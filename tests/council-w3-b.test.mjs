// Council wave 3, batch B: difficulty, progression and records (S3-05, S3-07, S3-08, S4-07, P-N02, S3-03, S3-06).
// Tests read the game through window.__game; the game clock is moved with act('advance') so no result depends on real time.
const URL = 'index.html?gl=0';
const stored = (t, k) => t.page.evaluate((k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, k);
const put = (t, k, v) => t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v]);
const reload = async (t) => { await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000); };
// plays n pairs from the stored solution, each after `sec` seconds on the game clock (no combo when sec > 4)
const play = async (t, n, sec = 10) => { for (let i = 0; i < n; i++) { await t.game('act', 'advance', sec * 1000); await t.game('act', 'solveStep'); } };
// what the win card says once it is open: each score row as [label, value], the subtitle and the total
const winCard = async (t) => {
  await t.page.waitForSelector('#o-win.on', { timeout: 15000 });
  return t.page.evaluate(() => {
    const c = [...document.querySelectorAll('#ow-grid > span')].map((s) => s.textContent), rows = [];
    for (let i = 0; i + 1 < c.length; i += 2) rows.push([c[i], c[i + 1]]);
    return { rows, sub: document.getElementById('ow-sub').textContent, earned: document.getElementById('ow-earned').innerText };
  });
};
const num = (v) => +String(v).replace('−', '-').replace(/,/g, '');
const par = (tiles) => tiles / 2 * 6000;
const rowOf = (c, label) => (c.rows.find((r) => r[0].startsWith(label)) || [])[1];

