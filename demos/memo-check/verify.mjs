// Verifies the Memo Check demo. Run from the showcase repo root: node demos/memo-check/verify.mjs
//
// What this owns: nothing real is published (checked against the source project's own ids, addresses and door
// names, read from it here so this file never spells them), logic.js is the source's code verbatim after the
// scrubs, queue.html is a fresh build, the mock answers exactly what the page calls, the canned model replies obey
// the production JSON schema, and the pipeline behaves as the app does — through the app's own code.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { buildLogic, SRC } from './build-logic.mjs';
import { findStaffNames } from '../../tools/staff-aliases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
let fail = 0;
const check = (label, ok, why) => { console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + (ok || !why ? '' : '\n        ' + why)); if (!ok) fail++; };
const lf = (s) => s.replace(/\r\n?/g, '\n');
const read = (f) => lf(readFileSync(path.join(HERE, f), 'utf8'));
const FILES = readdirSync(HERE).filter((f) => /\.(html|js|json)$/.test(f));

/* ---------------------------------------------------------------- 1. privacy */
console.log('\n  privacy');
const blob = FILES.map(read).join('\n');
const src = (f) => lf(readFileSync(path.join(SRC, f), 'utf8'));
// The real values the public copy must never carry, taken from the source itself.
const cfg = src('Config.js') + '\n' + src('Alerts.js');
const realStrings = [];
for (const m of cfg.matchAll(/var (MC_CMS_SHEET_ID|MC_DISTRO|MC_EAGLE_EYE_URL|MC_WEBAPP_URL_DEFAULT|MC_DEFAULT_NOTIFY_TO|MC_DEFAULT_ALERT_TO|MC_SUPER_ADMIN)\s*=\s*'([^']+)'/g))
  m[2].split(',').forEach((s) => realStrings.push(s.trim()));
for (const m of cfg.matchAll(/id:\s*'([^']+)'/g)) realStrings.push(m[1]);                       // the calendar ids
const doorBlock = /var MC_DOORS = (\{[\s\S]*?\});/.exec(cfg);
const realDoors = doorBlock ? [].concat(...Object.values(new Function('return ' + doorBlock[1])())) : [];
check('found the source\'s real config to compare against (' + realStrings.length + ' ids/addresses, ' + realDoors.length + ' door names)',
  realStrings.length >= 8 && realDoors.length >= 10);
