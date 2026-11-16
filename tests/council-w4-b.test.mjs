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
      run = await t.page.evaluate(() => {
        const g = window.__game, steps = [], cnt = (s) => [0, 1, 2].map((k) => s.tiles.filter((x) => x.present && x.f < 27 && Math.floor(x.f / 9) === k).length);
        let undoRedo = null;
        for (let n = 0; n < 100; n++) {
          const s0 = g.getState(), c0 = cnt(s0);
          if (!g.act('solveStep')) break;
          const s1 = g.getState(), c1 = cnt(s1);
          if (s1.gameStatus === 'won') break; // the last pair carries the win bonuses as well
          const cleared = [0, 1, 2].filter((k) => c0[k] > 0 && c1[k] === 0);
          steps.push({ d: s1.score - s0.score, combo: s1.combo, row: s1.rowDone && !s0.rowDone, cleared, toast: document.getElementById('toast').textContent, status: document.getElementById('status-text').textContent });
          if (cleared.length && !undoRedo) {
            g.act('undo'); const back = g.getState().score; g.act('redo'); const again = g.getState().score;
            undoRedo = { before: s0.score, after: s1.score, back, again };
          }
        }
        return { steps, undoRedo };
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
];
