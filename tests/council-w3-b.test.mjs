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
  // ------------------------------------------------------------------ S3-08
  {
    name: 'S3-08: Stats says Completion rate, keeps win totals and the last twenty wins, and shows them',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const statsText = async () => { await t.game('scene', 'stats'); return t.page.locator('#ost-body').innerText(); };
      // a save from before this wave: wins on record, no totals
      await put(t, 'bhm.stats.v1', { played: 9, won: 4, streak: 2, bestStreak: 3, layouts: { pyramid: { played: 5, won: 3, bestMs: 303000, bestScore: 1190 } }, daily: { last: null, streak: 0, best: 0, done: {} } });
      await reload(t);
      let txt = await statsText();
      t.expect(txt.includes('Completion rate') && !txt.includes('Win rate'), 'the rate is called Completion rate (it only measures abandoning, since a game cannot be lost)');
      t.expect(/Average win time\s*—/.test(txt), 'an old save has no average yet');
      t.expect(txt.includes('count the wins since they were added'), 'and the page says why');
      t.expect(!txt.includes('Recent wins'), 'no recent list until a win is made');
      await t.page.evaluate(() => document.querySelector('#o-stats [data-close]').click());
      // two wins: one clean, one with a hint
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 2); await t.game('act', 'advance', 120000); await t.game('act', 'solveTo', 0);
      await winCard(t); await t.page.click('#ow-title');
      await t.game('newGame', { layout: 'display', seed: 3, level: 'relaxed' }); await t.waitIdle(15000);
      await t.game('act', 'hint'); await t.game('act', 'solveTo', 2); await t.game('act', 'advance', 240000); await t.game('act', 'solveTo', 0);
      await winCard(t); await t.page.click('#ow-title');
      const st = await stored(t, 'bhm.stats.v1');
      t.equal([st.sums.wins, st.sums.clean], [2, 1], 'two timed wins, one of them hint-free');
      t.equal(st.recent.map((r) => [r.l, r.v, r.h]), [['display', 'relaxed', 1], ['pyramid', 'classic', 0]], 'the last wins are kept, newest first');
      t.expect(st.sums.winMs === st.recent[0].ms + st.recent[1].ms, 'the time in won games is the sum of those wins');
      txt = await statsText();
      const mins = Math.round(st.sums.winMs / 60000);
      t.expect(txt.includes('Time in won games') && txt.includes(mins + ' min'), 'the stats page shows the time in won games (' + mins + ' min)');
      t.expect(/Hint-free wins\s+1/.test(txt), 'and one hint-free win');
      t.expect(txt.includes('Recent wins') && txt.includes('Display Springs (Relaxed)') && txt.includes('Classic Pyramid'), 'and the recent wins');
      await t.shot('S3-08-stats');
      await t.page.evaluate(() => document.querySelector('#o-stats [data-close]').click());
    },
  },
  {
    name: 'S3-08: only the last twenty wins are kept, and damaged totals or entries are read as nothing',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const mk = (i) => ({ d: '2026-10-' + String(10 + (i % 18)).padStart(2, '0'), l: 'pyramid', v: 'classic', ms: 100000 + i, h: 0, s: 1000 + i });
      await put(t, 'bhm.stats.v1', { played: 30, won: 25, streak: 0, bestStreak: 0, layouts: {}, daily: { done: {} }, sums: { wins: 25, winMs: 2500000, clean: 25 }, recent: Array.from({ length: 25 }, (_, i) => mk(i)) });
      await reload(t);
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'classic' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0); await winCard(t);
      const st = await stored(t, 'bhm.stats.v1');
      t.equal([st.recent.length, st.recent[1].s, st.sums.wins], [20, 1000, 26], 'twenty are kept: the new win then the newest nineteen older ones');
      await put(t, 'bhm.stats.v1', { played: 3, won: 2, sums: 'x', recent: [null, 7, { l: 'nowhere', v: 'classic', d: '2026-10-01' }, { l: 'pyramid', v: 'bogus', d: '2026-10-01' }, { l: 'pyramid', v: 'classic', d: 'yesterday' }, { l: 'pyramid', v: 'classic', d: '2026-10-01', ms: 'x', h: -4, s: null }], layouts: {}, daily: {} });
      await reload(t);
      await t.game('scene', 'stats');
      const txt = await t.page.locator('#ost-body').innerText();
      t.expect(txt.includes('Games played') && txt.includes('Average win time'), 'the Stats page still opens');
      t.equal(await t.page.locator('#st-recent tbody tr').count(), 1, 'only the one entry with a known layout, level and date is shown');
      t.expect(/0:00/.test(await t.page.locator('#st-recent tbody tr').innerText()), 'its damaged numbers read as zero');
    },
  },
  // ------------------------------------------------------------------ S4-07
  {
    name: 'S4-07: the tile texts and the win-card facts agree on the numbers, and carry no footnote-style parentheses',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const meta = await t.game('act', 'faceMeta');
      const facts = await t.page.evaluate(() => JSON.parse(document.getElementById('facts').textContent));
      const win = (id) => { const f = facts.find((x) => x.id === id); return f.q + ' ' + f.a + ' ' + f.e; };
      const fact = (name) => meta.find((m) => m.name === name).fact;
      // the spring temperature: the tile gives today's figure and the explorers', both of which the win-card fact states
      const springs = fact('Springs 1');
      t.expect(springs.includes('143') && springs.includes('148–150'), 'Springs 1 gives both temperatures: ' + springs);
      t.expect(win('hs-0114').includes('148–150') && win('hs-0114').includes('143'), 'and the win-card fact states the same two numbers');
      // the dam and the lake: both years on the tile, as the win card has them
      const lake = fact('Lakes 2');
      t.expect(lake.includes('1931') && lake.includes('1932'), 'Lakes 2 gives the dam year and the lake year: ' + lake);
      t.expect(win('hs-0121').includes('Carpenter Dam, 1931') && win('hs-0121').includes('1932'), 'and the win-card fact has the same two years');
      // the seasons: no "(2017 figure)" footnote, no repeat of the lake's acreage
      const spring = fact('Season: Spring'), summer = fact('Season: Summer'), winter = fact('Season: Winter');
      t.expect(spring.includes('2017') && !/\(.*figure.*\)/.test(spring), 'Spring names its year in the sentence: ' + spring);
      t.expect(!summer.includes('7,200') && summer.includes('Lake Hamilton'), 'Summer no longer repeats the 7,200 acres: ' + summer);
      t.expect(winter.includes('2014') && winter.includes('4.5–5 million') && !winter.includes('later 4.5'), 'Winter reads as a sentence: ' + winter);
      t.expect(win('hs-0174').includes('Andrew Hulsey State Fish Hatchery') && win('hs-0174').includes('Lake Hamilton'), 'the Summer anchor is a fact the game already holds');
    },
  },
  // ------------------------------------------------------------------ S3-03
  {
    name: 'S3-03: the Daily Puzzle follows a weekly curve from the easiest board on Monday to the hardest on Sunday',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const MEASURED = { islands: 69, display: 68, pyramid: 37, terraces: 35, arlington: 31, tower: 29, row: 19 };
      const byWeekday = {};
      for (let d = 0; d < 21; d++) {
        const date = new Date(Date.UTC(2026, 10, 9 + d)).toISOString().slice(0, 10); // 9 November 2026 is a Monday
        const r = await t.game('newGame', { daily: true, date });
        const wd = d % 7; // 0 Monday .. 6 Sunday
        t.expect(MEASURED[r.layoutId] !== undefined, date + ' is one of the original seven boards (' + r.layoutId + ')');
        if (byWeekday[wd] === undefined) byWeekday[wd] = r.layoutId; else t.equal(r.layoutId, byWeekday[wd], date + ' has the same board as the same weekday a week before');
      }
      const week = [0, 1, 2, 3, 4, 5, 6].map((d) => byWeekday[d]);
      t.equal(new Set(week).size, 7, 'each of the seven boards comes once a week: ' + week.join(', '));
      for (let d = 1; d < 7; d++) t.expect(MEASURED[week[d]] <= MEASURED[week[d - 1]], 'the board gets no easier from ' + week[d - 1] + ' to ' + week[d]);
      t.equal([week[0], week[6]], ['islands', 'row'], 'Monday is the easiest board, Sunday the hardest');
    },
  },
  // ------------------------------------------------------------------ P-N02
  {
    name: 'P-N02: on a phone held upright a wide Daily Puzzle starts zoomed in and says so; a portrait one does not',
    url: URL,
    viewports: ['mobile'],
    async run(t) {
      const toastText = () => t.page.evaluate(() => (document.getElementById('toast').classList.contains('on') ? document.getElementById('toast').textContent : ''));
      const PORTRAIT = ['terraces', 'display', 'sugarloaf', 'cascade'];
      let wide = null, tall = null;
      for (let d = 0; d < 7 && !(wide && tall); d++) {
        const date = new Date(Date.UTC(2026, 10, 9 + d)).toISOString().slice(0, 10);
        await t.page.evaluate(() => { const e = document.getElementById('toast'); e.classList.remove('on'); e.textContent = ''; }); // the last board's note must not be read as this one's
        const r = await t.game('newGame', { daily: true, date }); await t.waitIdle(15000);
        const s = await t.state();
        if (PORTRAIT.includes(r.layoutId)) { if (!tall) tall = { r, s, toast: await toastText() }; } else if (!wide) wide = { r, s, toast: await toastText(), date };
      }
      t.expect(wide && tall, 'the week has both kinds of board');
      t.equal(wide.s.zoom, true, wide.r.layoutId + ' (wide) starts zoomed');
      t.expect(wide.toast.includes('is wide: Zoom is on') && wide.toast.includes(wide.s.layoutId === 'islands' ? 'Ouachita Islands' : ''), 'and the toast names the board: ' + wide.toast);
      await t.game('newGame', { daily: true, date: wide.date }); await t.waitIdle(15000); // the wide board again, for the picture
      await t.shot('P-N02-wide-daily-zoomed');
      t.equal([tall.s.zoom, tall.toast.includes('is wide')], [false, false], tall.r.layoutId + ' (made for phones) starts as before');
      // Zoom still turns off, and the same board on a later new game by choice is not zoomed
      await t.game('newGame', { daily: true, date: wide.date }); await t.waitIdle(15000);
      t.equal((await t.game('act', 'zoom', false)), false, 'Zoom can be turned off');
      await t.game('newGame', { layout: wide.r.layoutId, seed: 5 }); await t.waitIdle(15000);
      t.equal((await t.state()).zoom, false, 'and a board chosen from the layouts is not zoomed');
    },
  },
  {
    name: 'P-N02: on a desktop the Daily Puzzle starts as it always did',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { daily: true, date: '2026-11-09' }); await t.waitIdle(15000);
      const s = await t.state();
      t.equal(s.zoom, false, 'no automatic Zoom on a wide screen');
      t.expect(!/is wide/.test(await t.page.evaluate(() => document.getElementById('toast').textContent)), 'and no wide-board note');
    },
  },
  // ------------------------------------------------------------------ S3-06
  {
    name: 'S3-06: the Daily button shows the result of the day, the win card shows the streak and best, and Stats has a 30-day calendar',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      // local dates as the game computes them: n days before today
      const day = (n) => t.page.evaluate((n) => { const d = new Date(); d.setDate(d.getDate() - n); const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }, n);
      const [today, yday, d2, old] = [await day(0), await day(1), await day(2), await day(40)];
      await put(t, 'bhm.stats.v1', { played: 5, won: 3, streak: 0, bestStreak: 0, layouts: {}, daily: { last: yday, streak: 2, best: 2, done: { [yday]: 252000, [d2]: 300000, [old]: 111000 } } });
      await reload(t);
      const dailyLabel = async () => (await t.page.locator('#b-daily').innerText()).replace(/\s+/g, ' ').trim(); // two lines on a phone
      t.equal(await dailyLabel(), 'Daily Puzzle', 'before the puzzle is played the button is plain');
      // a faster win than any before: day 3 of the streak and the best daily time
      await t.game('newGame', { daily: true }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      let c = await winCard(t);
      t.expect(c.earned.includes('Daily streak: day 3.') && c.earned.includes('Your best daily time yet.'), 'the win card gives the streak day and the best: ' + c.earned);
      await t.shot('S3-06-daily-win');
      await t.page.click('#ow-title');
      const ms = (await stored(t, 'bhm.stats.v1')).daily.done[today];
      const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60;
      t.equal(await dailyLabel(), 'Daily Puzzle done ' + m + ':' + String(s).padStart(2, '0'), 'the button now says done and the time');
      await t.shot('S3-06-daily-button-done');
      // the calendar: 30 days, finished days carry their time, the old one is outside it
      await t.game('scene', 'stats');
      const cells = await t.page.evaluate(() => [...document.querySelectorAll('#st-cal > div')].map((d) => [d.dataset.date, d.className, d.getAttribute('aria-label')]));
      t.equal(cells.length, 30, 'thirty days are shown');
      t.equal([cells[29][0], cells[29][1].includes('today'), cells[29][1].includes('done')], [today, true, true], 'the last is today, finished');
      t.equal(cells.filter((x) => x[1].includes('done')).map((x) => x[0]), [d2, yday, today], 'the finished days are the ones on record, and a puzzle from 40 days ago is outside the 30');
      t.expect(cells[28][2].endsWith('finished in 4:12'), 'a finished day says its time to a screen reader: ' + cells[28][2]);
      t.expect(cells[0][2].endsWith('not played'), 'and an empty one says so: ' + cells[0][2]);
      await t.shot('S3-06-daily-calendar');
      await t.page.evaluate(() => document.querySelector('#o-stats [data-close]').click());
      // replaying today's finished puzzle is practice and says nothing about the streak
      await t.game('newGame', { daily: true }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      c = await winCard(t);
      t.expect(!c.earned.includes('Daily streak'), 'a practice replay shows no streak line');
      await t.page.click('#ow-title');
    },
  },
  {
    name: 'S3-06: a slower daily win says what the best time is',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const yday = await t.page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); const p = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); });
      await put(t, 'bhm.stats.v1', { played: 5, won: 3, streak: 0, bestStreak: 0, layouts: {}, daily: { last: yday, streak: 2, best: 2, done: { [yday]: 5000 } } });
      await reload(t);
      await t.game('newGame', { daily: true }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 2); await t.game('act', 'advance', 60000); await t.game('act', 'solveTo', 0);
      const c = await winCard(t);
      t.expect(c.earned.includes('Daily streak: day 3.') && c.earned.includes('Your best daily time is 0:05.'), 'a slower win names the best: ' + c.earned);
    },
  },
];
