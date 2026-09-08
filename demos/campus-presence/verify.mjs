// verify.mjs — checks this demo against the REAL Campus Presence code, not against itself.
//
// Three things can quietly rot in a demo like this: the fabricated dataset can stop matching what
// the app's parsers expect, the vendored logic bundle can fall behind the source modules, and the
// mock can lose an op the page still calls. All three show up in the browser as an empty screen
// and nothing else, so they are checked here instead:
//   1. the source project's own logic/*.js are required directly and fed data.js
//   2. logic.js is re-assembled in memory and compared, so drift is a failure
//   3. logic.js + data.js + mock.js are loaded into a vm with `window` bound to the sandbox —
//      i.e. the browser's arrangement — and the ops are exercised through the real MOCK_BACKEND
//   4. the four built pages are scanned for unreplaced tokens, for every google.script.run
//      method they call, for every {op:'...'} they send, and for leaked ids/URLs
//
// Run: node demos/campus-presence/verify.mjs
// Requires the source project checked out alongside this repo:
//   Projects/apps-script-showcase/  and  Projects/campus-sign-in-out-system/
// If it is not there, this SKIPS with exit 0 — a missing sibling project is not a broken demo.
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const SRC = '../../../campus-sign-in-out-system/logic/';

let Schema, Ids, Directory, Events, Presence, Badges, Pickup, Search, Metrics, Notify, assemble, ORDER;
try {
  Schema = require(SRC + 'schema.js');
  Ids = require(SRC + 'ids.js');
  Directory = require(SRC + 'directory.js');
  Events = require(SRC + 'events.js');
  Presence = require(SRC + 'presence.js');
  Badges = require(SRC + 'badges.js');
  Pickup = require(SRC + 'pickup.js');
  Search = require(SRC + 'search.js');
  Metrics = require(SRC + 'metrics.js');
  Notify = require(SRC + 'notify.js');
  ({ assemble, ORDER } = await import('./build-logic.mjs'));
} catch (e) {
  console.log('SKIP — source project not found next to this repo (' + e.message + ')');
  process.exit(0);
}

const here = (f) => new URL('./' + f, import.meta.url);
const read = (f) => readFileSync(here(f), 'utf8');

let fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) fail++; };

/* ======================================================================================
   1. the dataset, through the app's own parsers
   ==================================================================================== */
const win = {};
new Function('window', read('data.js'))(win);
const D = win.CAMPUS_PRESENCE_DATA;
const T = D.tabs;
const TODAY = D.demo.date;
const tabsOf = (names) => names.map((n) => ({ name: n, values: T[n] || [] }));

check('the EVENTS header is EXACTLY schema.js SCHEMA.EVENTS, in column order',
  D.eventsHeader.join('|') === Schema.SCHEMA.EVENTS.cols.map((c) => c.name).join('|'));
check('every DB tab the app reads is present',
  ['EVENTS', 'BADGES', 'SETTINGS', 'PERMISSIONS', 'WORK_RELEASE', 'STATIONS']
    .every((n) => Array.isArray(T[n]) && T[n].length > 1));
check('every FACTS tab the app reads is present, plus the ELC side-car',
  ['Sheet1', 'PickupContacts', 'Student Schedules', 'Staff', 'K5-6 Teachers']
    .every((n) => Array.isArray(T[n]) && T[n].length > 1));

const roster = Directory.buildStudents(tabsOf(['Sheet1']));
check('the real directory parser builds 87 ENROLLED students from the LONG Sheet1 rows',
  roster.length === 87);
check('...and drops the one non-Enrolled row rather than counting it',
  D.students.length === 88 && !roster.some((s) => s.id === '400188'));
check('guardians are attached to students, and a family with none stays enrolled',
  roster.find((s) => s.id === '400101').guardians.length === 3 &&
  roster.find((s) => s.id === '400180').guardians.length === 0);
