/* mock.js — the Memo Check demo's stand-in for Google, and nothing else.

   logic.js is Memo Check's own server code (see build-logic.mjs). This file gives it:
     1. the config the public copy leaves out (ids, addresses, the door inventory) as demo values, and two stubs:
        the chapel / memo-notes side tasks (not part of this demo) and the production prompt's campus rules (they
        name real doors, so a short stand-in takes their place);
     2. Apps Script services over plain JavaScript: an in-memory SpreadsheetApp (the Memo Check sheet and the CMS
        sheet), CalendarApp (Staff Events and School Events), GmailApp (the staff list's mail), MailApp (an outbox),
        PropertiesService, CacheService, Session (who is signed in) and Utilities, with a PINNED CLOCK;
     3. UrlFetchApp, which answers the real mcAnalyze_'s one HTTPS call to the model with the canned reply for that
        email (data.js) and keeps the request, so the demo can show what the model was actually sent;
     4. the replay: on a fresh visit the demo runs data.js's history at the times it happened, through the REAL
        hourly tick (memoCheckTick) and the REAL queue endpoint (mcQueueDecide), so every row, id, duplicate tag,
        note, digest and "applied" mark is the app's own output;
     5. Eagle Eye, which is not in this demo: "Make the Eagle Eye clicks" writes to the plan what the clicks would
        write, so the real hourly check can find it and mark the row applied.
   State lives in sessionStorage for the visit; Reset clears it. */
