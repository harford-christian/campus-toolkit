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
check('8 tabs, including the four the newer features need',
  tabs.map(t => t.name).join(',') ===
  'Sheet1,Student Schedules,Teachers,Period Times,Roster,Emergency Contacts,Attendance Today,PickupContacts');
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

/* ---------- transportation, siblings, pickup (the dismissal Roster) ---------- */
const tr = S.buildTransportation(tabs);
check('a recorded bus rider reads as a FACT, not an assumption',
  tr['400102'].type === 'Bus' && tr['400102'].routeCode === 'HDG' &&
  tr['400102'].routeName === 'Havre de Grace' && tr['400102'].assumed === false);
check('a residual-default Car is flagged as ASSUMED so the UI can say so',
  tr['400101'].type === 'Car' && tr['400101'].assumed === true);
check('split custody keeps BOTH rows instead of picking one',
  (tr['400109'].extra || []).length === 1 &&
  tr['400109'].type === 'Bus' && tr['400109'].extra[0].type === 'Car');
check('Building and Pickup stay separate columns (physical vs where the parent goes)',
  tr['400107'].building === 'MS' && tr['400107'].pickup === 'HS');

const sibs = S.buildSiblings(tabs);
check('siblings come from Family ID, and never include the student themselves',
  sibs['400106'].length === 1 && sibs['400106'][0].id === '400107' &&
  sibs['400112'][0].id === '400113' && sibs['400101'] === undefined);

const pk = S.buildPickupContacts(tabs);
check('authorised pickup indexes by student',
  pk['400101'].length === 3 && pk['400101'][0].relationship === 'Mother' &&
  pk['400101'][0].cell === '555-0101');
check('a student with NO pickup contacts is genuinely absent from the index',
  pk['400104'] === undefined); // renders "none recorded", which must differ from "loading"

/* ---------- today's presence (status and time only) ---------- */
check('presence carries NO guardian name, relationship or reason',
  Object.keys(D.presence).every(id =>
    Object.keys(D.presence[id]).sort().join() === 'back,late,out'));
check('a student signed out and not back reads as OUT',
  (() => { const s = S.studentStatus(null, D.presence['400114']); return s && s.state === 'out'; })());
check('signed out and returned reads as BACK',
  (() => { const s = S.studentStatus(null, D.presence['400104']); return s && s.state === 'back'; })());
check('an unknown student reads as PRESENT — never an invented absence',
  S.studentStatus(null, null) === null);
check('today-only dismissal override is present, and stamped with who made it',
  D.overrides['400103'].type === 'CAR' && !!D.overrides['400103'].by);

/* ---------- the deferred (second-call) split ---------- */
const DEFERRED = D.deferredTabs;
check('the deferred list names exactly the two collapsed-only contact tabs',
  DEFERRED.slice().sort().join() === 'Emergency Contacts,PickupContacts');
const core = tabs.filter(t => DEFERRED.indexOf(t.name) === -1);
check('every EXPANDED section is identical without the deferred tabs',
  (() => {
    const a = S.personDetail(core, '400101', TODAY), b = S.personDetail(tabs, '400101', TODAY);
    return JSON.stringify(a.profile) === JSON.stringify(b.profile) &&
           JSON.stringify(a.classes) === JSON.stringify(b.classes) &&
           JSON.stringify(a.transportation) === JSON.stringify(b.transportation) &&
           JSON.stringify(a.siblings) === JSON.stringify(b.siblings);
  })());
check('and the deferred lists come back EMPTY rather than throwing',
  (() => {
    const a = S.personDetail(core, '400101', TODAY);
    return a.pickups.length === 0 && a.emergency.length === 0;
  })());

/* ---------- game-day dismissal ---------- */
const nora2 = S.personDetail(tabs, '400101', TODAY);
check('the student\'s Varsity Girls Soccer enrolment resolves to that team\'s calendar',
  S.athleticsMatchTeams(nora2.activities.find(a => a.code === 'VGSC'),
    nora2.profile.gender, D.athleticsTeams).map(t => t.id).join() === 'soccer-v-girls');
