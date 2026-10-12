#!/bin/bash
cd "$(dirname "$0")"
node render.mjs video out/part1.mp4 30 0 30 > out/log1.txt 2>&1 &
node render.mjs video out/part2.mp4 30 30 60 > out/log2.txt 2>&1 &
node render.mjs video out/part3.mp4 30 60 90 > out/log3.txt 2>&1 &
wait
printf "file 'part1.mp4'\nfile 'part2.mp4'\nfile 'part3.mp4'\n" > out/list.txt
ffmpeg -y -f concat -safe 0 -i out/list.txt -c copy -movflags +faststart out/DS_mechanism.mp4 > out/concat.log 2>&1
echo DONE
