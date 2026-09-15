// Verifies this demo by running its fabricated dataset through the REAL app logic the demo ships:
//   - the Roster fixture must be EXACTLY what the real nightly producer
//     (FACTS/facts-api-sync/Transportation.gs) emits for the same inputs, so the fixture cannot
//     drift from the shape the app consumes;
//   - the mock backend (mock.js) is exercised against the real Dismissal.gs (the app's own code,
//     inlined into index.html unedited), lane by lane, flag by flag;
//   - the built page passes the app's own two blank-page gates (every literal $('id') resolves,
//     the page script parses), has no template tokens left, and is a fresh build of the source.
//
// Run from the repo root: node demos/transportation/verify.mjs
// Requires the source projects checked out alongside this repo:
//   Projects/apps-script-showcase/  ·  Projects/FACTS/transportation/  ·  Projects/FACTS/facts-api-sync/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const APP = fileURLToPath(new URL('../../../FACTS/transportation/Dismissal.gs', import.meta.url));
const PRODUCER = fileURLToPath(new URL('../../../FACTS/facts-api-sync/Transportation.gs', import.meta.url));
let S, P;
try {
  S = require(APP);
  P = require(PRODUCER);
} catch (e) {
  console.log('SKIP — source projects not found next to this repo (' + e.message + ')');
  process.exit(0);
}

/* ---------- load data.js and mock.js the way the browser does ---------- */
const window = {};
new Function('window', readFileSync(HERE + 'data.js', 'utf8'))(window);
const D = window.DISMISSAL_DATA;
// mock.js reaches the ds* functions as page globals (DismissalClient is inlined above the app
// script); here they are passed in by name from the real module.
const names = Object.keys(S);
new Function('window', ...names, readFileSync(HERE + 'mock.js', 'utf8'))(window, ...names.map(n => S[n]));
const M = window.MOCK_BACKEND;

let fail = 0;
const check = (l, c, extra) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + l + (!c && extra ? '\n        ' + extra : ''));
  if (!c) fail++;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byId = (rows, id) => rows.find(r => r.id === id);

/* ---------- the fixture matches the REAL producer ---------- */
const producerRows = P.assembleTransportationRows(D.producerInputs);
check('the Roster is EXACTLY what the real nightly producer emits for these inputs',
  eq(producerRows, D.tabs.Roster),
  'first difference at row ' + producerRows.findIndex((r, i) => !eq(r, D.tabs.Roster[i])));
check('Early Bird is computed by the producer\'s family rule, not hand-written',
  eq(P.trEarlyBirdSet_(D.producerInputs.gradeById, D.producerInputs.familyById), D.producerInputs.earlyBird));
check('87 fabricated students, one PM row each plus AM and split rows',
  Object.keys(D.producerInputs.nameById).length === 87 && D.tabs.Roster.length - 1 > 87);
check('all eleven tabs the app reads are present',
  eq(Object.keys(D.tabs).sort(), ['Attendance Today', 'EVENTS', 'Overrides', 'PickupAuth', 'PickupContacts', 'Roles',
                                  'Roster', 'Routes', 'Staff', 'Standing', 'Walkers']));
check('a temporary pickup authorization rides on the board row and the ramp slice as names + dates only',
  (() => { const r = M.dismissalApi(''); const f = S.dsFlatList(r.board).find(x => x.id === '400156');
    if (!f || !f.pickupAuth.length || !f.pickupAuth[0].active) return false;
    const sl = S.dsRampSlice(r.board, r.routes).find(x => x.name === f.name);
    return sl && sl.authPickups.length === 1 && sl.authPickups[0][0] === 'Marisol Vega' && JSON.stringify(sl).indexOf("mom's email") === -1; })());
check('every student in the sign-out log, attendance, overrides and walkers is on the roster',
  [...D.tabs.EVENTS.slice(1).map(r => r[3]), ...D.tabs['Attendance Today'].slice(1).map(r => r[0]),
   ...D.tabs.Overrides.slice(1).map(r => r[1]), ...D.tabs.Walkers.slice(1).map(r => r[0])]
    .every(id => D.producerInputs.nameById[id]));

