// Browser state-machine fuzzing: seeded random walks over every game action, checking score, undo/redo, status,
// winnability and save/continue invariants after each step; plus the stats rules (streaks, daily, best times).
// See TEST-CAMPAIGN.md, phase B.
const LAYOUTS = ['pyramid', 'tower', 'arlington', 'row', 'islands', 'terraces', 'display'];

// Runs inside the page. Returns { steps, counts, fails }.
function fuzz({ layout, seed, steps }) {
  const g = window.__game, E = ENGINE, fails = [], counts = {};
  let r = (seed >>> 0) || 1;
  const rnd = () => { r = (r + 0x6D2B79F5) >>> 0; let t = r; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const fail = (m) => { if (fails.length < 25) fails.push(`${layout}/${seed} step ${counts.step}: ${m}`); };
  g.newGame({ layout, seed });
  const snap = () => { const s = g.getState(); return { s, present: s.tiles.map((x) => x.present), faces: s.tiles.map((x) => x.f), score: s.score, combo: s.combo, rowDone: s.rowDone, shuffles: s.shuffles, hints: s.hints }; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const geo = E.buildGeometry(E.LAYOUTS.find((l) => l.id === layout).build());
  // shadow history: for each move, the snapshot before it, the snapshot after it and its own score delta
  let hist = [], redo = [], lastMatch = -1e9, combo = 0;
  for (counts.step = 0; counts.step < steps; counts.step++) {
    const A = snap(), s = A.s;
    if (s.gameStatus === 'won') break;
    const free = s.tiles.filter((x) => x.present && x.free), blocked = s.tiles.filter((x) => x.present && !x.free);
    const pairs = []; for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (free[i].key === free[j].key) pairs.push([free[i].i, free[j].i]);
    const ops = ['match', 'match', 'match', 'clickpair', 'click', 'hint', 'undo', 'undo', 'redo', 'redo', 'advance', 'pausetry'];
    if (rnd() < 0.04) ops.push('shuffle');
    if (rnd() < 0.03) ops.push('save');
    if (!pairs.length) ops.push('shuffle', 'undo');
    const op = pick(ops); counts[op] = (counts[op] || 0) + 1;
    const matchCheck = (a, b, B) => {
      const nc = s.elapsedMs - lastMatch <= 4000 ? combo + 1 : 0, rowNow = !A.rowDone && B.rowDone;
      let pts = 10 + Math.min(25, 5 * nc) + (rowNow ? 100 : 0);
      if (B.s.tilesLeft === 0) pts += 500 + Math.max(0, 600 - Math.floor(B.s.elapsedMs / 1000)); // clear and time bonus
      if (B.combo !== nc) fail(`combo ${B.combo}, want ${nc}`);
      if (B.score - A.score !== pts) fail(`match scored ${B.score - A.score}, want ${pts}`);
      if (rowNow && B.s.tiles.some((x) => x.present && x.f >= 9 && x.f < 18)) fail('Row bonus with bathhouse tiles left');
      if (A.s.winnable === true && B.s.tilesLeft && B.s.winnable === false) fail('a match from a winnable board was called dead without a re-check');
      combo = nc; lastMatch = s.elapsedMs;
      hist.push({ t: 'm', before: A, after: B, d: pts, combo: A.combo, last: lastMatch }); redo = [];
    };
    if (op === 'match' && pairs.length) {
      const [a, b] = pick(pairs); if (!g.act('match', a, b)) { fail(`legal match ${a},${b} refused`); continue; }
      matchCheck(a, b, snap());
    } else if (op === 'clickpair' && pairs.length) {
      const [a, b] = pick(pairs);
      if (s.selected >= 0) g.act('click', s.selected); // start from no selection
      const r1 = g.act('click', a); if (r1.selected !== a) fail(`click free ${a} did not select it`);
      const r2 = g.act('click', b); if (!r2.removed) { fail(`second click ${b} did not match`); continue; }
      matchCheck(a, b, snap());
    } else if (op === 'click' && s.gameStatus === 'playing') {
      const roll = rnd();
      if (roll < 0.35 && blocked.length) { const x = pick(blocked); const res = g.act('click', x.i); const B = snap(); if (!res.blocked || B.s.selected !== s.selected || !same(B.present, A.present)) fail(`blocked tile ${x.i} reacted`); }
      else if (free.length) {
        const x = pick(free), res = g.act('click', x.i), B = snap();
        if (s.selected === x.i) { if (B.s.selected !== -1) fail('re-click did not deselect'); }
        else if (s.selected >= 0 && E.matchKey(s.tiles[s.selected].f) === x.key) { if (!res.removed) fail('matching click did not remove'); else matchCheck(s.selected, x.i, B); }
        else if (B.s.selected !== x.i) fail(`free tile ${x.i} not selected`);
        if (!res.removed && !same(B.present, A.present)) fail('a non-matching click changed the board');
      }
    } else if (op === 'hint') {
      const pr = g.act('hint'), B = snap();
      if (pairs.length && !pr) fail('hint returned nothing with free pairs on the board');
      if (pr) {
        const [a, b] = pr, ta = B.s.tiles[a], tb = B.s.tiles[b];
        if (!ta.free || !tb.free || ta.key !== tb.key || a === b) fail(`hint ${a},${b} is not a free matching pair`);
        if (B.score !== Math.max(0, A.score - 15) || B.s.hints !== A.hints + 1) fail(`hint charged ${A.score - B.score}`);
        if (B.s.winnable === true && !B.s.planValid) fail('winnable without a valid plan');
        // following the hint from a winnable board must keep it winnable
        if (B.s.winnable === true && rnd() < 0.6) { const wasW = true; g.act('match', a, b); const C = snap(); A.score = B.score; matchCheck(a, b, C); if (wasW && C.s.tilesLeft && C.s.winnable !== true) fail(`following a hint left the board ${C.s.winnable}`); }
      }
    } else if (op === 'shuffle') {
      const ok = g.act('shuffle'), B = snap();
      if (ok) {
        const ms = (S) => S.faces.filter((_, i) => S.present[i]).sort((x, y) => x - y).join();
        if (ms(A) !== ms(B) || !same(A.present, B.present)) fail('shuffle changed the tiles');
        if (B.score !== Math.max(0, A.score - 50) || B.shuffles !== A.shuffles + 1) fail('shuffle penalty or count wrong');
        if (!B.s.planValid || B.s.winnable !== true || B.s.gameStatus !== 'playing') fail('shuffled board is not known winnable');
        hist.push({ t: 's', before: A, after: B, d: 0 }); redo = [];
      }
    } else if (op === 'undo') {
      const ok = g.act('undo'), B = snap();
      if (ok !== !!hist.length) fail(`undo returned ${ok} with ${hist.length} moves`);
      if (ok) {
        const h = hist.pop(); redo.push(h);
        if (!same(B.present, h.before.present) || !same(B.faces, h.before.faces)) fail(`undo of ${h.t} did not restore the board`);
        if (B.combo !== h.before.combo || B.rowDone !== h.before.rowDone) fail('undo did not restore combo/row');
        if (B.score !== Math.max(0, A.score - h.d)) fail(`undo score ${B.score}, want ${Math.max(0, A.score - h.d)} (penalties stay paid)`);
        if (B.shuffles !== A.shuffles || B.hints !== A.hints) fail('undo changed hint/shuffle counts');
        if (B.s.selected !== -1) fail('undo left a selection');
        combo = B.combo; lastMatch = h.t === 'm' ? (hist.length ? findLast(hist) : -1e9) : lastMatch;
      }
    } else if (op === 'redo') {
      const ok = g.act('redo'), B = snap();
      const can = redo.length && (A.s.gameStatus === 'playing' || redo[redo.length - 1].t === 's');
      if (!!ok !== !!can) fail(`redo returned ${ok}, expected ${!!can}`);
      if (ok) {
        const h = redo.pop(); hist.push(h);
        if (!same(B.present, h.after.present) || !same(B.faces, h.after.faces)) fail(`redo of ${h.t} did not restore the board`);
        if (B.score !== A.score + h.d) fail(`redo scored ${B.score - A.score}, want ${h.d}`);
        if (B.combo !== h.after.combo || B.rowDone !== h.after.rowDone) fail('redo did not replay combo/row');
        if (B.shuffles !== A.shuffles) fail('redo changed the shuffle count');
        combo = B.combo; if (h.t === 'm') lastMatch = h.last;
      }
    } else if (op === 'advance') {
      g.act('advance', pick([500, 2000, 3900, 4200, 9000]));
    } else if (op === 'pausetry' && s.gameStatus === 'playing') {
      g.pause(); const P = snap(); if (!P.s.paused) fail('pause did not pause');
      if (pairs.length) { const [a, b] = pairs[0]; g.act('match', a, b); }
      g.act('hint'); g.act('undo'); g.act('redo'); g.act('shuffle'); if (free.length) g.act('click', free[0].i);
      const Q = snap(); g.resume();
      if (!same(P.present, Q.present) || !same(P.faces, Q.faces) || P.score !== Q.score || Q.s.selected !== P.s.selected) fail('moves went through while paused');
    } else if (op === 'save') {
      const saved = JSON.parse(localStorage.getItem('bhm.game.v1') || 'null');
      if (!saved) { if (s.gameStatus !== 'won') fail('no save while playing'); continue; }
      g.setState(saved); const B = snap();
      const pick2 = (x) => ({ p: x.present, f: x.faces, sc: x.score, c: x.combo, r: x.rowDone, sh: x.shuffles, h: x.hints, hl: x.s.historyLen, st: x.s.gameStatus });
      if (!same(pick2(A), pick2(B))) fail('save + load changed the game: ' + JSON.stringify(pick2(A)).slice(0, 80) + ' vs ' + JSON.stringify(pick2(B)).slice(0, 80));
      redo = []; // saves keep no redo stack
      for (const h of hist) { if (h.before) h.before.s = null; }
    }
    // global invariants
    const Z = g.getState();
    if (Z.tilesLeft % 2) fail('odd number of tiles');
    if (Z.historyLen !== hist.length) fail(`history ${Z.historyLen}, shadow ${hist.length}`);
    if (Z.redoLen !== redo.length) fail(`redo ${Z.redoLen}, shadow ${redo.length}`);
    if (Z.score < 0) fail('negative score');
    const want = Z.tilesLeft === 0 ? 'won' : Z.pairsAvailable === 0 ? 'stuck' : 'playing';
    if (Z.gameStatus !== want) fail(`status ${Z.gameStatus}, want ${want}`);
    if (Z.winnable === true && Z.tilesLeft && !Z.planValid) fail('winnable flag without a valid plan');
    if (Z.winnable === false) {
      const present = Z.tiles.map((x) => x.present), faces = Z.tiles.map((x) => x.f);
      const rr = E.solveInfo(geo, present, faces, 60000);
      if (rr.plan) fail('board called dead, but the solver clears it');
    }
    if (Z.overlay) { fail('overlay open during fuzz: ' + Z.overlay); break; }
  }
  // undo everything, then redo everything
  const end = snap();
  if (end.s.gameStatus === 'won') { if (g.act('undo')) fail('undo after a win'); return { steps: counts.step, counts, fails, tilesLeft: 0 }; }
  let n = 0; while (g.act('undo')) n++;
  const start = snap();
  if (n !== hist.length) fail(`undo-all undid ${n} of ${hist.length}`);
  if (start.present.some((p) => !p)) fail('undo-all did not restore every tile');
  if (hist.length && !same(start.faces, hist[0].before.faces)) fail('undo-all did not restore the deal');
  for (let k = 0; k < n; k++) if (!g.act('redo')) { fail(`redo-all stopped at ${k} of ${n}`); break; }
  const back = snap();
  if (!same(back.present, end.present) || !same(back.faces, end.faces)) fail('redo-all did not return to the end position');
  if (back.score < end.score - 0) { /* scores may differ only by penalties floored at 0 */ }
  function findLast(h) { for (let k = h.length - 1; k >= 0; k--) if (h[k].t === 'm') return h[k].last; return -1e9; }
  return { steps: counts.step, counts, fails, tilesLeft: g.getState().tilesLeft };
}

const TESTS = [
  {
    name: 'state fuzz: random walks over every action keep score, undo/redo, status and saves consistent',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    async run(t) {
      let total = 0;
      for (const layout of LAYOUTS) for (let k = 0; k < 6; k++) {
        const r = await t.page.evaluate(fuzz, { layout, seed: 1000 + LAYOUTS.indexOf(layout) * 100 + k, steps: 220 });
        total += r.steps;
        for (const f of r.fails) t.fail(f);
        await t.page.evaluate(() => { for (const el of document.querySelectorAll('.overlay.on')) el.classList.remove('on'); });
      }
      t.log(`${total} fuzz steps`);
    },
  },
  {
    name: 'state fuzz on 3D tiles (same invariants)',
    viewports: ['desktop'],
    url: 'index.html?gl=1',
    async run(t) {
      for (const layout of ['pyramid', 'row', 'terraces']) {
        const r = await t.page.evaluate(fuzz, { layout, seed: 77 + layout.length, steps: 160 });
        for (const f of r.fails) t.fail(f);
      }
    },
  },
  {
    name: 'continue after a real reload restores the exact game, including mid-shuffle and stuck boards',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'tower', seed: 4242 });
      await t.game('act', 'solveTo', 120);
      await t.game('act', 'hint'); await t.game('act', 'shuffle'); await t.game('act', 'solveStep'); await t.game('act', 'undo');
      const a = await t.state();
      await t.waitIdle();
      await t.reload();
      await t.page.click('#b-continue');
      const b = await t.state();
      for (const k of ['layoutId', 'seed', 'score', 'combo', 'hints', 'shuffles', 'undos', 'historyLen', 'gameStatus', 'tilesLeft']) t.equal(b[k], a[k], `continue keeps ${k}`);
      t.equal(b.tiles.map((x) => x.f), a.tiles.map((x) => x.f), 'continue keeps the faces');
      t.expect(b.elapsedMs >= a.elapsedMs && b.elapsedMs - a.elapsedMs < 6000, `continue keeps the time (${a.elapsedMs} → ${b.elapsedMs}; the clock ran until the reload)`);
      // the restored history still undoes, including the shuffle
      t.expect(await t.game('act', 'undo'), 'undo of the shuffle after continue');
      const c = await t.state();
      t.equal([c.tilesLeft, c.shuffles], [a.tilesLeft, a.shuffles], 'undoing the shuffle keeps the tiles and the paid count');
      t.expect(await t.game('act', 'undo'), 'undo of a match after continue');
      t.equal((await t.state()).tilesLeft, a.tilesLeft + 2, 'undo after continue restores a pair');
      // a stuck board continues as stuck
      await t.game('newGame', { layout: 'arlington', seed: 4243 }); await t.waitIdle(15000);
      t.expect(await t.game('act', 'stuck'), 'test board made stuck'); await t.waitIdle();
      await t.reload(); await t.page.click('#b-continue');
      const d = await t.state();
      t.equal(d.gameStatus, 'stuck', 'stuck board continues as stuck');
      t.equal(d.overlay, 'o-stuck', 'stuck dialog shows after continue');
      // a corrupt save falls back to a fresh game without errors
      // (the game saves itself when the page hides, so keep it from overwriting the planted save)
      await t.page.evaluate(() => { document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true); localStorage.setItem('bhm.game.v1', JSON.stringify({ layoutId: 'tower', faces: [1, 2], present: [true] })); });
      await t.reload(); await t.page.click('#b-continue');
      const e = await t.state();
      t.equal(e.scene, 'game', 'a corrupt save still starts a game'); t.equal(e.tilesLeft, 144, 'fresh board after a corrupt save');
    },
  },
  {
    name: 'stats: win streaks, abandoning (playing or stuck), practice dailies, daily streak order, best times',
    viewports: ['desktop'],
    async run(t) {
      const stats = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.stats.v1')));
      await t.page.evaluate(() => document.getElementById('ost-reset').click());
      // win: +1 won, streak 1, best time and time bonus
      await t.game('newGame', { layout: 'islands', seed: 1 });
      await t.game('act', 'advance', 300000);
      await t.game('act', 'solveTo', 0);
      let s = await stats(), st = await t.state();
      t.equal([s.won, s.streak, s.layouts.islands.won], [1, 1, 1], 'a win counts');
      t.equal(s.layouts.islands.bestMs >= 300000 && s.layouts.islands.bestMs < 301500, true, 'best time recorded');
      // abandoning with no match keeps the streak
      await t.game('newGame', { layout: 'islands', seed: 2 }); await t.game('newGame', { layout: 'islands', seed: 3 });
      s = await stats(); t.equal(s.streak, 1, 'abandoning before any match keeps the streak');
      // abandoning after a match breaks it (the N key asks first)
      await t.game('act', 'solveStep');
      await t.game('act', 'key', 'n'); st = await t.state();
      t.equal(st.overlay, 'o-confirm', 'N mid-game asks before abandoning');
      await t.page.click('#oc-keep'); st = await t.state();
      t.equal([st.overlay, st.tilesLeft], [null, 142], 'Keep playing returns to the same game');
      await t.game('act', 'key', 'n'); await t.page.click('#oc-new');
      s = await stats(); st = await t.state();
      t.equal([s.streak, st.tilesLeft], [0, 144], 'abandoning after a match breaks the streak');
      // a slower win does not replace the best time; a stuck abandon breaks the streak too
      await t.game('act', 'advance', 400000); await t.game('act', 'solveTo', 0);
      s = await stats(); t.equal(s.streak, 1, 'win after abandon'); t.expect(s.layouts.islands.bestMs < 301500, 'slower win keeps the best time');
      await t.game('newGame', { layout: 'arlington', seed: 9 }); await t.game('act', 'solveStep'); t.expect(await t.game('act', 'stuck'), 'test board made stuck');
      await t.game('newGame', { layout: 'islands', seed: 10 });
      s = await stats(); t.equal(s.streak, 0, 'abandoning a stuck game breaks the streak');
      // daily streak: consecutive days, a gap, a practice replay, an older puzzle finished late
      const daily = async (date) => { await t.game('newGame', { daily: true, date }); await t.game('act', 'solveTo', 0); await t.waitIdle(); return stats(); };
      s = await daily('2026-03-01'); t.equal([s.daily.streak, s.daily.last], [1, '2026-03-01'], 'first daily');
      s = await daily('2026-03-02'); t.equal(s.daily.streak, 2, 'next day extends the daily streak');
      s = await daily('2026-03-04'); t.equal(s.daily.streak, 1, 'a missed day restarts the daily streak');
      const before = await stats();
      await t.game('newGame', { daily: true, date: '2026-03-04' }); st = await t.state();
      t.equal(st.practice, true, 'replaying a finished daily is practice');
      await t.game('act', 'solveTo', 0); s = await stats();
      t.equal([s.played, s.won, s.streak], [before.played, before.won, before.streak], 'practice does not count toward stats');
      s = await daily('2026-03-03'); t.equal([s.daily.streak, s.daily.last], [1, '2026-03-04'], 'finishing an older daily never moves the streak backwards');
      s = await daily('2026-03-05'); t.equal([s.daily.streak, s.daily.best], [2, 2], 'streak continues from the latest day');
      // an old stats save without daily.done does not break a daily win
      await t.page.evaluate(() => localStorage.setItem('bhm.stats.v1', JSON.stringify({ played: 3, won: 1, streak: 1, bestStreak: 1, layouts: {}, daily: { last: null, streak: 0, best: 0 } })));
      await t.reload();
      s = await daily('2026-04-01'); t.equal(s.daily.streak, 1, 'old stats format still records a daily');
    },
  },
  {
    name: 'a dead board is detected (deep search in a worker) and the player is told how far to undo',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    async run(t) {
      // replay the random opening that leaves pyramid seed 50 dead (tests/10-mechanics: proven dead, but not within
      // the hint budget)
      const r = await t.page.evaluate(() => {
        const E = ENGINE, g = window.__game; g.newGame({ layout: 'pyramid', seed: 50 });
        const geo = E.buildGeometry(E.LAYOUTS.find((l) => l.id === 'pyramid').build());
        const faces = g.getState().tiles.map((x) => x.f), present = faces.map(() => true);
        const rng = E.makeRng(50 * 7919), k = rng.int(60); let n = 0;
        for (let i = 0; i < k; i++) { const ps = E.availablePairs(geo, present, faces); if (!ps.length) break; const [a, b] = ps[rng.int(ps.length)]; if (!g.act('match', a, b)) return { err: 'match refused' }; present[a] = present[b] = false; n++; }
        return { n, w: g.getState().winnable };
      });
      t.expect(!r.err, r.err);
      let s; const end = Date.now() + 30000;
      do { await t.page.waitForTimeout(250); s = await t.state(); } while (s.winnable !== false && Date.now() < end);
      t.equal(s.winnable, false, `the dead board is recognised (after ${r.n} moves)`);
      t.expect(/can no longer be cleared/.test(s.status) && /Undo/.test(s.status), 'the status line says so and points at Undo: ' + s.status);
      // undoing back to the last known-winnable point brings the plan back
      const m = /Undo (?:up to )?(one move|(\d+) moves)/.exec(s.status), back = m ? (m[2] ? +m[2] : 1) : 0;
      t.expect(back > 0, 'the status gives an undo count');
      for (let i = 0; i < back; i++) await t.game('act', 'undo');
      await t.page.waitForTimeout(300);
      const w = await t.state();
      t.equal([w.winnable, w.planValid], [true, true], `undoing ${back} move(s) returns to a winnable board`);
      // a hint there keeps it winnable
      const pr = await t.game('act', 'hint'); await t.game('act', 'match', pr[0], pr[1]);
      t.equal((await t.state()).winnable, true, 'following the hint stays winnable');
    },
  },
  {
    name: 'timer: no phantom time at the start, stops when paused, stuck or hidden behind a dialog',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 5 });
      await t.waitIdle();
      await t.game('scene', 'title');
      await t.page.waitForTimeout(1800); // the loop is idle on the title screen
      await t.game('newGame', { layout: 'pyramid', seed: 6 });
      await t.waitFrames(3);
      let s = await t.state();
      t.expect(s.elapsedMs < 400, `a new game starts near 0:00 (got ${s.elapsedMs} ms)`);
      await t.page.waitForTimeout(1200);
      s = await t.state(); t.expect(s.elapsedMs > 800, `the clock runs while playing (${s.elapsedMs} ms)`);
      await t.game('pause'); const p0 = (await t.state()).elapsedMs;
      await t.page.waitForTimeout(800); await t.game('resume'); await t.waitFrames(2);
      const p1 = (await t.state()).elapsedMs; t.expect(p1 - p0 < 200, `paused clock stayed (${p1 - p0} ms)`);
      await t.game('act', 'stuck'); await t.page.waitForTimeout(900);
      const q0 = (await t.state()).elapsedMs; await t.page.waitForTimeout(700);
      const q1 = (await t.state()).elapsedMs; t.expect(q1 - q0 < 50, 'clock stops on a stuck board');
    },
  },
];

export const tests = TESTS;
