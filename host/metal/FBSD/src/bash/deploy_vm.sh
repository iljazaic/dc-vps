#!/usr/local/bin/bash

# Configuration
VM_NAME="$1"
RAM="${2:-2048}"
CPU="${3:-2}"
BASE_IMAGE="$4"
SSH_KEY_FILE="${5:-$HOME/.ssh/id_rsa.pub}"
OS="$6"



INIT_CMD=$(cat "../../../lib/init_scripts/${OS}")

# Network configuration - /16 subnet for 65k IPs
SUBNET_PREFIX="10.0"
HOST_IP="${SUBNET_PREFIX}.0.1"
BRIDGE="bridge0"
IP_LEASE_FILE="/var/db/vm_ip_leases.txt"

# Create lease file if it doesn't exist
touch "$IP_LEASE_FILE"

# Function to generate random IP in /16 range
get_random_ip() {
    local prefix="$1"
    local octet3=$((RANDOM % 256))
    local octet4=$((RANDOM % 254 + 1))
    echo "${prefix}.${octet3}.${octet4}"
}

# Function to allocate IP
allocate_ip() {
    local vm_name="$1"
    local lease_file="$2"
    
    if grep -q "^${vm_name} " "$lease_file"; then
        grep "^${vm_name} " "$lease_file" | awk '{print $2}'
        return 0
    fi
    
    local new_ip
    local max_attempts=100
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        new_ip=$(get_random_ip "$SUBNET_PREFIX")
        
        if ! grep -q " ${new_ip} " "$lease_file"; then
            echo "${vm_name} ${new_ip} $(date +%s)" >> "$lease_file"
            echo "$new_ip"
            return 0
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo "Error: Could not allocate IP after $max_attempts attempts" >&2
    return 1
}

# Get or allocate IP for this VM
if grep -q "^${VM_NAME} " "$IP_LEASE_FILE"; then
    VM_IP=$(grep "^${VM_NAME} " "$IP_LEASE_FILE" | awk '{print $2}')
    echo "Using existing IP for $VM_NAME: $VM_IP"
else
    VM_IP=$(allocate_ip "$VM_NAME" "$IP_LEASE_FILE")
    if [ $? -ne 0 ]; then
        echo "Error: Could not allocate IP"
        exit 1
    fi
    echo "Allocated new IP for $VM_NAME: $VM_IP"
fi

# Generate unique tap interface name
TAP_ID=$(echo -n "$VM_NAME" | md5 | cut -c1-4 | tr 'a-f' '0-9' | sed 's/^0*//')
TAP_ID=$((TAP_ID % 1000))
TAP="tap${TAP_ID}"

# Convert qcow2 to raw for bhyve (bhyve doesn't support qcow2)
VM_DISK="/vms/${VM_NAME}.img"
mkdir -p /vms

if [ ! -f "$VM_DISK" ]; then
    echo "Converting base image to raw format for bhyve..."
    qemu-img convert -f qcow2 -O raw "$BASE_IMAGE" "$VM_DISK"
    # Resize to 20G
    truncate -s 20G "$VM_DISK"
fi

# Read SSH public key
SSH_PUB_KEY=$(cat "$SSH_KEY_FILE")

# init config
CLOUD_INIT_DIR="/tmp/cloud-init-${VM_NAME}"
mkdir -p "$CLOUD_INIT_DIR"

cat > "${CLOUD_INIT_DIR}/meta-data" <<EOF
instance-id: ${VM_NAME}
local-hostname: ${VM_NAME}
EOF

cat > "${CLOUD_INIT_DIR}/user-data" <<EOF
#cloud-config

hostname: ${VM_NAME}
fqdn: ${VM_NAME}.local

users:
  - name: admin
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    ssh_authorized_keys:
      - ${SSH_PUB_KEY}

write_files:
  - path: /etc/netplan/01-netcfg.yaml
    content: |
      network:
        version: 2
        ethernets:
          ens3:
            addresses:
              - ${VM_IP}/16
            routes:
              - to: default
                via: ${HOST_IP}
            nameservers:
              addresses:
                - 8.8.8.8
                - 8.8.4.4
    permissions: '0644'

runcmd:
    ${INIT_CMD}

