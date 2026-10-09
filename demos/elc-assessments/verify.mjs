// Verifies the ELC Student Assessments demo by running it the way the browser does — data.js, the vendored
// server (logic.js) and mock.js in one context — and driving it through the same google.script.run surface
// the page uses:
//   - logic.js must be the source project's server, verbatim after the scrubs (build-logic.mjs), and app.html a
//     fresh build of build.json; the historical-score importer must never be in the bundle;
//   - every call('…') the page makes is served by the mock, and every mock method is a vendored server function;
//   - the access model per persona, the teacher's grade scope, the concern -> score -> fulfil round trip, and
//     that a DIBELS session's tiers are exactly what the app's own scoreAssessmentSession produces;
//   - the built page parses, its literal getElementById ids exist, and nothing real ships (names in the hashed
//     table, staff names, the domain, the school's address, the embedded crest).
//
// Run from the repo root: node demos/elc-assessments/verify.mjs
// Requires the source project alongside this repo: Projects/elc/elc-student-assessments/
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { buildLogic, SRC, NOT_VENDORED, nameAliases } from './build-logic.mjs';
import { findPhrases, findStaffNames, PHRASE_ALIASES } from '../../tools/staff-aliases.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
if (!existsSync(SRC)) { console.log('SKIP — source project not found next to this repo'); process.exit(0); }
const lf = (s) => s.replace(/\r\n?/g, '\n');

let fail = 0, count = 0;
const check = (label, cond, extra) => {
  count++;
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label + (!cond && extra ? '\n        ' + extra : ''));
  if (!cond) fail++;
};
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

/* ---------- boot ---------- */
function makeSession() { const s = {}; return { s, getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; } }; }
function boot(session, search) {
  const ctx = { Date, Math, JSON, Object, Array, String, Number, RegExp, Error, Promise, parseInt, parseFloat, isNaN, isFinite, URLSearchParams, setTimeout,
    console: { log() {}, warn() {}, error() {}, info() {} } };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.sessionStorage = session || makeSession();
  ctx.location = { search: search || '', href: 'http://demo/app.html' + (search || ''), reload() {} };
  vm.createContext(ctx);
  for (const f of ['data.js', 'logic.js', 'mock.js']) vm.runInContext(lf(readFileSync(HERE + f, 'utf8')), ctx, { filename: f });
  return { S: ctx, M: ctx.MOCK_BACKEND, L: ctx.ELC_LOGIC, D: ctx.ELC_DATA, X: ctx.ELC_DEMO };
}
const session = makeSession();
const elc = boot(session, '?as=elc');
const { M, L, D, X } = elc;
const plain = (x) => JSON.parse(JSON.stringify(x));

