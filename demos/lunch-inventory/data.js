/* data.js — fabricated inventory + logs for the HCS Lunch Inventory demo.
   Shared by home.html, kiosk.html, shipment.html and admin.html (each loads
   this before mock.js). No real people, sheet IDs, emails, exec URLs or
   supplier links — every name and number here is invented for the showcase
   (lunch lead Dana Whitfield, staff Marcus Ortega / Priya Nair, admin Karen
   Delgado; vendor "Northline Foodservice").

   TIME-RELATIVE FIELDS: batch expiry/received dates, the Buon Gusto history,
   shipment dates and the usage time-series all carry plain day OFFSETS here
   (receivedOffsetDays / expiryOffsetDays / daysAgo). mock.js resolves them
   against a fixed "today" (forced to a Tuesday so the Buon Gusto count cards
   appear) so urgent items stay urgent and dates look current no matter when
   the demo is opened.

   ITEM shape (see Code.gs getLunchData): id, category, name, price, qty, unit,
   minLevel, supplierUrl, lastCounted, isBuonGusto, trackExpiry, boxSize,
   defaultShelfLife, batchSeeds[] (-> batches[]). expiryStr / daysUntilExpiry
   are derived by mock.js from the soonest batch.
   BATCH seed: { batchId, shipmentId, receivedOffsetDays, expiryOffsetDays|null,
   qtyReceived, qtyRemaining, notes }. */
