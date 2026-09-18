// Verifies the Talon Hub · Staff demo. Run: node demos/talon-hub/verify.mjs
//
// This demo had NO verifier until 2026-09-18, which is why it drifted five months without
// anyone noticing: the portfolio scanner watches top-level google.script.run method names, and
// this app funnels every operation through ONE of them (api), so 136 unanswered operations were
// invisible to it and it kept reporting "mock contract intact".
//
// What this owns: the page is buildable and clean, the mock answers what the client asks, and
// an operation the demo has NOT reproduced says so out loud instead of dying silently.
import { readFileSync } from 'fs';

const here = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SRC = '../../../athletics/talon-hub/apps/staff/pages/';
const PAGES = ['ClientLogic', 'StaffApp', 'Staff', 'EventFormatEditor', 'TryoutResults'];

let fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) fail++; };

const w = {};
new Function('window', readFileSync(here + 'data.js', 'utf8'))(w);
new Function('window', readFileSync(here + 'mock.js', 'utf8'))(w);
const api = w.MOCK_BACKEND.api;
const D = w.STAFF_DATA;

let src = '';
try {
  src = PAGES.map(f => readFileSync(new URL(SRC + f + '.html', import.meta.url), 'utf8')).join('\n');
} catch (e) {
  console.log('SKIP — talon-hub source not checked out next to this repo (' + e.message + ')');
  process.exit(0);
}
const ops = [...new Set([...src.matchAll(/\bcall\(\s*'([A-Za-z0-9_.]+)'/g)].map(m => m[1]))].sort();

/* ---------- the dispatcher contract ---------- */
check('every op the client calls returns an envelope, never undefined or a throw',
  ops.every(op => {
    try { const r = api(op, {}); return r && typeof r.ok === 'boolean'; } catch (e) { return false; }
  }));
check('an unknown op is refused HONESTLY, not with a silent nothing',
  (() => {
    const r = api('noSuchOperationAtAll', {});
    return r && r.ok === false && r.code === 'DEMO_ONLY' && /demo/i.test(r.msg || '');
  })());

/* ---------- the boot path must actually work ---------- */
check('getStaffBundle returns the bundle the app boots from',
  (() => {
    const r = api('getStaffBundle', {});
    return r && r.ok === true && Array.isArray(r.teams) && r.teams.length > 0;
  })());
check('the core read paths are all really answered (not the fallback)',
  ['getStaffBundle', 'getDeptSchedule', 'getEventBoard', 'getTeamRoster', 'listAnnouncements',
   'getTeamConfig', 'globalSearch', 'listSessions', 'listDrills']
    .every(op => { const r = api(op, {}); return r && r.code !== 'DEMO_ONLY'; }));

/* ---------- lost + found: data existed, handlers did not ---------- */
check('lost+found lists the fabricated items',
  (() => { const r = api('lostFoundList', {}); return r.ok && r.items.length >= 2 && r.items[0].ItemID; })());
check('lost+found is really stateful — post, return and remove all take effect',
  (() => {
    const before = api('lostFoundList', {}).items.length;
    if (!api('postLostItem', { description: 'Red hoodie', where: 'Gym' }).ok) return false;
    const added = api('lostFoundList', {}).items;
    if (added.length !== before + 1) return false;
    const id = added[0].ItemID;
    if (!api('returnLostItem', { itemId: id }).ok) return false;
    const returned = api('lostFoundList', {}).items.filter(x => x.ItemID === id)[0];
    if (!returned || returned.Claimed !== true) return false;
    if (!api('removeLostItem', { itemId: id }).ok) return false;
    return api('lostFoundList', {}).items.length === before;
  })());
check('lost+found refuses an empty description rather than posting a blank row',
  api('postLostItem', {}).ok === false);

/* ---------- coverage, reported not asserted ---------- */
const answered = ops.filter(op => { const r = api(op, {}); return r && r.code !== 'DEMO_ONLY'; });
const pct = Math.round((100 * answered.length) / ops.length);
console.log(`\n  coverage: ${answered.length}/${ops.length} operations answered (${pct}%);` +
  ` the rest return DEMO_ONLY and say so on screen.`);
check('the boot path and the areas claimed as demoable are covered',
  answered.length >= 110);

/* ---------- the built page ---------- */
const page = readFileSync(here + 'index.html', 'utf8');
const scan = page.replace(/base64,[A-Za-z0-9+/=\s]+/g, 'base64,<img>');
check('no unreplaced Apps Script template tokens', !/<\?[=!]/.test(page));
check('the page is a complete document (the app itself is a fragment)',
  /^<!DOCTYPE html>/.test(page) && /<\/head>/.test(page) && /<\/body>\s*<\/html>\s*$/.test(page));
check('the demo shim, data and mock are wired in',
  /gsr-shim\.js/.test(page) && /src="data\.js"/.test(page) && /src="mock\.js"/.test(page));
check('the login gate is suppressed — a demo must not open on a sign-in wall',
  /id="need-login" hidden>0</.test(page));
check('no real domain, deployment id or live /exec URL reached the page',
  !/harford ?christian/i.test(scan) && !/AKfycb/.test(scan) &&
  !/script\.google\.com\/macros/.test(scan));
check('the fabricated data uses example.* addresses only',
  !/@(?!example\.)[a-z0-9.-]+\.(org|com|edu)/i.test(JSON.stringify(D).replace(/example\.[a-z]+/g, 'example.x')));

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
