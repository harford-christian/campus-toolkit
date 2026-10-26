#!/usr/bin/env node
/* scan-portfolio.mjs — keep the showcase in sync with the Projects/ folder.
 *
 *   node tools/scan-portfolio.mjs              → report: NEW demoable projects + CHANGED demos.
 *   node tools/scan-portfolio.mjs mark         → (re)baseline every tool's fingerprint.
 *   node tools/scan-portfolio.mjs mark <key>…  → re-baseline only those tools (after resyncing one demo, so the
 *                                                mark cannot quietly absorb drift in the others).
 *   node tools/scan-portfolio.mjs reach        → list, per tool, the source symbols its vendored code uses but its
 *                                                build does not vendor (what mock.js or the page must supply).
 *
 * WHAT A TOOL'S FINGERPRINT COVERS (manifest fields)
 *   builtFrom    the source pages build-demo.mjs inlines, plus any other source a demo is built from or checked
 *                against that no build script vendors (hand-listed).
 *   vendoredBy   the demo's build-logic scripts. Each exports VENDORED = [{ dir, files, decls }]: the source files
 *                it copies whole, and (decls) the named top-level declarations it picks out of a file. The scanner
 *                imports the script and fingerprints exactly that, so the list is never copied here by hand.
 *   producers    real code whose OUTPUT the demo's fabricated data must match (its verify.mjs compares the two).
 *
 * Detection is deterministic (no LLM). Hashes are taken over a comment/whitespace-normalized copy, so cosmetic
 * edits never surface. Statuses:
 *   OK                  nothing that matters changed.
 *   SIGNIFICANT-AUTO    content changed and none of the PROMPT rules fired: a rebuild should be enough. It is not a
 *                       licence to push — rebuild, and the demo's verify.mjs must pass first.
 *   SIGNIFICANT-PROMPT  the contract moved, so the mock or the data likely need work (ask Josh):
 *                         - the file set changed (a page added/removed, a build script's VENDORED list edited);
 *                         - the google.script.run method set changed;
 *                         - a page's envelope ops changed — per file, so per API (officeApi vs kioskApi);
 *                         - vendored code now reaches a top-level symbol of its source project that the build does
 *                           not vendor (a new helper, a new module, a new Config symbol the mock must supply);
 *                         - a producer changed.
 *   SOURCE-MISSING      a listed file, or a declaration a build script picks, no longer exists (source moved → ask).
 *
 * WHY THE LAST THREE PROMPT RULES EXIST. On 2026-10-26 this scanner called eight demos "content changed (mock
 * contract intact)", and three of their verify.mjs failed. transportation: setOverrides began calling a new
 * dsOverrideNotify_ that build-logic.mjs did not pick, and the roster producer gained a Homeschool column.
 * campus-presence: the office Board began sending officeApi {op:'lateIn'}, masked because ops were merged across
 * files and the kiosk already sent its own lateIn. student-portal: the vendored Code.gs/Data.gs began needing a new
 * GradeView.js and new Config.gs symbols. None of those files was fingerprinted, or the signal was merged away.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHOWCASE = path.resolve(SCRIPT_DIR, '..');
const PROJECTS = path.resolve(SHOWCASE, '..');
const MANIFEST = path.join(SCRIPT_DIR, 'portfolio.manifest.json');
const BASELINE = path.join(SCRIPT_DIR, 'portfolio-baseline.json');
const STATUS = path.join(SCRIPT_DIR, 'portfolio-status.json');

const mode = (process.argv[2] || 'report').toLowerCase();
const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const EXCLUDES = manifest.excludeDirs || [];
const rel = (p) => path.relative(PROJECTS, p).split(path.sep).join('/');
const excluded = (relPath) => EXCLUDES.some((e) => e.startsWith('/') ? ('/' + relPath + '/').includes(e) : relPath.split('/').includes(e));
const lf = (s) => s.replace(/\r\n?/g, '\n');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

/* ---------- fingerprint helpers ---------- */
function normalize(html) {
  const lines = html.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)); // drop full-line // comments (keeps URLs)
  return lines.join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')      // HTML comments
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/\s+/g, ' ')                 // collapse whitespace
    .trim();
}
function gsrMethods(html) {
  // Walk each `google.script.run` chain, consuming `.ident(...balanced...)` segments so
  // that calls inside handler bodies (getElementById, Array.isArray, .map().filter()) never
  // leak in. Records the real backend method names (drops the with* handler wrappers).
  const out = new Set();
  const anchor = 'google.script.run';
  const s = html;
  let i = 0;
  while ((i = s.indexOf(anchor, i)) >= 0) {
    let j = i + anchor.length;
    for (;;) {
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] !== '.') break;
      j++;
      while (j < s.length && /\s/.test(s[j])) j++;
      let id = '';
      while (j < s.length && /\w/.test(s[j])) id += s[j++];
      if (!id) break;
      while (j < s.length && /\s/.test(s[j])) j++;
      const isHandler = /^with(Success|Failure|User)/.test(id);
      if (s[j] !== '(') { if (!isHandler) out.add(id); break; } // property access, not a call
      let depth = 0;                                            // skip balanced parens + strings
      for (; j < s.length; j++) {
        const c = s[j];
        if (c === '"' || c === "'" || c === '`') { const q = c; j++; while (j < s.length && s[j] !== q) { if (s[j] === '\\') j++; j++; } }
        else if (c === '(') depth++;
        else if (c === ')') { depth--; if (depth === 0) { j++; break; } }
      }
      if (!isHandler) out.add(id);
    }
    i += anchor.length;
  }
  return [...out].sort();
}

