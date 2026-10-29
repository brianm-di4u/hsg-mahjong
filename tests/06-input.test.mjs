// Keyboard-only play, pointer/touch play, zoom and live region (PRD AC29, AC30, AC33).
export const tests = [
  {
    name: 'keyboard-only play',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 });
      await t.page.focus('#board');
      await t.page.keyboard.press('ArrowRight');
      t.expect((await t.state()).cursor >= 0, 'arrow key shows a cursor');
      const pr = await t.game('act', 'hint');
      for (const target of pr) {
        let guard = 60;
        while ((await t.state()).cursor !== target && guard-- > 0) {
          const st = await t.state();
          const cur = st.tiles[st.cursor], tg = st.tiles[target];
          const dx = tg.x - cur.x, dy = tg.y - cur.y;
          const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp');
          await t.page.keyboard.press(key);
        }
        t.equal((await t.state()).cursor, target, 'cursor reached the hinted tile');
        if (target === pr[0]) await t.shot('06-keyboard');
        await t.page.keyboard.press('Enter');
      }
      let s = await t.state();
      t.equal(s.tilesLeft, 142, 'pair matched with Enter');
      await t.page.waitForTimeout(80);
      s = await t.state();
      t.expect(s.live.includes('Matched'), 'live region announced the match: ' + s.live);
      await t.page.keyboard.press('u');
      t.equal((await t.state()).tilesLeft, 144, 'U undoes');
      await t.page.keyboard.press('r');
      t.equal((await t.state()).tilesLeft, 142, 'R redoes');
      await t.page.keyboard.press('h');
      t.expect((await t.state()).hint, 'H shows a hint');
      await t.page.keyboard.press('p');
      t.equal((await t.state()).overlay, 'o-pause', 'P pauses');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).overlay, null, 'Esc resumes');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).overlay, 'o-pause', 'Esc opens the menu');
      await t.page.keyboard.press('Tab');
      const focused = await t.page.evaluate(() => document.activeElement && document.activeElement.textContent.trim());
      t.expect(!!focused, 'Tab moves focus through the pause menu buttons: ' + focused);
    },
  },
  {
    name: 'pointer and touch play with zoom',
    async run(t) {
      await t.game('newGame', { layout: 'row', seed: 99 });
      const tap = async (c) => { if (t.viewport === 'mobile') await t.page.touchscreen.tap(c.x, c.y); else await t.page.mouse.click(c.x, c.y); await t.page.waitForTimeout(60); };
      const pr = await t.game('act', 'hint');
      for (const i of pr) await tap(await t.game('act', 'tileCenter', i));
      let s = await t.state();
      t.equal(s.tilesLeft, 142, 'pair matched by ' + (t.viewport === 'mobile' ? 'tapping' : 'clicking'));
      await t.shot('06-pointer');
      const w0 = s.tileW;
      await t.page.click('#t-zoom');
      s = await t.state();
      t.expect(s.zoom && s.tileW > w0 * 1.3, `zoom enlarges tiles (${w0} -> ${s.tileW})`);
      await t.shot('06-zoom');
      const box = await t.page.locator('#board').boundingBox();
      // a tap still selects a visible free tile while zoomed
      const st = await t.state();
      let picked = null;
      for (const x of st.tiles) {
        if (!x.present || !x.free) continue;
        const c = await t.game('act', 'tileCenter', x.i);
        if (c.x > box.x + 20 && c.x < box.x + box.width - 20 && c.y > box.y + 20 && c.y < box.y + box.height - 20) { picked = { i: x.i, c }; break; }
      }
      t.expect(picked, 'a free tile is visible while zoomed');
      if (picked) { await tap(picked.c); t.equal((await t.state()).selected, picked.i, 'tap selects while zoomed'); }
      // drag pans (synthetic pointer events, so touch and mouse take the same path)
      // drag one way, then the other (the view may already sit against one edge)
      let moved = false;
      for (const dir of [1, -1]) {
        const before = await t.game('act', 'tileCenter', 0);
        await t.page.evaluate(({ x, y, type, dir }) => {
          const cv = document.getElementById('board');
          const ev = (name, dx, dy) => cv.dispatchEvent(new PointerEvent(name, { pointerId: 7, pointerType: type, clientX: x + dx * dir, clientY: y + dy * dir, bubbles: true, isPrimary: true }));
          ev('pointerdown', 0, 0); for (let k = 1; k <= 6; k++) ev('pointermove', 20 * k, 7 * k); ev('pointerup', 120, 42);
        }, { x: box.x + box.width / 2, y: box.y + box.height / 2, type: t.viewport === 'mobile' ? 'touch' : 'mouse', dir });
        const after = await t.game('act', 'tileCenter', 0);
        if (Math.abs(after.x - before.x) > 20 || Math.abs(after.y - before.y) > 10) moved = true;
      }
      t.expect(moved, 'drag pans the zoomed board');
      // a hint while zoomed pans the pair into view
      const p3 = await t.game('act', 'hint');
      const hc = await t.game('act', 'tileCenter', p3[0]);
      t.expect(hc.x > box.x && hc.x < box.x + box.width && hc.y > box.y && hc.y < box.y + box.height, 'hinted tile is on screen while zoomed');
      await t.page.click('#t-zoom');
      t.equal((await t.state()).zoom, false, 'zoom off');
      await t.checkLayout({ allowScrollY: false });
    },
  },
];
