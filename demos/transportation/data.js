/* data.js — Dismissal Board demo dataset. 100% FABRICATED: every student, guardian, staff member,
   driver, email, phone number and student id below is invented. Nothing here comes from a real
   record. The seven route names and their stick colours are the school's real bus geography
   (public place names, not personal data) because the board's colour chips are keyed on them.

   Shape mirrors what the production app reads: the tabs of the standalone Dismissal_WORKING
   spreadsheet (Roster · Overrides · Walkers · Routes · Roles), three tabs of the FACTS staging
   sheet (Attendance Today · PickupContacts · Staff) and the sign-in/out kiosk's EVENTS log —
   each as a values array with the header row first, exactly as the Google Sheets are read.

   The Roster is ASSEMBLED here by the same rules as the real nightly producer
   (facts-api-sync/Transportation.gs): Bus > Staff Kid > Early Bird > Car, one row per
   (student, session, route), Early Bird as a FAMILY rule, 6th-grade pickup following siblings.
   demos/transportation/verify.mjs feeds `producerInputs` to the REAL producer and checks the two
   rosters are identical, so this fixture cannot drift from what the app actually consumes.

   The same fictional school as the Directory Search demo: its 14 students appear here with
   the same ids, grades, guardians and homeroom teachers. */
window.DISMISSAL_DATA = (function () {
  'use strict';

  /* ---------- the demo clock ----------
     Pinned to a Tuesday so the Aberdeen/Havre de Grace lane shows its "no driver listed" gap
     (the source driver sheet covers Mon/Wed/Fri and Thu/Fri — Tuesday is uncovered, Friday is
     double-covered, transcribed as given). ?sim=2026-09-18 15:00 is the Friday: the walk-up
     list's specials exceptions light up and the double-covered route shows two drivers. */
  var DEMO = {
    email: 'demo.staff@example.edu',            // the signed-in demo account (fabricated)
    teacherName: 'Sowell Gina',                 // ...who is also the 3rd-grade homeroom teacher
    date: '2026-09-15', dayName: 'Tue',
    fridaySim: '2026-09-18 15:00'
  };

  /* ---------- vendored producer rules (facts-api-sync/Transportation.gs) ---------- */
  // One entry is counter-intuitive and load-bearing: 5th grade is in the KINDERGARTEN building
  // (the basement). 6th is a modular unit between the buildings. (Corrected 2026-09-05 to match
  // the producer: 1st grade is Elementary, not Kindergarten.)
  var GRADE_BUILDING = {
    'K4': 'Kindergarten', 'K5': 'Kindergarten',
    '1': 'Elementary', '2': 'Elementary', '3': 'Elementary', '4': 'Elementary',
    '5': 'Kindergarten', '6': '6th Grade',
    '7': 'High School', '8': 'High School', '9': 'High School',
    '10': 'High School', '11': 'High School', '12': 'High School'
  };
  // Which side of campus a parent collects from. 6th is deliberately absent: the modular sits
  // between the buildings, so a 6th grader walks to whichever side their siblings use.
  var PICKUP_BY_GRADE = {
    'K4': 'EL', 'K5': 'EL', '1': 'EL', '2': 'EL', '3': 'EL', '4': 'EL', '5': 'EL',
    '7': 'HS', '8': 'HS', '9': 'HS', '10': 'HS', '11': 'HS', '12': 'HS'
  };
  var EL_SIDE = { 'K4': 1, 'K5': 1, '1': 1, '2': 1, '3': 1, '4': 1, '5': 1 };
  var EARLY_BIRD_GRADES = { '1': 1, '2': 1, '3': 1 };
  // Staff placement code -> the building that staff member works in. COACH / STAFF_MUSIC /
  // AIDE_TA / SUB genuinely do not identify a building, so a child of theirs reads 'Unresolved'
  // rather than being sent somewhere guessed. Drivers' children wait at the High School.
  var PLACEMENT_BUILDING = {
    'TEACHER_HS': 'High School', 'STAFF_HS': 'High School',
    'TEACHER_ELEM': 'Elementary', 'STAFF_ELEM': 'Elementary',
    'TEACHER_K': 'Kindergarten', 'STAFF_K': 'Kindergarten',
    'STAFF_TRANS': 'High School'
  };

  /* ---------- routes ----------
     code -> the FACTS course title the roster carries (the office's short name and the stick
     colour live on the Routes tab, joined by CODE). Four buses and three vans. */
  var ROUTES = {
    'A/HdG': { name: 'Aberdeen/Havre de Grace', title: 'Aberdeen/Havre de Grace Route', colour: 'White',  vehicle: 'Bus' },
    'Ab':    { name: 'Abingdon',                title: 'Abingdon Bus Route',             colour: 'Orange', vehicle: 'Bus' },
    'E':     { name: 'Edgewood',                title: 'Edgewood Bus Route',             colour: 'Pink',   vehicle: 'Bus' },
    'J':     { name: 'Jarrettsville',           title: 'Jarrettsville Bus Route',        colour: 'Purple', vehicle: 'Bus' },
    'BA':    { name: 'Bel Air',                 title: 'Bel Air Van Route',              colour: 'Red',    vehicle: 'Van' },
    'CC':    { name: 'Cecil County',            title: 'Cecil County Van Route',         colour: 'Green',  vehicle: 'Van' },
    'SP':    { name: 'Street/Pylesville',       title: 'Street/Pylesville Van Route',    colour: 'Blue',   vehicle: 'Van' }
  };
  // One row per (route, session, driver). Days blank = every school day.
  var ROUTE_ROWS = [
    ['A/HdG', 'AM', 'Delia Marchbanks', '410-555-0201', '', ''],
    ['A/HdG', 'PM', 'Rufus Okonkwo',    '410-555-0202', 'Mon,Wed,Fri', ''],
    ['A/HdG', 'PM', 'Tamsin Greer',     '410-555-0203', 'Thu,Fri',
     'driver sheet leaves TUESDAY PM uncovered and double-covers Friday'],
    ['Ab',    'AM', 'Hollis Brandt',    '410-555-0204', '', ''],
    ['Ab',    'PM', 'Hollis Brandt',    '410-555-0204', '', ''],
    ['E',     'AM', 'Marguerite Sato',  '410-555-0205', '', ''],
    ['E',     'PM', 'Marguerite Sato',  '410-555-0205', '', ''],
    ['J',     'AM', 'Wendell Ashby',    '410-555-0206', '', ''],
    ['J',     'PM', 'Wendell Ashby',    '410-555-0206', '', ''],
    ['BA',    'AM', 'Corinne Vasquez',  '410-555-0207', '', ''],
    ['BA',    'PM', 'Corinne Vasquez',  '410-555-0207', '', ''],
    ['CC',    'AM', 'Desmond Pyle',     '410-555-0208', '', ''],
    ['CC',    'PM', 'Desmond Pyle',     '410-555-0208', '', ''],
    ['SP',    'AM', 'Lorna Fitch',      '410-555-0209', '', ''],
    ['SP',    'PM', 'Everett Doyle',    '410-555-0210', '', '']
  ];

  /* ---------- staff ----------
     [staffId, 'Last First', placementCode, email, email2, active]. The demo sign-in IS Sowell
     Gina's address, which is how the classroom view knows whose class is "my class" and how
     holding a homeroom grants her the Teacher role with no Roles-tab row. The staff directory
     the settings gear suggests from is this tab, filtered to ACTIVE people on the school domain
     — so the leaver at the end never shows up as a suggestion. */
  var STAFF = [
    [9101, 'Whitfield Dana',       'TEACHER_HS',   'd.whitfield@example.edu', ''],
    [9102, 'Rasmussen Iris',       'TEACHER_HS',   'i.rasmussen@example.edu', ''],
    [9103, 'Okafor Simon',         'TEACHER_HS',   's.okafor@example.edu', ''],
    [9104, 'Brennan Kate',         'TEACHER_HS',   'k.brennan@example.edu', ''],
    [9105, 'Vandermeer Luke',      'TEACHER_HS',   'l.vandermeer@example.edu', ''],
    [9106, 'Nakamura Ellis',       'TEACHER_HS',   'e.nakamura@example.edu', ''],
    [9107, 'Duvall Marta',         'TEACHER_HS',   'm.duvall@example.edu', ''],
    [9108, 'Sandoval Rico',        'TEACHER_HS',   'r.sandoval@example.edu', ''],
    [9109, 'Ostrowski Renata',     'TEACHER_ELEM', 'r.ostrowski@example.edu', ''],
    [9110, 'Hensley Bartholomew',  'TEACHER_ELEM', 'b.hensley@example.edu', ''],
    [9111, 'Quon Beatrix',         'TEACHER_ELEM', 'b.quon@example.edu', ''],
    [9112, 'Larkin Moses',         'TEACHER_ELEM', 'm.larkin@example.edu', ''],
    [9113, 'Sowell Gina',          'TEACHER_ELEM', DEMO.email, ''],
    [9114, 'Farrow Imogen',        'TEACHER_ELEM', 'i.farrow@example.edu', ''],
    [9115, 'Tobin Celeste',        'TEACHER_K',    'c.tobin@example.edu', ''],
    [9116, 'Almeida Rosa',         'TEACHER_K',    'r.almeida@example.edu', ''],
    [9117, 'Prewitt Hannah',       'TEACHER_K',    'h.prewitt@example.edu', ''],
    [9118, 'Marchetti Dov',        'TEACHER_ELEM', 'd.marchetti@example.edu', ''],
    [9119, 'Pruitt Lorraine',      'STAFF_HS',     'l.pruitt@example.edu', ''],
    [9120, 'Ybarra Consuelo',      'STAFF_ELEM',   'c.ybarra@example.edu', ''],
    [9121, 'Dunmore Felix',        'COACH',        'f.dunmore@example.edu', ''],
    [9122, 'Ashby Wendell',        'STAFF_TRANS',  'w.ashby@example.edu', ''],
    [9123, 'Abernathy Sol',        'STAFF_MUSIC',  's.abernathy@example.edu', ''],
    [9124, 'Quill Hortensia',      'TEACHER_ELEM', 'h.quill@example.edu', '', 'N']   // left in June
  ];
  var placementOf = {}, staffIdOf = {};
  STAFF.forEach(function (s) { placementOf[s[1]] = s[2]; staffIdOf[s[1]] = String(s[0]); });

  // Homeroom by grade. Grade 4 is taught by two people, so a co-teacher's "My class" shows only
  // their own homeroom and "My grade" is the answer — a real limit of one-homeroom-per-student.
  var HOMEROOM = {
    'K4': ['K4-1', 'Prewitt Hannah'], 'K5': ['K5-1', 'Almeida Rosa'],
    '1': ['1-1', 'Tobin Celeste'], '2': ['2-1', 'Farrow Imogen'], '3': ['3-1', 'Sowell Gina'],
    '4': ['4-1', 'Quon Beatrix'], '4b': ['4-2', 'Larkin Moses'],
    '5': ['5-1', 'Hensley Bartholomew'], '6': ['6-1', 'Ostrowski Renata'],
    '7': ['HR-07-1', 'Duvall Marta'], '8': ['HR-08-1', 'Duvall Marta'],
    '9': ['HR-09-1', 'Nakamura Ellis'], '10': ['HR-10-1', 'Brennan Kate'],
    '11': ['HR-11-1', 'Okafor Simon'], '12': ['HR-12-1', 'Whitfield Dana']
  };

  /* ---------- families ----------
     { fid, last, guardians: [[first, relationship, cell, email]], kids: [[id, first, grade, d]] }
     d (dismissal facts, as FACTS would hold them):
       am / pm   route codes the child is enrolled on for that session (two in one session =
                 split custody, and they appear on both drivers' lists)
       staff     the name of the guardian who is active staff (parent link, not an email guess)
       hr        '4b' for the second 4th-grade homeroom; 'none' for no homeroom teacher recorded
     Early Bird is NOT written here — it is computed from the family, as in production. */
  var FAMILIES = [
    // ---- the Directory Search demo's families (same ids and grades) ----
    { fid: 7001, last: 'Alderman', guardians: [['Priya', 'Mother', '410-555-0101', 'priya.alderman@example.com'],
        ['Ross', 'Father', '410-555-0102', 'ross.alderman@example.com'], ['Vera', 'Grandparent', '410-555-0103', '']],
      kids: [[400101, 'Nora', '12', {}]] },
    { fid: 7002, last: 'Boyette', guardians: [['Trina', 'Mother', '410-555-0104', 'trina.boyette@example.com']],
      kids: [[400102, 'Marcus', '12', {}]] },
    { fid: 7003, last: 'Castellano', guardians: [['June', 'Mother', '410-555-0111', 'june.castellano@example.com'],
        ['Paul', 'Father', '410-555-0112', 'paul.castellano@example.com']],
      kids: [[400103, 'Ivy', '11', { am: ['A/HdG'], pm: ['A/HdG'] }]] },
    { fid: 7004, last: 'Delgado', guardians: [['Marisol', 'Mother', '410-555-0113', 'marisol.delgado@example.com']],
      kids: [[400104, 'Theo', '11', {}]] },
    { fid: 7005, last: 'Enriquez', guardians: [['Dolores', 'Mother', '410-555-0114', 'dolores.enriquez@example.com']],
      kids: [[400105, 'Sasha', '10', { am: ['J'], pm: ['J'] }]] },
    { fid: 7006, last: 'Fairbanks', guardians: [['Greta', 'Mother', '410-555-0105', 'greta.fairbanks@example.com'],
        ['Neil', 'Father', '410-555-0106', 'neil.fairbanks@example.com']],
      kids: [[400106, 'Owen', '9', { am: ['SP'], pm: ['SP'] }], [400107, 'Wren', '7', { am: ['SP'], pm: ['SP'] }]] },
    { fid: 7007, last: 'Grady', guardians: [['Adele', 'Mother', '410-555-0115', 'adele.grady@example.com']],
      kids: [[400108, 'Jonathon', '9', {}]] },
    { fid: 7008, last: 'Halvorsen', guardians: [['Rita', 'Mother', '410-555-0116', 'rita.halvorsen@example.com']],
      kids: [[400109, 'Jonathan', '8', { pm: ['E'] }]] },
    { fid: 7009, last: 'Iverson', guardians: [['Colette', 'Mother', '410-555-0117', 'colette.iverson@example.com'],
        ['Bram', 'Father', '410-555-0118', 'bram.iverson@example.com']],
      kids: [[400110, 'Maeve', '8', { am: ['J'], pm: ['J'] }]] },
    { fid: 7010, last: 'Jessup', guardians: [['Naomi', 'Mother', '410-555-0119', 'naomi.jessup@example.com']],
      kids: [[400111, 'Caleb', '7', {}]] },
    // a K5 sibling blocks the whole family from Early Bird — Bram (3rd) is Car, not Early Bird
    { fid: 7011, last: 'Kirkwood', guardians: [['Helena', 'Mother', '410-555-0107', 'helena.kirkwood@example.com'],
        ['Dot', 'Aunt', '410-555-0108', '']],
      kids: [[400112, 'Tess', 'K5', {}], [400113, 'Bram', '3', {}]] },
    { fid: 7012, last: 'Lindqvist', guardians: [['Suvi', 'Mother', '410-555-0120', 'suvi.lindqvist@example.com']],
      kids: [[400114, 'Anders', '10', { am: ['Ab'], pm: ['Ab'] }]] },

    // ---- Jarrettsville (purple) ----
    { fid: 7013, last: 'Marlowe', guardians: [['Hesper', 'Mother', '410-555-0121', 'hesper.marlowe@example.com'],
        ['Barnaby', 'Father', '410-555-0122', '']],
      kids: [[400115, 'Juniper', '4', { am: ['J'], pm: ['J'] }], [400116, 'Cassius', '1', { am: ['J'], pm: ['J'] }]] },
    { fid: 7014, last: 'Petrakis', guardians: [['Eleni', 'Mother', '410-555-0123', 'eleni.petrakis@example.com']],
      kids: [[400117, 'Leonidas', '6', { pm: ['J'] }]] },          // 6th, no sibling -> HS side
    // an only child in 2nd grade WOULD be Early Bird, but she rides a bus, and Bus wins
    { fid: 7015, last: 'Tennant', guardians: [['Oriel', 'Mother', '410-555-0125', 'oriel.tennant@example.com'],
        ['Beatrix', 'Grandmother', '410-555-0124', '']],
      kids: [[400118, 'Rosalind', '2', { am: ['J'], pm: ['J'] }]] },
    { fid: 7016, last: 'Vickery', guardians: [['Imelda', 'Mother', '410-555-0126', 'imelda.vickery@example.com'],
        ['Lucian', 'Father', '410-555-0127', '']],
      kids: [[400119, 'Dashiell', '9', { am: ['J'], pm: ['J'] }]] },
    { fid: 7017, last: 'Zielinski', guardians: [['Agnieszka', 'Mother', '410-555-0128', 'a.zielinski@example.com']],
      kids: [[400120, 'Hana', '5', { pm: ['J'] }]] },
    // SPLIT CUSTODY: Soren rides Jarrettsville from one parent's house and Street/Pylesville
    // from the other's, so he is on BOTH drivers' PM lists and flagged to confirm which today
    { fid: 7018, last: 'Bergstrom', guardians: [['Annika', 'Mother', '410-555-0129', 'annika.bergstrom@example.com'],
        ['Lars', 'Father', '410-555-0130', 'lars.bergstrom@example.com']],
      kids: [[400121, 'Soren', '3', { am: ['J'], pm: ['J', 'SP'] }], [400122, 'Freya', 'K4', {}]] },

    // ---- Edgewood (pink) ----
    { fid: 7019, last: 'Nakashima', guardians: [['Haruki', 'Father', '410-555-0131', 'haruki.nakashima@example.com'],
        ['Mei', 'Mother', '410-555-0132', '']],
      kids: [[400123, 'Kenji', '11', { am: ['E'], pm: ['E'] }], [400124, 'Yui', '7', { am: ['E'], pm: ['E'] }]] },
    { fid: 7020, last: 'Oyelaran', guardians: [['Folasade', 'Mother', '410-555-0133', 'f.oyelaran@example.com']],
      kids: [[400125, 'Temi', '3', { am: ['E'], pm: ['E'] }]] },
    { fid: 7021, last: 'Quintero', guardians: [['Rosario', 'Mother', '410-555-0134', 'rosario.quintero@example.com'],
        ['Esteban', 'Father', '410-555-0135', '']],
      kids: [[400126, 'Mateo', '10', { pm: ['E'] }]] },
    { fid: 7022, last: 'Rasheed', guardians: [['Farah', 'Mother', '410-555-0136', 'farah.rasheed@example.com']],
      kids: [[400127, 'Layla', '5', { am: ['E'], pm: ['E'] }]] },

    // ---- Aberdeen/Havre de Grace (white) ----
    { fid: 7023, last: 'Solberg', guardians: [['Kristoffer', 'Father', '410-555-0137', 'k.solberg@example.com']],
      kids: [[400128, 'Ingrid', '12', { am: ['A/HdG'], pm: ['A/HdG'] }]] },
    { fid: 7024, last: 'Ulrich', guardians: [['Petra', 'Mother', '410-555-0138', 'petra.ulrich@example.com']],
      kids: [[400129, 'Baxter', '8', { am: ['A/HdG'], pm: ['A/HdG'] }]] },
    { fid: 7025, last: 'Winslow', guardians: [['Cordelia', 'Mother', '410-555-0139', 'cordelia.winslow@example.com'],
        ['Jasper', 'Father', '410-555-0140', '']],
      kids: [[400130, 'Pippa', '2', { am: ['A/HdG'], pm: ['A/HdG'] }], [400131, 'Otis', 'K5', { am: ['A/HdG'], pm: ['A/HdG'] }]] },
    // a 6th grader with a 4th-grade sibling: pickup follows the sibling to the EL side
    { fid: 7026, last: 'Yeboah', guardians: [['Akosua', 'Mother', '410-555-0141', 'akosua.yeboah@example.com']],
      kids: [[400132, 'Kwame', '6', { pm: ['A/HdG'] }], [400133, 'Ama', '4', { hr: '4b' }]] },

    // ---- Abingdon (orange) ----
    { fid: 7027, last: 'Abbington', guardians: [['Florence', 'Mother', '410-555-0142', 'florence.abbington@example.com']],
      kids: [[400134, 'Clementine', '4', { am: ['Ab'], pm: ['Ab'], hr: '4b' }]] },
    { fid: 7028, last: 'Carrasco', guardians: [['Ignacio', 'Father', '410-555-0143', 'ignacio.carrasco@example.com'],
        ['Pilar', 'Mother', '410-555-0144', 'pilar.carrasco@example.com']],
      kids: [[400135, 'Diego', '7', { am: ['Ab'], pm: ['Ab'] }], [400136, 'Lucia', '9', { am: ['Ab'], pm: ['Ab'] }]] },
    { fid: 7029, last: 'Dufresne', guardians: [['Solange', 'Mother', '410-555-0145', 'solange.dufresne@example.com']],
      kids: [[400137, 'Margaux', '1', { pm: ['Ab'] }]] },
    // rides IN by bus but goes home another way — an AM-only rider the PM board must not wait for
    { fid: 7030, last: 'Ekwueme', guardians: [['Ngozi', 'Mother', '410-555-0146', 'ngozi.ekwueme@example.com']],
      kids: [[400138, 'Chidi', '8', { am: ['Ab'] }]] },
    // a different route each way
    { fid: 7031, last: 'Fontaine', guardians: [['Yves', 'Father', '410-555-0147', 'yves.fontaine@example.com']],
      kids: [[400139, 'Remy', '5', { am: ['CC'], pm: ['BA'] }]] },

    // ---- Bel Air van (red) ----
    { fid: 7032, last: 'Gaskill', guardians: [['Tabitha', 'Mother', '410-555-0148', 'tabitha.gaskill@example.com']],
      kids: [[400140, 'Wyatt', '3', { am: ['BA'], pm: ['BA'] }]] },
    { fid: 7033, last: 'Hartigan', guardians: [['Siobhan', 'Mother', '410-555-0149', 'siobhan.hartigan@example.com'],
        ['Declan', 'Father', '410-555-0150', '']],
      kids: [[400141, 'Niamh', '10', { am: ['BA'], pm: ['BA'] }]] },
    { fid: 7034, last: 'Ingram', guardians: [['Loretta', 'Grandmother', '410-555-0151', '']],
      kids: [[400142, 'Thaddeus', '12', { pm: ['BA'] }]] },
    { fid: 7035, last: 'Jablonski', guardians: [['Marek', 'Father', '410-555-0152', 'marek.jablonski@example.com']],
      kids: [[400143, 'Wiktor', '6', { am: ['BA'], pm: ['BA'] }]] },

    // ---- Cecil County van (green) ----
    { fid: 7036, last: 'Kowalczyk', guardians: [['Danuta', 'Mother', '410-555-0153', 'danuta.kowalczyk@example.com']],
      kids: [[400144, 'Zofia', '4', { am: ['CC'], pm: ['CC'] }]] },
    { fid: 7037, last: 'Lachance', guardians: [['Mireille', 'Mother', '410-555-0154', 'mireille.lachance@example.com']],
      kids: [[400145, 'Etienne', '2', { am: ['CC'], pm: ['CC'] }]] },
    { fid: 7038, last: 'Mbeki', guardians: [['Lindiwe', 'Mother', '410-555-0155', 'lindiwe.mbeki@example.com'],
        ['Sipho', 'Father', '410-555-0156', '']],
      kids: [[400146, 'Thabo', '11', { am: ['CC'], pm: ['CC'] }]] },
    { fid: 7039, last: 'Novotny', guardians: [['Jitka', 'Mother', '410-555-0157', 'jitka.novotny@example.com']],
      kids: [[400147, 'Klara', '8', { pm: ['CC'] }]] },

    // ---- Street/Pylesville van (blue) ----
    { fid: 7040, last: 'Oduya', guardians: [['Bolanle', 'Mother', '410-555-0158', 'bolanle.oduya@example.com']],
      kids: [[400148, 'Femi', '5', { am: ['SP'], pm: ['SP'] }]] },
    { fid: 7041, last: 'Pemberton', guardians: [['Cressida', 'Mother', '410-555-0159', 'cressida.pemberton@example.com'],
        ['Rupert', 'Father', '410-555-0160', '']],
      kids: [[400149, 'Harriet', '1', { am: ['SP'], pm: ['SP'] }]] },

    // ---- staff children (the guardian is active staff — a FACTS person link) ----
    { fid: 7042, last: 'Whitfield', guardians: [['Dana', 'Mother', '410-555-0161', 'd.whitfield@example.edu'],
        ['Aurelio', 'Father', '410-555-0162', '']],
      kids: [[400150, 'Juno', '2', { staff: 'Whitfield Dana' }]] },              // walks to the HS
    { fid: 7043, last: 'Okafor', guardians: [['Simon', 'Father', '410-555-0163', 's.okafor@example.edu'],
        ['Chioma', 'Mother', '410-555-0164', 'chioma.okafor@example.com']],
      kids: [[400151, 'Adaeze', '4', { staff: 'Okafor Simon' }], [400152, 'Chidubem', 'K4', { staff: 'Okafor Simon' }]] },
    { fid: 7044, last: 'Sowell', guardians: [['Gina', 'Mother', '410-555-0165', DEMO.email]],
      kids: [[400153, 'Tobias', 'K5', { staff: 'Sowell Gina' }]] },              // KG child, Elementary parent: walks to Elementary
    { fid: 7045, last: 'Marchetti', guardians: [['Dov', 'Father', '410-555-0166', 'd.marchetti@example.edu'],
        ['Serena', 'Mother', '410-555-0167', '']],
      kids: [[400154, 'Bianca', '3', { staff: 'Marchetti Dov' }]] },             // same building as parent
    { fid: 7046, last: 'Dunmore', guardians: [['Felix', 'Father', '410-555-0168', 'f.dunmore@example.edu']],
      kids: [[400155, 'Rhys', '5', { staff: 'Dunmore Felix' }]] },               // COACH -> Unresolved
    { fid: 7047, last: 'Ashby', guardians: [['Wendell', 'Father', '410-555-0169', 'w.ashby@example.edu'],
        ['Marisa', 'Mother', '410-555-0170', 'marisa.ashby@example.com']],
      kids: [[400156, 'Clover', '2', { staff: 'Ashby Wendell' }]] },             // a driver's child
    { fid: 7048, last: 'Pruitt', guardians: [['Lorraine', 'Mother', '410-555-0171', 'l.pruitt@example.edu']],
      kids: [[400157, 'Miles', '4', { staff: 'Pruitt Lorraine', hr: '4b' }], [400158, 'Esme', '9', { staff: 'Pruitt Lorraine' }]] },
    { fid: 7049, last: 'Almeida', guardians: [['Rosa', 'Mother', '410-555-0172', 'r.almeida@example.edu']],
      kids: [[400159, 'Joaquin', '4', { staff: 'Almeida Rosa' }]] },             // walks to Kindergarten
    { fid: 7050, last: 'Vandermeer', guardians: [['Luke', 'Father', '410-555-0173', 'l.vandermeer@example.edu'],
        ['Femke', 'Mother', '410-555-0174', '']],
      kids: [[400160, 'Ida', '3', { staff: 'Vandermeer Luke' }], [400161, 'Pim', 'K5', { staff: 'Vandermeer Luke' }]] },
    { fid: 7072, last: 'Rasmussen', guardians: [['Iris', 'Mother', '410-555-0199', 'i.rasmussen@example.edu'],
        ['Bjorn', 'Father', '410-555-0200', '']],
      kids: [[400187, 'Linnea', '1', { staff: 'Rasmussen Iris' }]] },

    // ---- Early Bird: every enrolled sibling in grades 1-3 ----
    { fid: 7051, last: 'Reinholt', guardians: [['Astrid', 'Mother', '410-555-0175', 'astrid.reinholt@example.com']],
      kids: [[400162, 'Matilda', '1', {}]] },
    { fid: 7052, last: 'Thackeray', guardians: [['Philippa', 'Mother', '410-555-0176', 'philippa.thackeray@example.com'],
        ['Edmund', 'Father', '410-555-0177', '']],
      kids: [[400163, 'Oscar', '2', {}], [400164, 'Elodie', '3', {}]] },
    { fid: 7053, last: 'Underhill', guardians: [['Verity', 'Mother', '410-555-0178', 'verity.underhill@example.com']],
      kids: [[400165, 'Beatrice', '3', {}]] },
    { fid: 7054, last: 'Valdez', guardians: [['Rocio', 'Mother', '410-555-0179', 'rocio.valdez@example.com'],
        ['Emilio', 'Father', '410-555-0180', '']],
      kids: [[400166, 'Santiago', '1', {}], [400167, 'Camila', '3', {}]] },
    { fid: 7055, last: 'Whitcombe', guardians: [['Honor', 'Mother', '410-555-0181', 'honor.whitcombe@example.com']],
      kids: [[400168, 'Percy', '2', {}]] },

    // ---- Car: the residual, recorded as ASSUMED rather than known ----
    // a 6th grader (Idris) blocks his 2nd-grade sister from Early Bird, and her grade pulls
    // his pickup to the EL side
    { fid: 7056, last: 'Yusuf', guardians: [['Halima', 'Mother', '410-555-0182', 'halima.yusuf@example.com']],
      kids: [[400169, 'Amira', '2', {}], [400170, 'Idris', '6', {}]] },
    { fid: 7057, last: 'Ambrose', guardians: [['Genevieve', 'Mother', '410-555-0183', 'genevieve.ambrose@example.com']],
      kids: [[400171, 'Delphine', '10', {}]] },
    { fid: 7058, last: 'Blakeney', guardians: [['Fionnuala', 'Mother', '410-555-0184', 'f.blakeney@example.com'],
        ['Ronan', 'Father', '410-555-0185', '']],
      kids: [[400172, 'Cormac', '4', { hr: '4b' }]] },
    { fid: 7059, last: 'Cardoso', guardians: [['Teresa', 'Mother', '410-555-0186', 'teresa.cardoso@example.com']],
      kids: [[400173, 'Ines', 'K4', {}], [400174, 'Rafael', '3', {}]] },
    { fid: 7060, last: 'Dimitriou', guardians: [['Yannis', 'Father', '410-555-0187', 'yannis.dimitriou@example.com']],
      kids: [[400175, 'Stavros', '7', {}]] },
    { fid: 7061, last: 'Esposito', guardians: [['Carmela', 'Mother', '410-555-0188', 'carmela.esposito@example.com']],
      kids: [[400176, 'Gianna', '12', { hr: 'none' }]] },                        // no homeroom recorded
    { fid: 7062, last: 'Fenwick', guardians: [['Meredith', 'Mother', '410-555-0189', 'meredith.fenwick@example.com']],
      kids: [[400177, 'Rowan', '5', {}]] },
    { fid: 7063, last: 'Guzman', guardians: [['Alejandra', 'Mother', '410-555-0190', 'alejandra.guzman@example.com'],
        ['Tomas', 'Father', '410-555-0191', '']],
      kids: [[400178, 'Ximena', '11', {}]] },
    { fid: 7064, last: 'Holloway', guardians: [['Sinclair', 'Father', '410-555-0192', 'sinclair.holloway@example.com']],
      kids: [[400179, 'Beckett', '9', {}]] },
    { fid: 7065, last: 'Ivashkin', guardians: [],                              // no pickup contacts recorded
      kids: [[400180, 'Nadia', '8', {}]] },
    { fid: 7066, last: 'Joubert', guardians: [['Sylvie', 'Mother', '410-555-0193', 'sylvie.joubert@example.com']],
      kids: [[400181, 'Amelie', '6', {}]] },                                     // 6th, no sibling -> HS
    { fid: 7067, last: 'Kessler', guardians: [],                               // no pickup contacts recorded
      kids: [[400182, 'Otto', 'K5', {}]] },
    { fid: 7068, last: 'Lombardi', guardians: [['Graziella', 'Mother', '410-555-0194', 'graziella.lombardi@example.com'],
        ['Enzo', 'Father', '410-555-0195', '']],
      kids: [[400183, 'Vittoria', '10', {}]] },
    { fid: 7069, last: 'Moreau', guardians: [['Anouk', 'Mother', '410-555-0196', 'anouk.moreau@example.com']],
      kids: [[400184, 'Celestine', '4', {}]] },
    { fid: 7070, last: 'Prakash', guardians: [['Deepa', 'Mother', '410-555-0197', 'deepa.prakash@example.com'],
        ['Ravi', 'Father', '410-555-0198', '']],
      kids: [[400185, 'Anjali', '12', { hr: 'none' }]] },                        // no homeroom recorded
    { fid: 7071, last: 'Rowntree', guardians: [],                              // no pickup contacts recorded
      kids: [[400186, 'Digby', '7', {}]] }
  ];

  /* ---------- the producer's inputs, derived from the families ---------- */
  var nameById = {}, gradeById = {}, familyById = {}, homeroomById = {}, staffChild = {},
      routesByStudent = {}, students = [];
  FAMILIES.forEach(function (f) {
    f.kids.forEach(function (k) {
      var sid = String(k[0]), d = k[3] || {};
      var name = f.last + ' ' + k[1];
      nameById[sid] = name; gradeById[sid] = k[2]; familyById[sid] = f.fid;
      var hr = d.hr === 'none' ? null : HOMEROOM[d.hr === '4b' ? '4b' : k[2]];
      homeroomById[sid] = hr ? { code: hr[0], teacher: hr[1] } : { code: '', teacher: '' };
      if (d.staff) {
        staffChild[sid] = { parentName: d.staff, parentStaffId: staffIdOf[d.staff] || '',
                            placementCode: placementOf[d.staff] || '' };
      }
      ['am', 'pm'].forEach(function (s) {
        (d[s] || []).forEach(function (code) {
          var b = routesByStudent[sid] = routesByStudent[sid] || {};
          var list = b[s.toUpperCase()] = b[s.toUpperCase()] || [];
          list.push({ code: code, name: ROUTES[code].title, vehicle: ROUTES[code].vehicle });
        });
      });
      students.push({ id: sid, name: name, first: k[1], last: f.last, grade: k[2], fid: f.fid, d: d });
    });
  });
  // Where each homeroom teacher physically stands, from the grades of the students they hold a
  // homeroom for, keyed by staff id. Vendored from the producer's trTeacherBuildings_ (2026-09-05):
  // the placement code is an OU, not a floor plan, and a homeroom beats it.
  var teacherBuildings = {};
  Object.keys(homeroomById).forEach(function (sid) {
    var t = homeroomById[sid].teacher, b = GRADE_BUILDING[gradeById[sid]], id = staffIdOf[t];
    if (t && b && id) (teacherBuildings[id] = teacherBuildings[id] || {})[b] = true;
  });
  // split custody: two routes in one session mark each other
  Object.keys(routesByStudent).forEach(function (sid) {
    ['AM', 'PM'].forEach(function (sess) {
      var list = routesByStudent[sid][sess] || [];
      if (list.length > 1) list.forEach(function (x) { x.split = list.map(function (y) { return y.code; }); });
    });
  });
  // EARLY BIRD is a family rule: every enrolled member in grades 1-3, or nobody qualifies
  function earlyBirdSet(gradeById, familyById) {
    var members = {};
    Object.keys(gradeById).forEach(function (sid) {
      var fid = familyById[sid];
      var key = (fid === undefined || fid === null || fid === '') ? ('solo:' + sid) : ('fam:' + fid);
      (members[key] = members[key] || []).push(sid);
    });
    var out = {};
    Object.keys(members).forEach(function (key) {
      var kids = members[key];
      if (kids.every(function (sid) { return EARLY_BIRD_GRADES[gradeById[sid]] === 1; })) {
        kids.forEach(function (sid) { out[sid] = true; });
      }
    });
    return out;
  }
  var earlyBird = earlyBirdSet(gradeById, familyById);

  /* ---------- assemble the Roster exactly as the producer does ---------- */
  var ROSTER_HEADER = ['Student ID', 'Student Name', 'Grade', 'Session', 'Type',
                       'Route Code', 'Route Name', 'Vehicle', 'Split',
                       'Building', 'Pickup', 'Pickup Basis', 'Walk To',
                       'Family ID', 'Homeroom', 'Homeroom Teacher', 'Source', 'Note'];
  function pickupFor(grade, sibGrades) {
    var fixed = PICKUP_BY_GRADE[grade];
    if (fixed) return { pickup: fixed, basis: 'grade' };
    if (grade !== '6') return { pickup: '', basis: 'unknown-grade' };
    var pulled = sibGrades.some(function (s) { return EL_SIDE[s] === 1; });
    return pulled ? { pickup: 'EL', basis: 'sibling-on-EL-side' } : { pickup: 'HS', basis: '6th-default-HS' };
  }
  function rosterValues() {
    var rows = [ROSTER_HEADER.slice()];
    var sids = Object.keys(nameById).sort(function (a, b) {
      var na = nameById[a], nb = nameById[b];
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
    var famMembers = {};
    Object.keys(nameById).forEach(function (sid) {
      (famMembers[String(familyById[sid])] = famMembers[String(familyById[sid])] || []).push(sid);
    });
    sids.forEach(function (sid) {
      var name = nameById[sid], grade = gradeById[sid], building = GRADE_BUILDING[grade] || '';
      var fid = String(familyById[sid]);
      var r = routesByStudent[sid] || {}, kid = staffChild[sid] || null;
      var hr = homeroomById[sid], hrCode = hr.code, hrTeacher = hr.teacher;
      var sibGrades = famMembers[fid].filter(function (m) { return m !== sid; })
        .map(function (m) { return gradeById[m]; });
      var pk = pickupFor(grade, sibGrades);
      ['AM', 'PM'].forEach(function (sess) {
        var list = r[sess] || [];
        if (sess === 'AM' && !list.length) return;      // AM rows only where there is AM data
        if (list.length) {                                // 1. Bus — one row PER ROUTE
          list.forEach(function (route) {
            rows.push([sid, name, grade, sess, 'Bus', route.code, route.name, route.vehicle,
                       route.split ? 'Y' : '', building, pk.pickup, pk.basis, '', fid, hrCode, hrTeacher,
                       'course-enrollment',
                       route.split ? 'SPLIT: rides ' + route.split.join(' or ') + ' on different days ' +
                                     '(e.g. split custody) — confirm which today' : '']);
          });
          return;
        }
        if (kid) {                                        // 2. Staff Kid
          // A homeroom teacher stands in the building of the grade they teach; that beats the
          // placement code. Same rule, same note text, as the producer — verify.mjs diffs the rows.
          var taught = Object.keys(teacherBuildings[kid.parentStaffId] || {});
          var fromHomeroom = taught.length === 1;
          var pb = fromHomeroom ? taught[0] : (PLACEMENT_BUILDING[kid.placementCode] || '');
          var walkTo = !pb ? 'Unresolved' : (pb === building ? '' : pb);
          var basis = fromHomeroom ? ' — from the grade they teach' : '';
          var note = !pb
            ? 'staff parent placement "' + (kid.placementCode || '(blank)') + '" does not identify a building'
            : (walkTo ? 'walk to ' + walkTo + ' (parent: ' + kid.parentName + ')' + basis
                      : 'same building as parent (' + kid.parentName + ')' + basis);
          rows.push([sid, name, grade, sess, 'Staff Kid', '', '', '', '', building, pk.pickup, pk.basis,
                     walkTo, fid, hrCode, hrTeacher, 'parent-link', note]);
          return;
        }
        if (earlyBird[sid]) {                             // 3. Early Bird
          rows.push([sid, name, grade, sess, 'Early Bird', '', '', '', '', building, pk.pickup, pk.basis,
                     '', fid, hrCode, hrTeacher, 'family-rule', 'every enrolled sibling is in grades 1-3']);
          return;
        }
        rows.push([sid, name, grade, sess, 'Car', '', '', '', '', building, pk.pickup, pk.basis,   // 4. Car
                   '', fid, hrCode, hrTeacher, 'residual-default',
                   'assumed: no route, no staff parent, not Early Bird']);
      });
    });
    return rows;
  }

  /* ---------- the other tabs ---------- */
  function attendanceValues() {
    var H = ['Student ID', 'Student Name', 'Date', 'Code', 'Status', 'Detail', 'Excused', 'Reason', 'Recorded At'];
    // The feed carries ONLY exceptions. Codes: AE/AU absent, ED early dismissal, LA/TE/TU late.
    var rows = [
      ['400103', 'AE', 'Absent',     'Absent - Excused',   'Y', 'fever, mom emailed'],            // on the white bus
      ['400109', 'AU', 'Absent',     'Absent - Unexcused', 'N', ''],                              // on the pink bus
      ['400162', 'AE', 'Absent',     'Absent - Excused',   'Y', 'family trip'],                   // an Early Bird
      ['400157', 'AE', 'Absent',     'Absent - Excused',   'Y', 'dentist'],                       // an approved walker
      ['400114', 'ED', 'Left early', 'Early Dismissal',    'N', 'orthodontist, signed out 11:20'],// on the orange bus
      ['400105', 'LA', 'Late',       'Late Arrival',       'N', 'arrived at 8:43'],               // still expected
      ['400111', 'TU', 'Late',       'Tardy - Unexcused',  'N', 'signed in at 8:55']              // still expected
    ];
    return [H].concat(rows.map(function (a) {
      return [a[0], nameById[a[0]], DEMO.date, a[1], a[2], a[3], a[4], a[5], DEMO.date + ' 14:47'];
    }));
  }

  // Today's completed mid-day sign-outs, from the sign-in/out kiosk's append-only EVENTS log —
  // its real columns. The LAST event of the day decides: an early-out with a later return-in
  // means the child is back. A PickupMatch of 'mismatch' is a stranger's FAILED attempt, not a
  // sign-out, and must never remove a child from the board.
  function eventsValues() {
    var H = ['Timestamp', 'Date', 'Type', 'PersonKey', 'GuardianName', 'PickupMatch'];
    var D = DEMO.date;
    return [H,
      [D + ' 10:40:00', D, 'student_early_out', '400126', 'Quintero Rosario',   'matched'],  // out for an appointment...
      [D + ' 11:35:00', D, 'student_return_in', '400126', 'Quintero Rosario',   'n/a'],      // ...and back — still expected
      [D + ' 13:04:00', D, 'student_early_out', '400115', 'Marlowe Hesper',     'matched'],  // gone for the day
      [D + ' 14:10:00', D, 'student_early_out', '400150', 'Whitfield Aurelio',  'override'], // a walker, collected early
      [D + ' 14:22:00', D, 'student_early_out', '400140', 'unrecognised adult', 'mismatch'], // a stranger turned away — NOT a sign-out
      [D + ' 14:22:00', D, 'pickup_flag',       '400140', 'unrecognised adult', 'mismatch']  // the open flag the office sees
    ];
  }

  // APPEND-ONLY, today-only. Every row records who changed it and when.
  var OVERRIDES_HEADER = ['Date', 'Student ID', 'Student Name', 'Type', 'Route Code', 'Note',
                          'By', 'At', 'Destination'];
  function overridesValues() {
    return [OVERRIDES_HEADER.slice(),
      // bus -> car: the office took the call, and the card says who she is handed to
      [DEMO.date, '400118', 'Tennant Rosalind', 'Car', '', 'mum called at 1pm — grandma collecting',
       'office.demo@example.edu', '13:02', 'Tennant, Beatrix (Grandmother)'],
      // staff kid -> car: recorded at the ramp by the person holding the child
      [DEMO.date, '400154', 'Marchetti Bianca', 'Car', '', 'dad in a meeting — mum collecting at the ramp',
       'ramp.lead@example.edu', '14:31', 'Marchetti, Serena (Mother)'],
      // an Occasional walker confirmed for today
      [DEMO.date, '400160', 'Vandermeer Ida', 'Staff Kid', '', 'dad confirmed — walking up today',
       'walkup.demo@example.edu', '07:55', '']
    ];
  }

  // The approved staff-kid walk-up list: K4-4th, walked from the Elementary to the HS lobby.
  // Human-approved per child, never derived. Except Day = a weekday the child is NOT walked
  // (already in a special up by the HS); Except Destination = where they go instead, if standing.
  function walkersValues() {
    var H = ['Student ID', 'Student Name', 'Grade', 'Teacher', 'Frequency', 'Destination',
             'Except Day', 'Except Reason', 'Except Destination', 'Note'];
    var rows = [
      ['400150', 'Daily',      '',                    '',    '',         '',                        ''],
      ['400151', 'Daily',      '',                    'Fri', 'Art',      '',                        ''],
      ['400152', 'Daily',      'to Dad',              '',    '',         '',                        ''],
      ['400156', 'Daily',      '',                    'Fri', 'Computer', 'to their own classroom',  'can go to her mom\'s room afterwards'],
      ['400157', 'Daily',      '',                    'Fri', 'Gym',      '',                        ''],
      ['400187', 'Daily',      '',                    '',    '',         '',                        'listed as "Linni" on the approved sheet'],
      ['400160', 'Occasional', '',                    '',    '',         '',                        ''],
      ['400161', 'Occasional', 'to her sister Ida',   '',    '',         '',                        '']
    ];
    return [H].concat(rows.map(function (w) {
      var sid = w[0];
      return [sid, nameById[sid], gradeById[sid], homeroomById[sid].teacher, w[1], w[2], w[3], w[4], w[5], w[6]];
    }));
  }

  function routesValues() {
    var H = ['Route Code', 'Route Name', 'Colour', 'Vehicle', 'Session', 'Driver', 'Phone', 'Days', 'Note'];
    return [H].concat(ROUTE_ROWS.map(function (r) {
      var rt = ROUTES[r[0]];
      return [r[0], rt.name, rt.colour, rt.vehicle, r[1], r[2], r[3], r[4], r[5]];
    }));
  }

  // READ is broad, WRITE is narrow. Role admin is per role: the ramp lead administers Ramp only.
  // Teacher is IMPLICIT — anyone the roster lists as a homeroom teacher holds it — so the demo
  // sign-in (Sowell Gina) and Quon Beatrix have no Teacher row here and still get the role; the
  // three Teacher rows below are the optional, explicit kind.
  function rolesValues() {
    return [['Role', 'Email', 'Admin', 'Note'],
      ['Admin',          DEMO.email,                   'Y', 'demo sign-in — administers every role'],
      ['Office',         'office.demo@example.edu',    '',  'front office — takes the phone calls'],
      ['Office',         'l.pruitt@example.edu',       '',  'HS office'],
      ['Office',         'c.ybarra@example.edu',       '',  'EL office'],
      ['Ramp',           'ramp.lead@example.edu',      'Y', 'runs the elementary ramp; owns the Ramp view'],
      ['Ramp',           'i.farrow@example.edu',       '',  'ramp cover'],
      ['Walk-Up',        'walkup.demo@example.edu',    'Y', 'chaperone — K4 to 4th, to the HS lobby'],
      ['Teacher',        'd.whitfield@example.edu',    '',  'Whitfield Dana, 12th grade — seeded 2026-09-04'],
      ['Teacher',        'm.larkin@example.edu',       '',  'Larkin Moses, 4th grade — seeded 2026-09-04'],
      ['Teacher',        'i.farrow@example.edu',       '',  'Farrow Imogen, 2nd grade — seeded 2026-09-04'],
      ['Transportation', 'transport.demo@example.edu', '',  'maintains the Routes tab']
    ];
  }

  function staffValues() {
    return [['Staff ID', 'First Name', 'Last Name', 'Active', 'Email', 'Email2']].concat(STAFF.map(function (s) {
      var p = s[1].split(' ');
      return [s[0], p.slice(1).join(' '), p[0], s[5] || 'Y', s[3], s[4]];
    }));
  }

  // Who is authorised to collect each child — the FACTS pickup-contact list, one row per contact.
  function pickupValues() {
    var H = ['pickupId', 'studentId', 'firstName', 'lastName', 'relationship', 'email',
             'cellPhone', 'homePhone', 'workPhone', 'note', 'portalSortOrder', 'refId'];
    var rows = [H], n = 1;
    FAMILIES.forEach(function (f) {
      f.kids.forEach(function (k) {
        f.guardians.forEach(function (g, i) {
          rows.push([String(n++), String(k[0]), g[0], f.last, g[1], g[3] || '', g[2], '', '',
                     g[1] === 'Aunt' ? 'emergency pickup only' : '', String(i + 1), '']);
        });
      });
    });
    return rows;
  }

  // Shared per-role board views — the ramp lead's exact filters, attached to the ROLE so a
  // stand-in opens her board rather than a blank one.
  var ROLE_VIEWS = {
    'Ramp': { mode: 'ramp', scope: '', route: '', types: ['Bus', 'Car'], grades: ['2', '3', '4', '5'],
              excludeTypes: ['Early Bird', 'Staff Kid'], savedBy: 'ramp.lead@example.edu',
              savedAt: '2026-09-08 14:40' }
  };

  var tabs = {
    'Roster': rosterValues(),
    'Attendance Today': attendanceValues(),
    'Overrides': overridesValues(),
    'Walkers': walkersValues(),
    'Routes': routesValues(),
    'Roles': rolesValues(),
    'PickupContacts': pickupValues(),
    'Staff': staffValues(),
    'EVENTS': eventsValues()
  };

  return {
    demo: DEMO,
    tabs: tabs,
    roleViews: ROLE_VIEWS,
    students: students,
    // exactly the inputs the real producer's assembleTransportationRows() takes — verify.mjs
    // feeds these to facts-api-sync/Transportation.gs and checks its output equals tabs.Roster
    producerInputs: {
      routesByStudent: routesByStudent, staffChild: staffChild, earlyBird: earlyBird,
      familyById: familyById, nameById: nameById, gradeById: gradeById, homeroomById: homeroomById,
      teacherBuildings: teacherBuildings
    }
  };
})();
