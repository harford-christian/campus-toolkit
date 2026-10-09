// Verifies the Purchasing & Procurement demo: the page is a fresh build of the source (build.json); every
// google.script.run method the page calls (static chains plus the analytics tabs it calls by name) is
// answered by mock.js and nothing else is; the workflow moves an order through the real statuses with
// totals that add up; the seed covers every status; state survives a reload in the same tab; and nothing
// private leaked. Run from the repo root: node demos/purchasing/verify.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { findStaffNames, findPhrases, aliasEmailLocals, PHRASE_ALIASES } from '../../tools/staff-aliases.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = fileURLToPath(new URL('../../../hcs-purchasing-system/Index.html', import.meta.url));
let fail = 0, count = 0;
const check = (l, c, extra) => { count++; console.log((c ? 'PASS' : 'FAIL') + '  ' + l + (!c && extra ? '\n        ' + extra : '')); if (!c) fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b) => Math.abs(a - b) < 0.005;
const throws = (fn, re) => { try { fn(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

const html = readFileSync(HERE + 'index.html', 'utf8');
const dataSrc = readFileSync(HERE + 'data.js', 'utf8');
const mockSrc = readFileSync(HERE + 'mock.js', 'utf8');
const cfg = JSON.parse(readFileSync(HERE + 'build.json', 'utf8'));

/* ---------- load data.js + mock.js the way the browser does (optionally with a storage and a clock) ---------- */
function memoryStorage() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }
function boot(storage, DateImpl) {
  const window = { sessionStorage: storage || memoryStorage() };
  new Function('window', dataSrc)(window);
  new Function('window', 'Date', mockSrc)(window, DateImpl || Date);
  return window;
}
const W = boot();
const D = W.PURCHASING_DATA, M = W.MOCK_BACKEND;
const ME = D.currentUser.email;

/* ---------- the mock contract: exactly the methods the page calls ---------- */
function chainEndpoint(src, from) {
  const text = src.slice(from, from + 8000).replace(/\/\/[^\n]*/g, '');
  if (!/^\s*\./.test(text)) return null;                       // prose, not a call
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && (ch === '[' || ch === ';')) return null;   // runner[name](...) is dynamic; ';' ends the statement
    else if (depth === 0 && ch === '.') { const m = /^\.([a-zA-Z]\w*)\s*\(/.exec(text.slice(i, i + 60)); if (m && !/^with/.test(m[1])) return m[1]; }
  }
  return null;
}
const staticCalls = [...new Set([...html.matchAll(/google\.script\.run/g)].map((m) => chainEndpoint(html, m.index + 17)).filter(Boolean))].sort();
const dynamicCalls = [...new Set([...html.matchAll(/loadAnalyticsTab\('[a-z]+',\s*'([a-zA-Z]+)'/g)].map((m) => m[1]))].sort();
const pageCalls = [...new Set(staticCalls.concat(dynamicCalls))].sort();
check('the page calls ' + pageCalls.length + ' server methods (' + staticCalls.length + ' in google.script.run chains, ' + dynamicCalls.length + ' analytics tabs by name) and the mock answers exactly those',
  dynamicCalls.length === 8 && eq(Object.keys(M).sort(), pageCalls),
  'page only: ' + pageCalls.filter((n) => !(n in M)).join(', ') + ' | mock only: ' + Object.keys(M).filter((n) => !pageCalls.includes(n)).join(', '));
check('the mock is a plain object of functions (no catch-all Proxy)', Object.keys(M).every((k) => typeof M[k] === 'function') && typeof M.notAServerMethod === 'undefined');
check('no unreplaced Apps Script template tokens', !/<\?[=!]?[\s\S]*?\?>/.test(html));
check('the Owner persona is baked in: initials, email, role, flags',
  html.includes('const userEmail = "jrivera@example.edu"') && html.includes('const userRole  = "Owner"') && html.includes('const userInitials = "JR"') &&
  html.includes("const isDelegate = 'false' === 'true'") && html.includes("const wizardSeen = 'true' === 'true'"));
check('the teacher notice, the Approver-only status options and the PIN Settings button are gone; the full Owner status list remains',
  !html.includes('Classroom Teachers') && !html.includes('btn-pinsettings') &&
  ((sel) => (sel.match(/<option value="Pending Signature">/g) || []).length === 1 && ['Under Review', 'Needs Info', 'Split', 'Merged', 'Cancelled'].every((s) => sel.includes('<option value="' + s + '">')))
    ((/<select id="mgmt-status-filter"[\s\S]*?<\/select>/.exec(html) || [''])[0]));
check('the success image is an inline SVG, and Switch Account no longer leaves for a Google sign-in page',
  /<img src="data:image\/svg\+xml,[^"]+" alt="Order submitted">/.test(html) && !/googleusercontent\.com\/u\//.test(html) &&
  /function switchAccount\(\) \{\n[^\n]*\n\s*appAlert\([^\n]*\); return;/.test(html));
check('the backup-approver default is the role mailbox backup.approver@example.edu', html.includes("const DEFAULT_BACKUP_APPROVER = 'backup.approver@example.edu';"));

/* ---------- on-load shapes ---------- */
const boot0 = M.getBootstrapData();
const catKeys = ['id', 'category', 'name', 'image', 'leadTime', 'colors', 'options', 'price'];
check('getBootstrapData: catalog has office / furniture / cleaning (renderCatalog needs all three), each item in the server shape',
  ['office', 'furniture', 'cleaning'].every((k) => Array.isArray(boot0.catalog[k]) && boot0.catalog[k].length >= 8 && boot0.catalog[k].every((c) => eq(Object.keys(c), catKeys) && Array.isArray(c.colors))) &&
  boot0.catalog.cleaning.length === 8 && boot0.catalog.cleaning.every((c) => c.category === 'Cleaning & Maintenance'));
check('getBootstrapData: charging departments (primary Science, Fine Arts alternate, active list) and a notify picker that excludes the caller, own departments first',
  boot0.depts.primary === 'Science' && eq(boot0.depts.alternates, ['Fine Arts']) && boot0.depts.allActive.includes('Science') && !boot0.depts.allActive.includes('Yearbook') &&
  boot0.staff.length > 5 && boot0.staff.every((s) => s.email && s.name && 'dept' in s && 'inMyDepts' in s) && !boot0.staff.some((s) => s.email === ME) &&
  boot0.staff.findIndex((s) => !s.inMyDepts) > boot0.staff.findLastIndex((s) => s.inMyDepts));
check('the dollies the page offers with a bookshelf or filing cabinet are in the furniture catalog',
  boot0.catalog.furniture.some((c) => /filing cabinet caddy/i.test(c.name)) && boot0.catalog.furniture.some((c) => /storage cabinet doll/i.test(c.name)));

/* ---------- the seed covers every status; the queue holds only open work ---------- */
const STATUSES = ['Pending Approval', 'Under Review', 'Needs Info', 'Pending Signature', 'On Hold', 'Approved', 'Fulfillment', 'Closed/Paid', 'Cancellation Requested', 'Cancelled', 'Rejected', 'Split', 'Merged'];
const TERMINAL = ['Closed/Paid', 'Cancelled', 'Rejected', 'Split', 'Merged'];
const byStatus = Object.fromEntries(STATUSES.map((s) => [s, M.searchOrders({ status: s }).total]));
check('at least one seeded order in each of the 13 statuses', STATUSES.every((s) => byStatus[s] >= 1), JSON.stringify(byStatus));
const queue = M.getMasterQueue();
const ORDER_KEYS = ['id', 'requestor', 'requestorEmail', 'date', 'sy', 'status', 'approvedAt', 'approvedBy', 'cancelJustification', 'vendor', 'bank', 'payType', 'total',
  'packingSummary', 'pricedAt', 'fulfillmentAt', 'closedAt', 'preCancelStatus', 'chargingDepartment', 'additionalNotify', 'poPdfUrl', 'parentId', 'adjustments',
  'assignedApprover', 'returnedAmount', 'items'];
const ITEM_KEYS = ['lineId', 'name', 'qty', 'unitCost', 'notes', 'status', 'fulfillNote', 'url', 'attachmentUrl', 'attachmentFileName', 'returnedQty'];
check('getMasterQueue excludes Closed/Paid, Cancelled, Rejected, Split and Merged, and holds every open status, newest first',
  queue.length > 0 && !queue.some((o) => TERMINAL.includes(o.status)) && STATUSES.filter((s) => !TERMINAL.includes(s)).every((s) => queue.some((o) => o.status === s)) &&
  queue.every((o, i) => i === 0 || new Date(queue[i - 1].date) >= new Date(o.date)));
check('queue orders carry every field the management views read, items every line field, ids <orderId>-<n>',
  queue.every((o) => ORDER_KEYS.every((k) => k in o) && o.items.every((it) => ITEM_KEYS.every((k) => k in it) && it.lineId.startsWith(o.id + '-'))));
check('school year is derived from the date (SY26-27 form) and an unpriced order has a blank total',
  queue.every((o) => { const d = new Date(o.date), y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return o.sy === 'SY' + String(y % 100).padStart(2, '0') + '-' + String((y + 1) % 100).padStart(2, '0'); }) &&
  queue.filter((o) => !o.pricedAt).every((o) => o.total === '') && queue.filter((o) => o.pricedAt).every((o) => typeof o.total === 'number'));
const totalOf = (o) => { const sub = o.items.reduce((s, it) => s + it.qty * it.unitCost, 0); const adj = (o.adjustments || []).reduce((s, a) => { const v = a.mode === 'pct' ? Math.round(sub * a.value) / 100 : a.value; return s + (a.type === 'discount' ? -v : v); }, 0); return Math.round((sub + adj - (o.returnedAmount || 0)) * 100) / 100; };
const allOrders = M.searchOrders({ q: 'ORD-' }).orders;
check('every priced order\'s total is line costs + charges − discounts − returns', allOrders.filter((o) => o.pricedAt).every((o) => near(o.total, totalOf(o))),
  allOrders.filter((o) => o.pricedAt && !near(o.total, totalOf(o))).map((o) => o.id + ' ' + o.total + ' vs ' + totalOf(o)).join('; '));
const hist = M.getUserOrderHistory(ME);
check('getUserOrderHistory: only the caller\'s orders, newest first, in the history shape', hist.length >= 6 &&
  hist.every((o) => ['id', 'date', 'sy', 'status', 'total', 'adjustments', 'returnedAmount', 'parentId', 'items'].every((k) => k in o)) &&
  hist.every((o) => allOrders.find((x) => x.id === o.id).requestorEmail === ME) && hist.every((o, i) => i === 0 || new Date(hist[i - 1].date) >= new Date(o.date)));
const tid = queue.find((o) => o.status === 'On Hold').id;
check('comments carry visibility, the audit log and the requestor timeline read from the same trail',
  M.getOrderComments(tid).every((c) => ['commentId', 'orderId', 'author', 'role', 'visibility', 'body', 'createdAt'].every((k) => k in c)) && M.getOrderComments(tid).length >= 2 &&
  M.getOrderAudit(tid).every((x) => eq(Object.keys(x), ['actor', 'action', 'detail', 'at'])) && M.getOrderTimeline(tid).every((x) => eq(Object.keys(x), ['label', 'at'])) &&
  M.getOrderTimeline(tid).some((x) => x.label === 'Priced by purchasing'));

/* ---------- one order through the whole flow ---------- */
const newId = M.submitOrder({ email: ME, priority: false, neededBy: '', chargingDepartment: 'Science', additionalNotify: ['jwolf@example.edu'] },
  [{ id: 'OFF-001', category: 'Office Supply', name: 'Copy Paper (Case of 10 Reams)', url: '', qty: 3, color: '', option: 'White', notes: 'Copy room', price: 44.99 },
   { id: 'CUSTOM-1', category: 'Custom', name: 'Amazon - Label Maker', url: 'https://www.amazon.com/', qty: 1, color: '', option: '', notes: '', price: 39.99 }]);
let o = M.getMasterQueue().find((x) => x.id === newId);
check('submitOrder returns an ORD-yyyymmdd-nnnn id and creates a Pending Approval order with a blank total', /^ORD-\d{8}-\d{4}$/.test(newId) && o.status === 'Pending Approval' && o.total === '' &&
  o.items.length === 2 && o.items[0].notes === 'White | Copy room' && o.additionalNotify === 'jwolf@example.edu' && M.getUserOrderHistory(ME)[0].id === newId);
check('a custom item with neither a link nor a quote is refused', throws(() => M.submitOrder({}, [{ category: 'Custom', name: 'X', qty: 1, price: 1 }]), /link or an attached quote/));
M.beckyUpdateOrder(newId, { vendor: 'Staples', bank: 'HCS Operating', payType: 'Credit Card', total: '0.00', adjustments: [{ label: 'Shipping', type: 'charge', mode: 'flat', value: 7.5 }, { label: 'Coupon', type: 'discount', mode: 'pct', value: 10 }] },
  [{ id: newId + '-1', cost: 40 }, { id: newId + '-2', cost: 35 }]);
o = M.getMasterQueue().find((x) => x.id === newId);
check('beckyUpdateOrder prices it server-side (3×40 + 35 = 155, +7.50 shipping −10% = 147.00, the client total ignored) → Pending Signature',
  o.status === 'Pending Signature' && near(o.total, 147) && o.vendor === 'Staples' && !!o.pricedAt && o.adjustments.length === 2);
check('a wrong PIN is refused (Invalid Approval PIN) and a bad PIN at the gate throws Invalid PIN',
  throws(() => M.bryanVerifyAndSign(newId, '0000'), /Invalid Approval PIN/) && throws(() => M.verifyApproverPin('0000'), /^Invalid PIN$/) && M.verifyApproverPin('1234') === true);
const signed = M.bryanVerifyAndSign(newId, '1234');
o = M.getMasterQueue().find((x) => x.id === newId);
check('bryanVerifyAndSign with PIN 1234 → Approved, stamped and signed by the caller', typeof signed === 'string' && o.status === 'Approved' && !!o.approvedAt && o.approvedBy === ME);
check('the approved order\'s lines show up in Buy by Vendor, grouped by store', M.getBuyByVendor().some((g) => g.vendor === 'Amazon' && g.items.some((it) => it.orderId === newId)));
M.markOrderFulfilled(newId);
check('markOrderFulfilled → Fulfillment', M.getMasterQueue().find((x) => x.id === newId).status === 'Fulfillment');
M.markOrderClosed(newId);
check('markOrderClosed → Closed/Paid, which leaves the queue but is found by search', !M.getMasterQueue().some((x) => x.id === newId) && M.searchOrders({ q: newId }).orders[0].status === 'Closed/Paid' &&
  M.searchOrders({ q: '147.00' }).orders.some((x) => x.id === newId));
check('the requestor timeline shows priced and approved', eq(M.getOrderTimeline(newId).map((x) => x.label), ['Priced by purchasing', 'Approved & signed']));
check('closing is refused unless the order is in Fulfillment', throws(() => M.markOrderClosed(queue.find((x) => x.status === 'Approved').id), /Fulfillment/));

/* ---------- the other branches ---------- */
const pa = M.submitOrder({ chargingDepartment: 'Science' }, [{ category: 'Office Supply', name: 'Sticky Notes (Pack of 24)', qty: 1, price: 14.75 }]);
M.beckySendBack(pa, 'Which color?'); const needs = M.getMasterQueue().find((x) => x.id === pa);
M.resubmitOrder(pa, 'Yellow'); const back = M.getMasterQueue().find((x) => x.id === pa);
check('send back → Needs Info with a public note; resubmit → Pending Approval',
  needs.status === 'Needs Info' && M.getOrderComments(pa).some((c) => c.visibility === 'public' && c.body === 'Which color?') && back.status === 'Pending Approval');
M.beckyUpdateOrder(pa, { vendor: 'Staples', bank: 'HCS Operating', payType: 'Check', adjustments: [] }, []);
M.bryanHoldOrder(pa, 'Why now?'); const held = M.getMasterQueue().find((x) => x.id === pa).status;
M.bryanRejectOrder(pa, 'No.'); const ur = M.getMasterQueue().find((x) => x.id === pa).status;
M.reopenUnderReview(pa); const reopened = M.getMasterQueue().find((x) => x.id === pa).status;
M.bryanRejectOrder(pa, 'Still no.'); M.beckyPublishRejection(pa, 'Not this year.');
check('hold → On Hold, approver reject → Under Review, reopen → Pending Signature, publish → Rejected (out of the queue)',
  held === 'On Hold' && ur === 'Under Review' && reopened === 'Pending Signature' && M.searchOrders({ q: pa }).orders[0].status === 'Rejected' && !M.getMasterQueue().some((x) => x.id === pa));
const cr = queue.find((x) => x.status === 'Cancellation Requested');
M.denyCancellation(cr.id);
check('denying a cancellation restores the prior status', M.getMasterQueue().find((x) => x.id === cr.id).status === cr.preCancelStatus);
M.requestCancellation(cr.id, 'Changed my mind'); M.approveCancellation(cr.id);
check('requesting then confirming a cancellation → Cancelled', M.searchOrders({ q: cr.id }).orders[0].status === 'Cancelled');
check('a Pending Approval order cancels directly; requesting cancellation on one is refused',
  throws(() => M.requestCancellation(queue.find((x) => x.status === 'Pending Approval').id, 'x'), /cannot be cancelled/) &&
  M.cancelOrder(M.submitOrder({}, [{ category: 'Office Supply', name: 'Pens', qty: 1, price: 1 }])) === 'Order cancelled successfully.');
const ps = queue.find((x) => x.status === 'Pending Signature' && !x.assignedApprover);
const routed = M.routeToBackupApprover(ps.id, 'backup.approver@example.edu');
check('routing to the backup approver records the assignment and grants temporary access', eq(routed, { orderId: ps.id, routedTo: 'backup.approver@example.edu' }) &&
  M.getMasterQueue().find((x) => x.id === ps.id).assignedApprover === 'backup.approver@example.edu' &&
  M.getDelegations().some((d) => d.delegateEmail === 'backup.approver@example.edu' && d.state === 'Active') && throws(() => M.routeToBackupApprover(ps.id, ME), /yourself/));
M.approveOnBehalf(ps.id, 'Both approvers out');
check('approve on the approver\'s behalf → Approved, signed "(on behalf of approver)"', M.getMasterQueue().find((x) => x.id === ps.id).approvedBy === ME + ' (on behalf of approver)');

/* ---------- split / merge / adjust / return arithmetic ---------- */
const tgt = queue.find((x) => x.id.endsWith('-4127')), src = queue.find((x) => x.id.endsWith('-4130'));
const merged = M.mergeOrders(tgt.id, [src.id], '');
const tgt2 = M.getMasterQueue().find((x) => x.id === tgt.id);
check('mergeOrders: the source\'s line moves onto the target (3 + 1 = 4 lines, new line ids), the source becomes Merged and points at the target',
  eq(merged, { targetId: tgt.id, merged: [src.id], itemsMoved: 1 }) && tgt2.items.length === 4 && tgt2.items[3].lineId === tgt.id + '-4' &&
  M.searchOrders({ q: src.id }).orders.find((x) => x.id === src.id).status === 'Merged' && M.searchOrders({ q: src.id }).orders.find((x) => x.id === src.id).parentId === tgt.id);
check('merging across requestors is refused', throws(() => M.mergeOrders(tgt.id, [queue.find((x) => x.status === 'Pending Approval' && x.requestorEmail !== tgt.requestorEmail).id]), /one requestor/));
const sub = (x) => Math.round(x.items.reduce((s, it) => s + it.qty * it.unitCost, 0) * 100) / 100;
const lines = tgt2.items.map((it) => it.lineId);
const split = M.splitOrder(tgt.id, [[lines[0], lines[1], lines[3]], [lines[2]]]);
const kids = split.children.map((id) => M.getMasterQueue().find((x) => x.id === id));
check('splitOrder: two children -A/-B in Pending Approval, every line in exactly one, quantities and subtotal conserved, vendor pre-filled per store, parent retired as Split',
  eq(split.children, [tgt.id + '-A', tgt.id + '-B']) && kids.every((k) => k.status === 'Pending Approval' && k.parentId === tgt.id && k.total === '') &&
  kids[0].items.length + kids[1].items.length === 4 && near(sub(kids[0]) + sub(kids[1]), sub(tgt2)) &&
  kids[0].vendor === 'Blick' && kids[1].vendor === 'Amazon' && M.searchOrders({ status: 'Split' }).orders.some((x) => x.id === tgt.id));
check('a split that leaves a line unassigned is refused', throws(() => M.splitOrder(kids[0].id, [[kids[0].items[0].lineId], [kids[0].items[1].lineId]]), /exactly one group/));
const ful = queue.find((x) => x.status === 'Fulfillment' && x.adjustments.length === 0 && x.items.length >= 3);
const adj = M.adjustOrderCost(ful.id, ful.items.map((it, i) => ({ id: it.lineId, cost: i === 0 ? it.unitCost + 1 : it.unitCost })), [{ label: 'Freight', type: 'charge', mode: 'flat', value: 10 }], 'Final invoice');
check('adjustOrderCost: new total = old + qty×$1 on line one + $10 freight; delta matches; status unchanged',
  near(adj.newTotal, ful.total + ful.items[0].qty + 10) && near(adj.delta, adj.newTotal - adj.previousTotal) && near(adj.previousTotal, ful.total) && !!adj.at &&
  M.getMasterQueue().find((x) => x.id === ful.id).status === 'Fulfillment' && M.getOrderAudit(ful.id).some((x) => x.action === 'Cost adjusted'));
const ap = M.getMasterQueue().find((x) => x.status === 'Approved' && x.items.some((it) => it.qty >= 10));
const chair = ap.items.find((it) => it.qty >= 10);
const ret = M.recordReturn(ap.id, [{ lineId: chair.lineId, qty: 2, refund: null }], 'Wrong color', null);
const ap2 = M.getMasterQueue().find((x) => x.id === ap.id);
check('recordReturn: 2 returned at the unit cost credits 2×cost, the total drops by exactly that, the line shows 2 returned (not fully Returned)',
  ret.itemsReturned === 2 && near(ret.refundTotal, 2 * chair.unitCost) && near(ret.newTotal, ap.total - 2 * chair.unitCost) && near(ap2.total, ret.newTotal) &&
  near(ap2.returnedAmount, 2 * chair.unitCost) && ap2.items.find((it) => it.lineId === chair.lineId).returnedQty === 2 && ap2.items.find((it) => it.lineId === chair.lineId).status !== 'Returned' &&
  M.getReturns(ap.id).length === 1 && M.getReturns(ap.id)[0].reason === 'Wrong color');
check('returning more than remains is refused; returning the rest marks the line Returned',
  throws(() => M.recordReturn(ap.id, [{ lineId: chair.lineId, qty: chair.qty }], 'x', null), /remain unreturned/) &&
  (M.recordReturn(ap.id, [{ lineId: chair.lineId, qty: chair.qty - 2 }], 'rest', null), M.getMasterQueue().find((x) => x.id === ap.id).items.find((it) => it.lineId === chair.lineId).status === 'Returned'));
const docs0 = M.getOrderDocuments(ap.id).length;
M.uploadOrderDocument(ap.id, 'Packing List', 'AAAA', 'slip.pdf', 'application/pdf');
check('uploading a Packing List to an Approved order moves it to Fulfillment; documents list and delete work',
  M.getMasterQueue().find((x) => x.id === ap.id).status === 'Fulfillment' && M.getOrderDocuments(ap.id).length === docs0 + 1 &&
  /^Deleted "slip\.pdf"\.$/.test(M.deleteOrderDocument(ap.id, M.getOrderDocuments(ap.id).find((x) => x.originalName === 'slip.pdf').docId)));

/* ---------- management tabs ---------- */
const tables = [M.getFullCatalog(), M.getVendorList(), M.getUserList()];
check('Products / Vendors / Users are 2-D arrays with a header row; Users carries the 15 sync columns',
  tables.every((t) => Array.isArray(t) && t.length > 5 && t.every((r) => Array.isArray(r) && r.length === t[0].length)) && tables[2][0].length === 15);
const cat = M.getFullCatalog(); const row = cat[1].slice(); row[8] = '50.00';
M.updateSheetData('Catalog_Items', row, 1);
check('editing a product row updates the New Order catalog too', M.getCatalogItems().office.find((c) => c.id === row[0]).price === 50);
check('email rules keep the 17 events with four recipient flags', M.getEmailRulesList().length === 17 && M.getEmailRulesList().every((r) => ['key', 'desc', 'notifyRequestor', 'notifyManager', 'notifyApprover', 'notifyNotify'].every((k) => k in r)));
const depts = M.getDepartments(true), stats = M.getDepartmentStats();
check('departments are records (inactive included on request) with per-department stats',
  depts.some((d) => !d.active) && depts.every((d) => ['name', 'category', 'description', 'active', 'headEmail', 'budget', 'ouPath', 'createdAt', 'viewers'].every((k) => k in d)) &&
  M.getDepartments(false).every((d) => d.active) && Object.values(stats).every((s) => 'userCount' in s && 'orderCount' in s && 'ytdSpend' in s));
check('save / deactivate a department and run the directory sync',
  M.saveDepartment({ name: 'Robotics', category: 'Faculty', active: true, budget: '1500' }) === 'Department created.' && M.setDepartmentActive('Robotics', false) === 'Department deactivated.' &&
  ['added', 'updated', 'deactivated', 'departmentsCreated', 'totalProcessed', 'syncedAt'].every((k) => k in M.syncFromGoogleAdmin()));
const dl = M.getDelegations();
check('temporary approvers: Active, Scheduled, Expired and Revoked states; add and revoke',
  ['Active', 'Scheduled', 'Expired', 'Revoked'].every((s) => dl.some((d) => d.state === s)) &&
  (() => { const t = new Date(); const ymd = (d) => d.toISOString().slice(0, 10); const r = M.addDelegation('akim@example.edu', ymd(t), ymd(new Date(t.getTime() + 3 * 864e5))); return r.delegateName === 'Avery Kim' && M.revokeDelegation(r.id) === 'Delegation revoked.'; })());
const team = M.getTeamOrders(ME);
check('Team Orders: why-you-see-these reasons on every order, and the access summary', team.access.hasAny && team.orders.length > 5 &&
  team.orders.every((x) => x.teamAccessReasons.length > 0) && team.orders.some((x) => x.teamAccessReasons.includes('Viewer of Fine Arts')) && team.orders.some((x) => x.teamAccessReasons.includes('Manages requestor')));
const v = M.saveView('Mine', { status: 'ALL' }, 'teamorders');
check('saved views are kept per type; save and delete', M.getSavedViews().every((x) => x.viewType === 'analytics') && M.getSavedViews('teamorders').some((x) => x.id === v.id) &&
  M.deleteSavedView(v.id) === 'View deleted.' && !M.getSavedViews('teamorders').some((x) => x.id === v.id));
check('the remaining management calls answer in shape', M.getApproverSettings(ME).isBypass === true && typeof M.markItemsOrdered === 'function' &&
  eq(Object.keys(M.scanDriveForNewSlips()), ['scanned', 'registered', 'errors']) && M.generatePOPDF(queue[0].id) === '#' && M.generateOrderPacket(queue[0].id) === '#' &&
  M.updateEmailRules([]) === 'Email rules updated.' && M.markWizardSeen() === true && M.getAnalyticsScope().full === true);

/* ---------- analytics (every tab the page renders) ---------- */
const now = new Date(), y0 = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
const csy = { dateFrom: new Date(y0, 8, 1).toISOString(), dateTo: new Date(y0 + 1, 7, 31).toISOString(), schoolYear: null, departments: [], vendors: [], requestors: [], categories: [], banks: [], payTypes: [], statuses: [], minAmount: null, maxAmount: null, priorityOnly: false };
const an = M.getAnalytics(csy);
check('Spending: KPIs, six group-bys, Pareto ending at 100%, and filter options; vendor totals never exceed spend',
  an.totalSpend > 0 && an.orderCount > 5 && ['vendor', 'department', 'category', 'bank', 'payType', 'requestor'].every((k) => an.groupedBy[k].length > 0) &&
  near(an.groupedBy.department.reduce((s, r) => s + r.total, 0), an.totalSpend) && an.paretoVendors.at(-1).cumulativePct <= 100.01 &&
  an.filterOptions.schoolYears.length >= 3 && an.deptByCategory.matrix.length === an.deptByCategory.departments.length);
check('a department filter narrows Spending to that department', (() => { const s = M.getAnalytics({ ...csy, departments: ['Science'] }); return s.totalSpend > 0 && s.totalSpend < an.totalSpend && eq(s.groupedBy.department.map((r) => r.department), ['Science']); })());
const pm = M.getProcessingMetrics(csy), tr = M.getTrendsMetrics(csy);
check('Processing: stage averages, a 5-stage funnel, outstanding by status, cycle and cancellation tables',
  pm.funnel.length === 5 && pm.funnel[0].pct === 100 && pm.outstandingByStatus.length > 0 && ['cycleByDepartment', 'cycleByVendor', 'cycleByRequestor', 'cancelByDepartment', 'cancelByCategory'].every((k) => Array.isArray(pm[k])));
check('Trends: 12 school-year months against the prior year, a two-year heatmap, weekdays, quarters, departments, vendor change',
  tr.hasPriorPeriod && tr.monthlyCurrentVsPrior.months.length === 12 && tr.monthlyCurrentVsPrior.prior.some((x) => x > 0) && tr.heatmap.rows.length === 2 &&
  tr.dayOfWeek.length === 7 && tr.quarterlyComparison.years.length === 3 && tr.deptTrend.departments.length > 0 && tr.vendorChange.length > 0 &&
  near(tr.cumulativeCurrentVsPrior.current.at(-1), tr.monthlyCurrentVsPrior.current.reduce((s, x) => s + x, 0)));
const vi = M.getVendorIntelligence(), by = M.getSchoolYearOverview(), bud = boot().MOCK_BACKEND.getDepartmentBudgets(), ro = M.getReorderCandidates(), fin = M.getFinancialSummary(), rs = M.getReturnsSummary();
check('Vendors tab: summary counts match the vendor rows, each row has the table columns',
  vi.summary.totalVendors === vi.vendors.length && vi.topByOrders.length > 0 && vi.vendors.every((x) => ['vendor', 'orders', 'knownSpend', 'firstUsed', 'lastUsed', 'status', 'topItems'].every((k) => k in x)));
check('By Year tab: three school years whose orders add up to the total', by.years.length === 3 && by.summary.totalOrders === by.years.reduce((s, x) => s + x.orders, 0), JSON.stringify(by.summary));
check('Budgets tab (fresh seed): current SY label, at least one department over budget, every row in the table shape',
  /^SY\d{2}-\d{2}$/.test(bud.currentSy) && bud.summary.overCount >= 1 && bud.departments.every((d) => ['department', 'budget', 'spent', 'remaining', 'pctUsed'].every((k) => k in d)), JSON.stringify(bud.summary));
check('Reorder tab: items, a top-15 chart list and the truncation flag', ro.items.length > 0 && ro.topByCount.length > 0 && 'truncated' in ro);
check('Financial tab: net adjustments = charges − discounts, spend by payment type and bank', near(fin.netAdjustments, fin.totalCharges - fin.totalDiscounts) && fin.byPayType.length > 0 && fin.byBank.length > 0);
check('Returns tab: the refund total is the sum of the return rows', near(rs.totalRefunded, rs.items.reduce((s, x) => s + x.refund, 0)) && rs.returnCount === rs.items.length, JSON.stringify([rs.totalRefunded, rs.returnCount, rs.items.length]));
check('the PDF report call answers (the demo has no Drive)', M.generateAnalyticsReportPDF({ subTab: 'spending' }) === '#');

/* ---------- state: survives a reload in the same tab, not a new tab; dates slide to today ---------- */
const store = memoryStorage();
const A = boot(store).MOCK_BACKEND;
const kept = A.submitOrder({ chargingDepartment: 'Science' }, [{ category: 'Office Supply', name: 'Pens', qty: 1, price: 6.99 }]);
check('a submitted order survives a reload in the same tab (sessionStorage) and a new tab starts clean',
  boot(store).MOCK_BACKEND.getMasterQueue().some((x) => x.id === kept) && !boot().MOCK_BACKEND.getMasterQueue().some((x) => x.id === kept));
const later = 200 * 864e5;
class LaterDate extends Date { constructor(...a) { if (a.length) super(...a); else super(Date.now() + later); } static now() { return Date.now() + later; } }
const L = boot(memoryStorage(), LaterDate).MOCK_BACKEND;
const lq = L.getMasterQueue(), base = new Date(D.anchor + 'T12:00:00');
check('opened 200 days later, every date and every ORD-yyyymmdd id slides together, so the newest order is still from "yesterday"',
  lq.every((x) => { const d = new Date(x.date); return x.id.slice(4, 12) === String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }) &&
  Math.round((new Date(lq[0].date) - base) / 864e5) >= 198);

/* ---------- privacy ---------- */
const SCHOOL_DOMAIN = 'harford' + 'christian'; // split, as in build-demo.mjs: this file is scanned too
const blob = html + dataSrc + mockSrc;
check('no real school domain, deployment id, spreadsheet link or Drive file id in the page, data or mock',
  !new RegExp(SCHOOL_DOMAIN + String.raw`|AKfycb|docs\.google\.com\/spreadsheets|drive\.google\.com|1[A-Za-z0-9_-]{30,}`, 'i').test(blob));
check('no staff first names (hash-matched) and no hashed phrases left in the built page',
  findStaffNames(html).length === 0 && findPhrases(html, Object.assign({}, PHRASE_ALIASES, cfg.nameAliases)).length === 0,
  'names: ' + findStaffNames(html).join(', '));
check('no hash-matched staff mailbox remains', aliasEmailLocals(html).count === 0 && aliasEmailLocals(dataSrc).count === 0);
const emails = [...blob.matchAll(/[\w.+-]+@[A-Za-z][\w-]*\.[\w.]+/g)].map((m) => m[0].replace(/\.+$/, ''));
check('every email address is on example.edu', emails.length > 20 && emails.every((e) => /@example\.edu$/.test(e)), [...new Set(emails.filter((e) => !/@example\.edu$/.test(e)))].join(', '));
const phones = [...blob.matchAll(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/g)].map((m) => m[0]);
check('every phone number is a 555 number', phones.length > 0 && phones.every((p) => /^\d{3}[-.]555[-.]\d{4}$/.test(p)), phones.join(', '));

/* ---------- fresh build ---------- */
if (!existsSync(SRC)) { check('source project present for the fresh-build check', false, SRC); }
else {
  try {
    mkdirSync(ROOT + '.tmp', { recursive: true });
    const tmpCfg = ROOT + '.tmp/verify-purchasing.json', tmpOut = ROOT + '.tmp/verify-purchasing.html';
    writeFileSync(tmpCfg, JSON.stringify({ ...cfg, dst: tmpOut }));
    execFileSync(process.execPath, [ROOT + 'tools/build-demo.mjs', tmpCfg], { cwd: ROOT, stdio: 'pipe' });
    check('index.html is what build-demo.mjs produces from the current source (not stale)', readFileSync(tmpOut, 'utf8') === html,
      'rebuild: node tools/build-demo.mjs demos/purchasing/build.json');
  } catch (e) { check('index.html could be rebuilt from build.json', false, e.message); }
}

console.log(fail ? `\n${fail} of ${count} checks FAILED` : `\nall ${count} demo checks passed`);
process.exit(fail ? 1 : 0);
