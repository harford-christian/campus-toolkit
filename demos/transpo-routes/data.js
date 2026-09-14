/* data.js — Driver Routes demo dataset. 100% FABRICATED: every student, driver, phone number,
   student id and PIN below is invented. Nothing here comes from a real record.

   THE SAME FICTIONAL SCHOOL AS THE DISMISSAL BOARD DEMO. Identical route codes, stick colours and
   driver cast (Wendell Ashby on Jarrettsville, Hollis Brandt on Abingdon, the Aberdeen/HdG Tuesday
   gap), because in production these two apps are one system: the dismissal app publishes the slice
   this one renders. The seven route names are the school's real bus geography — public place
   names, not personal data — because the colour chips are keyed on them.

   Shape mirrors what the production apps actually consume:
     · the published Transpo_DRIVER_ROUTES.json slice (what ../transportation writes every minute)
     · the Transpo_WORKING tabs: Stops · StudentStops · Drivers · Devices · Activity · Boarding

   THE STORY THIS DATASET TELLS, on purpose:
     1. Jarrettsville has its stops entered and Wendell ticks children on every day.
     2. Abingdon has stops but Hollis has never opened the app — so it reads "Not checked",
        NOT "0 boarded". That distinction is the whole design argument and you can see it.
     3. The other five routes have no stops yet, so the driver sheet shows its honest
        "stops are not set up for this route yet" banner rather than a silent flat list.
     4. Aberdeen/HdG has no driver on a Tuesday — the real coverage gap, carried over. */
