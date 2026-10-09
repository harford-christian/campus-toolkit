// Verifies the Door Automation demo: the three pages are fresh builds of the source templates
// (build.*.json), every action the pages post is answered by mock.js, the Schedules writes behave
// like the server (validation, bulk merge, temporary change and its cancel), Quick Control runs to
// completion through the polled progress record, and nothing private leaked.
// Run from the repo root: node demos/door/verify.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = fileURLToPath(new URL('../../../campus-control/door-automation/', import.meta.url));
let fail = 0;
const check = (l, c, extra) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + l + (!c && extra ? '\n        ' + extra : '')); if (!c) fail++; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function boot() {
  const window = {};
  new Function('window', readFileSync(HERE + 'data.js', 'utf8'))(window);
  new Function('window', readFileSync(HERE + 'mock.js', 'utf8'))(window);
  return { D: window.DOOR_DATA, M: window.MOCK_BACKEND };
}
const { D, M } = boot();
const post = (action, params) => M.processPost(Object.assign({ action, csrf: 'demo-csrf-0' }, params || {}));
const pages = ['index.html', 'dashboard.html', 'leadership.html'].map((f) => [f, readFileSync(HERE + f, 'utf8')]);
const allHtml = pages.map((p) => p[1]).join('\n');

/* ---------- contract: every action the pages post is answered ---------- */
const actions = [...new Set([...allHtml.matchAll(/(?:post|postBtn)\(\s*(?:[^,()]+,\s*)?(?:'[^']*',\s*)?'([a-zA-Z]+)'/g)].map((m) => m[1])
  .concat([...allHtml.matchAll(/\bop:\s*'([a-zA-Z]+)'/g)].map((m) => m[1])))].filter((a) => !/^lockdown/.test(a)).sort();
const unanswered = actions.filter((a) => { const r = post(a, {}); return r && /^Unknown action/.test(r.error || ''); });
check('every door action the pages post is answered by the mock (' + actions.length + ' actions)', actions.length >= 15 && unanswered.length === 0, 'unanswered: ' + unanswered.join(', '));
check('the stale pre-July quickControl action is gone from the page; the page starts a run and polls it',
  !/'quickControl'/.test(allHtml) && /quickControlStart/.test(allHtml) && /quickControlProgress/.test(allHtml) && /qc-modal/.test(allHtml));
check('the Schedules tab has its search, select and bulk-edit controls and the Add button', /updateScheduleBulk/.test(allHtml) && /addSchedule/.test(allHtml) && /rebuildOk/.test(allHtml));
check('no unreplaced Apps Script template tokens', pages.every(([, h]) => !/<\?[=!]?[\s\S]*?\?>/.test(h)));
check('the Dashboard and Leadership links are relative, the csrf token is the demo one', /href="dashboard\.html"/.test(pages[0][1]) && /leadership\.html/.test(pages[0][1]) && /demo-csrf-0/.test(pages[0][1]));

/* ---------- reads ---------- */
const sd = post('getSchedulesData');
check('getSchedulesData carries schedules, doorGroups AND doors (the single-door picker reads doors)',
  sd.success && sd.schedules.length === D.schedules.length && Array.isArray(sd.doors) && sd.doors.length === 15 && sd.doorGroups.indexOf('ALL') !== -1);
check('a temporary change (override) resolves its INDAYS until-date to a real date', sd.schedules.some((s) => s.override && /^\d{4}-\d{2}-\d{2}$/.test(s.override.until)));
check('getDoorGroups / getDoorStates / getEditData / getTodayData / getDashboardData answer with success',
  ['getDoorGroups', 'getDoorStates', 'getEditData', 'getTodayData', 'getDashboardData'].every((a) => post(a, { days: 30 }).success === true));

/* ---------- Schedules writes, with the server's rules ---------- */
const before = D.schedules.length;
check('addSchedule validates like the server: type, days, HH:MM, lock after unlock',
  /Type is required/.test(post('addSchedule', { days: 'WEEKDAYS', unlockTime: '07:00', lockTime: '16:00' }).error) &&
  /Days is required/.test(post('addSchedule', { type: 'Normal', unlockTime: '07:00', lockTime: '16:00' }).error) &&
  /valid HH:MM/.test(post('addSchedule', { type: 'Normal', days: 'WEEKDAYS', unlockTime: '7am', lockTime: '16:00' }).error) &&
  /Lock time must be after/.test(post('addSchedule', { type: 'Normal', days: 'WEEKDAYS', unlockTime: '16:00', lockTime: '07:00' }).error) && D.schedules.length === before);
const added = post('addSchedule', { type: 'Summer', name: 'Summer Camp', days: 'WEEKDAYS', unlockTime: '08:00', lockTime: '15:00', groups: 'Gym Lobby', category: 'School', enabled: true });
const newRow = D.schedules[D.schedules.length - 1];
check('addSchedule appends a row with a new id and the next rowIndex, and reports rebuildOk',
  added.success && added.rebuildOk === true && D.schedules.length === before + 1 && newRow.name === 'Summer Camp' && newRow.id && newRow.rowIndex === 12 && newRow.enabled === true);
const bulk = post('updateScheduleBulk', { rowIndexes: [2, 3, newRow.rowIndex], fields: { groups: 'Main Entrance', category: '', enabled: false } });
check('updateScheduleBulk merges only the given fields (blank keeps the old value), reports the count',
  bulk.success && bulk.count === 3 && [2, 3, newRow.rowIndex].every((ri) => { const r = D.schedules.find((s) => s.rowIndex === ri); return r.groups === 'Main Entrance' && r.enabled === false && r.category; }));
check('updateScheduleBulk refuses no rows, a bad row and a merge that would break a row\'s times',
  /No rows selected/.test(post('updateScheduleBulk', { rowIndexes: [], fields: {} }).error) &&
  /Invalid rowIndex: 99/.test(post('updateScheduleBulk', { rowIndexes: [99], fields: {} }).error) &&
  /^Row 2 \(.*\): Lock time must be after/.test(post('updateScheduleBulk', { rowIndexes: [2], fields: { unlockTime: '18:00', lockTime: '06:00' } }).error));
const upd = post('updateSchedule', { rowIndex: 2, type: D.schedules[0].type, name: 'Renamed Window', days: 'DAILY', unlockTime: '06:30', lockTime: '17:30', groups: 'ALL', category: 'School', enabled: true });
check('updateSchedule rewrites the row permanently', upd.success && upd.rebuildOk === true && D.schedules[0].name === 'Renamed Window' && D.schedules[0].days === 'DAILY' && D.schedules[0].enabled === true);
const tmp = post('tempScheduleChange', { rowIndex: 2, enabled: true, days: 'WEEKDAYS', unlockTime: '09:00', lockTime: '14:00', groups: 'ALL', until: '2027-01-15', startDate: '2027-01-04' });
const withOv = post('getSchedulesData').schedules.find((s) => s.rowIndex === 2);
check('tempScheduleChange attaches an override the tab reads back; cancelScheduleOverride removes it',
  tmp.success && withOv.override && withOv.override.until === '2027-01-15' && withOv.override.unlockTime === '09:00' &&
  post('cancelScheduleOverride', { soRow: 2 }).success === true && !post('getSchedulesData').schedules.find((s) => s.rowIndex === 2).override &&
  /No temporary change/.test(post('cancelScheduleOverride', { soRow: 2 }).error));

/* ---------- Quick Control: start, poll, done ---------- */
check('quickControlStart validates the action and the targets',
  /action must be/.test(post('quickControlStart', { qcAction: 'Open', qcTargets: 'ALL' }).error) && /No active doors match/.test(post('quickControlStart', { qcAction: 'Unlock', qcTargets: 'Nowhere' }).error));
const sched = post('quickControlStart', { qcAction: 'Lock', qcTargets: 'Gym Lobby', qcImmediate: false, qcDate: '2027-02-01', qcStart: '18:00', qcEnd: '21:00' });
check('a scheduled run is confirmed without a token (no modal), naming the doors and the window',
  sched.success && sched.immediate === false && !sched.token && sched.doors.length > 0 && sched.startTime === '18:00' && sched.endTime === '21:00' && sched.csrfToken);
const run = post('quickControlStart', { qcAction: 'Unlock', qcTargets: 'ALL', qcImmediate: true, qcDuration: 30 });
check('an immediate run returns a token, the door count and a window ending 30 minutes out', run.success && run.immediate === true && run.token && run.total === 15 && run.endTime > run.startTime);
const p1 = post('quickControlProgress', { token: run.token }), p2 = post('quickControlProgress', { token: run.token }), p3 = post('quickControlProgress', { token: run.token }), p4 = post('quickControlProgress', { token: run.token });
check('polling walks pending -> running (half the doors) -> done (all) -> unknown (the record is gone), as the page expects',
  p1.status === 'pending' && p1.done.length === 0 && p1.total === 15 && p2.status === 'running' && p2.done.length === 8 && p3.status === 'done' && p3.done.length === 15 &&
  p3.failed.length === 0 && p3.action === 'Unlock' && p4.status === 'unknown');
check('the run changed the live door states the Today tab shows', D.liveStates.filter((d) => d.ison === true).length >= D.liveStates.filter((d) => d.ison !== null).length - 1);
check('a missing token is refused', eq(post('quickControlProgress', {}), { error: 'no token' }));

/* ---------- privacy ---------- */
const blob = allHtml + readFileSync(HERE + 'data.js', 'utf8') + readFileSync(HERE + 'mock.js', 'utf8');
check('no real domain, deployment id or spreadsheet id', !/harfordchristian|AKfycb|docs\.google\.com\/spreadsheets|1[A-Za-z0-9_-]{30,}/i.test(blob));
check('the change-notice mailboxes are role mailboxes on the demo domain',
  /facilities@/.test(pages[0][1]) && /\bit@/.test(pages[0][1]) && /admin@example\.edu/.test(pages[0][1]) &&
  [...blob.matchAll(/[\w.+-]+@[A-Za-z][\w-]*\.[\w.]+/g)].every((m) => /@example\.edu$/.test(m[0])));

/* ---------- fresh builds ---------- */
if (!existsSync(SRC + 'Index.html')) check('source project present for the fresh-build check', false, SRC);
else {
  for (const [cfgName, page] of [['build.index.json', 'index.html'], ['build.dashboard.json', 'dashboard.html'], ['build.leadership.json', 'leadership.html']]) {
    try {
      const cfg = JSON.parse(readFileSync(HERE + cfgName, 'utf8'));
      mkdirSync(ROOT + '.tmp', { recursive: true });
      const tmpCfg = ROOT + '.tmp/verify-door-' + page + '.json', tmpOut = ROOT + '.tmp/verify-door-' + page;
      writeFileSync(tmpCfg, JSON.stringify({ ...cfg, dst: tmpOut }));
      execFileSync(process.execPath, [ROOT + 'tools/build-demo.mjs', tmpCfg], { cwd: ROOT, stdio: 'pipe' });
      check(page + ' is a fresh build of ' + cfgName, readFileSync(tmpOut, 'utf8') === readFileSync(HERE + page, 'utf8'), 'rebuild: node tools/build-demo.mjs demos/door/' + cfgName);
    } catch (e) { check(page + ' could be rebuilt', false, e.message); }
  }
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall demo checks passed');
process.exit(fail ? 1 : 0);
