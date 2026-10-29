// Rules, layouts and deal generation (PRD AC1-AC3, AC6, AC7, AC20).
const LAYOUTS = ['pyramid', 'tower', 'arlington', 'row', 'islands'];

export const tests = [
  {
    name: 'layouts are valid and every deal is solvable',
    viewports: ['desktop'],
    async run(t) {
      for (const id of LAYOUTS) {
        const r = await t.game('act', 'verifyDeals', id, 100);
        t.equal(r.errors, [], `${id} layout errors`);
        t.equal(r.ok, 100, `${id}: deals that replay to an empty board`);
        t.expect(r.maxMs < 50, `${id}: deal generation ${r.maxMs} ms (budget 50)`);
        t.log(`${id}: ${r.ok}/100 solvable, max deal ${r.maxMs} ms`);
        const s = await t.game('act', 'solverCheck', id, 10);
        t.log(`${id}: independent solver found a solution for ${s.solved}/${s.total} deals`);
      }
    },
  },
  {
    name: 'deal composition, flowers and seasons, determinism',
    viewports: ['desktop'],
    async run(t) {
      for (const id of LAYOUTS) {
        const counts = await t.game('act', 'composition', id, 42);
        for (let f = 0; f < 34; f++) t.equal(counts[f], 4, `${id} face ${f} count`);
        for (let f = 34; f < 42; f++) t.equal(counts[f], 1, `${id} bonus face ${f} count`);
      }
      // determinism
      await t.game('newGame', { layout: 'tower', seed: 777 });
      const a = (await t.state()).tiles.map((x) => x.f);
      await t.game('newGame', { layout: 'tower', seed: 777 });
      const b = (await t.state()).tiles.map((x) => x.f);
      await t.game('newGame', { layout: 'tower', seed: 778 });
      const c = (await t.state()).tiles.map((x) => x.f);
      t.equal(a, b, 'same seed gives the same deal');
      t.expect(JSON.stringify(a) !== JSON.stringify(c), 'different seed gives a different deal');
      // flowers match any flower, seasons any season, but not each other
      const s = await t.state();
      const keyOf = (f) => (f < 34 ? f : f < 38 ? 34 : 38);
      for (const tile of s.tiles) t.equal(tile.key, keyOf(tile.f), 'match key');
      const flowers = s.tiles.filter((x) => x.f >= 34 && x.f < 38).map((x) => x.f);
      t.equal(new Set(flowers).size, 4, 'four distinct flowers in the deal');
    },
  },
  {
    name: 'layout screenshots',
    async run(t) {
      for (const id of LAYOUTS) {
        await t.game('newGame', { layout: id, seed: 2026 });
        const s = await t.state();
        t.equal(s.total, 144, `${id} has 144 tiles`);
        t.expect(s.pairsAvailable > 0, `${id} opens with free pairs`);
        await t.shot('02-layout-' + id);
        await t.checkLayout({ allowScrollY: false });
      }
    },
  },
];