window.TRANSPO_DATA = (function () {
  'use strict';

  var DEMO = {
    who: 'transportation@example.edu',
    dayName: 'Tue',
    dayKey: '2026-09-15',
    builtAt: '2026-09-15T15:04:00',
    session: 'PM',
    pin: '4821'                                  // the demo driver PIN, shown on the sign-in screen
  };

  var ROUTES = {
    'A/HdG': { name: 'Aberdeen/Havre de Grace', colour: 'White',  vehicle: 'Bus' },
    'Ab':    { name: 'Abingdon',                colour: 'Orange', vehicle: 'Bus' },
    'E':     { name: 'Edgewood',                colour: 'Pink',   vehicle: 'Bus' },
    'J':     { name: 'Jarrettsville',           colour: 'Purple', vehicle: 'Bus' },
    'BA':    { name: 'Bel Air',                 colour: 'Red',    vehicle: 'Van' },
    'CC':    { name: 'Cecil County',            colour: 'Green',  vehicle: 'Van' },
    'SP':    { name: 'Street/Pylesville',       colour: 'Blue',   vehicle: 'Van' }
  };

  /* Tuesday PM drivers. A/HdG is deliberately EMPTY: the source driver sheet covers Mon/Wed/Fri
     and Thu/Fri, so Tuesday is uncovered — a real gap the office view surfaces. */
  var DRIVERS_TODAY = {
    'A/HdG': [],
    'Ab':    [{ name: 'Hollis Brandt' }],
    'E':     [{ name: 'Marguerite Sato' }],
    'J':     [{ name: 'Wendell Ashby' }],
    'BA':    [{ name: 'Corinne Vasquez' }],
    'CC':    [{ name: 'Desmond Pyle' }],
    'SP':    [{ name: 'Everett Doyle' }]
  };

  /* Riders. id · name · grade · route. Names invented; ids are demo-local. */
  var RIDERS = [
    ['s101','Abrahomovich Natalie','1','A/HdG'], ['s102','Castellon Ivanna','4','A/HdG'],
    ['s103','Castellon Victor','5','A/HdG'],     ['s104','Cohey Allen','7','A/HdG'],
    ['s105','Lamb Kenlee','12','A/HdG'],

    ['s201','Dorn Zane','4','Ab'],               ['s202','Encinas Grace','7','Ab'],
    ['s203','Okafor Blessing','2','Ab'],         ['s204','Pryor Hattie','9','Ab'],
    ['s205','Vance Theodore','6','Ab'],          ['s206','Whitlock Sadie','3','Ab'],

    ['s301','Brown Caleb','4','E'],              ['s302','Chitumbo Praise','10','E'],
    ['s303','Cronin Evan','10','E'],             ['s304','Douglas Alaska','4','E'],
    ['s305','Hill Alicanna','3','E'],            ['s306','Fritts Richard','10','E'],
    ['s307','Mbeki Nomsa','8','E'],

    ['s401','Ball Abigail','7','J'],             ['s402','Beck Jackson','10','J'],
    ['s403','Caskey Lonni','3','J'],             ['s404','Conroy Blake','6','J'],
    ['s405','Dodge Aurora','3','J'],             ['s406','Dodge Sawyer','6','J'],
    ['s407','Dodge Scarlett','8','J'],           ['s408','Elliott Maddox','2','J'],
    ['s409','Elliott Memphis','3','J'],          ['s410','Gernand Joshua','4','J'],
    ['s411','Hackett Austin','8','J'],           ['s412','Kehl Norah','1','J'],
    ['s413','Lenardson Liam','2','J'],           ['s414','Wilson Addison','2','J'],

    ['s501','Cole Emmaleigh','11','BA'],         ['s502','Davis Nolan','5','BA'],
    ['s503','Fontanez Elijah','4','BA'],         ['s504','Wright Corbin','5','BA'],

    ['s601','Appel Jade','4','CC'],              ['s602','Guarnaccia Leo','7','CC'],
    ['s603','Huff Madison','7','CC'],            ['s604','Huff Matthew','9','CC'],

    ['s701','Campbell Lydia','4','SP'],          ['s702','Doyle William','3','SP'],
    ['s703','Wojkowiak Heidi','K5','SP']
  ];

  /* Today's exceptions, straight from the dismissal board's cross-reference. This is the column
     that makes the app worth opening: who NOT to wait for, and why. */
  var NOT_RIDING = {
    's405': ['ABSENT',      'Marked absent today'],
    's402': ['LEFT EARLY',  'Signed out 1:04pm — orthodontist'],
    's201': ['CAR TODAY',   'Grandmother collecting — office took the call 12:40pm'],
    's303': ['ABSENT',      'Marked absent today'],
    's702': ['SIGNED OUT',  'Signed out 2:15pm']
  };

  /* Flags on riders who ARE going, carried through from overrides and standing answers. */
  var FLAGS = {
    's412': ['standing — rides with the Dodges on Tuesdays'],
    's206': ['added today — riding home with a cousin']
  };

  /* ---------- STOPS: entered for two routes, absent for the other five ---------- */
  var STOPS = {
    'J': [
      { stopId:'j1', seq:10, name:'Jarrettsville firehouse', landmark:'Pull in past the bay doors', time:'3:25', driverNote:'Do not block the apron' },
      { stopId:'j2', seq:20, name:'Norrisville Road',        landmark:'By the white fence',         time:'3:34', driverNote:'' },
      { stopId:'j3', seq:30, name:'Baldwin Mill crossroads', landmark:'Opposite the produce stand', time:'3:41', driverNote:'Children cross BEHIND the bus here' },
      { stopId:'j4', seq:40, name:'Federal Hill Road',       landmark:'Top of the lane',            time:'3:50', driverNote:'' }
    ],
    'Ab': [
      { stopId:'a1', seq:10, name:'Abingdon library',     landmark:'Car park entrance', time:'3:22', driverNote:'' },
      { stopId:'a2', seq:20, name:'Emmorton Road shops',  landmark:'By the pharmacy',   time:'3:31', driverNote:'' },
      { stopId:'a3', seq:30, name:'Woodsdale Court',      landmark:'Turning circle',    time:'3:40', driverNote:'Tight turn — reverse from the top' }
    ]
  };

  var STUDENT_STOPS = {
    's401':'j1', 's403':'j1', 's405':'j1', 's412':'j1',
    's404':'j2', 's406':'j2', 's408':'j2', 's409':'j2',
    's402':'j3', 's407':'j3', 's410':'j3', 's413':'j3',
    's411':'j4', 's414':'j4',
    's201':'a1', 's203':'a1',
    's202':'a2', 's206':'a2',
    's204':'a3', 's205':'a3'
  };

  /* ---------- people ---------- */
  var DRIVER_ROWS = [
    { 'Driver ID':'drv-wendell', Name:'Wendell Ashby',     Routes:'*',  'PIN Hash':'set', Active:'Y' },
    { 'Driver ID':'drv-hollis',  Name:'Hollis Brandt',     Routes:'*',  'PIN Hash':'set', Active:'Y' },
    { 'Driver ID':'drv-margue',  Name:'Marguerite Sato',   Routes:'*',  'PIN Hash':'set', Active:'Y' },
    { 'Driver ID':'drv-corinne', Name:'Corinne Vasquez',   Routes:'*',  'PIN Hash':'set', Active:'Y' },
    { 'Driver ID':'drv-desmond', Name:'Desmond Pyle',      Routes:'CC', 'PIN Hash':'set', Active:'Y' },
    { 'Driver ID':'drv-everett', Name:'Everett Doyle',     Routes:'*',  'PIN Hash':'',    Active:'Y' },
    { 'Driver ID':'drv-tamsin',  Name:'Tamsin Greer',      Routes:'*',  'PIN Hash':'set', Active:'Y' },
    { 'Driver ID':'drv-lorna',   Name:'Lorna Fitch',       Routes:'*',  'PIN Hash':'set', Active:'N' }
  ];

  var DEVICE_ROWS = [
    { Token:'demo-tok-1', 'Driver ID':'drv-wendell', Device:'Wendell Ashby — phone',   Added:'2026-09-08', Active:'Y' },
    { Token:'demo-tok-2', 'Driver ID':'drv-hollis',  Device:'Hollis Brandt — phone',   Added:'2026-09-08', Active:'Y' },
    { Token:'demo-tok-3', 'Driver ID':'drv-margue',  Device:'Marguerite Sato — phone', Added:'2026-09-08', Active:'Y' },
    { Token:'demo-tok-4', 'Driver ID':'drv-corinne', Device:'Corinne Vasquez — phone', Added:'2026-09-09', Active:'Y' },
    { Token:'demo-tok-5', 'Driver ID':'drv-desmond', Device:'Desmond Pyle — phone',    Added:'2026-09-10', Active:'Y' },
    { Token:'demo-tok-6', 'Driver ID':'drv-tamsin',  Device:'Tamsin Greer — old phone',Added:'2026-09-08', Active:'N' },
    { Token:'demo-tok-7', 'Driver ID':'drv-tamsin',  Device:'Tamsin Greer — phone',    Added:'2026-09-12', Active:'Y' }
  ];

  /* Adoption is PARTIAL, on purpose — that is the honest state of any rollout, and the office
     view has to survive it. Wendell uses it daily; Hollis has never signed in at all. */
  var ACTIVITY = [
    ['2026-09-15T15:02:11','drv-wendell','Wendell Ashby','login','Wendell Ashby — phone'],
    ['2026-09-15T15:02:40','drv-wendell','Wendell Ashby','route_open','J'],
    ['2026-09-15T14:58:03','drv-margue','Marguerite Sato','login','Marguerite Sato — phone'],
    ['2026-09-15T14:58:22','drv-margue','Marguerite Sato','route_open','E'],
    ['2026-09-15T14:51:36','drv-corinne','Corinne Vasquez','login','Corinne Vasquez — phone'],
    ['2026-09-15T07:41:02','drv-wendell','Wendell Ashby','login','Wendell Ashby — phone'],
    ['2026-09-15T07:12:55','drv-tamsin','Tamsin Greer','locked','locked out for 15 minutes'],
    ['2026-09-15T07:12:30','drv-tamsin','Tamsin Greer','login_failed','1 tries left'],
    ['2026-09-15T07:12:04','drv-tamsin','Tamsin Greer','login_failed','2 tries left'],
    ['2026-09-14T15:03:19','drv-wendell','Wendell Ashby','login','Wendell Ashby — phone'],
    ['2026-09-14T15:03:44','drv-wendell','Wendell Ashby','route_open','J'],
    ['2026-09-14T14:55:10','drv-desmond','Desmond Pyle','login','Desmond Pyle — phone'],
    ['2026-09-11T15:01:02','drv-wendell','Wendell Ashby','login','Wendell Ashby — phone'],
    ['2026-09-11T15:01:31','drv-wendell','Wendell Ashby','route_open','J']
  ].map(function (r) {
    return { Timestamp:r[0], 'Day Key':r[0].slice(0,10), 'Driver ID':r[1],
             'Driver Name':r[2], Event:r[3], Detail:r[4] };
  });

  /* Wendell ticked Jarrettsville today. NOBODY has ticked Abingdon — so Abingdon reads
     "Not checked", never "0 boarded". */
  var BOARDED_TODAY = ['s401','s403','s412','s404','s406','s408','s409','s407','s410','s413','s411'];
  var NO_SHOW_TODAY = ['s414'];

  var BOARDING = [];
  BOARDED_TODAY.forEach(function (sid, i) {
    BOARDING.push({ 'Event ID':'b'+i, Timestamp:'2026-09-15T15:2'+(i%10)+':00', 'Day Key':DEMO.dayKey,
      'Driver ID':'drv-wendell', 'Route Code':'J', Session:'PM',
      'Stop ID':STUDENT_STOPS[sid]||'', 'Rider Key':'rk-'+sid, 'Student ID':sid,
      Action:'on', Source:'driver', Note:'' });
  });
  NO_SHOW_TODAY.forEach(function (sid, i) {
    BOARDING.push({ 'Event ID':'bn'+i, Timestamp:'2026-09-15T15:31:00', 'Day Key':DEMO.dayKey,
      'Driver ID':'drv-wendell', 'Route Code':'J', Session:'PM',
      'Stop ID':STUDENT_STOPS[sid]||'', 'Rider Key':'rk-'+sid, 'Student ID':sid,
      Action:'no_show', Source:'driver', Note:'' });
  });
  // Two earlier days, so "tick days" in the adoption table is a distinct-DAY count, not raw events.
  ['2026-09-14','2026-09-11'].forEach(function (day, d) {
    ['s401','s403','s404'].forEach(function (sid, i) {
      BOARDING.push({ 'Event ID':'p'+d+i, Timestamp:day+'T15:2'+i+':00', 'Day Key':day,
        'Driver ID':'drv-wendell', 'Route Code':'J', Session:'PM',
        'Stop ID':STUDENT_STOPS[sid]||'', 'Rider Key':'rk-'+sid, 'Student ID':sid,
        Action:'on', Source:'driver', Note:'' });
    });
  });

  /* ---------- assemble the published slice, exactly as ../transportation writes it ---------- */
  function slice() {
    var byRoute = {};
    RIDERS.forEach(function (r) { (byRoute[r[3]] = byRoute[r[3]] || []).push(r); });

    return {
      builtAt: DEMO.builtAt, dayKey: DEMO.dayKey, dayName: DEMO.dayName,
      attendanceAsOf: '2026-09-15T15:00:00', attendanceOffDay: false, signOutActive: true,
      slice: {
        session: DEMO.session, dayName: DEMO.dayName,
        routes: Object.keys(ROUTES).map(function (code) {
          var rows = byRoute[code] || [];
          var riding = [], notRiding = [];
          rows.forEach(function (r) {
            var gone = NOT_RIDING[r[0]];
            if (gone) {
              notRiding.push({ id:r[0], name:r[1], grade:r[2], expected:false,
                               reason:gone[0], detail:gone[1] });
            } else {
              riding.push({ id:r[0], name:r[1], grade:r[2], expected:true,
                            flags: FLAGS[r[0]] || [] });
            }
          });
          var by = function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; };
          riding.sort(by); notRiding.sort(by);
          return { code: code, name: ROUTES[code].name, colour: ROUTES[code].colour,
                   vehicle: ROUTES[code].vehicle, drivers: DRIVERS_TODAY[code] || [],
                   riding: riding, notRiding: notRiding };
        })
      }
    };
  }

  function stopRows() {
    var out = [];
    Object.keys(STOPS).forEach(function (code) {
      STOPS[code].forEach(function (s) {
        out.push({ 'Stop ID':s.stopId, 'Route Code':code, Session:'PM', Seq:s.seq,
                   'Stop Name':s.name, Landmark:s.landmark, Time:s.time, Days:'',
                   Active:'Y', 'Driver Note':s.driverNote, Note:'' });
      });
    });
    return out;
  }

  function linkRows() {
    return Object.keys(STUDENT_STOPS).map(function (sid) {
      var route = (RIDERS.filter(function (r) { return r[0] === sid; })[0] || [])[3] || '';
      return { 'Student ID':sid, 'Route Code':route, Session:'PM',
               'Stop ID':STUDENT_STOPS[sid], Days:'', Note:'' };
    });
  }

  return {
    DEMO: DEMO, ROUTES: ROUTES,
    published: slice(),
    stopRows: stopRows(), linkRows: linkRows(),
    drivers: DRIVER_ROWS, devices: DEVICE_ROWS, activity: ACTIVITY, boarding: BOARDING
  };
})();
