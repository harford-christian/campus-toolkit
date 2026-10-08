#!/usr/bin/env node
/* verify.mjs — prove this demo still matches the app it claims to be.
 *
 *   node demos/conferences/verify.mjs
 *
 * Checks, in order of how much they matter:
 *   1. PRIVACY — no real person, no leaked id/URL, no real domain, in anything the demo ships.
 *   2. The vendored logic.js is in sync with the source project (byte-for-byte after the one
 *      staff-alias transform), and both built pages are fresh builds of their build.json.
 *   3. The mock covers every google.script.run method the two built pages actually call.
 *   4. Behaviour, end to end through the REAL code: the roster sync's grade tiers, the slot
 *      grid, a booking round trip parent -> teacher, the "just taken" and "already booked"
 *      refusals, cancel, and persistence across a reload.
 *
 * Exits 0 with SKIP for the source-project checks if the project isn't checked out beside this
 * repo (the showcase still has to verify on a machine that only has the showcase).
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { aliasStaffNames, findStaffNames } from '../../tools/staff-aliases.mjs';
import { buildLogic, SRC } from './build-logic.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

let fail = 0;
const ok = (c, m, extra) => { console.log((c ? 'PASS  ' : 'FAIL  ') + m + (!c && extra ? '\n        ' + extra : '')); if (!c) fail++; };
const skip = (m) => console.log('SKIP  ' + m);
const read = (f) => readFileSync(path.join(HERE, f), 'utf8');

const parent = read('parent.html'), teacher = read('teacher.html');
const dataJs = read('data.js'), mockJs = read('mock.js'), logicJs = read('logic.js'), switcher = read('index.html');
const all = [parent, teacher, dataJs, mockJs, logicJs, switcher].join('\n');

/* ---------------------------------- 1. privacy ---------------------------------- */
console.log('\n  privacy');
const leaks = all.match(/AKfycb[A-Za-z0-9_-]+|docs\.google\.com\/spreadsheets|script\.google\.com\/macros|\b1[A-Za-z0-9_-]{30,}/g) || [];
ok(leaks.length === 0, 'no deployment id, Sheet id or live URL', [...new Set(leaks)].slice(0, 3).join(', '));
ok(!/harford|\bHCS\b/i.test(all), 'the real school name/domain never appears (always-on scrub + a build replace)');
const staffHits = findStaffNames(all);
ok(staffHits.length === 0, 'no real staff name — matched by hash, never listed', staffHits.join(', '));
ok(!/Mueller|Seman|Boyd Stephanie/i.test(all), 'none of the real names from the source HANDOFF');
const emails = [...new Set(all.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])];
ok(emails.every(e => /@example\.(com|edu)$/.test(e)), 'every email address is @example.com / @example.edu', emails.filter(e => !/@example\.(com|edu)$/.test(e)).join(', '));

