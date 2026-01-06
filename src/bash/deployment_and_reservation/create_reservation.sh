#!/bin/bash
ram=$1
sto=$2
cpu=$3
os=$4

best_machine=$(select_host_machine "$ram" "$sto" "$cpu" 2>/dev/null)

if [ "$best_machine" != "null" ]; then
    res=$(curl -s "$best_machine/?ram=$ram&sto=$sto&cpu=$cpu&os=$os")
    echo "$res"
else
    echo "NO MACHINE CAN HOST"
    exit 1
fi