// Opens the game straight from disk (file://), the way a player double-clicking index.html would, and checks that
// 3D tiles render with the painted faces and that nothing logs an error or leaves the machine.
//
//   node tools/check-file-url.mjs [out.png]
//
// ?gl=1 forces 3D, because the harness Chromium only has SwiftShader (Tiles: Auto would pick flat tiles there).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(GAME);
const { chromium } = await import(pathToFileURL(path.join(ROOT, 'shared', 'test-harness', 'node_modules', 'playwright', 'index.mjs')).href);
const out = process.argv[2];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], external = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) external.push(r.url()); });
await page.goto(pathToFileURL(path.join(GAME, 'index.html')).href + '?gl=1');
await page.waitForFunction(() => window.__game);
await page.evaluate(() => window.__game.newGame({ layout: 'pyramid', seed: 2026 }));
await page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 60000 });
const r = await page.evaluate(() => { const s = window.__game.getState(), a = window.__game.act('art'); return { gfx: s.gfx, loaded: a.loaded.length, bundle: !!window.MJ_ART_DATA }; });
if (out) await page.screenshot({ path: out });
await browser.close();

const ok = r.gfx === '3d' && r.loaded >= 30 && r.bundle && !errors.length && !external.length;
console.log(`file:// ${ok ? 'OK' : 'FAILED'}: tiles ${r.gfx}, ${r.loaded} art images decoded, data bundle ${r.bundle ? 'loaded' : 'missing'}, ${errors.length} console errors, ${external.length} non-file requests`);
for (const e of errors) console.log('  error:', e);
for (const u of external) console.log('  request:', u);
process.exit(ok ? 0 : 1);
