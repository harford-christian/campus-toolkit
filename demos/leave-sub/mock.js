/* mock.js — Leave & Substitute demo backend.
   Mirrors the six server functions the public interface calls via
   google.script.run. Each returns the exact shape the untouched Apps Script
   UI expects; all data comes from data.js (window.LEAVESUB_DATA). Read-only —
   this analytics view never mutates state. */
window.MOCK_BACKEND = (function () {
  'use strict';
  var D = window.LEAVESUB_DATA;
  var WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var HOURS = { 'Sick Leave': 8, 'Personal Leave': 8, 'HCS-Related': 4, 'Late Arrival/Early Departure': 2, 'Other Paid Leave': 8 };
  var TYPES = ['Sick Leave', 'Personal Leave', 'HCS-Related', 'Late Arrival/Early Departure', 'Other Paid Leave'];

  // Build a realistic school-wide absence spread anchored to the CURRENT school year,
  // so the heatmap/forecast always light up (with per-day counts ranging 0–8). Each
  // absence is one record; weekend dates shift to the next weekday.
  function nextWeekday(d) { while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; }
  function genPublicAnalytics() {
    var now = new Date();
    var sy = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1; // Sep→Aug school year
    // [calendarMonthIdx, day, count, primaryType] — a believable flu-season curve peaking in Jan/Feb.
    var PEAKS = [
      [8, 15, 1, 'Personal Leave'], [8, 23, 2, 'Sick Leave'],
      [9, 7, 2, 'Sick Leave'], [9, 20, 3, 'Sick Leave'],
      [10, 6, 3, 'Sick Leave'], [10, 18, 4, 'Sick Leave'],
      [11, 9, 4, 'Sick Leave'], [11, 16, 2, 'Personal Leave'],
      [0, 13, 6, 'Sick Leave'], [0, 14, 8, 'Sick Leave'], [0, 20, 5, 'Sick Leave'], [0, 27, 3, 'Sick Leave'],
      [1, 3, 5, 'Sick Leave'], [1, 10, 4, 'Sick Leave'], [1, 24, 3, 'Personal Leave'],
      [2, 12, 3, 'HCS-Related'], [2, 25, 2, 'Sick Leave'],
      [3, 7, 2, 'Sick Leave'], [3, 21, 1, 'Late Arrival/Early Departure'],
      [4, 5, 2, 'Personal Leave'], [4, 19, 1, 'Sick Leave'],
      [5, 2, 1, 'Other Paid Leave']
    ];
    var out = [];
    PEAKS.forEach(function (p) {
      var mIdx = p[0], day = p[1], count = p[2], type = p[3];
      var year = mIdx >= 8 ? sy : sy + 1;
      for (var k = 0; k < count; k++) {
        var t = (count >= 5 || k === 0) ? type : TYPES[(k + mIdx) % TYPES.length];
        var d = nextWeekday(new Date(year, mIdx, day));
        out.push({ type: t, weekday: WD[d.getDay()], startRaw: d.getTime(), endRaw: d.getTime(), hours: HOURS[t] });
      }
    });
    // Two multi-day leaves so the forecast shows spans too.
    var s1 = nextWeekday(new Date(sy + 1, 1, 17)), e1 = new Date(s1); e1.setDate(e1.getDate() + 2);
    out.push({ type: 'Sick Leave', weekday: WD[s1.getDay()], startRaw: s1.getTime(), endRaw: e1.getTime(), hours: 24 });
    var s2 = nextWeekday(new Date(sy + 1, 2, 3)), e2 = new Date(s2); e2.setDate(e2.getDate() + 4);
    out.push({ type: 'Other Paid Leave', weekday: WD[s2.getDay()], startRaw: s2.getTime(), endRaw: e2.getTime(), hours: 40 });
    return out;
  }

  return {
    // School-wide approved analytics → Forecast + Heatmap (startRaw/endRaw)
    // and Summary (type/hours). Generated relative to the current school year.
    getPublicAnalytics: function () {
      return genPublicAnalytics();
    },

    // Staff Handbook link → the "📖 Handbook" nav button. Return null to hide it.
    getStaffHandbook: function () {
      return { name: D.handbook.name, url: D.handbook.url };
    },

    // Logged-in user chip + "Switch Account" destination.
    getLoggedInUser: function () {
      return { email: D.user.email, appUrl: D.user.appUrl };
    },

    // Alex Rivera's private records + per-type breakdown → My Leave tab.
    getPersonalLeaveData: function () {
      return {
        records: D.personal.records.map(function (r) {
          var c = {}; for (var k in r) c[k] = r[k]; return c;
        }),
        breakdown: JSON.parse(JSON.stringify(D.personal.breakdown))
      };
    },

    // School-wide rankings, keyed by the 5 leave types (null where absent).
    getRankingData: function () {
      return JSON.parse(JSON.stringify(D.ranking));
    },

    // Sub utilization → Subs tab (myLeave / mySubWork / schoolWide).
    getSubData: function () {
      return JSON.parse(JSON.stringify(D.subData));
    }
  };
})();