window.LUNCH_DATA = {

  config: {
    ORDER_CYCLE_DAYS:    7,
    EXPIRY_WARNING_DAYS: 6,
    EXPIRY_URGENT_DAYS:  3,
    MILK_EXPIRY_DAYS:    14,
    TIMEZONE:            'America/New_York'
  },

  // Today's Buon Gusto delivery — logged this morning, not yet sold.
  bgLog: { received: 60, sold: 0, leftover: 60 },

  items: [
    // ── Microwave Foods (entrees) ──────────────────────────────────────────
    {
      id: 'LI001', category: 'Microwave Foods', name: 'Pepperoni Pizza',
      price: 2.50, qty: 24, unit: 'each', minLevel: 6,
      trackExpiry: true, boxSize: 12, defaultShelfLife: 180,
      batchSeeds: [
        { batchId: 'SH20260615A_LI001_0', shipmentId: 'SH20260615A',
          receivedOffsetDays: -20, expiryOffsetDays: 60,
          qtyReceived: 24, qtyRemaining: 24, notes: '' }
      ]
    },
    {
      id: 'LI002', category: 'Microwave Foods', name: 'Cheese Pizza',
      price: 2.50, qty: 5, unit: 'each', minLevel: 6,
      trackExpiry: true, boxSize: 12, defaultShelfLife: 180,
      batchSeeds: [
        { batchId: 'SH20260610A_LI002_0', shipmentId: 'SH20260610A',
          receivedOffsetDays: -25, expiryOffsetDays: 75,
          qtyReceived: 12, qtyRemaining: 5, notes: '' }
      ]
    },
    {
      id: 'LI003', category: 'Microwave Foods', name: 'PB&J Sandwich',
      price: 2.00, qty: 30, unit: 'each', minLevel: 8,
      trackExpiry: true, boxSize: 24, defaultShelfLife: 365,
      batchSeeds: [
        { batchId: 'SH20260625A_LI003_0', shipmentId: 'SH20260625A',
          receivedOffsetDays: -10, expiryOffsetDays: 200,
          qtyReceived: 48, qtyRemaining: 30, notes: '' }
      ]
    },
    {
      id: 'LI011', category: 'Microwave Foods', name: 'Chicken Nuggets',
      price: 2.75, qty: 16, unit: 'pack', minLevel: 6,
      trackExpiry: true, boxSize: 20, defaultShelfLife: 120,
      batchSeeds: [
        { batchId: 'SH20260620A_LI011_0', shipmentId: 'SH20260620A',
          receivedOffsetDays: -15, expiryOffsetDays: 120,
          qtyReceived: 20, qtyRemaining: 16, notes: '' }
      ]
    },
    {
      id: 'LI012', category: 'Microwave Foods', name: 'Bean & Cheese Burrito',
      price: 2.50, qty: 9, unit: 'each', minLevel: 6,
      trackExpiry: true, boxSize: 12, defaultShelfLife: 90,
      batchSeeds: [
        { batchId: 'SH20260623A_LI012_0', shipmentId: 'SH20260623A',
          receivedOffsetDays: -12, expiryOffsetDays: 90,
          qtyReceived: 12, qtyRemaining: 9, notes: '' }
      ]
    },

    // ── Sides ───────────────────────────────────────────────────────────────
    {
      id: 'LI013', category: 'Sides', name: 'Baby Carrots',
      price: 0.75, qty: 20, unit: 'bag', minLevel: 8,
      trackExpiry: true, boxSize: 30, defaultShelfLife: 10,
      batchSeeds: [
        { batchId: 'SH20260702A_LI013_0', shipmentId: 'SH20260702A',
          receivedOffsetDays: -3, expiryOffsetDays: 5,
          qtyReceived: 30, qtyRemaining: 20, notes: '' }
      ]
    },
    {
      id: 'LI014', category: 'Sides', name: 'Side Salad',
      price: 2.25, qty: 4, unit: 'each', minLevel: 6,
      trackExpiry: true, boxSize: 12, defaultShelfLife: 5,
      batchSeeds: [
        { batchId: 'SH20260703A_LI014_0', shipmentId: 'SH20260703A',
          receivedOffsetDays: -2, expiryOffsetDays: 2,
          qtyReceived: 12, qtyRemaining: 4, notes: 'Use first — short date' }
      ]
    },
    {
      id: 'LI010', category: 'Sides', name: 'Applesauce',
      price: 0.75, qty: 8, unit: 'cup', minLevel: 4,
      trackExpiry: false, boxSize: 24, defaultShelfLife: 180,
      batchSeeds: []
    },

    // ── Beverages ─────────────────────────────────────────────────────────
    {
      id: 'LI004', category: 'Beverages', name: 'Chocolate Milk',
      price: 0.75, qty: 48, unit: 'carton', minLevel: 12,
      trackExpiry: true, boxSize: 12, defaultShelfLife: 14,
      batchSeeds: [
        { batchId: 'SH20260623A_LI004_0', shipmentId: 'SH20260623A',
          receivedOffsetDays: -12, expiryOffsetDays: 2,
          qtyReceived: 24, qtyRemaining: 12, notes: 'Older stock — use first' },
        { batchId: 'SH20260703A_LI004_1', shipmentId: 'SH20260703A',
          receivedOffsetDays: -2, expiryOffsetDays: 11,
          qtyReceived: 24, qtyRemaining: 36, notes: '' }
      ]
    },
    {
      id: 'LI015', category: 'Beverages', name: 'White Milk',
      price: 0.75, qty: 30, unit: 'carton', minLevel: 10,
      trackExpiry: true, boxSize: 12, defaultShelfLife: 14,
      batchSeeds: [
        { batchId: 'SH20260630A_LI015_0', shipmentId: 'SH20260630A',
          receivedOffsetDays: -5, expiryOffsetDays: 9,
          qtyReceived: 36, qtyRemaining: 30, notes: '' }
      ]
    },
    {
      id: 'LI005', category: 'Beverages', name: 'Water (small bottle)',
      price: 0.75, qty: 60, unit: 'bottle', minLevel: 12,
      trackExpiry: false, boxSize: 24, defaultShelfLife: 365,
      batchSeeds: []
    },
    {
      id: 'LI006', category: 'Beverages', name: 'Juice Pouch',
      price: 0.75, qty: 11, unit: 'pouch', minLevel: 10,
      trackExpiry: false, boxSize: 32, defaultShelfLife: 365,
      batchSeeds: []
    },
    {
      id: 'LI007', category: 'Beverages', name: 'Iced Tea',
      price: 1.00, qty: 24, unit: 'carton', minLevel: 8,
      trackExpiry: false, boxSize: 18, defaultShelfLife: 180,
      batchSeeds: []
    },

    // ── Snacks ────────────────────────────────────────────────────────────
    {
      id: 'LI009', category: 'Snacks', name: 'Cheese Crackers',
      price: 1.00, qty: 12, unit: 'pack', minLevel: 6,
      trackExpiry: false, boxSize: 24, defaultShelfLife: 180,
      batchSeeds: []
    },
    {
      id: 'LI016', category: 'Snacks', name: 'Pretzels',
      price: 1.00, qty: 3, unit: 'bag', minLevel: 4,
      trackExpiry: false, boxSize: 24, defaultShelfLife: 120,
      batchSeeds: []
    },
    {
      id: 'LI017', category: 'Snacks', name: 'Granola Bar',
      price: 1.00, qty: 22, unit: 'bar', minLevel: 8,
      trackExpiry: false, boxSize: 24, defaultShelfLife: 240,
      batchSeeds: []
    },

    // ── Supplies ────────────────────────────────────────────────────────────
    {
      id: 'LI018', category: 'Supplies', name: 'Napkins',
      price: 0.00, qty: 40, unit: 'pack', minLevel: 10,
      trackExpiry: false, boxSize: 100, defaultShelfLife: 0,
      batchSeeds: []
    },
    {
      id: 'LI019', category: 'Supplies', name: 'Paper Trays',
      price: 0.00, qty: 7, unit: 'sleeve', minLevel: 8,
      trackExpiry: false, boxSize: 50, defaultShelfLife: 0,
      batchSeeds: []
    },

    // ── Special: Buon Gusto hot pizza (isBuonGusto — no carryover stock) ──
    {
      id: 'LI008', category: 'Hot Pizza', name: 'HCS Fresh Pizza (Buon Gusto)',
      price: 2.50, qty: 0, unit: 'slice', minLevel: 0,
      isBuonGusto: true, trackExpiry: false, boxSize: 0, defaultShelfLife: 0,
      batchSeeds: []
    }
  ],

  // Buon Gusto delivery history — 3 Tuesdays + 3 Thursdays (leftover derived).
  bgHistory: [
    { daysAgo: 5,  received: 55, sold: 52 },   // Thu
    { daysAgo: 7,  received: 60, sold: 54 },   // Tue
    { daysAgo: 12, received: 50, sold: 49 },   // Thu
    { daysAgo: 14, received: 60, sold: 51 },   // Tue
    { daysAgo: 19, received: 55, sold: 50 },   // Thu
    { daysAgo: 21, received: 60, sold: 58 }    // Tue
  ],

  // Recent logged shipments (newest first is applied by the admin view).
  recentShipments: [
    { daysAgo: 2,  shipmentId: 'SH20260703A', loggedBy: 'Marcus Ortega',
      notes: 'Northline Foodservice weekly delivery', itemCount: 6 },
    { daysAgo: 9,  shipmentId: 'SH20260626A', loggedBy: 'Dana Whitfield',
      notes: 'Northline Foodservice — milk + beverages restock', itemCount: 4 },
    { daysAgo: 16, shipmentId: 'SH20260619A', loggedBy: 'Priya Nair',
      notes: 'Partial delivery — 1 box pizza short, backordered', itemCount: 5 }
  ],

  // Daily units withdrawn (last ~2 weeks) — drives the trends bar chart.
  timeSeriesDays: [
    { daysAgo: 1,  units: 14 },
    { daysAgo: 2,  units: 9 },
    { daysAgo: 3,  units: 18 },
    { daysAgo: 4,  units: 12 },
    { daysAgo: 5,  units: 22 },
    { daysAgo: 7,  units: 8 },
    { daysAgo: 8,  units: 15 },
    { daysAgo: 9,  units: 19 },
    { daysAgo: 11, units: 11 },
    { daysAgo: 14, units: 16 }
  ],

  // Aggregate consumption (admin trends: item bar + category doughnut).
  itemVelocity: {
    'Chocolate Milk':  41,
    'Pepperoni Pizza': 33,
    'Water (small bottle)': 28,
    'PB&J Sandwich':   19,
    'Juice Pouch':     17,
    'Cheese Pizza':    14,
    'Iced Tea':        12,
    'Chicken Nuggets': 11,
    'White Milk':       9,
    'Cheese Crackers':  8
  },
  categoryUsage: {
    'Beverages':        96,
    'Microwave Foods':  70,
    'Sides':            22,
    'Snacks':           18,
    'Supplies':          6
  }
};
