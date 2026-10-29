// Contrast, performance, size and load time (PRD AC32, AC34-AC36).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

export const tests = [
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
    name: 'performance, size and load',
    async run(t) {
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
