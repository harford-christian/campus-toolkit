// Verifies this demo's fabricated dataset by running it through the REAL Search.gs logic the
// demo ships (the app's own code, inlined into index.html unedited). Catches a broken demo
// before it's published — a fixture that no longer matches the app's expectations shows up as
// an empty page in the browser and nothing else.
//
// Run: node demos/facts-directory/verify.mjs
// Requires the source project checked out alongside this repo:
//   Projects/apps-script-showcase/  and  Projects/FACTS/facts-directory-search/
import { readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const SEARCH_GS = new URL('../../../FACTS/facts-directory-search/Search.gs', import.meta.url);
let S;
try {
  S = require(SEARCH_GS.pathname.replace(/^\//, ''));
} catch (e) {
  console.log('SKIP — source project not found next to this repo (' + e.message + ')');
  process.exit(0);
}

const window = {};
new Function('window', readFileSync(new URL('./data.js', import.meta.url), 'utf8'))(window);
const D = window.DIRECTORY_DATA;
const tabs = D.tabs;
const TODAY = D.demoNow.date;
const QR = S.parseQuarterRanges(D.quarterDates);

let fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) fail++; };

/* ---------- the dataset the browser receives ---------- */
check('6 tabs, including the three the newer features need',
  tabs.map(t => t.name).join(',') ===
  'Sheet1,Student Schedules,Teachers,Period Times,Emergency Contacts,Attendance Today');
check('14 students built from the LONG directory rows', S.buildPeople(tabs).length === 14);
check('siblings share a guardian email', S.searchPeople(tabs, 'greta.fairbanks@example.com').total === 2);
check('typo-tolerant name search still works',
  S.searchPeople(tabs, 'johnathon').total === 2);
check('subject search finds classes', S.searchPeople(tabs, 'band').classes.length >= 2);
check('grade-word search works', S.searchPeople(tabs, 'seventh grade').people.length > 0);
check('two sections of one code+teacher stay separate',
  S.buildClasses(tabs).filter(c => c.code === 'BI08-LOC').length === 2);

/* ---------- current class, on the demo clock ---------- */
const pt = S.buildPeriodTimes(tabs);
const ctx = { dayCol: D.demoNow.dayOfWeek, nowMin: 10 * 60 + 30,
              bells: S.bellSlotTimes(D.bellPeriods), closed: false,
              quarter: S.quarterForDate(QR, TODAY) };
check('the demo date falls inside Q1, so quarter filtering is live', ctx.quarter === 1);
const nora = S.personDetail(tabs, '400101', TODAY);
const ann = S.annotateSchedule(nora.classes, pt, ctx);
const live = ann.filter(c => c.current);
check('exactly one class is in session when the demo opens',
  live.length === 1 && live[0].description === 'Physics');
check('and it is NOT flagged ambiguous (quarters resolve the semester pair)',
  live[0].sharedSlot === false);
check('bell times drive the highlight', live[0].timeSource === 'bell');
check('homeroom is timed via the slot row',
  ann.find(c => c.code === 'HR-12').beginLabel === '8:28 AM');

// the Q1/Q3 pair sharing Period 6: exactly one meets today
const gov = ann.find(c => c.code === 'SS-GOV'), eco = ann.find(c => c.code === 'SS-ECO');
check('semester-split pair: the Q1 class meets, the Q3,4 one is marked off-quarter',
  gov.offQuarter === false && eco.offQuarter === true && eco.meetsToday === false);

// Friday reversal still demoable via ?sim=
const fri = S.annotateSchedule(nora.classes, pt, { ...ctx, dayCol: 5, nowMin: 14 * 60 + 45, bells: {} });
check('FRIDAY: the Period 1 class rotates into the P8 slot at 2:37pm',
  (fri.find(c => c.current) || {}).description === 'English - 12th Grade');

/* ---------- the newer sections ---------- */
check('emergency contacts index by student, in call order',
  (() => {
    const e = S.buildEmergencyContacts(tabs);
    return e['400101'].length === 3 && e['400101'][0].relationship === 'Mother' &&
           e['400101'][1].note === 'call cell first';
  })());
check('personDetail attaches the emergency list', nora.emergency.length === 3);
check('teams and clubs are split out of the academic schedule',
  nora.activities.length === 2 &&
  nora.activities.map(a => a.code).sort().join() === 'HonSoc,VGSC' &&
  nora.classes.every(c => c.activity === false));
check('activities carry a department so sports read differently from clubs',
  nora.activities.find(a => a.code === 'VGSC').dept === 'Athletics');

check('attendance shows an absence, a lateness and an early dismissal',
  (() => {
    const a = S.buildAttendance(tabs, TODAY);
    return Object.keys(a).length === 5 &&
           a['400103'].status === 'Absent' && a['400103'].excused === 'Y' &&
           a['400105'].status === 'Late' && a['400105'].reason === 'arrived at 8:43' &&
           a['400114'].status === 'Left early';
  })());
check('the badge reaches the search result list',
  (() => {
    const r = S.searchPeople(tabs, 'enriquez', { today: TODAY });
    return r.people[0].attendance.status === 'Late';
  })());
check('a stale feed is ignored rather than shown as today',
  Object.keys(S.buildAttendance(tabs, '2026-09-09')).length === 0);
check('a present student carries no badge',
  S.personDetail(tabs, '400101', TODAY).attendance === null);

/* ---------- the page itself ---------- */
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
check('no unreplaced Apps Script template tokens', !/<\?[=!]/.test(html));
check('the demo shim, data and mock are wired in',
  /gsr-shim\.js/.test(html) && /src="data\.js"/.test(html) && /src="mock\.js"/.test(html));
check('?sim= is wired to the URL so the Friday rotation is demoable',
  /URLSearchParams/.test(html));
check('the app\'s own logic is inlined, not reimplemented',
  /function annotateSchedule\(/.test(html) && /function buildAttendance\(/.test(html));
check('no real spreadsheet ids, deployment ids or urls leaked',
  !/AKfycb|docs\.google\.com\/spreadsheets/.test(html) &&
  !/1[A-Za-z0-9_-]{30,}/.test(html));

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
