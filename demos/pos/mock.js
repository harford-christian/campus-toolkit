/* mock.js — in-memory POS backend for the Nest Express demo. Implements the
   named api_* dispatcher the three surfaces call through google.script.run:
   kiosk (api_getMenuState / api_verifyPin / api_placeOrder), TV
   (api_getMenuState), and KDS (api_getKdsFeed / api_completeOrder /
   api_reopenOrder). STATEFUL in memory: orders placed on the kiosk appear on
   the KDS board; completing a ticket removes it; undo restores it.

   Cooking readiness and ticket ages are anchored ONCE at load, so the pizza
   timer counts down and seeded tickets age realistically across polls. */
window.MOCK_BACKEND = (function () {
  var DATA = window.POS_DATA;
  var LOAD_MS = Date.now();

  // Pizza's readyAt is anchored at load so the "BACK IN Nm" badge counts down.
  var COOKING_READY_AT = {};
  for (var i = 0; i < DATA.items.length; i++) {
    var it = DATA.items[i];
    if (typeof it.cookingOffsetMs === 'number') {
      COOKING_READY_AT[it.id] = LOAD_MS + it.cookingOffsetMs;
    }
  }

  // ---- live KDS queue (seeded, then mutated by placeOrder/complete/reopen) ----
  var kdsOrders = DATA.kdsSeed.map(function (t) {
    return {
      orderId: t.orderId,
      rowIndex: t.rowIndex,
      customerName: t.customerName,
      createdAtMs: LOAD_MS + t.createdOffsetMs,
      lines: t.lines.slice()
    };
  });
  var removed = {};          // orderId -> ticket, for reopen()
  var nextRowIndex = 6;      // seeds used rows 2..5

  // ---- menu state (fresh object each call; stock is not mutated in the demo) ----
  function buildItems() {
    return DATA.items.map(function (src) {
      var item = {};
      for (var k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        if (k === 'cookingOffsetMs') continue; // demo hint, not part of the contract
        item[k] = src[k];
      }
      if (Object.prototype.hasOwnProperty.call(COOKING_READY_AT, src.id)) {
        item.cooking = { readyAtMs: COOKING_READY_AT[src.id] };
      }
      return item;
    });
  }

  function menuState() {
    return {
      halfOff: DATA.halfOff === true,
      serverNow: Date.now(),
      version: DATA.menuVersion,
      items: buildItems()
    };
  }

  function itemName(itemId) {
    for (var i = 0; i < DATA.items.length; i++) {
      if (DATA.items[i].id === itemId) return DATA.items[i].name;
    }
    return itemId;
  }

  // Kitchen lines for a placed order. Prefer the real Payload formatter (present
  // once CartEngine is inlined in the page); fall back to a plain name ×qty list
  // so the Node verification harness works without CartEngine.
  function kitchenLines(payload) {
    if (typeof Payload !== 'undefined' && payload && payload.lines) {
      try {
        var out = Payload.formatKitchenLines(payload.lines, menuState());
        if (out && out.length) return out;
      } catch (e) { /* fall through */ }
    }
    var lines = [];
    var pl = (payload && payload.lines) || [];
    for (var i = 0; i < pl.length; i++) {
      var q = pl[i].qty || 0;
      if (q <= 0) continue;
      lines.push(itemName(pl[i].itemId) + ' ×' + q);
    }
    return lines.length ? lines : ['Order ' + ((payload && payload.orderId) || '')];
  }

  // ---- dispatcher methods ----

  function api_getMenuState() {
    return { ok: true, data: menuState() };
  }

  function api_verifyPin(pin) {
    return pin === '1234' ? { ok: true, token: 'tok' } : { ok: false };
  }

  function api_placeOrder(payload) {
    payload = payload || {};
    var isTest = !!payload.isTest;

    // Push into the live KDS queue (skip pure test orders — real ones cook).
    if (!isTest) {
      var orderId = payload.orderId || ('demo-' + Date.now());
      var exists = false;
      for (var i = 0; i < kdsOrders.length; i++) {
        if (kdsOrders[i].orderId === orderId) { exists = true; break; }
      }
      if (!exists) {
        kdsOrders.push({
          orderId: orderId,
          rowIndex: nextRowIndex++,
          customerName: payload.customerName || 'Guest',
          createdAtMs: (typeof payload.createdAtMs === 'number') ? payload.createdAtMs : Date.now(),
          lines: kitchenLines(payload)
        });
      }
    }

    return {
      status: 'OK',
      orderId: payload.orderId,
      serverTotalCents: payload.clientTotalCents || 0,
      isTest: isTest
    };
  }

  function api_getKdsFeed(urlKey) {
    return {
      ok: true,
      data: {
        serverNow: Date.now(),
        orders: kdsOrders.map(function (o) {
          return {
            orderId: o.orderId,
            rowIndex: o.rowIndex,
            customerName: o.customerName,
            createdAtMs: o.createdAtMs,
            lines: o.lines.slice()
          };
        })
      }
    };
  }

  function api_completeOrder(urlKey, orderId, rowIndex) {
    for (var i = 0; i < kdsOrders.length; i++) {
      if (kdsOrders[i].orderId === orderId) {
        removed[orderId] = kdsOrders.splice(i, 1)[0];
        break;
      }
    }
    return { ok: true };
  }

  function api_reopenOrder(urlKey, orderId, rowIndex) {
    if (removed[orderId]) {
      kdsOrders.push(removed[orderId]);
      delete removed[orderId];
      kdsOrders.sort(function (a, b) { return a.createdAtMs - b.createdAtMs; });
    }
    return { ok: true };
  }

  return {
    api_getMenuState: api_getMenuState,
    api_verifyPin: api_verifyPin,
    api_placeOrder: api_placeOrder,
    api_getKdsFeed: api_getKdsFeed,
    api_completeOrder: api_completeOrder,
    api_reopenOrder: api_reopenOrder
  };
})();
