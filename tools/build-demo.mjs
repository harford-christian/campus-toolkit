// build-demo.mjs — assemble a standalone demo HTML from a real Apps Script template.
// Usage: node tools/build-demo.mjs <config.json>
// Config: { src, dst, includeDir?, replace?: [[find,repl],...], demoName }
// Steps: inline <?!= include('X') ?> · apply literal replacements (GAS tokens / scrubs)
//        · strip control scriptlets <? ... ?> (keep inner content) · inject demo <head> block.
import fs from 'node:fs';
import path from 'node:path';

const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let html = fs.readFileSync(cfg.src, 'utf8');

// 1. Inline includes (one pass; door's includes don't nest).
if (cfg.includeDir) {
  html = html.replace(/<\?!=\s*include\('([^']+)'\)\s*;?\s*\?>/g, (_m, name) => {
    const p = path.join(cfg.includeDir, name + '.html');
    return fs.readFileSync(p, 'utf8');
  });
}

// 2. Literal replacements: GAS output tokens (<?= x ?>) and private-data scrubs.
for (const [find, repl] of (cfg.replace || [])) html = html.split(find).join(repl);

// 3. Strip remaining control scriptlets <? ... ?> but NOT <?= / <?!= output tags.
html = html.replace(/<\?(?![=!])[\s\S]*?\?>/g, '');

// 4. Inject the demo head block (shim + data + mock + banner) before </head>.
const head = [
  '<!-- ===== Showcase demo shim (standalone build) ===== -->',
  '<link rel="stylesheet" href="../../assets/demo-banner.css">',
  `<script>window.DEMO_META = { name: ${JSON.stringify(cfg.demoName || 'Demo')} };</script>`,
  '<script src="../../assets/gsr-shim.js"></script>',
  '<script src="data.js"></script>',
  '<script src="mock.js"></script>',
  '<script src="../../assets/demo-banner.js" defer></script>'
].join('\n');
html = html.replace(/<\/head>/i, head + '\n</head>');

fs.mkdirSync(path.dirname(cfg.dst), { recursive: true });
fs.writeFileSync(cfg.dst, html);

// Report any GAS tokens that slipped through (would break the page).
const leftover = (html.match(/<\?[=!][\s\S]*?\?>/g) || []);
console.log('built', cfg.dst, '(' + html.length + ' bytes)');
if (leftover.length) console.log('  WARNING unreplaced tokens:', [...new Set(leftover)].join(' | '));
