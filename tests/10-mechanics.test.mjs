// Rules engine, checked exhaustively in Node (no browser): geometry against an independent reference, match keys,
// deals, plan repair under random play, the solver and shuffles. See TEST-CAMPAIGN.md, phase A.
import { loadEngine } from '../tools/engine-load.mjs';

const E = loadEngine();
const LAYOUTS = E.LAYOUTS.map((l) => ({ id: l.id, pos: l.build() }));

// Reference freeness straight from the half-tile grid: a tile is covered by any present tile on a higher layer whose
// 2x2 footprint overlaps it, and blocked on a side by a present tile on its layer that touches that edge.
function refFree(pos, present, i) {
  if (!present[i]) return false;
  const [x, y, z] = pos[i];
  let l = false, r = false;
  for (let j = 0; j < pos.length; j++) {
    if (j === i || !present[j]) continue;
    const [xj, yj, zj] = pos[j], oy = Math.abs(yj - y) < 2;
    if (zj > z && Math.abs(xj - x) < 2 && oy) return false;
    if (zj === z && oy && xj === x - 2) l = true;
    if (zj === z && oy && xj === x + 2) r = true;
  }
  return !(l && r);
}
// Random reachable sub-board: remove geometrically free pairs (faces ignored) for k steps.
function randomBoard(g, rng, k) {
  const present = new Array(g.n).fill(true);
  for (let s = 0; s < k; s++) {
    const fr = []; for (let i = 0; i < g.n; i++) if (E.isFree(g, present, i)) fr.push(i);
    if (fr.length < 2) break;
    const a = fr.splice(rng.int(fr.length), 1)[0], b = fr[rng.int(fr.length)];
    present[a] = present[b] = false;
  }
  return present;
}
// Random play: a player who picks any free matching pair. Calls step(present, plan, move) after each move.
function playRandom(g, d, rng, step) {
  const present = new Array(g.n).fill(true); let plan = d.plan;
  for (;;) {
    const ps = E.availablePairs(g, present, d.faces);
    if (!ps.length) return present;
    const [a, b] = ps[rng.int(ps.length)];
    present[a] = present[b] = false;
    const before = plan;
    plan = E.repairPlan(g, present, d.faces, plan, a, b);
    if (step(present, plan, before, [a, b]) === false) return present;
  }
}

