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
 *   5. The Spelling Bee and Creative Writing forms (two more, smaller projects, each with its own Sheet): the
 *      same privacy, sync and contract checks, then a registration round trip through each project's real code.
 *
 * Exits 0 with SKIP for the source-project checks if the project isn't checked out beside this repo.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findStaffNames } from '../../tools/staff-aliases.mjs';
import { buildLogic, SRC, buildCompetitionLogic, COMPETITIONS } from './build-logic.mjs';

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

/* ================== 5. the Spelling Bee and Creative Writing forms (two more projects) ================== */
console.log('\n  spelling bee + creative writing: privacy');
const sb = read('spelling-bee.html'), cw = read('creative-writing.html'), sbLogic = read('logic-spelling.js'), cwLogic = read('logic-writing.js'),
  compMock = read('mock-competitions.js'), sbCfg = read('build.spelling.json'), cwCfg = read('build.writing.json');
const comp = [sb, cw, sbLogic, cwLogic, compMock, sbCfg, cwCfg, read('index.html'), mockJs, dataJs].join('\n');
const compLeaks = comp.match(/AKfycb[A-Za-z0-9_-]+|docs\.google\.com|drive\.google\.com|script\.google\.com\/macros|\b1[A-Za-z0-9_-]{30,}\b/g) || [];
ok(compLeaks.length === 0, 'no deployment id, live URL, published Drive link or Drive folder id in the new pages, bundles or configs', [...new Set(compLeaks)].slice(0, 3).join(', '));
ok(!/harford\s*christian|harfordchristian/i.test(comp) && findStaffNames(comp.replace(dataJs, '')).length === 0, 'no real school name, domain or staff name');
const compEmails = [...new Set(comp.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [])];
ok(compEmails.every(e => EXAMPLE.test(e)), 'every email address is on an example.* domain', compEmails.filter(e => !EXAMPLE.test(e)).join(', '));
ok(!/data:image\/png;base64,/.test(sb + cw) && /data:image\/svg\+xml,/.test(sb) && /data:image\/svg\+xml,/.test(cw), 'both pages carry the generated badge, not the real crest');
ok(/var DEFAULT_SCHOOLS = \[\n\s*\/\/[^\n]*\n\];/.test(cwLogic) && !/^\s*\['\d{4}', '[^']+'\],?$/m.test(cwLogic) && !/DEFAULT_SCHOOLS/.test(sbLogic),
  'the real member-school roster is not shipped (Creative Writing\'s DEFAULT_SCHOOLS emptied; Bootstrap.js not vendored)');
ok(!readdirSync(HERE).some(f => /\.docx?$/i.test(f)), 'the source project\'s rules .docx is not shipped');

