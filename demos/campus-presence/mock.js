/* mock.js — Campus Presence demo backend.

   The whole system talks to its server through exactly TWO google.script.run names, each taking
   a {op: '...'} envelope: officeApi(request) for the staff surfaces and kioskApi(request) for the
   iPads. So this file is one dispatcher per app, and the four pages' own untouched JavaScript
   does everything else.

   IT RUNS THE REAL LOGIC. logic.js is the source project's logic/ folder copied verbatim, and
   every op below hands the fabricated rows in data.js to the SAME pure functions the production
   server calls — Presence.derive, Badges.derive, Metrics.build, Events.makeEvent,
   Pickup.parsePickupContacts/contactsForStudent/matchTypedName, Search.searchStudents,
   Directory.buildStudents, Notify.resolveFollowUp. Nothing on screen is a hand-faked screenshot:
   the off-campus list, the building counts, the open flag, the KPI tiles and the pickup verdicts
   are all the app's own classification of this dataset.

   Ops, mirroring server/OfficeApi.js and server/KioskApi.js:
     officeApi   ping · bootstrap · getBoardSnapshot · resolveFlag · acknowledge · markPaged ·
                 manualVisitorOut · getMusterReport · getMetrics · getSettings · listPermissions
                 (saveSetting / savePermission / removePermission answer with a friendly
                  read-only error, which the shim routes to the page's failure handler)
     kioskApi    ping · bootstrap · searchStudents · visitorIn · visitorLookupBadge ·
                 visitorOpenList · visitorOut · lateIn · checkPickup · earlyOut

   WHAT IS DEMO-ONLY, stated plainly:
     * The Permissions gate and the kiosk URL-key gate always PASS here — a demo has no signed-in
       Google account and no Script Properties. In production requireOffice_() / requireKioskKey_()
       run on every single call and throw FORBIDDEN / DENIED, which the pages render as a
       permanent denied gate.
     * Mail is not sent. Where the server would email a teacher or the mismatch-alert list, the
       response says which follow-up mode fired and the board shows the pending row.
     * The pickup-check rate limiter (10/min per station) IS implemented, because it is a security
       behaviour worth showing. The search limiter (60/min per station) is not: it exists to cap
       bulk roster extraction by a script, and enforcing it here would only punish a visitor
       typing quickly.

   STATE lives in the browser for the length of the visit: a delta of appended event rows plus the
   flag/follow-up cells the office updated, and nothing else. Refresh resets the demo.
   Because the switcher swaps one <iframe>'s src, each surface is a FRESH document — module-scope
   variables do not survive the hop — so the delta is kept in sessionStorage under one key, which
   is what makes a kiosk sign-in appear on the board when you switch to it. Some browsers deny
   storage to a file:// iframe; that is caught, and the demo then keeps per-surface state instead
   of failing (each screen still works; the hand-off between them is what is lost). */
