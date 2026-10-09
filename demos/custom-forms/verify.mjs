// verify.mjs — checks the Custom Forms demo against the REAL HCS Forms source, not against itself.
//
//   node demos/custom-forms/verify.mjs          (from the showcase repo root; exit 1 on any FAIL)
//
// What can quietly rot here, and the check that catches it:
//   1. FRESH BUILDS — build.mjs is re-run into a temp folder; logic.js and all nine pages must be
//      byte-identical to what is committed (a stale page or bundle is the commonest demo failure).
//   2. METHOD CONTRACT — every google.script.run method each built page calls (a depth-aware scan of
//      the page, incl. the Builder's call('name') wrapper and chains held in a variable) must be exactly
//      the set its mock answers, and each must be a public function of THAT app's own server files
//      (a builder call that only exists in RunnerApi.js would fail in production, so it fails here).
//   3. doGet — every page, booted with its own query string, lands on itself (no routing hop) and gets
//      its template values from the app's own Router.js; the chooser's literal links equal its doGet's.
//   4. ROUND TRIP — through the pages' own mocks sharing one sessionStorage: the Builder creates,
//      edits and publishes a form; the parent runner fills it in; the Builder's Responses shows it;
//      an edit link from the receipt re-opens it; an approval-routed submission reaches the Builder's
//      queue and the decision mails the parent.
//   5. ONE-TIME CODE — the parent OTP and the MACS school OTP both mail the pinned demo code, reject a
//      wrong code, lock after five tries, and the verified sessions pre-fill (FACTS family / last year).
//   6. PRIVACY — no real domain, deployment id, Drive id or hashed name in anything published; the
//      fabricated data uses example domains only.
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { SRC, FILES, nameAliases } from './build-logic.mjs';
import { SURFACES } from './build.mjs';
import { findPhrases, findStaffNames, PHRASE_ALIASES } from '../../tools/staff-aliases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
if (!existsSync(SRC)) { console.log('SKIP — source project not found at ' + SRC); process.exit(0); }
const lf = (s) => s.replace(/\r\n?/g, '\n');
let fail = 0, passes = 0;
const check = (label, ok, extra) => {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (!ok && extra ? '\n        ' + extra : ''));
  if (ok) passes++; else fail++;
};
const read = (f) => readFileSync(path.join(HERE, f), 'utf8');
const PAGES = Object.keys(SURFACES);

/* ---------- 1. fresh builds ---------- */
const tmp = mkdtempSync(path.join(tmpdir(), 'forms-demo-'));
try {
  execFileSync(process.execPath, [path.join(HERE, 'build.mjs'), '--out', tmp], { cwd: ROOT, encoding: 'utf8' });
  check('logic.js is a fresh build of the five apps\' server files (build-logic.mjs)', readFileSync(path.join(tmp, 'logic.js'), 'utf8') === read('logic.js'));
  const stale = PAGES.filter((p) => readFileSync(path.join(tmp, p + '.html'), 'utf8') !== read(p + '.html'));
  check('all nine pages are fresh builds of their build.<page>.json (' + PAGES.join(', ') + ')', !stale.length, 'stale: ' + stale.join(', '));
} finally { rmSync(tmp, { recursive: true, force: true }); }

/* ---------- boot a page the way the browser does ---------- */
function makeSession() { const s = {}; return { s, getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; }, clear: () => { for (const k in s) delete s[k]; } }; }
function boot(surface, search, session) {
  const [app] = SURFACES[surface];
  const el = () => ({ setAttribute() {}, appendChild() {}, style: {}, addEventListener() {} });
  const ctx = { console, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, parseInt, parseFloat, isNaN, isFinite, URLSearchParams,
    setTimeout: () => 0, clearTimeout() {}, Proxy, Intl, Promise, Uint8Array, Symbol, Map, Set, encodeURIComponent, decodeURIComponent, crypto: globalThis.crypto };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.sessionStorage = session || makeSession();
  const loc = { search: search || '', hash: '', href: 'file:///demo/' + surface + '.html' + (search || ''), replaced: null };
  loc.replace = (u) => { loc.replaced = u; };
  ctx.location = loc;
  ctx.document = { title: '', readyState: 'loading', head: el(), body: null, createElement: el, addEventListener() {}, querySelector: () => null };
  ctx.DEMO_APP = app; ctx.DEMO_SURFACE = surface;
  vm.createContext(ctx);
  for (const f of ['logic.js', 'data.js', 'mock.js']) vm.runInContext(read(f), ctx, { filename: f });
  return ctx;
}

