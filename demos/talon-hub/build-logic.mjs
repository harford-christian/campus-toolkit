// build-logic.mjs — assemble demos/talon-hub/fan-logic.js from the fan app's OWN server modules.
//
// The fan surface's one data endpoint (publicSchedule) is a thin GAS wrapper around pure modules:
// FanView (the field-by-field public whitelist — the security boundary), Labels.teamLabel,
// Scoreboard.recordedResult, and for fan-flagged announcements Announcements.active +
// Projection.forParent over SCHEMA. Those modules are generated into apps/fan/server/lib/ by the
// source project's `npm run build` (source of truth: logic/*.js, unit-tested in Node). This copies
// them VERBATIM so the whitelist the demo applies is the real one, not a demo reimplementation.
//
// They are wrapped in ONE function scope that exposes only window.TalonFanLogic, so their globals
// (SCHEMA, TIER, Labels, ...) cannot collide with the page's own ClientLogic/Theme globals. Inside
// the wrapper they resolve each other exactly as they do in Apps Script (lexical globals).
//
// Run from the showcase repo root, BEFORE building fan.html / widget.html:
//   node demos/talon-hub/build-logic.mjs
// verify.mjs re-assembles in memory and fails if fan-logic.js has drifted from the source.
import fs from 'node:fs';
import path from 'node:path';
import { aliasStaffNames, aliasPhrases, PHRASE_ALIASES } from '../../tools/staff-aliases.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
export const SRC = path.resolve(HERE, '../../../athletics/talon-hub/apps/fan/server/lib');
const DST = path.join(HERE, 'fan-logic.js');

export const ORDER = ['schema.js', 'projection.js', 'announcements.js', 'labels.js', 'scoreboard.js', 'fanview.js'];

export function assemble(srcDir) {
  let out =
`/* fan-logic.js — the Talon Hub fan app's OWN pure server modules, copied VERBATIM from
   athletics/talon-hub/apps/fan/server/lib/ (generated there from logic/*.js by the source
   project's \`npm run build\`). Nothing here is a demo reimplementation: mock.js hands the staff
   demo's fabricated SCHEDULE rows to FanView.publicSchedule — the same field-by-field whitelist the
   production publicSchedule endpoint applies — so what the fan page shows is exactly what the real
   whitelist lets out.

   Wrapped in one function scope; only window.TalonFanLogic is exported, so these modules' globals
   cannot collide with the page's own. GENERATED — do not hand-edit. Rebuild with:
     node demos/talon-hub/build-logic.mjs
   demos/talon-hub/verify.mjs fails if this bundle drifts from the source modules.
*/
(function (window) {
`;
  for (const f of ORDER) {
    out += `\n/* ===================== apps/fan/server/lib/${f} ===================== */\n` +
      fs.readFileSync(path.join(srcDir, f), 'utf8').replace(/\r\n?/g, '\n');
  }
  out += `
/* ===================== export (demo wrapper) ===================== */
window.TalonFanLogic = { SCHEMA: SCHEMA, TIER: TIER, Projection: Projection, Announcements: Announcements,
  Labels: Labels, Scoreboard: Scoreboard, FanView: FanView };
})(typeof window !== 'undefined' ? window : this);
`;
  out = aliasStaffNames(aliasPhrases(out, PHRASE_ALIASES).text).text;   // people named in comments (hash-matched)
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(HERE, 'build-logic.mjs')) {
  const out = assemble(SRC);
  fs.writeFileSync(DST, out);
  console.log('wrote ' + path.relative(process.cwd(), DST) + ' (' + out.length + ' bytes, ' + ORDER.length + ' modules)');
}
