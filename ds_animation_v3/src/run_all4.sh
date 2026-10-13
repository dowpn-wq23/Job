#!/bin/bash
cd "$(dirname "$0")"
node render4.mjs video out4/part1.mp4 30 0 50 > out4/log1.txt 2>&1 &
node render4.mjs video out4/part2.mp4 30 50 97 > out4/log2.txt 2>&1 &
node render4.mjs video out4/part3.mp4 30 97 145 > out4/log3.txt 2>&1 &
wait
printf "file 'part1.mp4'\nfile 'part2.mp4'\nfile 'part3.mp4'\n" > out4/list.txt
ffmpeg -y -f concat -safe 0 -i out4/list.txt -c copy out4/video_v3.mp4 > out4/concat.log 2>&1
echo DONE > out4/DONE