/**
 * The `{op:'…'}` values an envelope-style app sends.
 *
 * WHY THIS EXISTS. gsrMethods alone cannot see a contract change in an app that funnels every call
 * through ONE server function — campus-presence (`officeApi` / `kioskApi`), transpo-routes (`driverApi` /
 * `officeApi`). The method name never changes, so the scanner reported "content changed (mock
 * contract intact)" while four new ops (movementOut, movementBack, movementOpenList,
 * studentOptions) had appeared and the mock handled none of them. Acting on that advice
 * auto-resyncs the demo into dead buttons. Found 2026-09-14, and only because the demo's own
 * verify.mjs disagreed with this scanner.
 *
 * For those apps the op set IS the contract, so it belongs in the fingerprint — per page, not merged: an op is
 * served per API, and a merged set let the office's new lateIn hide behind the kiosk's (2026-10-26).
 */
function envelopeOps(html) {
  const out = new Set();
  for (const m of html.matchAll(/\bop\s*:\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]/g)) out.add(m[1]);
  return [...out].sort();
}
/** { page file: { api, ops } } for every page that sends envelope ops. A page names its API through its own
 *  google.script.run call (each campus-presence page has its own api() wrapper over officeApi or kioskApi). */
function opsByFile(parts) {
  const out = {};
  for (const p of parts) {
    if (!p.file.endsWith('.html')) continue;
    const ops = envelopeOps(p.text);
    if (ops.length) out[p.file] = { api: gsrMethods(p.text).join('+') || '(api call in another file)', ops };
  }
  return out;
}

/* ---------- vendored-code reach: what the copied server code needs that the build does not copy ---------- */

/** Top-level declarations of a GAS/JS file: [{ name, text }], text running from the doc comment above it to the next
 *  declaration (the same split demos/transportation/build-logic.mjs uses to pick declarations). */
