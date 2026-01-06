#!/bin/bash
if [ -z "$1" ]; then
    echo "ERROR: No ID provided"
    exit 1
fi
ip=$(mysql -u vps_admin -p'pass' -D vps_admin_db -N -s \
    -e "SELECT IP FROM RESERVATIONS WHERE ID=$1;" 2>&1)

# Check if query was successful
if [ $? -eq 0 ] && [ -n "$ip" ]; then
    echo "$ip"
else
    echo "ERROR: No reservation found or query failed"
    exit 1
fi