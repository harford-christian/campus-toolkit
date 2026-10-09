/* mock.js — the ELC Assessments demo's stand-in for Google.

   The page (app.html) is the real Index.html, and logic.js is the app's own server, every .gs file vendored
   verbatim by build-logic.mjs. What this file supplies is the Google underneath that server:

     SpreadsheetApp     one in-memory spreadsheet holding every SHEET_SCHEMAS tab (Data.gs runs unmodified on
                        top of it: getOrCreateSheet_, readAllRows_, appendRow_, updateRow_, deleteRows_ and the
                        direct setValues writes in Roster.gs / GradeAudit.gs) plus the three staff-maintained
                        reference tabs (K5-6 Teachers, ELC Elementary, K5-6 Students). Like Sheets, a cell
                        written as 'YYYY-MM-DD' is stored as a local-midnight date, so administration dates
                        never drift a day through the UTC-midnight parse.
     Session            the signed-in persona: ?as=elc (default) | admin | teacher (2nd grade) | teacher4
     PropertiesService / CacheService (always a miss, so access scopes are recomputed every call) /
     LockService / MailApp (an outbox: window.ELC_DEMO.outbox) / ScriptApp (no triggers) / Utilities (uuid)
     Date               a PINNED CLOCK, bound into the server's scope only: "now" is Tuesday 13 October 2026,
                        10:20 local, plus however long the page has been open. The server calls new Date()
                        in some ninety places (school year, season, request age, staleness, audit stamps), so
                        pinning its Date is the one change that keeps all of them consistent; the page's own
                        Date is untouched except for the four "today" reads build.json routes through
                        window.ELC_DEMO_NOW (form defaults and request age).

   Each google.script.run call is a fresh Apps Script execution, so every call first clears the server's
   per-execution memo caches (ELC_LOGIC.newExecution). At first boot the history in data.js is replayed
   through the real submitSession(), so stored rows, tiers and summaries are the app's own output. Writes
   persist in sessionStorage for the visit (switching persona keeps them); ↻ Reset clears them. */