console.log('\n  spelling bee + creative writing: source sync');
if (!existsSync(COMPETITIONS.spelling.src) || !existsSync(COMPETITIONS.writing.src)) {
  skip('competition source projects not found — bundle drift and fresh-build checks skipped');
} else {
  ok(buildCompetitionLogic('spelling') === sbLogic, 'logic-spelling.js is the Spelling Bee project\'s Config/Code/YearRollover, verbatim after the scrubs');
  ok(buildCompetitionLogic('writing') === cwLogic, 'logic-writing.js is the Creative Writing project\'s Config/Code/YearRollover, verbatim after the scrubs');
  const tmp = mkdtempSync(path.join(tmpdir(), 'macs-verify-'));
  try {
    for (const [cfg, built] of [['build.spelling.json', sb], ['build.writing.json', cw]]) {
      const c = JSON.parse(read(cfg));
      const tmpCfg = path.join(tmp, cfg), dst = path.join(tmp, path.basename(c.dst));
      writeFileSync(tmpCfg, JSON.stringify({ ...c, src: path.resolve(ROOT, c.src), dst }));
      execFileSync(process.execPath, [path.join(ROOT, 'tools/build-demo.mjs'), tmpCfg], { cwd: ROOT, stdio: 'pipe' });
      ok(readFileSync(dst, 'utf8') === built, path.basename(c.dst) + ' is a fresh build of ' + cfg);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
ok(!/<\?[=!]?[\s\S]*?\?>/.test(sb + cw), 'no Apps Script template token in either new page');
ok(/<base target="_self">\s*<script src="logic-spelling\.js"><\/script>\s*<script src="mock-competitions\.js"><\/script>/.test(sb)
  && /<base target="_self">\s*<script src="logic-writing\.js"><\/script>\s*<script src="mock-competitions\.js"><\/script>/.test(cw),
  'each page targets _self and loads only its own project\'s bundle before the shim');
ok(/data-src="spelling-bee\.html"[^>]*>🐝 Spelling Bee</.test(switcher) && /data-src="creative-writing\.html"[^>]*>✍️ Creative Writing</.test(switcher)
  && /macs-demo-spelling-v1/.test(switcher) && /macs-demo-writing-v1/.test(switcher), 'the switcher has both new buttons and its Reset forgets their Sheets too');

console.log('\n  spelling bee + creative writing: mock contract');
const gsRunCalls = (html) => { const s = calledMethods(html); for (const m of html.matchAll(/gsRun\('(\w+)'/g)) s.add(m[1]); return [...s].sort(); };
const sbCalls = gsRunCalls(sb), cwCalls = gsRunCalls(cw);
ok(eq(sbCalls, ['checkSchoolStatus', 'getGradeGroups', 'getPaymentInfo', 'getSchoolList', 'submitRegistration']), 'the Spelling Bee page calls exactly the five methods the source does', sbCalls.join(', '));
ok(eq(cwCalls, ['checkSchoolStatus', 'getGeneralRules', 'getLevels', 'getPaymentInfo', 'getSchoolList', 'submitRegistration', 'uploadEntryFile']), 'the Creative Writing page calls exactly the seven methods the source does', cwCalls.join(', '));

function bootComp(page, bundle, sess) {
  globalThis.window = globalThis; globalThis.sessionStorage = sess; globalThis.location = { pathname: '/demos/macs/' + page };
  delete globalThis.MACS_COMPETITION; delete globalThis.MOCK_BACKEND;
  for (const f of [bundle, 'mock-competitions.js', 'data.js', 'mock.js']) new Function(readFileSync(path.join(HERE, f), 'utf8'))();
  return { M: globalThis.MOCK_BACKEND, D: globalThis.MACS_COMP_DEMO };
}
const err = (fn) => { try { fn(); return ''; } catch (e) { return e.message; } };
const sbContact = { firstName: 'Teresa', lastName: 'Quill', phone: '(410) 555-0199', email: 'teacher@riverbend.example.org' };

console.log('\n  spelling bee: behaviour (real code, in-memory Sheet)');
let sbSession = memStorage();
let { M: SM, D: SD } = bootComp('spelling-bee.html', 'logic-spelling.js', sbSession);
ok(eq(Object.keys(SM).sort(), sbCalls), 'MOCK_BACKEND implements exactly the methods the Spelling Bee page calls');
ok(eq(SM.getSchoolList().map(s => s.code), ['1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700']), 'the same eight fabricated member schools as the Secondary demo');
const groups = SM.getGradeGroups();
ok(eq(groups.map(g => g.key + ':' + g.maxStudents), ['G1:1', 'G2-3:2', 'G4-6:3', 'G7-9:3', 'G10-12:3']) && groups[0].yesNo, 'five grade groups with the project\'s caps (Grade 1 is the yes/no group)');
ok(/^MACS Fine Arts Office \(demo\), 400 Sample Road, Exampleton, MD 00000$/.test(SM.getPaymentInfo().mailingAddress) && SM.getPaymentInfo().macsPaymentPdfLink === 'sample.pdf',
  'payment info comes from Settings: a fictional mailing address and the sample fee form');
ok(SM.checkSchoolStatus('1100').alreadySubmitted && SM.checkSchoolStatus('1300').alreadySubmitted && !SM.checkSchoolStatus('1000').alreadySubmitted, 'two schools seeded at boot read as already registered; Riverbend does not');
ok(err(() => SM.submitRegistration('1000', 'Riverbend Baptist School', [{ groupKey: 'G4-6', students: ['A'] }], { ...sbContact, phone: '' })) === 'Sponsor name, phone, and email are required.', 'a missing sponsor field is refused with the app\'s message');
ok(err(() => SM.submitRegistration('1000', 'Riverbend Baptist School', [{ groupKey: 'G4-6', students: ['  ', ''] }], sbContact)) === 'At least one student must be entered.', 'blank student names do not count — no students is refused');
ok(err(() => SM.submitRegistration('1000', 'Riverbend Baptist School', [{ groupKey: 'G2-3', students: ['A', 'B', 'C'] }], sbContact)) === 'Too many students entered for G2-3 — max is 2.', 'the per-group cap is enforced server-side');
const sbR = SM.submitRegistration('1000', 'Riverbend Baptist School', [{ groupKey: 'G1', students: ['Juniper Hale'] }, { groupKey: 'G4-6', students: ['Rowan Pike', 'Esme Tate'] }], sbContact);
const sbRows = SD.workbook.getSheetByName('Students').values.filter(r => r[2] === '1000').map(r => r[0] + ' ' + r[5]);
ok(sbR.success && sbR.count === 3 && eq(sbRows, ['G1-1000-1 Juniper Hale', 'G4-6-1000-1 Rowan Pike', 'G4-6-1000-2 Esme Tate']), 'a valid registration writes one Students row per name, ids group + school + sequence');
ok(SM.checkSchoolStatus('1000').alreadySubmitted && /already submitted/.test(err(() => SM.submitRegistration('1000', 'Riverbend Baptist School', [{ groupKey: 'G1', students: ['X'] }], sbContact))),
  'Riverbend now reads as registered and a second registration is refused');
const capRow = SD.workbook.getSheetByName('Settings').values.find(r => r[0] === 'Max Students (Grades 2-3)');
capRow[1] = 4;
ok(SM.getGradeGroups().find(g => g.key === 'G2-3').maxStudents === 4, 'an admin raising "Max Students (Grades 2-3)" in Settings raises the cap the form offers');
({ M: SM, D: SD } = bootComp('spelling-bee.html', 'logic-spelling.js', sbSession));
ok(SM.checkSchoolStatus('1000').alreadySubmitted && SD.workbook.getSheetByName('Students').values.length === 14, 'after a reload the visit\'s registration is still there (sessionStorage)');
const sbRoll = globalThis.MACS_SPELLING_LOGIC.resetForNextYear_('2026');
ok(sbRoll.archiveName === 'Spelling Bee — 2026 Archive' && sbRoll.nextYear === '2027' && SD.workbook.getSheetByName('Students').values.length === 1
  && SM.getSchoolList().length === 8 && globalThis.MACS_SPELLING_LOGIC.getSettingsMap_()['Competition Year'] === '2027', 'the Sheet-menu year rollover archives, clears the registrations and keeps the schools');
({ M: SM } = bootComp('spelling-bee.html', 'logic-spelling.js', memStorage()));
ok(!SM.checkSchoolStatus('1000').alreadySubmitted && SM.checkSchoolStatus('1100').alreadySubmitted, 'a new visit starts from the seed data again');

console.log('\n  creative writing: behaviour (real code, in-memory Sheet and Drive)');
let cwSession = memStorage();
let { M: CM, D: CD } = bootComp('creative-writing.html', 'logic-writing.js', cwSession);
ok(eq(Object.keys(CM).sort(), cwCalls), 'MOCK_BACKEND implements exactly the methods the Creative Writing page calls');
const lv = CM.getLevels();
ok(eq(lv.map(l => l.key + ':' + l.categories.map(c => c.name).join('/')), ['L1A:Poetry/Short Story', 'L1B:Poetry/Short Story', 'L2:Poetry/Short Story', 'L3:Poetry/Essay'])
  && lv.every(l => l.categories.every(c => c.judgingSheetUrl === 'sample.pdf')) && CM.getGeneralRules().length === 8,
  'four levels and their categories are the project\'s own; judging-sheet links come from the Judging Sheets tab');
ok(/Exampleton, MD 00000/.test(CM.getPaymentInfo().mailingAddress), 'the Payment Mailing Address setting is fictional');
ok(CM.checkSchoolStatus('1200').alreadySubmitted && !CM.checkSchoolStatus('1000').alreadySubmitted, 'Harbor Light (seeded at boot) reads as registered; Riverbend does not');
const goodPdf = Buffer.from('%PDF-1.4\n% verify\n').toString('base64');
ok(/Only PDF files are accepted/.test(err(() => CM.uploadEntryFile(goodPdf, 'a.docx', 'application/msword', 'Riverbend Baptist School', 'L2', 'Poetry', 'entry')))
  && /is not a valid PDF file/.test(err(() => CM.uploadEntryFile(Buffer.from('hello').toString('base64'), 'a.pdf', 'application/pdf', 'Riverbend Baptist School', 'L2', 'Poetry', 'entry'))),
  'uploads are refused unless the type AND the %PDF- header say PDF');
const up1 = CM.uploadEntryFile(goodPdf, 'poem.pdf', 'application/pdf', 'Riverbend Baptist School', 'L2', 'Poetry', 'entry');
const up2 = CM.uploadEntryFile(goodPdf, 'poem-judge.pdf', 'application/pdf', 'Riverbend Baptist School', 'L2', 'Poetry', 'judging-sheet');
ok(/^https:\/\/example\.invalid\/drive\/.+entry_poem\.pdf$/.test(up1.url) && up2.name === 'judging-sheet_poem-judge.pdf', 'a real PDF lands in the in-memory Drive and returns a link');
const cwContact = { firstName: 'Teresa', lastName: 'Quill', phone: '(410) 555-0199', email: 'teacher@riverbend.example.org' };
const ent = (o) => ({ levelKey: 'L2', category: 'Poetry', studentFirst: 'Juniper', studentLast: 'Hale', title: 'Salt and Stars', entryUrl: up1.url, judgingSheetUrl: up2.url, ...o });
ok(err(() => CM.submitRegistration('1000', 'Riverbend Baptist School', cwContact, false, ['L2'], [ent()])) === 'You must certify that you have read the MACS Creative Writing General Rules.', 'the rules certification is required');
ok(err(() => CM.submitRegistration('1000', 'Riverbend Baptist School', cwContact, true, ['L2'], [])) === 'At least one entry must be provided.', 'no entries is refused');
ok(/Only one entry per category per level/.test(err(() => CM.submitRegistration('1000', 'Riverbend Baptist School', cwContact, true, ['L2'], [ent(), ent({ studentFirst: 'Rowan' })]))), 'two entries in one category and level are refused');
ok(/Unknown category "Essay" for Level II/.test(err(() => CM.submitRegistration('1000', 'Riverbend Baptist School', cwContact, true, ['L2'], [ent({ category: 'Essay' })]))), 'a category the level does not offer is refused');
ok(/Every entry needs a student name, title, entry PDF, and judging sheet PDF/.test(err(() => CM.submitRegistration('1000', 'Riverbend Baptist School', cwContact, true, ['L2'], [ent({ title: '' })]))), 'an entry missing its title is refused');
const cwR = CM.submitRegistration('1000', 'Riverbend Baptist School', cwContact, true, ['L2', 'L3'], [ent(), ent({ levelKey: 'L3', category: 'Essay', studentFirst: 'Rowan', studentLast: 'Pike', title: 'On Harbors' })]);
const cwRows = CD.workbook.getSheetByName('Entries').values.filter(r => r[2] === '1000');
const cwReg = CD.workbook.getSheetByName('Registrations').values.find(r => r[1] === '1000');
ok(cwR.success && cwR.count === 2 && eq(cwRows.map(r => r[0]), ['L2-1000-1', 'L3-1000-2']) && cwRows[0][9] === up1.url && cwReg[7] === 'L2, L3' && cwReg[8] === 'TRUE',
  'a valid registration writes the entries (with their PDF links) and the levels + certification');
ok(CM.checkSchoolStatus('1000').alreadySubmitted && /already submitted/.test(err(() => CM.submitRegistration('1000', 'Riverbend Baptist School', cwContact, true, ['L2'], [ent()]))), 'a second registration by the same school is refused');
({ M: CM, D: CD } = bootComp('creative-writing.html', 'logic-writing.js', cwSession));
ok(CM.checkSchoolStatus('1000').alreadySubmitted && CD.workbook.getSheetByName('Entries').values.length === 6, 'after a reload the visit\'s registration is still there (sessionStorage)');
({ M: CM } = bootComp('creative-writing.html', 'logic-writing.js', memStorage()));
ok(!CM.checkSchoolStatus('1000').alreadySubmitted, 'a new visit starts from the seed data again');

// the Secondary pages are untouched by the competition hook
delete globalThis.MACS_COMPETITION;
({ M } = boot('form.html', memStorage()));
ok(typeof M.verifySchoolCode === 'function' && !M.getGradeGroups && M.getCategoryList().length === 73, 'the Secondary form still gets its own backend when the hook is absent');

console.log('\n' + (fail ? fail + ' check(s) FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
