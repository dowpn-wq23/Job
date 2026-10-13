import json, numpy as np, soundfile as sf
S=json.load(open('timed2.json'))
sr=S[0]['sr']; T=145.0
out=np.zeros(int(T*sr)+sr, np.float32)
S[0]['t']=1.0; S[12]['t']=67.3
prev=0
log=[]
for i,s in enumerate(S):
    x,_=sf.read(f'n_{i:02d}.wav',dtype='float32')
    x=x/np.max(np.abs(x))*0.9
    t=max(s['t'], prev+0.15)
    a=int(t*sr); out[a:a+len(x)]+=x
    prev=t+len(x)/sr; log.append((i,round(t,2),round(prev,2)))
def chime(t0):
    n=int(1.6*sr); y=np.zeros(n,np.float32); tt=np.arange(n)/sr
    for k,(f,st) in enumerate([(659.25,0.0),(523.25,0.38)]):
        m=tt>=st; u=tt[m]-st
        tone=np.sin(2*np.pi*f*u)+0.35*np.sin(2*np.pi*2*f*u)+0.12*np.sin(2*np.pi*3.01*f*u)
        env=np.exp(-u/0.42)*np.minimum(1,u/0.004)
        y[m]+=tone*env
    y=y/np.max(np.abs(y))*0.28
    a=int(t0*sr); out[a:a+n]+=y
chime(0.0); chime(66.12)
sf.write('narration_raw.wav',out[:int(T*sr)],sr)
for l in log: print(l)