/* --------------------------- 2. vendored code + fresh builds --------------------------- */
console.log('\n  source sync');
if (!existsSync(SRC)) {
  skip('source project not found at ' + SRC + ' — logic drift and fresh-build checks skipped');
} else {
  ok(buildLogic() === logicJs, 'logic.js is the source project\'s six server files, verbatim (run build-logic.mjs)');
  const tmp = mkdtempSync(path.join(tmpdir(), 'ptc-verify-'));
  try {
    for (const [cfg, built] of [['build.parent.json', parent], ['build.teacher.json', teacher]]) {
      const c = JSON.parse(read(cfg));
      const tmpCfg = path.join(tmp, cfg);
      const dst = path.join(tmp, path.basename(c.dst));
      const absolute = { ...c, src: path.resolve(ROOT, c.src), dst };
      writeFileSync(tmpCfg, JSON.stringify(absolute));
      execFileSync(process.execPath, [path.join(ROOT, 'tools/build-demo.mjs'), tmpCfg], { cwd: ROOT, stdio: 'pipe' });
      ok(readFileSync(dst, 'utf8') === built, path.basename(c.dst) + ' is a fresh build of ' + cfg);
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

ok(!/<\?[=!][\s\S]*?\?>/.test(parent + teacher), 'no Apps Script template token left in either page');
ok(/<base target="_self">/.test(parent) && /<base target="_self">/.test(teacher), 'both pages target _self (they live in the switcher\'s iframe)');
ok(/<script src="\.\.\/facts-directory\/data\.js"><\/script>\s*<script src="logic\.js"><\/script>/.test(parent), 'the shared school dataset loads before logic.js, before the shim');
ok(!/var SSO_TOKEN = "/.test(parent) && /sessionStorage\.getItem\('ptc_demo_out'\)/.test(parent), 'the SSO ticket line is the demo constant, honouring Sign out');

/* ---------------------------------- 3. mock contract ---------------------------------- */
console.log('\n  mock contract');
// The handlers passed to a chain contain their own ".foo(" calls, so a regex over the chain is
// too greedy. Instead: find each google.script.run, then step over the with*Handler links (each
// with its balanced argument) to the first method called directly on the runner.
function calledMethodsStrict(html) {
  const out = new Set();
  let i = 0;
  while ((i = html.indexOf('google.script.run', i)) !== -1) {
    let j = i + 'google.script.run'.length;
    for (;;) {
      const m = /^\s*\.(\w+)\(/.exec(html.slice(j, j + 60));
      if (!m) break;
      if (/^with(Success|Failure)Handler$|^withUserObject$/.test(m[1])) {
        // skip the balanced argument of this link
        let depth = 0, k = j + m[0].length - 1;
        for (; k < html.length; k++) { if (html[k] === '(') depth++; else if (html[k] === ')') { depth--; if (!depth) break; } }
        j = k + 1;
        continue;
      }
      out.add(m[1]); break;
    }
    i = j;
  }
  return out;
}
const parentCalls = calledMethodsStrict(parent), teacherCalls = calledMethodsStrict(teacher);
ok(eq([...parentCalls].sort(), ['cancelBooking', 'getStudentAvailabilityGrid', 'loadStudentsFromSession', 'ssoLogin', 'submitBookings']),
  'the parent page calls exactly the five methods the source does', [...parentCalls].join(', '));
ok(eq([...teacherCalls].sort(), ['getCurrentTeacherGrid', 'saveTeacherBlockChanges']),
  'the teacher page calls exactly the two methods the source does', [...teacherCalls].join(', '));

/* ---------------------------------- 4. behaviour ---------------------------------- */
console.log('\n  behaviour (real code, in-memory sheets)');
function boot(session) {
  const window = { sessionStorage: session, console: { log() {} } };
  const load = (f) => new Function('window', 'sessionStorage', 'console', readFileSync(f, 'utf8'))(window, session, window.console);
  load(path.join(ROOT, 'demos/facts-directory/data.js'));
  load(path.join(HERE, 'data.js')); load(path.join(HERE, 'logic.js')); load(path.join(HERE, 'mock.js'));
  return window;
}
function memStorage() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const session = memStorage();
let W = boot(session);
let M = W.MOCK_BACKEND, L = W.PTC_LOGIC;
ok(Object.keys(M).sort().join() === [...new Set([...parentCalls, ...teacherCalls])].sort().join(), 'MOCK_BACKEND implements exactly the methods the pages call');

// the real roster sync, on the shared school
const roster = L.sheetRows_('Roster');
const byName = Object.fromEntries(roster.map(r => [r.StudentFirst + ' ' + r.StudentLast, r]));
const teachersOf = (n) => JSON.parse(byName[n].TeachersJSON);
ok(roster.length === 14, 'the roster is the Directory Search demo\'s 14 students, synced by the real RosterSync', roster.length);
ok(eq(teachersOf('Tess Kirkwood'), [{ subject: '', teacherName: 'Almeida Rosa' }]), 'K5: one meeting, the classroom teacher (elementary tier)');
ok(eq(teachersOf('Bram Kirkwood'), [{ subject: '', teacherName: 'Sowell Gina' }]), '3rd: the homeroom teacher only — Art (Specials) is not a conference');
ok(teachersOf('Wren Fairbanks').every(t => t.subject && t.teacherName !== '') && !teachersOf('Wren Fairbanks').some(t => /Homeroom/.test(t.subject)),
  '7th: every class with its name, Homeroom excluded (secondary tier)');
ok(teachersOf('Owen Fairbanks').some(t => t.subject === 'Physical Education - 9th Grade') && !teachersOf('Owen Fairbanks').some(t => t.subject === 'Health - 9th Grade'),
  '9th: the Q1 half of a semester pair is listed, the Q3,4 half is not');
ok(JSON.parse(byName['Maeve Iverson'].GuardiansJSON).length === 2, 'two guardians stay two guardians');

// sign-in and the parent grid
const s = M.ssoLogin('any-ticket');
ok(s.success && s.email === 'greta.fairbanks@example.com' && s.students.map(x => x.studentFirst).join() === 'Owen,Wren', 'the demo guardian signs in to her two children');
const owen = s.students[0], wren = s.students[1];
const gOwen = M.getStudentAvailabilityGrid(owen.rosterRow);
ok(gOwen.grid.length === 2 && gOwen.grid[0].slots.length === 14 && gOwen.grid[0].slots[0].start === '15:30' && gOwen.grid[0].slots[13].end === '19:00',
  'secondary grid: two dates x fourteen 15-minute slots from 3:30 to 7:00');
ok(gOwen.classes.length === 7 && !gOwen.classes.some(c => !c.teacherEmail), 'Owen\'s seven classes each resolve to a teacher email');
ok(eq(gOwen.bookings.map(b => b.subject), ['German I']), 'Greta\'s earlier German I booking is returned for Owen');
const delacroixAt = (date, start) => gOwen.grid.find(d => d.date === date).slots.find(x => x.start === start).teachers.some(t => t.teacherName === 'Delacroix Yvette');
ok(!delacroixAt('2026-10-22', '18:00') && delacroixAt('2026-10-22', '18:15'), 'the booked slot is closed for that teacher and the next one is open');
const sandovalOpen = gOwen.grid[0].slots.filter(x => x.teachers.some(t => t.teacherName === 'Sandoval Rico')).map(x => x.start);
ok(sandovalOpen[0] === '17:00', 'a single 90-minute block closes all six slots it overlaps', sandovalOpen.join(','));

// the booking round trip, parent -> teacher
const wrenEnglish = M.getStudentAvailabilityGrid(wren.rosterRow).classes.find(c => c.subject === 'English - 7th Grade');
const booking = { rosterRow: wren.rosterRow, date: '2026-10-22', start: '16:30', end: '16:45', teacherEmail: wrenEnglish.teacherEmail,
  teacherName: wrenEnglish.teacherName, subject: wrenEnglish.subject, studentFirst: 'Wren', studentLast: 'Fairbanks', grade: '07',
  parentName: 'Fairbanks Greta', parentEmail: 'greta.fairbanks@example.com' };
const r1 = M.submitBookings([booking]);
ok(r1.success && r1.results[0].success, 'the parent books Wren\'s English conference at 4:30');
const tg = M.getCurrentTeacherGrid();
const slot = tg.grid[0].slots.find(x => x.start === '16:30');
ok(tg.teacher.name === 'Duvall Marta' && slot.status === 'booked' && slot.studentName === 'Wren Fairbanks', 'the teacher\'s grid shows that slot booked, with her name');
ok(W.PTC_DEMO.outbox().length === 1 && W.PTC_DEMO.outbox()[0].to === 'greta.fairbanks@example.com', 'one confirmation email went to the outbox');
const r2 = M.submitBookings([{ ...booking, rosterRow: byName['Caleb Jessup']._row, studentFirst: 'Caleb', studentLast: 'Jessup', parentEmail: 'naomi.jessup@example.com' }]);
ok(!r2.success && /just taken/.test(r2.results[0].message), 'another family asking for the same slot is refused with "just taken"');
const r3 = M.saveTeacherBlockChanges([{ date: '2026-10-22', start: '16:30', end: '16:45', desiredBlocked: true }]);
ok(!r3.success && /already booked/.test(r3.results[0].message), 'the teacher cannot block a slot a parent holds');
const r4 = M.saveTeacherBlockChanges([{ date: '2026-10-22', start: '16:45', end: '17:00', desiredBlocked: true }]);
ok(r4.success, 'the teacher blocks the next slot');
ok(!M.getStudentAvailabilityGrid(wren.rosterRow).grid[0].slots.find(x => x.start === '16:45').teachers.some(t => t.teacherEmail === wrenEnglish.teacherEmail),
  'and the parent\'s grid no longer offers it for that teacher');

// persistence: a reload (fresh boot on the same sessionStorage) keeps the visit's state
W = boot(session); M = W.MOCK_BACKEND;
ok(M.getCurrentTeacherGrid().grid[0].slots.find(x => x.start === '16:30').studentName === 'Wren Fairbanks', 'after a reload the booking is still there (sessionStorage)');
const r5 = M.cancelBooking('2026-10-22', '16:30', wrenEnglish.teacherEmail, wren.rosterRow);
ok(r5.success && M.getCurrentTeacherGrid().grid[0].slots.find(x => x.start === '16:30').status === 'open', 'cancelling reopens the slot');
session.setItem('ptc-demo-teacher', JSON.stringify('gsowell@example.edu'));
W = boot(session); M = W.MOCK_BACKEND;
const sowell = M.getCurrentTeacherGrid();
ok(sowell.teacher.name === 'Sowell Gina' && sowell.grid[0].slots.length === 10 && sowell.grid[0].slots[0].end === '15:50',
  'the switcher\'s teacher choice is honoured; an elementary teacher gets 20-minute slots');
W = boot(memStorage()); M = W.MOCK_BACKEND;
ok(M.getCurrentTeacherGrid().grid[0].slots.find(x => x.start === '16:45').status === 'open', 'a new visit starts from the seed data again');

console.log('\n' + (fail ? fail + ' check(s) FAILED' : 'all checks passed'));
process.exit(fail ? 1 : 0);
