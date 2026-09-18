// coverage.mjs — which server operations does this demo's mock actually answer?
//
// Run: node demos/talon-hub/coverage.mjs [--missing]
//
// The Staff app funnels EVERY server call through one envelope — call(fn,args) ->
// google.script.run.api(fn,args) — so the portfolio scanner, which watches top-level
// google.script.run method names, sees exactly one method (`api`) and reports "mock contract
// intact" no matter how many operations have been added. It is structurally blind here.
// This asks the mock directly instead: load it, call every op the client calls, count refusals.
import { readFileSync } from 'fs';

const here = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SRC = '../../../athletics/talon-hub/apps/staff/pages/';
const PAGES = ['ClientLogic', 'StaffApp', 'Staff', 'EventFormatEditor', 'TryoutResults'];

const w = {};
new Function('window', readFileSync(here + 'data.js', 'utf8'))(w);
new Function('window', readFileSync(here + 'mock.js', 'utf8'))(w);

const src = PAGES.map(f => readFileSync(new URL(SRC + f + '.html', import.meta.url), 'utf8')).join('\n');
const ops = [...new Set([...src.matchAll(/\bcall\(\s*'([A-Za-z0-9_.]+)'/g)].map(m => m[1]))].sort();

const answered = [], unsupported = [], threw = [];
for (const op of ops) {
  let r;
  try { r = w.MOCK_BACKEND.api(op, {}); } catch (e) { threw.push(op + ' — ' + e.message); continue; }
  // DEMO_ONLY is the honest fallback the mock returns for an op it has not reproduced. It is
  // NOT coverage — counting it as answered made this tool report 100% the moment the fallback
  // landed, while 132 operations were still unimplemented. A metric that flatters itself is
  // worse than no metric.
  if (r && (r.code === 'NO_SUCH_FN' || r.code === 'DEMO_ONLY')) unsupported.push(op);
  else answered.push(op);
}

const pct = (n) => ((100 * n) / ops.length).toFixed(0) + '%';
console.log(`ops the Staff client calls : ${ops.length}`);
console.log(`answered by the mock       : ${answered.length}  (${pct(answered.length)})`);
console.log(`NOT answered               : ${unsupported.length}  (${pct(unsupported.length)})`);
if (threw.length) {
  console.log(`\nTHREW (a handler exists but crashed on {} — fix these first):`);
  threw.forEach(t => console.log('  ' + t));
}
if (process.argv.includes('--missing') && unsupported.length) {
  console.log('\nnot answered:');
  unsupported.forEach(o => console.log('  ' + o));
}
// A throwing handler is worse than a missing one: the control looks wired and then breaks.
process.exit(threw.length ? 1 : 0);
