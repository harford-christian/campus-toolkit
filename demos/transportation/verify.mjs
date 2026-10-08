// Verifies the Dismissal Board demo by running its fabricated dataset through the REAL app — all of it:
//   - the Roster fixture must be EXACTLY what the real nightly producer (FACTS/facts-api-sync/
//     Transportation.gs) emits for the same inputs, so the fixture cannot drift from the shape the app consumes;
//   - logic.js must be the source project's server layer, verbatim (build-logic.mjs), and index.html a fresh
//     build of build.json — a stale demo is the failure these two catch;
//   - every google.script.run method the page calls is served, by the vendored endpoint, over the in-memory
//     Google in mock.js: the board, the time-travel, the planned list, history, the writes (overrides, standing
//     patterns, walk-up list, notes, pickup authorizations, views, roles), the mail, the persistence;
//   - the built page passes the app's own two blank-page gates and carries no real names or ids.
//
// Run from the repo root: node demos/transportation/verify.mjs
// Requires the source projects checked out alongside this repo:
//   Projects/apps-script-showcase/  ·  Projects/FACTS/transportation/  ·  Projects/FACTS/facts-api-sync/
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { buildLogic, SRC } from './build-logic.mjs';
const require = createRequire(import.meta.url);

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const APP = SRC + '/Dismissal.gs';
const PRODUCER = fileURLToPath(new URL('../../../FACTS/facts-api-sync/Transportation.gs', import.meta.url));
if (!existsSync(APP) || !existsSync(PRODUCER)) { console.log('SKIP — source projects not found next to this repo'); process.exit(0); }
const lf = (s) => s.replace(/\r\n?/g, '\n');
const P = require(PRODUCER);

let fail = 0;
const check = (l, c, extra) => {
  console.log((c ? 'PASS' : 'FAIL') + '  ' + l + (!c && extra ? '\n        ' + extra : ''));
  if (!c) fail++;
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byId = (rows, id) => rows.find((r) => r.id === id);
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };

/* ---------- boot the demo the way the browser does ---------- */
// Dismissal.gs has no module.exports (removed 2026-09-21, deliberately) — it is loaded as page globals,
// exactly as DismissalClient is in the page; then data.js, the vendored logic.js, and mock.js.
function makeSession() { const s = {}; return { s, getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; } }; }
function boot(session, search) {
  const ctx = { console, Date, Math, JSON, Object, Array, String, Number, RegExp, Error, parseInt, parseFloat, isNaN, URLSearchParams, setTimeout };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.sessionStorage = session || makeSession();
  ctx.location = { search: search || '', href: 'http://demo/index.html', reload() {} };
  vm.createContext(ctx);
  for (const f of [APP, HERE + 'data.js', HERE + 'logic.js', HERE + 'mock.js']) vm.runInContext(lf(readFileSync(f, 'utf8')), ctx, { filename: f });
  return { S: ctx, M: ctx.MOCK_BACKEND, L: ctx.DISMISSAL_LOGIC, D: ctx.DISMISSAL_DATA, X: ctx.DISMISSAL_DEMO };
}
const session = makeSession();
const { S, M, L, D, X } = boot(session);
const T = D.tabs;

/* ---------- vendoring ---------- */
const logicJs = readFileSync(HERE + 'logic.js', 'utf8');
check('logic.js is the source project\'s server layer, verbatim after the scrubs (run build-logic.mjs)', buildLogic() === logicJs);
check('Dismissal.gs still has no module.exports (removed 2026-09-21) and is loaded as page globals, as the page does',
  !/module\.exports\s*=/.test(lf(readFileSync(APP, 'utf8'))) && typeof S.dsBuildBoard === 'function' && typeof S.DS_ROLES === 'object');
check('the bundle binds Google by name and exposes the endpoints and the constants the demo needs',
  typeof L.bind === 'function' && typeof L.dismissalApi === 'function' && typeof L.dsComputeBoardBundle_ === 'function' &&
  L.OVERRIDES_HEADER.length === 10 && L.STANDING_HEADER.length === 11 && L.WALKERS_HEADER.length === 14 && L.PICKUP_AUTH_HEADER.length === 16 &&
  L.ROUTES_HEADER.length === 11);
check('the fixture headers are the source\'s headers, column for column',
  eq(T.Overrides[0], L.OVERRIDES_HEADER) && eq(T.Standing[0], L.STANDING_HEADER) && eq(T.Walkers[0], L.WALKERS_HEADER) &&
  eq(T.PickupAuth[0], L.PICKUP_AUTH_HEADER) && eq(T.Notes[0], L.NOTES_HEADER) && eq(T.Specials[0], L.SPECIALS_HEADER) &&
  eq(T.Roles[0], L.ROLES_HEADER) && eq(T.Routes[0], L.ROUTES_HEADER));
