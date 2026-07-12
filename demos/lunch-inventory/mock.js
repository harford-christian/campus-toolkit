/* mock.js — in-memory HCS Lunch Inventory backend for the showcase demo.
   Implements the named google.script.run methods the four surfaces call
   (getLunchData / getAdminData / processLunchAction / logBuonGusto /
   logShipment / saveItemEdits / addLunchItem). The real Apps Script UI runs
   verbatim; the gsr-shim routes each call here.

   STATEFUL in memory: a count on the kiosk changes qty, a logged shipment
   raises qty and shows up in the admin Shipment History, editing an item on
   the Home "Manage" sheet updates price/box size/etc — all persist until the
   page is reloaded.

   TIME ANCHOR: "today" is pinned ONCE at load to the most recent Tuesday (so
   the kiosk's Tuesday/Thursday Buon Gusto count cards appear). All day OFFSETS
   in data.js resolve against this anchor, so a batch seeded at +2 days always
   reads as 2 days to expiry — urgent items stay urgent whenever the demo is
   opened. */
window.MOCK_BACKEND = (function () {
  var DATA = window.LUNCH_DATA;
  var DAYS3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MS_DAY = 86400000;

  // ── Fixed "today", forced to the most recent Tuesday (day 2), at noon. ──
  var _now = new Date();
  var _back = (_now.getDay() - 2 + 7) % 7;
  var TODAY = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate() - _back, 12, 0, 0);

  function dateFrom(days) { return new Date(TODAY.getTime() + days * MS_DAY); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fmtUS(d) { return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear(); }

  var TODAY_STR = fmtISO(TODAY);

  // ── Build a resolved batch object from a seed. ──
  function buildBatch(seed) {
    var hasExp = (seed.expiryOffsetDays !== null && seed.expiryOffsetDays !== undefined);
    return {
      batchId:         seed.batchId,
      shipmentId:      seed.shipmentId,
      receivedStr:     fmtUS(dateFrom(seed.receivedOffsetDays)),
      expiryStr:       hasExp ? fmtUS(dateFrom(seed.expiryOffsetDays)) : '',
      daysUntilExpiry: hasExp ? seed.expiryOffsetDays : null,
      qtyReceived:     seed.qtyReceived,
      qtyRemaining:    seed.qtyRemaining,
      notes:           seed.notes || ''
    };
  }

  // ── Build a full item (with resolved + sorted batches and derived expiry). ──
  function buildItem(src) {
    var batches = (src.batchSeeds || []).map(buildBatch);
    // Soonest expiry first; null (no date) sorts last — mirrors getActiveBatchMap().
    batches.sort(function (a, b) {
      if (a.daysUntilExpiry === null) return 1;
      if (b.daysUntilExpiry === null) return -1;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });
    return {
      id:               src.id,
      category:         src.category,
      name:             src.name,
      price:            src.price,
      qty:              src.qty,
      unit:             src.unit,
      minLevel:         src.minLevel,
      supplierUrl:      src.supplierUrl || '',
      lastCounted:      TODAY_STR,
      isBuonGusto:      !!src.isBuonGusto,
      trackExpiry:      !!src.trackExpiry,
      boxSize:          src.boxSize || 0,
      defaultShelfLife: src.defaultShelfLife || 0,
      batches:          batches,
      expiryStr:        batches.length ? batches[0].expiryStr : null,
      daysUntilExpiry:  batches.length ? batches[0].daysUntilExpiry : null
    };
  }

  // ── Mutable in-memory state ──
  var ITEMS = DATA.items.map(buildItem);
  var BG_LOG = {
    received: DATA.bgLog.received, sold: DATA.bgLog.sold, leftover: DATA.bgLog.leftover
  };
  var SHIPMENTS = DATA.recentShipments.map(function (s) {
    return {
      shipmentId: s.shipmentId,
      date:       fmtUS(dateFrom(-s.daysAgo)),
      loggedBy:   s.loggedBy,
      notes:      s.notes,
      itemCount:  s.itemCount
    };
  });

  function findItem(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === String(id)) return ITEMS[i];
    return null;
  }

  // ── DATA FETCH ─────────────────────────────────────────────────────────
  function getLunchData() {
    return {
      items:      ITEMS,
      todayStr:   TODAY_STR,
      todayDay:   2,                    // Tuesday — Buon Gusto count day
      bgLog:      BG_LOG,
      config:     DATA.config,
      serverTime: TODAY.toString()      // a Tuesday, so kiosk shows BG cards
    };
  }

  function buildTimeSeries() {
    var ts = {};
    DATA.timeSeriesDays.forEach(function (d) { ts[fmtISO(dateFrom(-d.daysAgo))] = d.units; });
    return ts;
  }

  function buildBgHistory() {
    return DATA.bgHistory.map(function (r) {
      var d = dateFrom(-r.daysAgo);
      return {
        date:     fmtUS(d),
        dayName:  DAYS3[d.getDay()],
        received: r.received,
        sold:     r.sold,
        leftover: Math.max(0, r.received - r.sold)
      };
    });
  }

  function buildExpiryAlerts() {
    var alerts = [];
    ITEMS.forEach(function (item) {
      item.batches.forEach(function (b) {
        if (b.daysUntilExpiry !== null && b.daysUntilExpiry <= DATA.config.ORDER_CYCLE_DAYS) {
          var a = {};
          for (var k in b) a[k] = b[k];
          a.itemName = item.name;
          alerts.push(a);
        }
      });
    });
    alerts.sort(function (a, b) { return a.daysUntilExpiry - b.daysUntilExpiry; });
    return alerts;
  }

  function getAdminData() {
    var base = getLunchData();
    var admin = {
      timeSeries:      buildTimeSeries(),
      itemVelocity:    DATA.itemVelocity,
      categoryUsage:   DATA.categoryUsage,
      bgHistory:       buildBgHistory(),
      recentShipments: SHIPMENTS.slice(-10),
      expiryAlerts:    buildExpiryAlerts(),
      reorderList:     ITEMS.filter(function (i) { return !i.isBuonGusto && i.qty <= i.minLevel; })
    };
    for (var k in base) admin[k] = base[k];
    return admin;
  }

  // ── INVENTORY ACTIONS (kiosk) ─────────────────────────────────────────
  function processLunchAction(payload) {
    payload = payload || {};
    var item = findItem(payload.itemId);
    if (!item) throw new Error('Item ID not found: ' + payload.itemId);
    var finalQty = item.qty;
    if (payload.actionType === 'Count') {
      finalQty = Math.max(0, parseInt(payload.newQty, 10) || 0);
    } else if (payload.actionType === 'Withdrawal') {
      finalQty = Math.max(0, item.qty - Math.abs(parseInt(payload.changeAmount, 10) || 0));
    }
    item.qty = finalQty;
    item.lastCounted = TODAY_STR;
    return { status: 'ok', finalQty: finalQty };
  }

  // ── BUON GUSTO LOG (kiosk) ────────────────────────────────────────────
  function logBuonGusto(payload) {
    payload = payload || {};
    var recv = parseInt(payload.slicesReceived, 10) || 0;
    var sold = parseInt(payload.slicesSold, 10) || 0;
    var leftover = Math.max(0, recv - sold);
    BG_LOG.received = recv;
    BG_LOG.sold = sold;
    BG_LOG.leftover = leftover;
    return { status: 'ok', updated: true, leftover: leftover };
  }

  // ── SHIPMENT LOGGING (shipment) ───────────────────────────────────────
  function logShipment(payload) {
    payload = payload || {};
    var lines = payload.lines || [];
    var shipmentId = 'SH' + Date.now();
    lines.forEach(function (line) {
      var total = 0;
      (line.boxes || []).forEach(function (b) { total += parseInt(b.qty, 10) || 0; });
      if (total <= 0) return;
      var item = findItem(line.itemId);
      if (item) item.qty += total;
    });
    SHIPMENTS.push({
      shipmentId: shipmentId,
      date:       fmtUS(TODAY),
      loggedBy:   'Lunch Staff',
      notes:      payload.notes || '',
      itemCount:  lines.length
    });
    return { status: 'ok', shipmentId: shipmentId };
  }

  // ── ITEM EDITS + ADD (home "Manage" sheet) ────────────────────────────
  function saveItemEdits(changes) {
    (changes || []).forEach(function (c) {
      var item = findItem(c.itemId);
      if (!item) return;
      if (c.newPrice     !== undefined && c.newPrice     !== null) item.price = parseFloat(c.newPrice) || 0;
      if (c.newMinLevel  !== undefined && c.newMinLevel  !== null) item.minLevel = parseInt(c.newMinLevel, 10) || 0;
      if (c.newBoxSize   !== undefined && c.newBoxSize   !== null) item.boxSize = parseInt(c.newBoxSize, 10) || 0;
      if (c.newShelfLife !== undefined && c.newShelfLife !== null) item.defaultShelfLife = parseInt(c.newShelfLife, 10) || 0;
    });
    return { status: 'ok' };
  }

  function addLunchItem(payload) {
    payload = payload || {};
    var maxNum = 0;
    ITEMS.forEach(function (i) {
      if (String(i.id).indexOf('LI') === 0) {
        var n = parseInt(String(i.id).replace('LI', ''), 10) || 0;
        if (n > maxNum) maxNum = n;
      }
    });
    var newId = 'LI' + String(maxNum + 1).padStart(3, '0');
    ITEMS.push({
      id: newId, category: payload.category, name: payload.name,
      price: parseFloat(payload.price) || 0, qty: parseInt(payload.qty, 10) || 0,
      unit: 'each', minLevel: parseInt(payload.min, 10) || 0,
      supplierUrl: '', lastCounted: TODAY_STR, isBuonGusto: false,
      trackExpiry: !!payload.trackExpiry, boxSize: parseInt(payload.boxSize, 10) || 0,
      defaultShelfLife: parseInt(payload.shelfLife, 10) || 0,
      batches: [], expiryStr: null, daysUntilExpiry: null
    });
    return { status: 'ok', newId: newId };
  }

  function updateExpiryDate() { return { status: 'ok' }; }

  return {
    getLunchData:       getLunchData,
    getAdminData:       getAdminData,
    processLunchAction: processLunchAction,
    logBuonGusto:       logBuonGusto,
    logShipment:        logShipment,
    saveItemEdits:      saveItemEdits,
    addLunchItem:       addLunchItem,
    updateExpiryDate:   updateExpiryDate
  };
})();