const leakedIds = realStrings.filter((s) => s.length > 6 && blob.includes(s));
check('no real sheet id, calendar id, deployment URL or mailbox from the source config', leakedIds.length === 0, leakedIds.join(', '));
const leakedDoors = realDoors.filter((d) => blob.includes(d));
check('none of the school\'s real door names (the demo has its own inventory)', leakedDoors.length === 0, leakedDoors.length + ' found');
check('no real domain, deployment id or Drive id', !/harford\s*christian/i.test(blob.replace(/Harford Christian School/g, '')) &&
  !/AKfycb|script\.google\.com\/macros|docs\.google\.com\/spreadsheets/.test(blob) && !/[\s"'/=(]1[A-Za-z0-9_-]{40,}/.test(blob));
const named = FILES.filter((f) => f !== 'data.js').filter((f) => findStaffNames(read(f).replace(/\b[A-Z][a-z]+\s+(?=[A-Z][a-z])/g, '')).length);
check('no real staff first names outside the fabricated data (hash-matched)', named.length === 0, named.join(', '));
const realPrompt = /HCS NORM RULES/.test(src('Analyze.js'));
check('the production prompt\'s campus rules are NOT vendored (a short stand-in in mock.js takes their place)',
  realPrompt && !/HCS NORM RULES/.test(blob) && !/function mcSystemPromptCore_/.test(read('logic.js')));

/* ---------------------------------------------------------------- 2. vendoring and the build */
console.log('\n  vendoring and the build');
check('logic.js is the source\'s server code verbatim after the scrubs (run build-logic.mjs)', buildLogic() === read('logic.js'));
const queue = read('queue.html');
try {
  const cfgB = JSON.parse(read('build.json'));
  mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
  const tmpCfg = path.join(ROOT, '.tmp/verify-memo-check.json'), tmpOut = path.join(ROOT, '.tmp/verify-memo-check.html');
  writeFileSync(tmpCfg, JSON.stringify({ ...cfgB, dst: tmpOut }));
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build-demo.mjs'), tmpCfg], { cwd: ROOT, stdio: 'pipe' });
  check('queue.html is what build-demo.mjs produces from the current source (not stale)', lf(readFileSync(tmpOut, 'utf8')) === queue,
    'rebuild: node tools/build-demo.mjs demos/memo-check/build.json');
} catch (e) { check('queue.html could be rebuilt from build.json', false, e.message); }
check('queue.html has no unreplaced template tokens, and loads logic.js before the shim, data and mock',
  !/<\?[=!]?[\s\S]*?\?>/.test(queue) && queue.indexOf('src="logic.js"') < queue.indexOf('gsr-shim.js') &&
  queue.indexOf('gsr-shim.js') < queue.indexOf('src="data.js"') && queue.indexOf('src="data.js"') < queue.indexOf('src="mock.js"'));
const calls = [...new Set([...queue.matchAll(/\.(mc[A-Za-z]+)\(\{/g)].map((m) => m[1]))];
check('the page calls exactly one server method, mcQueueDecide', JSON.stringify(calls) === '["mcQueueDecide"]', calls.join(', '));
for (const f of ['index.html', 'inbox.html', 'digest.html', 'queue.html']) {
  const blocks = [...read(f).matchAll(/<script>([\s\S]*?)<\/script>/g)];
  let ok = blocks.length > 0, why = '';
  for (const b of blocks) { try { new Function(b[1]); } catch (e) { ok = false; why = e.message; } }
  check(f + ': every inline script parses', ok, why);
}

/* ---------------------------------------------------------------- 3. behaviour, through the real code */
console.log('\n  behaviour (the app\'s own code over the in-memory Google)');
function memStorage() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }
function boot(storage, search) {
  const ctx = { console, URLSearchParams, JSON, Math };
  ctx.window = ctx; ctx.sessionStorage = storage; ctx.location = { search: search || '' };
  vm.createContext(ctx);
  for (const f of ['logic.js', 'data.js', 'mock.js']) vm.runInContext(read(f), ctx, { filename: f });
  return { M: ctx.MEMO_DEMO, B: ctx.MOCK_BACKEND, L: ctx.MEMO_LOGIC, D: ctx.MEMO_DATA };
}
const store = memStorage();
let { M, B, L, D } = boot(store);
const rows = () => M.rows();
const byId = (id) => rows().filter((r) => r.Id === id)[0];
const status = Object.fromEntries(rows().map((r) => [r.Id, r.Status]));

// The canned replies are the one fabricated step: hold them to the production schema the real call enforces.
const S = L.MC_FINDINGS_SCHEMA.properties.findings.items;
const bad = [];
Object.entries(D.model).forEach(([id, r]) => r.findings.forEach((f, i) => {
  const keys = Object.keys(f).sort().join(',');
  if (keys !== S.required.slice().sort().join(',')) bad.push(id + '#' + i + ' keys');
  if (L.MC_CATEGORIES.indexOf(f.category) < 0 || L.MC_ACTIONS.indexOf(f.action) < 0) bad.push(id + '#' + i + ' enum');
  if (typeof f.gap !== 'boolean' || typeof f.confidence !== 'number' || f.confidence < 0 || f.confidence > 1) bad.push(id + '#' + i + ' types');
  try { JSON.parse(f.action_params); } catch (e) { bad.push(id + '#' + i + ' action_params'); }
}));
check('every canned finding has exactly the schema\'s fields, its enums and its types (MC_FINDINGS_SCHEMA)', bad.length === 0, bad.join(', '));

check('the replay read three emails through the real hourly tick: three Log rows, each digest sent', (() => {
  const log = M.log().slice(1);
  return log.length === 3 && log.every((r) => r[7] === 'yes') && log.map((r) => r[5]).join(',') === '5,7,3';
})());
check('fifteen queue rows, with the statuses the history produced', JSON.stringify(status) === JSON.stringify({
  '0d3e9b11-1': 'applied', '0d3e9b11-2': 'applied', '0d3e9b11-3': 'applied', '0d3e9b11-4': 'applied', '0d3e9b11-5': 'denied',
  '2b7a5d22-1': 'info', '2b7a5d22-2': 'proposed', '2b7a5d22-3': 'proposed', '2b7a5d22-4': 'info', '2b7a5d22-5': 'proposed',
  '2b7a5d22-6': 'proposed', '2b7a5d22-7': 'proposed', '7c9e4f33-1': 'duplicate', '7c9e4f33-2': 'info', '7c9e4f33-3': 'proposed' }),
  JSON.stringify(status));
check('the correction\'s restated chapel swap is a duplicate of the queued proposal (mcMarkDuplicates_), not a second nag',
  /duplicate of 2b7a5d22-2 \(proposed\)/.test(byId('7c9e4f33-1').Note));
check('the concert was approved WITH CHANGES (doors at 6:00), and the note keeps what the model proposed', (() => {
  const r = byId('0d3e9b11-3'), p = JSON.parse(r.ActionParams);
  return p.start === '18:00' && p.end === '21:00' && /approved with changes \(was 2026-10-29 \{"start":"18:30"/.test(r.Note) && /Choir arrives/.test(r.Note);
})());
check('the four approved rows were marked applied by the real check, once the plan showed them',
  ['0d3e9b11-1', '0d3e9b11-2', '0d3e9b11-3', '0d3e9b11-4'].every((id) => /applied — plan reflected it 2026-10-26 09:05/.test(byId(id).Note)));
check('three digests in the outbox, rendered by mcRenderDigest_, with the counts in the subject', (() => {
  const o = M.outbox();
  return o.length === 3 && /4 proposed changes, 1 to check$/.test(o[0].subject) && /1 proposed change$/.test(o[2].subject) &&
    o.every((m) => /Memo check — proposed Campus Control changes/.test(m.html) && /queue\.html\?id=/.test(m.html));
})());
check('the low-confidence Booster Club read sits under "Worth a look", not "Proposed changes"', (() => {
  const h = M.outbox()[1].html, at = h.indexOf('Worth a look (');
  return at > -1 && h.slice(at).indexOf('Booster Club meeting') > -1 && h.slice(0, at).indexOf('Booster Club meeting') === -1;
})());
check('each model call was assembled by the real prompt builders: door inventory, venue rules, the email and the plan', (() => {
  const c = M.calls()['18f4c1e92b7a5d22'];
  return c && /DOOR INVENTORY/.test(c.system) && /KG Lower Level/.test(c.system) && /VENUE → DOOR RULES/.test(c.system) &&
    /Subject: Weekly Memo - Week of 11\/1\/2026/.test(c.user) && /PLAN WINDOW 2026-10-29 \.\. 2026-11-20/.test(c.user);
})());

// The queue endpoint and its gates.
let b = M.boot();
check('the schedule editor boots with buttons (canDecide) and a token; the queue shows all fifteen rows',
  b.canDecide === true && !!b.token && b.rows.length === 15 && b.today === '2026-11-02');
M.setUser('teacher@example.edu');
const tb = M.boot();
check('a teacher (no ScheduleOverrides) sees the queue read-only, with no token',
  tb.canDecide === false && tb.token === '' && tb.rows.length === 15);
check('and the server refuses a teacher\'s decision outright',
  /only Eagle Eye schedule editors can decide/.test(B.mcQueueDecide({ id: '2b7a5d22-2', decision: 'approve', token: 'x' }).error));
M.setUser('demo.staff@example.edu');
b = M.boot();
let res = B.mcQueueDecide({ id: '2b7a5d22-7', decision: 'deny', note: '', token: b.token });
check('Deny needs a reason', res.ok === false && /A reason is required/.test(res.error));
res = B.mcQueueDecide({ id: '2b7a5d22-5', decision: 'approve', params: { title: 'Luncheon', eventStart: '11:30', eventEnd: '13:30', start: '12:00', end: '14:00', doors: ['KG'] }, token: res.token });
check('Set up & approve refuses an unlock window that starts after the event', res.ok === false && /must cover the event/.test(res.error));
res = B.mcQueueDecide({ id: '2b7a5d22-2', decision: 'approve', note: '', token: res.token });
check('approving the Wednesday chapel swap moves it to approved, decided by the signed-in editor',
  res.ok && res.row.status === 'approved' && res.row.decidedBy === 'demo.staff@example.edu' && /^inbox\.html#/.test(res.row.permalink));
check('approved is not applied: the hourly check leaves it until the plan shows it', M.runTick().length === 0 && byId('2b7a5d22-2').Status === 'approved');
const made = M.makeClicks();
const wed = M.plan().days.filter((d) => d.date === '2026-11-04')[0];
check('the Eagle Eye stand-in writes the bell the clicks would (Wed 11/4 rings the Thursday grid)', made.join() === '2b7a5d22-2' && wed.bell === 'Normal_Thu');
const applied = M.runTick();
check('then the real hourly check finds it in the plan and marks the row applied', applied.join() === '2b7a5d22-2' &&
  byId('2b7a5d22-2').Status === 'applied' && /applied — plan reflected it/.test(byId('2b7a5d22-2').Note));
({ M } = boot(store));
check('the visit\'s decisions survive a reload (sessionStorage)', M.rows().filter((r) => r.Id === '2b7a5d22-2')[0].Status === 'applied');
const fresh = boot(memStorage()).M.rows();
check('a fresh visit replays the same history (deterministic)', fresh.map((r) => r.Id + r.Status + r.CreatedAt).join() ===
  boot(memStorage()).M.rows().map((r) => r.Id + r.Status + r.CreatedAt).join());

console.log(fail ? '\n' + fail + ' check(s) FAILED' : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
