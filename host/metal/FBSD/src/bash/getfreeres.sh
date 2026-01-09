#!/bin/bash

echo "Content-Type: text/plain"
echo ""

#get reserved stuff

#fallback in case smth goes wrong
#reserved_ram=$(mysql -u vps_host -p'pass' -D vps_host_local -N -s -e "SELECT SUM(ram) FROM reservations;")
#reserved_storage=$(mysql -u vps_host -p'pass' -D vps_host_local -N -s -e "SELECT SUM(storage) FROM reservations;")
#reserved_cpu=$(mysql -u vps_host -p'pass' -D vps_host_local -N -s -e "SELECT SUM(cpu) FROM reservations;")

#better way
read reserved_ram reserved_storage reserved_cpu < <(mysql -u vps_host -p'pass' -D vps_host_local -N -s -e "SELECT COALESCE(SUM(ram), 0), COALESCE(SUM(storage), 0), COALESCE(SUM(cpu), 0) FROM reservations;")


#make sure nothing is null

reserved_ram=${reserved_ram:-0}
reserved_storage=${reserved_storage:-0}
reserved_cpu=${reserved_cpu:-0}

#get the available stuff

storage=$(df -m / | tail -n 1 | tr -s ' ' | cut -d ' ' -f 4)
storage=$((storage / 1024))  # Convert MB to GB
ram=$(free -m | awk '/Mem:/ {print $4}')

#make sure nothing is null

ram=${ram:-0}
storage=${storage:-0}

#calculations

fr=$(($ram - reserved_ram))
fs=$(($storage - reserved_storage))
fc=$(echo "4.0 - $reserved_cpu" | bc -l)

if [ $fr -lt 0 ] || [ $fs -lt 0 ] || [ $(echo "$fc < 0" | bc -l) -eq 1 ]; then
	echo "-1"
	exit 1
fi

echo "ram:${fr};sto:${fs};cpu:${fc}"
