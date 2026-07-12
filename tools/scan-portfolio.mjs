#!/usr/bin/env node
/* scan-portfolio.mjs — keep the showcase in sync with the Projects/ folder.
 *
 *   node tools/scan-portfolio.mjs         → report: NEW demoable projects + CHANGED demos.
 *   node tools/scan-portfolio.mjs mark     → (re)baseline every tool's fingerprint.
 *
 * Detection is deterministic (no LLM). Change classification ignores cosmetic edits by
 * hashing a comment/whitespace-normalized copy of each demo's source HTML:
 *   OK                  fingerprint == baseline
 *   SIGNIFICANT-AUTO    normalized HTML changed; google.script.run method-set + file-set same
 *                       (mock contract still holds → safe to rebuild + push after verify)
 *   SIGNIFICANT-PROMPT  a source HTML file was added/removed, or the google.script.run
 *                       method-set changed (mock/data likely need new work → ask Josh)
 *   SOURCE-MISSING      a builtFrom file no longer exists (source moved → ask)
 * MINOR edits (whitespace/comments only) never surface — the normalized hash is unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
function fingerprint(builtFrom) {
  const files = [], missing = [];
  let concat = '';
  for (const g of builtFrom) {
    const abs = path.join(PROJECTS, g);
    if (!fs.existsSync(abs)) { missing.push(g); continue; }
    files.push(g);
    concat += '\n<<<' + g + '>>>\n' + fs.readFileSync(abs, 'utf8');
  }
  return {
    files: files.sort(),
    missing,
    gsr: gsrMethods(concat),
    hash: crypto.createHash('sha256').update(normalize(concat)).digest('hex').slice(0, 16)
  };
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

const covered = new Set(manifest.coveredProjects || []);
const newProjects = demoable.filter((d) => !covered.has(d));

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const tools = {};
for (const [key, t] of Object.entries(manifest.tools)) {
  const fp = fingerprint(t.builtFrom || []);
  let status = 'OK', detail = '';
  const base = baseline[key];
  if (fp.missing.length) { status = 'SOURCE-MISSING'; detail = 'missing: ' + fp.missing.join(', '); }
  else if (!base) { status = 'UNBASELINED'; detail = 'run `mark` to baseline'; }
  else if (base.hash === fp.hash && JSON.stringify(base.gsr) === JSON.stringify(fp.gsr) && JSON.stringify(base.files) === JSON.stringify(fp.files)) { status = 'OK'; }
  else if (JSON.stringify(base.files) !== JSON.stringify(fp.files)) { status = 'SIGNIFICANT-PROMPT'; detail = 'source view added/removed'; }
  else if (JSON.stringify(base.gsr) !== JSON.stringify(fp.gsr)) { status = 'SIGNIFICANT-PROMPT'; detail = 'google.script.run methods changed: ' + fp.gsr.join(', '); }
  else { status = 'SIGNIFICANT-AUTO'; detail = 'content changed (mock contract intact)'; }
  tools[key] = { title: t.title, demoFolder: t.demoFolder, status, detail, fingerprint: fp };
}

if (mode === 'mark') {
  const out = {};
  for (const [key, v] of Object.entries(tools)) out[key] = v.fingerprint;
  fs.writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n');
  console.log('Baselined ' + Object.keys(out).length + ' tools → ' + rel(BASELINE));
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
  if (auto.length) { L.push('CHANGED (auto-resync — rebuild+push after verify):'); auto.forEach((c) => L.push('  • ' + c.key + ' — ' + c.detail)); }
  if (prompt.length) { L.push('CHANGED (ask Josh — needs mock/data work):'); prompt.forEach((c) => L.push('  • ' + c.key + ' — ' + c.status + ' — ' + c.detail)); }
}
const unbaselined = Object.entries(tools).filter(([, v]) => v.status === 'UNBASELINED').map(([k]) => k);
if (unbaselined.length) L.push('(unbaselined: ' + unbaselined.join(', ') + ' — run `node tools/scan-portfolio.mjs mark`)');
console.log(L.join('\n'));
