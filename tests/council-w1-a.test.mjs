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
];
