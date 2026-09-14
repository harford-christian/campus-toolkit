/* mock.js — the fake backend for the Driver Routes demo.
 *
 * window.MOCK_BACKEND is what assets/gsr-shim.js routes google.script.run calls to, so the two
 * apps' own JavaScript runs completely unedited — including their error handling, their
 * "never blank" cache, and the honesty banners.
 *
 * BOTH apps funnel everything through ONE server function (driverApi / officeApi), so this file is
 * two dispatchers rather than a pile of stubs.
 *
 * The interesting work is NOT done here. logic.js is the source project's own logic/*.js, vendored
 * verbatim by build-logic.mjs, so the stop grouping, the PII projection, the check-off states and
 * the adoption table below are the app's real behaviour. This file only supplies rows and plays
 * the part of the Sheets. */
(function () {
  'use strict';

  var D = window.TRANSPO_DATA;
  var L = window.TRANSPO_LOGIC;
  var PUB = D.published;

  /* Demo-local session store, so the two apps behave like one system across the switcher:
     tick a child on the driver side, then look at the office side and the route has moved from
     "Not checked" to "Partly recorded". A refresh resets it. */
  var KEY = 'transpo_demo_boarding';
  function extraBoarding() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function pushBoarding(row) {
    try {
      var all = extraBoarding();
      all.push(row);
      sessionStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) { /* private mode — the demo still works, it just forgets */ }
  }
  function allBoarding() { return D.boarding.concat(extraBoarding()); }

  /* The demo's rider key is the student id with a prefix. The real app uses a truncated HMAC that
     rotates daily; a demo has no secret to key it with, and the point being demonstrated is that
     the phone never sees the FACTS id — which holds either way. */
  function rkOf(sid) { return sid ? 'rk-' + sid : ''; }

  function routeSlice(code) {
    return (PUB.slice.routes || []).filter(function (r) {
      return String(r.code).toLowerCase() === String(code).toLowerCase();
    })[0];
  }

  /* ------------------------------- the driver app ------------------------------- */

  var session = null;

  function driverApi(req) {
    req = req || {};

    if (req.op === 'login') {
      if (String(req.pin) !== D.DEMO.pin) {
        return { ok: false, reason: 'denied', remaining: 4 };
      }
      session = 'demo-session';
      return { ok: true, session: session, name: 'Wendell Ashby' };
    }

    if (!session) return { ok: false, reason: 'session' };

    if (req.op === 'routes') {
      return {
        ok: true, driver: 'Wendell Ashby',
        builtAt: PUB.builtAt, dayName: PUB.dayName, session: PUB.slice.session,
        routes: (PUB.slice.routes || []).map(function (r) {
          return { code: r.code, name: r.name, colour: r.colour, vehicle: r.vehicle };
        })
      };
    }

    if (req.op === 'manifest') {
      var slice = routeSlice(req.code);
      if (!slice) return { ok: false, reason: 'no-route' };

      // THE REAL buildManifest, from the source project. It groups riders onto stops and projects
      // each one through the explicit field allowlist — so what this demo hands the page is the
      // same shape, with the same fields stripped, as the production app.
      var m = L.buildManifest({
        slice: slice, stopRows: D.stopRows, linkRows: D.linkRows,
        rkOf: rkOf, session: PUB.slice.session, dayName: PUB.dayName
      });
      m.ok = true;
      m.builtAt = PUB.builtAt;
      m.dayKey = PUB.dayKey;
      m.attendanceOffDay = PUB.attendanceOffDay;
      m.signOutActive = PUB.signOutActive;
      m.boarding = L.foldBoarding(allBoarding(), slice.code, PUB.slice.session, PUB.dayKey);
      return m;
    }

    if (req.op === 'board') {
      pushBoarding({
        'Event ID': 'demo-' + Date.now(), Timestamp: new Date().toISOString().slice(0, 19),
        'Day Key': PUB.dayKey, 'Driver ID': 'drv-wendell', 'Route Code': req.code,
        Session: PUB.slice.session, 'Stop ID': req.stopId || '', 'Rider Key': req.rk,
        'Student ID': '', Action: req.action, Source: 'driver', Note: ''
      });
      return { ok: true, rk: req.rk, action: req.action };
    }

    return { ok: false, reason: 'unknown-op' };
  }

  /* ------------------------------- the office app ------------------------------- */

  // Demo-local edits, so adding a driver or resetting a PIN visibly does something.
  var drivers = D.drivers.slice();
  var devices = D.devices.slice();

  function officeApi(req) {
    req = req || {};

    if (req.op === 'dashboard') {
      var board = allBoarding();
      var routes = (PUB.slice.routes || []).map(function (r) {
        // The REAL fold and the REAL state machine. Abingdon has stops and riders but no events,
        // so it comes back NOT_CHECKED — rendered as "Not checked", never as a zero. That is the
        // whole design argument, running live rather than described.
        var fold = L.foldBoarding(board, r.code, PUB.slice.session, PUB.dayKey);
        var expected = (r.riding || []).length;
        var state = L.checkState(expected, fold);
        var tally = L.boardingTally(fold);
        return {
          code: r.code, name: r.name, colour: r.colour, vehicle: r.vehicle,
          drivers: (r.drivers || []).map(function (x) { return x.name; }),
          expected: expected, notRiding: (r.notRiding || []).length,
          state: state, label: L.checkStateLabel(state, tally, expected), tally: tally
        };
      });
      return {
        ok: true, routes: routes,
        dayKey: PUB.dayKey, dayName: PUB.dayName, session: PUB.slice.session,
        builtAt: PUB.builtAt,
        attendanceOffDay: PUB.attendanceOffDay, signOutActive: PUB.signOutActive,
        gaps: L.coverageGaps(PUB.slice.routes, PUB.dayName),
        totalExpected: routes.reduce(function (a, r) { return a + r.expected; }, 0)
      };
    }

    if (req.op === 'drivers') {
      var byDriver = {};
      devices.forEach(function (v) {
        if (String(v.Active).toUpperCase() === 'N') return;
        var id = v['Driver ID'];
        byDriver[id] = (byDriver[id] || 0) + 1;
      });
      return {
        ok: true,
        drivers: L.driverAdoption(drivers, D.activity, allBoarding(), byDriver),
        devices: devices.map(function (v) {
          return { token: v.Token, driverId: v['Driver ID'], device: v.Device,
                   added: v.Added, active: String(v.Active).toUpperCase() !== 'N' };
        }),
        execUrl: 'https://example.edu/routes/exec'
      };
    }

    if (req.op === 'activity') {
      return { ok: true, rows: L.recentActivity(D.activity, req.limit || 150) };
    }

    if (req.op === 'stops') {
      var slice = routeSlice(req.code) || { riding: [] };
      var assigned = {};
      D.linkRows.forEach(function (r) {
        if (String(r['Route Code']).toLowerCase() === String(req.code).toLowerCase()) {
          assigned[r['Student ID']] = r['Stop ID'];
        }
      });
      return {
        ok: true, code: req.code, session: 'PM',
        stops: L.buildStops(D.stopRows, req.code, 'PM', ''),
        riders: (slice.riding || []).map(function (r) {
          return { id: r.id, name: r.name, grade: r.grade, stopId: assigned[r.id] || '' };
        })
      };
    }

    if (req.op === 'saveStops') {
      // Writes are acknowledged but not persisted — the demo is a read-only snapshot of a school
      // day, and a half-saved stop order would make the next visitor's demo worse, not better.
      return { ok: true, stops: (req.stops || []).length,
               assigned: Object.keys(req.assign || {}).length };
    }

    if (req.op === 'addDriver') {
      var id = 'drv-demo' + (drivers.length + 1);
      var pin = String(req.pin || '').trim() || '4827';
      drivers.push({ 'Driver ID': id, Name: req.name, Routes: req.routes || '*',
                     'PIN Hash': 'set', Active: 'Y' });
      var tok = 'demo-tok-' + (devices.length + 1);
      devices.push({ Token: tok, 'Driver ID': id, Device: req.name + ' — phone',
                     Added: PUB.dayKey, Active: 'Y' });
      return { ok: true, driverId: id, name: req.name, pin: pin, token: tok,
               link: 'https://example.edu/routes/exec?k=' + tok };
    }

    if (req.op === 'resetPin') {
      return { ok: true, driverId: req.driverId,
               pin: String(req.pin || '').trim() || '5194' };
    }

    if (req.op === 'setActive') {
      drivers.forEach(function (x) {
        if (x['Driver ID'] === req.driverId) x.Active = req.active ? 'Y' : 'N';
      });
      return { ok: true };
    }

    if (req.op === 'revokeDevice') {
      devices.forEach(function (v) {
        if (v.Token === req.token) v.Active = req.active ? 'Y' : 'N';
      });
      return { ok: true };
    }

    if (req.op === 'addDevice') {
      var t = 'demo-tok-' + (devices.length + 1);
      devices.push({ Token: t, 'Driver ID': req.driverId, Device: 'replacement phone',
                     Added: PUB.dayKey, Active: 'Y' });
      return { ok: true, token: t, link: 'https://example.edu/routes/exec?k=' + t };
    }

    return { ok: false, reason: 'unknown-op' };
  }

  window.MOCK_BACKEND = { driverApi: driverApi, officeApi: officeApi };
})();