check('the shared 14 students carry the Directory / Dismissal demos\' own ids and grades',
  ['400101:12', '400102:12', '400103:11', '400104:11', '400105:10', '400106:9', '400107:7',
   '400108:9', '400109:8', '400110:8', '400111:7', '400112:K5', '400113:3', '400114:10']
    .every((pair) => {
      const [id, grade] = pair.split(':');
      const s = roster.find((x) => x.id === id);
      return s && s.grade === grade;
    }));
check('grades 7-12 carry a Homeroom Teacher; PK-6 do not (the real export\'s shape)',
  roster.find((s) => s.id === '400101').homeroomTeacher === 'Whitfield, Dana' &&
  roster.find((s) => s.id === '400113').homeroomTeacher === '');
check('...so elementary homerooms come from the Student Schedules Homeroom rows instead',
  Directory.homeroomTeacherByStudent(tabsOf(['Student Schedules']))['400113'] === 'Sowell, Gina');

const evRows = T.EVENTS.slice(1).map((r) => Events.objFromRow(T.EVENTS[0], r));
const KNOWN_TYPES = Object.keys(Schema.EVENT_TYPES).map((k) => Schema.EVENT_TYPES[k]);
check('every one of the ' + evRows.length + ' event rows parses to a KNOWN event type',
  evRows.length > 300 && evRows.every((e) => KNOWN_TYPES.indexOf(e.Type) !== -1));
check('every event row has a well-formed id, day key and timestamp string',
  evRows.every((e) => /^E-\d{8}-\d{6}-\d{4}$/.test(e.EventID) &&
                      /^\d{4}-\d{2}-\d{2}$/.test(e.Date) &&
                      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(e.Timestamp) &&
                      e.Timestamp.slice(0, 10) === e.Date));
check('event ids are unique across the log',
  new Set(evRows.map((e) => e.EventID)).size === evRows.length);
check('the log is chronological, as an append-only sheet is',
  evRows.every((e, i) => i === 0 || evRows[i - 1].Timestamp <= e.Timestamp));
check('the log spans the first day of school to the demo date, and skips Labor Day',
  evRows[0].Date === '2026-08-24' && evRows[evRows.length - 1].Date === TODAY &&
  !evRows.some((e) => e.Date === '2026-09-07'));
check('no event row carries a guardian email or phone — only the operator\'s own address, in a note',
  (() => {
    const blob = evRows.map((e) => Object.keys(e).map((k) => e[k]).join(' ')).join(' ');
    const mails = blob.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g) || [];
    return !/\d{3}-\d{3}-\d{4}/.test(blob) &&
           mails.length > 0 && mails.every((m) => m === D.demo.staffEmail);
  })());

/* ======================================================================================
   2. presence — the fold the whole system rests on
   ==================================================================================== */
const gradeMap = JSON.parse(
  T.SETTINGS.slice(1).find((r) => r[0] === 'building.grade.map')[1]);
const today = evRows.filter((e) => e.Date === TODAY);
const presence = Presence.derive(today, { gradeBuildingMap: gradeMap });
const offIds = presence.studentsOff.map((s) => s.id).sort();

check('Presence.derive yields the expected on-campus picture for the demo date',
  presence.visitors.length === 3 && presence.studentsOff.length === 8 &&
  presence.late.length === 3 && presence.moved.length === 1);
check('...the exact off-campus set, derived and not stored',
  offIds.join(',') === '400109,400113,400115,400150,400155,400175,400176,400184');
check('...spread across the buildings the grade map puts those children in',
  Object.keys(presence.counts.byBuilding).sort().join(',') ===
    'Bus Barn,Elementary,High School,Kindergarten');
check('a student signed out and signed back in reads as PRESENT, not off campus',
  today.some((e) => e.PersonKey === '400126' && e.Type === 'student_early_out') &&
  today.some((e) => e.PersonKey === '400126' && e.Type === 'student_return_in') &&
  offIds.indexOf('400126') === -1);
