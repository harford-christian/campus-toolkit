// build-logic.mjs — vendor HCS Forms' SERVER into the demo, verbatim.
//
//   node demos/custom-forms/build-logic.mjs        (or node demos/custom-forms/build.mjs, which runs everything)
//
// HCS Forms deploys as five Apps Script projects built from one codebase (tools/wrap.js copies the shared
// files into each): apps/builder, apps/chooser, apps/runner-public, apps/runner-staff, apps/runner-macs.
// Every app's server is the SAME shared files plus its own hand-written Router.js (one doGet each); builder
// alone adds AdminSettings.js + Maintenance.js, the three runners alone add RunnerApi.js. This bundle
// carries the shared files once, the app-only files, Seeds.js (the source repo's built-in form
// definitions — the forms the demo's library starts with), and all five Router.js files, each scoped to
// its own app. mock.js supplies the Google underneath (SpreadsheetApp, DriveApp, CacheService ...) and
// calls FORMS_SERVER(app, google) once PER google.script.run CALL — a fresh execution each time, exactly
// as Apps Script re-initialises a project's globals (the _SYS_SS / _DIR_ROWS / _ACTIVE_CTX memos) on
// every request.
//
// NOT vendored: PdfLibVendor.js + PdfLibPolyfills.js (526 KB of pdf-lib, used only to split an uploaded
// PDF while building a PDF template on Google Slides — mock.js answers those builder calls with a
// plain "runs on Google Slides" notice). Builder's Maintenance.js is vendored for the one endpoint the
// page calls (adminMigrateResponseSheet).
//
// Scrubs, all mechanical (verify.mjs re-runs this build and fails on any drift):
//   - the real school domain -> example.edu; live /exec URLs and deployment ids -> placeholders;
//   - every Drive/Sheets id -> DEMO_ID_<n> (n = order of first appearance; mock.js reads the one it needs,
//     the Contexts Registry spreadsheet id, back off the bundle as CONTEXTS_REGISTRY_SHEET_ID);
//   - chooser's two hard-coded app URLs -> this demo's own pages (parent.html / staff.html), the same
//     values the demo's Config tab gives PUBLIC_URL and RUNNER_STAFF_URL;
//   - people in comments and seed rows: build.builder.json's hashed nameAliases (shared with the page
//     builds), the shared staff aliases, and MAILBOX_ALIASES below — sha256(lowercased mailbox or
//     address).slice(0,16) -> role mailbox, so this file never spells the mailbox it removes.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { aliasStaffNames, aliasEmailLocals, aliasPhrases, PHRASE_ALIASES } from '../../tools/staff-aliases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(HERE, '../../../custom-forms');
const B = 'apps/builder/server';

// Load order = the dependency order Apps Script would see; nothing at top level reads another file's
// globals except through function calls, so it is not load-bearing beyond the lib/ IIFEs coming first.
export const FILES = [
  B + '/lib/shared-logic.js', B + '/lib/token.js', B + '/lib/app-handoff.js', B + '/lib/facts.js', B + '/lib/response-sheet.js',
  B + '/shared/SheetGateway.js', B + '/shared/ContextRegistry.js', B + '/shared/AuthKit.js', B + '/shared/Mailer.js',
  B + '/Theme.js', B + '/Facts.js', B + '/ResponseSheet.js', B + '/Forms.js', B + '/Approvals.js', B + '/AppsManager.js',
  B + '/PdfTemplate.js',
  B + '/AdminSettings.js', B + '/Maintenance.js',          // builder only
  'apps/runner-public/server/RunnerApi.js',               // the three runners only (byte-identical in each)
  'Seeds.js'                                              // the built-in form definitions (adminReseedForms)
];
export const APPS = ['builder', 'chooser', 'runner-public', 'runner-staff', 'runner-macs'];

// Mailboxes named in comments and seed rows (domain already scrubbed). Hash of the lowercased local part,
// or of the whole address for an off-domain one.
const MAILBOX_ALIASES = {
  '524e4ecd36479677': 'developer',
  'af348cdb4a77cad9': 'forms.owner1',
  'f6252bb2c8404324': 'forms.owner2',
  '699fc49f3a8eebe5': 'teacher.english', '788d78b07eff6fb7': 'teacher.math', '80bb21d2e6dbfbda': 'teacher.science',
  '15cf32116b37966e': 'teacher.history', '296704c5a5cb468e': 'teacher.bible',
  'def9adaa723d2aeb': 'someone@example.com'
};
const hash = (s) => createHash('sha256').update(String(s).toLowerCase()).digest('hex').slice(0, 16);

export function nameAliases() {
  return JSON.parse(readFileSync(path.join(HERE, 'build.builder.json'), 'utf8')).nameAliases || {};
}

