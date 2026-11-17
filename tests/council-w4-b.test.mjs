// Council wave 4, batch B: feedback, teaching and help; sound (C4-03, S3-11, S4-11, S1-09, S1-22, S4-21, S5-15).
// Every check reads what the player sees or hears (the status line, the win card, the painted fonts, the calls to the vibration and gamepad APIs,
// the audio the game renders) and waits for a condition, never for a time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FLAT = 'index.html?gl=0';
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const num = (v) => +String(v).replace('−', '-').replace(/,/g, '');
const winCard = async (t) => {
  await t.page.waitForSelector('#o-win.on', { timeout: 15000 });
  return t.page.evaluate(() => { const c = [...document.querySelectorAll('#ow-grid > span')].map((s) => s.textContent), rows = []; for (let i = 0; i + 1 < c.length; i += 2) rows.push([c[i], c[i + 1]]); return { rows, total: document.getElementById('ow-score').textContent }; });
};
const addsUp = (c) => { const tot = num(rowOf(c, 'Total')); return { sum: c.rows.filter((r) => r[0] !== 'Total').reduce((a, r) => a + num(r[1]), 0), tot }; };
const rowOf = (c, label) => (c.rows.find((r) => r[0].startsWith(label)) || [])[1];
const noteText = 'Free of points, but it ends the no-help bonus.';
const statusOf = (t) => t.page.evaluate(() => document.getElementById('status-text').textContent);