/* ---------- 2. method contract ---------- */
function pageCalls(html) {
  const out = new Set();
  const HANDLER = /^(withSuccessHandler|withFailureHandler|withUserObject)$/;
  for (const m of html.matchAll(/google\.script\.run/g)) {
    const text = html.slice(m.index + 17, m.index + 17 + 8000).replace(/\/\/[^\n]*/g, '');
    if (!/^\s*\./.test(text)) continue;                         // prose, not a call
    let depth = 0, found = null;
    for (let i = 0; i < text.length && !found; i++) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') { if (--depth < 0) break; }
      else if (depth === 0 && (ch === ';' || ch === '[')) break;
      else if (depth === 0 && ch === '.') { const mm = /^\.([a-zA-Z]\w*)\s*\(/.exec(text.slice(i, i + 60)); if (mm && !HANDLER.test(mm[1])) found = mm[1]; }
    }
    if (found) { out.add(found); continue; }
    // a chain held in a variable: var runner = google.script.run.with...(...); runner.method(...)
    const v = /(\w+)\s*=\s*$/.exec(html.slice(Math.max(0, m.index - 40), m.index));
    if (v) for (const c of html.slice(m.index, m.index + 3000).matchAll(new RegExp('\\b' + v[1] + '\\s*\\.\\s*([a-zA-Z]\\w*)\\s*\\(', 'g'))) if (!HANDLER.test(c[1])) out.add(c[1]);
  }
  // the Builder's promise wrapper: call('name', ...) and call(cond ? 'a' : 'b', ...)
  // (a literal right after == / === is the condition, not a method name)
  for (const c of html.matchAll(/(?<![.\w])call\(\s*([^,)]*)/g)) for (const s of c[1].matchAll(/'([a-zA-Z]\w*)'/g)) if (!/[=!]=\s*$/.test(c[1].slice(0, s.index))) out.add(s[1]);
  return [...out].sort();
}
// which source files each app actually ships (tools/wrap.js's split): builder never gets RunnerApi.js, runners never AdminSettings/Maintenance
const declared = (files) => { const n = new Set(); for (const f of files) for (const m of lf(readFileSync(path.join(SRC, f), 'utf8')).matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) n.add(m[1]); return n; };
const SHIPS = {
  builder: declared(FILES.filter((f) => !/RunnerApi|Seeds/.test(f))),
  runner: declared(FILES.filter((f) => !/AdminSettings|Maintenance|Seeds/.test(f)))
};
const bootSession = makeSession();
for (const surface of PAGES) {
  const [app] = SURFACES[surface];
  const calls = pageCalls(read(surface + '.html'));
  const S = boot(surface, surface === 'macs-portal' ? '?guest=1&School=Riverbend%20Christian%20School' : (/form$/.test(surface) ? '?form=FRM-SAMPLE-0001' + (surface === 'macs-form' ? '&School=Riverbend%20Christian%20School' : '') : ''), bootSession);
  const served = Object.keys(S.MOCK_BACKEND).sort();
  const server = S.FORMS_SERVER(app, {});
  const ships = app === 'builder' ? SHIPS.builder : SHIPS.runner;
  const notPublic = calls.filter((n) => /_$/.test(n) || typeof server[n] !== 'function' || !ships.has(n));
  check(`${surface}.html: the ${calls.length} methods it calls == the ${served.length} its mock serves, each a public function in ${app}'s own files`,
    JSON.stringify(calls) === JSON.stringify(served) && !notPublic.length,
    'page: ' + calls.join(',') + '\n        mock: ' + served.join(',') + '\n        not public in the app: ' + notPublic.join(','));
}
check('the scanner sees the calls a naive one misses (withdrawSubmission, listMyForms/listAllForms via a ternary, runner.submitForm via a variable)',
  ['withdrawSubmission', 'submitForm', 'getPublicForm'].every((n) => pageCalls(read('parent-form.html')).includes(n)) &&
  ['listMyForms', 'listAllForms'].every((n) => pageCalls(read('builder.html')).includes(n)));

