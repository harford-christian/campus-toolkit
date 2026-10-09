/* data.js — the ELC Assessments demo's fabricated school. Every person, id and score here is invented.

   A K–6 elementary of 40 students (ids 5001xx), the staff allow-list, the three staff-maintained reference
   tabs the real app reads by header name, and the history mock.js replays at boot.

   Nothing here is a stored result: `seedSessions` are the INPUTS a staff member would type into the
   New Assessment form (the same payload shape Index.html's collectAndSubmit builds), and mock.js feeds each
   one through the app's own submitSession() — so every tier, composite, summary and result row the demo
   shows was scored by the real benchmark tables. CORE Phonics items are written compactly as "items read
   correctly per part" and expanded to the per-item true/false lists the form sends (first n correct).

   The clock is pinned to Tuesday 13 October 2026 (school year 2026-2027, Fall window). History runs over
   the prior year's Fall / Winter / Spring windows and this Fall; no date sits on the first of a month. */
window.ELC_DATA = {
  now: [2026, 10, 13, 10, 20],

  personas: {
    elc:      { email: 'rashby@example.edu',       name: 'Renee Ashby',        label: 'ELC Staff' },
    elc2:     { email: 'mcastellanos@example.edu', name: 'Miriam Castellanos', label: 'ELC Staff' },
    admin:    { email: 'dwhitcomb@example.edu',    name: 'Dana Whitcomb',      label: 'Administrator' },
    teacher:  { email: 'lpryce@example.edu',       name: 'Lauren Pryce',       label: '2nd-grade teacher' },
    teacher4: { email: 'glindqvist@example.edu',   name: 'Gregory Lindqvist',  label: '4th-grade teacher' }
  },

  // Staff_Access, in schema order: email, added_date, notes, access_role, scope_grades
  staffAccess: [
    ['dwhitcomb@example.edu',    '2025-08-12', 'Principal',              'Administrator',       ''],
    ['rashby@example.edu',       '2025-08-12', 'ELC coordinator',        'ELC Staff',           ''],
    ['mcastellanos@example.edu', '2025-08-19', 'ELC reading specialist', 'ELC Staff',           ''],
    ['lpryce@example.edu',       '2025-08-26', '2nd grade homeroom',     'Grade-Level Teacher', '2'],
    ['glindqvist@example.edu',   '2025-08-26', '4th grade homeroom',     'Grade-Level Teacher', '4']
  ],

  // [student_id, first, last, grade, on the ELC caseload?, service areas if so (L)anguage (R)eading (M)ath (P)honics (S)pelling]
  students: [
    ['500101', 'Hazel', 'Brightwater', 'K', false],
    ['500102', 'Milo', 'Quintero', 'K', true, 'RP'],
    ['500103', 'Juniper', 'Ashdown', 'K', false],
    ['500104', 'Theo', 'Varga', 'K', true, 'L'],
    ['500105', 'Poppy', 'Delacroix', 'K', false],
    ['500106', 'Felix', 'Ormsby', '1', true, 'RPS'],
    ['500107', 'Iris', 'Kettering', '1', false],
    ['500108', 'Jasper', 'Noorani', '1', true, 'R'],
    ['500109', 'Mabel', 'Strand', '1', false],
    ['500110', 'Otis', 'Pembrook', '1', true, 'P'],
    ['500111', 'Lena', 'Achterberg', '1', false],
    ['500112', 'Rowan', 'Calloway', '2', true, 'RPS'],
    ['500113', 'Nell', 'Garroway', '2', false],
    ['500114', 'Ezra', 'Whitlock', '2', true, 'L'],
    ['500115', 'Clara', 'Holloway', '2', true, 'R'],
    ['500116', 'Desmond', 'Faure', '2', false],
    ['500117', 'Ivy', 'Tremaine', '2', false],
    ['500118', 'Wren', 'Marchetti', '3', true, 'R'],
    ['500119', 'Silas', 'Ingram', '3', true, 'RS'],
    ['500120', 'Maren', 'Kowal', '3', false],
    ['500121', 'Beckett', 'Sorensen', '3', true, 'RM'],
    ['500122', 'Lucia', 'Brandt', '3', false],
    ['500123', 'Arlo', 'Fenn', '3', true, 'R'],
    ['500124', 'Brody', 'Fenwick', '4', true, 'RM'],
    ['500125', 'Greta', 'Albright', '4', false],
    ['500126', 'Rafael', 'Dunmore', '4', true, 'L'],
    ['500127', 'Sadie', 'Merriweather', '4', false],
    ['500128', 'Callum', 'Reyes', '4', true, 'M'],
    ['500129', 'Noa', 'Prescott', '4', false],
    ['500130', 'Jonah', 'Ellery', '5', true, 'R'],
    ['500131', 'Maisie', 'Thorne', '5', true, 'RS'],
    ['500132', 'Tobias', 'Okonkwo', '5', false],
    ['500133', 'Della', 'Hargrove', '5', true, 'MR'],
    ['500134', 'Quinn', 'Abernathy', '5', false],
    ['500135', 'Pearl', 'Vasquez', '5', true, 'R'],
    ['500136', 'Tessa', 'Langford', '6', true, 'L'],
    ['500137', 'Hugo', 'Brennan', '6', true, 'R'],
    ['500138', 'Elsie', 'Morrow', '6', false],
    ['500139', 'Caleb', 'Adair', '6', true, 'RS'],
    ['500140', 'Vera', 'Lindholm', '6', false]
  ],
  // Enrolled in FACTS (the K5-6 Students tab) but not yet in this tool: what "+ Add Student" finds.
  notYetAdded: [
    ['500141', 'Amos', 'Kerrigan', 'K'], ['500142', 'Bea', 'Saltonstall', '1'], ['500143', 'Cyrus', 'Vandermeer', '2'],
    ['500144', 'Dorothea', 'Pike', '3'], ['500145', 'Emmett', 'Rosewood', '4'], ['500146', 'Flora', 'Ashcombe', '5'],
    ['500147', 'Gideon', 'Marsh', '6'], ['500148', 'Harriet', 'Quill', '2']
  ],

  // K5-6 Teachers reference tab: Grade, Teacher, Homeroom, Email
  teachers: [
    ['K5', 'Abigail Rourke', 'Room 101', 'arourke@example.edu'],
    ['1', 'Marcus Bellweather', 'Room 103', 'mbellweather@example.edu'],
    ['2', 'Lauren Pryce', 'Room 105', 'lpryce@example.edu'],
    ['3', 'Simone Archer', 'Room 107', 'sarcher@example.edu'],
    ['4', 'Gregory Lindqvist', 'Room 202', 'glindqvist@example.edu'],
    ['5', 'Daniel Okafor', 'Room 204', 'dokafor@example.edu'],
    ['6', 'Ruth Calder', 'Room 206', 'rcalder@example.edu']
  ],

  // Assessment_Requests rows (the concern queue). All three still open; requested_by is the asking teacher.
  requests: [
    { request_id: 'req-demo-0001', student_id: '500112', assessment_type: '', concern_areas: 'Reading, Phonics',
      requested_by: 'lpryce@example.edu', requested_at: [2026, 10, 6, 13, 40], status: 'pending',
      note: 'Still guessing at words from the first letter in guided reading. Cannot blend CVC words without help and avoids read-aloud time.' },
    { request_id: 'req-demo-0002', student_id: '500127', assessment_type: '', concern_areas: 'Math',
      requested_by: 'glindqvist@example.edu', requested_at: [2026, 9, 29, 15, 10], status: 'pending',
      note: 'Computation is fine, but loses track of the steps in two-step word problems. Worth a math benchmark?' },
    { request_id: 'req-demo-0003', student_id: '500138', assessment_type: 'easycbm', concern_areas: 'Reading, Spelling',
      requested_by: 'rcalder@example.edu', requested_at: [2026, 10, 9, 8, 5], status: 'pending',
      note: 'Reads slowly and is not finishing the novel chapters; weekly spelling scores have dropped since last year.' }
  ],

  // The history, oldest first. by: which ELC persona entered it; role: who administered it.
  // grade is grade_at_admin: the grade the student was in THAT school year.
  seedSessions: [
    // ---- 2025-2026 (last year) ----
    { id: '500112', type: 'dibels', date: '2025-09-17', year: '2025-2026', grade: '1', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 16], ['PSF', 25], ['NWF_CLS', 27], ['NWF_WRC', 3], ['WRF', 10], ['ORF_WORDS', 7]], orfErrors: 1 } },
    { id: '500114', type: 'dibels', date: '2025-09-17', year: '2025-2026', grade: '1', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 37], ['PSF', 39], ['NWF_CLS', 38], ['NWF_WRC', 10], ['WRF', 16], ['ORF_WORDS', 22]], orfErrors: 1 } },
    { id: '500118', type: 'dibels', date: '2025-09-18', year: '2025-2026', grade: '2', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 20], ['NWF_WRC', 5], ['WRF', 9], ['ORF_WORDS', 14]], orfErrors: 3, mazeCorrect: 2, mazeIncorrect: 2 } },
    { id: '500119', type: 'dibels', date: '2025-09-18', year: '2025-2026', grade: '2', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 45], ['NWF_WRC', 12], ['WRF', 22], ['ORF_WORDS', 39]], orfErrors: 3, mazeCorrect: 5, mazeIncorrect: 2 } },
    { id: '500130', type: 'easycbm', date: '2025-09-24', year: '2025-2026', grade: '4', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 77], ['PROFICIENT_READING', 8], ['VOCABULARY', 13], ['BASIC_READING', 17]] } },
    { id: '500118', type: 'dibels', date: '2026-01-21', year: '2025-2026', grade: '2', season: 'Winter', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 61], ['NWF_WRC', 17], ['WRF', 29], ['ORF_WORDS', 68]], orfErrors: 6, mazeCorrect: 9, mazeIncorrect: 2 } },
    { id: '500112', type: 'dibels', date: '2026-01-22', year: '2025-2026', grade: '1', season: 'Winter', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 25], ['PSF', 17], ['NWF_CLS', 20], ['NWF_WRC', 5], ['WRF', 7], ['ORF_WORDS', 5]], orfErrors: 1 } },
    { id: '500115', type: 'dibels', date: '2026-01-22', year: '2025-2026', grade: '1', season: 'Winter', by: 'elc', role: 'Grade-Level Teacher',
      input: { entries: [['LNF', 25], ['PSF', 38], ['NWF_CLS', 46], ['NWF_WRC', 12], ['WRF', 15], ['ORF_WORDS', 15]], orfErrors: 1 } },
    { id: '500136', type: 'easycbm', date: '2026-01-27', year: '2025-2026', grade: '5', season: 'Winter', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 156], ['PROFICIENT_READING', 17], ['VOCABULARY', 18], ['BASIC_READING', 23]] } },
    { id: '500124', type: 'easycbm', date: '2026-04-21', year: '2025-2026', grade: '3', season: 'Spring', by: 'elc', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 65], ['PROFICIENT_READING', 9], ['VOCABULARY', 14], ['BASIC_READING', 19]] } },
    { id: '500128', type: 'easycbm_math', date: '2026-04-21', year: '2025-2026', grade: '3', season: 'Spring', by: 'elc', role: 'ELC Staff',
      input: { entries: [['BASIC_MATH_BENCHMARK', 33], ['PROFICIENT_MATH_BENCHMARK', 28]] } },
    { id: '500112', type: 'core_phonics', date: '2026-04-28', year: '2025-2026', grade: '1', season: 'Spring', by: 'elc2', role: 'ELC Staff',
      notes: 'Knows letter names; short vowels and blends are the gap.',
      input: { correct: { A: 26, B: 26, C: 19, D_long: 3, D_short: 2, E: 8, F: 6, G: 5, H: 3, I: 2, J: 2, K: 1, L: 4 } } },
    { id: '500135', type: 'dra', date: '2026-04-29', year: '2025-2026', grade: '4', season: 'Spring', by: 'elc2', role: 'ELC Staff',
      input: { grl: 'Q', wcpm: 95 } },
    { id: '500130', type: 'easycbm', date: '2026-05-12', year: '2025-2026', grade: '4', season: 'Spring', by: 'elc', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 148], ['PROFICIENT_READING', 15], ['VOCABULARY', 18], ['BASIC_READING', 23]] } },
    { id: '500106', type: 'dibels', date: '2026-05-13', year: '2025-2026', grade: 'K', season: 'Spring', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 17], ['PSF', 18], ['NWF_CLS', 12], ['NWF_WRC', 2], ['WRF', 3]] } },
    { id: '500108', type: 'dibels', date: '2026-05-13', year: '2025-2026', grade: 'K', season: 'Spring', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 38], ['PSF', 48], ['NWF_CLS', 40], ['NWF_WRC', 10], ['WRF', 14]] } },
    { id: '500112', type: 'dibels', date: '2026-05-14', year: '2025-2026', grade: '1', season: 'Spring', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 26], ['PSF', 18], ['NWF_CLS', 22], ['NWF_WRC', 5], ['WRF', 8], ['ORF_WORDS', 13]], orfErrors: 2 } },
    { id: '500114', type: 'dibels', date: '2026-05-14', year: '2025-2026', grade: '1', season: 'Spring', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 65], ['PSF', 67], ['NWF_CLS', 93], ['NWF_WRC', 34], ['WRF', 56], ['ORF_WORDS', 82]], orfErrors: 1 } },
    { id: '500115', type: 'dibels', date: '2026-05-14', year: '2025-2026', grade: '1', season: 'Spring', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 26], ['PSF', 41], ['NWF_CLS', 50], ['NWF_WRC', 13], ['WRF', 21], ['ORF_WORDS', 32]], orfErrors: 3 } },
    { id: '500118', type: 'dibels', date: '2026-05-19', year: '2025-2026', grade: '2', season: 'Spring', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 96], ['NWF_WRC', 30], ['WRF', 56], ['ORF_WORDS', 111]], orfErrors: 3, mazeCorrect: 15, mazeIncorrect: 2 } },
    { id: '500119', type: 'dibels', date: '2026-05-19', year: '2025-2026', grade: '2', season: 'Spring', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 65], ['NWF_WRC', 19], ['WRF', 35], ['ORF_WORDS', 85]], orfErrors: 7, mazeCorrect: 9, mazeIncorrect: 2 } },

    // ---- 2026-2027 (this year, Fall window) ----
    { id: '500102', type: 'dibels', date: '2026-09-15', year: '2026-2027', grade: 'K', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 8], ['PSF', 0], ['NWF_CLS', 2], ['NWF_WRC', 0], ['WRF', 0]] } },
    { id: '500104', type: 'dibels', date: '2026-09-15', year: '2026-2027', grade: 'K', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 20], ['PSF', 10], ['NWF_CLS', 14], ['NWF_WRC', 7], ['WRF', 7]] } },
    { id: '500106', type: 'dibels', date: '2026-09-16', year: '2026-2027', grade: '1', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 16], ['PSF', 9], ['NWF_CLS', 12], ['NWF_WRC', 0], ['WRF', 4], ['ORF_WORDS', 2]], orfErrors: 1 } },
    { id: '500108', type: 'dibels', date: '2026-09-16', year: '2026-2027', grade: '1', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['LNF', 37], ['PSF', 39], ['NWF_CLS', 38], ['NWF_WRC', 10], ['WRF', 16], ['ORF_WORDS', 22]], orfErrors: 1 } },
    { id: '500110', type: 'core_phonics', date: '2026-09-17', year: '2026-2027', grade: '1', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { correct: { A: 26, B: 26, C: 21, D_long: 5, D_short: 5, E: 11 } } },
    { id: '500114', type: 'dibels', date: '2026-09-22', year: '2026-2027', grade: '2', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 92], ['NWF_WRC', 31], ['WRF', 56], ['ORF_WORDS', 91]], orfErrors: 1, mazeCorrect: 18, mazeIncorrect: 2 } },
    { id: '500115', type: 'dibels', date: '2026-09-22', year: '2026-2027', grade: '2', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 45], ['NWF_WRC', 12], ['WRF', 22], ['ORF_WORDS', 39]], orfErrors: 3, mazeCorrect: 5, mazeIncorrect: 2 } },
    { id: '500118', type: 'dibels', date: '2026-09-23', year: '2026-2027', grade: '3', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 98], ['NWF_WRC', 29], ['WRF', 50], ['ORF_WORDS', 89]], orfErrors: 3, mazeCorrect: 12, mazeIncorrect: 2 } },
    { id: '500119', type: 'dibels', date: '2026-09-23', year: '2026-2027', grade: '3', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      notes: 'Fatigued by the second passage; retest ORF in two weeks.',
      input: { entries: [['NWF_CLS', 26], ['NWF_WRC', 9], ['WRF', 15], ['ORF_WORDS', 27]], orfErrors: 5, mazeCorrect: 3, mazeIncorrect: 2 } },
    { id: '500121', type: 'dibels', date: '2026-09-24', year: '2026-2027', grade: '3', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['NWF_CLS', 64], ['NWF_WRC', 21], ['WRF', 35], ['ORF_WORDS', 64]], orfErrors: 6, mazeCorrect: 7, mazeIncorrect: 2 } },
    { id: '500123', type: 'dra', date: '2026-09-24', year: '2026-2027', grade: '3', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { grl: 'L', wcpm: 62 } },
    { id: '500124', type: 'easycbm', date: '2026-09-29', year: '2026-2027', grade: '4', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 38], ['PROFICIENT_READING', 4], ['VOCABULARY', 6], ['BASIC_READING', 9]] } },
    { id: '500126', type: 'easycbm', date: '2026-09-29', year: '2026-2027', grade: '4', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 116], ['PROFICIENT_READING', 13], ['VOCABULARY', 17], ['BASIC_READING', 22]] } },
    { id: '500128', type: 'easycbm_math', date: '2026-09-30', year: '2026-2027', grade: '4', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['BASIC_MATH_BENCHMARK', 26], ['PROFICIENT_MATH_BENCHMARK', 20]] } },
    { id: '500130', type: 'easycbm', date: '2026-09-30', year: '2026-2027', grade: '5', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 107], ['PROFICIENT_READING', 11], ['VOCABULARY', 14], ['BASIC_READING', 16]] } },
    { id: '500131', type: 'easycbm', date: '2026-10-06', year: '2026-2027', grade: '5', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 68], ['PROFICIENT_READING', 5], ['VOCABULARY', 7], ['BASIC_READING', 10]] } },
    { id: '500133', type: 'easycbm_math', date: '2026-10-06', year: '2026-2027', grade: '5', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { entries: [['BASIC_MATH_BENCHMARK', 18], ['PROFICIENT_MATH_BENCHMARK', 13]] } },
    { id: '500136', type: 'easycbm', date: '2026-10-07', year: '2026-2027', grade: '6', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 152], ['PROFICIENT_READING', 15], ['VOCABULARY', 18], ['BASIC_READING', 22]] } },
    { id: '500137', type: 'easycbm', date: '2026-10-07', year: '2026-2027', grade: '6', season: 'Fall', by: 'elc', role: 'ELC Staff',
      input: { entries: [['PASSAGE_READING_FLUENCY', 108], ['PROFICIENT_READING', 12], ['VOCABULARY', 15], ['BASIC_READING', 17]] } },
    { id: '500139', type: 'lexile', date: '2026-10-08', year: '2026-2027', grade: '6', season: 'Fall', by: 'elc2', role: 'ELC Staff',
      input: { lexileScore: '760L', wcpm: 110 } }
  ],

  // Iep_Goals rows (header-keyed; mock.js writes them in schema order).
  iepGoals: [
    { goal_id: 'goal-demo-01', student_id: '500112', school_year: '2026-2027', area: 'Decoding/Phonics',
      goal_text: 'Given a list of 20 CVC and CCVC words, Rowan will decode them accurately with 90% accuracy on three consecutive probes.',
      baseline: '8 of 20 CVC words read correctly (CORE Phonics Part E, Spring 2026).', target_criterion: '18 of 20 words, 3 consecutive probes',
      entered_date: '2026-09-09', status: 'Active', created_by: 'rashby@example.edu', created_at: [2026, 9, 9, 14, 0] },
    { goal_id: 'goal-demo-02', student_id: '500119', school_year: '2026-2027', area: 'Fluency',
      goal_text: 'Given a grade-level passage, Silas will read 70 words correct per minute with 95% accuracy by the spring benchmark.',
      baseline: '27 wcpm, 84% accuracy (DIBELS ORF, Fall 2026).', target_criterion: '70 wcpm at 95% accuracy',
      entered_date: '2026-09-30', status: 'Active', created_by: 'mcastellanos@example.edu', created_at: [2026, 9, 30, 10, 15] },
    { goal_id: 'goal-demo-03', student_id: '500124', school_year: '2026-2027', area: 'Comprehension',
      goal_text: 'After reading a short informational text, Brody will answer four of five literal and inferential questions correctly.',
      baseline: '2 of 5 questions correct on classroom probes.', target_criterion: '4 of 5, on four of five probes',
      entered_date: '2026-10-02', status: 'Active', created_by: 'rashby@example.edu', created_at: [2026, 10, 2, 9, 30] },
    { goal_id: 'goal-demo-04', student_id: '500106', school_year: '2025-2026', area: 'Decoding/Phonics',
      goal_text: 'Felix will produce the sound for all 21 consonants and 5 short vowels when shown the letter.',
      baseline: '12 of 26 letter sounds.', target_criterion: '26 of 26',
      entered_date: '2026-02-10', status: 'Met', completed_date: '2026-05-20', outcome_note: 'All 26 sounds on the May probe.',
      created_by: 'rashby@example.edu', created_at: [2026, 2, 10, 13, 0] }
  ],

  // Accommodations_Modifications: [student_id, type, category, item, responsible_party], one per checked item.
  accommodations: [
    ['500112', 'Accommodation', 'Presentation / Instruction', 'Visual supports/visual directions', 'Classroom Teacher'],
    ['500112', 'Accommodation', 'Reading / Writing', 'Read-aloud of directions', 'Shared / Either'],
    ['500112', 'Accommodation', 'Testing / Assessment', 'Small-group testing', 'ELC'],
    ['500124', 'Accommodation', 'Time / Pacing', 'Extended time on tests/quizzes', 'Shared / Either'],
    ['500124', 'Accommodation', 'Reading / Writing', 'Highlight or mark text', 'Classroom Teacher'],
    ['500133', 'Accommodation', 'Math', 'Multiplication/addition chart/Number Line', 'Classroom Teacher'],
    ['500133', 'Accommodation', 'Time / Pacing', 'Frequent breaks (if needed)', 'Shared / Either'],
    ['500133', 'Accommodation', 'Testing / Assessment', 'Separate/quiet testing location', 'ELC']
  ],

  // Section_504_Plans: one fabricated plan.
  section504: [
    { student_id: '500133', diagnosis: 'Attention-deficit/hyperactivity disorder, combined presentation (fabricated demo record).',
      medications: 'None taken during school hours.', service_areas: 'Math,Reading', date_plan_implemented: '2025-11-12',
      last_updated_by: 'rashby@example.edu', last_updated_at: [2026, 8, 27, 11, 0] }
  ]
};