function declarations(src) {
  const lines = src.split('\n');
  const isComment = (l) => /^\s*(\/\*\*|\/\*|\*|\*\/|\/\/)/.test(l);
  const starts = [];
  lines.forEach((line, i) => {
    const m = /^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(|^(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*[=;]|^class\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (!m) return;
    let doc = i;
    while (doc > 0 && isComment(lines[doc - 1])) doc--;
    starts.push({ name: m[1] || m[2] || m[3], doc, at: i });
  });
  return starts.map((s, k) => {
    const end = k + 1 < starts.length ? Math.max(starts[k + 1].doc, s.at + 1) : lines.length;
    return { name: s.name, text: lines.slice(s.doc, end).join('\n') };
  });
}

/** Bare names a piece of JS refers to — comments, string/regex literals and `.property` accesses skipped. */
function referencedNames(src, out = new Set()) {
  const n = src.length;
  const KEYWORD_BEFORE_EXPR = /^(return|typeof|case|do|else|in|of|new|delete|void|throw|instanceof|yield|await)$/;
  let i = 0, prev = '';   // prev: last significant token class, to tell a regex literal from a division
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      i = j + 1; prev = 'v'; continue;
    }
    if (c === '`') {                                  // template literal: skip the text, read the ${…} expressions
      let j = i + 1;
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') {
          let depth = 1, k = j + 2;
          while (k < n && depth) { if (src[k] === '{') depth++; else if (src[k] === '}') depth--; k++; }
          referencedNames(src.slice(j + 2, k - 1), out);
          j = k; continue;
        }
        j++;
      }
      i = j + 1; prev = 'v'; continue;
    }
    if (c === '/' && (prev === '' || prev === 'op')) {   // regex literal
      let j = i + 1, inClass = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') inClass = true;
        else if (src[j] === ']') inClass = false;
        else if (src[j] === '/' && !inClass) break;
        j++;
      }
      if (src[j] === '/') { j++; while (j < n && /\w/.test(src[j])) j++; i = j; prev = 'v'; continue; }
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w$]/.test(src[j])) j++;
      const id = src.slice(i, j);
      if (prev !== '.') out.add(id);
      prev = KEYWORD_BEFORE_EXPR.test(id) ? 'op' : 'v';
      i = j; continue;
    }
    if (/[0-9]/.test(c)) { let j = i + 1; while (j < n && /[\w.]/.test(src[j])) j++; i = j; prev = 'v'; continue; }
    if (!/\s/.test(c)) prev = c === '.' ? '.' : (c === ')' || c === ']' || c === '}') ? 'v' : 'op';
    i++;
  }
  return out;
}

// Folders of a source project that Apps Script never loads (tests, tooling, local data dumps) — not part of what
// vendored code could be reaching for, and some hold real data that has no business being read here.
const NOT_SERVER = new Set(['node_modules', '.git', 'test', 'tests', '__tests__', 'tools', 'scripts', 'docs', 'legacy',
  '.clasp-store', 'coverage', 'dist', '.tmp']);
function serverFiles(dir, acc = [], depth = 0) {
  if (depth > 4) return acc;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { if (!NOT_SERVER.has(e.name) && !e.name.startsWith('.')) serverFiles(abs, acc, depth + 1); }
    else if (/\.(gs|js)$/.test(e.name)) acc.push(abs);
  }
  return acc;
}

/**
 * The top-level symbols of the source project(s) that the vendored code refers to but the build does not vendor:
 * ['Config.gs:SOME_CONSTANT', 'GradeView.js:GradeView', 'Code.gs:dsOverrideNotify_', …]. Some are supplied on purpose
 * (mock.js's own config, a page-inlined module); the baseline records those. A NEW entry means the vendored code
 * now reaches past what the demo provides — the build's list or the mock has to grow — which is what a rebuild
 * alone cannot fix.
 */
function vendoredReach(vendored) {
  const declared = new Set(), wholeFiles = new Set(), refs = new Set();
  for (const v of vendored) {
    referencedNames(v.text, refs);
    if (v.picked) v.picked.forEach((x) => declared.add(x));
    else { wholeFiles.add(v.file); declarations(v.text).forEach((d) => declared.add(d.name)); }
  }
  const owner = new Map();   // symbol -> file that declares it, among source files not vendored whole
  for (const dir of new Set(vendored.map((v) => v.dir))) {
    for (const abs of serverFiles(path.join(PROJECTS, dir))) {
      const file = rel(abs);
      if (wholeFiles.has(file)) continue;
      let src; try { src = lf(fs.readFileSync(abs, 'utf8')); } catch { continue; }
      for (const d of declarations(src)) if (!owner.has(d.name)) owner.set(d.name, file);
    }
  }
  return [...refs].filter((r) => owner.has(r) && !declared.has(r)).map((r) => owner.get(r) + ':' + r).sort();
}

/* ---------- a tool's fingerprint ---------- */
async function vendoredSpecs(t) {
  const specs = [];
  for (const script of t.vendoredBy || []) {
    const mod = await import(pathToFileURL(path.join(SHOWCASE, script)).href);
    if (!Array.isArray(mod.VENDORED)) throw new Error(script + ' does not export a VENDORED list');
    for (const v of mod.VENDORED) specs.push({ dir: rel(v.dir), files: v.files || [], decls: v.decls || {} });
  }
  return specs;
}

