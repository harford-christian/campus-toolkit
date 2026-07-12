/* mock.js — Bell Schedule (Live Bell Schedule Hub) demo backend.
   Implements one window.MOCK_BACKEND method per server function the client's call(fn,...args)
   helper invokes via google.script.run. Return shapes mirror the hub's Editor.gs / Resolver.gs.
   Custom-day edits are stateful in memory for the session (saveEditorDay / createCustomAndSeed /
   saveAsPermanentCalendar / setModeMap mutate SESSION), so the calendar + editor feel live. */
window.MOCK_BACKEND = (function () {
  'use strict';
  var D = window.BELL_DATA;
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // In-memory session overlay (survives within one page load, like the live Sheet within a session).
  var SESSION = { savedDays: {}, calendars: D.calendars.slice(), modeMap: {} };
  Object.keys(D.modeMap).forEach(function (k) { SESSION.modeMap[k] = D.modeMap[k]; });

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(t) { var m = String(t).split(':'); return (+m[0]) * 60 + (+m[1]); }
  function dow(ds) { return new Date(ds + 'T12:00:00').getDay(); }
  function isWeekend(ds) { var w = dow(ds); return w === 0 || w === 6; }
  function addDays(ds, n) {
    var d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowISO() { return new Date().toISOString(); }

  // {t,n,tone,z} -> resolved BELL (bells[]) / editor BELLROW (rows[]).
  function toBell(b) {
    var hm = b.t.split(':');
    return { time: b.t, hour: +hm[0], minute: +hm[1], zone: b.z, tone: b.tone, name: b.n, timesToPlay: 1, relay: 'relaynone' };
  }
  function toRow(b) { return { time: b.t, zone: b.z, tone: b.tone, name: b.n, ttp: 1, relay: 'relaynone' }; }

  // Template / schedule name -> a compact bell set from data.js.
  function setForTemplate(name) {
    var key = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!key || key === 'NORMAL' || key === 'STANDARD') return D.bells.NORMAL;
    if (key === '2HRDELAY' || key === '2HOURDELAY') return D.bells.DELAY2;
    if (key === '3HRRELEASE' || key === '3HOURRELEASE') return D.bells.RELEASE3;
    if (key === '3HRDELAY' || key === '3HOURDELAY') return D.bells.RELEASE3;
    if (key === 'EXAM' || key === 'EXAMWEEK' || key === 'EXAMS') return D.bells.EXAM_MON;
    if (key === 'CHAPELDAY' || key === 'CHAPEL') return D.bells.CHAPEL;
    if (key === 'NOBELLS') return [];
    return D.bells.NORMAL;
  }

  // Resolve a single date's flavor -> {source, schedule, doorMode, set}.
  function resolveDay(ds) {
    if (isWeekend(ds)) return { source: 'closed', schedule: 'No School (closed)', doorMode: null, set: [] };
    var f = (ds.slice(0, 7) === '2026-09') ? D.flavors[ds] : null;
    if (!f) return { source: 'base', schedule: 'Normal', doorMode: 'Normal', set: D.bells.NORMAL };
    // A day whose custom span has been saved this session, or a preconfigured custom day.
    var set;
    if (f.source === 'custom-unconfigured') set = SESSION.savedDays[ds] ? SESSION.savedDays[ds].set : [];
    else if (f.span === 'chapel') set = D.bells.CHAPEL;
    else if (f.span === 'exam') set = examSetFor(ds);
    else set = setForTemplate(f.schedule);
    if (SESSION.savedDays[ds]) set = SESSION.savedDays[ds].set;
    return { source: f.source, schedule: f.schedule, doorMode: f.doorMode, set: set };
  }

  function examSetFor(ds) {
    var key = D.spans.exam.days[ds];
    return key ? D.bells[key] : [];
  }

  // Build one editor-day object {date, weekday, doorMode, rows, envelope, configured}.
  function editorDay(ds, set, envelope, configured, doorMode) {
    return {
      date: ds, weekday: WD[dow(ds)],
      doorMode: (doorMode === undefined ? 'Normal' : doorMode),
      rows: (set || []).map(toRow),
      envelope: envelope || 'Normal',
      configured: !!configured
    };
  }

  function spanObj(name, startDate, endDate, baseTemplate, weatherBehavior) {
    return {
      name: name, startDate: startDate, endDate: endDate,
      baseTemplate: baseTemplate || '', weatherBehavior: weatherBehavior || 'override',
      status: 'active', createdBy: 'demo', createdAt: nowISO(), rowIndex: 2
    };
  }

  return {
    // ---- config ----
    getEditorConfig: function () {
      return {
        today: D.today,
        timezone: D.timezone,
        constantBellNames: D.constantBellNames.slice(),
        calendars: SESSION.calendars.slice(),
        modeMap: clone(SESSION.modeMap)
      };
    },

    // ---- month coloring: [{date, source, label}] for every day of year/month (month 1-12) ----
    getMonthSources: function (year, month) {
      var out = [], dim = new Date(year, month, 0).getDate();
      for (var day = 1; day <= dim; day++) {
        var ds = year + '-' + pad(month) + '-' + pad(day);
        if (isWeekend(ds)) { out.push({ date: ds, source: 'closed', label: '—' }); continue; }
        var f = (year === D.year && month === D.month) ? D.flavors[ds] : null;
        if (f) out.push({ date: ds, source: f.source, label: f.label });
        else out.push({ date: ds, source: 'base', label: 'Normal' });
      }
      return out;
    },

    // ---- resolved week: array of getActiveSchedule-shaped objects ----
    getWeek: function (startDate, days) {
      var start = startDate || D.today, n = days || 7, out = [];
      for (var i = 0; i < n; i++) {
        var ds = addDays(start, i), r = resolveDay(ds);
        var tab = r.source === 'closed' ? 'NO_Bells'
          : r.source === 'base' ? 'Normal'
            : r.source === 'weather' ? (r.schedule.indexOf('2HR') >= 0 ? '2HR_Delay' : '3HR_Release')
              : 'Custom';
        out.push({
          date: ds, weekday: WD[dow(ds)], weekdayNum: dow(ds),
          doorMode: r.doorMode, source: r.source, scheduleName: r.schedule, tab: tab,
          bells: (r.set || []).map(toBell), bellCount: (r.set || []).length,
          warning: null, drift: null, generatedAt: nowISO()
        });
      }
      return out;
    },

    // ---- load a custom span for editing ----
    getEditorSpanByDate: function (dateStr) {
      var f = (dateStr.slice(0, 7) === '2026-09') ? D.flavors[dateStr] : null;

      if (f && f.span === 'chapel') {
        var cset = SESSION.savedDays[dateStr] ? SESSION.savedDays[dateStr].set : D.bells.CHAPEL;
        return {
          span: spanObj(D.spans.chapel.name, dateStr, dateStr, D.spans.chapel.baseTemplate, D.spans.chapel.weatherBehavior),
          days: [editorDay(dateStr, cset, 'Normal', true, 'Normal')]
        };
      }

      if (f && f.span === 'exam') {
        var ex = D.spans.exam, days = [];
        for (var ds = ex.startDate; ds <= ex.endDate; ds = addDays(ds, 1)) {
          if (SESSION.savedDays[ds]) { days.push(editorDay(ds, SESSION.savedDays[ds].set, 'Normal', true, 'Normal')); }
          else if (ex.days[ds]) { days.push(editorDay(ds, D.bells[ex.days[ds]], 'Normal', true, 'Normal')); }
          else { days.push(editorDay(ds, [], 'Normal', false, 'Normal')); }   // the intentionally-unset day
          if (ds === ex.endDate) break;
        }
        return { span: spanObj(ex.name, ex.startDate, ex.endDate, ex.baseTemplate, ex.weatherBehavior), days: days };
      }

      // Not inside a custom span -> no span; a single Normal day (client opens the Create panel).
      return { span: null, days: [editorDay(dateStr, D.bells.NORMAL, 'Normal', true, 'Normal')] };
    },

    // ---- suggested (unsaved) rows for a day from a template ----
    seedDayPreview: function (dateStr, template) {
      var env = template || 'Normal';
      return {
        envelope: env,
        rows: setForTemplate(template).map(toRow),
        note: 'Framing from "' + env + '".'
      };
    },

    // ---- writes (stateful) ----
    saveEditorDay: function (dateStr, rows, envelope) {
      SESSION.savedDays[dateStr] = {
        set: (rows || []).map(function (r) { return { t: r.time, n: r.name, tone: r.tone, z: r.zone }; })
      };
      return { ok: true, date: dateStr, rows: rows, envelope: envelope };
    },

    createCustomAndSeed: function (name, startDate, endDate, template, weatherBehavior) {
      var days = [];
      for (var ds = startDate; ds <= endDate; ds = addDays(ds, 1)) {
        if (isWeekend(ds)) { days.push(editorDay(ds, [], 'closed', false, null)); }
        else { days.push(editorDay(ds, setForTemplate(template), template || 'Normal', true, 'Normal')); }
        if (ds === endDate) break;
      }
      return { span: spanObj(name, startDate, endDate, template, weatherBehavior), days: days };
    },

    saveAsPermanentCalendar: function (name, rows, sourceTemplate, mapDoorType) {
      name = String(name || '').trim();
      if (name && SESSION.calendars.indexOf(name) < 0) SESSION.calendars.push(name);
      if (mapDoorType) SESSION.modeMap[String(mapDoorType).toUpperCase().replace(/[^A-Z0-9]/g, '')] = name;
      return { ok: true, calendar: name, rows: (rows || []).length, mappedDoorType: mapDoorType || '' };
    },

    setModeMap: function (doorType, calendar) {
      SESSION.modeMap[String(doorType).toUpperCase().replace(/[^A-Z0-9]/g, '')] = calendar;
      return { ok: true, updated: true };
    }
  };
})();
