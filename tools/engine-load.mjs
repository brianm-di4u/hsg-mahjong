// Loads the pure engine block (<script id="engine">) from index.html into a Node VM and returns ENGINE.
// Used by tools/check-layouts.mjs and the Node rules tests (tests/10-mechanics.test.mjs).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export function loadEngine(htmlPath = path.join(HERE, '..', 'index.html')) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const src = html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.E = ENGINE;', ctx);
  return ctx.E;
}