window.MOCK_BACKEND = (function () {
  'use strict';

  var D = window.CAMPUS_PRESENCE_DATA;
  var T = D.tabs;
  var DEMO = D.demo;

  /* =========================================================================
     the demo clock
     -------------------------------------------------------------------------
     Pinned to the demo date so "today" never drifts, but it ADVANCES in real
     time from there, so two sign-ins a minute apart are a minute apart on the
     board. Capped at four hours so a tab left open overnight cannot roll the
     clock into tomorrow and empty the board.
     ======================================================================= */
  var BASE_MS = (function () {
    var p = String(DEMO.now).split(/[- :]/);
    return new Date(+p[0], +p[1] - 1, +p[2], +p[3], +p[4], +p[5]).getTime();
  })();
  var LOADED_MS = Date.now();
  function now() {
    var elapsed = Math.min(Date.now() - LOADED_MS, 4 * 3600 * 1000);
    return new Date(BASE_MS + elapsed);
  }
  var disambig = 1000;
  function nextDisambig() { return (disambig = (disambig + 137) % 10000); }

  /* =========================================================================
     shared demo state (survives the switcher's iframe hop; see the header)
     ======================================================================= */
  var STORE_KEY = 'cp-demo-state-v1';
  var fallbackState = null;                 // used when storage is unavailable
  function blankState() { return { appended: [], updates: {} }; }
  function readState() {
    try {
      var raw = window.sessionStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : blankState();
    } catch (e) {
      return fallbackState || (fallbackState = blankState());
    }
  }
  function writeState(s) {
    fallbackState = s;
    try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /* =========================================================================
     the gateway, in miniature — the only place that "touches the sheet"
     ======================================================================= */
  function factsTabs(names) {
    return names.map(function (n) { return { name: n, values: T[n] || [] }; });
  }
  function tabObjects(name) {
    var v = T[name] || [];
    if (v.length < 2) return [];
    var h = v[0];
    return v.slice(1).map(function (r) { return Events.objFromRow(h, r); });
  }

  // Every EVENTS row as an object, in append (chronological) order: the checked-in log, then
  // anything this visit appended, with the office's cell updates applied on top. Faithful to the
  // real gateway, whose only UPDATE primitive patches FlagStatus / FlagNote / FollowUpStatus.
  function allEvents() {
    var st = readState();
    var h = T.EVENTS[0];
    var out = T.EVENTS.slice(1).map(function (r) { return Events.objFromRow(h, r); });
    st.appended.forEach(function (r) { out.push(Events.objFromRow(h, r)); });
    out.forEach(function (e) {
      var u = st.updates[e.EventID];
      if (u) for (var k in u) e[k] = u[k];
    });
    return out;
  }
  function eventsToday() {
    var day = Ids.dayKey(now());
    return allEvents().filter(function (e) { return e.Date === day; });
  }
  function appendEvent(ev) {
    var st = readState();
    st.appended.push(Events.rowFromEvent(ev));
    writeState(st);
    return ev.EventID;
  }
  function updateEventCells(eventId, patch) {
    var st = readState();
    var exists = allEvents().some(function (e) { return e.EventID === String(eventId); });
    if (!exists) return false;
    var cur = st.updates[String(eventId)] || {};
    for (var k in patch) cur[k] = patch[k];
    st.updates[String(eventId)] = cur;
    writeState(st);
    return true;
  }

  // Settings: the SETTINGS tab merged over SETTINGS_DEFAULTS, exactly as gwSettings_ does.
  function settings() {
    var out = {};
    for (var k in SETTINGS_DEFAULTS) out[k] = SETTINGS_DEFAULTS[k];
    tabObjects('SETTINGS').forEach(function (r) { if (r.Key) out[r.Key] = r.Value; });
    return out;
  }
  function badgeRows() { return tabObjects('BADGES'); }
  function gradeMap() {
    try { return JSON.parse(settings()['building.grade.map'] || '{}'); } catch (e) { return {}; }
  }
  function workReleaseIds(dayKey) {
    var ids = {};
    tabObjects('WORK_RELEASE').forEach(function (r) {
      if (!r.StudentID) return;
      if (r.Expires && String(r.Expires) < dayKey) return;   // expiry-aware, as in production
      ids[String(r.StudentID)] = true;
    });
    return ids;
  }
  function permissions() {
    return tabObjects('PERMISSIONS')
      .filter(function (r) { return String(r.Email || '').trim(); })
      .map(function (r) {
        return {
          email: String(r.Email).trim().toLowerCase(),
          frontOffice: String(r.FrontOffice).toUpperCase() === 'Y',
          admin: String(r.Admin).toUpperCase() === 'Y',
          alertStation: String(r.AlertStation || '').trim().toLowerCase() || 'all',
          notes: String(r.Notes || '')
        };
      });
  }

  // The enrolled-student roster, built by the REAL directory parser from the LONG Sheet1 rows
  // (one row per student+guardian, Enrolled only). Cached per document, as the server caches it
  // for six hours — the kiosk search must never pay to rebuild it.
  var rosterMemo = null;
  function fullRoster() {
    if (!rosterMemo) rosterMemo = Directory.buildStudents(factsTabs(['Sheet1']));
    return rosterMemo;
  }
  function compactRoster() {
    return fullRoster().map(function (s) { return { id: s.id, name: s.name, grade: s.grade }; });
  }
  function studentById(id) {
    var list = fullRoster();
    for (var i = 0; i < list.length; i++) if (list[i].id === String(id)) return list[i];
    return null;
  }
  function gradeNum(token) {
    var t = String(token || '');
    if (t === 'K4' || t === 'K5') return 0;
    var n = parseInt(t, 10);
    return isNaN(n) ? 0 : n;
  }
  function buildingOf(grade) { return gradeMap()[grade] || 'Other'; }

  // The real limiter, minus CacheService: attempts per station per rolling minute.
  var buckets = {};
  function rateLimit(station, bucket, perMin) {
    var k = bucket + '|' + station;
    var t = Date.now();
    var b = buckets[k] = (buckets[k] && t - buckets[k].at < 60000) ? buckets[k] : { at: t, n: 0 };
    b.n++;
    return b.n <= perMin;
  }

  /* =========================================================================
     OFFICE
     ======================================================================= */
  // The signed-in demo operator, resolved from the same PERMISSIONS rows the real gate reads.
  function whoami() {
    var me = String(DEMO.staffEmail).toLowerCase();
    var row = null;
    permissions().forEach(function (p) { if (p.email === me) row = p; });
    return { email: me, frontOffice: !!(row && row.frontOffice), admin: !!(row && row.admin),
             alertStation: (row && row.alertStation) || 'all' };
  }

  function officeBootstrap() {
    var s = settings();
    var who = whoami();
    return {
      ok: true, me: who.email, isAdmin: who.admin, alertStation: who.alertStation,
      stationNames: { hs: 'HS', el: 'EL', kg: 'KG', office: 'Office', mobile: 'Mobile', nurse: 'Nurse' },
      pollSeconds: Number(s['board.poll.seconds']) || 12,
      musterMode: s['muster.rosterMode'] || 'counts',
      factsFinderUrl: String(s['factsfinder.url'] || '').trim(),
      // The real setting points at the Dismissal Board deployment; the demo points at its sibling demo.
      dismissalUrl: String(s['dismissal.url'] || '').trim(),
      followUpMode: s['dismissal.followup.mode'],
      planReasons: String(s['plan.reasons'] || '').split('|').map(function (r) { return r.trim(); }).filter(Boolean),
      generatedAt: D.factsGeneratedAt
    };
  }
  function deskMap() {
    try { return JSON.parse(settings()['desk.grade.map'] || '{}'); } catch (e) { return {}; }
  }
  // Every dismissal_planned row whose Date is after today — the plans taken for a later day.
  function plansAfter(dayKey) {
    return allEvents().filter(function (e) { return e.Type === 'dismissal_planned' && String(e.Date || '') > dayKey; });
  }

  // Verbatim the shape of OfficeApi.js officeBoardSnapshot_: the fold is Presence.derive, the
  // badge state is Badges.derive, and the two alert lists are a single pass over today's rows.
  function boardSnapshot() {
    var n = now();
    var events = eventsToday();
    var presence = Presence.derive(events, { gradeBuildingMap: gradeMap() });
    var badgeState = Badges.derive(badgeRows(), events);

    var dm = deskMap();
    var openFlags = [], pending = [];
    events.forEach(function (e) {
      if (e.Type === 'pickup_flag' && e.FlagStatus === 'open') {
        openFlags.push({ eventId: e.EventID, name: e.PersonName, grade: e.Grade,
          desk: Planned.deskFor(dm, e.Grade), studentId: e.PersonKey,
          typedName: e.GuardianName, relationship: e.Relationship, reason: e.Reason,
          station: e.Station, at: e.Timestamp });
      }
      if (e.FollowUpStatus === 'pending' && e.Type !== 'pickup_flag') {
        pending.push({ eventId: e.EventID, mode: e.FollowUpMode || 'office_alert',
          desk: Planned.deskFor(dm, e.Grade),
          type: e.Type, name: e.PersonName, grade: e.Grade, station: e.Station,
          with: e.GuardianName, reason: e.Reason, at: e.Timestamp });
      }
    });

    return {
      ok: true, serverNow: n.getTime(), presence: presence,
      openFlags: openFlags, pending: pending,
      badgesOut: badgeState.assigned, unknownBadges: badgeState.unknownInUse,
      // Parents who rang ahead and have not collected yet — one card per family (the real Planned.families).
      planFamilies: Planned.families(events, dm),
      generatedAt: D.factsGeneratedAt
    };
  }

  /* ---- planned dismissals (2026-09-14 upstream): the office records a pickup BEFORE it happens ---- */
  function planDismissal(request) {
    var who = whoami();
    var students = (request && request.students) || [];
    if (!students.length) return { ok: false, error: 'no students selected' };
    var n = now();
    var day = Planned.checkPlanDay(request.forDay, Ids.dayKey(n));
    if (!day.ok) return { ok: false, error: day.error };
    var s = settings(), dm = deskMap();
    var groupId = 'G-' + String(Ids.timestamp(n)).replace(/[^0-9]/g, '') + '-' + nextDisambig();
    var made = [], resolved = [];
    students.forEach(function (sel) {
      var st = studentById(sel.id);
      if (!st) return;
      resolved.push(st);
      var ev = Events.makeEvent('dismissal_planned', {
        PersonKey: st.id, PersonName: st.name, Grade: st.grade, HomeBuilding: buildingOf(st.grade),
        Station: 'office', Reason: request.reason || '', GuardianName: request.guardianName || '',
        RelatedEventID: groupId, ExpectedBack: String(request.expectedAt || '').slice(0, 5), Date: day.day,
        FollowUpMode: 'record_only', FollowUpStatus: 'n/a', Source: 'office',
        Notes: 'planned by ' + who.email + (request.note ? ' - ' + request.note : '')
      }, n, nextDisambig());
      appendEvent(ev);
      made.push({ eventId: ev.EventID, id: st.id, name: st.name, grade: st.grade });
    });
    if (!made.length) return { ok: false, error: 'none of those students resolved' };
    // Production emails every front desk the family spans plus the in-scope homeroom teachers; the
    // demo resolves the same list (through the real desk map and teacher resolver) and sends nothing.
    var tabs = factsTabs(['Sheet1', 'Student Schedules', 'Staff']);
    var ctx = { staffEmailFor: Directory.staffEmailResolver(tabs), hrByStudent: Directory.homeroomTeacherByStudent(tabs),
                elcEmails: Directory.elcTeacherEmails(factsTabs(['K5-6 Teachers'])), elcEmailFor: Directory.elcEmailFor };
    var sentTo = {};
    Planned.desksFor(dm, resolved).forEach(function (desk) { sentTo[desk + '.desk@example.edu'] = true; });
    resolved.forEach(function (st) {
      if (!Notify.gradeInMailScope(s, st.grade)) return;
      var t = Notify.resolveTeacherEmail(st, ctx);
      if (t.email) sentTo[t.email] = true;
    });
    return { ok: true, groupId: groupId, planned: made, notified: Object.keys(sentTo), day: day.day,
             dayLabel: Planned.dayLabel(day.day) };
  }
  function listPlanned() {
    var dayKey = Ids.dayKey(now()), dm = deskMap();
    var upcoming = Planned.upcoming(plansAfter(dayKey), dayKey, dm).map(function (f) { f.dayLabel = Planned.dayLabel(f.date); return f; });
    return { ok: true, families: Planned.families(eventsToday(), dm), upcoming: upcoming, maxDaysAhead: Planned.MAX_DAYS_AHEAD };
  }
  function cancelPlanned(request) {
    var who = whoami();
    var groupId = String((request && request.groupId) || '');
    if (groupId) {
      var dayKey = Ids.dayKey(now());
      var n = 0;
      Planned.outstanding(eventsToday().concat(plansAfter(dayKey))).forEach(function (e) {
        if (String(e.RelatedEventID || '') !== groupId) return;
        updateEventCells(e.EventID, { FlagStatus: 'cancelled', FlagNote: 'cancelled by ' + who.email });
        n++;
      });
      return n ? { ok: true, cancelled: n } : { ok: false, error: 'nothing outstanding in that group' };
    }
    var id = String((request && request.eventId) || '');
    if (!id) return { ok: false, error: 'no plan given' };
    updateEventCells(id, { FlagStatus: 'cancelled', FlagNote: 'cancelled by ' + who.email });
    return { ok: true };
  }
  function signOutOnePlan(who, plan) {
    var ev = Events.makeEvent('student_early_out', {
      PersonKey: plan.PersonKey, PersonName: plan.PersonName, Grade: plan.Grade, HomeBuilding: plan.HomeBuilding,
      Station: 'office', Reason: plan.Reason || '', PickupMatch: 'override',
      GuardianName: plan.GuardianName || '(collected at the office)', RelatedEventID: plan.EventID,
      FollowUpMode: 'record_only', FollowUpStatus: 'n/a', Source: 'office',
      Notes: 'signed out at the desk by ' + who.email + ' against a planned dismissal'
    }, now(), nextDisambig());
    appendEvent(ev);
    return { eventId: ev.EventID, name: plan.PersonName, studentId: plan.PersonKey };
  }
  function signOutPlanned(request) {
    var who = whoami();
    var id = String((request && request.eventId) || ''), groupId = String((request && request.groupId) || '');
    var today = eventsToday();
    if (groupId) {
      var done = [];
      Planned.outstanding(today).forEach(function (e) { if (String(e.RelatedEventID || '') === groupId) done.push(signOutOnePlan(who, e)); });
      if (!done.length) return { ok: false, error: 'nobody in that group is still outstanding' };
      return { ok: true, signedOut: done, count: done.length };
    }
    var plan = null;
    Planned.outstanding(today).forEach(function (e) { if (e.EventID === id) plan = e; });
    if (!plan) return { ok: false, error: 'that plan is no longer outstanding' };
    var made = signOutOnePlan(who, plan);
    return { ok: true, eventId: made.eventId, name: plan.PersonName };
  }
  // The History page is not a built surface here, but the board asks for a child's history inline.
  function history(request) {
    var today = Ids.dayKey(now());
    var range = (request.from || request.to) ? { from: request.from || '', to: request.to || '', label: 'Custom' }
                                              : History.rangeFor(request.preset || 'week', today);
    var rows = History.filter(allEvents(), { from: range.from, to: range.to, studentId: request.studentId || '',
      types: request.types || null, station: request.station || '', personType: request.personType || '' });
    return { ok: true, range: range, today: today, days: History.groupByDay(rows), students: History.studentsIn(rows),
             counts: History.counts(rows), capped: false, totalInRange: rows.length, generatedAt: D.factsGeneratedAt };
  }
  // Who may collect a child, with phone numbers — the front desk's view (2026-09-14). Office only; the
  // kiosk never sees this list, which is the whole point of the typed-name check.
  function pickupContacts(request) {
    var studentId = String((request && request.studentId) || '').trim();
    if (!studentId) return { ok: false, error: 'no student given' };
    var tab = Directory.tabByName(factsTabs(['PickupContacts']), ['PickupContacts']);
    if (!tab || (tab.values || []).length < 2) return { ok: true, studentId: studentId, contacts: [], note: 'The PickupContacts tab is not in the FACTS export yet.' };
    var h = Directory.headerMap(tab.values[0]);
    var cell = function (row, name) { return h[name] === undefined ? '' : Directory.cellToString(row[h[name]]).trim(); };
    var contacts = [];
    for (var r = 1; r < tab.values.length; r++) {
      var row = tab.values[r];
      if (cell(row, 'studentId') !== studentId) continue;
      var phones = [];
      [['cellPhone', 'cell'], ['homePhone', 'home'], ['workPhone', 'work']].forEach(function (p) { var v = cell(row, p[0]); if (v) phones.push({ label: p[1], number: v }); });
      contacts.push({ name: (cell(row, 'firstName') + ' ' + cell(row, 'lastName')).trim(), relationship: cell(row, 'relationship'),
                      phones: phones, email: cell(row, 'email'), note: cell(row, 'note'), sort: Number(cell(row, 'portalSortOrder') || 999) });
    }
    contacts.sort(function (a, b) { return a.sort - b.sort; });
    var st = studentById(studentId);
    return { ok: true, studentId: studentId, studentName: st ? st.name : '', contacts: contacts };
  }
  function officeSearch(request) {
    var q = String((request && request.q) || '').trim();
    if (q.length < 3) return { ok: true, results: [] };
    var res = Search.searchStudents(compactRoster(), q) || {};
    return { ok: true, truncated: !!res.truncated, total: res.total || 0,
             results: (res.results || []).map(function (x) { return { id: x.id, name: x.name, grade: x.grade }; }) };
  }

  // Approve = the dismissal really happens, as an office OVERRIDE linked to the flag.
  // Deny = the flag is closed with a note and nothing else changes. Either way the flag itself is
  // never a sign-out, which is the whole point of the design.
  function resolveFlag(request) {
    var who = whoami();
    var flag = null;
    eventsToday().forEach(function (e) {
      if (e.EventID === String(request.eventId) && e.Type === 'pickup_flag') flag = e;
    });
    if (!flag) return { ok: false, error: 'flag not found (today only)' };
    if (flag.FlagStatus !== 'open') return { ok: false, error: 'already resolved' };

    if (request.action === 'approve') {
      appendEvent(Events.makeEvent('student_early_out', {
        PersonKey: flag.PersonKey, PersonName: flag.PersonName, Grade: flag.Grade,
        HomeBuilding: flag.HomeBuilding, Station: 'office',
        Reason: flag.Reason || 'office override', PickupMatch: 'override',
        GuardianName: flag.GuardianName, Relationship: flag.Relationship,
        RelatedEventID: flag.EventID, Source: 'office',
        FollowUpMode: 'record_only', FollowUpStatus: 'n/a',
        Notes: 'override by ' + who.email + (request.note ? ' — ' + request.note : '')
      }, now(), nextDisambig()));
    }
    updateEventCells(flag.EventID, {
      FlagStatus: 'resolved',
      FlagNote: (request.action === 'approve' ? 'APPROVED' : 'DENIED') + ' by ' + who.email +
        (request.note ? ' — ' + request.note : ''),
      FollowUpStatus: 'done'
    });
    return { ok: true, action: request.action };
  }

  function setFollowUp(eventId, status) {
    var found = updateEventCells(String(eventId), { FollowUpStatus: status });
    return { ok: found, error: found ? '' : 'event not found' };
  }

  function manualVisitorOut(request) {
    var who = whoami();
    var open = null;
    eventsToday().forEach(function (e) {
      if (e.Type === 'visitor_in' && e.PersonKey === String(request.visitKey)) open = e;
      if (e.Type === 'visitor_out' && e.PersonKey === String(request.visitKey)) open = null;
    });
    if (!open) return { ok: false, error: 'not open' };
    appendEvent(Events.makeEvent('visitor_out', {
      PersonKey: open.PersonKey, PersonName: open.PersonName, BadgeID: open.BadgeID,
      RelatedEventID: open.EventID, Station: 'office', Source: 'office',
      Notes: 'signed out by ' + who.email
    }, now(), nextDisambig()));
    return { ok: true, name: open.PersonName };
  }

  // Counts + exceptions always; the per-building roster only when mode=full. The roster carries
  // the FACTS id so the names can deep-link into the directory tool — that link is disabled in
  // this demo (SETTINGS factsfinder.url is blank), which is a supported production setting.
  function musterReport(request) {
    var snapshot = boardSnapshot();
    var s = settings();
    var mode = (request && request.mode) || s['muster.rosterMode'] || 'counts';
    var out = {
      ok: true, at: Ids.timestamp(now()), mode: mode,
      presence: snapshot.presence, badgesOut: snapshot.badgesOut,
      openFlags: snapshot.openFlags, generatedAt: snapshot.generatedAt, rosters: null
    };
    if (mode === 'full') {
      var map = gradeMap();
      var offIds = {};
      snapshot.presence.studentsOff.forEach(function (x) { offIds[x.id] = true; });
      var rosters = {};
      fullRoster().forEach(function (st) {
        var bld = map[st.grade] || 'Other';
        (rosters[bld] = rosters[bld] || []).push({
          id: st.id, name: st.name, grade: st.grade, off: !!offIds[st.id]
        });
      });
      out.rosters = rosters;
    }
    return out;
  }

  // The whole log, folded once by the real Metrics engine. The server caches the result for five
  // minutes; the page keeps its own memo per range, so the demo just answers every time and
  // reports cached:false honestly.
  function metrics(request) {
    var preset = String((request && request.preset) || 'month');
    var s = settings();
    var startMonth = Number(s['schoolyear.start.month']) || 8;
    var range = (preset === 'custom' && request.from && request.to)
      ? { from: String(request.from).slice(0, 10), to: String(request.to).slice(0, 10), label: 'Custom' }
      : Metrics.rangeFor(preset, now(), startMonth);
    var types = (request && request.types && request.types.length) ? request.types : null;
    var events = allEvents();
    var out = Metrics.build(events, { from: range.from, to: range.to, types: types });
    out.ok = true;
    out.preset = preset;
    out.rangeLabel = range.label;
    out.schoolYearStartMonth = startMonth;
    out.eventLogRows = events.length;
    out.builtAt = Ids.timestamp(now());
    out.cached = false;
    return out;
  }

  var READ_ONLY = 'This is a read-only demo — the change was not saved. In the real app this ' +
                  'writes to the Settings / Permissions tab and is stamped with who did it.';

  function officeApi(request) {
    var op = (request && request.op) || '';
    switch (op) {
      case 'ping': return { ok: true };
      case 'bootstrap': return officeBootstrap();
      case 'getBoardSnapshot': return boardSnapshot();
      case 'resolveFlag': return resolveFlag(request);
      case 'acknowledge': return setFollowUp(request.eventId, 'done');
      case 'markPaged': return setFollowUp(request.eventId, 'done');
      case 'manualVisitorOut': return manualVisitorOut(request);
      case 'getMusterReport': return musterReport(request);
      case 'getMetrics': return metrics(request);
      case 'getHistory': return history(request);
      case 'getPickupContacts': return pickupContacts(request);
      case 'planDismissal': return planDismissal(request);
      case 'searchStudents': return officeSearch(request);
      case 'listPlanned': return listPlanned();
      case 'cancelPlanned': return cancelPlanned(request);
      case 'signOutPlanned': return signOutPlanned(request);
      case 'getSettings': return { ok: true, settings: settings(), defaults: SETTINGS_DEFAULTS };
      case 'listPermissions': return { ok: true, people: permissions(), me: whoami().email };
      case 'saveSetting':
      case 'savePermission':
      case 'removePermission': throw new Error(READ_ONLY);
      default: return { ok: false, error: 'unknown op' };
    }
  }

  /* =========================================================================
     KIOSK
     ======================================================================= */
  function kioskBootstrap(request) {
    var s = settings();
    return {
      ok: true, station: request.station,
      reasons: {
        visitor: String(s['visitor.reasons']).split('|'),
        late: String(s['late.reasons']).split('|'),
        dismissal: String(s['dismissal.reasons']).split('|'),
        movement: String(s['movement.reasons'] || '').split('|').filter(function (r) { return r; })
      },
      idleWarnSeconds: Number(s['kiosk.idle.warn.seconds']) || 45,
      idleResetSeconds: Number(s['kiosk.idle.reset.seconds']) || 10,
      parentDrivenMaxGrade: gradeNum(s['late.parentdriven.maxgrade'] || '5'),
      buildings: BUILDINGS.slice(),
      generatedAt: D.factsGeneratedAt
    };
  }

  // The one op that must feel instant. Fuzzy, capped at 8 rows, ≥3 characters, and the projection
  // is {id, name, grade, close} — never a guardian, an email, a homeroom or a contact.
  function kioskSearch(request) {
    var res = Search.searchStudents(compactRoster(), request.q);
    return { ok: res.ok, reason: res.reason || '', total: res.total,
             truncated: res.truncated, results: res.results };
  }

  function visitorIn(request) {
    var state = Badges.derive(badgeRows(), eventsToday());
    var check = Badges.canAssign(state, badgeRows(), String(request.badge || '').toUpperCase());
    if (!check.ok) return { ok: false, badge: check.reason };   // 'unknown' | 'inactive' | 'in-use'
    var ev = Events.makeEvent('visitor_in', {
      PersonName: request.name,
      Reason: String(request.reason || '') + (request.org ? ' — ' + request.org : ''),
      ToBuilding: request.destination || '',
      BadgeID: String(request.badge).toUpperCase(),
      Station: request.station
    }, now(), nextDisambig());
    appendEvent(ev);
    return { ok: true, badge: ev.BadgeID };
  }

  function visitorLookupBadge(request) {
    var state = Badges.derive(badgeRows(), eventsToday());
    var badge = String(request.badge || '').toUpperCase();
    for (var i = 0; i < state.assigned.length; i++) {
      if (state.assigned[i].badgeId === badge) {
        return { ok: true, open: true, name: state.assigned[i].name,
                 visitKey: state.assigned[i].visitKey };
      }
    }
    return { ok: true, open: false };
  }

  function visitorOpenList() {
    var state = Badges.derive(badgeRows(), eventsToday());
    return { ok: true, visitors: state.assigned.map(function (a) {
      return { name: a.name, badge: a.badgeId, visitKey: a.visitKey };
    }) };
  }

  function visitorOut(request) {
    var open = null;
    eventsToday().forEach(function (e) {
      if (e.Type === 'visitor_in' && e.PersonKey === String(request.visitKey || '')) open = e;
      if (e.Type === 'visitor_out' && e.PersonKey === String(request.visitKey || '')) open = null;
    });
    if (!open) return { ok: false, error: 'not-open' };
    appendEvent(Events.makeEvent('visitor_out', {
      PersonKey: open.PersonKey, PersonName: open.PersonName, RelatedEventID: open.EventID,
      BadgeID: open.BadgeID, Station: request.station,
      Notes: request.lostBadge ? 'badge not returned' : ''
    }, now(), nextDisambig()));
    return { ok: true, name: open.PersonName };
  }

  // Sign IN. Below 6th grade an adult must type their name (enforced HERE, server-side, not just
  // in the UI), and an open early-out today means this is a RETURN rather than a late arrival.
  function lateIn(request) {
    var student = studentById(request.studentId);
    if (!student) return { ok: false, error: 'unknown student' };
    var s = settings();
    var parentDriven = gradeNum(student.grade) <= gradeNum(s['late.parentdriven.maxgrade'] || '5');
    if (parentDriven && !String(request.guardianName || '').trim()) {
      return { ok: false, error: 'guardian-required' };
    }
    var openOut = null;
    eventsToday().forEach(function (e) {
      if (e.PersonKey !== student.id) return;
      if (e.Type === 'student_early_out' && e.PickupMatch !== 'mismatch') openOut = e;
      if (e.Type === 'student_return_in') openOut = null;
    });
    var type = openOut ? 'student_return_in' : 'student_late_in';
    appendEvent(Events.makeEvent(type, {
      PersonKey: student.id, PersonName: student.name, Grade: student.grade,
      HomeBuilding: buildingOf(student.grade), Station: request.station,
      Reason: request.reason || (openOut ? 'returned' : ''),
      GuardianName: request.guardianName || '', Relationship: request.relationship || '',
      RelatedEventID: openOut ? openOut.EventID : ''
    }, now(), nextDisambig()));
    return { ok: true, welcomeBack: !!openOut, name: student.name };
  }

  // The hard check, in isolation. The answer is {match: true|false} and NOTHING else — never a
  // contact name, never a hint about how close the typed name was.
  function checkPickup(request) {
    if (!rateLimit(request.station, 'pickup', 10)) return { ok: true, match: false, limited: true };
    var tabs = factsTabs(['Sheet1', 'PickupContacts']);
    var student = studentById(request.studentId);
    if (!student) return { ok: true, match: false };
    var cand = Pickup.contactsForStudent(Pickup.parsePickupContacts(tabs), student, student.id);
    var res = Pickup.matchTypedName(cand.contacts, request.typedName);
    return { ok: true, match: !!res.match };
  }

  // Sign OUT. Two doors: Work Release (grade 7+ AND on the approved list — the list never leaves
  // the server, and the check fails closed), or the authorised-pickup hard check. A MISMATCH
  // writes a pickup_flag and NOTHING ELSE: no sign-out, no presence change, and the desk beside
  // the kiosk is alerted. A match records the dismissal and fires the configured follow-up.
  function earlyOut(request) {
    var s = settings();
    var day = Ids.dayKey(now());
    var tabs = factsTabs(['Sheet1', 'PickupContacts', 'Student Schedules', 'Staff']);
    var student = studentById(request.studentId);
    if (!student) return { ok: false, error: 'unknown student' };
    var building = buildingOf(student.grade);

    if (request.mode === 'workrelease') {
      var allowed = workReleaseIds(day)[student.id] && gradeNum(student.grade) >= 7;
      if (!allowed) return { ok: false, denied: 'workrelease' };
      appendEvent(Events.makeEvent('student_early_out', {
        PersonKey: student.id, PersonName: student.name, Grade: student.grade,
        HomeBuilding: building, Station: request.station,
        Reason: request.reason || 'Work Release', PickupMatch: 'n/a',
        GuardianName: '(self — Work Release)',
        FollowUpMode: 'record_only', FollowUpStatus: 'n/a',
        Notes: request.returning ? 'returning today' : ''
      }, now(), nextDisambig()));
      // Production emails every guardian on file for a self sign-out; the demo sends nothing.
      return { ok: true, match: true, workRelease: true };
    }

    // Two newer doors (2026-09-10/16 upstream): a part-time homeschool student on a schedule, and a
    // 9th-12th grader signing THEMSELVES out at the HS kiosk — which chimes the board so the office
    // confirms a parent is on campus. Both fail closed.
    if (request.mode === 'homeschool') {
      if (!homeschoolIds(day)[student.id]) return { ok: false, denied: 'homeschool' };
      appendEvent(Events.makeEvent('student_early_out', {
        PersonKey: student.id, PersonName: student.name, Grade: student.grade, HomeBuilding: building,
        Station: request.station, Reason: 'Homeschool', PickupMatch: 'n/a',
        GuardianName: '(self — homeschool schedule)', FollowUpMode: 'record_only', FollowUpStatus: 'n/a'
      }, now(), nextDisambig()));
      return { ok: true, match: true, homeschool: true };
    }
    if (request.mode === 'self') {
      if (gradeNum(student.grade) < 9 || String(request.station || '') !== 'hs') return { ok: false, denied: 'self' };
      appendEvent(Events.makeEvent('student_early_out', {
        PersonKey: student.id, PersonName: student.name, Grade: student.grade, HomeBuilding: building,
        Station: request.station, Reason: 'Self sign-out', PickupMatch: 'n/a',
        GuardianName: '(self — office to confirm parent on campus)',
        FollowUpMode: 'office_alert', FollowUpStatus: 'pending',
        Notes: 'Self sign-out — confirm a parent is on campus'
      }, now(), nextDisambig()));
      return { ok: true, match: true, selfSignOut: true };
    }

    if (!rateLimit(request.station, 'pickup', 10)) return { ok: true, match: false, limited: true };
    var evs = eventsToday();
    var one = dismissOne(s, tabs, student, request, evs);
    if (!one.match) return { ok: true, match: false };
    return { ok: true, match: true, followUp: one.followUp, alsoHere: alsoCollecting(tabs, student, request.typedName, evs) };
  }

  // One child's dismissal through the hard check — shared by the single and the group sign-out, as
  // upstream's kioskDismissOne_. A MISMATCH writes a flag and NOTHING ELSE; a match records the
  // dismissal, links it to a plan the office took this morning, and fires the configured follow-up.
  function dismissOne(s, tabs, student, request, events) {
    var building = buildingOf(student.grade);
    var cand = Pickup.contactsForStudent(Pickup.parsePickupContacts(tabs), student, student.id);
    var res = Pickup.matchTypedName(cand.contacts, request.typedName);
    if (!res.match) {
      appendEvent(Events.makeEvent('pickup_flag', {
        PersonKey: student.id, PersonName: student.name, Grade: student.grade,
        HomeBuilding: building, Station: request.station,
        GuardianName: request.typedName || '(blank)', Relationship: request.relationship || '',
        Reason: request.reason || '', PickupMatch: 'mismatch',
        FollowUpStatus: 'pending'         // a mismatch ALWAYS alerts, whatever the mode
      }, now(), nextDisambig()));
      return { match: false, name: student.name, grade: student.grade, followUp: '' };
    }
    var plan = Planned.forStudent(events || [], student.id);
    var follow = Notify.resolveFollowUp(s, student, {
      staffEmailFor: Directory.staffEmailResolver(tabs),
      hrByStudent: Directory.homeroomTeacherByStudent(tabs),
      elcEmails: Directory.elcTeacherEmails(factsTabs(['K5-6 Teachers'])),
      elcEmailFor: Directory.elcEmailFor
    });
    appendEvent(Events.makeEvent('student_early_out', {
      PersonKey: student.id, PersonName: student.name, Grade: student.grade,
      HomeBuilding: building, Station: request.station,
      Reason: request.reason || (plan ? plan.Reason : '') || '', PickupMatch: 'matched',
      PickupContactID: res.contactId || '',
      GuardianName: request.typedName, Relationship: res.relationship || request.relationship || '',
      RelatedEventID: plan ? plan.EventID : '',
      FollowUpMode: follow.mode,
      FollowUpStatus: follow.pending ? 'pending' : (follow.sendEmail ? 'sent' : 'n/a'),
      Notes: [(request.returning ? 'returning today' : ''), (plan ? 'called ahead this morning' : ''),
              (follow.degraded ? 'follow-up degraded: ' + follow.degraded : '')]
        .filter(function (x) { return x; }).join('; ')
    }, now(), nextDisambig()));
    return { match: true, name: student.name, grade: student.grade, followUp: follow.mode };
  }
  // "Also collecting?" (2026-09-16): a parent who just signed one child out is offered their other
  // children — only those still on campus AND for whom the same typed name passes the check.
  function alsoCollecting(tabs, student, typedName, events) {
    var students = fullRoster();
    var sibs = Family.siblingsOf(students, student.id);
    if (!sibs.length) return [];
    var gone = {};
    (events || []).forEach(function (e) {
      if (e.Type === 'student_early_out' && e.PickupMatch !== 'mismatch') gone[String(e.PersonKey)] = true;
      if (e.Type === 'student_return_in') delete gone[String(e.PersonKey)];
    });
    var contacts = Pickup.parsePickupContacts(tabs);
    var out = [];
    sibs.forEach(function (sb) {
      if (gone[sb.id]) return;
      var full = studentById(sb.id);
      if (!full) return;
      var cand = Pickup.contactsForStudent(contacts, full, sb.id);
      if (!Pickup.matchTypedName(cand.contacts, typedName).match) return;
      out.push({ id: sb.id, name: sb.name, grade: sb.grade });
    });
    return out;
  }
  function earlyOutGroup(request) {
    var ids = (request && request.studentIds) || [];
    if (!ids.length) return { ok: false, error: 'no students' };
    if (!rateLimit(request.station, 'pickup', 10)) return { ok: true, limited: true };
    var s = settings();
    var events = eventsToday();
    var lead = String(ids[0]);
    var tabs = factsTabs(['Sheet1', 'PickupContacts', 'Student Schedules', 'Staff']);
    var allowed = {}; allowed[lead] = true;
    Planned.siblingsOf(events, lead).forEach(function (e) { allowed[String(e.PersonKey)] = true; });
    Family.siblingsOf(fullRoster(), lead).forEach(function (sb) { allowed[sb.id] = true; });
    var claimed = {};
    events.forEach(function (e) { if (e.Type === 'student_early_out') claimed[String(e.PersonKey)] = true; });
    var matched = [], flagged = [], skipped = 0;
    ids.forEach(function (raw) {
      var id = String(raw);
      if (!allowed[id] || claimed[id]) { skipped++; return; }
      var st = studentById(id);
      if (!st) { skipped++; return; }
      var r = dismissOne(s, tabs, st, request, events);
      (r.match ? matched : flagged).push(r.name);
    });
    return { ok: true, matched: matched, flagged: flagged, skipped: skipped };
  }
  function homeschoolIds(dayKey) {
    var ids = {};
    tabObjects('HOMESCHOOL').forEach(function (r) {
      if (!r.StudentID) return;
      if (r.Expires && String(r.Expires) < dayKey) return;
      ids[String(r.StudentID)] = true;
    });
    return ids;
  }
  // The plan the office took for this child, handed back at the iPad so nobody retypes it.
  function plannedFor(request) {
    var id = String((request && request.studentId) || '');
    if (!id) return { ok: false, error: 'no student' };
    var events = eventsToday();
    var plan = Planned.forStudent(events, id);
    if (!plan) return { ok: true, planned: false, siblings: [] };
    return { ok: true, planned: true, reason: plan.Reason || '',
             chipReason: Planned.kioskReasonFor(plan.Reason, String(settings()['dismissal.reasons'] || '').split('|')),
             at: Ids.h12(plan.ExpectedBack || ''),
             siblings: Planned.siblingsOf(events, id).map(function (e) { return { id: String(e.PersonKey), name: e.PersonName, grade: e.Grade }; }) };
  }
  // What the kiosk may offer this child: Work Release, a homeschool schedule, self sign-out (9th+ at
  // the HS kiosk), a return from a movement, a return from off campus.
  function studentOptions(request) {
    if (!rateLimit(request.station, 'options', 30)) return { ok: false, reason: 'limited' };
    var day = Ids.dayKey(now());
    var s = settings();
    var student = studentById(request.studentId);
    if (!student) return { ok: false, error: 'unknown student' };
    var g = gradeNum(student.grade);
    var events = eventsToday();
    var out = null, offCampus = null, arrivedToday = false;
    events.forEach(function (e) {
      if (e.PersonKey !== student.id) return;
      if (e.Type === 'movement') out = (e.Reason === 'returned' || e.Reason === 'arrived') ? null : e;
      if (e.Type === 'student_early_out' && e.PickupMatch !== 'mismatch') offCampus = e;
      if (e.Type === 'student_return_in') offCampus = null;
      if (e.Type === 'student_late_in') arrivedToday = true;
    });
    return { ok: true, id: student.id, name: student.name, grade: student.grade,
             workRelease: !!workReleaseIds(day)[student.id] && g >= 7,
             homeschool: !!homeschoolIds(day)[student.id],
             arrivedToday: arrivedToday,
             selfSignOut: g >= 9 && String(request.station || '') === 'hs',
             currentlyOut: !!out, outTo: out ? out.ToBuilding : '', expectedBack: out ? Ids.h12(out.ExpectedBack || '') : '',
             offCampus: !!offCampus,
             parentDriven: g <= gradeNum(s['late.parentdriven.maxgrade'] || '5') };
  }
  function movementOut(request) {
    var student = studentById(request.studentId);
    if (!student) return { ok: false, error: 'unknown student' };
    var home = buildingOf(student.grade);
    var to = String(request.toBuilding || '').trim();
    if (!to) return { ok: false, error: 'destination-required' };
    if (to === home) return { ok: false, error: 'same-building' };
    var ev = Events.makeEvent('movement', {
      PersonKey: student.id, PersonName: student.name, Grade: student.grade, HomeBuilding: home,
      FromBuilding: home, ToBuilding: to, Reason: request.reason || 'Between buildings',
      ExpectedBack: String(request.expectedBack || '').slice(0, 5), Station: request.station
    }, now(), nextDisambig());
    appendEvent(ev);
    return { ok: true, name: student.name, to: to, expectedBack: Ids.h12(ev.ExpectedBack) };
  }
  function movementBack(request) {
    var open = null;
    eventsToday().forEach(function (e) {
      if (e.Type !== 'movement' || e.PersonKey !== String(request.studentId || '')) return;
      open = (e.Reason === 'returned' || e.Reason === 'arrived') ? null : e;
    });
    if (!open) return { ok: false, error: 'not-out' };
    var ev = Events.makeEvent('movement', {
      PersonKey: open.PersonKey, PersonName: open.PersonName, Grade: open.Grade, HomeBuilding: open.HomeBuilding,
      FromBuilding: open.ToBuilding, ToBuilding: open.FromBuilding, Reason: 'returned',
      RelatedEventID: open.EventID, Station: request.station
    }, now(), nextDisambig());
    appendEvent(ev);
    return { ok: true, name: open.PersonName, to: ev.ToBuilding };
  }
  function movementOpenList() {
    var derived = Presence.derive(eventsToday(), { gradeBuildingMap: gradeMap() });
    return { ok: true, out: derived.moved.filter(function (m) { return m.away; }).map(function (m) {
      return { id: m.id, name: m.name, grade: m.grade, to: m.to, at: Ids.h12(m.at), expectedBack: Ids.h12(m.expectedBack), reason: m.reason };
    }) };
  }

  function kioskApi(request) {
    var op = (request && request.op) || '';
    switch (op) {
      case 'ping': return { ok: true };
      case 'bootstrap': return kioskBootstrap(request);
      case 'searchStudents': return kioskSearch(request);
      case 'visitorIn': return visitorIn(request);
      case 'visitorLookupBadge': return visitorLookupBadge(request);
      case 'visitorOpenList': return visitorOpenList();
      case 'visitorOut': return visitorOut(request);
      case 'lateIn': return lateIn(request);
      case 'checkPickup': return checkPickup(request);
      case 'earlyOut': return earlyOut(request);
      case 'earlyOutGroup': return earlyOutGroup(request);
      case 'plannedFor': return plannedFor(request);
      case 'studentOptions': return studentOptions(request);
      case 'movementOut': return movementOut(request);
      case 'movementBack': return movementBack(request);
      case 'movementOpenList': return movementOpenList();
      default: return { ok: false, error: 'unknown op' };
    }
  }

  return { officeApi: officeApi, kioskApi: kioskApi };
})();
