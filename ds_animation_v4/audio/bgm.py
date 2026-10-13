import numpy as np, soundfile as sf
sr=48000; T=146.0; N=int(T*sr); rng=np.random.default_rng(7)
L=np.zeros(N); R=np.zeros(N)
bpm=80; beat=60/bpm; bar=4*beat
def hz(m): return 440*2**((m-69)/12)
# progression (2 bars each): Fmaj9, G6/9, Em7, Am9  (key of C, calm/corporate)
chords=[[53,57,60,64,67],[55,59,62,64,69],[52,55,59,62,66-2+2],[57,60,64,67,71]]
chords[2]=[52,55,59,62,67]
bass=[41,43,40,45]
def env_adsr(n,a,r):
    e=np.ones(n); ai=int(a*sr); ri=int(r*sr)
    e[:ai]=np.linspace(0,1,ai); e[-ri:]*=np.linspace(1,0,ri); return e
def add(sig,t0,pan=0.0,g=1.0):
    a=int(t0*sr); b=min(N,a+len(sig)); s=sig[:b-a]*g
    L[a:b]+=s*np.sqrt(0.5*(1-pan)); R[a:b]+=s*np.sqrt(0.5*(1+pan))
def pad(notes,dur):
    n=int(dur*sr); t=np.arange(n)/sr; y=np.zeros(n)
    for m in notes:
        f=hz(m)
        for det in (-0.12,0.0,0.13):
            ff=f*2**(det/12)
            y+=np.sin(2*np.pi*ff*t+rng.uniform(0,6))+0.25*np.sin(2*np.pi*2*ff*t)+0.08*np.sin(2*np.pi*3*ff*t)
    y*=env_adsr(n,1.6,1.8)*(1+0.06*np.sin(2*np.pi*0.2*t))
    return y/len(notes)/3
def epiano(m,dur=1.6):
    n=int(dur*sr); t=np.arange(n)/sr; f=hz(m)
    y=(np.sin(2*np.pi*f*t)+0.45*np.sin(2*np.pi*2*f*t)*np.exp(-t/0.25)+0.15*np.sin(2*np.pi*4.01*f*t)*np.exp(-t/0.08))
    return y*np.exp(-t/0.55)*np.minimum(1,t/0.004)
def bassn(m,dur):
    n=int(dur*sr); t=np.arange(n)/sr; f=hz(m)
    return (np.sin(2*np.pi*f*t)+0.2*np.sin(2*np.pi*2*f*t))*env_adsr(n,0.05,0.6)
def tick(dur=0.06):
    n=int(dur*sr); x=rng.standard_normal(n)
    x=np.diff(np.concatenate([[0],x])); return x*np.exp(-np.arange(n)/sr/0.012)
t=0.0; k=0
while t<T:
    c=chords[k%4]; sec=2*bar
    add(pad(c,sec+2.0),t,0,0.55)
    add(bassn(bass[k%4],sec),t,0,0.30 if t>8 else 0.30*t/8)
    if t>=7.5:                      # gentle arpeggio
        seq=[c[1]+12,c[2]+12,c[3]+12,c[4]+12,c[3]+12,c[2]+12,c[4]+12,c[1]+24]
        for j in range(16):
            tt=t+j*beat/2
            if tt<T-3: add(epiano(seq[j%8]),tt,(-0.5 if j%2 else 0.5),0.10 if j%4 else 0.13)
    if 66.0<=t<136.0:              # tech pulse for the development part
        for j in range(16):
            tt=t+j*beat/2; add(tick(),tt,0.3,0.05 if j%2 else 0.08)
        for j in range(4):
            tt=t+j*bar/2; add(bassn(bass[k%4]+12,beat*0.9),tt,0,0.08)
    t+=sec; k+=1
# reverb: convolution with decaying stereo noise IR
ir_n=int(2.6*sr); ti=np.arange(ir_n)/sr
def conv(x,seed):
    ir=np.random.default_rng(seed).standard_normal(ir_n)*np.exp(-ti/0.75); ir[0]=0; ir/=np.sqrt(np.sum(ir**2))
    n=1<<int(np.ceil(np.log2(len(x)+ir_n)))
    return np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(ir,n),n)[:len(x)]
Lw=0.72*L+0.38*conv(L,1); Rw=0.72*R+0.38*conv(R,2)
y=np.stack([Lw,Rw],1)
# fades
fi=int(3*sr); fo=int(5*sr)
y[:fi]*=np.linspace(0,1,fi)[:,None]; y[N-fo:]*=np.linspace(1,0,fo)[:,None]
y/=np.max(np.abs(y))*1.12
sf.write('bgm_raw.wav',y[:int(145*sr)].astype(np.float32),sr)
print('ok')
