/* data.js — fabricated data for the Talon Hub · Staff demo. All athletes,
   guardians, opponents, coach emails, and metrics are invented. Guardian emails
   use @example.com; the HCS / @harfordchristian.org brand is kept for staff/coach
   identity only. No real spreadsheet, calendar, portal, or file IDs appear here.
   Event dates are stored as day offsets (inDays) and resolved to yyyy-MM-dd in
   mock.js relative to "today" so they stay upcoming. Athlete missingForms are
   DERIVED from compliance in mock.js — the compliance flags are the source of truth.

   The real Staff app funnels every server call through one dispatcher
   api(fn,args) -> google.script.run.api(fn,args); mock.js reproduces that
   dispatcher and switches on fn. Shapes mirror the live server endpoints
   (getStaffBundle / getTeamRoster / getEventBoard / getPlayerProfile / practices /
   drills / announcements / tryouts / lost&found / stats / lineup / groups / staff). */
(function () {
  'use strict';

  // Roster athlete factory. comp = [PhysicalOnFile, ConcussionFormOnFile, HandbookSigned].
  function athlete(id, first, last, grade, jersey, pos, guardianCount, primaryGuardian, comp, profile) {
    return {
      athleteId: id, first: first, last: last, grade: grade, jersey: jersey, position: pos,
      status: 'Enrolled', guardianCount: guardianCount, primaryGuardian: primaryGuardian, photo: '',
      compliance: { PhysicalOnFile: comp[0], ConcussionFormOnFile: comp[1], HandbookSigned: comp[2] },
      profile: Object.assign({
        AthleteID: id, PreferredName: '', SpiritWearSize: '', AthleteCellPhone: '', NotesToCoach: '',
        ShoeSize: '', JerseySize: '', ShortsSize: '', WarmupSize: '', BackpackNumber: '',
        EquipmentNotes: '', GearIssued: ''
      }, profile || {})
    };
  }

  window.STAFF_DATA = {
    // ---- identity / bundle scalars ----
    role: 'Coach',                       // Coach experience (home/schedule/roster/practices/gameday…)
    owner: false,
    email: 'demo.coach@harfordchristian.org',
    isGuardian: false,
    season: 'F26',
    neverLoggedIn: 3,
    // Program-wide module toggles (union across the coach's teams).
    features: { tryouts: true, practices: true, gameLive: true, scoreboard: true, travel: true },
    // Coach defaults (CoachPrefs.resolve shape).
    prefs: {
      WarmupMin: 10, CooldownMin: 5, WaterBreakMin: 3, WaterBreakEveryMin: 0, DefaultLengthMin: 90,
      PerDrillMin: 0, AutoAdvance: true, ToneOn: true, DefaultTeamID: 'BSOC-V-F26', ScrimHalfMin: 25,
      ScrimHalfCount: 2, ScrimSquadSize: 7, GameDayChecklist: 'Uniforms\nWater / coolers\nFirst-aid kit\nGame balls\nLineup card\nRoster / scorebook',
      LandingTab: '', TabOrderJson: '', HiddenTabsJson: '', Density: 'comfortable'
    },

    teams: [
      {
        TeamID: 'BSOC-V-F26', Sport: 'BSOC', Level: 'V', Gender: 'Boys', Season: 'F26', CalendarId: '',
        CoachEmails: 'aturner@harfordchristian.org, jbekele@harfordchristian.org',
        Active: true, label: 'Boys Varsity Soccer', Phase: 'InSeason', GradeMin: 9, GradeMax: 12,
        mine: true, phase: 'InSeason', phaseLabel: 'In season', future: false,
        features: { tryouts: true, practices: true, gameLive: true, scoreboard: true, travel: true },
        overrides: {}, wizardComplete: true, sportName: 'Soccer'
      },
      {
        TeamID: 'GSOC-V-F26', Sport: 'GSOC', Level: 'V', Gender: 'Girls', Season: 'F26', CalendarId: '',
        CoachEmails: 'mdelgado@harfordchristian.org, sroberts@harfordchristian.org',
        Active: true, label: 'Girls Varsity Soccer', Phase: 'InSeason', GradeMin: 9, GradeMax: 12,
        mine: true, phase: 'InSeason', phaseLabel: 'In season', future: false,
        features: { tryouts: true, practices: true, gameLive: true, scoreboard: true, travel: true },
        overrides: {}, wizardComplete: true, sportName: 'Soccer'
      }
    ],

    // Athletes flagged as being on more than one team (dept-dashboard clash warning).
    multiSport: [
      { athleteId: 'B04', name: 'Owen Sinclair', teams: ['Boys Varsity Soccer', 'Boys Varsity Cross Country'] }
    ],

    // Staff roster (AD console / staff mgr). Coach view doesn't surface this, but
    // listStaff stays shape-correct for the demo.
    staff: [
      { email: 'aturner@harfordchristian.org', role: 'Coach', teams: [{ teamId: 'BSOC-V-F26', label: 'Boys Varsity Soccer', season: 'F26' }] },
      { email: 'mdelgado@harfordchristian.org', role: 'Coach', teams: [{ teamId: 'GSOC-V-F26', label: 'Girls Varsity Soccer', season: 'F26' }] },
      { email: 'athletics@harfordchristian.org', role: 'AD', teams: [] }
    ],

    // Registration form links (Ops → getFormLinks).
    formLinks: { physical: '', concussion: '', handbook: '' },

    rosters: {
      'BSOC-V-F26': [
        athlete('B01', 'Aiden', 'Brooks', 12, '9', 'F', 2, 'Renee Brooks', [true, true, true],
          { PreferredName: 'AJ', ShoeSize: '10.5', SpiritWearSize: 'L', AthleteCellPhone: '(410) 555-0142', NotesToCoach: 'Prefers left wing.', JerseySize: 'L' }),
        athlete('B02', 'Marcus', 'Reyes', 11, '4', 'D', 2, 'Elena Reyes', [true, true, true]),
        athlete('B03', 'Caleb', 'Nolan', 12, '1', 'GK', 1, 'Paul Nolan', [false, true, true]),
        athlete('B04', 'Owen', 'Sinclair', 10, '7', 'M', 2, 'Dana Sinclair', [true, true, true]),
        athlete('B05', 'Diego', 'Alvarez', 11, '10', 'M', 2, 'Carmen Alvarez', [true, true, true]),
        athlete('B06', 'Jonah', 'Whitfield', 9, '14', 'D', 1, 'Greg Whitfield', [true, false, false]),
        athlete('B07', 'Ethan', 'Park', 12, '8', 'M', 2, 'Susan Park', [true, true, true]),
        athlete('B08', 'Liam', 'Fitzgerald', 10, '11', 'F', 2, 'Mary Fitzgerald', [true, true, false]),
        athlete('B09', 'Noah', 'Bergstrom', 11, '3', 'D', 1, 'Erik Bergstrom', [true, true, true]),
        athlete('B10', 'Samuel', 'Okafor', 12, '6', 'M', 2, 'Grace Okafor', [true, true, true]),
        athlete('B11', 'Tyler', 'Hoffman', 9, '16', 'F', 0, '', [false, false, false]),
        athlete('B12', 'Gabriel', 'Santos', 10, '5', 'D', 2, 'Ana Santos', [true, true, true]),
        athlete('B13', 'Elias', 'Whitmore', 11, '2', 'D', 1, 'Karen Whitmore', [true, true, true]),
        athlete('B14', 'Colton', 'Reed', 12, '12', 'M', 2, 'Brian Reed', [false, true, true]),
        athlete('B15', 'Isaiah', 'Mensah', 9, '17', 'GK', 1, 'Abena Mensah', [true, true, true])
      ],
      'GSOC-V-F26': [
        athlete('G01', 'Ava', 'Sanderson', 12, '10', 'F', 2, 'Nicole Sanderson', [true, true, true],
          { PreferredName: 'Avie', ShoeSize: '8', SpiritWearSize: 'M', NotesToCoach: 'Captain.', JerseySize: 'M' }),
        athlete('G02', 'Sofia', 'Delacroix', 11, '7', 'M', 2, 'Marie Delacroix', [true, true, true]),
        athlete('G03', 'Emma', 'Hollis', 12, '1', 'GK', 1, 'Tom Hollis', [true, true, true]),
        athlete('G04', 'Maya', 'Robinson', 10, '4', 'D', 2, 'Denise Robinson', [true, true, false]),
        athlete('G05', 'Grace', 'Whitaker', 11, '9', 'F', 2, 'Laura Whitaker', [true, true, true]),
        athlete('G06', 'Lily', 'Chen', 9, '14', 'M', 0, '', [false, false, false]),
        athlete('G07', 'Harper', 'Nguyen', 12, '8', 'M', 2, 'Linh Nguyen', [true, true, true]),
        athlete('G08', 'Zoe', 'Abernathy', 10, '3', 'D', 1, 'Rachel Abernathy', [true, true, true]),
        athlete('G09', 'Chloe', 'Barrett', 11, '6', 'M', 2, 'Steve Barrett', [true, false, true]),
        athlete('G10', 'Nadia', 'Petrov', 12, '5', 'D', 2, 'Irina Petrov', [true, true, true]),
        athlete('G11', 'Ruby', 'Callahan', 9, '16', 'F', 1, 'Megan Callahan', [false, true, false]),
        athlete('G12', 'Isabella', 'Moreno', 10, '11', 'F', 2, 'Rosa Moreno', [true, true, true]),
        athlete('G13', 'Hannah', 'Frost', 11, '2', 'D', 1, 'Julie Frost', [true, true, true]),
        athlete('G14', 'Addison', 'Vaughn', 12, '12', 'M', 2, 'Cindy Vaughn', [true, true, true]),
        athlete('G15', 'Sadie', 'Lindqvist', 9, '17', 'GK', 1, 'Anna Lindqvist', [true, true, true])
      ]
    },

    // School directory pool for the "Add a player" / tryout search (some rostered, some not).
    directory: [
      { directoryKey: 'dir-201', first: 'Mason', last: 'Delgado', grade: 10, gradYear: 2028, guardianCount: 2 },
      { directoryKey: 'dir-202', first: 'Ella', last: 'Whitfield', grade: 11, gradYear: 2027, guardianCount: 2 },
      { directoryKey: 'dir-203', first: 'Jackson', last: 'Reyes', grade: 9, gradYear: 2029, guardianCount: 1 },
      { directoryKey: 'dir-204', first: 'Olivia', last: 'Brooks', grade: 10, gradYear: 2028, guardianCount: 2 },
      { directoryKey: 'dir-205', first: 'Lucas', last: 'Nguyen', grade: 12, gradYear: 2026, guardianCount: 2 },
      { directoryKey: 'dir-206', first: 'Sophie', last: 'Barrett', grade: 9, gradYear: 2029, guardianCount: 1 },
      { directoryKey: 'dir-207', first: 'Henry', last: 'Alvarez', grade: 11, gradYear: 2027, guardianCount: 2 },
      { directoryKey: 'dir-208', first: 'Mia', last: 'Sanderson', grade: 9, gradYear: 2029, guardianCount: 2 },
      { directoryKey: 'dir-209', first: 'Benjamin', last: 'Frost', grade: 10, gradYear: 2028, guardianCount: 1 },
      { directoryKey: 'dir-210', first: 'Layla', last: 'Okafor', grade: 11, gradYear: 2027, guardianCount: 2 },
      { directoryKey: 'dir-211', first: 'Nathan', last: 'Hollis', grade: 9, gradYear: 2029, guardianCount: 0 },
      { directoryKey: 'dir-212', first: 'Camila', last: 'Moreno', grade: 12, gradYear: 2026, guardianCount: 2 }
    ],

    // Events (day offsets → resolved in mock.js). missing[] are outbound exceptions;
    // returnPlan holds return-leg special cases; seedChecked pre-checks a few riders.
    events: [
      {
        EventID: 'EV-BSOC-1', TeamID: 'BSOC-V-F26', Sport: 'BSOC', Gender: 'Boys', Season: 'F26', Level: 'V',
        EventType: 'Practice', inDays: 1, StartTime: '3:30 PM', EndTimeEst: '5:00 PM',
        Opponent: '', HomeAway: 'Home', LocationName: 'HCS Turf Field', LocationAddress: '',
        DepartTime: '', ReturnEstTime: '', TransportMode: 'None', UniformNote: 'Training kit',
        Status: 'Scheduled', StaffNotes: '', exceptionCount: 0,
        missing: [], returnPlan: { guardian: [], self: [], other: [] }, seedChecked: { out: [], ret: [] }
      },
      {
        EventID: 'EV-BSOC-2', TeamID: 'BSOC-V-F26', Sport: 'BSOC', Gender: 'Boys', Season: 'F26', Level: 'V',
        EventType: 'Game', inDays: 4, StartTime: '4:30 PM', EndTimeEst: '6:00 PM',
        Opponent: 'Bayside Prep', HomeAway: 'Away', LocationName: 'Bayside Prep', LocationAddress: '120 Harbor Rd, Bayside',
        DepartTime: '2:45 PM', ReturnEstTime: '7:30 PM', TransportMode: 'Bus', UniformNote: 'Away whites',
        Status: 'Scheduled', StaffNotes: 'Bus leaves from the gym lot at depart time — be dressed and taped.',
        exceptionCount: 5,
        missing: [
          { athleteId: 'B06', status: 'ABSENT', reason: 'Family trip — out of town', setBy: 'whitfield.home@example.com', coachAck: false },
          { athleteId: 'B11', status: 'SELF', reason: 'Riding with a parent straight from work', setBy: 'hoffman.k@example.com', coachAck: false }
        ],
        returnPlan: {
          guardian: [
            { athleteId: 'B02', authorizedBy: 'reyes.m@example.com', isOverride: false, note: 'Dad picking up at the field' },
            { athleteId: 'B08', authorizedBy: 'aunt.fitzgerald@example.com', isOverride: true, note: 'Aunt collecting — primary guardian notified' }
          ],
          self: ['B07'],
          other: [
            { athleteId: 'B05', authorizedBy: 'alvarez.carpool@example.com', isOverride: false, note: 'Approved carpool with a teammate family' }
          ]
        },
        seedChecked: { out: ['B01', 'B03', 'B04'], ret: ['B01'] }
      },
      {
        EventID: 'EV-BSOC-3', TeamID: 'BSOC-V-F26', Sport: 'BSOC', Gender: 'Boys', Season: 'F26', Level: 'V',
        EventType: 'Game', inDays: 6, StartTime: '5:00 PM', EndTimeEst: '6:30 PM',
        Opponent: 'Cedar Grove Academy', HomeAway: 'Home', LocationName: 'HCS Stadium', LocationAddress: '',
        DepartTime: '', ReturnEstTime: '', TransportMode: 'None', UniformNote: 'Home maroon',
        Status: 'Cancelled', StaffNotes: 'Cancelled — field conditions after storms.', exceptionCount: 0,
        missing: [], returnPlan: { guardian: [], self: [], other: [] }, seedChecked: { out: [], ret: [] }
      },
      {
        EventID: 'EV-GSOC-1', TeamID: 'GSOC-V-F26', Sport: 'GSOC', Gender: 'Girls', Season: 'F26', Level: 'V',
        EventType: 'Practice', inDays: 2, StartTime: '3:30 PM', EndTimeEst: '5:00 PM',
        Opponent: '', HomeAway: 'Home', LocationName: 'HCS Turf Field', LocationAddress: '',
        DepartTime: '', ReturnEstTime: '', TransportMode: 'None', UniformNote: 'Training kit',
        Status: 'Scheduled', StaffNotes: '', exceptionCount: 0,
        missing: [], returnPlan: { guardian: [], self: [], other: [] }, seedChecked: { out: [], ret: [] }
      },
      {
        EventID: 'EV-GSOC-2', TeamID: 'GSOC-V-F26', Sport: 'GSOC', Gender: 'Girls', Season: 'F26', Level: 'V',
        EventType: 'Game', inDays: 5, StartTime: '4:00 PM', EndTimeEst: '5:30 PM',
        Opponent: 'Northgate Christian', HomeAway: 'Away', LocationName: 'Northgate Christian', LocationAddress: '55 Ridge Line Dr, Northgate',
        DepartTime: '2:15 PM', ReturnEstTime: '6:45 PM', TransportMode: 'Bus', UniformNote: 'Away whites',
        Status: 'Scheduled', StaffNotes: 'Snacks provided on the return trip.', exceptionCount: 2,
        missing: [
          { athleteId: 'G06', status: 'ABSENT', reason: 'Out sick', setBy: 'chen.family@example.com', coachAck: false }
        ],
        returnPlan: {
          guardian: [
            { athleteId: 'G04', authorizedBy: 'robinson.mom@example.com', isOverride: false, note: '' }
          ],
          self: [],
          other: []
        },
        seedChecked: { out: ['G01', 'G02'], ret: [] }
      },
      {
        EventID: 'EV-GSOC-3', TeamID: 'GSOC-V-F26', Sport: 'GSOC', Gender: 'Girls', Season: 'F26', Level: 'V',
        EventType: 'Scrimmage', inDays: 8, StartTime: '10:00 AM', EndTimeEst: '11:30 AM',
        Opponent: 'Maple Ridge School', HomeAway: 'Home', LocationName: 'HCS Turf Field', LocationAddress: '',
        DepartTime: '', ReturnEstTime: '', TransportMode: 'None', UniformNote: 'Home maroon',
        Status: 'Scheduled', StaffNotes: '', exceptionCount: 0,
        missing: [], returnPlan: { guardian: [], self: [], other: [] }, seedChecked: { out: [], ret: [] }
      }
    ],

    // Program / team announcements (bundle.announcements + listAnnouncements).
    announcements: [
      {
        AnnouncementID: 'ANN-001', Audience: 'Program', TeamID: '', Title: 'Fall pictures Thursday',
        Body: 'Team photos in the gym before practice — wear home uniforms.', Severity: 'info',
        CreatedAt: '', ExpiresAt: '', PostedByName: 'Athletics Office', PostedByEmail: 'athletics@harfordchristian.org', Status: 'Active'
      },
      {
        AnnouncementID: 'ANN-002', Audience: 'Team', TeamID: 'BSOC-V-F26', Title: 'Bus leaves 30 min early Friday',
        Body: 'Bayside Prep is farther than usual — depart 2:45 sharp from the gym lot.', Severity: 'urgent',
        CreatedAt: '', ExpiresAt: '', PostedByName: 'Coach Turner', PostedByEmail: 'aturner@harfordchristian.org', Status: 'Active'
      }
    ],

    // Drill pool (listDrills). Sport BSOC (soccer). Equipment powers the plan roll-up.
    drills: [
      { DrillID: 'DRL-001', Name: 'Dynamic warm-up circuit', Category: 'Warm-up', Sport: 'BSOC', Tags: 'warmup,mobility', Description: 'Progressive movement prep — skips, lunges, openers.', Equipment: 'Cones', DurationMinDefault: 10 },
      { DrillID: 'DRL-002', Name: 'Rondo 4v2', Category: 'Possession', Sport: 'BSOC', Tags: 'possession,pressure', Description: 'Keep-away in a tight grid; two defenders press.', Equipment: 'Cones, Balls, Pinnies', DurationMinDefault: 15 },
      { DrillID: 'DRL-003', Name: 'Passing patterns', Category: 'Technical', Sport: 'BSOC', Tags: 'passing,movement', Description: 'Combination play through a fixed pattern, both sides.', Equipment: 'Cones, Balls', DurationMinDefault: 15 },
      { DrillID: 'DRL-004', Name: 'Shooting from crosses', Category: 'Finishing', Sport: 'BSOC', Tags: 'finishing,crossing', Description: 'Wide delivery to near/far post finishing.', Equipment: 'Balls, Goals, Cones', DurationMinDefault: 20 },
      { DrillID: 'DRL-005', Name: 'Defensive shape 6v6', Category: 'Tactical', Sport: 'BSOC', Tags: 'defending,shape', Description: 'Compact block, pressing triggers, transition.', Equipment: 'Pinnies, Balls, Cones', DurationMinDefault: 20 },
      { DrillID: 'DRL-006', Name: 'Small-sided scrimmage', Category: 'Game', Sport: 'BSOC', Tags: 'scrimmage,conditioning', Description: 'Free play to finish; rotate squads every 4 min.', Equipment: 'Balls, Pinnies, Goals', DurationMinDefault: 20 }
    ],

    // Saved reusable practices (listSessions / getSession).
    sessions: [
      {
        sessionId: 'PS-001', title: 'Possession & pressing', scope: 'Team', teamId: 'BSOC-V-F26', sport: 'BSOC',
        focus: 'Keep the ball under pressure', objectives: 'Sharp first touch; press as a unit within 5s of loss.',
        tags: 'possession,pressing', estMinutes: 90,
        blocks: [
          { blockId: 'BLK-1', seq: 0, title: 'Warm-up', durationMin: 10, notes: '', drillId: 'DRL-001', drillName: 'Dynamic warm-up circuit' },
          { blockId: 'BLK-2', seq: 1, title: 'Rondos', durationMin: 15, notes: 'Two-touch limit.', drillId: 'DRL-002', drillName: 'Rondo 4v2' },
          { blockId: 'BLK-3', seq: 2, title: 'Defensive shape', durationMin: 25, notes: '', drillId: 'DRL-005', drillName: 'Defensive shape 6v6' },
          { blockId: 'BLK-4', seq: 3, title: 'Scrimmage', durationMin: 20, notes: '', drillId: 'DRL-006', drillName: 'Small-sided scrimmage' }
        ]
      },
      {
        sessionId: 'PS-002', title: 'Finishing day', scope: 'Team', teamId: 'BSOC-V-F26', sport: 'BSOC',
        focus: 'Convert chances', objectives: 'First-time finishes; movement in the box.',
        tags: 'finishing', estMinutes: 75,
        blocks: [
          { blockId: 'BLK-1', seq: 0, title: 'Warm-up', durationMin: 10, notes: '', drillId: 'DRL-001', drillName: 'Dynamic warm-up circuit' },
          { blockId: 'BLK-2', seq: 1, title: 'Passing patterns', durationMin: 15, notes: '', drillId: 'DRL-003', drillName: 'Passing patterns' },
          { blockId: 'BLK-3', seq: 2, title: 'Crosses & finishing', durationMin: 25, notes: 'Both flanks.', drillId: 'DRL-004', drillName: 'Shooting from crosses' }
        ]
      }
    ],

    // Recently run practices (listPracticeRuns). ranOn resolved in mock.js (inDays).
    practiceRuns: [
      { runId: 'RUN-001', title: 'Possession & pressing', teamId: 'BSOC-V-F26', inDays: -2, durationMin: 90 },
      { runId: 'RUN-002', title: 'Finishing day', teamId: 'BSOC-V-F26', inDays: -5, durationMin: 75 }
    ],

    // Lost & Found (lostFoundList). PostedAt resolved in mock.js (inDays).
    lostFound: [
      { ItemID: 'LF-001', Description: 'Blue Nike cleats, size 9', FoundWhere: 'HCS Turf Field', FoundWhen: 'After Tue practice', PhotoThumb: '', Status: 'Open', Claimed: false, PostedBy: 'aturner@harfordchristian.org', inDays: -1, Season: 'F26' },
      { ItemID: 'LF-002', Description: 'Black water bottle, name faded', FoundWhere: 'Gym lot', FoundWhen: 'Friday bus', PhotoThumb: '', Status: 'Open', Claimed: false, PostedBy: 'aturner@harfordchristian.org', inDays: -3, Season: 'F26' }
    ],

    // Tryouts (listTryouts / getTryout). Standings stay empty until evaluations exist.
    tryouts: [
      {
        TryoutID: 'TRY-F26-01', Name: 'Boys Varsity Soccer 2026', Sport: 'BSOC', Season: 'F26', TeamID: 'BSOC-V-F26',
        Status: 'Open', EvalCode: 'SOC26X', CreatedBy: 'athletics@harfordchristian.org', CreatedAt: '',
        events: [
          { TryoutID: 'TRY-F26-01', EventKey: 'sprint', Name: '40-yard sprint', InputType: 'time', ConfigJson: '', MaxPoints: 10, Weight: 1, EventOrder: 0, AllEvaluators: false, Active: true },
          { TryoutID: 'TRY-F26-01', EventKey: 'juggling', Name: 'Juggling count', InputType: 'number', ConfigJson: '', MaxPoints: 10, Weight: 1, EventOrder: 1, AllEvaluators: false, Active: true },
          { TryoutID: 'TRY-F26-01', EventKey: 'scrimmage', Name: 'Scrimmage read', InputType: 'rating', ConfigJson: '', MaxPoints: 10, Weight: 2, EventOrder: 2, AllEvaluators: true, Active: true }
        ],
        candidates: [
          { TryoutID: 'TRY-F26-01', CandidateID: 'CAND-001', FirstName: 'Lucas', LastName: 'Nguyen', Grade: 12, DirectoryKey: 'dir-205', Number: '21', Decision: '', AddedAt: '' },
          { TryoutID: 'TRY-F26-01', CandidateID: 'CAND-002', FirstName: 'Henry', LastName: 'Alvarez', Grade: 11, DirectoryKey: 'dir-207', Number: '22', Decision: '', AddedAt: '' }
        ]
      }
    ],

    // Positions catalog fallback for lineup (Sports blueprint also supplies these).
    soccerPositions: ['GK', 'DEF', 'MID', 'FWD']
  };
})();
