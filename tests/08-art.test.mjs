// Painted art (assets/*.webp): assets load and are used, ?art=0 falls back to vector art, tile sets persist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
const MB = Object.values(MANIFEST).reduce((a, m) => a + m.bytes, 0) / 1024 / 1024; // http assets (art-data.js is file:// only and not in the manifest)

const TESTS = [
  {
    name: 'painted assets load',
    async run(t) {
      t.log(Object.keys(MANIFEST).length + ' assets, ' + MB.toFixed(2) + ' MB');
      t.expect(MB <= 3.5, 'asset folder ≤ 3.5 MB (' + MB.toFixed(2) + ')');
      for (const set of ['palm', 'ribbon', 'peacock']) {
        await t.game('scene', 'settings');
        await t.page.click(`[data-set="tileset"] [data-v="${set}"]`);
        await t.game('newGame', { layout: 'pyramid', seed: 11 });
        await t.shot('08-set-' + set);
      }
      const a = await t.game('act', 'art');
      const missing = Object.keys(MANIFEST).filter((n) => !a.loaded.includes(n));
      t.equal(missing, [], 'every manifest asset decoded');
      t.equal(a.wanted.filter((n) => !MANIFEST[n]), [], 'the game asks only for packed assets');
      t.expect(!(await t.page.evaluate(() => !!window.MJ_ART_DATA)), 'the file:// art bundle is not loaded over http');
    },
  },
  {
    name: 'tile set persists',
    viewports: ['desktop'],
    async run(t) {
      await t.game('scene', 'settings');
      await t.page.click('[data-set="tileset"] [data-v="ribbon"]');
      t.equal(await t.page.getAttribute('[data-set="tileset"] [data-v="ribbon"]', 'aria-pressed'), 'true', 'choice shown as pressed');
      await t.reload();
      t.equal((await t.state()).settings.tileset, 'ribbon', 'tile set survives a reload');
      t.equal((await t.game('act', 'art')).tileset, 'ribbon', 'and is in use');
    },
  },
  {
    name: 'vector fallback (?art=0)',
    url: 'index.html?art=0&gl=1',
    async run(t) {
      const a = await t.game('act', 'art');
      t.equal(a.on, false, 'art disabled by the query flag');
      t.equal(a.wanted, [], 'no asset requests');
      await t.game('newGame', { layout: 'pyramid', seed: 11 });
      await t.shot('08-fallback');
    },
  },
];
// 3D tiles are forced on (?gl=1): the harness's Chromium renders WebGL with SwiftShader, where Tiles: Auto
// would pick flat tiles. Tests that set their own url keep it.
export const tests = TESTS.map((x) => ({ url: 'index.html?gl=1', ...x }));