async function fingerprint(t) {
  const missing = [];
  const parts = new Map();   // file -> { file, text, dir?, picked? }; a file vendored whole beats one picked from
  const read = (g) => { const abs = path.join(PROJECTS, g); if (!fs.existsSync(abs)) { missing.push(g); return null; } return fs.readFileSync(abs, 'utf8'); };
  for (const g of t.builtFrom || []) { const text = read(g); if (text !== null) parts.set(g, { file: g, text }); }
  const vendored = [];
  for (const v of await vendoredSpecs(t)) {
    for (const f of v.files) {
      const g = v.dir + '/' + f, text = read(g);
      if (text === null) continue;
      const p = { file: g, text, dir: v.dir };
      vendored.push(p); parts.set(g, p);
    }
    for (const [f, names] of Object.entries(v.decls)) {
      const g = v.dir + '/' + f, text = read(g);
      if (text === null) continue;
      const byName = new Map(declarations(lf(text)).map((d) => [d.name, d.text]));
      names.filter((x) => !byName.has(x)).forEach((x) => missing.push(g + ' → ' + x));
      const p = { file: g, text: names.filter((x) => byName.has(x)).map((x) => byName.get(x)).join('\n'), dir: v.dir, picked: names };
      vendored.push(p);
      if (!parts.has(g) || parts.get(g).picked) parts.set(g, p);
    }
  }
  const list = [...parts.values()];
  const producers = {};
  for (const g of t.producers || []) { const text = read(g); if (text !== null) producers[g] = sha(normalize(text)); }
  const concat = list.map((p) => '\n<<<' + p.file + '>>>\n' + p.text).join('');
  const picked = {};
  for (const p of list) if (p.picked) picked[p.file] = [...p.picked].sort();
  return {
    files: list.map((p) => p.file).sort(),
    missing,
    // The pages' calls. Vendored server files are left out: they only mention google.script.run in comments.
    gsr: gsrMethods(list.filter((p) => !p.dir).map((p) => '\n<<<' + p.file + '>>>\n' + p.text).join('')),
    opsByFile: opsByFile(list),
    picked,
    reach: vendored.length ? vendoredReach(vendored) : [],
    producers,
    fileHashes: Object.fromEntries(list.map((p) => [p.file, sha(normalize(p.text))]).sort()),
    hash: sha(normalize(concat))
  };
}

/* ---------- the baseline record ----------
   Every NAME the baseline keeps (methods, ops, declarations, reach) is stored hashed: the baseline sits in a PUBLIC repo
   and the names come from unscrubbed source — the purchasing pages' own method names carry a staff member's name, which
   the demo build aliases away but a plain list here would publish. Paths stay plain (the manifest lists them anyway). */
const nameKey = (tag, name) => sha(tag + ':' + name);
const keys = (tag, names) => names.map((n) => nameKey(tag, n)).sort();
function stored(fp) {
  return {
    v: 2,
    files: fp.files,
    gsr: keys('gsr', fp.gsr),
    opsByFile: Object.fromEntries(Object.entries(fp.opsByFile).map(([f, o]) => [f, keys('op', o.ops)])),
    picked: Object.fromEntries(Object.entries(fp.picked).map(([f, names]) => [f, keys('decl', names)])),
    reach: keys('reach', fp.reach),
    producers: fp.producers,
    fileHashes: fp.fileHashes,
    hash: fp.hash
  };
}

/* ---------- classification ---------- */
const diff = (now, was) => ({ added: now.filter((x) => !was.includes(x)), removed: was.filter((x) => !now.includes(x)) });
const describe = ({ added, removed }) => [added.length ? 'added: ' + added.join(', ') : '', removed.length ? 'removed: ' + removed.join(', ') : '']
  .filter(Boolean).join('; ');
/** Current names against a baseline's hashed ones: the added names, and the keys of those that are gone. */
function nameDiff(tag, now, wasKeys) {
  const was = new Set(wasKeys), nowKeys = new Set(now.map((n) => nameKey(tag, n)));
  return { added: now.filter((n) => !was.has(nameKey(tag, n))), removed: [...was].filter((k) => !nowKeys.has(k)) };
}
const describeNames = ({ added, removed }) => [added.length ? 'added: ' + added.join(', ') : '', removed.length ? removed.length + ' removed' : '']
  .filter(Boolean).join('; ');

