// Contrast, performance, size and load time (PRD AC32, AC34-AC36).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const TESTS = [
  {
    name: 'contrast in the light theme',
    viewports: ['desktop'],
    async run(t) {
      const res = await t.game('act', 'contrast');
      t.equal(res.filter((c) => c.ratio < 4.5), [], 'all text pairs >= 4.5:1');
      t.log('lowest ratio: ' + Math.min(...res.map((c) => c.ratio)) + ' across ' + res.length + ' pairs');
    },
  },
  {
    // Tiles: Auto. On a real GPU that is 3D; the harness renders WebGL with SwiftShader (software), where Auto
    // must fall back to flat tiles, and that is what this measures. tools/perf-gpu.mjs measures 3D on a GPU.
    name: 'performance, size and load',
    url: 'index.html',
    async run(t) {
      const g0 = await t.state();
      t.log('WebGL renderer: ' + g0.glName + ' -> tiles ' + g0.gfx);
      if (/swiftshader|llvmpipe|software/i.test(g0.glName)) t.equal(g0.gfx, '2d', 'software WebGL falls back to flat tiles under Auto');
      t.expect(t.loadMs < 2000, 'hooks ready in ' + t.loadMs + ' ms');
      const bytes = fs.statSync(path.join(HERE, '..', 'index.html')).size;
      t.expect(bytes < 2 * 1024 * 1024, 'index.html is ' + bytes + ' bytes');
      await t.game('newGame', { layout: 'pyramid', seed: 1234 });
      const idle = await t.fps(1000);
      const pr = await t.game('act', 'hint');
      await t.game('act', 'match', pr[0], pr[1]);
      const fps = await t.fps(700);
      t.expect(fps >= 55, 'fps during the match animation: ' + fps);
      await t.shot('07-fps');
      const mem = await t.memoryMB();
      const deal = await t.page.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 20; i++) window.__game.act('composition', 'arlington', i); return (performance.now() - t0) / 20; });
      t.expect(deal < 50, 'deal generation ' + deal.toFixed(1) + ' ms');
      t.log(`load ${t.loadMs} ms, size ${(bytes / 1024).toFixed(0)} KB, idle rAF ${idle} fps, animating ${fps} fps, heap ${mem} MB, deal ${deal.toFixed(1)} ms`);
    },
  },
];
// 3D tiles are forced on (?gl=1): the harness's Chromium renders WebGL with SwiftShader, where Tiles: Auto
// would pick flat tiles. Tests that set their own url keep it.
export const tests = TESTS.map((x) => ({ url: 'index.html?gl=1', ...x }));
