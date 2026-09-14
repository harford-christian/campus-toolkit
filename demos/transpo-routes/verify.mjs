#!/usr/bin/env node
/* verify.mjs — prove this demo still matches the app it claims to be.
 *
 *   node demos/transpo-routes/verify.mjs
 *
 * Checks, in order of how much they matter:
 *   1. PRIVACY — no real student, no leaked id/URL, and the driver page never renders a field the
 *      source project's own forbidden list bans. This is the one that must never be skipped.
 *   2. The vendored logic.js is in sync with the source project's logic/.
 *   3. The mock covers every google.script.run method the two built pages actually call.
 *   4. data.js + mock.js load and answer, and the NOT_CHECKED distinction survives end to end.
 *
 * Exits 0 with SKIP for the source-project checks if transpo-department isn't checked out.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../../../FACTS/transpo-department');

let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m); if (!c) fail++; };
const skip = (m) => console.log('SKIP  ' + m);

const driver = readFileSync(path.join(HERE, 'driver.html'), 'utf8');
const office = readFileSync(path.join(HERE, 'office.html'), 'utf8');
const dataJs = readFileSync(path.join(HERE, 'data.js'), 'utf8');
const mockJs = readFileSync(path.join(HERE, 'mock.js'), 'utf8');
const logicJs = readFileSync(path.join(HERE, 'logic.js'), 'utf8');
const all = [driver, office, dataJs, mockJs, logicJs].join('\n');

/* ---------------------------------- 1. privacy ---------------------------------- */
console.log('\n  privacy');

// Deployment ids, Sheet ids, live URLs.
const leaks = all.match(/AKfycb[A-Za-z0-9_-]+|docs\.google\.com\/spreadsheets|\b1[A-Za-z0-9_-]{30,}/g) || [];
ok(leaks.length === 0, 'no deployment id, Sheet id or live URL — found: ' + [...new Set(leaks)].slice(0, 3).join(', '));

/* The real drivers and office staff are real people and must not appear anywhere in this demo.
 *
 * They are matched by HASH, never by name. A deny list written out in full would publish the very
 * people it exists to protect — into a public, prospect-facing repo — which is worse than not
 * checking at all. So: pull every "First Last" out of the built demo, hash it, and compare. The
 * hashes below reveal nothing, and the check still fails loudly if a real name ever lands here.
 *
 * To add someone: node -e "console.log(require('crypto').createHash('sha256')
 *   .update('First Last'.toLowerCase()).digest('hex').slice(0,16))" */
const PROTECTED = new Set([
  'ce5b1a14960b3438', '1ea979791640d8d2', 'd093f51eddb56f7a', 'c5732bacf456925e',
  '0c1163012b859371', '715ee45ae4c3ebac', '15a01f8e194705e0', '12672c6b44d587a9',
  'f12ee7ff175c2fae', 'daf4752323db78ec', '25adea4cb817ea12', '6d99b5b47601b828'
]);
const hits = [];
for (const m of all.matchAll(/\b[A-Z][a-z]+ [A-Z][a-zA-Z]+\b/g)) {
  const h = createHash('sha256').update(m[0].toLowerCase()).digest('hex').slice(0, 16);
  if (PROTECTED.has(h)) hits.push(m[0]);
}
ok(hits.length === 0, 'no real driver or staff name appears (hash-matched) — found: ' + hits.join(', '));
ok(dataJs.includes('Wendell Ashby') && dataJs.includes('Hollis Brandt'),
   'the fabricated driver cast IS present (shared with the Dismissal Board demo)');

ok(!/@harfordchristian\.org/.test(all), 'no real email domain');
ok(/example\.edu/.test(mockJs), 'demo addresses use example.edu');

/* ------------------------- 2. vendored logic in sync ------------------------- */
console.log('\n  vendored logic');
if (!existsSync(SRC)) {
  skip('source project not checked out — cannot compare logic.js');
} else {
  const FILES = ['schema.js', 'stops.js', 'manifest.js', 'office.js', 'auth.js'];
  let drift = [];
  for (const f of FILES) {
    let body = readFileSync(path.join(SRC, 'logic', f), 'utf8');
    const cut = body.indexOf("if (typeof module !== 'undefined'");
    if (cut > 0) body = body.slice(0, cut);
    body = body.replace(
      /\(typeof module !== 'undefined' && module\.exports\)\s*\r?\n?\s*\? require\([^)]*\) : null/g,
      'null');
    // Compare on a whitespace-normalised basis so a line-ending flip is not reported as drift.
    const norm = (s) => s.replace(/\r\n/g, '\n').trim();
    if (!norm(logicJs).includes(norm(body))) drift.push(f);
  }
  ok(drift.length === 0,
     'logic.js matches the source project — stale: ' + (drift.join(', ') || 'none') +
     (drift.length ? '  (run: node demos/transpo-routes/build-logic.mjs)' : ''));

  // The forbidden-field list is the demo's privacy contract too, not just the app's.
  const schema = readFileSync(path.join(SRC, 'logic', 'schema.js'), 'utf8');
  ok(/FORBIDDEN_RIDER_FIELDS/.test(logicJs) && /FORBIDDEN_RIDER_FIELDS/.test(schema),
     'the forbidden-field list is vendored along with the logic');
}

