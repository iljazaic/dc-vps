#!/usr/local/bin/bash

mysql -u vps_host -p'pass' -D vps_host_local -N -s -e "DELETE FROM RESERVATIONS WHERE ID=$1" 2>&1 || echo "ERROR"
