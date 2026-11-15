// Council wave 2, batch B, item S3-01: a difficulty setting with three levels and separate records.
// The balance tests run in Node with the real probe (tools/balance.mjs); the rest drive the page.
import { loadEngine } from '../tools/engine-load.mjs';
import { measure } from '../tools/balance.mjs';

const URL = 'index.html?gl=0';
const E = loadEngine();
const stored = (t, k) => t.page.evaluate((k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, k);
const put = (t, k, v) => t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v]);
const reload = async (t) => { await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000); };
const PRE_WAVE_STATS = { played: 9, won: 4, streak: 2, bestStreak: 3, layouts: { pyramid: { played: 5, won: 3, bestMs: 303000, bestScore: 1190 }, row: { played: 2, won: 1, bestMs: 611000, bestScore: 900 } }, daily: { last: '2026-11-10', streak: 2, best: 4, done: { '2026-11-10': 420000 } } };

export const tests = [
  {
    name: 'S3-01: Relaxed beats Classic beats Expert on the balance probe, with Classic unchanged',
    node: true,
    async run(t) {
      const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const R = [], C = [], X = [];
      for (const L of E.LAYOUTS) { R.push(measure(L, 'relaxed', 60)); C.push(measure(L, 'classic', 60)); X.push(measure(L, 'expert', 60)); }
      const w = (rows) => mean(rows.map((r) => r.winRate)) * 100, o = (rows) => mean(rows.map((r) => r.openingPairs));
      t.log('mean random-play win %: relaxed ' + w(R).toFixed(1) + ', classic ' + w(C).toFixed(1) + ', expert ' + w(X).toFixed(1) + '; opening pairs: ' + o(R).toFixed(1) + ' / ' + o(C).toFixed(1) + ' / ' + o(X).toFixed(1));
      t.expect(w(R) - w(C) >= 8, 'Relaxed wins at least 8 points more often than Classic: ' + (w(R) - w(C)).toFixed(1));
      t.expect(w(C) - w(X) >= 8, 'Classic wins at least 8 points more often than Expert: ' + (w(C) - w(X)).toFixed(1));
      t.expect(o(R) > o(C) && o(C) > o(X), 'opening free pairs fall from Relaxed to Classic to Expert');
      const order = E.LAYOUTS.filter((_, i) => R[i].winRate > C[i].winRate && C[i].winRate > X[i].winRate).length;
      t.expect(order >= Math.floor(E.LAYOUTS.length * 0.8), order + ' of ' + E.LAYOUTS.length + ' layouts are ordered Relaxed > Classic > Expert one by one');
      // Classic is the deal the game always made: a third argument of 0 changes nothing, and shaped deals stay solvable
      let solved = 0, tried = 0;
      for (const L of E.LAYOUTS) {
        const g = E.buildGeometry(L.build());
        t.equal(E.deal(g, E.makeRng(77), 0), E.deal(g, E.makeRng(77)), L.id + ' Classic deal is identical to the old one');
        for (const shape of [-1, 1]) for (let s = 1; s <= 4; s++) {
          const d = E.deal(g, E.makeRng(s * 31), shape);
          t.expect(E.planValid(g, new Array(g.n).fill(true), d.faces, d.plan), L.id + ' shape ' + shape + ' seed ' + s + ' replays to an empty board');
          // the plan above is the guarantee; the independent solver on a small budget is a second opinion that trap-heavy Expert deals make harder
          tried++; if (E.solve(g, new Array(g.n).fill(true), d.faces, 25000)) solved++;
        }
      }
      t.log('independent solver, 25000-node budget, on Relaxed and Expert deals: ' + solved + ' of ' + tried);
      t.expect(solved / tried >= 0.8, 'the independent solver still finds most shaped deals on a small budget: ' + solved + ' of ' + tried);
      // the shaped deal is quick enough to run when the game starts
      let worst = 0; const g = E.buildGeometry(E.LAYOUTS[0].build());
      for (let s = 1; s <= 10; s++) { const t0 = performance.now(); E.deal(g, E.makeRng(s), 1); worst = Math.max(worst, performance.now() - t0); }
      t.log('slowest Expert deal of 144 tiles in Node: ' + worst.toFixed(0) + ' ms');
      t.expect(worst < 400, 'an Expert deal takes under 400 ms (' + worst.toFixed(0) + ' ms)');
    },
  },
  {
    name: 'S3-01: hints, shuffles, the free glow and the stuck dialog follow the level',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const play = async (level) => {
        await t.game('newGame', { layout: 'pyramid', seed: 515, level }); await t.waitIdle(15000);
        await t.game('act', 'solveTo', 110);
        return t.state();
      };
      // Classic: today's costs
      let s = await play('classic');
      t.equal([s.level, s.hints], ['classic', 0], 'a game says its level');
      const sc0 = s.score;
      await t.game('act', 'hint'); s = await t.state();
      t.equal([s.hints, s.score], [1, Math.max(0, sc0 - 40)], 'Classic: a hint costs 40');
      await t.game('act', 'shuffle'); s = await t.state();
      t.equal([s.shuffles, s.score], [1, Math.max(0, sc0 - 40 - 50)], 'Classic: a shuffle costs 50');
      t.expect(await t.page.locator('#os-shuffle').textContent() === 'Shuffle (−50)', 'the stuck dialog button says Shuffle (−50)');
      // Relaxed: free
      s = await play('relaxed');
      const sr = s.score;
      await t.game('act', 'hint'); await t.game('act', 'shuffle'); s = await t.state();
      t.equal([s.level, s.hints, s.shuffles, s.score], ['relaxed', 1, 1, sr], 'Relaxed: hint and shuffle cost nothing');
      t.expect(await t.page.locator('#os-shuffle').textContent() === 'Shuffle', 'the Relaxed button says Shuffle without a price');
      // Expert: no hints, 100 a shuffle, three at most, no glow
      s = await play('expert');
      t.expect(s.score >= 200, 'enough points to see the Expert shuffle penalty: ' + s.score);
      t.equal(await t.page.getAttribute('#t-hint', 'aria-disabled'), 'true', 'the Hint button is marked unavailable in Expert');
      t.equal(await t.page.getAttribute('#t-free', 'aria-disabled'), 'true', 'the Free button is marked unavailable in Expert');
      const se = s.score;
      const h = await t.game('act', 'hint'); s = await t.state();
      t.equal([h, s.hints, s.score], [null, 0, se], 'Expert: Hint gives no hint and costs nothing');
      t.expect(/Hints are off in Expert/.test(s.status), 'and says why: ' + s.status);
      await t.page.keyboard.press('h'); s = await t.state();
      t.equal(s.hints, 0, 'the H key gives no hint either');
      const glow = s.settings.highlightFree;
      await t.page.keyboard.press('f'); s = await t.state();
      t.equal(s.settings.highlightFree, glow, 'F does not change the free-tile setting while the glow is off');
      t.expect(/not highlighted in Expert/.test(s.status), 'and says why: ' + s.status);
      for (let k = 1; k <= 3; k++) { await t.game('act', 'shuffle'); s = await t.state(); t.equal([s.shuffles, s.score], [k, se - 100 * k], 'Expert: shuffle ' + k + ' costs 100'); }
      const r4 = await t.game('act', 'shuffle'); s = await t.state();
      t.equal([r4, s.shuffles, s.score], [null, 3, se - 300], 'Expert: a fourth shuffle is refused and costs nothing');
      t.expect(/No shuffles left/.test(s.status), 'with a reason: ' + s.status);
      // the stuck dialog explains it
      await t.game('act', 'stuck'); await t.page.waitForSelector('#o-stuck.on', { timeout: 4000 });
      t.equal(await t.page.locator('#os-shuffle').isDisabled(), true, 'the stuck dialog has no Shuffle left');
      t.expect(/3 shuffles of Expert are used/.test(await t.page.locator('#os-text').textContent()), 'and the text says so');
      await t.shot('S3-01-expert-stuck');
    },
  },
  {
    name: 'S3-01: the Daily Puzzle is always Classic, and a game keeps its level through a reload',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await put(t, 'bhm.settings.v1', { difficulty: 'expert' });
      await reload(t);
      let s = await t.game('newGame', { daily: true, date: '2026-11-13' }); await t.waitIdle(15000);
      s = await t.state();
      t.equal([s.level, s.daily], ['classic', '2026-11-13'], 'the Daily Puzzle ignores the setting and is Classic');
      await t.game('newGame', { layout: 'pyramid', seed: 8 }); await t.waitIdle(15000);
      s = await t.state();
      t.equal(s.level, 'expert', 'a normal game takes the saved setting');
      await t.game('act', 'solveTo', 138);
      const before = await t.state();
      await t.page.reload(); await t.page.waitForFunction(() => !!window.__game);
      await t.page.click('#b-continue'); await t.waitIdle(15000);
      s = await t.state();
      t.equal([s.level, s.tilesLeft, s.score], ['expert', 138, before.score], 'Continue brings back the Expert game with its score');
      const h = await t.game('act', 'hint');
      t.equal(h, null, 'and Hints are still off');
    },
  },
  {
    name: 'S3-01: records are kept apart per level, and a pre-wave save loads as Classic with nothing lost',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      // a save from before this wave: no difficulty, no tiers
      await put(t, 'bhm.stats.v1', PRE_WAVE_STATS);
      await put(t, 'bhm.settings.v1', { sound: true, volume: 70, motion: 'auto', theme: 'auto', highlightFree: true, showTimer: true, captions: true, tileset: 'auto', graphics: 'auto', camera: 'classic' });
      await reload(t);
      let s = await t.state();
      t.equal(s.settings.difficulty, 'classic', 'an old settings save plays Classic');
      await t.game('scene', 'stats');
      let body = await t.page.locator('#ost-body').innerText();
      t.expect(/Games played\s+9/.test(body) && /Games won\s+4/.test(body), 'the old totals are all there: ' + body.slice(0, 60).replace(/\n/g, ' '));
      t.expect(/Classic Pyramid\s+5\s+3\s+5:03\s+1190/.test(body), 'the old Classic Pyramid record is shown under Classic');
      t.expect(/Classic\s+9\s+4\s+44%/.test(body), 'all nine old games count as Classic');
      await t.game('scene', 'title');
      // win one game at each of the other levels
      for (const level of ['relaxed', 'expert']) {
        await t.game('newGame', { layout: 'pyramid', seed: 21, level }); await t.waitIdle(15000);
        await t.game('act', 'advance', 61000);
        await t.game('act', 'solveTo', 0);
        await t.page.waitForSelector('#o-win.on', { timeout: 6000 });
        await t.page.click('#ow-title');
      }
      const st = await stored(t, 'bhm.stats.v1');
      t.equal([st.played, st.won], [11, 6], 'the overall totals count every level');
      t.equal([st.tiers.relaxed.played, st.tiers.relaxed.won, st.tiers.expert.played, st.tiers.expert.won], [1, 1, 1, 1], 'each level has its own totals');
      t.expect(st.tiers.relaxed.layouts.pyramid.won === 1 && st.tiers.relaxed.layouts.pyramid.bestMs >= 61000, 'Relaxed has its own Pyramid best time');
      t.expect(st.tiers.expert.layouts.pyramid.won === 1, 'Expert has its own Pyramid record');
      t.equal(st.layouts.pyramid, PRE_WAVE_STATS.layouts.pyramid, 'the old Classic Pyramid record is untouched by the other levels');
      await t.game('scene', 'stats');
      body = await t.page.locator('#ost-body').innerText();
      t.expect(/Relaxed\s+1\s+1\s+100%/.test(body) && /Expert\s+1\s+1\s+100%/.test(body) && /Classic\s+9\s+4\s+44%/.test(body), 'the Stats card lists the three levels');
      await t.page.click('#st-level [data-v="expert"]');
      body = await t.page.locator('#ost-body').innerText();
      t.expect(/Classic Pyramid\s+1\s+1\s+1:01/.test(body.replace(/ /g, ' ')), 'choosing Expert shows its Pyramid record');
      await t.shot('S3-01-stats-levels');
      await t.page.keyboard.press('Escape');
      // the card shows the record of the chosen level
      await t.page.reload(); await t.page.waitForFunction(() => !!window.__game);
      await t.game('scene', 'layouts');
      await t.page.click('.levelbar [data-v="relaxed"]');
      let best = await t.page.locator('#cards .card[data-layout="pyramid"] .best').innerText();
      t.expect(/Won 1 · best 1:0\d · Relaxed/.test(best), 'Pyramid card under Relaxed: ' + best);
      await t.page.click('.levelbar [data-v="classic"]');
      best = await t.page.locator('#cards .card[data-layout="pyramid"] .best').innerText();
      t.equal(best, 'Won 3 · best 5:03', 'Pyramid card under Classic keeps the old record');
    },
  },
  {
    name: 'S3-01: a damaged difficulty setting, level or tier falls back without an error',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await put(t, 'bhm.settings.v1', { difficulty: 'nightmare' });
      await put(t, 'bhm.stats.v1', { played: 3, won: 1, tiers: 'broken', layouts: {} });
      await reload(t);
      let s = await t.state();
      t.equal(s.settings.difficulty, 'classic', 'an unknown difficulty becomes Classic');
      await t.game('scene', 'stats');
      t.expect(/Games played\s+3/.test(await t.page.locator('#ost-body').innerText()), 'a broken tiers field leaves the totals and the card working');
      await t.game('newGame', { layout: 'pyramid', seed: 5 }); await t.waitIdle(15000);
      const saved = await stored(t, 'bhm.game.v1');
      saved.level = 'nightmare';
      await put(t, 'bhm.game.v1', saved);
      await t.page.reload(); await t.page.waitForFunction(() => !!window.__game);
      await t.page.click('#b-continue'); await t.waitIdle(15000);
      s = await t.state();
      t.equal([s.level, s.layoutId], ['classic', 'pyramid'], 'a saved game with an unknown level plays as Classic');
      delete saved.level;
      await put(t, 'bhm.game.v1', saved);
      await t.page.reload(); await t.page.waitForFunction(() => !!window.__game);
      await t.page.click('#b-continue'); await t.waitIdle(15000);
      s = await t.state();
      t.equal(s.level, 'classic', 'a saved game from before levels existed plays as Classic');
    },
  },
  {
    name: 'S3-01: the picker has a Difficulty bar that is saved, reachable and labelled',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'layouts');
      const bar = await t.page.$$eval('.levelbar .seg button', (bs) => bs.map((b) => ({ v: b.dataset.v, on: b.getAttribute('aria-pressed'), h: b.getBoundingClientRect().height })));
      t.equal(bar.map((b) => b.v), ['relaxed', 'classic', 'expert'], 'three levels in order');
      t.equal(bar.map((b) => b.on), ['false', 'true', 'false'], 'Classic is the default');
      t.expect(bar.every((b) => b.h >= 44), 'the buttons are at least 44 px tall: ' + bar.map((b) => b.h));
      t.equal(await t.page.getAttribute('.levelbar .seg', 'aria-labelledby'), 'lb-level', 'the group is labelled for screen readers');
      t.expect(/standard game/.test(await t.page.locator('#level-blurb').textContent()), 'the blurb describes Classic');
      await t.shot('S3-01-picker-classic');
      await t.page.click('.levelbar [data-v="expert"]');
      t.expect(/No hints/.test(await t.page.locator('#level-blurb').textContent()), 'choosing Expert changes the blurb');
      t.equal((await stored(t, 'bhm.settings.v1')).difficulty, 'expert', 'the choice is saved with the settings');
      t.expect(/Expert$/.test(await t.page.locator('#cards .card[data-layout="pyramid"] .best').innerText()), 'cards say which level their records are for');
      await t.shot('S3-01-picker-expert');
      await t.page.reload(); await t.page.waitForFunction(() => !!window.__game);
      t.equal((await t.state()).settings.difficulty, 'expert', 'the level survives a reload');
      // Settings carries the same choice
      await t.game('scene', 'settings');
      t.equal(await t.page.getAttribute('#o-settings [data-set="difficulty"] [data-v="expert"]', 'aria-pressed'), 'true', 'Settings shows Expert too');
      await t.page.click('#o-settings [data-set="difficulty"] [data-v="relaxed"]');
      t.equal((await t.state()).settings.difficulty, 'relaxed', 'and changes it');
      await t.page.keyboard.press('Escape');
      // starting a game from a card uses it
      await t.game('scene', 'layouts');
      await t.page.click('.levelbar [data-v="expert"]');
      await t.page.click('#cards .card[data-layout="pyramid"]'); await t.waitIdle(15000);
      const s = await t.state();
      t.equal([s.layoutId, s.level, s.total], ['pyramid', 'expert', 144], 'a card starts a game at the chosen level');
      t.equal(await t.page.locator('#h-sub').textContent(), 'Expert · seed ' + s.seed, 'the HUD names the level');
      await t.shot('S3-01-expert-game');
    },
  },
  {
    name: 'S3-01: a new game at every level starts quickly on the 144-tile boards',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const r = await t.page.evaluate(() => {
        const out = {};
        for (const level of ['relaxed', 'classic', 'expert']) {
          const times = [];
          for (const id of ['pyramid', 'arlington', 'row', 'tower']) for (let k = 1; k <= 3; k++) { const t0 = performance.now(); window.__game.newGame({ layout: id, seed: 900 + k, level }); times.push(performance.now() - t0); }
          out[level] = { avg: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0), max: +Math.max(...times).toFixed(0) };
        }
        return out;
      });
      t.log('newGame times (ms): ' + JSON.stringify(r));
      t.expect(r.classic.avg < 120 && r.relaxed.avg < 250 && r.expert.avg < 250, 'a new game starts in a fraction of a second at every level');
    },
  },
];
