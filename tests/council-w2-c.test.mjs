// Council wave 2, batch C: S3-02 goals and collection (stars, achievements, unlocks, tile and fact collection),
// S2-03 phone layouts (the landscape tag and the rotate chip), S4-02 a colour of table for every layout.
const URL = 'index.html?gl=0';
const stored = (t, k) => t.page.evaluate((k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, k);
const put = (t, k, v) => t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v]);
const reload = async (t) => { await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000); };
const PRE_WAVE_STATS = { played: 9, won: 4, streak: 2, bestStreak: 3, layouts: { pyramid: { played: 5, won: 3, bestMs: 303000, bestScore: 1190 }, row: { played: 2, won: 1, bestMs: 611000, bestScore: 900 } }, daily: { last: '2026-11-02', streak: 2, best: 3, done: { '2026-11-01': 400000, '2026-11-02': 380000 } } };
const PRE_WAVE_SETTINGS = { sound: true, volume: 70, motion: 'auto', theme: 'auto', highlightFree: true, showTimer: true, captions: true, tileset: 'peacock', graphics: 'auto', camera: 'top' };
const winGame = async (t, opts) => {
  await t.game('newGame', opts); await t.waitIdle(15000);
  await t.game('act', 'solveTo', 0);
  await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
};
const goals = (t) => t.game('goals');
const setDark = (t) => t.page.evaluate(() => document.querySelector('[data-set="theme"] [data-v="dark"]').click());

