// Daily puzzle, stats persistence, continue after reload, no storage (PRD AC14-AC17).
const waitWin = (t) => t.page.waitForFunction(() => document.getElementById('o-win').classList.contains('on'), null, { timeout: 5000 }).catch(() => t.fail('win overlay did not open'));

const TESTS = [
  {
    name: 'daily puzzle is date-seeded',
    async run(t) {
      await t.game('newGame', { daily: true, date: '2026-10-28' });
      const a = await t.state();
      await t.game('newGame', { daily: true, date: '2026-10-28' });
      const b = await t.state();
      await t.game('newGame', { daily: true, date: '2026-10-29' });
      const c = await t.state();
      t.equal(a.daily, '2026-10-28', 'daily date recorded');
      t.equal(a.layoutId, b.layoutId, 'same date, same layout');
      t.equal(a.tiles.map((x) => x.f), b.tiles.map((x) => x.f), 'same date, same deal');
      t.expect(a.layoutId !== c.layoutId, 'next day rotates the layout');
      t.expect(a.seed !== c.seed, 'different date, different seed');
      await t.game('newGame', { daily: true, date: '2026-10-28' });
      await t.shot('04-daily');
      const sub = await t.page.textContent('#h-sub');
      t.expect(sub.includes('Daily Puzzle') && sub.includes('2026-10-28'), 'HUD shows the daily date');
      await t.game('act', 'solveTo', 0);
      await waitWin(t);
      const stats = await t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.stats.v1')));
      t.equal(stats.daily.last, '2026-10-28', 'daily completion saved');
      t.equal(stats.daily.streak, 1, 'daily streak started');
    },
  },
  {
    name: 'stats persist and an unfinished game continues after reload',
    async run(t) {
      await t.game('newGame', { layout: 'tower', seed: 4242 });
      await t.game('act', 'solveTo', 100);
      await t.page.waitForTimeout(400);
      const before = await t.state();
      await t.page.reload();
      await t.page.waitForFunction(() => !!window.__game);
      t.equal((await t.state()).scene, 'title', 'reload returns to the title');
      t.expect(await t.page.isVisible('#b-continue'), 'Continue button offered');
      await t.page.click('#b-continue');
      const after = await t.state();
      t.equal(after.layoutId, 'tower', 'same layout');
      t.equal(after.tilesLeft, 100, 'same tiles left');
      t.equal(after.score, before.score, 'same score');
      t.equal(after.tiles.map((x) => x.present), before.tiles.map((x) => x.present), 'same board');
      t.equal(after.historyLen, before.historyLen, 'undo history restored');
      await t.shot('04-continue');
      await t.game('act', 'undo');
      t.equal((await t.state()).tilesLeft, 102, 'undo works after continuing');
      await t.game('act', 'solveTo', 0);
      await waitWin(t);
      await t.page.reload();
      await t.page.waitForFunction(() => !!window.__game);
      const s = await t.state();
      t.expect(s.statsWon >= 1, 'won count survives reload');
      t.expect(!(await t.page.isVisible('#b-continue')), 'no Continue after a finished game');
      await t.page.click('#b-stats');
      const txt = await t.page.textContent('#ost-body');
      t.expect(txt.includes('Mountain Tower'), 'stats table lists layouts');
      await t.shot('04-stats');
    },
  },
  {
    name: 'works without localStorage',
    async run(t) {
      await t.page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage disabled'); } });
      });
      await t.page.reload();
      await t.page.waitForFunction(() => !!window.__game);
      t.equal((await t.state()).storage, false, 'game knows storage is unavailable');
      await t.game('newGame', { layout: 'islands', seed: 1 });
      await t.game('act', 'solveTo', 120);
      t.equal((await t.state()).tilesLeft, 120, 'game plays without storage');
      await t.game('scene', 'settings');
      const note = await t.page.textContent('#se-storage');
      t.expect(note.includes('unavailable'), 'settings explain that nothing is saved');
      await t.shot('04-nostorage');
    },
  },
];
// 3D tiles are forced on (?gl=1): the harness's Chromium renders WebGL with SwiftShader, where Tiles: Auto
// would pick flat tiles. Tests that set their own url keep it.
export const tests = TESTS.map((x) => ({ url: 'index.html?gl=1', ...x }));