/* ---------- the board on the pinned Tuesday, through the mock + real Dismissal.gs ---------- */
const res = M.dismissalApi('');
const board = res.board, flat = S.dsFlatList(board);
check('the board loads for the pinned school day', res.ok && res.dayKey === '2026-09-15' && res.dayName === 'Tue');
check('every student is counted once, whatever their row count', board.counts.total === 87);
check('lanes are ordered Bus -> Early Bird -> Staff Kid -> Car',
  eq(board.groups.map(g => g.type).filter((t, i, a) => a.indexOf(t) === i), ['Bus', 'Early Bird', 'Staff Kid', 'Car']));
check('seven bus/van lanes, keyed by the FACTS course title', board.routes.length === 7 &&
  board.routes.every(k => /Route$/.test(k)), JSON.stringify(board.routes));
check('lane sizes match the fabricated enrolment (J 9 · E 6 · A/HdG 6 · Ab 5 · BA 5 · CC 4 · SP 5, split child in J and SP)',
  (() => { const n = {}; board.groups.filter(g => g.type === 'Bus').forEach(g => { n[g.key] = g.rows.length; });
    // Tennant Rosalind (J) is overridden to Car today, so Jarrettsville shows 8 of its 9 riders
    return n['Jarrettsville Bus Route'] === 8 && n['Edgewood Bus Route'] === 6 &&
           n['Aberdeen/Havre de Grace Route'] === 6 && n['Abingdon Bus Route'] === 5 &&
           n['Bel Air Van Route'] === 5 && n['Cecil County Van Route'] === 4 &&
           n['Street/Pylesville Van Route'] === 5; })(),
  JSON.stringify(board.groups.filter(g => g.type === 'Bus').map(g => g.key + '=' + g.rows.length)));

// who NOT to wait for
const ne = Object.fromEntries(board.notExpected.map(r => [r.id, r]));
check('ABSENT excused / unexcused both flag, with the detail',
  ne['400103'] && ne['400103'].reason === 'ABSENT' && /excused — fever/.test(ne['400103'].detail) &&
  ne['400109'] && /unexcused/.test(ne['400109'].detail));
check('LEFT EARLY flags with the reason', ne['400114'] && ne['400114'].reason === 'LEFT EARLY' && /orthodontist/.test(ne['400114'].detail));
check('a mid-day sign-out flags with time and adult',
  ne['400115'] && ne['400115'].reason === 'SIGNED OUT' && ne['400115'].detail === '13:04 with Marlowe Hesper');
check('a child signed out and signed BACK IN is still expected (last event wins)', !ne['400126']);
check('a pickup_flag row and a MISMATCHED early-out are NOT sign-outs — Gaskill Wyatt stays expected',
  !ne['400140'] && D.tabs.EVENTS.some(r => r[3] === '400140' && r[2] === 'student_early_out' && r[5] === 'mismatch'));
check('the sign-out fold is the app\'s own dsBuildSignedOut, over the kiosk\'s real columns',
  eq(Object.keys(S.dsBuildSignedOut(D.tabs.EVENTS, D.demo.date)).sort(), ['400115', '400150']) &&
  eq(D.tabs.EVENTS[0], ['Timestamp', 'Date', 'Type', 'PersonKey', 'GuardianName', 'PickupMatch']));
check('freshness carries the live sign-out count the page shows next to attendance',
  res.freshness.signOutActive === true && res.freshness.signOutCount === 2 && res.signOutActive === true);
check('late arrivals are EXPECTED and badged LATE, never treated as gone',
  !ne['400105'] && byId(flat, '400105').reason === 'LATE' && !ne['400111'] && byId(flat, '400111').reason === 'LATE');
check('exactly the seven intended students are flagged',
  eq(Object.keys(ne).sort(), ['400103', '400109', '400114', '400115', '400150', '400157', '400162']),
  JSON.stringify(Object.keys(ne).sort()));

