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
                      'Category', 'Teacher', 'Quarters', 'Class ID', 'Pattern', 'Period', 'Room'];
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
    [400101, 'FA-SHCB',   'Concert Band - Senior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7309, 11, 'Band Room'],
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
    [400103, 'FA-SHCB',   'Concert Band - Senior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7309, 11, 'Band Room'],
    [400104, 'HR-11',     'Homeroom - 11th Grade',        'Homeroom', 'Okafor Simon', 'Q1,2,3,4', 7320, '',  '107'],
    [400104, 'E11-ENG',   'English - 11th Grade',         'Core', 'Whitfield Dana',  'Q1,2,3,4', 7321, 2,  '103'],
    [400104, 'SS-USHIS',  'U.S. History',                 'Core', 'Brennan Kate',    'Q1,2,3,4', 7324, 1,  '111'],
    // grade 10
    [400105, 'HR-10',     'Homeroom - 10th Grade',        'Homeroom', 'Brennan Kate', 'Q1,2,3,4', 7330, '',  '111'],
    [400105, 'E10-ENG',   'English - 10th Grade',         'Core', 'Whitfield Dana',  'Q1,2,3,4', 7331, 3,  '103'],
    [400105, 'SC-BIO',    'Biology',                      'Core', 'Okafor Simon',    'Q1,2,3,4', 7332, 5,  '100'],
    [400105, 'FA-CHOIR',  'Vocal Choir - Senior High',    'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7333, 9, 'Choir Room'],
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
    [400106, 'FA-SHCB',   'Concert Band - Senior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7309, 11, 'Band Room'],
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
    [400110, 'JHCB',      'Concert Band - Junior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7355, 4, 'Band Room'],
    // grade 7
    [400107, 'HR-07',     'Homeroom - 7th Grade',         'Homeroom', 'Duvall Marta', 'Q1,2,3,4', 7360, '',  '203'],
    [400107, 'E07-ENG',   'English - 7th Grade',          'Core', 'Duvall Marta',    'Q1,2,3,4', 7361, 2,  '203'],
    [400107, 'BI07-OTH',  'Old Testament History',        'Core', 'Vandermeer Luke', 'Q1,2,3,4', 7362, 4,  '109'],
    [400107, 'JHCB',      'Concert Band - Junior High',   'Fine-Arts Elective', 'Peters Wesley', 'Q1,2,3,4', 7355, 4, 'Band Room'],
    [400111, 'HR-07',     'Homeroom - 7th Grade',         'Homeroom', 'Duvall Marta', 'Q1,2,3,4', 7360, '',  '203'],
    [400111, 'E07-ENG',   'English - 7th Grade',          'Core', 'Duvall Marta',    'Q1,2,3,4', 7361, 2,  '203'],
    [400111, 'MA07-PRE',  'Pre-Algebra',                  'Core', 'Rasmussen Iris',  'Q1,2,3,4', 7353, 4,  '105'],
    // elementary — no periods exist in the source system for self-contained classrooms
    [400112, 'K5ALL',     'Kindergarten',                 'Core', 'Almeida Rosa',    'Q1,2,3,4', 7370, '',  'E105'],
    [400113, '3ALL',      'Third Grade',                  'Core', 'Sowell Gina',     'Q1,2,3,4', 7371, '',  'E211'],
    [400113, '3ART',      'Art - 3rd Grade',              'Specials', 'Marchetti Dov','Q1,2,3,4', 7372, '', 'Art Room']
  ];

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
    CLASSES.forEach(function (c) {
      var s = byId[c[0]];
      rows.push([c[0], s[1], s[3], c[1], c[2], c[3], c[4], c[5], c[6], c[7] || '',
                 c[7] ? slotOf[c[7]] : '', c[8]]);
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

  return {
    tabs: [
      { name: 'Sheet1',            values: directoryValues() },
      { name: 'Student Schedules', values: scheduleValues() },
      { name: 'Teachers',          values: teacherValues() },
      { name: 'Period Times',      values: periodTimesValues() }
    ],
    bellPeriods: BELL_PERIODS,
    // the demo clock: a Tuesday mid-morning, so a class is always in session on open
    demoNow: { date: '2026-09-08', time: '10:30', dayOfWeek: 2 }
  };
})();
