// Verifies the Onboarding Tracker demo. Run from the showcase repo root: node demos/onboarding-tracker/verify.mjs
//
// What this owns: nothing real is published (checked against the source's own constants, read here so this file
// never spells them), logic.js is Code.js verbatim after the scrubs, dashboard.html is a fresh build, the sheet
// is the layout Code.js documents, every checklist key the page reads is one the server produces, the fabricated
// emails parse cleanly through the real parser, and the sync and the four endpoints behave as the app does.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { buildLogic, documentedHeaders, source, SRC } from './build-logic.mjs';
import { findStaffNames } from '../../tools/staff-aliases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let fail = 0;
const check = (label, ok, why) => { console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (ok || !why ? '' : '\n        ' + why)); if (!ok) fail++; };
const lf = (s) => s.replace(/\r\n?/g, '\n');
const read = (f) => lf(readFileSync(path.join(HERE, f), 'utf8'));
const FILES = readdirSync(HERE).filter((f) => /\.(html|js|json)$/.test(f));

/* ---------------------------------------------------------------- 1. privacy */
console.log('\n  privacy');
const blob = FILES.map(read).join('\n'), code = source();
const realConsts = [...code.matchAll(/^const (SPREADSHEET_ID|DASHBOARD_URL|SCHOOL_DOMAIN)\s*=\s*'([^']+)'/gm)].map((m) => m[2]);
check('found the source\'s three real constants to compare against', realConsts.length === 3);
check('none of them (the sheet id, the deployment URL, the domain) is in the demo', realConsts.every((s) => !blob.includes(s)));
check('no real domain, deployment id or Drive id', !/harford\s*christian/i.test(blob.replace(/HCS Onboarding Dashboard/g, '')) &&
  !/AKfycb|script\.google\.com\/macros/.test(blob) && !/[\s"'/=(]1[A-Za-z0-9_-]{40,}/.test(blob));
const named = FILES.filter((f) => f !== 'data.js').filter((f) => findStaffNames(read(f).replace(/\b[A-Z][a-z]+\s+(?=[A-Z][a-z])/g, '')).length);
check('no real staff first names outside the fabricated data (hash-matched)', named.length === 0, named.join(', '));
check('the fabricated contact details are fake: 555 phone numbers, example / .invalid addresses only',
  [...blob.matchAll(/\b\d{3}-\d{3}-\d{4}\b/g)].every((m) => /-555-01\d\d$/.test(m[0])) &&
  [...blob.matchAll(/[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi)].every((m) => /@(mail\.)?example\.(edu|com)$|\.invalid$/.test(m[0])));

/* ---------------------------------------------------------------- 2. vendoring and the build */
console.log('\n  vendoring and the build');
check('logic.js is Code.js\'s named declarations verbatim after the scrubs (run build-logic.mjs)', buildLogic() === read('logic.js'));
const page = read('dashboard.html');
try {
  const cfg = JSON.parse(read('build.json'));
  mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
  const tmpCfg = path.join(ROOT, '.tmp/verify-onboarding.json'), tmpOut = path.join(ROOT, '.tmp/verify-onboarding.html');
  writeFileSync(tmpCfg, JSON.stringify({ ...cfg, dst: tmpOut }));
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build-demo.mjs'), tmpCfg], { cwd: ROOT, stdio: 'pipe' });
  check('dashboard.html is what build-demo.mjs produces from the current source (not stale)', lf(readFileSync(tmpOut, 'utf8')) === page,
    'rebuild: node tools/build-demo.mjs demos/onboarding-tracker/build.json');
} catch (e) { check('dashboard.html could be rebuilt from build.json', false, e.message); }
check('dashboard.html loads logic.js before the shim, data and mock, and has no template tokens',
  !/<\?[=!]?[\s\S]*?\?>/.test(page) && page.indexOf('src="logic.js"') < page.indexOf('gsr-shim.js') &&
  page.indexOf('gsr-shim.js') < page.indexOf('src="data.js"') && page.indexOf('src="data.js"') < page.indexOf('src="mock.js"'));
const calls = [...new Set([...page.matchAll(/\.\s*(getDashboardData|updateChecklistItem|manualOverrideStatus|addManualOnboardingRequest)\(/g)].map((m) => m[1]))].sort();
const gsr = (page.match(/google\.script\.run/g) || []).length;
check('the page calls exactly the four server methods (' + calls.join(', ') + ')', calls.length === 4 && gsr === 4);
for (const f of ['index.html', 'inbox.html', 'dashboard.html']) {
  const blocks = [...read(f).matchAll(/<script>([\s\S]*?)<\/script>/g)];
  let ok = blocks.length > 0, why = '';
  for (const b of blocks) { try { new Function(b[1]); } catch (e) { ok = false; why = e.message; } }
  check(f + ': every inline script parses', ok, why);
}

/* ---------------------------------------------------------------- 3. the sheet and the page agree */
console.log('\n  the sheet and the page');
function memStorage() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }
function boot(storage) {
  const ctx = { console, JSON, Math };
  ctx.window = ctx; ctx.sessionStorage = storage;
  vm.createContext(ctx);
  for (const f of ['logic.js', 'data.js', 'mock.js']) vm.runInContext(read(f), ctx, { filename: f });
  return { O: ctx.ONBOARD_DEMO, B: ctx.MOCK_BACKEND, L: ctx.ONBOARD_LOGIC, D: ctx.ONBOARD_DATA, ctx };
}
const store = memStorage();
let { O, B, L, D } = boot(store);
const docHeaders = documentedHeaders();
check('the demo sheet\'s header row is the layout Code.js documents (columns A–Y)', JSON.stringify(O.headers) === JSON.stringify(docHeaders) && docHeaders.length === 25);
check('and COLS agrees with it (Last Updated in X, Initial Entry Date in Y)', docHeaders[L.COLS.LAST_UPDATED - 1] === 'Last Updated' && docHeaders[L.COLS.INITIAL_ENTRY - 1] === 'Initial Entry Date');
const keyOf = (h) => h.replace(/\s+/g, '_').replace(/[?:\/]/g, '').replace(/-/g, '_');          // getDashboardData's rule
const made = docHeaders.map(keyOf);
const pageKeys = [...(/function colToKey[\s\S]*?\{([\s\S]*?)\};/.exec(page) || [])[1].matchAll(/[A-W]:\s*'([^']+)'/g)].map((m) => m[1]);
check('every checklist key the page reads is a key getDashboardData produces (no item that can never read as ticked)',
  pageKeys.length === 11 && pageKeys.every((k) => made.includes(k)), pageKeys.filter((k) => !made.includes(k)).join(', '));
const srcPage = lf(readFileSync(path.join(SRC, 'Index.html'), 'utf8'));
check('the two demo-only key fixes are still needed (the source page still expects keys no header can produce)',
  /IT_Assign_Equipment_laptop_etc/.test(srcPage) && /HR_I9_Verification/.test(srcPage),
  'the source is fixed: remove the two colToKey replacements from build.json');

/* ---------------------------------------------------------------- 4. behaviour, through the real code */
console.log('\n  behaviour (the app\'s own Code.js over the in-memory sheet and mailbox)');
const reqs = D.emails.filter((e) => /Approval Requested/.test(e.subject));
const parsed = reqs.map((e) => {
  const body = e.html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s\s+/g, ' ').trim();
  return L.parseOnboardingEmail(body, e.html, e.subject);
});
check('every fabricated request email parses cleanly through the real parser (no field left as ---)',
  parsed.length === 7 && parsed.every((p) => Object.values(p).every((v) => v !== '---')),
  JSON.stringify(parsed.filter((p) => Object.values(p).some((v) => v === '---'))));
check('and each parsed name and role is exactly what the email says', parsed.every((p, i) => {
  const who = D.people.filter((x) => x.id === /Approval-(\d+)/.exec(reqs[i].subject)[1])[0];
  return p.firstName === who.first && p.lastName === who.last && p.role === who.role && p.department === who.dept;
}));
const rows = () => B.getDashboardData();
const row = (id) => rows().filter((r) => r.Approval_ID === id)[0];
const done = (r) => ['IT_Create_Google_Account', 'IT_Assign_Equipment', 'IT_Create_IDBadge_Access', 'HR_Offer_Letter_Signed', 'HR_I_9_Verification',
  'HR_Direct_Deposit_Setup', 'HR_Handbook_Acknowledged', 'HR_Orientation_Scheduled', 'HR_Emergency_Contacts_Collected', 'HR_Benefits_Enrollment',
  'HR_IDBadge_Issued'].filter((k) => r[k] === '✅').length;
check('the replayed history: seven records, statuses from the real subject rules (approved, revoked → Rejected, else Pending)',
  rows().map((r) => r.Approval_ID + ':' + r.Status).join(' ') === '10401:Approved 10409:Approved 10414:Rejected 10418:Pending 10422:Pending 10425:Pending M001:Pending');
check('checklist progress is what IT and HR ticked through updateChecklistItem (11 · 11 · 0 · 4 · 10 · 1 · 0)',
  rows().map(done).join(',') === '11,11,0,4,10,1,0');
check('typed dates became Dates in the sheet, so every start date carries the _Raw the countdown and sort read',
  rows().every((r) => typeof r.Start_Date_Raw === 'number' && /^\d{2}\/\d{2}\/\d{4}$/.test(r.Start_Date)));
check('a comment email lands in the discussion log under the commenter\'s name (processDiscussionLog)',
  /^Kendra Moss: Benefits paperwork/.test(row('10409').Discussion_Log) && /^Kendra Moss: Offer letter is signed/.test(row('10418').Discussion_Log));
check('the manual-entry failsafe made M001 with the notes as its discussion log', row('M001').First_Name === 'Lena' && /board meeting/.test(row('M001').Discussion_Log));
check('two emails are still unread for the visitor', O.unread() === 2);
const s1 = O.sync();
check('the 10-minute sync adds the new hire as a Pending record and appends the new comment to Avery\'s log', s1.added === 1 &&
  row('10431').Status === 'Pending' && row('10431').First_Name === 'Grace' &&
  /\nRay Delgado: Laptop is imaged/.test(row('10418').Discussion_Log) && O.unread() === 0);
check('a second sync finds nothing new (threads are marked read)', O.sync().added === 0 && rows().length === 8);
const avery = row('10418');
check('updateChecklistItem ticks an item and the dashboard reads it back', B.updateChecklistItem(avery.rowId, 'N', '✅') === 'Success' && row('10418').IT_Assign_Equipment === '✅');
check('manualOverrideStatus forces a status', B.manualOverrideStatus(row('10425').rowId, 'Approved') === 'Success' && row('10425').Status === 'Approved');
check('addManualOnboardingRequest numbers the next manual record M002', B.addManualOnboardingRequest({ firstName: 'Test', lastName: 'Person', startDate: '2026-12-01',
  department: 'Elementary', role: 'Aide' }) === 'Success' && !!row('M002'));
({ B } = boot(store));
check('the visit\'s changes survive a reload (sessionStorage, Dates intact)', B.getDashboardData().length === 9 &&
  B.getDashboardData().filter((r) => r.Approval_ID === '10418')[0].IT_Assign_Equipment === '✅' &&
  typeof B.getDashboardData()[0].Start_Date_Raw === 'number');

console.log(fail ? '\n' + fail + ' check(s) FAILED' : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