/** The scrubs, applied to any vendored text (verify.mjs applies the same to compare). */
export function scrub(text, ids) {
  const DOMAIN = 'harford' + 'christian';
  let out = text;
  out = out.replace(/var PARENT_URL = '[^']*';/, "var PARENT_URL = 'parent.html'; // demo: runner-public is this folder's parent.html")
           .replace(/var STAFF_URL = '[^']*';/, "var STAFF_URL = 'staff.html'; // demo: runner-staff is this folder's staff.html");
  out = out.replace(/https:\/\/script\.google\.com\/(?:a\/macros\/[^/\s'"]+|macros)\/s\/[A-Za-z0-9_-]{20,}\/(?:exec|dev)/g, 'https://example.invalid/demo-deployment');
  out = out.replace(/AKfycb[A-Za-z0-9_-]{20,}/g, 'DEMO_DEPLOYMENT_ID');
  out = out.replace(/\b1[A-Za-z0-9_-]{30,}\b/g, (m) => { if (!ids.has(m)) ids.set(m, 'DEMO_ID_' + (ids.size + 1)); return ids.get(m); });
  out = out.replace(/\b([A-Za-z0-9._-]+)@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g, (m, local) => MAILBOX_ALIASES[hash(m)] || m);
  out = out.replace(new RegExp(DOMAIN + '\\.org', 'gi'), 'example.edu').replace(new RegExp(DOMAIN, 'gi'), 'example');
  out = out.replace(/\b([a-z][a-z0-9._-]{1,30})@/g, (m, local) => { const a = MAILBOX_ALIASES[hash(local)]; return a ? a + '@' : m; });
  out = aliasEmailLocals(out).text;
  out = aliasPhrases(out, Object.assign({}, PHRASE_ALIASES, nameAliases())).text;
  out = aliasStaffNames(out).text;
  return out;
}

// Every Google service the server names; mock.js passes them in, so the bundle binds nothing global.
export const SERVICES = ['SpreadsheetApp', 'DriveApp', 'Drive', 'CacheService', 'PropertiesService', 'LockService', 'Session',
  'Utilities', 'MailApp', 'ScriptApp', 'HtmlService', 'ContentService', 'UrlFetchApp', 'AdminDirectory', 'Slides', 'SlidesApp',
  'MimeType', 'Logger'];

function topLevelNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/^(?:(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|var\s+([A-Za-z_$][\w$]*)\s*=)/gm)) names.add(m[1] || m[2]);
  return names;
}

export function buildLogic() {
  const lf = (s) => s.replace(/\r\n?/g, '\n');
  const ids = new Map();
  const names = new Set();
  let body = '';
  for (const f of FILES) {
    const src = lf(readFileSync(path.join(SRC, f), 'utf8'));
    topLevelNames(src).forEach((n) => names.add(n));
    body += `\n/* ===================== ${f} ===================== */\n` + src.replace(/\s+$/, '') + '\n';
  }
  let routers = '';
  for (const app of APPS) {
    const src = lf(readFileSync(path.join(SRC, 'apps', app, 'server/Router.js'), 'utf8')).replace(/\s+$/, '');
    routers += `\n  /* ===================== apps/${app}/server/Router.js ===================== */\n` +
      `  ROUTERS[${JSON.stringify(app)}] = function () {\n${src}\n  return { doGet: doGet, include_: include_ };\n  };\n`;
  }
  const exportsList = [...names].sort();
  let out = [
    '/* GENERATED by demos/custom-forms/build-logic.mjs — do not edit.',
    '   HCS Forms\' OWN server, verbatim after the scrubs listed in build-logic.mjs: the files every app shares',
    '   (copied into each by the source repo\'s tools/wrap.js), builder\'s AdminSettings.js + Maintenance.js, the',
    '   runners\' RunnerApi.js, the built-in form seeds, and all five apps\' Router.js — each scoped to its own app,',
    '   because each is a separate Apps Script project with its own doGet.',
    '   FORMS_SERVER(app, google) evaluates the whole server against mock.js\'s in-memory Google and returns its',
    '   functions by name; mock.js does that once per google.script.run call (one execution per request). */',
    '(function (global) {',
    'global.FORMS_SERVER = function (APP, google) {',
    '  var ' + SERVICES.map((s) => `${s} = google.${s}`).join(', ') + ';',
    '  // apps/runner-public/server/Router.js declares this flag at top level, and the shared AuthKit.js reads it',
    '  // (getPortalView). Router.js is scoped to its app below, so the flag is lifted here for runner-public only.',
    "  var PORTAL_PARENT_ONLY_ = APP === 'runner-public' ? true : undefined;",
    '  var ROUTERS = {};',
    body,
    routers,
    '  if (!ROUTERS[APP]) throw new Error("FORMS_SERVER: unknown app " + APP);',
    '  var router = ROUTERS[APP]();',
    '  return {',
    '    app: APP, doGet: router.doGet, include_: router.include_,',
    ...exportsList.map((n, i) => `    ${n}: typeof ${n} === 'undefined' ? undefined : ${n}${i < exportsList.length - 1 ? ',' : ''}`),
    '  };',
    '};',
    '})(typeof window !== "undefined" ? window : globalThis);',
    ''
  ].join('\n');
  out = scrub(out, ids);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(SRC)) { console.log('SKIP build-logic: source project not found at', SRC); process.exit(0); }
  const out = buildLogic();
  writeFileSync(path.join(HERE, 'logic.js'), out);
  console.log('built demos/custom-forms/logic.js (' + out.length + ' bytes)');
}
