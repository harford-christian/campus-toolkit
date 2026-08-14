/* data.js — fabricated, realistic sample data for the Staff Onboarding demo.
   No real staff: names are invented; the domain/brand are the client's (HCS).
   Doc HTML below stands in for the Google Docs the content owner edits in production. */
(function () {
  'use strict';

  function docHtml(title, bodyHtml) {
    return '<!DOCTYPE html><html><head><base target="_blank"><style>' +
      'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#000;max-width:100%;margin:0;padding:.25em .1em;line-height:1.5}' +
      'h1{font-size:15pt;color:#6b1f2a;margin:.2em 0 .5em}h2{font-size:12pt;color:#6b1f2a;margin:1em 0 .3em}' +
      'ol,ul{margin:.4em 0 .8em 1.5em;padding:0}li{margin:.25em 0}' +
      'a{color:#1155cc}td,th{border:1px solid #ccc;padding:.3em .6em;font-size:10pt}table{border-collapse:collapse;margin:.5em 0}' +
      '.tip{background:#fdf3dc;border-left:4px solid #c8a24a;padding:.5em .8em;margin:.7em 0}' +
      '</style></head><body><h1>' + title + '</h1>' + bodyHtml + '</body></html>';
  }

  window.DEMO_DATA = {

    roles: [
      { key: 'FULLTIME_STAFF',       label: 'Fulltime Staff' },
      { key: 'FULLTIME_TEACHER',     label: 'Fulltime Teacher' },
      { key: 'SUB_PARTTIME_TEACHER', label: 'Sub / Part-time Teacher' },
      { key: 'COACH',                label: 'Coach' },
      { key: 'SUPPORT_STAFF',        label: 'Part-time / Support Staff (bus drivers, aides, …)' }
    ],

    ui: {
      title: 'Welcome to Harford Christian School',
      roleQuestion: 'What is your role at HCS?',
      intro: 'Pick the option that best describes you — the setup steps below change based on your ' +
             'answer. You can switch anytime (some people have more than one role).',
      everyoneHeading: 'For everyone'
    },

    everyoneHtml: docHtml('Everyone — first-week checklist',
      '<ol>' +
      '<li><b>Read the Staff Handbook</b> — <a href="#">current Staff Handbook (Google Doc)</a>. ' +
      'HR will ask you to acknowledge it by Friday of your first week.</li>' +
      '<li><b>Set up your school email signature</b> — name, role, and the school phone number.</li>' +
      '<li><b>Campus Wi-Fi</b> — join <i>HCS-Staff</i> with your school Google account.</li>' +
      '<li><b>Emergency procedures</b> — your supervisor will walk you through the crisis flipchart ' +
      'for your building.</li>' +
      '</ol>' +
      '<div class="tip">Questions? Reply to the onboarding email — a real person reads it.</div>'),

    docs: {
      FULLTIME_STAFF: docHtml('Fulltime Staff — setup steps',
        '<h2>FACTS access</h2><ol>' +
        '<li>Go to <a href="#">factsmgt.com</a> → <b>Log in → FACTS SIS</b>.</li>' +
        '<li>District code: <b>HF-MD</b>. Click <b>Create Account</b> and use your school email.</li>' +
        '<li>Once approved you\'ll see the Staff portal — timesheets live under <b>My Info</b>.</li>' +
        '</ol>' +
        '<h2>Payroll &amp; HR</h2><ol>' +
        '<li>Complete your I-9 and W-4 with the front office (bring ID on day one).</li>' +
        '<li>Direct-deposit form is in the HR packet — return it by your first Friday.</li></ol>'),

      FULLTIME_TEACHER: docHtml('Fulltime Teacher — setup steps',
        '<h2>FACTS access (gradebook &amp; attendance)</h2><ol>' +
        '<li>Go to <a href="#">factsmgt.com</a> → <b>Log in → FACTS SIS</b>, district code <b>HF-MD</b>.</li>' +
        '<li>Create your account with your school email; the registrar links your class rosters.</li>' +
        '<li>Attendance is due by <b>8:20 AM</b> each morning — it feeds the front-office dashboard.</li>' +
        '</ol>' +
        '<h2>Classroom tech</h2><ol>' +
        '<li>Your Google Classroom courses are pre-created — check <a href="#">classroom.google.com</a>.</li>' +
        '<li>Projector/Chromebook cart requests go through the IT help desk.</li></ol>'),

      SUB_PARTTIME_TEACHER: docHtml('Sub / Part-time Teacher — setup steps',
        '<ol>' +
        '<li>Your school Google account is your key to everything — sign in on any school device.</li>' +
        '<li>Sub plans live in the shared <b>Sub Binder</b> Drive folder — bookmark it.</li>' +
        '<li>Sign in/out at the front office each day you work (it drives your pay).</li>' +
        '<li>You do <b>not</b> need a FACTS account — attendance is handled by the office for your room.</li>' +
        '</ol>'),

      COACH: docHtml('Coach — setup steps',
        '<h2>Talon Hub (athletics)</h2><ol>' +
        '<li>Open <a href="#">Talon Hub</a> and sign in with your school Google account.</li>' +
        '<li>Your team roster, schedule, and transportation requests all live there.</li>' +
        '<li>Submit game-day logistics by <b>Wednesday noon</b> for the coming week.</li>' +
        '</ol>' +
        '<h2>Clearances</h2><ol>' +
        '<li>Concussion training + background check must be on file with the AD before first practice.</li></ol>'),

      SUPPORT_STAFF: docHtml('Part-time / Support Staff — setup steps',
        '<ol>' +
        '<li>Your school Google account gives you email and the staff directory — that\'s all you need.</li>' +
        '<li>Timesheets are paper for part-time roles — pick yours up at the front office.</li>' +
        '<li>Bus drivers: route sheets and radios are issued by the Transportation coordinator.</li>' +
        '</ol>'),

      /* Doc for a role the demo visitor might add in the admin panel */
      _NEW_ROLE: docHtml('New role — setup steps',
        '<p>This Doc was just created for the new role. In production the content owner ' +
        'opens it in Google Docs and writes the instructions — the page updates immediately.</p>')
    },

    // Active /Staff & Teachers accounts as the admin roster sees them.
    // onboarded: '' = would be treated as a new hire until marked.
    roster: [
      { email: 'aharrington@harfordchristian.org', name: 'Amelia Harrington', ou: '/Staff & Teachers/Teachers/HS', created: '2019-08-02', onboarded: 'pre-existing 2026-08-14' },
      { email: 'bcrowley@harfordchristian.org',    name: 'Ben Crowley',       ou: '/Staff & Teachers/Staff/Elementary', created: '2017-07-21', onboarded: 'pre-existing 2026-08-14' },
      { email: 'cvasquez@harfordchristian.org',    name: 'Carmen Vasquez',    ou: '/Staff & Teachers/Teachers/Elementary', created: '2021-08-05', onboarded: '' },
      { email: 'dfairbanks@harfordchristian.org',  name: 'Dana Fairbanks',    ou: '/Staff & Teachers/Coaches', created: '2022-06-30', onboarded: '' },
      { email: 'ekowalski@harfordchristian.org',   name: 'Ethan Kowalski',    ou: '/Staff & Teachers/Subs, Aids & Part Time Employees', created: '2023-01-12', onboarded: '' },
      { email: 'fmontgomery@harfordchristian.org', name: 'Faith Montgomery',  ou: '/Staff & Teachers/Staff/HS', created: '2018-07-19', onboarded: '' },
      { email: 'gokafor@harfordchristian.org',     name: 'Grace Okafor',      ou: '/Staff & Teachers/Teachers/K', created: '2020-08-03', onboarded: '' },
      { email: 'hlindqvist@harfordchristian.org',  name: 'Henrik Lindqvist',  ou: '/Staff & Teachers/Staff/Transportation', created: '2016-08-15', onboarded: '' },
      { email: 'imarchetti@harfordchristian.org',  name: 'Isabella Marchetti',ou: '/Staff & Teachers/Teachers/HS', created: '2024-07-29', onboarded: '' },
      { email: 'jwhitaker@harfordchristian.org',   name: 'Jonah Whitaker',    ou: '/Staff & Teachers/Coaches', created: '2024-08-01', onboarded: '' },
      { email: 'kpemberton@harfordchristian.org',  name: 'Kate Pemberton',    ou: '/Staff & Teachers/Staff/Music', created: '2015-06-24', onboarded: '' },
      { email: 'lsandhu@harfordchristian.org',     name: 'Lena Sandhu',       ou: '/Staff & Teachers/Subs, Aids & Part Time Employees', created: '2025-01-08', onboarded: '' },
      { email: 'mdelgado@harfordchristian.org',    name: 'Marcus Delgado',    ou: '/Staff & Teachers/Teachers/Elementary', created: '2025-08-04', onboarded: '' },
      { email: 'rnewhire@harfordchristian.org',    name: 'Riley Newhire',     ou: '/Staff & Teachers/Teachers/HS', created: '2026-08-12', onboarded: '' }
    ]
  };
})();
