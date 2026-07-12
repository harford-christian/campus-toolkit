# Campus Operations Toolkit — Showcase

An interactive, sales-ready portfolio of the Google Apps Script tools built for Harford
Christian School. Each demo is the **real app UI** running standalone in the browser on
**fabricated sample data** — no Google backend, no login, and no real records.

## Demos included (all 8 live)
| Tool | Folder | Notes |
|------|--------|-------|
| Library Catalog | `demos/library/` | Real cover art on the featured books (loaded from OpenLibrary; falls back to placeholder covers offline) |
| Campus Control (suite) | `demos/campus-control/` | Unified switcher (`index.html`) that frames three campus-control tools in one system: **Door Automation** (`demos/door/` — tabs + `dashboard.html` + `leadership.html`), **Event Requests** (`demos/event-requests/`), and **Emergency Lockdown** (`demos/lockdown/`) |
| Athletics Logistics (Talon Hub) | `demos/talon-hub/` | Rosters, travel manifests, check-offs — fully fabricated athletes/guardians |
| Purchasing & Procurement | `demos/purchasing/` | New Order, Order History, Management queue, and all 3 Analytics tabs are live. Secondary management sub-tabs (Products/Vendors/Users/Departments/Saved Views/Team Orders) and write-actions render empty by design — not wired for the demo |
| Leave & Substitute | `demos/leave-sub/` | Read-only analytics: personal, forecast, heatmap, subs, summary |
| Concessions Ordering System | `demos/pos/` | `index.html` is a unified switcher framing the three screens — `kiosk.html` (order kiosk) + `tv.html` (menu board) + `kds.html` (kitchen display). Kiosk PIN is `1234` |
| Lobby Display TV | `demos/lobby-tv/` | `index.html` switcher: **Control Dashboard** (`dashboard.html`) + the **TV** (`preview.html?mode=slides\|pictures\|livestream\|emergency`). Local sample content (`slides-sample.html`, `live-sample.html`) — no real YouTube. Note: the production TV renderer is a separate non-Apps-Script kiosk; `preview.html` is the project's own faithful reproduction of it |
| Custom Forms | `demos/custom-forms/` | `index.html` chooser → `admin.html` (staff builder + responses + admin) and `fill.html` (form runner). Reuses the project's own mock-backed preview build — no login, fabricated forms/submissions |
| Gym Display TV | `demos/gym-tv/` | `index.html` switcher: Control Dashboard + display (`display.html?mode=game\|idle\|emergency`). Auto-detects home games; game mode mirrors the live concession menu |
| Lunch Inventory | `demos/lunch-inventory/` | `index.html` switcher: Home / Count Kiosk / Shipment / Admin. Per-batch expiry tracking, reorder lists, pizza sell-through, usage charts |

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
