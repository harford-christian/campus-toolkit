// build-logic.mjs — vendor the REAL server code of the MACS Secondary competition app into the demo.
//
//   node demos/macs/build-logic.mjs
//
// What is vendored, verbatim: Config.js (the sheet layout and every default — categories, field templates,
// settings, buildings), Intake.js (the registration endpoints and the one-time-submission write), MacsBridge.js
// (the school sign-in gate), Auth.js (the session tokens), AdminBackend.js (every admin_* endpoint), MasterList.js,
// TestData.js (the SAFE sample-data generator) and YearRollover.js (archive + reset). The demo runs them in the
// browser over in-memory stand-ins for Sheets, Drive, the cache and the mail service (mock.js), so an entry id,
// an "Other Entry IDs (auto)" cross-reference, a max-per-school refusal or a second-submission refusal is the
// app's own behaviour.
//
// What is NOT vendored, and why:
//   HistoricalData.js  real 2023-24 entrants — hundreds of real minors' names. Never. The admin page's
//                      "seed historical data" button is pointed at the safe generator instead (mock.js), and
//                      verify.mjs fails if that file's data ever lands in the bundle.
//   Bootstrap.js       seeds a blank workbook with the real member schools; the demo seeds its own fabricated
//                      schools from data.js, so this file has no job here.
//   Scheduler / Solver / ConflictChecker / ConflictGraph / ScheduleOutput  run from the Sheet menu, not the
//                      web app; not part of this demo.
//
// Scrubs applied to the vendored text (verify.mjs applies the same before comparing): the school's real domain
// and the one real admin address, the live deployment URL of the sibling forms project, and two Drive ids that
// appear in strings. Plus the usual: Node export guards dropped, staff first names aliased.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aliasStaffNames, aliasPhrases, PHRASE_ALIASES } from '../../tools/staff-aliases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(HERE, '../../../macs-scheduling/secondary');
export const FILES = ['Config.js', 'Auth.js', 'Intake.js', 'MacsBridge.js', 'AdminBackend.js', 'MasterList.js', 'TestData.js', 'YearRollover.js'];
export const SERVICES = ['SpreadsheetApp', 'CacheService', 'PropertiesService', 'DriveApp', 'UrlFetchApp', 'LockService',
  'Session', 'Utilities', 'Logger', 'HtmlService', 'MailApp'];
export const EXPORTS = [
  // the form's endpoints
  'getSchoolList', 'getBranding', 'getCategoryList', 'getJudgingSheets', 'getPaymentInfo', 'getFieldTemplateDefs',
  'checkSchoolStatus', 'submitSchoolEntries', 'uploadEntryFile', 'requestSchoolCode', 'verifySchoolCode',
  // the admin page's endpoints
  'admin_getCategoryConfig', 'admin_saveCategoryConfig', 'admin_getFieldTemplates', 'admin_saveFieldTemplates',
  'admin_getBuildingMap', 'admin_saveBuildingMap', 'admin_getJudgingSheets', 'admin_saveJudgingSheets',
  'admin_uploadJudgingSheetFile', 'admin_getSettings', 'admin_saveSettings', 'admin_getJudges', 'admin_saveJudges',
  'admin_getSchools', 'admin_saveSchools', 'admin_getRegistrations', 'admin_getSubmissions',
  'admin_updateSubmissionEntry', 'admin_deleteSubmissionEntry', 'admin_runClearTestData', 'admin_resetForNextYear',
  // internals the mock and verify.mjs use
  'submitSchoolEntries_', 'seedTestData', 'clearTestData_', 'readSubmissions_', 'readCategoryConfig_', 'generateMasterList',
  'requireAdmin_', 'requireSchoolSession_', 'isAuthorizedAdmin_', 'ensureSettingExists_', 'getOrCreateSheet_',
  'setHeaderRow_', 'schoolSignInStatus_', 'matchSchoolCode_', 'resetForNextYear_',
  'SHEETS', 'SUBMISSIONS_HEADERS', 'REGISTRATIONS_HEADERS', 'JUDGES_HEADERS', 'SCHOOLS_HEADERS', 'JUDGING_SHEETS_HEADERS',
  'FIELD_TEMPLATES_HEADERS', 'DEFAULT_CATEGORY_CONFIG_HEADERS', 'DEFAULT_CATEGORY_CONFIG', 'DEFAULT_FIELD_TEMPLATES',
  'DEFAULT_SETTINGS', 'DEFAULT_BUILDINGS', 'DEFAULT_JUDGING_SHEETS'
];