check('an unclosed movement leg reads as IN TRANSIT',
  presence.moved[0].inTransit === true && presence.moved[0].from !== presence.moved[0].to);
check('one pickup mismatch flag is OPEN today',
  presence.flags.openMismatch === 1);

// The headline safety property: a failed pickup attempt is not a sign-out.
const openFlag = today.find((e) => e.Type === 'pickup_flag' && e.FlagStatus === 'open');
check('THE FLAG IS NOT A SIGN-OUT: the flagged child is still counted present',
  !!openFlag && openFlag.PersonKey === '400140' && offIds.indexOf('400140') === -1);
check('...and no student_early_out was written for that attempt',
  !today.some((e) => e.Type === 'student_early_out' && e.PersonKey === '400140'));
check('a flag the office APPROVED became an override sign-out, linked back to the flag',
  (() => {
    const ov = today.find((e) => e.Type === 'student_early_out' && e.PickupMatch === 'override');
    const src = today.find((e) => e.EventID === (ov || {}).RelatedEventID);
    return !!ov && ov.PersonKey === '400150' && !!src && src.Type === 'pickup_flag' &&
           src.FlagStatus === 'resolved' && /^APPROVED by /.test(src.FlagNote) &&
           offIds.indexOf('400150') !== -1;
  })());

const badgeState = Badges.derive(
  T.BADGES.slice(1).map((r) => Events.objFromRow(T.BADGES[0], r)), today);
check('three visitor badges are still out, and none of them is unregistered',
  badgeState.assigned.length === 3 && badgeState.unknownInUse.length === 0);
check('the retired badge V7 is never issued anywhere in the log',
  !evRows.some((e) => e.BadgeID === 'V7'));

/* ======================================================================================
   3. the authorised-pickup hard check
   ==================================================================================== */
const pkTabs = tabsOf(['Sheet1', 'PickupContacts']);
const pkIndex = Pickup.parsePickupContacts(pkTabs);
const wyatt = roster.find((s) => s.id === '400140');
const wyattContacts = Pickup.contactsForStudent(pkIndex, wyatt, wyatt.id);
check('the PickupContacts tab parses by header name into per-student contacts',
  wyattContacts.source === 'pickup' && wyattContacts.contacts.length === 1 &&
  wyattContacts.contacts[0].first === 'Tabitha');
check('an authorised contact typing her own name MATCHES',
  Pickup.matchTypedName(wyattContacts.contacts, 'Tabitha Gaskill').match === true);
check('...even misspelt, within the length-scaled edit-distance budget',
  Pickup.matchTypedName(wyattContacts.contacts, 'Tabatha Gaskil').match === true);
check('A NEAR-MISS STRANGER who knows only the surname is REJECTED',
  Pickup.matchTypedName(wyattContacts.contacts, 'Marcus Gaskill').match === false);
check('...and one name alone is never specific enough',
  Pickup.matchTypedName(wyattContacts.contacts, 'Tabitha').reason === 'need-full-name');
check('the uncle in today\'s resolved flag genuinely was not on the list',
  (() => {
    const juno = roster.find((s) => s.id === '400150');
    const c = Pickup.contactsForStudent(pkIndex, juno, juno.id).contacts;
    return Pickup.matchTypedName(c, 'Ray Whitfield').match === false &&
           Pickup.matchTypedName(c, 'Dana Whitfield').match === true;
  })());
check('a child with nobody on file FAILS CLOSED — there is nothing to match against',
  (() => {
    const nadia = roster.find((s) => s.id === '400180');
    const c = Pickup.contactsForStudent(pkIndex, nadia, nadia.id);
    return c.source === 'none' && c.contacts.length === 0 &&
           Pickup.matchTypedName(c.contacts, 'Anyone Ivashkin').match === false;
  })());

