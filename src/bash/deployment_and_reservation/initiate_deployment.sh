#! /bin/bash

id=$1
ip=$2

if [ -z "$1" ] || [ -z "$2"]; then
    echo "ERROR: No ID or IP provided"
    exit 1
fi

res=$(curl -s "$ip/deploy_reservation?id=$id")
echo "$res"