export function buildLogic() {
  const DOMAIN = 'harford' + 'christian';
  const parts = FILES.map((f) => {
    let body = readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n?/g, '\n');
    body = body.replace(/^if \(typeof module !== 'undefined'\) module\.exports = \{[^\n]*\};\s*$/m, '');
    body = body.replace(new RegExp(DOMAIN + '\\.org', 'gi'), 'example.edu').replace(new RegExp(DOMAIN, 'gi'), 'example');
    body = body.replace(/\b[a-z]+@example\.edu\b/g, 'admin@example.edu');                     // the one real admin address
    body = body.replace(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec/g, 'https://example.invalid/macs-forms/exec');
    body = body.replace(/\b1[A-Za-z0-9_-]{30,}\b/g, 'DEMO_DRIVE_ID');                           // two Drive ids in strings
    body = aliasStaffNames(aliasPhrases(body, PHRASE_ALIASES).text).text;
    return `/* ===== ${f} ===== */\n` + body;
  });
  return [
    '/* GENERATED by demos/macs/build-logic.mjs — do not edit.',
    "   This is the SOURCE PROJECT'S OWN server code, verbatim (Config, Auth, Intake, MacsBridge, AdminBackend,",
    '   MasterList, TestData, YearRollover) with the real domain, admin address, sibling-app URL and Drive ids',
    '   scrubbed. The demo runs it in the browser over in-memory Google services (mock.js), so sign-in, entry ids,',
    "   cross-references, the per-school caps and the one-time-submission rule are the app's real behaviour. */",
    '(function (global) {',
    '  var ' + SERVICES.join(', ') + ';',
    ...parts,
    '  global.MACS_LOGIC = {',
    '    bind: function (env) { ' + SERVICES.map((s) => `${s} = env.${s};`).join(' ') + ' },',
    ...EXPORTS.map((n, i) => `    ${n}: ${n}${i < EXPORTS.length - 1 ? ',' : ''}`),
    '  };',
    '})(typeof window !== "undefined" ? window : globalThis);',
    ''
  ].join('\n');
}


/* ---------- the two single-form sibling projects: Spelling Bee and Creative Writing ----------
   Each is its own Apps Script project with its own Sheet (Registrations · Students|Entries · Schools ·
   Settings …) and no admin web app — staff work in the Sheet. Their server files share function NAMES with the
   Secondary project (getSchoolList, getPaymentInfo, SHEETS …), so each is bundled into its own IIFE and its own
   global (MACS_SPELLING_LOGIC / MACS_WRITING_LOGIC); a page only ever loads one of them.
   Vendored verbatim: Config.js, Code.js, YearRollover.js. NOT vendored: Bootstrap.js — a Sheet-menu setup routine
   whose only data is the real member-school roster; the demo seeds the same tabs from data.js instead.
   Scrubs, on top of the shared ones: the published Drive links (judging sheets, fee forms) become example.invalid
   links, and Creative Writing's DEFAULT_SCHOOLS (the real roster, used only by Bootstrap.js) is emptied. */
