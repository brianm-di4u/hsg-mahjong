// Extracts the pure engine block (<script id="engine">) from index.html and checks every layout in Node:
// tile count, overlaps, support, and that seeded deals replay to an empty board. Run from the repo root:
//   node games/mahjong/tools/check-layouts.mjs [deals-per-layout]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
const src = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + '\nthis.E = ENGINE;', ctx);
const E = ctx.E;
const N = +(process.argv[2] || 100);
let bad = 0;
for (const L of E.LAYOUTS) {
  const pos = L.build();
  const errs = E.validateLayout(pos);
  const g = E.buildGeometry(pos);
  let ok = 0, solved = 0, ms = 0;
  for (let s = 1; s <= N; s++) {
    const t0 = performance.now();
    const d = E.deal(g, E.makeRng(s));
    ms = Math.max(ms, performance.now() - t0);
    if (d && E.planValid(g, new Array(g.n).fill(true), d.faces, d.plan)) ok++;
  }
  for (let s = 1; s <= 20; s++) { const d = E.deal(g, E.makeRng(1000 + s)); if (E.solve(g, new Array(g.n).fill(true), d.faces, 25000)) solved++; }
  if (errs.length || ok !== N) bad++;
  console.log(`${L.id.padEnd(10)} ${pos.length} tiles  errors: ${errs.join('; ') || 'none'}  deals replayed ${ok}/${N} (max ${ms.toFixed(1)} ms)  independent solver ${solved}/20`);
}
process.exit(bad ? 1 : 0);