export const tests = [
  // ------------------------------------------------------------------ S3-02
  {
    name: 'S3-02: a new player sees what is locked and why, and the first win opens the first things',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      let g = await goals(t);
      t.equal(g.unlocked, [], 'a new player has nothing unlocked');
      t.equal(await stored(t, 'bhm.stats.v1'), null, 'and nothing was written just by opening the game');
      await t.game('scene', 'settings');
      for (const [set, v] of [['tileset', 'ribbon'], ['tileset', 'peacock'], ['camera', 'tilted'], ['camera', 'top']]) {
        const b = t.page.locator(`#o-settings [data-set="${set}"] [data-v="${v}"]`);
        t.equal(await b.getAttribute('aria-disabled'), 'true', v + ' is shown as locked');
        t.expect(((await b.getAttribute('title')) || '').includes('to unlock'), v + ' says what unlocks it');
      }
      const hint = await t.page.locator('#lh-tileset').innerText();
      t.expect(/Ribbon: win a game/.test(hint) && /Peacock: clear 5 different layouts \(0 of 5\)/.test(hint), 'the tile set row says how: ' + hint);
      t.expect(/Tilted: clear 3 different layouts/.test(await t.page.locator('#lh-camera').innerText()), 'and so does the camera row');
      await t.page.click('#o-settings [data-set="tileset"] [data-v="ribbon"]', { force: true });
      t.equal((await t.state()).settings.tileset, 'auto', 'tapping a locked tile set changes nothing');
      await t.page.click('#o-settings [data-set="camera"] [data-v="top"]', { force: true });
      t.equal((await t.state()).settings.camera, 'classic', 'tapping a locked camera changes nothing');
      for (const b of await t.page.locator('#o-settings [data-set="tileset"] button, #o-settings [data-set="camera"] button').all()) { const bb = await b.boundingBox(); t.expect(bb.height >= 44 - 0.5, 'setting buttons stay at least 44 px tall'); }
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-02-settings-locked');
      await t.game('scene', 'layouts');
      const hale = t.page.locator('.card[data-layout="hale"]');
      t.equal(await hale.getAttribute('aria-disabled'), 'true', 'Hale Bathhouse is locked on the picker');
      t.expect(/Win a game to unlock/.test(await hale.innerText()), 'with its condition in plain words');
      t.expect(/Clear 3 different layouts to unlock \(0 of 3\)/.test(await t.page.locator('.card[data-layout="quapaw"]').innerText()), 'and Quapaw Dome shows its progress');
      t.equal(await t.page.locator('.card[data-layout="pyramid"]').getAttribute('aria-disabled'), null, 'the original boards are open');
      await hale.scrollIntoViewIfNeeded();
      await hale.click({ force: true });
      t.equal((await t.state()).scene, 'layouts', 'tapping a locked card does not start it');
      await t.shot('S3-02-picker-locked');
      // the first win, inside the first session
      await winGame(t, { layout: 'pyramid', seed: 11 });
      g = await goals(t);
      for (const id of ['tileset:ribbon', 'layout:hale', 'layout:lamar']) t.expect(g.unlocked.includes(id), 'the first win unlocks ' + id);
      t.expect('first-soak' in g.ach, 'First Soak is earned');
      const card = await t.page.locator('#ow-earned').innerText();
      t.expect(/First Soak/.test(card) && /Unlocked: Ribbon tile set/.test(card) && /Unlocked: Hale Bathhouse/.test(card), 'the win card lists what was earned: ' + card.replace(/\n/g, ' | '));
      t.expect(/★★★/.test(await t.page.locator('#ow-earned').innerText()), 'a quick clean win is three stars');
      await t.shot('S3-02-win-earned');
      await t.page.click('#ow-title');
      await t.game('scene', 'settings');
      await t.page.click('#o-settings [data-set="tileset"] [data-v="ribbon"]');
      t.equal((await t.state()).settings.tileset, 'ribbon', 'Ribbon can now be chosen');
      t.equal(await t.page.locator('#o-settings [data-set="tileset"] [data-v="ribbon"]').getAttribute('aria-disabled'), null, 'and is no longer shown as locked');
      await reload(t);
      g = await goals(t);
      t.expect(g.unlocked.includes('tileset:ribbon') && 'first-soak' in g.ach, 'the unlocks and achievements survive a reload');
      t.equal((await t.state()).settings.tileset, 'ribbon', 'and so does the choice');
    },
  },
  {
    name: 'S3-02: a save from before this version keeps every tile set and camera, and loses nothing',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await put(t, 'bhm.stats.v1', PRE_WAVE_STATS); await put(t, 'bhm.settings.v1', PRE_WAVE_SETTINGS);
      await reload(t);
      let g = await goals(t);
      for (const id of ['tileset:ribbon', 'tileset:peacock', 'camera:tilted', 'camera:top']) t.expect(g.unlocked.includes(id), 'an older save keeps ' + id);
      t.expect(g.rec === true, 'the unlock record was written');
      const st = await stored(t, 'bhm.stats.v1');
      t.expect(st.goals && st.goals.rec === true && st.goals.unlocked.includes('camera:top'), 'and saved, so it is permanent');
      const s = await t.state();
      t.equal([s.settings.tileset, s.settings.camera], ['peacock', 'top'], 'the old choices are still selected');
      t.equal([st.played, st.won, st.streak, st.bestStreak], [9, 4, 2, 3], 'the old totals are untouched');
      t.equal(st.layouts.pyramid.bestMs, 303000, 'and so is a best time');
      t.expect(g.unlocked.includes('layout:hale'), 'four wins and two cleared layouts already open the first short boards');
      t.expect(!g.unlocked.includes('layout:quapaw'), 'and not the ones beyond two layouts');
      t.expect('first-soak' in g.ach, 'a win already on record earns First Soak');
      t.expect('daily-dip' in g.ach, 'and a finished daily earns Daily Dip');
      await t.game('scene', 'settings');
      t.equal(await t.page.locator('#o-settings [data-set="camera"] [data-v="top"]').getAttribute('aria-disabled'), null, 'the Top-down camera shows as open');
      await t.game('scene', 'stats');
      t.expect(/Games played\s+9/.test(await t.page.locator('#ost-body').innerText()), 'the Records tab still shows the old numbers');
      await reload(t);
      g = await goals(t);
      t.expect(g.unlocked.includes('tileset:peacock'), 'the record survives another reload');
    },
  },
  {
    name: 'S3-02: a hand-edited save that points at locked things falls back to the defaults, and damaged goals load',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await put(t, 'bhm.settings.v1', { tileset: 'peacock', camera: 'top' });
      await put(t, 'bhm.stats.v1', { played: 1, won: 1, goals: { rec: true, unlocked: ['tileset:peacock', 'nonsense', 7], ach: { 'first-soak': 5, junk: 'x' }, tiles: [1, 1, 99, 'a', -3], wins: ['hs-0057', 'zzz', 4] } });
      await reload(t);
      const g = await goals(t);
      t.equal(g.unlocked, ['tileset:peacock'], 'unknown unlock ids are dropped');
      t.equal(Object.keys(g.ach), ['first-soak'], 'unknown achievement ids are dropped');
      t.equal(g.tiles, [1], 'tile stories keep only real, distinct faces');
      t.equal(g.wins, ['hs-0057'], 'win facts keep only real ids');
      // Peacock was recorded as unlocked, Top-down was not: the camera falls back, the setting stays as written
      await t.game('newGame', { layout: 'pyramid', seed: 3 }); await t.waitIdle(15000);
      t.equal((await t.game('act', 'art')).tileset, 'peacock', 'an unlocked tile set is used');
      t.equal((await t.game('act', 'art')).camera, 'classic', 'a locked camera is not used');
      t.equal((await t.state()).settings.camera, 'top', 'but the saved camera choice is not rewritten');
      await put(t, 'bhm.stats.v1', { played: 1, won: 0 });
      await put(t, 'bhm.settings.v1', { tileset: 'ribbon' });
      await reload(t);
      await t.game('newGame', { layout: 'pyramid', seed: 3 }); await t.waitIdle(15000);
      t.equal((await t.game('act', 'art')).tileset, 'ribbon', 'with a save from before this version, Ribbon is open');
      await put(t, 'bhm.stats.v1', { played: 1, won: 0, goals: 'junk' });
      await reload(t);
      t.expect((await goals(t)).unlocked.includes('tileset:ribbon'), 'goals that are not an object count as no record: an older save is opened again');
    },
  },
  {
    name: 'S3-02: stars come from hints and time, are kept per level, and show on the layout cards',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await t.game('act', 'hint');
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
      t.expect(/★☆☆/.test(await t.page.locator('#ow-earned').innerText()), 'a win after a hint is one star');
      let st = await stored(t, 'bhm.stats.v1');
      t.equal(st.layouts.pyramid.stars, 1, 'the star is saved with the layout record');
      await t.page.click('#ow-title');
      await t.game('newGame', { layout: 'pyramid', seed: 22 }); await t.waitIdle(15000);
      await t.game('act', 'advance', 600000);
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
      t.expect(/★★☆/.test(await t.page.locator('#ow-earned').innerText()), 'no hint but slower than par is two stars');
      await t.page.click('#ow-title');
      await t.game('newGame', { layout: 'pyramid', seed: 23 }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
      t.expect(/★★★/.test(await t.page.locator('#ow-earned').innerText()), 'no hint and under par is three stars');
      t.expect('three-stars' in (await goals(t)).ach, 'Three Stars is earned');
      await t.page.click('#ow-title');
      st = await stored(t, 'bhm.stats.v1');
      t.equal(st.layouts.pyramid.stars, 3, 'the best is kept');
      await t.game('newGame', { layout: 'pyramid', seed: 24 }); await t.waitIdle(15000);
      await t.game('act', 'hint');
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
      st = await stored(t, 'bhm.stats.v1');
      t.equal(st.layouts.pyramid.stars, 3, 'a worse win never lowers the stars');
      await t.page.click('#ow-layouts');
      const card = t.page.locator('.card[data-layout="pyramid"]');
      t.expect(/★★★/.test(await card.locator('.stars').innerText()), 'the card shows three stars');
      t.expect(/Two stars: no hints\. Three: no hints and under 7:12\./.test(await card.locator('.stars').innerText()), 'and the targets');
      t.equal(await card.locator('.stars .sr-only').innerText(), '3 of 3 stars.', 'stars are spoken');
      t.expect(/☆☆☆/.test(await t.page.locator('.card[data-layout="row"] .stars').innerText()), 'a layout not yet cleared has none');
      await card.scrollIntoViewIfNeeded();
      await t.shot('S3-02-picker-stars');
      // an old win with no stars on record still counts as one
      await put(t, 'bhm.stats.v1', PRE_WAVE_STATS); await reload(t);
      await t.game('scene', 'layouts');
      t.expect(/★☆☆/.test(await t.page.locator('.card[data-layout="row"] .stars').innerText()), 'a win from before stars is one star');
      // levels keep their own stars
      await t.game('newGame', { layout: 'pyramid', seed: 25, level: 'expert' }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
      st = await stored(t, 'bhm.stats.v1');
      t.equal(st.tiers.expert.layouts.pyramid.stars, 3, 'Expert has its own record');
      t.equal(st.layouts.pyramid.stars || 0, 0, 'and Classic is untouched');
      t.expect('hard-water' in (await goals(t)).ach, 'Hard Water is earned by an Expert win');
    },
  },
  {
    name: 'S3-02: achievements come from play, with a banner and a cue, and are listed under Stats',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 31 }); await t.waitIdle(15000);
      t.equal((await goals(t)).ach, {}, 'nothing is earned by opening menus or starting a game');
      const before = (await t.game('audioState')).cues.achieve || 0;
      for (let i = 0; i < 5; i++) await t.game('act', 'solveStep');
      let g = await goals(t);
      t.expect('steam-rising' in g.ach, 'five quick pairs earn Steam Rising');
      t.expect(!('full-steam' in g.ach), 'and not Full Steam yet');
      t.expect(/Steam Rising/.test(await t.page.locator('#banner').innerText()), 'a banner names it');
      t.equal(await t.page.locator('#banner').evaluate((el) => el.classList.contains('on')), true, 'and is showing');
      t.expect(((await t.game('audioState')).cues.achieve || 0) > before, 'with its cue');
      t.equal(await t.page.locator('#banner').evaluate((el) => getComputedStyle(el).pointerEvents), 'none', 'the banner never blocks a tap');
      t.equal((await t.state()).gameStatus, 'playing', 'and play was never interrupted');
      await t.shot('S3-02-banner');
      for (let i = 0; i < 30; i++) await t.game('act', 'solveStep');
      t.expect('full-steam' in (await goals(t)).ach, 'ten quick pairs earn Full Steam');
      let guard = 80; while (!(await t.state()).rowDone && guard-- > 0) { if (!(await t.game('act', 'solveStep'))) break; }
      g = await goals(t);
      t.expect((await t.state()).rowDone && 'along-the-row' in g.ach, 'clearing the Bathhouse tiles earns Along the Row');
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
      g = await goals(t);
      for (const id of ['first-soak', 'clear-water', 'quick-dip']) t.expect(id in g.ach, id + ' is earned by a fast clean win');
      await t.page.click('#ow-title');
      await t.game('scene', 'stats');
      await t.page.click('#st-tabs [data-tab="goals"]');
      const body = await t.page.locator('#ost-body').innerText();
      t.expect(/Achievements \(\d+ of 15\)/.test(body), 'Stats lists fifteen achievements: ' + (body.match(/Achievements \(\d+ of \d+\)/) || [''])[0]);
      t.expect(/First Soak: Win your first game\./.test(body) && /Local Historian/.test(body), 'earned and unearned ones are listed with what they ask');
      t.expect(/Ribbon tile set: open/.test(body) && /Peacock tile set: Clear 5 different layouts \(1 of 5\)/.test(body), 'and so are the unlocks and how far along the player is');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-02-stats-goals');
      await t.page.click('#st-tabs [data-tab="records"]');
      t.expect(/Games played\s+1/.test(await t.page.locator('#ost-body').innerText()), 'the Records tab is still there');
      // reset clears records but keeps what was earned
      await t.page.click('#ost-reset');
      g = await goals(t);
      t.expect('first-soak' in g.ach && g.unlocked.includes('tileset:ribbon'), 'Reset stats keeps achievements and unlocks');
      t.equal((await stored(t, 'bhm.stats.v1')).won, 0, 'and clears the records');
    },
  },
  {
    name: 'S3-02: every tile story and win fact is collected by play and shown in the Tile Guide',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('scene', 'tiles');
      await t.page.click('#ot-tabs [data-tab="coll"]');
      let txt = await t.page.locator('#ot-coll').innerText();
      t.expect(/Tile stories: 0 of 42/.test(txt) && /Win facts read: 0 of 123/.test(txt), 'a new collection is empty: ' + txt.slice(0, 50).replace(/\n/g, ' '));
      t.expect(/Not found yet/.test(txt), 'and says how to fill it');
      await t.page.click('#ot-tabs [data-tab="faces"]');
      t.equal(await t.page.locator('#ot-faces').isVisible(), true, 'the faces are still on the first tab');
      await t.game('scene', 'title');
      await t.game('newGame', { layout: 'pyramid', seed: 41 }); await t.waitIdle(15000);
      const pr = await t.game('act', 'solveStep');
      const s = await t.state(), f = s.tiles[pr[0]].f;
      let g = await goals(t);
      t.expect(g.tiles.includes(f), 'matching a pair collects that tile story');
      t.expect(g.tiles.length >= 1 && g.tiles.length <= 2, 'and only those');
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
      g = await goals(t);
      t.equal(g.tiles.length, 42, 'a full board collects every one of the 42 tile stories');
      t.equal(g.wins.length, 1, 'the win card collects one fact');
      const firstFact = await t.page.locator('#ow-fact .q').innerText();
      await t.page.click('#ow-again'); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
      g = await goals(t);
      t.equal(g.wins.length, 2, 'a second win shows a second fact, not the first again');
      t.expect(firstFact !== (await t.page.locator('#ow-fact .q').innerText()), 'the question differs');
      t.expect('know-your-tiles' in g.ach, 'collecting all 42 earns Know Your Tiles');
      await t.page.click('#ow-title');
      await t.game('scene', 'tiles');
      await t.page.click('#ot-tabs [data-tab="coll"]');
      txt = await t.page.locator('#ot-coll').innerText();
      t.expect(/Tile stories: 42 of 42/.test(txt) && /Win facts read: 2 of 123/.test(txt), 'the collection shows the counts');
      t.expect(/Source: /.test(txt), 'and the facts read, with their sources');
      t.expect(!/Not found yet/.test(txt), 'and nothing left to find among the tiles');
      await t.checkLayout({ allowScrollY: true });
      await t.page.evaluate(() => { document.querySelector('#ot-body').scrollTop = 0; });
      await t.shot('S3-02-collection');
      await reload(t);
      t.equal((await goals(t)).tiles.length, 42, 'the collection survives a reload');
    },
  },
  {
    name: 'S3-02: the achievement cue sits in the cue range',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      t.expect((await t.game('audioList')).cues.includes('achieve'), 'there is an achieve cue');
      const peaks = [];
      for (let seed = 1; seed <= 4; seed++) peaks.push((await t.game('audioRender', 'cue:achieve', 2, false, seed)).peak);
      t.log('achieve cue peaks: ' + peaks.map((p) => p.toFixed(3)).join(', '));
      for (const p of peaks) t.expect(p >= 0.2 && p <= 0.45, 'achieve peaks at ' + p);
      t.expect(new Set(peaks).size > 1, 'repeats are not identical');
    },
  },
  // ------------------------------------------------------------------ S2-03
  {
    name: 'S2-03: on a phone held upright, wide boards say so on the picker and keep a rotate chip while played',
    url: URL,
    viewports: ['mobile'],
    async run(t) {
      await t.game('unlockAll');
      await t.game('scene', 'layouts');
      const tags = await t.page.$$eval('#cards .card', (cs) => cs.map((c) => ({ id: c.dataset.layout, tags: [...c.querySelectorAll('.tag')].map((x) => x.textContent) })));
      const portrait = ['terraces', 'display', 'sugarloaf', 'cascade'];
      for (const c of tags) {
        if (portrait.includes(c.id)) t.expect(c.tags.includes('Fits phones') && !c.tags.includes('Best in landscape'), c.id + ' is tagged Fits phones');
        else t.expect(c.tags.includes('Best in landscape') && !c.tags.includes('Fits phones'), c.id + ' is tagged Best in landscape');
      }
      await t.shot('S2-03-picker-tags');
      await t.game('newGame', { layout: 'row', seed: 5 }); await t.waitIdle(15000);
      const chip = t.page.locator('#rot-chip');
      t.equal(await chip.isVisible(), true, 'a wide board in portrait shows the chip');
      t.expect(/sideways for bigger tiles/.test(await chip.innerText()), 'and says what to do: ' + await chip.innerText());
      const cb = await chip.boundingBox(), sb = await t.page.locator('#status').boundingBox(), tb = await t.page.locator('.toolbar').boundingBox();
      t.expect(cb.y >= sb.y - 1 && cb.y + cb.height <= sb.y + sb.height + 1, 'the chip sits inside the status bar');
      t.expect(cb.y + cb.height <= tb.y, 'and clear of the toolbar');
      t.expect(cb.x >= 0 && cb.x + cb.width <= 390, 'and inside the screen');
      t.equal((await t.game('act', 'boardFits')).out, 0, 'the board still fits with the chip showing');
      await t.shot('S2-03-chip');
      await t.page.waitForTimeout(4500);
      t.equal(await chip.isVisible(), true, 'the chip is not dismissed by waiting');
      await t.game('pause'); await t.game('resume'); await t.waitIdle(15000);
      t.equal(await chip.isVisible(), true, 'or by pausing');
      await t.page.setViewportSize({ width: 844, height: 390 }); await t.page.waitForTimeout(600);
      t.equal(await chip.isVisible(), false, 'turning the phone sideways removes it');
      await t.shot('S2-03-landscape');
      await t.page.setViewportSize({ width: 390, height: 844 }); await t.page.waitForTimeout(600);
      t.equal(await chip.isVisible(), true, 'and turning it back brings it back');
      await t.game('newGame', { layout: 'terraces', seed: 5 }); await t.waitIdle(15000);
      t.equal(await chip.isVisible(), false, 'a board that fits a phone has no chip');
      await t.game('scene', 'title');
      t.equal(await chip.isVisible(), false, 'and the title has none');
    },
  },
  {
    name: 'S2-03: desktop never shows the phone tag or chip',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('unlockAll');
      await t.game('scene', 'layouts');
      t.equal(await t.page.locator('#cards .tag', { hasText: 'Best in landscape' }).count(), 0, 'no landscape tags on a wide screen');
      await t.game('newGame', { layout: 'row', seed: 5 }); await t.waitIdle(15000);
      t.equal(await t.page.locator('#rot-chip').isVisible(), false, 'and no chip');
    },
  },
  // ------------------------------------------------------------------ S4-02
  {
    name: 'S4-02: every layout has its own colour of table',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const ids = await t.page.evaluate(() => { const o = []; window.__game.scene('layouts'); document.querySelectorAll('#cards .card').forEach((c) => o.push(c.dataset.layout)); return o; });
      t.equal(ids.length, 18, 'eighteen layouts');
      const tints = {};
      for (const id of ids) { await t.game('newGame', { layout: id, seed: 4 }); tints[id] = (await t.game('act', 'table')).tint; t.expect(!!tints[id], id + ' has a tint'); }
      const rgb = (h, s, l) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map((v) => v * 255); };
      let min = 1e9, pair = '';
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = rgb(tints[ids[i]].h, tints[ids[i]].s, tints[ids[i]].l), b = rgb(tints[ids[j]].h, tints[ids[j]].s, tints[ids[j]].l);
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (d < min) { min = d; pair = ids[i] + '/' + ids[j]; }
      }
      t.log('closest two table colours: ' + pair + ' at distance ' + min.toFixed(1) + ' of 441');
      t.expect(min >= 10, 'no two layouts share a colour of table (closest: ' + pair + ' at ' + min.toFixed(1) + ')');
      for (const id of ids) t.expect(tints[id].l >= 20 && tints[id].l <= 28, id + ' stays a dark table, so the tiles lead (lightness ' + tints[id].l + ')');
    },
  },
  {
    name: 'S4-02: the slab and the backdrop follow the layout in 3D',
    url: 'index.html?gl=1',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const grab = () => t.page.evaluate(() => { const c = document.getElementById('board-bg'); const x = c.getContext('2d'); const d = x.getImageData(Math.round(c.width * 0.5), Math.round(c.height * 0.06), 1, 1).data; return [d[0], d[1], d[2]]; });
      const seen = {};
      for (const id of ['pyramid', 'islands', 'arlington', 'terraces']) {
        await t.game('newGame', { layout: id, seed: 4 }); await t.waitIdle(15000);
        const tb = await t.game('act', 'table');
        t.equal((await t.game('act', 'gl')).on, true, 'WebGL is on');
        const tint = tb.tint;
        t.equal(tb.slab, tint.h + ',' + tint.s + ',' + tint.l, id + ': the 3D slab carries the layout tint');
        seen[id] = await grab();
        await t.shot('S4-02-' + id);
      }
      const keys = Object.values(seen).map((c) => c.join(','));
      t.expect(new Set(keys).size === keys.length, 'the backdrop behind the board differs by layout: ' + keys.join(' | '));
      await setDark(t); await t.game('newGame', { layout: 'islands', seed: 4 }); await t.waitIdle(15000);
      t.equal((await t.game('act', 'table')).slab, '200,48,25', 'the tint is kept in the dark theme');
      await t.shot('S4-02-islands-night');
    },
  },
  {
    name: 'S4-02: flat tiles get the layout wash on the table too',
    url: 'index.html?gl=0',
    viewports: ['desktop'],
    async run(t) {
      const grab = () => t.page.evaluate(() => { const c = document.getElementById('board'); const x = c.getContext('2d'); const d = x.getImageData(Math.round(c.width * 0.5), Math.round(c.height * 0.04), 1, 1).data; return [d[0], d[1], d[2]].join(','); });
      const seen = [];
      for (const id of ['pyramid', 'islands', 'arlington']) {
        await t.game('newGame', { layout: id, seed: 4 }); await t.waitIdle(15000);
        t.expect((await t.game('act', 'table')).wash.endsWith(id), id + ': the table is cached per layout');
        seen.push(await grab());
        await t.shot('S4-02-flat-' + id);
      }
      t.expect(new Set(seen).size === seen.length, 'the flat table differs by layout: ' + seen.join(' | '));
    },
  },
];
