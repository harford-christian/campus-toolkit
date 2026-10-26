/* mock.js — the onboarding tracker demo's stand-in for Google.

   logic.js is the app's own Code.js (see build-logic.mjs). This file gives it:
     1. the sheet id the public copy leaves out, and the sheet itself: Onboarding_Log with the header row Code.js
        documents (columns A–Y). Like Google Sheets, a typed date ("11/16/2026", "2026-11-08") becomes a Date when
        it is written, which is what the dashboard's countdown badges and start-date sort read;
     2. GmailApp over the identity platform's emails (data.js), with read / unread state, so the REAL 10-minute
        sync (processInboundOnboarding) does the parsing, the status rules and the discussion log;
     3. the replay: on a fresh visit the history in data.js runs through the real sync, the real checklist endpoint
        and the real manual-entry endpoint, so every row on the dashboard is the app's own output;
     4. window.MOCK_BACKEND: the four server methods the dashboard calls, each the vendored function itself.
   State lives in sessionStorage for the visit; Reset clears it. */
(function () {
  'use strict';
  var D = window.ONBOARD_DATA, L = window.ONBOARD_LOGIC, KEY = 'onboard-demo-state-v1';
  var HEADERS = ['Approval ID', 'Status', 'UID Portal Link', 'First Name', 'Last Name', 'Email', 'Start Date', 'Department', 'Role',
    'Manager', 'Location', 'Discussion Log', 'IT: Create Google Account', 'IT: Assign Equipment', 'IT: Create ID/Badge Access',
    'HR: Offer Letter Signed', 'HR: I-9 Verification', 'HR: Direct Deposit Setup', 'HR: Handbook Acknowledged',
    'HR: Orientation Scheduled', 'HR: Emergency Contacts Collected', 'HR: Benefits Enrollment', 'HR: ID/Badge Issued',
    'Last Updated', 'Initial Entry Date'];

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  // Dates survive the round trip through JSON as {"$d": ms}.
  function enc(v) { return JSON.stringify(v, function (k, x) { var raw = this[k]; return raw instanceof Date ? { $d: raw.getTime() } : x; }); }
  function dec(s) { return JSON.parse(s, function (k, x) { return x && typeof x === 'object' && typeof x.$d === 'number' ? new Date(x.$d) : x; }); }
  function load() { var s = store(); if (!s) return null; try { var t = s.getItem(KEY); return t ? dec(t) : null; } catch (e) { return null; } }
  var state = null;
  function persist() { var s = store(); if (!s) return; try { s.setItem(KEY, enc(state)); } catch (e) {} }

  /* ------------------------------------------------------------------ SpreadsheetApp */
  // What Sheets does to a typed value: a date string becomes a Date (US month/day/year, or ISO year-month-day).
  function typed(v) {
    if (typeof v !== 'string') return v;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return v;
  }
  function Range(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  Range.prototype.getValues = function () {
    var out = [];
    for (var i = 0; i < this.nr; i++) {
      var row = this.sh.v[this.r - 1 + i] || [], o = [];
      for (var j = 0; j < this.nc; j++) { var x = row[this.c - 1 + j]; o.push(x === undefined || x === null ? '' : x); }
      out.push(o);
    }
    return out;
  };
  Range.prototype.getValue = function () { return this.getValues()[0][0]; };
  Range.prototype.setValues = function (vals) {
    for (var i = 0; i < this.nr; i++) {
      var row = this.sh.v[this.r - 1 + i] = this.sh.v[this.r - 1 + i] || [];
      for (var j = 0; j < this.nc; j++) row[this.c - 1 + j] = typed(vals[i][j]);
    }
    persist(); return this;
  };
  Range.prototype.setValue = function (x) { return this.setValues([[x]]); };
  function Sheet(v) { this.v = v; }
  Sheet.prototype.getLastRow = function () { return this.v.length; };
  Sheet.prototype.getLastColumn = function () { return this.v.reduce(function (m, r) { return Math.max(m, r.length); }, 0); };
  Sheet.prototype.getDataRange = function () { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), HEADERS.length); };
  Sheet.prototype.getRange = function (r, c, nr, nc) { return new Range(this, r, c, nr, nc); };
  var SpreadsheetApp = {
    openById: function (id) {
      if (id !== window.SPREADSHEET_ID) throw new Error('Spreadsheet not found: ' + id);
      return { getSheetByName: function (n) { return n === L.TAB_NAME ? new Sheet(state.sheet) : null; } };
    }
  };

  /* ------------------------------------------------------------------ GmailApp: one label, read / unread */
  function arrived() { return D.emails.filter(function (e) { return !e.arriving || state.arrived[e.id]; }); }
  function msgObj(e) {
    return {
      getSubject: function () { return e.subject; }, getBody: function () { return e.html; }, getDate: function () { return new Date(e.at); },
      isUnread: function () { return !state.read[e.id]; }
    };
  }
  function threadObj(tid) {
    var mine = arrived().filter(function (e) { return e.thread === tid; });
    return { getMessages: function () { return mine.map(msgObj); },
             markRead: function () { mine.forEach(function (e) { state.read[e.id] = true; }); persist(); return this; } };
  }
  var GmailApp = {
    search: function (q) {
      if (q.indexOf('label:"' + L.GMAIL_LABEL + '"') < 0) return [];
      var unreadOnly = /is:unread/.test(q), seen = {}, out = [];
      arrived().forEach(function (e) {
        if ((unreadOnly && state.read[e.id]) || seen[e.thread]) return;
        seen[e.thread] = true; out.push(threadObj(e.thread));
      });
      return out;
    }
  };

  /* ------------------------------------------------------------------ the rest */
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function formatDate(d, tz, fmt) {
    return String(fmt).replace(/yyyy|MM|dd|HH|mm/g, function (t) {
      return t === 'yyyy' ? d.getFullYear() : t === 'MM' ? p2(d.getMonth() + 1) : t === 'dd' ? p2(d.getDate()) : t === 'HH' ? p2(d.getHours()) : p2(d.getMinutes());
    });
  }
  window.SPREADSHEET_ID = 'onboarding-demo-sheet';       // the real Code.js constant, left out of the public copy
  L.bind({
    SpreadsheetApp: SpreadsheetApp, GmailApp: GmailApp, HtmlService: null,
    Session: { getScriptTimeZone: function () { return 'America/New_York'; } },
    Utilities: { formatDate: formatDate }
  });

  /* ------------------------------------------------------------------ boot: replay data.js's history */
  function rowIdOf(appId) { return String(L.findRowById(new Sheet(state.sheet), appId)); }
  function replay() {
    state = { v: 1, sheet: [HEADERS.slice()], read: {}, arrived: {} };
    L.processInboundOnboarding();                                    // every email that has already arrived
    Object.keys(D.ticks).forEach(function (id) {
      D.ticks[id].forEach(function (col) { var r = L.updateChecklistItem(rowIdOf(id), col, '✅'); if (r !== 'Success') throw new Error(r); });
    });
    var res = L.addManualOnboardingRequest(D.manual);
    if (res !== 'Success') throw new Error(res);
    D.emails.forEach(function (e) { if (e.arriving) state.arrived[e.id] = true; });   // then two more land, unread
    persist();
  }
  state = load();
  if (!state || state.v !== 1) replay();

  window.MOCK_BACKEND = {
    getDashboardData: function () { return L.getDashboardData(); },
    updateChecklistItem: function (rowId, colKey, newVal) { return L.updateChecklistItem(rowId, colKey, newVal); },
    manualOverrideStatus: function (rowId, newStatus) { return L.manualOverrideStatus(rowId, newStatus); },
    addManualOnboardingRequest: function (data) { return L.addManualOnboardingRequest(data); }
  };
  window.ONBOARD_DEMO = {
    emails: function () { return arrived().map(function (e) { return { id: e.id, at: e.at, subject: e.subject, html: e.html, unread: !state.read[e.id] }; }); },
    unread: function () { return arrived().filter(function (e) { return !state.read[e.id]; }).length; },
    sync: function () { var before = state.sheet.length; L.processInboundOnboarding(); return { added: state.sheet.length - before }; },
    sheet: function () { return state.sheet; },
    headers: HEADERS,
    reset: function () { var s = store(); if (s) s.removeItem(KEY); }
  };
})();
