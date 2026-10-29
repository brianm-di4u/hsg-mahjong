// Frame-rate check for the 3D board on the machine's real GPU (the test harness renders WebGL with SwiftShader).
//
//   node games/mahjong/tools/perf-gpu.mjs [--cpu 4]       (--cpu N throttles the CPU N times, like a slow phone)
//
// Serves the repo on a local port, opens the game in headless Chromium with GPU flags, and for each viewport
// measures rAF frame times while the busiest scenes animate: the deal, a match, a shuffle, and a hint pulse.
// Prints fps (mean and 5th-percentile), load time, JS heap and transferred bytes. Needs the harness's Playwright.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'shared', 'test-harness', 'node_modules', 'playwright', 'index.mjs')).href);
const cpu = +(process.argv[process.argv.indexOf('--cpu') + 1] || 1) || 1;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
let bytes = 0;
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  const buf = fs.readFileSync(f); bytes += buf.length;
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(buf);
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const port = server.address().port;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });

const VIEWPORTS = { desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true } };
for (const [vp, opts] of Object.entries(VIEWPORTS)) {
  bytes = 0;
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (cpu > 1) { const s = await ctx.newCDPSession(page); await s.send('Emulation.setCPUThrottlingRate', { rate: cpu }); }
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/games/mahjong/index.html`);
  await page.waitForFunction(() => window.__game);
  const load = Date.now() - t0;
  await page.waitForTimeout(1500); // a player looks at the title for a moment; the game warms the 3D renderer then
  const layout = vp === 'mobile' ? 'terraces' : 'arlington';
  const r = await page.evaluate(async (layout) => {
    const g = window.__game, frames = (ms) => new Promise((res) => { const d = []; let last = performance.now(); const end = last + ms; const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(d); }; requestAnimationFrame(f); });
    const stat = (d) => { const s = d.slice(2).sort((a, b) => a - b); const mean = s.reduce((a, b) => a + b, 0) / s.length; return { fps: +(1000 / mean).toFixed(1), p5: +(1000 / s[Math.floor(s.length * 0.95)]).toFixed(1), worstMs: +s[s.length - 1].toFixed(1) }; };
    const t1 = performance.now(); g.newGame({ layout, seed: 77 }); const deal = stat(await frames(1100)); const newGameMs = performance.now() - t1;
    const pr = g.act('hint'); const hint = stat(await frames(900));
    g.act('match', pr[0], pr[1]); const match = stat(await frames(1200));
    g.act('shuffle'); const shuffle = stat(await frames(1000));
    const st = g.getState();
    return { gfx: st.gfx, gl: st.glName, tileW: st.tileW, deal, hint, match, shuffle, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, newGameMs: Math.round(newGameMs) };
  }, layout);
  console.log(`\n[${vp}${cpu > 1 ? ', CPU x' + cpu : ''}] ${layout}: ${r.gfx} on ${r.gl}`);
  console.log(`  load ${load} ms, ${(bytes / 1024).toFixed(0)} KB transferred, heap ${r.heapMB} MB, tile ${r.tileW} px`);
  for (const k of ['deal', 'hint', 'match', 'shuffle']) console.log(`  ${k.padEnd(8)} ${String(r[k].fps).padStart(6)} fps  (5th pct ${r[k].p5} fps, worst frame ${r[k].worstMs} ms)`);
  if (errors.length) console.log('  console errors:', errors);
  await ctx.close();
}
await browser.close();
server.close();
