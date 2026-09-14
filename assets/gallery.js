/* gallery.js — hover summaries + "learn more" problem/solution modals for the showcase.
   Each card carries data-tool; TOOLS[tool] supplies the hover summary and the modal story
   (the problem/limitation before, and how the system resolved it). */
(function () {
  'use strict';

  var TOOLS = {
    'library': {
      icon: '📚', title: 'Library Catalog', launch: 'demos/library/index.html',
      summary: 'The library\'s first digital catalog — it replaced handwritten cards tucked inside each book cover. Search-as-you-type, browse by reading level, staff picks, self-checkout, and student/parent dashboards.',
      body:
        '<h4>The problem</h4>' +
        '<p>The library had no digital system at all. Every book was tracked by a handwritten notecard tucked into a pocket inside the front cover — checking a book out meant pulling that card and filing it by hand. There was no catalog to search, no way to see what was on the shelf without walking the aisles, and nothing a parent could check from home.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A colorful, phone-friendly catalog that finds books the instant you type, browses by genre and reading level, and surfaces librarian &ldquo;staff picks.&rdquo; Students self-check-out by scanning, and student &amp; parent dashboards show current books, due dates, and reading history. It runs on a Google Sheet — no catalog software to license or maintain.</p>'
    },

    'campus-control': {
      icon: '🛡️', title: 'Campus Control — Automation Suite', launch: 'demos/campus-control/index.html',
      summary: 'An integrated campus-automation suite — schedule-driven door control, event & facility approvals, and emergency lockdown — all reading from one master schedule.',
      body:
        '<p>Campus Control is a tightly integrated suite. A single <b>master schedule</b> resolves each day&rsquo;s type — normal, delay, summer, church, event — and the door, paging/bell, and lockdown systems all read from it, so one change flows everywhere automatically.</p>' +
        '<h4>🚪 Door Automation</h4>' +
        '<p><b>Before:</b> our Ubiquiti (UniFi) access doors and smart relays were solid hardware, but they lacked advanced unlock scheduling. Staff locked and unlocked doors on manual rounds, one-off events meant remembering to override by hand, and there was no single view of what was open — or proof a door actually locked.</p>' +
        '<p><b>Now:</b> every door locks and unlocks automatically on the bell schedule and <b>auto-adjusts for weather</b> (2-hour delays), calendar events, athletics, and church days. One-tap event overrides, the live &ldquo;who&rsquo;s open now&rdquo; <b>Eagle Eye</b> leadership board, and an operations dashboard with success/failure analytics and auto-remediation — all layered on the existing hardware.</p>' +
        '<h4>📋 Event Requests &amp; Approvals</h4>' +
        '<p><b>Before:</b> facility-use and event requests came in by email and paper. They got lost in inboxes, the right approvers weren&rsquo;t always looped in, and event door-unlocks had to be re-typed into the door system by hand.</p>' +
        '<p><b>Now:</b> one portal figures out which approval groups are required (AV, facilities, security, business office), routes to them with a live progress bar and notifications, and — once approved — feeds the unlock times straight into Door Automation. No chains, no double entry.</p>' +
        '<h4>🔒 Emergency Lockdown</h4>' +
        '<p><b>Before:</b> starting a lockdown meant finding an administrator, making a PA announcement, and hoping every exterior door got locked in time — with no fast way to log the incident or alert the right people.</p>' +
        '<p><b>Now:</b> any authorized staffer hits one big button from their phone. Exterior doors lock instantly via the relays, leadership is alerted, and the app captures incident details for the record. A maintenance mode lets facilities test specific doors without triggering a real alert.</p>' +
        '<h4>🔔 Bell Scheduler &amp; 📟 Monitoring</h4>' +
        '<p>The suite also includes a <b>bell schedule hub</b> — one calendar that resolves which bell pattern rings each day (normal, delay, chapel, exam week) so paging, doors, and the lobby TV all inherit it — and a <b>campus monitoring board</b> showing live freezer/fridge temperatures, water-leak sensors, and device status, flagging problems within minutes instead of after they fail.</p>'
    },

    'athletics': {
      icon: '🦅', title: 'Athletics Logistics', launch: 'demos/talon-hub/index.html',
      summary: 'Rosters, compliance flags, and travel manifests for every team — coaches see who is missing and who rides the bus; parents manage return-trip pickups.',
      body:
        '<h4>The problem</h4>' +
        '<p>Game-day logistics ran on group texts, paper rosters, and clipboard checklists. Coaches had no reliable list of who was traveling, who was on the bus versus getting picked up, or whose forms (physical, concussion, handbook) were missing. Pickup and guardianship changes arrived ad hoc, often at the last minute.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A shared hub where coaches manage rosters and compliance flags and see a live <b>travel manifest</b> — outbound and return legs, who is on the bus, who is self-transport, and guardian-authorized pickups (with override alerts for non-primary guardians). Parents mark players out and control the return-trip pickup. Zero-cost, built on one Google Sheet.</p>'
    },

    'purchasing': {
      icon: '🧾', title: 'Purchasing & Procurement', launch: 'demos/purchasing/index.html',
      summary: 'A catalog-based purchase-request portal with role-based approval routing, automatic PO generation, and spend analytics.',
      body:
        '<h4>The problem</h4>' +
        '<p>Purchase requests were paper POs and email. Staff didn&rsquo;t know what to order or from which vendor, approvals stalled with no clear chain, purchase orders were typed by hand, and there was no easy way to see spend by department, vendor, or category.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>Staff order from a catalog; requests route through pricing and a PIN-signed approval step; POs generate automatically; and administrators get spending, processing-time, and trend analytics. The whole workflow lives in Google Workspace — no procurement SaaS or per-seat fees.</p>'
    },

    'leave-sub': {
      icon: '📆', title: 'Leave & Substitute Tracker', launch: 'demos/leave-sub/index.html',
      summary: 'Staff absence tracking with substitute coverage, a coverage heatmap, personal balances, and forecasting for administrators.',
      body:
        '<h4>The problem</h4>' +
        '<p>Leave slips were paper, substitute coverage was arranged by phone tree, and administrators had no forward view of coverage gaps or how leave was trending. Staff couldn&rsquo;t easily see their own balances or history.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>Staff see their leave history and balances at a glance, while administrators get a <b>coverage heatmap</b>, forecast, and school-wide summaries to spot thin days before they arrive. Substitute assignments and their impact are tracked automatically — no phone tree required.</p>'
    },

    'concessions': {
      icon: '🍿', title: 'Concessions Ordering System', launch: 'demos/pos/index.html',
      summary: 'One ordering system, three synced screens — an order kiosk, a live TV menu board, and a kitchen display — driven by a single Google Sheet.',
      body:
        '<h4>The problem</h4>' +
        '<p>The concession stand ran on a cash box and handwritten orders. Lines were slow, the kitchen worked off scribbled tickets, customers couldn&rsquo;t see prices or what was sold out, and there was no sales record at the end of the night.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>Three screens on inexpensive tablets and TVs: a touch <b>kiosk</b> takes orders (with combos, flavors, and half-off specials), a <b>TV menu board</b> shows live availability and deals, and a <b>kitchen display</b> queues tickets with prep timers — all synced through one Google Sheet that also logs every sale. No POS hardware or per-transaction fees.</p>'
    },

    'lobby-tv': {
      icon: '📺', title: 'Lobby Display TV', launch: 'demos/lobby-tv/index.html',
      summary: 'A front-desk lobby TV that rotates announcement slides, photo carousels, and live game streams — driven by a one-click control dashboard, with a companion kiosk that renders the screen.',
      body:
        '<h4>The problem</h4>' +
        '<p>The lobby TV showed a single static image, and changing it meant someone walking over with a laptop to plug in. There was no easy way to post an announcement, react to a snow delay, put up game-day photos, or show a live stream — so it often sat on the same slide for weeks.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A control dashboard any staffer opens from a phone or desktop pushes content to the TV in about 20 seconds — rotate a Google Slides / PowerPoint deck, run a photo carousel from a Drive folder, drop in a single image, or switch to a live game stream. Around the content it overlays the bell-schedule countdown, upcoming athletics events, weather, and a scrolling ticker, plus full-screen emergency alerts and an automatic overnight &ldquo;resting&rdquo; mode. A lightweight kiosk polls a small control file, so the screen updates without anyone touching the TV.</p>' +
        '<p><b>Where content comes from:</b> slides from Google Slides or an auto-converted PowerPoint in Drive, photos from a Drive folder or a quick upload, and the livestream from the school&rsquo;s YouTube channel.</p>'
    },

    'custom-forms': {
      icon: '📝', title: 'Custom Forms', launch: 'demos/custom-forms/index.html',
      summary: 'A school-owned form builder that replaces JotForm — staff design forms (18+ field types, conditional logic, e-signatures, approvals); parents verify by email and forms auto-fill their own children from the student directory.',
      body:
        '<h4>The problem</h4>' +
        '<p>Forms ran on JotForm — a paid third-party service where every parent and student&rsquo;s information lived on a vendor&rsquo;s servers, with per-form limits and no connection to the school&rsquo;s student directory. Parents hand-typed which child a permission slip was for (and sometimes picked a sibling or the wrong student), branding was inconsistent, and identity wasn&rsquo;t really verified.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A form builder that lives entirely inside the school&rsquo;s own Google Workspace. Staff design forms in one branded builder with 18+ field types, conditional logic, calculations, file uploads, e-signatures, and approval routing. Parents verify with a one-time code sent to the email the school already has on file, then the form <b>auto-fills their name and their own children</b> from the student directory — so the right student is always attached.</p>' +
        '<p>Every form, response, and uploaded file stays on school-owned Drive and Sheets, and it costs nothing per form or per response.</p>'
    },

    'gym-tv': {
      icon: '🏀', title: 'Gym Display TV', launch: 'demos/gym-tv/index.html',
      summary: 'An unattended gym TV that auto-detects home games from the athletics calendar — showing the live concession menu (stock + half-off specials) on game nights and a rotating photo/announcement carousel otherwise, all set from a control dashboard.',
      body:
        '<h4>The problem</h4>' +
        '<p>The gym’s second display had to be switched on and loaded by hand off a shared PC — someone had to remember, and there was no live view of what concessions were still in stock, so fans crowded the stand asking and staff juggled an extra screen on game night.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A gym TV that runs itself. It flips to game mode automatically from the athletics calendar and mirrors the concession stand’s live inventory in real time — &ldquo;Only 3 left,&rdquo; &ldquo;Sold out,&rdquo; half-off specials, a cooking countdown — next to team photos. The rest of the time it’s an idle board: photo carousel, upcoming games, weather, and a ticker. A simple dashboard sets manual overrides, messages, and a full-screen emergency alert.</p>' +
        '<p>Same pattern as the lobby display, running on a ~$35 Raspberry Pi in kiosk mode — no touch on game night.</p>'
    },

    'lunch-inventory': {
      icon: '🍎', title: 'Lunch Inventory', launch: 'demos/lunch-inventory/index.html',
      summary: 'A four-screen lunch-program system: a touch count kiosk, a shipment-intake screen with per-batch expiry tracking, and an admin dashboard with reorder lists, expiry alerts, pizza sell-through, and usage-trend charts.',
      body:
        '<h4>The problem</h4>' +
        '<p>Lunch inventory lived on paper and manual spreadsheet counts — no expiry tracking per delivery batch, no automatic reorder flagging when stock ran low, and no view of how fast items sold or how much hot pizza got thrown away. Staff eyeballed the shelf and guessed reorder amounts.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A shared, phone-friendly system on top of the same Google Sheet. Staff do shelf counts on a touch <b>kiosk</b>, log incoming <b>shipments</b> with per-box expiry dates, and the <b>admin dashboard</b> surfaces FIFO expiry warnings, at-a-glance low-stock reorder lists, hot-pizza sell-through, shipment history, and usage-trend charts — right-sizing orders and cutting waste.</p>'
    },

    'facts-directory': {
      icon: '🔎', title: 'Directory Search', launch: 'demos/facts-directory/index.html',
      summary: 'An instant staff lookup over the nightly SIS export: students, guardians, teachers, classes and rosters — searchable by name, parent email, subject or grade. Each student\'s record shows period, room, today\'s real bell times, the class they are in right now, an absent/late badge refreshed every 15 minutes, emergency contacts, and their teams and clubs.',
      body:
        '<h4>The problem</h4>' +
        '<p>Every small question — a parent\'s email, which homeroom a student is in, who teaches 7th-grade band, where a student is at 10:30 — meant logging into the student information system and clicking through several screens. Most staff don\'t have accounts for it, so the questions landed on the office instead, and answering "where is this student right now" meant reading a paper schedule against a bell chart.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>One search box over the nightly export. The whole searchable dataset is handed to the browser on load, so results appear <b>as you type</b> — no waiting between keystrokes — and typo-tolerant matching finds <i>Jonathan</i> when you typed <i>Johnathon</i>. Search a <b>subject</b> ("band", "7th grade band") and the class comes back with its instructor first, then the full roster; tap any student, teacher or class to walk straight into the next record.</p>' +
        '<p>Each student\'s schedule shows <b>period · room · today\'s clock time</b> and <b>bolds the class in session right now</b>. Times come from the school\'s period grid joined to the live bell schedule, so delays and exam days shift correctly — and the school\'s reverse-order Friday (a first-period class meeting at 2:37pm) resolves on its own because the join is keyed on the time <i>slot</i>, not the period number. Add <code>?sim=2026-09-11 14:45</code> to the URL to time-travel and watch it.</p>' +
        '<p>The record answers the rest of the "where is this child and who do I call" question in one place: an <b>Absent / Late / Left-early badge</b> pulled from attendance every 15 minutes — shown on the search result itself, so it\'s visible before you even open the record — plus the <b>emergency call list</b>, and <b>teams and clubs</b> kept separate from the timed schedule. Every block collapses, and remembers whether you left it open.</p>' +
        '<p>Read-only by design, gated to staff accounts in one org unit, and it never writes to the source data. Where the source system is genuinely ambiguous — two semester classes sharing one period — it says so rather than guessing.</p>'
    },

    'facts-provisioning': {
      icon: '🔑', title: 'Account Provisioning (FACTS → Google → Microsoft 365)', launch: 'demos/facts-provisioning/index.html',
      summary: 'Automated student/staff account provisioning: new enrollments flow from the FACTS SIS into auto-created Google Workspace accounts (email, org-unit, password), which then drive Microsoft 365 license assignment. Headless in production; shown here as a console.',
      body:
        '<h4>The problem</h4>' +
        '<p>Every new enrollment meant IT hand-creating that student\'s Google Workspace account from a FACTS export — inventing a username, picking an org-unit, setting a password — then repeating for withdrawals and the annual graduation shuffle. It was slow, error-prone, and inconsistent org-units broke downstream Microsoft 365 license assignment.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A nightly automation reads the FACTS SIS export and manages the whole account lifecycle — <b>create → update → move OU → suspend/graduate</b> — with strict email/OU conventions and unique per-student passwords, guarded by a dry-run and a staged rollout so no existing account is ever disrupted. The correct org-units then drive <b>Microsoft 365 licensing automatically</b> (Students → A1, Staff → A3).</p>' +
        '<p>The real tool runs headless (nightly, reporting to Sheets + email). This console is a representative view of what one run surfaces — the pending-account queue, OU moves, review flags, and the Google→M365 sync.</p>'
    },

    'staff-onboarding': {
      icon: '🎓', title: 'Staff Onboarding', launch: 'demos/staff-onboarding/index.html',
      summary: 'New staff automatically get an onboarding email linking to a role-picker page — each role sees its own setup instructions, maintained by a non-technical owner in Google Docs. Includes a first-run admin wizard (⚙ Settings in the demo).',
      body:
        '<h4>The problem</h4>' +
        '<p>Every new hire got a hand-written instruction email — a different one per role. Fulltime staff and teachers needed SIS-access steps, coaches needed the athletics hub, bus drivers needed neither, and everyone needed the current Staff Handbook. One person composed each of these from memory, for every single hire, and the content lived nowhere but her sent folder.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>The moment a new staff Google account is created (by the provisioning automation or by hand), a scanner emails the new inbox a single link. The hire picks their role — <b>Fulltime Staff, Fulltime Teacher, Sub/Part-time Teacher, Coach, or Support Staff</b> — and sees exactly the steps for them, plus a for-everyone section. The content is plain Google Docs the owner edits herself; changes are live on the next page load. An in-app <b>⚙ Settings</b> panel (try it in the demo) lets her rename/reorder/add roles, rewrite the page text, and one-click mark all existing staff as already onboarded so they\'re never emailed.</p>' +
        '<p>Idempotent by design: each account is stamped when emailed, the scanner is gated by a start date and a circuit breaker, and the sender never touches anyone created before rollout.</p>'
    },

    'transportation': {
      icon: '🚌', title: 'Dismissal Board', launch: 'demos/transportation/index.html',
      summary: 'A staff-only dismissal board: who is in each bus, van and car lane this afternoon, and who should NOT be waited for because they are absent, left early or were signed out at lunch. Built nightly from the SIS, refreshed from attendance every 15 minutes, with route colours matching the sticks children carry and today-only changes that record who made them.',
      body:
        '<h4>The problem</h4>' +
        '<p>At 3:10pm the answer to &ldquo;who should be in this line?&rdquo; was split across three places nobody could cross-reference from the ramp: the student information system held the bus routes, attendance lived on a different screen, and mid-day pickups were a note on the office desk. A child collected at 1:04pm still got waited for. A child who rode a different route home on alternate weeks was on one driver\'s list and missing from the other\'s. Route and driver changes reached staff by word of mouth.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A nightly job sorts every enrolled student into one of four lanes &mdash; <b>Bus</b> (from the route enrolments the transportation director already maintains), <b>Staff Kid</b> (a guardian is active staff, so the child walks to the parent\'s building), <b>Early Bird</b> (a family rule: every sibling in grades 1&ndash;3, released before the buses so parents clear the lot) and <b>Car</b>, which is marked as <i>assumed</i> rather than recorded so nobody mistakes a default for data. The board then cross-checks each child against attendance every 15 minutes and against the sign-in/out kiosk, and flags <b>ABSENT</b>, <b>LEFT EARLY</b> and <b>SIGNED OUT</b> inline &mdash; the child stays findable, but nobody waits for them. An unknown always reads as <i>expected</i>: the app will never invent an absence.</p>' +
        '<p><b>The route is its colour.</b> Each bus shows a coloured sheet in its window and every child is handed a matching stick, so the board renders the route as a chip filled with that colour and the card says &ldquo;hand them the purple stick.&rdquo; Each lane header names today\'s driver and phone &mdash; and says <b>no driver listed</b> when the driver sheet has a gap (the Aberdeen/Havre de Grace lane in Explore, on the demo\'s Tuesday). A split-custody child shows both routes so either driver has them.</p>' +
        '<p>Four views for four jobs. <b>Ramp</b> is one flat alphabetical list, because a child arrives in front of you by name, not by lane. <b>Class</b> narrows to a teacher\'s own homeroom, then their grade, then the school. <b>Walk-Up</b> is the approved list of staff children walked to the high school, with the reason anyone is not walking today. <b>Explore</b> groups by lane. Tap a name for who is authorised to collect them, their siblings, and a <b>Change for today</b> that expires overnight and stamps who changed it and when. Add <code>?sim=2026-09-18 15:00</code> to the URL to see the Friday specials exceptions on the walk-up list.</p>' +
        '<p>Read is broad and write is narrow: any staff member can look anyone up, but changing a dismissal is scoped by role (office, ramp, walk-up, a teacher for their own class), roles are administered per role from the &#9881; gear &mdash; type a name and the staff directory supplies the address, and every homeroom teacher holds the Teacher role automatically from the roster &mdash; and a shared team view means a stand-in opens the ramp lead\'s exact board. Read-only against every source &mdash; the only thing it writes is today\'s changes, to its own sheet.</p>'
    },

    'transpo-routes': {
      icon: '🚍', title: 'Driver Routes', launch: 'demos/transpo-routes/index.html',
      summary: 'The route sheet a bus driver or substitute opens on their own phone &mdash; no school email, no Google account, just a link and a short PIN. Their route in stop order, who not to wait for, the bus number and stick colour, and a tick list as children board. The transportation office gets the other half: who is actually using it, an activity log, PIN resets and the stop editor.',
      body:
        '<h4>The problem</h4>' +
        '<p>Bus drivers are the one group on a school campus with no email address and no account to sign into, so every system built for staff simply excluded them. What a driver got was a printed transportation list sorted by student surname &mdash; perfect for the office, close to useless at 3:15 in a bus. A <b>substitute</b> got that same sheet for a route they had never driven, and the actual stop order existed nowhere: not in the student information system, not on the sheet, only in the regular driver\'s head.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>A driver opens a link on their own phone and types a PIN. The link says <i>which phone</i> and the PIN says <i>which person</i>, and both are re-checked on the server for every single request &mdash; a link on its own reaches a dead end, and five wrong PINs lock that handset for fifteen minutes. Nothing is installed and no account is created; it goes on the home screen like any other app.</p>' +
        '<p><b>The rider list was already right &mdash; it just pointed the wrong way.</b> Who rides which route is already maintained in the SIS by the transportation director, so no new data entry was invented: the app reads the same slice the dismissal board publishes every minute, which means it arrives already cross-checked against attendance, mid-day sign-outs and today&rsquo;s office changes. The driver sees <b>who not to wait for</b>, with the reason, before pulling out of the lot. What was genuinely missing was the <b>stops</b>, so those are the one thing the office types in once &mdash; and until a route has them the sheet says so plainly, rather than quietly showing a flat list as though it were an order.</p>' +
        '<p><b>A personal phone is a wider blast radius than an iPad bolted to a wall</b>, so the driver surface carries a name, a grade and a stop, and nothing else &mdash; no phone numbers, no contacts, no student id. That is not a policy note: the code builds each rider by naming those fields one at a time, and a test that has been proven to fail blocks any build where a record is passed through wholesale. The check-off uses a key that is meaningless outside the day it was issued.</p>' +
        '<p><b>Some drivers will use it and some never will</b>, and the office view is built for that rather than against it. A route nobody has ticked reads <b>&ldquo;Not checked &mdash; no record either way&rdquo;</b>, never &ldquo;0 boarded&rdquo;: identical numbers, opposite conclusions, and conflating them would be worse than having no screen at all. The office sees who is genuinely getting value &mdash; last opened, how many distinct days they have used the tick list, who is locked out &mdash; and can reset a PIN, issue a replacement link or revoke a lost phone without waiting for IT.</p>' +
        '<p>Two Apps Script projects, not one: the driver app is anonymous and the office console is staff-only, deployed separately because anything sharing a project with them is reachable from a browser whatever the page chooses to show. Read-only against every source &mdash; the only thing it writes anywhere is the tick list, to its own sheet.</p>'
    },

    'campus-presence': {
      icon: '🪪', title: 'Campus Presence', launch: 'demos/campus-presence/index.html',
      summary: 'Sign-in and sign-out on two iPad kiosks at the visitor entrances, and the live answer to &ldquo;who is on campus right now?&rdquo; Visitors badge themselves in, students sign in late or out early, and a hard authorised-pickup check turns a stranger&rsquo;s attempt into an office flag rather than a sign-out. Presence is never stored &mdash; it is derived from an append-only event log, which is the one input the lockdown system never had.',
      body:
        '<h4>The problem</h4>' +
        '<p>Two entrances, two clipboards. A visitor wrote a name and a time on a paper sheet &mdash; when they remembered to. A parent collecting a child at lunchtime meant a phone call to a classroom, a note left on the desk, and somebody&rsquo;s memory. So the log recorded who had bothered to sign it, not who was in the building: at 10:40 on a Tuesday nobody could answer <i>who is on campus right now</i> without walking the corridors, and a fire drill was counted against a roster printed that morning.</p>' +
        '<p>Worse, nothing actually <i>checked</i> the adult at the window. The list of people authorised to collect each child lived in the student information system, three clicks and a login away, so under time pressure the answer was a face somebody recognised. And when the lockdown system fired, it locked doors around a population it could not name.</p>' +
        '<h4>How it helps now</h4>' +
        '<p>Two iPads run four flows, each built to finish in under twenty seconds &mdash; faster than the clipboard it replaced, which is the only reason anybody uses it. A <b>visitor</b> types their name, taps a reason and a destination building, and keys in the number on a reusable lanyard badge; signing out is that number and one confirmation, with a &ldquo;lost my badge?&rdquo; escape hatch listing today&rsquo;s open visits by name. A <b>student arriving late</b> is found by fuzzy search on three letters &mdash; below 6th grade an adult must sign them in, and that rule is enforced on the server, not merely hidden in the interface. Grades 7&ndash;12 on the approved <b>Work Release</b> list sign themselves out, and their guardians are emailed automatically.</p>' +
        '<p><b>The hard check, and what happens when it fails.</b> The kiosk never displays the authorised-pickup list, because showing it would hand a stranger the answer. Instead the adult types their <i>own</i> first and last name, and the server replies match or no match &mdash; nothing else. Typos and shortenings are forgiven (&ldquo;Chris&rdquo; finds Christopher, a transposed letter still matches, a hyphenated or suffixed surname matches either half), but a near-miss who knows only the surname does not. A failure is <b>not</b> a refusal and <b>not</b> a sign-out: it writes a pickup flag, chimes the desk beside the kiosk, and shows the parent a calm &ldquo;please see office staff.&rdquo; The child stays counted present. Staff then approve or deny the flag on the board, and approving is what records the dismissal &mdash; as an office override linked back to the flag, so the trail says a human decided. Try it in the demo: sign <b>Gaskill Wyatt</b> out as &ldquo;Marcus Gaskill&rdquo; and watch a flag appear on the Live Board where a sign-out would have been.</p>' +
        '<p><b>Presence is derived, never stored.</b> There is no status column anywhere: the board folds today&rsquo;s append-only event log every twelve seconds into visitors on campus, students signed out, late arrivals and anyone mid-move between buildings, counted per building. Everyone else is stated as <i>assumed present in their homeroom building</i> &mdash; the legend says so out loud, because a system that quietly invents an absence is worse than no system at all. Half-typed notes survive each re-render, a dropped connection raises a red banner and keeps rendering the last good snapshot, and the alert chime is scoped per desk so an elementary sign-out never interrupts the high-school office.</p>' +
        '<p>The same fold prints. <b>Muster</b> is a point-in-time evacuation document: per-building counts, every exception named, unreturned visitor badges, and unresolved flags stated as &ldquo;these are NOT sign-outs &mdash; these children are counted present,&rdquo; plus a full roster you can narrow by building, grade and name before printing it black-on-white for the clipboard at the assembly point. <b>Metrics</b> folds the whole year for leadership: late arrivals and early dismissals by day, reason, hour, grade, building and kiosk, with any bar clickable to filter the event log beneath it &mdash; and pickup mismatches counted on their own red tile, a safety signal that is never allowed to inflate a dismissal number.</p>' +
        '<p>The security posture is the design. The kiosk is a <b>separate Apps Script project holding no staff code at all</b>, because an anonymous web app&rsquo;s server bridge can reach any function in its own project; it is authorised only by a per-device key in its URL, re-checked on every single call. Its endpoints return the least that can possibly work &mdash; a search result is an id, a name and a grade; a pickup answer is true or false &mdash; and no guardian, email, homeroom or contact ever crosses to the anonymous side. The staff app is domain-only behind its own fail-closed permissions list, re-checked on every call rather than trusted from the rendered page. And because presence is a derivation of one event log, the emergency-lockdown screens can read the campus population from a single cell, degrading to &ldquo;unavailable&rdquo; rather than erroring if it is ever taken away.</p>'
    }
  };

  function ready(fn) { document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {
    // ---- Hover/focus tooltip (summary) ----
    var tip = document.createElement('div');
    tip.className = 'sc-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    document.body.appendChild(tip);

    function showTip(el) {
      var t = TOOLS[el.getAttribute('data-tool')];
      if (!t) return;
      tip.innerHTML = '<span class="sc-tip-text">' + t.summary + '</span><span class="sc-tip-more">Click to learn more →</span>';
      tip.hidden = false;
      var r = el.getBoundingClientRect();
      var top = r.bottom + 10, left = Math.min(r.left, window.innerWidth - tip.offsetWidth - 16);
      if (top + tip.offsetHeight > window.innerHeight - 8) top = r.top - tip.offsetHeight - 10;
      tip.style.top = Math.max(8, top) + 'px';
      tip.style.left = Math.max(8, left) + 'px';
    }
    function hideTip() { tip.hidden = true; }

    // ---- Modal (problem / solution) ----
    var modal = document.getElementById('sc-modal');
    var mIcon = modal.querySelector('.sc-modal-icon');
    var mTitle = modal.querySelector('.sc-modal-title');
    var mBody = modal.querySelector('.sc-modal-body');
    var mLaunch = modal.querySelector('.sc-modal-launch');
    var lastFocus = null;

    function openModal(tool) {
      var t = TOOLS[tool]; if (!t) return;
      lastFocus = document.activeElement;
      mIcon.textContent = t.icon; mTitle.textContent = t.title;
      mBody.innerHTML = t.body; mLaunch.setAttribute('href', t.launch);
      modal.hidden = false; document.body.style.overflow = 'hidden';
      hideTip(); modal.querySelector('.sc-modal-close').focus();
    }
    function closeModal() {
      modal.hidden = true; document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector('.sc-modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

    // ---- Wire cards ----
    document.querySelectorAll('.info, .learn').forEach(function (el) {
      var tool = el.getAttribute('data-tool');
      if (el.classList.contains('info')) {
        el.addEventListener('mouseenter', function () { showTip(el); });
        el.addEventListener('mouseleave', hideTip);
        el.addEventListener('focus', function () { showTip(el); });
        el.addEventListener('blur', hideTip);
      }
      el.addEventListener('click', function (e) { e.preventDefault(); openModal(tool); });
    });
  });
})();
