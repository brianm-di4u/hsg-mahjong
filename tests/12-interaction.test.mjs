// Interaction: picking on every layout and camera, input during transient states, every key, keyboard reach,
// and the mobile text-selection fix. See TEST-CAMPAIGN.md, phase C.
const LAYOUTS = ['pyramid', 'tower', 'arlington', 'row', 'islands', 'terraces', 'display'];

// In the page: every tile with nothing on top picks itself at its projected centre, and a tap anywhere well inside
// a free tile's face never lands on a blocked tile.
function pickSweep({ tol }) {
  const g = window.__game, s = g.getState(), out = { checked: 0, wrong: [], blockedHits: [] };
  const r = document.getElementById('board').getBoundingClientRect();
  const on = (x, y) => x >= 0 && y >= 0 && x <= r.width && y <= r.height;
  const topOf = new Map(); for (const t of s.tiles) topOf.set(t.i, t);
  const covered = (t) => s.tiles.some((u) => u.present && u.z === t.z + 1 && Math.abs(u.x - t.x) < 2 && Math.abs(u.y - t.y) < 2);
  for (const t of s.tiles) {
    if (!t.present || covered(t)) continue;
    const [x, y] = g.act('screenCenter', t.i); if (!on(x, y)) continue;
    out.checked++;
    const got = g.act('tileAt', r.left + x, r.top + y, 0);
    if (got !== t.i) out.wrong.push(`${t.i}→${got}`);
    if (t.free) {
      const w = s.tileW * 0.38;
      for (const [dx, dy] of [[-w, 0], [w, 0], [0, -w * 1.1], [0, w * 1.1]]) {
        if (!on(x + dx, y + dy)) continue;
        const h = g.act('tileAt', r.left + x + dx, r.top + y + dy, tol);
        if (h >= 0 && !topOf.get(h).free) out.blockedHits.push(`${t.i}+(${dx | 0},${dy | 0})→${h}`);
      }
    }
  }
  return out;
}

async function setCamera(t, v) { await t.page.evaluate((v) => document.querySelector(`[data-set="camera"] [data-v="${v}"]`).click(), v); await t.waitFrames(3); }

