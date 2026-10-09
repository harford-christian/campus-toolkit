/* mock-competitions.js — the stand-in for Google on the Spelling Bee and Creative Writing pages.

   Those are two more Apps Script projects, separate from Secondary: one public registration form each, one Sheet
   each (Registrations · Students or Entries · Schools · Settings · …), no sign-in and no admin web app — staff work
   in the Sheet itself. Each page loads its own vendored server bundle (logic-spelling.js / logic-writing.js) and
   this file; mock.js then hands over its in-memory Sheets and Drive and this file seeds that project's own Sheet
   from its verbatim defaults plus data.js, binds the services the code reaches for, and answers every
   google.script.run call the page makes by calling the project's real function. The Sheet persists in
   sessionStorage for the visit, separately per project. */
(function () {
  'use strict';
  var page = String(window.location && window.location.pathname || '');
  var KIND = /spelling-bee\.html$/.test(page) ? 'spelling' : /creative-writing\.html$/.test(page) ? 'writing' : null;
  if (!KIND) return;

  var CONF = {
    spelling: {
      logic: 'MACS_SPELLING_LOGIC', key: 'macs-demo-spelling-v1', title: 'MACS Spelling Bee Registration',
      methods: ['getGradeGroups', 'getSchoolList', 'getPaymentInfo', 'checkSchoolStatus', 'submitRegistration']
    },
    writing: {
      logic: 'MACS_WRITING_LOGIC', key: 'macs-demo-writing-v1', title: 'MACS Creative Writing Registration',
      methods: ['getSchoolList', 'getGeneralRules', 'getLevels', 'getPaymentInfo', 'checkSchoolStatus', 'uploadEntryFile', 'submitRegistration']
    }
  }[KIND];

  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function rows(list) { return list.map(function (r) { return r.slice(); }); }

  window.MACS_COMPETITION = {
    kind: KIND,
    boot: function (kit) {
      var L = window[CONF.logic], D = kit.data, C = D[KIND];
      var live = kit.registerWorkbook(new kit.Workbook('macs-' + KIND + '-live', CONF.title));
      var saved = kit.readStore(CONF.key);

      L.bind({
        SpreadsheetApp: {
          getActiveSpreadsheet: function () { return live; },
          create: function (name) { return kit.registerWorkbook(new kit.Workbook('sheet-' + KIND + '-' + Date.now(), name)); },
          getUi: function () { throw new Error('No UI in a web app request'); }
        },
        DriveApp: {
          getFoldersByName: function (n) { return kit.root.getFoldersByName(n); },
          createFolder: function (n) { return kit.root.createFolder(n); },
          getFolderById: function () { return kit.root; },
          getFileById: function (id) { if (!kit.files[id]) throw new Error('Not found: ' + id); return kit.files[id]; },
          Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' }
        },
        Utilities: {
          base64Decode: function (b64) {
            var bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
            var out = []; for (var i = 0; i < bin.length; i++) { var b = bin.charCodeAt(i); out.push(b > 127 ? b - 256 : b); } return out;
          },
          newBlob: function (bytes, mime, name) { return { bytes: bytes, mime: mime, name: name }; },
          formatDate: function (d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
        },
        Session: {
          getActiveUser: function () { return { getEmail: function () { return ''; } }; },
          getScriptTimeZone: function () { return 'America/New_York'; }
        },
        Logger: { log: function () { if (window.console && window.MACS_DEBUG) console.log.apply(console, ['[Logger]'].concat([].slice.call(arguments))); } },
        HtmlService: null
      });

      if (saved) {
        live.load(saved);
      } else {
        // The tabs Bootstrap.js's setupSpreadsheet creates, with the project's own headers and defaults — but the
        // member schools are data.js's fabricated ones (shared with the Secondary demo), not the real roster.
        var S = L.SHEETS;
        live.insertSheet(S.REGISTRATIONS).values = [L.REGISTRATIONS_HEADERS.slice()];
        if (KIND === 'spelling') live.insertSheet(S.STUDENTS).values = [L.STUDENTS_HEADERS.slice()];
        else live.insertSheet(S.ENTRIES).values = [L.ENTRIES_HEADERS.slice()];
        live.insertSheet(S.SCHOOLS).values = [L.SCHOOLS_HEADERS.slice()].concat(D.schools.map(function (s) {
          return s.slice(0, L.SCHOOLS_HEADERS.length);
        }));
        var settings = live.insertSheet(S.SETTINGS);
        settings.values = [['Setting', 'Value']].concat(L.DEFAULT_SETTINGS.map(function (r) {
          return [r[0], Object.prototype.hasOwnProperty.call(C.settings, r[0]) ? C.settings[r[0]] : r[1]];
        }));
        Object.keys(C.settings).forEach(function (k) {
          if (!L.DEFAULT_SETTINGS.some(function (r) { return r[0] === k; })) settings.values.push([k, C.settings[k]]);
        });
        if (KIND === 'writing') {
          live.insertSheet(S.JUDGING_SHEETS).values = [L.JUDGING_SHEETS_HEADERS.slice()].concat(rows(L.DEFAULT_JUDGING_SHEETS).map(function (r) {
            return [r[0], r[1], C.judgingSheetUrl];
          }));
        }
        live.insertSheet(S.ADMIN_EDITS_LOG).values = [['Timestamp', 'Admin', 'Entry ID', 'Change Description']];

        /* first boot: the schools that already registered go through the REAL write path */
        var pdf = (typeof btoa === 'function' ? btoa : function (s) { return Buffer.from(s, 'binary').toString('base64'); })('%PDF-1.4\n% fabricated demo upload\n');
        C.submitted.forEach(function (s) {
          if (KIND === 'spelling') {
            L.submitRegistration(s.code, s.name, JSON.parse(JSON.stringify(s.groups)), s.contact);
          } else {
            var entries = s.entries.map(function (e) {
              var stem = e.studentLast + '_' + e.studentFirst.charAt(0) + '_' + e.category.replace(/\s+/g, '') + '.pdf';
              var a = L.uploadEntryFile(pdf, stem, 'application/pdf', s.name, e.levelKey, e.category, 'entry');
              var b = L.uploadEntryFile(pdf, stem.replace('.pdf', '_Judge.pdf'), 'application/pdf', s.name, e.levelKey, e.category, 'judging-sheet');
              return { levelKey: e.levelKey, category: e.category, studentFirst: e.studentFirst, studentLast: e.studentLast,
                title: e.title, entryUrl: a.url, judgingSheetUrl: b.url };
            });
            L.submitRegistration(s.code, s.name, s.contact, true, s.levels.slice(), entries);
          }
        });
        // Backdate them so they read as earlier registrations, not "just now".
        var reg = live.sheets[S.REGISTRATIONS], out = live.sheets[KIND === 'spelling' ? S.STUDENTS : S.ENTRIES];
        C.submitted.forEach(function (s, i) {
          reg.values.forEach(function (r) { if (String(r[1]) === s.code) r[0] = C.stamps[i]; });
          out.values.forEach(function (r) { if (String(r[2]) === s.code) r[1] = C.stamps[i]; });
        });
      }
      live.onTouch = function () { kit.writeStore(CONF.key, live.dump()); };
      if (!saved) live.touch();

      var M = {};
      CONF.methods.forEach(function (name) { M[name] = function () { return L[name].apply(null, arguments); }; });
      window.MACS_COMP_DEMO = { kind: KIND, workbook: live, drive: kit.root, files: kit.files };
      return M;
    }
  };
})();
