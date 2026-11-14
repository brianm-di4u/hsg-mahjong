// Balance probe: random-play win rate, free pairs and forced moves per layout and difficulty level, in Node.
// Extends the council's seat-3 probe with the three difficulty levels (the deal shape each one uses) and a layout filter.
//   node tools/balance.mjs [--n 150] [--level classic|relaxed|expert|all] [--layouts id,id] [--json]
import { loadEngine } from './engine-load.mjs';

const E = loadEngine();
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const N = +arg('n', 150);
const SHAPE = { relaxed: -1, classic: 0, expert: 1 }; // the deal shape each level passes to ENGINE.deal (see LEVELS in index.html)
const levels = arg('level', 'classic') === 'all' ? ['relaxed', 'classic', 'expert'] : [arg('level', 'classic')];
const only = arg('layouts', '') ? arg('layouts', '').split(',') : null;

function play(g, d, rng) {
  const present = new Array(g.n).fill(true), faces = d.faces;
  let left = g.n, moves = 0, sumFree = 0, noChoice = 0;
  while (left > 0) {
    const pairs = E.availablePairs(g, present, faces);
    if (!pairs.length) return { won: false, left, moves, avgFree: sumFree / Math.max(1, moves), noChoice };
    sumFree += pairs.length; if (pairs.length === 1) noChoice++;
    const pr = pairs[rng.int(pairs.length)];
    present[pr[0]] = present[pr[1]] = false; left -= 2; moves++;
  }
  return { won: true, left: 0, moves, avgFree: sumFree / moves, noChoice };
}

export function measure(L, level, n = N) {
  const g = E.buildGeometry(L.build());
  let won = 0, leftSum = 0, fSum = 0, nc = 0, open = 0, dealMs = 0, maxMs = 0;
  for (let s = 1; s <= n; s++) {
    const t0 = performance.now();
    const d = E.deal(g, E.makeRng(s * 7919), SHAPE[level]);
    const ms = performance.now() - t0; dealMs += ms; maxMs = Math.max(maxMs, ms);
    open += E.availablePairs(g, new Array(g.n).fill(true), d.faces).length;
    const r = play(g, d, E.makeRng(s + 99));
    if (r.won) won++; leftSum += r.left; fSum += r.avgFree; nc += r.noChoice;
  }
  return { layout: L.id, level, tiles: g.n, n, winRate: +(won / n).toFixed(3), openingPairs: +(open / n).toFixed(1), avgFreePairs: +(fSum / n).toFixed(1), avgForcedMoves: +(nc / n).toFixed(1), avgTilesLeftAtStuck: +(leftSum / n).toFixed(1), dealMsAvg: +(dealMs / n).toFixed(1), dealMsMax: +maxMs.toFixed(1) };
}

if (/balance\.mjs$/.test(process.argv[1] || '')) {
  const rows = [];
  for (const level of levels) for (const L of E.LAYOUTS) if (!only || only.includes(L.id)) rows.push(measure(L, level));
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else {
    console.log(['layout', 'level', 'tiles', 'win%', 'open', 'free', 'forced', 'stuckLeft', 'dealMs', 'max'].map((h) => h.padEnd(10)).join(''));
    for (const r of rows) console.log([r.layout, r.level, r.tiles, (r.winRate * 100).toFixed(1), r.openingPairs, r.avgFreePairs, r.avgForcedMoves, r.avgTilesLeftAtStuck, r.dealMsAvg, r.dealMsMax].map((v) => String(v).padEnd(10)).join(''));
  }
}
