/* mock.js — Dismissal Board demo backend.

   The real app is a thin server over PURE logic: Dismissal.gs runs unchanged on the server, in
   Node and in the browser (it is inlined into this page as DismissalClient). So this mock reads
   the fabricated tabs in data.js and hands them to the SAME ds* functions the production server
   calls — dsBuildRoster, dsBuildBoard, dsBuildSignedOut, dsWalkUpList, dsPermissions,
   dsCanChange, dsBuildStaffDirectory — and the app's own untouched JavaScript renders the
   result. What you see is the real classification.

   Backend methods the client calls (every one re-checks permission server-side in production;
   the same pure checks are applied here):
     dismissalApi(sim)      the whole board in one call; ?sim=YYYY-MM-DD[ HH:MM] time-travels
     pickupsApi()           who may collect each child (phase 2, after the board has painted)
     setOverride(...)       a TODAY-ONLY change — appends to the Overrides tab, returns the board
     saveView(view)         remember this person's filters
     rolesApi()             role membership, shared views and the staff directory, for the gear
     addRoleMember / removeRoleMember / saveRoleView
   State lives in this tab only; refresh to reset the demo. */
window.MOCK_BACKEND = (function () {
  'use strict';

  var D = window.DISMISSAL_DATA;
  var T = D.tabs;
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };

  // Mutable demo state — everything the real app would WRITE.
  var state = {
    overrides: clone(T.Overrides),
    roles: clone(T.Roles),
    savedViews: {},                    // {email: view}
    roleViews: clone(D.roleViews)      // {role: view}
  };

  /* ---------- clock (mirrors Code.gs dsTodayKey_ / dsDayName_) ---------- */
  function todayKey(sim) {
    var s = String(sim || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return D.demo.date;                // pinned to a school day, not the visitor's calendar
  }
  function dayNameOf(dayKey) {
    var p = dayKey.split('-');
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(+p[0], +p[1] - 1, +p[2], 12).getDay()];
  }
  function pad2(n) { return ('0' + n).slice(-2); }
  function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function stamp(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + hhmm(d);
  }

  /* ---------- permissions (mirrors Roles.gs dsMyPermissions_ / dsEffectiveView_) ----------
     Holding a homeroom on today's roster IS the Teacher role, so the roster's homeroom-teacher
     set goes in alongside the Roles tab. */
  function myPerm() {
    var staffNames = dsBuildStaffNames(T.Staff);
    return dsPermissions(D.demo.email, dsBuildRoles(state.roles), staffNames[D.demo.email] || '',
                         dsHomeroomTeacherSet(dsBuildRoster(T.Roster)));
  }
  function effectiveView(perm) {
    var personal = state.savedViews[D.demo.email];
    if (personal) return { view: personal, from: 'personal' };
    for (var i = 0; i < perm.roles.length; i++) {
      if (state.roleViews[perm.roles[i]]) return { view: state.roleViews[perm.roles[i]], from: perm.roles[i] };
    }
    return { view: null, from: '' };
  }
  function occasionalToday(overrides) {
    var out = {};
    Object.keys(overrides).forEach(function (id) { if (overrides[id].type === 'Staff Kid') out[id] = true; });
    return out;
  }
  // The staff directory for the settings add box: ACTIVE staff on the caller's own domain
  // (mirrors Roles.gs dsStaffDirectory_).
  function staffDirectory() {
    return dsBuildStaffDirectory(T.Staff, String(D.demo.email).split('@')[1] || '');
  }

  // How current the inputs are. The attendance feed refreshes every 15 minutes in production;
  // the demo says it was pulled a few minutes ago. The sign-out feed's state rides along so the
  // page can say "2 signed out today" next to the attendance line.
  function freshness(attendance, signedOut) {
    var now = new Date(), synced = new Date(now.getTime() - 9 * 60000);
    return { attendanceRows: Object.keys(attendance).length, rosterAt: '04:06',
             syncedAt: hhmm(synced), syncedAgeMin: 9, syncStale: false,
             signOutActive: true, signOutCount: Object.keys(signedOut).length };
  }

  function dismissalApi(sim) {
    var dayKey = todayKey(sim), dayName = dayNameOf(dayKey);
    var roster = dsBuildRoster(T.Roster);
    var attendance = dsBuildAttendance(T['Attendance Today']);
    var todayOverrides = dsBuildOverrides(state.overrides, dayKey);
    // The office's STANDING answers sit under today's call-ins (today wins) — mirrors dismissalApi.
    var overrides = dsMergeOverrides(dsBuildStanding(T.Standing, dayName), todayOverrides);
    var signedOut = dsBuildSignedOut(T.EVENTS, dayKey);     // the app's own fold, real kiosk columns
    var walkers = dsBuildWalkers(T.Walkers);
    var routes = dsBuildRoutes(T.Routes);
    var board = dsBuildBoard({ roster: roster, attendance: attendance, signedOut: signedOut, overrides: overrides },
                             { session: 'PM', routes: routes });
    // Only TODAY's overrides feed the walk-up list; then the approved walkers are MARKED on the board.
    var walkUp = dsWalkUpList(dsFlatList(board), walkers, attendance, signedOut, dayName,
                              occasionalToday(todayOverrides), todayOverrides);
    dsApplyWalkUps(board, walkUp);
    var perm = myPerm(), eff = effectiveView(perm);
    var fresh = freshness(attendance, signedOut);
    return {
      ok: true, board: board, routes: routes,
      walkUp: walkUp,
      dayKey: dayKey, dayName: dayName, sim: String(sim || ''),
      perm: perm,
      savedView: eff.view, viewFrom: eff.from,
      freshness: fresh,
      signOutActive: fresh.signOutActive,
      serverNow: stamp(new Date())
    };
  }

  return {
    dismissalApi: dismissalApi,

    // PHASE 2: enrolled students only, [name, relationship, one phone] per contact.
    pickupsApi: function () {
      var enrolled = {};
      dsBuildRoster(T.Roster).forEach(function (r) { enrolled[r.id] = 1; });
      var full = dsBuildPickups(T.PickupContacts), out = {};
      Object.keys(full).forEach(function (sid) {
        if (!enrolled[sid]) return;
        out[sid] = full[sid].map(function (p) { return [p.name, p.rel || '', p.cell || p.home || p.work || '']; });
      });
      return out;
    },

    // A TODAY-ONLY change. Permission is enforced HERE with the same pure rule the page uses to
    // hide the button, and the row records who and when.
    setOverride: function (studentId, type, routeCode, note, sim, destination) {
      studentId = String(studentId || '').trim();
      if (!studentId) throw new Error('A student id is required.');
      var allowed = ['Bus', 'Car', 'Early Bird', 'Staff Kid'];
      type = String(type || '').trim();
      if (allowed.indexOf(type) === -1) throw new Error('Type must be one of: ' + allowed.join(', '));
      var subject = null;
      dsBuildRoster(T.Roster).forEach(function (r) { if (!subject && r.id === studentId) subject = r; });
      var verdict = dsCanChange(myPerm(), subject, !!dsBuildWalkers(T.Walkers)[studentId]);
      if (!verdict.ok) throw new Error(verdict.why);
      state.overrides.push([todayKey(sim), studentId, subject ? subject.name : '', type,
                            String(routeCode || '').trim(), String(note || '').trim(),
                            D.demo.email, hhmm(new Date()), String(destination || '').trim()]);
      return dismissalApi(sim);
    },

    saveView: function (view) {
      if (!myPerm().roles.length) throw new Error('You have no dismissal role yet — ask the office to add you.');
      if (view === null || view === undefined) { delete state.savedViews[D.demo.email]; return null; }
      state.savedViews[D.demo.email] = {
        mode: String(view.mode || 'ramp'), scope: String(view.scope || ''),
        types: (view.types || []).map(String).slice(0, 8), type: String(view.type || ''),
        route: String(view.route || ''), pickup: String(view.pickup || ''),
        grades: (view.grades || []).map(String).slice(0, 16),
        excludeTypes: (view.excludeTypes || []).map(String).slice(0, 8),
        savedAt: stamp(new Date())
      };
      return clone(state.savedViews[D.demo.email]);
    },

    rolesApi: function () {
      var perm = myPerm();
      if (!perm.canManageRoles && !perm.roles.length) {
        return { ok: true, perm: perm, roles: DS_ROLES, members: [], views: {}, staff: [] };
      }
      return {
        ok: true, perm: perm, roles: DS_ROLES,
        members: dsBuildRoles(state.roles).filter(function (r) {
          return perm.isAdmin || perm.adminOf.indexOf(r.role) !== -1;
        }),
        views: clone(state.roleViews),
        staff: perm.canManageRoles ? staffDirectory() : []
      };
    },

    addRoleMember: function (role, email, asAdmin, note) {
      var perm = myPerm();
      if (DS_ROLES.indexOf(role) === -1) throw new Error('Unknown role: ' + role);
      if (perm.adminOf.indexOf(role) === -1) throw new Error('You are not an administrator of the "' + role + '" role.');
      if (asAdmin && !perm.isAdmin) throw new Error('Only an Admin can grant administrator rights on a role.');
      var e = String(email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('That does not look like an email.');
      var dup = dsBuildRoles(state.roles).some(function (r) { return r.role === role && r.email === e; });
      if (dup) throw new Error(e + ' is already in the "' + role + '" role.');
      state.roles.push([role, e, asAdmin ? 'Y' : '',
                        String(note || '').trim() || ('added by ' + perm.email + ' on ' + todayKey(''))]);
      return this.rolesApi();
    },

    removeRoleMember: function (role, email) {
      var perm = myPerm();
      if (perm.adminOf.indexOf(role) === -1) throw new Error('You are not an administrator of the "' + role + '" role.');
      var e = String(email || '').trim().toLowerCase();
      var rows = dsBuildRoles(state.roles);
      if (role === 'Admin' && rows.filter(function (r) { return r.role === 'Admin'; }).length <= 1) {
        throw new Error('That is the last Admin — removing it would lock everyone out of role management. ' +
                        'Add another Admin first.');
      }
      for (var i = state.roles.length - 1; i >= 1; i--) {
        if (String(state.roles[i][0]).trim() === role && String(state.roles[i][1]).trim().toLowerCase() === e) {
          state.roles.splice(i, 1); break;
        }
      }
      return this.rolesApi();
    },

    saveRoleView: function (role, view) {
      var perm = myPerm();
      if (perm.adminOf.indexOf(role) === -1) throw new Error('You are not an administrator of the "' + role + '" role.');
      if (DS_ROLES.indexOf(role) === -1) throw new Error('Unknown role: ' + role);
      state.roleViews[role] = {
        mode: String((view && view.mode) || 'ramp'), scope: String((view && view.scope) || ''),
        route: String((view && view.route) || ''),
        types: ((view && view.types) || []).map(String).slice(0, 8),
        grades: ((view && view.grades) || []).map(String).slice(0, 16),
        excludeTypes: ((view && view.excludeTypes) || []).map(String).slice(0, 8),
        savedBy: perm.email, savedAt: stamp(new Date())
      };
      return clone(state.roleViews[role]);
    }
  };
})();