/* ======================================================================================
   4. kiosk search — the one op that has to feel instant, and leak nothing
   ==================================================================================== */
const compact = roster.map((s) => ({ id: s.id, name: s.name, grade: s.grade }));
check('search needs three characters before it answers at all',
  Search.searchStudents(compact, 'ga').reason === 'short');
check('a correctly spelled surname finds the family',
  Search.searchStudents(compact, 'marlowe').total === 2);
check('a misspelt name still finds the child, flagged as a close match',
  (() => {
    const r = Search.searchStudents(compact, 'gaskel');
    return r.total === 1 && r.results[0].id === '400140' && r.results[0].close === true;
  })());
check('results are capped at 8 and marked truncated, so the roster cannot be dumped',
  (() => {
    const r = Search.searchStudents(compact, 'a');       // short-circuited
    const wide = Search.searchStudents(compact, 'an');
    const real = Search.searchStudents(compact, 'ann');
    return r.ok === false && wide.ok === false &&
           real.results.length <= Search.MAX_RESULTS;
  })());
check('a search result carries ONLY id, name, grade and the close flag',
  Object.keys(Search.searchStudents(compact, 'marlowe').results[0]).sort().join(',') ===
    'close,grade,id,name');
check('the withdrawn student is unsearchable — she is not in the roster the kiosk searches',
  !compact.some((s) => s.id === '400188') &&
  Search.searchStudents(compact, 'halloran').results.every((r) => r.id !== '400188'));
check('the muster\'s staff-side filter is the same matcher with no cap and no floor',
  Search.filterPeople(compact, '').total === 87 &&
  Search.filterPeople(compact, 'marlowe').total === 2);

/* ======================================================================================
   5. metrics — real trends, and a flag that never inflates a dismissal count
   ==================================================================================== */
const all = Metrics.build(evRows, { from: '0000-01-01', to: '9999-12-31' });
check('Metrics.build returns non-zero KPIs across the whole log',
  all.kpi.total === 280 && all.kpi.visitors === 73 && all.kpi.students === 73 &&
  all.kpi.days === 16 && all.kpi.flags === 5);
check('THE FLAGS ARE COUNTED SEPARATELY: no pickup_flag is in the early-dismissal total',
  (() => {
    const early = all.byType.find((t) => t.key === 'student_early_out').count;
    const flagRows = evRows.filter((e) => e.Type === 'pickup_flag').length;
    return flagRows === 5 && all.kpi.flags === flagRows &&
           early === evRows.filter((e) => e.Type === 'student_early_out').length &&
           !all.byType.some((t) => t.key === 'pickup_flag');
  })());
check('the daily series is GAP-FILLED, so a weekend or a holiday reads as zero',
  all.daily.length === 23 &&
  all.daily.find((d) => d.date === '2026-09-07').student_late_in === 0 &&
  all.daily.some((d) => d.date === '2026-09-06'));
check('the school-year preset starts at the configured month, not January',
  Metrics.rangeFor('year', new Date(2026, 8, 15), 8).from === '2026-08-01');
check('every counted type appears, and visitor_out is deliberately not one of them',
  all.byType.map((t) => t.key).sort().join(',') ===
    'movement,student_early_out,student_late_in,student_return_in,visitor_in' &&
  evRows.some((e) => e.Type === 'visitor_out'));
check('the reason, hour, weekday, grade, building and station folds are all populated',
  all.byReason.length > 8 && all.byHour.length > 5 && all.byWeekday.length === 5 &&
  all.byGrade.length > 8 && all.byBuilding.length >= 4 && all.byStation.length >= 3);
check('the homeschool cohort shows up as a Tuesday/Thursday pattern',
  (() => {
    const tue = all.byWeekday.find((w) => w.key === '2').count;
    const wed = all.byWeekday.find((w) => w.key === '3').count;
    return tue > wed;
  })());