final_message: "VM ${VM_NAME} ready at ${VM_IP}"
EOF

cat > "${CLOUD_INIT_DIR}/network-config" <<EOF
version: 2
ethernets:
  ens3:
    addresses:
      - ${VM_IP}/16
    routes:
      - to: default
        via: ${HOST_IP}
    nameservers:
      addresses:
        - 8.8.8.8
        - 8.8.4.4
EOF

# Create cloud-init ISO
CLOUD_INIT_ISO="/tmp/cloud-init-${VM_NAME}.iso"
mkisofs -output "$CLOUD_INIT_ISO" \
    -volid cidata -joliet -rock \
    "${CLOUD_INIT_DIR}/user-data" \
    "${CLOUD_INIT_DIR}/meta-data" \
    "${CLOUD_INIT_DIR}/network-config" 2>/dev/null

# Cleanup function
cleanup() {
    bhyvectl --destroy --vm="$VM_NAME" 2>/dev/null
    rm -f "$CLOUD_INIT_ISO"
    rm -rf "$CLOUD_INIT_DIR"
}
trap cleanup EXIT

# Load kernel modules
kldload -n vmm if_tap if_bridge 2>/dev/null

# Setup networking
ifconfig "$TAP" create 2>/dev/null
ifconfig "$TAP" up

if ! ifconfig "$BRIDGE" >/dev/null 2>&1; then
    ifconfig "$BRIDGE" create
    ifconfig "$BRIDGE" inet "${HOST_IP}/16" up
fi
ifconfig "$BRIDGE" addm "$TAP" 2>/dev/null

# Enable forwarding and NAT
sysctl net.inet.ip.forwarding=1 >/dev/null
EXT_IF=$(route -n get default 2>/dev/null | grep interface | awk '{print $2}')

if [ -n "$EXT_IF" ]; then
    cat > /tmp/pf_vms.conf <<EOF
nat on $EXT_IF from ${SUBNET_PREFIX}.0.0/16 to any -> ($EXT_IF)
pass all
EOF
    pfctl -f /tmp/pf_vms.conf 2>/dev/null
    pfctl -e 2>/dev/null
fi

# Destroy existing VM
bhyvectl --destroy --vm="$VM_NAME" 2>/dev/null

echo "=========================================="
echo "VM Name: $VM_NAME"
echo "VM IP: $VM_IP"
echo "Host IP: $HOST_IP"
echo "Subnet: ${SUBNET_PREFIX}.0.0/16"
echo "Connect: ssh admin@${VM_IP}"
echo "=========================================="

# Check if grub-bhyve is installed (needed for Linux VMs)
if ! command -v grub-bhyve >/dev/null 2>&1; then
    echo "Error: grub-bhyve not installed. Install with: pkg install grub2-bhyve"
    exit 1
fi

# Boot Linux VM with grub-bhyve
cat > /tmp/device_${VM_NAME}.map <<EOF
(hd0) $VM_DISK
(cd0) $CLOUD_INIT_ISO
EOF

# Use grub to boot (this will drop into grub shell - needs automation)
# For automated boot, we need to create a grub config
cat > /tmp/grub_${VM_NAME}.cfg <<EOF
set root=(cd0)
linux (hd0,msdos1)/boot/vmlinuz root=/dev/vda1 console=ttyS0
initrd (hd0,msdos1)/boot/initrd.img
boot
EOF

# Load VM with grub
grub-bhyve -m /tmp/device_${VM_NAME}.map -r hd0,msdos1 -M ${RAM}M -c /tmp/grub_${VM_NAME}.cfg "$VM_NAME"

# Run bhyve
bhyve -c ${CPU} -m ${RAM}M -H -A -P \
    -s 0,hostbridge \
    -s 1,lpc \
    -s 2,virtio-blk,"$VM_DISK" \
    -s 3,virtio-blk,"$CLOUD_INIT_ISO" \
    -s 4,virtio-net,"$TAP" \
    -s 31,lpc \
    -l com1,stdio \
    "$VM_NAME" &

BHYVE_PID=$!
echo "bhyve PID: $BHYVE_PID"
echo "VM started. Detaching... (VM runs in background)"

# Don't cleanup tap/bridge - VM is still running
trap - EXIT