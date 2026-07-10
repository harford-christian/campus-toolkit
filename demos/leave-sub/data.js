/* data.js — fabricated data for the Leave & Substitute staff-analytics demo.
   Invented staff (no real people/IDs). The logged-in user is "Alex Rivera".
   School year runs Sep 1 → Aug 31; the seeded records live in SY 2025-2026
   (Sep 2025 – Jun 2026), which the app treats as the current school year.

   Field contracts mirror the real Apps Script backend exactly (a mismatch
   blanks the UI):
     getPublicAnalytics  → [{ type, weekday, startRaw, endRaw, hours }]
     getPersonalLeaveData→ { records:[…], breakdown:{<5 types>:{count,hours}} }
     getRankingData      → { <5 types>: null | {rank,total,hours,topFive[]} }
     getSubData          → { myLeave, mySubWork, schoolWide }
   Dates are stored as epoch-ms so the Forecast calendar and Heatmap read them
   directly. One Pending personal record is anchored to "now + 21 days" so it
   surfaces in the "Upcoming Leave" strip whenever the demo is opened. */
window.LEAVESUB_DATA = (function () {
  'use strict';

  var LEAVE_TYPES = [
    'Sick Leave', 'Personal Leave', 'HCS-Related',
    'Late Arrival/Early Departure', 'Other Paid Leave'
  ];

  // ── date helpers (local time, so they line up with the calendar/heatmap) ──
  function ms(y, m, d) { return new Date(y, m - 1, d).getTime(); } // m is 1-indexed
  function weekdayOf(t) { return new Date(t).toLocaleDateString('en-US', { weekday: 'long' }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mdy(t) { var d = new Date(t); return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear(); }
  var DAY = 24 * 60 * 60 * 1000;

  // ── 1. School-wide analytics (Approved only) — powers Forecast/Heatmap/Summary ──
  // Row shape: { type, weekday, startRaw, endRaw, hours }. ~15 rows across the 5
  // types, Sep 2025 – Jun 2026. Four single-day Sick/Personal/Other records land
  // on 2026-02-10 (a flu-wave cluster) so the heatmap paints that day level-2 (3–4).
  function pub(type, y, m, d, hours, end) {
    var s = ms(y, m, d);
    return { type: type, weekday: weekdayOf(s), startRaw: s, endRaw: end ? ms(end[0], end[1], end[2]) : null, hours: hours };
  }
  var publicAnalytics = [
    pub('Sick Leave',                   2025,  9, 16, 8),
    pub('Personal Leave',               2025, 10,  7, 16, [2025, 10, 8]),
    pub('HCS-Related',                  2025, 10, 21, 8),
    pub('Other Paid Leave',             2025, 11, 12, 24, [2025, 11, 14]),
    pub('Late Arrival/Early Departure', 2025, 12,  3, 2),
    pub('Sick Leave',                   2026,  1, 13, 8),
    pub('Personal Leave',               2026,  1, 27, 8),
    pub('HCS-Related',                  2026,  2,  5, 16, [2026, 2, 6]),
    // ── cluster on 2026-02-10 (Tue): 4 people out → heatmap level-2 ──
    pub('Sick Leave',                   2026,  2, 10, 8),
    pub('Sick Leave',                   2026,  2, 10, 8),
    pub('Personal Leave',               2026,  2, 10, 8),
    pub('Other Paid Leave',             2026,  2, 10, 8),
    pub('Late Arrival/Early Departure', 2026,  3, 11, 2),
    pub('HCS-Related',                  2026,  4, 15, 8),
    pub('Sick Leave',                   2026,  5, 19, 8)
  ];

  // ── 2. Alex Rivera's personal leave records ──
  // start is 'MM/dd/yyyy' (derived from startRaw). One late Personal Leave
  // (submitted < 14 days before start) trips the late-warning flag; one Pending
  // record is anchored to now+21d so it shows as Upcoming.
  var NOW = Date.now();
  function rec(o) {
    o.start = mdy(o.startRaw);
    o.end = o.endRaw ? mdy(o.endRaw) : '';
    return o;
  }
  var personalRecords = [
    rec({ approvalId: 'LSA-2025-0916', type: 'Sick Leave', status: 'Approved',
      uidLink: 'https://uid.demo.harfordchristian.org/r/AR-2025-0916',
      startRaw: ms(2025, 9, 16), endRaw: null, hours: 8,
      subRequired: 'Yes', subNames: 'Jordan Blake',
      discussion: 'Out with a bad cold; coverage arranged the day before.',
      submittedRaw: ms(2025, 8, 28) }),
    rec({ approvalId: 'LSA-2025-1021', type: 'HCS-Related', status: 'Approved',
      uidLink: 'https://uid.demo.harfordchristian.org/r/AR-2025-1021',
      startRaw: ms(2025, 10, 21), endRaw: null, hours: 8,
      subRequired: 'No', subNames: '',
      discussion: 'Chaperoned the regional HCS academic tournament.',
      submittedRaw: ms(2025, 9, 30) }),
    rec({ approvalId: 'LSA-2025-1113', type: 'Other Paid Leave', status: 'Approved',
      uidLink: 'https://uid.demo.harfordchristian.org/r/AR-2025-1113',
      startRaw: ms(2025, 11, 13), endRaw: null, hours: 8,
      subRequired: 'Yes', subNames: 'Jordan Blake',
      discussion: 'Jury duty — county summons.',
      submittedRaw: ms(2025, 10, 20) }),
    rec({ approvalId: 'LSA-2025-1203', type: 'Late Arrival/Early Departure', status: 'Approved',
      uidLink: 'https://uid.demo.harfordchristian.org/r/AR-2025-1203',
      startRaw: ms(2025, 12, 3), endRaw: null, hours: 2,
      subRequired: 'No', subNames: '',
      discussion: 'Early departure at 2:15 PM for a medical appointment.',
      submittedRaw: ms(2025, 11, 24) }),
    rec({ approvalId: 'LSA-2026-0127', type: 'Personal Leave', status: 'Approved',
      uidLink: 'https://uid.demo.harfordchristian.org/r/AR-2026-0127',
      startRaw: ms(2026, 1, 27), endRaw: null, hours: 8,
      subRequired: 'Yes', subNames: 'Sam Ortiz & Priya Nair',
      discussion: 'Personal day — requested well in advance.',
      submittedRaw: ms(2025, 12, 20) }),
    // Late Personal Leave: submitted 2026-02-05, starts 2026-02-10 → < 14 days.
    rec({ approvalId: 'LSA-2026-0210', type: 'Personal Leave', status: 'Approved',
      uidLink: 'https://uid.demo.harfordchristian.org/r/AR-2026-0210',
      startRaw: ms(2026, 2, 10), endRaw: null, hours: 8,
      subRequired: 'Yes', subNames: 'Marcus Webb',
      discussion: 'Short-notice family matter; approved at admin discretion.',
      submittedRaw: ms(2026, 2, 5) }),
    // Pending + future: anchored to now+21d so it appears under "Upcoming Leave".
    rec({ approvalId: '', type: 'Personal Leave', status: 'Pending',
      uidLink: 'https://uid.demo.harfordchristian.org/r/AR-PENDING',
      startRaw: NOW + 21 * DAY, endRaw: null, hours: 8,
      subRequired: 'Yes', subNames: 'Priya Nair',
      discussion: 'Requested personal day — awaiting approval.',
      submittedRaw: NOW - 2 * DAY })
  ];

  // breakdown: approved-only counts/hours per type (all 5 keys present).
  var breakdown = {};
  LEAVE_TYPES.forEach(function (t) { breakdown[t] = { count: 0, hours: 0 }; });
  personalRecords.forEach(function (r) {
    if (r.status !== 'Approved') return;
    breakdown[r.type].count += 1;
    breakdown[r.type].hours += r.hours;
  });

  // ── 3. School-wide rankings (anonymous). null for types with no ranking. ──
  var ranking = {
    'Sick Leave': {
      rank: 2, total: 34, hours: 16,
      topFive: [
        { rank: 1, isMe: false, hours: 24 },
        { rank: 2, isMe: true,  hours: 16 },
        { rank: 3, isMe: false, hours: 12 },
        { rank: 4, isMe: false, hours: 8 },
        { rank: 5, isMe: false, hours: 8 }
      ]
    },
    // rank > 5 → top four, then an ellipsis row for "You".
    'Personal Leave': {
      rank: 8, total: 30, hours: 24,
      topFive: [
        { rank: 1, isMe: false, hours: 40 },
        { rank: 2, isMe: false, hours: 32 },
        { rank: 3, isMe: false, hours: 24 },
        { rank: 4, isMe: false, hours: 24 },
        { rank: 5, isMe: false, hours: 16 },
        { rank: 8, isMe: true,  hours: 24, ellipsis: true }
      ]
    },
    'HCS-Related': {
      rank: 1, total: 12, hours: 16,
      topFive: [
        { rank: 1, isMe: true,  hours: 16 },
        { rank: 2, isMe: false, hours: 8 },
        { rank: 3, isMe: false, hours: 8 }
      ]
    },
    'Late Arrival/Early Departure': null,
    'Other Paid Leave': null
  };

  // ── 4. Sub utilization ──
  var subData = {
    myLeave: {
      totalApproved: 6,   // Alex's approved leave records
      neededSubs: 4,      // of those, how many needed a substitute
      impactHours: 32,    // total leave hours a sub had to cover
      subsUsed: [         // aggregated by substitute (sorted by hours desc)
        { name: 'Jordan Blake', count: 2, hours: 16 },
        { name: 'Marcus Webb',  count: 1, hours: 8 },
        { name: 'Priya Nair',   count: 1, hours: 8 }
      ]
    },
    mySubWork: {
      totalAssignments: 5,
      totalHours: 34,
      monthlyHours: { '2025-10': 6, '2025-11': 8, '2026-01': 8, '2026-03': 6, '2026-05': 6 },
      records: [
        { hours: 6, type: 'Sick Leave',       start: '10/09/2025', startRaw: ms(2025, 10, 9) },
        { hours: 8, type: 'Personal Leave',   start: '11/18/2025', startRaw: ms(2025, 11, 18) },
        { hours: 8, type: 'Sick Leave',       start: '01/22/2026', startRaw: ms(2026, 1, 22) },
        { hours: 6, type: 'Other Paid Leave', start: '03/05/2026', startRaw: ms(2026, 3, 5) },
        { hours: 6, type: 'Sick Leave',       start: '05/07/2026', startRaw: ms(2026, 5, 7) }
      ]
    },
    schoolWide: {
      totalSubHours: 420,
      myContributionHours: 34,
      myImpactPct: 8,        // Alex's leave (32h) share of all sub hours needed
      myContributionPct: 8   // Alex's sub work (34h) share → "Moderate Impact"
    }
  };

  return {
    LEAVE_TYPES: LEAVE_TYPES,
    user: { email: 'alex.rivera@harfordchristian.org', appUrl: '#' },
    handbook: { name: 'HCS Staff Handbook 2025-2026', url: 'https://drive.google.com/file/d/1DemoStaffHandbookAbc/view' },
    publicAnalytics: publicAnalytics,
    personal: { records: personalRecords, breakdown: breakdown },
    ranking: ranking,
    subData: subData
  };
})();
