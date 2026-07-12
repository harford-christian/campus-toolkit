/* data.js — fabricated content for the Bell Schedule (Live Bell Schedule Hub) demo.
   Return shapes mirror the hub's Editor.gs / Resolver.gs (getEditorConfig, getMonthSources,
   getWeek, getEditorSpanByDate, seedDayPreview, ...). All content is invented but authentic in
   structure: HCS branding, the real (public) tone .wav filenames, zone model (40 HS-all,
   41 HS+6th, 99 all-campus), and period naming fabricated from Setup.gs `_examWeekPlan_`.
   No private Sheet/Script IDs or emails appear anywhere here — data arrives "over google.script.run".

   A demo month is fixed at September 2026 so the calendar layout + flavored days stay stable.
   Bell rows are stored compactly as {t,n,tone,z}; mock.js converts them to the resolved BELL
   shape (bells[]) or the editor BELLROW shape (rows[]) as each function requires. */
window.BELL_DATA = (function () {
  'use strict';

  // The 6-bell opening block — identical across every schedule. The exact NAMES are locked so the
  // client's timeline grouping recognizes them as the rigid "Opening block" (see deriveGroups()).
  var OPENING = [
    { t: '07:45', n: 'HS Prayer Start',    tone: 'PrayerStart.wav', z: 40 },
    { t: '08:00', n: 'All Prayer End',     tone: 'PrayerEnd.wav',   z: 99 },
    { t: '08:26', n: '2 Min Warning (HR)', tone: 'Warning1.wav',    z: 41 },
    { t: '08:27', n: '1 Min Warning (HR)', tone: 'Warning2.wav',    z: 41 },
    { t: '08:28', n: 'Homeroom Start',     tone: 'StartofDay.wav',  z: 41 },
    { t: '08:33', n: 'Homeroom End',       tone: 'End.wav',         z: 40 }
  ];

  // NORMAL day: opening block + 7 period Start/End pairs (with a Lunch block), closing at 15:17.
  var NORMAL = OPENING.concat([
    { t: '08:36', n: '1st Start',   tone: 'Start.wav',    z: 40 },
    { t: '09:26', n: '1st End',     tone: 'End.wav',      z: 40 },
    { t: '09:29', n: '2nd Start',   tone: 'Start.wav',    z: 40 },
    { t: '10:19', n: '2nd End',     tone: 'End.wav',      z: 40 },
    { t: '10:22', n: '3rd Start',   tone: 'Start.wav',    z: 40 },
    { t: '11:12', n: '3rd End',     tone: 'End.wav',      z: 40 },
    { t: '11:15', n: '4th Start',   tone: 'Start.wav',    z: 40 },
    { t: '12:05', n: '4th End',     tone: 'End.wav',      z: 40 },
    { t: '12:08', n: 'Lunch Start', tone: 'Start.wav',    z: 40 },
    { t: '12:38', n: 'Lunch End',   tone: 'End.wav',      z: 40 },
    { t: '12:41', n: '5th Start',   tone: 'Start.wav',    z: 40 },
    { t: '13:31', n: '5th End',     tone: 'End.wav',      z: 40 },
    { t: '13:34', n: '6th Start',   tone: 'Start.wav',    z: 40 },
    { t: '14:24', n: '6th End',     tone: 'End.wav',      z: 40 },
    { t: '14:27', n: '7th Start',   tone: 'Start.wav',    z: 40 },
    { t: '15:17', n: 'End of Day',  tone: 'EndOfDay.wav', z: 41 }
  ]);

  // 2HR Delay = the Normal set shifted +120 minutes (computed so the copy can't drift from NORMAL).
  function shift(set, mins) {
    return set.map(function (b) {
      var m = (+b.t.split(':')[0]) * 60 + (+b.t.split(':')[1]) + mins;
      var hh = Math.floor(m / 60), mm = m % 60;
      return { t: ('0' + hh).slice(-2) + ':' + ('0' + mm).slice(-2), n: b.n, tone: b.tone, z: b.z };
    });
  }
  var DELAY2 = shift(NORMAL, 120);
  var RELEASE3 = shift(NORMAL, 180);

  // CHAPEL day: opening block + a Chapel Start/End all-campus block, ending at End of Day.
  var CHAPEL = OPENING.concat([
    { t: '08:36', n: '1st Start',    tone: 'Start.wav',    z: 40 },
    { t: '09:21', n: '1st End',      tone: 'End.wav',      z: 40 },
    { t: '09:24', n: '2nd Start',    tone: 'Start.wav',    z: 40 },
    { t: '10:09', n: '2nd End',      tone: 'End.wav',      z: 40 },
    { t: '10:12', n: 'Chapel Start', tone: 'StartofDay.wav', z: 99 },
    { t: '11:00', n: 'Chapel End',   tone: 'End.wav',      z: 99 },
    { t: '11:03', n: '3rd Start',    tone: 'Start.wav',    z: 40 },
    { t: '11:48', n: '3rd End',      tone: 'End.wav',      z: 40 },
    { t: '11:51', n: 'Lunch Start',  tone: 'Start.wav',    z: 40 },
    { t: '12:21', n: 'Lunch End',    tone: 'End.wav',      z: 40 },
    { t: '12:24', n: '4th Start',    tone: 'Start.wav',    z: 40 },
    { t: '13:09', n: '4th End',      tone: 'End.wav',      z: 40 },
    { t: '13:12', n: '5th Start',    tone: 'Start.wav',    z: 40 },
    { t: '13:57', n: '5th End',      tone: 'End.wav',      z: 40 },
    { t: '14:00', n: '6th Start',    tone: 'Start.wav',    z: 40 },
    { t: '14:45', n: '6th End',      tone: 'End.wav',      z: 40 },
    { t: '14:48', n: '7th Start',    tone: 'Start.wav',    z: 40 },
    { t: '15:17', n: 'End of Day',   tone: 'EndOfDay.wav', z: 41 }
  ]);

  // Exam-week per-day content (from Setup.gs _examWeekPlan_) prepended with the opening block.
  // [time, name, tone, zone].
  function withOpening(content) {
    return OPENING.concat(content.map(function (c) {
      return { t: c[0], n: c[1], tone: c[2], z: c[3] };
    })).slice().sort(function (a, b) {
      return ((+a.t.split(':')[0]) * 60 + (+a.t.split(':')[1])) - ((+b.t.split(':')[0]) * 60 + (+b.t.split(':')[1]));
    });
  }
  var EXAM_MON = withOpening([
    ['08:36', 'Exam 1 Start', 'Start.wav', 40], ['09:21', 'Midway', 'Midway.wav', 40],
    ['10:09', 'Exam 1 End', 'End.wav', 40], ['10:12', '2nd Start', 'Start.wav', 40],
    ['10:57', '2nd End/Lunch 1 Start', 'End.wav', 40], ['11:22', 'Lunch 1 End', 'End.wav', 41],
    ['11:45', 'Lunch 2 Start', 'Start.wav', 40], ['12:10', '4th/Lunch End', 'End.wav', 40],
    ['12:13', 'Exam 5 Start', 'Start.wav', 40], ['12:58', 'Midway', 'Midway.wav', 40],
    ['13:46', 'Exam 5 End', 'End.wav', 40], ['13:49', '6th Start', 'Start.wav', 40],
    ['14:34', '6th End', 'End.wav', 40], ['14:37', '7th Start', 'Start.wav', 40],
    ['15:17', '7th End/End of Day', 'EndOfDay.wav', 41]
  ]);
  var EXAM_TUE = withOpening([
    ['08:36', 'Exam 2 Start', 'Start.wav', 40], ['09:21', 'Midway', 'Midway.wav', 40],
    ['10:09', 'Exam 2 End', 'End.wav', 40], ['10:12', '3rd Start', 'Start.wav', 40],
    ['10:57', '3rd End/Lunch 1 Start', 'End.wav', 40], ['11:22', 'Lunch 1 End', 'End.wav', 41],
    ['11:45', 'Lunch 2 Start', 'Start.wav', 40], ['12:10', '4th/Lunch End', 'End.wav', 40],
    ['12:13', 'Exam 6 Start', 'Start.wav', 40], ['12:58', 'Midway', 'Midway.wav', 40],
    ['13:46', 'Exam 6 End', 'End.wav', 40], ['13:49', '7th Start', 'Start.wav', 40],
    ['14:34', '7th End', 'End.wav', 40], ['14:37', '8th Start', 'Start.wav', 40],
    ['15:17', '8th End/End of Day', 'EndOfDay.wav', 41]
  ]);
  var EXAM_WED = withOpening([
    ['08:36', 'Exam 3 Start', 'Start.wav', 40], ['09:21', 'Midway', 'Midway.wav', 40],
    ['10:09', 'Exam 3 End', 'End.wav', 40], ['10:12', 'Exam 7 Start', 'Start.wav', 40],
    ['10:57', 'Midway', 'Midway.wav', 40], ['11:43', 'Exam 7 End', 'End.wav', 40],
    ['11:45', 'Exam 4 Start', 'Start.wav', 40], ['12:07', 'Midway', 'Midway.wav', 40],
    ['12:30', 'Exam 4 End/Parties Start', 'End.wav', 40], ['13:15', 'End of Day', 'EndOfDay.wav', 41]
  ]);
  var EXAM_THU = withOpening([
    ['09:24', 'Exam 4 Start', 'Start.wav', 40], ['10:09', 'Midway', 'Midway.wav', 40],
    ['10:57', 'Exam 4 End', 'End.wav', 40], ['11:00', '8th Start', 'Start.wav', 40],
    ['11:40', '8th End', 'End.wav', 40], ['12:15', 'End of Day', 'EndOfDay.wav', 41]
  ]);

  return {
    today: '2026-09-14',        // fixed demo "today" (a Monday) — keeps the calendar deterministic
    year: 2026,
    month: 9,
    timezone: 'America/New_York',
    constantBellNames: ['HS Prayer Start', 'EL Prayer Start', 'All Prayer End',
      '2 Min Warning (HR)', '1 Min Warning (HR)', 'Homeroom Start', 'Homeroom End'],
    calendars: ['Normal', '2HR_Delay', '3HR_Release', 'Exam', 'NO_Bells'],
    modeMap: { 'NORMAL': 'Normal', '2HRDELAY': '2HR_Delay' },

    // Flavored weekdays for the demo month (everything else = base/Normal; weekends = closed).
    flavors: {
      '2026-09-11': { source: 'weather', label: '3HR Release',      schedule: '3HR Release', doorMode: '3HR Release' },
      '2026-09-16': { source: 'custom',  label: 'Chapel Day',       schedule: 'Chapel Day',  doorMode: 'Normal', span: 'chapel' },
      '2026-09-18': { source: 'weather', label: '2HR Delay',        schedule: '2HR Delay',   doorMode: '2HR Delay' },
      '2026-09-21': { source: 'custom',  label: 'Exam Week',        schedule: 'Exam Week',   doorMode: 'Normal', span: 'exam' },
      '2026-09-22': { source: 'custom',  label: 'Exam Week',        schedule: 'Exam Week',   doorMode: 'Normal', span: 'exam' },
      '2026-09-23': { source: 'custom',  label: 'Exam Week',        schedule: 'Exam Week',   doorMode: 'Normal', span: 'exam' },
      '2026-09-24': { source: 'custom-unconfigured', label: 'Exam Week (unset)', schedule: 'Exam Week', doorMode: 'Normal', span: 'exam' },
      '2026-09-30': { source: 'custom',  label: 'Chapel Day',       schedule: 'Chapel Day',  doorMode: 'Normal', span: 'chapel' }
    },

    // Bell sets by key. mock.js maps template/schedule names onto these.
    bells: {
      NORMAL: NORMAL, DELAY2: DELAY2, RELEASE3: RELEASE3, CHAPEL: CHAPEL,
      EXAM_MON: EXAM_MON, EXAM_TUE: EXAM_TUE, EXAM_WED: EXAM_WED, EXAM_THU: EXAM_THU
    },

    // Custom span definitions.
    spans: {
      chapel: { name: 'Chapel Day', baseTemplate: '', weatherBehavior: 'override', bellSet: 'CHAPEL' },
      exam: {
        name: 'Exam Week', startDate: '2026-09-21', endDate: '2026-09-24',
        baseTemplate: '', weatherBehavior: 'override',
        days: { '2026-09-21': 'EXAM_MON', '2026-09-22': 'EXAM_TUE', '2026-09-23': 'EXAM_WED' },
        unset: ['2026-09-24']   // one day intentionally left unconfigured (matches month "unset")
      }
    }
  };
})();
