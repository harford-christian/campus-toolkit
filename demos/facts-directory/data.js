/* data.js — Directory Search demo dataset. 100% FABRICATED: every student, guardian,
   teacher, email and room below is invented. Nothing here comes from a real record.

   Shape mirrors what the production app receives from its one bootstrap call
   (`tabsApi()`): the tabs of the nightly SIS export, each as {name, values} with
   values[0] the header row — exactly as the real Google Sheet is read.

   Tabs:
     Sheet1            LONG directory — one row per (student, guardian)
     Student Schedules one row per (student, class), incl. Class ID / Pattern / Period / Room
     Teachers          staff directory
     Period Times      the school's period grid: which TIME SLOT each pattern occupies per
                       weekday, plus its clock times. Built below from a compact spec.
*/
window.DIRECTORY_DATA = (function () {
  'use strict';

  /* ---------- the period grid ----------
     13 time slots x 5 weekdays. Slot label -> [Mon, Tue, Wed, Thu, Fri] "begin-end".
     Thursday runs a compressed late start; every other day shares one set of times. */
  var SLOTS = [
    [1,  'Homeroom',    '08:28-08:33', '08:28-08:33', '08:28-08:33', '08:28-08:33', '08:28-08:33'],
    [2,  'P1',          '08:36-09:21', '08:36-09:21', '08:36-09:21', '09:24-10:02', '08:36-09:21'],
    [3,  'P2',          '09:24-10:09', '09:24-10:09', '09:24-10:09', '10:05-10:43', '09:24-10:09'],
    [4,  'P3',          '10:12-10:57', '10:12-10:57', '10:12-10:57', '10:46-11:24', '10:12-10:57'],
    [5,  'P4 7-8',      '11:25-12:10', '11:25-12:10', '11:25-12:10', '11:52-12:30', '11:25-12:10'],
    [6,  'P4 9-12',     '11:00-11:45', '11:00-11:45', '11:00-11:45', '11:27-12:05', '11:00-11:45'],
    [7,  'Lunch 7-8',   '10:57-11:22', '10:57-11:22', '10:57-11:22', '11:24-11:49', '10:57-11:22'],
    [8,  'Lunch 9-12',  '11:45-12:10', '11:45-12:10', '11:45-12:10', '12:05-12:30', '11:45-12:10'],
    [9,  'P5',          '12:13-12:58', '12:13-12:58', '12:13-12:58', '12:33-13:11', '12:13-12:58'],
    [10, 'P6',          '13:01-13:46', '13:01-13:46', '13:01-13:46', '13:14-13:52', '13:01-13:46'],
    [11, 'P7',          '13:49-14:34', '13:49-14:34', '13:49-14:34', '13:55-14:33', '13:49-14:34'],
    [12, 'P8',          '14:37-15:17', '14:37-15:17', '14:37-15:17', '14:35-15:17', '14:37-15:17']
  ];

  /* Meeting patterns: pattern -> the (slot, weekday) cells it occupies.
     NOTE the reversal on Friday (day 5): "Period 1" sits in the P1 slot Monday-Thursday
     but in the P8 slot on Friday, so a first-period class meets at 2:37pm that day. This
     is the real scheduling quirk the app was built to get right. */
  var PATTERNS = {
    1:  { name: 'Period 1',    cells: [[2, 1], [2, 2], [2, 3], [2, 4], [12, 5]] },
    2:  { name: 'Period 2',    cells: [[3, 1], [3, 2], [3, 3], [3, 4], [11, 5]] },
    3:  { name: 'Period 3',    cells: [[4, 1], [4, 2], [4, 3], [4, 4], [10, 5]] },
    4:  { name: 'Period 4 7-8 grade',  cells: [[5, 1], [5, 2], [5, 3], [5, 4], [9, 5]] },
    5:  { name: 'Period 4 9-12 grade', cells: [[6, 1], [6, 2], [6, 3], [6, 4], [9, 5]] },
    6:  { name: 'Period 5 7-8',        cells: [[9, 1], [9, 2], [9, 3], [9, 4], [5, 5]] },
    7:  { name: 'Period 5 9-12',       cells: [[9, 1], [9, 2], [9, 3], [9, 4], [6, 5]] },
    8:  { name: 'Period 6',    cells: [[10, 1], [10, 2], [10, 3], [10, 4], [4, 5]] },
    9:  { name: 'Period 7',    cells: [[11, 1], [11, 2], [11, 3], [11, 4], [3, 5]] },
    10: { name: 'Period 8',    cells: [[12, 1], [12, 2], [12, 3], [12, 4], [2, 5]] },
    // an unnamed pattern in the source system — a part-week class (Mon/Wed + Fri)
    11: { name: '',            cells: [[12, 1], [12, 3], [2, 5]] }
  };

  var DAY_NAMES = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
  var TEMPLATE = [54, '7-12 Template'];

  // canonical label from the structural slot label — never from the hand-typed pattern name
  function canonical(slotLabel) {
    var m = /^P\s*(\d+)\s*(.*)$/.exec(slotLabel);
    if (m) return 'Period ' + Number(m[1]) + (m[2] ? ' (' + m[2].trim() + ')' : '');
    m = /^Lunch\s*(.*)$/.exec(slotLabel);
    if (m) return 'Lunch' + (m[1] ? ' (' + m[1].trim() + ')' : '');
    return slotLabel;
  }

  var slotByNum = {};
  SLOTS.forEach(function (s) { slotByNum[s[0]] = s; });

  function periodTimesValues() {
    var rows = [['Template ID', 'Template Name', 'Pattern', 'Pattern Name', 'Period',
                 'Day', 'Day Name', 'Slot', 'Slot Label', 'Begin', 'End']];
    // Pattern 0 = "slot rows": every cell in the grid, so slots that no pattern occupies
    // (Homeroom, the two lunches) can still be resolved.
    SLOTS.forEach(function (s) {
      for (var day = 1; day <= 5; day++) {
        var pair = s[1 + day].split('-');
        rows.push([TEMPLATE[0], TEMPLATE[1], 0, '(slot)', canonical(s[1]),
                   day, DAY_NAMES[day], s[0], s[1], pair[0] + ':00', pair[1] + ':00']);
      }
    });
    Object.keys(PATTERNS).map(Number).sort(function (a, b) { return a - b; }).forEach(function (p) {
      var pat = PATTERNS[p];
      var dominant = {}, best = '', n = 0;
      pat.cells.forEach(function (c) {
        var l = slotByNum[c[0]][1];
        dominant[l] = (dominant[l] || 0) + 1;
        if (dominant[l] > n) { n = dominant[l]; best = l; }
      });
      pat.cells.slice().sort(function (a, b) { return a[1] - b[1]; }).forEach(function (c) {
        var s = slotByNum[c[0]], day = c[1], pair = s[1 + day].split('-');
        rows.push([TEMPLATE[0], TEMPLATE[1], p, pat.name, canonical(best),
                   day, DAY_NAMES[day], s[0], s[1], pair[0] + ':00', pair[1] + ':00']);
      });
    });
    return rows;
  }

  /* ---------- fabricated people ---------- */
  var DIR_HEADER = ['Student ID (System)', 'LastName FirstName', 'Email', 'Status', 'Grade Level',
                    'LastName FirstName 1', 'Email 1', 'Email2', 'Homeroom', 'Homeroom Teacher', 'Gender'];

  // [id, name, email, grade, homeroom, hrTeacher, gender, [ [guardian, email, email2], ... ] ]
  var STUDENTS = [
    [400101, 'Alderman Nora',   'nalderman@example.edu', '12', 'HR-12-1', 'Whitfield Dana', 'Female',
      [['Alderman Priya', 'priya.alderman@example.com', 'p.alderman@example.net'], ['Alderman Ross', 'ross.alderman@example.com', '']]],
    [400102, 'Boyette Marcus',  'mboyette@example.edu', '12', 'HR-12-1', 'Whitfield Dana', 'Male',
      [['Boyette Trina', 'trina.boyette@example.com', '']]],
    [400103, 'Castellano Ivy',  'icastellano@example.edu', '11', 'HR-11-1', 'Okafor Simon', 'Female',
      [['Castellano June', 'june.castellano@example.com', ''], ['Castellano Paul', 'paul.castellano@example.com', '']]],
    [400104, 'Delgado Theo',    'tdelgado@example.edu', '11', 'HR-11-1', 'Okafor Simon', 'Male',
      [['Delgado Marisol', 'marisol.delgado@example.com', '']]],
    [400105, 'Enriquez Sasha',  'senriquez@example.edu', '10', 'HR-10-1', 'Brennan Kate', 'Female',
      [['Enriquez Dolores', 'dolores.enriquez@example.com', '']]],
    [400106, 'Fairbanks Owen',  'ofairbanks@example.edu', '09', 'HR-09-1', 'Nakamura Ellis', 'Male',
      [['Fairbanks Greta', 'greta.fairbanks@example.com', 'g.fairbanks@example.net'], ['Fairbanks Neil', 'neil.fairbanks@example.com', '']]],
    [400107, 'Fairbanks Wren',  'wfairbanks@example.edu', '07', 'HR-07-1', 'Duvall Marta', 'Female',
      [['Fairbanks Greta', 'greta.fairbanks@example.com', 'g.fairbanks@example.net'], ['Fairbanks Neil', 'neil.fairbanks@example.com', '']]],
    [400108, 'Grady Jonathon',  'jgrady@example.edu', '09', 'HR-09-1', 'Nakamura Ellis', 'Male',
      [['Grady Adele', 'adele.grady@example.com', '']]],
    [400109, 'Halvorsen Jonathan', 'jhalvorsen@example.edu', '08', 'HR-08-1', 'Duvall Marta', 'Male',
      [['Halvorsen Rita', 'rita.halvorsen@example.com', '']]],
    [400110, 'Iverson Maeve',   'miverson@example.edu', '08', 'HR-08-1', 'Duvall Marta', 'Female',
      [['Iverson Colette', 'colette.iverson@example.com', ''], ['Iverson Bram', 'bram.iverson@example.com', '']]],
    [400111, 'Jessup Caleb',    'cjessup@example.edu', '07', 'HR-07-1', 'Duvall Marta', 'Male',
      [['Jessup Naomi', 'naomi.jessup@example.com', '']]],
    [400112, 'Kirkwood Tess',   '', 'K5', 'K5-1', 'Almeida Rosa', 'Female',
      [['Kirkwood Helena', 'helena.kirkwood@example.com', '']]],
    [400113, 'Kirkwood Bram',   '', '03', '3-1', 'Sowell Gina', 'Male',
      [['Kirkwood Helena', 'helena.kirkwood@example.com', '']]],
    [400114, 'Lindqvist Anders', 'alindqvist@example.edu', '10', 'HR-10-1', 'Brennan Kate', 'Male',
      [['Lindqvist Suvi', 'suvi.lindqvist@example.com', '']]]
  ];

  function directoryValues() {
    var rows = [DIR_HEADER];
    STUDENTS.forEach(function (s) {
      var guardians = s[7].length ? s[7] : [['', '', '']];
      guardians.forEach(function (g) {
        rows.push([s[0], s[1], s[2], 'Enrolled', s[3], g[0], g[1], g[2], s[4], s[5], s[6]]);
      });
    });
    return rows;
  }

  /* ---------- fabricated schedules ----------
     [studentId, code, description, category, teacher, quarters, classId, pattern, room] */
  var SCHED_HEADER = ['Student ID', 'Student Name', 'Grade', 'Class Code', 'Class Description',
                      'Category', 'Teacher', 'Quarters', 'Class ID', 'Pattern', 'Period', 'Room',
                      'Activity', 'Course Dept'];
  var CLASSES = [
    // grade 12 — Nora. Includes the semester-split pair (Q1,2 vs Q3,4) sharing Period 6.
    [400101, 'HR-12',     'Homeroom - 12th Grade',        'Homeroom', 'Whitfield Dana', 'Q1,2,3,4', 7301, '',  '108'],
    [400101, 'E12-ENG',   'English - 12th Grade',         'Core', 'Whitfield Dana',  'Q1,2,3,4', 7302, 1,  '103'],
    [400101, 'MA-CALC',   'Calculus',                     'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7303, 2,  '105'],
    [400101, 'SC-PHYCS',  'Physics',                      'Core', 'Okafor Simon',    'Q1,2,3,4', 7304, 3,  '100'],
    [400101, 'BI12-DOC',  'Bible Doctrines',              'Core', 'Vandermeer Luke', 'Q1,2,3,4', 7305, 5,  '109'],
    [400101, 'SS-GOV',    'Government (1 semester)',      'Core', 'Brennan Kate',    'Q1,2',     7306, 8,  '111'],
    [400101, 'SS-ECO',    'Economics (1 semester)',       'Core', 'Brennan Kate',    'Q3,4',     7307, 8,  '111'],
    [400101, 'FL-SPA4',   'Spanish IV',                   'Core', 'Delacroix Yvette','Q1,2,3,4', 7308, 9,  '112'],
    [400101, 'FA-SHCB',   'Concert Band - Senior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7309, 11, 'Band Room (EL)'],
    // grade 12 — Marcus
    [400102, 'HR-12',     'Homeroom - 12th Grade',        'Homeroom', 'Whitfield Dana', 'Q1,2,3,4', 7301, '',  '108'],
    [400102, 'E12-ENG',   'English - 12th Grade',         'Core', 'Whitfield Dana',  'Q1,2,3,4', 7302, 1,  '103'],
    [400102, 'MA-STATS',  'Statistics',                   'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7310, 2,  '105'],
    [400102, 'TA-08',     'Teacher Assistant - 8th Period','Core', '',               'Q1,2,3,4', 7311, 10, ''],
    // grade 11
    [400103, 'HR-11',     'Homeroom - 11th Grade',        'Homeroom', 'Okafor Simon', 'Q1,2,3,4', 7320, '',  '107'],
    [400103, 'E11-ENG',   'English - 11th Grade',         'Core', 'Whitfield Dana',  'Q1,2,3,4', 7321, 2,  '103'],
    [400103, 'SC-CHEM',   'Chemistry',                    'Core', 'Okafor Simon',    'Q1,2,3,4', 7322, 3,  '100'],
    [400103, 'MA-ALG2',   'Algebra II',                   'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7323, 5,  '105'],
    [400103, 'FA-SHCB',   'Concert Band - Senior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7309, 11, 'Band Room (EL)'],
    [400104, 'HR-11',     'Homeroom - 11th Grade',        'Homeroom', 'Okafor Simon', 'Q1,2,3,4', 7320, '',  '107'],
    [400104, 'E11-ENG',   'English - 11th Grade',         'Core', 'Whitfield Dana',  'Q1,2,3,4', 7321, 2,  '103'],
    [400104, 'SS-USHIS',  'U.S. History',                 'Core', 'Brennan Kate',    'Q1,2,3,4', 7324, 1,  '111'],
    // grade 10
    [400105, 'HR-10',     'Homeroom - 10th Grade',        'Homeroom', 'Brennan Kate', 'Q1,2,3,4', 7330, '',  '111'],
    [400105, 'E10-ENG',   'English - 10th Grade',         'Core', 'Whitfield Dana',  'Q1,2,3,4', 7331, 3,  '103'],
    [400105, 'SC-BIO',    'Biology',                      'Core', 'Okafor Simon',    'Q1,2,3,4', 7332, 5,  '100'],
    [400105, 'FA-CHOIR',  'Vocal Choir - Senior High',    'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7333, 9, 'Sanctuary (EL)'],
    [400114, 'HR-10',     'Homeroom - 10th Grade',        'Homeroom', 'Brennan Kate', 'Q1,2,3,4', 7330, '',  '111'],
    [400114, 'E10-ENG',   'English - 10th Grade',         'Core', 'Whitfield Dana',  'Q1,2,3,4', 7331, 3,  '103'],
    [400114, 'MA-GEOM',   'Geometry',                     'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7334, 7,  '105'],
    // grade 9
    [400106, 'HR-09',     'Homeroom - 9th Grade',         'Homeroom', 'Nakamura Ellis', 'Q1,2,3,4', 7340, '', '110'],
    [400106, 'E09-ENG',   'English - 9th Grade',          'Core', 'Nakamura Ellis',  'Q1,2,3,4', 7341, 2,  '110'],
    [400106, 'MA-ALG1',   'Algebra I',                    'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7342, 9,  '105'],
    [400106, 'FL-GER1',   'German I',                     'Core', 'Delacroix Yvette','Q1,2,3,4', 7343, 1,  '112'],
    [400106, 'HPE-09',    'Physical Education - 9th Grade','Core', 'Sandoval Rico',  'Q1,2',     7344, 5,  'Gymnasium'],
    [400106, 'HLT-09',    'Health - 9th Grade',           'Core', 'Sandoval Rico',   'Q3,4',     7345, 5,  '106'],
    [400106, 'FA-SHCB',   'Concert Band - Senior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7309, 11, 'Band Room (EL)'],
    [400108, 'HR-09',     'Homeroom - 9th Grade',         'Homeroom', 'Nakamura Ellis', 'Q1,2,3,4', 7340, '', '110'],
    [400108, 'E09-ENG',   'English - 9th Grade',          'Core', 'Nakamura Ellis',  'Q1,2,3,4', 7341, 2,  '110'],
    [400108, 'MA-ALG1',   'Algebra I',                    'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7342, 9,  '105'],
    // grade 8 — two sections of the SAME code and teacher meeting different periods
    [400109, 'HR-08',     'Homeroom - 8th Grade',         'Homeroom', 'Duvall Marta', 'Q1,2,3,4', 7350, '',  '204'],
    [400109, 'E08-ENG',   'English - 8th Grade',          'Core', 'Duvall Marta',    'Q1,2,3,4', 7351, 1,  '204'],
    [400109, 'BI08-LOC',  'Life of Christ',               'Core', 'Vandermeer Luke', 'Q1,2,3,4', 7352, 3,  '109'],
    [400109, 'MA07-PRE',  'Pre-Algebra',                  'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7353, 4,  '105'],
    [400110, 'HR-08',     'Homeroom - 8th Grade',         'Homeroom', 'Duvall Marta', 'Q1,2,3,4', 7350, '',  '204'],
    [400110, 'E08-ENG',   'English - 8th Grade',          'Core', 'Duvall Marta',    'Q1,2,3,4', 7351, 1,  '204'],
    [400110, 'BI08-LOC',  'Life of Christ',               'Core', 'Vandermeer Luke', 'Q1,2,3,4', 7354, 6,  '109'], // 2nd section
    [400110, 'JHCB',      'Concert Band - Junior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7355, 4, 'Band Room (EL)'],
    // grade 7
    [400107, 'HR-07',     'Homeroom - 7th Grade',         'Homeroom', 'Duvall Marta', 'Q1,2,3,4', 7360, '',  '101'],
    [400107, 'E07-ENG',   'English - 7th Grade',          'Core', 'Duvall Marta',    'Q1,2,3,4', 7361, 2,  '101'],
    [400107, 'BI07-OTH',  'Old Testament History',        'Core', 'Vandermeer Luke', 'Q1,2,3,4', 7362, 4,  '109'],
    [400107, 'JHCB',      'Concert Band - Junior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7355, 4, 'Band Room (EL)'],
    [400111, 'HR-07',     'Homeroom - 7th Grade',         'Homeroom', 'Duvall Marta', 'Q1,2,3,4', 7360, '',  '101'],
    [400111, 'E07-ENG',   'English - 7th Grade',          'Core', 'Duvall Marta',    'Q1,2,3,4', 7361, 2,  '101'],
    [400111, 'MA07-PRE',  'Pre-Algebra',                  'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7353, 4,  '105'],
    // elementary — no periods exist in the source system for self-contained classrooms
    [400112, 'K5ALL',     'Kindergarten',                 'Core', 'Almeida Rosa',    'Q1,2,3,4', 7370, '',  'E105'],
    [400113, '3ALL',      'Third Grade',                  'Core', 'Sowell Gina',     'Q1,2,3,4', 7371, '',  'E211'],
    [400113, '3ART',      'Art - 3rd Grade',              'Specials', 'Marchetti Dov','Q1,2,3,4', 7372, '', '603']
  ];

  /* Teams and clubs. In the real system these are ordinary class enrolments whose COURSE
     carries an `activity` flag — so they arrive with the schedule and are split out by that
     structural flag, not by guessing from the name. Most have no period: they meet after
     school, which is exactly why they'd otherwise clutter a timed schedule as "not today".
     [studentId, code, description, category, teacher, quarters, classId, pattern, room,
      activity, courseDept] */
  var ACTIVITIES = [
    [400101, 'VGSC',    'Varsity Girls Soccer',        'Athletics', 'Sandoval Rico',  'Q1,2',     7401, '', '', 'Y', 'Athletics'],
    [400101, 'HonSoc',  'Honor Society 26-27',         'Core',      'Whitfield Dana', 'Q1,2,3,4', 7402, '', '', 'Y', 'Other'],
    [400103, 'VGSC',    'Varsity Girls Soccer',        'Athletics', 'Sandoval Rico',  'Q1,2',     7401, '', '', 'Y', 'Athletics'],
    [400106, 'JVVBSoc', 'JV/Varsity Boys Soccer',      'Athletics', 'Sandoval Rico',  'Q1,2',     7403, '', '', 'Y', 'Athletics'],
    [400106, 'PlayCast','Fall Play Cast',              'Core',      'Peters Wesley',  'Q1,2',     7404, '', '', 'Y', 'Fine Arts'],
    [400107, 'MSCCTRY', 'MS Cross Country',            'Athletics', 'Sandoval Rico',  'Q1,2',     7405, '', '', 'Y', 'Athletics'],
    [400110, 'MSVB',    'Middle School Volleyball',    'Athletics', 'Duvall Marta',   'Q1,2',     7406, '', '', 'Y', 'Athletics'],
    [400114, 'JVVBSoc', 'JV/Varsity Boys Soccer',      'Athletics', 'Sandoval Rico',  'Q1,2',     7403, '', '', 'Y', 'Athletics']
  ];

  /* The emergency call list — a separate list in the source system from the guardians on the
     directory tab (who to call vs. who the parents are). Every name/number here is invented. */
  var EMERGENCY_HEADER = ['Student ID', 'Student Name', 'Order', 'Contact Name', 'Relationship',
                          'Cell Phone', 'Home Phone', 'Work Phone', 'Email', 'Note'];
  var EMERGENCY = [
    [400101, 1, 'Priya Alderman',  'Mother',      '555-0101', '555-0140', '',         'priya.alderman@example.com', ''],
    [400101, 2, 'Ross Alderman',   'Father',      '555-0102', '555-0140', '555-0150', '',                            'call cell first'],
    [400101, 3, 'Vera Alderman',   'Grandparent', '555-0103', '',         '',         '',                            'lives nearby'],
    [400102, 1, 'Trina Boyette',   'Mother',      '555-0104', '',         '555-0151', 'trina.boyette@example.com',   ''],
    [400106, 1, 'Greta Fairbanks', 'Mother',      '555-0105', '555-0141', '',         'greta.fairbanks@example.com', ''],
    [400106, 2, 'Neil Fairbanks',  'Father',      '555-0106', '555-0141', '',         '',                            ''],
    [400107, 1, 'Greta Fairbanks', 'Mother',      '555-0105', '555-0141', '',         'greta.fairbanks@example.com', ''],
    [400112, 1, 'Helena Kirkwood', 'Mother',      '555-0107', '',         '',         'helena.kirkwood@example.com', ''],
    [400112, 2, 'Dot Kirkwood',    'Aunt',        '555-0108', '',         '',         '',                            'emergency pickup only']
  ];

  function emergencyValues() {
    var byId = {};
    STUDENTS.forEach(function (s) { byId[s[0]] = s; });
    var rows = [EMERGENCY_HEADER];
    EMERGENCY.forEach(function (e) {
      rows.push([e[0], byId[e[0]][1], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8]]);
    });
    return rows;
  }

  /* Today's attendance exceptions. The real feed refreshes every 15 minutes during school
     hours and only carries students who are NOT present, each row stamped with the date it
     was pulled so a stalled feed can't report yesterday's absences as today's. */
  var ATTENDANCE_HEADER = ['Student ID', 'Student Name', 'Date', 'Code', 'Status', 'Detail',
                           'Excused', 'Reason', 'Recorded At'];
  var ATTENDANCE = [
    [400103, 'AE', 'Absent',     'Absent - Excused',   'Y', 'fever, mom emailed'],
    [400109, 'AU', 'Absent',     'Absent - Unexcused', 'N', ''],
    [400105, 'LA', 'Late',       'Late Arrival',       'N', 'arrived at 8:43'],
    [400111, 'TU', 'Late',       'Tardy - Unexcused',  'N', 'signed in at 8:55'],
    [400114, 'ED', 'Left early', 'Early Dismissal',    'N', 'orthodontist, signed out 11:20']
  ];

  function attendanceValues(dateStr) {
    var byId = {};
    STUDENTS.forEach(function (s) { byId[s[0]] = s; });
    var rows = [ATTENDANCE_HEADER];
    ATTENDANCE.forEach(function (a) {
      rows.push([a[0], byId[a[0]][1], dateStr, a[1], a[2], a[3], a[4], a[5],
                 dateStr + 'T12:15:00Z']);
    });
    return rows;
  }

  function scheduleValues() {
    var byId = {};
    STUDENTS.forEach(function (s) { byId[s[0]] = s; });
    var slotOf = {};
    Object.keys(PATTERNS).forEach(function (p) {
      var dom = {}, best = '', n = 0;
      PATTERNS[p].cells.forEach(function (c) {
        var l = slotByNum[c[0]][1];
        dom[l] = (dom[l] || 0) + 1;
        if (dom[l] > n) { n = dom[l]; best = l; }
      });
      slotOf[p] = canonical(best);
    });
    var rows = [SCHED_HEADER];
    CLASSES.concat(ACTIVITIES).forEach(function (c) {
      var s = byId[c[0]];
      var isActivity = c[9] === 'Y';
      rows.push([c[0], s[1], s[3], c[1], c[2], c[3], c[4], c[5], c[6], c[7] || '',
                 c[7] ? slotOf[c[7]] : '', c[8],
                 isActivity ? 'Y' : 'N', c[10] || '']);
    });
    return rows;
  }

  /* ---------- fabricated staff ---------- */
  var TEACHERS = [
    // [staffId, name, active, level, dept, grades, core, specials, fineArts, athletics, homerooms]
    [9101, 'Whitfield Dana',   'Y', 'HS',    'Upper School',  '10,11,12', 'English', '', '', '', 'HR-12-1'],
    [9102, 'Rasmussen Iris',   'Y', 'MS/HS', 'Mathematics',   '7,8,9,10,11,12', 'Algebra I, Algebra II, Geometry, Calculus, Statistics, Pre-Algebra', '', '', '', ''],
    [9103, 'Okafor Simon',     'Y', 'HS',    'Science',       '10,11,12', 'Biology, Chemistry, Physics', '', '', '', 'HR-11-1'],
    [9104, 'Brennan Kate',     'Y', 'HS',    'Social Studies','10,11,12', 'U.S. History, Government, Economics', '', '', '', 'HR-10-1'],
    [9105, 'Vandermeer Luke',  'Y', 'MS/HS', 'Bible',         '7,8,12',   'Old Testament History, Life of Christ, Bible Doctrines', '', '', '', ''],
    [9106, 'Delacroix Yvette', 'Y', 'HS',    'World Language','9,10,11,12','German I, Spanish IV', '', '', '', ''],
    [9107, 'Nakamura Ellis',   'Y', 'HS',    'English',       '9',        'English - 9th Grade', '', '', '', 'HR-09-1'],
    [9108, 'Duvall Marta',     'Y', 'MS',    'Middle School', '7,8',      'English - 7th Grade, English - 8th Grade', '', '', '', 'HR-07-1, HR-08-1'],
    [9109, 'Peters Wesley',    'Y', 'MS/HS', 'Fine Arts',     '7,8,9,10,11,12', '', '', 'Concert Band - Junior High, Concert Band - Senior High, Vocal Choir - Senior High', '', ''],
    [9110, 'Sandoval Rico',    'Y', 'HS',    'Physical Education', '9',   'Physical Education - 9th Grade, Health - 9th Grade', '', '', 'Cross Country, Track', ''],
    [9111, 'Almeida Rosa',     'Y', 'Elem',  'Lower School',  'K5',       'Kindergarten', '', '', '', 'K5-1'],
    [9112, 'Sowell Gina',      'Y', 'Elem',  'Lower School',  '3',        'Third Grade', '', '', '', '3-1'],
    [9113, 'Marchetti Dov',    'Y', 'Elem',  'Fine Arts',     '1,2,3,4,5,6', '', 'Art', '', '', ''],
    // an inactive record — the app deliberately never lists these
    [9114, 'Ashby Gerald',     'N', 'MS',    'Middle School', '8',        '', '', '', '', '']
  ];
  var TEACHER_HEADER = ['Staff ID', 'Teacher', 'Active', 'Level', 'Department', 'Grades', 'Core',
                        'Specials', 'Fine-Arts Electives', 'Athletics', 'Homerooms', 'ELC'];

  function teacherValues() {
    var rows = [TEACHER_HEADER];
    TEACHERS.forEach(function (t) {
      rows.push([t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], t[9], t[10], '']);
    });
    return rows;
  }

  /* ---------- today's bells ----------
     What the bell system publishes for a normal day. The app prefers these over the grid's
     nominal times, which is how 2-hour delays and exam schedules stay correct. */
  var BELL_PERIODS = [
    { name: 'Homeroom',    start: '08:28', end: '08:33', type: 'period' },
    { name: '1st Period',  start: '08:36', end: '09:21', type: 'period' },
    { name: '2nd Period',  start: '09:24', end: '10:09', type: 'period' },
    { name: '3rd Period',  start: '10:12', end: '10:57', type: 'period' },
    { name: '4th Period',  start: '11:00', end: '11:45', type: 'period' },
    { name: 'Lunch',       start: '11:45', end: '12:10', type: 'lunch' },
    { name: '5th Period',  start: '12:13', end: '12:58', type: 'period' },
    { name: '6th Period',  start: '13:01', end: '13:46', type: 'period' },
    { name: '7th Period',  start: '13:49', end: '14:34', type: 'period' },
    { name: '8th Period',  start: '14:37', end: '15:17', type: 'period' }
  ];

  // The demo clock: Tuesday 2026-09-08, mid-morning — a school day, so a class is always in
  // session when the page opens. It also falls inside Q1 below, which is what lets the
  // semester-split pair resolve to a single answer instead of two maybes.
  var DEMO_NOW = { date: '2026-09-08', time: '10:30', dayOfWeek: 2 };

  /* ---------- transportation + siblings (the dismissal Roster) ----------
     In production this tab lives in ANOTHER spreadsheet, written daily at 04:00 by
     facts-api-sync/Transportation.gs, and it is the authority on two separate things: how a
     child gets home, and — via Family ID — who their siblings are. Deliberately exercises the
     three cases the UI has to distinguish:
       · a recorded bus rider (Source=route-class) — a fact
       · a residual-default Car (Source=residual-default) — an ASSUMPTION the UI must label
       · a split-custody student with TWO rows, who really does ride both routes
     Family IDs link the two Fairbanks siblings and the two Kirkwoods. */
  var ROSTER_HEADER = ['Student ID', 'Student Name', 'Grade', 'Session', 'Type', 'Route Code',
    'Route Name', 'Vehicle', 'Split', 'Building', 'Pickup', 'Pickup Basis', 'Walk To',
    'Family ID', 'Homeroom', 'Homeroom Teacher', 'Source', 'Note'];

  // [id, type, routeCode, routeName, vehicle, split, building, pickup, walkTo, familyId, source, note]
  var ROSTER = [
    [400101, 'Car',        '',    '',                 '',      '',   'HS', 'HS', '',        'F-1001', 'residual-default', ''],
    [400102, 'Bus',        'HDG', 'Havre de Grace',   'Bus 7', '',   'HS', 'HS', '',        'F-1002', 'route-class',      ''],
    [400103, 'Bus',        'ABD', 'Aberdeen',         'Bus 3', '',   'HS', 'HS', '',        'F-1003', 'route-class',      ''],
    [400104, 'Staff Kid',  '',    '',                 '',      '',   'HS', 'HS', '',        'F-1004', 'family-rule',      'parent teaches 4th'],
    [400105, 'Car',        '',    '',                 '',      '',   'HS', 'HS', '',        'F-1005', 'residual-default', ''],
    [400106, 'Bus',        'JRV', 'Jarrettsville',    'Bus 2', '',   'HS', 'HS', '',        'F-1006', 'route-class',      ''],
    [400107, 'Bus',        'JRV', 'Jarrettsville',    'Bus 2', '',   'MS', 'HS', 'HS lobby','F-1006', 'route-class',      'rides with older brother'],
    [400108, 'Early Bird', '',    '',                 '',      '',   'HS', 'EL', '',        'F-1008', 'family-rule',      ''],
    [400109, 'Bus',        'BLA', 'Bel Air',          'Bus 5', 'Y',  'MS', 'MS', '',        'F-1009', 'route-class',      'split custody — Mon/Wed'],
    [400109, 'Car',        '',    '',                 '',      'Y',  'MS', 'MS', '',        'F-1009', 'override-family',  'split custody — Tue/Thu/Fri'],
    [400110, 'Car',        '',    '',                 '',      '',   'MS', 'MS', '',        'F-1010', 'residual-default', ''],
    [400111, 'Bus',        'ABD', 'Aberdeen',         'Bus 3', '',   'MS', 'MS', '',        'F-1011', 'route-class',      ''],
    [400112, 'Car',        '',    '',                 '',      '',   'EL', 'EL', '',        'F-1012', 'residual-default', 'K5 — parent collects at the EL door'],
    [400113, 'Car',        '',    '',                 '',      '',   'EL', 'EL', '',        'F-1012', 'residual-default', ''],
    [400114, 'Bus',        'HDG', 'Havre de Grace',   'Bus 7', '',   'HS', 'HS', '',        'F-1014', 'route-class',      '']
  ];

  function rosterValues() {
    var byId = {};
    STUDENTS.forEach(function (s) { byId[s[0]] = s; });
    var rows = [ROSTER_HEADER.slice()];
    ROSTER.forEach(function (r) {
      var s = byId[r[0]] || [];
      rows.push([r[0], s[1] || '', s[3] || '', 'PM', r[1], r[2], r[3], r[4], r[5],
                 r[6], r[7], 'grade', r[8], r[9], s[4] || '', s[5] || '', r[10], r[11]]);
    });
    return rows;
  }

  /* ---------- authorised pickup ----------
     A separate FACTS list from the guardians and from the emergency call list: who may
     physically COLLECT the child. Phone-number heavy, which is why the real app defers this
     tab to a second call and keeps the section collapsed. One student is deliberately absent
     from the list so the demo shows "no pickup contacts recorded" — the honest empty state,
     which must read differently from "still loading". */
  var PICKUP_HEADER = ['pickupId', 'studentId', 'firstName', 'lastName', 'relationship',
                       'email', 'cellPhone', 'homePhone', 'workPhone'];
  var PICKUPS = [
    [1,  400101, 'Priya',   'Alderman',   'Mother',      'priya.alderman@example.com', '555-0101', '555-0102', ''],
    [2,  400101, 'Ross',    'Alderman',   'Father',      'ross.alderman@example.com',  '555-0103', '',         '555-0104'],
    [3,  400101, 'Dorothy', 'Alderman',   'Grandparent', '',                           '555-0105', '',         ''],
    [4,  400102, 'Trina',   'Boyette',    'Mother',      'trina.boyette@example.com',  '555-0111', '',         ''],
    [5,  400103, 'June',    'Castellano', 'Mother',      'june.castellano@example.com','555-0121', '',         ''],
    [6,  400105, 'Dolores', 'Enriquez',   'Mother',      'dolores.enriquez@example.com','555-0131','',         ''],
    [7,  400106, 'Greta',   'Fairbanks',  'Mother',      'greta.fairbanks@example.com','555-0141', '555-0142', ''],
    [8,  400107, 'Greta',   'Fairbanks',  'Mother',      'greta.fairbanks@example.com','555-0141', '555-0142', ''],
    [9,  400107, 'Neil',    'Fairbanks',  'Father',      'neil.fairbanks@example.com', '555-0143', '',         ''],
    [10, 400112, 'Helena',  'Kirkwood',   'Mother',      'helena.kirkwood@example.com','555-0151', '',         ''],
    [11, 400113, 'Helena',  'Kirkwood',   'Mother',      'helena.kirkwood@example.com','555-0151', '',         ''],
    [12, 400114, 'Suvi',    'Lindqvist',  'Mother',      'suvi.lindqvist@example.com', '555-0161', '',         '']
  ];
  function pickupValues() {
    return [PICKUP_HEADER.slice()].concat(PICKUPS.map(function (p) { return p.slice(); }));
  }

  /* ---------- today's sign-in/out (Campus Presence) ----------
     STATUS AND TIME ONLY — the real app deliberately drops guardian name, relationship and
     reason, because Campus Presence tiers those as OFFICE while this tool is open to the whole
     staff OU. Shape matches buildPresence's output so the mock can serve it directly.
       400114 left at 12:40 and has NOT come back  -> OUT (not in the building)
       400104 left at 09:15 and returned at 11:05  -> BACK
       400105 arrived late at 08:43                -> LATE (also in the attendance feed) */
  var PRESENCE = {
    '400114': { out: '12:40', back: '', late: '' },
    '400104': { out: '09:15', back: '11:05', late: '' },
    '400105': { out: '', back: '', late: '08:43' }
  };

  /* Today-only dismissal changes, which OVERRIDE the standing assignment above. */
  var OVERRIDES = {
    '400103': { type: 'CAR', routeCode: '', destination: 'front office', note: 'aunt collecting',
                by: 'office@example.edu' }
  };

  /* ---------- athletics (game-day dismissal) ----------
     The real app reads these off the 21 public team calendars and parses the dismissal out of
     whatever prose the coach typed into the event description. Here they are pre-parsed, since
     the demo has no calendars to fetch — the matching, ordering and tense logic below is the
     app's own untouched code. Nora (400101) is on Varsity Girls Soccer, which plays away today. */
  var ATHLETICS_TEAMS = [
    { id: 'soccer-v-girls', sport: 'Soccer', gender: 'Girls', level: 'Varsity' },
    { id: 'soccer-v-boys', sport: 'Soccer', gender: 'Boys', level: 'Varsity' },
    { id: 'volleyball-v-girls', sport: 'Volleyball', gender: 'Girls', level: 'Varsity' },
    { id: 'basketball-v-boys', sport: 'Basketball', gender: 'Boys', level: 'Varsity' }
  ];
  var ATHLETICS_EVENTS = [
    { teamId: 'soccer-v-girls', date: DEMO_NOW.date, title: 'Varsity Girls Soccer @ Rising Sun',
      start: '16:30', allDay: false, location: 'Rising Sun High School',
      dismiss: '14:00', depart: '14:15' },
    // A home game with no posted dismissal: nothing about the school day changes, so the app
    // deliberately shows NOTHING for it rather than "dismissal not posted".
    { teamId: 'volleyball-v-girls', date: DEMO_NOW.date, title: 'Varsity Volleyball vs Tome',
      start: '18:30', allDay: false, location: 'Harford Christian School', dismiss: '', depart: '' }
  ];

  /* Favourites the demo opens with, so the home screen shows the feature immediately: a
     sibling pair plus the student who is currently signed out. */
  var FAVORITES = ['400106', '400107', '400114'];

  return {
    tabs: [
      { name: 'Sheet1',             values: directoryValues() },
      { name: 'Student Schedules',  values: scheduleValues() },
      { name: 'Teachers',           values: teacherValues() },
      { name: 'Period Times',       values: periodTimesValues() },
      { name: 'Roster',             values: rosterValues() },
      { name: 'Emergency Contacts', values: emergencyValues() },
      { name: 'Attendance Today',   values: attendanceValues(DEMO_NOW.date) },
      { name: 'PickupContacts',     values: pickupValues() }
    ],
    // The two tabs the real app fetches in a SECOND call, after first paint — they feed only
    // collapsed sections. Named here so the mock can reproduce that split faithfully.
    deferredTabs: ['Emergency Contacts', 'PickupContacts'],
    presence: PRESENCE,
    overrides: OVERRIDES,
    favorites: FAVORITES,
    athleticsTeams: ATHLETICS_TEAMS,
    athleticsEvents: ATHLETICS_EVENTS,
    bellPeriods: BELL_PERIODS,
    demoNow: DEMO_NOW,
    // Quarter ranges: a class marked Q1,2 vs Q3,4 can share a period, and only the one whose
    // quarter contains today is really meeting. Without these the app says so rather than
    // guessing; with them it gives one definite answer.
    quarterDates: '1:2026-09-08..2026-11-08,2:2026-11-09..2027-01-31,' +
                  '3:2027-02-01..2027-04-11,4:2027-04-12..2027-06-18'
  };
})();
