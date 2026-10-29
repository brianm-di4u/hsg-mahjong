// Turns three.js's self-contained ES module build into a classic script that sets window.THREE,
// so the game can load it with <script src> (ES-module imports of local files fail under file://).
//
//   npm pack three@0.169.0 && tar -xzf three-0.169.0.tgz        (in an empty scratch folder)
//   node tools/vendor-three.mjs <path to the extracted "package" folder>
//
// The only change to the code is the wrapper: the trailing `export{a as B,...}` becomes
// `window.THREE={B:a,...}` inside a strict-mode function. See SAMPLES.md for the version record.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = process.argv[2];
if (!pkg) { console.error('usage: node vendor-three.mjs <three package folder>'); process.exit(1); }
const meta = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
if (meta.name !== 'three') throw new Error('not the three package');
let src = fs.readFileSync(path.join(pkg, 'build', 'three.module.min.js'), 'utf8');
if (/^\s*import[\s{]/m.test(src) || src.includes('import.meta')) throw new Error('build imports other files; pick a self-contained version (<= r170)');
const m = src.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
if (!m) throw new Error('trailing export clause not found');
const pairs = m[1].split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
  const [local, , name] = s.split(/\s+/); return (name || local) + ':' + local;
});
src = src.slice(0, m.index);
const out = '/* three.js r' + meta.version.split('.')[1] + ' (npm three@' + meta.version + '), MIT license: see three-LICENSE.txt. Wrapped as a classic script by tools/vendor-three.mjs. */\n'
  + '(function(){"use strict";\n' + src + '\nwindow.THREE={' + pairs.join(',') + '};\n})();\n';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vendor');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'three.min.js'), out);
fs.copyFileSync(path.join(pkg, 'LICENSE'), path.join(dir, 'three-LICENSE.txt'));
console.log('vendor/three.min.js', (out.length / 1024).toFixed(0) + ' KB,', pairs.length, 'exports, three@' + meta.version);
