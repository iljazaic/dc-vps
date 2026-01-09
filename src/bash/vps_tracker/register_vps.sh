#! /bin/bash

#payment variables
subscription_id=$1
payment_id=$2
next_charge_date=$3
last_charge_date=$4
monthly_cost=$5

#spec variables
ram=$6
sto=$7
cpu=$8

#security variables
own_ssh_key=$9
cert_enabled=${10}

#personal information variables
vm_id=${11}
user_id=${12}
email=${13}

#networking variables
host_ip=${14}
local_ip=${15}
subdomain_names=${16}
tcp_forwards=${17}
mcp_enabled=${18}

mysql -u vps_manager -p pass vps_fence -e "INSERT INTO vps_instances(subscription_id,payment_id,next_charge_date,last_charge_date,monthly_cost,ram,sto,cpu,own_cert_key,cert_enabled,vm_id,user_id,email,host_ip,local_ip,subdimain_list,tcp_forwards,mcp_enabled) VALUES\
('$subscription_id','$payment_id','$next_charge_date','$last_charge_date','$monthly_cost','$ram','$sto','$cpu','$own_ssh_key','$cert_enabled','$vm_id','$user_id','$email','$host_ip','$local_ip','$subdomain_names','$tcp_forwards','$mcp_enabled');"

# Check if user exists in users table
user_exists=$(mysql -u vps_manager -p pass vps_fence -se "SELECT COUNT(*) FROM users WHERE user_id='$user_id' OR email='$email';")

# If user doesn't exist, create new user
if [ "$user_exists" -eq 0 ]; then
    mysql -u vps_manager -p pass vps_fence -e "INSERT INTO users(user_id, email) VALUES('$user_id', '$email');"
fi

# Add vm_id to user's vm_ids list
mysql -u vps_manager -p pass vps_fence -e "UPDATE users SET vm_ids = CONCAT_WS(',', COALESCE(vm_ids, ''), '$vm_id') WHERE user_id='$user_id';"