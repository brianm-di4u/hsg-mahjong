// Builds the win-screen fact list from research/trivia-bank.json and splices it into
// index.html between the FACTS markers. Run from the repo root:
//   node tools/extract-facts.mjs [--file other.html]
// A rerun keeps what the page already holds: the records the owner approved by hand (they are not in the bank)
// and corrections made to a record (hs-0102 says 2013). The bank only adds records the page does not have yet.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'trivia-bank.json'), 'utf8'));
// Sensitive history never pops up as a "fun fact" (research/00-INDEX.md content rules).
const SENSITIVE = /lynch|slave|segregat|bomb|murder|kill|racis|riot|massacre|shoot|death|died|fatal|incident|gangster|mob\b/i;
const facts = bank.questions
  .filter((q) => ['Places & Landmarks', 'Nature & Lakes'].includes(q.category) && q.confidence === 'confirmed')
  .filter((q) => !SENSITIVE.test(q.question + ' ' + q.answer + ' ' + q.explanation))
  .map((q) => ({ id: q.id, q: q.question, a: q.answer, e: q.explanation, s: q.source }));
const at = process.argv.indexOf('--file');
const file = at > 0 ? path.resolve(process.argv[at + 1]) : path.join(ROOT, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const re = /(<script type="application\/json" id="facts">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) throw new Error('facts marker not found');
const held = JSON.parse(html.match(re)[0].replace(/^<script[^>]*>|<\/script>$/g, ''));
const heldIds = new Set(held.map((f) => f.id));
const added = facts.filter((f) => !heldIds.has(f.id));
const merged = held.concat(added);
const json = JSON.stringify(merged).replace(/</g, '<');
fs.writeFileSync(file, html.replace(re, (_, a, b) => a + json + b));
console.log(`${merged.length} facts (${held.length} kept, ${added.length} added from the bank), ${json.length} bytes written`);
