// usage: node render.mjs stills 5,12,22   |   node render.mjs video out.mp4 [fps] [t0] [t1]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });

const mode = process.argv[2];
const outDir = path.join(ROOT, 'out');
fs.mkdirSync(outDir, { recursive: true });

async function frame(t, q) {
  const url = await page.evaluate(([t, q]) => window.renderAt(t, q), [t, q]);
  return Buffer.from(url.split(',')[1], 'base64');
}

if (mode === 'stills') {
  for (const s of process.argv[3].split(',')) {
    const t = parseFloat(s);
    const t0 = Date.now();
    const buf = await frame(t, 0.9);
    fs.writeFileSync(path.join(outDir, `still_${s.padStart(5, '0')}.jpg`), buf);
    console.log('still', s, Date.now() - t0, 'ms');
  }
} else if (mode === 'video') {
  const out = process.argv[3], fps = +(process.argv[4] || 30), T0 = +(process.argv[5] || 0), T1 = +(process.argv[6] || 90);
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((T1 - T0) * fps);
  const st = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await frame(T0 + i / fps, 0.95);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - st) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
await browser.close();
server.close();