/* ---------------------------- 3. mock contract ---------------------------- */
console.log('\n  mock contract');
/**
 * Collect the backend methods a page calls, by walking the chain with paren-depth tracking.
 *
 * Regex cannot do this. The apps write
 *   google.script.run.withSuccessHandler(fn).withFailureHandler(fn).driverApi(req);
 * and the handler bodies contain their own semicolons, parens and `.method(` calls — so both a
 * bounded window and a "stop at the first ;" match found either nothing or the wrong names, and
 * the check passed vacuously. Walking from `google.script.run` and recording `.name(` only at
 * depth 0 picks out exactly the chain links, whatever the handlers contain.
 */
function backendCalls(src) {
  const out = new Set();
  let i = src.indexOf('google.script.run');
  while (i !== -1) {
    let j = i + 'google.script.run'.length;
    let depth = 0;
    while (j < src.length) {
      const c = src[j];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ';' && depth === 0) break;
      else if (c === '.' && depth === 0) {
        const m = /^\.(\w+)\s*\(/.exec(src.slice(j));
        if (m && !/^with/.test(m[1])) out.add(m[1]);
      }
      j++;
    }
    i = src.indexOf('google.script.run', j);
  }
  return out;
}

const called = new Set();
for (const page of [driver, office]) for (const c of backendCalls(page)) called.add(c);
const provided = new Set();
for (const m of mockJs.matchAll(/window\.MOCK_BACKEND\s*=\s*\{([\s\S]*?)\}/g)) {
  for (const k of m[1].matchAll(/(\w+)\s*:/g)) provided.add(k[1]);
}
const missing = [...called].filter((c) => !provided.has(c));
ok(called.size > 0, 'found the pages\' backend calls: ' + [...called].join(', '));
ok(missing.length === 0, 'mock provides every method the pages call — missing: ' + (missing.join(', ') || 'none'));

// Every {op:'x'} the pages send must be handled, or a tab silently renders empty.
const ops = new Set();
for (const page of [driver, office]) {
  for (const m of page.matchAll(/op\s*:\s*'(\w+)'/g)) ops.add(m[1]);
}
const unhandled = [...ops].filter((o) => !new RegExp(`op === '${o}'|case '${o}'`).test(mockJs));
ok(unhandled.length === 0, 'mock handles every op the pages send — unhandled: ' + (unhandled.join(', ') || 'none'));

/* ---------------------------- 4. it actually runs ---------------------------- */
console.log('\n  runtime');
const win = { sessionStorage: { getItem: () => null, setItem: () => {} } };
try {
  new Function('window', 'module', 'require', logicJs)(win, undefined, undefined);
  new Function('window', 'module', 'require', dataJs)(win, undefined, undefined);
  new Function('window', 'module', 'require', mockJs)(win, undefined, undefined);
  ok(true, 'logic.js + data.js + mock.js load in a browser-like scope');
} catch (e) {
  ok(false, 'load failed: ' + e.message);
}

if (win.MOCK_BACKEND) {
  const B = win.MOCK_BACKEND;
  const dash = B.officeApi({ op: 'dashboard' });
  ok(dash.ok && dash.routes.length === 7, 'dashboard returns all 7 routes');

  const J = dash.routes.find((r) => r.code === 'J');
  const Ab = dash.routes.find((r) => r.code === 'Ab');
  ok(J.state === 'in_progress' || J.state === 'complete',
     'Jarrettsville has been ticked, so it is not "not checked" (' + J.state + ')');
  ok(Ab.state === 'not_checked', 'Abingdon has riders but NO events, so it reads not_checked');
  ok(!/\b0\b/.test(Ab.label), 'the Abingdon label never renders a bare 0: "' + Ab.label + '"');

  const AH = dash.routes.find((r) => r.code === 'A/HdG');
  ok(AH.drivers.length === 0, 'Aberdeen/HdG shows its Tuesday driver gap');
  ok(dash.gaps.isSchoolDay === true, 'the demo day is a school day, so that gap reads as real');

  // The PII contract, end to end through the real projection.
  B.driverApi({ op: 'login', pin: '4821' });
  const man = B.driverApi({ op: 'manifest', code: 'J' });
  ok(man.ok && man.stops.length > 0, 'driver manifest builds and groups onto stops');
  const riders = [].concat(...man.stops.map((s) => s.riders)).concat(man.notRiding);
  const banned = win.TRANSPO_LOGIC.FORBIDDEN_RIDER_FIELDS;
  const bad = [];
  for (const r of riders) for (const f of banned) if (Object.prototype.hasOwnProperty.call(r, f)) bad.push(f);
  ok(bad.length === 0, 'no rider in the built manifest carries a forbidden field — found: ' + [...new Set(bad)].join(', '));
  ok(riders.every((r) => !/^s\d+$/.test(r.rk)), 'the rider key is not the raw student id');

  const noStops = B.driverApi({ op: 'manifest', code: 'E' });
  ok(noStops.stopsUnset === true, 'a route with no stops entered reports stopsUnset, so the page can say so');
}

console.log('\n' + (fail ? `  ${fail} FAILURE(S)\n` : '  all checks passed\n'));
process.exit(fail ? 1 : 0);