/* ---------- 3. pages and doGet ---------- */
for (const surface of PAGES) {
  const html = read(surface + '.html');
  const [app] = SURFACES[surface];
  check(`${surface}.html: no template tags left, DEMO_APP='${app}' ahead of logic.js and the shim, never navigates the top window`,
    !/<\?[=!]?[\s\S]*?\?>/.test(html.replace(/<!--[\s\S]*?-->/g, '')) && html.indexOf(`DEMO_APP = '${app}'`) > -1 &&
    html.indexOf('<script src="logic.js">') > -1 && html.indexOf('<script src="logic.js">') < html.indexOf('<script src="../../assets/gsr-shim.js">') &&
    html.indexOf('<script src="mock.js">') > html.indexOf('<script src="data.js">') && !/top\.location\.href\s*=/.test(html));
}
const routes = { chooser: '', builder: '', parent: '', 'parent-form': '?form=FRM-PARENT-DEMO', staff: '', 'staff-form': '?form=FRM-FIELD-TRIP', macs: '', 'macs-portal': '?guest=1&School=Northside%20Christian%20Academy', 'macs-form': '?form=FRM-MACS-SPELLING&School=Northside%20Christian%20Academy' };
for (const surface of PAGES) {
  const S = boot(surface, routes[surface], makeSession());
  check(`${surface}.html${routes[surface]}: the app's own doGet takes this page's branch (no hop)`, S.location.replaced === null, 'hopped to ' + S.location.replaced);
}
{
  const hop = (surface, q) => boot(surface, q, makeSession()).location.replaced;
  check('doGet routes like production: parent.html?form= -> parent-form, macs.html?form= without a school stays on the gate, ?School= -> macs-form, ?guest=1 -> macs-portal',
    /^parent-form\.html\?form=X/.test(hop('parent', '?form=X')) && hop('macs', '?form=X') === null &&
    /^macs-form\.html/.test(hop('macs', '?form=X&School=Y')) && /^macs-portal\.html/.test(hop('macs', '?guest=1&School=Y')) && /^staff\.html/.test(hop('staff-form', '')));
  const C = boot('chooser', '', makeSession()), html = read('chooser.html');
  const ch = C.FORMS_SERVER('chooser', {});
  check('chooser.html\'s literal links are exactly its doGet\'s values (parent.html, staff.html, ?guest=1, crest, org)',
    html.includes('href="parent.html"') && html.includes('href="staff.html"') && html.includes('href="parent.html?guest=1"') && html.includes('<span>HCS</span>') &&
    /var PARENT_URL = 'parent\.html'/.test(read('logic.js')) && /var STAFF_URL = 'staff\.html'/.test(read('logic.js')) && C.document.title === 'HCS Forms' && typeof ch.doGet === 'function');
  const M = boot('macs-form', routes['macs-form'], makeSession());
  check('MACS pages wear MACS\'s palette and name, rendered by the app\'s own ThemeLogic from MACS\'s THEME_JSON',
    M.DEMO_DOGET.siteName === 'MACS Forms' && M.DEMO_DOGET.orgName === 'Maryland Association of Christian Schools' && JSON.parse(M.DEMO_DOGET.schoolsJson).length === 3 &&
    JSON.parse(M.DEMO_DOGET.schoolsJson).every((s) => Object.keys(s).join() === 'name,otp'));
}

