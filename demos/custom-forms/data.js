/* data.js — the Custom Forms demo's FABRICATED world. Every person, family, school and address here is
   invented (@example.edu staff, @example.com families, *.example.org MACS schools). Nothing is copied
   from a real roster.

   mock.js turns this into the two contexts' Drive + _System spreadsheets on a first visit (and after
   "Reset demo"), using the app's own server code to do it: provisionSystemSpreadsheet_() lays out each
   _System, the source repo's own form seeds (Seeds.js, the forms adminReseedForms installs) fill HCS's
   library, and writeResponse_() records the sample submissions — so every sheet has exactly the shape
   production writes. */
window.FORMS_DEMO_DATA = {
  // The signed-in Google account on the two staff apps (Builder, Staff portal). An HCS Forms admin who
  // also teaches and also has a child at the school — so the Builder's admin pages, the approval queue
  // and the portal's "View as: Staff · Parent" bridge all have something to show.
  staffUser: 'm.avery@example.edu',

  // The one-time code every sign-in email carries in this demo. Production derives a fresh random code
  // from an HMAC; mock.js pins the HMAC's output for that one message shape, so the app's own
  // authRequestOtp/authVerifyOtp (rate limits, 5-try lockout, hashing) run unchanged.
  otpCode: '482193',
  // Suggested on the sign-in screens (a demo tip box); any directory guardian email works.
  demoParent: 'sam.whitfield@example.com',
  demoMacsEmail: 'coordinator@northside.example.org',

  // AdminDirectory stand-in: who is staff (and their display name). Anyone else is "not in the domain".
  directoryUsers: {
    'm.avery@example.edu':     { name: 'Morgan Avery',     orgUnitPath: '/Staff/Administration' },
    'p.lindqvist@example.edu': { name: 'Priya Lindqvist',  orgUnitPath: '/Staff/Administration' },
    'r.castillo@example.edu':  { name: 'Rosa Castillo',    orgUnitPath: '/Staff/High School' },
    'd.okafor@example.edu':    { name: 'Daniel Okafor',    orgUnitPath: '/Staff/Athletics' },
    'h.brandt@example.edu':    { name: 'Helen Brandt',     orgUnitPath: '/Staff/Health Office' },
    'g.marsh@example.edu':     { name: 'Gideon Marsh',     orgUnitPath: '/Staff/High School' },
    'l.chen@example.edu':      { name: 'Lydia Chen',       orgUnitPath: '/Staff/Elementary' },
    'it@example.edu':          { name: 'Forms service account', orgUnitPath: '/Service' },
    'ellie.whitfield@example.edu': { name: 'Ellie Whitfield', orgUnitPath: '/Students/HS' }
  },

  hcs: {
    // _System!Config values (keys the app reads; the rest stay as provisionSystemSpreadsheet_ seeds them)
    config: {
      PUBLIC_URL: 'parent.html', RUNNER_STAFF_URL: 'staff.html', BUILDER_URL: 'builder.html', CHOOSER_URL: 'chooser.html',
      SUPPORT_CONTACT: 'office@example.edu or (555) 010-0142',
      DEVELOPER_OVERRIDE: 'false', SCHOOL_YEAR: '2026-2027', DEV_EMAIL: 'forms.dev@example.edu', OPS_EMAIL: 'forms.dev@example.edu',
      FactsExportFileId: '', FactsExportFileName: 'FACTS_Export.xlsx'
    },
    admins: [['m.avery@example.edu', 'Morgan Avery (operations)'], ['p.lindqvist@example.edu', 'Priya Lindqvist (principal)']],
    // FACTS_Directory: StudentId, Last, First, DisplayName, Grade, StudentEmail, Homeroom, HomeroomTeacher,
    //                  GuardianName ("Last First", as the export writes it), GuardianEmail, GuardianSlot
    directory: [
      ['700101', 'Whitfield', 'Ellie', 'Ellie Whitfield', '10', 'ellie.whitfield@example.edu', 'HR-10A', 'Rosa Castillo', 'Whitfield Sam', 'sam.whitfield@example.com', '1'],
      ['700101', 'Whitfield', 'Ellie', 'Ellie Whitfield', '10', 'ellie.whitfield@example.edu', 'HR-10A', 'Rosa Castillo', 'Whitfield Dana', 'dana.whitfield@example.com', '2'],
      ['700102', 'Whitfield', 'Theo', 'Theo Whitfield', '7', '', 'HR-7B', 'Gideon Marsh', 'Whitfield Sam', 'sam.whitfield@example.com', '1'],
      ['700102', 'Whitfield', 'Theo', 'Theo Whitfield', '7', '', 'HR-7B', 'Gideon Marsh', 'Whitfield Dana', 'dana.whitfield@example.com', '2'],
      ['700103', 'Ortiz', 'Lucas', 'Lucas Ortiz', '3', '', 'HR-3A', 'Lydia Chen', 'Ortiz Jamie', 'jamie.ortiz@example.com', '1'],
      ['700104', 'Nakamura', 'Aiko', 'Aiko Nakamura', '11', 'aiko.nakamura@example.edu', 'HR-11A', 'Gideon Marsh', 'Nakamura Chris', 'chris.nakamura@example.com', '1'],
      ['700105', 'Brooks', 'Mason', 'Mason Brooks', '9', 'mason.brooks@example.edu', 'HR-9A', 'Rosa Castillo', 'Brooks Taylor', 'taylor.brooks@example.com', '1'],
      ['700106', 'Avery', 'Quinn', 'Quinn Avery', '4', '', 'HR-4A', 'Lydia Chen', 'Avery Morgan', 'm.avery@example.edu', '1']
    ],
    // FACTS_Classes: StudentId, ClassCode, ClassDescription, Category, Teacher
    classes: [
      ['700101', 'ENG10-1', 'English 10', 'English', 'Rosa Castillo'],
      ['700101', 'BIO-2', 'Biology', 'Science', 'Gideon Marsh'],
      ['700102', 'HIST7-1', 'World Cultures 7', 'History', 'Gideon Marsh'],
      ['700104', 'CHEM-1', 'Chemistry', 'Science', 'Gideon Marsh'],
      ['700105', 'ENG9-2', 'English 9', 'English', 'Rosa Castillo']
    ],
    factsStaff: [['r.castillo@example.edu', 'Rosa Castillo'], ['g.marsh@example.edu', 'Gideon Marsh'], ['l.chen@example.edu', 'Lydia Chen']],
    // Staff tab: Name, Email, Dept, Level, Active — the staffPicker field's options
    staff: [
      ['Mrs. Rosa Castillo', 'r.castillo@example.edu', 'English', 'HS', true],
      ['Mr. Gideon Marsh', 'g.marsh@example.edu', 'Science', 'HS', true],
      ['Mr. Daniel Okafor', 'd.okafor@example.edu', 'Athletics', 'HS', true],
      ['Mrs. Lydia Chen', 'l.chen@example.edu', 'Grade 3', 'EL', true],
      ['Mrs. Helen Brandt', 'h.brandt@example.edu', 'Health Office', 'All', true]
    ],
    approvalGroups: [
      ['Administrators', 'p.lindqvist@example.edu, m.avery@example.edu', 'Final sign-off on trips and at-home learning'],
      ['Health Office', 'h.brandt@example.edu', 'Medication and physicals']
    ],
    // Apps_Registry rows (AppId, Name, Description, Url, IconEmoji, OwnerEmail, Active, LastCheckedAt,
    // LastStatus, LastStatusMsg, Slug, SupportsHandoff, VisibleToParent, VisibleToStaff, VisibleToStudent,
    // PreviewImageUrl, LogoUrl, UseLivePreview, LivePreviewUrl, Notes) — linked tools, pointing at sibling demos.
    apps: [
      ['app-ptc', 'Conference Scheduler', 'Book parent–teacher conference times.', '../conferences/index.html', '📅', 'm.avery@example.edu', true, '', 'ok', '', 'ptc', false, true, true, false, '', '', false, '', ''],
      ['app-dismissal', 'Dismissal Board', 'Who goes home how, today.', '../transportation/index.html', '🚌', 'm.avery@example.edu', true, '', 'ok', '', 'dismissal', false, false, true, false, '', '', false, '', '']
    ],
    // Forms the seeds don't cover. owner, lifecycle, access, isTemplate, templateScope, category, classCode/teacher, closeInDays
    forms: [
      { formId: 'FRM-20260921-4471', owner: 'm.avery@example.edu', lifecycle: 'draft', access: 'open', category: 'Events',
        schema: { title: 'Fall Concert Volunteer Sign-up', description: 'Help us run the Fall Concert — pick a job and a shift.',
          settings: { access: 'open', lifecycle: 'draft', locked: false, confirmationMessage: 'Thank you for volunteering! We will email shift details the week before.', notifyEmails: ['m.avery@example.edu'], onePerEmail: true },
          pages: [{ title: 'Main', fields: [
            { id: 'name', type: 'text', label: 'Your name', required: true },
            { id: 'email', type: 'email', label: 'Email', required: true },
            { id: 'job', type: 'radio', label: 'Which job?', required: true, options: ['Ushers', 'Bake sale table', 'Set-up crew', 'Clean-up crew'], capacity: { 'Ushers': 6, 'Bake sale table': 4, 'Set-up crew': 8, 'Clean-up crew': 8 } },
            { id: 'shirt', type: 'dropdown', label: 'Volunteer T-shirt size', required: false, options: ['S', 'M', 'L', 'XL', 'No shirt, thanks'] }
          ] }] } },
      { formId: 'FRM-20260915-2210', owner: 'r.castillo@example.edu', lifecycle: 'published', access: 'private', category: 'High School',
        classCode: 'ENG10-1', classTeacher: 'Rosa Castillo', closeInDays: 5,
        schema: { title: 'English 10 — Novel Choice Permission', description: 'Our spring novel unit offers three titles. Please choose the one your student will read.',
          settings: { access: 'private', lifecycle: 'published', locked: false, confirmationMessage: 'Thanks — Mrs. Castillo has your choice.', notifyEmails: ['r.castillo@example.edu'], closeDate: '' },
          prefill: { audience: 'parent', identityBlock: true },
          pages: [{ title: 'Main', fields: [
            { id: 'pFirst', type: 'text', label: 'First name', required: true, prefillFrom: 'parentFirst' },
            { id: 'pLast', type: 'text', label: 'Last name', required: true, prefillFrom: 'parentLast' },
            { id: 'pEmail', type: 'email', label: 'Email', required: true, prefillFrom: 'parentEmail' },
            { id: 'student', type: 'studentPicker', label: 'Student', required: true },
            { id: 'novel', type: 'radio', label: 'Novel', required: true, options: ['The Hiding Place', 'Cry, the Beloved Country', 'Les Misérables (abridged)'] },
            { id: 'ok', type: 'yesno', label: 'I have previewed the title and give permission.', required: true }
          ] }] } },
      { formId: 'FRM-20260902-0815', owner: 'p.lindqvist@example.edu', lifecycle: 'published', access: 'open', isTemplate: true, templateScope: 'shared', category: 'Surveys',
        schema: { title: 'Club Interest Survey', description: 'A starter survey any teacher can copy for a new club.',
          settings: { access: 'open', lifecycle: 'published', locked: false, confirmationMessage: 'Thanks for your interest!', notifyEmails: [] },
          pages: [{ title: 'Main', fields: [
            { id: 'name', type: 'text', label: 'Student name', required: true },
            { id: 'grade', type: 'dropdown', label: 'Grade', required: true, options: ['6', '7', '8', '9', '10', '11', '12'] },
            { id: 'days', type: 'checkboxes', label: 'Which days could you meet?', required: false, options: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
            { id: 'why', type: 'textarea', label: 'Why are you interested?', required: false }
          ] }] } },
      { formId: 'FRM-20260929-6630', owner: 'd.okafor@example.edu', lifecycle: 'published', access: 'open', isTemplate: true, templateScope: 'pending', category: 'Athletics',
        schema: { title: 'Team Travel Roster', description: 'Coaches list who is travelling to an away game.',
          settings: { access: 'staff', lifecycle: 'published', locked: false, confirmationMessage: 'Roster received.', notifyEmails: ['d.okafor@example.edu'] },
          pages: [{ title: 'Main', fields: [
            { id: 'team', type: 'dropdown', label: 'Team', required: true, options: ['Varsity Soccer', 'JV Soccer', 'Varsity Volleyball', 'Cross Country'] },
            { id: 'date', type: 'date', label: 'Game date', required: true },
            { id: 'riders', type: 'textarea', label: 'Athletes travelling', required: true }
          ] }] } }
    ],
    // Sample submissions, recorded through the app's writeResponse_ (values exactly as the runner stores them)
    submissions: [
      { formId: 'FRM-ATHOME-LEARNING', daysAgo: 1, email: 'sam.whitfield@example.com', via: 'otp',
        values: { pFirst: 'Sam', pLast: 'Whitfield', pEmail: 'sam.whitfield@example.com', students: ['Theo Whitfield'], reason: 'Illness / medical',
          startDate: '2026-10-12', returnDate: '2026-10-23', plan: 'Theo will follow the weekly packets from his teachers and join math by video on Tuesdays and Thursdays.',
          coordination: 'Work emailed each Friday; Dana Whitfield is the contact.', sign: 'Sam Whitfield (typed)' } },
      { formId: 'FRM-FIELD-TRIP', daysAgo: 2, email: 'r.castillo@example.edu', via: 'sso',
        values: { tripName: 'English 10 — Shakespeare matinee', destination: 'Riverside Playhouse', date: '2026-11-06', grades: ['10'], count: '42',
          overnight: 'No', transport: 'Charter bus', cost: '18', notes: 'Bagged lunches from the cafeteria; back by 2:45.' } },
      { formId: 'FRM-SAMPLE-0001', daysAgo: 6, email: 'jamie.ortiz@example.com', via: 'open',
        values: { firstName: 'Jamie', lastName: 'Ortiz', email: 'jamie.ortiz@example.com', phone: '(555) 010-0177', grade: '3', interest: 'Very', topics: ['Academics', 'Arts'], consent: 'Yes', comments: 'Interested in the spring art show.' } },
      { formId: 'FRM-SAMPLE-0001', daysAgo: 4, email: 'pat.lee@example.com', via: 'open',
        values: { firstName: 'Pat', lastName: 'Lee', email: 'pat.lee@example.com', phone: '', grade: 'K5', interest: 'Somewhat', topics: ['Spiritual life'], consent: 'No', comments: '' } },
      { formId: 'FRM-SAMPLE-0001', daysAgo: 2, email: 'river.santos@example.com', via: 'open',
        values: { firstName: 'River', lastName: 'Santos', email: 'river.santos@example.com', phone: '(555) 010-0190', grade: '9', interest: 'Very', topics: ['Athletics', 'Academics'], consent: 'Yes', comments: 'Cross country?' } },
      { formId: 'FRM-HS-CONFERENCE', daysAgo: 3, email: 'chris.nakamura@example.com', via: 'otp',
        values: { pFirst: 'Chris', pLast: 'Nakamura', pEmail: 'chris.nakamura@example.com', student: 'Aiko Nakamura', grade: '11',
          teachers: ['Mr. Gideon Marsh'], time1: 'Tue — 3:20–3:40 PM', time2: 'Thu — 3:20–3:40 PM', time3: '', info: '' } },
      { formId: 'FRM-HS-CONFERENCE', daysAgo: 1, email: 'taylor.brooks@example.com', via: 'otp',
        values: { pFirst: 'Taylor', pLast: 'Brooks', pEmail: 'taylor.brooks@example.com', student: 'Mason Brooks', grade: '9',
          teachers: ['Mrs. Rosa Castillo', 'Mr. Daniel Okafor'], time1: 'Tue — 3:20–3:40 PM', time2: 'Tue — 4:00–4:20 PM', time3: '', info: 'Mason has practice at 4:30.' } },
      { formId: 'FRM-20260915-2210', daysAgo: 2, email: 'taylor.brooks@example.com', via: 'otp',
        values: { pFirst: 'Taylor', pLast: 'Brooks', pEmail: 'taylor.brooks@example.com', student: 'Mason Brooks', novel: 'The Hiding Place', ok: 'Yes' } }
    ],
    closeInDays: { 'FRM-PARENT-DEMO': 4 }
  },

  macs: {
    config: {
      BRAND_NAME: 'MACS Forms', ORG_NAME: 'Maryland Association of Christian Schools',
      THEME_JSON: '{"primary":"#1f2933","primaryHover":"#111827","accent":"#c0392b","accentSoft":"#f6e3e1"}',
      DEVELOPER_OVERRIDE: 'false', PUBLIC_URL: 'macs.html', SUPPORT_CONTACT: 'events@macs.example.org'
    },
    admins: [['m.avery@example.edu', 'Morgan Avery']],
    // MACS_Schools: SchoolName, Entry, Notes — a school with an Entry asks for an emailed code before
    // "remember last year's answers" will fill; a school with none stays fully open.
    schools: [
      ['Northside Christian Academy', '@northside.example.org', 'any Northside address'],
      ['Cedar Hill Christian School', 'office@cedarhill.example.org', ''],
      ['Riverbend Christian School', '', 'open — no verification']
    ],
    forms: [
      { formId: 'FRM-MACS-SPELLING', owner: 'm.avery@example.edu', lifecycle: 'published', access: 'open', category: 'Academic events',
        schema: { title: 'Spelling Bee Registration', description: 'Register your school\'s spellers for the MACS Spelling Bee. Coordinator details are remembered from last year once your school email is verified.',
          settings: { access: 'open', lifecycle: 'published', locked: false, confirmationMessage: 'Registered — see you at the Bee!', notifyEmails: ['m.avery@example.edu'] },
          pages: [{ title: 'Main', fields: [
            { id: 'school', type: 'dropdown', label: 'School', required: true, prefillFrom: 'schoolPicker', options: ['Northside Christian Academy', 'Cedar Hill Christian School', 'Riverbend Christian School'] },
            { id: 'coordName', type: 'text', label: 'Coordinator name', required: true, priorYear: true },
            { id: 'coordEmail', type: 'email', label: 'Coordinator email', required: true, priorYear: true },
            { id: 'coordPhone', type: 'phone', label: 'Coordinator phone', required: false, priorYear: true },
            { id: 'spellers', type: 'number', label: 'Number of spellers', required: true, validation: { min: 1, max: 6 } },
            { id: 'division', type: 'checkboxes', label: 'Divisions', required: true, options: ['Grades 4–5', 'Grades 6–8'] }
          ] }] } },
      { formId: 'FRM-MACS-FINEARTS', owner: 'm.avery@example.edu', lifecycle: 'published', access: 'open', category: 'Fine arts',
        schema: { title: 'Fine Arts Festival — Judge Volunteer', description: 'Offer to judge at the spring Fine Arts Festival.',
          settings: { access: 'open', lifecycle: 'published', locked: false, confirmationMessage: 'Thank you — the festival team will be in touch.', notifyEmails: ['m.avery@example.edu'] },
          pages: [{ title: 'Main', fields: [
            { id: 'school', type: 'dropdown', label: 'School', required: true, prefillFrom: 'schoolPicker', options: ['Northside Christian Academy', 'Cedar Hill Christian School', 'Riverbend Christian School'] },
            { id: 'judge', type: 'text', label: 'Judge name', required: true },
            { id: 'areas', type: 'checkboxes', label: 'Areas', required: true, options: ['Piano', 'Voice', 'Strings', 'Visual art', 'Speech'] }
          ] }] } }
    ],
    submissions: [
      { formId: 'FRM-MACS-SPELLING', daysAgo: 330, email: 'coordinator@northside.example.org', via: 'open',
        values: { school: 'Northside Christian Academy', coordName: 'Reese Hollander', coordEmail: 'coordinator@northside.example.org', coordPhone: '(555) 010-0233', spellers: '4', division: ['Grades 4–5', 'Grades 6–8'] } }
    ]
  }
};
