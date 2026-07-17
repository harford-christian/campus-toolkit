/* data.js — fabricated content for the Gym TV demo. Keeps HCS/Eagles branding;
   invents opponents. Photos are placeholder images (no real people). Event dates
   and cooking timers are computed relative to now in mock.js. */
window.GYMTV_DATA = {
  demoUser: 'demo@harfordchristian.org',
  sports: ['JV Boys Basketball', 'JV Girls Basketball', 'MS Boys Basketball', 'MS Girls Basketball',
    'V Boys Basketball', 'V Girls Basketball', 'JV Girls Volleyball', 'MS Girls Volleyball', 'V Girls Volleyball'],
  carousel: [
    'https://picsum.photos/seed/gym1/1280/720',
    'https://picsum.photos/seed/gym2/1280/720',
    'https://picsum.photos/seed/gym3/1280/720'
  ],
  gamePhotos: [
    'https://picsum.photos/seed/bball1/1280/720',
    'https://picsum.photos/seed/bball2/1280/720',
    'https://picsum.photos/seed/bball3/1280/720'
  ],
  tickerIdle: ['Winter Spirit Week — Dec 9-13', 'Boosters meeting Thursday 6pm in the library', 'Go Eagles!'],
  tickerGame: ['Go Eagles! Beat Northgate!', 'Concessions open all game — cash & card'],
  infoCards: [
    'The Eagles varsity boys are 8-2 on the season — best start in five years.',
    'Did you know? HCS has won 3 conference volleyball titles in the last decade.',
    'Senior Night is Feb 6 — come honor our varsity athletes.'
  ],
  // Concession menu shown in game mode (priceCents; stock<=0 sold out; <=5 low; cooking = countdown).
  menu: [
    { id: 'hotdog', name: 'Hot Dog', type: 'simple', category: 'Food', priceCents: 200, discountable: true, stock: 24, cooking: null, lowStockThreshold: 5, backedBySpecial: false },
    { id: 'nachos', name: 'Nachos', type: 'simple', category: 'Food', priceCents: 300, discountable: true, stock: 3, cooking: null, lowStockThreshold: 5, backedBySpecial: false },
    { id: 'pretzel', name: 'Soft Pretzel', type: 'simple', category: 'Food', priceCents: 250, discountable: true, stock: 0, cooking: null, lowStockThreshold: 5, backedBySpecial: false },
    { id: 'popcorn', name: 'Popcorn', type: 'simple', category: 'Food', priceCents: 150, discountable: false, stock: null, cooking: { readyInMin: 7 }, lowStockThreshold: 5, backedBySpecial: false },
    { id: 'water', name: 'Water', type: 'simple', category: 'Food', priceCents: 100, discountable: false, stock: 40, cooking: null, lowStockThreshold: 10, backedBySpecial: false },
    { id: 'gatorade', name: 'Gatorade', type: 'simple', category: 'Food', priceCents: 200, discountable: false, stock: 12, cooking: null, lowStockThreshold: 6, backedBySpecial: false },
    { id: 'candy', name: 'Candy Bar', type: 'simple', category: 'Food', priceCents: 150, discountable: true, stock: 18, cooking: null, lowStockThreshold: 6, backedBySpecial: false }
  ],
  // Upcoming events (inDays/time expanded to ISO in mock.js); "Home" ones use the school location.
  events: [
    { label: 'V Boys Basketball', summary: 'Eagles vs Northgate Christian', inDays: 1, time: '18:00', home: true },
    { label: 'V Girls Volleyball', summary: 'Eagles @ Cedar Valley Academy', inDays: 3, time: '17:30', home: false },
    { label: 'MS Boys Basketball', summary: 'Eagles vs Grace Prep', inDays: 5, time: '16:00', home: true },
    { label: 'V Girls Basketball', summary: 'Eagles vs St. Andrew’s', inDays: 6, time: '19:00', home: true }
  ],
  // Message/promo ad slides (mirrors GymControl.setMessageAds / content.ads shape). These rotate
  // as full-screen "promoAd" slides on the display. startShow/endShow blank = always active.
  messageAds: [
    { id: 'ad_redout', headline: 'RED OUT', subhead: 'Wear red — pack the gym!', dateText: 'Fri Dec 13', opponent: 'Northgate Christian', theme: 'redout', startShow: '', endShow: '', enabled: true },
    { id: 'ad_senior', headline: 'SENIOR NIGHT', subhead: 'Honoring our varsity seniors', dateText: 'Feb 6', opponent: '', theme: 'senior-night', startShow: '', endShow: '', enabled: true },
    { id: 'ad_boosters', headline: 'GO EAGLES', subhead: 'Concessions open — cash & card', dateText: '', opponent: '', theme: 'gold', startShow: '', endShow: '', enabled: true }
  ]
};