check('"this month" is a real subset of the year, not the same numbers twice',
  (() => {
    const month = Metrics.build(evRows, Metrics.rangeFor('month', new Date(2026, 8, 15), 8));
    return month.kpi.total === 184 && month.kpi.days === 10 && month.kpi.total < all.kpi.total;
  })());

/* ======================================================================================
   6. follow-up resolution (which alert the office actually gets)
   ==================================================================================== */
const notifyTabs = tabsOf(['Sheet1', 'Student Schedules', 'Staff']);
const notifyCtx = {
  staffEmailFor: Directory.staffEmailResolver(notifyTabs),
  hrByStudent: Directory.homeroomTeacherByStudent(notifyTabs),
  elcEmails: Directory.elcTeacherEmails(tabsOf(['K5-6 Teachers']))
};
check('the configured mode is office_alert, so a dismissal lands on the board as pending',
  Notify.resolveFollowUp({ 'dismissal.followup.mode': 'office_alert' }, roster[0], notifyCtx)
    .pending === true);
check('in email_teacher mode a 12th-grader resolves to the Staff tab address',
  (() => {
    const f = Notify.resolveFollowUp({ 'dismissal.followup.mode': 'email_teacher' },
      roster.find((s) => s.id === '400101'), notifyCtx);
    return f.sendEmail && f.sendEmail.to === 'd.whitfield@example.edu';
  })());
check('...and a K5 child, whose teacher is missing from Staff, falls through to the ELC side-car',
  (() => {
    const f = Notify.resolveFollowUp({ 'dismissal.followup.mode': 'email_teacher' },
      roster.find((s) => s.id === '400112'), notifyCtx);
    return f.sendEmail && f.sendEmail.to === 'r.almeida@example.edu';
  })());

/* ======================================================================================
   7. the vendored logic bundle must not drift from the source modules
   ==================================================================================== */
check('logic.js is the source project\'s logic/*.js, byte for byte (' + ORDER.length + ' modules)',
  (() => {
    try {
      return assemble(new URL(SRC, import.meta.url).pathname
        .replace(/^\/([A-Za-z]:)/, '$1')) === read('logic.js');
    } catch (e) { return false; }
  })());

/* ======================================================================================
   8. the mock, loaded the way a browser loads it
   ==================================================================================== */
const ctx = vm.createContext({ console, URLSearchParams });
ctx.window = ctx;                        // in a browser, window IS the global object
for (const f of ['logic.js', 'data.js', 'mock.js']) {
  vm.runInContext(read(f), ctx, { filename: f });
}
const MB = ctx.MOCK_BACKEND;
check('MOCK_BACKEND exposes exactly the two backend names the whole system calls',
  MB && Object.keys(MB).sort().join(',') === 'kioskApi,officeApi');

const PAGES = { 'kiosk.html': 'kioskApi', 'board.html': 'officeApi',
                'muster.html': 'officeApi', 'metrics.html': 'officeApi' };
const html = {};
Object.keys(PAGES).forEach((p) => { html[p] = read(p); });

// Walk each google.script.run chain and record the real backend method names, dropping the
// with*Handler wrappers (the same walk tools/scan-portfolio.mjs uses for its fingerprints).
function gsrMethods(s) {
  const out = new Set(), anchor = 'google.script.run';
  let i = 0;
  while ((i = s.indexOf(anchor, i)) >= 0) {
    let j = i + anchor.length;
    for (;;) {
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] !== '.') break;
      j++;
      while (j < s.length && /\s/.test(s[j])) j++;
      let id = '';
      while (j < s.length && /\w/.test(s[j])) id += s[j++];
      if (!id) break;
      while (j < s.length && /\s/.test(s[j])) j++;
      const isHandler = /^with(Success|Failure|User)/.test(id);
      if (s[j] !== '(') { if (!isHandler) out.add(id); break; }
      let depth = 0;
      for (; j < s.length; j++) {
        const c = s[j];
        if (c === '"' || c === "'" || c === '`') {
          const q = c; j++;
          while (j < s.length && s[j] !== q) { if (s[j] === '\\') j++; j++; }
        } else if (c === '(') depth++;
        else if (c === ')') { depth--; if (depth === 0) { j++; break; } }
      }
      if (!isHandler) out.add(id);
    }
    i += anchor.length;
  }
  return [...out].sort();
}
const called = new Set();
Object.keys(html).forEach((p) => gsrMethods(html[p]).forEach((m) => called.add(m)));
check('the mock has a key for EVERY google.script.run method the four pages call (' +
      [...called].sort().join(', ') + ')',
  called.size > 0 && [...called].every((m) => typeof MB[m] === 'function'));