// the four lanes and the producer's edge cases
const type = id => byId(flat, id).type;
check('an AM-only rider is Car on the PM board, not waited for at a bus', type('400138') === 'Car');
check('a different route each way: PM lane is Bel Air, not Cecil County',
  byId(flat, '400139').routeCodes[0] === 'BA' && byId(flat, '400139').routes.length === 1);
check('split custody: on BOTH drivers\' lists, one ramp row carrying both routes and the SPLIT flag',
  board.groups.filter(g => g.rows.some(r => r.id === '400121')).length === 2 &&
  eq(byId(flat, '400121').routeCodes, ['J', 'SP']) && byId(flat, '400121').split === true);
check('Early Bird is the seven children whose EVERY sibling is in grades 1-3',
  eq(flat.filter(r => r.type === 'Early Bird').map(r => r.id).sort(),
     ['400162', '400163', '400164', '400165', '400166', '400167', '400168']));
check('a K5 sibling blocks the family (Kirkwood Bram is Car), and Bus beats Early Bird (Tennant Rosalind)',
  type('400113') === 'Car' && D.tabs.Roster.find(r => r[0] === '400118' && r[3] === 'PM')[4] === 'Bus');
check('Car rows are marked ASSUMED (residual-default), never mistaken for recorded data',
  D.tabs.Roster.filter(r => r[4] === 'Car').every(r => r[16] === 'residual-default'));
check('staff kids: walk to the HS / same building / Unresolved / to Elementary / to Kindergarten',
  byId(flat, '400150').walkTo === 'High School' && byId(flat, '400154').walkTo === '' &&
  byId(flat, '400155').walkTo === 'Unresolved' && byId(flat, '400153').walkTo === 'Elementary' &&
  byId(flat, '400159').walkTo === 'Kindergarten');
check("a STANDING answer overrides the derivation: the driver's child is Car, badge data on, no TODAY stamp",
  (() => { const c = byId(flat, '400156'); return !!c && c.type === 'Car' && c.standing === true &&
    c.overridden === false && /AM van route/.test(c.standingNote) && c.routes.length === 0; })());
check('approved walkers are MARKED on the ramp rows — every one of the 8 carries a destination or a reason',
  (() => { const w = flat.filter(r => r.walkUp); return w.length === 8 && w.every(r => r.walkUpWalking ? true : !!r.walkUpWhy); })());
check('6th-grade pickup follows the siblings: EL with an EL-side sibling, HS otherwise',
  byId(flat, '400132').pickup === 'EL' && byId(flat, '400170').pickup === 'EL' &&
  byId(flat, '400117').pickup === 'HS' && byId(flat, '400143').pickup === 'HS' && byId(flat, '400181').pickup === 'HS');

// today-only changes
const ros = byId(flat, '400118');
check('Bus -> Car override: the bus is GONE from her row, and who she is handed to rides with it',
  ros.type === 'Car' && ros.routes.length === 0 && ros.overridden === true &&
  ros.overrideDestination === 'Tennant, Beatrix (Grandmother)' && ros.overrideBy === 'office.demo@example.edu' &&
  ros.overrideAt === '13:02');
check('Staff Kid -> Car override recorded at the ramp shows the TODAY badge data',
  type('400154') === 'Car' && byId(flat, '400154').overridden === true);

// routes: the stick colour and who is driving
check('all seven routes resolve by CODE to a colour the page can render',
  Object.keys(res.routes).length === 7 &&
  flat.filter(r => r.type === 'Bus').every(r => r.routeCodes.every((c, i) => S.dsRouteFor(res.routes, c, r.routes[i]) &&
    S.dsRouteFor(res.routes, c, r.routes[i]).colour)));
check('the FACTS title joins to the office short name: "Jarrettsville Bus Route" + J -> Purple',
  S.dsRouteFor(res.routes, 'J', 'Jarrettsville Bus Route').colour === 'Purple' &&
  S.dsRouteFor(res.routes, 'J', 'Jarrettsville Bus Route').name === 'Jarrettsville');