export const tests = [
  // ------------------------------------------------------------------ S3-05
  {
    name: 'S3-05: a Classic hint costs 40, and an undo costs 10 after the first three (Relaxed stays free)',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await play(t, 20);
      let s = await t.state();
      const before = s.score;
      t.expect(before >= 200, 'twenty pairs score at least 200 (' + before + '), enough that no penalty is cut short by the floor at 0');
      await t.game('act', 'hint'); s = await t.state();
      t.equal([s.score, s.fee.hint], [before - 40, 40], 'a hint takes 40 off and is itemized');
      for (let k = 1; k <= 3; k++) await t.game('act', 'undo');
      s = await t.state();
      t.equal([s.undos, s.fee.undo], [3, 0], 'the first three undos cost nothing');
      await t.game('act', 'undo'); s = await t.state();
      t.equal([s.undos, s.fee.undo], [4, 10], 'the fourth costs 10');
      t.expect(/Undone \(−10\)/.test(s.status), 'and the status line says so: ' + s.status);
      await t.game('act', 'undo'); s = await t.state();
      t.equal(s.fee.undo, 20, 'the fifth costs another 10');
      await t.game('act', 'redo'); await t.game('act', 'redo'); s = await t.state();
      t.equal(s.fee.undo, 20, 'redo charges nothing');
      // Relaxed: nothing is charged for anything
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'relaxed' }); await t.waitIdle(15000);
      await play(t, 20); for (let k = 0; k < 6; k++) await t.game('act', 'undo');
      await t.game('act', 'hint'); s = await t.state();
      t.equal(s.fee, { hint: 0, shuffle: 0, undo: 0 }, 'Relaxed charges no hint, shuffle or undo');
    },
  },
  {
    name: 'S3-05: the win card itemizes the penalties, adds a no-help bonus, and scales the time bonus to par',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      // a clean win: no help at all, finished at par
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      const tiles = (await t.state()).total;
      await t.game('act', 'solveTo', 2); await t.game('act', 'advance', par(tiles)); await t.game('act', 'solveTo', 0);
      let c = await winCard(t);
      t.equal(num(rowOf(c, 'No-help bonus')), 250, 'a win with no hint, shuffle or undo earns 250');
      t.expect(c.rows.some((r) => r[0] === 'Time bonus (par 7:12)'), 'the label shows this layout\'s par: ' + JSON.stringify(c.rows.map((r) => r[0])));
      const tb = num(rowOf(c, 'Time bonus'));
      t.expect(tb >= 290 && tb <= 300, 'a win at par earns about half the 600 time bonus (' + tb + '); the flat ten minutes gave 168');
      const total = c.rows.find((r) => r[0] === 'Total');
      const sum = c.rows.filter((r) => r[0] !== 'Total').reduce((a, r) => a + num(r[1]), 0);
      t.equal([num(total[1]), (await t.state()).score], [sum, sum], 'the rows add up to the total, and to the score in the game');
      await t.shot('S3-05-win-card-clean');
      await t.page.click('#ow-title');
      // a helped win: one hint and five undos
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await play(t, 12); await t.game('act', 'hint');
      for (let k = 0; k < 5; k++) await t.game('act', 'undo');
      for (let k = 0; k < 5; k++) await t.game('act', 'redo');
      await t.game('act', 'solveTo', 0);
      c = await winCard(t);
      t.equal(rowOf(c, 'Hints'), '−40', 'the hint is itemized');
      t.equal(rowOf(c, 'Undos after the first 3'), '−20', 'two undos past the free three are itemized');
      t.equal(rowOf(c, 'No-help bonus'), undefined, 'and there is no no-help bonus');
      const total2 = c.rows.find((r) => r[0] === 'Total');
      t.equal(num(total2[1]), c.rows.filter((r) => r[0] !== 'Total').reduce((a, r) => a + num(r[1]), 0), 'the rows still add up to the total');
      await t.shot('S3-05-win-card-helped');
      await t.page.click('#ow-title');
    },
  },
  {
    name: 'S3-05: the time bonus runs out at twice par, and a game saved before penalties were itemized still loads',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'sugarloaf', seed: 5, level: 'classic' }); await t.waitIdle(15000);
      const tiles = (await t.state()).total;
      await t.game('act', 'solveTo', 2); await t.game('act', 'advance', par(tiles) * 2 + 5000); await t.game('act', 'solveTo', 0);
      const c = await winCard(t);
      t.equal(num(rowOf(c, 'Time bonus')), 0, 'twice par or slower earns no time bonus');
      await t.page.click('#ow-title');
      await t.game('newGame', { layout: 'sugarloaf', seed: 5, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 2); await t.game('act', 'advance', par(tiles) * 1.5); await t.game('act', 'solveTo', 0);
      const c15 = await winCard(t), tb15 = num(rowOf(c15, 'Time bonus'));
      t.expect(tb15 >= 140 && tb15 <= 150, 'one and a half times par still earns about 150 (' + tb15 + '); the flat ten minutes gave 0 there');
      await t.page.click('#ow-title');
      // an in-progress save from before this wave has no fee record
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await play(t, 3);
      const g = await stored(t, 'bhm.game.v1'); delete g.fee; await put(t, 'bhm.game.v1', g);
      await reload(t);
      await t.page.click('#b-continue'); await t.waitIdle(15000);
      const s = await t.state();
      t.equal([s.scene, s.fee], ['game', { hint: 0, shuffle: 0, undo: 0 }], 'it loads with an empty fee record');
      const g2 = await stored(t, 'bhm.game.v1'); g2.fee = { hint: 'x', undo: -5 }; await put(t, 'bhm.game.v1', g2);
      await reload(t);
      await t.page.click('#b-continue'); await t.waitIdle(15000);
      t.equal((await t.state()).fee, { hint: 0, shuffle: 0, undo: 0 }, 'a damaged fee record is read as zeros');
    },
  },
  // ------------------------------------------------------------------ S3-07
  {
    name: 'S3-07: the win card names a new best score as well as a new best time, and the layout card shows the best score',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      // a first win sets both records
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      let c = await winCard(t);
      t.expect(c.sub.endsWith('new best time and score!'), 'a first win is a new best time and score: ' + c.sub);
      const first = (await stored(t, 'bhm.stats.v1')).layouts.pyramid;
      await t.page.click('#ow-title');
      // a slower, lower win: no new best of either kind
      await t.game('newGame', { layout: 'pyramid', seed: 22, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 2); await t.game('act', 'advance', 3000000); await t.game('act', 'solveTo', 0);
      c = await winCard(t);
      t.expect(!/new best/.test(c.sub), 'a slower, lower win claims no record: ' + c.sub);
      await t.page.click('#ow-title');
      // both records beaten, then only the score
      const st = await stored(t, 'bhm.stats.v1'); st.layouts.pyramid.bestMs = 100000000; st.layouts.pyramid.bestScore = 1; await put(t, 'bhm.stats.v1', st); await reload(t);
      await t.game('newGame', { layout: 'pyramid', seed: 23, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      c = await winCard(t);
      t.expect(c.sub.endsWith('new best time and score!'), 'beating both stored records says so: ' + c.sub);
      await t.page.click('#ow-title');
      const st2 = await stored(t, 'bhm.stats.v1'); st2.layouts.pyramid.bestMs = 0; st2.layouts.pyramid.bestScore = 1; await put(t, 'bhm.stats.v1', st2); await reload(t);
      await t.game('newGame', { layout: 'pyramid', seed: 24, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      c = await winCard(t);
      t.expect(c.sub.endsWith(' · new best score!'), 'a higher score that is not a faster time is a best score only: ' + c.sub);
      await t.page.click('#ow-title');
      const st3 = await stored(t, 'bhm.stats.v1'); st3.layouts.pyramid.bestMs = 100000000; st3.layouts.pyramid.bestScore = 999999; await put(t, 'bhm.stats.v1', st3); await reload(t);
      await t.game('newGame', { layout: 'pyramid', seed: 25, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      c = await winCard(t);
      t.expect(c.sub.endsWith(' · new best time!'), 'a faster time with a lower score is a best time only: ' + c.sub);
      await t.page.click('#ow-title');
      // the layout card carries the best score beside the best time
      const best = (await stored(t, 'bhm.stats.v1')).layouts.pyramid.bestScore;
      await t.game('scene', 'layouts'); await t.waitIdle(15000);
      const card = await t.page.locator('.card[data-layout="pyramid"] .best').innerText();
      t.expect(card.includes('score ' + best.toLocaleString('en-US')), 'the Pyramid card says "score ' + best + '": ' + card);
      await t.page.locator('.card[data-layout="pyramid"]').scrollIntoViewIfNeeded();
      await t.shot('S3-07-card-best-score');
      t.equal(first.bestScore > 0, true, 'the first win saved a best score');
    },
  },
];
