/* data.js — Parent-Teacher Conferences demo dataset. 100% FABRICATED: every student, guardian,
   teacher, email and room below is invented. Nothing here comes from a real record.

   The SAME fictional school as the Directory Search, Dismissal Board and Campus Presence demos.
   This file does not re-type the students: the page loads ../facts-directory/data.js first and
   this file hands its Sheet1 / Student Schedules / Teachers tabs — the exact FACTS export shape
   the conference app's RosterSync reads — to the app's own syncRoster() and syncTeachers() at
   boot (see mock.js). So each child's bookable list is produced by the app's real grade-tier
   rules (K-3 homeroom only · 4-6 distinct core teachers · 7-12 every class except Homeroom and
   Study Hall), not written by hand. The two things FACTS has that the directory demo lacks —
   a Staff tab (emails) and each teacher's Room — are fabricated here.

   Shape mirrors the two Google Sheets the production app reads: the FACTS export workbook
   (Sheet1 · Student Schedules · Teachers · Staff) and the app's own bound workbook
   (Settings · Roster · Teachers · Blocks · Bookings · Sessions), each tab as a values array
   with the header row first. */
window.PTC_DATA = (function () {
  'use strict';

  var DIR = window.DIRECTORY_DATA;
  if (!DIR) throw new Error('conferences/data.js needs ../facts-directory/data.js loaded first');
  function tab(name) { return DIR.tabs.filter(function (t) { return t.name === name; })[0].values; }

  /* ---------- the demo cast ----------
     Signed in: Greta Fairbanks, mother of Owen (9th) and Wren (7th) — two secondary-tier
     children, so the sibling-conflict warning and the shrinking "paper sheet" grid both show.
     Teacher screen: Marta Duvall (7th/8th English) by default; the switcher can pick others. */
  var DEMO = {
    guardianEmail: 'greta.fairbanks@example.com',
    teacherEmail: 'mduvall@example.edu',
    // Thursday + Friday evening conferences, 15-minute secondary slots / 20-minute elementary.
    dates: ['2026-10-22', '2026-10-23'],
    dayStart: '15:30', dayEnd: '19:00'
  };

  /* ---------- Staff tab (FACTS): Staff ID -> Email ----------
     FACTS stores teachers as "Last First"; the fabricated address is first-initial + last. */
  var teachersTab = tab('Teachers');
  var STAFF = [['Staff ID', 'Email']];
  var ROOMS = { // Room is local to the conference app (FACTS has none) and survives a re-sync.
    'Whitfield Dana': '103', 'Rasmussen Iris': '105', 'Okafor Simon': '100', 'Brennan Kate': '111',
    'Vandermeer Luke': '109', 'Delacroix Yvette': '112', 'Nakamura Ellis': '110', 'Duvall Marta': '204',
    'Peters Wesley': 'Band Room', 'Sandoval Rico': 'Gym office', 'Almeida Rosa': 'E105',
    'Sowell Gina': 'E211', 'Marchetti Dov': '603'
  };
  var LOCAL_TEACHERS = [['Name', 'Email', 'Room', 'GradeBand']];
  function emailFor(lastFirst) {
    var p = String(lastFirst).trim().split(/\s+/);
    return (p[1] ? p[1].charAt(0) : '').toLowerCase() + p[0].toLowerCase() + '@example.edu';
  }
  teachersTab.slice(1).forEach(function (r) {
    STAFF.push([r[0], emailFor(r[1])]);
    // Seed only Room — syncTeachers() rebuilds Name/Email/GradeBand and preserves Room by email.
    LOCAL_TEACHERS.push([r[1], emailFor(r[1]), ROOMS[r[1]] || '', '']);
  });

  /* ---------- Settings tab (key / value) ---------- */
  var SETTINGS = [
    ['Key', 'Value'],
    ['RosterSpreadsheetId', 'facts-export-demo'],   // the mock's id for the FACTS workbook
    ['ConferenceDate1', DEMO.dates[0]],
    ['ConferenceDate2', DEMO.dates[1]],
    ['DayStartTime', DEMO.dayStart],
    ['DayEndTime', DEMO.dayEnd],
    ['SlotLengthElementary', 20],
    ['SlotLengthSecondary', 15],
    ['GradeBandCutoff', 6]
  ];

  /* ---------- Blocks: times teachers have marked unavailable ----------
     [TeacherEmail, Date, StartTime, EndTime] */
  var D1 = DEMO.dates[0], D2 = DEMO.dates[1];
  var BLOCKS = [
    ['TeacherEmail', 'Date', 'StartTime', 'EndTime'],
    ['mduvall@example.edu',    D1, '15:30', '15:45'],   // bus duty
    ['mduvall@example.edu',    D1, '15:45', '16:00'],
    ['mduvall@example.edu',    D2, '18:30', '18:45'],
    ['mduvall@example.edu',    D2, '18:45', '19:00'],
    ['irasmussen@example.edu', D1, '17:00', '17:15'],
    ['irasmussen@example.edu', D1, '17:15', '17:30'],
    ['irasmussen@example.edu', D1, '17:30', '17:45'],
    ['enakamura@example.edu',  D2, '15:30', '15:45'],
    ['rsandoval@example.edu',  D1, '15:30', '17:00'],  // one long block — a game — spans six slots
    ['rsandoval@example.edu',  D2, '15:30', '17:00']
  ];

  /* ---------- Bookings already saved by OTHER families, plus one of Greta's own ----------
     RosterRow is filled in by mock.js after the real sync assigns row numbers.
     [Date, StartTime, EndTime, TeacherEmail, TeacherName, StudentFirst, StudentLast, Grade,
      ParentName, ParentEmail, Subject] */
  var BOOKINGS = [
    [D1, '16:00', '16:15', 'mduvall@example.edu',    'Duvall Marta',    'Jonathan', 'Halvorsen',  '08', 'Halvorsen Rita',  'rita.halvorsen@example.com',  'English - 8th Grade'],
    [D1, '16:15', '16:30', 'mduvall@example.edu',    'Duvall Marta',    'Maeve',    'Iverson',    '08', 'Iverson Colette', 'colette.iverson@example.com', 'English - 8th Grade'],
    [D1, '17:30', '17:45', 'mduvall@example.edu',    'Duvall Marta',    'Caleb',    'Jessup',     '07', 'Jessup Naomi',    'naomi.jessup@example.com',    'English - 7th Grade'],
    [D2, '16:00', '16:15', 'mduvall@example.edu',    'Duvall Marta',    'Jonathan', 'Halvorsen',  '08', 'Halvorsen Rita',  'rita.halvorsen@example.com',  'Middle School Volleyball'],
    [D1, '16:00', '16:15', 'irasmussen@example.edu', 'Rasmussen Iris',  'Nora',     'Alderman',   '12', 'Alderman Priya',  'priya.alderman@example.com',  'Calculus'],
    [D1, '16:30', '16:45', 'irasmussen@example.edu', 'Rasmussen Iris',  'Jonathon', 'Grady',      '09', 'Grady Adele',     'adele.grady@example.com',     'Algebra I'],
    [D2, '15:45', '16:00', 'irasmussen@example.edu', 'Rasmussen Iris',  'Caleb',    'Jessup',     '07', 'Jessup Naomi',    'naomi.jessup@example.com',    'Pre-Algebra'],
    [D1, '16:00', '16:15', 'enakamura@example.edu',  'Nakamura Ellis',  'Jonathon', 'Grady',      '09', 'Grady Adele',     'adele.grady@example.com',     'English - 9th Grade'],
    [D2, '17:00', '17:15', 'dwhitfield@example.edu', 'Whitfield Dana',  'Ivy',      'Castellano', '11', 'Castellano June', 'june.castellano@example.com', 'English - 11th Grade'],
    // Greta booked this one last week — it opens as a "Booked" sheet the parent can cancel.
    [D1, '18:00', '18:15', 'ydelacroix@example.edu', 'Delacroix Yvette', 'Owen',    'Fairbanks',  '09', 'Fairbanks Greta', 'greta.fairbanks@example.com', 'German I']
  ];
  var BOOKINGS_HEADER = ['Date', 'StartTime', 'EndTime', 'TeacherEmail', 'TeacherName', 'StudentFirst',
    'StudentLast', 'Grade', 'ParentName', 'ParentEmail', 'Timestamp', 'Subject', 'RosterRow'];

  return {
    demo: DEMO,
    // The FACTS export workbook, as RosterSync reads it.
    facts: {
      'Sheet1': tab('Sheet1'),
      'Student Schedules': tab('Student Schedules'),
      'Teachers': tab('Teachers'),
      'Staff': STAFF
    },
    // The app's own workbook. Roster is empty until the real sync fills it.
    local: {
      'Settings': SETTINGS,
      'Roster': [['StudentFirst', 'StudentLast', 'Grade', 'ParentName', 'ParentEmail', 'GuardiansJSON', 'TeachersJSON']],
      'Teachers': LOCAL_TEACHERS,
      'Blocks': BLOCKS,
      'Bookings': [BOOKINGS_HEADER],
      'Sessions': [['Token', 'Email', 'CreatedAt']]
    },
    seedBookings: BOOKINGS,
    bookingsHeader: BOOKINGS_HEADER
  };
})();