check('TUESDAY: Aberdeen/Havre de Grace has NO PM driver listed — the gap is shown, not hidden',
  S.dsDriversFor(res.routes['A/HdG'], 'PM', res.dayName).length === 0 &&
  S.dsDriversFor(res.routes['A/HdG'], 'PM', 'Mon').length === 1 &&
  S.dsDriversFor(res.routes['A/HdG'], 'PM', 'Fri').length === 2);

// the walk-up list
const w = res.walkUp;
check('walk-up list: everyone approved appears every day, 8 on the list',
  w.counts.onList === 8 && w.rows.length === 8 && w.dayName === 'Tue');
check('Tuesday: 5 walking, 3 not (signed out · absent · Occasional not confirmed)',
  w.counts.walking === 5 && w.counts.notWalking === 3 &&
  w.rows.find(r => r.id === '400150').kind === 'SIGNED OUT' &&
  w.rows.find(r => r.id === '400157').kind === 'ABSENT' &&
  w.rows.find(r => r.id === '400161').kind === 'NOT TODAY', JSON.stringify(w.counts));
check('an Occasional walker confirmed by today\'s override IS walking, and the change is stamped',
  (() => { const r = w.rows.find(x => x.id === '400160');
    return r.walking === true && r.overridden === true && r.overrideBy === 'walkup.demo@example.edu'; })());
check('a specific hand-over destination is carried ("to Dad")', w.rows.find(r => r.id === '400152').destination === 'to Dad');

/* ---------- the Friday time-travel ---------- */
const fri = M.dismissalApi(D.demo.fridaySim);
const fw = fri.walkUp;
check('?sim= moves the board to Friday and echoes the simulated clock',
  fri.dayName === 'Fri' && fri.dayKey === '2026-09-18' && fri.sim === D.demo.fridaySim);
check('FRIDAY: the Art child is IN A SPECIAL, already up by the HS',
  (() => { const r = fw.rows.find(x => x.id === '400151');
    return r.walking === false && r.kind === 'IN A SPECIAL' && /Art/.test(r.why) && /already up by the HS/.test(r.why); })());
check('FRIDAY: a standing exception destination says where the child goes instead',
  (() => { const r = fw.rows.find(x => x.id === '400156');
    return r.walking === false && r.destination === 'to their own classroom'; })());
check('Tuesday\'s sign-out and overrides do not leak into Friday (self-expiring)',
  fw.rows.find(r => r.id === '400150').walking === true && fw.rows.find(r => r.id === '400160').kind === 'NOT TODAY' &&
  !S.dsFlatList(fri.board).find(r => r.id === '400118').overridden);
check('FRIDAY: the double-covered route lists two drivers', S.dsDriversFor(fri.routes['A/HdG'], 'PM', 'Fri').length === 2);

/* ---------- who the demo visitor is, and what they may do ---------- */
const perm = res.perm;
check('the demo sign-in is an Admin who is also the 3rd-grade homeroom teacher',
  perm.isAdmin && perm.canManageRoles && perm.teacherName === 'Sowell Gina' && perm.adminOf.length === 6);
check('Teacher is IMPLICIT: holding a homeroom on the roster grants it with no Roles-tab row',
  perm.teacherImplicit === true && perm.roles.indexOf('Teacher') !== -1 &&
  !D.tabs.Roles.some(r => r[0] === 'Teacher' && r[1] === D.demo.email));
check('"My class" is her ten 3rd graders; a co-teacher\'s "My grade" widens past their own homeroom',
  S.dsScopeRows(flat, 'Sowell Gina', 'class').length === 10 &&
  S.dsScopeRows(flat, 'Quon Beatrix', 'class').length < S.dsScopeRows(flat, 'Quon Beatrix', 'grade').length);
const quon = S.dsPermissions('b.quon@example.edu', S.dsBuildRoles(D.tabs.Roles), 'Quon Beatrix',
                             S.dsHomeroomTeacherSet(S.dsBuildRoster(D.tabs.Roster)));
