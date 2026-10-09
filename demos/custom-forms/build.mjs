// build.mjs — rebuild the whole Custom Forms demo from the source project.
//
//   node demos/custom-forms/build.mjs             (from the showcase repo root)
//
// 1. build-logic.mjs vendors the five apps' server into logic.js.
// 2. PREP, for each surface: the app's pages/Index.html is an Apps Script TEMPLATE whose doGet picks a
//    branch (<? if (mode === ...) { ?>) and pulls partials in with include_('pages/X'). tools/build-demo.mjs
//    inlines only the include('X') spelling and keeps every branch, so this step evaluates the template's
//    CONTROL scriptlets for one mode — the branch doGet would take — and respells include_(...) as
//    include(...). Output tags (<?= x ?>, <?!= x ?>) are left untouched for build-demo and the build
//    config. The result goes to .tmp/custom-forms/<surface>.src.html (git-ignored): an intermediate, the
//    same template text with only the branch and the spelling changed.
// 3. tools/build-demo.mjs builds each demos/custom-forms/build.<surface>.json into <surface>.html.
//
// Pass --out <dir> to write the built pages and logic.js somewhere else (verify.mjs builds into a temp
// directory and compares byte-for-byte with what is committed).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildLogic, SRC } from './build-logic.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// surface -> [app, mode]. mode is the value doGet assigns to t.mode for that branch ('' = no branch).
export const SURFACES = {
  'chooser':     ['chooser', ''],
  'builder':     ['builder', ''],
  'parent':      ['runner-public', 'parent'],      // also serves ?guest=1 (mode 'guest' takes the same branch)
  'parent-form': ['runner-public', 'runner'],
  'staff':       ['runner-staff', 'portal'],
  'staff-form':  ['runner-staff', 'runner'],
  'macs':        ['runner-macs', 'schoolGate'],
  'macs-portal': ['runner-macs', 'guest'],
  'macs-form':   ['runner-macs', 'runner']
};

/** Evaluate a template's control scriptlets for `mode`; keep output tags verbatim (include_ respelled). */
export function prepTemplate(src, mode) {
  const parts = src.replace(/\r\n?/g, '\n').split(/(<\?[\s\S]*?\?>)/);
  let code = 'var out = [];\n';
  for (const p of parts) {
    if (!p) continue;
    if (/^<\?(=|!=)/.test(p)) {
      const inc = /^<\?!=\s*include_\('([^']+)'\)\s*;?\s*\?>$/.exec(p);
      code += 'out.push(' + JSON.stringify(inc ? "<?!= include('" + inc[1] + "') ?>" : p) + ');\n';
    } else if (/^<\?/.test(p)) {
      code += p.slice(2, -2) + '\n';
    } else {
      code += 'out.push(' + JSON.stringify(p) + ');\n';
    }
  }
  code += 'return out.join("");';
  return new Function('mode', code)(mode);
}

export function prepAll(tmpDir) {
  mkdirSync(tmpDir, { recursive: true });
  for (const [surface, [app, mode]] of Object.entries(SURFACES)) {
    const src = readFileSync(path.join(SRC, 'apps', app, 'pages/Index.html'), 'utf8');
    writeFileSync(path.join(tmpDir, surface + '.src.html'), prepTemplate(src, mode));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(SRC)) { console.log('SKIP build: source project not found at', SRC); process.exit(0); }
  const oi = process.argv.indexOf('--out');
  const outDir = oi > -1 ? path.resolve(process.argv[oi + 1]) : HERE;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'logic.js'), buildLogic());
  console.log('built logic.js');
  const tmp = path.join(ROOT, '.tmp/custom-forms');
  prepAll(tmp);
  for (const surface of Object.keys(SURFACES)) {
    const cfgPath = path.join(HERE, 'build.' + surface + '.json');
    let arg = cfgPath;
    if (outDir !== HERE) {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
      cfg.dst = path.join(outDir, surface + '.html');
      arg = path.join(tmp, 'build.' + surface + '.out.json');
      writeFileSync(arg, JSON.stringify(cfg));
    }
    process.stdout.write(execFileSync(process.execPath, [path.join(ROOT, 'tools/build-demo.mjs'), arg], { cwd: ROOT, encoding: 'utf8' }));
  }
}
