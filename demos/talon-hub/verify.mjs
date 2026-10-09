// Verifies the Talon Hub demo — the staff app (staff.html) and the public fan pages (fan.html,
// widget.html) that share its data.js + mock.js. Run: node demos/talon-hub/verify.mjs
//
// This demo had NO verifier until 2026-09-18, which is why it drifted five months without
// anyone noticing: the portfolio scanner watches top-level google.script.run method names, and
// this app funnels every operation through ONE of them (api), so 136 unanswered operations were
// invisible to it and it kept reporting "mock contract intact".
//
// What this owns: the page is buildable and clean, the mock answers what the client asks, and
// an operation the demo has NOT reproduced says so out loud instead of dying silently.
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import os from 'os';
import path from 'path';

const here = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SRC = '../../../athletics/talon-hub/apps/staff/pages/';
const PAGES = ['ClientLogic', 'StaffApp', 'Staff', 'EventFormatEditor', 'TryoutResults'];

let fail = 0;
const check = (l, c) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) fail++; };

// One page load = one fresh window running fan-logic.js, data.js and mock.js. Pass a shared
// storage object to model two pages (staff.html, then fan.html) in the same browser tab.
function memStorage() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } };
}
function load(storage) {
  const win = storage ? { sessionStorage: storage } : {};
  new Function('window', readFileSync(here + 'fan-logic.js', 'utf8'))(win);
  new Function('window', readFileSync(here + 'data.js', 'utf8'))(win);
  new Function('window', readFileSync(here + 'mock.js', 'utf8'))(win);
  return win;
}
const w = load();
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
const page = readFileSync(here + 'staff.html', 'utf8');
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

/* =====================================================================
   FAN SURFACE (apps/fan) — public, anonymous, read-only
   ===================================================================== */
const ROOT = path.resolve(here, '../..');
const FAN_SRC = path.resolve(ROOT, '../athletics/talon-hub/apps/fan/pages/');
const fanClient = ['FanApp', 'Widget'].map(f => readFileSync(path.join(FAN_SRC, f + '.html'), 'utf8')).join('\n');
const fanOps = [...new Set([...fanClient.matchAll(/\bcall\(\s*'([A-Za-z0-9_.]+)'/g)].map(m => m[1]))].sort();

/* ---------- the vendored logic is the real thing, and current ---------- */
{
  const { assemble, SRC: LOGIC_SRC } = await import(new URL('./build-logic.mjs', import.meta.url));
  const bundle = readFileSync(here + 'fan-logic.js', 'utf8');
  check('fan-logic.js is the fan app\'s own server modules, unchanged since build-logic.mjs ran',
    assemble(LOGIC_SRC) === bundle);
  const fv = readFileSync(path.join(LOGIC_SRC, 'fanview.js'), 'utf8').replace(/\r\n?/g, '\n');
  check('the FanView whitelist inside fan-logic.js is byte-for-byte the deployed apps/fan/server/lib/fanview.js',
    bundle.includes(fv));
}

/* ---------- the built fan pages are fresh ---------- */
{
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'talon-fan-'));
  for (const [cfgName, out] of [['build.fan.json', 'fan.html'], ['build.widget.json', 'widget.html']]) {
    const cfg = JSON.parse(readFileSync(here + cfgName, 'utf8'));
    cfg.dst = path.join(tmp, out);
    const cfgPath = path.join(tmp, cfgName);
    writeFileSync(cfgPath, JSON.stringify(cfg));
    execFileSync(process.execPath, ['tools/build-demo.mjs', cfgPath], { cwd: ROOT, stdio: 'pipe' });
    check(out + ' is a fresh build of ' + cfgName + ' (no hand edits, no source drift)',
      readFileSync(cfg.dst, 'utf8') === readFileSync(here + out, 'utf8'));
  }
  rmSync(tmp, { recursive: true, force: true });
}

/* ---------- method contract ---------- */
check('the fan pages call exactly publicSchedule + liveNow (the fan Router allowlist, minus ping)',
  JSON.stringify(fanOps) === JSON.stringify(['liveNow', 'publicSchedule']));
