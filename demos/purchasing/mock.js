/* mock.js — HCS Procurement / Purchasing demo backend.

   Implements the real app's google.script.run server functions in the browser.
   The client calls named methods directly (e.g. google.script.run.getMasterQueue());
   the gsr-shim resolves each name to window.MOCK_BACKEND[name]. MOCK_BACKEND is a
   Proxy: the CORE functions below are implemented faithfully so the app boots and
   the key tabs (New Order, Order History, Management queue, Analytics) work; ANY
   other server function name resolves to a benign stub returning [] (an empty
   list/feed). See the bottom of this file for the list of stubbed functions.

   State is in memory: submitOrder() pushes a new order into ORDERS, so a fresh
   submission then shows up in Order History and the analytics recompute from it.
   Every dollar figure across history, the management queue, and all three
   analytics sub-tabs is derived from the single ORDERS list in data.js, so the
   views are internally consistent. */
window.MOCK_BACKEND = (function () {
  'use strict';
  var D = window.PURCHASING_DATA;
  var ORDERS = D.orders.map(cloneOrder);
  var seq = 4200;

  // ---- helpers ----------------------------------------------------------
  function cloneOrder(o) { return JSON.parse(JSON.stringify(o)); }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function orderTotal(o) {
    return round2((o.items || []).reduce(function (s, it) {
      return s + (parseFloat(it.unitCost) || 0) * (parseInt(it.qty, 10) || 0);
    }, 0));
  }
  function catOf(dept) { return D.deptCategory[dept] || 'Other'; }
  function isCancelled(o) { return o.status === 'Cancelled' || o.status === 'Rejected'; }
  var CLOSED = { 'Closed/Paid': 1 };
  function isOpen(o) { return !isCancelled(o) && !CLOSED[o.status]; }
  function monthKey(iso) { return String(iso || '').slice(0, 7); }
  function daysBetween(a, b) {
    if (!a || !b) return null;
    return round2((new Date(b) - new Date(a)) / 86400000);
  }
  function byDateDesc(a, b) { return String(b.date).localeCompare(String(a.date)); }

  // ---- CORE: catalog / departments / staff / approver ------------------
  function getCatalogItems() {
    return { office: D.catalog.office.slice(), furniture: D.catalog.furniture.slice() };
  }
  function getUserAvailableDepts(_email) {
    return {
      primary: D.depts.primary,
      alternates: D.depts.alternates.slice(),
      allActive: D.depts.allActive.slice()
    };
  }
  function getActiveStaffForPicker() {
    return D.staff.map(function (s) {
      return { email: s.email, name: s.name, dept: s.dept, inMyDepts: !!s.inMyDepts };
    });
  }
  function getApproverSettings(email) {
    var a = D.approverSettings;
    return {
      email: email || D.currentUser.email, role: a.role, hasPin: a.hasPin,
      requireOnAccess: a.requireOnAccess, intervalMinutes: a.intervalMinutes,
      amountThreshold: a.amountThreshold, isBypass: a.isBypass
    };
  }

  // ---- CORE: order history (current user) ------------------------------
  function historyItem(it) {
    return {
      name: it.name, qty: it.qty, status: it.status || null, url: it.url || '',
      notes: it.notes || '', attachmentUrl: it.attachmentUrl || '',
      attachmentFileName: it.attachmentFileName || ''
    };
  }
  function getUserOrderHistory(email) {
    email = (email || D.currentUser.email).toLowerCase();
    return ORDERS.filter(function (o) { return (o.requestorEmail || '').toLowerCase() === email; })
      .slice().sort(byDateDesc).map(function (o) {
        return {
          id: o.id, date: o.date, sy: 'SY25-26', status: o.status,
          approvedAt: o.approvedAt || '', approvedBy: o.approvedBy || '',
          cancelJustification: o.cancelJustification || '', pricedAt: o.pricedAt || '',
          fulfillmentAt: o.fulfillmentAt || '', closedAt: o.closedAt || '',
          poPdfUrl: o.poPdfUrl || '', chargingDepartment: o.dept || '',
          additionalNotify: o.additionalNotify || '',
          items: (o.items || []).map(historyItem)
        };
      });
  }

  // ---- CORE: master queue (all orders) ---------------------------------
  function queueItem(it, i) {
    return {
      lineId: 'L' + (i + 1), name: it.name, qty: it.qty,
      unitCost: parseFloat(it.unitCost) || 0, notes: it.notes || '',
      url: it.url || '', attachmentUrl: it.attachmentUrl || '',
      attachmentFileName: it.attachmentFileName || ''
    };
  }
  function getMasterQueue() {
    return ORDERS.slice().sort(byDateDesc).map(function (o) {
      return {
        id: o.id, date: o.date, sy: 'SY25-26', status: o.status,
        requestor: o.requestor, requestorEmail: o.requestorEmail, poNumber: o.id,
        chargingDepartment: o.dept || '', additionalNotify: o.additionalNotify || '',
        vendor: o.vendor || '', bank: o.bank || '', payType: o.payType || '',
        total: orderTotal(o), packingSummary: o.packingSummary || '',
        preCancelStatus: o.preCancelStatus || '',
        approvedAt: o.approvedAt || '', approvedBy: o.approvedBy || '',
        pricedAt: o.pricedAt || '', fulfillmentAt: o.fulfillmentAt || '',
        closedAt: o.closedAt || '', poPdfUrl: o.poPdfUrl || '',
        cancelJustification: o.cancelJustification || '',
        items: (o.items || []).map(queueItem)
      };
    });
  }

  // ---- CORE: submit a new order ----------------------------------------
  function submitOrder(orderData, lineItems) {
    orderData = orderData || {};
    var now = new Date();
    var id = 'ORD-' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(++seq, 4);
    var notify = Array.isArray(orderData.additionalNotify)
      ? orderData.additionalNotify.join(', ') : (orderData.additionalNotify || '');
    var order = {
      id: id, date: now.toISOString(), status: 'Pending Approval',
      requestor: D.currentUser.firstName + ' ' + D.currentUser.lastName,
      requestorEmail: (orderData.email || D.currentUser.email),
      dept: orderData.chargingDepartment || D.depts.primary,
      vendor: '', bank: '', payType: '', additionalNotify: notify,
      pricedAt: '', approvedAt: '', approvedBy: '', fulfillmentAt: '', closedAt: '',
      poPdfUrl: '', cancelJustification: '', preCancelStatus: '', packingSummary: '',
      items: (lineItems || []).map(function (li) {
        return {
          name: li.name || 'Item', qty: parseInt(li.qty, 10) || 1,
          unitCost: parseFloat(li.price != null ? li.price : li.unitCost) || 0,
          notes: li.notes || '', url: li.url || '',
          attachmentUrl: li.attachmentBase64 ? '#' : '',
          attachmentFileName: li.attachmentFileName || ''
        };
      })
    };
    ORDERS.push(order);
    return id;
  }

  // ---- analytics helpers ------------------------------------------------
  function activeOrders() { return ORDERS.filter(function (o) { return !isCancelled(o); }); }

  function groupSum(orders, keyFn, labelName) {
    var map = {};
    orders.forEach(function (o) {
      var k = keyFn(o);
      if (k === '' || k == null) return;
      map[k] = (map[k] || 0) + orderTotal(o);
    });
    return Object.keys(map).map(function (k) {
      var row = { total: round2(map[k]) }; row[labelName] = k; return row;
    }).sort(function (a, b) { return b.total - a.total; });
  }

  function getAnalytics(_filters) {
    var active = activeOrders();
    var totalSpend = round2(active.reduce(function (s, o) { return s + orderTotal(o); }, 0));
    var orderCount = active.length;
    var totals = active.map(orderTotal);
    var largest = totals.length ? Math.max.apply(null, totals) : 0;
    var cancelledCount = ORDERS.filter(isCancelled).length;

    // monthly trend
    var mMap = {};
    active.forEach(function (o) { var k = monthKey(o.date); mMap[k] = (mMap[k] || 0) + orderTotal(o); });
    var monthlyTrend = Object.keys(mMap).sort().map(function (k) { return { month: k, spend: round2(mMap[k]) }; });

    // status breakdown (all orders)
    var sMap = {};
    ORDERS.forEach(function (o) { sMap[o.status] = (sMap[o.status] || 0) + 1; });
    var statusBreakdown = Object.keys(sMap).map(function (k) { return { status: k, count: sMap[k] }; });

    var byVendor = groupSum(active, function (o) { return o.vendor; }, 'vendor');
    var byDept = groupSum(active, function (o) { return o.dept; }, 'department');
    var byCat = groupSum(active, function (o) { return catOf(o.dept); }, 'category');
    var byBank = groupSum(active, function (o) { return o.bank; }, 'bank');
    var byPay = groupSum(active, function (o) { return o.payType; }, 'payType');
    var byReq = groupSum(active, function (o) { return o.requestor; }, 'requestor');

    // pareto over vendors
    var vendorRunning = 0;
    var vendorGrand = byVendor.reduce(function (s, r) { return s + r.total; }, 0) || 1;
    var paretoVendors = byVendor.map(function (r) {
      vendorRunning += r.total;
      return {
        vendor: r.vendor, total: r.total, cumulative: round2(vendorRunning),
        cumulativePct: round2((vendorRunning / vendorGrand) * 100)
      };
    });

    // top items (by spend)
    var itMap = {};
    active.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        var e = itMap[it.name] || { name: it.name, qty: 0, spend: 0 };
        e.qty += parseInt(it.qty, 10) || 0;
        e.spend += (parseFloat(it.unitCost) || 0) * (parseInt(it.qty, 10) || 0);
        itMap[it.name] = e;
      });
    });
    var topItems = Object.keys(itMap).map(function (k) {
      return { name: itMap[k].name, qty: itMap[k].qty, spend: round2(itMap[k].spend) };
    }).sort(function (a, b) { return b.spend - a.spend; }).slice(0, 10);

    // size distribution
    var buckets = [
      { bucket: '< $100', min: 0, max: 100 },
      { bucket: '$100–$250', min: 100, max: 250 },
      { bucket: '$250–$500', min: 250, max: 500 },
      { bucket: '$500–$1k', min: 500, max: 1000 },
      { bucket: '$1k+', min: 1000, max: Infinity }
    ];
    var sizeDistribution = buckets.map(function (b) {
      return { bucket: b.bucket, count: active.filter(function (o) { var t = orderTotal(o); return t >= b.min && t < b.max; }).length };
    });

    // dept x category matrix
    var deptNames = byDept.map(function (r) { return r.department; });
    var catNames = byCat.map(function (r) { return r.category; });
    var matrix = deptNames.map(function (dn) {
      return catNames.map(function (cn) {
        return round2(active.filter(function (o) { return o.dept === dn && catOf(o.dept) === cn; })
          .reduce(function (s, o) { return s + orderTotal(o); }, 0));
      });
    });

    var uniq = function (arr) { return Object.keys(arr.reduce(function (m, v) { if (v) m[v] = 1; return m; }, {})); };

    return {
      totalSpend: totalSpend,
      orderCount: orderCount,
      avgOrder: orderCount ? round2(totalSpend / orderCount) : 0,
      cancelRate: ORDERS.length ? round2((cancelledCount / ORDERS.length) * 100) : 0,
      openCount: ORDERS.filter(isOpen).length,
      largestOrder: round2(largest),
      vendorTop10: byVendor.slice(0, 10),
      monthlyTrend: monthlyTrend,
      statusBreakdown: statusBreakdown,
      groupedBy: { vendor: byVendor, department: byDept, category: byCat, bank: byBank, payType: byPay, requestor: byReq },
      topItems: topItems,
      paretoVendors: paretoVendors,
      sizeDistribution: sizeDistribution,
      deptByCategory: { departments: deptNames, categories: catNames, matrix: matrix },
      filterOptions: {
        vendors: uniq(ORDERS.map(function (o) { return o.vendor; })).sort(),
        departments: D.depts.allActive.slice(),
        requestors: uniq(ORDERS.map(function (o) { return o.requestor; })).sort(),
        categories: uniq(D.depts.allActive.map(catOf)).sort(),
        banks: D.banks.slice(),
        payTypes: D.payTypes.slice(),
        statuses: uniq(ORDERS.map(function (o) { return o.status; })),
        schoolYears: ['SY26-27', 'SY25-26']
      }
    };
  }

  // ---- CORE: processing metrics ----------------------------------------
  function avgStage(fromKey, toKey) {
    var vals = ORDERS.map(function (o) { return daysBetween(o[fromKey], o[toKey]); })
      .filter(function (v) { return v != null && v >= 0; });
    if (!vals.length) return 0;
    return round2(vals.reduce(function (s, v) { return s + v; }, 0) / vals.length);
  }

  function getProcessingMetrics(_filters) {
    var active = activeOrders();
    var has = function (k) { return function (o) { return !!o[k]; }; };
    var funnelDefs = [
      { stage: 'Submitted', test: function () { return true; } },
      { stage: 'Priced', test: has('pricedAt') },
      { stage: 'Approved', test: has('approvedAt') },
      { stage: 'Fulfillment', test: has('fulfillmentAt') },
      { stage: 'Closed', test: has('closedAt') }
    ];
    var first = active.length || 1;
    var funnel = funnelDefs.map(function (f) {
      var count = active.filter(f.test).length;
      return { stage: f.stage, count: count, pct: Math.round((count / first) * 100) };
    });

    var openMap = {};
    ORDERS.filter(isOpen).forEach(function (o) {
      var e = openMap[o.status] || { status: o.status, count: 0, total: 0 };
      e.count += 1; e.total += orderTotal(o); openMap[o.status] = e;
    });
    var outstandingByStatus = Object.keys(openMap).map(function (k) {
      return { status: k, count: openMap[k].count, total: round2(openMap[k].total) };
    });

    var today = new Date();
    var staleOrders = ORDERS.filter(isOpen).map(function (o) {
      var since = o.fulfillmentAt || o.approvedAt || o.pricedAt || o.date;
      return { o: o, days: Math.round((today - new Date(since)) / 86400000) };
    }).filter(function (x) { return x.days > 14; }).map(function (x) {
      return {
        id: x.o.id, status: x.o.status, daysInStatus: x.days,
        requestor: x.o.requestor, department: x.o.dept, vendor: x.o.vendor || '—',
        total: orderTotal(x.o)
      };
    }).sort(function (a, b) { return b.daysInStatus - a.daysInStatus; });

    var closed = active.filter(function (o) { return !!o.closedAt; });
    var cycleGroup = function (keyFn, labelName) {
      var map = {};
      closed.forEach(function (o) {
        var k = keyFn(o); if (!k) return;
        var e = map[k] || { count: 0, sum: 0 };
        e.count += 1; e.sum += daysBetween(o.date, o.closedAt) || 0; map[k] = e;
      });
      return Object.keys(map).map(function (k) {
        var row = { count: map[k].count, avgDays: round2(map[k].sum / map[k].count) };
        row[labelName] = k; return row;
      }).sort(function (a, b) { return b.avgDays - a.avgDays; });
    };

    var cancelGroup = function (keyFn, labelName) {
      var map = {};
      ORDERS.forEach(function (o) {
        var k = keyFn(o); if (!k) return;
        var e = map[k] || { total: 0, cancelled: 0 };
        e.total += 1; if (isCancelled(o)) e.cancelled += 1; map[k] = e;
      });
      return Object.keys(map).map(function (k) {
        var row = { total: map[k].total, cancelled: map[k].cancelled, rate: Math.round((map[k].cancelled / map[k].total) * 100) };
        row[labelName] = k; return row;
      });
    };

    return {
      avgSubmToPriced: avgStage('date', 'pricedAt'),
      avgPricedToApproved: avgStage('pricedAt', 'approvedAt'),
      avgApprovedToFulfill: avgStage('approvedAt', 'fulfillmentAt'),
      avgFulfillToClosed: avgStage('fulfillmentAt', 'closedAt'),
      avgTotalCycle: avgStage('date', 'closedAt'),
      funnel: funnel,
      outstandingByStatus: outstandingByStatus,
      staleOrders: staleOrders,
      cycleByDepartment: cycleGroup(function (o) { return o.dept; }, 'department'),
      cycleByVendor: cycleGroup(function (o) { return o.vendor; }, 'vendor'),
      cycleByRequestor: cycleGroup(function (o) { return o.requestor; }, 'requestor'),
      cancelByDepartment: cancelGroup(function (o) { return o.dept; }, 'department'),
      cancelByCategory: cancelGroup(function (o) { return catOf(o.dept); }, 'category')
    };
  }

  // ---- CORE: trends metrics --------------------------------------------
  var SY_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  var SY_KEYS = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];

  function currentByMonth() {
    var active = activeOrders();
    return SY_KEYS.map(function (k) {
      return round2(active.filter(function (o) { return monthKey(o.date) === k; })
        .reduce(function (s, o) { return s + orderTotal(o); }, 0));
    });
  }

  function getTrendsMetrics(_filters) {
    var current = currentByMonth();
    // Prior-period (last SY) — fabricated, smaller, so the comparison lines differ.
    var prior = current.map(function (v, i) { return round2(v * 0.7 + (i % 3) * 40); });

    var cumC = [], cumP = [], rc = 0, rp = 0;
    for (var i = 0; i < current.length; i++) { rc += current[i]; rp += prior[i]; cumC.push(round2(rc)); cumP.push(round2(rp)); }

    // heatmap: two school years x 12 months
    var maxSpend = Math.max.apply(null, current.concat(prior).concat([1]));
    var rowFor = function (label, arr) {
      return { label: label, cells: SY_MONTHS.map(function (m, idx) { return { month: m, monthKey: SY_KEYS[idx], spend: arr[idx] }; }) };
    };
    var heatmap = { rows: [rowFor('SY24-25', prior), rowFor('SY25-26', current)], maxSpend: round2(maxSpend) };

    // day of week (from submission dates)
    var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var dowMap = {};
    activeOrders().forEach(function (o) {
      var d = DOW[new Date(o.date).getDay()];
      var e = dowMap[d] || { day: d, count: 0, spend: 0 };
      e.count += 1; e.spend += orderTotal(o); dowMap[d] = e;
    });
    var dayOfWeek = DOW.map(function (d) { var e = dowMap[d] || { day: d, count: 0, spend: 0 }; return { day: e.day, count: e.count, spend: round2(e.spend) }; });

    // quarterly (school-year quarters: Q1 Sep-Nov, Q2 Dec-Feb, Q3 Mar-May, Q4 Jun-Aug)
    var qSum = function (arr, q) { var start = q * 3; return round2(arr[start] + arr[start + 1] + arr[start + 2]); };
    var quarterlyComparison = {
      quarters: ['Q1', 'Q2', 'Q3', 'Q4'],
      years: [
        { year: 'SY24-25', spend: [qSum(prior, 0), qSum(prior, 1), qSum(prior, 2), qSum(prior, 3)] },
        { year: 'SY25-26', spend: [qSum(current, 0), qSum(current, 1), qSum(current, 2), qSum(current, 3)] }
      ]
    };

    // department trend — top departments by total spend
    var deptTotals = {};
    activeOrders().forEach(function (o) { deptTotals[o.dept] = (deptTotals[o.dept] || 0) + orderTotal(o); });
    var deptNames = Object.keys(deptTotals).sort(function (a, b) { return deptTotals[b] - deptTotals[a]; }).slice(0, 8);
    var departments = deptNames.map(function (dn) {
      var monthlySpend = SY_KEYS.map(function (k) {
        return round2(activeOrders().filter(function (o) { return o.dept === dn && monthKey(o.date) === k; })
          .reduce(function (s, o) { return s + orderTotal(o); }, 0));
      });
      return { department: dn, monthlySpend: monthlySpend, total: round2(deptTotals[dn]) };
    });

    // vendor change vs prior period (fabricated prior figures)
    var active = activeOrders();
    var vMap = {};
    active.forEach(function (o) { if (o.vendor) vMap[o.vendor] = (vMap[o.vendor] || 0) + orderTotal(o); });
    var vendorChange = Object.keys(vMap).map(function (v, i) {
      var cur = round2(vMap[v]);
      var pri = round2(cur * (0.6 + (i % 4) * 0.15));
      return { vendor: v, prior: pri, current: cur, change: round2(cur - pri), pctChange: pri ? round2(((cur - pri) / pri) * 100) : null };
    }).sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change); }).slice(0, 8);

    return {
      hasPriorPeriod: true,
      monthlyCurrentVsPrior: { months: SY_MONTHS.slice(), current: current, prior: prior },
      cumulativeCurrentVsPrior: { months: SY_MONTHS.slice(), current: cumC, prior: cumP },
      heatmap: heatmap,
      dayOfWeek: dayOfWeek,
      quarterlyComparison: quarterlyComparison,
      deptTrend: { months: SY_MONTHS.slice(), departments: departments },
      vendorChange: vendorChange
    };
  }

  // ---- CORE: per-order documents / comments (client expects arrays) ----
  function getOrderDocuments(_orderId) { return []; }
  function getOrderComments(_orderId) { return []; }

  // ---- dispatcher -------------------------------------------------------
  var CORE = {
    getCatalogItems: getCatalogItems,
    getUserAvailableDepts: getUserAvailableDepts,
    getActiveStaffForPicker: getActiveStaffForPicker,
    getApproverSettings: getApproverSettings,
    getUserOrderHistory: getUserOrderHistory,
    getMasterQueue: getMasterQueue,
    submitOrder: submitOrder,
    getAnalytics: getAnalytics,
    getProcessingMetrics: getProcessingMetrics,
    getTrendsMetrics: getTrendsMetrics,
    getOrderDocuments: getOrderDocuments,
    getOrderComments: getOrderComments
  };

  // Any server function not in CORE resolves to a benign stub returning [] — most
  // uncalled functions are list/table feeds, so an empty array renders as an empty
  // (but not broken) view. A handful of object-returning ones render empty; that is
  // an accepted, documented gap for this showcase demo.
  return new Proxy(CORE, {
    get: function (target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
      return function () { return []; };
    }
  });
})();
