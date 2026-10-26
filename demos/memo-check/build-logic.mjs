// build-logic.mjs — vendor Memo Check's OWN server code into the demo.
//
//   node demos/memo-check/build-logic.mjs
//
// Memo Check is a headless Apps Script project with one small web page (the review queue). Its whole pipeline is
// plain server code: the hourly tick reads new mail to the staff list (Mail.js), takes a plan snapshot of what
// Campus Control already intends (Plan.js), asks the model for structured findings (Analyze.js), stores them as
// queue rows with cross-memo dedupe and emails a digest (Report.js), and later checks whether an approved change
// has reached the plan (Applied.js). The queue page decides rows through Queue.js. The demo runs ALL of that
// verbatim; mock.js supplies Gmail, Sheets, Calendar and the one HTTPS call to the model.
//
// WHAT IS VENDORED, AND HOW
//   Plan.js, Queue.js        whole files (no ids, no addresses).
//   Config.js, Report.js, Analyze.js, Applied.js, Mail.js, Alerts.js, Main.js
//                            NAMED declarations only, each with the doc comment above it. Left out on purpose:
//     - every real identifier: the CMS sheet id, the two calendar ids, the Eagle Eye and queue deployment URLs,
//       the staff distribution list and the notification / alert recipients (mock.js supplies demo values);
//     - MC_DOORS and the seeded Rules (MC_RULES_SEED): the school's real door inventory and venue notes. A door
//       layout is security-relevant, so the demo has its own invented doors and rules;
//     - mcSystemPromptCore_: the production prompt's campus rules name real doors. mock.js supplies a short
//       stand-in, so the rest of the prompt (door inventory, venue rules, norms, the email, the plan) is still
//       assembled by the real mcSystemPrompt_ / mcUserPrompt_ / mcPlanText_;
//     - the chapel and memo-notes side tasks (ChapelNote.js, MemoNotes.js) and the backtest tooling.
//   The model call itself is the real mcAnalyze_: mock.js answers its one UrlFetchApp.fetch with a canned
//   response, so the stop_reason checks, the window guard, the "date already passed" rule and the in-response
//   dedupe all run as written.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aliasStaffNames, aliasPhrases, PHRASE_ALIASES } from '../../tools/staff-aliases.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SRC = path.resolve(HERE, '../../../campus-control/memo-check');

export const WHOLE = ['Plan.js', 'Queue.js'];
export const WANT = {
  'Config.js': ['MC_TIMEZONE', 'MC_CMS_SCHEDULE_TAB', 'MC_C_DATE', 'MC_LOOKBACK_DAYS', 'MC_LOOKAHEAD_DAYS', 'MC_GMAIL_QUERY_DAYS',
    'MC_PROCESSED_LABEL', 'MC_API_URL', 'MC_MODEL', 'MC_MAX_TOKENS', 'MC_EFFORT', 'MC_FIRM_CONFIDENCE', 'MC_PROP_API_KEY',
    'MC_PROP_NOTIFY_TO', 'MC_PROP_SHEET_ID', 'MC_PROP_SEND', 'MC_PROP_WEBAPP_URL', 'MC_ST', 'MC_DEDUPE_AGAINST',
    'MC_APPLIED_NUDGE_DAYS', 'MC_QUEUE_DAYS_BACK', 'MC_CMS_PERMISSIONS_TAB', 'MC_CMS_PERM_FLAG', '_mcWebAppUrl_',
    '_mcDoorGroupsFor_', '_mcProps_', '_mcProp_', '_mcSendEnabled_', '_mcNotifyTo_', '_mcFmt_', '_mcToday_', '_mcAddDays_',
    '_mcDow_', '_mcCellDate_'],
  'Report.js': ['MC_FINDINGS_TAB', 'MC_LOG_TAB', 'MC_RULES_TAB', 'MC_RULES_HEADERS', 'MC_FINDINGS_HEADERS', 'MC_LOG_HEADERS',
    'mcSheet_', 'mcEnsureHeaders_', 'mcEnsureTab_', 'mcRules_', 'MC_RETRY_PREFIX', 'MC_GAVEUP_PREFIX', 'MC_MAX_COSTLY_RETRIES',
    'MC_FAILURE_RE', 'mcIsAccountError_', 'mcIsCostlyError_', 'mcLogRowsFor_', 'mcAlreadyLogged_', 'mcLogFailure_', 'mcLog_',
    'MC_F', 'mcFindingsRows_', 'mcMarkDuplicates_', 'mcIsNewProposal_', 'mcStoreFindings_', 'mcPatchFinding_', 'mcAppendNote_',
    'mcEsc_', 'mcActionLabel_', 'mcRenderDigest_'],
  'Analyze.js': ['MC_CATEGORIES', 'MC_ACTIONS', 'MC_FINDINGS_SCHEMA', 'mcSystemPrompt_', 'mcUserPrompt_', 'mcAnalyze_',
    'mcFindingSig_', 'mcDedupeFindings_', 'mcIsActionable_'],
  'Applied.js': ['mcCheckApplied_', 'mcAppliedBy_', 'mcHHMM_', 'mcDateSpan_', 'mcSendNudge_'],
  'Mail.js': ['mcFindUnprocessed_', 'mcProcessedLabel_', 'mcMessageBody_', 'mcLooksLikeHtml_', 'mcHtmlToText_', 'mcReadMessage_',
    'mcCleanBody_', 'mcMarkProcessed_', 'mcSendDigest_'],
  'Alerts.js': ['MC_PROP_ALERT_TO', 'MC_PROP_ALERT_OPEN', 'MC_ALERT_EVERY_HOURS', '_mcAlertTo_', '_mcSendAlert_',
    'mcAlertAccountProblem_', 'mcAlertRecovered_', 'mcAlertGaveUp_'],
  'Main.js': ['memoCheckTick']
};
// What this script vendors, for tools/scan-portfolio.mjs.
export const VENDORED = [{ dir: SRC, files: WHOLE.concat(Object.keys(WANT)) }];

