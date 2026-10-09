/* data.js — Student Portal demo dataset. 100% FABRICATED: every student, teacher, email, homework line, score,
   absence, game and calendar entry below is invented. Nothing here comes from a real record.

   The SAME fictional school as the Directory Search, Dismissal Board, Campus Presence and Conferences demos.
   The page loads ../facts-directory/data.js first; this file re-uses its Sheet1 / Student Schedules / Teachers /
   Period Times tabs as the portal's STAGING workbook (the nightly SIS export the real app reads) and adds the
   tabs the directory demo does not carry: Provisioning, Staff and today's Attendance.

   Everything else is shaped exactly like the portal's own private DATA workbook, written by its 30-minute FACTS
   sync (Sync.gs writeTab_ headers): Homework · Assignments · Grades · Averages · Attendance · Meta · Prefs ·
   Notices. Homework is deliberately typed the way teachers type it — "due Thursday", "quiz 9/29", "due
   tomorrow", the same line re-typed three days running — because the app's real Due.js is what turns that prose
   into dated items, and a dataset that bypassed it would be a drawing of the feature.

   Bells and the two calendar feeds (team calendars, the school calendar) are fabricated .ics text and BellHub
   verdicts; the app's own Athletics.js / SchoolCal.js parse them, so the 2:00 dismissal on the game card and the
   closed Friday both come out of the real parsers. */
