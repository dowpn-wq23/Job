#!/bin/bash
cd "$(dirname "$0")"
node render2.mjs video out2/part1.mp4 30 0 50 > out2/log1.txt 2>&1 &
node render2.mjs video out2/part2.mp4 30 50 97 > out2/log2.txt 2>&1 &
node render2.mjs video out2/part3.mp4 30 97 145 > out2/log3.txt 2>&1 &
wait
printf "file 'part1.mp4'\nfile 'part2.mp4'\nfile 'part3.mp4'\n" > out2/list.txt
ffmpeg -y -f concat -safe 0 -i out2/list.txt -c copy -movflags +faststart out2/DS_mechanism_v2.mp4 > out2/concat.log 2>&1
echo DONE