check('every op the fan pages call is really answered (ok:true, not the DEMO_ONLY fallback)',
  fanOps.every(op => { const r = load().MOCK_BACKEND.api(op, {}); return r && r.ok === true; }));

/* ---------- the whitelist: nothing private leaves publicSchedule ---------- */
const PUBLIC_KEYS = ['id', 'sport', 'level', 'gender', 'team', 'type', 'date', 'time', 'opponent', 'homeAway',
  'location', 'status', 'result', 'resultTone', 'liveStreamUrl', 'highlightUrl'].sort();
{
  const fw = load();
  const r = fw.MOCK_BACKEND.api('publicSchedule', {});
  const FD = fw.STAFF_DATA;
  check('publicSchedule answers with the real envelope (ok, today, events, announcements, liveNow, generatedAt)',
    r.ok === true && r.events.length > 0 && JSON.stringify(Object.keys(r).sort()) ===
      JSON.stringify(['announcements', 'events', 'generatedAt', 'liveNow', 'ok', 'today']));
  check('every public event carries EXACTLY the 16 FanView keys — nothing beyond the whitelist',
    r.events.every(e => JSON.stringify(Object.keys(e).sort()) === JSON.stringify(PUBLIC_KEYS)));
  check('the rows fed to the whitelist really DID hold private fields (so the checks here mean something)',
    FD.events.some(e => e.StaffNotes && e.missing.some(m => /@/.test(m.setBy))));
  // Every private string in the dataset: athlete names, every email, absence reasons, staff notes,
  // uniform notes, travel times and street addresses.
  const secrets = new Set();
  Object.values(FD.rosters).flat().forEach(a => secrets.add(a.first + ' ' + a.last));
  FD.events.forEach(e => {
    [e.StaffNotes, e.UniformNote, e.LocationAddress, e.DepartTime, e.ReturnEstTime].forEach(v => v && secrets.add(String(v)));
    e.missing.forEach(m => { secrets.add(m.reason); secrets.add(m.setBy); });
    e.returnPlan.guardian.concat(e.returnPlan.other).forEach(g => { secrets.add(g.authorizedBy); if (g.note) secrets.add(g.note); });
  });
  const blob = JSON.stringify(r);
  const leaked = [...secrets].filter(x => x && x.length > 3 && blob.includes(x));
  check('no athlete name, email, absence reason, staff note, travel time or address appears anywhere in the payload',
    leaked.length === 0 && !/@/.test(blob));
  if (leaked.length) console.log('      leaked: ' + leaked.slice(0, 5).join(' | '));
  const ANN_ALL = fw.TalonFanLogic.SCHEMA.ANNOUNCEMENTS.cols.filter(c => c.tier === 'ALL').map(c => c.name);
  check('public announcements are fan-flagged only, projected to ALL-tier columns (no PostedByEmail / Status)',
    r.announcements.length >= 1 && r.announcements.every(a => a.ShowFans === '1' &&
      Object.keys(a).every(k => ANN_ALL.includes(k))));
  check('practices are public only for the team that opted in (TEAMS.ShowPracticesPublic)',
    r.events.some(e => e.type === 'Practice' && e.sport === 'GSOC') &&
    !r.events.some(e => e.type === 'Practice' && e.sport === 'BSOC'));
  check('a cancelled game never reaches the fan board', !r.events.some(e => e.id === 'EV-BSOC-3'));
  check('recorded finals come through Scoreboard.recordedResult (W 3–1 a win, L 1–2 a loss)',
    r.events.some(e => e.id === 'EV-BSOC-0' && e.result === 'W 3–1' && e.resultTone === 'win') &&
    r.events.some(e => e.id === 'EV-GSOC-0' && e.result === 'L 1–2' && e.resultTone === 'loss'));
}

