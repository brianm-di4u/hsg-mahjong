// Council wave 1, batch A: stability, saves and lifecycle (S2-02 ...)
const URL = 'index.html?gl=0';
const stored = (t, k) => t.page.evaluate((k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, k);

export const tests = [
  {
    name: 'S2-02: layout cards and Daily ask before abandoning a game in progress',
    url: URL,
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 301 }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 136);
      const a = await t.state();
      t.equal(a.tilesLeft, 136, 'two pairs matched');
      // layout card
      await t.game('scene', 'layouts');
      await t.page.click('#cards .card[data-layout="tower"]');
      let s = await t.state();
      t.equal(s.overlay, 'o-confirm', 'the confirm dialog opens');
      t.equal([s.layoutId, s.tilesLeft], ['pyramid', 136], 'the game in progress is untouched while asking');
      await t.page.click('#oc-keep');
      s = await t.state();
      t.equal([s.overlay, s.layoutId, s.tilesLeft], [null, 'pyramid', 136], 'Keep playing leaves the game alone');
      // Daily
      await t.game('scene', 'title');
      await t.page.click('#b-daily');
      s = await t.state();
      t.equal([s.overlay, s.daily, s.tilesLeft], ['o-confirm', null, 136], 'Daily asks first too');
      await t.page.click('#oc-keep');
      // confirming starts the card the player picked, not the old layout
      await t.game('scene', 'layouts');
      await t.page.click('#cards .card[data-layout="tower"]');
      await t.page.click('#oc-new');
      s = await t.state();
      t.equal([s.scene, s.layoutId, s.tilesLeft], ['game', 'tower', 144], 'Start the new game opens the chosen layout');
      // with no match made there is nothing to lose: no dialog
      await t.game('scene', 'layouts');
      await t.page.click('#cards .card[data-layout="islands"]');
      s = await t.state();
      t.equal([s.scene, s.overlay, s.layoutId], ['game', null, 'islands'], 'no dialog when no match has been made');
    },
  },
  {
    name: 'S2-02: a saved game is protected after a reload',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 302 }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 136);
      await t.game('act', 'hint'); // saves the game
      await t.page.evaluate(() => { document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true); });
      t.expect((await stored(t, 'bhm.game.v1')) !== null, 'a save exists');
      await t.reload();
      t.expect(await t.page.evaluate(() => !document.getElementById('b-continue').hidden), 'Continue is offered');
      await t.page.click('#b-play');
      await t.page.click('#cards .card[data-layout="tower"]');
      let s = await t.state();
      t.equal(s.overlay, 'o-confirm', 'the dialog opens over the layout picker');
      t.equal((await stored(t, 'bhm.game.v1')).layoutId, 'pyramid', 'the saved game is still there');
      await t.page.click('#oc-keep');
      await t.game('scene', 'title');
      await t.page.click('#b-daily');
      s = await t.state();
      t.equal(s.overlay, 'o-confirm', 'Daily asks too');
      t.equal((await stored(t, 'bhm.game.v1')).layoutId, 'pyramid', 'the saved game is still there after Daily');
      await t.page.click('#oc-keep');
      await t.game('scene', 'title');
      await t.page.click('#b-continue');
      s = await t.state();
      t.equal([s.layoutId, s.tilesLeft], ['pyramid', 136], 'Continue still resumes it');
    },
  },
  {
    name: 'S1-21: hiding the tab suspends the audio context and showing it resumes',
    url: URL,
    viewports: ['desktop'],
    initScript: () => {
      const O = window.AudioContext; window.__acs = [];
      window.AudioContext = class extends O { constructor(...a) { super(...a); window.__acs.push(this); } };
    },
    async run(t) {
      const setHidden = (h) => t.page.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
      const acState = () => t.page.evaluate(() => (window.__acs[0] ? window.__acs[0].state : 'none'));
      await t.page.click('#b-play'); // the first gesture creates the context
      await t.page.waitForFunction(() => window.__acs.length > 0 && window.__acs[0].state === 'running', null, { timeout: 5000 }).catch(() => {});
      t.equal(await acState(), 'running', 'audio runs while the tab is visible');
      await setHidden(true);
      await t.page.waitForTimeout(300);
      t.equal(await acState(), 'suspended', 'hiding the tab suspends the audio context');
      await setHidden(false);
      await t.page.waitForTimeout(300);
      t.equal(await acState(), 'running', 'showing the tab resumes it');
    },
  },
  {
    name: 'S6-02: junk settings do not kill the buttons, and a stray error is contained',
    url: URL,
    viewports: ['desktop'],
    allowConsoleErrors: true,
    async run(t) {
      const junk = '{"volume":"abc","motion":"x","theme":"zzz","tileset":"nope","graphics":"zz","camera":"zz","sound":"yes","showTimer":7}';
      await t.page.evaluate((j) => localStorage.setItem('bhm.settings.v1', j), junk);
      await t.reload();
      const s = (await t.state()).settings;
      t.expect(Number.isFinite(s.volume) && s.volume >= 0 && s.volume <= 100, 'volume is a finite 0-100 number, got ' + s.volume);
      t.equal([s.motion, s.theme, s.tileset, s.graphics, s.camera], ['auto', 'auto', 'auto', 'auto', 'classic'], 'enum values fall back to the defaults');
      t.equal([typeof s.sound, typeof s.showTimer], ['boolean', 'boolean'], 'booleans are booleans');
      await t.page.click('#b-play');
      t.equal((await t.state()).scene, 'layouts', 'Play works with junk settings');
      await t.game('scene', 'title');
      await t.page.click('#b-settings');
      t.equal((await t.state()).overlay, 'o-settings', 'Settings opens');
      await t.page.keyboard.press('Escape');
      // volume 9999 is clamped
      await t.page.evaluate(() => localStorage.setItem('bhm.settings.v1', '{"volume":9999}'));
      await t.reload();
      t.equal((await t.state()).settings.volume, 100, 'volume is clamped');
      // a stray error shows a toast and the game keeps going
      await t.page.evaluate(() => { setTimeout(() => { throw new Error('boom'); }, 0); });
      await t.page.waitForTimeout(200);
      t.expect(await t.page.evaluate(() => document.getElementById('toast').classList.contains('on')), 'a toast tells the player');
      await t.page.click('#b-play');
      t.equal((await t.state()).scene, 'layouts', 'the game still responds after a stray error');
    },
  },
  {
    name: 'S6-06: junk saves and junk stats do not show NaN or soft-lock',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'tower', seed: 777 }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 136); await t.game('act', 'hint');
      await t.page.evaluate(() => { document.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true); });
      const good = await t.page.evaluate(() => localStorage.getItem('bhm.game.v1'));
      t.expect(!!good, 'a good save exists');
      const mut = (fn) => { const o = JSON.parse(good); fn(o); return JSON.stringify(o); };
      const bad = {
        'score string': mut((o) => { o.score = 'abc'; }),
        'elapsedMs null': mut((o) => { o.elapsedMs = null; }),
        'status won': mut((o) => { o.status = 'won'; }),
      };
      // a page with a game in it saves itself when it hides, so reload first, then plant the save
      const plant = async (json) => { await t.reload(); await t.page.evaluate((j) => localStorage.setItem('bhm.game.v1', j), json); await t.reload(); };
      for (const [name, json] of Object.entries(bad)) {
        await plant(json);
        await t.page.click('#b-continue');
        const s = await t.state();
        t.equal([s.scene, s.tilesLeft, s.gameStatus], ['game', 144, 'playing'], name + ': the bad save is discarded and a fresh game starts');
        const hud = await t.page.evaluate(() => ['h-score', 'h-time', 'h-left'].map((id) => document.getElementById(id).textContent).join('|'));
        t.expect(!/NaN/.test(hud), name + ': HUD has no NaN: ' + hud);
      }
      // the good save still continues
      await plant(good); await t.page.click('#b-continue');
      t.equal((await t.state()).tilesLeft, 136, 'a good save still continues');
      // junk stats
      await t.page.evaluate(() => localStorage.setItem('bhm.stats.v1', JSON.stringify({ played: 'abc', won: null, streak: -4, layouts: { tower: null, pyramid: { played: 'x', won: 2, bestMs: 'abc' } }, daily: { done: null, streak: 'x', last: 5 } })));
      await t.reload();
      await t.page.click('#b-stats');
      const txt = await t.page.evaluate(() => document.getElementById('o-stats').innerText);
      t.expect(!/NaN|undefined|Infinity/.test(txt), 'Stats shows no NaN: ' + txt.replace(/s+/g, ' ').slice(0, 200));
      await t.page.keyboard.press('Escape');
      await t.page.click('#b-play');
      const cards = await t.page.evaluate(() => document.getElementById('cards').innerText);
      t.expect(!/NaN/.test(cards), 'layout cards show no NaN');
    },
  },
  {
    name: 'S6-01: a stale second tab does not erase stats or settings',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('unlockAll');
      const B = await t.page.context().newPage();
      try {
        await B.goto(t.page.url());
        await B.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
        const stats = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bhm.stats.v1')));
        // tab A wins a board
        await t.game('newGame', { layout: 'pyramid', seed: 11 }); await t.waitIdle(15000);
        await t.game('act', 'solveTo', 0);
        await t.page.waitForFunction(() => window.__game.getState().gameStatus === 'won', null, { timeout: 10000 });
        let a = await stats(t.page);
        t.equal([a.played, a.won], [1, 1], 'tab A recorded the win');
        // tab B, opened before the win, starts a game
        await B.evaluate(() => window.__game.newGame({ layout: 'tower', seed: 12 }));
        a = await stats(B);
        t.equal([a.played, a.won, a.streak], [2, 1, 1], 'tab B adds to the win instead of erasing it');
        // tab A hears about it without a reload
        await t.page.waitForFunction(() => window.__game.getState().statsPlayed === 2, null, { timeout: 5000 }).catch(() => {});
        t.equal((await t.state()).statsPlayed, 2, 'tab A follows the stats change');
        // settings: each tab changes a different setting
        await t.game('scene', 'settings');
        await t.page.click('#o-settings [data-set="camera"] [data-v="top"]');
        await B.evaluate(() => { const b = document.querySelector('#o-settings [data-set="theme"] [data-v="dark"]'); b.click(); });
        const st = JSON.parse(await t.page.evaluate(() => localStorage.getItem('bhm.settings.v1')));
        t.equal([st.camera, st.theme], ['top', 'dark'], 'both settings survive');
        await t.page.waitForFunction(() => window.__game.getState().settings.theme === 'dark', null, { timeout: 5000 }).catch(() => {});
        t.equal((await t.state()).settings.theme, 'dark', 'tab A follows the settings change');
      } finally { await B.close(); }
    },
  },
];