/* ---------- 4. the round trip ---------- */
const tab = makeSession();
const B = boot('builder', '', tab).MOCK_BACKEND;
const who = B.whoAmI();
check('the Builder signs in the demo staff account through requireStaff_ + the Admins tab (an admin)', who.email === 'm.avery@example.edu' && who.isAdmin === true && who.name === 'Morgan Avery');
check('both contexts are registered (HCS facts-otp, MACS open-picker) and HCS starts with the source repo\'s 12 built-in forms + the demo\'s own',
  B.adminListContexts().map((c) => c.contextId + ':' + c.authMode).join() === 'hcs:facts-otp,macs:open-picker' &&
  ['FRM-SAMPLE-0001', 'FRM-PARENT-DEMO', 'FRM-HS-CONFERENCE', 'FRM-SPORTS-PHYSICAL', 'FRM-KI-AUTH', 'FRM-FIELD-TRIP', 'FRM-COURSE-SELECTION', 'FRM-HOMESCHOOL-OPP',
    'FRM-PREAPPROVED-TRIP', 'FRM-MED-AUTH', 'FRM-SUPPLY-LISTS', 'FRM-ATHOME-LEARNING'].every((id) => B.listAllForms('hcs').some((f) => f.id === id)) &&
  B.listAllForms('macs').length === 2);
const created = B.createForm('hcs', 'Robotics Club Sign-up');
let ed = B.loadFormForEdit('hcs', created.formId);
const schema = ed.schema;
schema.description = 'Pick a build night.';
schema.pages[0].fields = [
  { id: 'fld_name', type: 'text', label: 'Student name', required: true },
  { id: 'fld_night', type: 'radio', label: 'Build night', required: true, options: ['Tuesday', 'Thursday'] },
  { id: 'fld_bring', type: 'checkboxes', label: 'I can bring', required: false, options: ['Laptop', 'Snacks'], showIf: { field: 'fld_night', op: 'equals', value: 'Thursday' } },
  { id: 'fld_email', type: 'email', label: 'Parent email', required: true }];
const saved = B.saveForm('hcs', created.formId, schema, ed.meta.version);
const pub = B.setFormState('hcs', created.formId, { lifecycle: 'published', allowEdit: true }, saved.version);   // the Settings tab's path
const share = B.getShareUrl('hcs', created.formId);
check('Builder: create -> save the designed schema -> publish with "allow edit" on, and the share link points at the parent runner',
  created.ok && saved.ok && pub.ok && pub.meta.lifecycle === 'published' && pub.meta.settings.allowEdit === true && share.url === 'parent.html?form=' + created.formId);
let conflict = '';
try { B.saveForm('hcs', created.formId, schema, ed.meta.version); } catch (e) { conflict = e.message; }
check('a save from a stale copy is refused with CONFLICT (the version guard), not silently last-write-wins', conflict === 'CONFLICT');
const R = boot('parent-form', '?form=' + created.formId, tab);
check('the parent page\'s doGet hands the runner the form id from the URL', R.DEMO_DOGET.mode === 'runner' && R.DEMO_DOGET.formId === created.formId && R.location.replaced === null);
const pf = R.MOCK_BACKEND.getPublicForm(created.formId, null);
check('the runner renders the published schema (fields, conditional rule)', pf.ok && pf.form.title === 'Robotics Club Sign-up' && pf.form.pages[0].fields.length === 4 && pf.form.pages[0].fields[2].showIf.value === 'Thursday');
const bad = R.MOCK_BACKEND.submitForm(created.formId, { fld_name: '', fld_night: 'Friday', fld_email: 'nope' }, null, {}, '');
check('server-side validation rejects a required blank, an option not offered and a bad email', !bad.ok && bad.reason === 'validation' && Object.keys(bad.errors).sort().join() === 'fld_email,fld_name,fld_night');
const sub = R.MOCK_BACKEND.submitForm(created.formId, { fld_name: 'Kai Ortiz', fld_night: 'Tuesday', fld_bring: ['Snacks'], fld_email: 'jamie.ortiz@example.com' }, null, {}, '');
check('the parent\'s submission is recorded', sub.ok && /^SUB-\d{14}-\d{3}$/.test(sub.submissionId) && sub.status === 'Submitted');
const resp = boot('builder', '', tab).MOCK_BACKEND.getResponses('hcs', created.formId);
const row = resp.rows && resp.rows[0];
const col = (h) => resp.headers.indexOf(h);
check('...and appears in the Builder\'s Responses (a fresh page, same tab): values by column, hidden field blanked by the showIf rule',
  resp.ok && resp.count === 1 && row[col('SubmissionID')] === sub.submissionId && row[col('Student name')] === 'Kai Ortiz' && row[col('Build night')] === 'Tuesday' &&
  row[col('RespondentEmail')] === 'jamie.ortiz@example.com' && !resp.rows[0].slice(col('ApprovalLog') + 1).some((v) => /Snacks/.test(String(v))));
