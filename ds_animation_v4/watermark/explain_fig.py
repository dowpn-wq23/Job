import sys, numpy as np, subprocess as sp
sys.path.insert(0, '/home/user/Job/ds_animation_v4/watermark'); import ssw
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.colors import LinearSegmentedColormap, ListedColormap
from matplotlib.patches import Rectangle
from scipy.ndimage import gaussian_filter
fm.fontManager.addfont('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')
plt.rcParams['font.family'] = 'WenQuanYi Zen Hei'; plt.rcParams['axes.unicode_minus'] = False
W, H = 1920, 1080
FIN = '/home/user/Job/ds_animation_v4/DS_mechanism_v4.mp4'; CLN = '../wm/clean.mp4'
BLUE, ORNG, MID, INK, MUTED = '#2a6fdb', '#e8710a', '#efefec', '#1f2328', '#6b7078'
div = LinearSegmentedColormap.from_list('d', [ORNG, MID, BLUE])
def grab(src, t, fmt='rgb24'):
    c = 3 if fmt == 'rgb24' else 1
    r = sp.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', src, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', fmt, '-'], capture_output=True).stdout
    return np.frombuffer(r, np.uint8).reshape(H, W, c) if c == 3 else np.frombuffer(r, np.uint8).reshape(H, W)
T = 40
A, B = grab(CLN, T), grab(FIN, T)
diff = gaussian_filter(grab(FIN, T, 'gray').astype(float) - grab(CLN, T, 'gray').astype(float), 2)
F = ssw.embed_field('이도원', 1.0); bits = ssw.bits_of('이도원'); P, bm = ssw.pattern(72)
def scores(src):
    r = sp.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', 'fps=2', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    return ssw.decode(np.frombuffer(r, np.uint8).reshape(-1, H, W), 9)
sF, scF = scores(FIN); sC, scC = scores(CLN); nrm = np.abs(scF).mean()

fig = plt.figure(figsize=(16, 21), dpi=110, facecolor='white')
gs = fig.add_gridspec(5, 2, height_ratios=[1, 1, 0.55, 0.62, 0.9], hspace=0.42, wspace=0.08, left=0.04, right=0.97, top=0.895, bottom=0.04)
fig.suptitle("숨은 워터마크 '이도원' - 어디에, 어떻게 들어 있나", fontsize=24, color=INK, x=0.04, y=0.975, ha='left', fontweight='bold')
fig.text(0.04, 0.945, '영상 전체 화면의 밝기를 ±1단계(0~255 중) 이내로 아주 미세하게 바꿔서 글자를 숨겼습니다. 아래는 40초 지점 프레임 기준입니다.', fontsize=13, color=MUTED)
def title(ax, n, t, sub=None):
    ax.set_title(f'{n}  {t}', loc='left', fontsize=16, color=INK, fontweight='bold', pad=26 if sub else 8)
    if sub: ax.text(0, 1.015, sub, transform=ax.transAxes, fontsize=11.5, color=MUTED, va='bottom')
ax = fig.add_subplot(gs[0, 0]); ax.imshow(A); ax.axis('off'); title(ax, '①', '워터마크 넣기 전', '원본 프레임')
ax = fig.add_subplot(gs[0, 1]); ax.imshow(B); ax.axis('off'); title(ax, '②', '워터마크 넣은 후 (최종 영상)', '눈으로는 ①과 차이가 없음 · 우측 하단 기관명만 보이는 워터마크')
ax.add_patch(Rectangle((1560, 1035), 350, 40, fill=False, ec=BLUE, lw=2))
ax = fig.add_subplot(gs[1, 0]); im = ax.imshow(np.clip(diff, -1.2, 1.2), cmap=div, vmin=-1.2, vmax=1.2); ax.axis('off')
title(ax, '③', '② - ① 차이만 뽑아 80배 강조', '화면 전체에 얼룩 무늬로 퍼져 있음 (주황 = 1단계 어둡게, 파랑 = 1단계 밝게)')
zy, zx, zs = 384, 832, 256
ax.add_patch(Rectangle((zx, zy), zs, zs, fill=False, ec=INK, lw=2))
ax = fig.add_subplot(gs[1, 1]); ax.imshow(F[zy:zy+zs, zx:zx+zs], cmap=div, vmin=-1, vmax=1, extent=(0, zs, zs, 0)); ax.set_xticks([]); ax.set_yticks([])
title(ax, '④', '③의 네모 부분 확대 (32×32 화소 칸)', '칸마다 72개 비트 중 하나를 담당 · 숫자 = 비트 번호, 괄호 = 그 비트 값')
for i in range(0, zs + 1, 32):
    ax.axhline(i, color='white', lw=1.2); ax.axvline(i, color='white', lw=1.2)
