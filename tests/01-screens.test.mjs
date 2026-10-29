// Screens: title, layouts, help, tile guide, stats, settings, pause (PRD AC18, AC19, AC21, AC25, AC31).
async function targets(t) {
  // every visible button must be at least 44 px tall and wide at mobile size
  return t.page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('button')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      if (r.height < 43.5 || r.width < 43.5) bad.push(`${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return bad;
  });
}

export const tests = [
  {
    name: 'title and menus',
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'boots to the title');
      const txt = await t.page.textContent('#s-title');
      for (const w of ['Bathhouse Mahjong', 'Valley of Vapors', 'Play', 'Daily Puzzle', 'How to Play', 'Tile Guide', 'Stats', 'Settings']) t.expect(txt.includes(w), 'title shows ' + w);
      await t.shot('01-title');
      await t.checkLayout();
      if (t.viewport === 'mobile') t.equal(await targets(t), [], 'title touch targets >= 44px');

      await t.page.click('#b-play');
      t.equal((await t.state()).scene, 'layouts', 'Play opens the layout picker');
      t.equal(await t.page.locator('.card').count(), 5, 'five layout cards');
      await t.shot('01-layouts', { fullPage: true });
      await t.checkLayout();

      await t.page.click('[data-back]');
      await t.page.click('#b-help');
      t.equal((await t.state()).overlay, 'o-help', 'help opens');
      await t.shot('01-help');
      await t.checkLayout();
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).overlay, null, 'Esc closes help');

      await t.page.click('#b-tiles');
      t.equal(await t.page.locator('.guide figure').count(), 42, 'tile guide shows 42 faces');
      await t.shot('01-tile-guide');
      await t.page.evaluate(() => { const b = document.querySelector('#ot-body'); b.scrollTop = b.scrollHeight; });
      await t.shot('01-tile-guide-bottom');
      await t.page.click('#o-tiles [data-close]');

      await t.page.click('#b-stats');
      await t.shot('01-stats');
      await t.page.click('#o-stats [data-close]');
      await t.page.click('#b-settings');
      await t.shot('01-settings');
      if (t.viewport === 'mobile') t.equal(await targets(t), [], 'settings touch targets >= 44px');
      await t.checkLayout();
      await t.page.click('#o-settings [data-close]');
    },
  },
  {
    name: 'game HUD and pause',
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 11 });
      await t.shot('01-game');
      await t.checkLayout({ allowScrollY: false });
      if (t.viewport === 'mobile') t.equal(await targets(t), [], 'game touch targets >= 44px');
      await t.page.click('#b-pause');
      t.equal((await t.state()).overlay, 'o-pause', 'pause overlay opens');
      await t.shot('01-pause');
      await t.page.click('#op-resume');
      t.equal((await t.state()).overlay, null, 'resume closes the pause overlay');
    },
  },
];
