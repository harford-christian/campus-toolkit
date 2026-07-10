/* mock.js — Emergency Lockdown demo backend.
   Stateful in-memory processPost mirroring WebApp.js/LockdownControl.js. Every
   response carries a rotating csrfToken (the UI stores it for the next call). */
window.MOCK_BACKEND = (function () {
  var D = window.LOCKDOWN_DATA;
  var csrfSeq = 1;
  var state = { active: false };
  var maint = { active: false };

  function token() { return 'demo-csrf-' + (++csrfSeq); }
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function resolveDoors(names) {
    if (!names || !names.length) return [];
    var wanted = names.map(function (n) { return String(n).toLowerCase(); });
    return D.doors.map(function (d) { return d.name; })
      .filter(function (n) { return wanted.indexOf(n.toLowerCase()) >= 0; });
  }

  function processPost(payload) {
    var res;
    switch (payload && payload.action) {
      case 'lockdownGet':
        res = {
          success: true, email: D.demoUser, isAdmin: true,
          state: JSON.parse(JSON.stringify(state)),
          categories: D.categories, doors: D.doors,
          maint: JSON.parse(JSON.stringify(maint))
        };
        break;
      case 'lockdownTrigger':
        state = {
          active: true, since: stamp(), by: D.demoUser, category: '', shortCode: '',
          scope: maint.active ? (maint.doors || []) : null,
          test: !!maint.active
        };
        res = { success: true, failed: [], since: state.since, by: state.by, test: state.test, scope: state.scope };
        break;
      case 'lockdownDetails':
        if (!state.active) { res = { error: 'No active lockdown to attach details to.' }; break; }
        state.category = payload.category || '';
        res = { success: true };
        break;
      case 'lockdownEnd':
        state = { active: false };
        res = { success: true };
        break;
      case 'lockdownMaintOn':
        maint = { active: true, until: Date.now() + 5 * 60 * 1000, doors: resolveDoors(payload.doors) };
        res = { ok: true, until: maint.until, doors: maint.doors };
        break;
      case 'lockdownMaintOff':
        maint = { active: false };
        res = { ok: true };
        break;
      default:
        res = { error: 'Unknown action: ' + (payload && payload.action) };
    }
    res.csrfToken = token();
    return res;
  }

  return { processPost: processPost };
})();
