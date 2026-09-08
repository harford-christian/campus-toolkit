# Campus Operations Toolkit — Showcase

An interactive, sales-ready portfolio of the Google Apps Script tools built for Harford
Christian School. Each demo is the **real app UI** running standalone in the browser on
**fabricated sample data** — no Google backend, no login, and no real records.

## Demos included (all 8 live)
| Tool | Folder | Notes |
|------|--------|-------|
| Library Catalog | `demos/library/` | Real cover art on the featured books (loaded from OpenLibrary; falls back to placeholder covers offline) |
| Campus Control (suite) | `demos/campus-control/` | Unified switcher (`index.html`) that frames three campus-control tools in one system: **Door Automation** (`demos/door/` — tabs + `dashboard.html` + `leadership.html`), **Event Requests** (`demos/event-requests/`), **Emergency Lockdown** (`demos/lockdown/`), **Bell Scheduler** (`demos/bell-schedule/`), and **Campus Monitoring** (`demos/monitoring/`) |
| Athletics Logistics (Talon Hub) | `demos/talon-hub/` | Rosters, travel manifests, check-offs — fully fabricated athletes/guardians |
| Purchasing & Procurement | `demos/purchasing/` | New Order, Order History, Management queue, and all 3 Analytics tabs are live. Secondary management sub-tabs (Products/Vendors/Users/Departments/Saved Views/Team Orders) and write-actions render empty by design — not wired for the demo |
| Leave & Substitute | `demos/leave-sub/` | Read-only analytics: personal, forecast, heatmap, subs, summary |
| Concessions Ordering System | `demos/pos/` | `index.html` is a unified switcher framing the three screens — `kiosk.html` (order kiosk) + `tv.html` (menu board) + `kds.html` (kitchen display). Kiosk PIN is `1234` |
| Lobby Display TV | `demos/lobby-tv/` | `index.html` switcher: **Control Dashboard** (`dashboard.html`) + the **TV** (`preview.html?mode=slides\|pictures\|livestream\|emergency`). Local sample content (`slides-sample.html`, `live-sample.html`) — no real YouTube. Note: the production TV renderer is a separate non-Apps-Script kiosk; `preview.html` is the project's own faithful reproduction of it |
| Custom Forms | `demos/custom-forms/` | `index.html` chooser → `admin.html` (staff builder + responses + admin) and `fill.html` (form runner). Reuses the project's own mock-backed preview build — no login, fabricated forms/submissions |
| Gym Display TV | `demos/gym-tv/` | `index.html` switcher: Control Dashboard + display (`display.html?mode=game\|idle\|emergency`). Auto-detects home games; game mode mirrors the live concession menu |
| Lunch Inventory | `demos/lunch-inventory/` | `index.html` switcher: Home / Count Kiosk / Shipment / Admin. Per-batch expiry tracking, reorder lists, pizza sell-through, usage charts |
| Directory Search | `demos/facts-directory/` | Instant client-side search over a fabricated 87-field SIS export — students/guardians/teachers/classes, each student's schedule ordered by the clock and with the in-session class highlighted, today's ABSENT / LATE / OUT badge, transportation (a recorded bus route vs an *assumed* car, split custody kept as two rows), siblings from Family ID, authorised pickup and emergency contacts, and a game-day dismissal parsed from a coach's own calendar wording. **Favourites**: star a few students and the home screen shows them with today's status. The two phone-heavy contact tabs load in a second call after first paint, so those sections read "Loading…" rather than a misleading "none on file". Append `?sim=YYYY-MM-DD HH:MM` to time-travel (try `?sim=2026-09-11 14:45` for the reverse-order Friday, where Period 1 meets at 2:37pm and the schedule runs 8&rarr;1). Rebuild with `node tools/build-demo.mjs demos/facts-directory/build.json`; `node demos/facts-directory/verify.mjs` re-checks the dataset against the real app logic |
| Account Provisioning | `demos/facts-provisioning/` | Bespoke console (the source tool is headless): FACTS SIS → Google Workspace account creation → Microsoft 365 licensing, with dry-run → create → sync, a pending-account queue, OU moves, and review flags. Fabricated data |
| Dismissal Board | `demos/transportation/` | The real dismissal board (Ramp / Class / Walk-Up / Explore) on a fabricated 87-student school: four lanes computed by the same rules as the nightly producer, ABSENT / LEFT EARLY / SIGNED OUT flags, route chips in the stick colours, today-only changes with an audit stamp, and the role-scoped settings gear. Pinned to a Tuesday so the Aberdeen lane shows its "no driver listed" gap; append `?sim=2026-09-18 15:00` for the Friday walk-up exceptions. Rebuild with `node tools/build-demo.mjs demos/transportation/build.json`; `node demos/transportation/verify.mjs` proves the roster equals the real producer's output and runs the dataset through the real Dismissal.gs |
| Campus Presence | `demos/campus-presence/` | `index.html` switcher over five surfaces of a **two-Apps-Script-project** system: the anonymous iPad kiosk (**Kiosk · HS** and **Kiosk · EL** are the same built page with `?station=hs\|el`, exactly as the two iPads are) plus the staff **Live Board**, **Muster** and **Metrics**. Both apps reach their server through a single `{op}` envelope, so `mock.js` is two dispatchers handing the fabricated rows in `data.js` to the app's **real** pure logic — `logic.js` is the source project's `logic/*.js` copied verbatim by `demos/campus-presence/build-logic.mjs`, so the off-campus list, the building counts, the KPI tiles and every pickup verdict are the app's own classification, not a hand-faked screenshot. Pinned to 2:52pm on the same Tuesday as the Dismissal Board demo and on the **same 87-student school** (shared ids, names, grades and guardians), with an event log from the first day of school generated by a seeded LCG so every build is byte-identical. Try the pitch: sign **Gaskill Wyatt** out at the EL kiosk as "Marcus Gaskill" — a flag appears on the Live Board where a sign-out would have been. Demo state lives in `sessionStorage` for the visit, so a kiosk sign-in shows up when you switch to the board; a refresh resets it. Rebuild with `node demos/campus-presence/build-logic.mjs` then `node tools/build-demo.mjs demos/campus-presence/build.{kiosk,board,muster,metrics}.json`; `node demos/campus-presence/verify.mjs` re-checks the dataset, the mock contract and the vendored logic bundle against the source project. Settings and Flags are deliberately not built — a config form is not a story, and an open flag already renders as an alert card on the board |

