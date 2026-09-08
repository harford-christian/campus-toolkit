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
      stationNames: { hs: 'HS', el: 'EL', office: 'Office', mobile: 'Mobile' },
      pollSeconds: Number(s['board.poll.seconds']) || 12,
      musterMode: s['muster.rosterMode'] || 'counts',
      factsFinderUrl: String(s['factsfinder.url'] || '').trim(),
      followUpMode: s['dismissal.followup.mode'],
      generatedAt: D.factsGeneratedAt
    };
  }

  // Verbatim the shape of OfficeApi.js officeBoardSnapshot_: the fold is Presence.derive, the
  // badge state is Badges.derive, and the two alert lists are a single pass over today's rows.
  function boardSnapshot() {
    var n = now();
    var events = eventsToday();
    var presence = Presence.derive(events, { gradeBuildingMap: gradeMap() });
    var badgeState = Badges.derive(badgeRows(), events);

    var openFlags = [], pending = [];
    events.forEach(function (e) {
      if (e.Type === 'pickup_flag' && e.FlagStatus === 'open') {
        openFlags.push({ eventId: e.EventID, name: e.PersonName, grade: e.Grade,
          typedName: e.GuardianName, relationship: e.Relationship, reason: e.Reason,
          station: e.Station, at: e.Timestamp });
      }
      if (e.FollowUpStatus === 'pending' && e.Type !== 'pickup_flag') {
        pending.push({ eventId: e.EventID, mode: e.FollowUpMode || 'office_alert',
          type: e.Type, name: e.PersonName, grade: e.Grade, station: e.Station,
          with: e.GuardianName, reason: e.Reason, at: e.Timestamp });
      }
    });

    return {
      ok: true, serverNow: n.getTime(), presence: presence,
      openFlags: openFlags, pending: pending,
      badgesOut: badgeState.assigned, unknownBadges: badgeState.unknownInUse,
      generatedAt: D.factsGeneratedAt
    };
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
        dismissal: String(s['dismissal.reasons']).split('|')
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

    if (!rateLimit(request.station, 'pickup', 10)) return { ok: true, match: false, limited: true };
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
      return { ok: true, match: false };
    }

    var follow = Notify.resolveFollowUp(s, student, {
      staffEmailFor: Directory.staffEmailResolver(tabs),
      hrByStudent: Directory.homeroomTeacherByStudent(tabs),
      elcEmails: Directory.elcTeacherEmails(factsTabs(['K5-6 Teachers']))
    });
    appendEvent(Events.makeEvent('student_early_out', {
      PersonKey: student.id, PersonName: student.name, Grade: student.grade,
      HomeBuilding: building, Station: request.station,
      Reason: request.reason || '', PickupMatch: 'matched',
      PickupContactID: res.contactId || '',
      GuardianName: request.typedName, Relationship: res.relationship || request.relationship || '',
      FollowUpMode: follow.mode,
      FollowUpStatus: follow.pending ? 'pending' : (follow.sendEmail ? 'sent' : 'n/a'),
      Notes: [(request.returning ? 'returning today' : ''),
              (follow.degraded ? 'follow-up degraded: ' + follow.degraded : '')]
        .filter(function (x) { return x; }).join('; ')
    }, now(), nextDisambig()));
    return { ok: true, match: true, followUp: follow.mode };
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
      default: return { ok: false, error: 'unknown op' };
    }
  }

  return { officeApi: officeApi, kioskApi: kioskApi };
})();
