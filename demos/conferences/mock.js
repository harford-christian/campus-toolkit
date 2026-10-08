/* mock.js — the demo's stand-in for Google. Two halves:

   1. An in-memory Google Sheets. The source project's server code (logic.js, vendored verbatim)
      reads and writes through SpreadsheetApp / LockService / Session / Utilities. Those are
      implemented here over plain arrays, so the app's own functions run unchanged in the
      browser. Blocks and Bookings persist in sessionStorage for the visit, which is what lets a
      booking made on the Parent screen appear on the Teacher screen (and a teacher's block
      grey out on the parent's sheet). Closing the tab resets the demo.

   2. window.MOCK_BACKEND — the seven google.script.run methods the two pages call, each
      delegating to the real function. Only sign-in is faked: production verifies a signed
      hand-off ticket from the school's parent portal; here any ticket signs in the demo guardian. */
(function () {
  'use strict';
  var DATA = window.PTC_DATA, L = window.PTC_LOGIC;
  var STATE_KEY = 'ptc-demo-state-v1', TEACHER_KEY = 'ptc-demo-teacher', OUTBOX_KEY = 'ptc-demo-outbox';

  /* ---------- in-memory Sheets ---------- */
  function Sheet(values) { this.values = values.map(function (r) { return r.slice(); }); }
  Sheet.prototype.getDataRange = function () {
    var v = this.values;
    return { getValues: function () { return v.map(function (r) { return r.slice(); }); } };
  };
  Sheet.prototype.appendRow = function (row) { this.values.push(row.slice()); onWrite(); };
  Sheet.prototype.deleteRow = function (r) { this.values.splice(r - 1, 1); onWrite(); };
  Sheet.prototype.clearContents = function () { this.values = []; };
  Sheet.prototype.getRange = function (r, c, n, m) {
    var self = this;
    return {
      setValues: function (vals) {
        for (var i = 0; i < n; i++) {
          self.values[r - 1 + i] = self.values[r - 1 + i] || [];
          for (var j = 0; j < m; j++) self.values[r - 1 + i][c - 1 + j] = vals[i][j];
        }
      }
    };
  };
  function Workbook(tabs) {
    this.sheets = {};
    var self = this;
    Object.keys(tabs).forEach(function (n) { self.sheets[n] = new Sheet(tabs[n]); });
  }
  Workbook.prototype.getSheetByName = function (n) { return this.sheets[n] || null; };

  var facts = new Workbook(DATA.facts);
  var local = new Workbook(DATA.local);
  var booting = true;

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function readStore(key) {
    var s = store(); if (!s) return null;
    try { return JSON.parse(s.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    var s = store(); if (!s) return;
    try { s.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable: the visit just won't persist across screens */ }
  }
  function onWrite() {
    if (booting) return;
    writeStore(STATE_KEY, { Blocks: local.sheets.Blocks.values, Bookings: local.sheets.Bookings.values });
  }

  var outbox = readStore(OUTBOX_KEY) || [];

  L.bind({
    SpreadsheetApp: {
      getActive: function () { return local; },
      openById: function (id) {
        if (id !== 'facts-export-demo') throw new Error('Unknown spreadsheet id ' + id);
        return facts;
      }
    },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Session: {
      getActiveUser: function () {
        return { getEmail: function () { return readStore(TEACHER_KEY) || DATA.demo.teacherEmail; } };
      },
      getScriptTimeZone: function () { return 'America/New_York'; }
    },
    Utilities: {
      // Only reached if a Date object ever lands in a Sheet cell; the demo's cells are strings.
      formatDate: function (d, tz, fmt) {
        var p = function (n) { return (n < 10 ? '0' : '') + n; };
        return fmt === 'HH:mm' ? p(d.getHours()) + ':' + p(d.getMinutes())
          : d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
      }
    },
    Logger: { log: function (m) { if (window.console) console.log('[Logger]', m); } },
    // Production emails a confirmation from the booking; the demo keeps an outbox the switcher
    // bar counts, so the side effect is visible without sending anything.
    sendBookingEmail_: function (booking, kind) {
      outbox.push({ kind: kind, to: booking.parentEmail, student: booking.studentFirst + ' ' + booking.studentLast,
        subject: booking.subject, date: booking.date, start: booking.start });
      writeStore(OUTBOX_KEY, outbox);
    }
  });

  /* ---------- boot: the REAL sync fills Roster and Teachers from the FACTS tabs ---------- */
  L.syncTeachers();
  L.syncRoster();

  var saved = readStore(STATE_KEY);
  if (saved && saved.Blocks && saved.Bookings) {
    local.sheets.Blocks = new Sheet(saved.Blocks);
    local.sheets.Bookings = new Sheet(saved.Bookings);
  } else {
    // Seed the other families' bookings, resolving each RosterRow from the freshly synced Roster
    // exactly as a booking saved through the app would carry it.
    var roster = L.sheetRows_('Roster');
    DATA.seedBookings.forEach(function (b) {
      var row = roster.filter(function (s) { return s.StudentFirst === b[5] && s.StudentLast === b[6]; })[0];
      local.sheets.Bookings.values.push(b.slice(0, 10).concat(['2026-10-01 09:00:00', b[10], row ? row._row : '']));
    });
  }
  booting = false;

  /* ---------- the server methods the pages call ---------- */
  function signIn() {
    var email = DATA.demo.guardianEmail;
    return { email: email, students: L.findStudentsByGuardianEmail_(email) };
  }
  window.MOCK_BACKEND = {
    // Auth.js in production: verify the portal's signed ticket, mint a session. Faked here.
    ssoLogin: function (ticket) {
      var s = signIn();
      return { success: true, token: 'demo-session', email: s.email, students: s.students };
    },
    loadStudentsFromSession: function (token) {
      var s = signIn();
      return { valid: true, email: s.email, students: s.students };
    },
    // Everything below is the app's own code (logic.js).
    getStudentAvailabilityGrid: function (rosterRow) { return L.getStudentAvailabilityGrid(rosterRow); },
    submitBookings: function (bookings) { return L.submitBookings(bookings); },
    cancelBooking: function (date, start, teacherEmail, rosterRow) { return L.cancelBooking(date, start, teacherEmail, rosterRow); },
    getCurrentTeacherGrid: function () { return L.getCurrentTeacherGrid(); },
    saveTeacherBlockChanges: function (changes) { return L.saveTeacherBlockChanges(changes); }
  };

  // For the switcher bar and verify.mjs.
  window.PTC_DEMO = {
    outbox: function () { return readStore(OUTBOX_KEY) || []; },
    teachers: function () { return L.sheetRows_('Teachers'); },
    local: local
  };
})();