/* ---------- vendoring and build ---------- */
const logicJs = readFileSync(HERE + 'logic.js', 'utf8');
check('logic.js is the source project\'s server, verbatim after the scrubs (run build-logic.mjs)', buildLogic() === logicJs);
const importerFns = [...lf(readFileSync(path.join(SRC, NOT_VENDORED[0]), 'utf8')).matchAll(/^function\s+(\w+)\s*\(/gm)].map((m) => m[1]);
check('the historical-score importer (' + NOT_VENDORED[0] + ') is not in the bundle', importerFns.length > 0 && importerFns.every((n) => !logicJs.includes(n)));
check('the bundle binds Google, Date and console by name and exposes the server', typeof L.bind === 'function' && typeof L.newExecution === 'function' &&
  typeof L.submitSession === 'function' && typeof L.scoreAssessmentSession === 'function' && Object.keys(L.SHEET_SCHEMAS).length === 15);

const html = readFileSync(HERE + 'app.html', 'utf8');
const pageCalls = [...new Set([...html.matchAll(/\bcall\(\s*['"]([A-Za-z0-9_]+)['"]/g)].map((m) => m[1]))].sort();
const served = Object.keys(M).sort();
check('every call(\'…\') the page makes is served, and the mock serves nothing else (' + pageCalls.length + ' methods)',
  pageCalls.length >= 70 && JSON.stringify(pageCalls) === JSON.stringify(served),
  'unserved: ' + pageCalls.filter((n) => !M[n]).join(', ') + ' | extra: ' + served.filter((n) => !pageCalls.includes(n)).join(', '));
check('every mock method is a vendored server function', served.every((n) => typeof L[n] === 'function'));
check('the page reaches the server only through call(), which wraps google.script.run', (html.match(/google\.script\.run/g) || []).length >= 1 &&
  /function call\(fn\)[\s\S]{0,200}google\.script\.run[\s\S]{0,120}\[fn\]\.apply/.test(html));

const tmp = mkdtempSync(path.join(tmpdir(), 'elc-verify-'));
try {
  const cfg = JSON.parse(readFileSync(HERE + 'build.json', 'utf8'));
  cfg.dst = path.join(tmp, 'app.html');
  writeFileSync(path.join(tmp, 'build.json'), JSON.stringify(cfg));
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build-demo.mjs'), path.join(tmp, 'build.json')], { cwd: ROOT, stdio: 'pipe' });
  check('app.html is a fresh build of build.json (run tools/build-demo.mjs)', readFileSync(cfg.dst, 'utf8') === html);
} finally { rmSync(tmp, { recursive: true, force: true }); }
check('logic.js loads in <head> before the shim, data and mock', (() => {
  const i = html.indexOf('<script src="logic.js">'), s = html.indexOf('gsr-shim.js'), d = html.indexOf('src="data.js"'), m = html.indexOf('src="mock.js"');
  return i > 0 && i < s && s < d && d < m && m < html.indexOf('</head>');
})());

/* ---------- the page itself ---------- */
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
check('every inline page script parses', scripts.length >= 1 && scripts.every((s) => { try { new vm.Script(s); return true; } catch (e) { return false; } }));
const ids = [...new Set([...html.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]))];
// Declared in the page or in a script-built HTML string — or, on the Staff Access form, built as
// idPrefix + '-suffix' with the prefix passed as a literal ('sa-new' / 'sa-edit').
const declared = (id) => new RegExp('id=\\\\?["\']' + id + '\\\\?["\']|\\.id\\s*=\\s*[\'"]' + id + '[\'"]').test(html) ||
  (() => { const i = id.lastIndexOf('-'); return i > 0 && html.includes("idPrefix + '" + id.slice(i) + '"') && html.includes("'" + id.slice(0, i) + "'"); })();
const missingIds = ids.filter((id) => !declared(id));
check('every literal getElementById id exists in the page or the HTML its scripts build (' + ids.length + ' ids)', ids.length > 50 && missingIds.length === 0,
  'missing: ' + missingIds.join(', '));
check('the page clock reads go through the pinned demo clock (request age, form date/year/season, print stamps)',
  (html.match(/window\.ELC_DEMO_NOW \? window\.ELC_DEMO_NOW\(\) : new Date\(\)/g) || []).length === 7 && !/var d = new Date\(\);/.test(html));

/* ---------- the dataset and the replayed history ---------- */
const S = (name) => X.tabs[name].v;
check('40 fabricated students, ids 5001xx, every grade K-6, 22 on the ELC caseload',
  D.students.length === 40 && D.students.every((s) => /^5001\d\d$/.test(s[0])) && new Set(D.students.map((s) => s[3])).size === 7 &&
  D.students.filter((s) => s[4]).length === 22 && S('Students').length === 41);
check('every staff address is @example.edu, and every request / goal / accommodation / 504 row names a real demo student',
  D.staffAccess.every((r) => /@example\.edu$/.test(r[0])) && D.teachers.every((t) => /@example\.edu$/.test(t[3])) &&
  [...D.requests.map((r) => r.student_id), ...D.iepGoals.map((g) => g.student_id), ...D.accommodations.map((a) => a[0]), ...D.section504.map((p) => p.student_id)]
    .every((id) => D.students.some((s) => s[0] === id)));
check('all ' + D.seedSessions.length + ' history sessions were saved through submitSession, with result rows',
  S('Assessment_Sessions').length - 1 === D.seedSessions.length && S('Assessment_Results').length - 1 > D.seedSessions.length * 2);
check('no seeded date falls on the 1st of a month', D.seedSessions.every((s) => !/-01$/.test(s.date)));
const results = L.readAllRows_('Assessment_Results');
const compositeTiers = new Set(results.filter((r) => r.measure_id === 'composite').map((r) => r.benchmark_tier));
check('the replayed DIBELS composites span all four tiers (Blue, Green, Yellow, Red)', ['Blue', 'Green', 'Yellow', 'Red'].every((t) => compositeTiers.has(t)),
  [...compositeTiers].join(','));
check('the other instruments score too: Mastery, Strategic and Intensive all occur', ['Mastery', 'Strategic', 'Intensive'].every((t) => results.some((r) => r.benchmark_tier === t)));
const seasons = new Set(L.readAllRows_('Assessment_Sessions').map((s) => s.school_year + ' ' + s.season));
check('history covers last year\'s Fall, Winter and Spring windows and this Fall',
  ['2025-2026 Fall', '2025-2026 Winter', '2025-2026 Spring', '2026-2027 Fall'].every((k) => seasons.has(k)));
check('the server\'s clock is pinned: Tuesday 13 October 2026, school year 2026-2027, Fall',
  L.currentSchoolYear_() === '2026-2027' && L.seasonForDate_(new X.DemoDate()) === 'Fall' && new X.DemoDate().getDay() === 2 &&
  new X.DemoDate().getDate() === 13 && new X.DemoDate().getMonth() === 9);
const sess = L.readAllRows_('Assessment_Sessions');
check('administration dates are stored as the local day typed, as Sheets does (no UTC-midnight drift)',
  D.seedSessions.every((s, i) => { const d = sess[i].administration_date; return d instanceof X.DemoDate && d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') === s.date; }));

/* ---------- access, per persona ---------- */
const teacher = boot(session, '?as=teacher');
const admin = boot(session, '?as=admin');
const t4 = boot(session, '?as=teacher4');
const accE = M.getMyAccess(), accA = admin.M.getMyAccess(), accT = teacher.M.getMyAccess();
check('getMyAccess: ELC Staff is unrestricted ELC staff', accE.is_elc_staff === true && accE.unrestricted === true && accE.is_administrator === false && accE.email === D.personas.elc.email);
check('getMyAccess: the principal is Administrator', accA.is_administrator === true && accA.unrestricted === true);
check('getMyAccess: the 2nd-grade teacher is grade-scoped, not unrestricted, and still gets a Dashboard', accT.unrestricted === false && accT.is_administrator === false &&
  accT.is_elc_staff === false && accT.has_grade_scope === true);
D.personas.stranger = { email: 'stranger@example.edu' };
check('an address not on Staff_Access is refused', throws(() => X.asUser('stranger', () => M.getMyAccess()), /Not authorized/));
delete D.personas.stranger;
const rosterE = M.getRoster(), rosterT = teacher.M.getRoster(), rosterT4 = t4.M.getRoster();
check('the roster is scoped by grade: ELC sees all 40, the 2nd-grade teacher only her 6, the 4th-grade teacher only his 6',
  rosterE.length === 40 && rosterT.length === 6 && rosterT.every((s) => s.grade === '2') && rosterT4.length === 6 && rosterT4.every((s) => s.grade === '4'));
check('the roster carries first name + last initial only (the app\'s PII minimisation)', rosterE.every((s) => s.last_initial && s.last_initial.length === 1 && !('last_name' in s)));
check('a teacher cannot open a student outside her grade', throws(() => teacher.M.getStudentProfileBundle('500124'), /not found|scope|authori/i));
check('only Administrator / ELC Staff may edit a 504 plan', throws(() => teacher.M.saveSection504Plan('500112', { diagnosis: 'x' }), /Administrator or ELC Staff/));
check('Staff Access is Administrator-only', throws(() => M.getStaffAccessBundle(), /Administrator/) && admin.M.getStaffAccessBundle().staffAccessList.length === 5);

/* ---------- concern -> score -> fulfil, through the real endpoints ---------- */
const KID = '500116';     // a 2nd grader with no history yet
const bucketOf = (bundle, id) => {
  for (const g of bundle.dashboard.grades) for (const [b, list] of Object.entries(g.students_by_bucket || {})) if (list.some((s) => s.student_id === id)) return b;
  return null;
};
const dashBefore = M.getDashboardBundle('', '');
const profileBefore = M.getStudentProfileBundle(KID);
check('before: the student has no history and sits in not_assessed', bucketOf(dashBefore, KID) === 'not_assessed' && (profileBefore.history.sessions || []).length === 0,
  bucketOf(dashBefore, KID));
const pendingBefore = M.getPendingRequests().length;
const outboxBefore = X.outbox.length;
// The teacher files it in the same page context (in the browser the persona switch reloads the page, which reads
// the visit's sessionStorage; here one context and asUser keep the tables shared).
const req = X.asUser('teacher', () => M.createAssessmentRequest({ student_id: KID, concern_areas: ['Phonics', 'Reading'], note: 'Cannot blend sounds in CVC words; decoding is the concern.' }));
const pending = M.getPendingRequests();
const mine = pending.find((r) => r.request_id === req.request_id);
check('the teacher\'s concern lands in ELC\'s Pending Requests, attributed to her, with a suggested instrument',
  mine && mine.requested_by === D.personas.teacher.email && pending.length === pendingBefore + 1 && mine.student_first_name === 'Desmond' &&
  mine.suggested_assessment_type === 'core_phonics', JSON.stringify(mine));
check('filing it sent the new-request notification to the outbox (mail is never really sent)', X.outbox.length > outboxBefore);
check('the teacher sees only her grade\'s open requests', X.asUser('teacher', () => M.getPendingRequests()).every((r) => r.student_grade === '2'));

const input = { grade: '2', season: 'Fall', entries: [{ measure: 'NWF_CLS', rawScore: 24 }, { measure: 'NWF_WRC', rawScore: 6 }, { measure: 'WRF', rawScore: 11 },
  { measure: 'ORF_WORDS', rawScore: 18 }], orfErrors: 4, mazeCorrect: 3, mazeIncorrect: 2 };
const payload = { student_id: KID, assessment_type: 'dibels', administration_date: '2026-10-13', school_year: '2026-2027', grade_at_admin: '2', season: 'Fall',
  notes: '', administrator_role: 'ELC Staff', input: plain(input), fulfilling_request_id: req.request_id, test_grade_level: '' };
const preview = M.previewDibelsComposite('2', 'Fall', { NWF_CLS: 24, NWF_WRC: 6, WRF: 11, ORF_WORDS: 18, ORF_ACCURACY: Math.round(18 / 22 * 10000) / 100, MAZE: 2 }, '2026-10-13');
const saved = M.submitSession(plain(payload));
const direct = plain(L.scoreAssessmentSession('dibels', Object.assign(plain(input), { administrationDate: '2026-10-13' })));
const tiers = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [v.raw_score, v.benchmark_tier]]));
check('a grade-2 Fall DIBELS session saves, and its tiers are exactly scoreAssessmentSession\'s on the same input',
  saved.session_id && JSON.stringify(tiers(saved.measures)) === JSON.stringify(tiers(direct.measures)) && saved.measures.composite.raw_score !== null,
  JSON.stringify(tiers(saved.measures)));
check('previewDibelsComposite shows the same composite and tier before saving', preview.composite === saved.measures.composite.raw_score &&
  preview.tier === saved.measures.composite.benchmark_tier, JSON.stringify(preview) + ' vs ' + JSON.stringify(saved.measures.composite));
check('ORF Accuracy and Maze are derived from the raw counts, not typed', saved.measures.orf_accuracy.raw_score === Math.round(18 / 22 * 10000) / 100 &&
  saved.measures.maze.raw_score === 2);
const reqsAfter = M.getStudentProfileBundle(KID).requests;
check('the session fulfils the request: off the pending queue, completed and linked to the session',
  !M.getPendingRequests().some((r) => r.request_id === req.request_id) &&
  reqsAfter.some((r) => r.request_id === req.request_id && r.status === 'completed' && r.fulfilled_session_id === saved.session_id), JSON.stringify(reqsAfter));
const profileAfter = M.getStudentProfileBundle(KID);
check('the student profile now carries the session and its composite', JSON.stringify(profileAfter) !== JSON.stringify(profileBefore) &&
  JSON.stringify(profileAfter.history).includes(saved.session_id));
const dashAfter = M.getDashboardBundle('', '');
const expectBucket = { Red: 'at_risk', Yellow: 'some_risk', Green: 'on_track', Blue: 'on_track' }[saved.measures.composite.benchmark_tier];
check('the Dashboard moves the student from not_assessed to ' + expectBucket + ' (composite ' + saved.measures.composite.benchmark_tier + ')',
  bucketOf(dashAfter, KID) === expectBucket, bucketOf(dashAfter, KID));
const dup = M.submitSession(plain(Object.assign({}, payload, { fulfilling_request_id: null })));
check('entering the same screening again warns instead of saving a duplicate', dup.duplicate_warning === true && dup.existing_session.session_id === saved.session_id &&
  L.readAllRows_('Assessment_Sessions').filter((s) => s.student_id === KID).length === 1);
const gm = M.submitSession(plain(Object.assign({}, payload, { school_year: '2025-2026', season: 'Spring', fulfilling_request_id: null })));
check('a grade that does not fit the school year warns (2nd grade now means 1st grade last year)', gm.grade_year_mismatch_warning === true && gm.expected_grade === '1');
const partial = M.submitSession(plain(Object.assign({}, payload, { season: 'Winter', fulfilling_request_id: null, input: { grade: '2', season: 'Winter', entries: [{ measure: 'WRF', rawScore: 20 }] } })));
check('a DIBELS session missing composite measures warns before saving', partial.composite_incomplete_warning === true && partial.missing_measures.length >= 3);

/* ---------- persistence ---------- */
const again = boot(session, '?as=elc');
check('writes persist for the visit: a new page load (another persona switch) sees the new session and the closed request',
  again.L.readAllRows_('Assessment_Sessions').length === D.seedSessions.length + 1 && !again.M.getPendingRequests().some((r) => r.request_id === req.request_id));
const fresh = boot(session, '?as=elc&reset=1');
check('?reset=1 (the wrapper\'s Reset) replays the sample history from scratch',
  fresh.L.readAllRows_('Assessment_Sessions').length === D.seedSessions.length && fresh.M.getPendingRequests().length === 3);

/* ---------- privacy ---------- */
const table = Object.assign({}, PHRASE_ALIASES, nameAliases());
const h = (w) => createHash('sha256').update(w.toLowerCase()).digest('hex').slice(0, 16);
const camelPieces = (text) => [...text.matchAll(/[A-Za-z][a-z]*[A-Z][A-Za-z]*/g)].flatMap((m) => m[0].split(/(?=[A-Z])/)).filter((p) => p.length > 2);
const SHIP = { 'app.html': html, 'logic.js': logicJs, 'mock.js': readFileSync(HERE + 'mock.js', 'utf8'), 'index.html': readFileSync(HERE + 'index.html', 'utf8') };
for (const [f, text] of Object.entries(SHIP)) {
  check(f + ': no name from the hashed table (whole words, phrases, or inside a camelCase identifier)',
    findPhrases(text, table).length === 0 && camelPieces(text).every((p) => table[h(p)] === undefined));
  check(f + ': no real staff first name', findStaffNames(text.replace(/\b[A-Z][a-z]+\s+(?=[A-Z][a-z])/g, '')).length === 0);
  const DOMAIN = 'harford' + 'christian';
  check(f + ': no real domain, school name or street address', !new RegExp(DOMAIN, 'i').test(text) && !new RegExp('harford\\s+christian', 'i').test(text) &&
    !/whiteford|darlington|21034/i.test(text));
  check(f + ': no deployment URL or Drive id', !/AKfycb|script\.google\.com\/macros\/s\//.test(text) && !/[\s"'/=(]1[A-Za-z0-9_-]{40,}/.test(text));
}
check('the embedded 400 KB crest is gone: no base64 image anywhere in the page, the letterhead uses the generated badge',
  !/base64,[A-Za-z0-9+/=]{200,}/.test(html) && /var HCS_LOGO_BASE64_ = 'data:image\/svg\+xml,/.test(html) && html.length < 700000);
const studentIdLike = [...html.matchAll(/(?<!#)\b\d{6}\b/g)].map((m) => m[0]);
check('the page carries no student id (all ids come from data.js at run time)', studentIdLike.every((n) => !/^\d{6}$/.test(n) || /^0/.test(n)) || studentIdLike.length === 0,
  [...new Set(studentIdLike)].slice(0, 10).join(','));

console.log('\n' + (fail ? fail + ' FAILED' : 'all ' + count + ' checks passed'));
process.exit(fail ? 1 : 0);