const TESTS = [
  {
    name: 'picking: every exposed tile picks itself, on every layout and camera, zoomed and with a selection',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const tol = t.viewport === 'mobile' ? 9 : 4;
      for (const cam of ['classic', 'tilted', 'top']) {
        await setCamera(t, cam);
        for (const id of LAYOUTS) {
          await t.game('newGame', { layout: id, seed: 31 });
          await t.waitIdle(15000);
          await t.game('act', 'solveTo', 120); // a board with gaps, partly cleared stacks
          await t.waitIdle(15000);
          const r = await t.page.evaluate(pickSweep, { tol });
          t.equal(r.wrong, [], `${cam}/${id}: tiles that do not pick themselves (of ${r.checked})`);
          t.equal(r.blockedHits, [], `${cam}/${id}: taps inside a free tile that hit a blocked one`);
          if (cam === 'classic') {
            // with a lifted selection, and zoomed in
            const s = await t.state(); const f = s.tiles.find((x) => x.present && x.free);
            await t.game('act', 'click', f.i); await t.waitFrames(3);
            const c = await t.game('act', 'tileCenter', f.i);
            t.equal(await t.game('act', 'tileAt', c.x, c.y, 0), f.i, `${id}: the lifted selection still picks itself`);
            await t.game('act', 'zoom', true); await t.waitIdle(15000);
            const z = await t.page.evaluate(pickSweep, { tol });
            t.equal(z.wrong, [], `${id} zoomed: tiles that do not pick themselves (of ${z.checked})`);
            const fs = await t.game('act', 'tileCenter', f.i), box = await t.page.locator('#board').boundingBox();
            t.expect(fs.x > box.x && fs.x < box.x + box.width && fs.y > box.y && fs.y < box.y + box.height, `${id}: zoom keeps the selected tile on screen`);
            await t.game('act', 'zoom', false);
          }
        }
      }
      await setCamera(t, 'classic');
    },
  },
  {
    name: 'picking on flat tiles (2D renderer)',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?gl=0',
    async run(t) {
      const tol = t.viewport === 'mobile' ? 9 : 4;
      for (const id of LAYOUTS) {
        await t.game('newGame', { layout: id, seed: 32 }); await t.game('act', 'solveTo', 110); await t.waitIdle();
        const r = await t.page.evaluate(pickSweep, { tol });
        t.equal(r.wrong, [], `2D/${id}: tiles that do not pick themselves (of ${r.checked})`);
        t.equal(r.blockedHits, [], `2D/${id}: taps inside a free tile that hit a blocked one`);
      }
    },
  },
  {
    name: 'real pointer: click, deselect, drag is not a tap, taps wait for the deal-in and shuffle flip',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 8 });
      // during the deal-in the faces are not on screen yet: a tap must not select
      let s = await t.state(); const f = s.tiles.find((x) => x.free);
      let c = await t.game('act', 'tileCenter', f.i);
      await t.waitFrames(2); await t.game('act', 'animAt', 300, 'deal'); // hold the clock mid-deal (software WebGL is slow)
      await t.page.mouse.click(c.x, c.y);
      t.equal((await t.state()).selected, -1, 'a tap during the deal-in is ignored');
      await t.game('act', 'animAt', null);
      await t.waitIdle(15000);
      await t.page.mouse.click(c.x, c.y);
      t.equal((await t.state()).selected, f.i, 'a tap after the deal selects');
      await t.page.mouse.click(c.x, c.y);
      t.equal((await t.state()).selected, -1, 'tapping the selected tile deselects it');
      // a drag that ends on a tile (not zoomed) must not select it
      await t.page.mouse.move(c.x - 60, c.y); await t.page.mouse.down(); await t.page.mouse.move(c.x - 30, c.y, { steps: 4 }); await t.page.mouse.move(c.x, c.y, { steps: 4 }); await t.page.mouse.up();
      t.equal((await t.state()).selected, -1, 'a drag is not a tap');
      // tapping empty table clears a selection
      await t.game('act', 'click', f.i);
      const box = await t.page.locator('#board').boundingBox();
      await t.page.mouse.click(box.x + 6, box.y + box.height - 6);
      t.equal((await t.state()).selected, -1, 'tapping empty table clears the selection');
      // during the shuffle flip the new faces are not on screen yet
      await t.game('act', 'shuffle'); await t.game('act', 'animAt', 200, 'shuffle');
      s = await t.state(); const g2 = s.tiles.find((x) => x.free); c = await t.game('act', 'tileCenter', g2.i);
      await t.page.mouse.click(c.x, c.y);
      t.equal((await t.state()).selected, -1, 'a tap during the shuffle flip is ignored');
      await t.game('act', 'animAt', null);
      await t.waitIdle(15000);
      // undo during a match flight: the restored tiles are back at once and pickable
      const pr = (await t.state()).hint || await t.game('act', 'hint');
      await t.game('act', 'match', pr[0], pr[1]);
      await t.game('act', 'undo');
      const ai = await t.game('act', 'animInfo');
      t.equal(ai.list.length, 0, 'undo drops the flight of the restored tiles');
      const ca = await t.game('act', 'tileCenter', pr[0]);
      t.equal(await t.game('act', 'tileAt', ca.x, ca.y, 0), pr[0], 'a restored tile is pickable during the flight');
    },
  },
  {
    name: 'overlays, pause, stuck and win delays block moves; switching to flat tiles mid-flight is safe',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'arlington', seed: 12 }); await t.waitIdle(15000);
      const snapshot = async () => { const s = await t.state(); return JSON.stringify([s.tilesLeft, s.score, s.selected, s.hints, s.shuffles, s.historyLen]); };
      await t.game('act', 'solveStep');
      for (const ov of ['help', 'settings', 'stats', 'tiles']) {
        await t.game('scene', ov); const a = await snapshot();
        for (const k of ['h', 's', 'u', 'r', 'Enter', 'n']) await t.game('act', 'key', k);
        const s = await t.state(); const f = s.tiles.find((x) => x.present && x.free); await t.game('act', 'click', f.i);
        t.equal(await snapshot(), a, `keys and taps behind the ${ov} dialog do nothing`);
        await t.page.keyboard.press('Escape');
      }
      await t.game('pause'); const p = await snapshot();
      for (const k of ['h', 's', 'u', 'r']) await t.game('act', 'key', k);
      t.equal(await snapshot(), p, 'keys do nothing while paused'); await t.game('resume');
      // stuck: keys before the dialog appears do not double-act; the dialog then shows
      t.expect(await t.game('act', 'stuck'), 'test board made stuck'); await t.game('act', 'key', 'h');
      t.equal((await t.state()).hints, 0, 'no hint on a stuck board');
      await t.page.waitForTimeout(800); t.equal((await t.state()).overlay, 'o-stuck', 'stuck dialog opens');
      await t.page.click('#os-undo'); t.equal((await t.state()).gameStatus, 'playing', 'undo from the stuck dialog');
      // the shuffle button is re-enabled for the next game even after a refused shuffle
      await t.page.evaluate(() => { document.getElementById('os-shuffle').disabled = true; });
      await t.game('newGame', { layout: 'islands', seed: 13 });
      t.equal(await t.page.evaluate(() => document.getElementById('os-shuffle').disabled), false, 'a new game re-enables Shuffle in the stuck dialog');
      // win delay: N and other keys must not skip the win card
      await t.game('act', 'solveTo', 2); await t.waitIdle(15000);
      await t.game('act', 'solveStep'); await t.game('act', 'key', 'n'); await t.game('act', 'key', 'u');
      await t.page.waitForTimeout(1200);
      const w = await t.state(); t.equal([w.gameStatus, w.overlay], ['won', 'o-win'], 'the win card still shows after keys during the win delay');
      // switch to flat tiles while a match is flying (watchdog, context loss or Settings) must not throw
      await t.game('newGame', { layout: 'islands', seed: 14 }); await t.waitIdle(15000);
      await t.game('act', 'solveStep'); await t.game('act', 'loseContext'); await t.waitFrames(5);
      t.equal((await t.state()).gfx, '2d', 'context loss mid-flight falls back to flat tiles');
    },
  },
  {
    name: 'keyboard: every key, no auto-repeat for actions, Ctrl+Shift+Z redo, and the cursor reaches every open tile',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      const key = (k, o) => t.game('act', 'key', k, o || {});
      let s = await t.state();
      await key('ArrowRight'); s = await t.state(); t.expect(s.cursor >= 0, 'an arrow shows the cursor');
      await key('h'); s = await t.state(); t.equal(s.hints, 1, 'H hints');
      await key('h', { repeat: true }); await key('h', { repeat: true }); t.equal((await t.state()).hints, 1, 'a held H does not repeat');
      const [a, b] = s.hint; await t.game('act', 'match', a, b);
      await key('z', { ctrlKey: true }); t.equal((await t.state()).tilesLeft, 144, 'Ctrl+Z undoes');
      await key('z', { ctrlKey: true, shiftKey: true }); t.equal((await t.state()).tilesLeft, 142, 'Ctrl+Shift+Z redoes');
      await key('u'); await key('r'); t.equal((await t.state()).tilesLeft, 142, 'U then R');
      await key('y', { ctrlKey: true }); await key('u'); await key('y', { ctrlKey: true }); t.equal((await t.state()).tilesLeft, 142, 'Ctrl+Y redoes');
      await key('s'); s = await t.state(); t.equal(s.shuffles, 1, 'S shuffles'); await key('s', { repeat: true }); t.equal((await t.state()).shuffles, 1, 'a held S does not repeat');
      await t.waitIdle(15000);
      const hf = s.settings.highlightFree; await key('f'); t.equal((await t.state()).settings.highlightFree, !hf, 'F toggles the free-tile highlight'); await key('f');
      await key('z'); t.equal((await t.state()).zoom, true, 'Z zooms'); await key('z');
      await key('?'); t.equal((await t.state()).overlay, 'o-help', '? opens help'); await t.page.keyboard.press('Escape');
      await key('p'); t.equal((await t.state()).overlay, 'o-pause', 'P pauses'); await t.page.keyboard.press('Escape');
      t.equal((await t.state()).overlay, null, 'Esc resumes');
      await key('Escape'); t.equal((await t.state()).overlay, 'o-pause', 'Esc pauses'); await t.page.keyboard.press('Escape');
      // Enter selects the cursor tile only if it is free
      s = await t.state(); const fr = s.tiles.find((x) => x.present && x.free);
      await t.game('act', 'cursor', fr.i); await key('Enter'); t.equal((await t.state()).selected, fr.i, 'Enter selects the cursor tile');
      await key(' '); t.equal((await t.state()).selected, -1, 'Space deselects it');
      // cursor reach: from every open tile, arrows reach every other open tile on every layout
      for (const id of LAYOUTS) {
        await t.game('newGame', { layout: id, seed: 22 }); await t.game('act', 'solveTo', 100); await t.waitIdle(15000);
        const r = await t.page.evaluate(() => {
          const g = window.__game, s = g.getState();
          const open = s.tiles.filter((t) => t.present && !s.tiles.some((u) => u.present && u.z === t.z + 1 && Math.abs(u.x - t.x) < 2 && Math.abs(u.y - t.y) < 2)).map((t) => t.i);
          const edges = new Map();
          for (const i of open) { const e = []; for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) { g.act('cursor', i); g.act('key', k, {}); e.push(g.getState().cursor); } edges.set(i, e); }
          const seen = new Set([open[0]]), q = [open[0]];
          while (q.length) for (const j of edges.get(q.shift()) || []) if (!seen.has(j)) { seen.add(j); q.push(j); }
          return { open: open.length, reached: seen.size, missing: open.filter((i) => !seen.has(i)) };
        });
        t.equal(r.missing, [], `${id}: open tiles the arrow keys cannot reach (${r.reached}/${r.open})`);
      }
    },
  },
  {
    name: 'mobile: long press, double tap and drags never select text or open a callout',
    viewports: ['mobile', 'desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'terraces', seed: 3 }); await t.waitIdle(15000);
      const sel = () => t.page.evaluate(() => String(window.getSelection()));
      const css = await t.page.evaluate(() => ['body', '#status-text', '.hud', '.toolbar', '#board'].map((q) => { const cs = getComputedStyle(document.querySelector(q)); return q + ':' + (cs.userSelect || cs.webkitUserSelect); }));
      for (const c of css) t.expect(c.endsWith(':none'), `user-select is off: ${c}`);
      const centre = async (q) => { const b = await t.page.locator(q).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
      for (const q of ['#board', '#status-text', '.hud .name', '.toolbar']) {
        const p = await centre(q);
        if (t.viewport === 'mobile') {
          await t.touchDrag(p, p, { steps: 1, holdMs: 750 });                       // long press
          await t.tap(p); await t.tap(p);                                              // double tap
          await t.touchDrag(p, [p[0] + 120, p[1] + 40], { steps: 10, holdMs: 600 }); // press and drag
        } else {
          await t.page.mouse.dblclick(p[0], p[1]); await t.page.mouse.click(p[0], p[1], { clickCount: 3 });
          await t.page.mouse.move(p[0] - 80, p[1]); await t.page.mouse.down(); await t.page.mouse.move(p[0] + 80, p[1], { steps: 6 }); await t.page.mouse.up();
        }
        t.equal(await sel(), '', `no text selected after presses on ${q}`);
        const prevented = await t.page.evaluate((q) => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.querySelector(q).dispatchEvent(ev); return ev.defaultPrevented; }, q);
        t.expect(prevented, `no long-press menu on ${q}`);
      }
      // the game still plays normally after all that
      const s = await t.state(); t.equal(s.tilesLeft, 144, 'presses on the chrome never removed tiles');
    },
  },
];

export const tests = TESTS.map((x) => ({ url: 'index.html?gl=1', ...x }));
