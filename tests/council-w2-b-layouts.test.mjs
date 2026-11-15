// Council wave 2, batch B, item S3-04: eleven new layouts (72, 96 and 120 tiles), each rated by the balance probe.
import { loadEngine } from '../tools/engine-load.mjs';
import { measure } from '../tools/balance.mjs';

const URL = 'index.html?gl=0';
const E = loadEngine();
const NEW = ['hale', 'lamar', 'quapaw', 'lake', 'promenade', 'central', 'valley', 'northmtn', 'westmtn', 'sugarloaf', 'cascade'];
const ORIGINAL = ['pyramid', 'tower', 'arlington', 'row', 'islands', 'terraces', 'display'];
const SIZE = { hale: 72, lamar: 72, quapaw: 96, lake: 96, sugarloaf: 96, cascade: 96, promenade: 120, central: 120, valley: 120, northmtn: 120, westmtn: 120 };
const WEEK = ['islands', 'display', 'pyramid', 'terraces', 'arlington', 'tower', 'row']; // Monday to Sunday, by the balance probe's win rate; it was ORIGINAL by day number
const band = (m) => (m >= 50 ? 'Easy' : m < 30 ? 'Hard' : 'Medium');

export const tests = [
  {
    name: 'S3-04: the eleven new layouts are valid, deal solvable boards, and keep whole quads and the Bathhouse share',
    node: true,
    async run(t) {
      t.equal(E.LAYOUTS.map((l) => l.id), [...ORIGINAL, ...NEW], 'the seven original boards come first, then the eleven new ones');
      for (const id of NEW) {
        const L = E.LAYOUTS.find((l) => l.id === id), pos = L.build(), g = E.buildGeometry(pos);
        t.equal(E.validateLayout(pos), [], id + ' passes validateLayout (support, overlap, even count)');
        t.equal(pos.length, SIZE[id], id + ' has ' + SIZE[id] + ' tiles');
        t.expect(pos.length % 4 === 0, id + ' keeps whole quads');
        for (let s = 1; s <= 8; s++) {
          const d = E.deal(g, E.makeRng(s * 7919));
          t.expect(d && E.planValid(g, new Array(g.n).fill(true), d.faces, d.plan), id + ' seed ' + s + ' replays to an empty board');
          const counts = new Map(); for (const f of d.faces) counts.set(E.matchKey(f), (counts.get(E.matchKey(f)) || 0) + 1);
          t.expect([...counts.values()].every((c) => c === 4), id + ' every kind appears four times');
          const bath = d.faces.filter((f) => f >= 9 && f < 18).length, want = 4 * Math.max(1, Math.round(9 * (g.n / 4) / 36));
          t.equal(bath, want, id + ' keeps its Bathhouse share (' + want + ' of ' + g.n + ' tiles), so the Row bonus is not given away');
        }
        for (let s = 1; s <= 6; s++) t.expect(!!E.solve(g, new Array(g.n).fill(true), E.deal(g, E.makeRng(1000 + s)).faces, 25000), id + ' deal ' + s + ' is solved by the independent solver');
      }
      const names = E.LAYOUTS.map((l) => l.name);
      t.expect(new Set(names).size === names.length, 'every board has its own name');
      const west = E.LAYOUTS.find((l) => l.id === 'westmtn').build(), north = E.LAYOUTS.find((l) => l.id === 'northmtn').build(), m = Math.max(...north.map((p) => p[0]));
      t.equal(west.map(([x, y, z]) => [m - x, y, z]).sort().join('|'), north.map(([x, y, z]) => [x, y, z]).sort().join('|'), 'West Mountain is North Mountain turned around');
    },
  },
  {
    name: 'S3-04: each layout carries a rating that is what the balance probe finds, and opens with moves',
    node: true,
    async run(t) {
      const rows = [];
      for (const L of E.LAYOUTS) {
        const r = measure(L, 'classic', 150);
        rows.push(L.id + ' ' + (r.winRate * 100).toFixed(1) + '% open ' + r.openingPairs);
        t.expect(Math.abs(r.winRate * 100 - L.measured) <= 0.5, L.id + ': stored ' + L.measured + ' matches the probe ' + (r.winRate * 100).toFixed(1));
        t.expect(r.openingPairs >= 4, L.id + ' opens with at least four free pairs on average (' + r.openingPairs + ')');
      }
      t.log(rows.join('; '));
    },
  },
  {
    name: 'S3-04: the picker lists all eighteen boards with size, a measured rating and a phone tag',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await t.game('unlockAll'); // the new boards are locked for a new player (S3-02)
      await t.game('scene', 'layouts');
      const cards = await t.page.$$eval('#cards .card', (cs) => cs.map((c) => ({ id: c.dataset.layout, rating: (c.querySelector('.rate') || {}).textContent, meas: (c.querySelector('.meas') || {}).textContent, best: c.querySelector('.best').textContent, phones: !!Array.from(c.querySelectorAll('.tag')).find((x) => x.textContent === 'Fits phones') })));
      t.equal(cards.length, 18, 'eighteen cards');
      for (const c of cards) {
        const L = E.LAYOUTS.find((l) => l.id === c.id);
        t.equal(c.rating, band(L.measured), c.id + ' is tagged ' + band(L.measured));
        t.expect(c.meas === 'A random player clears about ' + L.measured + ' in 100 deals.', c.id + ' says how it was measured: ' + c.meas);
        t.expect(c.best === L.build().length + ' tiles', c.id + ' shows its size: ' + c.best);
        t.equal(c.phones, !!L.portrait, c.id + ' phone tag matches its shape');
      }
      t.expect(cards.filter((c) => c.rating === 'Easy').length >= 3 && cards.filter((c) => c.rating === 'Hard').length >= 3, 'the ratings spread: easy, medium and hard boards all exist');
      t.equal(cards.filter((c) => c.phones).map((c) => c.id).sort(), ['cascade', 'display', 'sugarloaf', 'terraces'], 'four boards fit a phone held upright');
      await t.shot('S3-04-picker-short-boards');
      await t.page.click('#cards .card[data-layout="hale"]'); await t.waitIdle(15000);
      const s = await t.state();
      t.equal([s.layoutId, s.total], ['hale', 72], 'a new card starts its board');
    },
  },
  {
    name: 'S3-04: every new board starts, fits the screen, and can be cleared',
    url: URL,
    viewports: ['desktop', 'mobile'],
    async run(t) {
      for (const id of NEW) {
        await t.game('newGame', { layout: id, seed: 4242 }); await t.waitIdle(15000);
        let s = await t.state();
        t.equal([s.layoutId, s.total, s.tilesLeft, s.gameStatus], [id, SIZE[id], SIZE[id], 'playing'], id + ' starts with ' + SIZE[id] + ' tiles');
        t.expect(s.pairsAvailable >= 1 && s.winnable !== false, id + ' opens with a move');
        const fit = await t.game('act', 'boardFits');
        t.equal(fit.out, 0, id + ' keeps every tile on screen (tile ' + Math.round(fit.tileW) + ' px)');
        t.expect(fit.tileW >= 22, id + ' tiles are readable: ' + Math.round(fit.tileW) + ' px');
        await t.shot('S3-04-' + id);
        await t.game('act', 'solveTo', SIZE[id] - 2); s = await t.state();
        t.equal(s.rowDone, false, id + ': the Bathhouse Row bonus is not paid on the first pair');
        await t.game('newGame', { layout: id, seed: 4242 }); await t.waitIdle(15000);
        await t.game('act', 'solveTo', 0);
        await t.page.waitForSelector('#o-win.on', { timeout: 8000 });
        s = await t.state();
        t.equal(s.gameStatus, 'won', id + ' can be cleared');
        await t.page.click('#ow-title');
      }
      await t.checkLayout();
    },
  },
  {
    name: 'S3-04: the Daily Puzzle still uses the original seven boards only',
    url: URL,
    viewports: ['desktop'],
    async run(t) {
      const seen = new Set();
      for (let d = 1; d <= 21; d++) {
        const date = '2026-12-' + String(d).padStart(2, '0');
        const days = Math.floor(Date.UTC(2026, 11, d) / 86400000);
        const r = await t.game('newGame', { daily: true, date });
        t.equal(r.layoutId, WEEK[(days + 3) % 7], date + ' picks the board of its weekday (wave 3, S3-03: easiest on Monday to hardest on Sunday)');
        seen.add(r.layoutId);
      }
      t.equal(seen.size, 7, 'all seven original boards come up in three weeks');
    },
  },
];