const outbox = () => R.FORMS_DEMO.state().outbox;
const receipt = outbox().filter((m) => m.to === 'jamie.ortiz@example.com' && /We received your submission: Robotics Club Sign-up/.test(m.subject)).pop();
const editHref = receipt && (/href="([^"]+edit=[^"]+)"/.exec(receipt.htmlBody) || [])[1];
check('the receipt email (Demo inbox) carries the app\'s own edit link, on the parent page', !!editHref && editHref.indexOf('parent.html?form=' + created.formId + '&edit=' + sub.submissionId + '&t=') === 0,
  'link: ' + editHref);
if (editHref) {
  const q = editHref.slice(editHref.indexOf('?'));
  const E = boot('parent-form', q.replace(/&amp;/g, '&'), tab);
  const ef = E.MOCK_BACKEND.getSubmissionForEdit(E.DEMO_DOGET.formId, E.DEMO_DOGET.editSub, E.DEMO_DOGET.editToken);
  const up = E.MOCK_BACKEND.updateSubmission(E.DEMO_DOGET.formId, E.DEMO_DOGET.editSub, E.DEMO_DOGET.editToken, { fld_name: 'Kai Ortiz', fld_night: 'Thursday', fld_bring: ['Laptop'], fld_email: 'jamie.ortiz@example.com' }, {});
  const forged = E.MOCK_BACKEND.getSubmissionForEdit(E.DEMO_DOGET.formId, E.DEMO_DOGET.editSub, 'x' + E.DEMO_DOGET.editToken.slice(1));
  const r2 = boot('builder', '', tab).MOCK_BACKEND.getResponses('hcs', created.formId);
  check('the edit link re-opens the answers, saves an edit, and a forged token is refused',
    ef.ok && ef.answers.fld_night === 'Tuesday' && up.ok && up.edited && forged.reason === 'bad-token' && r2.rows[0][r2.headers.indexOf('Build night')] === 'Thursday');
}
// approval routing: the source's At-Home Learning seed routes to the demo admin
const P = boot('parent', '', tab).MOCK_BACKEND;
P.authRequestOtp('dana.whitfield@example.com');
const tok = P.authVerifyOtp('dana.whitfield@example.com', '482193').token;
const F = boot('parent-form', '?form=FRM-ATHOME-LEARNING', tab).MOCK_BACKEND;
const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const ah = F.submitForm('FRM-ATHOME-LEARNING', { pFirst: 'Dana', pLast: 'Whitfield', pEmail: 'dana.whitfield@example.com', students: ['Ellie Whitfield'], reason: 'Extended travel',
  startDate: '2026-11-02', returnDate: '2026-11-13', plan: 'Daily packets.', sign: 'Dana Whitfield' }, tok, { sign: [{ name: 'signature.png', mimeType: 'image/png', b64: pngB64 }] }, '');
const B2 = boot('builder', '', tab).MOCK_BACKEND;
const queue = B2.listMyApprovalQueue('hcs');
check('an approval-routed parent submission (drawn signature uploaded to Drive) lands in the Builder\'s approval queue',
  ah.ok && ah.status === 'Pending Approval' && queue.items.some((i) => i.submissionId === ah.submissionId), JSON.stringify(ah).slice(0, 200));
const pdf = ah.pdfCopies && ah.pdfCopies[0] && Buffer.from(ah.pdfCopies[0].b64, 'base64').toString('latin1');
check('the form\'s "PDF copy" setting hands back a downloadable PDF of the receipt (the demo\'s text rendering of the app\'s HTML)',
  !!pdf && /^%PDF-1\.4/.test(pdf) && /%%EOF\n$/.test(pdf) && /Extended travel/.test(pdf), JSON.stringify(ah.pdfCopies).slice(0, 200));