const html = readFileSync(HERE + 'index.html', 'utf8');
// Every google.script.run chain: walk forward from each call site at paren depth 0 — through the
// .with*Handler(...) calls, whose bodies may nest anything — to the first method that is not a with*; the
// gear's members table goes through cfgCall(btn, 'name', args).
function chainEndpoint(src, from) {
  // the chain's text with line comments removed (a handler's comment may hold an unbalanced paren)
  const text = src.slice(from, from + 8000).replace(/\/\/[^\n]*/g, '');
  if (!/^\s*\./.test(text)) return null;                 // a mention in prose, not a call
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && ch === '[') return null;      // run[name].apply(...) — dynamic, covered by cfgCall
    else if (depth === 0 && ch === '.') {
      const m = /^\.([a-zA-Z]\w*)\s*\(/.exec(text.slice(i, i + 60));
      if (m && !/^with/.test(m[1])) return m[1];
    }
  }
  return null;
}
const pageCalls = [...new Set([...html.matchAll(/google\.script\.run/g)].map((m) => chainEndpoint(html, m.index + 17))
  .concat([...html.matchAll(/cfgCall\([^,]+,\s*'([a-zA-Z]+)'/g)].map((m) => m[1])).filter(Boolean))].sort();
check('every google.script.run method the page calls is served by the mock, and every mock method is a vendored endpoint',
  pageCalls.length >= 17 && pageCalls.every((n) => typeof M[n] === 'function') && Object.keys(M).every((n) => typeof L[n] === 'function'),
  'page calls: ' + pageCalls.join(', ') + ' | unserved: ' + pageCalls.filter((n) => typeof M[n] !== 'function').join(', '));

/* ---------- the fixture matches the REAL producer ---------- */
const producerRows = P.assembleTransportationRows(D.producerInputs);
check('the Roster is EXACTLY what the real nightly producer emits for these inputs (Enrichment column included)',
  eq(producerRows, T.Roster) && T.Roster[0][18] === 'Enrichment',
  'first difference at row ' + producerRows.findIndex((r, i) => !eq(r, T.Roster[i])));
check('Early Bird is computed by the producer\'s family rule, not hand-written',
  eq(P.trEarlyBirdSet_(D.producerInputs.gradeById, D.producerInputs.familyById), D.producerInputs.earlyBird));
check('87 fabricated students, one PM row each plus AM and split rows; two K4/K5 children in Afternoon Enrichment',
  Object.keys(D.producerInputs.nameById).length === 87 && T.Roster.length - 1 > 87 &&
  eq(T.Roster.filter((r) => r[18] === 'Y' && r[3] === 'PM').map((r) => r[0]).sort(), ['400122', '400131']));
check('all fifteen tabs the server reads are present, across the four workbooks',
  eq(Object.keys(T).sort(), ['Attendance Today', 'EVENTS', 'Notes', 'Overrides', 'PickupAuth', 'PickupContacts', 'Roles', 'Roster', 'Routes',
    'Schedule', 'Sheet1', 'Specials', 'Staff', 'Standing', 'Walkers']) && Object.keys(X.workbooks).length === 4);
check('every student in the sign-out log, attendance, overrides, notes and walkers is on the roster',
  [...T.EVENTS.slice(1).map((r) => r[3]), ...T['Attendance Today'].slice(1).map((r) => r[0]), ...T.Overrides.slice(1).map((r) => r[1]),
   ...T.Walkers.slice(1).map((r) => r[0]), ...T.Notes.slice(1).map((r) => r[1]), ...Object.keys(D.sportsFeed.students)]
    .every((id) => D.producerInputs.nameById[id]));

/* ---------- the board on the pinned Tuesday, through the REAL server ---------- */
const res = M.dismissalApi('');
const board = res.board, flat = S.dsFlatList(board);
check('the board loads for the pinned school day, stamped by the pinned clock',
  res.ok && res.dayKey === '2026-09-15' && res.dayName === 'Tue' && /^2026-09-15 14:5/.test(res.serverNow) && /^2026-09-15 14:5/.test(res.builtAt));
check('the first read builds and publishes; the second is served from the 3-minute board cache',
  res.freshness.fromCache === false && M.dismissalApi('').freshness.fromCache === true &&
  Object.keys(X.files).some((id) => X.files[id].name === 'Dismissal_RAMP_BOARD.json') &&
  Object.keys(X.files).some((id) => X.files[id].name === 'Transpo_DRIVER_ROUTES.json'));
check('freshness is read off the Drive stamps through the pinned clock: attendance 9 min old, roster at 04:06, not stale',
  res.freshness.syncedAgeMin === 9 && res.freshness.syncedAt === '14:43' && res.freshness.rosterAt === '04:06' &&
  res.freshness.syncStale === false && res.freshness.attendanceOffDay === false && eq(res.freshness.attendanceDates, ['2026-09-15']));
check('the four feeds report in: sign-outs 2 (1 back, 1 planned), schedule KNOWN with no delay, sports feed on with 2 students',
  res.freshness.signOutActive && res.freshness.signOutAvailable && res.freshness.signOutCount === 2 && res.freshness.backCount === 1 &&
  res.freshness.plannedCount === 1 && res.freshness.delay.known === true && res.freshness.delay.minutes === 0 &&
  res.freshness.sports.enabled && res.freshness.sports.available && res.freshness.sports.count === 2, JSON.stringify(res.freshness));
check('every student is counted once, whatever their row count', board.counts.total === 87);
check('lanes are ordered Bus -> Early Bird -> Staff Kid -> Car',
  eq(board.groups.map((g) => g.type).filter((t, i, a) => a.indexOf(t) === i), ['Bus', 'Early Bird', 'Staff Kid', 'Car']));
check('seven bus/van lanes, keyed by the FACTS course title', board.routes.length === 7 && board.routes.every((k) => /Route$/.test(k)));
check('lane sizes match the fabricated enrolment (Tennant Rosalind is Car today, so Jarrettsville shows 8 of 9)',
  (() => { const n = {}; board.groups.filter((g) => g.type === 'Bus').forEach((g) => { n[g.key] = g.rows.length; });
    return n['Jarrettsville Bus Route'] === 8 && n['Edgewood Bus Route'] === 6 && n['Aberdeen/Havre de Grace Route'] === 6 &&
           n['Abingdon Bus Route'] === 5 && n['Bel Air Van Route'] === 5 && n['Cecil County Van Route'] === 4 && n['Street/Pylesville Van Route'] === 5; })(),
  JSON.stringify(board.groups.filter((g) => g.type === 'Bus').map((g) => g.key + '=' + g.rows.length)));

// who NOT to wait for, and the new statuses on the rows
const ne = Object.fromEntries(board.notExpected.map((r) => [r.id, r]));
check('ABSENT excused / unexcused both flag, with the detail',
  ne['400103'] && ne['400103'].reason === 'ABSENT' && /excused — fever/.test(ne['400103'].detail) && ne['400109'] && /unexcused/.test(ne['400109'].detail));
check('LEFT EARLY flags with the reason', ne['400114'] && ne['400114'].reason === 'LEFT EARLY' && /orthodontist/.test(ne['400114'].detail));
check('a mid-day sign-out flags with time and adult', ne['400115'] && ne['400115'].reason === 'SIGNED OUT' && ne['400115'].detail === '13:04 with Marlowe Hesper');
check('a child signed out and signed BACK IN is expected and badged BACK with the time',
  !ne['400126'] && byId(flat, '400126').reason === 'BACK' && byId(flat, '400126').detail === 'returned 11:35');
check('a parent who rang ahead: PICKUP PLANNED on the row, with the time, the reason and the caller — never a departure',
  !ne['400144'] && byId(flat, '400144').reason === 'PICKUP PLANNED' && byId(flat, '400144').detail === '3:10 PM — Dr/Dentist (Kowalczyk Danuta)');
check('the sports feed marks GAME DAY with the posted dismissal; an absent player stays ABSENT',
  byId(flat, '400101').reason === 'GAME DAY' && /Varsity Girls Soccer — posted dismissal 2:00 PM/.test(byId(flat, '400101').detail) &&
  ne['400103'].reason === 'ABSENT');
check('a pickup_flag row and a MISMATCHED early-out are NOT sign-outs — Gaskill Wyatt stays expected', !ne['400140']);
check('the sign-out fold is the app\'s own dsBuildSignedOut over the kiosk\'s real columns (the log now carries planned pickups too)',
  eq(Object.keys(S.dsBuildSignedOut(T.EVENTS, D.demo.date)).sort(), ['400115', '400150']) &&
  eq(Object.keys(S.dsBuildCalledAhead(T.EVENTS, D.demo.date)), ['400144']) &&
  eq(T.EVENTS[0], ['Timestamp', 'Date', 'Type', 'PersonKey', 'GuardianName', 'PickupMatch', 'Reason', 'FlagStatus', 'ExpectedBack']));
check('late arrivals are EXPECTED and badged LATE, never treated as gone',
  !ne['400105'] && byId(flat, '400105').reason === 'LATE' && !ne['400111'] && byId(flat, '400111').reason === 'LATE');
check('exactly the seven intended students are flagged',
  eq(Object.keys(ne).sort(), ['400103', '400109', '400114', '400115', '400150', '400157', '400162']), JSON.stringify(Object.keys(ne).sort()));
check('the office\'s standing NOTES ride on the row — active ones only, the removed one gone',
  byId(flat, '400118').notes.length === 1 && /Grandma/.test(byId(flat, '400118').notes[0].text) && byId(flat, '400140').notes.length === 1 &&
  !flat.some((r) => r.notes.some((n) => /inhaler/.test(n.text))));
check('Afternoon Enrichment is carried on the two K4/K5 children and nobody else',
  eq(flat.filter((r) => r.enrichment).map((r) => r.id).sort(), ['400122', '400131']));

// the four lanes and the producer's edge cases
const type = (id) => byId(flat, id).type;
check('an AM-only rider is Car on the PM board, not waited for at a bus', type('400138') === 'Car');
check('a different route each way: PM lane is Bel Air, not Cecil County', byId(flat, '400139').routeCodes[0] === 'BA' && byId(flat, '400139').routes.length === 1);
check('split custody: on BOTH drivers\' lists, one ramp row carrying both routes and the SPLIT flag',
  board.groups.filter((g) => g.rows.some((r) => r.id === '400121')).length === 2 && eq(byId(flat, '400121').routeCodes, ['J', 'SP']) && byId(flat, '400121').split === true);
check('Early Bird is the seven children whose EVERY sibling is in grades 1-3',
  eq(flat.filter((r) => r.type === 'Early Bird').map((r) => r.id).sort(), ['400162', '400163', '400164', '400165', '400166', '400167', '400168']));
check('a K5 sibling blocks the family (Kirkwood Bram is Car), and Bus beats Early Bird (Tennant Rosalind)',
  type('400113') === 'Car' && T.Roster.find((r) => r[0] === '400118' && r[3] === 'PM')[4] === 'Bus');
check('Car rows are marked ASSUMED (residual-default), never mistaken for recorded data', T.Roster.filter((r) => r[4] === 'Car').every((r) => r[16] === 'residual-default'));
check('staff kids: walk to the HS / same building / Unresolved / to Elementary / to Kindergarten',
  byId(flat, '400150').walkTo === 'High School' && byId(flat, '400154').walkTo === '' && byId(flat, '400155').walkTo === 'Unresolved' &&
  byId(flat, '400153').walkTo === 'Elementary' && byId(flat, '400159').walkTo === 'Kindergarten');
check("a STANDING answer overrides the derivation: the driver's child is Car, badge data on, no TODAY stamp",
  (() => { const c = byId(flat, '400156'); return !!c && c.type === 'Car' && c.standing === true && c.overridden === false && /AM van route/.test(c.standingNote) && c.routes.length === 0; })());
check('a standing row with Days (Fridays only) sits in standingRows for the card but does not touch Tuesday',
  res.standingRows['400130'] && eq(res.standingRows['400130'][0].days, ['Fri']) && byId(flat, '400130').type === 'Bus' && byId(flat, '400130').standing === false);
check('approved walkers are MARKED on the ramp rows — every one of the 8 carries a destination or a reason',
  (() => { const w = flat.filter((r) => r.walkUp); return w.length === 8 && w.every((r) => r.walkUpWalking ? true : !!r.walkUpWhy); })());
check('6th-grade pickup follows the siblings: EL with an EL-side sibling, HS otherwise',
  byId(flat, '400132').pickup === 'EL' && byId(flat, '400170').pickup === 'EL' && byId(flat, '400117').pickup === 'HS' &&
  byId(flat, '400143').pickup === 'HS' && byId(flat, '400181').pickup === 'HS');

// today-only changes
const ros = byId(flat, '400118');
check('Bus -> Car override: the bus is GONE from her row, and who she is handed to rides with it',
  ros.type === 'Car' && ros.routes.length === 0 && ros.overridden === true && ros.overrideDestination === 'Tennant, Beatrix (Grandmother)' &&
  ros.overrideBy === 'office.demo@example.edu' && ros.overrideAt === '13:02');
check('Staff Kid -> Car override recorded at the ramp shows the TODAY badge data', type('400154') === 'Car' && byId(flat, '400154').overridden === true);
check('a change planned for Friday does not touch Tuesday\'s board', byId(flat, '400110').overridden === false && byId(flat, '400110').type === 'Bus');

// routes: the stick colour and who is driving
check('all seven routes resolve by CODE to a colour the page can render',
  Object.keys(res.routes).length === 7 && flat.filter((r) => r.type === 'Bus').every((r) => r.routeCodes.every((c, i) =>
    S.dsRouteFor(res.routes, c, r.routes[i]) && S.dsRouteFor(res.routes, c, r.routes[i]).colour)));
check('the FACTS title joins to the office short name: "Jarrettsville Bus Route" + J -> Purple',
  S.dsRouteFor(res.routes, 'J', 'Jarrettsville Bus Route').colour === 'Purple' && S.dsRouteFor(res.routes, 'J', 'Jarrettsville Bus Route').name === 'Jarrettsville');
check('TUESDAY: Aberdeen/Havre de Grace has NO PM driver listed — the gap is shown, not hidden',
  S.dsDriversFor(res.routes['A/HdG'], 'PM', res.dayName).length === 0 && S.dsDriversFor(res.routes['A/HdG'], 'PM', 'Mon').length === 1 &&
  S.dsDriversFor(res.routes['A/HdG'], 'PM', 'Fri').length === 2);

// the walk-up list
const w = res.walkUp;
check('walk-up list: everyone approved appears every day, 8 on the list', w.counts.onList === 8 && w.rows.length === 8 && w.dayName === 'Tue');
check('Tuesday: 4 walking, 4 not (going by car on a standing row · signed out · absent · Occasional not confirmed)',
  w.counts.walking === 4 && w.counts.notWalking === 4 && w.rows.find((r) => r.id === '400156').kind === 'GOING BY CAR' &&
  w.rows.find((r) => r.id === '400150').kind === 'SIGNED OUT' && w.rows.find((r) => r.id === '400157').kind === 'ABSENT' &&
  w.rows.find((r) => r.id === '400161').kind === 'NOT TODAY', JSON.stringify(w.counts));
check('an Occasional walker confirmed by today\'s override IS walking, and the change is stamped',
  (() => { const r = w.rows.find((x) => x.id === '400160'); return r.walking === true && r.overridden === true && r.overrideBy === 'walkup.demo@example.edu'; })());
check('a specific hand-over destination is carried ("to Dad")', w.rows.find((r) => r.id === '400152').destination === 'to Dad');

/* ---------- the Friday time-travel (?sim= reaches the SERVER, as in production) ---------- */
const fri = M.dismissalApi(D.demo.fridaySim);
const fw = fri.walkUp, fflat = S.dsFlatList(fri.board);
check('?sim= moves the board to Friday and echoes the simulated clock; a sim read is never served from cache',
  fri.dayName === 'Fri' && fri.dayKey === '2026-09-18' && fri.sim === D.demo.fridaySim && !fri.freshness.fromCache);
check('FRIDAY: the Art child is IN A SPECIAL (from the office\'s Specials tab), already up by the HS',
  (() => { const r = fw.rows.find((x) => x.id === '400151'); return r.walking === false && r.kind === 'IN A SPECIAL' && /Art/.test(r.why) && /already up by the HS/.test(r.why); })());
check('FRIDAY: a standing exception destination says where the child goes instead',
  (() => { const r = fw.rows.find((x) => x.id === '400156'); return r.walking === false && r.destination === 'to their own classroom'; })());
check('FRIDAY: the Fridays-only standing row applies (Pippa is Car), and the change PLANNED for Friday is on her row',
  byId(fflat, '400130').type === 'Car' && byId(fflat, '400130').standing === true &&
  byId(fflat, '400110').type === 'Car' && byId(fflat, '400110').overridden === true && /dentist/.test(byId(fflat, '400110').overrideNote));
check('Tuesday\'s override does not leak into Friday; attendance and sign-outs are always TODAY\'s (the server reads the real clock for those)',
  !byId(fflat, '400118').overridden && fw.rows.find((r) => r.id === '400160').kind === 'NOT TODAY' &&
  fw.rows.find((r) => r.id === '400150').kind === 'SIGNED OUT' && fri.board.notExpected.some((r) => r.id === '400103'));
check('FRIDAY: the double-covered route lists two drivers', S.dsDriversFor(fri.routes['A/HdG'], 'PM', 'Fri').length === 2);

/* ---------- the planned list and the per-child history ---------- */
const planned = M.plannedApi('');
check('plannedApi lists the changes recorded for LATER days, with the grade joined from the roster',
  planned.ok && planned.todayKey === '2026-09-15' && planned.rows.length === 1 && planned.rows[0].id === '400110' &&
  planned.rows[0].date === '2026-09-18' && planned.rows[0].grade === '8' && planned.perm.isAdmin === true);
const hist = M.historyApi('400118', '');
check('historyApi returns everything ever recorded for one child: the change with its Entered stamp, who won, and the authorizations',
  hist.ok && hist.changes.length === 1 && hist.changes[0].won === true && hist.changes[0].entered === '2026-09-15 13:02' &&
  hist.changes[0].when === 'today' && M.historyApi('400156', '').auths.length === 1);

/* ---------- who the demo visitor is, and what they may do ---------- */
const perm = res.perm;
check('the demo sign-in is an Admin who is also the 3rd-grade homeroom teacher',
  perm.isAdmin && perm.canManageRoles && perm.teacherName === 'Sowell Gina' && perm.adminOf.length === S.DS_ROLES.length);
check('Teacher is IMPLICIT: holding a homeroom on the roster grants it with no Roles-tab row',
  perm.teacherImplicit === true && perm.roles.indexOf('Teacher') !== -1 && !T.Roles.some((r) => r[0] === 'Teacher' && r[1] === D.demo.email));
check('"My class" is her ten 3rd graders; a co-teacher\'s "My grade" widens past their own homeroom',
  S.dsScopeRows(flat, 'Sowell Gina', 'class').length === 10 && S.dsScopeRows(flat, 'Quon Beatrix', 'class').length < S.dsScopeRows(flat, 'Quon Beatrix', 'grade').length);
const quon = S.dsPermissions('b.quon@example.edu', S.dsBuildRoles(T.Roles), 'Quon Beatrix', S.dsHomeroomTeacherSet(S.dsBuildRoster(T.Roster)));
check('a homeroom teacher with NO Roles row holds the Teacher role but may change nobody, own class included',
  quon.teacherImplicit === true && !quon.canChangeAnyone && !S.dsCanChange(quon, byId(flat, '400115'), false).ok &&
  !S.dsCanChange(quon, byId(flat, '400113'), false).ok && /office/.test(S.dsCanChange(quon, byId(flat, '400115'), false).why));
check('the allowlist admits the demo account without a directory lookup (AdminDirectory is never consulted)',
  X.props.ALLOWED_EMAILS === D.demo.email && !throws(() => M.pickupsApi(), /./));

/* ---------- the student card ---------- */
const pk = M.pickupsApi();
check('pickup contacts are trimmed to enrolled students, in FACTS sort order',
  eq(pk['400101'].map((p) => p[1]), ['Mother', 'Father', 'Grandparent']) && pk['400101'][0][0] === 'Alderman, Priya');
check('a student with NO contacts recorded is stated, not shown as a failed load',
  S.dsStudentCard('400180', flat, pk).hasPickups === false && S.dsStudentCard('400180', flat, pk).pickupsLoaded === true);
check('siblings resolve from the flat list with their route codes',
  (() => { const c = S.dsStudentCard('400106', flat, pk); return c.siblings.length === 1 && c.siblings[0].id === '400107' && eq(c.siblings[0].routeCodes, ['SP']); })());
check('the override destination offered for Rosalind is one of her authorised contacts', pk['400118'].some((p) => p[0] === 'Tennant, Beatrix'));
const contacts = M.pickupAuthContacts('400156').contacts;
check('the authorization dialog lists who asked, with the guardian email joined from the staging roster',
  contacts.length === 2 && /Ashby, Wendell \(Father\) — w\.ashby@example\.edu/.test(contacts[0].label));

/* ---------- the WRITES, through the real endpoints over the in-memory Sheets ---------- */
const dm = X.workbooks['dismissal-demo'];
const tab = (n) => dm.getSheetByName(n).getDataRange().getValues();
const after = M.setOverrides('400140', 'Car', '', 'nan collecting', '', 'Gaskill, Tabitha (Mother)', null);
check('setOverrides appends a stamped row (with Entered) and returns the re-built, re-published board',
  after.ok && eq(after.plannedDates, ['2026-09-15']) && byId(S.dsFlatList(after.board), '400140').type === 'Car' &&
  byId(S.dsFlatList(after.board), '400140').overrideBy === D.demo.email && !after.freshness.fromCache &&
  (() => { const r = tab('Overrides').slice(-1)[0]; return r[1] === '400140' && r[6] === D.demo.email && /^2026-09-15 14:5\d$/.test(r[9]); })());
check('setOverrides refuses a bad type and a weekend plan',
  throws(() => M.setOverrides('400140', 'Helicopter', '', '', '', '', null), /Type must be/) &&
  throws(() => M.setOverrides('400140', 'Car', '', '', '', '', ['2026-09-19']), /weekend/));
check('a plan for next Wednesday lands in plannedApi, and cancelling it ("Usual") takes it back off',
  M.setOverrides('400144', 'Car', '', 'ortho', '', 'Kowalczyk, Danuta (Mother)', ['2026-09-23']).plannedDates[0] === '2026-09-23' &&
  M.plannedApi('').rows.some((r) => r.id === '400144' && r.date === '2026-09-23' && r.type === 'Car') &&
  M.setOverrides('400144', 'Usual', '', 'plan cancelled', '', '', ['2026-09-23']).ok &&
  !M.plannedApi('').rows.some((r) => r.id === '400144' && r.type === 'Car'));
const st = M.setStanding('400118', [{ type: 'Car', routeCode: '', destination: 'Tennant, Beatrix (Grandmother)', note: 'Wednesdays: grandma', days: ['Wed'], every: '', from: '' }], '');
check('setStanding rewrites ONE child\'s rows and leaves the others (the Standing tab is re-written whole, 11 columns wide)',
  st.ok && st.standingSaved.length === 1 && eq(st.standingRows['400118'][0].days, ['Wed']) && st.standingRows['400156'] && st.standingRows['400130'] &&
  tab('Standing').length === 4 && tab('Standing').every((r) => r.length === 11));
const rm = M.removeWalker('400161', '');
check('removeWalker is a SOFT delete: Status Removed with who and when, and the list drops to 7',
  rm.ok && rm.walkUp.counts.onList === 7 && (() => { const r = tab('Walkers').find((x) => x[0] === '400161'); return r[13] === 'Removed' && r[11] === D.demo.email && /^2026-09-15/.test(r[12]); })());
const sw = M.setWalker('400161', { frequency: 'Daily', destination: 'to the HS lobby', exceptDay: '', exceptReason: '', exceptDestination: '', note: '', onlyDays: '' }, '');
check('setWalker puts the child back on the list, Daily, and the board marks her walking again',
  sw.ok && sw.walkerSaved.frequency === 'Daily' && sw.walkUp.counts.onList === 8 && sw.walkUp.rows.find((r) => r.id === '400161').walking === true);
check('setWalker refuses a child who is not on the roster and a frequency it does not know',
  throws(() => M.setWalker('499999', { frequency: 'Daily' }, ''), /not on the current roster/) &&
  throws(() => M.setWalker('400161', { frequency: 'Sometimes' }, ''), /Daily or Occasional/));
const na = M.noteAdd('400101', 'Walks to the lot with her brother.', '');
const noteId = tab('Notes').slice(-1)[0][0];
check('noteAdd appends an Active note that rides on the row; noteDelete marks it Removed and takes it off',
  na.ok && byId(S.dsFlatList(na.board), '400101').notes.length === 1 && noteId.length === 8 &&
  byId(S.dsFlatList(M.noteDelete(noteId, '').board), '400101').notes.length === 0 && tab('Notes').find((r) => r[0] === noteId)[4] === 'Removed' &&
  throws(() => M.noteAdd('400101', '', ''), /Type the note/));
const pa = M.pickupAuthSave({ studentId: '400118', people: [{ name: 'Tennant, Beatrix', rel: 'Grandmother' }], start: '2026-09-15', end: '2026-09-16',
  method: 'Email', note: 'grandparents\' week', requestedIdx: 0, requestedLabel: M.pickupAuthContacts('400118').contacts[0].label }, '');
check('pickupAuthSave writes the rows with who asked, and the confirmation goes to the requester and the office mailbox',
  pa.ok && pa.authId.length === 8 && pa.mail.sent === true && pa.mail.to.indexOf('office.demo@example.edu') !== -1 && pa.mail.only &&
  byId(S.dsFlatList(pa.board), '400118').pickupAuth.length === 1 && X.outbox.length === 1 && /Tennant/.test(X.outbox[0].body) &&
  (() => { const r = tab('PickupAuth').find((x) => x[0] === pa.authId); return r && r[9] === 'Active' && r[14] && /@/.test(r[15]); })());
const pd = M.pickupAuthDelete(pa.authId, '');
check('pickupAuthDelete retires the rows (Deleted, by whom, when) and mails the same requester',
  pd.ok && pd.mail.sent === true && pd.mail.only === pa.mail.only && X.outbox.length === 2 &&
  tab('PickupAuth').find((x) => x[0] === pa.authId)[9] === 'Deleted' && byId(S.dsFlatList(pd.board), '400118').pickupAuth.length === 0 &&
  throws(() => M.pickupAuthDelete(pa.authId, ''), /no longer exists/));
check('pickupAuthSave refuses a missing name and an end before the start',
  throws(() => M.pickupAuthSave({ studentId: '400118', people: [], start: '2026-09-15', end: '2026-09-15', method: 'Email' }, ''), /At least one name/) &&
  throws(() => M.pickupAuthSave({ studentId: '400118', people: [{ name: 'X Y', rel: 'Aunt' }], start: '2026-09-16', end: '2026-09-15', method: 'Email' }, ''), /before the start/));

// views and roles
const roles = M.rolesApi();
check('the settings gear sees every role\'s members and the shared Ramp view',
  roles.members.length === T.Roles.length - 1 && roles.views.Ramp && roles.views.Ramp.savedBy === 'ramp.lead@example.edu');
check('the gear gets the staff DIRECTORY: active people on the school domain, sorted, name + email only',
  roles.staff.length > 0 && roles.staff.every((s) => /@example\.edu$/.test(s.email) && Object.keys(s).length === 2) &&
  !roles.staff.some((s) => /Quill/.test(s.name)) && roles.staff.some((s) => s.email === D.demo.email) &&
  eq(roles.staff.map((s) => s.name), roles.staff.map((s) => s.name).slice().sort()));
check('typing a name in the add box resolves to ONE person, or says why not',
  S.dsResolveStaff(roles.staff, 'quon').email === 'b.quon@example.edu' && S.dsResolveStaff(roles.staff, 'Gina Sowell').email === D.demo.email &&
  /people match/.test(S.dsResolveStaff(roles.staff, 'ma').error || '') && /Nobody on staff/.test(S.dsResolveStaff(roles.staff, 'zzz').error || ''));
check('a duplicate member and the last Admin are both refused',
  throws(() => M.addRoleMember('Ramp', 'ramp.lead@example.edu', false, ''), /already in/) && throws(() => M.removeRoleMember('Admin', D.demo.email), /last Admin/));
check('adding then removing a member round-trips through rolesApi and the Roles tab',
  M.addRoleMember('Ramp', 'cover.demo@example.edu', false, '').members.some((m) => m.email === 'cover.demo@example.edu') &&
  tab('Roles').some((r) => r[1] === 'cover.demo@example.edu') &&
  !M.removeRoleMember('Ramp', 'cover.demo@example.edu').members.some((m) => m.email === 'cover.demo@example.edu') &&
  !tab('Roles').some((r) => r[1] === 'cover.demo@example.edu'));
check('a saved personal view is a script property and wins over any team view on the next load',
  M.saveView({ mode: 'ramp', types: ['Bus'], grades: ['3'] }).types[0] === 'Bus' && M.dismissalApi('').viewFrom === 'personal' &&
  JSON.parse(X.props['view:' + D.demo.email]).grades[0] === '3' && M.saveView(null) === null && M.dismissalApi('').viewFrom !== 'personal');
check('saveRoleView records the role\'s shared filters with who saved them',
  M.saveRoleView('Office', { mode: 'explore', grades: ['K4', 'K5'] }).savedBy === D.demo.email && JSON.parse(X.props.ROLE_VIEWS).Office.grades.length === 2);

/* ---------- persistence: a reload sees the writes ---------- */
const again = boot(session);
const r2 = again.M.dismissalApi('');
check('after a reload the writes are still there (sessionStorage): the override, the standing row, the walker, the role view',
  byId(again.S.dsFlatList(r2.board), '400140').type === 'Car' && r2.standingRows['400118'] && r2.walkUp.counts.onList === 8 &&
  JSON.parse(again.X.props.ROLE_VIEWS).Office.mode === 'explore' && again.X.outbox.length === 2);
check('a fresh session starts from the dataset', !byId(boot(makeSession()).S.dsFlatList(boot(makeSession()).M.dismissalApi('').board), '400140').overridden);

/* ---------- the page itself ---------- */
check('no unreplaced Apps Script template tokens', !/<\?[=!]?[\s\S]*?\?>/.test(html));
check('logic.js loads in <head> before the shim, data and mock, with the title the server sets',
  (() => { const head = html.slice(0, html.indexOf('<body>'));
    const at = (s) => head.indexOf(s);
    return at('<title>HCS Dismissal</title>') !== -1 && at('src="logic.js"') !== -1 && at('src="logic.js"') < at('gsr-shim.js') &&
           at('gsr-shim.js') < at('src="data.js"') && at('src="data.js"') < at('src="mock.js"'); })());
check('the app\'s own logic is inlined (DismissalClient), not reimplemented',
  /GENERATED from Dismissal\.gs/.test(html) && /function dsBuildBoard\(/.test(html) && /function dsWalkUpList\(/.test(html));
check('?sim= is wired to the URL with the server\'s own sanitiser, and the Campus Presence link points at the sibling demo',
  /var SIM = \(new URLSearchParams\(location\.search\)\.get\('sim'\) \|\| ''\)\.replace\(/.test(html) &&
  /var PRESENCE_URL = '\.\.\/campus-presence\/index\.html';/.test(html));
check('all seven stick colours are in the page\'s chip palette',
  ['white', 'orange', 'pink', 'purple', 'red', 'green', 'blue'].every((c) => new RegExp('\\b' + c + ':\\s*\\{ bg:').test(html)));

// The app's two blank-page gates, applied to the BUILT page (from FACTS/transportation/tools/test-dismissal.mjs).
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
let synOk = true, synWhy = '';
try { new Function(blocks[blocks.length - 1][1]); } catch (e) { synOk = false; synWhy = e.message; }
check('the page script parses as JavaScript', synOk, synWhy);
const defined = new Set([...html.matchAll(/\bid="([A-Za-z_][\w-]*)"/g)].map((m) => m[1]));
const missing = [...html.matchAll(/(?:\$|getElementById)\(\s*'([A-Za-z_][\w-]*)'\s*\)/g)].map((m) => m[1]).filter((id, i, a) => !defined.has(id) && a.indexOf(id) === i);
check('every literal $(id) in the page resolves to an element', missing.length === 0, 'missing: ' + missing.join(', '));

// privacy
const all = html + logicJs + readFileSync(HERE + 'data.js', 'utf8') + readFileSync(HERE + 'mock.js', 'utf8');
check('no real spreadsheet ids, deployment ids, urls or the real domain leaked', !/AKfycb|docs\.google\.com\/spreadsheets|1[A-Za-z0-9_-]{30,}|harfordchristian\.org/i.test(all));
check('staff first names and real families in the source comments were scrubbed to their roles — page AND bundle',
  !/Angela|Becky|Charlie Huber|Coreen|Jenni\b|Heather|Siverd|Boehm|Hodgson|Corrado|Manogue|Renwick|Kline/.test(all) &&
  /the ramp lead/.test(html) && /the walk-up chaperone/.test(html) && /the office manager/.test(logicJs) && !/NAME RESOLUTION, done once/.test(logicJs));
check('every phone number in the dataset is a fictional 555 number', [...all.matchAll(/\b\d{3}-\d{3}-\d{4}\b/g)].every((m) => /^\d{3}-555-/.test(m[0])));

// the page is a fresh build of the CURRENT source — a stale demo is the failure this catches
try {
  const cfg = JSON.parse(readFileSync(HERE + 'build.json', 'utf8'));
  mkdirSync(ROOT + '.tmp', { recursive: true });
  const tmpCfg = ROOT + '.tmp/verify-transportation.json', tmpOut = ROOT + '.tmp/verify-transportation.html';
  writeFileSync(tmpCfg, JSON.stringify({ ...cfg, dst: tmpOut }));
  execFileSync(process.execPath, [ROOT + 'tools/build-demo.mjs', tmpCfg], { cwd: ROOT, stdio: 'pipe' });
  check('index.html is what build-demo.mjs produces from the current source (not stale)', readFileSync(tmpOut, 'utf8') === html,
    'rebuild: node demos/transportation/build-logic.mjs && node tools/build-demo.mjs demos/transportation/build.json');
} catch (e) {
  check('index.html could be rebuilt from build.json', false, e.message);
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