(function () {
  'use strict';
  var D = window.MEMO_DATA, L = window.MEMO_LOGIC, G = window;
  var KEY = 'memo-demo-state-v1', USER_KEY = 'memo-demo-user';

  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function load(k) { var s = store(); if (!s) return null; try { return JSON.parse(s.getItem(k) || 'null'); } catch (e) { return null; } }
  function save(k, v) { var s = store(); if (!s) return; try { s.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ------------------------------------------------------------------ the pinned clock
     School-local wall time. Each replay step sets it exactly; for the visit it is data.js's "now" plus however
     long the visitor has been here (kept across reloads, so a decision never predates the page). */
  var RealDate = Date;
  var clock = { base: new RealDate(D.demo.now).getTime(), realAt: RealDate.now() };
  function nowMs() { return clock.base + (RealDate.now() - clock.realAt); }
  function setClock(isoLocal) { clock.base = new RealDate(isoLocal).getTime(); clock.realAt = RealDate.now(); }
  class PinnedDate extends RealDate {
    constructor() { if (arguments.length) super(...arguments); else super(nowMs()); }
    static now() { return nowMs(); }
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function formatDate(d, tz, fmt) {
    var y = d.getFullYear(), mo = d.getMonth() + 1, day = d.getDate(), H = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    return String(fmt).replace(/'([^']*)'|yyyy|MMM|MM|dd|HH|mm|ss|EEE|d|h|a/g, function (tok, lit) {
      if (lit !== undefined) return lit;
      switch (tok) {
        case 'yyyy': return String(y); case 'MMM': return MON[mo - 1]; case 'MM': return p2(mo); case 'dd': return p2(day);
        case 'HH': return p2(H); case 'mm': return p2(m); case 'ss': return p2(s); case 'EEE': return DOW[d.getDay()];
        case 'd': return String(day); case 'h': return String(H % 12 || 12); case 'a': return H >= 12 ? 'PM' : 'AM';
      }
      return tok;
    });
  }

  /* ------------------------------------------------------------------ state */
  var state = null;
  function fresh() {
    return {
      v: 1,
      books: {},                                  // id -> { name, order: [tab], tabs: { tab: values[][] } }
      props: { MC_SEND: 'true', ANTHROPIC_API_KEY: 'demo-key-not-real' },
      events: JSON.parse(JSON.stringify(D.calendars)),
      labels: {}, outbox: [], calls: {}, nextBook: 1, visitStartedAt: null
    };
  }
  function persist() { save(KEY, state); }

  /* ------------------------------------------------------------------ SpreadsheetApp */
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
      for (var j = 0; j < this.nc; j++) row[this.c - 1 + j] = vals[i][j];
    }
    persist(); return this;
  };
  Range.prototype.setValue = function (x) { return this.setValues([[x]]); };
  ['setFontWeight', 'setBackground', 'setFontColor', 'setNumberFormat'].forEach(function (k) { Range.prototype[k] = function () { return this; }; });
  function Sheet(book, name) { this.book = book; this.name = name; this.v = book.tabs[name]; }
  Sheet.prototype.getName = function () { return this.name; };
  Sheet.prototype.getLastRow = function () { return this.v.length; };
  Sheet.prototype.getLastColumn = function () { return this.v.reduce(function (m, r) { return Math.max(m, r.length); }, 0); };
  Sheet.prototype.getDataRange = function () { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); };
  Sheet.prototype.getRange = function (r, c, nr, nc) { return new Range(this, r, c, nr, nc); };
  Sheet.prototype.appendRow = function (row) { this.v.push(row.slice()); persist(); return this; };
  Sheet.prototype.setFrozenRows = function () { return this; };
  Sheet.prototype.setColumnWidth = function () { return this; };
  function Book(id) { this.id = id; this.b = state.books[id]; }
  Book.prototype.getId = function () { return this.id; };
  Book.prototype.getName = function () { return this.b.name; };
  Book.prototype.getSheetByName = function (n) { return this.b.tabs[n] ? new Sheet(this.b, n) : null; };
  Book.prototype.getSheets = function () { var self = this; return this.b.order.map(function (n) { return new Sheet(self.b, n); }); };
  Book.prototype.insertSheet = function (n) { this.b.tabs[n] = []; this.b.order.push(n); persist(); return new Sheet(this.b, n); };
  Book.prototype.deleteSheet = function (sh) { delete this.b.tabs[sh.name]; this.b.order = this.b.order.filter(function (n) { return n !== sh.name; }); persist(); };
  var SpreadsheetApp = {
    openById: function (id) { if (!state.books[id]) throw new Error('Spreadsheet not found: ' + id); return new Book(id); },
    create: function (name) {
      var id = 'memo-check-sheet-' + (state.nextBook++);
      state.books[id] = { name: name, order: ['Sheet1'], tabs: { Sheet1: [] } };
      persist(); return new Book(id);
    }
  };

  /* ------------------------------------------------------------------ CalendarApp */
  function localDate(s) { return new RealDate(/T/.test(s) ? s + ':00' : s + 'T00:00:00'); }
  var CalendarApp = {
    getCalendarById: function (id) {
      if (!state.events[id]) return null;
      return {
        getEvents: function (from, to) {
          return state.events[id].filter(function (e) { return localDate(e.start) < to && localDate(e.end) > from; }).map(function (e) {
            return { getTitle: function () { return e.title; }, getDescription: function () { return e.description || ''; },
              isAllDayEvent: function () { return !!e.allDay; }, getStartTime: function () { return localDate(e.start); },
              getEndTime: function () { return localDate(e.end); } };
          });
        }
      };
    }
  };

  /* ------------------------------------------------------------------ GmailApp
     The staff list's mail as the itscripts@ mailbox sees it: a message exists once its send time has passed, and
     search honours the one operator that matters here, newer_than:Nd (the tick looks back five days). */
  function msgObj(m) {
    return {
      getId: function () { return m.id; }, getDate: function () { return new RealDate(m.date); }, getFrom: function () { return m.from; },
      getTo: function () { return m.to; }, getCc: function () { return m.cc; }, getSubject: function () { return m.subject; },
      getPlainBody: function () { return m.body; }, getBody: function () { return m.body.replace(/\n/g, '<br>'); },
      getAttachments: function () { return []; }, isInTrash: function () { return false; },
      getThread: function () { return threadObj(m.threadId); }
    };
  }
  function arrived() { var t = nowMs(); return D.messages.filter(function (m) { return new RealDate(m.date).getTime() <= t; }); }
  function threadObj(tid) {
    return {
      getId: function () { return tid; },
      getMessages: function () { return arrived().filter(function (m) { return m.threadId === tid; }).map(msgObj); },
      addLabel: function (label) { state.labels[tid] = label.getName(); persist(); return this; }
    };
  }
  var GmailApp = {
    search: function (q) {
      var days = Number((/newer_than:(\d+)d/.exec(q) || [])[1] || 3650), since = nowMs() - days * 86400000;
      var seen = {}, out = [];
      arrived().forEach(function (m) {
        if (new RealDate(m.date).getTime() < since || seen[m.threadId]) return;
        seen[m.threadId] = true; out.push(threadObj(m.threadId));
      });
      return out;
    },
    getUserLabelByName: function (n) { return state.labels['__made_' + n] ? { getName: function () { return n; } } : null; },
    createLabel: function (n) { state.labels['__made_' + n] = true; persist(); return { getName: function () { return n; } }; }
  };

  /* ------------------------------------------------------------------ UrlFetchApp: the model call, canned */
  function response(code, body) { return { getResponseCode: function () { return code; }, getContentText: function () { return body; } }; }
  var UrlFetchApp = {
    fetch: function (url, opts) {
      if (url !== L.MC_API_URL) return response(404, 'not found');
      var req = JSON.parse(opts.payload), user = req.messages[0].content;
      var subj = (/^Subject: (.*)$/m.exec(user) || [])[1] || '', sent = (/^Sent: (\S+ \S+)/m.exec(user) || [])[1] || '';
      var msg = D.messages.filter(function (m) { return m.subject === subj && m.date.replace('T', ' ').slice(0, 16) === sent; })[0];
      var canned = msg && D.model[msg.id];
      if (!canned) return response(500, '{"error":"the demo has no canned reply for this email"}');
      var reply = { summary: canned.summary, findings: canned.findings };
      state.calls[msg.id] = { at: formatDate(new PinnedDate(), '', 'yyyy-MM-dd HH:mm'), model: req.model, effort: req.output_config.effort,
        system: req.system[0].text, user: user, reply: reply, usage: canned.usage };
      persist();
      return response(200, JSON.stringify({ model: req.model, stop_reason: 'end_turn', usage: canned.usage,
        content: [{ type: 'text', text: JSON.stringify(reply) }] }));
    }
  };

  /* ------------------------------------------------------------------ the rest of Google */
  var props = {
    getProperty: function (k) { return Object.prototype.hasOwnProperty.call(state.props, k) ? state.props[k] : null; },
    setProperty: function (k, v) { state.props[k] = String(v); persist(); return props; },
    deleteProperty: function (k) { delete state.props[k]; persist(); return props; },
    getProperties: function () { return Object.assign({}, state.props); }
  };
  var cacheStore = {};
  var cache = { get: function (k) { return Object.prototype.hasOwnProperty.call(cacheStore, k) ? cacheStore[k] : null; },
    put: function (k, v) { cacheStore[k] = String(v); }, remove: function (k) { delete cacheStore[k]; } };
  var activeUser = load(USER_KEY) || D.demo.user;
  L.bind({
    SpreadsheetApp: SpreadsheetApp, CalendarApp: CalendarApp, GmailApp: GmailApp, UrlFetchApp: UrlFetchApp,
    MailApp: { sendEmail: function (o) { state.outbox.push({ at: formatDate(new PinnedDate(), '', 'yyyy-MM-dd HH:mm'), to: o.to,
      subject: o.subject, html: o.htmlBody || '', text: o.body || '' }); persist(); } },
    PropertiesService: { getScriptProperties: function () { return props; } },
    CacheService: { getScriptCache: function () { return cache; } },
    Session: { getActiveUser: function () { return { getEmail: function () { return activeUser; } }; },
               getEffectiveUser: function () { return { getEmail: function () { return 'itscripts@example.edu'; } }; } },
    Utilities: { formatDate: formatDate, getUuid: function () { return 'tok-' + Math.random().toString(36).slice(2, 12); } },
    Logger: { log: function () { if (window.MEMO_DEBUG && window.console) console.log.apply(console, arguments); } },
    ScriptApp: { getService: function () { return { getUrl: function () { return ''; } }; } },
    HtmlService: null,
    Date: PinnedDate
  });

  /* ------------------------------------------------------------------ the config the public copy leaves out */
  G.MC_DISTRO = D.demo.distro;
  G.MC_CMS_SHEET_ID = 'cms-demo';
  G.MC_CALENDARS = [{ name: 'Staff Events', id: 'staff-events-demo' }, { name: 'School Events', id: 'school-events-demo' }];
  G.MC_EAGLE_EYE_URL = '../campus-control/index.html';   // Eagle Eye itself is not in the showcase; the Campus Control suite is
  G.MC_WEBAPP_URL_DEFAULT = 'queue.html';
  G.MC_SUPER_ADMIN = 'itscripts@example.edu';
  G.MC_DEFAULT_NOTIFY_TO = 'facilities@example.edu,it@example.edu';
  G.MC_DEFAULT_ALERT_TO = 'it@example.edu';
  G.MC_DOORS = D.doors;
  G.MC_RULES_SEED = D.rulesSeed;
  G.mcChapelTick_ = function () { return { found: false, reason: 'not part of this demo' }; };
  G.mcNotesTick_ = function () { return []; };
  G.mcSystemPromptCore_ = function () {
    return [
      'You are the schedule analyst for a school\'s "Campus Control": the automation that rings the bells, unlocks and locks',
      'building doors, and plays PA dismissal announcements. You read ONE email sent to the all-staff list and decide which',
      'statements in it should change what Campus Control already plans. You PROPOSE; humans approve. Cite the email\'s words',
      'and never invent dates.',
      '',
      '(Demo stand-in: the production prompt continues with how the plan is published, the school\'s numbered norm rules —',
      'chapel days and bell grids, in-service days, early releases, exam spans, closures, evening events and door windows —',
      'and rules of engagement for dates, gaps and confidence. Its campus details are not published here.)'
    ];
  };

  /* ------------------------------------------------------------------ Eagle Eye, as far as the plan can see it
     What the human's clicks write, for each approved row: the CMS Schedule cell (door type in B, bell in H) or a
     Staff Events entry carrying the door tags. The real hourly check then reads the plan and decides "applied". */
  function makeClicks(by) {
    var rows = L.mcFindingsRows_().filter(function (r) { return r.Status === L.MC_ST.APPROVED; });
    var cms = SpreadsheetApp.openById(G.MC_CMS_SHEET_ID).getSheetByName(L.MC_CMS_SCHEDULE_TAB);
    var made = [], stamp = formatDate(new PinnedDate(), '', 'yyyy-MM-dd HH:mm');
    rows.forEach(function (r) {
      var p = {}; try { p = JSON.parse(r.ActionParams || '{}') || {}; } catch (e) {}
      var dates = []; for (var d = r.Date; d <= (r.EndDate || r.Date); d = L._mcAddDays_(d, 1)) dates.push(d);
      function setDay(door, bell) {
        dates.forEach(function (ds) {
          for (var i = 1; i < cms.v.length; i++) if (cms.v[i][0] === ds) {
            if (door) cms.v[i][1] = door;
            if (bell) cms.v[i][7] = bell;
            cms.v[i][2] = 'Eagle Eye'; cms.v[i][3] = 'Memo Check ' + r.Id; cms.v[i][4] = by; cms.v[i][5] = stamp;
          }
        });
      }
      switch (r.Action) {
        case 'bells_ring_as': setDay('', 'Normal_' + p.ringAs); break;
        case 'early_release': setDay(p.hours + 'HR Release', p.hours + 'HR_Release'); break;
        case 'delay': setDay(p.hours + 'HR Delay', p.hours + 'HR_Delay'); break;
        case 'closure': setDay('Weekend_Holiday', 'NO_Bells'); break;
        case 'no_bells': setDay('', 'NO_Bells'); break;
        case 'exam_custom_span': setDay('', 'Exam'); break;
        case 'door_unlock':
          var groups = L._mcDoorGroupsFor_([].concat(p.doors || []).concat(p.buildings || []));
          state.events['staff-events-demo'].push({
            title: p.title || L.mcActionLabel_({ action: r.Action, action_params: r.ActionParams }),
            start: r.Date + 'T' + (p.eventStart || p.start), end: r.Date + 'T' + (p.eventEnd || p.end), allDay: false,
            description: 'Door Schedule: Event\nDoors: ' + groups.join(', ') + '\nUnlock Start: ' + r.Date + ' ' + p.start +
                         '\nUnlock End: ' + r.Date + ' ' + p.end + (p.location ? '\nLocation: ' + p.location : '')
          });
          break;
        case 'pa_dismissal':
          state.events['staff-events-demo'].push({ title: 'PA dismissal', start: r.Date + 'T' + p.time, end: r.Date + 'T' + p.time,
            allDay: false, description: 'dismissal ' + p.time });
          break;
      }
      made.push(r.Id);
    });
    persist();
    return made;
  }

  /* ------------------------------------------------------------------ boot: replay data.js's history */
  function asUser(email, fn) { var was = activeUser; activeUser = email; try { return fn(); } finally { activeUser = was; } }
  function findingId(msgId, n) { return msgId.slice(-8) + '-' + n; }
  function replay() {
    state = fresh();
    state.books['cms-demo'] = { name: 'Campus Master Schedule (demo)', order: ['Schedule', 'Permissions'],
      tabs: { Schedule: D.scheduleRows(), Permissions: D.permissions.map(function (r) { return r.slice(); }) } };
    D.timeline.forEach(function (step) {
      setClock(step.at);
      if (step.tick) L.memoCheckTick();
      if (step.decide) asUser(step.as, function () {
        step.decide.forEach(function (d) {
          var token = L.mcQueueBootstrap_(step.as, '').token;
          var res = L.mcQueueDecide({ id: findingId(d.msg, d.n), decision: d.decision, note: d.note || '', params: d.params || {}, token: token });
          if (!res.ok) throw new Error('replay: ' + d.decision + ' ' + findingId(d.msg, d.n) + ' failed: ' + res.error);
        });
      });
      if (step.clicks) makeClicks('dprentiss@example.edu');
    });
    setClock(D.demo.now);
    state.visitStartedAt = RealDate.now();
    persist();
  }
  state = load(KEY);
  if (!state || state.v !== 1) replay();
  else clock = { base: new RealDate(D.demo.now).getTime(), realAt: state.visitStartedAt || RealDate.now() };

  /* ------------------------------------------------------------------ the page's server, and the demo's own API */
  // The queue's "open email" link points at Gmail in production; in the demo it opens the message in the Staff email view.
  function demoLinks(row) { if (row && row.permalink) row.permalink = 'inbox.html#' + row.permalink.split('/').pop(); return row; }
  window.MOCK_BACKEND = {
    mcQueueDecide: function (req) { var res = L.mcQueueDecide(req); if (res && res.row) demoLinks(res.row); return res; }
  };
  window.MEMO_DEMO = {
    /** What doGet injects as BOOT: the real mcQueueBootstrap_ for whoever is signed in, ?id= focusing a row. */
    boot: function () {
      var id = ''; try { id = (new URLSearchParams(location.search).get('id') || '').replace(/[^0-9A-Za-z-]/g, ''); } catch (e) {}
      var b = L.mcQueueBootstrap_(activeUser, id);
      b.rows.forEach(demoLinks);
      return b;
    },
    user: function () { return activeUser; },
    setUser: function (email) { save(USER_KEY, email); activeUser = email; },
    users: function () { return D.permissions.slice(1).map(function (r) { return { email: r[0], name: r[1], canDecide: r[2] === 'TRUE' }; }); },
    messages: function () { return D.messages.filter(function (m) { return new RealDate(m.date).getTime() <= nowMs(); }); },
    calls: function () { return state.calls; },
    outbox: function () { return state.outbox.slice(); },
    rows: function () { return L.mcFindingsRows_(); },
    log: function () { var sh = L.mcSheet_().getSheetByName(L.MC_LOG_TAB); return sh ? sh.getDataRange().getValues() : []; },
    plan: function () { return L.mcPlanSnapshot_(L._mcToday_()); },
    approved: function () { return L.mcFindingsRows_().filter(function (r) { return r.Status === L.MC_ST.APPROVED; }).length; },
    makeClicks: function () { return makeClicks(activeUser); },
    runTick: function () {
      var before = {}; L.mcFindingsRows_().forEach(function (r) { before[r.Id] = r.Status; });
      L.memoCheckTick();
      return L.mcFindingsRows_().filter(function (r) { return r.Status === L.MC_ST.APPLIED && before[r.Id] !== L.MC_ST.APPLIED; }).map(function (r) { return r.Id; });
    },
    now: function () { return formatDate(new PinnedDate(), '', 'EEE MMM d, yyyy h:mm a'); },
    reset: function () { var s = store(); if (s) { s.removeItem(KEY); s.removeItem(USER_KEY); } }
  };
})();