// Teachers are READ-ONLY (Josh, 2026-09-05): the implicit role scopes what she sees, and every
// change goes through Office / Ramp / Walk-Up. This check used to assert she could change her own
// class; the app's rule reversed and so did this.
check('a homeroom teacher with NO Roles row holds the Teacher role but may change nobody, own class included',
  quon.teacherImplicit === true && !quon.canChangeAnyone &&
  !S.dsCanChange(quon, byId(flat, '400115'), false).ok && !S.dsCanChange(quon, byId(flat, '400113'), false).ok &&
  /office/.test(S.dsCanChange(quon, byId(flat, '400115'), false).why));

/* ---------- the student card ---------- */
const pk = M.pickupsApi();
check('pickup contacts are trimmed to enrolled students, in FACTS sort order',
  eq(pk['400101'].map(p => p[1]), ['Mother', 'Father', 'Grandparent']) && pk['400101'][0][0] === 'Alderman, Priya');
check('a student with NO contacts recorded is stated, not shown as a failed load',
  S.dsStudentCard('400180', flat, pk).hasPickups === false && S.dsStudentCard('400180', flat, pk).pickupsLoaded === true);
check('siblings resolve from the flat list with their route codes',
  (() => { const c = S.dsStudentCard('400106', flat, pk);
    return c.siblings.length === 1 && c.siblings[0].id === '400107' && eq(c.siblings[0].routeCodes, ['SP']); })());
check('the override destination offered for Rosalind is one of her authorised contacts',
  pk['400118'].some(p => p[0] === 'Tennant, Beatrix'));

/* ---------- the mock WRITES behave like the server ---------- */
const after = M.setOverride('400140', 'Car', '', 'nan collecting', '', 'Gaskill, Tabitha (Mother)');
check('setOverride appends a stamped row and returns the re-built board',
  after.ok && byId(S.dsFlatList(after.board), '400140').type === 'Car' &&
  byId(S.dsFlatList(after.board), '400140').overrideBy === D.demo.email);
check('setOverride refuses a bad type', (() => { try { M.setOverride('400140', 'Helicopter', '', '', '', ''); return false; }
  catch (e) { return /Type must be/.test(e.message); } })());
const roles = M.rolesApi();
check('the settings gear sees every role\'s members and the shared Ramp view',
  roles.members.length === D.tabs.Roles.length - 1 && roles.views.Ramp && roles.views.Ramp.savedBy === 'ramp.lead@example.edu');
check('the gear gets the staff DIRECTORY: active people on the school domain, sorted, name + email only',
  roles.staff.length > 0 && roles.staff.every(s => /@example\.edu$/.test(s.email) && Object.keys(s).length === 2) &&
  !roles.staff.some(s => /Quill/.test(s.name)) && roles.staff.some(s => s.email === D.demo.email) &&
  eq(roles.staff.map(s => s.name), roles.staff.map(s => s.name).slice().sort()));
check('typing a name in the add box resolves to ONE person, or says why not',
  S.dsResolveStaff(roles.staff, 'quon').email === 'b.quon@example.edu' &&
  S.dsResolveStaff(roles.staff, 'Gina Sowell').email === D.demo.email &&
  /people match/.test(S.dsResolveStaff(roles.staff, 'ma').error || '') &&
  /Nobody on staff/.test(S.dsResolveStaff(roles.staff, 'zzz').error || ''));
check('a duplicate member and the last Admin are both refused',
  (() => { let a = false, b = false;
    try { M.addRoleMember('Ramp', 'ramp.lead@example.edu', false, ''); } catch (e) { a = /already in/.test(e.message); }
    try { M.removeRoleMember('Admin', D.demo.email); } catch (e) { b = /last Admin/.test(e.message); }
    return a && b; })());
check('adding then removing a member round-trips through rolesApi',
  M.addRoleMember('Ramp', 'cover.demo@example.edu', false, '').members.some(m => m.email === 'cover.demo@example.edu') &&
  !M.removeRoleMember('Ramp', 'cover.demo@example.edu').members.some(m => m.email === 'cover.demo@example.edu'));
