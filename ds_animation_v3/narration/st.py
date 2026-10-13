import sys, sherpa_onnx, soundfile as sf, numpy as np
D='sherpa-onnx-supertonic-3-tts-int8-2026-05-11'
def make():
    c=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
        duration_predictor=f'{D}/duration_predictor.int8.onnx',text_encoder=f'{D}/text_encoder.int8.onnx',vector_estimator=f'{D}/vector_estimator.int8.onnx',
        vocoder=f'{D}/vocoder.int8.onnx',tts_json=f'{D}/tts.json',unicode_indexer=f'{D}/unicode_indexer.bin',voice_style=f'{D}/voice.bin'),num_threads=3,provider='cpu'))
    return sherpa_onnx.OfflineTts(c)
def gen(tts,text,sid,speed=1.0,steps=16):
    g=sherpa_onnx.GenerationConfig(); g.sid=sid; g.num_steps=steps; g.speed=speed; g.extra['lang']='ko'
    a=tts.generate(text,g); return np.array(a.samples,dtype=np.float32), a.sample_rate