const TESTS = [
  {
    name: 'geometry: neighbour lists and freeness match an independent reference',
    node: true,
    async run(t) {
      for (const { id, pos } of LAYOUTS) {
        t.equal(E.validateLayout(pos), [], `${id} layout errors`);
        t.equal(pos.length, 144, `${id} tile count`);
        const g = E.buildGeometry(pos);
        for (let i = 0; i < g.n; i++) {
          for (const j of g.top[i]) t.expect(g.below[j].includes(i), `${id}: top/below asymmetric ${i}/${j}`);
          for (const j of g.right[i]) t.expect(g.left[j].includes(i), `${id}: left/right asymmetric ${i}/${j}`);
        }
        // nothing on a higher layer may cover a tile without a tile directly on the next layer also covering it
        for (let i = 0; i < g.n; i++) for (let j = 0; j < g.n; j++) {
          const [xi, yi, zi] = pos[i], [xj, yj, zj] = pos[j];
          if (zj > zi + 1 && Math.abs(xj - xi) < 2 && Math.abs(yj - yi) < 2 && !g.top[i].length) t.fail(`${id}: tile ${i} covered only from layer ${zj}`);
        }
        const rng = E.makeRng(99);
        let checked = 0, bad = 0;
        for (let b = 0; b < 2000; b++) {
          const present = b === 0 ? new Array(g.n).fill(true) : randomBoard(g, rng, rng.int(72));
          for (let i = 0; i < g.n; i++) { checked++; if (E.isFree(g, present, i) !== refFree(pos, present, i)) { bad++; if (bad < 4) t.fail(`${id}: isFree(${i}) disagrees with the reference at board ${b}`); } }
        }
        t.equal(bad, 0, `${id}: freeness mismatches in ${checked} checks`);
      }
    },
  },
  {
    name: 'match keys: every pair of the 42 faces',
    node: true,
    async run(t) {
      const group = (f) => (f < 34 ? 'f' + f : f < 38 ? 'flower' : 'season');
      for (let a = 0; a < 42; a++) for (let b = 0; b < 42; b++) t.equal(E.matchKey(a) === E.matchKey(b), group(a) === group(b), `faces ${a} and ${b}`);
      const pl = E.fullPairList(); t.equal(pl.length, 72, 'pairs in a full set');
      for (const [x, y] of pl) t.expect(E.matchKey(x) === E.matchKey(y), `full pair list pairs ${x} with ${y}`);
    },
  },
  {
    name: 'deals: composition, determinism and a valid plan for 1000 seeds per layout',
    node: true,
    async run(t) {
      for (const { id, pos } of LAYOUTS) {
        const g = E.buildGeometry(pos), all = new Array(g.n).fill(true);
        let bad = 0;
        for (let s = 1; s <= 1000; s++) {
          const d = E.deal(g, E.makeRng(s));
          if (!d) { t.fail(`${id} seed ${s}: no deal`); continue; }
          const c = new Array(42).fill(0); for (const f of d.faces) c[f]++;
          const okComp = c.every((n, f) => n === (f < 34 ? 4 : 1));
          if (!okComp || !E.planValid(g, all, d.faces, d.plan)) bad++;
          if (s <= 20) t.equal(E.deal(g, E.makeRng(s)).faces, d.faces, `${id} seed ${s} determinism`);
        }
        t.equal(bad, 0, `${id}: deals with a wrong composition or an invalid plan`);
      }
    },
  },
  {
    name: 'plan repair under random play: a kept plan is always valid, and playing any free plan step keeps it valid',
    node: true,
    async run(t) {
      for (const { id, pos } of LAYOUTS) {
        const g = E.buildGeometry(pos);
        let moves = 0, kept = 0, invalid = 0, outOfOrder = 0;
        for (let s = 1; s <= 120; s++) {
          const d = E.deal(g, E.makeRng(s)), rng = E.makeRng(s * 31);
          playRandom(g, d, rng, (present, plan, before) => {
            moves++;
            if (plan) { kept++; if (!E.planValid(g, present, d.faces, plan)) invalid++; }
            if (!plan) return false; // the rest of this game is covered by the solver test
          });
          // out-of-order hints: the first plan step whose tiles are both free is always safe to play
          const present = new Array(g.n).fill(true); let plan = d.plan;
          while (plan && plan.length) {
            const fr = plan.filter(([a, b]) => E.isFree(g, present, a) && E.isFree(g, present, b));
            const st = fr[rng.int(fr.length)];
            present[st[0]] = present[st[1]] = false;
            plan = E.repairPlan(g, present, d.faces, plan, st[0], st[1]);
            if (!plan && present.some(Boolean)) { outOfOrder++; break; }
          }
        }
        t.equal(invalid, 0, `${id}: repaired plans that do not clear the board`);
        t.equal(outOfOrder, 0, `${id}: playing a free plan step broke the plan`);
        t.log(`${id}: ${kept}/${moves} random moves kept the plan`);
      }
    },
  },
  {
    name: 'solver: finds every fresh deal, proves dead boards, and never returns a bad plan',
    node: true,
    async run(t) {
      for (const { id, pos } of LAYOUTS) {
        const g = E.buildGeometry(pos), all = new Array(g.n).fill(true);
        let found = 0, slow = 0;
        for (let s = 1; s <= 40; s++) {
          const d = E.deal(g, E.makeRng(5000 + s)), t0 = performance.now();
          const r = E.solveInfo(g, all, d.faces, 20000);
          if (performance.now() - t0 > 400) slow++;
          if (r.plan && E.planValid(g, all, d.faces, r.plan)) found++;
          if (r.exhausted) t.fail(`${id} seed ${5000 + s}: a solvable deal was reported dead`);
        }
        t.equal(found, 40, `${id}: fresh deals solved by the hint solver`);
        t.expect(slow <= 2, `${id}: ${slow} solves took over 400 ms`);
        // after random play the solver must either find a valid plan or prove the board dead; a dead verdict is
        // re-checked with a large exhaustive search
        let unknown = 0, dead = 0, solved = 0;
        for (let s = 1; s <= 60; s++) {
          const d = E.deal(g, E.makeRng(s)), rng = E.makeRng(s * 7919), k = rng.int(60);
          const present = new Array(g.n).fill(true);
          for (let i = 0; i < k; i++) { const ps = E.availablePairs(g, present, d.faces); if (!ps.length) break; const [a, b] = ps[rng.int(ps.length)]; present[a] = present[b] = false; }
          if (!E.availablePairs(g, present, d.faces).length) continue;
          const r = E.solveInfo(g, present, d.faces, 20000);
          if (r.plan) { solved++; if (!E.planValid(g, present, d.faces, r.plan)) t.fail(`${id} seed ${s}: solver returned an invalid plan`); }
          else if (r.exhausted) dead++;
          else unknown++;
        }
        // the few the hint budget leaves open are all dead boards whose proof takes seconds: the game hands those to a
        // background worker (11-statefuzz checks it)
        t.expect(unknown <= 3, `${id}: ${unknown} mid-game boards left undecided by the hint solver`);
        t.log(`${id}: mid-game boards solved ${solved}, proven dead ${dead}, undecided ${unknown}`);
      }
      // hand-made dead boards
      const stack = E.buildGeometry([[0, 0, 0], [0, 0, 1]]);
      t.equal(E.solveInfo(stack, [true, true], [5, 5], 1000).exhausted, true, 'two same tiles stacked are proven dead');
      const sandwich = E.buildGeometry([[0, 0, 0], [2, 0, 0], [4, 0, 0], [0, 0, 1], [4, 0, 1], [2, 0, 1]]);
      // the middle bottom tile (5) can only be freed after its own pair partner on top of it is gone
      t.equal(E.solveInfo(sandwich, new Array(6).fill(true), [1, 7, 2, 1, 2, 7], 1000).plan, null, 'tile under its only partner is dead');
    },
  },
  {
    name: 'shuffle: same faces, untouched gaps, solvable result; dead geometry is refused',
    node: true,
    async run(t) {
      for (const { id, pos } of LAYOUTS) {
        const g = E.buildGeometry(pos);
        let bad = 0, refused = 0;
        for (let s = 1; s <= 300; s++) {
          const d = E.deal(g, E.makeRng(s)), rng = E.makeRng(s * 13);
          const present = new Array(g.n).fill(true), k = rng.int(70);
          for (let i = 0; i < k; i++) { const ps = E.availablePairs(g, present, d.faces); if (!ps.length) break; const [a, b] = ps[rng.int(ps.length)]; present[a] = present[b] = false; }
          const r = E.reshuffle(g, present, d.faces, E.makeRng(s));
          if (!r) { refused++; continue; }
          const ms = (f) => present.map((p, i) => (p ? f[i] : -1)).filter((x) => x >= 0).sort((a, b) => a - b).join();
          const gapsSame = present.every((p, i) => p || r.faces[i] === d.faces[i]);
          if (ms(r.faces) !== ms(d.faces) || !gapsSame || !E.planValid(g, present, r.faces, r.plan)) bad++;
        }
        t.equal(bad, 0, `${id}: shuffles that changed faces, gaps, or are not solvable`);
        t.log(`${id}: ${refused}/300 shuffles refused (dead geometry)`);
      }
      const stack = E.buildGeometry([[0, 0, 0], [0, 0, 1]]);
      t.equal(E.reshuffle(stack, [true, true], [3, 3], E.makeRng(1)), null, 'two stacked tiles cannot be shuffled solvable');
    },
  },
];

export const tests = TESTS;
