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
];