function classify(key, fp, base) {
  if (fp.missing.length) return { status: 'SOURCE-MISSING', detail: 'missing: ' + fp.missing.join(', ') };
  if (!base) return { status: 'UNBASELINED', detail: 'run `mark` to baseline' };
  // A field absent from the baseline predates its check: that is UNKNOWN, not changed — comparing it would flag
  // every demo once, for nothing. (Added 2026-10-26, baseline v2: opsByFile, picked, reach, producers, fileHashes.)
  const why = [];
  const changed = (d) => d.added.length || d.removed.length;
  const files = diff(fp.files, base.files || []);
  if (changed(files)) why.push('file set changed (a page, or a build script\'s VENDORED list) — ' + describe(files));
  const gsr = nameDiff('gsr', fp.gsr, base.v >= 2 ? base.gsr : keys('gsr', base.gsr || []));   // v1 kept them plain
  if (changed(gsr)) why.push('google.script.run methods changed — ' + describeNames(gsr));
  if (base.opsByFile) {
    for (const f of [...new Set([...Object.keys(fp.opsByFile), ...Object.keys(base.opsByFile)])].sort()) {
      const now = fp.opsByFile[f] || { api: '(page no longer sends ops)', ops: [] };
      const d = nameDiff('op', now.ops, base.opsByFile[f] || []);
      if (changed(d)) why.push(f + ' (' + now.api + ') envelope ops ' + describeNames(d));
    }
  }
  if (base.picked) {
    for (const f of [...new Set([...Object.keys(fp.picked), ...Object.keys(base.picked)])].sort()) {
      const d = nameDiff('decl', fp.picked[f] || [], base.picked[f] || []);
      if (changed(d)) why.push('declarations vendored from ' + f + ' ' + describeNames(d));
    }
  }
  if (base.reach) {
    const grown = nameDiff('reach', fp.reach, base.reach).added;
    if (grown.length) why.push('vendored code now reaches source the build does not vendor — ' +
      grown.map((r) => r.slice(r.lastIndexOf(':') + 1) + ' (' + r.slice(0, r.lastIndexOf(':')) + ')').join(', ') +
      ' — vendor it (the build script\'s list) or have the mock supply it');
  }
  if (base.producers) {
    const moved = Object.keys(fp.producers).filter((f) => base.producers[f] !== fp.producers[f]);
    if (moved.length) why.push('data producer changed: ' + moved.join(', ') + ' — the fabricated data may need its new shape (verify.mjs compares the two)');
  }
  if (why.length) return { status: 'SIGNIFICANT-PROMPT', detail: why.join(' | ') + '. The mock/data need work before a rebuild.' };
  if (base.hash === fp.hash) return { status: 'OK', detail: '' };
  const edited = base.fileHashes ? Object.keys(fp.fileHashes).filter((f) => base.fileHashes[f] !== fp.fileHashes[f]) : [];
  return { status: 'SIGNIFICANT-AUTO', detail: 'content changed, contract intact' + (edited.length ? ' (' + edited.join(', ') + ')' : '') +
    ' — rebuild, then ' + (manifest.tools[key].demoFolder || 'demos/' + key) + '/verify.mjs must pass before any push' };
}

/* ---------- discovery: demoable web apps under Projects/ ---------- */
function findAppManifests(dir, depth, acc) {
  if (depth > 4) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const r = rel(abs);
    if (excluded(r)) continue;
    if (e.isDirectory()) findAppManifests(abs, depth + 1, acc);
    else if (e.name === 'appsscript.json') acc.push(dir);
  }
}
function readAll(dir, exts, depth = 0, acc = []) {
  if (depth > 3) return acc;
  let entries; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) readAll(abs, exts, depth + 1, acc);
    else if (exts.some((x) => e.name.endsWith(x))) { try { acc.push(fs.readFileSync(abs, 'utf8')); } catch {} }
  }
  return acc;
}
function isDemoable(appDir) {
  try {
    const mani = fs.readFileSync(path.join(appDir, 'appsscript.json'), 'utf8');
    if (!/"webapp"/.test(mani)) return false;
  } catch { return false; }
  const code = readAll(appDir, ['.js', '.gs']).join('\n');
  const hasDoGet = /function\s+doGet\b/.test(code) && /HtmlService\.create(HtmlOutput|Template)FromFile/.test(code);
  if (!hasDoGet) return false;
  const html = readAll(appDir, ['.html']).join('\n');
  return /google\.script\.run/.test(html);
}

