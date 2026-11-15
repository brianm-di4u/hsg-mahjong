// Council wave 3, batch A: saves and lifecycle, controls, rules and play (S1-04, S4-26, S6-05, P-N01, S4-01, S1-10, S2-09, S3-17, S1-03, S2-19).
// Tests read the game's state through window.__game; animations are held still with animAt so nothing depends on timing.
const URL = 'index.html?gl=0';
const stored = (t, k) => t.page.evaluate((k) => { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }, k);
const put = (t, k, v) => t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v]);
const reload = async (t) => { await t.page.reload(); await t.page.waitForFunction(() => !!window.__game); await t.waitIdle(15000); };
// a free pair that matches (indexes into the tile list), or null
const freePair = (s) => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; };
const blockedTile = (s) => s.tiles.find((x) => x.present && !x.free);

export const tests = [
  // ------------------------------------------------------------------ S1-04
  {
    name: 'S1-04: an undone pair settles back from above, and with reduced motion it just returns',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const pr = freePair(await t.state());
      await t.game('act', 'match', pr[0], pr[1]); await t.waitIdle(15000);
      await t.game('act', 'animAt', 'now');                       // hold the animation clock so the state can be read at leisure
      t.equal(await t.game('act', 'undo'), true, 'undo works');
      const info = await t.game('act', 'animInfo');
      t.equal(info.drop, pr, 'the pair that came back is the pair that settles');
      t.equal((await t.state()).tiles[pr[0]].present, true, 'and it is back on the board at once');
      await t.shot('S1-04-undo-mid');
      await t.game('act', 'animAt', null);
      await t.waitIdle(15000);
      t.equal((await t.game('act', 'animInfo')).drop, null, 'it comes to rest');
      t.expect((await t.game('audioState')).cues.undo >= 1, 'with the undo cue, not the select tick');
      t.equal((await t.game('audioState')).cues.click || 0, 0, 'and no select click was played for it');
    },
  },
  {
    name: 'S1-04: reduced motion gives no settling animation',
    url: 'index.html',
    reducedMotion: true,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const pr = freePair(await t.state());
      await t.game('act', 'match', pr[0], pr[1]); await t.waitIdle(15000);
      await t.game('act', 'animAt', 'now');
      await t.game('act', 'undo');
      t.equal((await t.game('act', 'animInfo')).drop, null, 'no drop under reduced motion');
      await t.game('act', 'animAt', null);
    },
  },
  // ------------------------------------------------------------------ S4-26
  {
    name: 'S4-26: the title buttons carry their own solid colour, so their contrast is measured against the real pair',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      for (const theme of ['light', 'dark']) {
        await t.page.evaluate((th) => document.querySelector('[data-set="theme"] [data-v="' + th + '"]').click(), theme);
        const r = await t.contrastReport({ selector: '#s-title .menu .btn' });
        t.log(theme + ': ' + r.checked + ' title buttons checked, fails: ' + JSON.stringify(r.fails));
        t.expect(r.checked >= 5, 'the probe saw the title buttons (' + r.checked + ')');
        t.equal(r.fails, [], 'no title button fails contrast in the ' + theme + ' theme');
        const solid = await t.page.evaluate(() => [...document.querySelectorAll('#s-title .menu .btn')].filter((b) => !b.hidden && b.offsetParent && !b.classList.contains('primary')).map((b) => getComputedStyle(b).backgroundColor).every((c) => /^rgb\(/.test(c)));
        t.expect(solid, 'each title button has an opaque background colour under its gradient (' + theme + ')');
      }
      await t.shot('S4-26-title-buttons');
    },
  },
  // ------------------------------------------------------------------ S6-05
  {
    name: 'S6-05: a refused write (storage full) is said once in a toast and kept in the Settings and Stats notes',
    url: URL,
    viewports: ['desktop', 'mobile'],
    // the page's storage refuses every bhm.* write while window.__full is set, as a full disk does
    initScript: () => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (window.__full && String(k).startsWith('bhm.')) { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; } return set.call(this, k, v); };
    },
    async run(t) {
      const toastText = () => t.page.evaluate(() => (document.getElementById('toast').classList.contains('on') ? document.getElementById('toast').textContent : ''));
      const note = async () => { await t.game('scene', 'settings'); const x = await t.page.locator('#se-storage').innerText(); await t.page.evaluate(() => document.querySelector('#o-settings [data-close]').click()); return x; };
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      t.expect(/saved in this browser/.test(await note()), 'with room to write, the note says it is saved');
      t.equal(await toastText(), '', 'and there is no warning');
      await t.page.evaluate(() => { window.__full = true; });
      let s = await t.state(); const pr = freePair(s);
      await t.game('act', 'match', pr[0], pr[1]); await t.waitIdle(15000);
      t.expect(/storage is full/.test(await toastText()), 'the first refused write says so in a toast: ' + await toastText());
      await t.shot('S6-05-toast', { wait: false });
      t.expect(/will not be kept/.test(await note()), 'and Settings says progress will not be kept');
      await t.game('scene', 'stats');
      t.expect(/storage is full/.test(await t.page.locator('#ost-body').innerText()), 'and so does Stats');
      await t.page.evaluate(() => document.querySelector('#o-stats [data-close]').click());
      await t.page.evaluate(() => { document.getElementById('toast').classList.remove('on'); document.getElementById('toast').textContent = ''; });
      s = await t.state(); const pr2 = freePair(s);
      await t.game('act', 'match', pr2[0], pr2[1]); await t.waitIdle(15000);
      t.equal(await toastText(), '', 'a second refused write does not toast again');
      await t.game('scene', 'settings'); await t.page.locator('#se-storage').scrollIntoViewIfNeeded(); await t.shot('S6-05-settings-note');
      await t.page.evaluate(() => document.querySelector('#o-settings [data-close]').click());
      await t.page.evaluate(() => { window.__full = false; });
      s = await t.state(); const pr3 = freePair(s);
      await t.game('act', 'match', pr3[0], pr3[1]); await t.waitIdle(15000);
      t.expect(/saved in this browser/.test(await note()), 'once a write succeeds the note goes back to normal');
      t.equal((await stored(t, 'bhm.game.v1')).history.length, 3, 'and the game is saved again');
    },
  },
  // ------------------------------------------------------------------ P-N01
  {
    name: 'P-N01: reloading does not dodge the win streak: abandoning the saved game resets it',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const setStreak = (n) => t.page.evaluate((n) => { const s = JSON.parse(localStorage.getItem('bhm.stats.v1')); s.streak = n; s.bestStreak = Math.max(n, s.bestStreak || 0); localStorage.setItem('bhm.stats.v1', JSON.stringify(s)); }, n);
      const startFromTitle = async () => { await t.page.click('#b-play'); await t.page.click('.card[data-layout="pyramid"]'); };
      // a saved game with a match, and a streak of 4
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const pr = freePair(await t.state());
      await t.game('act', 'match', pr[0], pr[1]); await t.waitIdle(15000);
      await setStreak(4);
      await reload(t);
      t.equal((await stored(t, 'bhm.game.v1')).history.length, 1, 'the game with a match is saved');
      await startFromTitle();
      const text = await t.page.locator('#oc-text').innerText();
      t.expect(await t.page.locator('#o-confirm.on').count() === 1, 'the Abandon dialog opens');
      t.expect(/your saved game and resets your win streak of 4./.test(text), 'and it says what is at stake: ' + text);
      t.equal((await stored(t, 'bhm.stats.v1')).streak, 4, 'asking does not change the streak');
      await t.shot('P-N01-confirm');
      await t.page.click('#oc-keep');
      t.equal((await stored(t, 'bhm.stats.v1')).streak, 4, 'keeping the game keeps the streak');
      await t.page.click('.card[data-layout="pyramid"]'); await t.page.click('#oc-new'); // still on the picker after keeping
      t.equal((await stored(t, 'bhm.stats.v1')).streak, 0, 'abandoning it after a reload resets the streak, as the dialog said');
      t.equal((await t.state()).scene, 'game', 'and the new game started');
      // a saved game with no match yet has nothing to lose
      await t.game('newGame', { layout: 'pyramid', seed: 22 }); await t.waitIdle(15000);
      await setStreak(4);
      await reload(t);
      await startFromTitle();
      t.equal(await t.page.locator('#o-confirm.on').count(), 0, 'no dialog for a game with no match');
      t.equal((await stored(t, 'bhm.stats.v1')).streak, 4, 'and the streak is untouched');
    },
  },
  // ------------------------------------------------------------------ S4-01
  {
    name: 'S4-01: the title steam drifts; the table has banks of steam in 3D; both stand still under reduced motion',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const hash = () => t.page.evaluate(() => { const c = document.getElementById('title-steam'); if (!c.width) return ''; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 3; i < d.length; i += 4) h = (h * 31 + d[i]) | 0; return String(h); });
      await t.page.waitForFunction(() => { const c = document.getElementById('title-steam'); return c.width > 0; });
      // six changes in a row: one-off redraws (art arriving) cannot give that, only a running loop can
      let h = await hash();
      t.expect(h !== '', 'the title has a steam layer with puffs drawn');
      for (let k = 0; k < 6; k++) {
        await t.page.waitForFunction((prev) => { const c = document.getElementById('title-steam'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let x = 0; for (let i = 3; i < d.length; i += 4) x = (x * 31 + d[i]) | 0; return String(x) !== prev; }, h, { timeout: 15000 });
        h = await hash();
      }
      await t.shot('S4-01-title');
      // the table: three banks of steam, animated, between the backdrop and the tiles
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const gl = (await t.state()).gfx === '3d';
      const info = () => t.page.evaluate(() => { const w = document.getElementById('board-steam'); const i = [...w.children]; return { shown: getComputedStyle(w).display !== 'none', n: i.length, anim: i.map((e) => getComputedStyle(e).animationName), tf: getComputedStyle(i[0]).transform, order: [...document.getElementById('board-wrap').children].map((e) => e.id).filter(Boolean).slice(0, 4) }; });
      let b = await info();
      t.equal(b.n, 3, 'three steam banks');
      if (gl) {
        t.expect(b.shown && b.anim.every((a) => a === 'steam-drift'), 'in 3D the banks are shown and animated');
        t.equal(b.order.slice(0, 3), ['board-bg', 'board-steam', 'board3d'], 'they sit between the backdrop and the tiles');
        await t.page.waitForFunction((tf) => getComputedStyle(document.querySelector('#board-steam i')).transform !== tf, b.tf, { timeout: 15000 });
        t.expect(true, 'and they drift');
        await t.shot('S4-01-table');
      } else t.log('no 3D here: the table check ran on the flat renderer');
      // turning Reduced on stops them at once
      await t.page.evaluate(() => document.querySelector('[data-set="motion"] [data-v="reduced"]').click());
      b = await info();
      t.expect(b.anim.every((a) => a === 'none'), 'Reduced motion stops the banks: ' + b.anim);
      await t.game('scene', 'title');
      await t.waitIdle(15000); await t.waitFrames(5);
      const r0 = await hash(); await t.waitFrames(20);
      t.equal(await hash(), r0, 'and the title steam holds still');
    },
  },
  {
    name: 'S4-01: with flat tiles the table draws its own backdrop, so there is no steam layer over it',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      t.equal(await t.page.evaluate(() => getComputedStyle(document.getElementById('board-steam')).display), 'none', 'hidden on the flat renderer');
    },
  },
  {
    name: 'S4-01: a player who asked for reduced motion starts with the steam still',
    url: 'index.html',
    reducedMotion: true,
    viewports: ['desktop'],
    async run(t) {
      await t.page.waitForFunction(() => document.getElementById('title-steam').width > 0);
      const hash = () => t.page.evaluate(() => { const c = document.getElementById('title-steam'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 3; i < d.length; i += 4) h = (h * 31 + d[i]) | 0; return h; });
      await t.waitIdle(15000); await t.waitFrames(5);
      const a = await hash(); await t.waitFrames(30);
      t.equal(await hash(), a, 'the title steam does not move');
      t.expect(await t.page.evaluate(() => document.getElementById('board-steam').classList.contains('still')), 'and the table steam is marked still');
    },
  },
  // ------------------------------------------------------------------ S1-10
  {
    name: 'S1-10: a blocked tap rings the tiles that block it and says whether it is covered or hemmed in',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const s = await t.state(), P = s.tiles.filter((x) => x.present);
      const above = (a) => P.filter((b) => b.z === a.z + 1 && Math.abs(b.x - a.x) < 2 && Math.abs(b.y - a.y) < 2).map((b) => b.i);
      const sides = (a) => P.filter((b) => b.z === a.z && Math.abs(b.y - a.y) < 2 && Math.abs(b.x - a.x) === 2).map((b) => b.i);
      const covered = P.find((a) => !a.free && above(a).length), hemmed = P.find((a) => !a.free && !above(a).length);
      t.expect(!!covered && !!hemmed, 'the board has both kinds of blocked tile');
      await t.game('act', 'animAt', 'now');                         // hold the clock: the ring is read as state, not caught on a frame
      await t.game('act', 'click', covered.i);
      let info = await t.game('act', 'animInfo');
      t.equal([...info.block].sort((a, b) => a - b), above(covered).sort((a, b) => a - b), 'the ring is on the tiles above the covered tile');
      t.expect(/^Blocked: .*Covered: the tiles? on top of it must go first.$/.test((await t.state()).status), 'and the line says so: ' + (await t.state()).status);
      await t.shot('S1-10-covered');
      await t.game('act', 'click', hemmed.i);
      info = await t.game('act', 'animInfo');
      t.equal([...info.block].sort((a, b) => a - b), sides(hemmed).sort((a, b) => a - b), 'for a tile hemmed in, the ring is on the tiles at its sides');
      t.equal(info.block.length, 2, 'one each side');
      t.expect(/Hemmed in: it has a tile on its left and one on its right.$/.test((await t.state()).status), 'and the line says so: ' + (await t.state()).status);
      await t.shot('S1-10-hemmed');
      await t.game('act', 'animAt', null);
      await t.waitIdle(15000);
      t.equal((await t.game('act', 'animInfo')).block, null, 'the ring is gone after a moment');
      t.equal((await t.state()).selected, -1, 'and the blocked tap selected nothing');
    },
  },
  // ------------------------------------------------------------------ S2-09
  {
    name: 'S2-09: the title heading stays inside its panel at 320 px wide, and at 360 and 390',
    url: 'index.html',
    viewports: ['mobile'],
    async run(t) {
      for (const [w, h] of [[320, 568], [360, 740], [390, 844]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.page.evaluate(() => document.fonts.ready);
        await t.waitFrames(3);
        const r = await t.page.evaluate(() => {
          const el = document.querySelector('#t-h'), panel = el.closest('.title-block'), q = document.createRange(); q.selectNodeContents(el);
          const tr = q.getBoundingClientRect(), pr = panel.getBoundingClientRect(), ps = getComputedStyle(panel);
          return { left: tr.left, right: tr.right, pl: pr.left + parseFloat(ps.paddingLeft), pr: pr.right - parseFloat(ps.paddingRight), over: el.scrollWidth - el.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth };
        });
        t.log(w + ' px: text ' + Math.round(r.left) + ' to ' + Math.round(r.right) + ' in ' + Math.round(r.pl) + ' to ' + Math.round(r.pr));
        t.expect(r.left >= r.pl - 1 && r.right <= r.pr + 1, w + ' px: the title text lies inside the panel padding');
        t.expect(r.over <= 1, w + ' px: the heading does not overflow its box');
        t.expect(r.docOver <= 0, w + ' px: the page does not scroll sideways');
        if (w === 320) await t.shot('S2-09-title-320');
      }
    },
  },
  // ------------------------------------------------------------------ S3-17
  {
    name: 'S3-17: selecting a tile rings its free partners, and Highlight free tiles (or Expert) turns that off',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      let s = await t.state();
      const free = s.tiles.filter((x) => x.present && x.free), byKey = {};
      for (const x of free) (byKey[x.key] = byKey[x.key] || []).push(x.i);
      const group = Object.values(byKey).find((g) => g.length >= 3), lone = Object.values(byKey).find((g) => g.length === 1);
      t.expect(!!group, 'the board has a face with three or more free tiles');
      t.equal((await t.state()).partners, [], 'nothing is ringed until a tile is selected');
      await t.game('act', 'click', group[0]);
      s = await t.state();
      t.equal(s.selected, group[0], 'the tile is selected');
      t.equal(s.partners, group.slice(1), 'its free partners are ringed, and nothing else');
      await t.shot('S3-17-partners');
      if (lone) { await t.game('act', 'click', group[0]); await t.game('act', 'click', lone[0]); t.equal((await t.state()).partners, [], 'a tile with no free partner rings nothing'); await t.game('act', 'click', lone[0]); }
      else await t.game('act', 'click', group[0]);
      t.equal((await t.state()).partners, [], 'deselecting clears the rings');
      await t.game('act', 'click', group[0]);
      t.equal((await t.state()).partners.length, group.length - 1, 'selected again, the rings return');
      await t.page.evaluate(() => document.getElementById('se-free').click());
      t.equal((await t.state()).partners, [], 'with Highlight free tiles off there are no rings');
      await t.page.evaluate(() => document.getElementById('se-free').click());
      t.equal((await t.state()).partners.length, group.length - 1, 'and back on they return');
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'expert' }); await t.waitIdle(15000);
      s = await t.state();
      const g2 = s.tiles.filter((x) => x.present && x.free).filter((x) => s.tiles.filter((y) => y.present && y.free && y.key === x.key).length >= 2);
      await t.game('act', 'click', g2[0].i);
      t.equal((await t.state()).partners, [], 'Expert shows no free-tile help, so no rings');
    },
  },
  // ------------------------------------------------------------------ S1-03
  {
    name: 'S1-03: the wheel and a trackpad pinch zoom the board in and out',
    url: 'index.html',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const c = await t.game('act', 'tileCenter', 40);
      await t.page.mouse.move(c.x, c.y);
      await t.page.mouse.wheel(0, -120);
      await t.page.waitForFunction(() => window.__game.getState().zoom === true);
      t.expect(true, 'wheel up zooms in');
      await t.waitIdle(15000);
      await t.page.mouse.wheel(0, -120);
      t.equal((await t.state()).zoom, true, 'more wheel up changes nothing');
      await t.page.mouse.wheel(0, 120);
      await t.page.waitForFunction(() => window.__game.getState().zoom === false);
      t.expect(true, 'wheel down fits the board again');
      await t.waitIdle(15000);
      await t.page.keyboard.down('Control'); await t.page.mouse.wheel(0, -120); await t.page.keyboard.up('Control');
      await t.page.waitForFunction(() => window.__game.getState().zoom === true);
      t.expect(true, 'a trackpad pinch (ctrl+wheel) zooms in too');
      await t.game('act', 'tileCenter', 0); // the page still works
      await t.game('scene', 'settings');
      await t.page.mouse.wheel(0, 120);
      t.equal((await t.state()).zoom, true, 'with a dialog open the wheel leaves the board alone');
    },
  },
  {
    name: 'S1-03: Zoom glides in 3D (over 160 ms, ending on the zoomed view) and snaps under reduced motion',
    url: 'index.html',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      if ((await t.state()).gfx !== '3d') { t.log('no 3D here: the glide is a 3D effect'); return; }
      // read inside one synchronous call, so nothing depends on how fast the frames come
      const r = await t.page.evaluate(() => {
        const g = window.__game, before = g.act('screenCenter', 0), w0 = g.getState().tileW;
        g.act('zoom', true);
        return { before, during: g.act('screenCenter', 0), glide: g.getState().gliding, w0 };
      });
      t.expect(Math.hypot(r.during[0] - r.before[0], r.during[1] - r.before[1]) < 3, 'the first instant of the glide is still the fitted view (within a pixel or two)');
      await t.waitIdle(15000);
      const after = await t.game('act', 'screenCenter', 0), s = await t.state();
      t.expect(Math.hypot(after[0] - r.before[0], after[1] - r.before[1]) > 20, 'it lands on the zoomed view');
      t.expect(s.tileW > r.w0, 'with larger tiles (' + r.w0 + ' to ' + s.tileW + ')');
      t.equal((await t.game('act', 'screenCenter', 0)).map(Math.round), after.map(Math.round), 'and stays there');
      await t.shot('S1-03-zoomed');
      await t.page.evaluate(() => window.__game.act('zoom', false)); await t.waitIdle(15000);
      const back = await t.game('act', 'screenCenter', 0);
      t.expect(Math.hypot(back[0] - r.before[0], back[1] - r.before[1]) < 3, 'zooming out returns to the fitted view');
    },
  },
  {
    name: 'S1-03: with reduced motion Zoom snaps at once',
    url: 'index.html',
    reducedMotion: true,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const r = await t.page.evaluate(() => { const g = window.__game, before = g.act('screenCenter', 0); g.act('zoom', true); return { before, now: g.act('screenCenter', 0) }; });
      t.expect(Math.hypot(r.now[0] - r.before[0], r.now[1] - r.before[1]) > 20, 'the very next read is already the zoomed view');
    },
  },
  {
    name: 'S1-03: a zoomed pan glides on after release and stops by itself; a touch or a new game stops it',
    url: 'index.html',
    viewports: ['mobile'], // a phone is where the board is bigger than the screen and there is room to glide
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await t.game('act', 'zoom', true); await t.waitIdle(15000);
      const p0 = await t.state();
      await t.game('act', 'coast', 0.5, 0);
      t.equal((await t.state()).gliding, true, 'a glide is under way');
      await t.page.waitForFunction(() => !window.__game.getState().gliding, null, { timeout: 15000 });
      const p1 = await t.state();
      t.expect(Math.abs(p1.panX - p0.panX) > 10, 'the board moved on its own (' + Math.round(p0.panX) + ' to ' + Math.round(p1.panX) + ')');
      t.equal(p1.gliding, false, 'and then stopped');
      await t.game('act', 'coast', 0.5, 0);
      await t.game('newGame', { layout: 'pyramid', seed: 22 });
      t.equal((await t.state()).gliding, false, 'a new game ends a glide');
      // a real drag with the mouse: release while still moving, and the board carries on (the drag is retried if the tool stalls)
      await t.waitIdle(15000);
      await t.game('act', 'zoom', true); await t.waitIdle(15000);
      let moved = false;
      for (let attempt = 0; attempt < 3 && !moved; attempt++) {
        const c = await t.game('act', 'tileCenter', 40), p0 = (await t.state()).panX;
        await t.page.mouse.move(c.x, c.y); await t.page.mouse.down();
        for (let k = 1; k <= 6; k++) await t.page.mouse.move(c.x - k * 12, c.y); // 72 px to the left
        await t.page.mouse.up();                                              // straight after the last move: still moving
        await t.page.waitForFunction(() => !window.__game.getState().gliding, null, { timeout: 15000 });
        const p1 = (await t.state()).panX;
        if (p0 - p1 > 72 + 5) moved = true;                                   // further than the drag itself: it glided
        else { await t.game('act', 'zoom', false); await t.game('act', 'zoom', true); await t.waitIdle(15000); }
      }
      t.expect(moved, 'a quick drag released while moving carries on');
    },
  },
  {
    name: 'S1-03: a touch drag on the board and then a tap on Zoom turns Zoom on at the first tap',
    url: 'index.html',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'terraces', seed: 5 }); await t.waitIdle(15000);
      const a = await t.game('act', 'tileCenter', 20);
      await t.touchDrag([a.x, a.y], [a.x - 60, a.y - 30], { steps: 5 });
      const box = await t.page.locator('#t-zoom').boundingBox();
      await t.tap([box.x + box.width / 2, box.y + box.height / 2]);
      await t.page.waitForFunction(() => window.__game.getState().zoom === true, null, { timeout: 5000 });
      t.expect(true, 'the first tap on Zoom after a touch drag zooms in');
      await t.waitIdle(15000);
      await t.shot('S1-03-touch-zoom');
    },
  },
  // ------------------------------------------------------------------ S2-19
  {
    name: 'S2-19: after a match its story follows the Matched line: a Bathhouse pair brings a Did you know, any other pair its own tile story',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const facts = await t.page.evaluate(() => JSON.parse(document.getElementById('facts').textContent).map((f) => f.e));
      t.expect(facts.length > 100, 'the game carries its sourced facts (' + facts.length + ')');
      // a deal (the first of a fixed run of seeds) with a free Bathhouse pair and a free pair of another kind
      let bath = null, other = null;
      for (let seed = 1; seed < 40 && !(bath && other); seed++) {
        await t.game('newGame', { layout: 'pyramid', seed }); await t.waitIdle(15000);
        const s = await t.state(), f = s.tiles.filter((x) => x.present && x.free);
        bath = null; other = null;
        for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) { if (f[a].f >= 9 && f[a].f < 18) bath = bath || [f[a].i, f[b].i, f[a].f]; else if (f[a].f < 9) other = other || [f[a].i, f[b].i, f[a].f]; }
      }
      t.expect(!!(bath && other), 'found a deal with both kinds of pair');
      await t.game('act', 'match', bath[0], bath[1]);
      t.expect(/^Matched Bathhouse/.test((await t.state()).status), 'first the Matched line: ' + (await t.state()).status);
      await t.page.waitForFunction(() => /^Did you know[?] /.test(window.__game.getState().status), null, { timeout: 15000 });
      const line = (await t.state()).status;
      t.expect(facts.includes(line.replace('Did you know? ', '')), 'then a Did you know from the sourced facts: ' + line);
      await t.shot('S2-19-did-you-know');
      const names = await t.game('act', 'faceMeta');
      await t.game('act', 'match', other[0], other[1]);
      await t.page.waitForFunction((n) => window.__game.getState().status.startsWith(n + ': '), names[other[2]].name, { timeout: 15000 });
      t.expect(true, 'a Springs pair brings its own story: ' + (await t.state()).status);
      // doing something else in between keeps the story back
      const s2 = await t.state(), pr = (() => { const f = s2.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; })();
      await t.game('act', 'match', pr[0], pr[1]);
      const free = (await t.state()).tiles.find((x) => x.present && x.free && x.i !== pr[0] && x.i !== pr[1]);
      await t.game('act', 'click', free.i);
      const picked = (await t.state()).status;
      await t.page.waitForTimeout(3000); // longer than the Matched line is held
      t.equal((await t.state()).status, picked, 'a tap before the story arrives keeps its own line');
    },
  },
];
