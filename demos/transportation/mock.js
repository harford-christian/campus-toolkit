/* mock.js — the Dismissal Board demo's stand-in for Google.

   The page is the real Index.html; its pure logic (Dismissal.gs) is inlined as DismissalClient; and
   logic.js is the app's own SERVER layer, vendored verbatim by build-logic.mjs — the fifteen-odd
   google.script.run endpoints, the bundle assembly, the cache, the publish step. What this file
   supplies is the Google underneath them, over plain JavaScript:

     SpreadsheetApp   four in-memory workbooks: the FACTS staging sheet, Dismissal_WORKING, the
                      kiosk's SignInOut_DB and the campus-control master schedule
     DriveApp         the shared folder (ramp/driver JSON files land here) and the sports feed file
     CacheService     with real TTLs, so the 60 s short cache and the 3-minute board cache behave
     PropertiesService  the script properties the real deployment carries, fabricated values
     Session / Utilities / MailApp / LockService / Logger
     a PINNED CLOCK   "now" is Tuesday 2026-09-15 14:52 plus however long the page has been open,
                      applied uniformly to every Date the server formats, so attendance, sign-outs
                      and freshness all land on the dataset's day. ?sim= still time-travels the
                      BOARD exactly as it does in production (the server reads it, not the clock).

   Everything the real app would WRITE (Overrides, Standing, PickupAuth, Walkers, Roles, Notes,
   saved views, role views) persists in sessionStorage for the visit; a new tab starts clean.
   window.DISMISSAL_DEMO exposes the outbox and a reset for the verifier and the curious. */
