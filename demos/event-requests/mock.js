/* mock.js — Event Requests & Approvals demo backend.
   Mirrors WebApp.js processPost + getLoggedInUser. Stateful in memory: approve/
   deny/cancel/create/update mutate the request list, and the client's reload
   (getRequestData) reflects the change. Dates are computed relative to today so
   events are always upcoming. */
window.MOCK_BACKEND = (function () {
  var D = window.EVENTREQ_DATA;
  var U = D.currentUser;
  var csrfSeq = 1;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(offsetDays) {
    var d = new Date(); d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowStamp() {
    var d = new Date();
    return fmtDate(0) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function token() { return 'demo-csrf-' + (++csrfSeq); }
  function uuid() { return 'req-' + Math.random().toString(16).slice(2, 10) + '-new'; }

  // Expand a declarative seed row into a full REQUEST object (canonical shape).
  function expand(r) {
    var eventDate = fmtDate(r.inDays) + (r.time ? ' ' + r.time : '');
    var ga = {};
    Object.keys(r.approvals).forEach(function (g) {
      var st = r.approvals[g];
      ga[g] = (st === 'Approved' || st === 'Denied')
        ? { status: st, by: 'approver@harfordchristian.org', at: fmtDate(-3) + ' 10:15' }
        : { status: 'Pending' };
    });
    return {
      token: r.token, approvalId: '',
      requesterName: r.requesterName, requesterEmail: r.requesterEmail,
      eventName: r.eventName, eventType: r.eventType, location: r.location,
      eventDate: eventDate,
      setupDate: r.setup ? fmtDate(r.inDays - 1) : '',
      avRequired: r.avRequired, heavyItems: r.heavyItems, doorSchedule: r.doorSchedule,
      target: r.target || '',
      start: (r.target && r.startTime) ? fmtDate(r.inDays) + ' ' + r.startTime : '',
      end: (r.target && r.endTime) ? fmtDate(r.inDays) + ' ' + r.endTime : '',
      status: r.status,
      createdAt: fmtDate(-20) + ' 09:15', updatedAt: fmtDate(-10) + ' 14:22',
      doorActions: r.doorActions || '',
      requiredGroups: r.requiredGroups.slice(),
      groupApprovals: ga
    };
  }

  var REQUESTS = D.requests.map(expand);
  function find(tok) { for (var i = 0; i < REQUESTS.length; i++) if (REQUESTS[i].token === tok) return REQUESTS[i]; return null; }
  function canApprove(g) { return U.isSuperApprover || D.myGroups.indexOf(g) >= 0; }
  function allApproved(req) { return req.requiredGroups.every(function (g) { return req.groupApprovals[g] && req.groupApprovals[g].status === 'Approved'; }); }

  function getRequestData() {
    var list = REQUESTS.filter(function (r) { return r.status !== 'Canceled'; })
      .slice().sort(function (a, b) { return b.eventDate.localeCompare(a.eventDate); });
    return {
      success: true, requests: list, isAdmin: U.isAdmin, doors: D.doors,
      allGroups: D.allGroups, myGroups: D.myGroups, isSuperApprover: U.isSuperApprover
    };
  }

  function triggersFor(f) {
    var g = ['Planning & Events'];
    if (String(f.avRequired) === 'Yes') g.push('AV / IT Team');
    if (String(f.heavyItems) === 'Yes') g.push('Facilities / Setup Crew');
    if (String(f.doorSchedule || '').trim().toLowerCase().indexOf('yes') === 0) g.push('Security & Doors');
    return g;
  }

  function processPost(params) {
    var res, req;
    switch (params && params.action) {
      case 'getRequestData':
        res = getRequestData();
        break;

      case 'approveRequest':
        req = find(params.token);
        if (!req) { res = { error: 'Request not found' }; break; }
        req.requiredGroups.forEach(function (g) {
          if (canApprove(g) && req.groupApprovals[g] && req.groupApprovals[g].status !== 'Approved') {
            req.groupApprovals[g] = { status: 'Approved', by: U.email, at: nowStamp() };
          }
        });
        var full = allApproved(req);
        if (full) req.status = 'Active';
        req.updatedAt = nowStamp();
        res = { success: true, fullyApproved: full, csrfToken: token() };
        break;

      case 'denyRequest':
        req = find(params.token);
        if (!req) { res = { error: 'Request not found' }; break; }
        req.status = 'Denied';
        req.requiredGroups.forEach(function (g) {
          if (canApprove(g)) req.groupApprovals[g] = { status: 'Denied', by: U.email, at: nowStamp() };
        });
        req.updatedAt = nowStamp();
        res = { success: true, csrfToken: token() };
        break;

      case 'cancelRequest':
        req = find(params.token);
        if (req) { req.status = 'Canceled'; req.updatedAt = nowStamp(); }
        res = { success: true };
        break;

      case 'createRequest': {
        var rg = triggersFor(params);
        var ga = {}; rg.forEach(function (g) { ga[g] = { status: 'Pending' }; });
        var nr = {
          token: uuid(), approvalId: '',
          requesterName: params.requesterName || U.email, requesterEmail: U.email,
          eventName: params.eventName || 'Untitled Event', eventType: params.eventType || 'School',
          location: params.location || '', eventDate: params.eventDate || fmtDate(14),
          setupDate: params.setupDate || '', avRequired: params.avRequired || 'No',
          heavyItems: params.heavyItems || 'No', doorSchedule: params.doorSchedule || 'No',
          target: params.target || '', start: params.start || '', end: params.end || '',
          status: 'Pending', createdAt: nowStamp(), updatedAt: nowStamp(),
          doorActions: params.doorActions || '', requiredGroups: rg, groupApprovals: ga
        };
        REQUESTS.push(nr);
        res = { success: true, token: nr.token };
        break;
      }

      case 'updateRequest': {
        req = find(params.token);
        if (!req) { res = { error: 'Request not found' }; break; }
        var fields = {};
        try { fields = JSON.parse(params.fields || '{}'); } catch (e) {}
        ['requesterName', 'eventName', 'eventType', 'location', 'eventDate', 'setupDate',
          'avRequired', 'heavyItems', 'doorSchedule', 'target', 'start', 'end', 'doorActions']
          .forEach(function (k) { if (k in fields) req[k] = fields[k]; });
        req.updatedAt = nowStamp();
        res = { success: true, approvalReset: false };
        break;
      }

      default:
        res = { error: 'Unknown action: ' + (params && params.action) };
    }
    return res;
  }

  return {
    processPost: processPost,
    getLoggedInUser: function () { return { email: U.email, isAdmin: U.isAdmin }; }
  };
})();
