#!/bin/bash
ram=$1
sto=$2
cpu=$3
os=$4
best_host="null"
best_score=0
valid_hosts="../../../lib/net/valid_hosts"

while IFS= read -r line
do
    can_host=true
    host="$line"
    res=$(curl -s "$host")
    IFS=';' read -ra el <<< "$res"
    score=0
    
    for i in "${el[@]}"; do
        IFS=':' read -ra val <<< "$i"
        var_name="${val[0]}"
        available="${val[1]}"
        required="${!var_name}"
        
        # check if can host
        if (( $(bc -l <<< "$required > $available") )); then
            can_host=false
            break
        fi
        
        # evaluate against current best
        if [ "$var_name" = "ram" ]; then
            # ram is reported in mb, in the 1000s, high weight
            score=$((score + ${val[1]}))
        elif [ "$var_name" = "sto" ]; then
            # storage reported in gb, in the 100s, low weight
            score=$((score + ${val[1]} / 2))
        else
            # cpu is 0.0 to 4.0 therefore multiply by 1000
            score=$(bc -l <<< "$score + 1000 * ${val[1]}")
        fi
    done
    
    if [ "$can_host" = true ] && [ $score -gt $best_score ]; then
        best_score=$score
        best_host="$host"
    fi
done < "$valid_hosts"

echo "$best_host"