window.PORTAL_DATA = (function () {
  'use strict';

  var DIR = window.DIRECTORY_DATA;
  if (!DIR) throw new Error('student-portal/data.js needs ../facts-directory/data.js loaded first');
  function tab(name) { return DIR.tabs.filter(function (t) { return t.name === name; })[0].values; }

  /* ---------- the demo clock ----------
     Wednesday 2026-09-23, 10:30 — third period on a normal day, two weeks into the year, in Q1. The week
     around it is chosen to exercise the schedule: Monday ran on a 2-hour delay (bells override FACTS times),
     Thursday is the compressed late-start grid, and Friday is a Professional Development Day — closed — which
     the school calendar says and the day tab must honour. */
  var DEMO = {
    now: '2026-09-23 10:30',
    students: [
      { id: '400101', email: 'nalderman@example.edu',  name: 'Nora Alderman',  label: 'Nora Alderman · 12th · Varsity Soccer' },
      { id: '400106', email: 'ofairbanks@example.edu', name: 'Owen Fairbanks', label: 'Owen Fairbanks · 9th · JV/V Soccer' },
      { id: '400107', email: 'wfairbanks@example.edu', name: 'Wren Fairbanks', label: 'Wren Fairbanks · 7th' },
      { id: '400112', email: '',                       name: 'Tess Kirkwood',  label: 'Tess Kirkwood · K5 (elementary view)' }
    ],
    defaultStudent: '400101',
    weekStart: '2026-09-21'
  };

  /* ---------- staging workbook: the tabs the directory demo lacks ---------- */
  var sheet1 = tab('Sheet1');
  var PROVISIONING = [['Student ID', 'First Name', 'Last Name', 'Nickname', 'Grade Level', 'Homeroom', 'Email']];
  var seen = {};
  sheet1.slice(1).forEach(function (r) {
    if (seen[r[0]]) return; seen[r[0]] = 1;
    var parts = String(r[1]).split(/\s+/);           // "Alderman Nora" -> last, first
    PROVISIONING.push([r[0], parts.slice(1).join(' '), parts[0], '', r[4], r[8], r[2]]);
  });
  // The one nickname on file — the profile shows "Wren" from Nickname rather than First Name.
  PROVISIONING.forEach(function (r) { if (r[0] === 400107) r[3] = 'Wren'; });

  var STAFF = [['First Name', 'Last Name', 'Active', 'Email']];
  tab('Teachers').slice(1).forEach(function (r) {
    var p = String(r[1]).split(/\s+/);               // "Duvall Marta" -> first Marta, last Duvall
    STAFF.push([p[1] || '', p[0], r[2], (p[1] ? p[1].charAt(0) : '').toLowerCase() + p[0].toLowerCase() + '@example.edu']);
  });

  var TODAY = '2026-09-23';
  var ATTENDANCE_TODAY = [
    ['Student ID', 'Student Name', 'Date', 'Code', 'Status', 'Detail', 'Excused', 'Reason', 'Recorded At'],
    [400106, 'Fairbanks Owen', TODAY, 'LA', 'Late',   'Late Arrival',       'N', 'arrived 8:52',  TODAY + 'T12:15:00Z'],
    [400103, 'Castellano Ivy', TODAY, 'AE', 'Absent', 'Absent - Excused',   'Y', 'fever',         TODAY + 'T12:15:00Z']
  ];

  /* ---------- the private DATA workbook (Sync.gs headers) ---------- */
  // [Class ID, Plan Date, Homework, Homework HTML, Modified, AutoNum] — one row per class per day, as FACTS holds it
  var HOMEWORK = [['Class ID', 'Plan Date', 'Homework', 'Homework HTML', 'Modified', 'AutoNum']];
  function hw(classId, date, text, html) {
    HOMEWORK.push([classId, date, text, html || ('<p>' + text + '</p>'), date + ' 15:40:00', HOMEWORK.length]);
  }
  // Nora (12th)
  hw(7302, '2026-09-21', 'Read Hamlet Act 2, scenes 1-2. Journal response due Thursday.',
     '<p>Read Hamlet Act 2, scenes 1-2.</p><p>Journal response due Thursday.</p>');
  hw(7302, '2026-09-22', 'Finish the Act 2 comprehension questions (p. 44-45).');
  hw(7302, '2026-09-23', 'Essay outline due 9/30. Bring your annotated text tomorrow.',
     '<p>Essay outline due 9/30.</p><p>Bring your annotated text tomorrow.</p>');
  hw(7303, '2026-09-22', 'Pg. 118 #1-25 odd');
  hw(7303, '2026-09-23', 'Pg. 124 #2-20 even. Quiz Thursday on sections 2.1-2.4.',
     '<p>Pg. 124 #2-20 even.</p><p>Quiz Thursday on sections 2.1-2.4.</p>');
  hw(7304, '2026-09-22', 'No homework tonight!');
  hw(7304, '2026-09-23', 'Lab report (Lab 2: Projectiles) due tomorrow. Typed, with your data table attached.');
  hw(7305, '2026-09-21', 'Memorize Romans 8:28-30 by Thursday.');   // the same line, three days running:
  hw(7305, '2026-09-22', 'Memorize Romans 8:28-30 by Thursday.');   // the real engine folds it into ONE item
  hw(7305, '2026-09-23', 'Memorize Romans 8:28-30 by Thursday.');
  hw(7306, '2026-09-22', 'Read ch. 3 pp. 60-72 and answer the review questions.');
  hw(7306, '2026-09-23', 'Current events summary due Monday.');
  hw(7308, '2026-09-23', 'Study vocabulario 2A. Vocab quiz 9/29.');
  // Owen (9th)
  hw(7341, '2026-09-23', 'Vocabulary unit 3 — quiz next Tuesday. Finish the short-story questions for tomorrow.',
     '<p>Vocabulary unit 3 — quiz next Tuesday.</p><p>Finish the short-story questions for tomorrow.</p>');
  hw(7342, '2026-09-22', 'p. 76 #1-30');
  hw(7342, '2026-09-23', 'p. 81 #5-25 odd. Chapter 2 test on 10/1.');
  hw(7343, '2026-09-22', 'Study the der/die/das list for tomorrow.');
  // Wren (7th)
  hw(7361, '2026-09-23', 'Read chapter 5 of Hatchet. Reading log due Thursday.');
  hw(7362, '2026-09-23', 'Map of Canaan due Monday — colour the twelve tribes.');
  // Tess (K5)
  hw(7370, '2026-09-23', 'Practice letters A-E with a grown-up. Library books come back Thursday.');

  // [Assignment ID, Class ID, Category ID, Title, Description, Date Assigned, Date Due, Max Points, Weight]
  var ASSIGNMENTS = [
    ['Assignment ID', 'Class ID', 'Category ID', 'Title', 'Description', 'Date Assigned', 'Date Due', 'Max Points', 'Weight'],
    [9001, 7302, 2, 'Hamlet Act 1 Response',    '',                                          '2026-09-14', '2026-09-18', 20,  1],
    [9002, 7303, 1, 'Quiz 2.1-2.2',             '',                                          '2026-09-15', '2026-09-17', 25,  1],
    [9003, 7304, 3, 'Lab 1: Motion on a Ramp',  'Typed report with data table and graph.',   '2026-09-11', '2026-09-16', 30,  1],
    [9004, 7306, 3, 'Constitution Test',        'Articles I-III and the Bill of Rights.',    '2026-09-23', '2026-09-30', 100, 2],
    [9005, 7308, 2, 'Vocab Quiz 2A',            '',                                          '2026-09-23', '2026-09-29', 20,  1],
    [9101, 7342, 3, 'Chapter 1 Test',           '',                                          '2026-09-14', '2026-09-18', 100, 2],
    [9102, 7341, 2, 'Summer Reading Essay',     'Five paragraphs on your summer novel.',     '2026-09-08', '2026-09-12', 50,  1],
    [9201, 7361, 1, 'Spelling Test 3',          '',                                          '2026-09-15', '2026-09-19', 20,  1]
  ];
  // [Assignment ID, Student ID, Class ID, Display Grade, Status, Earned, Max, Notes]
  var GRADES = [
    ['Assignment ID', 'Student ID', 'Class ID', 'Display Grade', 'Status', 'Earned', 'Max', 'Notes'],
    [9001, 400101, 7302, '18', 'Graded', 18, 20, ''],
    [9002, 400101, 7303, '22', 'Graded', 22, 25, ''],
    // 9003 (Physics lab) has NO row for Nora: past due with no score -> the Ungraded bucket
    [9101, 400106, 7342, '84', 'Graded', 84, 100, ''],
    // 9102 (Owen's essay) has no row either
    [9201, 400107, 7361, '19', 'Graded', 19, 20, '']
  ];
  // [Class ID, Student ID, Category ID, Average, Letter, Points Earned, Points Possible, Full Average, Term ID]
  // FACTS writes the CLASS total as category -1 (the only lettered row); 1..n are per-category sub-averages.
  var AVERAGES = [
    ['Class ID', 'Student ID', 'Category ID', 'Average', 'Letter', 'Points Earned', 'Points Possible', 'Full Average', 'Term ID'],
    [7302, 400101, -1, '92.5', 'A-', 37, 40, '92.5', 1],
    [7302, 400101, 2,  '90',   '',   18, 20, '90',   1],
    [7303, 400101, -1, '88',   'B+', 22, 25, '88',   1],
    [7306, 400101, -1, '95',   'A',  95, 100, '95',  1],
    // Physics (7304): no summary rows yet -> the app shows NO average rather than a guessed one
    [7342, 400106, -1, '84',   'B',  84, 100, '84',  1],
    [7361, 400107, -1, '95',   'A',  19, 20, '95',   1]
  ];
  // [Student ID, Date, Code, Status, Detail, Excused] — exception-only: a day with no row was present
  var ATTENDANCE = [
    ['Student ID', 'Date', 'Code', 'Status', 'Detail', 'Excused'],
    [400101, '2026-09-15', 'LA', 'Late',       'Late Arrival',      'N'],
    [400106, '2026-09-10', 'AE', 'Absent',     'Absent - Excused',  'Y'],
    [400106, '2026-09-18', 'ED', 'Left early', 'Early Dismissal',   'Y']
  ];
  // Meta: lastSyncAt / lastSyncOk are stamped by mock.js at boot; noSchoolDays is computed by the app's own
  // noSchoolDaysCached_ from the bells + the school calendar below, exactly as the sync computes it.
  var META = [['Key', 'Value'], ['syncVersion', 'demo'], ['lastSyncOk', 'true']];
  var PREFS = [
    ['Email', 'Student ID', 'Prefs JSON', 'Updated'],
    ['nalderman@example.edu', '400101',
      JSON.stringify({ daily: { on: true, time: '18:00', schoolDaysOnly: true }, weekly: { on: false, day: 0, time: '18:00' },
        changes: { on: false, classes: [] }, tests: { on: true, daysBefore: 2 }, lastDaily: '2026-09-22', lastWeekly: '', updated: '2026-09-12T19:02:11' }),
      '2026-09-12T19:02:11']
  ];
  var NOTICES = [
    ['When', 'Email', 'Student ID', 'Type', 'Subject', 'Body', 'Key'],
    ['2026-09-21T18:00:08', 'nalderman@example.edu', '400101', 'daily', 'Tonight: 3 things due Tue 9/22',
      'Due Tue 9/22\n• Calc — Pg. 118 #1-25 odd\n• Gov — Read ch. 3 pp. 60-72\n• Bible — Memorize Romans 8:28-30 (by Thu)\n\nTests this week: Calc quiz Thu 9/24', 'daily|2026-09-21'],
    ['2026-09-22T18:00:12', 'nalderman@example.edu', '400101', 'daily', 'Tonight: 2 things due Wed 9/23',
      'Due Wed 9/23\n• Eng — Finish the Act 2 comprehension questions (p. 44-45)\n• Calc — Pg. 118 #1-25 odd\n\nTests this week: Calc quiz Thu 9/24', 'daily|2026-09-22'],
    ['2026-09-22T06:30:02', 'nalderman@example.edu', '400101', 'tests', 'Quiz Thursday: Calculus 2.1-2.4',
      'Quiz Thursday on sections 2.1-2.4 — Calculus, Rasmussen Iris. Due Thu 9/24.', 'tests|hw|7303|quiz thursday on sections 2124|2026-09-24']
  ];

  /* ---------- bells (BellHub verdicts) ----------
     The portal asks BellHub for each weekday of the week. Normal days answer with the standard bells; Monday
     2026-09-21 was a 2-hour delay (every period shifts, and the app prefers these over FACTS times); Friday
     2026-09-25 is closed. Unknown dates get the normal verdict from mock.js. */
  function periods(list) { return list.map(function (p) { return { name: p[0], start: p[1], end: p[2] }; }); }
  var NORMAL = periods([['Homeroom', '08:28', '08:33'], ['1st Period', '08:36', '09:21'], ['2nd Period', '09:24', '10:09'],
    ['3rd Period', '10:12', '10:57'], ['4th Period', '11:00', '11:45'], ['Lunch', '11:45', '12:10'], ['5th Period', '12:13', '12:58'],
    ['6th Period', '13:01', '13:46'], ['7th Period', '13:49', '14:34'], ['8th Period', '14:37', '15:17']]);
  var DELAY = periods([['Homeroom', '10:28', '10:33'], ['1st Period', '10:36', '11:06'], ['2nd Period', '11:09', '11:39'],
    ['3rd Period', '11:42', '12:12'], ['4th Period', '12:15', '12:45'], ['Lunch', '12:45', '13:10'], ['5th Period', '13:13', '13:43'],
    ['6th Period', '13:46', '14:16'], ['7th Period', '14:19', '14:49'], ['8th Period', '14:52', '15:17']]);
  var BELLS = {
    '2026-09-21': { ok: true, date: '2026-09-21', weekday: 'Monday', mode: '2-Hour Delay', source: 'calendar', closed: false, periods: DELAY, warning: null },
    '2026-09-25': { ok: true, date: '2026-09-25', weekday: 'Friday', mode: 'No School', source: 'calendar', closed: true, periods: [], warning: null }
  };
  function bellFor(iso) {
    if (BELLS[iso]) return BELLS[iso];
    var dow = new Date(iso + 'T00:00:00Z').getUTCDay();
    return { ok: true, date: iso, weekday: '', mode: 'Normal', source: 'default', closed: dow === 0 || dow === 6, periods: NORMAL, warning: null };
  }

  /* ---------- calendars, as the public .ics feeds the app really reads ----------
     Team calendars: the dismissal exists only as prose the coach typed into the description — the app's
     Athletics.js parses it. One game is called off the way coaches actually do it (a CANCELED: prefix), one is
     a home game with nothing posted (the card must say "no dismissal posted", not invent one), and one unrelated
     calendar answers HTTP 429 so the page shows its honest "some calendars did not answer" note. */
  function ics(events) {
    var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//demo//EN'];
    events.forEach(function (e) {
      out.push('BEGIN:VEVENT');
      out.push('UID:' + e.uid + '@demo');
      if (e.allDay) { out.push('DTSTART;VALUE=DATE:' + e.start); if (e.end) out.push('DTEND;VALUE=DATE:' + e.end); }
      else { out.push('DTSTART;TZID=America/New_York:' + e.start); if (e.end) out.push('DTEND;TZID=America/New_York:' + e.end); }
      out.push('SUMMARY:' + e.summary);
      if (e.location) out.push('LOCATION:' + e.location);
      if (e.description) out.push('DESCRIPTION:' + e.description);
      if (e.status) out.push('STATUS:' + e.status);
      out.push('END:VEVENT');
    });
    out.push('END:VCALENDAR');
    return out.join('\r\n') + '\r\n';
  }
  var ICS = {
    'soccer-v-girls': ics([
      { uid: 'vgs1', start: '20260923T163000', end: '20260923T180000', summary: 'Varsity Girls Soccer @ Rising Sun',
        location: 'Rising Sun High School', description: 'Dismissal 2:00 pm. Bus departs 2:15 pm. Bring both jerseys.' },
      { uid: 'vgs2', start: '20260929T160000', end: '20260929T173000', summary: 'Varsity Girls Soccer vs Tome',
        location: 'Harford Christian School', description: 'Home game. JV plays first.' },
      { uid: 'vgs3', start: '20261006T160000', end: '20261006T173000', summary: 'CANCELED: Varsity Girls Soccer @ Harford Tech',
        location: 'Harford Technical High School', description: 'Field unplayable. Dismissal 2:30.' },
      { uid: 'vgs4', start: '20261009T180000', end: '20261009T193000', summary: 'Senior Night — Varsity Girls Soccer vs Calvary',
        location: 'Harford Christian School', description: 'Senior ceremony 5:40.' }
    ]),
    'soccer-v-boys': ics([
      { uid: 'vbs1', start: '20260924T160000', end: '20260924T173000', summary: 'Varsity Boys Soccer @ Elkton',
        location: 'Elkton High School', description: 'Dismiss 2:10. Depart school at 2:25 pm.' },
      { uid: 'vbs2', start: '20261001T160000', end: '20261001T173000', summary: 'Varsity Boys Soccer vs Cecil Christian',
        location: 'Harford Christian School', description: '' }
    ]),
    'soccer-jv-boys': ics([
      { uid: 'jvb1', start: '20260924T150000', end: '20260924T161500', summary: 'JV Boys Soccer @ Elkton',
        location: 'Elkton High School', description: 'Dismiss 2:10. Depart school at 2:25 pm.' },
      { uid: 'jvb2', start: '20261001T150000', end: '20261001T161500', summary: 'JV Boys Soccer vs Cecil Christian',
        location: 'Harford Christian School', description: '' }
    ]),
    'crosscountry-v-coed': ics([
      { uid: 'xc1', start: '20260926T090000', end: '20260926T120000', summary: 'Cross Country — Bull Run Invitational',
        location: 'Bull Run Park', description: 'Depart school 7:15 am. Saturday meet.' }
    ]),
    'volleyball-ms-girls': ics([
      { uid: 'msv1', start: '20260930T160000', end: '20260930T173000', summary: 'MS Girls Volleyball vs Tome',
        location: 'Harford Christian School', description: '' }
    ])
  };
  // School calendar: closures, an early dismissal that is STILL a school day, a tournament whose title says
  // "Holiday" and must not close anything, and a multi-day break in one row (DTEND exclusive).
  var SCHOOL_ICS = ics([
    { uid: 'pd', allDay: true, start: '20260925', end: '20260926', summary: 'Professional Development Day — No School' },
    { uid: 'early', allDay: true, start: '20261002', end: '20261003', summary: '3-Hour Early Dismissal' },
    { uid: 'tipoff', allDay: true, start: '20261204', end: '20261205', summary: 'Holiday Tip-Off Basketball Tournament' },
    { uid: 'thanks', allDay: true, start: '20261125', end: '20261128', summary: 'Thanksgiving Break — School and Offices Closed' },
    { uid: 'xmas', allDay: true, start: '20261223', end: '20270102', summary: 'School and Offices Closed — Christmas Break' },
    { uid: 'macs', allDay: true, start: '20261113', end: '20261114', summary: 'MACS Fine Arts Festival — no school for non-participants' }
  ]);

  // The memo-check sheet (campus-control/memo-check reads the weekly office memo and files chapel and notes rows).
  // The portal reads two of its tabs, read-only. One memo per week; the newest live memo wins. No speakers named.
  var CHAPEL = [['CreatedAt', 'EmailDate', 'WeekOf', 'Day', 'Date', 'Display', 'Time', 'NoChapel'],
    ['2026-09-13 18:40', '2026-09-13', '2026-09-14', 'Wednesday', '2026-09-16', 'Opening chapel — the senior class leads worship', '08:35:00', 'false'],
    ['2026-09-20 18:02', '2026-09-20', '2026-09-21', 'Wednesday', '2026-09-23', 'The junior class leads worship · Missions Week kickoff', '08:35:00', 'false'],
    ['2026-09-27 17:55', '2026-09-27', '2026-09-28', 'Wednesday', '2026-09-30', 'Missions Week guest — the summer team shares', '08:35:00', 'false']];
  var MEMO_NOTES = [['CreatedAt', 'EmailDate', 'WeekOf', 'Kind', 'Day', 'Date', 'Title'],
    ['2026-09-20 18:02', '2026-09-20', '2026-09-21', 'exam', 'Thursday', '2026-09-24', 'Algebra II unit 1 test (all sections)'],
    ['2026-09-20 18:02', '2026-09-20', '2026-09-21', 'spirit', 'Thursday', '2026-09-24', 'Spirit Day — wear your class colour'],
    ['2026-09-20 18:02', '2026-09-20', '2026-09-21', 'picture', 'Tuesday', '2026-09-29', 'Picture retakes, 9:00 in the gym']];

  // The team table the app joins against. Same ids and shape as production; the calendar ids are demo keys.
  var TEAMS = [
    ['baseball-jv-boys', 'Baseball', 'Boys', 'JV'], ['baseball-ms-boys', 'Baseball', 'Boys', 'MS'], ['baseball-v-boys', 'Baseball', 'Boys', 'Varsity'],
    ['basketball-jv-boys', 'Basketball', 'Boys', 'JV'], ['basketball-jv-girls', 'Basketball', 'Girls', 'JV'], ['basketball-ms-boys', 'Basketball', 'Boys', 'MS'],
    ['basketball-ms-girls', 'Basketball', 'Girls', 'MS'], ['basketball-v-boys', 'Basketball', 'Boys', 'Varsity'], ['basketball-v-girls', 'Basketball', 'Girls', 'Varsity'],
    ['crosscountry-v-coed', 'Cross-Country', 'Coed', 'Varsity'], ['flagfootball-jv-coed', 'Flag Football', 'Coed', 'JV', true], ['golf-v-coed', 'Golf', 'Coed', 'Varsity'],
    ['soccer-jv-boys', 'Soccer', 'Boys', 'JV'], ['soccer-ms-boys', 'Soccer', 'Boys', 'MS'], ['soccer-ms-girls', 'Soccer', 'Girls', 'MS'],
    ['soccer-v-boys', 'Soccer', 'Boys', 'Varsity'], ['soccer-v-girls', 'Soccer', 'Girls', 'Varsity'], ['softball-v-girls', 'Softball', 'Girls', 'Varsity'],
    ['volleyball-jv-girls', 'Volleyball', 'Girls', 'JV'], ['volleyball-ms-girls', 'Volleyball', 'Girls', 'MS'], ['volleyball-v-girls', 'Volleyball', 'Girls', 'Varsity']
  ].map(function (t) { return { id: t[0], sport: t[1], gender: t[2], level: t[3], calendarId: 'demo-cal-' + t[0], hidden: !!t[4] }; });
  var FAILING_CALENDARS = ['demo-cal-golf-v-coed'];   // answers HTTP 429, like Google does when rate-limiting

  return {
    demo: DEMO,
    staging: {
      'Student Schedules': tab('Student Schedules'),
      'Period Times': tab('Period Times'),
      'Provisioning': PROVISIONING,
      'Sheet1': sheet1,
      'Staff': STAFF,
      'Attendance Today': ATTENDANCE_TODAY
    },
    data: {
      'Homework': HOMEWORK, 'Assignments': ASSIGNMENTS, 'Grades': GRADES, 'Averages': AVERAGES, 'Attendance': ATTENDANCE,
      'Meta': META, 'UserState': [['Email', 'Item Key', 'State', 'Updated']], 'SyncLog': [['When', 'Note']],
      'AdminViews': [['When', 'Admin', 'Student ID', 'Student', 'Note']], 'Prefs': PREFS, 'Notices': NOTICES
    },
    memo: { 'Chapel': CHAPEL, 'MemoNotes': MEMO_NOTES },
    bellFor: bellFor,
    ics: ICS, schoolIcs: SCHOOL_ICS, teams: TEAMS, failingCalendars: FAILING_CALENDARS,
    quarterDates: DIR.quarterDates
  };
})();