(function () {
  'use strict';
  var D = window.ELC_DATA, L = window.ELC_LOGIC;
  var STORE_KEY = 'elc-assessments-demo-v1';

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function readStore() { var s = store(); if (!s) return null; try { return JSON.parse(s.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } }
  function writeStore(v) { var s = store(); if (!s) return; try { s.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) {} }

  /* ---------- the pinned clock (server scope only) ---------- */
  var RealDate = window.Date;
  var PIN = new RealDate(D.now[0], D.now[1] - 1, D.now[2], D.now[3], D.now[4]).getTime();
  var OFFSET = PIN - RealDate.now();
  class DemoDate extends RealDate {
    constructor() {
      if (arguments.length === 0) super(RealDate.now() + OFFSET);
      else super(...arguments);
    }
    static now() { return RealDate.now() + OFFSET; }
  }
  function at(parts) { return new DemoDate(parts[0], parts[1] - 1, parts[2], parts[3] || 0, parts[4] || 0); }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  /* ---------- persona ---------- */
  var asParam = '';
  try { asParam = new URLSearchParams(window.location.search).get('as') || ''; } catch (e) {}
  var personaKey = Object.prototype.hasOwnProperty.call(D.personas, asParam) ? asParam : 'elc';
  var currentEmail = D.personas[personaKey].email;

  /* ---------- in-memory Sheets ---------- */
  function blank(v) { return v === '' || v === null || v === undefined; }
  function cellIn(x) {
    if (x === undefined || x === null) return '';
    if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) {      // Sheets parses a typed date as local midnight
      var p = x.split('-'); return new DemoDate(+p[0], +p[1] - 1, +p[2]);
    }
    return x;
  }
  function Sheet(name, values) { this.name = name; this.v = (values || []).map(function (r) { return r.slice(); }); }
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.getLastRow = function () {
    for (var r = this.v.length - 1; r >= 0; r--) if ((this.v[r] || []).some(function (c) { return !blank(c); })) return r + 1;
    return 0;
  };
  Sheet.prototype.getLastColumn = function () {
    var w = 0;
    this.v.forEach(function (row) { for (var c = row.length - 1; c >= 0; c--) if (!blank(row[c])) { if (c + 1 > w) w = c + 1; break; } });
    return w;
  };
  Sheet.prototype.getMaxRows = function () { return Math.max(this.v.length, 1000); };
  Sheet.prototype.setFrozenRows = function () { return this; };
  Sheet.prototype.appendRow = function (row) { this.v[this.getLastRow()] = row.map(cellIn); return this; };
  Sheet.prototype.deleteRow = function (r) { this.v.splice(r - 1, 1); return this; };
  Sheet.prototype.getDataRange = function () { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); };
  Sheet.prototype.getRange = function (r, c, n, m) {
    var self = this; n = n || 1; m = m || 1;
    function cell(i, j) { var row = self.v[r - 1 + i]; var x = row ? row[c - 1 + j] : ''; return blank(x) ? '' : x; }
    function put(i, j, x) {
      var ri = r - 1 + i, ci = c - 1 + j;
      while (self.v.length <= ri) self.v.push([]);
      while (self.v[ri].length < ci) self.v[ri].push('');
      self.v[ri][ci] = cellIn(x);
    }
    var range = {
      getValues: function () { var out = []; for (var i = 0; i < n; i++) { var row = []; for (var j = 0; j < m; j++) row.push(cell(i, j)); out.push(row); } return out; },
      getValue: function () { return cell(0, 0); },
      setValues: function (vals) {
        if (vals.length !== n || vals.some(function (row) { return row.length !== m; })) throw new Error('The number of rows or columns in the data does not match the range.');
        for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) put(i, j, vals[i][j]); return range;
      },
      setValue: function (x) { put(0, 0, x); return range; },
      clearContent: function () { for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) put(i, j, ''); return range; },
      setNumberFormat: function () { return range; }, setBackground: function () { return range; },
      setFontColor: function () { return range; }, setFontWeight: function () { return range; }
    };
    return range;
  };

  var SHEET_ID = 'elc-assessments-demo-sheet';
  var tabs = {};
  var spreadsheet = {
    getId: function () { return SHEET_ID; },
    getName: function () { return L.SPREADSHEET_NAME; },
    getUrl: function () { return 'https://example.invalid/elc-assessments-demo-spreadsheet'; },
    getSheetByName: function (n) { return tabs[n] || null; },
    insertSheet: function (n) { tabs[n] = new Sheet(n, []); return tabs[n]; },
    getSheets: function () { return Object.keys(tabs).map(function (n) { return tabs[n]; }); },
    deleteSheet: function (s) { delete tabs[s.getName()]; }
  };

  /* ---------- the other services ---------- */
  var wantReset = false;
  try { wantReset = new URLSearchParams(window.location.search).has('reset'); } catch (e) {}
  if (wantReset) { var st = store(); if (st) try { st.removeItem(STORE_KEY); } catch (e) {} }   // the wrapper's Reset: ?reset=1
  var saved = readStore();
  var propStore = (saved && saved.props) || {};
  propStore[L.SPREADSHEET_ID_PROP] = SHEET_ID;
  if (!saved) propStore.NOTIFICATION_ADMIN_EMAIL = D.personas.admin.email;
  var props = {
    getProperty: function (k) { return Object.prototype.hasOwnProperty.call(propStore, k) ? propStore[k] : null; },
    setProperty: function (k, v) { propStore[k] = String(v); return props; },
    setProperties: function (o) { Object.keys(o).forEach(function (k) { propStore[k] = String(o[k]); }); return props; },
    deleteProperty: function (k) { delete propStore[k]; return props; },
    getProperties: function () { return clone(propStore); },
    getKeys: function () { return Object.keys(propStore); }
  };
  var cache = { get: function () { return null; }, put: function () {}, remove: function () {}, getAll: function () { return {}; }, putAll: function () {}, removeAll: function () {} };
  var outbox = (saved && saved.outbox) || [];
  var uuidN = (saved && saved.uuidN) || 0;
  var lock = { waitLock: function () {}, tryLock: function () { return true; }, releaseLock: function () {}, hasLock: function () { return true; } };
  function triggerBuilder() {
    var b = {}; ['timeBased', 'everyDays', 'everyWeeks', 'everyHours', 'atHour', 'nearMinute', 'onWeekDay', 'forSpreadsheet', 'onEdit', 'inTimezone']
      .forEach(function (k) { b[k] = function () { return b; }; });
    b.create = function () { return { getUniqueId: function () { return 'demo-trigger'; }, getHandlerFunction: function () { return ''; } }; };
    return b;
  }
  var quiet = function () { if (window.ELC_DEBUG && window.console) window.console.log.apply(window.console, ['[server]'].concat([].slice.call(arguments))); };

  L.bind({
    SpreadsheetApp: {
      openById: function (id) { if (id !== SHEET_ID) throw new Error('Unknown spreadsheet ' + id); return spreadsheet; },
      create: function () { return spreadsheet; },
      getActiveSpreadsheet: function () { return spreadsheet; },
      flush: function () {}
    },
    CacheService: { getScriptCache: function () { return cache; } },
    PropertiesService: { getScriptProperties: function () { return props; } },
    Session: {
      getActiveUser: function () { return { getEmail: function () { return currentEmail; } }; },
      getEffectiveUser: function () { return { getEmail: function () { return 'elc-assessments-script@example.edu'; } }; },
      getScriptTimeZone: function () { return 'America/New_York'; }
    },
    Utilities: {
      getUuid: function () { uuidN++; return '00000000-demo-4000-8000-' + ('000000000000' + uuidN).slice(-12); },
      sleep: function () {}
    },
    MailApp: {
      sendEmail: function (a, b, c) { outbox.push(typeof a === 'object' ? clone(a) : { to: a, subject: b, body: c }); },
      getRemainingDailyQuota: function () { return 100; }
    },
    ScriptApp: {
      getProjectTriggers: function () { return []; }, newTrigger: triggerBuilder, deleteTrigger: function () {},
      getService: function () { return { getUrl: function () { return ''; } }; },
      WeekDay: { MONDAY: 'MONDAY', TUESDAY: 'TUESDAY', WEDNESDAY: 'WEDNESDAY', THURSDAY: 'THURSDAY', FRIDAY: 'FRIDAY', SATURDAY: 'SATURDAY', SUNDAY: 'SUNDAY' }
    },
    HtmlService: { createHtmlOutput: function () { return {}; }, createHtmlOutputFromFile: function () { return {}; }, XFrameOptionsMode: {} },
    LockService: { getScriptLock: function () { return lock; } },
    Logger: { log: quiet },
    Date: DemoDate,
    console: { log: quiet, info: quiet, warn: quiet, error: quiet }
  });

  /* ---------- the workbook: restored for the visit, or built and seeded ---------- */
  var REFERENCE_TABS = ['K5-6 Teachers', 'ELC Elementary', 'K5-6 Students'];
  var ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  function revive(rows) { return rows.map(function (r) { return r.map(function (x) { return (typeof x === 'string' && ISO.test(x)) ? new DemoDate(x) : x; }); }); }
  function rowFor(sheetName, obj) { return L.SHEET_SCHEMAS[sheetName].map(function (h) { return obj[h] === undefined || obj[h] === null ? '' : obj[h]; }); }
  function asUser(key, fn) { var was = currentEmail; currentEmail = D.personas[key].email; try { return fn(); } finally { currentEmail = was; } }

  function expandCore(correct) {
    var items = {};
    Object.keys(correct).forEach(function (part) {
      var len = L.CORE_PHONICS_PARTS[part].items.length;
      items[part] = []; for (var i = 0; i < len; i++) items[part].push(i < correct[part]);
    });
    return items;
  }
  function seedPayload(s) {
    var input;
    if (s.type === 'core_phonics') input = { itemResults: expandCore(s.input.correct) };
    else {
      input = { grade: s.grade, season: s.season };
      Object.keys(s.input).forEach(function (k) {
        input[k] = k === 'entries' ? s.input.entries.map(function (e) { return { measure: e[0], rawScore: e[1] }; }) : s.input[k];
      });
    }
    return { student_id: s.id, assessment_type: s.type, administration_date: s.date, school_year: s.year, grade_at_admin: s.grade,
      season: s.season, notes: s.notes || '', administrator_role: s.role, input: input, fulfilling_request_id: null, test_grade_level: '' };
  }

  function build() {
    Object.keys(L.SHEET_SCHEMAS).forEach(function (n) { tabs[n] = new Sheet(n, [L.SHEET_SCHEMAS[n].slice()]); });
    function add(name, obj) { tabs[name].appendRow(rowFor(name, obj)); }
    D.staffAccess.forEach(function (r) { add(L.SHEET_ACCESS, { email: r[0], added_date: r[1], notes: r[2], access_role: r[3], scope_grades: r[4] }); });
    D.students.forEach(function (s) {
      add(L.SHEET_STUDENTS, { student_id: s[0], first_name: s[1], last_name: s[2], grade: s[3], school: '',
        elc_status: s[4] ? 'ELC' : 'Not ELC (manually added)', source: s[4] ? 'FACTS' : 'K5-6 Roster', active: true,
        date_added: s[3] === 'K' ? '2026-08-24' : '2025-08-20', notes: '', deactivation_reason: '' });
    });
    var elcTeacher = [D.personas.elc, D.personas.elc2];
    tabs['K5-6 Teachers'] = new Sheet('K5-6 Teachers', [['Grade', 'Teacher', 'Homeroom', 'Email']].concat(D.teachers));
    var elcRows = [['Student ID', 'Student Name', 'Grade', 'Teacher', 'Email', 'Secondary Teacher Email', 'Language', 'Reading', 'Math', 'Phonics', 'Spelling']];
    D.students.filter(function (s) { return s[4]; }).forEach(function (s, i) {
      var t = elcTeacher[i % 2], a = s[5] || '';
      elcRows.push([s[0], s[2] + ' ' + s[1], s[3] === 'K' ? 'K5' : s[3], t.name, t.email, '',
        a.indexOf('L') !== -1, a.indexOf('R') !== -1, a.indexOf('M') !== -1, a.indexOf('P') !== -1, a.indexOf('S') !== -1]);
    });
    tabs['ELC Elementary'] = new Sheet('ELC Elementary', elcRows);
    var k56 = [['Student ID', 'Student Name', 'Grade', 'Email', 'Status']];
    D.students.concat(D.notYetAdded).forEach(function (s) {
      k56.push([s[0], s[2] + ' ' + s[1], s[3] === 'K' ? 'K5' : s[3], (s[1] + '.' + s[2]).toLowerCase() + '@students.example.edu', 'Enrolled']);
    });
    tabs['K5-6 Students'] = new Sheet('K5-6 Students', k56);
    D.requests.forEach(function (r) {
      var o = clone(r); o.requested_at = at(r.requested_at); o.fulfilled_session_id = ''; o.fulfilled_at = ''; o.overdue_alert_sent = '';
      add(L.SHEET_REQUESTS, o);
    });
    D.iepGoals.forEach(function (g) { var o = clone(g); o.created_at = at(g.created_at); add(L.SHEET_IEP_GOALS, o); });
    D.accommodations.forEach(function (a, i) {
      add(L.SHEET_ACCOMMODATIONS, { entry_id: 'acc-demo-' + (i + 1), student_id: a[0], type: a[1], category: a[2], item: a[3],
        responsible_party: a[4], created_by: D.personas.elc.email, created_at: at([2026, 9, 10, 9, 0]) });
    });
    D.section504.forEach(function (p) { var o = clone(p); o.last_updated_at = at(p.last_updated_at); add(L.SHEET_504_PLANS, o); });

    // The history, through the real submitSession — then stamp created_at with the day it was entered.
    D.seedSessions.forEach(function (s) {
      L.newExecution();
      var out = asUser(s.by, function () { return L.submitSession(seedPayload(s)); });
      if (!out || !out.session_id) throw new Error('seed session for ' + s.id + ' ' + s.type + ' ' + s.date + ' was not saved: ' + JSON.stringify(out));
      L.newExecution();
      var d = s.date.split('-');
      L.updateRow_(L.SHEET_SESSIONS, 'session_id', out.session_id, { created_at: new DemoDate(+d[0], +d[1] - 1, +d[2], 15, 30) });
    });
    L.newExecution();
  }

  if (saved && saved.tabs) Object.keys(saved.tabs).forEach(function (n) { tabs[n] = new Sheet(n, revive(saved.tabs[n])); });
  else build();

  function persist() {
    var t = {};
    Object.keys(tabs).forEach(function (n) { t[n] = tabs[n].v; });
    writeStore({ tabs: t, props: propStore, outbox: outbox, uuidN: uuidN });
  }
  if (!saved) persist();

  /* ---------- the page's google.script.run surface ---------- */
  // Every function Index.html reaches through call('…'); verify.mjs checks this list against the built page.
  var METHODS = ['addIepGoal', 'addManualStudent', 'addStudentFromK56Roster', 'applyGradeAtAdminCorrections', 'bulkAddStudents',
    'bulkAdvanceGrades', 'cancelRequest', 'createAssessmentRequest', 'deactivateStudent', 'deleteIepGoal', 'deleteSection504Plan',
    'deleteSession', 'discontinueIepGoal', 'findStudentsAboveTopGrade', 'getAccessAuditLog', 'getAccommodationChecklist',
    'getAdministratorRoles', 'getArchivedSchoolYears', 'getAssessmentAuditLog', 'getAssessmentStatusBundle', 'getAssessmentTypes',
    'getAvailableSchoolYears', 'getComplianceReport', 'getComplianceRequirementsSummary', 'getConcernAreas', 'getCorePhonicsAvailability',
    'getCorePhonicsParts', 'getCoverageReport', 'getDashboardBundle', 'getDeactivatedRoster', 'getDeactivationReasons',
    'getDibelsMeasureList', 'getEasyCbmMathMeasureList', 'getEasyCbmMeasureList', 'getEmailLog', 'getGrlLetters', 'getIepExportLog',
    'getIepGoalAreas', 'getInstalledTriggerStatus', 'getMyAccess', 'getNotificationTestModeStatus', 'getPendingRequests',
    'getReactivationReasons', 'getRoster', 'getSchoolwideSkillRanking', 'getSection504History', 'getSection504ServiceAreas',
    'getSessionItemDetail', 'getSpreadsheetUrl', 'getStaffAccessBundle', 'getStudentProfileBundle', 'getStudentSummary',
    'getSummaryBundle', 'getYearEndArchive', 'grantAccess', 'logIepExport', 'markIepGoalMet', 'previewDibelsComposite',
    'previewGradeAdvance', 'previewGradeAtAdminCorrections', 'reactivateStudent', 'resolveRequestManually', 'reviseIepGoal',
    'revokeAccess', 'runGradeAtAdminAudit', 'saveSection504Plan', 'searchK56Roster', 'searchRosterByLastName', 'setAccommodationItem',
    'submitSession', 'updateAccessScope', 'updateSessionFields', 'updateStudent'];
  var backend = {};
  METHODS.forEach(function (name) {
    backend[name] = function () {
      L.newExecution();                       // a fresh Apps Script execution
      try { return clone(L[name].apply(null, clone([].slice.call(arguments)))); }
      finally { persist(); }
    };
  });
  window.MOCK_BACKEND = backend;
  window.ELC_DEMO_NOW = function () { return new RealDate(DemoDate.now()); };
  window.ELC_DEMO = {
    persona: personaKey, email: function () { return currentEmail; }, personas: D.personas,
    outbox: outbox, tabs: tabs, methods: METHODS, DemoDate: DemoDate,
    asUser: function (key, fn) { return asUser(key, fn); },
    setPersona: function (key) { currentEmail = D.personas[key].email; personaKey = key; },
    reset: function () { var s = store(); if (s) s.removeItem(STORE_KEY); window.location.reload(); }
  };
})();
