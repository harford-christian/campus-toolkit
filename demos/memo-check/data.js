/* data.js — the Memo Check demo's fabricated world. Nothing here is a real person, memo, door or schedule.

   - three emails to the staff list, as Gmail would hand them over (the weekly memo, next week's memo, and a
     correction sent as a reply in that thread);
   - what the model returned for each — the structured findings, shaped exactly as the production JSON schema
     (Analyze.js MC_FINDINGS_SCHEMA) requires. The model call is the one canned step: mock.js answers the real
     mcAnalyze_'s HTTPS request with these, and everything after that is the app's own code;
   - the school's plan as Campus Control publishes it (the CMS Schedule tab and two calendars), the people
     allowed to decide, the venue rules, and an invented door inventory;
   - the history the demo replays at boot, at the times it happened: two hourly ticks that read the memos, a
     schedule editor's decisions on the first one, the Eagle Eye clicks that applied them, and the check that
     marked them applied. */
window.MEMO_DATA = (function () {
  'use strict';

  var PRINCIPAL = 'Margaret Ellison <principal@example.edu>';
  var DISTRO = 'staff@example.edu';

  // ---------------------------------------------------------------------------------------- the email
  var messages = [
    {
      id: '18f2a7c40d3e9b11', threadId: 't-18f2a7c40d3e9b11', from: PRINCIPAL, to: DISTRO, cc: '',
      subject: 'Weekly Memo - Week of 10/25/2026', date: '2026-10-23T15:42:00',
      body: [
        'Good afternoon, team,',
        '',
        'Here is the week ahead. Week of 10/25/2026.',
        '',
        'MONDAY 10/26',
        '  *   Picture retakes in the HS library during 2nd and 3rd period.',
        '',
        'WEDNESDAY 10/28',
        '  *   HS chapel will be on WEDNESDAY this week. Thursday is the 9th-grade field trip, so Thursday is a regular class day for everyone else in the high school.',
        '  *   Grades 1-6 chapel as usual.',
        '',
        'THURSDAY 10/29',
        '  *   Fall Choral Concert, 7:00 PM in the elementary gym. Choir members arrive by 6:15.',
        '',
        'FRIDAY 10/30',
        '  *   3-hour early dismissal for parent-teacher conferences. Buses leave at 12:10.',
        '  *   Dress down for $2 (proceeds go to the 8th-grade trip).',
        '',
        'Have a great weekend,',
        'Margaret'
      ].join('\n')
    },
    {
      id: '18f4c1e92b7a5d22', threadId: 't-18f4c1e92b7a5d22', from: PRINCIPAL, to: DISTRO, cc: '',
      subject: 'Weekly Memo - Week of 11/1/2026', date: '2026-10-30T15:55:00',
      body: [
        'Hi everyone,',
        '',
        'Week of 11/1/2026 - a busy one.',
        '',
        'TUESDAY 11/3',
        '  *   Election Day. The Rec Center lot is a polling place; please park in the upper lot.',
        '',
        'WEDNESDAY 11/4',
        '  *   HS chapel is WEDNESDAY this week because of PSAT make-ups in the HS gym on Thursday morning.',
        '  *   Faculty meeting at 3:15 in the HS library.',
        '',
        'THURSDAY 11/5',
        '  *   Grades 1-6 chapel moves to Thursday this week.',
        '  *   A church family is hosting a funeral luncheon in the kindergarten lower level, 11:30 AM to 1:30 PM. Please keep the hallway quiet.',
        '  *   Booster Club meeting Thursday evening in the HS library.',
        '',
        'FRIDAY 11/6',
        '  *   Teacher in-service - no students. Breakfast in the staff lounge at 8:00.',
        '',
        'Thanks for all you do,',
        'Margaret'
      ].join('\n')
    },
    {
      id: '18f53b0a7c9e4f33', threadId: 't-18f4c1e92b7a5d22', from: PRINCIPAL, to: DISTRO, cc: '',
      subject: 'Re: Weekly Memo - Week of 11/1/2026', date: '2026-11-01T19:20:00',
      body: [
        'One correction: the teacher in-service is MONDAY 11/9, not Friday. Friday 11/6 is a normal school day with students.',
        'Everything else stands.',
        '',
        'Margaret',
        '',
        'On Fri, Oct 30, 2026 at 3:55 PM Margaret Ellison <principal@example.edu> wrote:',
        '> Hi everyone,',
        '> Week of 11/1/2026 - a busy one.',
        '> FRIDAY 11/6',
        '>   *   Teacher in-service - no students.'
      ].join('\n')
    }
  ];

  // ------------------------------------------------------- what the model returned, per message (canned)
  function f(date, category, quote, interpretation, planNow, gap, action, params, steps, confidence, endDate) {
    return { date: date, end_date: endDate || date, category: category, quote: quote, interpretation: interpretation,
      plan_now: planNow, gap: gap, action: action, action_params: JSON.stringify(params || {}),
      eagle_eye_steps: steps, confidence: confidence };
  }
  var model = {
    '18f2a7c40d3e9b11': {
      usage: { input_tokens: 6120, cache_read_input_tokens: 2480, output_tokens: 1388 },
      summary: 'HS chapel moves to Wednesday 10/28, so Wednesday and Thursday swap bell grids; Thursday evening\'s choral concert in the elementary gym needs a door window; Friday 10/30 is a 3-hour early release. Picture retakes and the dress-down day do not touch Campus Control.',
      findings: [
        f('2026-10-28', 'chapel_moved', 'HS chapel will be on WEDNESDAY this week',
          'HS chapel is normally Thursday; on another weekday that day runs the Thursday bell grid (norm 1).',
          '2026-10-28 Wed | door=Normal | church=Open | bell=Normal', true, 'bells_ring_as', { ringAs: 'Thu' },
          'Status tab → click Wed Oct 28 → Adjust this day → Bells ring as: Thursday bell schedule → reason → Save', 0.92),
        f('2026-10-29', 'chapel_moved', 'Thursday is a regular class day for everyone else in the high school',
          'With chapel moved to Wednesday, Thursday has no HS chapel, so it runs the Mon/Tue/Wed/Fri grid (norm 1).',
          '2026-10-29 Thu | door=Normal | church=Open | bell=Normal', true, 'bells_ring_as', { ringAs: 'Wed' },
          'Status tab → click Thu Oct 29 → Adjust this day → Bells ring as: Mon/Tue/Wed/Fri bell schedule → reason → Save', 0.84),
        f('2026-10-29', 'evening_event', 'Fall Choral Concert, 7:00 PM in the elementary gym',
          'An evening event in the elementary gym: the venue rule opens the EL Gym Lobby 30 minutes before and keeps it open 30 minutes after. The memo gives no end time, so 8:30 PM is assumed; confirm it.',
          'No Staff Events entry on 2026-10-29 carries door tags; 2026-10-29 Thu | door=Normal', true, 'door_unlock',
          { start: '18:30', end: '21:00', doors: ['EL Gym Lobby'], buildings: ['EL'] },
          'Schedule Event → Thu Oct 29 → "Fall Choral Concert" → Doors: EL → Unlock Start 18:30 → Unlock End 21:00 → Save', 0.78),
        f('2026-10-30', 'early_dismissal', '3-hour early dismissal for parent-teacher conferences',
          'A 3-hour early dismissal (norm 5).', '2026-10-30 Fri | door=Normal | church=Open | bell=Normal', true,
          'early_release', { hours: 3 }, 'Status tab → click Fri Oct 30 → Adjust this day → Doors: 3HR Release → reason → Save', 0.95),
        f('2026-10-30', 'early_dismissal', 'Buses leave at 12:10',
          'The bus time may call for a PA dismissal announcement just before 12:10. Release days usually announce from the release bell grid, so this may not be needed.',
          'No Staff Events entry on 2026-10-30 has a dismissal tag', true, 'pa_dismissal', { time: '12:05' },
          'Schedule Event → Fri Oct 30 → Staff Events → description "dismissal 12:05" → Save', 0.52)
      ]
    },
    '18f4c1e92b7a5d22': {
      usage: { input_tokens: 6390, cache_read_input_tokens: 2480, output_tokens: 1702 },
      summary: 'HS chapel moves to Wednesday 11/4 (PSAT make-ups Thursday), so Wednesday and Thursday swap grids; a daytime funeral luncheon in the kindergarten lower level needs those doors; the Booster Club meets Thursday evening with no time given; Friday 11/6 is an in-service day with no students.',
      findings: [
        f('2026-11-03', 'other', 'Election Day. The Rec Center lot is a polling place',
          'Parking only; no bells, doors or PA are affected.', '2026-11-03 Tue | door=Normal | church=Open | bell=Normal', false,
          'none', {}, 'none', 0.9),
        f('2026-11-04', 'chapel_moved', 'HS chapel is WEDNESDAY this week',
          'HS chapel off its usual Thursday: Wednesday runs the Thursday bell grid (norm 1).',
          '2026-11-04 Wed | door=Normal | church=Open | bell=Normal', true, 'bells_ring_as', { ringAs: 'Thu' },
          'Status tab → click Wed Nov 4 → Adjust this day → Bells ring as: Thursday bell schedule → reason → Save', 0.9),
        f('2026-11-05', 'chapel_moved', 'PSAT make-ups in the HS gym on Thursday morning',
          'Chapel moved off Thursday, so Thursday runs the Mon/Tue/Wed/Fri grid (norm 1).',
          '2026-11-05 Thu | door=Normal | church=Open | bell=Normal', true, 'bells_ring_as', { ringAs: 'Wed' },
          'Status tab → click Thu Nov 5 → Adjust this day → Bells ring as: Mon/Tue/Wed/Fri bell schedule → reason → Save', 0.82),
        f('2026-11-05', 'chapel_moved', 'Grades 1-6 chapel moves to Thursday this week',
          'Elementary bells are not automated (norm 2): information only.', '2026-11-05 Thu | bell=Normal', false,
          'none', {}, 'none', 0.88),
        f('2026-11-05', 'daytime_movement', 'a funeral luncheon in the kindergarten lower level, 11:30 AM to 1:30 PM',
          'Guests arrive during the school day at a door that is normally locked. The kindergarten lower-level venue rule opens KG Lower Level and KG Main Entrance 30 minutes either side: 11:00 to 2:00.',
          'No Staff Events entry on 2026-11-05 carries door tags; 2026-11-05 Thu | door=Normal', true, 'door_unlock',
          { start: '11:00', end: '14:00', doors: ['KG Lower Level', 'KG Main Entrance'], buildings: ['KG'] },
          'Schedule Event → Thu Nov 5 → "Funeral luncheon" → Doors: KG → Unlock Start 11:00 → Unlock End 14:00 → Save', 0.86),
        f('2026-11-05', 'evening_event', 'Booster Club meeting Thursday evening in the HS library',
          'An evening meeting with no clock time. A 6:00 to 9:00 PM window is proposed from the HS library rule, but the time must be confirmed before anything is set up.',
          'No Staff Events entry on 2026-11-05 evening', true, 'door_unlock',
          { start: '18:00', end: '21:00', doors: ['HS Library'], buildings: ['HS'] },
          'Schedule Event → Thu Nov 5 → "Booster Club" → Doors: HS → Unlock Start 18:00 → Unlock End 21:00 → Save', 0.42),
        f('2026-11-06', 'in_service', 'Teacher in-service - no students',
          'In-service day: no students, so no bells (norm 3). Doors stay on the Normal staff schedule.',
          '2026-11-06 Fri | door=Normal | church=Open | bell=Normal', true, 'no_bells', {},
          'Schedule Event → Staff Events, all-day Fri Nov 6 → Bell Schedule: NO_Bells → Create', 0.9)
      ]
    },
    '18f53b0a7c9e4f33': {
      usage: { input_tokens: 6870, cache_read_input_tokens: 2480, output_tokens: 846 },
      summary: 'A correction to the 11/1 memo: the in-service moves from Friday 11/6 to Monday 11/9, and Friday is a normal school day. The rest of the memo stands.',
      findings: [
        f('2026-11-04', 'chapel_moved', 'Everything else stands.',
          'The original memo\'s Wednesday HS chapel still applies: Wednesday runs the Thursday bell grid (norm 1).',
          '2026-11-04 Wed | door=Normal | church=Open | bell=Normal', true, 'bells_ring_as', { ringAs: 'Thu' },
          'Status tab → click Wed Nov 4 → Adjust this day → Bells ring as: Thursday bell schedule → reason → Save', 0.86),
        f('2026-11-06', 'in_service', 'Friday 11/6 is a normal school day with students',
          'This corrects the earlier memo: there is no in-service on Friday, so the earlier no-bells proposal for 11/6 should be denied.',
          '2026-11-06 Fri | door=Normal | church=Open | bell=Normal', false, 'none', {}, 'none', 0.9),
        f('2026-11-09', 'in_service', 'the teacher in-service is MONDAY 11/9',
          'The in-service moved to Monday: no students, so no bells (norm 3).',
          '2026-11-09 Mon | door=Normal | church=Open | bell=Normal', true, 'no_bells', {},
          'Schedule Event → Staff Events, all-day Mon Nov 9 → Bell Schedule: NO_Bells → Create', 0.9)
      ]
    }
  };

  // ----------------------------------------------------------------------------- Campus Control's plan
  // The CMS Schedule tab, read by position (A Date · B DayType · C Source · D Reason · E SetBy · F SetAt · G Church · H Bell).
  // A school day publishes door Normal / bell Normal (the bell system itself picks the Thursday grid on a Thursday).
  var closed = { '2026-11-25': 'Thanksgiving Break', '2026-11-26': 'Thanksgiving Break', '2026-11-27': 'Thanksgiving Break' };
  function scheduleRows() {
    var rows = [['Date', 'DayType', 'Source', 'Reason', 'SetBy', 'SetAt', 'ChurchStatus', 'BellSchedule']];
    var d = new Date(2026, 9, 19, 12, 0, 0);
    for (var i = 0; i < 49; i++, d.setDate(d.getDate() + 1)) {
      var iso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
      var dow = d.getDay(), weekend = dow === 0 || dow === 6;
      if (closed[iso]) rows.push([iso, 'Weekend_Holiday', 'Calendar', closed[iso], 'publish', '2026-10-01 05:00', 'Open', 'NO_Bells']);
      else rows.push([iso, weekend ? 'Weekend_Holiday' : 'Normal', 'Default', '', 'publish', '2026-10-01 05:00',
                      dow === 0 ? 'Services' : 'Open', weekend ? 'NO_Bells' : 'Normal']);
    }
    return rows;
  }
  var calendars = {
    'staff-events-demo': [
      { title: 'Faculty meeting', start: '2026-11-04T15:15', end: '2026-11-04T16:15', allDay: false, description: '' },
      { title: 'Thanksgiving Break - School and Offices Closed', start: '2026-11-25', end: '2026-11-28', allDay: true, description: 'Door Schedule: Weekend_Holiday\nBell Schedule: NO_Bells' }
    ],
    'school-events-demo': [
      { title: 'Picture retakes', start: '2026-10-26', end: '2026-10-27', allDay: true, description: '' },
      { title: 'Parent-teacher conferences', start: '2026-10-30', end: '2026-10-31', allDay: true, description: '' },
      { title: 'PSAT make-up', start: '2026-11-05T08:00', end: '2026-11-05T11:00', allDay: false, description: '' }
    ]
  };

  // Who may decide: the CMS Permissions tab's ScheduleOverrides flag (read-only lookup by the real mcCanDecide_).
  var permissions = [
    ['Email', 'Name', 'ScheduleOverrides', 'ManageAccess'],
    ['demo.staff@example.edu', 'Jordan Rivera (you)', 'TRUE', 'FALSE'],
    ['dprentiss@example.edu', 'Dale Prentiss, facilities', 'TRUE', 'FALSE'],
    ['teacher@example.edu', 'A classroom teacher', 'FALSE', 'FALSE']
  ];

  // The invented door inventory (groups = what Eagle Eye unlocks) and the venue rules the model reads.
  var doors = {
    KG: ['KG Main Entrance', 'KG Lower Level'],
    EL: ['EL Main Entrance', 'EL Gym Lobby', 'EL Courtyard'],
    HS: ['HS Main Entrance', 'HS Gym Lobby', 'HS Library']
  };
  var rulesSeed = [
    ['venue', 'kindergarten lower level, KG lower level, KG basement', 'KG Lower Level, KG Main Entrance', 30, 30,
     'Luncheons and receptions downstairs in the kindergarten building use both lower-level doors.', 'TRUE'],
    ['venue', 'elementary gym, EL gym', 'EL Gym Lobby', 30, 30, 'Concerts and assemblies in the elementary gym.', 'TRUE'],
    ['venue', 'hs library, high school library', 'HS Library', 30, 30, 'Evening meetings in the HS library.', 'TRUE'],
    ['norm', '', '', '', '', 'If an event names a place with a venue rule above, propose exactly those doors with that lead/lag. If the place has no rule, say so and propose buildings only.', 'TRUE'],
    ['norm', '', '', '', '', 'When only "evening" is given with no clock time, propose a window but mark confidence below 0.5 and say the time must be confirmed.', 'TRUE'],
    ['ignore', 'dress down, picture retakes, car line, mailbox', '', '', '', 'Never produce findings for these.', 'TRUE']
  ];

  // --------------------------------------------------------------------- the history the demo replays
  // A decision names its finding by message and position (the real ids are the message id's last 8 + '-' + n).
  var timeline = [
    { at: '2026-10-23T16:05:00', tick: true },
    { at: '2026-10-26T07:32:00', as: 'dprentiss@example.edu', decide: [
      { msg: '18f2a7c40d3e9b11', n: 1, decision: 'approve' },
      { msg: '18f2a7c40d3e9b11', n: 2, decision: 'approve' },
      { msg: '18f2a7c40d3e9b11', n: 3, decision: 'approve', note: 'Choir arrives at 6:15, so the doors open at 6:00.',
        params: { title: 'Fall Choral Concert', location: 'Elementary gym', eventStart: '19:00', eventEnd: '20:30', start: '18:00', end: '21:00', doors: ['EL'] } },
      { msg: '18f2a7c40d3e9b11', n: 4, decision: 'approve' },
      { msg: '18f2a7c40d3e9b11', n: 5, decision: 'deny', note: 'Release days already announce dismissal from the 3HR release grid; no extra PA.' }
    ] },
    { at: '2026-10-26T08:10:00', clicks: true },
    { at: '2026-10-26T09:05:00', tick: true },
    { at: '2026-10-30T16:05:00', tick: true },
    { at: '2026-11-01T20:05:00', tick: true }
  ];

  return {
    demo: { now: '2026-11-02T07:45:00', user: 'demo.staff@example.edu', distro: DISTRO },
    messages: messages, model: model, scheduleRows: scheduleRows, calendars: calendars, permissions: permissions,
    doors: doors, rulesSeed: rulesSeed, timeline: timeline
  };
})();
