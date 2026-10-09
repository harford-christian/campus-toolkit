/* mock.js — the demo's stand-in for Google.

   1. In-memory Google services the vendored code (logic.js) reaches for: a spreadsheet with the app's own
      tabs (seeded from the app's verbatim defaults plus data.js), a Drive just real enough for uploads and the
      year-end archive, a cache, script properties with the two signing secrets, the sibling forms project
      behind UrlFetchApp (the master roster and the one-time-code endpoints), and a mail service that keeps an
      outbox instead of sending. The whole workbook persists in sessionStorage for the visit, so a school's
      submission on the form shows up on the admin page.
   2. window.MOCK_BACKEND — every google.script.run method the two pages call, delegating to the real code.
      (On the Spelling Bee and Creative Writing pages, mock-competitions.js takes over after the Drive section.)
      Two deliberate stand-ins: the "seed historical data" action runs the project's SAFE sample generator (the
      real one needs a file of real names that is never vendored), and the one-time code is always 123456. */
(function () {
  'use strict';
  var D = window.MACS_DATA, L = window.MACS_LOGIC;
  var STATE_KEY = 'macs-demo-workbook-v1', OUTBOX_KEY = 'macs-demo-outbox';
  var IS_ADMIN_PAGE = /admin\.html$/.test(String(window.location && window.location.pathname || ''));

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function readStore(k) { var s = store(); if (!s) return null; try { return JSON.parse(s.getItem(k) || 'null'); } catch (e) { return null; } }
  function writeStore(k, v) { var s = store(); if (!s) return; try { s.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- Sheets ---------- */
  var nextId = 1;
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function Sheet(wb, name, values) { this.wb = wb; this.name = name; this.values = (values || []).map(function (r) { return r.slice(); }); }
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.setName = function (n) { delete this.wb.sheets[this.name]; this.name = n; this.wb.sheets[n] = this; return this; };
  Sheet.prototype.getDataRange = function () { var v = this.values; return { getValues: function () { return v.map(function (r) { return r.slice(); }); } }; };
  Sheet.prototype.getLastRow = function () { return this.values.length; };
  Sheet.prototype.getMaxRows = function () { return Math.max(this.values.length, 1); };
  Sheet.prototype.getMaxColumns = function () { return Math.max.apply(null, [1].concat(this.values.map(function (r) { return r.length; }))); };
  Sheet.prototype.appendRow = function (row) { this.values.push(row.slice()); this.wb.touch(); return this; };
  Sheet.prototype.deleteRow = function (r) { this.values.splice(r - 1, 1); this.wb.touch(); return this; };
  Sheet.prototype.clear = function () { this.values = []; this.wb.touch(); return this; };
  Sheet.prototype.clearContents = function () { this.values = []; this.wb.touch(); return this; };
  Sheet.prototype.setFrozenRows = function () { return this; };
  Sheet.prototype.copyTo = function (target) { var s = new Sheet(target, 'Copy of ' + this.name, this.values); target.sheets[s.name] = s; return s; };
  Sheet.prototype.getRange = function (r, c, n, m) {
    var self = this; n = n || 1; m = m || 1;
    return {
      setValues: function (vals) {
        for (var i = 0; i < n; i++) { self.values[r - 1 + i] = self.values[r - 1 + i] || []; for (var j = 0; j < m; j++) self.values[r - 1 + i][c - 1 + j] = vals[i][j]; }
        self.wb.touch();
      },
      setValue: function (v) { self.values[r - 1] = self.values[r - 1] || []; self.values[r - 1][c - 1] = v; self.wb.touch(); },
      getValues: function () { var out = []; for (var i = 0; i < n; i++) { var row = self.values[r - 1 + i] || []; out.push(row.slice(c - 1, c - 1 + m)); } return out; },
      clearNote: function () {}
    };
  };
  function Workbook(id, name) { this.id = id; this.name = name; this.sheets = {}; this.onTouch = null; }
  Workbook.prototype.getId = function () { return this.id; };
  Workbook.prototype.getUrl = function () { return 'https://example.invalid/sheets/' + this.id; };
  Workbook.prototype.getName = function () { return this.name; };
  Workbook.prototype.getSheetByName = function (n) { return this.sheets[n] || null; };
  Workbook.prototype.insertSheet = function (n) { this.sheets[n] = new Sheet(this, n, []); this.touch(); return this.sheets[n]; };
  Workbook.prototype.getSheets = function () { var self = this; return Object.keys(this.sheets).map(function (k) { return self.sheets[k]; }); };
  Workbook.prototype.deleteSheet = function (sh) { delete this.sheets[sh.getName()]; };
  Workbook.prototype.touch = function () { if (this.onTouch) this.onTouch(); };
  // Persisted the way Sheets would hand it back: a Date cell becomes the same 'yyyy-MM-dd HH:mm:ss' text the
  // app's timestampToString_ produces, so a timestamp written on the form page reads cleanly on the admin page.
  Workbook.prototype.dump = function () {
    var o = {}; var self = this;
    Object.keys(this.sheets).forEach(function (k) {
      o[k] = self.sheets[k].values.map(function (row) { return row.map(function (v) {
        if (Object.prototype.toString.call(v) !== '[object Date]') return v;
        return v.getFullYear() + '-' + p2(v.getMonth() + 1) + '-' + p2(v.getDate()) + ' ' + p2(v.getHours()) + ':' + p2(v.getMinutes()) + ':' + p2(v.getSeconds());
      }); });
    });
    return o;
  };
  Workbook.prototype.load = function (tabs) { var self = this; this.sheets = {}; Object.keys(tabs).forEach(function (k) { self.sheets[k] = new Sheet(self, k, tabs[k]); }); };

  /* ---------- Drive ---------- */
  var files = {};
  function Folder(name) { this.id = 'folder-' + (nextId++); this.name = name; this.folders = []; this.files = []; files[this.id] = this; }
  function iter(list) { var i = 0; return { hasNext: function () { return i < list.length; }, next: function () { return list[i++]; } }; }
  Folder.prototype.getName = function () { return this.name; };
  Folder.prototype.getId = function () { return this.id; };
  Folder.prototype.getFoldersByName = function (n) { return iter(this.folders.filter(function (f) { return f.name === n; })); };
  Folder.prototype.createFolder = function (n) { var f = new Folder(n); this.folders.push(f); return f; };
  Folder.prototype.createFile = function (blob) { var f = new File(blob.name, blob); this.files.push(f); f.parents.push(this); return f; };
  Folder.prototype.addFile = function (f) { if (this.files.indexOf(f) === -1) { this.files.push(f); f.parents.push(this); } };
  Folder.prototype.removeFile = function (f) { this.files = this.files.filter(function (x) { return x !== f; }); f.parents = f.parents.filter(function (p) { return p !== this; }, this); };
  function File(name, blob, id) { this.id = id || ('file-' + (nextId++)); this.name = name; this.blob = blob; this.parents = []; files[this.id] = this; }
  File.prototype.getName = function () { return this.name; };
  File.prototype.getId = function () { return this.id; };
  File.prototype.getUrl = function () { return 'https://example.invalid/drive/' + this.id + '/' + encodeURIComponent(this.name); };
  File.prototype.setSharing = function () { return this; };
  File.prototype.getParents = function () { return iter(this.parents.slice()); };
  var root = new Folder('My Drive');
  var workbooks = {};
  function registerWorkbook(wb) { workbooks[wb.id] = wb; var f = new File(wb.name, null, wb.id); root.addFile(f); return wb; }

  /* ---------- the Spelling Bee and Creative Writing pages ----------
     Separate single-form Apps Script projects with their own Sheets: mock-competitions.js (loaded with their
     server bundle) seeds that project's Sheet over these same in-memory Sheets and Drive and answers its calls. */
  if (window.MACS_COMPETITION) {
    window.MOCK_BACKEND = window.MACS_COMPETITION.boot({ Workbook: Workbook, root: root, files: files,
      registerWorkbook: registerWorkbook, readStore: readStore, writeStore: writeStore, data: D });
    return;
  }

  /* ---------- the live workbook ---------- */
  var live = registerWorkbook(new Workbook('macs-live', 'MACS Secondary Scheduling'));
  var saved = readStore(STATE_KEY);
  if (saved) {
    live.load(saved);
  } else {
    var S = L.SHEETS;
    live.insertSheet(S.SUBMISSIONS).values = [L.SUBMISSIONS_HEADERS.slice()];
    live.insertSheet(S.REGISTRATIONS).values = [L.REGISTRATIONS_HEADERS.slice()];
    live.insertSheet(S.JUDGES).values = [L.JUDGES_HEADERS.slice()].concat(D.judges.map(function (r) { return r.slice(); }));
    live.insertSheet(S.SCHOOLS).values = [L.SCHOOLS_HEADERS.slice()].concat(D.schools.map(function (r) { return r.slice(); }));
    live.insertSheet(S.CATEGORY_CONFIG).values = [L.DEFAULT_CATEGORY_CONFIG_HEADERS.slice()].concat(L.DEFAULT_CATEGORY_CONFIG.map(function (r) { return r.slice(); }));
    live.insertSheet(S.FIELD_TEMPLATES).values = [L.FIELD_TEMPLATES_HEADERS.slice()].concat(L.DEFAULT_FIELD_TEMPLATES.map(function (r) { return r.slice(); }));
    live.insertSheet(S.JUDGING_SHEETS).values = [L.JUDGING_SHEETS_HEADERS.slice()].concat(D.judgingSheets.map(function (r) { return r.slice(); }));
    live.insertSheet(S.SETTINGS).values = [['Setting', 'Value']].concat(L.DEFAULT_SETTINGS.map(function (r) {
      return [r[0], Object.prototype.hasOwnProperty.call(D.settingsOverrides, r[0]) ? D.settingsOverrides[r[0]] : r[1]];
    }));
    Object.keys(D.settingsOverrides).forEach(function (k) {
      if (!L.DEFAULT_SETTINGS.some(function (r) { return r[0] === k; })) live.sheets[S.SETTINGS].values.push([k, D.settingsOverrides[k]]);
    });
    live.insertSheet('Building Map').values = [['Room', 'Building']].concat(Object.keys(L.DEFAULT_BUILDINGS).map(function (room) { return [room, L.DEFAULT_BUILDINGS[room]]; }));
    live.insertSheet(S.MASTER); live.insertSheet(S.CATEGORY_COUNTS); live.insertSheet(S.SCHEDULE);
    live.insertSheet(S.ADMIN_EDITS_LOG).values = [['Timestamp', 'Admin', 'Entry ID', 'Change Description']];
  }

  /* ---------- the other services ---------- */
  var cacheStore = {};
  var cache = { get: function (k) { return Object.prototype.hasOwnProperty.call(cacheStore, k) ? cacheStore[k] : null; }, put: function (k, v) { cacheStore[k] = String(v); }, remove: function (k) { delete cacheStore[k]; } };
  var propStore = { APP_HANDOFF_SECRET: 'demo-handoff-secret', AUTH_HMAC_SECRET: 'demo-session-secret' };
  var props = { getProperty: function (k) { return Object.prototype.hasOwnProperty.call(propStore, k) ? propStore[k] : null; }, setProperty: function (k, v) { propStore[k] = String(v); }, deleteProperty: function (k) { delete propStore[k]; } };
  var outbox = readStore(OUTBOX_KEY) || [];
  function mail(to, subject, body) { outbox.push({ to: to, subject: subject, body: body, at: new Date().toISOString() }); writeStore(OUTBOX_KEY, outbox); }
  function response(code, body) { return { getResponseCode: function () { return code; }, getContentText: function () { return body; } }; }
  // The sibling forms project: a GET for the master roster, POSTs for the one-time code.
  function macsForms(url, opts) {
    if (/api=fineArtsConfig/.test(url)) return response(200, JSON.stringify(D.master));
    var p = (opts && opts.payload) || {};
    if (p.api === 'macsRequestOtp') {
      mail(p.email, 'Your MACS Fine Arts sign-in code', 'Your one-time code for ' + p.school + ' is ' + D.demo.code + '. It expires in 10 minutes.');
      return response(200, JSON.stringify({ ok: true }));
    }
    if (p.api === 'macsVerifyOtp') {
      if (String(p.code) !== D.demo.code) return response(200, JSON.stringify({ ok: false, code: 'CODE_INVALID', msg: 'That code is not correct. Check the email and try again.' }));
      return response(200, JSON.stringify({ ok: true, school: p.school, email: p.email }));
    }
    return response(404, 'not found');
  }
  // A deterministic 32-byte "HMAC": the vendored Auth.js only needs mint and verify to agree.
  function hmac(msg, secret) {
    var s = String(secret) + '|' + String(msg), out = [], h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    for (var j = 0; j < 32; j++) { h ^= j + 0x9e37; h = Math.imul(h, 16777619) >>> 0; out.push((h & 255) - 128); }
    return out;
  }

  L.bind({
    SpreadsheetApp: {
      getActiveSpreadsheet: function () { return live; },
      create: function (name) { return registerWorkbook(new Workbook('sheet-' + (nextId++), name)); },
      getUi: function () { throw new Error('No UI in a web app request'); }
    },
    CacheService: { getScriptCache: function () { return cache; } },
    PropertiesService: { getScriptProperties: function () { return props; } },
    DriveApp: {
      getFoldersByName: function (n) { return root.getFoldersByName(n); },
      createFolder: function (n) { return root.createFolder(n); },
      getFolderById: function () { return root; },
      getFileById: function (id) { if (!files[id]) throw new Error('Not found: ' + id); return files[id]; },
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' }
    },
    UrlFetchApp: { fetch: function (url, opts) { return macsForms(String(url), opts); } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Session: {
      getActiveUser: function () { return { getEmail: function () { return IS_ADMIN_PAGE ? D.demo.adminEmail : ''; } }; },
      getScriptTimeZone: function () { return 'America/New_York'; }
    },
    Utilities: {
      computeHmacSha256Signature: hmac,
      base64Decode: function (b64) {
        var bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
        var out = []; for (var i = 0; i < bin.length; i++) { var b = bin.charCodeAt(i); out.push(b > 127 ? b - 256 : b); } return out;
      },
      newBlob: function (bytes, mime, name) { return { bytes: bytes, mime: mime, name: name }; },
      formatDate: function (d, tz, fmt) {
        var y = d.getFullYear(), mo = p2(d.getMonth() + 1), day = p2(d.getDate()), H = p2(d.getHours()), m = p2(d.getMinutes()), s = p2(d.getSeconds());
        return fmt === 'HH:mm' ? H + ':' + m : y + '-' + mo + '-' + day + ' ' + H + ':' + m + ':' + s;
      }
    },
    Logger: { log: function () { if (window.console && window.MACS_DEBUG) console.log.apply(console, ['[Logger]'].concat([].slice.call(arguments))); } },
    HtmlService: null,
    MailApp: { sendEmail: function (to, subject, body) { mail(to, subject, body); } }
  });
  // TestData.js's clear routine reads the real historical table to know which codes to purge; the demo has none.
  window.HISTORICAL_ENTRIES = []; window.HISTORICAL_ROSTERS = {}; window.HISTORICAL_SCHOOL_NAMES = {};

  /* ---------- first boot: three schools' entries go through the REAL write path ---------- */
  if (!saved) {
    D.submitted.forEach(function (s) { L.submitSchoolEntries_(s.code, s.name, JSON.parse(JSON.stringify(s.entries)), s.contact); });
    // Backdate those registrations so they read as earlier submissions, not "just now".
    var reg = live.sheets[L.SHEETS.REGISTRATIONS], sub = live.sheets[L.SHEETS.SUBMISSIONS];
    var stamps = ['2027-01-12 09:41:00', '2027-01-15 14:08:00', '2027-01-20 11:27:00'];
    D.submitted.forEach(function (s, i) {
      reg.values.forEach(function (r) { if (String(r[1]) === s.code) r[0] = stamps[i]; });
      sub.values.forEach(function (r) { if (String(r[2]) === s.code) r[1] = stamps[i]; });
    });
  }
  live.onTouch = function () { writeStore(STATE_KEY, live.dump()); };
  if (!saved) live.touch();

  /* ---------- the server methods the pages call ---------- */
  var M = {};
  ['getSchoolList', 'getBranding', 'getCategoryList', 'getJudgingSheets', 'getPaymentInfo', 'getFieldTemplateDefs', 'checkSchoolStatus',
   'submitSchoolEntries', 'uploadEntryFile', 'requestSchoolCode', 'verifySchoolCode',
   'admin_getCategoryConfig', 'admin_saveCategoryConfig', 'admin_getFieldTemplates', 'admin_saveFieldTemplates', 'admin_getBuildingMap',
   'admin_saveBuildingMap', 'admin_getJudgingSheets', 'admin_saveJudgingSheets', 'admin_getSettings',
   'admin_saveSettings', 'admin_getJudges', 'admin_saveJudges', 'admin_getSchools', 'admin_saveSchools', 'admin_getRegistrations',
   'admin_getSubmissions', 'admin_updateSubmissionEntry', 'admin_deleteSubmissionEntry', 'admin_runClearTestData', 'admin_resetForNextYear'
  ].forEach(function (name) { M[name] = function () { return L[name].apply(null, arguments); }; });
  // The real button seeds 2023-24's actual entrants from a file this demo never ships. Same guard, safe generator.
  M.admin_runSeedHistoricalTestData = function () { L.requireAdmin_(); return L.seedTestData(); };
  window.MOCK_BACKEND = M;

  window.MACS_DEMO = {
    outbox: function () { return readStore(OUTBOX_KEY) || []; },
    workbook: live, drive: root, files: files
  };
})();