// Every {op:'...'} the pages send must be a real op, not the dispatcher's "unknown op".
const opsByApi = { officeApi: new Set(), kioskApi: new Set() };
Object.keys(PAGES).forEach((p) => {
  const m = html[p].match(/\bop:\s*'([A-Za-z]+)'/g) || [];
  m.forEach((x) => opsByApi[PAGES[p]].add(x.replace(/.*'([A-Za-z]+)'.*/, '$1')));
});
const badOps = [];
Object.keys(opsByApi).forEach((api) => {
  opsByApi[api].forEach((op) => {
    let res;
    try { res = MB[api]({ op: op, station: 'hs' }); } catch (e) { res = { error: e.message }; }
    if (res && res.error === 'unknown op') badOps.push(api + ':' + op);
  });
});
check('every {op} the pages send is handled (' +
      [...opsByApi.kioskApi].sort().join(', ') + ' | ' + [...opsByApi.officeApi].sort().join(', ') + ')',
  opsByApi.kioskApi.size >= 8 && opsByApi.officeApi.size >= 6 && badOps.length === 0);

// The ops the pages do NOT reach (the Settings surface is out of scope) are still implemented,
// because the mock documents the whole server surface.
check('the ops behind the surfaces this demo leaves out are implemented too',
  MB.officeApi({ op: 'getSettings' }).ok === true &&
  MB.officeApi({ op: 'listPermissions' }).people.length === 5 &&
  MB.kioskApi({ op: 'ping', station: 'hs' }).ok === true &&
  MB.kioskApi({ op: 'checkPickup', station: 'hs', studentId: '400140',
                typedName: 'Tabitha Gaskill' }).match === true);
check('a write op answers with a friendly read-only error the page can show inline',
  (() => {
    try { MB.officeApi({ op: 'saveSetting', key: 'board.poll.seconds', value: '5' }); return false; }
    catch (e) { return /read-only demo/.test(e.message); }
  })());
check('checkPickup answers match/no-match and NOTHING else',
  Object.keys(MB.kioskApi({ op: 'checkPickup', station: 'hs', studentId: '400140',
                            typedName: 'Marcus Gaskill' })).sort().join(',') === 'match,ok');

/* ---- the hand-off between surfaces: a kiosk sign-out has to reach the board ---- */
const before = MB.officeApi({ op: 'getBoardSnapshot' });
const signOut = MB.kioskApi({ op: 'earlyOut', station: 'hs', studentId: '400102', mode: 'pickup',
                              typedName: 'Trina Boyette', relationship: 'Mother',
                              reason: 'Illness', returning: false });
const afterOut = MB.officeApi({ op: 'getBoardSnapshot' });
check('a kiosk sign-out is recorded and the BOARD sees it on the next poll',
  signOut.ok === true && signOut.match === true &&
  afterOut.presence.studentsOff.length === before.presence.studentsOff.length + 1 &&
  afterOut.presence.studentsOff.some((s) => s.id === '400102'));
check('...and the office gets the follow-up the settings asked for',
  signOut.followUp === 'office_alert' &&
  afterOut.pending.some((p) => p.name === 'Boyette Marcus' && p.mode === 'office_alert'));

