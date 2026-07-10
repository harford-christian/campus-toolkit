/* data.js — fabricated menu + kitchen data for the Nest Express / Eagles Nest
   concessions POS demo. Shared by index.html (kiosk), tv.html (menu board),
   and kds.html (kitchen display). No real PINs, sheet IDs, ops keys, or logo
   URLs. Time-dependent fields (cooking readyAt, KDS ticket ages) carry plain
   millisecond OFFSETS here and are resolved against Date.now() in mock.js so
   countdowns and ticket colors stay live no matter when the page is opened.

   Item shape (see CartEngine / KioskUI):
     { id, name, type:'simple'|'flavored'|'combo', category, priceCents:int,
       discountable, stock, cooking, lowStockThreshold,
       halfPriceCents?  (only when discountable),
       confirmLowStock? (only when set),
       flavors?, flavorLabel?           (flavored items),
       combo?                            (combo items) }
   `cookingOffsetMs` is a demo-only hint; mock.js turns it into
     cooking:{ readyAtMs } and deletes the hint. */
window.POS_DATA = {
  menuVersion: 'demo01',
  halfOff: false,

  items: [
    // ---------------- Drinks ----------------
    {
      id: 'soda', name: 'Soda', type: 'flavored', category: 'Drinks',
      priceCents: 200, discountable: false, stock: 40,
      cooking: null, lowStockThreshold: 3,
      flavorLabel: 'Soda',
      flavors: ['Coke', 'Diet Coke', 'Sprite', 'Dr Pepper']
    },
    {
      id: 'water', name: 'Bottled Water', type: 'simple', category: 'Drinks',
      priceCents: 150, discountable: false, stock: 60,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'gatorade', name: 'Gatorade', type: 'simple', category: 'Drinks',
      priceCents: 250, discountable: false, stock: 24,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'coffee', name: 'Coffee', type: 'simple', category: 'Drinks',
      priceCents: 200, discountable: false, stock: 30,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'hotcocoa', name: 'Hot Cocoa', type: 'simple', category: 'Drinks',
      priceCents: 200, discountable: false, stock: 3,
      cooking: null, lowStockThreshold: 5, confirmLowStock: true
    },

    // ---------------- Snacks ----------------
    {
      id: 'pretzel', name: 'Soft Pretzel', type: 'simple', category: 'Snacks',
      priceCents: 300, discountable: true, halfPriceCents: 150, stock: 18,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'candybar', name: 'Candy Bar', type: 'simple', category: 'Snacks',
      priceCents: 200, discountable: true, halfPriceCents: 100, stock: 25,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'chips', name: 'Chips', type: 'simple', category: 'Snacks',
      priceCents: 150, discountable: false, stock: 30,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'popcorn', name: 'Popcorn', type: 'simple', category: 'Snacks',
      priceCents: 250, discountable: false, stock: 20,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'nachos', name: 'Nachos', type: 'simple', category: 'Snacks',
      priceCents: 400, discountable: false, stock: 15,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'sunflower', name: 'Sunflower Seeds', type: 'simple', category: 'Snacks',
      priceCents: 150, discountable: false, stock: 22,
      cooking: null, lowStockThreshold: 3
    },

    // ---------------- Grill ----------------
    {
      id: 'cheeseburger', name: 'Cheeseburger', type: 'simple', category: 'Grill',
      priceCents: 500, discountable: false, stock: 20,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'hotdog', name: 'Hot Dog', type: 'simple', category: 'Grill',
      priceCents: 300, discountable: false, stock: 24,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'chickensandwich', name: 'Chicken Sandwich', type: 'simple', category: 'Grill',
      priceCents: 550, discountable: false, stock: 12,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'pizza', name: 'Pizza Slice', type: 'simple', category: 'Grill',
      priceCents: 350, discountable: false, stock: 0,
      cooking: null, cookingOffsetMs: 8 * 60000, lowStockThreshold: 3
    },
    {
      id: 'cfacombo', name: 'CFA Combo', type: 'combo', category: 'Grill',
      priceCents: 0, discountable: false, stock: 18,
      cooking: null, lowStockThreshold: 3,
      combo: {
        prompt: 'Pick a drink for the CFA Combo.',
        options: [
          {
            id: 'cfa-soda', label: 'w/ Soda', detailsName: 'CFA Soda Combo',
            priceCents: 700, halfPriceCents: null,
            includesItemId: 'soda', includesQty: 1, pruneRank: 1
          },
          {
            id: 'cfa-water', label: 'w/ Water', detailsName: 'CFA Water Combo',
            priceCents: 650, halfPriceCents: null,
            includesItemId: 'water', includesQty: 1, pruneRank: 2
          }
        ],
        pruneOrder: ['cfa-soda', 'cfa-water']
      }
    },

    // ---------------- Sweets ----------------
    {
      id: 'ricekrispie', name: 'Rice Krispie Treat', type: 'simple', category: 'Sweets',
      priceCents: 200, discountable: true, halfPriceCents: 100, stock: 20,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'cookie', name: 'Cookie', type: 'simple', category: 'Sweets',
      priceCents: 150, discountable: false, stock: 26,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'brownie', name: 'Brownie', type: 'simple', category: 'Sweets',
      priceCents: 200, discountable: false, stock: 18,
      cooking: null, lowStockThreshold: 3
    },
    {
      id: 'icecream', name: 'Ice Cream Sandwich', type: 'simple', category: 'Sweets',
      priceCents: 250, discountable: false, stock: 16,
      cooking: null, lowStockThreshold: 3
    }
  ],

  // Seed KDS tickets. createdOffsetMs is relative to Date.now() at page load:
  //   -470000 → red (>6m), -240000 → amber (3–6m), -90000/-30000 → green (<3m).
  kdsSeed: [
    {
      orderId: 'seed-marcus', rowIndex: 2, customerName: 'Marcus',
      createdOffsetMs: -470000,
      lines: ['Cheeseburger ×2', 'Soda ×1 — Coke ×1']
    },
    {
      orderId: 'seed-priya', rowIndex: 3, customerName: 'Priya',
      createdOffsetMs: -240000,
      lines: ['Chicken Sandwich ×1', 'Soft Pretzel ×1', 'Bottled Water ×1']
    },
    {
      orderId: 'seed-jordan', rowIndex: 4, customerName: 'Jordan',
      createdOffsetMs: -90000,
      lines: ['CFA Combo w/ Soda ×2', 'Soda ×2 — Sprite ×2', 'Nachos ×1']
    },
    {
      orderId: 'seed-sam', rowIndex: 5, customerName: 'Sam',
      createdOffsetMs: -30000,
      lines: ['Hot Dog ×1', 'Cookie ×2']
    }
  ]
};
