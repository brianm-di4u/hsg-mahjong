// Builds the win-screen fact list from research/trivia-bank.json and splices it into
// index.html between the FACTS markers. Run from the repo root:
//   node tools/extract-facts.mjs
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
const json = JSON.stringify(facts).replace(/</g, '\u003c');
const file = path.join(ROOT, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const re = /(<script type="application\/json" id="facts">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) throw new Error('facts marker not found');
fs.writeFileSync(file, html.replace(re, (_, a, b) => a + json + b));
console.log(`${facts.length} facts, ${json.length} bytes written`);
