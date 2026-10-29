// 3D board (board3d.js on three.js): renderer, fallbacks, mid-animation frames, camera, phone layouts.
// The harness renders WebGL with SwiftShader, so 3D is forced with ?gl=1 unless a test is about choosing it.
const LAYOUTS = ['pyramid', 'tower', 'arlington', 'row', 'islands', 'terraces', 'display'];

const TESTS = [
  {
    name: '3D board renders in one instanced draw',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 2026 });
      const s = await t.state();
      t.equal(s.gfx, '3d', '3D renderer active');
      await t.shot('09-3d-pyramid');
      const gl = await t.game('act', 'gl');
      t.expect(gl.calls <= 5, 'draw calls per frame: ' + gl.calls);
      t.equal(gl.gl, 'webgl2', 'WebGL2 context');
      t.log('renderer: ' + s.glName + ', ' + gl.calls + ' draw calls, ' + gl.triangles + ' triangles');
    },
  },
  {
    name: 'flat tiles with ?gl=0',
    url: 'index.html?gl=0',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 2026 });
      t.equal((await t.state()).gfx, '2d', '2D renderer with ?gl=0');
      await t.shot('09-flat');
    },
  },
  {
    name: 'Tiles setting switches renderer',
    viewports: ['desktop'],
    url: 'index.html',
    async run(t) {
      await t.game('scene', 'settings');
      await t.page.click('[data-set="graphics"] [data-v="3d"]');
      await t.game('newGame', { layout: 'tower', seed: 3 });
      t.equal((await t.state()).gfx, '3d', 'Tiles: 3D');
      await t.game('scene', 'settings');
      await t.page.click('[data-set="graphics"] [data-v="flat"]');
      await t.game('scene', 'game');
      t.equal((await t.state()).gfx, '2d', 'Tiles: Flat');
      await t.reload();
      t.equal((await t.state()).settings.graphics, 'flat', 'choice persists');
    },
  },
  {
    name: 'slow frames under Auto switch to flat tiles',
    viewports: ['desktop'],
    url: 'index.html?glhw=1', // treat SwiftShader as a GPU, so the watchdog (not the software check) has to act
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 5 });
      t.equal((await t.state()).gfx, '3d', 'starts in 3D');
      // keep it animating until the watchdog has seen enough frames
      await t.page.waitForFunction(() => { const g = window.__game; if (g.getState().gfx === '2d') return true; g.act('shuffle'); return false; }, null, { timeout: 120000, polling: 1500 }).catch(() => {});
      const s = await t.state();
      t.log('frames measured on ' + s.glName);
      t.equal(s.gfx, '2d', 'watchdog switched to flat tiles');
      t.expect(await t.page.evaluate(() => localStorage.getItem('bhm.gl.slow') === 'true'), 'remembered for the next visit');
    },
  },
  {
    name: 'context loss falls back to flat tiles',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'islands', seed: 4 });
      t.equal((await t.state()).gfx, '3d', '3D first');
      await t.game('act', 'loseContext');
      await t.page.waitForTimeout(300);
      const s = await t.state();
      t.equal(s.gfx, '2d', 'flat after the WebGL context is lost');
      t.equal(s.tilesLeft, 144, 'game state untouched');
      await t.shot('09-context-lost');
    },
  },
  {
    name: 'mid-animation frames: deal, match, shuffle',
    async run(t) {
      await t.game('newGame', { layout: 'arlington', seed: 21 });
      await t.game('act', 'animAt', 520, 'deal');
      await t.shot('09-deal-mid');
      await t.game('act', 'animAt', null);
      await t.waitForStable();
      const pr = await t.game('act', 'hint');
      await t.game('act', 'match', pr[0], pr[1]);
      await t.game('act', 'animAt', 300);
      await t.shot('09-match-rise');
      await t.game('act', 'animAt', 470);
      await t.shot('09-match-clack');
      await t.game('act', 'animAt', null);
      await t.waitForStable();
      await t.game('act', 'shuffle');
      await t.game('act', 'animAt', 430, 'shuffle');
      await t.shot('09-shuffle-mid');
      await t.game('act', 'animAt', null);
      await t.page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 30000 }).catch(() => {}); // software WebGL: a 0.9 s flip can take many seconds
      await t.shot('09-shuffle-done');
    },
  },
  {
    name: 'every layout fits the board area',
    async run(t) {
      for (const id of LAYOUTS) {
        await t.game('newGame', { layout: id, seed: 7 });
        await t.waitForStable();
        const f = await t.game('act', 'boardFits');
        t.equal(f.out, 0, id + ': every tile on screen (' + f.w + 'x' + f.h + ', tiles ' + f.tileW + ' px)');
      }
      await t.checkLayout();
    },
  },
  {
    name: 'portrait layouts keep phone tiles large',
    viewports: ['mobile'],
    async run(t) {
      for (const id of ['terraces', 'display']) {
        await t.game('newGame', { layout: id, seed: 12 });
        const s = await t.state();
        t.expect(s.tileW >= 38, id + ' tiles are ' + s.tileW + ' px wide on a 390 px phone');
        await t.shot('09-phone-' + id);
      }
      await t.game('scene', 'layouts');
      const first = await t.page.locator('.card').first().getAttribute('data-layout');
      t.expect(first === 'terraces', 'phone layouts lead the picker (' + first + ')');
      t.expect(await t.page.locator('.card .tag').count() === 2, 'both carry a "Fits phones" tag');
      await t.shot('09-phone-picker');
    },
  },
  {
    name: 'camera settings: Classic (default), Tilted, Top-down',
    async run(t) {
      t.equal((await t.state()).settings.camera, 'classic', 'Classic oblique camera by default');
      await t.game('newGame', { layout: 'arlington', seed: 8 });
      await t.shot('09-camera-classic');
      for (const v of ['tilted', 'top']) {
        await t.game('scene', 'settings');
        await t.page.click(`[data-set="camera"] [data-v="${v}"]`);
        await t.game('newGame', { layout: 'arlington', seed: 8 });
        t.equal((await t.state()).settings.camera, v, v + ' camera saved');
        const f = await t.game('act', 'boardFits');
        t.equal(f.out, 0, v + ': every tile on screen');
        await t.shot('09-camera-' + v);
      }
    },
  },
  {
    name: 'a portrait phone starts on a layout that fits it',
    viewports: ['mobile'],
    async run(t) {
      await t.page.evaluate(() => localStorage.clear());
      await t.reload();
      await t.page.click('#b-play');
      await t.page.locator('.card').first().click();
      const s = await t.state();
      t.equal(s.layoutId, 'terraces', 'first card on a phone is Tufa Terraces');
      await t.game('newGame', {});
      t.equal((await t.state()).layoutId, 'terraces', 'and a new game with no layout picked uses it');
      t.expect((await t.state()).tileW >= 38, 'tiles ' + (await t.state()).tileW + ' px wide');
      await t.shot('09-phone-default');
      await t.page.click('#t-zoom');
      await t.waitForStable();
      const z = await t.state();
      t.expect(z.tileW >= 50, 'zoom on a phone fills the height: tiles ' + z.tileW + ' px');
      await t.shot('09-phone-zoom');
    },
  },
  {
    name: 'Neon Night in 3D',
    colorScheme: 'dark',
    async run(t) {
      await t.game('newGame', { layout: 'tower', seed: 31 });
      const pr = await t.game('act', 'hint');
      await t.game('act', 'click', pr[0]);
      await t.shot('09-dark-3d');
    },
  },
];
export const tests = TESTS.map((x) => ({ url: 'index.html?gl=1', ...x }));