(function () {
  'use strict';
  var D = window.DISMISSAL_DATA, L = window.DISMISSAL_LOGIC, T = D.tabs;
  var STORE_KEY = 'dismissal-demo-v2';

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function readStore() { var s = store(); if (!s) return null; try { return JSON.parse(s.getItem(STORE_KEY) || 'null'); } catch (e) { return null; } }
  function writeStore(v) { var s = store(); if (!s) return; try { s.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) {} }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---------- the pinned clock ---------- */
  var pm = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/.exec(D.demo.now);
  var pinnedUtcMs = Date.UTC(+pm[1], +pm[2] - 1, +pm[3], pm[4] === undefined ? 12 : +pm[4], pm[5] === undefined ? 0 : +pm[5]);
  var loadedAt = Date.now();
  var OFFSET = pinnedUtcMs - loadedAt;
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  /** A Date as the demo's wall clock: a UTC Date whose UTC fields ARE school time. A real-clock
      instant (now, a Drive modified-time — anything within a day of the real clock) is shifted onto
      the pinned day, so ages stay true; any other Date was CONSTRUCTED from calendar fields (a ?sim=
      day at noon, say) and is read as those fields. */
  function wall(date) {
    var t = date.getTime();
    if (Math.abs(t - Date.now()) < 86400000) return new Date(t + OFFSET);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));
  }
  function formatDate(date, tz, fmt) {
    var w = wall(date);
    var y = w.getUTCFullYear(), mo = w.getUTCMonth() + 1, d = w.getUTCDate(), H = w.getUTCHours(),
        m = w.getUTCMinutes(), s = w.getUTCSeconds(), dow = w.getUTCDay();
    return String(fmt).replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss|EEE|u/g, function (tok, lit) {
      if (lit !== undefined) return lit;
      switch (tok) {
        case 'yyyy': return String(y); case 'MM': return p2(mo); case 'dd': return p2(d);
        case 'HH': return p2(H); case 'mm': return p2(m); case 'ss': return p2(s);
        case 'EEE': return DOW[dow]; case 'u': return String(dow === 0 ? 7 : dow);
      }
      return tok;
    });
  }
  function minutesAgo(n) { return loadedAt - n * 60000; }

  /* ---------- in-memory Sheets ---------- */
  function blank(v) { return v === '' || v === null || v === undefined; }
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
  Sheet.prototype.appendRow = function (row) { this.v[this.getLastRow()] = row.slice(); return this; };
  Sheet.prototype.deleteRow = function (r) { this.v.splice(r - 1, 1); return this; };
  Sheet.prototype.getDataRange = function () { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); };
  Sheet.prototype.getRange = function (r, c, n, m) {
    var self = this; n = n || 1; m = m || 1;
    function cell(i, j) { var row = self.v[r - 1 + i]; var x = row ? row[c - 1 + j] : ''; return blank(x) ? '' : x; }
    function put(i, j, x) {
      var ri = r - 1 + i, ci = c - 1 + j;
      while (self.v.length <= ri) self.v.push([]);
      while (self.v[ri].length < ci) self.v[ri].push('');
      self.v[ri][ci] = x;
    }
    return {
      getValues: function () { var out = []; for (var i = 0; i < n; i++) { var row = []; for (var j = 0; j < m; j++) row.push(cell(i, j)); out.push(row); } return out; },
      getValue: function () { return cell(0, 0); },
      setValues: function (vals) { for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) put(i, j, vals[i][j]); return this; },
      setValue: function (x) { put(0, 0, x); return this; },
      setNumberFormat: function () { return this; },
      clearContent: function () { for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) put(i, j, ''); return this; }
    };
  };
  function Workbook(id, tabs) { this.id = id; this.sheets = {}; var self = this; Object.keys(tabs).forEach(function (n) { self.sheets[n] = new Sheet(n, tabs[n]); }); }
  Workbook.prototype.getId = function () { return this.id; };
  Workbook.prototype.getSheetByName = function (n) { return this.sheets[n] || null; };
  Workbook.prototype.insertSheet = function (n) { this.sheets[n] = new Sheet(n, []); return this.sheets[n]; };
  Workbook.prototype.getSheets = function () { var s = this.sheets; return Object.keys(s).map(function (n) { return s[n]; }); };

  var WRITABLE = ['Overrides', 'Standing', 'PickupAuth', 'Walkers', 'Roles', 'Notes'];
  var saved = readStore() || {};
  var staging = new Workbook('staging-demo', { 'Attendance Today': T['Attendance Today'], 'PickupContacts': T.PickupContacts, 'Staff': T.Staff, 'Sheet1': T.Sheet1 });
  var dismissal = new Workbook('dismissal-demo', { 'Roster': T.Roster, 'Overrides': T.Overrides, 'Standing': T.Standing, 'PickupAuth': T.PickupAuth,
    'Walkers': T.Walkers, 'Routes': T.Routes, 'Roles': T.Roles, 'Notes': T.Notes, 'Specials': T.Specials });
  var signinout = new Workbook('signinout-demo', { 'EVENTS': T.EVENTS });
  var cms = new Workbook('cms-demo', { 'Schedule': T.Schedule });
  if (saved.dismissal) Object.keys(saved.dismissal).forEach(function (n) { dismissal.sheets[n] = new Sheet(n, saved.dismissal[n]); });
  var WORKBOOKS = { 'staging-demo': staging, 'dismissal-demo': dismissal, 'signinout-demo': signinout, 'cms-demo': cms };
  // Drive modified-times, on the REAL clock so ages compute, displayed through the pinned one:
  // attendance pulled 9 minutes ago, the roster produced at 04:06, the kiosk log a minute ago.
  var STAMPS = { 'staging-demo': minutesAgo(9), 'dismissal-demo': minutesAgo(10 * 60 + 46), 'signinout-demo': minutesAgo(1), 'cms-demo': minutesAgo(90) };

  /* ---------- Drive: the shared folder and the sports feed ---------- */
  var files = { 'sports-feed-demo': { id: 'sports-feed-demo', name: 'Sports_Dismissals_TODAY.json', content: JSON.stringify(D.sportsFeed), updated: minutesAgo(8 * 60 + 47) } };
  var nextFile = 1;
  function fileObj(f) {
    return {
      getId: function () { return f.id; }, getName: function () { return f.name; },
      getLastUpdated: function () { return new Date(f.updated); },
      getBlob: function () { return { getDataAsString: function () { return f.content; } }; },
      setContent: function (c) { f.content = String(c); f.updated = Date.now(); return this; }
    };
  }
  function iterator(list) { var i = 0; return { hasNext: function () { return i < list.length; }, next: function () { return list[i++]; } }; }
  function byName(name) { return Object.keys(files).filter(function (id) { return files[id].name === name; }).map(function (id) { return fileObj(files[id]); }); }
  var folder = {
    getFilesByName: function (name) { return iterator(byName(name)); },
    createFile: function (name, content, mime) { var id = 'shared-file-' + (nextFile++); files[id] = { id: id, name: name, content: String(content), mime: mime, updated: Date.now() }; return fileObj(files[id]); }
  };
  var DriveApp = {
    getFileById: function (id) {
      if (WORKBOOKS[id]) return { getId: function () { return id; }, getName: function () { return id; }, getLastUpdated: function () { return new Date(STAMPS[id]); } };
      if (files[id]) return fileObj(files[id]);
      throw new Error('File not found: ' + id);
    },
    getFolderById: function () { return folder; },
    getFilesByName: function (name) { return iterator(byName(name)); }
  };

  /* ---------- cache (with TTLs) and script properties ---------- */
  var cacheStore = {};
  function alive(k) { var e = cacheStore[k]; if (!e) return false; if (e.until && e.until < Date.now()) { delete cacheStore[k]; return false; } return true; }
  var cache = {
    get: function (k) { return alive(k) ? cacheStore[k].v : null; },
    put: function (k, v, ttl) { cacheStore[k] = { v: String(v), until: ttl ? Date.now() + ttl * 1000 : 0 }; },
    remove: function (k) { delete cacheStore[k]; },
    getAll: function (keys) { var o = {}; (keys || []).forEach(function (k) { if (alive(k)) o[k] = cacheStore[k].v; }); return o; },
    putAll: function (obj, ttl) { var self = this; Object.keys(obj).forEach(function (k) { self.put(k, obj[k], ttl); }); },
    removeAll: function (keys) { (keys || []).forEach(function (k) { delete cacheStore[k]; }); }
  };
  var propStore = saved.props || {
    STAGING_SHEET_ID: 'staging-demo', DISMISSAL_SHEET_ID: 'dismissal-demo', DB_SHEET_ID: 'signinout-demo', CMS_SHEET_ID: 'cms-demo',
    SPORTS_FEED_FILE_ID: 'sports-feed-demo', ALLOWED_EMAILS: D.demo.email, PRESENCE_URL: '../campus-presence/index.html',
    PICKUP_AUTH_NOTIFY: 'office.demo@example.edu', ROLE_VIEWS: JSON.stringify(D.roleViews)
  };
  var props = {
    getProperty: function (k) { return Object.prototype.hasOwnProperty.call(propStore, k) ? propStore[k] : null; },
    setProperty: function (k, v) { propStore[k] = String(v); return this; },
    deleteProperty: function (k) { delete propStore[k]; return this; },
    getProperties: function () { return clone(propStore); }
  };

  /* ---------- the rest ---------- */
  var outbox = saved.outbox || [];
  var uuidN = 0;
  L.bind({
    SpreadsheetApp: { openById: function (id) { if (!WORKBOOKS[id]) throw new Error('Unknown spreadsheet ' + id); return WORKBOOKS[id]; }, flush: function () {} },
    DriveApp: DriveApp,
    CacheService: { getScriptCache: function () { return cache; } },
    PropertiesService: { getScriptProperties: function () { return props; } },
    Session: {
      getActiveUser: function () { return { getEmail: function () { return D.demo.email; } }; },
      getEffectiveUser: function () { return { getEmail: function () { return 'itscripts@example.edu'; } }; },
      getScriptTimeZone: function () { return 'America/New_York'; }
    },
    Utilities: {
      formatDate: formatDate,
      getUuid: function () { uuidN++; var r = Math.random().toString(16).slice(2, 10); return (r + '00000000').slice(0, 8) + '-demo-4000-8000-' + ('000000000000' + uuidN).slice(-12); },
      formatString: function (f) { var a = [].slice.call(arguments, 1), i = 0; return String(f).replace(/%[sd]/g, function () { return String(a[i++]); }); },
      sleep: function () {}
    },
    MailApp: { sendEmail: function (opts) { outbox.push(clone(opts)); } },
    ScriptApp: { getService: function () { return { getUrl: function () { return ''; } }; }, getProjectTriggers: function () { return []; } },
    LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, waitLock: function () {}, releaseLock: function () {}, hasLock: function () { return true; } }; } },
    HtmlService: null,
    AdminDirectory: { Users: { get: function () { throw new Error('the demo has no directory — the allowlist decides'); } } },
    Logger: { log: function () { if (window.console && window.DISMISSAL_DEBUG) console.log.apply(console, ['[Logger]'].concat([].slice.call(arguments))); } }
  });

  /* ---------- persistence and the page's methods ---------- */
  function persist() {
    var tabs = {};
    WRITABLE.forEach(function (n) { if (dismissal.sheets[n]) tabs[n] = dismissal.sheets[n].v; });
    writeStore({ dismissal: tabs, props: propStore, outbox: outbox });
  }
  var METHODS = ['dismissalApi', 'pickupsApi', 'setOverride', 'setOverrides', 'plannedApi', 'historyApi', 'setStanding', 'setWalker',
    'removeWalker', 'pickupAuthContacts', 'pickupAuthSave', 'pickupAuthDelete', 'noteAdd', 'noteDelete', 'saveView', 'rolesApi',
    'saveRoleView', 'addRoleMember', 'removeRoleMember'];
  var backend = {};
  METHODS.forEach(function (name) {
    backend[name] = function () {
      var out;
      try { out = L[name].apply(null, arguments); }
      finally { persist(); }
      return out;
    };
  });
  window.MOCK_BACKEND = backend;
  window.DISMISSAL_DEMO = {
    outbox: outbox, workbooks: WORKBOOKS, props: propStore, files: files,
    pinnedNow: function () { return formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd HH:mm'); },
    reset: function () { var s = store(); if (s) s.removeItem(STORE_KEY); window.location.reload(); }
  };
})();
