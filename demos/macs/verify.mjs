#!/usr/bin/env node
/* verify.mjs — prove this demo still matches the app it claims to be.
 *
 *   node demos/macs/verify.mjs
 *
 * Checks, in order of how much they matter:
 *   1. PRIVACY — above all, that the project's file of real 2023-24 entrants never reaches the bundle; then no
 *      real domain, address, deployment URL, Drive id, logo or staff name in anything the demo ships.
 *   2. The vendored logic.js is in sync with the source project, and both pages are fresh builds.
 *   3. The mock implements exactly the google.script.run methods the two built pages call.
 *   4. Behaviour, end to end through the REAL code: the sign-in gate and its refusals, the session token,
 *      entry ids and cross-references, the per-school cap, the one-time-submission rule, admin edits, the
 *      sample seeder, the year-end archive, and the form page's inability to reach admin endpoints.
 *
 * Exits 0 with SKIP for the source-project checks if the project isn't checked out beside this repo.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findStaffNames } from '../../tools/staff-aliases.mjs';
import { buildLogic, SRC } from './build-logic.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let fail = 0;
const ok = (c, m, extra) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m + (!c && extra ? '\n        ' + extra : '')); if (!c) fail++; };
const skip = (m) => console.log('SKIP  ' + m);
const read = (f) => readFileSync(path.join(HERE, f), 'utf8');
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const form = read('form.html'), admin = read('admin.html'), dataJs = read('data.js'), mockJs = read('mock.js'), logicJs = read('logic.js'), switcher = read('index.html');
const all = [form, admin, dataJs, mockJs, logicJs, switcher].join('\n');

/* ---------------------------------- 1. privacy ---------------------------------- */
console.log('\n  privacy');
// (mock.js defines the three tables EMPTY so the real clear routine can run; a non-empty literal is the leak.)
ok(!/HISTORICAL_ENTRIES\s*=\s*\[\s*\{/.test(all) && !/HistoricalData\.js/.test(logicJs) && !/HISTORICAL_ROSTERS\s*=\s*\{\s*['"]/.test(all) && !/HISTORICAL_SCHOOL_NAMES\s*=\s*\{\s*['"]/.test(all),
  'the real 2023-24 entrants (HistoricalData.js) are NOT in the bundle');
const leaks = all.match(/AKfycb[A-Za-z0-9_-]+|docs\.google\.com\/spreadsheets|script\.google\.com\/macros|\b1[A-Za-z0-9_-]{30,}\b/g) || [];
ok(leaks.length === 0, 'no deployment id, live URL, Sheet id or Drive folder id', [...new Set(leaks)].slice(0, 3).join(', '));
ok(!/harford\s*christian|harfordchristian/i.test(all), 'the real school name and domain never appear');
ok(!/Whiteford|Darlington/i.test(all), 'no street address');
const staffHits = findStaffNames(all);
ok(staffHits.length === 0, 'no real staff name — matched by hash, never listed', staffHits.join(', '));
const emails = [...new Set(all.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [])];
const EXAMPLE = /@([\w-]+\.)?example\.(com|edu|org|invalid)$/i;   // .invalid: the source's own sign-in probe address
ok(emails.every(e => EXAMPLE.test(e)), 'every email address is on an example.* domain', emails.filter(e => !EXAMPLE.test(e)).join(', '));
ok(!/data:image\/png;base64,/.test(form) && !/data:image\/png;base64,/.test(admin) && /data:image\/svg\+xml,/.test(form), 'the real organisation crest is replaced by a generated badge');
ok(!/real schools, 2023-24 names/.test(admin), 'the admin seed button no longer promises real data');

/* --------------------------- 2. vendored code + fresh builds --------------------------- */
console.log('\n  source sync');
if (!existsSync(SRC)) {
  skip('source project not found at ' + SRC + ' — logic drift and fresh-build checks skipped');
} else {
  ok(buildLogic() === logicJs, 'logic.js is the source project\'s eight server files, verbatim after the scrubs (run build-logic.mjs)');
  const tmp = mkdtempSync(path.join(tmpdir(), 'macs-verify-'));
  try {
    for (const [cfg, built] of [['build.form.json', form], ['build.admin.json', admin]]) {
      const c = JSON.parse(read(cfg));
      const tmpCfg = path.join(tmp, cfg), dst = path.join(tmp, path.basename(c.dst));
      writeFileSync(tmpCfg, JSON.stringify({ ...c, src: path.resolve(ROOT, c.src), dst }));
      execFileSync(process.execPath, [path.join(ROOT, 'tools/build-demo.mjs'), tmpCfg], { cwd: ROOT, stdio: 'pipe' });
      ok(readFileSync(dst, 'utf8') === built, path.basename(c.dst) + ' is a fresh build of ' + cfg);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
ok(!/<\?[=!]?[\s\S]*?\?>/.test(form + admin), 'no Apps Script template token in either page');
ok(/<base target="_self">\s*<script src="logic\.js"><\/script>/.test(form) && /<base target="_self">\s*<script src="logic\.js"><\/script>/.test(admin), 'both pages target _self and load logic.js before the shim');

/* ---------------------------------- 3. mock contract ---------------------------------- */
console.log('\n  mock contract');
function calledMethods(html) {
  const out = new Set();
  let i = 0;
  while ((i = html.indexOf('google.script.run', i)) !== -1) {
    let j = i + 'google.script.run'.length;
    for (;;) {
      const m = /^\s*\.(\w+)\(/.exec(html.slice(j, j + 60));
      if (!m) break;
      if (/^with(Success|Failure)Handler$|^withUserObject$/.test(m[1])) {
        let depth = 0, k = j + m[0].length - 1;
        for (; k < html.length; k++) { if (html[k] === '(') depth++; else if (html[k] === ')') { depth--; if (!depth) break; } }
        j = k + 1; continue;
      }
      out.add(m[1]); break;
    }
    i = j;
  }
  // Dynamic names: the form's gateCall_('name'), the admin page's getter/setter strings and action fn names.
  for (const m of html.matchAll(/gateCall_\('(\w+)'/g)) out.add(m[1]);
  for (const m of html.matchAll(/'(admin_\w+)'/g)) out.add(m[1]);
  return out;
}
const formCalls = [...calledMethods(form)].sort(), adminCalls = [...calledMethods(admin)].sort();
ok(eq(formCalls, ['checkSchoolStatus', 'getBranding', 'getCategoryList', 'getFieldTemplateDefs', 'getJudgingSheets', 'getPaymentInfo', 'getSchoolList',
  'requestSchoolCode', 'submitSchoolEntries', 'uploadEntryFile', 'verifySchoolCode']), 'the form calls exactly the eleven methods the source does', formCalls.join(', '));
ok(adminCalls.length === 21 && adminCalls.every(n => /^admin_/.test(n)), 'the admin page calls exactly its 21 admin_* methods (the judging-sheet upload is a paste-a-link field in this build)', adminCalls.join(', '));

/* ---------------------------------- 4. behaviour ---------------------------------- */
console.log('\n  behaviour (real code, in-memory services)');
function memStorage() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
function boot(page, session) {
  globalThis.window = globalThis; globalThis.sessionStorage = session; globalThis.location = { pathname: '/demos/macs/' + page };
  const load = (f) => new Function(readFileSync(f, 'utf8'))();
  load(path.join(HERE, 'logic.js')); load(path.join(HERE, 'data.js')); load(path.join(HERE, 'mock.js'));
  return { M: globalThis.MOCK_BACKEND, L: globalThis.MACS_LOGIC, D: globalThis.MACS_DEMO };
}
let session = memStorage();
let { M, L, D } = boot('form.html', session);
ok(eq(Object.keys(M).sort(), [...new Set([...formCalls, ...adminCalls])].sort()), 'MOCK_BACKEND implements exactly the methods the pages call');

const schools = M.getSchoolList();
ok(schools.length === 8 && schools.every(s => /^1[0-7]00$/.test(s.code)) && schools.filter(s => !s.otp).map(s => s.name).join() === 'Oakmont Christian Academy',
  'eight fabricated schools, reconciled against the sibling roster; one has no allowlisted address');
ok(M.getCategoryList().length === 73 && Object.keys(M.getFieldTemplateDefs()).length === 9, 'the 73 categories and 9 field templates are the app\'s own defaults');
ok(M.getBranding().brand.orgName === 'Maryland Association of Christian Schools', 'branding comes from the (mocked) sibling project, as in production');

// the sign-in gate
ok(M.requestSchoolCode('Oakmont Christian Academy', 'a@oakmont.example.org').code === 'SCHOOL_NOT_CONFIGURED', 'a school with no allowlisted address is refused with the honest message');
ok(M.requestSchoolCode('Nowhere Academy', 'a@b.example.org').code === 'UNKNOWN_SCHOOL', 'an unknown school name is refused');
ok(M.requestSchoolCode('Riverbend Baptist School', 'teacher@riverbend.example.org').ok === true && D.outbox().length === 2 && /123456/.test(D.outbox()[1].body),
  'a configured school gets a code — "emailed" to the outbox (the first email was the ops alert for Oakmont)');
ok(M.verifySchoolCode('Riverbend Baptist School', 'teacher@riverbend.example.org', '000000').code === 'CODE_INVALID', 'a wrong code is refused');
const v = M.verifySchoolCode('Riverbend Baptist School', 'teacher@riverbend.example.org', '123456');
ok(v.ok && v.schoolCode === '1000' && /^v1\.[\w-]+\.[\w-]+$/.test(v.token), 'the right code mints a signed session carrying the school code resolved server-side');
ok(eq(L.requireSchoolSession_(v.token), { email: 'teacher@riverbend.example.org', schoolCode: '1000', schoolName: 'Riverbend Baptist School' }), 'the session verifies through the real TokenLogic');
let threw = '';
try { M.submitSchoolEntries('v1.tampered.token', [], {}); } catch (e) { threw = e.message; }
ok(threw === 'AUTH_INVALID', 'a tampered token is rejected before anything is read');

// submission rules
const contact = { firstName: 'Teresa', lastName: 'Quill', phone: '410-555-0199', email: 'teacher@riverbend.example.org' };
threw = '';
try { M.submitSchoolEntries(v.token, [1, 2, 3].map(i => ({ categoryCode: 'SBM', studentName: 'S' + i, roster: [] })), contact); } catch (e) { threw = e.message; }
ok(/Bible Memory \(SBM\): 3 entered, max 2 per school/.test(threw), 'the per-school cap is enforced by category');
const r = M.submitSchoolEntries(v.token, [
  { categoryCode: 'SFVS', studentName: 'Mira Hollenbeck', title: 'Pie Jesu', authorComposer: 'Webber', accompanist: 'Mr. Tate', roster: [] },
  { categoryCode: 'SSVE', studentName: 'Riverbend Trio', title: 'Amazing Grace', roster: [{ studentName: 'Mira Hollenbeck', participatingIn: '' }, { studentName: 'Owen Pike', participatingIn: '' }] }
], contact);
ok(r.success && r.count === 2 && M.checkSchoolStatus(v.token).alreadySubmitted === true, 'a valid submission is written and the school now reads as submitted');
threw = '';
try { M.submitSchoolEntries(v.token, [{ categoryCode: 'SBM', studentName: 'X', roster: [] }], contact); } catch (e) { threw = e.message; }
ok(/already submitted/.test(threw), 'a second submission by the same school is refused');
const v2 = M.verifySchoolCode('Chesapeake Christian Academy', 'd@chesapeake.example.org', '123456');
ok(M.checkSchoolStatus(v2.token).alreadySubmitted === true, 'a school seeded at boot reads as already submitted');
threw = '';
try { M.admin_getSubmissions(); } catch (e) { threw = e.message; }
ok(/AUTH_REQUIRED/.test(threw), 'the anonymous form page cannot reach an admin endpoint');

// the admin page, same visit
({ M, L, D } = boot('admin.html', session));
const subs = M.admin_getSubmissions();
const byId = Object.fromEntries(subs.map(s => [s['Entry ID'], s]));
ok(subs.length === 26 && byId.SFVS1001 && byId.SSVE1001, 'entry ids are category code + school code + sequence (SFVS1001, SSVE1001)');
ok(byId.SFVS1001['Other Entry IDs (auto)'] === 'SSVE1001' && byId.SSVE1001['Other Entry IDs (auto)'] === 'SFVS1001',
  'a soloist who is also on a group roster is cross-referenced both ways, automatically');
ok(byId.SSVE1101['Other Entry IDs (auto)'] === 'SFVS1101, SCP1101, SMVS1101, SBM1101, SEP1101', 'the seeded ensemble cross-references all five of its members\' own entries');
ok(byId.SFVS1001.Level === 'Senior High' && byId.SFVS1001.Timestamp.length === 19 && !/T|Z/.test(byId.SFVS1001.Timestamp), 'level derives from the code and the timestamp reads as sheet text after the page change');
const regs = M.admin_getRegistrations();
ok(regs.length === 4 && regs[3].contactLast === 'Quill' && regs[0].timestamp === '2027-01-12 09:41:00', 'four registrations: three seeded (backdated) plus the one just made');
ok(M.admin_getSettings().find(s => s.key === 'Admin Emails').value === 'admin@example.edu', 'the admin allowlist is the demo address');
ok(M.admin_getJudges().length === 17 && M.admin_getSchools().length === 8 && M.admin_getBuildingMap().length === 8 && M.admin_getFieldTemplates().length === 9, 'judges, schools, rooms and templates load');
ok(M.admin_updateSubmissionEntry('SFVS1001', { Title: 'Pie Jesu (Requiem)' }).success && M.admin_getSubmissions().find(s => s['Entry ID'] === 'SFVS1001').Title === 'Pie Jesu (Requiem)', 'an admin edit lands in the sheet');
ok(M.admin_deleteSubmissionEntry('JAP1302').success && !M.admin_getSubmissions().some(s => s['Entry ID'] === 'JAP1302'), 'an admin delete removes the row');
const seeded = M.admin_runSeedHistoricalTestData();
ok(seeded.success && seeded.count === 146 && M.admin_getSchools().some(s => s.name === 'Test Christian School'), 'the seed button runs the SAFE generator: one fabricated school, every category');
ok(M.admin_runClearTestData().success && M.admin_getSubmissions().length === 25 && !M.admin_getSchools().some(s => s.name === 'Test Christian School'), 'Clear Test Data removes exactly what the seeder added');
const roll = M.admin_resetForNextYear('2027');
ok(roll.archiveName === 'Secondary — 2027 Archive' && roll.nextYear === '2028' && /^https:\/\/example\.invalid\//.test(roll.archiveUrl), 'the year-end archive runs through the real rollover over the in-memory Drive');
ok(M.admin_getSubmissions().length === 0 && M.admin_getRegistrations().length === 0 && M.admin_getSettings().find(s => s.key === 'Competition Year').value === '2028', 'competition data is cleared and the year advances');
ok(M.admin_getJudges().length === 17 && M.admin_getSchools().length === 8 && M.admin_getCategoryConfig().length === 73, 'setup tabs survive the rollover untouched');
({ M } = boot('admin.html', session));
ok(M.admin_getSubmissions().length === 0 && M.admin_getSettings().find(s => s.key === 'Competition Year').value === '2028', 'after a reload the visit\'s state is still there (sessionStorage)');
({ M } = boot('admin.html', memStorage()));
ok(M.admin_getSubmissions().length === 24, 'a new visit starts from the seed data again');

console.log('\n' + (fail ? fail + ' check(s) FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
