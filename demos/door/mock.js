/* mock.js — Door Automation demo backend. Shared by index.html (tabs), dashboard.html,
   and leadership.html. Implements processPost (all read + write actions) and the
   dedicated getLeadershipStatus(mode). Read-only actions return real fabricated data;
   write actions return {success:true, csrfToken}. serverTimezone is reported as the
   viewer's own zone so clock conversions are a no-op. */
window.MOCK_BACKEND = (function () {
  var D = window.DOOR_DATA;
  var csrfSeq = 1;
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function token() { return 'demo-csrf-' + (++csrfSeq); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateAt(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d; }
  function fmtDate(off) { var d = dateAt(off); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowStamp() { var d = new Date(); return fmtDate(0) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'America/New_York'; } }

  function resolveTargets(csv) {
    var out = [], seen = {};
    String(csv || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (tok) {
      var names = [];
      if (tok.toUpperCase() === 'ALL') names = D.doors.map(function (d) { return d.name; });
      else if (D.doorGroups.indexOf(tok) >= 0) names = D.doors.filter(function (d) { return d.group === tok; }).map(function (d) { return d.name; });
      else names = D.doors.filter(function (d) { return d.name === tok; }).map(function (d) { return d.name; });
      names.forEach(function (n) { if (!seen[n]) { seen[n] = 1; out.push(n); } });
    });
    return out;
  }

  function editEvents() {
    return D.editEvents.map(function (e) {
      return {
        rowIndex: e.rowIndex, name: e.name,
        date: e.annual || fmtDate(e.inDays), resolvedDate: fmtDate(e.inDays),
        recurrence: e.recurrence, unlockTime: e.unlockTime, lockTime: e.lockTime,
        groups: e.groups, status: e.status, createdBy: e.createdBy,
        category: e.category, type: e.type, targetType: e.targetType, resolution: e.resolution
      };
    });
  }

  function schedules() {
    return D.schedules.map(function (s) {
      var ov = s.override ? JSON.parse(JSON.stringify(s.override)) : null;
      if (ov && typeof ov.until === 'string' && ov.until.indexOf('INDAYS:') === 0) {
        ov.until = fmtDate(parseInt(ov.until.split(':')[1], 10));
      }
      return {
        type: s.type, name: s.name, days: s.days, unlockTime: s.unlockTime, lockTime: s.lockTime,
        groups: s.groups, category: s.category, enabled: s.enabled, rowIndex: s.rowIndex, override: ov
      };
    });
  }

  function dashboard(days) {
    var win = days || 30;
    var trends = [];
    for (var i = win - 1; i >= 0; i--) trends.push({ date: fmtDate(-i), success: 12 + (i % 5), failed: (i % 9 === 0 ? 1 : 0) });
    var d = D.dashboard;
    return {
      success: true, windowDays: win,
      doorOpsTotal: d.doorOpsTotal, doorOpsSuccess: d.doorOpsSuccess, doorOpsFailed: d.doorOpsFailed,
      doorOpsSkipped: d.doorOpsSkipped, doorOpsAttempted: d.doorOpsAttempted,
      successRate: d.successRate, failRate: d.failRate, remediationCount: d.remediationCount,
      deviceOfflineCount: d.deviceOfflineCount, staleTriggersCount: d.staleTriggersCount, schedulingErrors: d.schedulingErrors,
      dailyTrends: trends, byActionType: d.byActionType, sportsSyncStats: d.sportsSyncStats,
      recentFailures: d.recentFailures.map(function (f) { return { timestamp: fmtDate(f.inDays) + ' ' + f.time, source: f.source, action: f.action, doors: f.doors, notes: f.notes }; }),
      emergencyOps: d.emergencyOps.map(function (o) { return { timestamp: fmtDate(o.inDays) + ' ' + o.time, action: o.action, result: o.result, notes: o.notes }; }),
      generatedAt: nowStamp()
    };
  }

  function buildDay(off) {
    var d = dateAt(off), dow = d.getDay(), weekend = (dow === 0 || dow === 6), weekday = !weekend, isToday = (off === 0);
    var delay = weekday && dow === 2;                       // Tuesdays run on a 2-hour delay
    var doorType = weekend ? 'Closed' : (delay ? '2HR Delay' : 'Normal');
    var churchMeets = (dow === 0 || dow === 3);             // Sun / Wed
    var evening = weekday && (isToday || dow === 5);        // today + Fridays get an evening event
    var curMin = new Date().getHours() * 60 + new Date().getMinutes();
    var school = delay ? { startMin: 540, endMin: 960, label: '2HR Delay', timeText: '9:00 AM – 4:00 PM' }
                       : { startMin: 420, endMin: 960, label: 'Normal', timeText: '7:00 AM – 4:00 PM' };
    var timeline = weekend ? null : {
      axisStartMin: 420, axisEndMin: 1260, nowMin: isToday ? curMin : null,
      ticks: [{ min: 420, label: '7a' }, { min: 600, label: '10a' }, { min: 780, label: '1p' }, { min: 960, label: '4p' }, { min: 1140, label: '7p' }, { min: 1260, label: '9p' }],
      school: school, schoolBars: [{ startMin: school.startMin, endMin: school.endMin }],
      events: evening ? [{ name: 'Evening Basketball', startMin: 1050, endMin: 1260, category: 'School', timeText: '5:30 PM – 9:00 PM' }] : [],
      eventBars: evening ? [{ startMin: 1050, endMin: 1260 }] : []
    };
    var open = [];
    if (weekday) open.push({ name: 'Main Entrance North', groups: 'Main Entrance', category: 'School', until: '4:00 PM', timeText: '7:00 AM – 4:00 PM' });
    if (evening) open.push({ name: 'Gym Lobby Doors', groups: 'Gym Lobby', category: 'School', until: '9:00 PM', timeText: '5:30 PM – 9:00 PM' });
    if (dow === 0) open.push({ name: 'Main Entrance', groups: 'Main Entrance', category: 'Church', until: '12:30 PM', timeText: '8:30 AM – 12:30 PM' });
    return {
      date: fmtDate(off), dow: DOW[dow], dateLabel: DOW[dow] + ', ' + MON[d.getMonth()] + ' ' + d.getDate(),
      isToday: isToday, doorType: doorType, doorActive: weekday,
      bellName: weekday ? 'Regular Day' : 'No bells', bellActive: weekday,
      church: churchMeets ? 'Meets today' : 'No church', churchMeets: churchMeets,
      eventCount: evening ? 1 : 0, timeline: timeline,
      openLabel: isToday ? 'Open now' : 'Scheduled to open', open: open,
      note: evening ? 'Gym Lobby will be unlocked until 9:00 PM.' : ''
    };
  }

  function changesSample(params, isNew) {
    var c = { type: isNew ? 'added' : 'changed', name: (params && params.name) || 'Door Window', unlock: (params && params.unlockTime) || '', lock: (params && params.lockTime) || '', groups: (params && params.groups) || 'ALL' };
    if (!isNew) c.prev = { unlock: '07:00', lock: '16:00', groups: c.groups };
    return [c];
  }

  var WRITE = { restoreNormal: 1, createEvent: 1, updateEvent: 1, cancelEvent: 1, syncTodaySchedule: 1, cancelTodayRow: 1, skipTodayRow: 1, updateSchedule: 1, tempScheduleChange: 1, cancelScheduleOverride: 1, scanEventCalendar: 1, syncSportsCalendar: 1 };

  function processPost(payload) {
    var a = payload && payload.action, res;
    switch (a) {
      case 'getDoorGroups': res = { success: true, groups: D.doorGroups, doors: D.doors }; break;
      case 'getTodayData':
        res = { success: true, today: fmtDate(0), serverTimezone: tz(), scheduleType: 'Normal', todayChurchStatus: 'closed', todayChurchMeets: false, doorGroups: D.doorGroups, doors: D.doors, doorActions: D.todayActions };
        break;
      case 'getDoorStates': res = { success: true, doors: D.liveStates }; break;
      case 'getEditData': res = { success: true, scheduleTypes: D.scheduleTypes, doorGroups: D.doorGroups, doors: D.doors, events: editEvents() }; break;
      case 'getSchedulesData': res = { success: true, doorGroups: D.doorGroups, schedules: schedules() }; break;
      case 'getEventConflicts': res = { success: true, hasConflict: false, conflicts: [] }; break;
      case 'getDashboardData': res = dashboard(parseInt(payload.days, 10) || 30); break;
      case 'quickControl': {
        var resolved = resolveTargets(payload.qcTargets);
        res = { success: true, action: payload.qcAction || 'Unlock', targets: payload.qcTargets || '', doors: resolved, date: payload.qcDate || fmtDate(0), startTime: payload.qcStart || '', endTime: payload.qcEnd || '', immediate: !!payload.qcImmediate, acted: resolved, failed: [], csrfToken: token() };
        break;
      }
      case 'addTodayRow': res = { success: true, changes: changesSample(payload, true), csrfToken: token() }; break;
      case 'updateTodayRow': res = { success: true, changes: changesSample(payload, false), csrfToken: token() }; break;
      case 'previewTodayRow': res = { success: true, changes: changesSample(payload, payload && payload.isNew !== false), csrfToken: token() }; break;
      case 'previewCancelTodayRow': res = { success: true, changes: [{ type: 'removed', name: 'Door Window', unlock: '', lock: '', groups: 'ALL' }], csrfToken: token() }; break;
      default:
        if (WRITE[a]) res = { success: true, csrfToken: token() };
        else res = { error: 'Unknown action: ' + a };
    }
    return res;
  }

  function getLeadershipStatus(mode) {
    var days;
    if (mode === 'week') { days = []; for (var i = 0; i < 7; i++) days.push(buildDay(i)); }
    else if (mode === 'tomorrow') days = [buildDay(1)];
    else days = [buildDay(0)];
    return { success: true, serverTimezone: tz(), lockdown: { active: false }, monitoring: { available: false }, days: days };
  }

  return { processPost: processPost, getLeadershipStatus: getLeadershipStatus };
})();