check('a saved personal view wins over any team view on the next load',
  M.saveView({ mode: 'ramp', types: ['Bus'], grades: ['3'] }).types[0] === 'Bus' && M.dismissalApi('').viewFrom === 'personal');

/* ---------- the page itself ---------- */
const html = readFileSync(HERE + 'index.html', 'utf8');
check('no unreplaced Apps Script template tokens', !/<\?[=!]?[\s\S]*?\?>/.test(html));
check('the demo shim, data and mock load in <head>, before the app',
  (() => { const head = html.slice(0, html.indexOf('<body>'));
    return /gsr-shim\.js/.test(head) && /src="data\.js"/.test(head) && /src="mock\.js"/.test(head) &&
           /<title>HCS Dismissal<\/title>/.test(head); })());
check('the app\'s own logic is inlined (DismissalClient), not reimplemented',
  /GENERATED from Dismissal\.gs/.test(html) && /function dsBuildBoard\(/.test(html) && /function dsWalkUpList\(/.test(html));
check('?sim= is wired to the URL with the server\'s own sanitiser',
  /var SIM = \(new URLSearchParams\(location\.search\)\.get\('sim'\) \|\| ''\)\.replace\(/.test(html));
check('all seven stick colours are in the page\'s chip palette',
  ['white', 'orange', 'pink', 'purple', 'red', 'green', 'blue'].every(c => new RegExp('\\b' + c + ':\\s*\\{ bg:').test(html)));

// The app's two blank-page gates, applied to the BUILT page (from FACTS/transportation/tools/test-dismissal.mjs).
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
let synOk = true, synWhy = '';
try { new Function(blocks[blocks.length - 1][1]); } catch (e) { synOk = false; synWhy = e.message; }
check('the page script parses as JavaScript', synOk, synWhy);
const defined = new Set([...html.matchAll(/\bid="([A-Za-z_][\w-]*)"/g)].map(m => m[1]));
const missing = [...html.matchAll(/(?:\$|getElementById)\(\s*'([A-Za-z_][\w-]*)'\s*\)/g)].map(m => m[1])
  .filter((id, i, a) => !defined.has(id) && a.indexOf(id) === i);
check('every literal $(id) in the page resolves to an element', missing.length === 0, 'missing: ' + missing.join(', '));

// privacy
const all = html + readFileSync(HERE + 'data.js', 'utf8') + readFileSync(HERE + 'mock.js', 'utf8');
check('no real spreadsheet ids, deployment ids or urls leaked',
  !/AKfycb|docs\.google\.com\/spreadsheets|1[A-Za-z0-9_-]{30,}/.test(all));
check('staff first names in the source comments were scrubbed to their roles',
  !/Angela|Becky|Charlie Huber/.test(html) && /the ramp lead/.test(html) && /the walk-up chaperone/.test(html));
check('every phone number in the dataset is a fictional 555 number',
  [...all.matchAll(/\b\d{3}-\d{3}-\d{4}\b/g)].every(m => /^\d{3}-555-/.test(m[0])));

// the page is a fresh build of the CURRENT source — a stale demo is the failure this catches
try {
  const cfg = JSON.parse(readFileSync(HERE + 'build.json', 'utf8'));
  mkdirSync(ROOT + '.tmp', { recursive: true });
  const tmpCfg = ROOT + '.tmp/verify-transportation.json', tmpOut = ROOT + '.tmp/verify-transportation.html';
  writeFileSync(tmpCfg, JSON.stringify({ ...cfg, dst: tmpOut }));
  execFileSync(process.execPath, [ROOT + 'tools/build-demo.mjs', tmpCfg], { cwd: ROOT, stdio: 'pipe' });
  check('index.html is what build-demo.mjs produces from the current source (not stale)',
    readFileSync(tmpOut, 'utf8') === html, 'rebuild: node tools/build-demo.mjs demos/transportation/build.json');
} catch (e) {
  check('index.html could be rebuilt from build.json', false, e.message);
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
