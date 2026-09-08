/* data.js — Campus Presence demo dataset. 100% FABRICATED: every student, guardian, visitor,
   staff member, email, phone number, student id, badge and event below is invented. Nothing here
   comes from a real record, and no Google Sheet id, deployment URL or device key appears anywhere
   (the real app keeps those in Script Properties, never in data).

   THE SAME FICTIONAL SCHOOL as the Directory Search and Dismissal Board demos: the 87 students
   carry the same ids (400101-400187), names, grades and guardians as demos/transportation/data.js,
   and today's mid-day sign-outs are the same ones its board reads out of the kiosk's EVENTS log —
   so the three demos tell one consistent story. One extra row (400188) is Inactive rather than
   Enrolled, because the real directory parser keeps only enrolled students and that filter should
   be exercised rather than assumed.

   Shape mirrors what the production app reads, tab for tab:
     FACTS staging sheet (read-only, parsed BY HEADER NAME):
       Sheet1             one row per student+guardian (the LONG directory format)
       PickupContacts     who is authorised to collect each child
       Student Schedules  Category='Homeroom' rows — the only elementary homeroom source
       Staff              teacher emails, for the email_teacher follow-up mode
     ELC side-car:
       K5-6 Teachers      elementary homeroom emails, the fallback when Staff has no match
     SignInOut_DB (the app's own spreadsheet):
       EVENTS             the append-only event log — presence is ALWAYS derived from it
       BADGES SETTINGS PERMISSIONS WORK_RELEASE STATIONS

   The EVENTS header is EXACTLY SCHEMA.EVENTS cols[].name, in order; verify.mjs asserts that
   against the real logic/schema.js, so this fixture cannot drift from the column contract.

   The event log is GENERATED, deterministically: a small linear-congruential generator (no
   Math.random anywhere) so every build of this demo produces a byte-identical log. It spans the
   first day of school to the demo date, which is what gives the Metrics page real trends rather
   than a single pretty day. */
