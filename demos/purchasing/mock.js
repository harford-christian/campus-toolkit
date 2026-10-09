/* mock.js — the Purchasing & Procurement demo's stand-in for Code.js.

   The page is the real Index.html + JavaScript.html; every google.script.run call it makes lands
   here (gsr-shim resolves the name on window.MOCK_BACKEND). This is a plain object with one
   function per server method the page calls (no catch-all), each returning the shape Code.js
   returns and applying the same workflow rules:

     Pending Approval --price--> Pending Signature --sign--> Approved --slip / mark--> Fulfillment --> Closed/Paid
       |  send back -> Needs Info -> resubmit          |  hold -> On Hold (discussion, re-send, sign)
       |  reject -> Rejected                           |  approver rejects -> Under Review -> publish (Rejected) / reopen
       |  split -> Split + children, merge -> Merged   |  route to a backup approver, or approve on the approver's behalf
       '  cancel (Pending Approval) / request cancellation -> Cancellation Requested -> Cancelled, or back to prior status

   State lives in memory and in sessionStorage for the visit: a submitted order survives a tab
   switch or reload; a new browser tab starts clean. Dates in data.js are written as of its anchor
   day and slid forward to today (ids included), so the current-school-year views always have data.
   The signed-in user is the Owner from data.js. window.PURCHASING_DEMO.reset() restores the seed. */
