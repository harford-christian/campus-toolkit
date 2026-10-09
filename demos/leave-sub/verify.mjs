// Verifies the Leave & Substitute demo: the page is a fresh build of the source (build.json), every
// google.script.run method the page calls is answered by mock.js with the shape the page reads, the
// Charged vs Used card's numbers add up under every range, and nothing private leaked.
// Run from the repo root: node demos/leave-sub/verify.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = fileURLToPath(new URL('../../../leave-sub-automation/public-interface/Public.html', import.meta.url));
let fail = 0;
const check = (l, c, extra) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + l + (!c && extra ? '\n        ' + extra : '')); if (!c) fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- load data.js and mock.js the way the browser does ---------- */
const window = {};
new Function('window', readFileSync(HERE + 'data.js', 'utf8'))(window);
new Function('window', readFileSync(HERE + 'mock.js', 'utf8'))(window);
const D = window.LEAVESUB_DATA, M = window.MOCK_BACKEND;
const html = readFileSync(HERE + 'index.html', 'utf8');

/* ---------- the mock contract ---------- */
function chainEndpoint(src, from) {
  const text = src.slice(from, from + 8000).replace(/\/\/[^\n]*/g, '');
  if (!/^\s*\./.test(text)) return null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++; else if (ch === ')') depth--;
    else if (depth === 0 && ch === '[') return null;
    else if (depth === 0 && ch === '.') { const m = /^\.([a-zA-Z]\w*)\s*\(/.exec(text.slice(i, i + 60)); if (m && !/^with/.test(m[1])) return m[1]; }
  }
  return null;
}
const calls = [...new Set([...html.matchAll(/google\.script\.run/g)].map((m) => chainEndpoint(html, m.index + 17)).filter(Boolean))].sort();
check('the page calls seven methods and the mock answers exactly those',
  eq(calls, ['getLoggedInUser', 'getMyChargeVsActual', 'getPersonalLeaveData', 'getPublicAnalytics', 'getRankingData', 'getStaffHandbook', 'getSubData']) &&
  eq(Object.keys(M).sort(), calls), 'page: ' + calls.join(', ') + ' | mock: ' + Object.keys(M).sort().join(', '));
check('no unreplaced Apps Script template tokens', !/<\?[=!]?[\s\S]*?\?>/.test(html));

/* ---------- the contracts the tabs read ---------- */
const me = M.getLoggedInUser();
check('the signed-in user is the fabricated staff member, on the demo domain', /@example\.edu$/.test(me.email) && typeof me.appUrl === 'string');
const pl = M.getPersonalLeaveData();
check('personal records carry the fields the My Leave tab reads, with every one of the five types in the breakdown',
  pl.records.length >= 6 && pl.records.every((r) => 'approvalId' in r && 'type' in r && 'status' in r && 'start' in r && 'hours' in r && 'submittedRaw' in r) &&
  eq(Object.keys(pl.breakdown).sort(), ['HCS-Related', 'Late Arrival/Early Departure', 'Other Paid Leave', 'Personal Leave', 'Sick Leave'].sort()));
check('one pending request sits three weeks ahead, so "Upcoming Leave" is never empty',
  pl.records.some((r) => r.status === 'Pending' && r.startRaw > Date.now() + 19 * 86400000));
check('a short-notice approval exists (submitted under 14 days before it started)',
  pl.records.some((r) => r.status === 'Approved' && r.startRaw - r.submittedRaw < 14 * 86400000 && r.startRaw - r.submittedRaw > 0));
check('public analytics rows have type/weekday/startRaw/endRaw/hours', M.getPublicAnalytics().every((r) => 'type' in r && 'weekday' in r && 'startRaw' in r && 'hours' in r));
check('rankings and sub data keep their shapes', eq(Object.keys(M.getRankingData()).length, 5) && ['myLeave', 'mySubWork', 'schoolWide'].every((k) => k in M.getSubData()));

/* ---------- Charged vs Used (the new card) ---------- */
const all = M.getMyChargeVsActual('All'), sy = M.getMyChargeVsActual('SchoolYear'), tm = M.getMyChargeVsActual('ThisMonth'), lm = M.getMyChargeVsActual('LastMonth');
const sums = (r) => r.byType.reduce((a, t) => ({ c: a.c + t.chargeable, u: a.u + t.actual, n: a.n + t.count }), { c: 0, u: 0, n: 0 });
check('All time: five approved rows count (HCS-Related is excluded by the server\'s rule), totals equal the per-type rows, difference is charged minus used',
  all.requests === 5 && all.period.label === 'All time' && Math.abs(sums(all).c - all.chargeable) < 0.01 && Math.abs(sums(all).u - all.actual) < 0.01 &&
  sums(all).n === all.requests && Math.abs(all.difference - (all.chargeable - all.actual)) < 0.01 && !all.byType.some((t) => t.type === 'HCS-Related'),
  JSON.stringify(all));
check('two rows were charged more than the time away (half-day rounding), so roundedUp is 2 and the difference is positive',
  all.roundedUp === 2 && all.difference > 0 && all.chargeable === 36 && all.actual === 32.25);
check('every narrower range is a subset of All and labelled with its dates; the school year (the records sit on its calendar) holds all five',
  sy.requests === 5 && [sy, tm, lm].every((r) => r.requests <= all.requests && r.chargeable <= all.chargeable && / – /.test(r.period.label)) &&
  sy.period.key === 'SchoolYear' && tm.period.key === 'ThisMonth' && lm.period.key === 'LastMonth', JSON.stringify([sy.requests, tm.requests, lm.requests]));
check('byType rows are sorted by type and carry type/count/chargeable/actual', all.byType.every((t, i, a) => (i === 0 || a[i - 1].type <= t.type) && eq(Object.keys(t), ['type', 'count', 'chargeable', 'actual'])));

/* ---------- privacy ---------- */
const blob = html + readFileSync(HERE + 'data.js', 'utf8') + readFileSync(HERE + 'mock.js', 'utf8');
check('no real domain, deployment id, spreadsheet id or real email', !/harfordchristian|AKfycb|docs\.google\.com\/spreadsheets|1[A-Za-z0-9_-]{30,}/i.test(blob));
check('every email in the demo is on example.edu', [...blob.matchAll(/[\w.+-]+@[A-Za-z][\w-]*\.[\w.]+/g)].every((m) => /@(example\.edu|uid\.demo\.example\.edu|example\.com)$/.test(m[0])));

/* ---------- fresh build ---------- */
if (!existsSync(SRC)) { check('source project present for the fresh-build check', false, SRC); }
else {
  try {
    const cfg = JSON.parse(readFileSync(HERE + 'build.json', 'utf8'));
    mkdirSync(ROOT + '.tmp', { recursive: true });
    const tmpCfg = ROOT + '.tmp/verify-leave-sub.json', tmpOut = ROOT + '.tmp/verify-leave-sub.html';
    writeFileSync(tmpCfg, JSON.stringify({ ...cfg, dst: tmpOut }));
    execFileSync(process.execPath, [ROOT + 'tools/build-demo.mjs', tmpCfg], { cwd: ROOT, stdio: 'pipe' });
    check('index.html is what build-demo.mjs produces from the current source (not stale)', readFileSync(tmpOut, 'utf8') === html,
      'rebuild: node tools/build-demo.mjs demos/leave-sub/build.json');
  } catch (e) { check('index.html could be rebuilt from build.json', false, e.message); }
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
