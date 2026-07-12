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
        '<p><b>Now:</b> any authorized staffer hits one big button from their phone. Exterior doors lock instantly via the relays, leadership is alerted, and the app captures incident details for the record. A maintenance mode lets facilities test specific doors without triggering a real alert.</p>'
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