(function () {
  'use strict';
  var D = window.PURCHASING_DATA;
  var STORE_KEY = 'purchasing-demo-v1';
  var ME = D.currentUser.email;
  var MY_ROLE = D.currentUser.role;
  var DAY = 86400000;

  var TERMINAL = ['Closed/Paid', 'Cancelled', 'Rejected', 'Split', 'Merged'];
  var NON_SPEND = ['Cancelled', 'Split', 'Merged', 'Rejected', 'Under Review', 'On Hold'];
  var ANALYTICS_EXCLUDE = ['Cancelled', 'Rejected', 'Split', 'Merged'];
  var PRE_SIGN = ['Pending Approval', 'Needs Info', 'Pending Signature', 'On Hold'];
  var MERGEABLE = ['Pending Approval', 'Pending Signature', 'On Hold'];
  var AWAITING_SIGNATURE = ['Pending Signature', 'On Hold'];
  var ITEM_STATUSES = ['Pending', 'Ordered', 'Arrived', 'Delayed', 'Backordered', 'Returned'];
  var DOC_CATEGORIES = { 'Quote': 'QT', 'Order Confirmation': 'OC', 'Packing List': 'PL', 'Invoice': 'INV', 'Return Confirmation': 'RET', 'Misc': 'MISC' };
  var USERS_HEADERS = ['Email', 'First_Name', 'Last_Name', 'Default_Dept', 'System_Role', 'PIN', 'PIN_RequireOnAccess', 'PIN_IntervalMinutes',
    'PIN_AmountThreshold', 'Manager_Email', 'Employee_Title', 'OU_Path', 'Last_Synced_At', 'Active', 'Alt_Depts'];
  var CATALOG_HEADERS = ['Item_ID', 'Category', 'Item_Name', 'Image_URL', 'Lead_Time', 'Colors', 'Options', 'Active', 'Price'];

  /* ---------- small helpers ---------- */
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function nowIso() { return new Date().toISOString(); }
  function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function todayYmd() { return ymd(new Date()); }
  function isTrue(v) { return v === true || (typeof v === 'string' && v.toLowerCase() === 'true'); }
  function fail(msg) { throw new Error(msg); }
  function syOf(iso) {
    var d = new Date(iso), y = d.getFullYear();
    var start = d.getMonth() >= 8 ? y : y - 1;
    return 'SY' + p2(start % 100) + '-' + p2((start + 1) % 100);
  }
  function csyRange() {
    var now = new Date(), y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: new Date(y, 8, 1).getTime(), end: new Date(y + 1, 7, 31, 23, 59, 59).getTime(), startYear: y };
  }
  function money(n) { return '$' + round2(n).toFixed(2); }

  /* ---------- slide the anchor-day dataset onto today ---------- */
  var a = D.anchor.split('-');
  var anchorDate = new Date(+a[0], +a[1] - 1, +a[2]);
  var t0 = new Date(); t0 = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
  var SHIFT_DAYS = Math.round((t0 - anchorDate) / DAY);
  function shiftDate(y, m, d, hh, mm, ss) {
    var dt = new Date(+y, +m - 1, +d, +(hh || 0), +(mm || 0), +(ss || 0));
    dt.setDate(dt.getDate() + SHIFT_DAYS);
    return dt;
  }
  function shiftString(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (m) return shiftDate(m[1], m[2], m[3], m[4], m[5], m[6]).toISOString();
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return ymd(shiftDate(m[1], m[2], m[3]));
    return s.replace(/ORD-(\d{4})(\d{2})(\d{2})-/g, function (_x, y, mo, d) {
      var dt = shiftDate(y, mo, d);
      return 'ORD-' + dt.getFullYear() + p2(dt.getMonth() + 1) + p2(dt.getDate()) + '-';
    });
  }
  function shiftAll(x) {
    if (typeof x === 'string') return shiftString(x);
    if (Array.isArray(x)) return x.map(shiftAll);
    if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (k) { o[k] = shiftAll(x[k]); }); return o; }
    return x;
  }

  /* ---------- state ---------- */
  var S;
  function storage() { try { return window.sessionStorage; } catch (e) { return null; } }
  function save() { var s = storage(); if (!s) return; try { s.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {} }
  function load() {
    var s = storage(); if (!s) return null;
    try { var v = JSON.parse(s.getItem(STORE_KEY) || 'null'); return (v && v.shiftDays === SHIFT_DAYS && v.version === 1) ? v : null; } catch (e) { return null; }
  }

  function seed() {
    var d = shiftAll(clone(D));
    var st = { version: 1, shiftDays: SHIFT_DAYS, seq: 1, orders: [], comments: [], audit: [], docs: [], returns: [] };
    var syncedAt = (function () { var x = new Date(t0.getTime() - DAY); return ymd(x) + ' 06:00'; })();
    st.users = [USERS_HEADERS.slice()].concat(d.staff.map(function (u) {
      var isMe = u.email === ME;
      return [u.email, u.first, u.last, u.dept, u.role, (isMe || u.role === 'Approver') ? '****' : '', false,
        (isMe || u.role === 'Approver') ? 30 : '', (isMe || u.role === 'Approver') ? 500 : '', u.manager, u.title,
        '/Staff/' + (u.dept === 'Administration' || u.dept === 'Athletics' || u.dept === 'Operations' || u.dept === 'Technology' ? u.dept : 'Faculty'),
        syncedAt, true, u.alt];
    }));
    st.vendors = clone(d.vendors);
    st.catalog = [CATALOG_HEADERS.slice()];
    ['office', 'furniture', 'cleaning'].forEach(function (k) {
      d.catalog[k].forEach(function (c) { st.catalog.push([c.id, c.category, c.name, c.image, c.leadTime, c.colors.join(', '), c.options.join(', '), true, c.price]); });
    });
    st.departments = clone(d.departments);
    st.delegations = clone(d.delegations);
    st.savedViews = clone(d.savedViews);
    st.emailRules = clone(d.emailRules);
    st.approver = clone(d.approverSettings);
    st.depts = clone(d.depts);
    st.teamAccess = clone(d.teamAccess);

    d.orders.forEach(function (o) {
      var n = {
        id: o.id, requestorEmail: o.requestorEmail, date: o.date, sy: syOf(o.date), priority: !!o.priority, neededBy: o.neededBy || '',
        status: o.status, approvedAt: o.approvedAt || '', approvedBy: o.approvedBy || '', cancelJustification: o.cancelJustification || '',
        poPdfUrl: '', parentId: o.parentId || '', vendor: o.vendor || '', bank: o.bank || '', payType: o.payType || '', total: '',
        packingSummary: o.packingSummary || '', pricedAt: o.pricedAt || '', fulfillmentAt: o.fulfillmentAt || '', closedAt: o.closedAt || '',
        preCancelStatus: o.preCancelStatus || '', chargingDepartment: o.dept || '', additionalNotify: o.additionalNotify || '',
        adjustments: clone(o.adjustments || []), assignedApprover: o.assignedApprover || '',
        items: o.items.map(function (it, i) {
          return {
            lineId: o.id + '-' + (i + 1), category: it.category || 'Custom', name: it.name, url: it.url || '', qty: it.qty, color: it.color || '',
            notes: it.notes || '', status: it.status || 'Pending', fulfillNote: it.fulfillNote || '', unitCost: it.unitCost || 0,
            attachmentUrl: it.attachmentFileName ? '#attachment' : '', attachmentFileName: it.attachmentFileName || ''
          };
        })
      };
      st.orders.push(n);
    });
    S = st;   // helpers below read S
    d.returns.forEach(function (r, k) {
      var o = byId(r.orderId), it = o.items[r.line - 1];
      S.returns.push({ returnId: 'RET-' + r.orderId + '-' + (k + 1), orderId: r.orderId, lineId: it.lineId, item: it.name, qty: r.qty,
        unitCost: it.unitCost, refund: r.refund, reason: r.reason, docUrl: '', by: r.by, at: r.at });
      if (returnedQty(it.lineId) >= it.qty) it.status = 'Returned';
    });
    S.orders.forEach(function (o) { if (o.pricedAt) recomputeTotal(o); });
    // Milestone audit rows from each order's own timestamps, then the hand-written extras.
    S.orders.forEach(function (o) {
      if (o.pricedAt) S.audit.push({ orderId: o.id, actor: 'pquinlan@example.edu', action: 'Priced', detail: 'Total ' + money(grossTotal(o)) + (o.vendor ? ' · ' + o.vendor : ''), at: o.pricedAt });
      if (o.approvedAt) S.audit.push({ orderId: o.id, actor: o.approvedBy, action: 'Approved', detail: 'Total ' + money(grossTotal(o)) + ' · signed by ' + o.approvedBy, at: o.approvedAt });
      if (o.fulfillmentAt) S.audit.push({ orderId: o.id, actor: 'pquinlan@example.edu', action: 'Fulfillment started', detail: 'packing list uploaded', at: o.fulfillmentAt });
    });
    d.audit.forEach(function (x) { S.audit.push(clone(x)); });
    d.comments.forEach(function (c, k) {
      S.comments.push({ commentId: 'CMT-' + c.orderId + '-' + (k + 1), orderId: c.orderId, author: c.author, role: c.role, visibility: c.visibility, body: c.body, createdAt: c.at });
    });
    d.documents.forEach(function (x, k) {
      S.docs.push({ docId: 'DOC-' + (1000 + k), orderId: x.orderId, category: x.category, driveName: x.orderId + '_' + DOC_CATEGORIES[x.category] + '_' + x.originalName,
        originalName: x.originalName, fileUrl: '', uploadedBy: x.uploadedBy, uploadedAt: x.uploadedAt });
    });
    return S;
  }

  /* ---------- order helpers (read S) ---------- */
  function byId(id) { for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) return S.orders[i]; return null; }
  function mustOrder(id) { var o = byId(id); if (!o) fail('Order not found: ' + id); return o; }
  function subtotal(o) { return o.items.reduce(function (s, it) { return s + (parseInt(it.qty, 10) || 0) * (parseFloat(it.unitCost) || 0); }, 0); }
  function adjAmount(a, sub) { return round2(a.mode === 'pct' ? (sub * (a.value || 0) / 100) : (a.value || 0)); }
  function adjSum(o, sub) { return (o.adjustments || []).reduce(function (s, a) { return s + (a.type === 'discount' ? -adjAmount(a, sub) : adjAmount(a, sub)); }, 0); }
  function returnedAmount(id) { return round2(S.returns.filter(function (r) { return r.orderId === id; }).reduce(function (s, r) { return s + (parseFloat(r.refund) || 0); }, 0)); }
  function returnedQty(lineId) { return S.returns.filter(function (r) { return r.lineId === lineId; }).reduce(function (s, r) { return s + (parseInt(r.qty, 10) || 0); }, 0); }
  function grossTotal(o) { var sub = subtotal(o); return round2(sub + adjSum(o, sub)); }
  function recomputeTotal(o) { o.total = round2(grossTotal(o) - returnedAmount(o.id)); return o.total; }
  function isPriced(o) { return o.total !== '' && o.total != null; }
  function userRow(email) {
    var e = (email || '').toLowerCase();
    for (var i = 1; i < S.users.length; i++) if ((S.users[i][0] || '').toString().toLowerCase() === e) return S.users[i];
    return null;
  }
  function nameOf(email) { var u = userRow(email); return u ? (u[1] + ' ' + u[2]).trim() : email; }
  function deptOf(email) { var u = userRow(email); return u ? (u[3] || '') : ''; }
  function effDept(o) { return o.chargingDepartment || deptOf(o.requestorEmail) || 'Unassigned'; }
  function audit(orderId, action, detail) { S.audit.push({ orderId: orderId, actor: ME, action: action, detail: detail || '', at: nowIso() }); }
  function comment(orderId, visibility, body) {
    var c = { commentId: 'CMT-' + orderId + '-' + Date.now() + '-' + (S.seq++), orderId: orderId, author: ME, role: MY_ROLE, visibility: visibility, body: body, createdAt: nowIso() };
    S.comments.push(c);
    return c;
  }
  function needText(v, msg) { if (!v || !v.toString().trim()) fail(msg); return v.toString().trim(); }
  function storeFromItem(name, url) {
    var n = (name || '').toString(), dash = n.indexOf(' - ');
    if (dash > 0 && dash < 30) return n.substring(0, dash).trim();
    try { if (url) { var host = new URL(url).hostname.replace(/^www\./, '').split('.')[0]; return host.charAt(0).toUpperCase() + host.slice(1); } } catch (e) {}
    return '';
  }
  function normAdjustments(list) {
    return (list || []).map(function (x) {
      return { label: (x.label || '').toString().trim(), type: x.type === 'discount' ? 'discount' : 'charge', mode: x.mode === 'pct' ? 'pct' : 'flat', value: Math.abs(parseFloat(x.value != null ? x.value : x.amount) || 0) };
    }).filter(function (x) { return x.value > 0; });
  }
  function applyCosts(o, itemCosts) {
    var costMap = {};
    (itemCosts || []).forEach(function (c) { if (c && c.id != null) costMap[c.id] = parseFloat(c.cost) || 0; });
    o.items.forEach(function (it) { if (it.lineId in costMap) it.unitCost = round2(costMap[it.lineId]); });
  }

  /* ---------- projections (the shapes Code.js returns) ---------- */
  function fullOrder(o) {
    return {
      returnedAmount: returnedAmount(o.id), id: o.id, requestor: nameOf(o.requestorEmail), requestorEmail: o.requestorEmail, date: o.date, sy: o.sy,
      status: o.status, approvedAt: o.approvedAt, approvedBy: o.approvedBy, cancelJustification: o.cancelJustification, vendor: o.vendor,
      bank: o.bank, payType: o.payType, total: o.total, packingSummary: o.packingSummary, pricedAt: o.pricedAt, fulfillmentAt: o.fulfillmentAt,
      closedAt: o.closedAt, preCancelStatus: o.preCancelStatus, chargingDepartment: o.chargingDepartment, additionalNotify: o.additionalNotify,
      poPdfUrl: o.poPdfUrl, parentId: o.parentId, adjustments: clone(o.adjustments), assignedApprover: o.assignedApprover,
      items: o.items.map(function (it) {
        return { lineId: it.lineId, name: it.name, qty: it.qty, unitCost: it.unitCost || 0, notes: it.notes, status: it.status || 'Pending',
          fulfillNote: it.fulfillNote || '', url: it.url, attachmentUrl: it.attachmentUrl, attachmentFileName: it.attachmentFileName,
          returnedQty: returnedQty(it.lineId), category: it.category, color: it.color };
      })
    };
  }
  function historyOrder(o) {
    return {
      id: o.id, date: o.date, sy: o.sy, status: o.status, approvedAt: o.approvedAt, approvedBy: o.approvedBy, cancelJustification: o.cancelJustification,
      pricedAt: o.pricedAt, fulfillmentAt: o.fulfillmentAt, closedAt: o.closedAt, poPdfUrl: o.poPdfUrl, parentId: o.parentId,
      chargingDepartment: o.chargingDepartment, additionalNotify: o.additionalNotify, total: o.total, adjustments: clone(o.adjustments),
      returnedAmount: returnedAmount(o.id),
      items: o.items.map(function (it) {
        return { name: it.name, qty: it.qty, unitCost: it.unitCost || 0, returnedQty: returnedQty(it.lineId), status: it.status || 'Pending',
          fulfillNote: it.fulfillNote || '', url: it.url, notes: it.notes, attachmentUrl: it.attachmentUrl, attachmentFileName: it.attachmentFileName,
          category: it.category, color: it.color };
      })
    };
  }
  function byDateDesc(a, b) { return new Date(b.date) - new Date(a.date); }

  /* ---------- catalog, people, departments ---------- */
  function getCatalogItems() {
    var items = { office: [], furniture: [], cleaning: [] };
    S.catalog.slice(1).forEach(function (r) {
      if (!isTrue(r[7])) return;
      var item = { id: r[0], category: r[1], name: r[2], image: r[3], leadTime: r[4],
        colors: r[5] ? r[5].toString().split(',').map(function (c) { return c.trim(); }) : [],
        options: r[6] ? r[6].toString().split(',').map(function (c) { return c.trim(); }) : [],
        price: parseFloat(r[8]) || 0 };
      if (item.category === 'Office Supply') items.office.push(item);
      if (item.category === 'Furniture') items.furniture.push(item);
      if (item.category === 'Cleaning & Maintenance') items.cleaning.push(item);
    });
    return items;
  }
  function activeDeptNames() { return S.departments.filter(function (d) { return d.active; }).map(function (d) { return d.name; }).sort(); }
  function myDepts() {
    var u = userRow(ME), primary = u ? u[3] : S.depts.primary;
    var alts = u && u[14] ? u[14].toString().split(',').map(function (x) { return x.trim(); }).filter(Boolean) : S.depts.alternates.slice();
    return { primary: primary, alternates: alts };
  }
  function getUserAvailableDepts(_email) { var m = myDepts(); return { primary: m.primary, alternates: m.alternates, allActive: activeDeptNames() }; }
  function getActiveStaffForPicker() {
    var m = myDepts(), mine = [m.primary].concat(m.alternates).map(function (x) { return x.toLowerCase(); });
    var people = S.users.slice(1).filter(function (r) { return isTrue(r[13]) && (r[0] || '').toLowerCase() !== ME.toLowerCase(); }).map(function (r) {
      return { email: r[0], name: (r[1] + ' ' + r[2]).trim(), dept: r[3], inMyDepts: mine.indexOf((r[3] || '').toLowerCase()) > -1 };
    }).sort(function (x, y) { return x.name.localeCompare(y.name); });
    return people.filter(function (p) { return p.inMyDepts; }).concat(people.filter(function (p) { return !p.inMyDepts; }));
  }
  function getBootstrapData() { return { catalog: getCatalogItems(), depts: getUserAvailableDepts(ME), staff: getActiveStaffForPicker() }; }

  /* ---------- requestor ---------- */
  function submitOrder(meta, cart) {
    meta = meta || {};
    if (!Array.isArray(cart) || !cart.length) fail('Cannot submit an order with no items. Please add at least one item to your cart.');
    cart.forEach(function (it) {
      if (it && it.category === 'Custom' && !(it.url && it.url.toString().trim()) && !it.attachmentBase64) fail('Each custom/online item needs either a link or an attached quote.');
    });
    var now = new Date(), id;
    do { id = 'ORD-' + now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate()) + '-' + Math.floor(1000 + Math.random() * 9000); } while (byId(id));
    var notify = Array.isArray(meta.additionalNotify) ? meta.additionalNotify : (meta.additionalNotify ? String(meta.additionalNotify).split(',') : []);
    var seen = {}, clean = [];
    notify.forEach(function (e) { var t = (e || '').toString().trim(); if (t && !seen[t.toLowerCase()]) { seen[t.toLowerCase()] = 1; clean.push(t); } });
    var o = {
      id: id, requestorEmail: ME, date: now.toISOString(), sy: syOf(now.toISOString()), priority: !!meta.priority, neededBy: meta.neededBy || '',
      status: 'Pending Approval', approvedAt: '', approvedBy: '', cancelJustification: '', poPdfUrl: '', parentId: '', vendor: '', bank: '', payType: '',
      total: '', packingSummary: '', pricedAt: '', fulfillmentAt: '', closedAt: '', preCancelStatus: '', chargingDepartment: (meta.chargingDepartment || '').toString().trim(),
      additionalNotify: clean.join(', '), adjustments: [], assignedApprover: '',
      items: cart.map(function (it, i) {
        return { lineId: id + '-' + (i + 1), category: it.category || 'Custom', name: it.name, url: it.url || '', qty: parseInt(it.qty, 10) || 1,
          color: it.color || '', notes: [it.color, it.option, it.notes].filter(Boolean).join(' | '), status: 'Pending', fulfillNote: '',
          unitCost: parseFloat(it.price) || 0, attachmentUrl: it.attachmentBase64 ? '#attachment' : '', attachmentFileName: it.attachmentBase64 ? (it.attachmentFileName || 'attachment') : '' };
      })
    };
    S.orders.push(o);
    return id;
  }
  function getUserOrderHistory(email) {
    var target = ((MY_ROLE === 'Owner' ? (email || ME) : ME) || '').toLowerCase();
    return S.orders.filter(function (o) { return o.requestorEmail.toLowerCase() === target; }).map(historyOrder).sort(byDateDesc);
  }
  function cancelOrder(id) {
    var o = mustOrder(id);
    if (o.status !== 'Pending Approval') fail('Only Pending Approval orders can be directly cancelled.');
    o.preCancelStatus = o.status; o.status = 'Cancelled';
    return 'Order cancelled successfully.';
  }
  function editOrder(id, items) {
    var o = mustOrder(id);
    if (!Array.isArray(items) || !items.length) fail('An order must keep at least one item.');
    if (PRE_SIGN.indexOf(o.status) === -1) fail('This order cannot be edited at its current status.');
    var before = o.items.map(function (it) { return it.name + '×' + it.qty; }).join('|');
    o.items = items.map(function (it, i) {
      return { lineId: id + '-' + (i + 1), category: it.category || 'Custom', name: it.name, url: it.url || '', qty: parseInt(it.qty, 10) || 1, color: it.color || '',
        notes: it.notes || '', status: ITEM_STATUSES.indexOf(it.status) > -1 ? it.status : 'Pending', fulfillNote: it.fulfillNote || '',
        unitCost: round2(it.price != null ? it.price : it.unitCost), attachmentUrl: it.attachmentUrl || '', attachmentFileName: it.attachmentFileName || '' };
    });
    var after = o.items.map(function (it) { return it.name + '×' + it.qty; }).join('|');
    if (isPriced(o)) recomputeTotal(o);
    audit(id, 'Items edited', before === after ? 'pricing/notes only' : 'items/qty changed (' + o.items.length + ' line' + (o.items.length === 1 ? '' : 's') + ')');
    return 'Order updated successfully.';
  }
  function requestCancellation(id, justification) {
    var o = mustOrder(id);
    if (o.status === 'Cancellation Requested') fail('A cancellation has already been submitted for this order.');
    if (o.status === 'Pending Approval' || TERMINAL.indexOf(o.status) > -1) fail('This order cannot be cancelled at its current status (' + o.status + ').');
    o.preCancelStatus = o.status; o.status = 'Cancellation Requested'; o.cancelJustification = needText(justification, 'A justification is required.');
    return 'Cancellation request submitted. You will be notified once it has been reviewed.';
  }
  function resubmitOrder(id, note) {
    var o = mustOrder(id);
    if (o.status !== 'Needs Info') fail('This order is not awaiting more info.');
    o.status = 'Pending Approval';
    if (note && note.toString().trim()) comment(id, 'internal', 'Requestor resubmitted: ' + note.toString().trim());
    return 'Your request has been resubmitted to purchasing.';
  }

  /* ---------- comments, timeline, audit ---------- */
  function getOrderComments(id) {
    return S.comments.filter(function (c) { return c.orderId === id; }).sort(function (x, y) { return new Date(x.createdAt) - new Date(y.createdAt); });
  }
  function addOrderComment(id, body) { mustOrder(id); return comment(id, 'internal', needText(body, 'Comment cannot be empty.')); }
  function getOrderAudit(id) {
    return S.audit.filter(function (x) { return x.orderId === id; }).map(function (x) { return { actor: x.actor, action: x.action, detail: x.detail, at: x.at }; })
      .sort(function (x, y) { return new Date(x.at) - new Date(y.at); });
  }
  var TIMELINE_LABELS = { 'Priced': 'Priced by purchasing', 'Approved': 'Approved & signed', 'Split': 'Split into separate orders', 'Merged': 'Combined into another order',
    'Merged in': 'Other orders combined into this one', 'Item statuses updated': 'Item status updated', 'Reopened': 'Re-opened by purchasing' };
  function getOrderTimeline(id) {
    var out = [];
    getOrderAudit(id).forEach(function (x) {
      var label = TIMELINE_LABELS[x.action];
      if (x.action === 'Items edited') { if ((x.detail || '').indexOf('items/qty changed') === -1) return; label = 'Items updated by purchasing'; }
      if (label) out.push({ label: label, at: x.at });
    });
    return out;
  }

  /* ---------- management queue + search ---------- */
  function getMasterQueue() { return S.orders.filter(function (o) { return TERMINAL.indexOf(o.status) === -1; }).map(fullOrder).sort(byDateDesc); }
  function searchOrders(criteria) {
    criteria = criteria || {};
    var q = (criteria.q || '').toString().trim().toLowerCase(), st = (criteria.status || '').toString().trim(), sy = (criteria.schoolYear || '').toString().trim();
    if (!q && !st && !sy) return { orders: [], total: 0, truncated: false };
    var amt = /^\$?\s*[\d,]+(\.\d{1,2})?$/.test(q) ? parseFloat(q.replace(/[$,\s]/g, '')) : null;
    var hits = S.orders.filter(function (o) {
      if (st && o.status !== st) return false;
      if (sy && o.sy !== sy) return false;
      if (!q) return true;
      var hay = [o.id, nameOf(o.requestorEmail), o.requestorEmail, o.vendor, o.chargingDepartment, o.bank, o.payType, o.status, o.sy,
        o.items.map(function (it) { return it.name + ' ' + it.notes; }).join(' ')].join(' ').toLowerCase();
      if (hay.indexOf(q) > -1) return true;
      return amt != null && isPriced(o) && Math.abs(o.total - amt) < 0.005;
    }).sort(byDateDesc);
    return { orders: hits.slice(0, 300).map(fullOrder), total: hits.length, truncated: hits.length > 300 };
  }

  /* ---------- PIN ---------- */
  function getApproverSettings(_email) {
    var a = S.approver;
    return { email: ME, role: MY_ROLE, hasPin: !!a.pin, requireOnAccess: !!a.requireOnAccess, intervalMinutes: a.intervalMinutes || 0, amountThreshold: a.amountThreshold || 0, isBypass: !!a.isBypass };
  }
  function verifyApproverPin(pin) { if ((pin || '').toString() === S.approver.pin) return true; throw new Error('Invalid PIN'); }
  function updateApproverPIN(_email, oldPin, newPin) {
    if ((oldPin || '').toString() !== S.approver.pin) fail('Current PIN is incorrect');
    if (!newPin || newPin.toString().length < 4) fail('New PIN must be at least 4 digits');
    S.approver.pin = newPin.toString();
    return 'PIN updated successfully';
  }
  function updateApproverSettings(_email, pin, settings) {
    if ((pin || '').toString() !== S.approver.pin) fail('Current PIN is incorrect');
    settings = settings || {};
    S.approver.requireOnAccess = !!settings.requireOnAccess;
    S.approver.intervalMinutes = parseInt(settings.intervalMinutes, 10) || 0;
    S.approver.amountThreshold = parseFloat(settings.amountThreshold) || 0;
    return 'Settings updated successfully';
  }

  /* ---------- purchasing (Manager/Owner) and approver actions ---------- */
  function beckyUpdateOrder(id, poData, itemCosts) {
    var o = mustOrder(id);
    if (PRE_SIGN.indexOf(o.status) === -1) fail('This order can no longer be priced/sent (status: ' + o.status + '). Please reopen it.');
    poData = poData || {};
    var prev = { items: clone(o.items), adjustments: clone(o.adjustments) };
    applyCosts(o, itemCosts);
    o.adjustments = normAdjustments(poData.adjustments);
    var total = round2(grossTotal(o) - returnedAmount(o.id));
    if (total < 0) { o.items = prev.items; o.adjustments = prev.adjustments; fail('The order total is negative — a discount exceeds the item subtotal plus charges. Please adjust the discount.'); }
    o.status = 'Pending Signature'; o.vendor = (poData.vendor || '').toString(); o.bank = poData.bank || ''; o.payType = poData.payType || '';
    o.total = total; o.pricedAt = nowIso();
    audit(id, 'Priced', 'Total ' + money(total) + (o.vendor ? ' · ' + o.vendor : ''));
    return true;
  }
  function beckySendBack(id, note) {
    var o = mustOrder(id), n = needText(note, 'A note telling the requestor what is needed is required.');
    if (['Pending Approval', 'Needs Info'].indexOf(o.status) === -1) fail('This request can no longer be sent back here (status: ' + o.status + ').');
    o.status = 'Needs Info'; comment(id, 'public', n);
    return 'Sent back to the requestor for more info.';
  }
  function beckyRejectRequest(id, note) {
    var o = mustOrder(id), n = needText(note, 'A note to the requestor is required to reject.');
    if (['Pending Approval', 'Needs Info'].indexOf(o.status) === -1) fail('This request can no longer be rejected here (status: ' + o.status + ').');
    o.status = 'Rejected'; comment(id, 'public', n);
    return 'Order rejected. The requestor has been notified.';
  }
  function bryanHoldOrder(id, text) {
    var o = mustOrder(id), c = needText(text, 'A comment is required to hold an order.');
    if (o.status !== 'Pending Signature') fail('Only an order awaiting signature can be held (status: ' + o.status + ').');
    o.status = 'On Hold'; comment(id, 'internal', c);
    return 'Order placed on hold.';
  }
  function bryanRejectOrder(id, text) {
    var o = mustOrder(id), c = needText(text, 'A comment is required to reject an order.');
    if (AWAITING_SIGNATURE.indexOf(o.status) === -1) fail('This order is not awaiting signature (status: ' + o.status + ').');
    o.status = 'Under Review'; comment(id, 'internal', c);
    return 'Order rejected and sent for review.';
  }
  function beckyPublishRejection(id, note) {
    var o = mustOrder(id), n = needText(note, 'A summary note is required to publish the rejection.');
    if (o.status !== 'Under Review') fail('This order is not awaiting rejection review.');
    o.status = 'Rejected'; comment(id, 'public', n);
    return 'Rejection published to requestor.';
  }
  function reopenUnderReview(id) {
    var o = mustOrder(id);
    if (o.status !== 'Under Review') fail('Only an order under rejection review can be reopened.');
    o.status = 'Pending Signature'; audit(id, 'Reopened', 'rejection reversed → Pending Signature');
    return 'Order reopened and returned to the approver.';
  }
  function bryanVerifyAndSign(id, pin) {
    var o = mustOrder(id);
    if (AWAITING_SIGNATURE.indexOf(o.status) === -1) fail('This order is not awaiting signature (status: ' + o.status + ').');
    var typed = (pin || '').toString();
    // A typed PIN must be right; with none typed, the bypass list or the amount threshold decides (Code.js's rules).
    var ok = typed ? typed === S.approver.pin
      : (S.approver.isBypass || (S.approver.amountThreshold > 0 && (parseFloat(o.total) || 0) < S.approver.amountThreshold));
    if (!ok) fail('Invalid Approval PIN');
    o.status = 'Approved'; o.approvedAt = nowIso(); o.approvedBy = ME;
    audit(id, 'Approved', 'Total ' + money(o.total) + ' · signed by ' + ME);
    return 'Digital Signature Applied Successfully';
  }
  function approveOnBehalf(id, reason) {
    var r = needText(reason, 'A reason is required to approve on the approver\'s behalf.'), o = mustOrder(id);
    if (AWAITING_SIGNATURE.indexOf(o.status) === -1) fail('Only an order awaiting signature can be approved (status: ' + o.status + ').');
    o.status = 'Approved'; o.approvedAt = nowIso(); o.approvedBy = ME + ' (on behalf of approver)';
    audit(id, 'Approved', 'on approver\'s behalf by ' + ME + ' · ' + r);
    comment(id, 'internal', 'Approved on the approver\'s behalf by ' + ME + '.\nReason: ' + r);
    return 'Approved on the approver\'s behalf.';
  }
  function routeToBackupApprover(id, backup) {
    backup = (backup || '').toString().trim();
    if (!backup || backup.indexOf('@') === -1) fail('Please choose who to route this order to.');
    if (backup.toLowerCase() === ME.toLowerCase()) fail('You cannot route an order to yourself - use Auto-Approve instead.');
    var o = mustOrder(id);
    if (AWAITING_SIGNATURE.indexOf(o.status) === -1) fail('Only an order awaiting signature can be routed (status: ' + o.status + ').');
    o.assignedApprover = backup;
    var today = todayYmd(), live = S.delegations.some(function (d) { return d.delegateEmail.toLowerCase() === backup.toLowerCase() && !d.revoked && d.end >= today; });
    if (!live) { var end = new Date(); end.setDate(end.getDate() + 7); S.delegations.push({ id: 'DLG-' + Date.now(), delegateEmail: backup, grantedBy: ME, start: today, end: ymd(end), revoked: false }); }
    audit(id, 'Routed', 'signature routed to ' + backup + ' by ' + ME);
    comment(id, 'internal', 'Routed to backup approver ' + nameOf(backup) + ' (' + backup + ') for signature.');
    return { orderId: id, routedTo: backup };
  }
  function approveCancellation(id) {
    var o = mustOrder(id);
    if (o.status !== 'Cancellation Requested') fail('This order is not in Cancellation Requested status.');
    o.status = 'Cancelled';
    return 'Order cancellation confirmed.';
  }
  function denyCancellation(id) {
    var o = mustOrder(id);
    if (o.status !== 'Cancellation Requested') fail('This order is not in Cancellation Requested status.');
    var prior = o.preCancelStatus || 'Approved';
    o.status = prior; o.cancelJustification = ''; o.preCancelStatus = '';
    return 'Cancellation request denied. Order restored to: ' + prior + '.';
  }
  function splitOrder(id, groups) {
    var clean = (Array.isArray(groups) ? groups : []).map(function (g) { return Array.isArray(g) ? g.filter(Boolean) : []; }).filter(function (g) { return g.length; });
    if (clean.length < 2) fail('Splitting requires at least two non-empty groups.');
    var o = mustOrder(id);
    if (MERGEABLE.indexOf(o.status) === -1) fail('This order can no longer be split (status: ' + o.status + '). Please reopen it.');
    var lines = {}; o.items.forEach(function (it) { lines[it.lineId] = it; });
    var seen = {};
    clean.forEach(function (g) { g.forEach(function (l) { if (!lines[l]) fail('An item in the split is unknown or out of date. Please reopen the order and try again.'); if (seen[l]) fail('An item was assigned to more than one group. Please reopen and try again.'); seen[l] = 1; }); });
    if (Object.keys(seen).length !== o.items.length) fail('Every item must be assigned to exactly one group before splitting.');
    var letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', li = 0, children = [];
    clean.forEach(function (g) {
      while (byId(id + '-' + letters[li])) li++;
      var cid = id + '-' + letters[li++], vendor = '';
      g.forEach(function (l) { var s = storeFromItem(lines[l].name, lines[l].url); if (s) vendor = (vendor === '' ? s : (vendor === s ? s : '__mixed__')); });
      S.orders.push({
        id: cid, requestorEmail: o.requestorEmail, date: o.date, sy: o.sy, priority: o.priority, neededBy: o.neededBy, status: 'Pending Approval',
        approvedAt: '', approvedBy: '', cancelJustification: '', poPdfUrl: '', parentId: id, vendor: vendor === '__mixed__' ? '' : vendor, bank: '', payType: '',
        total: '', packingSummary: '', pricedAt: '', fulfillmentAt: '', closedAt: '', preCancelStatus: '', chargingDepartment: o.chargingDepartment,
        additionalNotify: o.additionalNotify, adjustments: [], assignedApprover: '',
        items: g.map(function (l, k) { var src = clone(lines[l]); src.lineId = cid + '-' + (k + 1); src.status = 'Pending'; src.fulfillNote = ''; return src; })
      });
      children.push(cid);
    });
    o.status = 'Split';
    comment(id, 'internal', 'Order split into ' + children.join(', ') + ' by ' + ME);
    audit(id, 'Split', 'into ' + children.join(', '));
    return { parentId: id, children: children };
  }
  function mergeOrders(targetId, sourceIds, chargingDepartment) {
    var tgt = mustOrder(targetId), seen = {}, sources = [];
    (Array.isArray(sourceIds) ? sourceIds : []).forEach(function (x) { var s = (x || '').toString().trim(); if (s && s !== targetId && !seen[s]) { seen[s] = 1; sources.push(s); } });
    if (!sources.length) fail('Select at least one other order to merge in.');
    [tgt].concat(sources.map(mustOrder)).forEach(function (o) {
      if (MERGEABLE.indexOf(o.status) === -1) fail('Order ' + o.id + ' can no longer be merged (status: ' + o.status + '). Please reopen and try again.');
      if (o.requestorEmail.toLowerCase() !== tgt.requestorEmail.toLowerCase()) fail('Only one requestor\'s orders can be merged together.');
    });
    var n = tgt.items.length, moved = 0;
    sources.forEach(function (sid) {
      var s = byId(sid);
      s.items.forEach(function (it) { var c = clone(it); c.lineId = targetId + '-' + (++n); tgt.items.push(c); moved++; });
      s.status = 'Merged'; s.parentId = targetId;
      comment(sid, 'internal', 'Merged into ' + targetId + ' by ' + ME);
      audit(sid, 'Merged', 'into ' + targetId);
    });
    if (!tgt.vendor) {
      var v = ''; tgt.items.forEach(function (it) { var s = storeFromItem(it.name, it.url); if (s) v = (v === '' ? s : (v === s ? s : '__mixed__')); });
      if (v && v !== '__mixed__') tgt.vendor = v;
    }
    if (chargingDepartment) tgt.chargingDepartment = chargingDepartment.toString().trim();
    if (isPriced(tgt)) recomputeTotal(tgt);
    comment(targetId, 'internal', 'Merged in ' + sources.join(', ') + ' by ' + ME);
    audit(targetId, 'Merged in', sources.join(', ') + ' (' + moved + ' item(s))');
    return { targetId: targetId, merged: sources, itemsMoved: moved };
  }
  function adjustOrderCost(id, itemCosts, adjustments, reason) {
    var o = mustOrder(id);
    if (['Approved', 'Fulfillment', 'Closed/Paid'].indexOf(o.status) === -1) fail('Costs can only be adjusted once an order is approved (status: ' + o.status + ').');
    var previousTotal = parseFloat(o.total) || 0, prev = { items: clone(o.items), adjustments: clone(o.adjustments) };
    applyCosts(o, itemCosts);
    o.adjustments = normAdjustments(adjustments);
    var newTotal = round2(grossTotal(o) - returnedAmount(id));
    if (newTotal < 0) { o.items = prev.items; o.adjustments = prev.adjustments; fail('The order total cannot be negative.'); }
    o.total = newTotal;
    var delta = round2(newTotal - previousTotal), r = (reason || '').toString().trim();
    audit(id, 'Cost adjusted', money(previousTotal) + ' → ' + money(newTotal) + (r ? ' · ' + r : ''));
    comment(id, 'internal', 'Cost adjusted: ' + money(previousTotal) + ' → ' + money(newTotal) + (r ? '\nReason: ' + r : ''));
    return { previousTotal: previousTotal, newTotal: newTotal, delta: delta, at: nowIso() };
  }
  function updateItemStatuses(id, updates) {
    if (!id || !Array.isArray(updates) || !updates.length) fail('Nothing to update.');
    var o = mustOrder(id), count = 0;
    updates.forEach(function (u) {
      o.items.forEach(function (it) {
        if (it.lineId !== u.lineId || it.status === 'Returned') return;
        var st = ITEM_STATUSES.indexOf(u.status) > -1 && u.status !== 'Returned' ? u.status : 'Pending';
        it.status = st; it.fulfillNote = (st === 'Delayed' || st === 'Backordered') ? (u.note || '').toString().trim() : '';
        count++;
      });
    });
    if (!count) fail('No matching items to update.');
    audit(id, 'Item statuses updated', count + ' item' + (count === 1 ? '' : 's'));
    return 'Item statuses updated (' + count + ' item' + (count === 1 ? '' : 's') + '). Requestor notified.';
  }
  function markOrderFulfilled(id) {
    var o = mustOrder(id);
    if (o.status !== 'Approved') fail('Only an Approved order can be moved to Fulfillment (currently: ' + o.status + ').');
    o.status = 'Fulfillment'; o.fulfillmentAt = nowIso();
    audit(id, 'Fulfillment started', 'marked by purchasing (no packing slip required)');
    return 'Order moved to Fulfillment.';
  }
  function markOrderClosed(id) {
    var o = mustOrder(id);
    if (o.status !== 'Fulfillment') fail('Order must be in Fulfillment status to be closed (currently: ' + o.status + ')');
    o.status = 'Closed/Paid'; o.closedAt = nowIso();
    return 'Order marked as Closed/Paid';
  }
  // PDFs and packets are generated in Drive by the real app; the demo has no Drive.
  function generatePOPDF(id) { mustOrder(id); return '#'; }
  function generateOrderPacket(id) { mustOrder(id); audit(id, 'Packet generated', 'PO + attachments'); return '#'; }

  /* ---------- documents ---------- */
  function getOrderDocuments(id) {
    return S.docs.filter(function (x) { return x.orderId === id; }).sort(function (x, y) { return new Date(y.uploadedAt) - new Date(x.uploadedAt); });
  }
  function uploadOrderDocument(id, category, base64, name, _mime) {
    if (!id) fail('Order ID required');
    if (!base64) fail('File data required');
    var prefix = DOC_CATEGORIES[category];
    if (!prefix) fail('Unknown document category: ' + category);
    var o = mustOrder(id);
    var doc = { docId: 'DOC-' + Date.now() + '-' + (S.seq++), orderId: id, category: category, driveName: id + '_' + prefix + '_' + (name || 'file'),
      originalName: name || 'file', fileUrl: '', uploadedBy: ME, uploadedAt: nowIso() };
    S.docs.push(doc);
    if (category === 'Packing List') {
      var n = S.docs.filter(function (x) { return x.orderId === id && x.category === 'Packing List'; }).length;
      o.packingSummary = n + ' packing list' + (n === 1 ? '' : 's');
      if (o.status === 'Approved') { o.status = 'Fulfillment'; o.fulfillmentAt = nowIso(); audit(id, 'Fulfillment started', 'packing list uploaded'); }
    }
    return { docId: doc.docId, category: category, fileUrl: doc.fileUrl, driveName: doc.driveName, originalName: doc.originalName };
  }
  function deleteOrderDocument(id, docId) {
    if (!id) fail('Order ID required.');
    if (!docId) fail('Document ID required.');
    var i = S.docs.findIndex(function (x) { return x.orderId === id && x.docId === docId; });
    if (i < 0) fail('That document is no longer on this order. Someone may have just deleted it, so close and reopen the order to refresh the list.');
    var d = S.docs.splice(i, 1)[0];
    audit(id, 'Document deleted', d.category + ': ' + d.originalName);
    return 'Deleted "' + d.originalName + '".';
  }
  function scanDriveForNewSlips() { return { scanned: S.docs.filter(function (x) { return x.category === 'Packing List'; }).length, registered: 0, errors: [] }; }

  /* ---------- returns ---------- */
  function getReturns(id) {
    return S.returns.filter(function (r) { return r.orderId === id; }).sort(function (x, y) { return new Date(y.at) - new Date(x.at); });
  }
  function recordReturn(id, lines, reason, doc) {
    if (!id) fail('Order ID required.');
    if (!Array.isArray(lines) || !lines.length) fail('Select at least one item to return.');
    var why = needText(reason, 'A return reason is required.'), o = mustOrder(id);
    if (['Approved', 'Fulfillment', 'Closed/Paid'].indexOf(o.status) === -1) fail('Items can only be returned once an order is approved (status: ' + o.status + ').');
    var rows = lines.map(function (l) {
      var it = o.items.filter(function (x) { return x.lineId === (l && l.lineId); })[0];
      if (!it) fail('An item in this return is no longer on the order. Please reopen and try again.');
      var qty = parseInt(l.qty, 10) || 0, prior = returnedQty(it.lineId);
      if (qty < 1) fail('Return quantity must be at least 1 for ' + it.name + '.');
      if (qty + prior > it.qty) fail('Cannot return ' + qty + ' of "' + it.name + '" — only ' + (it.qty - prior) + ' of ' + it.qty + ' remain unreturned.');
      var refund = (l.refund == null || l.refund === '') ? round2(qty * (parseFloat(it.unitCost) || 0)) : round2(parseFloat(l.refund) || 0);
      if (refund < 0) fail('Refund amount cannot be negative.');
      return { it: it, qty: qty, prior: prior, refund: refund };
    });
    var refundTotal = round2(rows.reduce(function (s, r) { return s + r.refund; }, 0));
    var after = round2(grossTotal(o) - returnedAmount(id) - refundTotal);
    if (after < 0) fail('That credit is more than the order total. Check the refund amount (order total would become $' + after.toFixed(2) + ').');
    if (doc && doc.fileBase64) uploadOrderDocument(id, 'Return Confirmation', doc.fileBase64, doc.fileName, doc.mimeType);
    var at = nowIso(), itemsReturned = 0;
    rows.forEach(function (r, k) {
      S.returns.push({ returnId: 'RET-' + id + '-' + Date.now() + '-' + (k + 1), orderId: id, lineId: r.it.lineId, item: r.it.name, qty: r.qty,
        unitCost: r.it.unitCost, refund: r.refund, reason: why, docUrl: '', by: ME, at: at });
      itemsReturned += r.qty;
      if (r.qty + r.prior >= r.it.qty) r.it.status = 'Returned';
    });
    var newTotal = recomputeTotal(o);
    var names = rows.map(function (r) { return r.qty + '× ' + r.it.name; }).join('; ');
    audit(id, 'Return recorded', names + ' — credit ' + money(refundTotal) + ' · new total ' + money(newTotal) + ' · ' + why);
    comment(id, 'internal', 'Return recorded: ' + names + '\nCredit: ' + money(refundTotal) + '\nOrder total now: ' + money(newTotal) + '\nReason: ' + why);
    return { orderId: id, itemsReturned: itemsReturned, refundTotal: refundTotal, newTotal: newTotal, at: at };
  }

  /* ---------- buy by vendor ---------- */
  function getBuyByVendor() {
    var groups = {};
    S.orders.forEach(function (o) {
      if (o.status !== 'Approved' && o.status !== 'Fulfillment') return;
      o.items.forEach(function (it) {
        if ((it.status || 'Pending') !== 'Pending') return;
        var vendor = storeFromItem(it.name, it.url) || o.vendor || 'Other / Unspecified';
        var g = groups[vendor] || (groups[vendor] = { vendor: vendor, items: [], itemCount: 0, totalQty: 0, estCost: 0 });
        g.items.push({ orderId: o.id, lineId: it.lineId, name: it.name, url: it.url, qty: it.qty, unitCost: parseFloat(it.unitCost) || 0,
          requestorEmail: o.requestorEmail, requestorName: nameOf(o.requestorEmail) });
        g.itemCount++; g.totalQty += parseInt(it.qty, 10) || 0; g.estCost = round2(g.estCost + it.qty * (parseFloat(it.unitCost) || 0));
      });
    });
    return Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (x, y) { return y.itemCount - x.itemCount; });
  }
  function markItemsOrdered(refs) {
    if (!Array.isArray(refs) || !refs.length) fail('No items selected.');
    var count = 0, orders = {};
    refs.forEach(function (r) {
      var o = r && byId(r.orderId);
      if (!o || (o.status !== 'Approved' && o.status !== 'Fulfillment')) return;
      o.items.forEach(function (it) { if (it.lineId === r.lineId) { it.status = 'Ordered'; it.fulfillNote = ''; count++; orders[o.id] = 1; } });
    });
    if (!count) fail('Nothing was marked — the selected items may no longer be on approved orders. Refresh and try again.');
    var n = Object.keys(orders).length;
    Object.keys(orders).forEach(function (oid) { audit(oid, 'Item statuses updated', 'marked Ordered from Buy by Vendor'); });
    return 'Marked ' + count + ' item' + (count === 1 ? '' : 's') + ' as Ordered across ' + n + ' order' + (n === 1 ? '' : 's') + '. Requestor' + (n === 1 ? '' : 's') + ' notified.';
  }

  /* ---------- sheet-table tabs ---------- */
  function getFullCatalog() { return S.catalog; }
  function getVendorList() { return S.vendors; }
  function getUserList() { return S.users; }
  function updateSheetData(tab, row, rowIndex) {
    var t = { Catalog_Items: S.catalog, Vendor_Suppliers: S.vendors, Users: S.users }[tab];
    if (!t) fail('Editing the "' + tab + '" tab is not allowed via this endpoint.');
    var i = parseInt(rowIndex, 10);
    if (!(i >= 1 && i < t.length) || !Array.isArray(row)) fail('Row not found.');
    t[i] = row.map(function (v, k) { var old = t[i][k]; if (typeof old === 'boolean') return isTrue(v); if (typeof old === 'number' && v !== '' && !isNaN(v)) return parseFloat(v); return v; });
    return 'Success';
  }

  /* ---------- email rules, departments, delegations ---------- */
  function getEmailRulesList() { return S.emailRules; }
  function updateEmailRules(updates) {
    (updates || []).forEach(function (u) {
      S.emailRules.forEach(function (r) {
        if (r.key !== u.key) return;
        r.notifyRequestor = u.notifyRequestor === true; r.notifyManager = u.notifyManager === true; r.notifyApprover = u.notifyApprover === true; r.notifyNotify = u.notifyNotify === true;
      });
    });
    return 'Email rules updated.';
  }
  function getDepartments(includeInactive) {
    return S.departments.filter(function (d) { return includeInactive || d.active; }).slice().sort(function (x, y) { return x.name.localeCompare(y.name); });
  }
  function getDepartmentStats() {
    var stats = {}, csy = csyRange();
    S.users.slice(1).forEach(function (r) { var d = (r[3] || '').toString().trim(); if (!d) return; (stats[d] = stats[d] || { userCount: 0, orderCount: 0, ytdSpend: 0 }).userCount++; });
    S.orders.forEach(function (o) {
      var t = new Date(o.date).getTime();
      if (t < csy.start || NON_SPEND.indexOf(o.status) > -1) return;
      var d = o.chargingDepartment || deptOf(o.requestorEmail); if (!d) return;
      var s = stats[d] = stats[d] || { userCount: 0, orderCount: 0, ytdSpend: 0 };
      s.orderCount++; s.ytdSpend = round2(s.ytdSpend + (parseFloat(o.total) || 0));
    });
    return stats;
  }
  function saveDepartment(p) {
    if (!p || !p.name) fail('Department name is required.');
    var rec = { name: p.name.toString().trim(), category: p.category || '', description: p.description || '', active: p.active !== false,
      headEmail: p.headEmail || '', budget: (p.budget != null && p.budget !== '') ? parseFloat(p.budget) : null, ouPath: p.ouPath || '', viewers: p.viewers || '' };
    var hit = S.departments.filter(function (d) { return d.name.toLowerCase() === rec.name.toLowerCase(); })[0];
    if (hit) { Object.keys(rec).forEach(function (k) { if (k !== 'name') hit[k] = rec[k]; }); return 'Department updated.'; }
    rec.createdAt = nowIso(); S.departments.push(rec);
    return 'Department created.';
  }
  function setDepartmentActive(name, active) {
    if (!name) fail('Department name required.');
    var hit = S.departments.filter(function (d) { return d.name === name; })[0];
    if (!hit) fail('Department not found: ' + name);
    hit.active = !!active;
    return active ? 'Department reactivated.' : 'Department deactivated.';
  }
  function syncFromGoogleAdmin() {
    var stamp = ymd(new Date()) + ' ' + p2(new Date().getHours()) + ':' + p2(new Date().getMinutes());
    S.users.slice(1).forEach(function (r) { r[12] = stamp; });
    var n = S.users.length - 1;
    return { added: 0, updated: n, deactivated: 0, departmentsCreated: 0, totalProcessed: n, syncedAt: nowIso() };
  }
  function delegationState(d) {
    var today = todayYmd();
    if (d.revoked) return 'Revoked';
    if (today > d.end) return 'Expired';
    if (today >= d.start) return 'Active';
    return 'Scheduled';
  }
  function getDelegations() {
    return S.delegations.map(function (d) {
      return { id: d.id, delegateEmail: d.delegateEmail, delegateName: nameOf(d.delegateEmail), grantedBy: d.grantedBy, start: d.start, end: d.end, state: delegationState(d) };
    }).sort(function (x, y) { return x.start < y.start ? 1 : (x.start > y.start ? -1 : 0); });
  }
  function addDelegation(email, start, end) {
    email = (email || '').toString().trim();
    if (!email) fail('Please choose a person to delegate to.');
    var s = (start || '').toString().slice(0, 10), e = (end || '').toString().slice(0, 10);
    if (!s || !e) fail('Please choose both a start and an end date.');
    if (e < s) fail('The end date must be on or after the start date.');
    if (e < todayYmd()) fail('The end date is in the past.');
    var d = { id: 'DLG-' + Date.now(), delegateEmail: email, grantedBy: ME, start: s, end: e, revoked: false };
    S.delegations.push(d);
    return { id: d.id, delegateEmail: email, delegateName: nameOf(email), start: s, end: e };
  }
  function revokeDelegation(id) {
    var d = S.delegations.filter(function (x) { return x.id === id; })[0];
    if (!d) fail('Delegation not found.');
    d.revoked = true;
    return 'Delegation revoked.';
  }

  /* ---------- team orders + saved views ---------- */
  function getTeamOrders(_email) {
    var acc = S.teamAccess, mgr = {}, head = {}, view = {};
    acc.asManager.forEach(function (e) { mgr[e.toLowerCase()] = 1; });
    acc.asHead.forEach(function (d) { head[d.toLowerCase()] = d; });
    acc.asViewer.forEach(function (d) { view[d.toLowerCase()] = d; });
    var orders = [];
    S.orders.forEach(function (o) {
      var dept = (o.chargingDepartment || deptOf(o.requestorEmail) || '').toLowerCase(), reasons = [];
      if (mgr[o.requestorEmail.toLowerCase()]) reasons.push('Manages requestor');
      if (dept && head[dept]) reasons.push('Heads ' + head[dept]);
      if (dept && view[dept]) reasons.push('Viewer of ' + view[dept]);
      if (!reasons.length) return;
      var f = fullOrder(o); f.total = o.total || 0; f.teamAccessReasons = reasons;
      orders.push(f);
    });
    return { orders: orders.sort(byDateDesc), access: { asManager: acc.asManager.slice(), asHead: acc.asHead.slice(), asViewer: acc.asViewer.slice(), hasAny: true } };
  }
  function getSavedViews(viewType) {
    var t = (viewType || 'analytics').toString();
    return S.savedViews.filter(function (v) { return (v.viewType || 'analytics') === t; }).sort(function (x, y) { return new Date(y.createdAt) - new Date(x.createdAt); });
  }
  function saveView(name, filters, viewType) {
    var t = (viewType || 'analytics').toString();
    if (['analytics', 'teamorders'].indexOf(t) === -1) fail('Unknown view type: ' + t);
    var n = needText(name, 'View name is required.');
    var v = { id: 'VIEW-' + Date.now() + '-' + (S.seq++), name: n, filters: filters || {}, createdAt: nowIso(), viewType: t };
    S.savedViews.push(v);
    return v;
  }
  function deleteSavedView(id) {
    var i = S.savedViews.findIndex(function (v) { return v.id === id; });
    if (i < 0) fail('View not found.');
    S.savedViews.splice(i, 1);
    return 'View deleted.';
  }

  /* ---------- analytics ---------- */
  function getAnalyticsScope() { return { access: true, full: true, departments: [] }; }
  function dateWindow(f) {
    var from = f.dateFrom ? new Date(f.dateFrom) : null, to = f.dateTo ? new Date(f.dateTo) : null;
    var m = f.schoolYear && /SY(\d{2})-(\d{2})/.exec(f.schoolYear);
    if (m) { from = new Date(2000 + parseInt(m[1], 10), 8, 1); to = new Date(2000 + parseInt(m[2], 10), 7, 31); }
    if (to) to.setHours(23, 59, 59, 999);
    return { from: from, to: to };
  }
  function lc(arr) { return (arr && arr.length) ? arr.map(function (s) { return (s || '').toString().trim().toLowerCase(); }) : null; }
  // One row per order with the fields every analytics reader keys on (Code.js reads the same columns).
  function analyticsRows() {
    return S.orders.map(function (o) {
      return { o: o, t: new Date(o.date), status: o.status, total: parseFloat(o.total) || 0, vendor: (o.vendor || '').trim() || '(No Vendor)',
        bank: (o.bank || '').trim() || '(No Bank)', payType: (o.payType || '').trim() || '(No Payment Type)', requestor: nameOf(o.requestorEmail), dept: effDept(o),
        cats: o.items.map(function (it) { return it.category || 'Custom'; }).filter(function (c, i, a) { return a.indexOf(c) === i; }) };
    });
  }
  function passes(r, f, win) {
    if (win.from && r.t < win.from) return false;
    if (win.to && r.t > win.to) return false;
    var fv = lc(f.vendors), fb = lc(f.banks), fp = lc(f.payTypes), fr = lc(f.requestors), fd = lc(f.departments), fs = lc(f.statuses), fc = lc(f.categories);
    if (fv && fv.indexOf(r.vendor.toLowerCase()) === -1) return false;
    if (fb && fb.indexOf(r.bank.toLowerCase()) === -1) return false;
    if (fp && fp.indexOf(r.payType.toLowerCase()) === -1) return false;
    if (fr && fr.indexOf(r.requestor.toLowerCase()) === -1) return false;
    if (fd && fd.indexOf(r.dept.toLowerCase()) === -1) return false;
    if (fs && fs.indexOf(r.status.toLowerCase()) === -1) return false;
    if (fc && !fc.some(function (c) { return r.cats.map(function (x) { return x.toLowerCase(); }).indexOf(c) > -1; })) return false;
    if (f.priorityOnly === true && !r.o.priority) return false;
    var min = (f.minAmount != null && f.minAmount !== '') ? parseFloat(f.minAmount) : null, max = (f.maxAmount != null && f.maxAmount !== '') ? parseFloat(f.maxAmount) : null;
    if (min != null && r.total < min) return false;
    if (max != null && r.total > max) return false;
    return true;
  }
  function sortedArr(obj, key) { return Object.keys(obj).map(function (k) { var x = {}; x[key] = k; x.total = round2(obj[k]); return x; }).sort(function (x, y) { return y.total - x.total; }); }
  function monthKey(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1); }

  function getAnalytics(filters) {
    var f = filters || {}, win = dateWindow(f), rows = analyticsRows();
    var opt = { vendors: {}, departments: {}, requestors: {}, categories: {}, banks: {}, payTypes: {}, statuses: {}, schoolYears: {} };
    rows.forEach(function (r) {
      if (r.o.vendor) opt.vendors[r.o.vendor] = 1; if (r.o.bank) opt.banks[r.o.bank] = 1; if (r.o.payType) opt.payTypes[r.o.payType] = 1;
      opt.statuses[r.status] = 1; opt.schoolYears[r.o.sy] = 1; opt.requestors[r.requestor] = 1; opt.departments[deptOf(r.o.requestorEmail) || 'Unassigned'] = 1;
      r.cats.forEach(function (c) { opt.categories[c] = 1; });
    });
    var totalSpend = 0, orderCount = 0, cancelled = 0, open = 0, spendOrders = 0, largest = 0;
    var V = {}, Dp = {}, C = {}, B = {}, P = {}, R = {}, items = {}, status = {}, monthly = {}, dxc = {};
    var buckets = { '<$50': 0, '$50–$200': 0, '$200–$1k': 0, '$1k–$5k': 0, '$5k+': 0 };
    rows.forEach(function (r) {
      if (!passes(r, f, win)) return;
      orderCount++; status[r.status] = (status[r.status] || 0) + 1;
      if (r.status === 'Cancelled') { cancelled++; return; }
      if (NON_SPEND.indexOf(r.status) > -1) return;
      var t = r.total;
      totalSpend += t; if (t > 0) { spendOrders++; if (t > largest) largest = t; }
      if (r.vendor !== '(No Vendor)') V[r.vendor] = (V[r.vendor] || 0) + t;
      B[r.bank] = (B[r.bank] || 0) + t; P[r.payType] = (P[r.payType] || 0) + t; R[r.requestor] = (R[r.requestor] || 0) + t; Dp[r.dept] = (Dp[r.dept] || 0) + t;
      var sub = subtotal(r.o);
      r.o.items.forEach(function (it) {
        var line = (parseInt(it.qty, 10) || 0) * (parseFloat(it.unitCost) || 0), share = sub > 0 ? t * line / sub : t / r.o.items.length, cat = it.category || 'Custom';
        C[cat] = (C[cat] || 0) + share;
        var e = items[it.name] || (items[it.name] = { qty: 0, spend: 0 }); e.qty += parseInt(it.qty, 10) || 0; e.spend += share;
        (dxc[r.dept] = dxc[r.dept] || {})[cat] = ((dxc[r.dept] || {})[cat] || 0) + share;
      });
      var mk = monthKey(r.t); monthly[mk] = (monthly[mk] || 0) + t;
      if (r.status !== 'Closed/Paid') open++;
      if (t > 0) buckets[t < 50 ? '<$50' : t < 200 ? '$50–$200' : t < 1000 ? '$200–$1k' : t < 5000 ? '$1k–$5k' : '$5k+']++;
    });
    var vendorArr = sortedArr(V, 'vendor'), running = 0;
    var dxDepts = Object.keys(dxc).sort(), catSet = {};
    dxDepts.forEach(function (d) { Object.keys(dxc[d]).forEach(function (c) { catSet[c] = 1; }); });
    var dxCats = Object.keys(catSet).sort();
    return {
      totalSpend: round2(totalSpend), orderCount: orderCount, avgOrder: spendOrders ? round2(totalSpend / spendOrders) : 0,
      cancelRate: orderCount ? round2(cancelled / orderCount * 100) : 0, openCount: open, largestOrder: round2(largest),
      monthlyTrend: Object.keys(monthly).sort().map(function (k) { return { month: k, spend: round2(monthly[k]) }; }),
      statusBreakdown: Object.keys(status).map(function (s) { return { status: s, count: status[s] }; }).sort(function (x, y) { return y.count - x.count; }),
      groupedBy: { vendor: vendorArr.slice(0, 15), department: sortedArr(Dp, 'department'), category: sortedArr(C, 'category'), bank: sortedArr(B, 'bank'),
        payType: sortedArr(P, 'payType'), requestor: sortedArr(R, 'requestor').slice(0, 15) },
      topItems: Object.keys(items).map(function (n) { return { name: n, qty: items[n].qty, spend: round2(items[n].spend) }; }).sort(function (x, y) { return y.spend - x.spend; }).slice(0, 15),
      paretoVendors: vendorArr.map(function (v) { running += v.total; return { vendor: v.vendor, total: v.total, cumulative: round2(running), cumulativePct: totalSpend > 0 ? round2(running / totalSpend * 100) : 0 }; }),
      sizeDistribution: Object.keys(buckets).map(function (b) { return { bucket: b, count: buckets[b] }; }),
      deptByCategory: { departments: dxDepts, categories: dxCats, matrix: dxDepts.map(function (d) { return dxCats.map(function (c) { return round2(dxc[d][c] || 0); }); }) },
      filterOptions: { vendors: Object.keys(opt.vendors).sort(), departments: Object.keys(opt.departments).sort(), requestors: Object.keys(opt.requestors).sort(),
        categories: Object.keys(opt.categories).sort(), banks: Object.keys(opt.banks).sort(), payTypes: Object.keys(opt.payTypes).sort(),
        statuses: Object.keys(opt.statuses).sort(), schoolYears: Object.keys(opt.schoolYears).sort().reverse() }
    };
  }

  function daysBetween(x, y) { return (!x || !y) ? null : (new Date(y) - new Date(x)) / DAY; }
  function getProcessingMetrics(filters) {
    var f = filters || {}, win = dateWindow(f);
    var rows = analyticsRows().filter(function (r) { return passes(r, f, win); });
    var active = rows.filter(function (r) { return ANALYTICS_EXCLUDE.indexOf(r.status) === -1; });
    function avg(a, b) {
      var v = active.map(function (r) { return daysBetween(r.o[a], r.o[b]); }).filter(function (x) { return x != null && x >= 0; });
      return v.length ? round2(v.reduce(function (s, x) { return s + x; }, 0) / v.length) : 0;
    }
    var first = active.length || 1;
    var funnel = [['Submitted', 'date'], ['Priced', 'pricedAt'], ['Approved', 'approvedAt'], ['Fulfillment', 'fulfillmentAt'], ['Closed', 'closedAt']].map(function (s) {
      var c = active.filter(function (r) { return !!r.o[s[1]]; }).length;
      return { stage: s[0], count: c, pct: Math.round(c / first * 100) };
    });
    var openMap = {};
    rows.filter(function (r) { return TERMINAL.indexOf(r.status) === -1; }).forEach(function (r) {
      var e = openMap[r.status] || (openMap[r.status] = { status: r.status, count: 0, total: 0 }); e.count++; e.total = round2(e.total + r.total);
    });
    var now = Date.now();
    var stale = rows.filter(function (r) { return TERMINAL.indexOf(r.status) === -1; }).map(function (r) {
      var since = r.o.fulfillmentAt || r.o.approvedAt || r.o.pricedAt || r.o.date;
      return { id: r.o.id, status: r.status, daysInStatus: Math.floor((now - new Date(since)) / DAY), requestor: r.requestor, department: r.dept, vendor: r.o.vendor || '—', total: r.total };
    }).filter(function (x) { return x.daysInStatus > 14; }).sort(function (x, y) { return y.daysInStatus - x.daysInStatus; });
    var closed = active.filter(function (r) { return !!r.o.closedAt; });
    function cycle(keyFn, label) {
      var m = {};
      closed.forEach(function (r) { var k = keyFn(r); if (!k) return; var e = m[k] || (m[k] = { count: 0, sum: 0 }); e.count++; e.sum += daysBetween(r.o.date, r.o.closedAt) || 0; });
      return Object.keys(m).map(function (k) { var x = { count: m[k].count, avgDays: round2(m[k].sum / m[k].count) }; x[label] = k; return x; }).sort(function (x, y) { return y.avgDays - x.avgDays; });
    }
    function cancels(keyFn, label) {
      var m = {};
      rows.forEach(function (r) { var k = keyFn(r); if (!k) return; var e = m[k] || (m[k] = { total: 0, cancelled: 0 }); e.total++; if (r.status === 'Cancelled' || r.status === 'Rejected') e.cancelled++; });
      return Object.keys(m).map(function (k) { var x = { total: m[k].total, cancelled: m[k].cancelled, rate: Math.round(m[k].cancelled / m[k].total * 100) }; x[label] = k; return x; });
    }
    return {
      avgSubmToPriced: avg('date', 'pricedAt'), avgPricedToApproved: avg('pricedAt', 'approvedAt'), avgApprovedToFulfill: avg('approvedAt', 'fulfillmentAt'),
      avgFulfillToClosed: avg('fulfillmentAt', 'closedAt'), avgTotalCycle: avg('date', 'closedAt'),
      funnel: funnel, outstandingByStatus: Object.keys(openMap).map(function (k) { return openMap[k]; }), staleOrders: stale,
      cycleByDepartment: cycle(function (r) { return r.dept; }, 'department'), cycleByVendor: cycle(function (r) { return r.o.vendor; }, 'vendor'),
      cycleByRequestor: cycle(function (r) { return r.requestor; }, 'requestor'),
      cancelByDepartment: cancels(function (r) { return r.dept; }, 'department'), cancelByCategory: cancels(function (r) { return r.cats[0]; }, 'category')
    };
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function getTrendsMetrics(filters) {
    var f = filters || {}, win = dateWindow(f);
    var noDate = { dateFrom: null, dateTo: null, schoolYear: null };
    var fNoDate = Object.assign({}, f, noDate);
    var spendRows = analyticsRows().filter(function (r) { return NON_SPEND.indexOf(r.status) === -1 && passes(r, fNoDate, {}); });
    var hasPrior = !!(win.from && win.to);
    var from = win.from || (function () { var d = new Date(); return new Date(d.getFullYear() - 1, d.getMonth() + 1, 1); })();
    var to = win.to || new Date();
    var keys = [], labels = [], cur = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cur <= to && keys.length < 24) { keys.push(monthKey(cur)); labels.push(MONTHS[cur.getMonth()] + (keys.length === 1 || cur.getMonth() === 0 ? ' ' + String(cur.getFullYear()).slice(2) : '')); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
    function sumMonth(k) { return round2(spendRows.filter(function (r) { return monthKey(r.t) === k; }).reduce(function (s, r) { return s + r.total; }, 0)); }
    function priorKey(k) { var y = +k.slice(0, 4) - 1; return y + k.slice(4); }
    var current = keys.map(sumMonth), prior = keys.map(function (k) { return sumMonth(priorKey(k)); });
    var cc = [], cp = [], rc = 0, rp = 0;
    current.forEach(function (v, i) { rc += v; rp += prior[i]; cc.push(round2(rc)); cp.push(round2(rp)); });
    var csy = csyRange(), rowsHM = [];
    [csy.startYear - 1, csy.startYear].forEach(function (y) {
      var cells = [];
      for (var i = 0; i < 12; i++) { var d = new Date(y, 8 + i, 1); cells.push({ month: MONTHS[d.getMonth()], monthKey: monthKey(d), spend: sumMonth(monthKey(d)) }); }
      rowsHM.push({ label: 'SY' + p2(y % 100) + '-' + p2((y + 1) % 100), cells: cells });
    });
    var maxSpend = 0; rowsHM.forEach(function (r) { r.cells.forEach(function (c) { if (c.spend > maxSpend) maxSpend = c.spend; }); });
    var inWin = spendRows.filter(function (r) { return (!win.from || r.t >= win.from) && (!win.to || r.t <= win.to); });
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], dow = DOW.map(function (d) { return { day: d, count: 0, spend: 0 }; });
    inWin.forEach(function (r) { var e = dow[r.t.getDay()]; e.count++; e.spend = round2(e.spend + r.total); });
    var thisYear = new Date().getFullYear(), years = [];
    for (var y = thisYear - 2; y <= thisYear; y++) {
      years.push({ year: String(y), spend: [0, 1, 2, 3].map(function (q) {
        return round2(spendRows.filter(function (r) { return r.t.getFullYear() === y && Math.floor(r.t.getMonth() / 3) === q; }).reduce(function (s, r) { return s + r.total; }, 0));
      }) });
    }
    var deptTot = {};
    inWin.forEach(function (r) { deptTot[r.dept] = (deptTot[r.dept] || 0) + r.total; });
    var depts = Object.keys(deptTot).sort(function (x, y) { return deptTot[y] - deptTot[x]; }).slice(0, 8).map(function (dn) {
      return { department: dn, total: round2(deptTot[dn]), monthlySpend: keys.map(function (k) {
        return round2(spendRows.filter(function (r) { return r.dept === dn && monthKey(r.t) === k; }).reduce(function (s, r) { return s + r.total; }, 0)); }) };
    });
    var vc = [];
    if (hasPrior) {
      var pf = new Date(win.from.getFullYear() - 1, win.from.getMonth(), win.from.getDate()), pt = new Date(win.to.getFullYear() - 1, win.to.getMonth(), win.to.getDate(), 23, 59, 59);
      var curV = {}, priV = {};
      spendRows.forEach(function (r) {
        if (r.vendor === '(No Vendor)') return;
        if (r.t >= win.from && r.t <= win.to) curV[r.vendor] = (curV[r.vendor] || 0) + r.total;
        if (r.t >= pf && r.t <= pt) priV[r.vendor] = (priV[r.vendor] || 0) + r.total;
      });
      Object.keys(Object.assign({}, curV, priV)).forEach(function (v) {
        var c = round2(curV[v] || 0), p = round2(priV[v] || 0);
        vc.push({ vendor: v, prior: p, current: c, change: round2(c - p), pctChange: p ? round2((c - p) / p * 100) : null });
      });
      vc.sort(function (x, y) { return Math.abs(y.change) - Math.abs(x.change); });
    }
    return {
      hasPriorPeriod: hasPrior,
      monthlyCurrentVsPrior: { months: labels, current: current, prior: prior },
      cumulativeCurrentVsPrior: { months: labels, current: cc, prior: cp },
      heatmap: { rows: rowsHM, maxSpend: round2(maxSpend) },
      dayOfWeek: dow,
      quarterlyComparison: { quarters: ['Q1', 'Q2', 'Q3', 'Q4'], years: years },
      deptTrend: { months: labels, departments: depts },
      vendorChange: vc.slice(0, 15)
    };
  }

  function getVendorIntelligence() {
    var csy = csyRange(), V = {};
    S.orders.forEach(function (o) {
      if (ANALYTICS_EXCLUDE.indexOf(o.status) > -1 || !(o.vendor || '').trim()) return;
      var v = V[o.vendor] || (V[o.vendor] = { vendor: o.vendor, orders: 0, knownSpend: 0, firstT: null, lastT: null, items: {} }), t = new Date(o.date).getTime(), total = parseFloat(o.total);
      v.orders++; if (!isNaN(total) && total > 0) v.knownSpend += total;
      if (v.firstT === null || t < v.firstT) v.firstT = t; if (v.lastT === null || t > v.lastT) v.lastT = t;
      o.items.forEach(function (it) { v.items[it.name] = (v.items[it.name] || 0) + 1; });
    });
    var vendors = Object.keys(V).map(function (k) {
      var v = V[k], active = v.lastT >= csy.start, fresh = v.firstT >= csy.start;
      return { vendor: v.vendor, orders: v.orders, knownSpend: round2(v.knownSpend), firstUsed: new Date(v.firstT).toISOString(), lastUsed: new Date(v.lastT).toISOString(),
        status: active ? 'Active' : 'Dormant', activeThisSy: active, newThisSy: fresh,
        topItems: Object.keys(v.items).sort(function (x, y) { return v.items[y] - v.items[x]; }).slice(0, 3).join(', ') };
    }).sort(function (x, y) { return y.orders - x.orders; });
    return {
      vendors: vendors,
      summary: { totalVendors: vendors.length, activeThisSy: vendors.filter(function (v) { return v.activeThisSy; }).length,
        dormant: vendors.filter(function (v) { return !v.activeThisSy; }).length, newThisSy: vendors.filter(function (v) { return v.newThisSy; }).length },
      topByOrders: vendors.slice(0, 15).map(function (v) { return { vendor: v.vendor, orders: v.orders }; })
    };
  }
  function getSchoolYearOverview() {
    var by = {};
    S.orders.forEach(function (o) {
      if (ANALYTICS_EXCLUDE.indexOf(o.status) > -1) return;
      var y = by[o.sy] || (by[o.sy] = { sy: o.sy, orders: 0, spend: 0 }), t = parseFloat(o.total);
      y.orders++; if (!isNaN(t) && t > 0) y.spend = round2(y.spend + t);
    });
    var years = Object.keys(by).sort().map(function (k) { return by[k]; }), busiest = '', n = -1, tot = 0, sp = 0;
    years.forEach(function (y) { tot += y.orders; sp += y.spend; if (y.orders > n) { n = y.orders; busiest = y.sy; } });
    return { years: years, summary: { totalOrders: tot, totalKnownSpend: round2(sp), busiestSy: busiest } };
  }
  function getDepartmentBudgets() {
    var csy = csyRange(), spent = {};
    S.orders.forEach(function (o) {
      var t = new Date(o.date).getTime(), total = parseFloat(o.total);
      if (NON_SPEND.indexOf(o.status) > -1 || t < csy.start || t > csy.end || isNaN(total) || total <= 0) return;
      var d = (o.chargingDepartment || deptOf(o.requestorEmail) || '').toLowerCase(); if (d) spent[d] = (spent[d] || 0) + total;
    });
    var rows = [], tb = 0, ts = 0, over = 0;
    S.departments.filter(function (d) { return d.active; }).forEach(function (d) {
      var budget = parseFloat(d.budget) || 0, s = round2(spent[d.name.toLowerCase()] || 0);
      tb += budget; ts += s; if (budget > 0 && s > budget) over++;
      rows.push({ department: d.name, budget: budget, spent: s, remaining: round2(budget - s), pctUsed: budget > 0 ? Math.round(s / budget * 1000) / 10 : null });
    });
    rows.sort(function (x, y) { return (y.pctUsed || 0) - (x.pctUsed || 0); });
    return { departments: rows, summary: { totalBudget: round2(tb), totalSpent: round2(ts), overCount: over }, currentSy: 'SY' + p2(csy.startYear % 100) + '-' + p2((csy.startYear + 1) % 100) };
  }
  function normItem(name) {
    var s = (name || '').toString().trim(), dash = s.indexOf(' - ');
    if (dash > 0 && dash < 30) s = s.substring(dash + 3);
    return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim();
  }
  function getReorderCandidates() {
    var acc = {};
    S.orders.forEach(function (o) {
      if (ANALYTICS_EXCLUDE.indexOf(o.status) > -1) return;
      var t = new Date(o.date).getTime();
      o.items.forEach(function (it) {
        var k = normItem(it.name); if (!k) return;
        var a = acc[k] || (acc[k] = { names: {}, times: 0, qty: 0, reqs: {}, vendors: {}, lastT: null });
        a.names[it.name] = (a.names[it.name] || 0) + 1; a.times++; a.qty += parseInt(it.qty, 10) || 0; a.reqs[o.requestorEmail] = 1;
        if (o.vendor) a.vendors[o.vendor] = 1; if (a.lastT === null || t > a.lastT) a.lastT = t;
      });
    });
    var rows = Object.keys(acc).map(function (k) {
      var a = acc[k];
      return { item: Object.keys(a.names).sort(function (x, y) { return a.names[y] - a.names[x]; })[0], timesOrdered: a.times, totalQty: a.qty,
        requestors: Object.keys(a.reqs).length, vendors: Object.keys(a.vendors).length, lastOrdered: new Date(a.lastT).toISOString() };
    }).sort(function (x, y) { return y.timesOrdered - x.timesOrdered; });
    return { items: rows.slice(0, 150), topByCount: rows.slice(0, 15).map(function (r) { return { item: r.item, count: r.timesOrdered }; }), truncated: rows.length > 150 };
  }
  function getFinancialSummary() {
    var charges = 0, discounts = 0, byLabel = {}, byPay = {}, byBank = {};
    S.orders.forEach(function (o) {
      if (NON_SPEND.indexOf(o.status) > -1) return;
      var total = parseFloat(o.total);
      if (!isNaN(total) && total > 0) {
        var pay = (o.payType || '').trim() || '(unspecified)', bank = (o.bank || '').trim() || '(unspecified)';
        byPay[pay] = (byPay[pay] || 0) + total; byBank[bank] = (byBank[bank] || 0) + total;
      }
      var sub = subtotal(o);
      (o.adjustments || []).forEach(function (x) {
        var amt = adjAmount(x, sub), label = (x.label || (x.type === 'discount' ? 'Discount' : 'Charge')).toString().trim() || 'Charge';
        if (x.type === 'discount') { discounts += amt; byLabel[label] = (byLabel[label] || 0) - amt; } else { charges += amt; byLabel[label] = (byLabel[label] || 0) + amt; }
      });
    });
    function amounts(obj, key) { return Object.keys(obj).map(function (k) { var x = {}; x[key] = k; x.amount = round2(obj[k]); return x; }).sort(function (x, y) { return Math.abs(y.amount) - Math.abs(x.amount); }); }
    function spends(obj, key) { return Object.keys(obj).map(function (k) { var x = {}; x[key] = k; x.spend = round2(obj[k]); return x; }).sort(function (x, y) { return y.spend - x.spend; }); }
    return { totalCharges: round2(charges), totalDiscounts: round2(discounts), netAdjustments: round2(charges - discounts),
      byLabel: amounts(byLabel, 'label'), byPayType: spends(byPay, 'payType'), byBank: spends(byBank, 'bank') };
  }
  function getReturnsSummary() {
    var byV = {}, byR = {}, byM = {}, items = [], total = 0, n = 0, qty = 0;
    S.returns.forEach(function (r) {
      var o = byId(r.orderId); if (!o) return;
      var v = (o.vendor || '').trim() || '(No Vendor)', who = nameOf(o.requestorEmail), refund = parseFloat(r.refund) || 0, mk = monthKey(new Date(r.at));
      total += refund; n++; qty += parseInt(r.qty, 10) || 0;
      byV[v] = round2((byV[v] || 0) + refund); byR[who] = round2((byR[who] || 0) + refund); byM[mk] = round2((byM[mk] || 0) + refund);
      items.push({ orderId: r.orderId, item: r.item, qty: r.qty, refund: round2(refund), reason: r.reason, vendor: v, requestor: who, at: r.at, docUrl: r.docUrl });
    });
    function arr(obj, key) { return Object.keys(obj).map(function (k) { var x = {}; x[key] = k; x.refund = obj[k]; return x; }).sort(function (a2, b2) { return b2.refund - a2.refund; }); }
    items.sort(function (x, y) { return new Date(y.at) - new Date(x.at); });
    return { totalRefunded: round2(total), returnCount: n, itemCount: qty, byVendor: arr(byV, 'vendor'), byRequestor: arr(byR, 'requestor'),
      byMonth: Object.keys(byM).sort().map(function (k) { return { month: k, refund: byM[k] }; }), items: items.slice(0, 300) };
  }
  function generateAnalyticsReportPDF(payload) { if (!payload) fail('Report payload required'); return '#'; }
  function markWizardSeen() { return true; }

  /* ---------- the backend object ---------- */
  var API = {
    getBootstrapData: getBootstrapData, getCatalogItems: getCatalogItems, getUserAvailableDepts: getUserAvailableDepts, getActiveStaffForPicker: getActiveStaffForPicker,
    submitOrder: submitOrder, getUserOrderHistory: getUserOrderHistory, cancelOrder: cancelOrder, editOrder: editOrder,
    requestCancellation: requestCancellation, resubmitOrder: resubmitOrder,
    getOrderComments: getOrderComments, addOrderComment: addOrderComment, getOrderTimeline: getOrderTimeline, getOrderAudit: getOrderAudit,
    getMasterQueue: getMasterQueue, searchOrders: searchOrders,
    getApproverSettings: getApproverSettings, verifyApproverPin: verifyApproverPin, updateApproverPIN: updateApproverPIN, updateApproverSettings: updateApproverSettings,
    beckyUpdateOrder: beckyUpdateOrder, beckySendBack: beckySendBack, beckyRejectRequest: beckyRejectRequest, beckyPublishRejection: beckyPublishRejection,
    reopenUnderReview: reopenUnderReview, bryanVerifyAndSign: bryanVerifyAndSign, bryanHoldOrder: bryanHoldOrder, bryanRejectOrder: bryanRejectOrder,
    approveCancellation: approveCancellation, denyCancellation: denyCancellation, routeToBackupApprover: routeToBackupApprover, approveOnBehalf: approveOnBehalf,
    splitOrder: splitOrder, mergeOrders: mergeOrders, adjustOrderCost: adjustOrderCost, updateItemStatuses: updateItemStatuses,
    markOrderFulfilled: markOrderFulfilled, markOrderClosed: markOrderClosed, generatePOPDF: generatePOPDF, generateOrderPacket: generateOrderPacket,
    getOrderDocuments: getOrderDocuments, uploadOrderDocument: uploadOrderDocument, deleteOrderDocument: deleteOrderDocument, scanDriveForNewSlips: scanDriveForNewSlips,
    getReturns: getReturns, recordReturn: recordReturn, getBuyByVendor: getBuyByVendor, markItemsOrdered: markItemsOrdered,
    getFullCatalog: getFullCatalog, getVendorList: getVendorList, getUserList: getUserList, updateSheetData: updateSheetData,
    getEmailRulesList: getEmailRulesList, updateEmailRules: updateEmailRules,
    getDepartments: getDepartments, getDepartmentStats: getDepartmentStats, saveDepartment: saveDepartment, setDepartmentActive: setDepartmentActive, syncFromGoogleAdmin: syncFromGoogleAdmin,
    getDelegations: getDelegations, addDelegation: addDelegation, revokeDelegation: revokeDelegation,
    getTeamOrders: getTeamOrders, getSavedViews: getSavedViews, saveView: saveView, deleteSavedView: deleteSavedView,
    getAnalyticsScope: getAnalyticsScope, getAnalytics: getAnalytics, getProcessingMetrics: getProcessingMetrics, getTrendsMetrics: getTrendsMetrics,
    getVendorIntelligence: getVendorIntelligence, getSchoolYearOverview: getSchoolYearOverview, getDepartmentBudgets: getDepartmentBudgets,
    getReorderCandidates: getReorderCandidates, getFinancialSummary: getFinancialSummary, getReturnsSummary: getReturnsSummary,
    generateAnalyticsReportPDF: generateAnalyticsReportPDF, markWizardSeen: markWizardSeen
  };

  S = load() || seed();
  save();

  // Every method returns a copy (the page never holds a live reference to state) and persists what it changed.
  var backend = {};
  Object.keys(API).forEach(function (name) {
    backend[name] = function () { var r = API[name].apply(null, arguments); save(); return clone(r); };
  });
  window.MOCK_BACKEND = backend;
  window.PURCHASING_DEMO = {
    reset: function () { S = seed(); save(); },
    shiftDays: SHIFT_DAYS
  };
})();