const before = outbox().length;
const dec = B2.decideApproval('hcs', 'FRM-ATHOME-LEARNING', ah.submissionId, 'Approved', 'Enjoy the trip.');
const after = boot('builder', '', tab).MOCK_BACKEND.getResponses('hcs', 'FRM-ATHOME-LEARNING');
const arow = after.rows.find((r) => r[after.headers.indexOf('SubmissionID')] === ah.submissionId);
check('approving it records the decision on the response row and emails the parent',
  dec && dec.ok !== false && arow[after.headers.indexOf('Status')] === 'Approved' &&
  outbox().slice(before).some((m) => m.to === 'dana.whitfield@example.com' && /approved/i.test(m.subject)), JSON.stringify(dec).slice(0, 200));

/* ---------- 5. one-time codes ---------- */
{
  const t = makeSession();
  const PP = boot('parent', '', t);
  const res = PP.MOCK_BACKEND.authRequestOtp('sam.whitfield@example.com');
  const mail = PP.FORMS_DEMO.state().outbox.pop();
  check('parent OTP: the generic anti-enumeration reply, and the emailed code is the demo\'s pinned 482193', res.ok && /If that email is on file/.test(res.msg) && mail.to === 'sam.whitfield@example.com' && mail.subject === 'Your HCS Forms code: 482193');
  PP.MOCK_BACKEND.authRequestOtp('stranger@example.com');
  check('an email that is not a FACTS guardian gets the same reply and no mail', PP.FORMS_DEMO.state().outbox.every((m) => m.to !== 'stranger@example.com'));
  const wrong = PP.MOCK_BACKEND.authVerifyOtp('sam.whitfield@example.com', '111111');
  const ok = PP.MOCK_BACKEND.authVerifyOtp('sam.whitfield@example.com', '482193');
  check('a wrong code is refused, the right one mints a session token', wrong.code === 'CODE_INVALID' && ok.ok && ok.email === 'sam.whitfield@example.com' && /\./.test(ok.token));
  PP.MOCK_BACKEND.authRequestOtp('taylor.brooks@example.com');
  const tries = [1, 2, 3, 4, 5].map(() => PP.MOCK_BACKEND.authVerifyOtp('taylor.brooks@example.com', '000000').code);
  check('five wrong tries lock the address (the app\'s own lockout)', tries[4] === 'LOCKED' && PP.MOCK_BACKEND.authVerifyOtp('taylor.brooks@example.com', '482193').code === 'LOCKED');
  const view = PP.MOCK_BACKEND.getPortalView(ok.token);
  check('the verified parent\'s portal: their two students, the class-tagged form under Ellie only, and the closing-soon list',
    view.role === 'parent' && view.students.map((s) => s.displayName).join() === 'Ellie Whitfield,Theo Whitfield' &&
    view.students[0].forms.map((f) => f.id).join() === 'FRM-20260915-2210' && view.students[1].forms.length === 0 &&
    view.closingSoon.map((f) => f.id).sort().join() === 'FRM-20260915-2210,FRM-PARENT-DEMO');
  const FF = boot('parent-form', '?form=FRM-HS-CONFERENCE', t).MOCK_BACKEND;
  const locked = FF.getPublicForm('FRM-HS-CONFERENCE', null);
  const open = FF.getPublicForm('FRM-HS-CONFERENCE', ok.token);
  check('a Private form asks for the code without a session, and with one pre-fills the parent and their students from FACTS',
    locked.reason === 'auth-required' && locked.verifyWith === 'parent' && open.ok && open.verifiedVia === 'otp' &&
    open.prefill.parent.displayName === 'Sam Whitfield' && open.prefill.students.length === 2);
  const staffP = boot('staff', '', t).MOCK_BACKEND.getPortalView(null);
  check('the staff portal: SSO identity, staff + open forms, and the staff-who-is-also-a-parent bridge offered',
    staffP.role === 'staff' && staffP.email === 'm.avery@example.edu' && staffP.canBridge === true && staffP.builderEditorUrl === 'builder.html' &&
    staffP.globalForms.some((f) => f.id === 'FRM-FIELD-TRIP'));
  const bridge = boot('staff', '', t).MOCK_BACKEND.getParentBridgeUrl();
  const BR = boot('parent', bridge.url.slice(bridge.url.indexOf('?')), t);
  check('the bridge opens the parent portal signed in as that parent, with no code (app-handoff ticket -> ordinary parent token)',
    bridge.ok && /^parent\.html\?ssoToken=/.test(bridge.url) && !!BR.DEMO_DOGET.bridgeToken && BR.MOCK_BACKEND.getPortalView(BR.DEMO_DOGET.bridgeToken).students[0].displayName === 'Quinn Avery');
}
{
  const t = makeSession();
  const MF = boot('macs-form', '?form=FRM-MACS-SPELLING&School=Northside%20Christian%20Academy', t);
  const before = MF.MOCK_BACKEND.getPriorAnswersForSchool('FRM-MACS-SPELLING', 'Northside Christian Academy', null);
  MF.MOCK_BACKEND.macsRequestOtp('Northside Christian Academy', 'someone@elsewhere.example.org');
  MF.MOCK_BACKEND.macsRequestOtp('Northside Christian Academy', 'coordinator@northside.example.org');
  const mails = MF.FORMS_DEMO.state().outbox;
  const v = MF.MOCK_BACKEND.macsVerifyOtp('Northside Christian Academy', 'coordinator@northside.example.org', '482193');
  const prior = MF.MOCK_BACKEND.getPriorAnswersForSchool('FRM-MACS-SPELLING', 'Northside Christian Academy', v.token);
  check('MACS school OTP: only an allow-listed address (@northside domain) is mailed the pinned code; verified, last year\'s coordinator answers fill in',
    before.verified === false && before.otpAvailable === true && mails.length === 1 && mails[0].subject === 'Your MACS Forms code: 482193' && v.ok &&
    prior.verified && prior.filled === 3 && prior.answers.coordName === 'Reese Hollander');
  const riv = MF.MOCK_BACKEND.getPriorAnswersForSchool('FRM-MACS-SPELLING', 'Riverbend Christian School', v.token);
  check('a token for one school fills nothing for another, and an open school offers no verification', riv.verified === false && riv.otpAvailable === false);
}

