#!/bin/bash

osname=$1
ram=$2
storage=$3
cpu=$4
image=$5
vmid=$6
port=$7
ownkey=$8
cert=$9
certupdate=$10

# Generate SSH keypair
KEY_DIR="./vm_keys/${osname}_${vmid}"
mkdir -p "$KEY_DIR"
if [ $ownkey = false ]; then
    ssh-keygen -t ed25519 -f "$KEY_DIR/id_ed25519" -N "" -C "vm-${vmid}"
fi

#save private key
PRIVATE_KEY=$(cat "$KEY_DIR/id_ed25519")

FINGERPRINT=$(ssh-keygen -l -E sha256 -f "$KEY_DIR/id_ed25519" | awk '{print $2}')
#echo "Fingerprint: $FINGERPRINT"

qemu-system-x86_64 -m "$ram" -cdrom "../${osname}.iso" -drive file="$image" -vnc 127.0.0.1:1 -netdev user,id=net1,hostfwd=tcp::"$port"-:22 -device e1000,netdev=net1 -smp "$cpu"

QEMU_PID=$!
echo "QEMU started with PID $QEMU_PID"

# Wait for VM to boot (adjust timing as needed)
sleep 30

# Inject the public key into the VM
# This assumes you have default credentials for your prebuilt image
VM_USER="root"  # or whatever user exists in your image
VM_PASS="password"  # default password in your prebuilt image

sshpass -p "$VM_PASS" ssh -o StrictHostKeyChecking=no -p 2222 ${VM_USER}@localhost << 'ENDSSH'
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Mount the shared folder and copy the key
mkdir -p /mnt/hostkeys
mount -t 9p -o trans=virtio hostkeys /mnt/hostkeys
cat /mnt/hostkeys/id_ed25519.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
umount /mnt/hostkeys
# Optionally disable password auth
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
ENDSSH

echo "SSH key injected successfully!"
echo "Connect with: ssh -i $KEY_DIR/id_ed25519 -p ${port} ${VM_USER}@localhost"
