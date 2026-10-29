// Free-tile highlight, dark theme, reduced motion, sound settings (PRD AC22, AC26-AC28).
const TESTS = [
  {
    name: 'free-tile highlight toggle',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 77 });
      t.equal((await t.state()).settings.highlightFree, true, 'highlight on by default');
      const on = await t.shot('05-highlight-on');
      await t.page.click('#t-free');
      t.equal((await t.state()).settings.highlightFree, false, 'toolbar toggles it off');
      t.equal(await t.page.getAttribute('#t-free', 'aria-pressed'), 'false', 'toggle state exposed');
      const off = await t.shot('05-highlight-off');
      t.expect(off.stats.mean > on.stats.mean + 2, `blocked tiles are dimmed only when on (mean ${on.stats.mean} vs ${off.stats.mean})`);
      await t.game('act', 'key', 'f');
      t.equal((await t.state()).settings.highlightFree, true, 'F key toggles it back');
    },
  },
  {
    name: 'dark theme from the color scheme',
    colorScheme: 'dark',
    async run(t) {
      t.equal((await t.state()).theme, 'dark', 'auto theme follows prefers-color-scheme: dark');
      await t.shot('05-dark-title');
      await t.game('newGame', { layout: 'arlington', seed: 3 });
      const pr = await t.game('act', 'hint');
      await t.game('act', 'click', pr[0]);
      await t.shot('05-dark-game');
      await t.game('scene', 'help');
      await t.shot('05-dark-help');
      const bad = (await t.game('act', 'contrast')).filter((c) => c.ratio < 4.5);
      t.equal(bad, [], 'dark theme text contrast >= 4.5');
    },
  },
  {
    name: 'manual theme switch',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"] [data-v="dark"]');
      t.equal((await t.state()).theme, 'dark', 'Neon Night selected');
      await t.page.click('[data-set="theme"] [data-v="light"]');
      t.equal((await t.state()).theme, 'light', 'Light selected');
    },
  },
  {
    // wall-clock settle time on the flat renderer (software WebGL in the harness takes ~0.5 s a frame);
    // the 3D test below checks the same policy through the animation list
    name: 'reduced motion uses short fades',
    reducedMotion: true,
    url: 'index.html?gl=0',
    async run(t) {
      await t.game('newGame', { layout: 'tower', seed: 8 });
      t.equal((await t.state()).reduced, true, 'reduced motion detected');
      const pr = await t.game('act', 'hint');
      const t0 = Date.now();
      await t.game('act', 'match', pr[0], pr[1]);
      await t.waitForStable();
      const ms = Date.now() - t0;
      t.expect(ms < 600, 'match settles quickly with reduced motion (' + ms + ' ms)');
      await t.shot('05-reduced');
    },
  },
  {
    name: 'sound settings',
    viewports: ['desktop'],
    async run(t) {
      const before = await t.page.evaluate(() => window.__game.getState().settings.sound);
      t.equal(before, true, 'sound on by default');
      await t.game('scene', 'settings');
      await t.page.click('#se-sound');
      t.equal((await t.state()).settings.sound, false, 'sound off');
      await t.page.fill('#se-vol', '30');
      t.equal((await t.state()).settings.volume, 30, 'volume saved');
      await t.page.click('#se-sound');
      t.equal((await t.state()).settings.sound, true, 'sound on');
      const saved = await t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.settings.v1')));
      t.equal(saved.volume, 30, 'settings persisted');
    },
  },
  {
    name: 'reduced motion in 3D: short fades only',
    reducedMotion: true,
    async run(t) {
      await t.game('newGame', { layout: 'tower', seed: 8 });
      const a0 = await t.game('act', 'animInfo');
      t.equal(a0.dealAt, 0, 'no deal-in animation');
      const pr = await t.game('act', 'hint');
      await t.game('act', 'match', pr[0], pr[1]);
      const a1 = await t.game('act', 'animInfo');
      t.expect(a1.list.length === 1 && a1.list[0].type === 'fade' && a1.list[0].dur <= 200, 'match is one short fade: ' + JSON.stringify(a1.list));
      t.equal(a1.particles, 0, 'no steam, sparks or score pops');
      await t.game('act', 'shuffle');
      t.equal((await t.game('act', 'animInfo')).shuffleAt, 0, 'no shuffle flip');
      await t.shot('05-reduced-3d');
    },
  },
];
// 3D tiles are forced on (?gl=1): the harness's Chromium renders WebGL with SwiftShader, where Tiles: Auto
// would pick flat tiles. Tests that set their own url keep it.
export const tests = TESTS.map((x) => ({ url: 'index.html?gl=1', ...x }));
