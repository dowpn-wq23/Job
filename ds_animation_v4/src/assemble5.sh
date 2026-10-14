#!/bin/bash
# cover(0.8s) + [orig 0-83s] + [re-rendered inset 83-135s] + [orig 135-145s]; org name + copyright overlay; audio delayed 0.8s
set -e
cd "$(dirname "$0")"
OUT=${1:-/home/user/Job/ds_animation_v4/DS_mechanism_v4.mp4}
ORG="drawtext=fontfile=/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc:text='대전세종충남본부 천안전력지사':fontsize=20:fontcolor=0x5f646b@0.55:x=w-tw-22:y=h-th-16"
ffmpeg -v error -y -loop 1 -framerate 30 -t 0.8 -i out5/cover.png -i out4/video_v3.mp4 -i out5/inset.mp4 \
  -i /home/user/Job/ds_animation_v4/audio/narration_bgm_mix.wav -i out5/copyright.png -ss 135 -i out4/video_v3.mp4 -filter_complex "
[0:v]format=yuv420p,setsar=1[cv];
[1:v]trim=end_frame=2490,setpts=PTS-STARTPTS[a];
[2:v]setpts=PTS-STARTPTS[b];
[5:v]trim=end_frame=300,setpts=PTS-STARTPTS[c];
[a][b][c]concat=n=3:v=1:a=0,$ORG[m0];
[m0][4:v]overlay=x=W-22-w+1:y=1066:format=auto,format=yuv420p,setsar=1[m];
[cv][m]concat=n=2:v=1:a=0[v];
[3:a]adelay=800|800,apad,atrim=end=145.8[au]" \
  -map "[v]" -map "[au]" -c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -movflags +faststart \
  -metadata copyright="(c) 2026 이도원" "$OUT"
