// build-logic.mjs — vendor the Dismissal Board's SERVER endpoints into the demo, verbatim.
//
//   node demos/transportation/build-logic.mjs
//
// The page already carries the app's pure logic (Dismissal.gs, inlined by build-demo.mjs as
// DismissalClient). What the demo used to re-implement by hand was the layer above it: Code.gs's
// bundle assembly (dsComputeBoardBundle_) and the fifteen endpoints the page calls — dismissalApi,
// plannedApi, historyApi, setOverrides, setStanding, removeWalker, noteAdd/noteDelete, the three
// pickup-authorisation calls, pickupsApi, rolesApi, saveRoleView, saveView. In September 2026 that layer
// grew faster than a hand copy could follow, so the demo now runs the real one over in-memory stand-ins
// for Google (mock.js).
//
// WHAT IS VENDORED, AND HOW
//   Config.gs   whole file, with its Drive ids scrubbed (the folder id and one sheet id sit in strings).
//   Code.gs, Roles.gs, Walkers.gs, Routes.gs   NAMED declarations only, extracted verbatim with the doc
//               comment above each. Whole-file vendoring is out: Walkers.gs and Roles.gs carry seed tables of
//               real children and real staff, and Code.gs's RUN_* diagnostics name real people in comments.
//               The extractor takes a top-level `function name(` or `var NAME =` and everything up to the
//               next top-level declaration, so each function arrives exactly as the source has it.
//   Dismissal.gs   NOT here — it is already inlined into index.html (and verify.mjs loads it directly).
//
// Scrubs applied to the vendored text (verify.mjs applies the same before comparing): the real domain, a
// handful of staff first names and three family names in comments (the same replace list build.json
// applies to the page, read from there so there is one list), deployment URLs and Drive ids.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aliasStaffNames, aliasPhrases, PHRASE_ALIASES } from '../../tools/staff-aliases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(HERE, '../../../FACTS/transportation');

export const WANT = {
  'Code.gs': ['DS_SS_MEMO_', 'DS_STAMP_MEMO_', 'CHUNK', 'DS_TAB_MEMO_', 'OFFICE_TAB_TTL_SEC', 'DRIVER_CONTACTS_MAX', 'VIEW_PROP_PREFIX',
    'dsDayName_', 'dsTodayKey_', 'dsOpen_', 'dsReadTab_', 'dsFileStamp_', 'dsCachePut_', 'dsCacheGet_', 'dsReadTabCached_',
    'dsBustShortCache_', 'dsReadTabShort_', 'dsSignOutFeedToday_', 'dsReadTailRows_', 'dsDelayToday_', 'dsSportsFeedId_',
    'dsSportsFeedEnabled_', 'dsSportsFeedFile_', 'dsSportsToday_', 'dsComputeBoardBundle_', 'dsBundleAgeSec_', 'dsBoardBundle_',
    'dsRampPickups_', 'dsDriverPickups_', 'dsPublishBundle_', 'dsWriteRampFile_', 'dsWriteDriverFile_', 'dsWriteDriverAmFile_',
    'dsPublishDriverAmDaily_', 'dsPublishDriverAmNow_', 'dsWriteSharedFile_', 'dsDecorateBundle_', 'dismissalApi', 'dsFreshness_',
    'setOverride', 'setOverrides', 'plannedApi', 'historyApi', 'setStanding', 'dsWalkersSheet_', 'setWalker', 'removeWalker',
    'dsWriteWalkerRows_', 'dsPickupAuthSheet_', 'dsPickupAuthRetire_', 'dsGuardianEmails_', 'pickupAuthContacts', 'dsAuthRequesterAt_',
    'dsPickupAuthNotify_', 'dsAfterWrite_', 'pickupAuthSave', 'pickupAuthDelete', 'pickupsApi', 'dsOccasionalToday_', 'noteAdd',
    'noteDelete', 'dsViewKey_', 'dsLegacyViews_', 'dsViewFor_', 'dsAllViews_', 'getSavedView_', 'saveView'],
  'Roles.gs': ['ROLES_TAB', 'ROLES_HEADER', 'PROP_ROLE_VIEWS', 'dsRoleRows_', 'dsMyPermissions_', 'dsHomeroomSetCached_', 'dsRoleViews_',
    'dsEffectiveView_', 'saveRoleView', 'addRoleMember', 'removeRoleMember', 'rolesApi', 'dsStaffDirectory_'],
  'Walkers.gs': ['WALKERS_TAB', 'WALKERS_HEADER', 'dsEnsureColumns_'],
  'Routes.gs': ['ROUTES_TAB', 'ROUTES_HEADER']
};
export const SERVICES = ['SpreadsheetApp', 'DriveApp', 'CacheService', 'PropertiesService', 'Session', 'Utilities', 'MailApp',
  'ScriptApp', 'HtmlService', 'LockService', 'AdminDirectory', 'Logger'];
