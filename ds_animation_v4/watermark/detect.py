# Usage: python3 detect.py video.mp4   -> prints the hidden mark (averages frames sampled across the video)
import sys, os, numpy as np, subprocess as sp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ssw
W, H = ssw.W, ssw.H
r = sp.run(['ffmpeg', '-v', 'error', '-i', sys.argv[1], '-vf', f'fps=2,scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
           capture_output=True).stdout
fr = np.frombuffer(r, np.uint8).reshape(-1, H, W)
s, sc = ssw.decode(fr, 9)
conf = np.abs(sc).min() / np.abs(sc).mean()
print(f'frames={len(fr)}  hidden mark: {s!r}  confidence={conf:.2f}')