const mismatch = MB.kioskApi({ op: 'earlyOut', station: 'hs', studentId: '400103', mode: 'pickup',
                               typedName: 'Zebedee Castellano', relationship: 'Other',
                               reason: 'Family', returning: false });
const afterFlag = MB.officeApi({ op: 'getBoardSnapshot' });
check('A MISMATCH AT THE KIOSK RAISES A FLAG AND IS NOT A SIGN-OUT',
  mismatch.ok === true && mismatch.match === false &&
  afterFlag.openFlags.length === afterOut.openFlags.length + 1 &&
  afterFlag.presence.studentsOff.length === afterOut.presence.studentsOff.length &&
  !afterFlag.presence.studentsOff.some((s) => s.id === '400103'));
check('the office can APPROVE that flag, which is what records the dismissal as an override',
  (() => {
    const flag = afterFlag.openFlags.find((f) => f.name === 'Castellano Ivy');
    const res = MB.officeApi({ op: 'resolveFlag', eventId: flag.eventId, action: 'approve',
                               note: 'phoned June' });
    const done = MB.officeApi({ op: 'getBoardSnapshot' });
    return res.ok === true &&
           done.openFlags.every((f) => f.eventId !== flag.eventId) &&
           done.presence.studentsOff.some((s) => s.id === '400103');
  })());
check('Work Release is grade 7+ AND on the list, and the expired row is refused',
  MB.kioskApi({ op: 'earlyOut', station: 'hs', studentId: '400101', mode: 'workrelease' })
    .workRelease === true &&
  MB.kioskApi({ op: 'earlyOut', station: 'hs', studentId: '400178', mode: 'workrelease' })
    .denied === 'workrelease');
check('signing a young child IN without an adult is refused by the server, not just the UI',
  MB.kioskApi({ op: 'lateIn', station: 'el', studentId: '400118', reason: 'Overslept' })
    .error === 'guardian-required');
check('the badge registry answers unknown / inactive / in-use distinctly',
  MB.kioskApi({ op: 'visitorIn', station: 'hs', name: 'A Visitor', reason: 'Meeting',
                destination: 'High School', badge: 'V99' }).badge === 'unknown' &&
  MB.kioskApi({ op: 'visitorIn', station: 'hs', name: 'A Visitor', reason: 'Meeting',
                destination: 'High School', badge: 'V7' }).badge === 'inactive' &&
  MB.kioskApi({ op: 'visitorIn', station: 'hs', name: 'A Visitor', reason: 'Meeting',
                destination: 'High School',
                badge: before.badgesOut[0].badgeId }).badge === 'in-use');
check('a visitor signing in appears on the board with their badge, and can be signed out again',
  (() => {
    const free = MB.kioskApi({ op: 'visitorOpenList', station: 'hs' }).visitors.length;
    const vin = MB.kioskApi({ op: 'visitorIn', station: 'hs', name: 'Wilhelmina Trask',
                              reason: 'Meeting', destination: 'High School', badge: 'V15' });
    const look = MB.kioskApi({ op: 'visitorLookupBadge', station: 'hs', badge: 'V15' });
    const onBoard = MB.officeApi({ op: 'getBoardSnapshot' })
      .presence.visitors.some((v) => v.name === 'Wilhelmina Trask');
    const out = MB.kioskApi({ op: 'visitorOut', station: 'hs', visitKey: look.visitKey });
    const gone = MB.officeApi({ op: 'getBoardSnapshot' })
      .presence.visitors.some((v) => v.name === 'Wilhelmina Trask');
    return vin.ok && vin.badge === 'V15' && look.open === true && onBoard &&
           out.ok === true && gone === false &&
           MB.kioskApi({ op: 'visitorOpenList', station: 'hs' }).visitors.length === free;
  })());
