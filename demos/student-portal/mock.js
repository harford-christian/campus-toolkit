/* mock.js — the demo's stand-in for Google, in three parts:

   1. The portal's CONFIG, as globals (the one source file not vendored, because the real one carries calendar
      and Drive ids). Same symbol names, fabricated values, and the caller resolver answers with the demo student.
   2. Apps Script services over plain JavaScript: an in-memory Sheets, CacheService, PropertiesService, DriveApp,
      UrlFetchApp (serving the fabricated .ics feeds), BellHub, Session, Utilities with a PINNED CLOCK. The clock
      is the one deliberate fiction: "now" is Wednesday 2026-09-23 10:30 plus however long the page has been open,
      so every "NOW" marker, due bucket and attendance day lands on the dataset. ?sim=YYYY-MM-DD HH:MM moves it.
   3. window.MOCK_BACKEND — the six google.script.run methods the page calls, each delegating to the vendored
      endpoint in logic.js. The page's inline boot payload is produced the same way (PORTAL_DEMO.bootData). */
(function () {
  'use strict';
  var D = window.PORTAL_DATA, L = window.PORTAL_LOGIC;
  var STUDENT_KEY = 'portal-demo-student', PREFS_KEY = 'portal-demo-prefs-v1';

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function readStore(k) { var s = store(); if (!s) return null; try { return JSON.parse(s.getItem(k) || 'null'); } catch (e) { return null; } }
  function writeStore(k, v) { var s = store(); if (!s) return; try { s.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- the pinned clock ---------- */
  var simParam = '';
  try { simParam = (new URLSearchParams(window.location.search).get('sim') || '').replace(/[^0-9:\- T]/g, '').slice(0, 16); } catch (e) {}
  var pinned = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2})?$/.test(simParam) ? simParam : D.demo.now;
  var pm = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(pinned);
  var pinnedUtcMs = Date.UTC(+pm[1], +pm[2] - 1, +pm[3], pm[4] === undefined ? 8 : +pm[4], pm[5] === undefined ? 45 : +pm[5]);
  var loadedAt = Date.now();
  /** The demo's wall clock as a UTC Date whose UTC fields ARE the school's local time. */
  function wall(date) {
    // A Date created as "now" (within a few seconds of the real clock) means "the demo's now".
    if (Math.abs(date.getTime() - Date.now()) < 5000) return new Date(pinnedUtcMs + (Date.now() - loadedAt));
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function formatDate(date, tz, fmt) {
    var w = wall(date);
    var y = w.getUTCFullYear(), mo = w.getUTCMonth() + 1, d = w.getUTCDate(), H = w.getUTCHours(), m = w.getUTCMinutes(), s = w.getUTCSeconds();
    var dow = w.getUTCDay(), h12 = H % 12 || 12;
    return String(fmt).replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss|EEE|MMM|d|h|H|m|a|z|u/g, function (tok, lit) {
      if (lit !== undefined) return lit;
      switch (tok) {
        case 'yyyy': return String(y); case 'MM': return p2(mo); case 'dd': return p2(d); case 'HH': return p2(H);
        case 'mm': return p2(m); case 'ss': return p2(s); case 'EEE': return DOW[dow]; case 'MMM': return MON[mo - 1];
        case 'd': return String(d); case 'h': return String(h12); case 'H': return String(H); case 'm': return String(m);
        case 'a': return H >= 12 ? 'PM' : 'AM'; case 'z': return 'EDT'; case 'u': return String(dow === 0 ? 7 : dow);
      }
      return tok;
    });
  }
  function pinnedLabel() {
    var w = wall(new Date());
    return DOW[w.getUTCDay()] + ' ' + MON[w.getUTCMonth()] + ' ' + w.getUTCDate() + ', ' + w.getUTCFullYear() + ' ' +
      (w.getUTCHours() % 12 || 12) + ':' + p2(w.getUTCMinutes()) + ' ' + (w.getUTCHours() >= 12 ? 'PM' : 'AM');
  }

  /* ---------- in-memory Sheets ---------- */
  function Sheet(values) { this.values = values.map(function (r) { return r.slice(); }); }
  Sheet.prototype.getDataRange = function () { var v = this.values; return { getValues: function () { return v.map(function (r) { return r.slice(); }); } }; };
  Sheet.prototype.appendRow = function (row) { this.values.push(row.slice()); return this; };
  Sheet.prototype.deleteRow = function (r) { this.values.splice(r - 1, 1); return this; };
  Sheet.prototype.deleteRows = function (r, n) { this.values.splice(r - 1, n); return this; };
  Sheet.prototype.getLastRow = function () { return this.values.length; };
  Sheet.prototype.setFrozenRows = function () { return this; };
  Sheet.prototype.clearContents = function () { this.values = []; return this; };
  Sheet.prototype.getRange = function (r, c, n, m) {
    var self = this;
    return { setValues: function (vals) {
      for (var i = 0; i < n; i++) { self.values[r - 1 + i] = self.values[r - 1 + i] || []; for (var j = 0; j < m; j++) self.values[r - 1 + i][c - 1 + j] = vals[i][j]; }
    } };
  };
  function Workbook(tabs) { this.sheets = {}; var self = this; Object.keys(tabs).forEach(function (n) { self.sheets[n] = new Sheet(tabs[n]); }); }
  Workbook.prototype.getSheetByName = function (n) { return this.sheets[n] || null; };
  Workbook.prototype.insertSheet = function (n) { this.sheets[n] = new Sheet([]); return this.sheets[n]; };
  var staging = new Workbook(D.staging);
  var data = new Workbook(D.data);
  var savedPrefs = readStore(PREFS_KEY);
  if (savedPrefs) data.sheets.Prefs = new Sheet(savedPrefs);
  var memo = new Workbook(D.memo);   // the memo-check sheet's Chapel + MemoNotes tabs, read-only
  var WORKBOOKS = { 'staging-demo': staging, 'data-demo': data, 'memo-demo': memo };

  /* ---------- the other services ---------- */
  var cacheStore = {};
  var cache = {
    get: function (k) { return Object.prototype.hasOwnProperty.call(cacheStore, k) ? cacheStore[k] : null; },
    put: function (k, v) { cacheStore[k] = String(v); },
    remove: function (k) { delete cacheStore[k]; },
    getAll: function (keys) { var o = {}; (keys || []).forEach(function (k) { if (Object.prototype.hasOwnProperty.call(cacheStore, k)) o[k] = cacheStore[k]; }); return o; },
    putAll: function (obj) { Object.keys(obj).forEach(function (k) { cacheStore[k] = String(obj[k]); }); },
    removeAll: function (keys) { (keys || []).forEach(function (k) { delete cacheStore[k]; }); }
  };
  var propStore = { ATHLETICS_ENABLED: '1', ATTENDANCE_ENABLED: '1', AVERAGES_ENABLED: '1', NEWS_ENABLED: '1', STAGING_SHEET_ID: 'staging-demo', DATA_SHEET_ID: 'data-demo',
    MEMO_CHECK_SHEET_ID: 'memo-demo',
    ADMIN_EMAILS: '', DATA_VERSION: 'demo', GRADES_VERSION: 'demo', NO_SCHOOL_DATES: '' };
  var props = {
    getProperty: function (k) { return Object.prototype.hasOwnProperty.call(propStore, k) ? propStore[k] : null; },
    setProperty: function (k, v) { propStore[k] = String(v); }, deleteProperty: function (k) { delete propStore[k]; },
    getProperties: function () { var o = {}; Object.keys(propStore).forEach(function (k) { o[k] = propStore[k]; }); return o; }
  };
  function response(code, body) { return { getResponseCode: function () { return code; }, getContentText: function () { return body; } }; }
  function fetchOne(url) {
    var m = /\/ical\/([^/]+)\/public/.exec(String(url));
    var id = m ? decodeURIComponent(m[1]) : '';
    if (id === 'school-events-demo') return response(200, D.schoolIcs);
    if (D.failingCalendars.indexOf(id) !== -1) return response(429, 'Too Many Requests');
    var teamId = id.replace(/^demo-cal-/, '');
    return response(200, D.ics[teamId] || 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n');
  }
  var current = function () {
    var id = readStore(STUDENT_KEY) || D.demo.defaultStudent;
    return D.demo.students.filter(function (s) { return s.id === id; })[0] || D.demo.students[0];
  };

  L.bind({
    SpreadsheetApp: { openById: function (id) { if (!WORKBOOKS[id]) throw new Error('Unknown spreadsheet ' + id); return WORKBOOKS[id]; } },
    CacheService: { getScriptCache: function () { return cache; } },
    PropertiesService: { getScriptProperties: function () { return props; } },
    DriveApp: {
      getFileById: function (id) { if (!WORKBOOKS[id]) throw new Error('Not found'); return { getName: function () { return id; }, getLastUpdated: function () { return new Date(Date.UTC(2026, 8, 23, 7, 2)); } }; },
      getFolderById: function () { return { getFilesByName: function () { return { hasNext: function () { return false; } }; } }; }
    },
    UrlFetchApp: { fetch: function (url) { return fetchOne(url); }, fetchAll: function (reqs) { return reqs.map(function (r) { return fetchOne(r.url); }); } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Session: {
      getActiveUser: function () { return { getEmail: function () { return current().email; } }; },
      getEffectiveUser: function () { return { getEmail: function () { return 'itscripts@example.edu'; } }; },
      getScriptTimeZone: function () { return 'America/New_York'; }
    },
    Utilities: {
      formatDate: formatDate,
      computeDigest: function (alg, str) { var h = 0, out = []; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; for (var j = 0; j < 16; j++) out.push(((h >> (j % 4) * 8) & 255) - 128); return out; },
      DigestAlgorithm: { MD5: 'MD5' },
      getUuid: function () { return 'demo-' + Math.random().toString(36).slice(2); }
    },
    Logger: { log: function () { if (window.console && window.PORTAL_DEBUG) console.log.apply(console, ['[Logger]'].concat([].slice.call(arguments))); } },
    ScriptApp: { getService: function () { return { getUrl: function () { return ''; } }; }, getProjectTriggers: function () { return []; } },
    HtmlService: null, MailApp: { sendEmail: function () {} }, GmailApp: { sendEmail: function () {} },
    BellHub: { getLobbyForDate: function (iso) { return D.bellFor(iso); } },
    AdminDirectory: null
  });

  /* ---------- Config.gs, the demo's own version ---------- */
  var G = window;
  G.APP_NAME = 'Student Portal'; G.APP_VERSION = 'demo-p14'; G.TIMEZONE = 'America/New_York';
  G.YEAR_START = '2026-09-08'; G.DEFAULT_QUARTER_DATES = D.quarterDates;
  G.STUDENTS_OU_PREFIX = '/Students'; G.WORKSPACE_DOMAIN = 'example.edu'; G.SCHEMA_NAME = 'SIS'; G.SCHEMA_FIELD_FACTS_ID = 'facts_id';
  G.SHARED_FOLDER_ID = 'demo-folder'; G.STAGING_SHEET_NAME = 'FACTS_API_Sync_STAGING';
  G.STAGING_TABS = [
    { name: 'Student Schedules' }, { name: 'Period Times' },
    { name: 'Provisioning', keep: ['Student ID', 'First Name', 'Last Name', 'Nickname', 'Grade Level', 'Homeroom', 'Email'] },
    { name: 'Sheet1', keep: ['Student ID (System)', 'LastName FirstName', 'Grade Level', 'Homeroom', 'Homeroom Teacher', 'Gender'], dedupeBy: 'Student ID (System)' },
    { name: 'Staff', keep: ['First Name', 'Last Name', 'Active', 'Email'] }
  ];
  G.ATTENDANCE_TODAY_TAB = 'Attendance Today'; G.ATTENDANCE_TODAY_KEEP = ['Student ID', 'Date', 'Code', 'Status', 'Detail', 'Excused']; G.ATTENDANCE_TODAY_TTL_SECS = 300;
  G.DATA_SHEET_NAME = 'Student_Portal_DATA';
  G.DATA_TABS = { homework: 'Homework', assignments: 'Assignments', grades: 'Grades', averages: 'Averages', attendance: 'Attendance', meta: 'Meta', userState: 'UserState', log: 'SyncLog', adminViews: 'AdminViews' };
  G.ADMIN_VIEWS_KEEP = 5000; G.ATHLETICS_TEAMS = D.teams; G.SCHOOL_CALENDAR_ID = 'school-events-demo';
  G.PROP_ATHLETICS_ENABLED = 'ATHLETICS_ENABLED'; G.PROP_ATTENDANCE_ENABLED = 'ATTENDANCE_ENABLED'; G.PROP_AVERAGES_ENABLED = 'AVERAGES_ENABLED';
  // News & Info (phase 2/3 upstream): the memo-check sheet's tabs and the flag, as Config.gs declares them.
  G.PROP_MEMO_SHEET_ID = 'MEMO_CHECK_SHEET_ID'; G.CHAPEL_TAB = 'Chapel';
  G.CHAPEL_KEEP = ['CreatedAt', 'EmailDate', 'WeekOf', 'Day', 'Date', 'Display', 'Time', 'NoChapel']; G.CHAPEL_TTL_SECS = 3600;
  G.MEMO_NOTES_TAB = 'MemoNotes'; G.MEMO_NOTES_KEEP = ['CreatedAt', 'EmailDate', 'WeekOf', 'Kind', 'Day', 'Date', 'Title'];
  G.PROP_NEWS_ENABLED = 'NEWS_ENABLED';
  G.PROP_ADMIN_EMAILS = 'ADMIN_EMAILS'; G.PROP_STAGING_SHEET_ID = 'STAGING_SHEET_ID'; G.PROP_DATA_SHEET_ID = 'DATA_SHEET_ID';
  G.PROP_QUARTER_DATES = 'QUARTER_DATES'; G.PROP_TERM_ID = 'TERM_ID'; G.PROP_ROLLOVER_TIME = 'ROLLOVER_TIME'; G.DEFAULT_ROLLOVER_TIME = '16:00';
  G.PROP_DATA_VERSION = 'DATA_VERSION'; G.PROP_STAGING_CONTENT_VERSION = 'STAGING_CONTENT_VERSION'; G.PROP_GRADES_VERSION = 'GRADES_VERSION'; G.PROP_BOOT_SALT = 'BOOT_SALT';
  G.BOOT_CACHE_TTL_SECS = 21600; G.STAGING_VERSION_TTL = 900; G.PREFS_CACHE_TTL_SECS = 21600;
  G.props_ = function () { return props; };
  G.requireOperator_ = function () { throw new Error('Not authorized.'); };
  G.getRolloverMin_ = function () { return 16 * 60; };
  G.getAdminEmails_ = function () { return []; };
  G.getQuarterDatesRaw_ = function () { return props.getProperty('QUARTER_DATES') || G.DEFAULT_QUARTER_DATES; };
  G.getTermId_ = function () { return '1'; };
  G.averagesEnabled_ = function () { return props.getProperty('AVERAGES_ENABLED') === '1'; };
  G.athleticsEnabled_ = function () { return props.getProperty('ATHLETICS_ENABLED') === '1'; };
  G.attendanceEnabled_ = function () { return props.getProperty('ATTENDANCE_ENABLED') === '1'; };
  G.newsEnabled_ = function () { return props.getProperty('NEWS_ENABLED') === '1'; };
  G.getStagingSheetId_ = function () { return 'staging-demo'; };
  G.getDataSheetId_ = function () { return 'data-demo'; };
  G.appUrl_ = function () { return '#'; };
  G.withAccountChooser_ = function (url) { return url; };
  // Auth.gs in production: the signed-in Workspace account -> directory lookup -> student id. The demo answers
  // with whichever fabricated student the switcher chose. `as` (admin support view) is never honoured here.
  G.resolveCaller_ = function () {
    var s = current();
    return { email: s.email, isStudent: true, isAdmin: false, studentId: s.id, viewingAs: '', ou: '/Students', suspended: false,
      factsId: s.id, fullName: s.name, lookupError: '', denyReason: '' };
  };

  /* ---------- boot-time pieces the sync would have written ----------
     Meta.lastSyncAt is relative to the visitor's real clock (the page prints "updated N min ago" against
     Date.now()), and noSchoolDays is produced by the app's own noSchoolDaysCached_ — bells plus the school
     calendar, through SchoolCal.classify — exactly the way the sync computes it. */
  (function stampMeta() {
    var meta = data.sheets.Meta;
    var t = new Date(Date.now() - 18 * 60000);
    var local = t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate()) + ' ' + p2(t.getHours()) + ':' + p2(t.getMinutes()) + ':' + p2(t.getSeconds());
    meta.appendRow(['lastSyncAt', local]);
    var today = formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
    var ns = L.noSchoolDaysCached_(L.Due.addDays(today, -30), L.Due.addDays(today, 45));
    meta.appendRow(['noSchoolDays', Object.keys(ns.days).sort().join(',')]);
    meta.appendRow(['noSchoolComplete', String(ns.complete)]);
  })();

  /* ---------- the server methods the page calls ---------- */
  window.MOCK_BACKEND = {
    bootApi: function (asId, sim) { return L.bootApi('', ''); },   // the pinned clock already applies; admin-only sim is not honoured
    athleticsApi: function (asId) { return L.athleticsApi(''); },
    gradesApi: function (asId) { return L.gradesApi(''); },
    savePrefsApi: function (asId, raw) { var r = L.savePrefsApi('', raw); writeStore(PREFS_KEY, data.sheets.Prefs.values); return r; },
    inboxApi: function (asId) { return L.inboxApi(''); },
    attendanceApi: function (asId) { return L.attendanceApi(''); }
  };

  // What doGet injects into the page: the boot object and the inline payload.
  window.PORTAL_DEMO = {
    boot: function () {
      var s = current();
      return { appName: G.APP_NAME, appVersion: G.APP_VERSION, email: s.email, fullName: s.name, isAdmin: false, viewingAs: '', asId: '',
        ou: '/Students', factsId: s.id, denyReason: '', lookupError: '', ok: true, switchUrl: '#',
        // Always set: it tells the page this is a simulated clock, which also keeps it from caching the demo in localStorage.
        sim: pinnedLabel(), serverTime: formatDate(new Date(), G.TIMEZONE, 'EEE MMM d, yyyy h:mm a z') };
    },
    bootData: function () { try { return L.bootApi('', ''); } catch (e) { if (window.console) console.error(e); return null; } },
    pinnedLabel: pinnedLabel,
    student: current,
    data: data, staging: staging
  };

  // The simulated-clock bar the template renders for admins: here it is the honest label for every visitor.
  // No ?sim= hint — the page runs in the frame, so visitors move the clock with the frame's Clock picker.
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.getElementById('demoSimbar');
    if (bar) { bar.textContent = 'Demo clock · ' + pinnedLabel(); bar.hidden = false; }
  });
})();
