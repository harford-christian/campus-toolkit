/* mock.js — in-memory stand-in for the Staff Onboarding app's Apps Script backend.
   Implements every google.script.run method the untouched UI calls (via gsr-shim.js).
   State lives in this tab only; refresh to reset the demo. */
(function () {
  'use strict';
  var D = window.DEMO_DATA;

  // Mutable demo state (cloned so a refresh resets everything).
  var state = {
    setupComplete: false, // wizard banner shows inside ⚙ Settings until "Finish setup"
    schemaReady: true,
    ui: JSON.parse(JSON.stringify(D.ui)),
    roles: D.roles.map(function (r) { return { key: r.key, label: r.label }; }),
    roster: JSON.parse(JSON.stringify(D.roster))
  };

  function today() { return new Date().toISOString().slice(0, 10); }

  function adminState() {
    return {
      setupComplete: state.setupComplete,
      schemaReady: state.schemaReady,
      ui: JSON.parse(JSON.stringify(state.ui)),
      everyoneDocUrl: '#demo-doc-everyone',
      roles: state.roles.map(function (r) { return { key: r.key, label: r.label, docUrl: '#demo-doc-' + r.key }; })
    };
  }

  window.MOCK_BACKEND = {

    contentApi: function (roleKey) {
      var out = { everyoneHtml: D.everyoneHtml, roleHtml: '', roleLabel: '' };
      if (roleKey) {
        out.roleHtml = D.docs[roleKey] || D.docs._NEW_ROLE;
        state.roles.forEach(function (r) { if (r.key === roleKey) out.roleLabel = r.label; });
      }
      return out;
    },

    adminStateApi: function () { return adminState(); },

    adminRosterApi: function () {
      return state.roster.map(function (r) { return JSON.parse(JSON.stringify(r)); })
        .sort(function (a, b) { return a.email < b.email ? -1 : 1; });
    },

    adminMarkOnboardedApi: function (emails) {
      var all = !emails || !emails.length;
      var wanted = {};
      (emails || []).forEach(function (e) { wanted[String(e).toLowerCase()] = true; });
      var written = 0;
      var stamp = 'pre-existing ' + today();
      state.roster.forEach(function (r) {
        if (r.onboarded) return;
        if (all || wanted[r.email.toLowerCase()]) { r.onboarded = stamp; written++; }
      });
      return { requested: written, written: written, verified: written, pending: [], failed: [] };
    },

    adminSaveRolesApi: function (roles) {
      if (!roles || !roles.length) throw new Error('At least one role is required.');
      var byKey = {};
      state.roles.forEach(function (r) { byKey[r.key] = true; });
      state.roles = roles.map(function (r) {
        if (!byKey[r.key]) throw new Error('Unknown role key: ' + r.key);
        if (!String(r.label || '').trim()) throw new Error('Every role needs a name.');
        return { key: r.key, label: String(r.label).trim() };
      });
      return adminState();
    },

    adminAddRoleApi: function (label) {
      label = String(label || '').trim();
      if (!label) throw new Error('The new role needs a name.');
      var key = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'ROLE';
      var base = key, n = 2;
      while (state.roles.some(function (r) { return r.key === key; })) key = base + '_' + (n++);
      state.roles.push({ key: key, label: label });
      return adminState();
    },

    adminSaveUiApi: function (ui) {
      Object.keys(state.ui).forEach(function (k) {
        if (ui && typeof ui[k] === 'string' && ui[k].trim()) state.ui[k] = ui[k].trim();
      });
      return adminState();
    },

    adminCompleteSetupApi: function () {
      state.setupComplete = true;
      return adminState();
    }
  };
})();
