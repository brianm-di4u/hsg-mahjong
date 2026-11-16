#!/usr/bin/env node
// Writes the display face into index.html as a base64 @font-face rule, between the two marker comments in the <style id="fonts"> block.
// A page opened from file:// cannot load a font from a url(), so the face travels inside the page. The source is vendor/fonts
// (SIL Open Font License 1.1; the licence is beside it as OFL-marcellus.txt).
//   node tools/build-fonts.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FACES = [
  // the title, the board names and the win card
  ['Marcellus', 400, 'normal', 'marcellus-latin-400-normal.woff2'],
];
const BEGIN = '/* fonts:begin (written by tools/build-fonts.mjs) */', END = '/* fonts:end */';
let css = '';
for (const [family, weight, style, file] of FACES) {
  const b64 = fs.readFileSync(path.join(GAME, 'vendor', 'fonts', file)).toString('base64');
  css += `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
}
const file = path.join(GAME, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const a = html.indexOf(BEGIN), b = html.indexOf(END);
if (a < 0 || b < a) throw new Error('the font markers are missing from index.html');
fs.writeFileSync(file, html.slice(0, a + BEGIN.length) + css + html.slice(b));
console.log('index.html font rule', (css.length / 1024).toFixed(1), 'KB');
