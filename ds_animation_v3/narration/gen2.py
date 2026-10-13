from st import *
import json
tts=make()
S=json.load(open('script.json'))
import sys
ONLY=[int(a) for a in sys.argv[1:]]
T2=json.load(open('timed2.json'))
for i,s in enumerate(S):
    if ONLY and i not in ONLY: S[i]=T2[i]; continue
    win=s['end']-s['t']
    for sp in [0.95,1.0,1.05]:
        x,sr=gen(tts,s['text'],1,speed=sp,steps=16)
        # trim leading/trailing silence
        a=np.abs(x); th=0.01*a.max(); idx=np.where(a>th)[0]; x=x[max(0,idx[0]-int(0.03*sr)):idx[-1]+int(0.08*sr)]
        d=len(x)/sr
        if d<=win: break
    sf.write(f'n_{i:02d}.wav',x,sr); s['dur']=d; s['speed']=sp; s['sr']=sr
    print(f"{i:02d} t={s['t']:6.1f} win={win:4.1f} dur={d:4.2f} sp={sp}{' OVER' if d>win else ''}")
json.dump(S,open('timed2.json','w'),ensure_ascii=False,indent=1)
