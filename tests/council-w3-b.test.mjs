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
];