window.CAMPUS_PRESENCE_DATA = (function () {
  'use strict';

  /* ---------- the demo clock ----------
     Pinned to Tuesday 15 September 2026 at 2:52pm — the same day and time the Dismissal Board
     demo is pinned to, and late enough in the afternoon that the board has a full day behind it:
     visitors on campus, students off campus, late arrivals, a page-the-student follow-up waiting
     to be cleared, and one OPEN pickup mismatch flag. Nothing reads the visitor's own clock, so
     the demo looks the same in January as in June. */
  var DEMO = {
    date: '2026-09-15',
    dayName: 'Tue',
    now: '2026-09-15 14:52:11',
    firstSchoolDay: '2026-08-24',        // a Monday; the log starts here
    holidays: ['2026-09-07'],            // Labor Day — a deliberate gap in the daily series
    staffEmail: 'demo.staff@example.edu' // the signed-in demo account (front office + Admin)
  };

  /* ---------- grade -> building / desk (schema.js defaults, restated here so data.js stays
     free of app logic and can be loaded on its own by verify.mjs) ----------
     Two counter-intuitive, load-bearing entries: 5th grade meets in the KINDERGARTEN building,
     and 6th is a modular unit that campus-control's building enum calls '6th Grade'. */
  var GRADE_BUILDING = {
    'K4': 'Kindergarten', 'K5': 'Kindergarten',
    '1': 'Elementary', '2': 'Elementary', '3': 'Elementary', '4': 'Elementary',
    '5': 'Kindergarten', '6': '6th Grade',
    '7': 'High School', '8': 'High School', '9': 'High School',
    '10': 'High School', '11': 'High School', '12': 'High School'
  };
  // Which front desk coordinates the dismissal call. Distinct from the physical map above.
  var DESK = {
    'K4': 'el', 'K5': 'el', '1': 'el', '2': 'el', '3': 'el', '4': 'el', '5': 'el',
    '6': 'hs', '7': 'hs', '8': 'hs', '9': 'hs', '10': 'hs', '11': 'hs', '12': 'hs'
  };

  /* ---------- staff ---------- */
  // [staffId, 'Last First', email, active]. Two elementary teachers are deliberately ABSENT from
  // this tab (Almeida Rosa, Prewitt Hannah) so the email_teacher follow-up has to fall through to
  // the ELC side-car below — the degrade path the app was written for.
  var STAFF = [
    [9101, 'Whitfield Dana', 'd.whitfield@example.edu', 'Y'],
    [9102, 'Rasmussen Iris', 'i.rasmussen@example.edu', 'Y'],
    [9103, 'Okafor Simon', 's.okafor@example.edu', 'Y'],
    [9104, 'Brennan Kate', 'k.brennan@example.edu', 'Y'],
    [9105, 'Vandermeer Luke', 'l.vandermeer@example.edu', 'Y'],
    [9106, 'Nakamura Ellis', 'e.nakamura@example.edu', 'Y'],
    [9107, 'Duvall Marta', 'm.duvall@example.edu', 'Y'],
    [9108, 'Sandoval Rico', 'r.sandoval@example.edu', 'Y'],
    [9109, 'Ostrowski Renata', 'r.ostrowski@example.edu', 'Y'],
    [9110, 'Hensley Bartholomew', 'b.hensley@example.edu', 'Y'],
    [9111, 'Quon Beatrix', 'b.quon@example.edu', 'Y'],
    [9112, 'Larkin Moses', 'm.larkin@example.edu', 'Y'],
    [9113, 'Sowell Gina', DEMO.staffEmail, 'Y'],
    [9114, 'Farrow Imogen', 'i.farrow@example.edu', 'Y'],
    [9115, 'Tobin Celeste', 'c.tobin@example.edu', 'Y'],
    [9118, 'Marchetti Dov', 'd.marchetti@example.edu', 'Y'],
    [9119, 'Pruitt Lorraine', 'l.pruitt@example.edu', 'Y'],
    [9120, 'Ybarra Consuelo', 'c.ybarra@example.edu', 'Y'],
    [9124, 'Quill Hortensia', 'h.quill@example.edu', 'N']   // left in June
  ];

  // Homeroom by grade. '4b' is the second 4th-grade homeroom (grade 4 is taught by two people).
  // TEACHER NAMES ARE 'Last, First' with the comma, which is the form the FACTS export uses in
  // its Homeroom Teacher / Teacher columns and the form the app's staff-email resolver keys on —
  // students are last-name-first WITHOUT a comma, and that asymmetry is real, not a typo here.
  var HOMEROOM = {
    'K4': ['HR-K4', 'Prewitt, Hannah'], 'K5': ['HR-K5', 'Almeida, Rosa'],
    '1': ['HR-01', 'Tobin, Celeste'], '2': ['HR-02', 'Farrow, Imogen'], '3': ['HR-03', 'Sowell, Gina'],
    '4': ['HR-04', 'Quon, Beatrix'], '4b': ['HR-04-2', 'Larkin, Moses'],
    '5': ['HR-05', 'Hensley, Bartholomew'], '6': ['HR-06', 'Ostrowski, Renata'],
    '7': ['HR-07', 'Duvall, Marta'], '8': ['HR-08', 'Duvall, Marta'],
    '9': ['HR-09', 'Nakamura, Ellis'], '10': ['HR-10', 'Brennan, Kate'],
    '11': ['HR-11', 'Okafor, Simon'], '12': ['HR-12', 'Whitfield, Dana']
  };

  // The elementary side-car the office keeps for K5-6 homeroom emails — the fallback the app
  // reaches for when the Staff tab has no row for a teacher (Prewitt and Almeida, above).
  var ELC_TEACHERS = [
    ['K4', 'Prewitt, Hannah', 'HR-K4', 'h.prewitt@example.edu'],
    ['K5', 'Almeida, Rosa', 'HR-K5', 'r.almeida@example.edu'],
    ['5', 'Hensley, Bartholomew', 'HR-05', 'b.hensley@example.edu'],
    ['6', 'Ostrowski, Renata', 'HR-06', 'r.ostrowski@example.edu']
  ];

  /* ---------- families ----------
     { fid, last, guardians: [[first, relationship, cell, email]], kids: [[id, first, grade, opts]] }
     opts.hr = '4b' for the second 4th-grade homeroom, 'none' where no homeroom is recorded.
     opts.hs = a part-time HOMESCHOOL enrolment: arrives mid-morning, leaves around noon.
     opts.status = a non-Enrolled FACTS status (the parser drops these).
     Three families have NO guardians on file at all — the kiosk's pickup check has nothing to
     match against for those children, which is exactly why it must fail closed. */
  var FAMILIES = [
    { fid: 7001, last: 'Alderman', guardians: [['Priya', 'Mother', '410-555-0101', 'priya.alderman@example.com'],
        ['Ross', 'Father', '410-555-0102', 'ross.alderman@example.com'], ['Vera', 'Grandparent', '410-555-0103', '']],
      kids: [[400101, 'Nora', '12', {}]] },
    { fid: 7002, last: 'Boyette', guardians: [['Trina', 'Mother', '410-555-0104', 'trina.boyette@example.com']],
      kids: [[400102, 'Marcus', '12', {}]] },
    { fid: 7003, last: 'Castellano', guardians: [['June', 'Mother', '410-555-0111', 'june.castellano@example.com'],
        ['Paul', 'Father', '410-555-0112', 'paul.castellano@example.com']],
      kids: [[400103, 'Ivy', '11', {}]] },
    { fid: 7004, last: 'Delgado', guardians: [['Marisol', 'Mother', '410-555-0113', 'marisol.delgado@example.com']],
      kids: [[400104, 'Theo', '11', {}]] },
    { fid: 7005, last: 'Enriquez', guardians: [['Dolores', 'Mother', '410-555-0114', 'dolores.enriquez@example.com']],
      kids: [[400105, 'Sasha', '10', {}]] },
    { fid: 7006, last: 'Fairbanks', guardians: [['Greta', 'Mother', '410-555-0105', 'greta.fairbanks@example.com'],
        ['Neil', 'Father', '410-555-0106', 'neil.fairbanks@example.com']],
      kids: [[400106, 'Owen', '9', {}], [400107, 'Wren', '7', {}]] },
    { fid: 7007, last: 'Grady', guardians: [['Adele', 'Mother', '410-555-0115', 'adele.grady@example.com']],
      kids: [[400108, 'Jonathon', '9', {}]] },
    { fid: 7008, last: 'Halvorsen', guardians: [['Rita', 'Mother', '410-555-0116', 'rita.halvorsen@example.com']],
      kids: [[400109, 'Jonathan', '8', {}]] },
    { fid: 7009, last: 'Iverson', guardians: [['Colette', 'Mother', '410-555-0117', 'colette.iverson@example.com'],
        ['Bram', 'Father', '410-555-0118', 'bram.iverson@example.com']],
      kids: [[400110, 'Maeve', '8', {}]] },
    { fid: 7010, last: 'Jessup', guardians: [['Naomi', 'Mother', '410-555-0119', 'naomi.jessup@example.com']],
      kids: [[400111, 'Caleb', '7', {}]] },
    { fid: 7011, last: 'Kirkwood', guardians: [['Helena', 'Mother', '410-555-0107', 'helena.kirkwood@example.com'],
        ['Dot', 'Aunt', '410-555-0108', '']],
      kids: [[400112, 'Tess', 'K5', {}], [400113, 'Bram', '3', {}]] },
    { fid: 7012, last: 'Lindqvist', guardians: [['Suvi', 'Mother', '410-555-0120', 'suvi.lindqvist@example.com']],
      kids: [[400114, 'Anders', '10', {}]] },
    { fid: 7013, last: 'Marlowe', guardians: [['Hesper', 'Mother', '410-555-0121', 'hesper.marlowe@example.com'],
        ['Barnaby', 'Father', '410-555-0122', '']],
      kids: [[400115, 'Juniper', '4', {}], [400116, 'Cassius', '1', {}]] },
    { fid: 7014, last: 'Petrakis', guardians: [['Eleni', 'Mother', '410-555-0123', 'eleni.petrakis@example.com']],
      kids: [[400117, 'Leonidas', '6', {}]] },
    { fid: 7015, last: 'Tennant', guardians: [['Oriel', 'Mother', '410-555-0125', 'oriel.tennant@example.com'],
        ['Beatrix', 'Grandmother', '410-555-0124', '']],
      kids: [[400118, 'Rosalind', '2', {}]] },
    { fid: 7016, last: 'Vickery', guardians: [['Imelda', 'Mother', '410-555-0126', 'imelda.vickery@example.com'],
        ['Lucian', 'Father', '410-555-0127', '']],
      kids: [[400119, 'Dashiell', '9', {}]] },
    { fid: 7017, last: 'Zielinski', guardians: [['Agnieszka', 'Mother', '410-555-0128', 'a.zielinski@example.com']],
      kids: [[400120, 'Hana', '5', {}]] },
    { fid: 7018, last: 'Bergstrom', guardians: [['Annika', 'Mother', '410-555-0129', 'annika.bergstrom@example.com'],
        ['Lars', 'Father', '410-555-0130', 'lars.bergstrom@example.com']],
      kids: [[400121, 'Soren', '3', {}], [400122, 'Freya', 'K4', {}]] },
    { fid: 7019, last: 'Nakashima', guardians: [['Haruki', 'Father', '410-555-0131', 'haruki.nakashima@example.com'],
        ['Mei', 'Mother', '410-555-0132', '']],
      kids: [[400123, 'Kenji', '11', {}], [400124, 'Yui', '7', {}]] },
    { fid: 7020, last: 'Oyelaran', guardians: [['Folasade', 'Mother', '410-555-0133', 'f.oyelaran@example.com']],
      kids: [[400125, 'Temi', '3', {}]] },
    { fid: 7021, last: 'Quintero', guardians: [['Rosario', 'Mother', '410-555-0134', 'rosario.quintero@example.com'],
        ['Esteban', 'Father', '410-555-0135', '']],
      kids: [[400126, 'Mateo', '10', {}]] },
    { fid: 7022, last: 'Rasheed', guardians: [['Farah', 'Mother', '410-555-0136', 'farah.rasheed@example.com']],
      kids: [[400127, 'Layla', '5', {}]] },
    { fid: 7023, last: 'Solberg', guardians: [['Kristoffer', 'Father', '410-555-0137', 'k.solberg@example.com']],
      kids: [[400128, 'Ingrid', '12', {}]] },
    { fid: 7024, last: 'Ulrich', guardians: [['Petra', 'Mother', '410-555-0138', 'petra.ulrich@example.com']],
      kids: [[400129, 'Baxter', '8', {}]] },
    { fid: 7025, last: 'Winslow', guardians: [['Cordelia', 'Mother', '410-555-0139', 'cordelia.winslow@example.com'],
        ['Jasper', 'Father', '410-555-0140', '']],
      kids: [[400130, 'Pippa', '2', {}], [400131, 'Otis', 'K5', {}]] },
    { fid: 7026, last: 'Yeboah', guardians: [['Akosua', 'Mother', '410-555-0141', 'akosua.yeboah@example.com']],
      kids: [[400132, 'Kwame', '6', {}], [400133, 'Ama', '4', { hr: '4b' }]] },
    { fid: 7027, last: 'Abbington', guardians: [['Florence', 'Mother', '410-555-0142', 'florence.abbington@example.com']],
      kids: [[400134, 'Clementine', '4', { hr: '4b' }]] },
    { fid: 7028, last: 'Carrasco', guardians: [['Ignacio', 'Father', '410-555-0143', 'ignacio.carrasco@example.com'],
        ['Pilar', 'Mother', '410-555-0144', 'pilar.carrasco@example.com']],
      kids: [[400135, 'Diego', '7', {}], [400136, 'Lucia', '9', {}]] },
    { fid: 7029, last: 'Dufresne', guardians: [['Solange', 'Mother', '410-555-0145', 'solange.dufresne@example.com']],
      kids: [[400137, 'Margaux', '1', {}]] },
    { fid: 7030, last: 'Ekwueme', guardians: [['Ngozi', 'Mother', '410-555-0146', 'ngozi.ekwueme@example.com']],
      kids: [[400138, 'Chidi', '8', {}]] },
    { fid: 7031, last: 'Fontaine', guardians: [['Yves', 'Father', '410-555-0147', 'yves.fontaine@example.com']],
      kids: [[400139, 'Remy', '5', {}]] },
    { fid: 7032, last: 'Gaskill', guardians: [['Tabitha', 'Mother', '410-555-0148', 'tabitha.gaskill@example.com']],
      kids: [[400140, 'Wyatt', '3', {}]] },
    { fid: 7033, last: 'Hartigan', guardians: [['Siobhan', 'Mother', '410-555-0149', 'siobhan.hartigan@example.com'],
        ['Declan', 'Father', '410-555-0150', '']],
      kids: [[400141, 'Niamh', '10', {}]] },
    { fid: 7034, last: 'Ingram', guardians: [['Loretta', 'Grandmother', '410-555-0151', '']],
      kids: [[400142, 'Thaddeus', '12', {}]] },
    { fid: 7035, last: 'Jablonski', guardians: [['Marek', 'Father', '410-555-0152', 'marek.jablonski@example.com']],
      kids: [[400143, 'Wiktor', '6', {}]] },
    { fid: 7036, last: 'Kowalczyk', guardians: [['Danuta', 'Mother', '410-555-0153', 'danuta.kowalczyk@example.com']],
      kids: [[400144, 'Zofia', '4', {}]] },
    { fid: 7037, last: 'Lachance', guardians: [['Mireille', 'Mother', '410-555-0154', 'mireille.lachance@example.com']],
      kids: [[400145, 'Etienne', '2', {}]] },
    { fid: 7038, last: 'Mbeki', guardians: [['Lindiwe', 'Mother', '410-555-0155', 'lindiwe.mbeki@example.com'],
        ['Sipho', 'Father', '410-555-0156', '']],
      kids: [[400146, 'Thabo', '11', {}]] },
    { fid: 7039, last: 'Novotny', guardians: [['Jitka', 'Mother', '410-555-0157', 'jitka.novotny@example.com']],
      kids: [[400147, 'Klara', '8', {}]] },
    { fid: 7040, last: 'Oduya', guardians: [['Bolanle', 'Mother', '410-555-0158', 'bolanle.oduya@example.com']],
      kids: [[400148, 'Femi', '5', {}]] },
    { fid: 7041, last: 'Pemberton', guardians: [['Cressida', 'Mother', '410-555-0159', 'cressida.pemberton@example.com'],
        ['Rupert', 'Father', '410-555-0160', '']],
      kids: [[400149, 'Harriet', '1', {}]] },

    // ---- staff children (a guardian is active staff) ----
    { fid: 7042, last: 'Whitfield', guardians: [['Dana', 'Mother', '410-555-0161', 'd.whitfield@example.edu'],
        ['Aurelio', 'Father', '410-555-0162', '']],
      kids: [[400150, 'Juno', '2', {}]] },
    { fid: 7043, last: 'Okafor', guardians: [['Simon', 'Father', '410-555-0163', 's.okafor@example.edu'],
        ['Chioma', 'Mother', '410-555-0164', 'chioma.okafor@example.com']],
      kids: [[400151, 'Adaeze', '4', {}], [400152, 'Chidubem', 'K4', {}]] },
    { fid: 7044, last: 'Sowell', guardians: [['Gina', 'Mother', '410-555-0165', DEMO.staffEmail]],
      kids: [[400153, 'Tobias', 'K5', {}]] },
    { fid: 7045, last: 'Marchetti', guardians: [['Dov', 'Father', '410-555-0166', 'd.marchetti@example.edu'],
        ['Serena', 'Mother', '410-555-0167', '']],
      kids: [[400154, 'Bianca', '3', {}]] },
    { fid: 7046, last: 'Dunmore', guardians: [['Felix', 'Father', '410-555-0168', 'f.dunmore@example.edu']],
      kids: [[400155, 'Rhys', '5', {}]] },
    { fid: 7047, last: 'Ashby', guardians: [['Wendell', 'Father', '410-555-0169', 'w.ashby@example.edu'],
        ['Marisa', 'Mother', '410-555-0170', 'marisa.ashby@example.com']],
      kids: [[400156, 'Clover', '2', {}]] },
    { fid: 7048, last: 'Pruitt', guardians: [['Lorraine', 'Mother', '410-555-0171', 'l.pruitt@example.edu']],
      kids: [[400157, 'Miles', '4', { hr: '4b' }], [400158, 'Esme', '9', {}]] },
    { fid: 7049, last: 'Almeida', guardians: [['Rosa', 'Mother', '410-555-0172', 'r.almeida@example.edu']],
      kids: [[400159, 'Joaquin', '4', {}]] },
    { fid: 7050, last: 'Vandermeer', guardians: [['Luke', 'Father', '410-555-0173', 'l.vandermeer@example.edu'],
        ['Femke', 'Mother', '410-555-0174', '']],
      kids: [[400160, 'Ida', '3', {}], [400161, 'Pim', 'K5', {}]] },
    { fid: 7072, last: 'Rasmussen', guardians: [['Iris', 'Mother', '410-555-0199', 'i.rasmussen@example.edu'],
        ['Bjorn', 'Father', '410-555-0200', '']],
      kids: [[400187, 'Linnea', '1', {}]] },

    // ---- the rest of the school ----
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
    { fid: 7056, last: 'Yusuf', guardians: [['Halima', 'Mother', '410-555-0182', 'halima.yusuf@example.com']],
      kids: [[400169, 'Amira', '2', {}], [400170, 'Idris', '6', {}]] },
    { fid: 7057, last: 'Ambrose', guardians: [['Genevieve', 'Mother', '410-555-0183', 'genevieve.ambrose@example.com']],
      kids: [[400171, 'Delphine', '10', {}]] },
    { fid: 7058, last: 'Blakeney', guardians: [['Fionnuala', 'Mother', '410-555-0184', 'f.blakeney@example.com'],
        ['Ronan', 'Father', '410-555-0185', '']],
      kids: [[400172, 'Cormac', '4', { hr: '4b' }]] },
    { fid: 7059, last: 'Cardoso', guardians: [['Teresa', 'Mother', '410-555-0186', 'teresa.cardoso@example.com']],
      kids: [[400173, 'Ines', 'K4', {}], [400174, 'Rafael', '3', {}]] },
    // part-time HOMESCHOOL enrolments: in for two morning classes, out again around noon
    { fid: 7060, last: 'Dimitriou', guardians: [['Yannis', 'Father', '410-555-0187', 'yannis.dimitriou@example.com']],
      kids: [[400175, 'Stavros', '7', { hs: 1 }]] },
    { fid: 7061, last: 'Esposito', guardians: [['Carmela', 'Mother', '410-555-0188', 'carmela.esposito@example.com']],
      kids: [[400176, 'Gianna', '12', { hr: 'none', hs: 1 }]] },
    { fid: 7062, last: 'Fenwick', guardians: [['Meredith', 'Mother', '410-555-0189', 'meredith.fenwick@example.com']],
      kids: [[400177, 'Rowan', '5', {}]] },
    { fid: 7063, last: 'Guzman', guardians: [['Alejandra', 'Mother', '410-555-0190', 'alejandra.guzman@example.com'],
        ['Tomas', 'Father', '410-555-0191', '']],
      kids: [[400178, 'Ximena', '11', {}]] },
    { fid: 7064, last: 'Holloway', guardians: [['Sinclair', 'Father', '410-555-0192', 'sinclair.holloway@example.com']],
      kids: [[400179, 'Beckett', '9', {}]] },
    { fid: 7065, last: 'Ivashkin', guardians: [],                        // nobody on file
      kids: [[400180, 'Nadia', '8', {}]] },
    { fid: 7066, last: 'Joubert', guardians: [['Sylvie', 'Mother', '410-555-0193', 'sylvie.joubert@example.com']],
      kids: [[400181, 'Amelie', '6', {}]] },
    { fid: 7067, last: 'Kessler', guardians: [],                         // nobody on file
      kids: [[400182, 'Otto', 'K5', {}]] },
    { fid: 7068, last: 'Lombardi', guardians: [['Graziella', 'Mother', '410-555-0194', 'graziella.lombardi@example.com'],
        ['Enzo', 'Father', '410-555-0195', '']],
      kids: [[400183, 'Vittoria', '10', {}]] },
    { fid: 7069, last: 'Moreau', guardians: [['Anouk', 'Mother', '410-555-0196', 'anouk.moreau@example.com']],
      kids: [[400184, 'Celestine', '4', { hs: 1 }]] },
    { fid: 7070, last: 'Prakash', guardians: [['Deepa', 'Mother', '410-555-0197', 'deepa.prakash@example.com'],
        ['Ravi', 'Father', '410-555-0198', '']],
      kids: [[400185, 'Anjali', '12', { hr: 'none' }]] },
    { fid: 7071, last: 'Rowntree', guardians: [],                        // nobody on file
      kids: [[400186, 'Digby', '7', {}]] },
    // withdrawn over the summer: the directory parser keeps ENROLLED only, so this student must
    // never appear in a search, a roster or a muster count.
    { fid: 7073, last: 'Halloran', guardians: [['Niall', 'Father', '410-555-0201', 'niall.halloran@example.com']],
      kids: [[400188, 'Wilfred', '8', { status: 'Inactive' }]] }
  ];

  /* ---------- derived indexes ---------- */
  var students = [];          // {id, name, first, last, grade, homeroom, teacher, guardians[], hs}
  var byId = {};
  FAMILIES.forEach(function (f) {
    f.kids.forEach(function (k) {
      var o = k[3] || {};
      var hr = o.hr === 'none' ? null : HOMEROOM[o.hr === '4b' ? '4b' : k[2]];
      var s = {
        id: String(k[0]), first: k[1], last: f.last, name: f.last + ' ' + k[1], grade: k[2],
        homeroom: hr ? hr[0] : '', teacher: hr ? hr[1] : '',
        status: o.status || 'Enrolled', hs: !!o.hs, fid: f.fid,
        guardians: f.guardians.map(function (g) {
          return { first: g[0], relationship: g[1], cell: g[2], email: g[3], last: f.last };
        })
      };
      students.push(s);
      byId[s.id] = s;
    });
  });
  var enrolled = students.filter(function (s) { return s.status === 'Enrolled'; });

  /* ---------- FACTS staging tabs (parsed BY HEADER NAME — the columns are append-only in the
     producer, so the parsers never rely on position) ---------- */

  // Sheet1: the LONG directory format — one row per student+guardian pair. 'Homeroom Teacher' is
  // populated for grades 7-12 ONLY, exactly as the real export is; elementary homerooms come from
  // the Student Schedules tab below. A student with no guardians still gets one row, so they are
  // enrolled and searchable with nobody authorised to collect them.
  function sheet1Values() {
    var H = ['Student ID (System)', 'LastName FirstName', 'Grade Level', 'Homeroom Teacher',
             'Status', 'Family ID', 'LastName FirstName 1', 'Relationship 1', 'Email 1', 'Email2'];
    var rows = [H];
    students.forEach(function (s) {
      var hrTeacher = (['7', '8', '9', '10', '11', '12'].indexOf(s.grade) !== -1) ? s.teacher : '';
      if (!s.guardians.length) {
        rows.push([s.id, s.name, s.grade, hrTeacher, s.status, String(s.fid), '', '', '', '']);
        return;
      }
      s.guardians.forEach(function (g) {
        rows.push([s.id, s.name, s.grade, hrTeacher, s.status, String(s.fid),
                   g.last + ' ' + g.first, g.relationship, g.email, '']);
      });
    });
    return rows;
  }

  // PickupContacts: who may collect each child (facts-api-sync M2 header contract). The kiosk
  // NEVER receives these rows — it answers match/no-match only — which is why the phone and email
  // columns can sit here untouched.
  function pickupValues() {
    var H = ['pickupId', 'studentId', 'firstName', 'lastName', 'relationship', 'email',
             'cellPhone', 'homePhone', 'workPhone', 'note', 'portalSortOrder', 'refId'];
    var rows = [H], n = 1;
    students.forEach(function (s) {
      s.guardians.forEach(function (g, i) {
        rows.push([String(n++), s.id, g.first, s.last, g.relationship, g.email, g.cell, '', '',
                   (g.relationship === 'Aunt' || g.relationship === 'Grandparent')
                     ? 'emergency pickup only' : '',
                   String(i + 1), '']);
      });
    });
    return rows;
  }

  // Student Schedules — only the Category='Homeroom' rows matter here (the app reads nothing else
  // from this tab), and they are the ONLY elementary homeroom source in the export.
  function schedulesValues() {
    var H = ['Student ID', 'Student Name', 'Class Code', 'Description', 'Category', 'Teacher', 'Period'];
    var rows = [H];
    students.forEach(function (s) {
      if (!s.homeroom) return;
      rows.push([s.id, s.name, s.homeroom, 'Homeroom ' + s.grade, 'Homeroom', s.teacher, 'HR']);
    });
    return rows;
  }

  function staffValues() {
    var H = ['Staff ID', 'First Name', 'Last Name', 'Active', 'Email', 'Email2'];
    return [H].concat(STAFF.map(function (r) {
      var p = r[1].split(' ');
      return [String(r[0]), p.slice(1).join(' '), p[0], r[3], r[2], ''];
    }));
  }

  function elcValues() {
    return [['Grade', 'Teacher', 'Homeroom', 'Email']].concat(ELC_TEACHERS.map(function (r) {
      return [r[0], r[1], r[2], r[3]];
    }));
  }

  /* ---------- SignInOut_DB: BADGES ----------
     Reusable numbered lanyards, V1-V20 at the high-school office and V21-V40 at the elementary
     entrance. V7 is retired rather than deleted (the registry is append-only in spirit), so the
     kiosk keypad's "that badge isn't in service" answer is demoable. */
  function badgeValues() {
    var H = ['BadgeID', 'Label', 'HomeStation', 'Active', 'Notes'];
    var rows = [H];
    for (var i = 1; i <= 40; i++) {
      var st = i <= 20 ? 'hs' : 'el';
      rows.push(['V' + i, 'Visitor ' + i, st, i === 7 ? 'N' : 'Y',
                 i === 7 ? 'clip broken — retired 2026-08-31' : '']);
    }
    return rows;
  }

  /* ---------- SignInOut_DB: SETTINGS ----------
     SETTINGS_DEFAULTS from logic/schema.js, with the handful of values this school actually
     changed. 'Homeschool' is in BOTH the late and dismissal reason lists, because the part-time
     homeschool cohort uses the kiosk twice a day. factsfinder.url is deliberately BLANK: the
     roster's deep link points at a separate tool with its own staff allowlist, and there is no
     such target in a standalone demo — blank is the app's own supported "no deep links" setting
     (and it keeps a real deployment URL out of this repo). */
  var SETTINGS_ROWS = [
    ['dismissal.followup.mode', 'office_alert'],
    ['dismissal.followup.cc', 'office.demo@example.edu'],
    ['dismissal.pickup.ui', 'type'],
    ['late.parentdriven.maxgrade', '5'],
    ['visitor.reasons', 'Meeting|Delivery|Maintenance|Family visit|Volunteering|Other'],
    ['late.reasons', 'Appointment|Overslept|Car trouble|Family|Homeschool|Other'],
    ['dismissal.reasons', 'Medical appointment|Family|Sports dismissal|Illness|Homeschool|Other'],
    ['building.grade.map', JSON.stringify(GRADE_BUILDING)],
    ['desk.grade.map', JSON.stringify(DESK)],
    ['presence.doorsheet.enabled', 'false'],
    ['kiosk.idle.warn.seconds', '45'],
    ['kiosk.idle.reset.seconds', '10'],
    ['board.poll.seconds', '12'],
    ['muster.rosterMode', 'full'],
    ['mismatch.alert.emails', 'office.demo@example.edu'],
    ['closeout.hour', '23'],
    ['schoolyear.start.month', '8'],
    ['factsfinder.url', ''],
    ['kiosk.flows.enabled', JSON.stringify(['visitor', 'student_in', 'student_out'])]
  ];
  function settingsValues() {
    return [['Key', 'Value', 'UpdatedAt', 'UpdatedBy']].concat(SETTINGS_ROWS.map(function (r) {
      return [r[0], r[1], '2026-08-21 09:14:02', DEMO.staffEmail];
    }));
  }

  /* ---------- SignInOut_DB: PERMISSIONS ----------
     Stand-alone and fail-CLOSED: no row means no access. AlertStation scopes only the CHIME —
     every listed person still sees the whole campus on the board. */
  function permissionValues() {
    return [['Email', 'FrontOffice', 'Admin', 'Notes', 'AlertStation'],
      [DEMO.staffEmail, 'Y', 'Y', 'demo sign-in — front office + settings', 'all'],
      ['office.demo@example.edu', 'Y', '', 'HS front desk', 'hs'],
      ['l.pruitt@example.edu', 'Y', '', 'HS office', 'hs'],
      ['c.ybarra@example.edu', 'Y', '', 'EL entrance desk', 'el'],
      ['r.ostrowski@example.edu', 'Y', '', 'reads the board at muster; chime off', 'none']
    ];
  }

  /* ---------- SignInOut_DB: WORK_RELEASE ----------
     The only students who may sign THEMSELVES out (grade 7+ and on this list — the kiosk fails
     closed and the list never leaves the server). One row has already expired, which is how the
     expiry check earns its place. */
  function workReleaseValues() {
    var H = ['StudentID', 'StudentName', 'ApprovedBy', 'Expires', 'Notes'];
    var rows = [
      ['400101', '', DEMO.staffEmail, '', 'internship, Tue/Thu afternoons'],
      ['400128', '', DEMO.staffEmail, '', 'works at the marina'],
      ['400142', '', DEMO.staffEmail, '', ''],
      ['400146', '', DEMO.staffEmail, '', 'dual enrolment, off-campus class'],
      ['400178', '', DEMO.staffEmail, '2026-09-01', 'EXPIRED — summer placement ended'],
      ['400185', '', DEMO.staffEmail, '', '']
    ];
    return [H].concat(rows.map(function (r) {
      return [r[0], (byId[r[0]] || {}).name || '', r[2], r[3], r[4]];
    }));
  }

  function stationValues() {
    return [['StationID', 'Name', 'Building', 'Enabled'],
      ['hs', 'HS Main Office', 'High School', 'Y'],
      ['el', 'EL Entrance', 'Elementary', 'Y'],
      ['office', 'Office (manual entries)', 'High School', 'Y'],
      ['mobile', 'Movement devices', 'Other', 'Y']
    ];
  }

  /* =====================================================================================
     THE EVENT LOG — generated deterministically
     =====================================================================================
     A tiny linear-congruential generator stands in for Math.random so the log is identical on
     every build: a demo that reshuffles itself cannot be verified, and a screenshot of it would
     never match what the next visitor sees.

     Shape of a school day, from three weeks of watching the real desks:
       * visitors arrive in a morning clump and a mid-afternoon clump, sign out 25-95 minutes
         later, and a couple never hand the badge back (the nightly close-out signs those out)
       * late arrivals land between 8:05 and 9:45; below 6th grade an adult must sign them in
       * the part-time homeschool cohort arrives together around 10:00 and leaves around 12:00
       * early dismissals run 10:30-14:45 and are heaviest on Fridays
       * about one in four early dismissals comes back the same day
       * pickup mismatches are rare — a handful a month — and never a sign-out
     Mondays are quieter; Labor Day is missing entirely, which is what the Metrics page's
     gap-filled daily series is for.
  ==================================================================================== */

  // EXACTLY SCHEMA.EVENTS cols[].name, in order. verify.mjs asserts this against schema.js.
  var EVENTS_HEADER = ['EventID', 'Timestamp', 'Date', 'Type', 'PersonType', 'PersonKey',
    'PersonName', 'Grade', 'HomeBuilding', 'Station', 'FromBuilding', 'ToBuilding', 'BadgeID',
    'Reason', 'GuardianName', 'Relationship', 'PickupContactID', 'PickupMatch', 'FlagStatus',
    'FlagNote', 'RelatedEventID', 'FollowUpMode', 'FollowUpStatus', 'Notes', 'Source'];

  function lcg(seed) {
    var s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function pad4(n) { return ('000' + n).slice(-4); }
  function ymd(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
  function dowOf(dayKey) {
    var p = dayKey.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();   // 0=Sun
  }
  function addDays(dayKey, n) {
    var p = dayKey.split('-');
    var t = Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000;
    var d = new Date(t);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  function schoolDays(from, to) {
    var out = [], day = from, guard = 0;
    while (day <= to && guard++ < 400) {
      var w = dowOf(day);
      if (w !== 0 && w !== 6 && DEMO.holidays.indexOf(day) === -1) out.push(day);
      day = addDays(day, 1);
    }
    return out;
  }
  function hhmmss(minutes, sec) {
    return pad2(Math.floor(minutes / 60)) + ':' + pad2(minutes % 60) + ':' + pad2(sec);
  }

  var VISITOR_NAMES = [
    'Cordelia Whitlow', 'Bertram Nkemelu', 'Saoirse Doherty', 'Emmerich Vogel', 'Nadine Achebe',
    'Gilbert Rourke', 'Anneliese Krupp', 'Desmond Farrar', 'Perpetua Okonjo', 'Ignatius Bell',
    'Marguerite Lyall', 'Osgood Templeton', 'Bettina Fiorelli', 'Rasheed Salaam', 'Winifred Ashe',
    'Lucien Beauchamp', 'Thomasina Reeve', 'Aurelio Santoro', 'Delphina Marsh', 'Casimir Wozniak',
    'Henrietta Ogilvie', 'Barnabus Fitch', 'Yolanda Prescott', 'Ferdinand Oyelowo'
  ];
  var VISITOR_ORGS = ['', '', '', 'Kettle Creek HVAC', 'Bayside Copier Service', 'Tidewater Pest Control',
    '', 'Harbour Dental Outreach', '', 'Northern Freight', '', 'Cedar Ridge Landscaping'];
  var VISITOR_REASONS = ['Meeting', 'Delivery', 'Maintenance', 'Family visit', 'Volunteering', 'Other'];
  var LATE_REASONS = ['Appointment', 'Overslept', 'Car trouble', 'Family', 'Other'];
  var DISMISS_REASONS = ['Medical appointment', 'Family', 'Sports dismissal', 'Illness', 'Other'];
  var VISITOR_DESTS = ['High School', 'High School', 'Elementary', 'Elementary', 'Kindergarten',
                       '6th Grade', 'Bus Barn'];

  var homeschoolIds = enrolled.filter(function (s) { return s.hs; }).map(function (s) { return s.id; });
  var pickable = enrolled.filter(function (s) { return !s.hs && s.guardians.length; });

  function contactOf(student, rnd) {
    var g = student.guardians[Math.floor(rnd() * student.guardians.length)];
    return { typed: g.first + ' ' + student.last, relationship: g.relationship };
  }
  function deskFor(grade, rnd) {
    // A parent may use either kiosk; ~15% of the time they use the other one.
    var own = DESK[grade] || 'hs';
    return rnd() < 0.15 ? (own === 'hs' ? 'el' : 'hs') : own;
  }

  function eventsValues() {
    var rnd = lcg(20260915);           // the demo date, as the seed
    var log = [];                      // event objects; sorted by Timestamp at the end
    var seq = 1;
    function push(day, minutes, type, f) {
      var sec = Math.floor(rnd() * 60);
      var e = {
        EventID: 'E-' + day.replace(/-/g, '') + '-' + hhmmss(minutes, sec).replace(/:/g, '') +
                 '-' + pad4((seq++ * 7) % 10000),
        Timestamp: day + ' ' + hhmmss(minutes, sec),
        Date: day, Type: type,
        PersonType: type.indexOf('visitor') === 0 ? 'visitor' : 'student',
        FollowUpStatus: 'n/a', Source: 'kiosk'
      };
      for (var k in f) e[k] = f[k];
      if (type === 'visitor_in' && !e.PersonKey) e.PersonKey = e.EventID;
      log.push(e);
      return e;
    }
    // Reusable lanyards, one badge to one visit per day. V7 is retired, so it never appears.
    var HS_BADGES = [], EL_BADGES = [];
    for (var b1 = 1; b1 <= 20; b1++) if (b1 !== 7) HS_BADGES.push('V' + b1);
    for (var b2 = 21; b2 <= 40; b2++) EL_BADGES.push('V' + b2);

    var days = schoolDays(DEMO.firstSchoolDay, DEMO.date);
    // Days that carry a pickup mismatch: three earlier ones (all resolved) plus TODAY's, which is
    // left OPEN so the board's alert card and the red Metrics tile both have something to show.
    var flagDays = { '2026-08-27': 1, '2026-09-03': 1, '2026-09-10': 1 };

    days.forEach(function (day, di) {
      var isToday = day === DEMO.date;
      var dow = dowOf(day);
      var quiet = dow === 1 ? 1 : 0;                   // Mondays are slower
      var shuffled = pickable.slice();
      for (var i = shuffled.length - 1; i > 0; i--) {  // deterministic Fisher-Yates
        var j = Math.floor(rnd() * (i + 1));
        var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t;
      }
      var take = 0;
      function next() { return shuffled[take++ % shuffled.length]; }
      var hsLeft = HS_BADGES.slice(), elLeft = EL_BADGES.slice();

      /* ---- visitors ---- */
      var nv = 3 + Math.floor(rnd() * 5) - quiet;
      for (var v = 0; v < nv; v++) {
        var vName = VISITOR_NAMES[Math.floor(rnd() * VISITOR_NAMES.length)];
        var vOrg = VISITOR_ORGS[Math.floor(rnd() * VISITOR_ORGS.length)];
        var vReason = VISITOR_REASONS[Math.floor(rnd() * VISITOR_REASONS.length)];
        var dest = VISITOR_DESTS[Math.floor(rnd() * VISITOR_DESTS.length)];
        var station = (dest === 'Elementary' || dest === 'Kindergarten') ? 'el' : 'hs';
        var pool = station === 'hs' ? hsLeft : elLeft;
        if (!pool.length) continue;                                  // rack empty (never happens)
        var badge = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
        // TODAY: the last three arrive in the last hour and are STILL HERE at 2:52pm — that is
        // the board's "Visitors on campus" list and the three badges still out.
        var stillHere = isToday && v >= nv - 3;
        var inMin = stillHere
          ? 13 * 60 + 55 + v * 7 + Math.floor(rnd() * 20)
          : (v < 3 ? 8 * 60 + 5 : 12 * 60 + 40) + Math.floor(rnd() * 150);
        if (isToday && !stillHere && inMin > 13 * 60 + 30) inMin = 12 * 60 + 45 + Math.floor(rnd() * 35);
        var vin = push(day, inMin, 'visitor_in', {
          PersonName: vName, Reason: vReason + (vOrg ? ' — ' + vOrg : ''),
          ToBuilding: dest, BadgeID: badge, Station: station
        });
        var stay = 25 + Math.floor(rnd() * 70);
        var outMin = inMin + stay;
        if (stillHere || (isToday && outMin > 14 * 60 + 52)) continue;
        if (rnd() < 0.06) {
          // never handed the badge back: the 23:45 close-out signs them out for the record
          push(day, 23 * 60 + 45, 'visitor_out', {
            PersonKey: vin.PersonKey, PersonName: vName, BadgeID: badge, Station: 'office',
            RelatedEventID: vin.EventID, Source: 'system', Notes: 'auto sign-out (end of day)'
          });
        } else {
          push(day, outMin, 'visitor_out', {
            PersonKey: vin.PersonKey, PersonName: vName, BadgeID: badge, Station: station,
            RelatedEventID: vin.EventID
          });
        }
      }

      /* ---- late arrivals ---- */
      var nl = 2 + Math.floor(rnd() * 5) - quiet;
      for (var l = 0; l < nl; l++) {
        var ls = next();
        var lateMin = 8 * 60 + 5 + Math.floor(rnd() * 100);
        var parentDriven = ['K4', 'K5', '1', '2', '3', '4', '5'].indexOf(ls.grade) !== -1;
        var lc = contactOf(ls, rnd);
        push(day, lateMin, 'student_late_in', {
          PersonKey: ls.id, PersonName: ls.name, Grade: ls.grade,
          HomeBuilding: GRADE_BUILDING[ls.grade], Station: deskFor(ls.grade, rnd),
          Reason: LATE_REASONS[Math.floor(rnd() * LATE_REASONS.length)],
          GuardianName: parentDriven ? lc.typed : '',
          Relationship: parentDriven ? lc.relationship : ''
        });
      }

      /* ---- the part-time homeschool cohort: in about 10:00, out about noon ----
         They are enrolled for two morning classes on TUESDAYS AND THURSDAYS only, which is why
         those two weekdays stand taller on the day-of-week chart and why 'Homeschool' is the
         single biggest reason in the log. The demo date is a Tuesday, so the cohort is part of
         today's off-campus list. */
      if (dow === 2 || dow === 4) homeschoolIds.forEach(function (hid, hi) {
        var hsS = byId[hid];
        var hc = contactOf(hsS, rnd);
        var parentIn = ['K4', 'K5', '1', '2', '3', '4', '5'].indexOf(hsS.grade) !== -1;
        push(day, 9 * 60 + 52 + hi * 4 + Math.floor(rnd() * 8), 'student_late_in', {
          PersonKey: hsS.id, PersonName: hsS.name, Grade: hsS.grade,
          HomeBuilding: GRADE_BUILDING[hsS.grade], Station: deskFor(hsS.grade, rnd),
          Reason: 'Homeschool', GuardianName: parentIn ? hc.typed : '',
          Relationship: parentIn ? hc.relationship : ''
        });
        push(day, 11 * 60 + 55 + hi * 5 + Math.floor(rnd() * 10), 'student_early_out', {
          PersonKey: hsS.id, PersonName: hsS.name, Grade: hsS.grade,
          HomeBuilding: GRADE_BUILDING[hsS.grade], Station: deskFor(hsS.grade, rnd),
          Reason: 'Homeschool', PickupMatch: 'matched', PickupContactID: 'p-' + hsS.id,
          GuardianName: hc.typed, Relationship: hc.relationship,
          FollowUpMode: 'office_alert', FollowUpStatus: 'done'
        });
      });

      /* ---- early dismissals (heaviest on Friday) ---- */
      var ne = 2 + Math.floor(rnd() * 4) + (dow === 5 ? 3 : 0) - quiet;
      for (var d2 = 0; d2 < ne; d2++) {
        var es = next();
        var outM = 10 * 60 + 30 + Math.floor(rnd() * 255);
        if (isToday && outM > 14 * 60 + 45) outM = 13 * 60 + Math.floor(rnd() * 90);
        var ec = contactOf(es, rnd);
        var returning = rnd() < 0.25;
        // The follow-up mode is a SNAPSHOT of the setting in force at event time. This school
        // runs office_alert; one of today's is a page_student row, so the board's PAGE card and
        // its [Paged] button are demoable.
        var mode = (isToday && d2 === 1) ? 'page_student' : 'office_alert';
        var pend = isToday && d2 <= 2;
        var eo = push(day, outM, 'student_early_out', {
          PersonKey: es.id, PersonName: es.name, Grade: es.grade,
          HomeBuilding: GRADE_BUILDING[es.grade], Station: deskFor(es.grade, rnd),
          Reason: DISMISS_REASONS[Math.floor(rnd() * DISMISS_REASONS.length)],
          PickupMatch: 'matched', PickupContactID: 'p-' + es.id,
          GuardianName: ec.typed, Relationship: ec.relationship,
          FollowUpMode: mode, FollowUpStatus: pend ? 'pending' : 'done',
          Notes: returning ? 'returning today' : ''
        });
        if (returning) {
          var backM = outM + 40 + Math.floor(rnd() * 55);
          if (!isToday || backM < 14 * 60 + 50) {
            push(day, backM, 'student_return_in', {
              PersonKey: es.id, PersonName: es.name, Grade: es.grade,
              HomeBuilding: GRADE_BUILDING[es.grade], Station: deskFor(es.grade, rnd),
              Reason: 'returned', GuardianName: ec.typed, Relationship: ec.relationship,
              RelatedEventID: eo.EventID
            });
          }
        }
      }

      /* ---- work-release self sign-outs (grade 7+, on the approved list) ---- */
      if (rnd() < 0.55) {
        var wr = byId[['400101', '400128', '400142', '400146', '400185'][Math.floor(rnd() * 5)]];
        push(day, 12 * 60 + 15 + Math.floor(rnd() * 100), 'student_early_out', {
          PersonKey: wr.id, PersonName: wr.name, Grade: wr.grade,
          HomeBuilding: GRADE_BUILDING[wr.grade], Station: 'hs',
          Reason: 'Work Release', PickupMatch: 'n/a', GuardianName: '(self — Work Release)',
          FollowUpMode: 'record_only', FollowUpStatus: 'n/a'
        });
      }

      /* ---- building-to-building movement (the doPost device API) ---- */
      if (rnd() < 0.35 || isToday) {
        var ms = next();
        var from = GRADE_BUILDING[ms.grade], toB = from === 'High School' ? 'Elementary' : 'High School';
        var mv = push(day, 10 * 60 + 15 + Math.floor(rnd() * 200), 'movement', {
          PersonKey: ms.id, PersonName: ms.name, Grade: ms.grade, HomeBuilding: from,
          FromBuilding: from, ToBuilding: toB, Station: 'mobile', Reason: 'walked with a teacher',
          Source: 'api'
        });
        // Most legs get an 'arrived' close; TODAY leaves one child IN TRANSIT on the board.
        if (!isToday) {
          push(day, 10 * 60 + 25 + Math.floor(rnd() * 200), 'movement', {
            PersonKey: ms.id, PersonName: ms.name, Grade: ms.grade, HomeBuilding: from,
            FromBuilding: from, ToBuilding: toB, Station: 'mobile', Reason: 'arrived',
            RelatedEventID: mv.EventID, Source: 'api'
          });
        }
      }

      /* ---- pickup mismatch flags ----
         A flag is a SAFETY signal, never a sign-out: no student_early_out is written, so presence
         does not change and the early-dismissal count is untouched. Earlier flags were resolved
         by the office; today's is still open. */
      if (flagDays[day]) {
        var fs = next();
        var fc = fs.guardians[0];
        push(day, 13 * 60 + 20 + Math.floor(rnd() * 80), 'pickup_flag', {
          PersonKey: fs.id, PersonName: fs.name, Grade: fs.grade,
          HomeBuilding: GRADE_BUILDING[fs.grade], Station: deskFor(fs.grade, rnd),
          GuardianName: 'Marion ' + fs.last, Relationship: 'Other',
          Reason: 'Family', PickupMatch: 'mismatch',
          FlagStatus: 'resolved',
          FlagNote: 'DENIED by ' + DEMO.staffEmail + ' — phoned ' + fc.first +
                    ', who had not arranged it. Child stayed on campus.',
          FollowUpMode: 'office_alert', FollowUpStatus: 'done'
        });
      }
    });

    /* ---------- TODAY's fixed, hand-written moments ----------
       These are the story the Dismissal Board demo reads out of this same log, plus the two rows
       the pitch is really about. They are appended last, which is also append order — the fold
       is order-insensitive for everything except "latest wins", and these are the latest. */
    var D = DEMO.date;

    // 10:40 — Mateo Quintero out for an appointment with his mother, back at 11:35.
    var mateoOut = push(D, 10 * 60 + 40, 'student_early_out', {
      PersonKey: '400126', PersonName: byId['400126'].name, Grade: '10',
      HomeBuilding: 'High School', Station: 'hs', Reason: 'Medical appointment',
      PickupMatch: 'matched', PickupContactID: 'p-400126',
      GuardianName: 'Rosario Quintero', Relationship: 'Mother',
      FollowUpMode: 'office_alert', FollowUpStatus: 'done', Notes: 'returning today'
    });
    push(D, 11 * 60 + 35, 'student_return_in', {
      PersonKey: '400126', PersonName: byId['400126'].name, Grade: '10',
      HomeBuilding: 'High School', Station: 'hs', Reason: 'returned',
      GuardianName: 'Rosario Quintero', Relationship: 'Mother', RelatedEventID: mateoOut.EventID
    });

    // 13:04 — Juniper Marlowe collected for the day. Still off campus at 2:52pm.
    push(D, 13 * 60 + 4, 'student_early_out', {
      PersonKey: '400115', PersonName: byId['400115'].name, Grade: '4',
      HomeBuilding: 'Elementary', Station: 'el', Reason: 'Family',
      PickupMatch: 'matched', PickupContactID: 'p-400115',
      GuardianName: 'Hesper Marlowe', Relationship: 'Mother',
      FollowUpMode: 'office_alert', FollowUpStatus: 'pending'
    });

    // 14:05 -> 14:10 — THE FLAG THAT BECAME A SIGN-OUT.
    // An uncle nobody had added to Juno Whitfield's authorised list types his own name. Nothing
    // is signed out: a pickup_flag is raised, the desk chimes, and the office phones her mother.
    // Approving the flag is what records the dismissal — as an office OVERRIDE, linked back to
    // the flag, so the audit trail says a human decided it.
    var junoFlag = push(D, 14 * 60 + 5, 'pickup_flag', {
      PersonKey: '400150', PersonName: byId['400150'].name, Grade: '2',
      HomeBuilding: 'Elementary', Station: 'el',
      GuardianName: 'Ray Whitfield', Relationship: 'Other', Reason: 'Family',
      PickupMatch: 'mismatch', FlagStatus: 'resolved',
      FlagNote: 'APPROVED by ' + DEMO.staffEmail + ' — phoned Dana, uncle confirmed; ' +
                'added to the FACTS list afterwards.',
      FollowUpMode: 'office_alert', FollowUpStatus: 'done'
    });
    push(D, 14 * 60 + 10, 'student_early_out', {
      PersonKey: '400150', PersonName: byId['400150'].name, Grade: '2',
      HomeBuilding: 'Elementary', Station: 'office', Reason: 'Family',
      PickupMatch: 'override', GuardianName: 'Ray Whitfield', Relationship: 'Other',
      RelatedEventID: junoFlag.EventID, Source: 'office',
      FollowUpMode: 'record_only', FollowUpStatus: 'n/a',
      Notes: 'override by ' + DEMO.staffEmail + ' — guardian confirmed by phone'
    });

    // 14:22 — TODAY'S OPEN FLAG. 'Marcus Gaskill' shares Wyatt's surname but is on nobody's
    // authorised list, so the typed name matches a last name and no first name. The kiosk says
    // "please see office staff", the sign-out does NOT happen, and this row is what the board's
    // alert card and the red Metrics tile are showing.
    push(D, 14 * 60 + 22, 'pickup_flag', {
      PersonKey: '400140', PersonName: byId['400140'].name, Grade: '3',
      HomeBuilding: 'Elementary', Station: 'el',
      GuardianName: 'Marcus Gaskill', Relationship: 'Other', Reason: 'Family',
      PickupMatch: 'mismatch', FlagStatus: 'open',
      FollowUpMode: 'office_alert', FollowUpStatus: 'pending'
    });

    // Append order in the real sheet IS chronological (rows are appended as they happen), and
    // presence's "latest wins" rules read the log in that order — so sort before serialising.
    // Array.prototype.sort is stable, so same-second rows keep the order they were written in
    // (which is what links a flag to the override that resolved it).
    log.sort(function (a, b) { return a.Timestamp < b.Timestamp ? -1 : a.Timestamp > b.Timestamp ? 1 : 0; });
    return [EVENTS_HEADER.slice()].concat(log.map(function (e) {
      return EVENTS_HEADER.map(function (c) { return e[c] === undefined ? '' : String(e[c]); });
    }));
  }

  var tabs = {
    // FACTS staging (read-only)
    'Sheet1': sheet1Values(),
    'PickupContacts': pickupValues(),
    'Student Schedules': schedulesValues(),
    'Staff': staffValues(),
    // ELC side-car
    'K5-6 Teachers': elcValues(),
    // SignInOut_DB
    'EVENTS': eventsValues(),
    'BADGES': badgeValues(),
    'SETTINGS': settingsValues(),
    'PERMISSIONS': permissionValues(),
    'WORK_RELEASE': workReleaseValues(),
    'STATIONS': stationValues()
  };

  return {
    demo: DEMO,
    tabs: tabs,
    eventsHeader: EVENTS_HEADER.slice(),
    gradeBuilding: GRADE_BUILDING,
    deskGrade: DESK,
    // Convenience views for verify.mjs and the mock (never serialised to a kiosk client).
    students: students,
    enrolledCount: enrolled.length,
    // The stamp the FACTS staging sheet carries; the kiosk footer and the board header show it,
    // because a roster that is four hours stale is a thing the office needs to know.
    factsGeneratedAt: '2026-09-15 11:00:38'
  };
})();
