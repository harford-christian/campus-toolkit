/* mock.js — Door Automation demo backend. Shared by index.html (tabs), dashboard.html,
   and leadership.html. Implements processPost (all read + write actions) and the
   dedicated getLeadershipStatus(mode). Read-only actions return real fabricated data.
   The Schedules writes (addSchedule, updateSchedule, updateScheduleBulk, tempScheduleChange,
   cancelScheduleOverride) mutate the in-memory rows with the server's own validation rules, so
   the tab re-reads what was saved; Quick Control runs as the server does now — quickControlStart
   hands back a token and quickControlProgress is polled until the run is done (three polls here:
   pending, half-way, done — then the record is gone). Other writes return {success:true, csrfToken}.
   serverTimezone is reported as the viewer's own zone so clock conversions are a no-op. */
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

  /* ---- Schedules: the server's validation (ScheduleAdminData.js _validateSchedule_), verbatim rules ---- */
  var HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  function validateSchedule(r) {
    if (!String(r.type || '').trim()) return 'Type is required (e.g. Normal, 2HR Delay, Summer, Church).';
    if (!String(r.days || '').trim()) return 'Days is required (e.g. DAILY, WEEKDAYS, WEEKENDS, or 1-5).';
    if (!HHMM.test(String(r.unlockTime || '')) || !HHMM.test(String(r.lockTime || ''))) return 'Unlock and Lock must be valid HH:MM times.';
    if (String(r.lockTime) <= String(r.unlockTime)) return 'Lock time must be after Unlock time.';
    return '';
  }
  function scheduleRow(rowIndex) { for (var i = 0; i < D.schedules.length; i++) if (D.schedules[i].rowIndex === Number(rowIndex)) return D.schedules[i]; return null; }
  function uuid() { return 'demo-' + Math.random().toString(16).slice(2, 10) + '-' + Math.random().toString(16).slice(2, 6); }
  function addSchedule(p) {
    var row = { type: String(p.type || '').trim(), name: String(p.name || '').trim() || String(p.type || '').trim(), days: String(p.days || '').trim(),
      unlockTime: String(p.unlockTime || '').trim(), lockTime: String(p.lockTime || '').trim(), groups: String(p.groups || '').trim() || 'ALL',
      category: String(p.category || '').trim() || 'School', enabled: (p.enabled === true || p.enabled === 'true'), override: null, id: uuid() };
    var err = validateSchedule(row);
    if (err) return { error: err };
    row.rowIndex = D.schedules.reduce(function (m, s) { return Math.max(m, s.rowIndex); }, 1) + 1;
    D.schedules.push(row);
    return { success: true, rebuildOk: true, csrfToken: token() };
  }
  function updateSchedule(p) {
    var row = scheduleRow(p.rowIndex);
    if (!row) return { error: 'Invalid rowIndex: ' + p.rowIndex };
    var next = { type: String(p.type || row.type).trim(), name: String(p.name || '').trim() || row.name, days: String(p.days || '').trim(),
      unlockTime: String(p.unlockTime || '').trim(), lockTime: String(p.lockTime || '').trim(), groups: String(p.groups || '').trim() || 'ALL',
      category: String(p.category || '').trim() || row.category, enabled: (p.enabled === true || p.enabled === 'true') };
    var err = validateSchedule(next);
    if (err) return { error: err };
    Object.keys(next).forEach(function (k) { row[k] = next[k]; });
    return { success: true, rebuildOk: true, csrfToken: token() };
  }
  function updateScheduleBulk(p) {
    var idx = (p.rowIndexes || []).map(Number), fields = p.fields || {};
    if (!idx.length) return { error: 'No rows selected.' };
    var rows = [];
    for (var i = 0; i < idx.length; i++) { var r = scheduleRow(idx[i]); if (!r) return { error: 'Invalid rowIndex: ' + idx[i] }; rows.push(r); }
    var merged = rows.map(function (r) {
      var m = {}; Object.keys(r).forEach(function (k) { m[k] = r[k]; });
      Object.keys(fields).forEach(function (k) {
        if (k === 'enabled') { m.enabled = (fields[k] === true || fields[k] === 'true'); return; }
        var v = String(fields[k] == null ? '' : fields[k]).trim();
        if (v) m[k] = v;                              // a blank value keeps the old one
      });
      return m;
    });
    for (var j = 0; j < merged.length; j++) {
      var e = validateSchedule(merged[j]);
      if (e) return { error: 'Row ' + rows[j].rowIndex + ' (' + rows[j].type + ' / ' + rows[j].name + '): ' + e };
    }
    merged.forEach(function (m, k) { ['name', 'days', 'unlockTime', 'lockTime', 'groups', 'category', 'enabled'].forEach(function (f) { rows[k][f] = m[f]; }); });
    return { success: true, rebuildOk: true, count: rows.length, csrfToken: token() };
  }
  function tempScheduleChange(p) {
    var row = scheduleRow(p.rowIndex);
    if (!row) return { error: 'Invalid rowIndex: ' + p.rowIndex };
    row.override = { soRow: row.rowIndex, until: String(p.until || fmtDate(7)), startDate: p.startDate ? String(p.startDate) : undefined,
      days: String(p.days || row.days), unlockTime: String(p.unlockTime || row.unlockTime), lockTime: String(p.lockTime || row.lockTime),
      groups: String(p.groups || row.groups), enabled: (p.enabled === true || p.enabled === 'true') };
    return { success: true, rebuildOk: true, csrfToken: token() };
  }
  function cancelScheduleOverride(p) {
    var hit = false;
    D.schedules.forEach(function (s) { if (s.override && Number(s.override.soRow) === Number(p.soRow)) { s.override = null; hit = true; } });
    return hit ? { success: true, rebuildOk: true, csrfToken: token() } : { error: 'No temporary change on row ' + p.soRow + '.' };
  }

  /* ---- Quick Control: start a run, then be polled (QuickControl.js shape) ---- */
  var QC_RUNS = {};
  function hhmmNow(plusMin) { var d = new Date(); d.setMinutes(d.getMinutes() + (plusMin || 0)); var h = d.getHours(), m = d.getMinutes();
    if (plusMin && (d.getDate() !== new Date().getDate())) { h = 23; m = 59; } return pad(h) + ':' + pad(m); }
  function quickControlStart(p) {
    var action = String(p.qcAction || '');
    if (action !== 'Unlock' && action !== 'Lock') return { error: 'action must be "Unlock" or "Lock"' };
    var doors = resolveTargets(p.qcTargets);
    if (!doors.length) return { error: 'No active doors match targets: "' + (p.qcTargets || '') + '"' };
    var immediate = !(p.qcImmediate === false || p.qcImmediate === 'false');
    if (!immediate) {
      if (!HHMM.test(String(p.qcStart || ''))) return { error: 'invalid start time' };
      if (!HHMM.test(String(p.qcEnd || ''))) return { error: 'invalid end time (give endTime or durationMins)' };
      if (String(p.qcEnd) <= String(p.qcStart)) return { error: 'end time must be after start time' };
      return { success: true, immediate: false, action: action, targets: p.qcTargets || '', doors: doors, date: p.qcDate || fmtDate(0),
               startTime: p.qcStart, endTime: p.qcEnd, csrfToken: token() };
    }
    var start = hhmmNow(0), end;
    if (p.qcEnd) { if (!HHMM.test(String(p.qcEnd))) return { error: 'invalid end time (give endTime or durationMins)' }; end = String(p.qcEnd); }
    else { var mins = parseInt(p.qcDuration, 10); if (!(mins > 0)) return { error: 'invalid end time (give endTime or durationMins)' }; end = hhmmNow(mins); }
    if (end <= start) return { error: 'end time must be after start time' };
    var tok = 'qc-' + Math.random().toString(16).slice(2, 10);
    QC_RUNS[tok] = { polls: 0, action: action, targets: p.qcTargets || '', doors: doors, startTime: start, endTime: end, startedAt: nowStamp() };
    return { success: true, immediate: true, token: tok, action: action, targets: p.qcTargets || '', doors: doors, total: doors.length,
             date: fmtDate(0), startTime: start, endTime: end, csrfToken: token() };
  }
  function quickControlProgress(p) {
    if (!p || !p.token) return { error: 'no token' };
    var run = QC_RUNS[p.token];
    if (!run) return { status: 'unknown' };
    run.polls++;
    var n = run.polls === 1 ? 0 : run.polls === 2 ? Math.ceil(run.doors.length / 2) : run.doors.length;
    var status = run.polls === 1 ? 'pending' : run.polls === 2 ? 'running' : 'done';
    var done = run.doors.slice(0, n);
    done.forEach(function (name) { D.liveStates.forEach(function (d) { if (d.name === name && d.ison !== null) d.ison = (run.action === 'Unlock'); }); });
    var out = { token: p.token, status: status, action: run.action, targets: run.targets, total: run.doors.length, done: done, failed: [],
                startTime: run.startTime, endTime: run.endTime, startedAt: run.startedAt };
    if (status === 'done') delete QC_RUNS[p.token];       // the server forgets a run once its 'done' has been read
    return out;
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
      case 'getSchedulesData': res = { success: true, doorGroups: D.doorGroups, doors: D.doors, schedules: schedules() }; break;
      case 'getEventConflicts': res = { success: true, hasConflict: false, conflicts: [] }; break;
      case 'getDashboardData': res = dashboard(parseInt(payload.days, 10) || 30); break;
      case 'quickControlStart': res = quickControlStart(payload); break;
      case 'quickControlProgress': res = quickControlProgress(payload); break;
      case 'addSchedule': res = addSchedule(payload); break;
      case 'updateSchedule': res = updateSchedule(payload); break;
      case 'updateScheduleBulk': res = updateScheduleBulk(payload); break;
      case 'tempScheduleChange': res = tempScheduleChange(payload); break;
      case 'cancelScheduleOverride': res = cancelScheduleOverride(payload); break;
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