// Apps Script services the code reaches for, plus Date (so mock.js can pin the clock). Bound by mock.js.
export const SERVICES = ['SpreadsheetApp', 'CalendarApp', 'GmailApp', 'MailApp', 'UrlFetchApp', 'PropertiesService', 'CacheService',
  'Session', 'Utilities', 'Logger', 'ScriptApp', 'HtmlService', 'Date'];
export const EXPORTS = ['memoCheckTick', 'mcQueueBootstrap_', 'mcQueueDecide', 'mcQueueValidateParams_', 'mcFindingsRows_',
  'mcCheckApplied_', 'mcPlanSnapshot_', 'mcSystemPrompt_', 'mcUserPrompt_', 'mcRenderDigest_', 'mcActionLabel_', 'mcSheet_',
  'mcFindingSig_', 'mcAppliedBy_', '_mcDoorGroupsFor_', '_mcToday_', '_mcDow_', '_mcAddDays_', 'MC_ST', 'MC_FINDINGS_HEADERS',
  'MC_LOG_HEADERS', 'MC_RULES_HEADERS', 'MC_FINDINGS_TAB', 'MC_LOG_TAB', 'MC_RULES_TAB', 'MC_CMS_SCHEDULE_TAB',
  'MC_CMS_PERMISSIONS_TAB', 'MC_CMS_PERM_FLAG', 'MC_API_URL', 'MC_MODEL', 'MC_PROP_SHEET_ID', 'MC_PROP_SEND', 'MC_PROP_API_KEY',
  'MC_FINDINGS_SCHEMA', 'MC_CATEGORIES', 'MC_ACTIONS'];

/** Top-level declarations of a GAS file: [{name, text}], text = the declaration plus the comment run above it,
 *  up to the next declaration's comments (so a statement that follows a declaration, like MC_F's forEach, stays with it). */
export function declarations(src) {
  const lines = src.split('\n');
  const isComment = (l) => /^\s*(\/\*\*|\/\*|\*|\*\/|\/\/)/.test(l);
  const starts = [];
  lines.forEach((line, i) => {
    const m = /^(?:function\s+([A-Za-z_$][\w$]*)\s*\(|var\s+([A-Za-z_$][\w$]*)\s*=)/.exec(line);
    if (!m) return;
    let doc = i;
    while (doc > 0 && isComment(lines[doc - 1])) doc--;
    starts.push({ name: m[1] || m[2], doc, at: i });
  });
  return starts.map((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1].doc : lines.length;
    return { name: s.name, text: lines.slice(s.doc, end).join('\n').replace(/\s+$/, '') + '\n' };
  });
}

const read = (f) => readFileSync(path.join(SRC, f), 'utf8').replace(/\r\n?/g, '\n');

function pick(file, names) {
  const byName = Object.fromEntries(declarations(read(file)).map((d) => [d.name, d.text]));
  const missing = names.filter((n) => !byName[n]);
  if (missing.length) throw new Error(file + ' is missing: ' + missing.join(', '));
  return names.map((n) => byName[n]).join('\n');
}

/** {group: [door names]}: the source's real inventory (read from it, never spelled here) and the demo's own. */
export function realDoors() { return new Function('return ' + /var MC_DOORS = (\{[\s\S]*?\});/.exec(read('Config.js'))[1])(); }
export function demoDoors() {
  const ctx = { window: {} };
  new Function('window', readFileSync(path.join(HERE, 'data.js'), 'utf8'))(ctx.window);
  return ctx.window.MEMO_DATA.doors;
}

/** The scrubs the vendored text gets (verify.mjs rebuilds and compares, so they are part of "verbatim"): the real
 *  domain (only in comments of what is vendored), staff first names in comments by hash, and real door names a
 *  comment uses as an example — each becomes a door of the same building from the demo's inventory. */
export function scrub(out) {
  const DOMAIN = 'harford' + 'christian';
  out = out.replace(new RegExp(DOMAIN + '\\.org', 'gi'), 'example.edu').replace(new RegExp(DOMAIN, 'gi'), 'example');
  const real = realDoors(), demo = demoDoors(), map = [];
  Object.keys(real).forEach((g) => real[g].forEach((name, i) => { const alt = demo[g] || demo[Object.keys(demo)[0]]; map.push([name, alt[i % alt.length]]); }));
  map.sort((a, b) => b[0].length - a[0].length).forEach(([name, alt]) => { out = out.split(name).join(alt); });
  return aliasStaffNames(aliasPhrases(out, PHRASE_ALIASES).text).text;
}

export function buildLogic() {
  let out = '';
  for (const f of WHOLE) out += `/* ===== ${f} ===== */\n` + read(f) + '\n';
  for (const [f, names] of Object.entries(WANT)) out += `/* ===== ${f} (named declarations) ===== */\n` + pick(f, names) + '\n';
  out = scrub(out);
  return [
    '/* GENERATED by demos/memo-check/build-logic.mjs — do not edit.',
    "   Memo Check's OWN server code, verbatim: Plan.js and Queue.js whole, and the named declarations of Config,",
    '   Report, Analyze, Applied, Mail, Alerts and Main that the hourly tick and the queue need. Real ids, addresses,',
    '   the door inventory and the production prompt are left out; mock.js supplies demo values and binds Google. */',
    '(function (global) {',
    '  var ' + SERVICES.join(', ') + ';',
    out,
    '  global.MEMO_LOGIC = {',
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
  console.log('built demos/memo-check/logic.js (' + out.length + ' bytes)');
}
