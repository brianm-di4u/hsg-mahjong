// Extracts the pure engine block (<script id="engine">) from index.html and checks every layout in Node:
// tile count, overlaps, support, and that seeded deals replay to an empty board. Run from the repo root:
//   node tools/check-layouts.mjs [deals-per-layout]
import { loadEngine } from './engine-load.mjs';

const E = loadEngine();
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
  let shaped = 0; // the Relaxed (-1) and Expert (1) deal shapes must replay to an empty board too
  for (const shape of [-1, 1]) for (let s = 1; s <= 5; s++) { const d = E.deal(g, E.makeRng(2000 + s), shape); if (d && E.planValid(g, new Array(g.n).fill(true), d.faces, d.plan)) shaped++; }
  if (errs.length || ok !== N || shaped !== 10) bad++;
  console.log(`${L.id.padEnd(10)} ${pos.length} tiles  errors: ${errs.join('; ') || 'none'}  deals replayed ${ok}/${N} (max ${ms.toFixed(1)} ms)  independent solver ${solved}/20  Relaxed and Expert deals ${shaped}/10`);
}
process.exit(bad ? 1 : 0);