export const tests = [
  {
    name: 'C4-03: the first undo of a board says it is free of points but ends the no-help bonus, once, and the button says so too',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      t.expect(/first 3 cost no points, but any undo ends the no-help bonus/.test(await t.page.locator('#t-undo').getAttribute('title')), 'the Undo button says what an undo does to the bonus');
      await t.game('act', 'solveStep'); await t.game('act', 'solveStep');
      await t.game('act', 'undo');
      t.expect((await statusOf(t)).includes(noteText), 'the first undo says so on the strip: ' + await statusOf(t));
      await t.page.waitForFunction((n) => document.getElementById('live').textContent.includes(n), noteText, { timeout: 5000 });
      t.expect(true, 'and a screen reader is told');
      await t.shot('C4-03-undo-note');
      // the second undo, and one after a redo, say nothing more: it is said once per board
      await t.game('act', 'undo');
      const second = await statusOf(t);
      t.expect(/^Undone\. /.test(second) && !second.includes('no-help'), 'the second undo does not repeat it: ' + second);
      await t.page.waitForFunction(() => document.getElementById('live').textContent === 'Undo', null, { timeout: 5000 });
      t.expect(true, 'a screen reader hears just "Undo" the second time');
    },
  },
  {
    name: 'C4-03: no note when the bonus was already gone (a hint came first) or when the level has none (Relaxed)',
    url: FLAT,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await t.game('act', 'solveStep'); await t.game('act', 'hint'); await t.game('act', 'undo');
      t.expect(!(await statusOf(t)).includes('no-help'), 'after a hint the bonus is gone and the undo does not mention it: ' + await statusOf(t));
      await t.game('newGame', { layout: 'pyramid', seed: 21, level: 'relaxed' }); await t.waitIdle(15000);
      await t.game('act', 'solveStep'); await t.game('act', 'undo');
      t.expect(!(await statusOf(t)).includes('no-help'), 'Relaxed has no no-help bonus, so the undo does not mention it: ' + await statusOf(t));
      t.equal(await t.page.locator('#t-undo').getAttribute('title'), 'Undo (U)', 'and its button keeps the plain tip');
    },
  },
  {
    name: 'C4-03: the score sheet names the no-help bonus as kept, or as ended by what ended it; the totals are unchanged',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const play = async (moves) => {
        await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
        await t.game('act', 'solveStep');
        for (const m of moves) await t.game('act', m);
        await t.game('act', 'solveTo', 0);
        return winCard(t);
      };
      const kept = await play([]);
      t.equal(rowOf(kept, 'No-help bonus'), '250', 'a win with no help keeps the 250 bonus on the card: ' + JSON.stringify(kept.rows.filter((r) => /No-help/.test(r[0]))));
      await t.shot('C4-03-win-card-kept');
      const undone = await play(['undo']);
      t.equal(rowOf(undone, 'No-help bonus, ended by an undo'), '0', 'an undo (even a free one) ends it, and the card says so: ' + JSON.stringify(undone.rows.filter((r) => /No-help/.test(r[0]))));
      t.expect(!undone.rows.some((r) => r[0] === 'No-help bonus'), 'and does not show it as earned');
      await t.shot('C4-03-win-card-ended');
      const both = await play(['hint', 'undo']);
      t.equal(rowOf(both, 'No-help bonus, ended by a hint or an undo'), '0', 'a hint and an undo are both named');
      // nothing else moved: the rows still add up to the total on every card, and the undo costs nothing in points among the first three
      for (const c of [kept, undone, both]) { const a = addsUp(c); t.equal(a.sum, a.tot, 'the rows add up to the Total row'); }
    },
  },
  {
    name: 'S3-11: the last tile of Springs, and of Lakes & Fish, earns +50 with a toast; the card has a Suits cleared line and adds up; undo and redo keep it',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      let run = null;
      for (let seed = 1; seed <= 12 && !run; seed++) {
      await t.game('newGame', { layout: 'pyramid', seed }); await t.waitIdle(15000);
      { const f = (await t.state()).tiles.find((x) => x.present && x.free); await t.game('act', 'click', f.i); await t.game('act', 'click', f.i); } // the first sound of the game, so there is audio to count
      run = await t.page.evaluate(() => {
        const g = window.__game, rows = () => g.audioState().cues.row || 0, steps = []; let final = null, cnt = (s) => [0, 1, 2].map((k) => s.tiles.filter((x) => x.present && x.f < 27 && Math.floor(x.f / 9) === k).length);
        let undoRedo = null;
        for (let n = 0; n < 100; n++) {
          const s0 = g.getState(), c0 = cnt(s0), r0 = rows();
          if (!g.act('solveStep')) break;
          const s1 = g.getState(), c1 = cnt(s1);
          const cleared = [0, 1, 2].filter((k) => c0[k] > 0 && c1[k] === 0);
          if (s1.gameStatus === 'won') { final = { rowDelta: rows() - r0, rowBonus: s1.rowDone && !s0.rowDone }; break; } // the last pair carries the win bonuses as well
          steps.push({ rowDelta: rows() - r0, d: s1.score - s0.score, combo: s1.combo, row: s1.rowDone && !s0.rowDone, cleared, toast: document.getElementById('toast').textContent, status: document.getElementById('status-text').textContent });
          if (cleared.length && !undoRedo) {
            g.act('undo'); const back = g.getState().score; g.act('redo'); const again = g.getState().score;
            undoRedo = { before: s0.score, after: s1.score, back, again };
          }
        }
        return { steps, undoRedo, final };
      });
      if (!(run.steps.some((s) => s.cleared.includes(0)) && run.steps.some((s) => s.cleared.includes(2)))) run = null;
      }
      if (!run) { t.fail('no deal of seeds 1 to 12 clears both Springs and Lakes & Fish before its last pair'); return; }
      const springs = run.steps.find((s) => s.cleared.includes(0)), lakes = run.steps.find((s) => s.cleared.includes(2)), row = run.steps.find((s) => s.cleared.includes(1));
      t.expect(!!springs && !!lakes, 'this deal clears Springs and Lakes & Fish before its last pair');
      for (const s of run.steps) {
        const want = 10 + Math.min(25, 5 * s.combo) + (s.row ? 100 : 0) + s.cleared.filter((k) => k !== 1).length * 50;
        t.equal(s.d, want, 'a pair is worth 10, plus the combo, the Row bonus and 50 for each of Springs and Lakes cleared (' + JSON.stringify(s.cleared) + ' gave ' + s.d + ')');
      }
      for (const s of run.steps) if (s.cleared.some((k) => k !== 1)) t.expect(s.rowDelta >= 1, 'a suit cleared in mid-board rings the Row chime (' + s.rowDelta + ')');
      if (springs) t.expect(/Springs cleared/.test(springs.toast) && /\+50/.test(springs.toast), 'the toast says Springs cleared, +50: ' + springs.toast);
      if (lakes) t.expect(/Lakes & Fish cleared/.test(lakes.toast), 'and Lakes & Fish cleared: ' + lakes.toast);
      t.expect(!run.steps.some((s) => !s.cleared.length && /cleared!/.test(s.toast) && /Springs|Lakes/.test(s.toast) && s === run.steps[0]), 'a first match toasts nothing about suits');
      t.expect(!!run.undoRedo && run.undoRedo.back === run.undoRedo.before && run.undoRedo.again === run.undoRedo.after, 'undoing the clearing pair takes the bonus back and redoing it returns it: ' + JSON.stringify(run.undoRedo));
      const card = await winCard(t);
      const suits = rowOf(card, 'Suits cleared');
      t.expect(suits === '100' || suits === '50', 'the card has a Suits cleared line: ' + JSON.stringify(card.rows.map((r) => r[0])));
      t.expect(/\(Springs and Lakes\)/.test(card.rows.find((r) => r[0].startsWith('Suits cleared'))[0]), 'it names the suits');
      { const a = addsUp(card); t.equal(a.sum, a.tot, 'and every row on the card adds up to its Total'); }
      await t.shot('S3-11-win-card');
      await t.checkLayout({ allowScrollY: true });
    },
  },
  {
    name: 'S3-11: when the last pair of the board also clears a suit, the win fanfare has it to itself (no Row chime on top)',
    url: FLAT,
    viewports: ['desktop'],
    async run(t) {
      let found = null;
      for (let seed = 1; seed <= 60 && !found; seed++) {
        await t.game('newGame', { layout: 'pyramid', seed }); await t.waitIdle(15000);
        { const f = (await t.state()).tiles.find((x) => x.present && x.free); await t.game('act', 'click', f.i); await t.game('act', 'click', f.i); }
        const r = await t.page.evaluate(() => {
          const g = window.__game, rows = () => g.audioState().cues.row || 0;
          g.act('solveTo', 2);
          const s0 = g.getState(), face = s0.tiles.find((x) => x.present).f, r0 = rows();
          if (!(face < 9 || (face >= 18 && face < 27))) return null; // the last pair is of Springs or of Lakes & Fish, so it clears that suit
          g.act('solveStep'); const s1 = g.getState();
          return { won: s1.gameStatus === 'won', rowDelta: rows() - r0, rowBonus: s1.rowDone && !s0.rowDone, face };
        });
        if (r) found = r;
      }
      if (!found) { t.fail('no deal of seeds 1 to 60 ends on a Springs or Lakes & Fish pair'); return; }
      t.expect(found.won, 'the last pair wins the board');
      t.equal(found.rowDelta, found.rowBonus ? 1 : 0, 'and rings no Row chime for the suit it clears (' + JSON.stringify(found) + ')');
      await winCard(t);
    },
  },
  {
    name: 'S3-11: a game that was saved with the pairs on record plays on, and a damaged suits list in the save is repaired',
    url: FLAT,
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await t.game('act', 'solveStep');
      const saved = await t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bhm.game.v1')); s.history[0].suits = 'junk'; return s; });
      await t.game('setState', saved); await t.waitIdle(15000);
      const hist = await t.page.evaluate(() => window.__game.getState().historyLen);
      t.equal(hist, 1, 'the move is still on record after a repaired load');
      await t.game('act', 'solveTo', 0);
      const card = await winCard(t);
      { const a = addsUp(card); t.equal(a.sum, a.tot, 'and the card still adds up'); }
    },
  },
  {
    name: 'S4-11: Reset stats asks in the game\'s own dialog (above the Stats card), never in a native one, and only a press of Reset records resets',
    url: FLAT,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      t.page.on('dialog', (d) => { t.fail('a native dialog opened: ' + d.message()); d.dismiss(); });
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await t.game('act', 'solveTo', 0); await t.page.waitForSelector('#o-win.on', { timeout: 15000 });
      await t.game('scene', 'title'); await t.page.evaluate(() => { for (const el of document.querySelectorAll('.overlay.on')) el.classList.remove('on'); });
      await t.page.click('#b-stats'); await t.page.waitForSelector('#o-stats.on');
      const played = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.stats.v1')).won);
      t.equal(await played(), 1, 'one win is on record');
      await t.page.click('#ost-reset');
      t.expect(await t.page.locator('#o-confirm.on').count() === 1, 'the themed confirm opens');
      t.equal(await t.page.locator('#oc-h').textContent(), 'Reset all records?', 'with its own heading');
      t.expect(/achievements, unlocks and collection stay/.test(await t.page.locator('#oc-text').textContent()), 'and says what stays');
      const top = await t.page.evaluate(() => { const b = document.getElementById('oc-new').getBoundingClientRect(), e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!e.closest('#o-confirm'); });
      t.expect(top, 'it is above the Stats card, so its buttons can be pressed');
      t.equal(await t.page.evaluate(() => document.activeElement.id), 'oc-keep', 'the safe choice has the focus');
      await t.shot('S4-11-reset-confirm');
      await t.page.keyboard.press('Escape');
      t.equal(await t.page.locator('#o-confirm.on').count(), 0, 'Escape closes just the confirm');
      t.equal(await t.page.locator('#o-stats.on').count(), 1, 'and leaves the Stats card open');
      t.equal(await played(), 1, 'nothing was reset');
      await t.page.click('#ost-reset'); await t.page.click('#oc-keep');
      t.equal(await played(), 1, 'Keep them resets nothing');
      await t.page.click('#ost-reset'); await t.page.click('#oc-new');
      t.equal(await played(), 0, 'Reset records clears the records');
      t.expect(await t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.stats.v1')).goals.wins.length > 0), 'and keeps the collection');
      t.equal(await t.page.locator('#o-stats.on').count(), 1, 'the Stats card is still there, now showing the cleared records');
    },
  },
  {
    name: 'S4-11: the title, board names and win card are set in Marcellus, from file://, and nothing overflows or wraps where it did not',
    url: FLAT,
    fileUrl: true,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const fam = (sel) => t.page.evaluate((sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily : null; }, sel);
      await t.page.evaluate(() => document.fonts.ready);
      t.expect(await t.page.evaluate(() => document.fonts.check('400 20px Marcellus')), 'the face is loaded (document.fonts.check)');
      t.expect(/^"?Marcellus/.test(await fam('h1')), 'the title is in Marcellus first: ' + await fam('h1'));
      const h1 = await t.page.evaluate(() => { const r = document.querySelector('#s-title h1').getBoundingClientRect(), s = getComputedStyle(document.querySelector('#s-title h1')); return { l: r.left, r: r.right, h: r.height, fs: parseFloat(s.fontSize), w: innerWidth }; });
      t.expect(h1.l >= 0 && h1.r <= h1.w && h1.h < h1.fs * 1.6, 'the title is inside the screen on one line: ' + JSON.stringify(h1));
      await t.checkLayout();
      await t.shot('S4-11-title-font');
      await t.game('scene', 'layouts'); await t.waitIdle(15000);
      t.expect(/^"?Marcellus/.test(await fam('.card b')), 'the board names are in Marcellus: ' + await fam('.card b'));
      const cards = await t.page.evaluate(() => [...document.querySelectorAll('.card')].map((c) => { const b = c.querySelector('b'), r = c.getBoundingClientRect(), q = b.getBoundingClientRect(); return { id: c.dataset.layout, ok: q.left >= r.left - 1 && q.right <= r.right + 1 && b.scrollWidth <= b.clientWidth + 1, lines: Math.round(q.height / parseFloat(getComputedStyle(b).lineHeight === 'normal' ? parseFloat(getComputedStyle(b).fontSize) * 1.2 : getComputedStyle(b).lineHeight)) }; }));
      t.expect(cards.length === 18 && cards.every((c) => c.ok), 'every board name stays inside its card: ' + JSON.stringify(cards.filter((c) => !c.ok)));
      await t.shot('S4-11-layouts-font', { fullPage: false });
      // a name that fits the top bar in the old stack still fits in Marcellus (on a 390 px phone the same nine long names are cut in both)
      const worse = [];
      for (const c of cards) {
        await t.game('newGame', { layout: c.id, seed: 3 }); await t.waitIdle(15000);
        const r = await t.page.evaluate(() => {
          const b = document.querySelector('.hud .name b'), cut = () => b.scrollWidth > b.clientWidth + 1, now = cut();
          document.documentElement.style.setProperty('--font-display', '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif'); const was = cut();
          document.documentElement.style.removeProperty('--font-display');
          return { text: b.textContent, now, was };
        });
        if (r.now && !r.was) worse.push(r.text);
      }
      t.equal(worse.length, 0, 'no layout name is cut short in the top bar that was not before: ' + worse.join(', '));
      t.expect(/^"?Marcellus/.test(await fam('.hud .name b')), 'the name in the top bar is in Marcellus: ' + await fam('.hud .name b'));
      await t.game('act', 'solveTo', 0);
      await t.page.waitForSelector('#o-win.on', { timeout: 15000 });
      t.expect(/^"?Marcellus/.test(await fam('#ow-h')) && /^"?Marcellus/.test(await fam('#ow-score')), 'the win card heading and score are in Marcellus');
      const card = await t.page.evaluate(() => { const p = document.querySelector('#o-win .panel'), r = p.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, sw: p.scrollWidth, cw: p.clientWidth, h2: document.getElementById('ow-h').getBoundingClientRect().height }; });
      t.expect(card.l >= 0 && card.r <= card.w && card.sw <= card.cw + 1, 'the win card fits the screen: ' + JSON.stringify(card));
      await t.waitForAnimations(); await t.shot('S4-11-win-font');
    },
  },
  {
    name: 'S4-11: the font in index.html is the vendored file, its licence is beside it, and the title stays inside a 320 px phone',
    url: FLAT,
    fileUrl: true,
    viewports: ['mobile'],
    async run(t) {
      const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
      const file = fs.readFileSync(path.join(HERE, '..', 'vendor', 'fonts', 'marcellus-latin-400-normal.woff2'));
      const m = /\/\* fonts:begin[^*]*\*\/(.*?)\/\* fonts:end \*\//s.exec(html);
      t.expect(!!m && m[1].includes(file.toString('base64')) && /font-display:block/.test(m[1]), 'the @font-face between the markers carries the vendored file, with font-display: block');
      t.expect(file.length < 30 * 1024, 'and it is under 30 KB (' + file.length + ' bytes)');
      t.expect(/SIL OPEN FONT LICENSE/.test(fs.readFileSync(path.join(HERE, '..', 'vendor', 'fonts', 'OFL-marcellus.txt'), 'utf8')), 'the licence is beside it as OFL-marcellus.txt');
      t.expect(/Marcellus, under the SIL Open Font License/.test(await t.page.locator('#o-help').evaluate((e) => e.textContent)), 'How to Play names the face and its licence');
      for (const w of [320, 360]) {
        await t.page.setViewportSize({ width: w, height: 700 });
        await t.page.waitForFunction((w) => innerWidth === w, w);
        const r = await t.page.evaluate(() => { const e = document.querySelector('#s-title h1').getBoundingClientRect(); return { l: e.left, r: e.right, w: innerWidth, sw: document.documentElement.scrollWidth }; });
        t.expect(r.l >= 0 && r.r <= r.w && r.sw <= r.w, 'the title fits at ' + w + ' px: ' + JSON.stringify(r));
      }
    },
  },
  {
    name: 'S1-09: a new profile on a phone feels a tick on a pick, a match, a blocked tile and a win; the Vibration switch and Reduced motion silence it',
    url: FLAT,
    viewports: ['mobile'],
    initScript: () => { window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; },
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      t.equal((await t.state()).settings.haptics, true, 'a new profile on a touch device has Vibration on');
      const vib = () => t.page.evaluate(() => window.__vib.slice());
      const clear = () => t.page.evaluate(() => { window.__vib.length = 0; });
      let s = await t.state();
      const blocked = s.tiles.find((x) => x.present && !x.free), pair = (() => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; })();
      await clear(); await t.game('act', 'click', pair[0]);
      t.equal(await vib(), [10], 'picking a tile ticks 10 ms');
      await clear(); await t.game('act', 'click', blocked.i);
      t.equal(await vib(), [25], 'a blocked tile gives a longer 25 ms tick');
      await clear(); await t.game('act', 'click', pair[1]);
      t.equal(await vib(), [20], 'a match gives 20 ms');
      // Reduced motion: nothing
      await t.game('scene', 'settings');
      await t.page.click('[data-set="motion"] [data-v="reduced"]');
      await t.page.keyboard.press('Escape');
      s = await t.state(); const f2 = s.tiles.find((x) => x.present && x.free);
      await clear(); await t.game('act', 'click', f2.i); await t.game('act', 'click', f2.i);
      t.equal(await vib(), [], 'with Reduced motion on there is no vibration');
      await t.game('scene', 'settings');
      await t.page.click('[data-set="motion"] [data-v="full"]');
      t.expect(await t.page.locator('#row-haptics').isVisible(), 'Settings shows a Vibration switch');
      t.equal(await t.page.locator('#se-haptics').getAttribute('aria-pressed'), 'true', 'which reads On');
      await t.shot('S1-09-settings-vibration');
      await t.page.click('#se-haptics');
      t.equal((await t.state()).settings.haptics, false, 'pressing it turns Vibration off');
      t.equal(await t.page.evaluate(() => JSON.parse(localStorage.getItem('bhm.settings.v1')).haptics), false, 'and the choice is saved');
      await t.page.keyboard.press('Escape');
      await clear(); await t.game('act', 'click', f2.i); await t.game('act', 'click', f2.i);
      t.equal(await vib(), [], 'with the switch off a pick is silent too');
      await t.game('act', 'solveTo', 0);
      t.equal(await vib(), [], 'and so is the win');
    },
  },
  {
    name: 'S1-09: the win has its own pattern when Vibration is on',
    url: FLAT,
    viewports: ['mobile'],
    initScript: () => { window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; },
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await t.page.evaluate(() => { window.__vib.length = 0; });
      await t.game('act', 'solveTo', 0);
      const v = await t.page.evaluate(() => window.__vib.filter((p) => Array.isArray(p)));
      t.equal(v.length, 1, 'one pattern for the win');
      t.expect(v[0].length >= 3 && v[0].every((x) => x >= 15 && x <= 60), 'made of short pulses: ' + JSON.stringify(v[0]));
      t.expect(v[0].filter((x, k) => k % 2 === 0).every((x) => x >= 10 && x <= 25), 'and every pulse (not the gaps between) is 10 to 25 ms: ' + JSON.stringify(v[0]));
    },
  },
  {
    name: 'S1-09: a desktop profile, and a phone profile that already has a save, start with Vibration off; where the browser cannot vibrate there is no switch',
    url: FLAT,
    viewports: ['desktop'],
    initScript: () => { navigator.vibrate = () => true; },
    async run(t) {
      t.equal((await t.state()).settings.haptics, false, 'a mouse-and-keyboard profile starts with it off');
      await t.game('scene', 'settings');
      t.expect(await t.page.locator('#row-haptics').isVisible(), 'the switch is there (the browser can vibrate)');
      await t.shot('S1-09-settings-vibration');
    },
  },
  {
    name: 'S1-09: a phone profile that already has a save keeps today\'s game: Vibration starts off',
    url: FLAT,
    viewports: ['mobile'],
    initScript: () => { navigator.vibrate = () => true; if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('bhm.stats.v1', JSON.stringify({ played: 4, won: 2 })); } },
    async run(t) {
      t.equal((await t.state()).settings.haptics, false, 'an existing player does not suddenly get vibration');
    },
  },
  {
    name: 'S1-09: a browser that cannot vibrate shows no Vibration switch',
    url: FLAT,
    viewports: ['desktop'],
    initScript: () => { try { delete Navigator.prototype.vibrate; } catch (e) { /* kept */ } Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true }); },
    async run(t) {
      await t.game('scene', 'settings');
      t.expect(!(await t.page.locator('#row-haptics').isVisible()), 'no switch');
      t.equal((await t.state()).settings.haptics, false, 'and the setting is off');
    },
  },
  {
    name: 'S1-09: a gamepad drives the keyboard path: D-pad and stick move the cursor, A selects, B undoes, X hints, Start pauses; over a card the D-pad moves the focus',
    url: FLAT,
    viewports: ['desktop'],
    initScript: () => {
      window.__pad = { id: 'test pad', index: 0, connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
      navigator.getGamepads = () => [window.__pad];
    },
    async run(t) {
      await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000);
      await t.page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')));
      const frames = () => t.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const hold = async (set) => { await t.page.evaluate((set) => { for (const [k, v] of Object.entries(set)) { if (k === 'ax') window.__pad.axes[v[0]] = v[1]; else window.__pad.buttons[+k].pressed = v; } }, set); await frames(); };
      const release = async () => { await t.page.evaluate(() => { for (const b of window.__pad.buttons) b.pressed = false; window.__pad.axes = [0, 0, 0, 0]; }); await frames(); };
      let s = await t.state();
      const pr = (() => { const f = s.tiles.filter((x) => x.present && x.free); for (let a = 0; a < f.length; a++) for (let b = a + 1; b < f.length; b++) if (f[a].key === f[b].key) return [f[a].i, f[b].i]; return null; })();
      // D-pad right from no cursor: the cursor appears
      await t.game('act', 'cursor', -1);
      await hold({ 15: true });
      await t.page.waitForFunction(() => window.__game.getState().cursor >= 0, null, { timeout: 5000 }); await release();
      t.expect((await t.state()).cursor >= 0, 'the D-pad brings up the cursor, as the arrow keys do');
      await t.game('act', 'cursor', -1);
      await hold({ ax: [0, 1] });
      await t.page.waitForFunction(() => window.__game.getState().cursor >= 0, null, { timeout: 5000 }); await release();
      t.expect((await t.state()).cursor >= 0, 'so does the left stick');
      // A selects the tile under the cursor, A on its partner takes the pair
      await t.game('act', 'cursor', pr[0]); await hold({ 0: true }); await t.page.waitForFunction((i) => window.__game.getState().selected === i, pr[0], { timeout: 5000 }); await release();
      await t.game('act', 'cursor', pr[1]); await hold({ 0: true }); await t.page.waitForFunction((n) => window.__game.getState().tilesLeft === n, s.tilesLeft - 2, { timeout: 5000 }); await release();
      t.equal((await t.state()).tilesLeft, s.tilesLeft - 2, 'A, A takes a pair');
      // B undoes it
      await hold({ 1: true }); await t.page.waitForFunction((n) => window.__game.getState().tilesLeft === n, s.tilesLeft, { timeout: 5000 }); await release();
      t.equal((await t.state()).tilesLeft, s.tilesLeft, 'B undoes it');
      // X asks for a hint
      await hold({ 2: true }); await t.page.waitForFunction(() => window.__game.getState().hints === 1, null, { timeout: 5000 }); await release();
      t.equal((await t.state()).hints, 1, 'X is Hint');
      // holding a direction repeats like a held arrow key: it keeps moving, not just once
      await hold({ 9: true }); await t.page.waitForFunction(() => window.__game.getState().overlay === 'o-pause', null, { timeout: 5000 }); await release();
      t.equal((await t.state()).overlay, 'o-pause', 'Start pauses');
      // over the pause card the D-pad moves the focus and A presses the focused button
      const focus0 = await t.page.evaluate(() => document.activeElement.id);
      await hold({ 13: true }); await t.page.waitForFunction((f) => document.activeElement.id !== f, focus0, { timeout: 5000 }); await release();
      t.expect((await t.page.evaluate(() => document.activeElement.id)) !== focus0, 'the D-pad moves the focus along the card\'s buttons');
      await hold({ 12: true }); await t.page.waitForFunction((f) => document.activeElement.id === f, focus0, { timeout: 5000 }); await release();
      await hold({ 0: true }); await t.page.waitForFunction(() => window.__game.getState().overlay === null, null, { timeout: 5000 }); await release();
      t.equal((await t.state()).paused, false, 'A on Resume carries on');
      await hold({ 9: true }); await t.page.waitForFunction(() => window.__game.getState().overlay === 'o-pause', null, { timeout: 5000 }); await release();
      await hold({ 9: true }); await t.page.waitForFunction(() => window.__game.getState().overlay === null, null, { timeout: 5000 }); await release();
      t.equal((await t.state()).paused, false, 'Start again resumes');
      await hold({ 9: true }); await t.page.waitForFunction(() => window.__game.getState().overlay === 'o-pause', null, { timeout: 5000 }); await release();
      await hold({ 1: true }); await t.page.waitForFunction(() => window.__game.getState().overlay === null, null, { timeout: 5000 }); await release();
      t.equal((await t.state()).paused, false, 'and B closes a card');
    },
  },
  ...(() => {
    const recorder = () => {
      window.__rec = null;
      const log = (k, v) => { if (window.__rec) window.__rec.push({ k, v }); };
      const co = BaseAudioContext.prototype.createOscillator;
      BaseAudioContext.prototype.createOscillator = function () { const o = co.call(this), f = o.frequency.setValueAtTime.bind(o.frequency), r = o.frequency.exponentialRampToValueAtTime.bind(o.frequency); o.frequency.setValueAtTime = (v, t) => { log('osc', v); return f(v, t); }; o.frequency.exponentialRampToValueAtTime = (v, t) => { log('glide', v); return r(v, t); }; return o; };
    };
    const rendered = (t, name, seed) => t.page.evaluate(async ([name, seed]) => { window.__rec = []; const r = await window.__game.audioRender(name, 4, false, seed); const rec = window.__rec; window.__rec = null; return { r, osc: rec.filter((e) => e.k === 'osc').map((e) => e.v), glide: rec.filter((e) => e.k === 'glide').map((e) => e.v) }; }, [name, seed]);
    const near = (list, hz, tol = 0.04) => list.some((v) => Math.abs(v / hz - 1) < tol);
    const LADDER = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1568, 1760, 2093, 2349.32];
    const prime = async (t) => { const f = (await t.state()).tiles.find((x) => x.present && x.free); await t.game('act', 'click', f.i); await t.game('act', 'click', f.i); };
    const cues = (t) => t.game('audioState').then((s) => s.cues);
    return [
      {
        name: 'S1-22: from the third chained pair the match note has a second voice a fifth above it; the level stays in the cue range',
        url: FLAT, viewports: ['desktop'], initScript: recorder,
        async run(t) {
          for (const c of [0, 2, 3, 6, 11]) {
            const has = []; for (let seed = 1; seed <= 3; seed++) has.push(near((await rendered(t, 'cue:match:' + c, seed)).osc, LADDER[c] * 1.5, 0.04));
            t.expect(c >= 3 ? has.every(Boolean) : !has.some(Boolean), 'combo ' + c + (c >= 3 ? ' has' : ' does not have') + ' a voice at 3/2 of ' + LADDER[c] + ' Hz');
          }
          for (const c of [2, 3, 11]) {
            const peaks = []; for (let seed = 1; seed <= 7; seed++) peaks.push((await t.game('audioRender', 'cue:match:' + c, 2, false, seed)).peak);
            t.expect(median(peaks) >= 0.2 && median(peaks) <= 0.45 && Math.min(...peaks) >= 0.17 && Math.max(...peaks) <= 0.48, 'combo ' + c + ' peaks at a median of ' + median(peaks) + ' (' + Math.min(...peaks) + ' to ' + Math.max(...peaks) + ')');
          }
          let worst = 0; for (let seed = 1; seed <= 8; seed++) worst = Math.max(worst, (await t.game('audioRender', 'cue:match:11', 2, false, seed, 100)).peak);
          t.expect(worst <= 0.92, 'a combo 11 match at volume 100 peaks at ' + worst);
        },
      },
      {
        name: 'S1-22, S4-21: the win lasts about 2.7 s with a bass note, a second phrase that comes home and a shimmer; it keeps its level and the busiest moment stays under the ceiling',
        url: FLAT, viewports: ['desktop'], initScript: recorder,
        async run(t) {
          const seeds = [101, 102, 103], runs = []; for (const s of seeds) runs.push(await rendered(t, 'cue:win', s));
          for (const x of runs) {
            t.expect(x.r.secs[2] >= 0.005, 'the win is still sounding between 2 and 3 s in (RMS ' + x.r.secs[2] + '; it was 0.0001 before the second bar)');
            t.expect(x.r.secs[3] < 0.002, 'and has finished by 3 s (RMS of the fourth second ' + x.r.secs[3] + ')');
            t.expect(near(x.osc, 130.8, 0.04), 'a bass note at 130 Hz sits under it');
            t.expect(near(x.osc, 523.25 * 4, 0.04) || near(x.osc, 783.99 * 4, 0.04), 'and the shimmer rings two octaves above the scale');
          }
          const peaks = [], rms = [], matches = [];
          for (let seed = 101; seed <= 120; seed++) { const w = await t.game('audioRender', 'cue:win', 3, false, seed), m = await t.game('audioRender', 'cue:match', 3, false, seed); peaks.push(w.peak); rms.push(w.rmsDb); matches.push(m.rmsDb); }
          t.expect(median(peaks) >= 0.2 && median(peaks) <= 0.45 && Math.max(...peaks.slice(0, 7)) <= 0.45, 'its peak stays in the cue range: median ' + median(peaks));
          t.expect(median(rms) >= median(matches) + 4, 'and its body is well over a match (' + median(rms) + ' dB against ' + median(matches) + ' dB)');
          const mixes = []; for (let k = 0; k < 5; k++) mixes.push((await t.game('audioRender', 'mix', 8, false, 201 + k, 100)).peak);
          t.expect(Math.max(...mixes) <= 0.92, 'the busiest moment, with the win in it, at volume 100 peaks at ' + Math.max(...mixes));
        },
      },
      {
        name: 'S5-15: a hint that costs points sounds a soft rising question over a low note, not the chime; a free hint keeps the chime',
        url: FLAT, viewports: ['desktop'], initScript: recorder,
        async run(t) {
          const q = await rendered(t, 'cue:hintCost', 5), c = await rendered(t, 'cue:chime', 5);
          t.expect(q.glide.some((v) => v > 540 && v < 600), 'the hint cue glides up to about 570 Hz: ' + q.glide.map(Math.round).join(', '));
          t.expect(q.osc.some((v) => v < 110), 'with a low note under it: ' + q.osc.map(Math.round).join(', '));
          t.expect(!c.glide.some((v) => v > 540 && v < 600) && !c.osc.some((v) => v < 200), 'the chime has neither');
          const peaks = []; for (let seed = 101; seed <= 107; seed++) peaks.push((await t.game('audioRender', 'cue:hintCost', 3, false, seed)).peak);
          t.expect(median(peaks) >= 0.2 && median(peaks) <= 0.45 && Math.min(...peaks) >= 0.17, 'it peaks inside the cue range: ' + median(peaks));
          await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000); await prime(t);
          const n0 = await cues(t); await t.game('act', 'hint'); const n1 = await cues(t);
          t.equal((n1.hintCost || 0) - (n0.hintCost || 0), 1, 'a Classic hint (−40) plays the hint-cost cue');
          t.equal((n1.chime || 0) - (n0.chime || 0), 0, 'and not the chime');
          await t.game('newGame', { layout: 'pyramid', seed: 22, level: 'relaxed' }); await t.waitIdle(15000);
          const r0 = await cues(t); await t.game('act', 'hint'); const r1 = await cues(t);
          t.equal((r1.chime || 0) - (r0.chime || 0), 1, 'a free hint in Relaxed keeps the chime');
          t.equal((r1.hintCost || 0) - (r0.hintCost || 0), 0, 'and has no penalty cue');
        },
      },
      {
        name: 'S5-15: a shuffle that costs points adds a faint falling low note after the rattle; a free one does not',
        url: FLAT, viewports: ['desktop'], initScript: recorder,
        async run(t) {
          const s = await rendered(t, 'cue:shuffleCost', 5);
          t.expect(s.osc.some((v) => v < 130) && s.glide.some((v) => v < 100), 'the cue is a low note that falls: ' + s.osc.map(Math.round).join(', ') + ' / ' + s.glide.map((v) => +v.toFixed(2)).join(', '));
          const peaks = []; for (let seed = 101; seed <= 107; seed++) peaks.push((await t.game('audioRender', 'cue:shuffleCost', 3, false, seed)).peak);
          t.expect(median(peaks) >= 0.2 && median(peaks) <= 0.45 && Math.min(...peaks) >= 0.17, 'it peaks inside the cue range: ' + median(peaks));
          await t.game('newGame', { layout: 'pyramid', seed: 21 }); await t.waitIdle(15000); await prime(t);
          const a = await cues(t); await t.game('act', 'shuffle'); const b = await cues(t);
          t.equal([(b.rattle || 0) - (a.rattle || 0), (b.shuffleCost || 0) - (a.shuffleCost || 0)], [1, 1], 'a Classic shuffle (−50) rattles and adds the low note');
          await t.game('newGame', { layout: 'pyramid', seed: 22, level: 'relaxed' }); await t.waitIdle(15000);
          const c = await cues(t); await t.game('act', 'shuffle'); const d = await cues(t);
          t.equal([(d.rattle || 0) - (c.rattle || 0), (d.shuffleCost || 0) - (c.shuffleCost || 0)], [1, 0], 'a free shuffle in Relaxed only rattles');
        },
      },
    ];
  })(),
];