/* ---------- a staff edit shows on the fan board (two page loads, one tab) ---------- */
{
  const tab = memStorage();
  const staffPage = load(tab).MOCK_BACKEND.api;
  staffPage('setScore', { eventId: 'EV-BSOC-2', model: 'goals', ourScore: 2, oppScore: 0 });
  staffPage('setEventStatus', { eventId: 'EV-GSOC-3', status: 'Cancelled', notify: false });
  staffPage('setEventMedia', { eventId: 'EV-GSOC-2', liveStreamUrl: 'https://example.com/live/gsoc', highlightUrl: '' });
  staffPage('postAnnouncement', { audience: 'Program', title: 'Fan-flagged post', body: 'x', showFans: true });
  staffPage('postAnnouncement', { audience: 'Program', title: 'Families-only post', body: 'x', showFans: false });
  const r = load(tab).MOCK_BACKEND.api('publicSchedule', {});   // a FRESH document, as after the switcher hop
  const ev = id => r.events.filter(e => e.id === id)[0];
  check('a final score entered in the staff app shows on the fan board (W 2–0)',
    !!ev('EV-BSOC-2') && ev('EV-BSOC-2').result === 'W 2–0' && ev('EV-BSOC-2').resultTone === 'win');
  check('a game the staff app cancels disappears from the fan board',
    !ev('EV-GSOC-3') && load().MOCK_BACKEND.api('publicSchedule', {}).events.some(e => e.id === 'EV-GSOC-3'));
  check('a stream link saved in the staff app becomes the fan board\'s Watch live link',
    !!ev('EV-GSOC-2') && ev('EV-GSOC-2').liveStreamUrl === 'https://example.com/live/gsoc');
  check('a staff announcement reaches fans only when its 📣 Fans box was ticked',
    r.announcements.some(a => a.Title === 'Fan-flagged post') && !r.announcements.some(a => a.Title === 'Families-only post'));
  check('without storage each page keeps its own state (no crash; seed data intact)',
    (() => { const x = load().MOCK_BACKEND.api('publicSchedule', {}); return x.ok && !x.events.filter(e => e.id === 'EV-BSOC-2')[0].result; })());
}

/* ---------- the built fan pages + the switcher ---------- */
for (const f of ['fan.html', 'widget.html']) {
  const p = readFileSync(here + f, 'utf8');
  const sc = p.replace(/base64,[A-Za-z0-9+/=\s]+/g, 'base64,<img>');
  check(f + ': a complete document with no unreplaced template tokens',
    /^<!DOCTYPE html>/.test(p) && /<\/head>/.test(p) && /<\/body>\s*<\/html>\s*$/.test(p) && !/<\?[=!]/.test(p));
  check(f + ': shim, vendored fan logic, data and mock are wired in (fan-logic.js before mock.js)',
    /gsr-shim\.js/.test(p) && /src="data\.js"/.test(p) && /src="mock\.js"/.test(p) &&
    p.indexOf('src="fan-logic.js"') !== -1 && p.indexOf('src="fan-logic.js"') < p.indexOf('src="mock.js"'));
  check(f + ': no real domain, deployment id, live /exec URL or Google sign-in door',
    !/harford ?christian/i.test(sc) && !/AKfycb/.test(sc) && !/script\.google\.com\/macros/.test(sc) &&
    !/accounts\.google\.com/.test(sc));
}
{
  const fanPage = readFileSync(here + 'fan.html', 'utf8');
  check('fan.html: the parent/student portal doors are empty (the app hides them)',
    /id="parent-url" hidden><\/span>/.test(fanPage) && /id="signup-url" hidden><\/span>/.test(fanPage));
  const sw = readFileSync(here + 'index.html', 'utf8');
  const srcs = [...sw.matchAll(/data-src="([^"?]+)/g)].map(m => m[1]);
  check('index.html switches between staff.html, fan.html and widget.html (all present) and links back to the gallery',
    ['staff.html', 'fan.html', 'widget.html'].every(f => srcs.includes(f) && existsSync(here + f)) &&
    /href="\.\.\/\.\.\/index\.html"/.test(sw) && /id="screen" src="staff\.html"/.test(sw));
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
