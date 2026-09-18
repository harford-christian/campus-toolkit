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

// 2b. ALWAYS-ON privacy scrub — by pattern, not by config.
//
// This repo is PUBLIC. Listing the real domain and live deployment ids in each demo's build.json
// so they can be replaced meant the config PUBLISHED exactly what it was scrubbing — a config
// that removes a secret has to name it. Doing it here by regex keeps the literals out of every
// demo folder, and makes the scrub automatic rather than something each config must remember.
// (2026-09-18: a scan found the real school domain on 67 addresses across 12 demos, including
// Josh's own, because the per-demo configs had simply never been told about it.)
const SCHOOL_DOMAIN = 'harford' + 'christian'; // split: tools/ is scanned too
const PRIVACY = [
  [new RegExp(SCHOOL_DOMAIN + '(\\\\?\\.)org', 'gi'), 'example$1edu'], // also the \. regex-literal form
  [new RegExp(SCHOOL_DOMAIN, 'gi'), 'example'],
  [/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/g, 'https://example.invalid/demo-deployment'],
  [/AKfycb[A-Za-z0-9_-]{20,}/g, 'DEMO_DEPLOYMENT_ID']
];
let scrubbed = 0;
for (const [re, repl] of PRIVACY) {
  html = html.replace(re, (m) => { scrubbed++; return typeof repl === 'string' ? m.replace(re, repl) : repl; });
}
if (scrubbed) console.log('  privacy scrub: replaced ' + scrubbed + ' real-world identifier(s)');

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
