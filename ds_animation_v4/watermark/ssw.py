# Invisible spread-spectrum watermark on the luma plane (yuv420p, 1920x1080).
# A smooth (blurred) key-derived ±1 pattern, signed per message bit, is added at sub-JND amplitude.
# Detection averages many frames, removes image content with a high-pass, and correlates.
import numpy as np, hashlib
from scipy.ndimage import gaussian_filter, uniform_filter
W, H = 1920, 1080
KEY = 'DS-GIS-2026'
CHIP, BLK, SIG, HPK, CLIP = 16, 32, 4.0, 17, 1.0
def bits_of(msg):
    return np.unpackbits(np.frombuffer(msg.encode('utf-8'), np.uint8)).astype(np.int8)
def pattern(nbits):
    rng = np.random.default_rng(int.from_bytes(hashlib.sha256(KEY.encode()).digest()[:8], 'little'))
    ch = rng.choice([-1, 1], size=(H // CHIP + 1, W // CHIP + 1)).astype(np.float32)
    P = gaussian_filter(np.kron(ch, np.ones((CHIP, CHIP), np.float32))[:H, :W], SIG)
    P /= np.abs(P).max()
    by, bx = H // BLK, W // BLK
    assign = rng.permutation(by * bx) % nbits
    bm = np.full((H, W), -1, np.int32)
    bm[:by * BLK, :bx * BLK] = np.kron(assign.reshape(by, bx), np.ones((BLK, BLK), np.int32))
    return P, bm
def embed_field(msg, amp):
    b = bits_of(msg); P, bm = pattern(len(b))
    s = np.where(bm >= 0, 2 * b[np.clip(bm, 0, None)] - 1, 0).astype(np.float32)
    return gaussian_filter(amp * P * s, 1.5)          # soften bit-block borders too
def decode(frames, nbytes):
    """frames: iterable of luma arrays (H,W). Soft scores are summed over frames."""
    nb = nbytes * 8; P, bm = pattern(nb); m = bm >= 0; sc = np.zeros(nb)
    for Y in frames:
        Y = np.asarray(Y, np.float32)
        hp = np.clip(Y - uniform_filter(Y, HPK), -CLIP, CLIP) * P   # clip: image edges must not dominate
        sc += np.bincount(bm[m], weights=hp[m], minlength=nb)
    return np.packbits((sc > 0).astype(np.uint8)).tobytes().decode('utf-8', 'replace'), sc
