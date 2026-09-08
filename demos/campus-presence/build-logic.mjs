// build-logic.mjs — assemble demos/campus-presence/logic.js from the source project's logic/*.js.
//
// The four built pages need the app's OWN pure logic modules in the browser so the mock can hand
// its fabricated rows to the same functions the production server calls. build-demo.mjs only
// inlines the app's `include()` partials, and these modules are server-side files rather than
// partials, so they are concatenated here instead and pulled in by a <script src="logic.js">
// injected through each build config's replace list.
//
// Run from the showcase repo root, BEFORE the four build-demo.mjs runs:
//   node demos/campus-presence/build-logic.mjs
// verify.mjs re-does this concatenation in memory and fails if logic.js has drifted, so the
// checked-in bundle can never quietly fall behind the source modules.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SRC = path.resolve(HERE, '../../../campus-sign-in-out-system/logic');
const DST = path.join(HERE, 'logic.js');

// Load order = dependency order for readability; at runtime every module resolves the others
// through globals at CALL time, so the order is not load-bearing.
export const ORDER = ['schema.js', 'ids.js', 'fuzzy.js', 'namerules.js', 'directory.js',
                      'events.js', 'badges.js', 'pickup.js', 'presence.js', 'search.js',
                      'metrics.js', 'notify.js'];

// The ONE scrub applied to the copied source: schema.js's SETTINGS_DEFAULTS ships the school's
// real FACTS-Finder /exec deployment URL as the default deep-link target, and no deployment URL
// belongs in this public repo. Blanking it is also the app's own supported "no deep links"
// setting, and data.js's SETTINGS tab sets the same value, so nothing behaves differently.
const SCRUB = [[/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(exec|dev)/g, '']];

export function assemble(srcDir) {
  let out =
`/* logic.js — the sign-in/out system's OWN pure logic modules, copied VERBATIM from the source
   project's logic/ folder: the single tested source of truth that both Apps Script projects
   ship into their own server/lib copies. Nothing here is a demo reimplementation. mock.js hands the
   fabricated rows in data.js to these exact functions, so what you see on the board, the muster
   and the metrics page is the real classification — the same fold the production server performs.

   Each file is an IIFE whose CommonJS export is guarded by \`typeof module !== 'undefined'\`, so
   in a browser they install themselves as globals (SCHEMA, Ids, Fuzzy, NameRules, Directory,
   Events, Badges, Pickup, Presence, Search, Metrics, Notify) and resolve each other through
   those globals — exactly as they do inside Apps Script.

   One scrub is applied: the real FACTS-Finder /exec deployment URL that schema.js carries as a
   SETTINGS default is blanked, because no deployment URL belongs in a public repo. Blank is the
   app's own "no deep links" setting, and data.js sets the same value on the SETTINGS tab.

   GENERATED — do not hand-edit. Rebuild with:
     node demos/campus-presence/build-logic.mjs
   demos/campus-presence/verify.mjs fails if this bundle drifts from the source modules.
*/
`;
  for (const f of ORDER) {
    out += `\n/* ===================== logic/${f} ===================== */\n` +
      fs.readFileSync(path.join(srcDir, f), 'utf8');
  }
  for (const [find, repl] of SCRUB) out = out.replace(find, repl);
  return out;
}

// Only write when run directly (verify.mjs imports assemble() to compare).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(HERE, 'build-logic.mjs')) {
  const out = assemble(SRC);
  fs.writeFileSync(DST, out);
  console.log('wrote ' + path.relative(process.cwd(), DST) + ' (' + out.length + ' bytes, ' +
              ORDER.length + ' modules)');
}
