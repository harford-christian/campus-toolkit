/* data.js — MACS Fine Arts demo dataset. 100% FABRICATED: every school, student, group, judge, title, phone
   number and email below is invented. Nothing here comes from a real registration. (The categories, rooms,
   field templates and settings are the app's own defaults, vendored verbatim in logic.js — competition rules
   are public, people are not.)

   Shape: what the app's own workbook holds (Schools · Judges · Judging Sheets · a few Settings), plus the
   master roster the sign-in gate fetches from the sibling forms project, plus the entries three schools have
   already submitted — fed through the app's REAL submitSchoolEntries_ at boot, so their entry ids and the
   "Other Entry IDs (auto)" cross-references are produced, not typed. */
window.MACS_DATA = (function () {
  'use strict';

  var DEMO = {
    code: '123456',                       // the one-time code every sign-in "emails" in the demo
    adminEmail: 'admin@example.edu',      // who the admin page is signed in as
    year: '2027',
    pitchSchool: 'Riverbend Baptist School'
  };

  // [School Code, School Name, Color Hex] — codes are baked into every entry id (e.g. SFVS1101), as in production.
  var SCHOOLS = [
    ['1000', 'Riverbend Baptist School',        '#e74c3c'],
    ['1100', 'Chesapeake Christian Academy',    '#f1c40f'],
    ['1200', 'Harbor Light Christian School',   '#2ecc71'],
    ['1300', 'Pine Ridge Baptist Academy',      '#3498db'],
    ['1400', 'Meadowbrook Christian School',    '#e67e22'],
    ['1500', 'Oakmont Christian Academy',       '#9b59b6'],
    ['1600', 'Saltmarsh Christian School',      '#1abc9c'],
    ['1700', 'Highland Baptist Academy',        '#34495e']
  ];
  // The sibling forms project's master roster: which schools exist and whether an allowlisted address is on
  // file (`otp`). Oakmont has none, so the gate refuses it honestly ("not set up to submit yet").
  var MASTER = {
    schools: SCHOOLS.map(function (s) { return { name: s[1], otp: s[1] !== 'Oakmont Christian Academy' }; }),
    theme: { accent: '#c8102e', primary: '#2b2b2d', card: '#ffffff' },
    brand: { orgName: 'Maryland Association of Christian Schools' }
  };

  // [Judge Name, Category Code, Notes]
  var JUDGES = [
    ['Dr. Helen Marsh', 'SFVS', 'Vocal — both levels'], ['Dr. Helen Marsh', 'JFVS', ''], ['Dr. Helen Marsh', 'SMVS', ''], ['Dr. Helen Marsh', 'JMVS', ''],
    ['Thomas Abernathy', 'SCP', 'Piano'], ['Thomas Abernathy', 'JCP', ''], ['Thomas Abernathy', 'SSP', ''], ['Thomas Abernathy', 'JSP', ''],
    ['Rev. Daniel Kowalczyk', 'SEP', 'Preaching'], ['Rev. Daniel Kowalczyk', 'JEP', ''], ['Rev. Daniel Kowalczyk', 'SBT', ''],
    ['Priya Venkataraman', 'SDI', 'Speech'], ['Priya Venkataraman', 'JDI', ''], ['Priya Venkataraman', 'SOPO', ''],
    ['Marcus Delacroix-Hale', 'SLVE', 'Ensembles — Sanctuary'], ['Marcus Delacroix-Hale', 'SCG', ''], ['Marcus Delacroix-Hale', 'SYC', '']
  ];
  var JUDGING_SHEETS = [['Bible', '#'], ['Music', '#'], ['Speech', ''], ['Art', '']];
  // Settings rows that differ from the app's defaults (the rest come from DEFAULT_SETTINGS, verbatim).
  var SETTINGS_OVERRIDES = { 'Competition Year': DEMO.year, 'Admin Emails': DEMO.adminEmail, 'Session Epoch': '1' };

  /* ---------- entries three schools already submitted ----------
     Each is exactly what the form sends to submitSchoolEntries: {categoryCode, studentName, title,
     authorComposer, accompanist, conductor, attachment, roster:[{studentName, participatingIn}]}. The same
     student appearing in two entries (a solo and a group roster) is deliberate — that is what the
     "Other Entry IDs (auto)" column exists to catch, and the real write path fills it in. */
  function e(code, name, title, composer, acc, cond, roster) {
    return { categoryCode: code, studentName: name, title: title || '', authorComposer: composer || '', accompanist: acc || '',
      conductor: cond || '', attachment: '', roster: roster || [] };
  }
  var SUBMITTED = [
    { code: '1100', name: 'Chesapeake Christian Academy', contact: { firstName: 'Dana', lastName: 'Whitcombe', phone: '410-555-0171', email: 'dwhitcombe@chesapeake.example.org' },
      entries: [
        e('SFVS', 'Lydia Okonkwo', 'O Divine Redeemer', 'Gounod', 'Mrs. Pearson'),
        e('SCP', 'Lydia Okonkwo', 'Nocturne in E-flat, Op. 9 No. 2', 'Chopin'),
        e('SMVS', 'Caleb Thornbury', 'How Great Thou Art', 'Hine', 'Mrs. Pearson'),
        e('SSVE', 'Chesapeake Chamber Singers', 'Be Thou My Vision', 'arr. Hagenberg', 'Mrs. Pearson', '',
          [{ studentName: 'Lydia Okonkwo', participatingIn: 'Female Vocal Solo, Classical Piano Solo' }, { studentName: 'Caleb Thornbury', participatingIn: 'Male Vocal Solo' },
           { studentName: 'Ruthie Mbeki', participatingIn: '' }, { studentName: 'Jonah Castellanos', participatingIn: '' }]),
        e('SEP', 'Jonah Castellanos', 'The Prodigal Returns'),
        e('SBM', 'Ruthie Mbeki', 'Psalm 139:1-18'),
        e('JDI', 'Amara Feldstein', 'The Hiding Place (excerpt)'),
        e('JBM', 'Tobias Nkemelu', 'Romans 12'),
        e('SAP', 'Isla Varga', 'Charcoal study: the harbor at dusk')
      ] },
    { code: '1200', name: 'Harbor Light Christian School', contact: { firstName: 'Miguel', lastName: 'Santangelo', phone: '443-555-0144', email: 'msantangelo@harborlight.example.org' },
      entries: [
        e('SLVE', 'Harbor Light Concert Choir', 'Total Praise', 'Smallwood', 'Mr. Oyelaran', 'Mrs. Santangelo',
          [{ studentName: 'Naomi Brightwater', participatingIn: '' }, { studentName: 'Ezra Lindgren', participatingIn: '' }, { studentName: 'Hope Adeyemi', participatingIn: '' },
           { studentName: 'Silas Marchetti', participatingIn: '' }, { studentName: 'Tessa Okoro', participatingIn: '' }]),
        e('SBS', 'Ezra Lindgren', 'Trumpet Voluntary', 'Clarke', 'Mr. Oyelaran'),
        e('SWS', 'Hope Adeyemi', 'Gabriel\'s Oboe', 'Morricone', 'Mr. Oyelaran'),
        e('SRR', 'Naomi Brightwater', 'Isaiah 53'),
        e('SOPO', 'Silas Marchetti', 'Why the Hard Road Is Worth It'),
        e('SXSP', 'Tessa Okoro', ''),
        e('JCG', 'Harbor Light Middle School Choir', 'Jubilate Deo', 'Mozart', 'Mr. Oyelaran', 'Mrs. Santangelo',
          [{ studentName: 'Micah Brightwater', participatingIn: '' }, { studentName: 'Ada Lindgren', participatingIn: '' }, { studentName: 'Theo Ramaswamy', participatingIn: '' }]),
        e('JMVS', 'Micah Brightwater', 'It Is Well', 'Bliss', 'Mr. Oyelaran'),
        e('JHI', 'Theo Ramaswamy', 'The Ransom of Red Chief')
      ] },
    { code: '1300', name: 'Pine Ridge Baptist Academy', contact: { firstName: 'Carol', lastName: 'Ferreira', phone: '301-555-0188', email: 'cferreira@pineridge.example.org' },
      entries: [
        e('SD', 'Pine Ridge Debate A', 'Resolved: school uniforms', '', '', '',
          [{ studentName: 'Gideon Albrecht', participatingIn: '' }, { studentName: 'Phoebe Nakashima', participatingIn: '' }]),
        e('SDA', 'Pine Ridge Players', 'The Trial of Peter (one act)', '', '', '',
          [{ studentName: 'Gideon Albrecht', participatingIn: 'Debate' }, { studentName: 'Phoebe Nakashima', participatingIn: 'Debate' }, { studentName: 'Levi Strand', participatingIn: '' }]),
        e('SSP', 'Phoebe Nakashima', 'Great Is Thy Faithfulness', 'arr. Hayes'),
        e('STP', 'Gideon Albrecht', 'Faith That Works'),
        e('JAP', 'Wren Castillo', 'Watercolor: Pine Ridge in snow'),
        e('JAP', 'Benedict Oyelaran', 'Pencil: my grandfather\'s hands')
      ] }
  ];

  /* ---------- the Spelling Bee and Creative Writing projects ----------
     Two more Apps Script projects, one registration form each, each with its own Sheet. They share the member
     schools above. Settings listed here are the rows that differ from each project's own DEFAULT_SETTINGS (the
     mailing address is a row admins add; the real form backfills it blank). The registrations below go through
     each project's REAL submitRegistration at first boot, so their entry ids are produced, not typed. */
  var SAMPLE_PDF = 'sample.pdf';   // a fabricated one-page PDF beside this file: fee forms, judging sheets, uploads
  var MAILING = 'MACS Fine Arts Office (demo), 400 Sample Road, Exampleton, MD 00000';   // fictional
  var SPELLING = {
    settings: { 'Competition Year': '2026', 'Admin Emails': DEMO.adminEmail, 'Payment PDF Link (MACS Schools)': SAMPLE_PDF,
      'Payment PDF Link (Non-MACS Schools)': SAMPLE_PDF, 'Payment Mailing Address': MAILING },
    // { code, name, contact, groups: [{ groupKey, students: [name, ...] }] } — exactly what the form sends.
    submitted: [
      { code: '1100', name: 'Chesapeake Christian Academy',
        contact: { firstName: 'Dana', lastName: 'Whitcombe', phone: '(410) 555-0171', email: 'dwhitcombe@chesapeake.example.org' },
        groups: [{ groupKey: 'G1', students: ['Posy Leverett'] }, { groupKey: 'G2-3', students: ['Abel Quintana', 'Mae Okafor'] },
          { groupKey: 'G4-6', students: ['Corin Ashby', 'Lark Pennington', 'Tobiah Reyes'] }, { groupKey: 'G7-9', students: ['Ivy Marchbanks'] }] },
      { code: '1300', name: 'Pine Ridge Baptist Academy',
        contact: { firstName: 'Carol', lastName: 'Ferreira', phone: '(301) 555-0188', email: 'cferreira@pineridge.example.org' },
        groups: [{ groupKey: 'G4-6', students: ['Hollis Grantham'] }, { groupKey: 'G10-12', students: ['Junia Vasquez-Hart', 'Bram Ellery'] }] }
    ],
    stamps: ['2026-01-14 10:05:00', '2026-01-22 15:32:00']
  };
  var WRITING = {
    settings: { 'Competition Year': '2026', 'Admin Emails': DEMO.adminEmail, 'Payment PDF Link (MACS Schools)': SAMPLE_PDF,
      'Payment PDF Link (Non-MACS Schools)': SAMPLE_PDF, 'Payment Mailing Address': MAILING },
    judgingSheetUrl: SAMPLE_PDF,     // every Level+Category row on the Judging Sheets tab
    // { code, name, contact, levels, entries: [{ levelKey, category, studentFirst, studentLast, title }] } — the PDFs
    // are "uploaded" through the real uploadEntryFile at boot, so each entry carries the two links it returns.
    submitted: [
      { code: '1200', name: 'Harbor Light Christian School',
        contact: { firstName: 'Miguel', lastName: 'Santangelo', phone: '(443) 555-0144', email: 'msantangelo@harborlight.example.org' },
        levels: ['L1B', 'L3'],
        entries: [
          { levelKey: 'L1B', category: 'Poetry', studentFirst: 'Winnie', studentLast: 'Calloway', title: 'The Lighthouse Keeps Watch' },
          { levelKey: 'L1B', category: 'Short Story', studentFirst: 'Oren', studentLast: 'Daskalov', title: 'The Day the Tide Forgot' },
          { levelKey: 'L3', category: 'Essay', studentFirst: 'Selah', studentLast: 'Ibarra', title: 'Why Small Harbors Matter' }
        ] }
    ],
    stamps: ['2025-11-24 13:47:00']
  };

  return { demo: DEMO, schools: SCHOOLS, master: MASTER, judges: JUDGES, judgingSheets: JUDGING_SHEETS,
    settingsOverrides: SETTINGS_OVERRIDES, submitted: SUBMITTED, spelling: SPELLING, writing: WRITING };
})();
