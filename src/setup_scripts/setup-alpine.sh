#! /bin/bash

#RUN WITH SUDO/ROOT/DOAS

#setup user and db
mysql -u root -e "CREATE USER 'vps-admin'@'*' IDENTIFIED BY 'vps-admin-password';" && \
mysql -u root -e "CREATE DATABASE vps_db;" && \
mysql -u root -e "GRANT ALL PRIVILEGES ON vps_db.* TO 'vps-admin'@'*';" && \
mysql -u root -e "FLUSH PRIVILEGES;" && \

#setup necessary tables
mysql -u root vps_db -e "CREATE TABLE reservations (ID INT PRIMARY KEY , IP VARCHAR(32), ISPAID BOOLEAN);"
mysql -u root vps_db -e "CREATE TABLE subdomains (USERID INT PRIMARY KEY , SUBDOMAIN VARCHAR(255), CREATED DATETIME, ADDRESS_BIND VARCHAR(35));"
mysql -u root appdb -e "CREATE TABLE tcp-records (PORT INT, IP VARCHAR(32), VMID VARCHAR(64));"
mysql -u root appdb -e "CREATE TABLE userinfo (ID INT PRIMARY KEY , EMAIL VARCHAR(255));"
mysql -u root appdb -e "CREATE TABLE vpstracker (ID INT PRIMARY KEY , IP VARCHAR(32), OWNER_EMAIL VARCHAR(255), SPECS VARCHAR(100));"


#get dependencies for webserver
apk add --no-cache nodejs npm && \
npm install -g pm2 && \
pm2 start ../facade/server.js --name "vps-facade"

#install the .iso files for all the distros
set -e

CDROM_DIR="../../lib/cdrom"
ISO_LIST="$CDROM_DIR/.iso_manifest"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[ISO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

mkdir -p "$CDROM_DIR"

# ISO definitions: name|url|filename
declare -A ISOS=(
    ["alpine"]="https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-standard-3.19.1-x86_64.iso|alpine.iso"
    ["ubuntu"]="https://releases.ubuntu.com/24.04/ubuntu-24.04.1-live-server-amd64.iso|ubuntu.iso"
    ["debian"]="https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-12.8.0-amd64-netinst.iso|debian.iso"
    ["arch"]="https://mirror.rackspace.com/archlinux/iso/latest/archlinux-x86_64.iso|arch.iso"
    ["fedora"]="https://download.fedoraproject.org/pub/fedora/linux/releases/41/Server/x86_64/iso/Fedora-Server-dvd-x86_64-41-1.4.iso|fedora.iso"
)

download_iso() {
    local name=$1
    local url="${ISOS[$name]%|*}"
    local filename="${ISOS[$name]##*|}"
    local filepath="$CDROM_DIR/$filename"
    
    if [[ -f "$filepath" ]]; then
        warn "$name ISO already exists: $filename"
        return 0
    fi
    
    log "Downloading $name..."
    if curl -L --progress-bar "$url" -o "$filepath"; then
        log "$name downloaded: $filename"
        echo "$name|$filepath" >> "$ISO_LIST"
        return 0
    else
        warn "Failed to download $name"
        return 1
    fi
}

get_iso_path() {
    local distro=$1
    local filename="${ISOS[$distro]##*|}"
    echo "$CDROM_DIR/$filename"
}

list_isos() {
    log "Available ISOs for VM creation:"
    for distro in "${!ISOS[@]}"; do
        local filepath=$(get_iso_path "$distro")
        if [[ -f "$filepath" ]]; then
            local size=$(du -h "$filepath" | cut -f1)
            echo "  - $distro: $filepath ($size)"
        else
            echo "  - $distro: [NOT DOWNLOADED]"
        fi
    done
}

download_all() {
    log "Downloading all ISOs..."
    > "$ISO_LIST"  # Clear manifest
    
    for distro in alpine ubuntu debian arch fedora; do
        download_iso "$distro"
    done
    
    log "Download complete!"
}

# Main command handler
case "${1:-download}" in
    download)
        if [[ -n "$2" ]]; then
            download_iso "$2"
        else
            download_all
        fi
        ;;
    list)
        list_isos
        ;;
    path)
        if [[ -z "$2" ]]; then
            echo "Usage: $0 path <distro>"
            exit 1
        fi
        get_iso_path "$2"
        ;;
    clean)
        log "Removing all ISOs..."
        rm -f "$CDROM_DIR"/*.iso "$ISO_LIST"
        log "Cleaned!"
        ;;
    *)
        echo "VM Cluster ISO Manager"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  download [distro]  Download all ISOs or specific distro"
        echo "  list              List available ISOs"
        echo "  path <distro>     Get path to ISO for VM creation"
        echo "  clean             Remove all downloaded ISOs"
        echo ""
        echo "Available distros: alpine, ubuntu, debian, arch, fedora"
        echo ""
        echo "Example VM creation:"
        echo "  ISO=\$(./setup_isos.sh path ubuntu)"
        echo "  qemu-system-x86_64 -cdrom \$ISO ..."
        ;;
esac



