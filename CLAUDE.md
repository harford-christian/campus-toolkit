# apps-script-showcase (Campus Operations Toolkit) — project instructions

> Drafted 2026-10-04 from the code and commit history. Review it, fix anything marked **(verify)**, and keep it current.

## Goal
A public, browser-only portfolio of HCS's Apps Script tools. Each demo is the **real app UI** running on **fabricated sample data** — no Google backend, no login, no real records. Hosted from GitHub (repo `harford-christian/campus-toolkit`; `.nojekyll` suggests GitHub Pages **(verify)**). `README.md` lists every demo with its build and verify commands.

## Shape
- `index.html` + `assets/` — the gallery and the shared demo banner/shim (`gsr-shim.js` stands in for `google.script.run`).
- `demos/<tool>/` — one folder per tool. Several are built from the source project with `node tools/build-demo.mjs demos/<tool>/build.json` and checked with `node demos/<tool>/verify.mjs`.
- `tools/` — `build-demo.mjs`, `privacy-scan.mjs`, `scan-portfolio.mjs` with `portfolio.manifest.json` / `portfolio-baseline.json`.

## Never do (this repo is public)
- Never put real student, family or staff data, real names, emails, phone numbers or the real school domain in a demo. Use fabricated data only. Real staff names are matched by **hash**, never listed.
- Never point a demo at a live Apps Script backend or real Google sign-in.
- Never hand-edit a demo that has a `build.json`; change the build input and rebuild.

## Always do
- Run `node tools/privacy-scan.mjs` (and the portfolio scanner) before every commit, and re-baseline only on purpose.
- After rebuilding a demo, run its `verify.mjs` when it has one.
- Fake tokens and PINs in demo data (e.g. `req-…` tokens, PIN 1234 / 4821) are intentional sample data.

## Verify
- Open `index.html` locally and click through the changed demo; the privacy scan reports clean.
