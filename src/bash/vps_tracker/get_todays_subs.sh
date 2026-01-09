#! /bin/bash

SUBSCRIPTIONS=$(mysql -u vps_manager -p pass vps_fence -e "SELECT subscription_id FROM subscriptions WHERE DAY(date_column) = DAY(CURDATE()) AND MONTH(date_column) = MONTH(CURDATE()) AND YEAR(date_column) = YEAR(CURDATE());" -N)

for subscription in $SUBSCRIPTIONS; do
    echo "$subscription"
done