/* ---------- run ---------- */
const appDirs = [];
findAppManifests(PROJECTS, 0, appDirs);
const demoable = [...new Set(appDirs.map(rel))].filter((d) => { try { return isDemoable(path.join(PROJECTS, d)); } catch { return false; } }).sort();

// skippedProjects: demoable projects Josh decided not to showcase. Kept apart from coveredProjects so "has a demo" and
// "deliberately has none" stay distinguishable; both stop a project being reported as NEW.
const covered = new Set([...(manifest.coveredProjects || []), ...(manifest.skippedProjects || [])]);
const newProjects = demoable.filter((d) => !covered.has(d));

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const tools = {};
for (const [key, t] of Object.entries(manifest.tools)) {
  let fp, c;
  try { fp = await fingerprint(t); c = classify(key, fp, baseline[key]); }
  catch (e) { fp = null; c = { status: 'SIGNIFICANT-PROMPT', detail: 'could not fingerprint (' + e.message + ') — fix the build script or the manifest' }; }
  tools[key] = { title: t.title, demoFolder: t.demoFolder, status: c.status, detail: c.detail, fingerprint: fp };
}

if (mode === 'reach') {   // what each demo's vendored code reaches outside its build (local names; never written)
  for (const [key, v] of Object.entries(tools)) if (v.fingerprint && v.fingerprint.reach.length) console.log(key + ': ' + v.fingerprint.reach.join(', '));
  process.exit(0);
}

if (mode === 'mark') {
  const only = process.argv.slice(3);
  const unknown = only.filter((k) => !tools[k]);
  if (unknown.length) { console.error('Unknown tool key(s): ' + unknown.join(', ')); process.exit(1); }
  const out = only.length ? Object.assign({}, baseline) : {};
  const marked = [];
  for (const [key, v] of Object.entries(tools)) {
    if (only.length && !only.includes(key)) continue;
    if (!v.fingerprint) { console.error('NOT marked ' + key + ': ' + v.detail); continue; }
    out[key] = stored(v.fingerprint); marked.push(key);
  }
  fs.writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n');
  console.log('Baselined ' + marked.length + ' tool(s)' + (only.length ? ' (' + marked.join(', ') + ')' : '') + ' → ' + rel(BASELINE));
  process.exit(0);
}

const status = {
  scannedAt: new Date().toISOString(),
  demoableCount: demoable.length,
  new: newProjects,
  changed: Object.entries(tools).filter(([, v]) => v.status.startsWith('SIGNIFICANT') || v.status === 'SOURCE-MISSING')
    .map(([k, v]) => ({ key: k, title: v.title, status: v.status, detail: v.detail })),
  tools: Object.fromEntries(Object.entries(tools).map(([k, v]) => [k, { status: v.status, detail: v.detail }]))
};
fs.writeFileSync(STATUS, JSON.stringify(status, null, 2) + '\n');

/* ---------- human summary ---------- */
const L = [];
const drift = status.changed.length > 0 || status.new.length > 0;
if (!drift) {
  L.push('Portfolio in sync — ' + Object.keys(tools).length + ' tools OK, no new demoable projects.');
} else {
  if (status.new.length) {
    L.push('NEW demoable projects not in the showcase (' + status.new.length + '):');
    status.new.forEach((d) => L.push('  • ' + d));
  }
  const auto = status.changed.filter((c) => c.status === 'SIGNIFICANT-AUTO');
  const prompt = status.changed.filter((c) => c.status !== 'SIGNIFICANT-AUTO');
  if (auto.length) { L.push('CHANGED (auto-resync — rebuild, push only once the demo\'s verify.mjs passes):'); auto.forEach((c) => L.push('  • ' + c.key + ' — ' + c.detail)); }
  if (prompt.length) { L.push('CHANGED (ask Josh — needs mock/data work):'); prompt.forEach((c) => L.push('  • ' + c.key + ' — ' + c.status + ' — ' + c.detail)); }
}
const unbaselined = Object.entries(tools).filter(([, v]) => v.status === 'UNBASELINED').map(([k]) => k);
if (unbaselined.length) L.push('(unbaselined: ' + unbaselined.join(', ') + ' — run `node tools/scan-portfolio.mjs mark`)');
console.log(L.join('\n'));
