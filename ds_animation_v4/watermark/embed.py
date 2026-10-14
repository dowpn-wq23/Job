# Usage: python3 embed.py clean.mp4 out.mp4
# Adds the invisible '이도원' mark (luma, amplitude 1.0), the visible org name (bottom-right) and metadata.
import sys, os, numpy as np, subprocess as sp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import ssw
W, H = ssw.W, ssw.H; FS = W * H * 3 // 2
src, dst = sys.argv[1], sys.argv[2]
F = ssw.embed_field('이도원', 1.0)
rng = np.random.default_rng(7)
VF = ("drawtext=fontfile=/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc:text='대전세종충남본부 천안전력지사'"
      ":fontsize=20:fontcolor=0x5f646b@0.55:x=w-tw-22:y=h-th-16")
dec = sp.Popen(['ffmpeg', '-v', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'], stdout=sp.PIPE)
enc = sp.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', f'{W}x{H}', '-r', '30', '-i', '-',
                '-i', src, '-map', '0:v', '-map', '1:a', '-vf', VF, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium',
                '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart',
                '-metadata', 'artist=이도원', '-metadata', 'author=이도원', '-metadata', 'copyright=(c) 이도원',
                '-metadata', 'comment=Made by 이도원 / 대전세종충남본부 천안전력지사', dst], stdin=sp.PIPE)
n = 0
while True:
    b = dec.stdout.read(FS)
    if len(b) < FS: break
    f = np.frombuffer(b, np.uint8).copy()
    Y = f[:W * H].reshape(H, W).astype(np.float32)
    f[:W * H] = np.clip(np.floor(Y + F + rng.random((H, W), np.float32)), 0, 255).astype(np.uint8).ravel()
    enc.stdin.write(f.tobytes()); n += 1
enc.stdin.close(); enc.wait(); dec.wait()
print('frames', n)
