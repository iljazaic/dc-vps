#!/bin/bash

mysql -u vps_admin -p'pass' -D vps_admin_db -N -s \
    -e "INSERT INTO RESERVATIONS(ID,IP) VALUES ($1,'$2');" 2>&1

if [ $? -eq 0 ]; then
    echo "Insert successful"
else
    echo "ERROR: Insert failed"
fi