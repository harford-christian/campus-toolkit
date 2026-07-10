/* data.js — fabricated data for the HCS Procurement / Purchasing demo.
   No real people or records. The current user is Jordan Rivera (Owner). Staff,
   catalog, departments, vendors, and orders are invented. Orders carry a
   canonical shape that mock.js projects into the requestor history view, the
   master management queue, and the analytics dashboards — all numbers are
   derived from this one list in mock.js so every view stays consistent.

   School year: all orders fall in SY25-26 (Sep 2025 - Aug 2026). Dates are
   fixed ISO strings (not offsets) so the analytics month/quarter buckets are
   stable regardless of when the demo is opened. */
window.PURCHASING_DATA = {
  currentUser: {
    email: 'jrivera@harfordchristian.org',
    firstName: 'Jordan',
    lastName: 'Rivera',
    role: 'Owner'
  },

  // getUserAvailableDepts(email) source. Jordan's home dept is Science; they can
  // also charge Fine Arts. allActive lists every active department.
  depts: {
    primary: 'Science',
    alternates: ['Fine Arts'],
    allActive: ['Science', 'Fine Arts', 'Athletics', 'English', 'Administration', 'Operations']
  },

  // Each department rolls up into an analytics Category.
  deptCategory: {
    'Science': 'Academics',
    'Fine Arts': 'Academics',
    'English': 'Academics',
    'Athletics': 'Athletics',
    'Administration': 'Operations',
    'Operations': 'Operations'
  },

  // getActiveStaffForPicker() source (~6 staff). inMyDepts is true for people in
  // Jordan's departments (Science / Fine Arts).
  staff: [
    { email: 'jwolf@harfordchristian.org',   name: 'Jamie Wolf',    dept: 'Science',        inMyDepts: true },
    { email: 'achen@harfordchristian.org',   name: 'Alex Chen',     dept: 'Fine Arts',      inMyDepts: true },
    { email: 'spatel@harfordchristian.org',  name: 'Sam Patel',     dept: 'Athletics',      inMyDepts: false },
    { email: 'tbrooks@harfordchristian.org', name: 'Taylor Brooks', dept: 'English',        inMyDepts: false },
    { email: 'mlee@harfordchristian.org',    name: 'Morgan Lee',    dept: 'Administration', inMyDepts: false },
    { email: 'cnguyen@harfordchristian.org', name: 'Casey Nguyen',  dept: 'Operations',     inMyDepts: false }
  ],

  // getApproverSettings(email) source. Role is Owner per the demo persona.
  approverSettings: {
    role: 'Owner', hasPin: true, requireOnAccess: false,
    intervalMinutes: 30, amountThreshold: 500, isBypass: false
  },

  // getCatalogItems() source — 8 Office Supply + 8 Furniture. image '' (no real
  // Drive URLs in the demo); a couple carry colors/options to exercise the
  // client's selector-or-text builder.
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
      { id: 'FUR-004', category: 'Furniture', name: 'Bookshelf (5-Shelf)', image: '', leadTime: '2-3 weeks', colors: ['Oak', 'Espresso'], options: [], price: 98.75 },
      { id: 'FUR-005', category: 'Furniture', name: 'Folding Utility Table (6 ft)', image: '', leadTime: '1-2 weeks', colors: [], options: [], price: 74.0 },
      { id: 'FUR-006', category: 'Furniture', name: 'Mobile Whiteboard (Double-Sided)', image: '', leadTime: '2-3 weeks', colors: [], options: [], price: 249.0 },
      { id: 'FUR-007', category: 'Furniture', name: 'Classroom Rug (8x12)', image: '', leadTime: '2-4 weeks', colors: ['Primary', 'Calm Tones'], options: [], price: 189.0 },
      { id: 'FUR-008', category: 'Furniture', name: 'Stackable Student Chair', image: '', leadTime: '1-2 weeks', colors: ['Red', 'Blue', 'Green'], options: ['14 in', '16 in', '18 in'], price: 32.0 }
    ]
  },

  banks: ['General Fund', 'Restricted - Science Grant', 'Athletics Fund', 'Technology Fund'],
  payTypes: ['PO', 'Credit Card', 'Check', 'ACH'],

  // Canonical order list. mock.js computes each order's total from its line items
  // (qty * unitCost) and projects the list into every view. Statuses cover the
  // full workflow enum. Timestamps present on an order reflect how far it has
  // progressed (Submitted -> Priced -> Approved -> Fulfillment -> Closed/Paid).
  orders: [
    {
      id: 'ORD-20260706-3310', date: '2026-07-06T09:12:00', status: 'Pending Approval',
      requestor: 'Jordan Rivera', requestorEmail: 'jrivera@harfordchristian.org', dept: 'Science',
      vendor: '', bank: '', payType: '', additionalNotify: 'jwolf@harfordchristian.org',
      pricedAt: '', approvedAt: '', approvedBy: '', fulfillmentAt: '', closedAt: '',
      poPdfUrl: '', cancelJustification: '', preCancelStatus: '', packingSummary: '',
      items: [
        { name: 'Prepared Microscope Slides (Set of 25)', qty: 2, unitCost: 45.0, notes: 'For 7th grade cell biology unit', url: '', attachmentUrl: '', attachmentFileName: '' },
        { name: 'Borosilicate Beaker Set', qty: 1, unitCost: 38.5, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20260703-8846', date: '2026-07-03T15:40:00', status: 'Cancellation Requested',
      requestor: 'Jordan Rivera', requestorEmail: 'jrivera@harfordchristian.org', dept: 'Science',
      vendor: 'Amazon Business', bank: 'General Fund', payType: 'Credit Card', additionalNotify: '',
      pricedAt: '2026-07-04T14:20:00', approvedAt: '', approvedBy: '', fulfillmentAt: '', closedAt: '',
      poPdfUrl: '', preCancelStatus: 'Pending Signature', packingSummary: '',
      cancelJustification: 'Found the same document camera cheaper through our science supplier — please cancel this Amazon order.',
      items: [
        { name: 'Amazon Business - Classroom Document Camera', qty: 1, unitCost: 129.99, notes: 'Priority for summer prep', url: 'https://www.amazon.com/dp/B00EXAMPLE', attachmentUrl: '', attachmentFileName: 'quote.pdf' }
      ]
    },
    {
      id: 'ORD-20260701-2884', date: '2026-07-01T11:05:00', status: 'Under Review',
      requestor: 'Alex Chen', requestorEmail: 'achen@harfordchristian.org', dept: 'Fine Arts',
      vendor: 'Blick Art Materials', bank: 'General Fund', payType: 'PO', additionalNotify: '',
      pricedAt: '2026-07-02T10:05:00', approvedAt: '', approvedBy: '', fulfillmentAt: '', closedAt: '',
      poPdfUrl: '', cancelJustification: '', preCancelStatus: '', packingSummary: '',
      items: [
        { name: 'Acrylic Paint Class Pack', qty: 3, unitCost: 64.0, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' },
        { name: 'Canvas Panels (Bulk 50)', qty: 2, unitCost: 42.0, notes: 'Spring art show', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20260625-1590', date: '2026-06-25T08:30:00', status: 'On Hold',
      requestor: 'Sam Patel', requestorEmail: 'spatel@harfordchristian.org', dept: 'Athletics',
      vendor: 'BSN Sports', bank: 'Athletics Fund', payType: 'PO', additionalNotify: '',
      pricedAt: '2026-06-26T09:30:00', approvedAt: '', approvedBy: '', fulfillmentAt: '', closedAt: '',
      poPdfUrl: '', cancelJustification: '', preCancelStatus: '', packingSummary: '',
      items: [
        { name: 'Practice Jersey Set', qty: 20, unitCost: 18.75, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' },
        { name: 'Team Water Bottles', qty: 24, unitCost: 6.5, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20260618-7723', date: '2026-06-18T13:00:00', status: 'Pending Signature',
      requestor: 'Taylor Brooks', requestorEmail: 'tbrooks@harfordchristian.org', dept: 'English',
      vendor: 'Amazon Business', bank: 'General Fund', payType: 'Credit Card', additionalNotify: '',
      pricedAt: '2026-06-19T13:15:00', approvedAt: '', approvedBy: '', fulfillmentAt: '', closedAt: '',
      poPdfUrl: '', cancelJustification: '', preCancelStatus: '', packingSummary: '',
      items: [
        { name: 'Classroom Novel Set - To Kill a Mockingbird (30)', qty: 1, unitCost: 210.0, notes: 'Replacing worn copies', url: '', attachmentUrl: '', attachmentFileName: '' },
        { name: 'Whiteboard Markers (Bulk)', qty: 4, unitCost: 12.99, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20260610-4055', date: '2026-06-10T10:15:00', status: 'Approved',
      requestor: 'Jordan Rivera', requestorEmail: 'jrivera@harfordchristian.org', dept: 'Science',
      vendor: 'School Specialty', bank: 'Restricted - Science Grant', payType: 'PO', additionalNotify: 'jwolf@harfordchristian.org',
      pricedAt: '2026-06-11T11:00:00', approvedAt: '2026-06-12T15:30:00', approvedBy: 'Morgan Lee',
      fulfillmentAt: '', closedAt: '', poPdfUrl: '', cancelJustification: '', preCancelStatus: '', packingSummary: '',
      items: [
        { name: 'Lab Safety Goggles (Class Set of 30)', qty: 1, unitCost: 180.0, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' },
        { name: 'Digital Scale 0.1g', qty: 2, unitCost: 34.95, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20260520-6631', date: '2026-05-20T09:00:00', status: 'Fulfillment',
      requestor: 'Morgan Lee', requestorEmail: 'mlee@harfordchristian.org', dept: 'Administration',
      vendor: 'Staples', bank: 'General Fund', payType: 'PO', additionalNotify: '',
      pricedAt: '2026-05-21T10:00:00', approvedAt: '2026-05-22T14:00:00', approvedBy: 'Morgan Lee',
      fulfillmentAt: '2026-05-28T09:00:00', closedAt: '', poPdfUrl: '', cancelJustification: '',
      preCancelStatus: '', packingSummary: '1 packing list',
      items: [
        { name: 'Copy Paper (10 Reams)', qty: 5, unitCost: 44.99, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' },
        { name: 'Toner Cartridge HP 26X', qty: 3, unitCost: 89.0, notes: 'Front office printer', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20260428-9012', date: '2026-04-28T14:20:00', status: 'Closed/Paid',
      requestor: 'Casey Nguyen', requestorEmail: 'cnguyen@harfordchristian.org', dept: 'Operations',
      vendor: 'Office Depot', bank: 'General Fund', payType: 'Check', additionalNotify: '',
      pricedAt: '2026-04-29T09:00:00', approvedAt: '2026-04-30T11:00:00', approvedBy: 'Morgan Lee',
      fulfillmentAt: '2026-05-06T10:00:00', closedAt: '2026-05-15T16:00:00', poPdfUrl: '',
      cancelJustification: '', preCancelStatus: '', packingSummary: '2 packing lists',
      items: [
        { name: 'Janitorial Supplies Bundle', qty: 1, unitCost: 320.0, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' },
        { name: 'Floor Wax (Case)', qty: 2, unitCost: 58.0, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20260315-5240', date: '2026-03-15T10:45:00', status: 'Cancelled',
      requestor: 'Sam Patel', requestorEmail: 'spatel@harfordchristian.org', dept: 'Athletics',
      vendor: '', bank: '', payType: '', additionalNotify: '',
      pricedAt: '', approvedAt: '', approvedBy: '', fulfillmentAt: '', closedAt: '',
      poPdfUrl: '', preCancelStatus: 'Pending Approval', packingSummary: '',
      cancelJustification: 'Season schedule changed; this equipment is no longer needed this year.',
      items: [
        { name: 'Agility Cone Set', qty: 4, unitCost: 22.0, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20260210-1178', date: '2026-02-10T11:30:00', status: 'Closed/Paid',
      requestor: 'Jordan Rivera', requestorEmail: 'jrivera@harfordchristian.org', dept: 'Science',
      vendor: 'Lakeshore Learning', bank: 'Restricted - Science Grant', payType: 'PO', additionalNotify: '',
      pricedAt: '2026-02-11T09:00:00', approvedAt: '2026-02-12T13:00:00', approvedBy: 'Morgan Lee',
      fulfillmentAt: '2026-02-20T10:00:00', closedAt: '2026-03-01T12:00:00', poPdfUrl: '',
      cancelJustification: '', preCancelStatus: '', packingSummary: '1 packing list',
      items: [
        { name: 'Anatomy Model - Human Torso', qty: 1, unitCost: 245.0, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' },
        { name: 'Magnetic Molecular Model Kit', qty: 3, unitCost: 29.99, notes: '', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    },
    {
      id: 'ORD-20251118-2207', date: '2025-11-18T09:50:00', status: 'Closed/Paid',
      requestor: 'Jordan Rivera', requestorEmail: 'jrivera@harfordchristian.org', dept: 'Science',
      vendor: 'CDW-G', bank: 'Technology Fund', payType: 'ACH', additionalNotify: '',
      pricedAt: '2025-11-19T10:00:00', approvedAt: '2025-11-20T14:00:00', approvedBy: 'Morgan Lee',
      fulfillmentAt: '2025-11-28T10:00:00', closedAt: '2025-12-05T10:00:00', poPdfUrl: '',
      cancelJustification: '', preCancelStatus: '', packingSummary: '1 packing list',
      items: [
        { name: 'Chromebook Charging Cart', qty: 1, unitCost: 899.0, notes: 'STEM lab', url: '', attachmentUrl: '', attachmentFileName: '' }
      ]
    }
  ]
};