const gd = S.athleticsForStudent(nora2.activities, nora2.profile.gender,
  D.athleticsTeams, D.athleticsEvents, TODAY);
check('today\'s away game surfaces with the dismissal the coach posted',
  gd.length === 1 && gd[0].team === 'Varsity Girls Soccer' &&
  gd[0].dismiss === '14:00' && gd[0].depart === '14:15' && gd[0].leavesEarly === true);
check('the HOME game with no posted dismissal is not treated as an early leave',
  D.athleticsEvents.filter(e => !e.dismiss && !e.depart).length === 1 &&
  gd.every(g => g.leavesEarly));
check('a student on no team gets no game',
  S.athleticsForStudent(S.personDetail(tabs, '400102', TODAY).activities, 'Male',
    D.athleticsTeams, D.athleticsEvents, TODAY).length === 0);

/* ---------- favourites ---------- */
check('the demo opens with favourites seeded, so the feature is visible on load',
  D.favorites.length === 3);
check('every seeded favourite is a real student in the dataset',
  (() => {
    const ids = S.buildPeople(tabs).map(p => p.id);
    return D.favorites.every(f => ids.indexOf(f) !== -1);
  })());

/* ---------- game-day dismissal: the bar and the classes it costs (app @38) ---------- */
const gd2 = S.athleticsForStudent(nora2.activities, nora2.profile.gender,
  D.athleticsTeams, D.athleticsEvents, TODAY);
const dismissMin = S.searchTimeToMin_(gd2[0].dismiss || gd2[0].depart);
check('the bar renders as sport + dismissal, with PM dropped',
  gd2[0].team === 'Varsity Girls Soccer' &&
  S.searchTimeLabel_(gd2[0].dismiss).replace(/\s*PM$/, '') === '2:00');
check('exactly one class is CUT SHORT by that dismissal, and it is the straddling one',
  (() => {
    const sc = S.annotateSchedule(nora2.classes, pt, ctx);
    const missed = sc.filter(c => S.isMissedForGame(c, dismissMin));
    // Spanish IV runs 1:49-2:34 and so is interrupted, not merely "starts later" — the subtler
    // half of the rule, and the one worth having on screen.
    return missed.length === 1 && missed[0].description === 'Spanish IV' &&
           S.searchTimeToMin_(missed[0].begin) < dismissMin;
  })());
check('morning classes are NOT flagged (they finish before the team leaves)',
  (() => {
    const sc = S.annotateSchedule(nora2.classes, pt, ctx);
    return sc.filter(c => c.meetsToday && S.searchTimeToMin_(c.end) <= dismissMin)
      .every(c => !S.isMissedForGame(c, dismissMin));
  })());

/* ---------- the school day names its own blocks (app @36) ---------- */
check('at lunchtime the day bar says Lunch, not "no class in session"',
  (() => {
    const b = S.schoolDayBlock(pt, { dayCol: D.demoNow.dayOfWeek, nowMin: 11 * 60 + 50,
                                    bells: ctx.bells }, nora2.profile.grade);
    return b && b.state === 'block' && b.label === 'Lunch';
  })());
check('the TWO-LUNCH band is respected in the demo grid too',
  S.slotAppliesToGrade_('Lunch 9-12', '12') === true &&
  S.slotAppliesToGrade_('Lunch 7-8', '12') === false);

/* ---------- a teacher's current class (app @39) ---------- */
check('teacherDetail carries `pattern`, so a teacher resolves a current class',
  (() => {
    const t = S.teacherDetail(tabs, tabs.find(x => x.name === 'Teachers').values[1][0]);
    return t && t.classes.length > 0 && t.classes.every(c => 'pattern' in c);
  })());

/* ---------- result groups render Students, Teachers, Classes (app @39) ---------- */
const page = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
check('result groups are ordered Students, then Teachers, then Classes',
  (() => {
    const s = page.indexOf('if (res.total) {'), t = page.indexOf('if (teachers.length) {'),
          c = page.indexOf('if (classes.length) {');
    return s > 0 && s < t && t < c;
  })());
check('the favourites chip — the way IN to that view — is in the page',
  /id="favview"/.test(page) && /function showFavorites_/.test(page));

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