export const EXPORTS = ['dismissalApi', 'pickupsApi', 'setOverride', 'setOverrides', 'plannedApi', 'historyApi', 'setStanding', 'setWalker',
  'removeWalker', 'pickupAuthContacts', 'pickupAuthSave', 'pickupAuthDelete', 'noteAdd', 'noteDelete', 'saveView', 'rolesApi',
  'saveRoleView', 'addRoleMember', 'removeRoleMember', 'dsComputeBoardBundle_', 'dsMyPermissions_', 'dsTodayKey_', 'dsDayName_',
  'requireStaff_', 'SHARED_FOLDER_ID', 'ROSTER_TAB', 'OVERRIDES_TAB', 'STANDING_TAB', 'NOTES_TAB', 'WALKERS_TAB', 'ROUTES_TAB',
  'ROLES_TAB', 'PICKUP_AUTH_TAB', 'SPECIALS_TAB', 'PICKUP_TAB', 'STAGING_ROSTER_TAB', 'SIGNINOUT_EVENTS_TAB', 'CMS_SCHEDULE_TAB',
  'SPORTS_FEED_NAME', 'PROP_SPORTS_FEED_FILE_ID', 'PROP_ROLE_VIEWS', 'OVERRIDES_HEADER', 'STANDING_HEADER', 'NOTES_HEADER',
  'WALKERS_HEADER', 'PICKUP_AUTH_HEADER', 'SPECIALS_HEADER', 'ROLES_HEADER', 'ROUTES_HEADER'];

/** Split a GAS file into top-level declarations: [{name, text}] where text includes the doc comment above. */
export function declarations(src) {
  const lines = src.split('\n');
  const isComment = (l) => /^\s*(\/\*\*|\/\*|\*|\*\/|\/\/)/.test(l);
  const starts = [];
  lines.forEach((line, i) => {
    const m = /^(?:function\s+([A-Za-z_]\w*)\s*\(|var\s+([A-Za-z_]\w*)\s*=)/.exec(line);
    if (!m) return;
    // the doc block is the run of comment lines immediately above the declaration
    let doc = i;
    while (doc > 0 && isComment(lines[doc - 1])) doc--;
    starts.push({ name: m[1] || m[2], doc, at: i });
  });
  return starts.map((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1].doc : lines.length;
    return { name: s.name, text: lines.slice(s.doc, end).join('\n').replace(/\s+$/, '') + '\n' };
  });
}

function pick(file, names) {
  const src = readFileSync(path.join(SRC, file), 'utf8').replace(/\r\n?/g, '\n');
  const decls = declarations(src);
  const byName = Object.fromEntries(decls.map((d) => [d.name, d.text]));
  const missing = names.filter((n) => !byName[n]);
  if (missing.length) throw new Error(file + ' is missing: ' + missing.join(', '));
  return names.map((n) => byName[n]).join('\n');
}

export function nameAliases() {
  // The hashed name table build.json applies to the page. One table, used by both builds, so the page
  // and the bundle agree — and neither file spells a name.
  return JSON.parse(readFileSync(path.join(HERE, 'build.json'), 'utf8')).nameAliases || {};
}

export function buildLogic() {
  const DOMAIN = 'harford' + 'christian';
  let out = '/* ===== Config.gs ===== */\n' + readFileSync(path.join(SRC, 'Config.gs'), 'utf8').replace(/\r\n?/g, '\n');
  for (const [file, names] of Object.entries(WANT)) out += `\n/* ===== ${file} (named declarations) ===== */\n` + pick(file, names);
  out = out.replace(new RegExp(DOMAIN + '\\.org', 'gi'), 'example.edu').replace(new RegExp(DOMAIN, 'gi'), 'example');
  out = out.replace(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/(exec|dev)/g, 'https://example.invalid/demo-deployment');
  out = out.replace(/\b1[A-Za-z0-9_-]{30,}\b/g, 'DEMO_DRIVE_ID');
  // Walkers.gs documents how five nicknames were resolved to real children — that table stays out of a public copy.
  out = out.replace(/ \* NAME RESOLUTION[\s\S]*?(?=\n \*\/)/, ' * NAME RESOLUTION was done once against the live roster, each nickname confirmed by a human;\n * the table itself is omitted from this public copy.');
  out = aliasPhrases(out, Object.assign({}, PHRASE_ALIASES, nameAliases())).text;
  out = aliasStaffNames(out).text;
  return [
    '/* GENERATED by demos/transportation/build-logic.mjs — do not edit.',
    "   The SOURCE PROJECT'S OWN server layer, verbatim: Config.gs whole (ids scrubbed) and the named",
    '   declarations of Code.gs, Roles.gs, Walkers.gs and Routes.gs that the fifteen endpoints need. The',
    '   pure logic (Dismissal.gs) is inlined into index.html as DismissalClient and resolved here as page',
    "   globals, exactly as Apps Script resolves it. mock.js binds the Google services. */",
    '(function (global) {',
    '  var ' + SERVICES.join(', ') + ';',
    out,
    '  global.DISMISSAL_LOGIC = {',
    '    bind: function (env) { ' + SERVICES.map((s) => `${s} = env.${s};`).join(' ') + ' },',
    ...EXPORTS.map((n, i) => `    ${n}: ${n}${i < EXPORTS.length - 1 ? ',' : ''}`),
    '  };',
    '})(typeof window !== "undefined" ? window : globalThis);',
    ''
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(SRC)) { console.log('SKIP build-logic: source project not found at', SRC); process.exit(0); }
  const out = buildLogic();
  writeFileSync(path.join(HERE, 'logic.js'), out);
  console.log('built demos/transportation/logic.js (' + out.length + ' bytes)');
}
