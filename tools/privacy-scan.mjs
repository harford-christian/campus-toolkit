// privacy-scan.mjs — refuse to publish real-world identifiers in the demos.
//
// Run: node tools/privacy-scan.mjs      (exit 1 = do not push)
//
// WHY THIS EXISTS: campus-toolkit is a PUBLIC repo. On 2026-09-18 a scan found the real school
// domain on 67 distinct addresses across 20 files in 12 demos — including Josh's own address —
// published for anyone to harvest. Every one of those demos is meant to be 100% fabricated; the
// domain had simply been carried along with otherwise-invented names. demos/transpo-routes had
// been guarding against exactly this in its own verify.mjs, and that guard was right — it just
// only covered one demo. This is that check, for all of them.
//
// Each demo's verify.mjs still owns its own dataset's correctness; this owns one question only:
// is there anything real in here?
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = new URL('../demos/', import.meta.url).pathname.replace(/^\//, '');
const SCANNABLE = /\.(js|mjs|html|json|css|md)$/;

// Split so this file never matches its own patterns.
const DOMAIN = 'harford' + 'christian';

const RULES = [
  { name: 'real school domain', re: new RegExp(DOMAIN, 'i'),
    fix: 'use example.edu / example.com — the demos are fabricated, the domain should be too' },
  { name: 'Apps Script deployment id', re: /AKfycb[A-Za-z0-9_-]{20,}/,
    fix: 'a real /exec deployment — replace with a placeholder' },
  { name: 'live Apps Script URL', re: /script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/,
    fix: 'points at the real running app — replace with https://example.invalid/...' },
  { name: 'Drive / Sheets file id', re: /[\s"'/=(]1[A-Za-z0-9_-]{40,}/,
    fix: 'a real Drive object id — replace with a placeholder' }
];

/** Strip content that legitimately contains long random-looking runs, so the id rule does not
 *  false-positive on picture bytes. (It did, on embedded PNG data in talon-hub's Theme.) */
const declutter = (s) => s
  .replace(/base64,[A-Za-z0-9+/=\s]+/g, 'base64,<stripped>')
  .replace(/url\(data:[^)]*\)/g, 'url(data:<stripped>)');

/** A line that ASSERTS the absence of something isn't a leak — it's a guard. */
const isGuard = (line) => /\bok\(\s*!|\bcheck\(|expect|assert|should not|must not|no real/i.test(line);

function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const p = path.join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : (SCANNABLE.test(e) ? [p] : []);
  });
}

let findings = 0;
for (const file of walk(ROOT)) {
  const raw = readFileSync(file, 'utf8');
  const lines = declutter(raw).split('\n');
  for (const rule of RULES) {
    lines.forEach((line, i) => {
      if (!rule.re.test(line) || isGuard(line)) return;
      findings++;
      console.log(`LEAK  ${path.relative(ROOT, file)}:${i + 1}  ${rule.name}`);
      console.log(`      ${line.trim().slice(0, 100)}`);
      console.log(`      -> ${rule.fix}`);
    });
  }
}

console.log(findings
  ? `\n${findings} finding(s) — DO NOT PUSH until these are scrubbed`
  : `privacy scan clean — ${RULES.length} rules across every demo`);
process.exit(findings ? 1 : 0);