/* ---------- 6. privacy ---------- */
{
  const DOMAIN = 'harford' + 'christian';
  const published = ['logic.js', 'mock.js', 'data.js', 'index.html', 'build-logic.mjs', 'build.mjs', 'verify.mjs', ...PAGES.map((p) => p + '.html'), ...PAGES.map((p) => 'build.' + p + '.json')];
  const leaks = [];
  const phrases = Object.assign({}, PHRASE_ALIASES, nameAliases());
  for (const f of published) {
    const text = read(f);
    if (new RegExp(DOMAIN, 'i').test(text)) leaks.push(f + ': real domain');
    if (/AKfycb[A-Za-z0-9_-]{20,}/.test(text) || /script\.google\.com\/(a\/macros|macros)\/[^\s'"]*\/s\/[A-Za-z0-9_-]{20,}/.test(text)) leaks.push(f + ': deployment');
    if (/[\s"'/=(]1[A-Za-z0-9_-]{40,}/.test(text.replace(/base64,[A-Za-z0-9+/=\s]+/g, ''))) leaks.push(f + ': Drive id');
    if (f !== 'data.js' && text.split('\n').some((l) => findPhrases(l, phrases, true).length || findStaffNames(l.replace(/\b[A-Z][a-z]+\s+(?=[A-Z][a-z])/g, '')).length)) leaks.push(f + ': hashed name');
  }
  check('nothing published here carries the real domain, a deployment id, a Drive id or a name from the hashed alias tables', !leaks.length, leaks.join('; '));
  const emails = [...read('data.js').matchAll(/[A-Za-z0-9._-]+@([A-Za-z0-9.-]+)/g)].map((m) => m[1]);
  check('the fabricated data uses example domains only (' + emails.length + ' addresses)', emails.length > 20 && emails.every((d) => /(^|\.)example\.(edu|com|org)$/.test(d)), [...new Set(emails)].join(' '));
  check('the scrubbed bundle: the Contexts Registry id and the physicals sheet id are placeholders, the chooser points at this folder',
    /var CONTEXTS_REGISTRY_SHEET_ID = 'DEMO_ID_1'/.test(read('logic.js')) && !/vanjoh/i.test(read('logic.js')));
}

console.log('\n' + (fail ? fail + ' FAILED, ' : '') + passes + ' passed');
process.exit(fail ? 1 : 0);