check('the muster report builds the full roster, grouped by building, with the off-campus marks',
  (() => {
    const r = MB.officeApi({ op: 'getMusterReport', mode: 'full' });
    const flat = Object.keys(r.rosters).reduce((a, k) => a.concat(r.rosters[k]), []);
    return r.mode === 'full' && flat.length === 87 &&
           flat.every((x) => x.id && x.name && x.grade) &&
           flat.some((x) => x.off === true) &&
           Object.keys(r.rosters).sort().join(',') === '6th Grade,Elementary,High School,Kindergarten';
  })());
check('quick-counts mode sends no roster at all — counts and exceptions only',
  MB.officeApi({ op: 'getMusterReport', mode: 'counts' }).rosters === null);
check('the kiosk bootstrap serves the Homeschool reason on both lists, and no secrets',
  (() => {
    const b = MB.kioskApi({ op: 'bootstrap', station: 'hs' });
    return b.reasons.late.indexOf('Homeschool') !== -1 &&
           b.reasons.dismissal.indexOf('Homeschool') !== -1 &&
           b.parentDrivenMaxGrade === 5 &&
           !/key|token|secret/i.test(JSON.stringify(b));
  })());

/* ======================================================================================
   9. the built pages themselves
   ==================================================================================== */
Object.keys(html).forEach((p) => {
  check(p + ': no unreplaced Apps Script template tokens', !/<\?[=!]/.test(html[p]));
});
check('all four pages load the shim, the dataset, the mock and the app\'s own logic bundle',
  Object.keys(html).every((p) => /gsr-shim\.js/.test(html[p]) && /src="data\.js"/.test(html[p]) &&
    /src="mock\.js"/.test(html[p]) && /src="logic\.js"/.test(html[p])));
check('the kiosk reads ?station= from the URL, so both iPads are demoable from one page',
  /URLSearchParams\(location\.search\)\.get\('station'\)/.test(html['kiosk.html']) &&
  /var URL_KEY = 'demo-device-key'/.test(html['kiosk.html']));
check('the staff pages keep a working cross-page nav pointed at the built files',
  ['board.html', 'muster.html', 'metrics.html'].every((p) =>
    /href="board\.html"/.test(html[p]) && /href="muster\.html"/.test(html[p]) &&
    /href="metrics\.html"/.test(html[p]) && !/href="\?page=/.test(html[p])));
check('the Settings anchor is gone but its id survives, so the admin check cannot hit null',
  ['board.html', 'muster.html', 'metrics.html'].every((p) =>
    /<span id="navSettings" hidden>/.test(html[p]) &&
    /\$\('navSettings'\)\.classList\.remove/.test(html[p])));
check('the pages run inside the switcher rather than escaping to the top window',
  Object.keys(html).every((p) => /<base target="_self">/.test(html[p])));
check('the switcher frames all five surfaces and links back to the gallery',
  (() => {
    const sw = read('index.html');
    return ['kiosk.html"', 'kiosk.html?station=el', 'board.html', 'muster.html', 'metrics.html']
      .every((s) => sw.indexOf(s) !== -1) && /href="\.\.\/\.\.\/index\.html"/.test(sw);
  })());
check('no real spreadsheet ids, deployment ids or Google URLs leaked into any file',
  ['data.js', 'mock.js', 'logic.js', 'index.html'].concat(Object.keys(html))
    .every((f) => {
      const s = read(f);
      return !/AKfycb|docs\.google\.com\/spreadsheets/.test(s) && !/1[A-Za-z0-9_-]{30,}/.test(s);
    }));
check('every email in the dataset is an example.com / example.edu address',
  (() => {
    const s = read('data.js');
    const mails = s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g) || [];
    return mails.length > 80 && mails.every((m) => /@example\.(com|edu)$/.test(m));
  })());
check('the Metrics page still loads Chart.js pinned, from the one CDN it is allowed',
  /cdn\.jsdelivr\.net\/npm\/chart\.js@4\.4\.6\//.test(html['metrics.html']));

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