for by in range(zs // 32):
    for bx in range(zs // 32):
        k = bm[zy + by * 32 + 16, zx + bx * 32 + 16]
        ax.text(bx * 32 + 16, by * 32 + 16, f'{k}\n({bits[k]})', ha='center', va='center', fontsize=8.5, color=INK,
                bbox=dict(boxstyle='round,pad=0.15', fc='white', ec='none', alpha=0.75))
# bits strip
ax = fig.add_subplot(gs[2, :]); ax.set_xlim(0, 72); ax.set_ylim(-1.6, 1.3); ax.axis('off')
title(ax, '⑤', "'이도원' → 컴퓨터 글자 코드(UTF-8, 9바이트) → 72개 비트", None)
for i, b in enumerate(bits):
    ax.add_patch(Rectangle((i + 0.06, 0), 0.88, 1, fc=BLUE if b else ORNG, ec='none'))
    ax.text(i + 0.5, 0.5, str(b), ha='center', va='center', color='white', fontsize=10, fontweight='bold')
    if i % 8 == 0: ax.text(i + 0.1, -0.25, f'#{i}', fontsize=8.5, color=MUTED, va='top')
for j, ch in enumerate('이도원'):
    x0 = j * 24; ax.plot([x0 + 0.2, x0 + 23.8], [-0.75, -0.75], color=INK, lw=1.5)
    ax.text(x0 + 12, -0.95, f"'{ch}'  (24비트)", ha='center', va='top', fontsize=14, color=INK, fontweight='bold')
ax.text(72, 1.12, '파랑 = 1 (해당 칸을 무늬 그대로)   주황 = 0 (무늬를 반전)', ha='right', fontsize=11.5, color=MUTED)
# where bit 0 lives
ax = fig.add_subplot(gs[3, 0]); g = (A.astype(float).mean(2) * 0.35 + 165).clip(0, 255)
ax.imshow(g, cmap='gray', vmin=0, vmax=255); ax.axis('off')
title(ax, '⑥', '비트 하나(#0)가 들어 있는 칸들', '같은 비트를 화면 곳곳 약 27칸에 흩어 저장 → 일부가 가려져도 복원 가능')
ys, xs = np.nonzero(bm[16::32, 16::32] == 0)
for y, x in zip(ys, xs): ax.add_patch(Rectangle((x * 32, y * 32), 32, 32, fc=BLUE, ec='white', lw=0.8, alpha=0.9))
ax = fig.add_subplot(gs[3, 1]); ax.axis('off')
title(ax, '⑦', '읽어 내는 원리', None)
txt = ('1. 영상에서 0.5초마다 프레임을 뽑습니다 (2분 25초 → 290장).\n'
       '2. 각 프레임에서 큰 형상(그림 내용)은 걸러 내고\n    미세한 얼룩만 남깁니다.\n'
       '3. 남은 얼룩을 비밀 열쇠로 만든 무늬와 칸별로 비교합니다.\n'
       '    무늬와 같으면 +, 반대면 - 점수.\n'
       '4. 290장의 점수를 모두 더하면 잡음은 상쇄되고\n    숨긴 신호만 쌓여서 72개 비트가 또렷해집니다 (⑧).\n'
       '5. 비트 → 글자로 바꾸면 \'이도원\'.')
ax.text(0, 0.92, txt, fontsize=13.5, color=INK, va='top', linespacing=1.6)
# scores
gs2 = gs[4, :].subgridspec(2, 1, hspace=0.55)
for r, (sc, lab, res) in enumerate([(scF, '최종 영상', sF), (scC, '워터마크 없는 영상 (비교)', sC)]):
    ax = fig.add_subplot(gs2[r]); v = sc / nrm
    ax.bar(np.arange(72), v, width=0.8, color=[BLUE if x > 0 else ORNG for x in v] if r == 0 else '#a9adb3')
    ax.axhline(0, color=INK, lw=0.8); ax.set_xlim(-0.8, 71.8); ax.set_ylim(-1.9, 1.9)
    for s in ['top', 'right']: ax.spines[s].set_visible(False)
    for s in ['left', 'bottom']: ax.spines[s].set_color('#c9ccd0')
    ax.tick_params(colors=MUTED, labelsize=9); ax.set_xticks(range(0, 72, 8)); ax.set_yticks([-1, 0, 1])
    ax.grid(axis='y', color='#ececea', lw=0.8); ax.set_axisbelow(True)
    shown = res if r == 0 else '알아볼 수 없음 (점수가 0 근처)'
    if r == 0: title(ax, '⑧', '실제 판독 점수 (비트 72개)', '막대가 0보다 위 = 1, 아래 = 0 → ⑤의 비트 배열과 정확히 일치')
    ax.text(0.0, 1.03 if r else 1.0, '', transform=ax.transAxes)
    ax.text(1.0, 0.97, f'{lab}: 판독 결과 → {shown}', transform=ax.transAxes, ha='right', va='top', fontsize=13,
            color=INK, fontweight='bold', bbox=dict(boxstyle='round,pad=0.3', fc='white', ec='#d5d7da'))
    if r == 1: ax.set_xlabel('비트 번호', color=MUTED, fontsize=11)
fig.savefig('/home/user/Job/ds_animation_v4/watermark/watermark_explained.png', facecolor='white')
print(sF, repr(sC))