export const COMPETITIONS = {
  spelling: {
    src: path.resolve(HERE, '../../../macs-scheduling/spelling_bee'), out: 'logic-spelling.js', global: 'MACS_SPELLING_LOGIC',
    title: 'MACS Spelling Bee',
    exports: ['getGradeGroups', 'getSchoolList', 'getPaymentInfo', 'checkSchoolStatus', 'submitRegistration',
      'resetForNextYear_', 'getSettingsMap_', 'SHEETS', 'REGISTRATIONS_HEADERS', 'STUDENTS_HEADERS', 'SCHOOLS_HEADERS',
      'GRADE_GROUPS', 'DEFAULT_SETTINGS']
  },
  writing: {
    src: path.resolve(HERE, '../../../macs-scheduling/creative_writing'), out: 'logic-writing.js', global: 'MACS_WRITING_LOGIC',
    title: 'MACS Creative Writing',
    exports: ['getSchoolList', 'getLevels', 'getGeneralRules', 'getPaymentInfo', 'checkSchoolStatus', 'uploadEntryFile',
      'submitRegistration', 'resetForNextYear_', 'getSettingsMap_', 'SHEETS', 'REGISTRATIONS_HEADERS', 'ENTRIES_HEADERS',
      'SCHOOLS_HEADERS', 'JUDGING_SHEETS_HEADERS', 'DEFAULT_JUDGING_SHEETS', 'DEFAULT_SETTINGS', 'DEFAULT_SCHOOLS', 'LEVELS']
  }
};
export const COMPETITION_FILES = ['Config.js', 'Code.js', 'YearRollover.js'];
export const COMPETITION_SERVICES = ['SpreadsheetApp', 'DriveApp', 'Utilities', 'Session', 'Logger', 'HtmlService'];

export function buildCompetitionLogic(kind) {
  const c = COMPETITIONS[kind];
  const DOMAIN = 'harford' + 'christian';
  const parts = COMPETITION_FILES.map((f) => {
    let body = readFileSync(path.join(c.src, f), 'utf8').replace(/\r\n?/g, '\n');
    body = body.replace(new RegExp(DOMAIN + '\\.org', 'gi'), 'example.edu').replace(new RegExp(DOMAIN, 'gi'), 'example');
    body = body.replace(/https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view(\?usp=[a-z_]+)?/g, 'https://example.invalid/drive/DEMO_DRIVE_ID');
    body = body.replace(/\b1[A-Za-z0-9_-]{30,}\b/g, 'DEMO_DRIVE_ID');                           // the archive root folder id
    body = body.replace(/^var DEFAULT_SCHOOLS = \[[\s\S]*?^\];/m,
      'var DEFAULT_SCHOOLS = [\n  // (demo) the real member-school roster is not shipped; Schools is seeded from data.js\n];');
    body = aliasStaffNames(aliasPhrases(body, PHRASE_ALIASES).text).text;
    return `/* ===== ${f} ===== */\n` + body;
  });
  return [
    '/* GENERATED by demos/macs/build-logic.mjs — do not edit.',
    "   This is the " + c.title + " project's OWN server code, verbatim (" + COMPETITION_FILES.join(', ') + ') with',
    '   its published Drive links, archive folder id and real school roster scrubbed. The demo runs it in the browser',
    '   over in-memory Google services (mock-competitions.js), so the per-group caps, the validation messages, the',
    "   entry ids and the one-submission-per-school rule are the app's real behaviour. */",
    '(function (global) {',
    '  var ' + COMPETITION_SERVICES.join(', ') + ';',
    ...parts,
    '  global.' + c.global + ' = {',
    '    bind: function (env) { ' + COMPETITION_SERVICES.map((s) => `${s} = env.${s};`).join(' ') + ' },',
    ...c.exports.map((n, i) => `    ${n}: ${n}${i < c.exports.length - 1 ? ',' : ''}`),
    '  };',
    '})(typeof window !== "undefined" ? window : globalThis);',
    ''
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(SRC)) { console.log('SKIP build-logic: source project not found at', SRC); process.exit(0); }
  const out = buildLogic();
  writeFileSync(path.join(HERE, 'logic.js'), out);
  console.log('built demos/macs/logic.js (' + out.length + ' bytes) from', FILES.length, 'source files');
  for (const kind of Object.keys(COMPETITIONS)) {
    const c = COMPETITIONS[kind];
    if (!existsSync(c.src)) { console.log('SKIP', c.out + ': source project not found at', c.src); continue; }
    const o = buildCompetitionLogic(kind);
    writeFileSync(path.join(HERE, c.out), o);
    console.log('built demos/macs/' + c.out + ' (' + o.length + ' bytes) from', COMPETITION_FILES.length, 'source files');
  }
}