**Online vs. offline:** the site works from `file://`, but a few tools pull CDN assets (Bootstrap, Chart.js, Inter font) and the library covers from the network — those render fully only with an internet connection. Everything degrades gracefully offline.

## View it locally
Double-click `index.html`. Everything runs from `file://` — no build step, no server.

## Host it (shareable link for prospects)
It's a static site, so any static host works:
- **GitHub Pages** — push this folder to a repo, enable Pages on the root.
- **Netlify / Cloudflare Pages** — drag-and-drop the folder.
- Or serve locally: `npx serve` (then open the printed URL).

## How it works
Each Apps Script app funnels all its server calls through a single dispatcher (`processPost` /
`run` / `call` / `api`) and uses simple HTML template tokens. To run one standalone we:
1. Substitute the template tokens (`<?= csrfToken ?>`, `<?!= include('X') ?>`, …) with static values.
2. Load `assets/gsr-shim.js`, which installs a fake `google.script.run`. Every backend method
   call is routed to `window.MOCK_BACKEND[name](...)` and delivered to the app's success handler
   after a short fake latency — **the app's own JavaScript is never edited.**
3. Provide per-demo `data.js` (fabricated dataset) and `mock.js` (`window.MOCK_BACKEND`).

```
apps-script-showcase/
  index.html            landing gallery
  assets/               gsr-shim.js · gallery.css · demo-banner.{css,js}
  demos/<tool>/         index.html (standalone UI) · data.js · mock.js
```

## Privacy
No real person, email, phone, Google Sheet ID, or deployment URL appears anywhere in this
folder. Verify with a scrub grep from the repo root (should return nothing):

```bash
grep -rEn 'AKfycb|docs\.google\.com/spreadsheets|1[A-Za-z0-9_-]{30,}' demos assets index.html
```

The only intentional references to Harford Christian School are the **brand/display name** and
the **public contact address `joshmay@harfordchristian.org`** on the landing page and inside the
apps — the client name (social proof) and a contact, not private data.
Swap it for a fictional org if you'd rather keep the client anonymous.

## Adding a demo
1. Copy the real app's HTML into `demos/<tool>/index.html`; replace GAS template tokens.
2. Add the shim + data + mock includes in `<head>` (see any existing demo).
3. Write `data.js` (fabricated) and `mock.js` (`window.MOCK_BACKEND` returning the shapes the
   UI expects).
4. Flip the tool's card on `index.html` from "Coming soon" to a Live demo link.
