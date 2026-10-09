#!/usr/bin/env node
/* verify.mjs — prove this demo still matches the app it claims to be.
 *
 *   node demos/student-portal/verify.mjs
 *
 * Checks, in order of how much they matter:
 *   1. PRIVACY — no real person, calendar id, Drive id, deployment id or domain in anything the demo ships.
 *   2. The vendored logic.js is in sync with the source project, and portal.html is a fresh build of build.json.
 *   3. The mock covers exactly the google.script.run methods the built page calls.
 *   4. Behaviour, end to end through the REAL code: the schedule week (bells, the reverse Friday, a closed day,
 *      the semester pair), the due engine on teacher prose, the gradebook merge, the game-day card parsed from a
 *      coach's description, the school-calendar closures, grades, attendance, prefs, and the switcher's choices.
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

const page = read('portal.html'), dataJs = read('data.js'), mockJs = read('mock.js'), logicJs = read('logic.js'), switcher = read('index.html');
const all = [page, dataJs, mockJs, logicJs, switcher].join('\n');

/* ---------------------------------- 1. privacy ---------------------------------- */
console.log('\n  privacy');
const leaks = all.match(/AKfycb[A-Za-z0-9_-]+|docs\.google\.com\/spreadsheets|script\.google\.com\/macros|\b1[A-Za-z0-9_-]{30,}|[a-z0-9]+@group\.calendar\.google\.com/g) || [];
ok(leaks.length === 0, 'no deployment id, Sheet/Drive id, live URL or real calendar id', [...new Set(leaks)].slice(0, 3).join(', '));
// The school's public NAME may appear (it is the brand on every demo, and Athletics.js matches it as the home
// venue); its DOMAIN may not.
ok(!/harford\s*christian\s*\.\s*org|harfordchristian/i.test(all), 'the real school domain never appears (always-on scrub)');
ok(!/Noah/.test(all), 'the personal credit in the source footer is gone');
const staffHits = findStaffNames(all);
ok(staffHits.length === 0, 'no real staff name — matched by hash, never listed', staffHits.join(', '));
const emails = [...new Set(all.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])].filter(e => !/@demo$/.test(e));
ok(emails.every(e => /@example\.(com|edu)$/.test(e)), 'every email address is @example.com / @example.edu', emails.filter(e => !/@example\.(com|edu)$/.test(e)).join(', '));
ok(!/calendarId: 'c_/.test(all) && /demo-cal-/.test(dataJs), 'the team table carries demo calendar keys, not the real ids');

/* --------------------------- 2. vendored code + fresh build --------------------------- */
console.log('\n  source sync');
if (!existsSync(SRC)) {
  skip('source project not found at ' + SRC + ' — logic drift and fresh-build checks skipped');
} else {
  ok(buildLogic() === logicJs, 'logic.js is the source project\'s ten files, verbatim (run build-logic.mjs)');
  const tmp = mkdtempSync(path.join(tmpdir(), 'portal-verify-'));
  try {
    const c = JSON.parse(read('build.json'));
    const tmpCfg = path.join(tmp, 'build.json'), dst = path.join(tmp, 'portal.html');
    writeFileSync(tmpCfg, JSON.stringify({ ...c, src: path.resolve(ROOT, c.src), includeDir: path.resolve(ROOT, c.includeDir), dst }));
    execFileSync(process.execPath, [path.join(ROOT, 'tools/build-demo.mjs'), tmpCfg], { cwd: ROOT, stdio: 'pipe' });
    ok(readFileSync(dst, 'utf8') === page, 'portal.html is a fresh build of build.json');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
ok(!/<\?[=!]?[\s\S]*?\?>/.test(page), 'no Apps Script template token or scriptlet left in the page');
ok(/<base target="_self">\s*<script src="\.\.\/facts-directory\/data\.js"><\/script>\s*<script src="logic\.js"><\/script>/.test(page), 'the shared school dataset loads before logic.js, before the shim');
ok(/var BOOT = window\.PORTAL_DEMO\.boot\(\);/.test(page) && /var BOOT_DATA = window\.PORTAL_DEMO\.bootData\(\);/.test(page), 'the boot object and inline payload come from the mock where doGet would have put them');
// (Client.html legitimately carries the same badge markup for the admin support view; only the template's
// server-rendered copy next to the name must be gone.)
ok(/<main class="deny" style="display:none">/.test(page) && !/<\/b><span class="adm">ADMIN<\/span><\/span>/.test(page), 'the deny panel is hidden and the server-rendered admin badge is gone');
ok(/id="demoSimbar"/.test(page), 'the admin sim bar became the demo-clock bar');

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
  return out;
}
const calls = [...calledMethods(page)].sort();
ok(eq(calls, ['athleticsApi', 'attendanceApi', 'bootApi', 'gradesApi', 'inboxApi', 'savePrefsApi']), 'the page calls exactly the six methods the source does', calls.join(', '));

/* ---------------------------------- 4. behaviour ---------------------------------- */
console.log('\n  behaviour (real code, in-memory services)');
function memStorage() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
function boot(session, search) {
  // The vendored code resolves config and services as bare globals, so the page's window IS globalThis here.
  globalThis.window = globalThis;
  globalThis.sessionStorage = session;
  globalThis.location = { search: search || '' };
  globalThis.document = { addEventListener() {}, getElementById() { return null; } };
  const load = (f) => new Function(readFileSync(f, 'utf8'))();
  load(path.join(ROOT, 'demos/facts-directory/data.js'));
  load(path.join(HERE, 'data.js')); load(path.join(HERE, 'logic.js')); load(path.join(HERE, 'mock.js'));
  return { M: globalThis.MOCK_BACKEND, P: globalThis.PORTAL_DEMO, L: globalThis.PORTAL_LOGIC };
}

let session = memStorage();
let { M, P, L } = boot(session);
ok(eq(Object.keys(M).sort(), calls), 'MOCK_BACKEND implements exactly the methods the page calls');

// the pinned clock and the boot payload, as doGet would inline it
const b = P.boot();
ok(b.ok && b.fullName === 'Nora Alderman' && /Wed Sep 23, 2026 10:30 AM/.test(b.sim), 'the demo opens as Nora on Wednesday 2026-09-23 at 10:30, labelled as a demo clock');
const d = P.bootData();
// News & Info: the memo-check sheet's Chapel and MemoNotes tabs, the calendar's closed days, through the app's own News.build
const news = d.news || {};
const nk = (k) => (news.items || []).filter((i) => i.kind === k);
ok(news.enabled === true && (news.items || []).length >= 4, 'News & Info is on, with this week\'s items', JSON.stringify(news).slice(0, 300));
ok(nk('chapel').length === 1 && nk('chapel')[0].date === '2026-09-23' && nk('chapel')[0].isToday === true && /junior class/.test(JSON.stringify(nk('chapel')[0])),
   'today\'s chapel is the live memo\'s row (the newest memo wins; last week\'s and next week\'s are not shown)');
ok(nk('exam').length === 1 && nk('exam')[0].date === '2026-09-24' && nk('spirit').length === 1 && nk('closed').some((i) => i.date === '2026-09-25'),
   'the exam and spirit day come from MemoNotes, Friday\'s no-school day from the school calendar');
ok(nk('picture').length === 1 && nk('picture')[0].date === '2026-09-29' && !(news.items || []).some((i) => i.date > '2026-09-30'),
   'picture retakes on Tuesday the 29th are inside the 7-day window; the following week (the 30th) and later are not');
ok(eq((news.items || []).map((i) => i.date), (news.items || []).map((i) => i.date).slice().sort()), 'items are in date order');
const sc = d.schedule;
ok(sc.date === '2026-09-23' && sc.dayCol === '3' && sc.nowMin === 630 && sc.quarter === 1 && sc.schoolDay === true, 'schedule context: Wednesday, third period, Q1, a school day');
ok(sc.now && sc.now.description === 'Physics' && sc.now.periodShort === 'P3' && sc.now.beginShort === '10:12', 'NOW is Physics (pattern 3 -> the P3 slot, 10:12-10:57)');
ok(sc.next && sc.next.description === 'Bible Doctrines', 'NEXT is Bible Doctrines');
ok(eq(['1', '2', '3', '4', '5'].map(k => sc.week[k].date), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']), 'the week is Mon 21 .. Fri 25');
const mon = sc.week['1'], fri = sc.week['5'];
ok(mon.bellMode === '2-Hour Delay' && mon.rows.find(r => r.periodShort === 'P1').begin === '10:36' && mon.rows.find(r => r.periodShort === 'P1').timeSource === 'bell',
  'Monday ran on a 2-hour delay: bell times override FACTS times (P1 at 10:36)');
ok(fri.closed === true && fri.bellMode === 'No School', 'Friday is closed (Professional Development Day)');
ok(fri.rows.filter(r => r.meetsToday)[1].periodShort === 'P8', 'the Friday grid is in reverse order (P8 right after homeroom)');
ok(sc.week['3'].rows.some(r => r.description === 'Economics (1 semester)' && r.offQuarter && !r.meetsToday), 'the Q3,4 half of the semester pair is listed as not this quarter');
ok(sc.rollover.source === 'lastClass' && sc.rollover.min === 917, 'the school day ends with the student\'s last timed class (3:17)');
ok(d.classes.filter(c => c.support).map(c => c.short).join() === 'HR' && d.classes.filter(c => c.activity).length === 2, 'homeroom is a support class; the two activities are flagged');
ok(d.classes.find(c => c.classId === '7302').teacherEmail === 'dwhitfield@example.edu', 'teacher emails resolve through the Staff tab by name tokens');

// the due engine on teacher prose
const hw = d.homework;
const byTitle = (t) => hw.items.find(it => it.title.indexOf(t) === 0);
ok(hw.connected && hw.today === '2026-09-23', 'homework is connected for today');
ok(byTitle('Journal response due Thursday').dueOn === '2026-09-24' && byTitle('Journal response due Thursday').dueSource === 'text', '"due Thursday" typed on Monday resolves to Thursday from the text');
ok(byTitle('Bring your annotated text tomorrow').dueOn === '2026-09-24', '"tomorrow" typed on Wednesday is Thursday');
ok(byTitle('Essay outline due 9/30').dueOn === '2026-09-30' && byTitle('Current events summary due Monday').dueOn === '2026-09-28', 'a numeric date and a weekday name both resolve');
ok(byTitle('Pg. 118 #1-25 odd').dueOn === '2026-09-23' && byTitle('Pg. 118 #1-25 odd').dueSource === 'nextSchoolDay', 'an undated line is due the next school day, and page ranges are not read as dates');
const romans = byTitle('Memorize Romans 8:28-30 by Thursday');
ok(romans && romans.timesTyped === 3 && hw.items.filter(it => /Romans/.test(it.title)).length === 1, 'the same line typed three days running is ONE item, typed 3 times');
ok(!hw.items.some(it => /No homework/i.test(it.title)), '"No homework tonight!" is not a task');
const vocab = hw.items.find(it => it.title === 'Vocab Quiz 2A');
ok(vocab && vocab.source === 'assignment' && vocab.dueSource === 'gradebook' && vocab.timesTyped === 1 && vocab.points === 20,
  'the teacher\'s "Vocab quiz 9/29" line merges into the gradebook assignment with the same name and date');
ok(hw.items.find(it => it.title === 'Quiz 2.1-2.2').grade.display === '22', 'a scored assignment carries its score');
ok(hw.items.find(it => it.title === 'Lab 1: Motion on a Ramp').grade === null && hw.items.find(it => it.title === 'Lab 1: Motion on a Ramp').dueOn < hw.today, 'a past-due assignment with no score is there for the Ungraded bucket');
ok(hw.noSchool['2026-09-25'] && hw.noSchool['2026-11-26'] && hw.noSchool['2026-12-24'] && hw.noSchool['2027-01-01'],
  'no-school days come from the bells AND the school calendar through SchoolCal (a 3-day break and a 10-day break expanded day by day)');
ok(!hw.noSchool['2026-10-02'] && !hw.noSchool['2026-12-04'] && !hw.noSchool['2026-11-13'],
  'an early dismissal, a "Holiday" tournament and a non-participants day are NOT closures');

// the game-day card, parsed from the coach's prose
const a = M.athleticsApi('');
ok(a.enrolled && eq(a.teams.map(t => t.name), ['Varsity Girls Soccer']), 'Nora\'s activity enrolment resolves to the Varsity Girls Soccer calendar');
const today = a.events.find(e => e.date === '2026-09-23');
ok(today && today.dismissLabel === '2:00 PM' && today.departLabel === '2:15 PM' && today.homeAway === 'away', 'today\'s away game: dismissal 2:00 and bus 2:15 parsed from the description');
ok(a.events.find(e => e.date === '2026-09-29').dismiss === '' && a.events.find(e => e.date === '2026-09-29').homeAway === 'home', 'a home game with nothing posted has no dismissal (the card will say so)');
ok(a.events.find(e => e.date === '2026-10-06').canceled === true && !/CANCELED/.test(a.events.find(e => e.date === '2026-10-06').title), 'a "CANCELED:" title is flagged and the marker stripped');
ok(a.ok === true && a.partial === true && a.myTeamsFailed.length === 0, 'one unrelated calendar answered 429: partial, but Nora\'s own result is still ok');

// grades, attendance, prefs, inbox
const g = M.gradesApi('');
const gc = (short) => g.classes.find(c => c.short === short);
ok(g.connected && g.averagesOn && gc('Eng').average === '92.5' && gc('Eng').letter === 'A-', 'the class average is the category -1 row, not the sub-average');
ok(gc('Phys').average === '' && gc('Phys').total === 1 && gc('Phys').graded === 0, 'a class with no summary row shows no average rather than a guess');
ok(!g.classes.some(c => c.short === 'HR' || /Soccer|Honor/.test(c.name)), 'grades skip homeroom and activities');
const at = M.attendanceApi('');
ok(at.connected && at.todayKnown && at.today === null && at.days.length === 1 && at.counts.late === 1 && at.quarter === 1, 'Nora: here today, one late arrival this quarter');
ok(d.prefs && d.prefs.daily.on === true && M.inboxApi('').notices.length === 3, 'Nora has saved reminder settings and three notices in her inbox');
const saved = M.savePrefsApi('', { daily: { on: false }, weekly: { on: true, day: 0, time: '19:00' }, changes: { on: true, classes: ['7302', '9999'] }, tests: { on: true, daysBefore: 3 } });
ok(saved.ok && saved.prefs.weekly.time === '19:00' && eq(saved.prefs.changes.classes, ['7302']) && saved.prefs.updated === '2026-09-23T10:30:00',
  'saving prefs validates them through the real cleanPrefs_ (an unknown class id is dropped) and stamps the demo clock');
({ M, P, L } = boot(session));
ok(P.bootData().prefs.weekly.on === true, 'after a reload the saved prefs are still there (sessionStorage)');

// the switcher's choices
session.setItem('portal-demo-student', JSON.stringify('400106'));
({ M, P, L } = boot(session));
const owen = P.bootData();
ok(owen.profile.name === 'Owen Fairbanks' && owen.sports.onTeam, 'the switcher\'s student choice is honoured');
ok(eq(M.athleticsApi('').teams.map(t => t.id), ['soccer-jv-boys', 'soccer-v-boys']), 'a JV/Varsity enrolment matches BOTH calendars');
ok(M.attendanceApi('').today && M.attendanceApi('').today.status === 'Late', 'Owen is marked late today from the live attendance tab');
session.setItem('portal-demo-student', JSON.stringify('400112'));
({ M, P, L } = boot(session));
const tess = P.bootData();
ok(tess.elementary === true && tess.profile.homeroomTeacher === 'Almeida Rosa', 'a K5 student gets the elementary view');
session = memStorage();
({ M, P, L } = boot(session, '?sim=2026-09-26 09:00'));
const sat = P.bootData().schedule;
ok(sat.dayCol === '' && sat.schoolDay === false && sat.week['1'].date === '2026-09-28', 'on a Saturday the week shown is the week AHEAD');
({ M, P, L } = boot(memStorage(), '?sim=2026-09-23 15:45'));
const late = P.bootData().schedule;
ok(late.now === null && late.next === null && late.nowMin === 945, 'after the last class there is no NOW and no NEXT');

console.log('\n' + (fail ? fail + ' check(s) FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
