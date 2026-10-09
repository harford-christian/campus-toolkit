/* data.js — fabricated records for the Purchasing & Procurement demo.

   Nobody here is real: every person, email (@example.edu), phone (410-555-xxxx), order and
   vendor contact is invented. The signed-in user is Jordan Rivera, an Owner (the role that
   sees purchasing, the approver's actions and every management tab).

   Dates are written as of the demo's ANCHOR day (2026-10-08). mock.js slides every date — and
   the date inside each ORD-yyyymmdd-nnnn id — forward by however many whole days separate the
   anchor from the day the page is opened, so "current school year" views are never empty and
   the ids keep matching their dates. Fields the server derives (school year, line ids, order
   totals net of adjustments and returns, returned quantities) are computed in mock.js from
   these records, the same way Code.js derives them from the sheets.

   Order lines: unitCost is the requested price until purchasing prices the order (an order
   with no pricedAt has a blank total, exactly as the Orders sheet does). Line ids are
   <orderId>-<n>, the server's own scheme. */
window.PURCHASING_DATA = {
  anchor: '2026-10-08',

  currentUser: { email: 'jrivera@example.edu', firstName: 'Jordan', lastName: 'Rivera', role: 'Owner' },

  // The Users sheet. role = System_Role; dept = Default_Dept; alt = Alt_Depts.
  staff: [
    { email: 'jrivera@example.edu',         first: 'Jordan', last: 'Rivera',  dept: 'Science',        role: 'Owner',     title: 'Science Department Chair', manager: 'mlee@example.edu',    alt: 'Fine Arts' },
    { email: 'pquinlan@example.edu',        first: 'Pat',    last: 'Quinlan', dept: 'Administration', role: 'Manager',   title: 'Purchasing Coordinator',   manager: 'mlee@example.edu',    alt: '' },
    { email: 'mlee@example.edu',            first: 'Morgan', last: 'Lee',     dept: 'Administration', role: 'Approver',  title: 'Business Manager',         manager: '',                    alt: '' },
    { email: 'backup.approver@example.edu', first: 'Robin',  last: 'Ellis',   dept: 'Administration', role: 'Requestor', title: 'Office Manager',           manager: 'mlee@example.edu',    alt: '' },
    { email: 'jwolf@example.edu',           first: 'Jamie',  last: 'Wolf',    dept: 'Science',        role: 'Requestor', title: 'Biology Teacher',          manager: 'jrivera@example.edu', alt: '' },
    { email: 'akim@example.edu',            first: 'Avery',  last: 'Kim',     dept: 'Science',        role: 'Requestor', title: 'Chemistry Teacher',        manager: 'jrivera@example.edu', alt: '' },
    { email: 'achen@example.edu',           first: 'Alex',   last: 'Chen',    dept: 'Fine Arts',      role: 'Requestor', title: 'Art Teacher',              manager: 'mlee@example.edu',    alt: '' },
    { email: 'spatel@example.edu',          first: 'Sam',    last: 'Patel',   dept: 'Athletics',      role: 'Requestor', title: 'Athletic Director',        manager: 'mlee@example.edu',    alt: '' },
    { email: 'tbrooks@example.edu',         first: 'Taylor', last: 'Brooks',  dept: 'English',        role: 'Requestor', title: 'English Teacher',          manager: 'mlee@example.edu',    alt: '' },
    { email: 'cnguyen@example.edu',         first: 'Casey',  last: 'Nguyen',  dept: 'Operations',     role: 'Requestor', title: 'Facilities Lead',          manager: 'mlee@example.edu',    alt: '' },
    { email: 'dmorales@example.edu',        first: 'Drew',   last: 'Morales', dept: 'Mathematics',    role: 'Requestor', title: 'Math Teacher',             manager: 'mlee@example.edu',    alt: '' },
    { email: 'qfoster@example.edu',         first: 'Quinn',  last: 'Foster',  dept: 'Technology',     role: 'Finance',   title: 'Technology Coordinator',   manager: 'mlee@example.edu',    alt: '' }
  ],

  // Jordan charges Science by default and may also charge Fine Arts.
  depts: { primary: 'Science', alternates: ['Fine Arts'] },

  // Departments sheet (getDepartments record shape). Budgets are per school year.
  departments: [
    { name: 'Administration', category: 'Operations', description: 'Front office, business office, purchasing', active: true,  headEmail: 'mlee@example.edu',    budget: 6000,  ouPath: '/Staff/Administration', createdAt: '2024-08-12T09:00:00', viewers: '' },
    { name: 'Athletics',      category: 'Athletics',  description: 'Teams, equipment, uniforms',                 active: true,  headEmail: 'spatel@example.edu',  budget: 8000,  ouPath: '/Staff/Athletics',      createdAt: '2024-08-12T09:00:00', viewers: '' },
    { name: 'English',        category: 'Faculty',    description: 'Upper and lower school English',             active: true,  headEmail: 'tbrooks@example.edu', budget: 3000,  ouPath: '/Staff/Faculty',        createdAt: '2024-08-12T09:00:00', viewers: '' },
    { name: 'Fine Arts',      category: 'Faculty',    description: 'Visual art, music and drama',                active: true,  headEmail: 'achen@example.edu',   budget: 4500,  ouPath: '/Staff/Faculty',        createdAt: '2024-08-12T09:00:00', viewers: 'jrivera@example.edu' },
    { name: 'Mathematics',    category: 'Faculty',    description: 'Math department',                            active: true,  headEmail: 'dmorales@example.edu',budget: 3500,  ouPath: '/Staff/Faculty',        createdAt: '2024-08-12T09:00:00', viewers: '' },
    { name: 'Operations',     category: 'Operations', description: 'Facilities, custodial, grounds',             active: true,  headEmail: 'cnguyen@example.edu', budget: 9000,  ouPath: '/Staff/Operations',     createdAt: '2024-08-12T09:00:00', viewers: '' },
    { name: 'Science',        category: 'Faculty',    description: 'Biology, chemistry, physics labs',           active: true,  headEmail: 'jrivera@example.edu', budget: 1000,  ouPath: '/Staff/Faculty',        createdAt: '2024-08-12T09:00:00', viewers: '' },
    { name: 'Technology',     category: 'Operations', description: 'Devices, carts, classroom AV',               active: true,  headEmail: 'qfoster@example.edu', budget: 12000, ouPath: '/Staff/Technology',     createdAt: '2025-01-06T09:00:00', viewers: '' },
    { name: 'Yearbook',       category: 'Activities', description: 'Retired; merged into Fine Arts',             active: false, headEmail: '',                    budget: null,  ouPath: '',                      createdAt: '2024-08-12T09:00:00', viewers: '' }
  ],

  // Why Jordan sees Team Orders: manages one teacher, heads Science, views Fine Arts.
  teamAccess: { asManager: ['jwolf@example.edu', 'akim@example.edu'], asHead: ['Science'], asViewer: ['Fine Arts'] },

  // The Owner's PIN row. The Owner is on the PIN bypass list (the page shows an Owner no PIN box), but a
  // PIN that IS typed must be right. Demo PIN: 1234.
  approverSettings: { role: 'Owner', hasPin: true, requireOnAccess: false, intervalMinutes: 30, amountThreshold: 500, isBypass: true, pin: '1234' },

  // Catalog_Items (Active rows). image '' — no Drive images in the demo. The two dollies let the
  // page's "you'll need a dollie" reminder add the matching size automatically.
  catalog: {
    office: [
      { id: 'OFF-001', category: 'Office Supply', name: 'Copy Paper (Case of 10 Reams)', image: '', leadTime: '2-3 business days', colors: [], options: ['White', 'Bright White'], price: 44.99 },
      { id: 'OFF-002', category: 'Office Supply', name: 'Dry-Erase Markers (Bulk 48)', image: '', leadTime: '3-5 business days', colors: ['Assorted', 'Black'], options: [], price: 22.5 },
      { id: 'OFF-003', category: 'Office Supply', name: 'Sticky Notes (Pack of 24)', image: '', leadTime: '2-3 business days', colors: [], options: [], price: 14.75 },
      { id: 'OFF-004', category: 'Office Supply', name: 'File Folders (Box of 100)', image: '', leadTime: '3-5 business days', colors: ['Manila', 'Assorted'], options: ['Letter', 'Legal'], price: 18.0 },
      { id: 'OFF-005', category: 'Office Supply', name: 'Ballpoint Pens (Dozen)', image: '', leadTime: '2-3 business days', colors: ['Black', 'Blue', 'Red'], options: [], price: 6.99 },
      { id: 'OFF-006', category: 'Office Supply', name: 'Laminating Pouches (Box of 200)', image: '', leadTime: '5-7 business days', colors: [], options: [], price: 27.0 },
      { id: 'OFF-007', category: 'Office Supply', name: 'Toner Cartridge (HP 26X)', image: '', leadTime: '3-5 business days', colors: [], options: [], price: 89.0 },
      { id: 'OFF-008', category: 'Office Supply', name: 'Storage Bins with Lids (Set of 6)', image: '', leadTime: '5-7 business days', colors: ['Clear', 'Blue'], options: ['Small', 'Large'], price: 34.95 }
    ],
    furniture: [
      { id: 'FUR-001', category: 'Furniture', name: 'Student Desk (Adjustable Height)', image: '', leadTime: '2-3 weeks', colors: ['Maple', 'Gray'], options: [], price: 129.0 },
      { id: 'FUR-002', category: 'Furniture', name: 'Ergonomic Task Chair', image: '', leadTime: '1-2 weeks', colors: ['Black', 'Navy', 'Gray'], options: [], price: 165.5 },
      { id: 'FUR-003', category: 'Furniture', name: '4-Drawer Filing Cabinet', image: '', leadTime: '2-3 weeks', colors: ['Black', 'Putty'], options: ['Letter', 'Legal'], price: 219.0 },
      { id: 'FUR-004', category: 'Furniture', name: 'Bookshelf (5-Shelf)', image: '', leadTime: '2-3 weeks', colors: ['Oak', 'Espresso'], options: ['36 x 12 x 72', '36 x 18 x 72'], price: 98.75 },
      { id: 'FUR-005', category: 'Furniture', name: 'Folding Utility Table (6 ft)', image: '', leadTime: '1-2 weeks', colors: [], options: [], price: 74.0 },
      { id: 'FUR-006', category: 'Furniture', name: 'Mobile Whiteboard (Double-Sided)', image: '', leadTime: '2-3 weeks', colors: [], options: [], price: 249.0 },
      { id: 'FUR-007', category: 'Furniture', name: 'Classroom Rug (8x12)', image: '', leadTime: '2-4 weeks', colors: ['Primary', 'Calm Tones'], options: [], price: 189.0 },
      { id: 'FUR-008', category: 'Furniture', name: 'Stackable Student Chair', image: '', leadTime: '1-2 weeks', colors: ['Red', 'Blue', 'Green'], options: ['14 in', '16 in', '18 in'], price: 32.0 },
      { id: 'FUR-009', category: 'Furniture', name: 'Filing Cabinet Caddy', image: '', leadTime: '1-2 weeks', colors: [], options: ['Letter (15 in)', 'Legal (18 in)'], price: 39.0 },
      { id: 'FUR-010', category: 'Furniture', name: 'Storage Cabinet Dollies (Pair)', image: '', leadTime: '1-2 weeks', colors: [], options: ['36 x 12', '36 x 18'], price: 58.0 }
    ],
    cleaning: [
      { id: 'CLN-001', category: 'Cleaning & Maintenance', name: 'Disinfecting Wipes (Case of 6)', image: '', leadTime: '2-3 business days', colors: [], options: ['Lemon', 'Unscented'], price: 38.4 },
      { id: 'CLN-002', category: 'Cleaning & Maintenance', name: 'Paper Towels (Case of 12)', image: '', leadTime: '2-3 business days', colors: [], options: [], price: 36.0 },
      { id: 'CLN-003', category: 'Cleaning & Maintenance', name: 'Trash Bags 55 gal (Case)', image: '', leadTime: '3-5 business days', colors: ['Black', 'Clear'], options: [], price: 42.0 },
      { id: 'CLN-004', category: 'Cleaning & Maintenance', name: 'Hand Soap Refill (Case)', image: '', leadTime: '3-5 business days', colors: [], options: [], price: 44.0 },
      { id: 'CLN-005', category: 'Cleaning & Maintenance', name: 'Neutral Floor Cleaner (4 x 1 gal)', image: '', leadTime: '3-5 business days', colors: [], options: [], price: 52.5 },
      { id: 'CLN-006', category: 'Cleaning & Maintenance', name: 'Microfiber Cloths (Pack of 48)', image: '', leadTime: '2-3 business days', colors: ['Blue', 'Assorted'], options: [], price: 24.99 },
      { id: 'CLN-007', category: 'Cleaning & Maintenance', name: 'Nitrile Gloves (Box of 100)', image: '', leadTime: '2-3 business days', colors: [], options: ['Small', 'Medium', 'Large'], price: 11.5 },
      { id: 'CLN-008', category: 'Cleaning & Maintenance', name: 'Wet Mop Heads (Pack of 6)', image: '', leadTime: '5-7 business days', colors: [], options: [], price: 29.0 }
    ]
  },

  // Vendor_Suppliers sheet (2-D, header row first). Contacts are fabricated.
  vendors: [
    ['Vendor', 'Account_Rep', 'Phone', 'Email', 'Notes'],
    ['Amazon Business', 'Business support', '410-555-0101', 'amazon.orders@example.edu', 'Tax-exempt account on file'],
    ['Blick Art Materials', 'Lena Ortiz', '410-555-0102', 'blick.rep@example.edu', 'Education pricing'],
    ['BSN Sports', 'Marcus Hale', '410-555-0103', 'bsn.rep@example.edu', 'Net 30'],
    ['Carolina Biological', 'Priya Shah', '410-555-0104', 'carolina.rep@example.edu', 'Live specimens ship Mon-Wed only'],
    ['CDW-G', 'Evan Brooks', '410-555-0105', 'cdwg.rep@example.edu', 'Quote required over $1,000'],
    ['Lakeshore Learning', 'Dana Price', '410-555-0106', 'lakeshore.rep@example.edu', ''],
    ['Office Depot', 'Store 0412', '410-555-0107', 'officedepot.rep@example.edu', ''],
    ['School Specialty', 'Chris Young', '410-555-0108', 'schoolspecialty.rep@example.edu', 'Free freight over $99'],
    ['Staples', 'Account desk', '410-555-0109', 'staples.rep@example.edu', 'Next-day delivery'],
    ['Uline', 'Rae Collins', '410-555-0110', 'uline.rep@example.edu', 'Janitorial and shipping supplies'],
    ['Grainger', 'Tom Reyes', '410-555-0111', 'grainger.rep@example.edu', 'Facilities equipment']
  ],

  // Orders. One of every status, plus two earlier school years of closed orders for the analytics.
  orders: [
    // ---- open work, SY26-27 ----
    { id: 'ORD-20261007-3310', date: '2026-10-07T09:12:00', status: 'Pending Approval', requestorEmail: 'jrivera@example.edu', dept: 'Science',
      priority: true, neededBy: '2026-10-20', additionalNotify: 'jwolf@example.edu',
      items: [
        { name: 'Carolina Biological - Prepared Microscope Slides (Set of 25)', qty: 2, unitCost: 45.0, category: 'Custom', notes: 'Cell biology unit, 7th grade', url: 'https://www.carolina.com/' },
        { name: 'Carolina Biological - Borosilicate Beaker Set', qty: 1, unitCost: 38.5, category: 'Custom', notes: '', url: 'https://www.carolina.com/' }
      ] },
    { id: 'ORD-20261006-4127', date: '2026-10-06T14:05:00', status: 'Pending Approval', requestorEmail: 'achen@example.edu', dept: 'Fine Arts',
      items: [
        { name: 'Blick - Acrylic Paint Class Pack', qty: 3, unitCost: 64.0, category: 'Custom', notes: 'Fall mural project', url: 'https://www.dickblick.com/' },
        { name: 'Blick - Canvas Panels (Bulk 50)', qty: 2, unitCost: 42.0, category: 'Custom', notes: '', url: 'https://www.dickblick.com/' },
        { name: 'Amazon - Drying Rack (25 Shelf)', qty: 1, unitCost: 89.99, category: 'Custom', notes: 'Ours lost two shelves', url: 'https://www.amazon.com/' }
      ] },
    { id: 'ORD-20261005-4130', date: '2026-10-05T08:40:00', status: 'Pending Approval', requestorEmail: 'achen@example.edu', dept: 'Fine Arts',
      items: [ { name: 'Blick - Kiln Shelf Paper (Roll)', qty: 1, unitCost: 24.5, category: 'Custom', notes: 'Forgot this on my last order', url: 'https://www.dickblick.com/' } ] },
    { id: 'ORD-20261005-5150', date: '2026-10-05T11:20:00', status: 'Pending Approval', requestorEmail: 'dmorales@example.edu', dept: 'Mathematics',
      items: [
        { name: 'Dry-Erase Markers (Bulk 48)', qty: 2, unitCost: 22.5, category: 'Office Supply', color: 'Black', notes: 'Black' },
        { name: 'File Folders (Box of 100)', qty: 1, unitCost: 18.0, category: 'Office Supply', color: 'Manila', notes: 'Manila | Letter' }
      ] },
    { id: 'ORD-20261002-2884', date: '2026-10-02T10:15:00', status: 'Under Review', requestorEmail: 'tbrooks@example.edu', dept: 'English',
      vendor: 'Amazon Business', bank: 'HCS Operating', payType: 'Credit Card', pricedAt: '2026-10-02T15:30:00',
      items: [ { name: 'Amazon - Classroom Novel Set (30 copies)', qty: 1, unitCost: 210.0, category: 'Custom', notes: 'Replacing worn copies', url: 'https://www.amazon.com/' } ] },
    { id: 'ORD-20261001-6120', date: '2026-10-01T09:05:00', status: 'Pending Signature', requestorEmail: 'jwolf@example.edu', dept: 'Science',
      vendor: 'School Specialty', bank: 'HCS Operating', payType: 'Credit Net 30', pricedAt: '2026-10-01T13:45:00', assignedApprover: 'backup.approver@example.edu',
      items: [
        { name: 'School Specialty - Lab Safety Goggles (Class Set of 30)', qty: 1, unitCost: 180.0, category: 'Custom', notes: '', url: 'https://www.schoolspecialty.com/' },
        { name: 'School Specialty - Digital Scale 0.1g', qty: 2, unitCost: 34.95, category: 'Custom', notes: 'Chem lab', url: 'https://www.schoolspecialty.com/' }
      ] },
    { id: 'ORD-20260930-5512', date: '2026-09-30T13:50:00', status: 'Needs Info', requestorEmail: 'jrivera@example.edu', dept: 'Science',
      items: [ { name: 'Vernier - Motion Detector', qty: 2, unitCost: 89.0, category: 'Custom', notes: 'Physics labs', url: 'https://www.vernier.com/' } ] },
    { id: 'ORD-20260929-7723', date: '2026-09-29T08:30:00', status: 'Pending Signature', requestorEmail: 'tbrooks@example.edu', dept: 'English',
      vendor: 'Amazon Business', bank: 'HCS Operating', payType: 'Credit Card', pricedAt: '2026-09-30T10:10:00',
      adjustments: [ { label: 'Shipping', type: 'charge', mode: 'flat', value: 12.5 } ],
      items: [
        { name: 'Amazon - Whiteboard Markers (Bulk 48)', qty: 4, unitCost: 12.99, category: 'Custom', notes: '', url: 'https://www.amazon.com/' },
        { name: 'Amazon - Sentence Strips (Pack of 100)', qty: 3, unitCost: 8.49, category: 'Custom', notes: '', url: 'https://www.amazon.com/' },
        { name: 'Amazon - Sticky Note Pads (24 pack)', qty: 1, unitCost: 14.75, category: 'Custom', notes: '', url: 'https://www.amazon.com/' }
      ] },
    { id: 'ORD-20260925-3301', date: '2026-09-25T15:00:00', status: 'Merged', requestorEmail: 'tbrooks@example.edu', dept: 'English', parentId: 'ORD-20260929-7723',
      items: [ { name: 'Amazon - Sticky Note Pads (24 pack)', qty: 1, unitCost: 14.75, category: 'Custom', notes: '', url: 'https://www.amazon.com/' } ] },
    { id: 'ORD-20260925-1590', date: '2026-09-25T08:30:00', status: 'On Hold', requestorEmail: 'spatel@example.edu', dept: 'Athletics',
      vendor: 'BSN Sports', bank: 'Activities', payType: 'Credit Net 30', pricedAt: '2026-09-28T09:30:00',
      items: [
        { name: 'BSN Sports - Practice Jersey Set', qty: 20, unitCost: 18.75, category: 'Custom', notes: 'Sizes on the attached roster', url: 'https://www.bsnsports.com/', attachmentFileName: 'jersey-sizes.pdf' },
        { name: 'BSN Sports - Team Water Bottles', qty: 24, unitCost: 6.5, category: 'Custom', notes: '', url: 'https://www.bsnsports.com/' }
      ] },
    { id: 'ORD-20260922-4055', date: '2026-09-22T10:15:00', status: 'Approved', requestorEmail: 'jrivera@example.edu', dept: 'Science',
      vendor: 'Amazon Business', bank: 'HCS Operating', payType: 'Credit Card', pricedAt: '2026-09-23T11:00:00',
      approvedAt: '2026-09-24T15:30:00', approvedBy: 'mlee@example.edu', additionalNotify: 'jwolf@example.edu',
      adjustments: [ { label: 'Promo code', type: 'discount', mode: 'flat', value: 5 } ],
      items: [
        { name: 'Amazon - Chromebook Headphones (10 pack)', qty: 2, unitCost: 39.99, category: 'Custom', notes: 'Lab stations', url: 'https://www.amazon.com/', status: 'Pending' },
        { name: 'Amazon - USB-C Charging Cables (6 pack)', qty: 1, unitCost: 21.99, category: 'Custom', notes: '', url: 'https://www.amazon.com/', status: 'Ordered' }
      ] },
    { id: 'ORD-20260918-7004', date: '2026-09-18T12:40:00', status: 'Approved', requestorEmail: 'jwolf@example.edu', dept: 'Science',
      vendor: 'Lakeshore Learning', bank: 'HCS Operating', payType: 'Check', pricedAt: '2026-09-21T09:00:00',
      approvedAt: '2026-09-22T16:10:00', approvedBy: 'mlee@example.edu',
      items: [
        { name: 'Lakeshore Learning - Magnetic Molecular Model Kit', qty: 3, unitCost: 29.99, category: 'Custom', notes: '', url: 'https://www.lakeshorelearning.com/', status: 'Pending' },
        { name: 'Stackable Student Chair', qty: 12, unitCost: 32.0, category: 'Furniture', color: 'Blue', notes: 'Blue | 16 in', status: 'Pending' }
      ] },
    { id: 'ORD-20260915-6631', date: '2026-09-15T09:00:00', status: 'Fulfillment', requestorEmail: 'mlee@example.edu', dept: 'Administration',
      vendor: 'Staples', bank: 'HCS Operating', payType: 'Credit Net 30', pricedAt: '2026-09-15T14:00:00',
      approvedAt: '2026-09-16T10:00:00', approvedBy: 'jrivera@example.edu', fulfillmentAt: '2026-09-21T09:00:00', packingSummary: '1 packing list',
      items: [
        { name: 'Copy Paper (Case of 10 Reams)', qty: 5, unitCost: 44.99, category: 'Office Supply', notes: 'White', status: 'Arrived' },
        { name: 'Toner Cartridge (HP 26X)', qty: 3, unitCost: 89.0, category: 'Office Supply', notes: 'Front office printer', status: 'Backordered', fulfillNote: 'Vendor ETA two weeks' },
        { name: 'Sticky Notes (Pack of 24)', qty: 2, unitCost: 14.75, category: 'Office Supply', notes: '', status: 'Delayed', fulfillNote: 'Ships separately' }
      ] },
    { id: 'ORD-20260910-8846', date: '2026-09-10T15:40:00', status: 'Cancellation Requested', requestorEmail: 'jrivera@example.edu', dept: 'Science',
      vendor: 'Amazon Business', bank: 'HCS Operating', payType: 'Credit Card', pricedAt: '2026-09-11T14:20:00',
      approvedAt: '2026-09-14T09:15:00', approvedBy: 'mlee@example.edu', preCancelStatus: 'Approved',
      cancelJustification: 'The science supplier quoted the same document camera for less. Please cancel this one before it ships.',
      items: [ { name: 'Amazon - Classroom Document Camera', qty: 1, unitCost: 129.99, category: 'Custom', notes: 'For the lab bench', url: 'https://www.amazon.com/', attachmentFileName: 'quote.pdf' } ] },
    { id: 'ORD-20260908-2207', date: '2026-09-08T09:50:00', status: 'Closed/Paid', requestorEmail: 'cnguyen@example.edu', dept: 'Operations',
      vendor: 'Uline', bank: 'HCS Operating', payType: 'Credit Net 30', pricedAt: '2026-09-08T13:00:00',
      approvedAt: '2026-09-09T10:30:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-09-14T08:00:00', closedAt: '2026-09-30T16:00:00',
      packingSummary: '1 packing list', adjustments: [ { label: 'Freight', type: 'charge', mode: 'flat', value: 18 } ],
      items: [
        { name: 'Disinfecting Wipes (Case of 6)', qty: 4, unitCost: 38.4, category: 'Cleaning & Maintenance', notes: 'Unscented', status: 'Arrived' },
        { name: 'Trash Bags 55 gal (Case)', qty: 3, unitCost: 42.0, category: 'Cleaning & Maintenance', color: 'Black', notes: 'Black', status: 'Arrived' }
      ] },
    { id: 'ORD-20260904-5240', date: '2026-09-04T10:45:00', status: 'Cancelled', requestorEmail: 'spatel@example.edu', dept: 'Athletics',
      preCancelStatus: 'Pending Approval', cancelJustification: 'The fall schedule changed; we will not need these this season.',
      items: [ { name: 'BSN Sports - Agility Cone Set', qty: 4, unitCost: 22.0, category: 'Custom', notes: '', url: 'https://www.bsnsports.com/' } ] },
    { id: 'ORD-20260903-9012', date: '2026-09-03T14:20:00', status: 'Rejected', requestorEmail: 'cnguyen@example.edu', dept: 'Operations',
      vendor: 'Grainger', bank: 'HCS Operating', payType: 'Check', pricedAt: '2026-09-04T09:00:00',
      items: [ { name: 'Grainger - Pressure Washer (3100 PSI)', qty: 1, unitCost: 429.0, category: 'Custom', notes: 'Sidewalks and bleachers', url: 'https://www.grainger.com/' } ] },
    { id: 'ORD-20260901-1178', date: '2026-09-01T11:30:00', status: 'Split', requestorEmail: 'jrivera@example.edu', dept: 'Science',
      items: [
        { name: 'Carolina Biological - Owl Pellets (Class Pack)', qty: 1, unitCost: 64.5, category: 'Custom', notes: '', url: 'https://www.carolina.com/' },
        { name: 'Amazon - Petri Dishes (Sleeve of 100)', qty: 2, unitCost: 17.99, category: 'Custom', notes: '', url: 'https://www.amazon.com/' },
        { name: 'Amazon - Nitrile Gloves (Box of 100)', qty: 3, unitCost: 11.5, category: 'Custom', notes: 'Medium', url: 'https://www.amazon.com/' }
      ] },
    { id: 'ORD-20260901-1178-A', date: '2026-09-01T11:30:00', status: 'Closed/Paid', requestorEmail: 'jrivera@example.edu', dept: 'Science', parentId: 'ORD-20260901-1178',
      vendor: 'Carolina Biological', bank: 'HCS Operating', payType: 'Credit Card', pricedAt: '2026-09-02T09:30:00',
      approvedAt: '2026-09-02T15:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-09-08T10:00:00', closedAt: '2026-09-19T11:00:00', packingSummary: '1 packing list',
      adjustments: [ { label: 'Shipping', type: 'charge', mode: 'flat', value: 9.95 } ],
      items: [ { name: 'Carolina Biological - Owl Pellets (Class Pack)', qty: 1, unitCost: 64.5, category: 'Custom', notes: '', url: 'https://www.carolina.com/', status: 'Arrived' } ] },
    { id: 'ORD-20260901-1178-B', date: '2026-09-01T11:30:00', status: 'Fulfillment', requestorEmail: 'jrivera@example.edu', dept: 'Science', parentId: 'ORD-20260901-1178',
      vendor: 'Amazon Business', bank: 'HCS Operating', payType: 'Credit Card', pricedAt: '2026-09-02T09:35:00',
      approvedAt: '2026-09-02T15:05:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-09-05T13:00:00', packingSummary: '1 packing list',
      items: [
        { name: 'Amazon - Petri Dishes (Sleeve of 100)', qty: 2, unitCost: 17.99, category: 'Custom', notes: '', url: 'https://www.amazon.com/', status: 'Arrived' },
        { name: 'Amazon - Nitrile Gloves (Box of 100)', qty: 3, unitCost: 11.5, category: 'Custom', notes: 'Medium', url: 'https://www.amazon.com/', status: 'Ordered' }
      ] },

    // ---- SY25-26, all closed (the prior year the trends compare against) ----
    { id: 'ORD-20250916-1102', date: '2025-09-16T10:00:00', status: 'Closed/Paid', requestorEmail: 'jrivera@example.edu', dept: 'Science', vendor: 'Carolina Biological', bank: 'HCS Operating', payType: 'Credit Card',
      pricedAt: '2025-09-17T09:00:00', approvedAt: '2025-09-18T11:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2025-09-24T10:00:00', closedAt: '2025-10-03T15:00:00',
      items: [ { name: 'Carolina Biological - Dissection Kit (Class Set)', qty: 1, unitCost: 189.0, category: 'Custom', notes: '', url: 'https://www.carolina.com/', status: 'Arrived' } ] },
    { id: 'ORD-20251021-1440', date: '2025-10-21T09:30:00', status: 'Closed/Paid', requestorEmail: 'mlee@example.edu', dept: 'Administration', vendor: 'Staples', bank: 'HCS Operating', payType: 'Credit Net 30',
      pricedAt: '2025-10-21T13:00:00', approvedAt: '2025-10-22T09:00:00', approvedBy: 'jrivera@example.edu', fulfillmentAt: '2025-10-24T10:00:00', closedAt: '2025-11-07T12:00:00',
      items: [ { name: 'Copy Paper (Case of 10 Reams)', qty: 10, unitCost: 44.99, category: 'Office Supply', notes: 'White', status: 'Arrived' } ] },
    { id: 'ORD-20251118-2207', date: '2025-11-18T09:50:00', status: 'Closed/Paid', requestorEmail: 'jrivera@example.edu', dept: 'Science', vendor: 'CDW-G', bank: 'RBC Operating', payType: 'Check',
      pricedAt: '2025-11-19T10:00:00', approvedAt: '2025-11-20T14:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2025-11-28T10:00:00', closedAt: '2025-12-05T10:00:00',
      items: [ { name: 'CDW-G - Chromebook Charging Cart (30 bay)', qty: 1, unitCost: 899.0, category: 'Custom', notes: 'STEM lab', url: 'https://www.cdwg.com/', status: 'Arrived' } ] },
    { id: 'ORD-20251209-3318', date: '2025-12-09T13:10:00', status: 'Closed/Paid', requestorEmail: 'achen@example.edu', dept: 'Fine Arts', vendor: 'Blick Art Materials', bank: 'HCS Operating', payType: 'Credit Card',
      pricedAt: '2025-12-10T09:00:00', approvedAt: '2025-12-10T16:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2025-12-15T10:00:00', closedAt: '2026-01-09T10:00:00',
      items: [ { name: 'Blick - Watercolor Sets (24 colors)', qty: 2, unitCost: 96.0, category: 'Custom', notes: '', url: 'https://www.dickblick.com/', status: 'Arrived' } ] },
    { id: 'ORD-20260113-4021', date: '2026-01-13T08:15:00', status: 'Closed/Paid', requestorEmail: 'spatel@example.edu', dept: 'Athletics', vendor: 'BSN Sports', bank: 'Activities', payType: 'Credit Net 30',
      pricedAt: '2026-01-14T10:00:00', approvedAt: '2026-01-15T11:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-01-22T10:00:00', closedAt: '2026-02-06T10:00:00',
      items: [ { name: 'BSN Sports - Basketballs (Dozen)', qty: 1, unitCost: 340.0, category: 'Custom', notes: '', url: 'https://www.bsnsports.com/', status: 'Arrived' } ] },
    { id: 'ORD-20260210-1178', date: '2026-02-10T11:30:00', status: 'Closed/Paid', requestorEmail: 'jrivera@example.edu', dept: 'Science', vendor: 'Lakeshore Learning', bank: 'HCS Operating', payType: 'Check',
      pricedAt: '2026-02-11T09:00:00', approvedAt: '2026-02-12T13:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-02-20T10:00:00', closedAt: '2026-03-01T12:00:00',
      items: [
        { name: 'Lakeshore Learning - Human Torso Anatomy Model', qty: 1, unitCost: 245.0, category: 'Custom', notes: '', url: 'https://www.lakeshorelearning.com/', status: 'Arrived' },
        { name: 'Lakeshore Learning - Magnetic Molecular Model Kit', qty: 3, unitCost: 29.99, category: 'Custom', notes: '', url: 'https://www.lakeshorelearning.com/', status: 'Arrived' }
      ] },
    { id: 'ORD-20260303-5521', date: '2026-03-03T14:00:00', status: 'Closed/Paid', requestorEmail: 'tbrooks@example.edu', dept: 'English', vendor: 'Amazon Business', bank: 'HCS Operating', payType: 'Credit Card',
      pricedAt: '2026-03-04T09:00:00', approvedAt: '2026-03-04T15:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-03-09T10:00:00', closedAt: '2026-03-20T10:00:00',
      items: [ { name: 'Amazon - Classroom Library Bins (12)', qty: 2, unitCost: 27.5, category: 'Custom', notes: '', url: 'https://www.amazon.com/', status: 'Arrived' } ] },
    { id: 'ORD-20260315-5240', date: '2026-03-15T10:45:00', status: 'Cancelled', requestorEmail: 'spatel@example.edu', dept: 'Athletics', preCancelStatus: 'Pending Approval',
      cancelJustification: 'Spring season was shortened; no longer needed.',
      items: [ { name: 'BSN Sports - Hurdle Set (6)', qty: 1, unitCost: 210.0, category: 'Custom', notes: '', url: 'https://www.bsnsports.com/' } ] },
    { id: 'ORD-20260414-6610', date: '2026-04-14T09:00:00', status: 'Closed/Paid', requestorEmail: 'cnguyen@example.edu', dept: 'Operations', vendor: 'Uline', bank: 'HCS Operating', payType: 'Credit Net 30',
      pricedAt: '2026-04-14T13:00:00', approvedAt: '2026-04-15T10:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-04-20T10:00:00', closedAt: '2026-05-04T10:00:00',
      adjustments: [ { label: 'Freight', type: 'charge', mode: 'flat', value: 24 } ],
      items: [
        { name: 'Paper Towels (Case of 12)', qty: 6, unitCost: 36.0, category: 'Cleaning & Maintenance', notes: '', status: 'Arrived' },
        { name: 'Hand Soap Refill (Case)', qty: 2, unitCost: 44.0, category: 'Cleaning & Maintenance', notes: '', status: 'Arrived' }
      ] },
    { id: 'ORD-20260428-9013', date: '2026-04-28T14:20:00', status: 'Closed/Paid', requestorEmail: 'cnguyen@example.edu', dept: 'Operations', vendor: 'Office Depot', bank: 'HCS Operating', payType: 'Check',
      pricedAt: '2026-04-29T09:00:00', approvedAt: '2026-04-30T11:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-05-06T10:00:00', closedAt: '2026-05-15T16:00:00',
      items: [ { name: 'Office Depot - Janitorial Supplies Bundle', qty: 1, unitCost: 320.0, category: 'Custom', notes: '', url: 'https://www.officedepot.com/', status: 'Arrived' } ] },
    { id: 'ORD-20260519-7333', date: '2026-05-19T10:30:00', status: 'Closed/Paid', requestorEmail: 'dmorales@example.edu', dept: 'Mathematics', vendor: 'Amazon Business', bank: 'HCS Operating', payType: 'Credit Card',
      pricedAt: '2026-05-19T15:00:00', approvedAt: '2026-05-20T10:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-05-23T10:00:00', closedAt: '2026-06-05T10:00:00',
      items: [ { name: 'Amazon - TI-84 Plus Graphing Calculator', qty: 10, unitCost: 109.0, category: 'Custom', notes: 'Calculator cart refresh', url: 'https://www.amazon.com/', status: 'Arrived' } ] },
    { id: 'ORD-20260611-8080', date: '2026-06-11T09:10:00', status: 'Closed/Paid', requestorEmail: 'mlee@example.edu', dept: 'Administration', vendor: 'Staples', bank: 'RBC Operating', payType: 'Credit Net 30',
      pricedAt: '2026-06-11T14:00:00', approvedAt: '2026-06-12T09:00:00', approvedBy: 'jrivera@example.edu', fulfillmentAt: '2026-06-22T10:00:00', closedAt: '2026-07-02T10:00:00',
      items: [ { name: 'Ergonomic Task Chair', qty: 2, unitCost: 165.5, category: 'Furniture', color: 'Black', notes: 'Black', status: 'Arrived' } ] },
    { id: 'ORD-20260720-9191', date: '2026-07-20T11:00:00', status: 'Closed/Paid', requestorEmail: 'jwolf@example.edu', dept: 'Science', vendor: 'School Specialty', bank: 'HCS Operating', payType: 'Credit Card',
      pricedAt: '2026-07-21T09:00:00', approvedAt: '2026-07-22T10:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-08-03T10:00:00', closedAt: '2026-08-14T10:00:00',
      items: [ { name: 'Mobile Whiteboard (Double-Sided)', qty: 1, unitCost: 249.0, category: 'Furniture', notes: '', status: 'Arrived' } ] },
    { id: 'ORD-20260805-2468', date: '2026-08-05T13:00:00', status: 'Closed/Paid', requestorEmail: 'qfoster@example.edu', dept: 'Technology', vendor: 'CDW-G', bank: 'RBC Operating', payType: 'Check',
      pricedAt: '2026-08-06T09:00:00', approvedAt: '2026-08-07T10:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2026-08-14T10:00:00', closedAt: '2026-08-28T10:00:00',
      adjustments: [ { label: 'E-rate discount', type: 'discount', mode: 'pct', value: 10 } ],
      items: [ { name: 'CDW-G - Chromebook (Student, 11.6 in)', qty: 12, unitCost: 239.0, category: 'Custom', notes: 'Grade 6 cart', url: 'https://www.cdwg.com/', status: 'Arrived' } ] },

    // ---- SY24-25 ----
    { id: 'ORD-20241015-1001', date: '2024-10-15T10:00:00', status: 'Closed/Paid', requestorEmail: 'jrivera@example.edu', dept: 'Science', vendor: 'Carolina Biological', bank: 'HCS Operating', payType: 'Check',
      pricedAt: '2024-10-16T09:00:00', approvedAt: '2024-10-17T10:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2024-10-25T10:00:00', closedAt: '2024-11-08T10:00:00',
      items: [ { name: 'Carolina Biological - Compound Microscope (40-1000x)', qty: 4, unitCost: 189.0, category: 'Custom', notes: '', url: 'https://www.carolina.com/', status: 'Arrived' } ] },
    { id: 'ORD-20250212-1002', date: '2025-02-12T13:00:00', status: 'Closed/Paid', requestorEmail: 'achen@example.edu', dept: 'Fine Arts', vendor: 'Blick Art Materials', bank: 'HCS Operating', payType: 'Credit Card',
      pricedAt: '2025-02-13T09:00:00', approvedAt: '2025-02-13T15:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2025-02-20T10:00:00', closedAt: '2025-03-04T10:00:00',
      items: [ { name: 'Blick - Low-Fire Clay (25 lb)', qty: 10, unitCost: 21.0, category: 'Custom', notes: '', url: 'https://www.dickblick.com/', status: 'Arrived' } ] },
    { id: 'ORD-20250408-1003', date: '2025-04-08T09:00:00', status: 'Closed/Paid', requestorEmail: 'mlee@example.edu', dept: 'Administration', vendor: 'Staples', bank: 'HCS Operating', payType: 'Credit Net 30',
      pricedAt: '2025-04-08T13:00:00', approvedAt: '2025-04-09T09:00:00', approvedBy: 'jrivera@example.edu', fulfillmentAt: '2025-04-11T10:00:00', closedAt: '2025-04-25T10:00:00',
      items: [ { name: 'Copy Paper (Case of 10 Reams)', qty: 8, unitCost: 42.99, category: 'Office Supply', notes: 'White', status: 'Arrived' } ] },
    { id: 'ORD-20250602-1004', date: '2025-06-02T10:00:00', status: 'Closed/Paid', requestorEmail: 'spatel@example.edu', dept: 'Athletics', vendor: 'BSN Sports', bank: 'Activities', payType: 'Credit Net 30',
      pricedAt: '2025-06-03T09:00:00', approvedAt: '2025-06-04T10:00:00', approvedBy: 'mlee@example.edu', fulfillmentAt: '2025-06-12T10:00:00', closedAt: '2025-06-27T10:00:00',
      items: [ { name: 'BSN Sports - Soccer Goal Nets (Pair)', qty: 1, unitCost: 275.0, category: 'Custom', notes: '', url: 'https://www.bsnsports.com/', status: 'Arrived' } ] }
  ],

  // Order_Comments. 'internal' = purchasing <-> approver only; 'public' = the note the requestor sees.
  comments: [
    { orderId: 'ORD-20261002-2884', author: 'mlee@example.edu', role: 'Approver', visibility: 'internal', at: '2026-10-05T08:20:00',
      body: 'Rejecting for now: we bought a classroom set of this title two years ago. Can someone check the book room before we buy again?' },
    { orderId: 'ORD-20261002-2884', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'internal', at: '2026-10-05T10:05:00',
      body: 'Checked: 22 usable copies in the book room. I will let the requestor know and suggest topping up with 8.' },
    { orderId: 'ORD-20261001-6120', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'internal', at: '2026-10-02T09:00:00',
      body: 'Routed to backup approver Robin Ellis (backup.approver@example.edu) for signature.' },
    { orderId: 'ORD-20260930-5512', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'public', at: '2026-10-01T11:30:00',
      body: 'Vernier sells these with and without the cart adapter. Which one do you need? Please attach a quote and resubmit.' },
    { orderId: 'ORD-20260925-1590', author: 'mlee@example.edu', role: 'Approver', visibility: 'internal', at: '2026-09-29T16:10:00',
      body: 'Holding: the athletics fund is already committed for fall. Can this wait for the spring booster deposit?' },
    { orderId: 'ORD-20260925-1590', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'internal', at: '2026-09-30T08:45:00',
      body: 'The jerseys are needed for the scrimmage on the 20th; the bottles can wait. Want me to split the order?' },
    { orderId: 'ORD-20260929-7723', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'internal', at: '2026-09-30T10:05:00',
      body: 'Merged in ORD-20260925-3301 by pquinlan@example.edu' },
    { orderId: 'ORD-20260925-3301', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'internal', at: '2026-09-30T10:05:00',
      body: 'Merged into ORD-20260929-7723 by pquinlan@example.edu' },
    { orderId: 'ORD-20260903-9012', author: 'mlee@example.edu', role: 'Approver', visibility: 'internal', at: '2026-09-04T15:00:00',
      body: 'Not this year. The grounds contractor already pressure-washes the bleachers twice a season.' },
    { orderId: 'ORD-20260903-9012', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'public', at: '2026-09-05T09:10:00',
      body: 'Not approved this year: the grounds contract already covers pressure washing. Raise it again at budget time if the contract changes.' },
    { orderId: 'ORD-20260901-1178', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'internal', at: '2026-09-02T09:20:00',
      body: 'Order split into ORD-20260901-1178-A, ORD-20260901-1178-B by pquinlan@example.edu' },
    { orderId: 'ORD-20260908-2207', author: 'pquinlan@example.edu', role: 'Manager', visibility: 'internal', at: '2026-09-25T10:00:00',
      body: 'Return recorded: 1× Disinfecting Wipes (Case of 6)\nCredit: $38.40\nReason: Case arrived crushed and leaking' }
  ],

  // Order_Audit rows beyond the Priced / Approved / Fulfillment started milestones, which mock.js
  // writes from each order's own timestamps.
  audit: [
    { orderId: 'ORD-20261001-6120', actor: 'pquinlan@example.edu', action: 'Routed', detail: 'signature routed to backup.approver@example.edu by pquinlan@example.edu', at: '2026-10-02T09:00:00' },
    { orderId: 'ORD-20260929-7723', actor: 'pquinlan@example.edu', action: 'Merged in', detail: 'ORD-20260925-3301 (1 item(s))', at: '2026-09-30T10:05:00' },
    { orderId: 'ORD-20260925-3301', actor: 'pquinlan@example.edu', action: 'Merged', detail: 'into ORD-20260929-7723', at: '2026-09-30T10:05:00' },
    { orderId: 'ORD-20260901-1178', actor: 'pquinlan@example.edu', action: 'Split', detail: 'into ORD-20260901-1178-A, ORD-20260901-1178-B', at: '2026-09-02T09:20:00' },
    { orderId: 'ORD-20260915-6631', actor: 'pquinlan@example.edu', action: 'Item statuses updated', detail: '1 Arrived, 1 Backordered, 1 Delayed', at: '2026-09-29T14:00:00' },
    { orderId: 'ORD-20260908-2207', actor: 'pquinlan@example.edu', action: 'Return recorded', detail: '1× Disinfecting Wipes (Case of 6) — credit $38.40 · Case arrived crushed and leaking', at: '2026-09-25T10:00:00' },
    { orderId: 'ORD-20260519-7333', actor: 'pquinlan@example.edu', action: 'Return recorded', detail: '1× Amazon - TI-84 Plus Graphing Calculator — credit $109.00 · Screen defect', at: '2026-06-01T09:00:00' },
    { orderId: 'ORD-20260805-2468', actor: 'pquinlan@example.edu', action: 'Cost adjusted', detail: 'final invoice applied the E-rate discount', at: '2026-08-28T09:30:00' }
  ],

  // Order_Documents. File links are not real files in the demo.
  documents: [
    { orderId: 'ORD-20260915-6631', category: 'Order Confirmation', originalName: 'staples-confirmation.pdf', uploadedBy: 'pquinlan@example.edu', uploadedAt: '2026-09-16T11:00:00' },
    { orderId: 'ORD-20260915-6631', category: 'Packing List', originalName: 'packing-slip-1.pdf', uploadedBy: 'pquinlan@example.edu', uploadedAt: '2026-09-21T09:00:00' },
    { orderId: 'ORD-20260922-4055', category: 'Order Confirmation', originalName: 'amazon-order-confirmation.pdf', uploadedBy: 'pquinlan@example.edu', uploadedAt: '2026-09-25T10:20:00' },
    { orderId: 'ORD-20260908-2207', category: 'Packing List', originalName: 'uline-packing-list.pdf', uploadedBy: 'pquinlan@example.edu', uploadedAt: '2026-09-14T08:00:00' },
    { orderId: 'ORD-20260908-2207', category: 'Invoice', originalName: 'uline-invoice.pdf', uploadedBy: 'pquinlan@example.edu', uploadedAt: '2026-09-29T15:00:00' },
    { orderId: 'ORD-20260908-2207', category: 'Return Confirmation', originalName: 'uline-rma.pdf', uploadedBy: 'pquinlan@example.edu', uploadedAt: '2026-09-25T10:00:00' },
    { orderId: 'ORD-20260901-1178-B', category: 'Packing List', originalName: 'amazon-box-1.jpg', uploadedBy: 'pquinlan@example.edu', uploadedAt: '2026-09-05T13:00:00' },
    { orderId: 'ORD-20260910-8846', category: 'Quote', originalName: 'quote.pdf', uploadedBy: 'jrivera@example.edu', uploadedAt: '2026-09-10T15:40:00' }
  ],

  // Returns. line = the 1-based line number on the order.
  returns: [
    { orderId: 'ORD-20260908-2207', line: 1, qty: 1, refund: 38.4, reason: 'Case arrived crushed and leaking', by: 'pquinlan@example.edu', at: '2026-09-25T10:00:00' },
    { orderId: 'ORD-20260519-7333', line: 1, qty: 1, refund: 109.0, reason: 'Screen defect', by: 'pquinlan@example.edu', at: '2026-06-01T09:00:00' }
  ],

  // Delegations (Temp Approver). State (Active / Scheduled / Expired / Revoked) is computed from today.
  delegations: [
    { id: 'DLG-1001', delegateEmail: 'backup.approver@example.edu', grantedBy: 'pquinlan@example.edu', start: '2026-10-02', end: '2026-10-09', revoked: false },
    { id: 'DLG-1002', delegateEmail: 'qfoster@example.edu', grantedBy: 'jrivera@example.edu', start: '2026-11-23', end: '2026-11-27', revoked: false },
    { id: 'DLG-1003', delegateEmail: 'dmorales@example.edu', grantedBy: 'pquinlan@example.edu', start: '2026-07-01', end: '2026-07-31', revoked: false },
    { id: 'DLG-1004', delegateEmail: 'akim@example.edu', grantedBy: 'jrivera@example.edu', start: '2026-06-15', end: '2026-06-30', revoked: true }
  ],

  // Saved_Views for the signed-in user.
  savedViews: [
    { id: 'VIEW-1001', name: 'Science, this school year', viewType: 'analytics', createdAt: '2026-09-12T08:00:00',
      filters: { preset: 'csy', departments: ['Science'], vendors: [], requestors: [], categories: [], banks: [], payTypes: [], statuses: [], minAmount: null, maxAmount: null, priorityOnly: false } },
    { id: 'VIEW-1002', name: 'Big tickets (over $500)', viewType: 'analytics', createdAt: '2026-09-02T08:00:00',
      filters: { preset: 'all', departments: [], vendors: [], requestors: [], categories: [], banks: [], payTypes: [], statuses: [], minAmount: '500', maxAmount: null, priorityOnly: false } },
    { id: 'VIEW-1003', name: 'My team, still open', viewType: 'teamorders', createdAt: '2026-09-15T08:00:00',
      filters: { status: 'Pending', sy: 'csy', search: '' } }
  ],

  // Email_Rules (DEFAULT_EMAIL_RULES order and wording).
  emailRules: [
    { key: 'order_submitted',         desc: 'New order submitted',                         notifyRequestor: true,  notifyManager: true,  notifyApprover: false, notifyNotify: true },
    { key: 'order_priced',            desc: 'Order priced, sent to approver',              notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: true },
    { key: 'order_approved',          desc: 'Order signed/approved',                       notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: true },
    { key: 'order_held',              desc: 'Order placed on hold by approver',            notifyRequestor: true,  notifyManager: true,  notifyApprover: false, notifyNotify: false },
    { key: 'order_under_review',      desc: 'Order rejected by approver, awaiting review',  notifyRequestor: false, notifyManager: true,  notifyApprover: false, notifyNotify: false },
    { key: 'order_comment_internal',  desc: 'New internal comment on an order',            notifyRequestor: false, notifyManager: true,  notifyApprover: true,  notifyNotify: false },
    { key: 'order_rejected',          desc: 'Rejection published to requestor',            notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: false },
    { key: 'order_needs_info',        desc: 'Sent back to requestor for more info',        notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: false },
    { key: 'order_resubmitted',       desc: 'Requestor resubmitted after more info',       notifyRequestor: false, notifyManager: true,  notifyApprover: false, notifyNotify: false },
    { key: 'order_item_update',       desc: 'Per-item arrival/delay status updated',       notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: false },
    { key: 'order_cancelled_direct',  desc: 'Requestor cancelled Pending Approval order',  notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: false },
    { key: 'cancellation_requested',  desc: 'Cancellation requested mid-flight',           notifyRequestor: true,  notifyManager: true,  notifyApprover: false, notifyNotify: false },
    { key: 'cancellation_confirmed',  desc: 'Cancellation confirmed by Manager',           notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: true },
    { key: 'cancellation_denied',     desc: 'Cancellation dismissed by Manager',           notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: false },
    { key: 'order_fulfillment_start', desc: 'First packing slip uploaded',                 notifyRequestor: true,  notifyManager: false, notifyApprover: false, notifyNotify: true },
    { key: 'order_slip_subsequent',   desc: 'Additional packing slip uploaded',            notifyRequestor: false, notifyManager: false, notifyApprover: false, notifyNotify: false },
    { key: 'order_closed',            desc: 'Order marked Closed/Paid',                    notifyRequestor: false, notifyManager: false, notifyApprover: false, notifyNotify: false }
  ]
};
