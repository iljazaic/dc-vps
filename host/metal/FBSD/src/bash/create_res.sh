#!/usr/local/bin/bash

mysql -u vps_host -p'pass' -D vps_host_local -N -s -e "INSERT INTO RESERVATIONS(ID,DONE,TIMESTAMP,RAM,STO,CPU,USR) VALUES ($1,FALSE,'$2',$4,$5,$6,$7);" 2>&1 || echo "ERROR"
