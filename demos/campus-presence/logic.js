/* logic.js — the sign-in/out system's OWN pure logic modules, copied VERBATIM from the source
   project's logic/ folder: the single tested source of truth that both Apps Script projects
   ship into their own server/lib copies. Nothing here is a demo reimplementation. mock.js hands the
   fabricated rows in data.js to these exact functions, so what you see on the board, the muster
   and the metrics page is the real classification — the same fold the production server performs.

   Each file is an IIFE whose CommonJS export is guarded by `typeof module !== 'undefined'`, so
   in a browser they install themselves as globals (SCHEMA, Ids, Fuzzy, NameRules, Directory,
   Events, Badges, Pickup, Presence, Search, Metrics, Notify) and resolve each other through
   those globals — exactly as they do inside Apps Script.

   One scrub is applied: the real FACTS-Finder /exec deployment URL that schema.js carries as a
   SETTINGS default is blanked, because no deployment URL belongs in a public repo. Blank is the
   app's own "no deep links" setting, and data.js sets the same value on the SETTINGS tab.

   GENERATED — do not hand-edit. Rebuild with:
     node demos/campus-presence/build-logic.mjs
   demos/campus-presence/verify.mjs fails if this bundle drifts from the source modules.
*/

/* ===================== logic/schema.js ===================== */
'use strict';
/**
 * schema.js — THE single load-bearing definition of the SignInOut_DB data model.
 *
 * Consumers, all reading these constants (the anti-drift mechanism):
 *   1. SheetGateway bootstrapSheets_() creates tabs/headers from cols[].name order
 *   2. SheetGateway reads build their column-index maps from it
 *   3. kiosk/office serializers project columns from cols[].tier
 *   4. tools/wrap.js regenerates the tab tables in docs/SCHEMA.md for human review
 *
 * Tiers (who a column may be serialized to):
 *   KIOSK  — the anonymous kiosk client. Minimum possible surface: the kiosk
 *            renders its own submissions and search picks, nothing historical.
 *   OFFICE — DOMAIN office staff (board / flags / muster / settings).
 *   SYSTEM — never serialized to ANY client; visible only in the raw sheet.
 *
 * Columns are APPEND-ONLY once live (FACTS-export discipline): never insert,
 * never reorder; retired columns keep their slot with a comment.
 */

var TIER = { KIOSK: 0, OFFICE: 1, SYSTEM: 2 };

// Taken from campus-control monitoring (Monitor.js MONITOR_BUILDINGS +
// Dashboard.html BUILDING_ORDER) so presence reads consistently with the
// Monitoring board and the lockdown surfaces — with one deliberate difference:
// 'Bus Barn' was never somewhere a student walks to during the day, so Josh
// swapped it for 'Nurse' (2026-09-09), which is a real destination on the
// between-buildings screen. This list drives the kiosk destination pills, the
// board/muster count strips, and the presence fold's buckets.
var BUILDINGS = ['High School', 'Elementary', 'Kindergarten', '6th Grade', 'Modular', 'Nurse', 'Other'];

// Grade token (as it appears in FACTS 'Grade Level': K4, K5, 1..12 unpadded) → PHYSICAL building
// (what matters for presence/muster/lockdown). Corrected per Josh at CP0 (2026-08-04);
// office-editable each fall via Settings 'building.grade.map' (the Settings value wins at runtime).
var DEFAULT_GRADE_BUILDING_MAP = {
  // Corrected 2026-09-05 (Josh): 1st grade is in the ELEMENTARY building, not KG.
  'K4': 'Kindergarten', 'K5': 'Kindergarten',   // Pre-K + Kindergarten
  '1': 'Elementary', '2': 'Elementary', '3': 'Elementary', '4': 'Elementary',
  '5': 'Kindergarten',  // 5th meets in the KG building (dismissal handled by the EL desk)
  '6': '6th Grade',     // physically a modular unit; campus-control's enum names this bucket '6th Grade' (the 'Modular'/MOD bucket is a different structure)
  '7': 'High School', '8': 'High School', '9': 'High School',
  '10': 'High School', '11': 'High School', '12': 'High School'
};

// Grade token → CONTROLLING front desk (which office coordinates the dismissal call — a parent
// may sign out ALL their kids at either kiosk; the desks phone the buildings). Distinct from the
// physical map above: 5th is KG-building/EL-desk, 6th is modular/HS-desk.
// 2026-09-16: K4, K5 and 5 move to their OWN desk ('kg') now the Kindergarten building is staffed.
// Grades 1-4 stay with the Elementary desk. THIS DEFAULT ONLY APPLIES TO A FRESH BOOTSTRAP — the
// live Settings value 'desk.grade.map' wins at runtime, so the change takes effect when it is
// updated in Settings → Advanced.
var DEFAULT_DESK_GRADE_MAP = {
  'K4': 'kg', 'K5': 'kg', '1': 'el', '2': 'el', '3': 'el', '4': 'el', '5': 'kg',
  '6': 'hs', '7': 'hs', '8': 'hs', '9': 'hs', '10': 'hs', '11': 'hs', '12': 'hs'
};

var EVENT_TYPES = {
  VISITOR_IN: 'visitor_in',
  VISITOR_OUT: 'visitor_out',
  STUDENT_LATE_IN: 'student_late_in',
  STUDENT_EARLY_OUT: 'student_early_out',
  STUDENT_RETURN_IN: 'student_return_in',
  MOVEMENT: 'movement',
  PICKUP_FLAG: 'pickup_flag',          // an open mismatch — NEVER affects presence, NEVER a completed sign-out
  // A parent rang ahead: the office records the dismissal BEFORE it happens
  // (Josh, 2026-09-14). Not a departure — it never touches presence and never
  // counts as a sign-out. The kiosk offers it back to the parent on arrival so
  // nobody retypes what was already said on the phone, and an unclaimed plan
  // simply expires at the end of the day, logged and silent.
  // Reuses ExpectedBack for the expected pickup time ('HH:mm') and
  // RelatedEventID for the sibling-group id, so a parent collecting three
  // children is one plan, not three unrelated rows.
  DISMISSAL_PLANNED: 'dismissal_planned',
  // Reserved for later revisions (no v1 flow renders or accepts them):
  VOLUNTEER_IN: 'volunteer_in',
  VOLUNTEER_OUT: 'volunteer_out',
  STAFF_IN: 'staff_in',
  STAFF_OUT: 'staff_out'
};

var PERSON_TYPES = ['visitor', 'student', 'volunteer', 'staff']; // volunteer/staff reserved

var PICKUP_MATCH = ['matched', 'mismatch', 'override', 'n/a'];

var FOLLOWUP_MODES = ['email_teacher', 'office_alert', 'page_student', 'record_only'];

// office = manual entries on the board; mobile = doPost movement devices;
// nurse = the nurse's own sign-out desk (Josh, 2026-09-16) — a real station, not a building, so
// her departures are distinguishable in history and metrics from a lobby iPad's.
// kg = the Kindergarten building's own iPad and desk (Josh, 2026-09-16) — K4, K5 and 5th are
// already 'Kindergarten' in the building map below; what was missing was a desk of their own.
// APPEND ONLY: metrics and the alert picker read the earlier positions.
var STATION_IDS = ['hs', 'el', 'office', 'mobile', 'nurse', 'kg'];

// The desks a dismissal call can be routed to — the subset of STATION_IDS that is a staffed front
// office, in the order a multi-desk family should be told about them. Anything else in
// desk.grade.map is a typo, and Planned.deskFor refuses it rather than inventing a desk.
var DESK_IDS = ['el', 'kg', 'hs'];

var SCHEMA = {
  // Append-only event log. Presence is ALWAYS derived by folding today's rows —
  // no mutable status rows anywhere. appendRow-only under script lock; the sole
  // UPDATE writes are FlagStatus/FlagNote/FollowUpStatus (office app, keyed by EventID).
  EVENTS: {
    key: ['EventID'],
    cols: [
      { name: 'EventID', tier: 'OFFICE' },        // E-20260804-134210-4821 (ids.js)
      { name: 'Timestamp', tier: 'OFFICE' },      // 'yyyy-MM-dd HH:mm:ss' STRING, America/New_York
      { name: 'Date', tier: 'OFFICE' },           // 'yyyy-MM-dd' — fast day filter
      { name: 'Type', tier: 'OFFICE' },           // EVENT_TYPES value
      { name: 'PersonType', tier: 'OFFICE' },     // PERSON_TYPES value
      { name: 'PersonKey', tier: 'OFFICE' },      // student: FACTS 'Student ID (System)'; visitor: the sign-in EventID (visit-scoped identity)
      { name: 'PersonName', tier: 'OFFICE' },     // display name ('Last, First' for students)
      { name: 'Grade', tier: 'OFFICE' },          // students only (FACTS token: K4..12)
      { name: 'HomeBuilding', tier: 'OFFICE' },   // resolved via grade→building map at event time
      { name: 'Station', tier: 'OFFICE' },        // STATION_IDS value
      { name: 'FromBuilding', tier: 'OFFICE' },   // movement only
      { name: 'ToBuilding', tier: 'OFFICE' },     // movement; doubles as visitor destination
      { name: 'BadgeID', tier: 'OFFICE' },        // visitor lanyard, e.g. 'V12'
      { name: 'Reason', tier: 'OFFICE' },         // picklist value (+ ' — ' + free text if any)
      { name: 'GuardianName', tier: 'OFFICE' },   // adult who signed a student in/out (typed at kiosk)
      { name: 'Relationship', tier: 'OFFICE' },   // quick-button value
      { name: 'PickupContactID', tier: 'SYSTEM' },// FACTS pickupId on a matched early-out (custody-adjacent — raw sheet only)
      { name: 'PickupMatch', tier: 'OFFICE' },    // PICKUP_MATCH value
      { name: 'FlagStatus', tier: 'OFFICE' },     // '' | 'open' | 'resolved'   (updatable)
      { name: 'FlagNote', tier: 'OFFICE' },       // office resolution note      (updatable)
      { name: 'RelatedEventID', tier: 'OFFICE' }, // out→in, return→early-out, override→pickup_flag linkage
      { name: 'FollowUpMode', tier: 'OFFICE' },   // snapshot of the mode in force at event time
      { name: 'FollowUpStatus', tier: 'OFFICE' }, // 'n/a' | 'pending' | 'sent' | 'done'   (updatable; 'pending' rows are the cross-script alert bus)
      { name: 'Notes', tier: 'OFFICE' },
      { name: 'Source', tier: 'SYSTEM' },         // 'kiosk' | 'office' | 'system' | 'api'
      // 'HH:mm' a between-buildings mover is expected back (Lisa Cope's ask,
      // 2026-09-08) — the board highlights them once it passes. APPENDED at the
      // END: the transportation Dismissal board parses EVENTS by header name, so
      // a new trailing column is invisible to it. Never insert above this.
      { name: 'ExpectedBack', tier: 'OFFICE' }
    ]
  },

  // Lanyard badge registry (office-maintained). Assigned/available is DERIVED
  // (logic/badges.js): assigned = latest visitor_in today with that badge and
  // no linked visitor_out. No mutable status column, on purpose.
  BADGES: {
    key: ['BadgeID'],
    cols: [
      { name: 'BadgeID', tier: 'KIOSK' },         // 'V12' — the kiosk validates keypad entry against these
      { name: 'Label', tier: 'OFFICE' },
      { name: 'HomeStation', tier: 'OFFICE' },    // 'hs' | 'el'
      { name: 'Active', tier: 'OFFICE' },         // 'Y' | 'N' (retired/lost badges stay as rows)
      { name: 'Notes', tier: 'OFFICE' }
    ]
  },

  // Key/value settings, edited via ?page=settings (Admin only). Keys + defaults
  // in SETTINGS_DEFAULTS below.
  SETTINGS: {
    key: ['Key'],
    cols: [
      { name: 'Key', tier: 'OFFICE' },
      { name: 'Value', tier: 'OFFICE' },
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedBy', tier: 'SYSTEM' }
    ]
  },

  // Display metadata only — device keys live in Script Properties, never here.
  STATIONS: {
    key: ['StationID'],
    cols: [
      { name: 'StationID', tier: 'OFFICE' },      // STATION_IDS value
      { name: 'Name', tier: 'OFFICE' },           // 'HS Main Office'
      { name: 'Building', tier: 'OFFICE' },       // BUILDINGS value
      { name: 'Enabled', tier: 'OFFICE' }         // 'Y' | 'N'
    ]
  },

  // Stand-alone access registry (Josh's call: zero CMS coupling). Fail-CLOSED:
  // no row / blank flag = no access. itscripts@ is synthesized super-admin in code.
  PERMISSIONS: {
    key: ['Email'],
    cols: [
      { name: 'Email', tier: 'SYSTEM' },
      { name: 'FrontOffice', tier: 'SYSTEM' },    // 'Y' → board / flags / muster
      { name: 'Admin', tier: 'SYSTEM' },          // 'Y' → settings, badge registry, permissions
      { name: 'Notes', tier: 'SYSTEM' },
      // Which station's alerts make THIS person's board chime. The board still
      // SHOWS the whole campus; only the sound is scoped, so an EL sign-out
      // doesn't interrupt the HS desk. '' or 'all' = every alert (default),
      // 'hs' | 'el' = that kiosk only, 'none' = never chime.
      // APPENDED 2026-09-05 — append-only, so existing rows keep working.
      { name: 'AlertStation', tier: 'SYSTEM' },
      // 'Y' → the nurse's sign-out page (?page=nurse) and nothing else. Deliberately INDEPENDENT of
      // FrontOffice: the nurse signs children out but has no business on the board, and a
      // front-office account does not get her door for free. Admin implies it, so Josh can test.
      // APPENDED 2026-09-16 — append-only; existing rows read blank and are unaffected.
      { name: 'Nurse', tier: 'SYSTEM' }
    ]
  },

  // INTERIM Work-Release list (the only students who may self sign-out).
  // FACTS becomes the source once the /UserDefinedData probe (M2) confirms a
  // field exists there — then this tab becomes a synced mirror, not hand-kept.
  WORK_RELEASE: {
    key: ['StudentID'],
    cols: [
      { name: 'StudentID', tier: 'SYSTEM' },      // FACTS 'Student ID (System)'
      { name: 'StudentName', tier: 'SYSTEM' },
      { name: 'ApprovedBy', tier: 'SYSTEM' },
      { name: 'Expires', tier: 'SYSTEM' },        // 'yyyy-MM-dd'; blank = school year
      { name: 'Notes', tier: 'SYSTEM' }
    ]
  },

  // Part-time / homeschool students, who attend for a class or two and whose
  // arrivals and departures are SCHEDULED rather than exceptions. They get their
  // own kiosk buttons (Josh, 2026-09-10) and are excluded from the FACTS
  // attendance push, because marking a scheduled part-day student late or absent
  // every day would be wrong.
  //
  // Seeded by RUN_seedHomeschoolFromSchedules (SheetGateway.js) from the FACTS
  // 'Student Schedules' tab — grades 1-12 carrying 4 or fewer real classes,
  // excluding Work Release. K4/K5 are excluded wholesale: their day is not
  // scheduled as classes at all, so a class count says nothing about them.
  // Auto-seeding only ADDS; removing a student is a deliberate human act.
  HOMESCHOOL: {
    key: ['StudentID'],
    cols: [
      { name: 'StudentID', tier: 'SYSTEM' },      // FACTS 'Student ID (System)'
      { name: 'StudentName', tier: 'SYSTEM' },
      { name: 'Grade', tier: 'SYSTEM' },
      { name: 'Classes', tier: 'SYSTEM' },        // class count when seeded — audit trail
      { name: 'AddedBy', tier: 'SYSTEM' },        // 'auto' | an email
      { name: 'Expires', tier: 'SYSTEM' },        // 'yyyy-MM-dd'; blank = school year
      { name: 'Notes', tier: 'SYSTEM' }
    ]
  }
};

// Defaults seeded by RUN_bootstrapDb; the Settings tab value always wins at runtime.
var SETTINGS_DEFAULTS = {
  'dismissal.followup.mode': 'office_alert',      // FOLLOWUP_MODES — Josh picks the live mode at M6
  'dismissal.followup.cc': '',                    // fallback + cc address(es), comma-separated
  // Teachers ABOVE this grade are not emailed — their dismissals alert the
  // board instead (Josh, 2026-09-15: "for now, I only want the emails going to
  // the front line employees and the k4 thru 6th grade teachers"). Set it to
  // '12' to email every homeroom teacher.
  'dismissal.followup.maxgrade': '6',
  'dismissal.pickup.ui': 'type',                  // 'type' (never display contacts) | 'list'
  'late.parentdriven.maxgrade': '5',              // ≤ this grade token = parent signs the student in (Josh 2026-08-05: 6th self-serves like HS)
  'visitor.reasons': 'Meeting|Delivery|Maintenance|Family visit|Other',
  // 'Late Bus' added 2026-09-11 (Josh): the bus was late, which is not the
  // student's doing — it maps to LA in FACTS, never a tardy.
  'late.reasons': 'Appointment|Late Bus|Overslept|Car trouble|Family|Other',
  // The PLANNED-pickup dialog has its own short list (Josh, 2026-09-14): a
  // parent ringing ahead is answering 'why', not choosing from the full
  // dismissal picklist the kiosk shows.
  'plan.reasons': 'Dr/Dentist|Family Event|Other',
  // The nurse's own list — why a child is going home from HER office, which is a different
  // question from the front desk's early-dismissal picklist (Josh, 2026-09-16).
  'nurse.reasons': 'Illness|Fever|Vomiting|Injury|Headache|Other',
  'dismissal.reasons': 'Medical appointment|Family|Sports dismissal|Illness|Homeschool|Other',
  // Between-buildings moves. Per Coreen Forloine 2026-09-08: a student moving
  // UNESCORTED (lessons, ELC, TA duties) signs out and back in; a class moving
  // together or escorted by a teacher does not. This is NOT leaving campus, so
  // it never runs the pickup check and never raises a flag.
  'movement.reasons': "Music lesson|ELC services|Teacher's Aide|Office errand|Other",
  'building.grade.map': JSON.stringify(DEFAULT_GRADE_BUILDING_MAP),
  'desk.grade.map': JSON.stringify(DEFAULT_DESK_GRADE_MAP),
  'presence.doorsheet.enabled': 'false',          // v1 is STANDALONE (Josh, CP0): no Door-Sheet write until he flips this
  'kiosk.idle.warn.seconds': '45',
  'kiosk.idle.reset.seconds': '10',
  'board.poll.seconds': '12',
  'muster.rosterMode': 'counts',                  // 'counts' | 'full'
  'mismatch.alert.emails': '',                    // always-alert recipients for pickup_flag, comma-separated
  'closeout.hour': '23',                          // nightly auto-close trigger runs in this hour
  // Month the school year begins (1-12). Drives the Metrics page's "this school
  // year" / "last school year" ranges: 8 means 2026-08-01 … 2027-07-31.
  'schoolyear.start.month': '8',
  // Deep-link target for the muster roster: clicking a student opens their full
  // record (schedule, contacts, attendance) in FACTS Finder, which applies its
  // OWN staff allowlist — we link out rather than copy directory data in here.
  // Blank disables the links.
  'factsfinder.url': '',
  // Deep-link target for the FACTS Dismissal board (../FACTS/transportation) — the
  // "how does this child go home today" question the front line asks next. Same
  // shape as factsfinder.url: Dismissal applies its OWN staff gate, we only point at
  // it. Blank hides the button; set it from Settings → Board (Josh, 2026-09-15).
  'dismissal.url': '',
  'kiosk.flows.enabled': JSON.stringify(['visitor', 'student_in', 'student_out']) // volunteer bolts on here later
};

// Node test shim (GAS loads this file as globals; tools/wrap.js copies it into apps/*/server/lib/).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TIER: TIER,
    BUILDINGS: BUILDINGS,
    DEFAULT_GRADE_BUILDING_MAP: DEFAULT_GRADE_BUILDING_MAP,
    DEFAULT_DESK_GRADE_MAP: DEFAULT_DESK_GRADE_MAP,
    EVENT_TYPES: EVENT_TYPES,
    PERSON_TYPES: PERSON_TYPES,
    PICKUP_MATCH: PICKUP_MATCH,
    FOLLOWUP_MODES: FOLLOWUP_MODES,
    STATION_IDS: STATION_IDS,
    DESK_IDS: DESK_IDS,
    SCHEMA: SCHEMA,
    SETTINGS_DEFAULTS: SETTINGS_DEFAULTS
  };
}

/* ===================== logic/ids.js ===================== */
'use strict';
/**
 * ids.js — event IDs + timestamp strings. Pure: every function takes a Date
 * (callers pass new Date()) so tests are deterministic and Sheets' date
 * coercion never enters the picture (we only ever WRITE strings).
 */

var Ids = (function () {
  function pad2(n) { return ('0' + n).slice(-2); }

  /** 'yyyy-MM-dd' (local time of the passed Date — GAS server runs America/New_York). */
  function dayKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /** 'yyyy-MM-dd HH:mm:ss' string — the ONLY timestamp format written to the DB. */
  function timestamp(d) {
    return dayKey(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  /** 'HH:mm' display time. */
  function hhmm(d) { return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  /**
   * A stored time, written the way the front desk says it out loud: 2:05 PM.
   *
   * DISPLAY ONLY. Everything stored, sorted or compared stays 24-hour — 'HH:mm'
   * sorts as a string, '2:05 PM' does not — so this is called at the edge, on
   * the way to a screen or an email, and never on the way into the sheet.
   *
   * No timezone conversion happens here and none should: GAS runs this project
   * in America/New_York and every timestamp was written in that zone, so the
   * clock time is already Eastern. Shifting it again would move every time by
   * hours.
   *
   * Takes a full 'yyyy-MM-dd HH:mm:ss' timestamp or a bare 'HH:mm'. Anything
   * else is handed back untouched — a label is never worth throwing for.
   */
  function h12(value) {
    var s = String(value == null ? '' : value).trim();
    var h, mi;
    var full = /^\d{4}-\d{2}-\d{2}[ T](\d{1,2}):(\d{2})/.exec(s);
    if (full) { h = Number(full[1]); mi = Number(full[2]); }
    else {
      var bare = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
      if (!bare) return s;
      h = Number(bare[1]); mi = Number(bare[2]);
    }
    if (h > 23 || mi > 59) return s;
    var hour = h % 12;
    if (hour === 0) hour = 12;              // midnight and noon are both 12
    return hour + ':' + pad2(mi) + ' ' + (h < 12 ? 'AM' : 'PM');
  }

  /**
   * Event ID: E-20260804-134210-4821. The 4-digit disambiguator is caller-supplied
   * (GAS: Math.floor(Math.random()*10000)); same-second collisions at 10–30
   * events/day are already vanishingly rare, the suffix makes them ignorable.
   */
  function makeEventId(d, disambig) {
    var n = ('000' + (disambig == null ? 0 : disambig)).slice(-4);
    return 'E-' + dayKey(d).replace(/-/g, '') + '-' +
      pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '-' + n;
  }

  return { dayKey: dayKey, timestamp: timestamp, hhmm: hhmm, h12: h12, makeEventId: makeEventId };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Ids;

/* ===================== logic/fuzzy.js ===================== */
'use strict';
/**
 * fuzzy.js — edit-distance matching primitives shared by search.js (student
 * lookup) and pickup.js (authorized-pickup hard check).
 * Lifted verbatim from FACTS\facts-directory-search\Search.gs (2026-08-04).
 */

var Fuzzy = (function () {
  /** Optimal-string-alignment distance (Levenshtein + adjacent transposition = 1). */
  function editDistance(a, b) {
    var la = a.length, lb = b.length;
    var d = [];
    for (var i = 0; i <= la; i++) { d[i] = [i]; }
    for (var j = 0; j <= lb; j++) { d[0][j] = j; }
    for (i = 1; i <= la; i++) {
      for (j = 1; j <= lb; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[la][lb];
  }

  /** Edit-distance budget for a fuzzy token, scaled by its length (0 = no fuzzing). */
  function budget(token) {
    if (token.length < 3 || !/^[a-z'-]+$/.test(token)) return 0; // IDs/emails: exact only
    return token.length <= 4 ? 1 : token.length <= 7 ? 2 : 3;
  }

  return { editDistance: editDistance, budget: budget };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Fuzzy;

/* ===================== logic/namerules.js ===================== */
'use strict';
/**
 * namerules.js — name normalization for matching typed names against FACTS
 * records. Lifted from FACTS\facts-to-gac-sync\NameRules.js (2026-08-04);
 * username-generation functions dropped (not needed here).
 */

var NameRules = (function () {
  var GENERATIONAL_SUFFIXES = { jr: 1, sr: 1, ii: 1, iii: 1, iv: 1, v: 1 };

  /** Lowercase a-z only: NFD-decompose, drop diacritics, drop everything non-alphabetic. */
  function normalize(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z]/g, '');
  }

  /** Remove trailing generational suffix tokens from a raw last name ("Smith, Jr." → "Smith"). */
  function stripGenerationalSuffix(last) {
    var tokens = String(last || '').replace(/,/g, ' ').trim().split(/\s+/);
    while (tokens.length > 1) {
      var tail = tokens[tokens.length - 1].replace(/\./g, '').toLowerCase();
      if (GENERATIONAL_SUFFIXES[tail]) tokens.pop();
      else break;
    }
    return tokens.join(' ');
  }

  /**
   * Split a free-typed full name into normalized word tokens, dropping
   * generational suffixes and empty fragments. Hyphenated names contribute
   * BOTH the joined and the split forms ("Smith-Jones" → smithjones, smith, jones)
   * so either half typed by a parent still matches.
   */
  function nameTokens(raw) {
    var cleaned = stripGenerationalSuffix(String(raw || '').replace(/,/g, ' '));
    var words = cleaned.split(/\s+/).filter(function (w) { return w; });
    var out = [];
    words.forEach(function (w) {
      var joined = normalize(w);
      if (joined) out.push(joined);
      if (w.indexOf('-') !== -1) {
        w.split('-').forEach(function (part) {
          var p = normalize(part);
          if (p && out.indexOf(p) === -1) out.push(p);
        });
      }
    });
    return out;
  }

  return {
    normalize: normalize,
    stripGenerationalSuffix: stripGenerationalSuffix,
    nameTokens: nameTokens
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NameRules;

/* ===================== logic/directory.js ===================== */
'use strict';
/**
 * directory.js — build the student directory from the FACTS staging-Sheet tabs.
 * Adapted from FACTS\facts-directory-search\Search.gs buildPeople (2026-08-04):
 * same header-name parsing (columns are append-only in the producer), narrowed
 * to what a sign-in/out kiosk needs, plus elementary-homeroom resolution
 * (the export's Homeroom column is grades 7–12 only).
 *
 * Input tabs shape (as everywhere): [{ name: 'Sheet1', values: [[hdr,...],[...]] }]
 */

/* global Ids, NameRules */

var Directory = (function () {
  function cellToString(v) {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) {
      return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
    }
    return String(v);
  }

  function tabByName(tabs, names) {
    for (var i = 0; i < (tabs || []).length; i++) {
      if (names.indexOf(tabs[i].name) !== -1) return tabs[i];
    }
    return null;
  }

  function headerMap(headerRow) {
    var map = {};
    (headerRow || []).forEach(function (h, i) { map[cellToString(h)] = i; });
    return map;
  }

  /**
   * Enrolled students from the LONG-format directory tab (one row per
   * student+guardian). Guardians are kept OFFICE/SYSTEM-side only — the kiosk
   * client never receives them.
   * @return {Array<{id,name,grade,homeroomTeacher,status,guardians:[{name,emails[]}]}>}
   */
  function buildStudents(tabs, opts) {
    opts = opts || {};
    var dir = tabByName(tabs, ['Directory', 'Sheet1']);
    if (!dir || (dir.values || []).length < 2) return [];
    var h = headerMap(dir.values[0]);
    var byId = {};
    var order = [];
    for (var r = 1; r < dir.values.length; r++) {
      var row = dir.values[r];
      var cell = function (name) { return cellToString(row[h[name]]).trim(); };
      var id = cell('Student ID (System)');
      if (!id) continue;
      var status = cell('Status');
      if (!opts.includeAllStatuses && status !== 'Enrolled') continue;
      var p = byId[id];
      if (!p) {
        p = byId[id] = {
          id: id,
          name: cell('LastName FirstName'),   // last-name-first, space- (sometimes comma-) separated
          grade: cell('Grade Level'),
          homeroomTeacher: cell('Homeroom Teacher'), // grades 7–12 only; blank PK–6
          status: status,
          guardians: []
        };
        order.push(p);
      }
      var gName = cell('LastName FirstName 1');
      var gEmails = [cell('Email 1'), cell('Email2')].filter(function (e) { return e; });
      if (gName || gEmails.length) p.guardians.push({ name: gName, emails: gEmails });
    }
    order.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    return order;
  }

  /** Index students by id for O(1) event enrichment. */
  function byId(students) {
    var idx = {};
    (students || []).forEach(function (s) { idx[s.id] = s; });
    return idx;
  }

  /**
   * Elementary homeroom teacher NAMES from the Student Schedules tab
   * (Category === 'Homeroom' rows, e.g. HR-K5..HR-06 — the only elementary
   * homeroom source in the export).
   * @return {Object} studentId -> teacher name ('Last, First')
   */
  function homeroomTeacherByStudent(tabs) {
    var sched = tabByName(tabs, ['Student Schedules']);
    var out = {};
    if (!sched || (sched.values || []).length < 2) return out;
    var h = headerMap(sched.values[0]);
    for (var r = 1; r < sched.values.length; r++) {
      var row = sched.values[r];
      if (cellToString(row[h['Category']]).trim() !== 'Homeroom') continue;
      var id = cellToString(row[h['Student ID']]).trim();
      var teacher = cellToString(row[h['Teacher']]).trim();
      if (id && teacher && !out[id]) out[id] = teacher;
    }
    return out;
  }

  /**
   * Strip accents, punctuation and case, so 'Bueché' and 'Bueche' are one name
   * and a trailing middle initial cannot change the answer.
   */
  function foldName(value) {
    var t = String(value == null ? '' : value);
    if (t.normalize) t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return t.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * The (surname, forename) pairs a teacher name could mean.
   *
   * FACTS writes teacher names TWO different ways and neither field announces
   * which: the 7-12 'Homeroom' cell holds 'Burge, Angela L.' while the Student
   * Schedules HR rows hold 'Burge Angela' with no comma at all. A resolver that
   * understands only the comma form silently matches nobody — which is exactly
   * how all 25 elementary homerooms came back unreachable on 2026-09-15, after
   * the mail had already been switched live.
   *
   * Order matters: the comma form is unambiguous, so it is tried first. The
   * space form is read as FACTS writes it (Last First) before the human order
   * (First Last), because the former is what the export actually contains.
   */
  function teacherNameParts(name) {
    var raw = String(name == null ? '' : name);
    var out = [];
    if (raw.indexOf(',') >= 0) {
      var bits = raw.split(',');
      out.push([foldName(bits[0]), foldName(bits[1]).split(' ')[0]]);
    }
    var t = foldName(raw).split(' ');
    if (t.length >= 2) {
      out.push([t[0], t[1]]);                        // 'Burge Angela' — FACTS HR rows
      out.push([t[t.length - 1], t[0]]);             // 'Angela Burge' — typed the other way
    }
    return out.filter(function (pr) { return pr[0] && pr[1]; });
  }

  /** The lookup keys a staff record should answer to. */
  function teacherKeys(last, first) {
    var L = foldName(last), F = foldName(first).split(' ')[0];
    return (L && F) ? [L + '|' + F] : [];
  }

  /**
   * Staff email lookup by teacher display name — forgiving about the name form,
   * never about ambiguity.
   *
   * A surname alone resolves ONLY when exactly one member of staff carries it.
   * With mail live, guessing between two Wilsons does not send a slightly wrong
   * email, it sends a child's early-dismissal notice to a stranger — so an
   * ambiguous surname returns nothing and the plan still reaches the desk.
   */
  function staffEmailResolver(tabs) {
    var staff = tabByName(tabs, ['Staff']);
    var byFull = {}, bySurname = {};
    if (staff && (staff.values || []).length > 1) {
      var h = headerMap(staff.values[0]);
      for (var r = 1; r < staff.values.length; r++) {
        var row = staff.values[r];
        var first = cellToString(row[h['First Name']]).trim();
        var last = cellToString(row[h['Last Name']]).trim();
        var email = cellToString(row[h['Email']]).trim();
        if (h['Active'] !== undefined &&
            cellToString(row[h['Active']]).toLowerCase() === 'false') continue;
        if (!last || !email) continue;
        teacherKeys(last, first).forEach(function (k) { if (!byFull[k]) byFull[k] = email; });
        var L = foldName(last);
        if (L) {
          bySurname[L] = bySurname[L] || [];
          if (bySurname[L].indexOf(email) < 0) bySurname[L].push(email);
        }
      }
    }
    /** @param {string} teacherName 'Last, First M.' OR 'Last First' */
    return function (teacherName) {
      var parts = teacherNameParts(teacherName);
      for (var i = 0; i < parts.length; i++) {
        var hit = byFull[parts[i][0] + '|' + parts[i][1]];
        if (hit) return hit;
      }
      // NO surname fallback when a forename was supplied and did not match.
      // facts-api-sync's watcher does fall back that way, and for an "attendance
      // is late" nudge that is a fair trade. This is not that: it carries a named
      // child's dismissal, so 'Smith John' quietly resolving to the only Smith on
      // staff - Jane - would hand one family's business to a stranger. A supplied
      // forename that misses is evidence of a DIFFERENT person, so we refuse and
      // let RUN_planTeacherCheck name the room for a human to fix.
      var solo = foldName(teacherName);
      if (solo && solo.indexOf(' ') < 0 && bySurname[solo] && bySurname[solo].length === 1) {
        return bySurname[solo][0];
      }
      return '';
    };
  }

  /**
   * ELC side-car 'K5-6 Teachers' tab (Grade | Teacher | Homeroom | Email) —
   * elementary teacher emails when the Staff-tab match fails.
   * @return {Object} teacher name (lowercased, spaceless) -> email
   */
  function elcTeacherEmails(elcTabs) {
    var tt = tabByName(elcTabs, ['K5-6 Teachers']);
    var out = {};
    if (!tt || (tt.values || []).length < 2) return out;
    var h = headerMap(tt.values[0]);
    for (var r = 1; r < tt.values.length; r++) {
      var row = tt.values[r];
      var name = cellToString(row[h['Teacher']]).trim();
      var email = cellToString(row[h['Email']]).trim();
      if (!name || !email) continue;
      // Register EVERY form the caller might arrive with, for the same reason
      // staffEmailResolver does: this tab is hand-kept, so 'Burge Angela',
      // 'Burge, Angela' and 'Angela Burge' are all plausible spellings of one
      // teacher and none of them should decide whether she is told.
      out[name.toLowerCase().replace(/\s+/g, '')] = out[name.toLowerCase().replace(/\s+/g, '')] || email;
      teacherNameParts(name).forEach(function (pr) {
        var k = pr[0] + '|' + pr[1];
        if (!out[k]) out[k] = email;
      });
    }
    return out;
  }

  /** The ELC side-car lookup, tried in the same forms the staff tab accepts. */
  function elcEmailFor(elcEmails, teacherName) {
    var map = elcEmails || {};
    var flat = String(teacherName || '').toLowerCase().replace(/\s+/g, '');
    if (map[flat]) return map[flat];
    var parts = teacherNameParts(teacherName);
    for (var i = 0; i < parts.length; i++) {
      var hit = map[parts[i][0] + '|' + parts[i][1]];
      if (hit) return hit;
    }
    return '';
  }

  /**
   * The name forms worth trying for a hand-typed student name.
   * "Jacob (Jake) Kurek" → ["Jacob Kurek", "Jake Kurek"], because FACTS may hold
   * either the legal or the preferred first name.
   */
  function candidateNameForms(raw) {
    var s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s) return [];
    var m = s.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);
    if (!m) return [s];
    var legal = (m[1] + ' ' + m[3]).replace(/\s+/g, ' ').trim();
    var preferred = (m[2] + ' ' + m[3]).replace(/\s+/g, ' ').trim();
    return preferred && preferred !== legal ? [legal, preferred] : [legal];
  }

  /**
   * Find students matching a typed name, order-independent ("Rachel Boin" and
   * "Boin, Rachel" both match the roster's "Boin Rachel"). Returns ALL matches —
   * the caller must refuse to act on an ambiguous result rather than guess,
   * because this feeds who may sign themselves out.
   * @param {Array} students from buildStudents
   * @param {string} typed
   * @return {Array} matching student objects
   */
  function findByTypedName(students, typed) {
    var NR = (typeof module !== 'undefined') ? require('./namerules.js') : NameRules;
    var forms = candidateNameForms(typed);
    var seen = {}, hits = [];
    forms.forEach(function (form) {
      var want = NR.nameTokens(form);
      if (want.length < 2) return; // a lone name is never specific enough
      (students || []).forEach(function (s) {
        if (seen[s.id]) return;
        var have = NR.nameTokens(s.name);
        var all = want.every(function (t) { return have.indexOf(t) !== -1; });
        if (all) { seen[s.id] = true; hits.push(s); }
      });
    });
    return hits;
  }

  return {
    cellToString: cellToString,
    tabByName: tabByName,
    headerMap: headerMap,
    buildStudents: buildStudents,
    candidateNameForms: candidateNameForms,
    findByTypedName: findByTypedName,
    byId: byId,
    homeroomTeacherByStudent: homeroomTeacherByStudent,
    staffEmailResolver: staffEmailResolver,
    elcTeacherEmails: elcTeacherEmails,
    foldName: foldName, teacherNameParts: teacherNameParts, elcEmailFor: elcEmailFor
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Directory;

/* ===================== logic/events.js ===================== */
'use strict';
/**
 * events.js — event object construction, validation, and row (de)serialization
 * against SCHEMA.EVENTS (the column order lives in schema.js, nowhere else).
 */

/* global SCHEMA, EVENT_TYPES, Ids */

var Events = (function () {
  function ref_() {
    if (typeof module !== 'undefined') {
      var s = require('./schema.js');
      return { SCHEMA: s.SCHEMA, EVENT_TYPES: s.EVENT_TYPES, Ids: require('./ids.js') };
    }
    return { SCHEMA: SCHEMA, EVENT_TYPES: EVENT_TYPES, Ids: Ids };
  }

  var REQUIRED = {
    visitor_in: ['PersonName', 'Station', 'BadgeID', 'Reason'],
    visitor_out: ['PersonKey', 'Station'],
    student_late_in: ['PersonKey', 'PersonName', 'Grade', 'Station', 'Reason'],
    student_early_out: ['PersonKey', 'PersonName', 'Grade', 'Station', 'Reason', 'PickupMatch'],
    student_return_in: ['PersonKey', 'PersonName', 'Grade', 'Station'],
    movement: ['PersonKey', 'PersonName', 'FromBuilding', 'ToBuilding'],
    pickup_flag: ['PersonKey', 'PersonName', 'Grade', 'Station', 'GuardianName']
  };

  /**
   * Build a complete event object. `fields` carries the flow-specific values;
   * everything else defaults to ''. @param {Date} now  @param {number} disambig
   */
  function makeEvent(type, fields, now, disambig) {
    var R = ref_();
    var valid = Object.keys(R.EVENT_TYPES).some(function (k) { return R.EVENT_TYPES[k] === type; });
    if (!valid) throw new Error('Events.makeEvent: unknown type ' + type);
    var req = REQUIRED[type] || [];
    req.forEach(function (f) {
      if (!fields || !String(fields[f] || '').trim()) {
        throw new Error('Events.makeEvent: ' + type + ' requires ' + f);
      }
    });
    var e = {};
    R.SCHEMA.EVENTS.cols.forEach(function (c) { e[c.name] = (fields && fields[c.name] != null) ? String(fields[c.name]) : ''; });
    e.EventID = R.Ids.makeEventId(now, disambig);
    e.Timestamp = R.Ids.timestamp(now);
    e.Date = R.Ids.dayKey(now);
    // A planned dismissal may be FOR a later day (Josh, 2026-09-28): its Date is the day it
    // applies, so every Date-filtered reader finds it then; Timestamp still records when it was
    // taken. No other type may be back- or forward-dated — a departure happens when it is written.
    if (type === 'dismissal_planned' && fields && /^\d{4}-\d{2}-\d{2}$/.test(String(fields.Date || '')) &&
        String(fields.Date) > e.Date) {
      e.Date = String(fields.Date);
    }
    e.Type = type;
    if (type === 'visitor_in' && !e.PersonKey) e.PersonKey = e.EventID; // visit-scoped identity
    if (!e.PersonType) e.PersonType = type.indexOf('visitor') === 0 ? 'visitor' : 'student';
    if (!e.FlagStatus && type === 'pickup_flag') e.FlagStatus = 'open';
    if (!e.FollowUpStatus) e.FollowUpStatus = 'n/a';
    if (!e.Source) e.Source = 'kiosk';
    return e;
  }

  /** Event object → row array in SCHEMA.EVENTS column order (for appendRow). */
  function rowFromEvent(e) {
    var R = ref_();
    return R.SCHEMA.EVENTS.cols.map(function (c) { return e[c.name] != null ? e[c.name] : ''; });
  }

  /** Sheet row array + header row → event object (headers win over position). */
  function objFromRow(headers, row) {
    var o = {};
    (headers || []).forEach(function (h, i) {
      var v = row[i];
      o[String(h)] = (v === null || v === undefined) ? '' : String(v);
    });
    return o;
  }

  return { makeEvent: makeEvent, rowFromEvent: rowFromEvent, objFromRow: objFromRow, REQUIRED: REQUIRED };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Events;

/* ===================== logic/family.js ===================== */
'use strict';
/**
 * family.js — which enrolled children belong to the same family.
 *
 * WHY THIS EXISTS. A parent collecting three children had to run the whole sign-out three times,
 * typing their name each time (Josh, 2026-09-16). The planned-pickup path already handled a family
 * in one go, but only when somebody had rung ahead that morning; a walk-up got nothing.
 *
 * FACTS gives this project no family id — the directory tab is one row per student+guardian — so
 * the link is the GUARDIAN: two children are siblings when they share a guardian. An email is the
 * strong key (exact, and a parent has one address across their children); a folded guardian NAME is
 * the fallback for the families whose rows carry no address.
 *
 * THIS MODULE ANSWERS "WHO IS RELATED", NEVER "WHO MAY BE COLLECTED". The caller must still run the
 * authorized-pickup check per child before a sibling's name is shown to anyone or acted on —
 * custody arrangements mean an adult cleared for one child may not be cleared for another, and the
 * kiosk is an anonymous device. Being someone's sibling is not permission.
 */

var Family = (function () {
  /** Fold a guardian name to surname + first forename, so "Smith, Jane A." keys with "Smith Jane". */
  function nameKey(s) {
    var t = String(s == null ? '' : s);
    if (typeof t.normalize === 'function') t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    var toks = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    return toks.slice(0, 2).join(' ');
  }

  /**
   * The keys that identify this student's family. Emails win; a name is used only when a guardian
   * row carries no address at all, so a common surname never merges two unrelated families that
   * both have emails on file.
   * @return {Array<string>} prefixed keys ('e:' email, 'n:' folded name)
   */
  function guardianKeys(student) {
    var out = [], seen = {};
    ((student && student.guardians) || []).forEach(function (g) {
      var emails = (g && g.emails) || [];
      var any = false;
      emails.forEach(function (e) {
        var k = 'e:' + String(e || '').trim().toLowerCase();
        if (k !== 'e:' && !seen[k]) { seen[k] = 1; out.push(k); any = true; }
      });
      if (!any) {
        var n = nameKey(g && g.name);
        var k2 = 'n:' + n;
        if (n && !seen[k2]) { seen[k2] = 1; out.push(k2); }
      }
    });
    return out;
  }

  /**
   * Every OTHER enrolled student who shares a guardian with this one.
   * @param students Directory.buildStudents output
   * @param studentId the child already identified
   * @return {Array<{id,name,grade}>} alphabetical; [] when the child or their family is unknown
   */
  function siblingsOf(students, studentId) {
    var id = String(studentId == null ? '' : studentId);
    var self = null;
    (students || []).forEach(function (st) { if (String(st.id) === id) self = st; });
    if (!self) return [];
    var keys = {};
    guardianKeys(self).forEach(function (k) { keys[k] = 1; });
    if (!Object.keys(keys).length) return [];   // no guardian on file = no family link to draw

    var out = [];
    (students || []).forEach(function (st) {
      if (String(st.id) === id) return;
      var hit = false;
      guardianKeys(st).forEach(function (k) { if (keys[k]) hit = true; });
      if (hit) out.push({ id: String(st.id), name: st.name, grade: st.grade });
    });
    out.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    return out;
  }

  return { nameKey: nameKey, guardianKeys: guardianKeys, siblingsOf: siblingsOf };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Family;

/* ===================== logic/planned.js ===================== */
'use strict';
/**
 * planned.js — planned early dismissals: a parent rings ahead, the office
 * records it, and the kiosk hands it back when they arrive (Josh, 2026-09-14).
 *
 * PURE: no GAS globals, no I/O. Shared by the office (create, list, notify) and
 * the kiosk (recognise on arrival), so both agree on what "still outstanding"
 * means instead of two filters drifting apart.
 *
 * A plan is NOT a departure. It never touches presence, never counts as a
 * sign-out, and the pickup check still runs when the adult actually turns up —
 * the plan says a dismissal is expected, not that whoever arrives is authorised
 * (Josh, decision 3).
 */

var Planned = (function () {

  // The staffed front desks, in the order a multi-desk family should be told about them. Mirrors
  // DESK_IDS in schema.js; kept local because this module is pure and imports nothing.
  var DESK_ORDER_ = ['el', 'kg', 'hs'];

  /**
   * Which front desk coordinates this student's dismissal?
   *
   * This is the routing key for the ARRIVAL alert, deliberately NOT the kiosk
   * the parent happens to be standing at (Josh, decision 2). A parent at the EL
   * iPad collecting a 4th grader AND a 10th grader must ring a bell at BOTH
   * desks — the HS desk is the one that has to walk the 10th grader down, and
   * routing by station would have left them unaware anyone was there.
   *
   * @param {Object} deskMap grade token -> 'hs' | 'el' (Settings desk.grade.map)
   * MAP-DRIVEN, not a two-desk whitelist (Josh, 2026-09-16). This used to hard-code 'hs'/'el' and
   * return '' for anything else, so the day the Kindergarten building got its own desk every KG
   * flag and pending alert would have carried desk:'' — a silent empty string that renders as '?'
   * on the board, routes to nobody, and makes isMultiDesk read false. Now any desk the map names
   * is honoured, and only a desk that is not a known station is refused.
   *
   * @return {string} a DESK_ORDER_ value, or '' when the grade is unknown or the map names no desk
   */
  function deskFor(deskMap, grade) {
    var g = String(grade == null ? '' : grade).trim().toUpperCase();
    if (!g) return '';
    var m = deskMap || {};
    var hit = m[g] || m[g.toLowerCase()] || m[String(grade).trim()];
    var d = String(hit == null ? '' : hit).trim().toLowerCase();
    return DESK_ORDER_.indexOf(d) === -1 ? '' : d;   // a typo in Settings is not a new desk
  }

  /** The distinct desks a group of students touches, in a stable order. */
  function desksFor(deskMap, students) {
    var seen = {};
    (students || []).forEach(function (s) {
      var d = deskFor(deskMap, s && s.grade);
      if (d) seen[d] = true;
    });
    return DESK_ORDER_.filter(function (d) { return seen[d]; });
  }

  /** True when a group spans more than one desk — both need telling. */
  function isMultiDesk(deskMap, students) {
    return desksFor(deskMap, students).length > 1;
  }

  /**
   * Outstanding plans for today: a plan is CLAIMED once the student has an
   * early-out (or a pickup flag — someone is clearly at the desk for them), and
   * CANCELLED when the office says so. Anything left at the end of the day
   * simply expires, logged and silent (Josh, decision 4) — no chasing, no
   * red banner for a parent whose plans changed.
   *
   * @param {Array<Object>} events today's EVENTS rows
   * @return {Array<Object>} the still-outstanding plan rows, oldest first
   */
  function outstanding(events) {
    var claimed = {}, cancelled = {};
    (events || []).forEach(function (e) {
      if (e.Type === 'student_early_out' || e.Type === 'pickup_flag') {
        claimed[String(e.PersonKey)] = true;
      }
      if (e.Type === 'dismissal_planned' &&
          String(e.FlagStatus || '').toLowerCase() === 'cancelled') {
        cancelled[String(e.EventID)] = true;
      }
    });
    return (events || []).filter(function (e) {
      if (e.Type !== 'dismissal_planned') return false;
      if (cancelled[String(e.EventID)]) return false;
      return !claimed[String(e.PersonKey)];
    });
  }

  /** The outstanding plan for ONE student today, or null. */
  function forStudent(events, studentId) {
    var id = String(studentId || '');
    var hits = outstanding(events).filter(function (e) { return String(e.PersonKey) === id; });
    return hits.length ? hits[hits.length - 1] : null;   // the most recent wins
  }

  /**
   * Everyone in the same sibling group, so the desk sees "collecting 3" rather
   * than three unrelated rows. Group id lives in RelatedEventID.
   */
  function groupOf(events, groupId) {
    var g = String(groupId || '');
    if (!g) return [];
    return (events || []).filter(function (e) {
      return e.Type === 'dismissal_planned' && String(e.RelatedEventID || '') === g;
    });
  }

  /**
   * The OTHER children on the same call who are still outstanding — what the
   * kiosk offers back when one parent has come for several.
   *
   * Lives here rather than in the kiosk because two rules matter and both are
   * easy to get quietly wrong: a sibling already collected must NOT be offered
   * again (it would sign a child out twice), and a plan with no group id must
   * drag in nobody — blank ids must never collide into one giant family.
   */
  function siblingsOf(events, studentId) {
    var id = String(studentId || '');
    var plan = forStudent(events, id);
    if (!plan || !String(plan.RelatedEventID || '')) return [];
    var still = {};
    outstanding(events).forEach(function (e) { still[String(e.EventID)] = true; });
    return groupOf(events, plan.RelatedEventID).filter(function (e) {
      return still[String(e.EventID)] && String(e.PersonKey) !== id;
    });
  }

  /** 'HH:mm' -> minutes, or -1. Used to sort plans by when they are expected. */
  function minutesOf(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return -1;
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 23 || mi > 59) return -1;
    return h * 60 + mi;
  }

  /** Outstanding plans sorted by expected time, unknown times last. */
  function sorted(events) {
    return outstanding(events).slice().sort(function (a, b) {
      var ma = minutesOf(a.ExpectedBack), mb = minutesOf(b.ExpectedBack);
      if (ma < 0 && mb < 0) return 0;
      if (ma < 0) return 1;
      if (mb < 0) return -1;
      return ma - mb;
    });
  }

  /**
   * Outstanding plans folded into FAMILIES — one card per parent trip, not one
   * per child (Josh, 2026-09-14). A parent collecting three children is one
   * event at the counter, and three separate rows made the desk work out for
   * themselves that they were related.
   *
   * Each family carries the desks it touches, and each child is tagged with
   * theirs, so a desk can see at a glance which children are ITS job while
   * still seeing the whole trip. Hiding the other building's children would
   * make the card incoherent — "collecting 1" when a parent says "I'm here for
   * three" is worse than showing one extra name.
   *
   * @param {Object} deskMap Settings desk.grade.map
   * @return {Array<Object>} families, soonest-expected first
   */
  function families(events, deskMap) {
    var rows = sorted(events);
    var byGroup = {}, order = [];
    rows.forEach(function (e) {
      // A plan with no group id is its own family of one (older rows, or a
      // single child) — keyed by event id so it can never collide.
      var key = String(e.RelatedEventID || '') || ('solo:' + e.EventID);
      if (!byGroup[key]) {
        byGroup[key] = {
          groupId: String(e.RelatedEventID || ''),
          expectedAt: e.ExpectedBack || '',
          reason: e.Reason || '',
          guardianName: e.GuardianName || '',
          at: e.Timestamp,
          students: [],
          desks: []
        };
        order.push(key);
      }
      var f = byGroup[key];
      var desk = deskFor(deskMap, e.Grade);
      f.students.push({
        eventId: e.EventID, studentId: e.PersonKey, name: e.PersonName,
        grade: e.Grade, desk: desk
      });
      if (desk && f.desks.indexOf(desk) < 0) f.desks.push(desk);
      // The soonest time in the family is the family's time.
      if (!f.expectedAt || (minutesOf(e.ExpectedBack) >= 0 &&
          minutesOf(e.ExpectedBack) < minutesOf(f.expectedAt))) {
        f.expectedAt = e.ExpectedBack || f.expectedAt;
      }
    });
    return order.map(function (k) {
      var f = byGroup[k];
      f.desks.sort();
      return f;
    });
  }

  /**
   * Translate an OFFICE plan reason into the KIOSK dismissal chip it should
   * pre-select.
   *
   * The two lists are deliberately different vocabularies: the office picks
   * from a short phone-call list ("Dr/Dentist", "Family Event", "Other") while
   * the kiosk offers the fuller dismissal list ("Medical appointment",
   * "Family", "Sports dismissal"…). Without a translation, "Dr/Dentist" would
   * match no chip, quietly select nothing, and the parent would conclude the
   * screen had forgotten their call — the exact failure this feature exists to
   * prevent.
   *
   * Falls back through preferences rather than hard-coding one target, so the
   * office can re-word either list in Settings without this going dead. An
   * unmappable reason returns '' and the parent simply taps one, as before.
   *
   * @param {string} planReason what the office recorded
   * @param {Array<string>} kioskReasons the live dismissal.reasons list
   * @return {string} a value present in kioskReasons, or ''
   */
  var PLAN_REASON_ALIASES_ = {
    'dr/dentist': ['Medical appointment', 'Appointment', 'Illness', 'Other'],
    'family event': ['Family', 'Other'],
    'other': ['Other']
  };

  function kioskReasonFor(planReason, kioskReasons) {
    var want = String(planReason == null ? '' : planReason).trim();
    if (!want) return '';
    var list = (kioskReasons || []).filter(function (r) { return r; });
    function find(target) {
      for (var i = 0; i < list.length; i++) {
        if (String(list[i]).toLowerCase() === String(target).toLowerCase()) return list[i];
      }
      return '';
    }
    var exact = find(want);                       // the lists may already agree
    if (exact) return exact;
    var alts = PLAN_REASON_ALIASES_[want.toLowerCase()] || [];
    for (var j = 0; j < alts.length; j++) {
      var hit = find(alts[j]);
      if (hit) return hit;
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // PLANNING AHEAD (Josh, 2026-09-28): "Mum rang on Monday about Friday's dentist."
  //
  // A future plan is the same dismissal_planned row with its Date column set to the day it is FOR
  // (Timestamp still says when it was recorded). Every reader already filters by Date — this
  // board's Expected pickups, the kiosk hand-back, the transportation Dismissal board — so on the
  // day it simply appears, with nobody taught anything new. Before that day it shows only in the
  // board's "Coming up" list.
  // ---------------------------------------------------------------------------

  /** How far ahead a plan may be made. A term is about this long; anything further is a typo. */
  var MAX_DAYS_AHEAD = 60;

  var DAY_NAMES_ = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH_NAMES_ = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];

  /** 'yyyy-MM-dd' -> UTC Date at midnight, or null when it is not a real calendar day. */
  function parseDay_(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || '').trim());
    if (!m) return null;
    var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    // Date.UTC rolls 2026-02-31 into March; a rolled date is not the day that was typed.
    if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
    return d;
  }

  /**
   * Is this an acceptable day to plan a pickup for?
   *
   * Blank means today, so the dialog behaves exactly as it did before for the common case.
   * Refused: the past (nothing reads it), weekends (no school, and the morning reminder would
   * mail a teacher on a Saturday about nothing), and more than MAX_DAYS_AHEAD out.
   *
   * @param {string} forDay 'yyyy-MM-dd' or ''
   * @param {string} todayKey 'yyyy-MM-dd' (America/New_York, from Ids.dayKey)
   * @return {{ok:boolean, day?:string, error?:string}}
   */
  function checkPlanDay(forDay, todayKey) {
    var want = String(forDay == null ? '' : forDay).trim();
    if (!want) return { ok: true, day: todayKey };
    var d = parseDay_(want), t = parseDay_(todayKey);
    if (!d || !t) return { ok: false, error: 'that is not a date' };
    var ahead = Math.round((d.getTime() - t.getTime()) / 86400000);
    if (ahead < 0) return { ok: false, error: 'that day has already gone' };
    if (ahead > MAX_DAYS_AHEAD) {
      return { ok: false, error: 'plans can be made up to ' + MAX_DAYS_AHEAD + ' days ahead' };
    }
    var dow = d.getUTCDay();
    if (dow === 0 || dow === 6) return { ok: false, error: 'that is a ' + DAY_NAMES_[dow] };
    return { ok: true, day: want };
  }

  /** 'yyyy-MM-dd' -> 'Friday, October 2' (or the input unchanged when it is not a date). */
  function dayLabel(key) {
    var d = parseDay_(key);
    if (!d) return String(key || '');
    return DAY_NAMES_[d.getUTCDay()] + ', ' + MONTH_NAMES_[d.getUTCMonth()] + ' ' + d.getUTCDate();
  }

  /**
   * Plans for days AFTER today, as families, soonest day first — the board's "Coming up".
   *
   * Nothing can have claimed them yet (a departure is always today's), so only a cancellation
   * removes one. Each family carries its date so the list can say which day it is for.
   *
   * @param {Array<Object>} rows EVENTS rows (any days; only future plans are kept)
   * @return {Array<Object>} families with .date, by date then expected time
   */
  function upcoming(rows, todayKey, deskMap) {
    var byDay = {};
    (rows || []).forEach(function (e) {
      if (e.Type !== 'dismissal_planned') return;
      var day = String(e.Date || '').slice(0, 10);
      if (!(day > todayKey)) return;
      (byDay[day] = byDay[day] || []).push(e);
    });
    var out = [];
    Object.keys(byDay).sort().forEach(function (day) {
      families(byDay[day], deskMap).forEach(function (f) { f.date = day; out.push(f); });
    });
    return out;
  }

  /**
   * The morning reminder: today's still-outstanding plans that were RECORDED ON AN EARLIER DAY,
   * grouped by family. A plan rung in this morning already sent its email minutes ago and must
   * not send a second; a plan made last week has not been mentioned since, and a teacher who read
   * it on Monday will not remember it on Friday.
   *
   * @return {Array<Array<Object>>} one array of plan rows per family
   */
  function remindersDue(events, todayKey) {
    var byGroup = {}, order = [];
    outstanding(events).forEach(function (e) {
      if (String(e.Date || '').slice(0, 10) !== todayKey) return;
      if (!(String(e.Timestamp || '').slice(0, 10) < todayKey)) return;
      var key = String(e.RelatedEventID || '') || ('solo:' + e.EventID);
      if (!byGroup[key]) { byGroup[key] = []; order.push(key); }
      byGroup[key].push(e);
    });
    return order.map(function (k) { return byGroup[k]; });
  }

  /** Does this family concern the given desk? '' / 'all' means every family. */
  function familyTouchesDesk(family, desk) {
    if (!desk || desk === 'all') return true;
    return (family.desks || []).indexOf(desk) >= 0;
  }

  return {
    deskFor: deskFor,
    desksFor: desksFor,
    isMultiDesk: isMultiDesk,
    outstanding: outstanding,
    forStudent: forStudent,
    groupOf: groupOf,
    siblingsOf: siblingsOf,
    minutesOf: minutesOf,
    sorted: sorted,
    families: families,
    familyTouchesDesk: familyTouchesDesk,
    kioskReasonFor: kioskReasonFor,
    MAX_DAYS_AHEAD: MAX_DAYS_AHEAD,
    checkPlanDay: checkPlanDay,
    dayLabel: dayLabel,
    upcoming: upcoming,
    remindersDue: remindersDue
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Planned;

/* ===================== logic/history.js ===================== */
'use strict';
/**
 * history.js — querying the EVENTS log for the front desk's "what happened?"
 * questions, and for OTHER APPS that read this data (Josh, 2026-09-12).
 *
 * PURE: no GAS globals, no I/O. That is the point — the office History page,
 * any future JSON endpoint, and any sibling project that vendors this file all
 * answer a question the SAME way, instead of three subtly different filters
 * drifting apart. Anything reading EVENTS should reach for this, not re-derive.
 *
 * The log is append-only and nothing is ever overwritten, so a student's day is
 * the full sequence of what happened, in order — a late arrival, a walk to
 * another building, the walk back, an early dismissal are four rows, not one
 * row updated four times. These helpers reassemble that story.
 */

var History = (function () {

  /** Event types a human would call "something happened to this student". */
  var STUDENT_TYPES = {
    student_late_in: 1, student_early_out: 1, student_return_in: 1,
    movement: 1, pickup_flag: 1
  };

  /** 'yyyy-MM-dd' from a Date, in no particular timezone — callers pass day keys. */
  function dayOf(value) {
    var s = String(value == null ? '' : value);
    var m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    return m ? m[1] : '';
  }

  function shiftDays(dayKey, n) {
    var p = String(dayKey).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    var mm = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (mm < 10 ? '0' : '') + mm + '-' + (dd < 10 ? '0' : '') + dd;
  }

  /**
   * A named range → { from, to } inclusive day keys.
   * Weeks run Monday–Sunday, which is how a school week is spoken about.
   * @param {string} preset today|yesterday|week|lastweek|month|last30|all
   * @param {string} todayKey 'yyyy-MM-dd'
   */
  function rangeFor(preset, todayKey) {
    var p = String(preset || 'today').toLowerCase();
    var parts = String(todayKey).split('-');
    var dow = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getDay(); // 0=Sun
    var sinceMonday = (dow === 0) ? 6 : dow - 1;

    if (p === 'today') return { from: todayKey, to: todayKey, label: 'Today' };
    if (p === 'yesterday') {
      var y = shiftDays(todayKey, -1);
      return { from: y, to: y, label: 'Yesterday' };
    }
    if (p === 'week') {
      return { from: shiftDays(todayKey, -sinceMonday), to: todayKey, label: 'This week' };
    }
    if (p === 'lastweek') {
      var lastMon = shiftDays(todayKey, -sinceMonday - 7);
      return { from: lastMon, to: shiftDays(lastMon, 6), label: 'Last week' };
    }
    if (p === 'month') {
      return { from: todayKey.slice(0, 8) + '01', to: todayKey, label: 'This month' };
    }
    if (p === 'last30') return { from: shiftDays(todayKey, -29), to: todayKey, label: 'Last 30 days' };
    if (p === 'all') return { from: '', to: '', label: 'All time' };
    return { from: todayKey, to: todayKey, label: 'Today' };
  }

  /** Inclusive day-range test; blank bounds mean unbounded. */
  function inRange(dayKey, from, to) {
    if (!dayKey) return false;
    if (from && dayKey < from) return false;
    if (to && dayKey > to) return false;
    return true;
  }

  /**
   * One event → a sentence a person can read without knowing the schema.
   * Kept here rather than in a template so every surface says the same thing.
   */
  function describe(e) {
    var t = e.Type;
    var reason = String(e.Reason || '').trim();
    if (t === 'student_late_in') {
      return 'Arrived late' + (reason ? ' — ' + reason : '');
    }
    if (t === 'student_early_out') {
      var who = String(e.GuardianName || '').trim();
      return 'Signed out' + (reason ? ' — ' + reason : '') +
        (who ? ' (' + who + ')' : '');
    }
    if (t === 'student_return_in') return 'Came back on campus';
    if (t === 'movement') {
      if (reason === 'returned' || reason === 'arrived') {
        return 'Back in ' + (e.ToBuilding || 'their building');
      }
      return 'Walked to ' + (e.ToBuilding || '?') + (reason ? ' — ' + reason : '');
    }
    if (t === 'pickup_flag') {
      return 'PICKUP FLAG — "' + String(e.GuardianName || '').trim() + '" did not match' +
        (String(e.FlagStatus || '') === 'resolved' ? ' (resolved)' : ' (open)');
    }
    if (t === 'visitor_in') return 'Visitor signed in' + (reason ? ' — ' + reason : '');
    if (t === 'visitor_out') return 'Visitor signed out';
    return t;
  }

  /** 'yyyy-MM-dd HH:mm:ss' → 'HH:mm'. */
  function timeOf(ts) {
    var m = /\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})/.exec(String(ts || ''));
    return m ? m[1] : '';
  }

  /**
   * Filter the log. Every criterion is optional and they AND together.
   * @param {Array<Object>} events raw EVENTS rows
   * @param {Object} q { from, to, studentId, types, station, personType }
   */
  function filter(events, q) {
    q = q || {};
    var wantTypes = (q.types && q.types.length)
      ? q.types.reduce(function (m, t) { m[t] = 1; return m; }, {}) : null;
    return (events || []).filter(function (e) {
      if (!inRange(dayOf(e.Date), q.from, q.to)) return false;
      if (q.studentId && String(e.PersonKey) !== String(q.studentId)) return false;
      if (q.personType && String(e.PersonType || '') !== q.personType) return false;
      if (q.station && String(e.Station || '') !== q.station) return false;
      if (wantTypes && !wantTypes[e.Type]) return false;
      return true;
    });
  }

  /**
   * Everything that happened, grouped day → student, each student's events in
   * time order. This is the shape both questions want: "show me this student"
   * is one student across days, "show me last Tuesday" is one day across
   * students — same structure, read differently.
   */
  function groupByDay(events) {
    var days = {};
    (events || []).forEach(function (e) {
      var d = dayOf(e.Date);
      if (!d) return;
      var day = days[d] || (days[d] = {});
      var key = String(e.PersonKey || '') || ('_' + e.EventID);
      var person = day[key] || (day[key] = {
        personKey: String(e.PersonKey || ''), name: e.PersonName || '',
        grade: e.Grade || '', personType: e.PersonType || '', events: []
      });
      person.events.push(e);
    });
    return Object.keys(days).sort().reverse().map(function (d) {
      var people = Object.keys(days[d]).map(function (k) {
        var p = days[d][k];
        p.events.sort(function (a, b) {
          return String(a.Timestamp) < String(b.Timestamp) ? -1 : 1;
        });
        p.timeline = p.events.map(function (e) {
          return { at: timeOf(e.Timestamp), type: e.Type, text: describe(e),
                   station: e.Station || '', eventId: e.EventID };
        });
        return p;
      });
      people.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      return { date: d, people: people, count: people.length };
    });
  }

  /** Distinct students appearing in a set of events, for a picker. */
  function studentsIn(events) {
    var seen = {};
    (events || []).forEach(function (e) {
      if (String(e.PersonType || '') !== 'student' || !e.PersonKey) return;
      var k = String(e.PersonKey);
      if (!seen[k]) seen[k] = { id: k, name: e.PersonName || '', grade: e.Grade || '', count: 0 };
      seen[k].count++;
    });
    return Object.keys(seen).map(function (k) { return seen[k]; })
      .sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  }

  /** Per-type totals for the header strip. */
  function counts(events) {
    var out = { total: (events || []).length };
    (events || []).forEach(function (e) { out[e.Type] = (out[e.Type] || 0) + 1; });
    return out;
  }

  return {
    STUDENT_TYPES: STUDENT_TYPES,
    rangeFor: rangeFor,
    inRange: inRange,
    dayOf: dayOf,
    shiftDays: shiftDays,
    timeOf: timeOf,
    describe: describe,
    filter: filter,
    groupByDay: groupByDay,
    studentsIn: studentsIn,
    counts: counts
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = History;

/* ===================== logic/badges.js ===================== */
'use strict';
/**
 * badges.js — lanyard badge state, derived (never stored): a badge is assigned
 * iff today's events contain a visitor_in with that BadgeID and no visitor_out
 * for the same visit (PersonKey). The sign-out badge grid and the office
 * "badges still out" view are the same derivation.
 */

var Badges = (function () {
  /**
   * @param {Array<Object>} badgeRows Badges-tab objects {BadgeID, Label, HomeStation, Active, Notes}
   * @param {Array<Object>} events today's Events objects in append order
   * @return {{assigned:Array<{badgeId,name,visitKey,in,station}>,
   *           availableByStation:Object, unknownInUse:Array<string>}}
   */
  function derive(badgeRows, events) {
    var registry = {};
    (badgeRows || []).forEach(function (b) { if (b.BadgeID) registry[b.BadgeID] = b; });

    var openByBadge = {}; // BadgeID -> visitor_in event
    (events || []).forEach(function (e) {
      if (e.Type === 'visitor_in' && e.BadgeID) {
        openByBadge[e.BadgeID] = e;
      } else if (e.Type === 'visitor_out') {
        Object.keys(openByBadge).forEach(function (bid) {
          if (openByBadge[bid].PersonKey === e.PersonKey) delete openByBadge[bid];
        });
      }
    });

    var assigned = [], unknownInUse = [];
    Object.keys(openByBadge).forEach(function (bid) {
      var e = openByBadge[bid];
      assigned.push({ badgeId: bid, name: e.PersonName, visitKey: e.PersonKey,
                      in: e.Timestamp, station: e.Station });
      if (!registry[bid]) unknownInUse.push(bid); // typo'd or unregistered badge — surface it
    });

    var availableByStation = {};
    (badgeRows || []).forEach(function (b) {
      if (!b.BadgeID || b.Active !== 'Y' || openByBadge[b.BadgeID]) return;
      var st = b.HomeStation || 'other';
      (availableByStation[st] = availableByStation[st] || []).push(b.BadgeID);
    });

    return { assigned: assigned, availableByStation: availableByStation, unknownInUse: unknownInUse };
  }

  /** Kiosk-side validation for the badge keypad. */
  function canAssign(state, badgeRows, badgeId) {
    var row = null;
    (badgeRows || []).forEach(function (b) { if (b.BadgeID === badgeId) row = b; });
    if (!row) return { ok: false, reason: 'unknown' };
    if (row.Active !== 'Y') return { ok: false, reason: 'inactive' };
    var taken = state.assigned.some(function (a) { return a.badgeId === badgeId; });
    if (taken) return { ok: false, reason: 'in-use' };
    return { ok: true };
  }

  return { derive: derive, canAssign: canAssign };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Badges;

/* ===================== logic/pickup.js ===================== */
'use strict';
/**
 * pickup.js — the authorized-pickup HARD CHECK.
 *
 * Threat model: the kiosk NEVER displays authorized names; the adult types
 * their own name and the server answers match/no-match only. A stranger must
 * therefore already know an authorized contact's first AND last name — same
 * information bar as the paper log, but now enforced and logged.
 *
 * Matching rule (per approved plan): at least one typed token must match the
 * contact's FIRST-name tokens and one must match their LAST-name tokens —
 * extra typed tokens (middle names) are ignored. A token matches within a
 * length-scaled edit-distance budget (typos) or as a ≥3-char prefix
 * (Chris → Christopher). Suffixes (Jr/III) and hyphens handled by NameRules.
 *
 * Sources: the FACTS PickupContacts tab (M2 producer change) when present;
 * falls back to the student's Sheet1 guardians until then.
 */

/* global Fuzzy, NameRules, Directory */

var Pickup = (function () {
  function ref_() {
    if (typeof module !== 'undefined') {
      return {
        Fuzzy: require('./fuzzy.js'),
        NameRules: require('./namerules.js'),
        Directory: require('./directory.js')
      };
    }
    return { Fuzzy: Fuzzy, NameRules: NameRules, Directory: Directory };
  }

  /**
   * Parse the PickupContacts tab into studentId → contacts.
   * Header contract (facts-api-sync M2, parse by NAME):
   *   pickupId | studentId | firstName | lastName | relationship | ...
   * @return {Object} studentId -> [{id, first, last, relationship}]
   */
  function parsePickupContacts(tabs) {
    var R = ref_();
    var tab = R.Directory.tabByName(tabs, ['PickupContacts']);
    var out = {};
    if (!tab || (tab.values || []).length < 2) return out;
    var h = R.Directory.headerMap(tab.values[0]);
    for (var r = 1; r < tab.values.length; r++) {
      var row = tab.values[r];
      var cell = function (name) { return R.Directory.cellToString(row[h[name]]).trim(); };
      var sid = cell('studentId');
      if (!sid) continue;
      (out[sid] = out[sid] || []).push({
        id: cell('pickupId'),
        first: cell('firstName'),
        last: cell('lastName'),
        relationship: cell('relationship')
      });
    }
    return out;
  }

  /**
   * Candidate contacts for one student: PickupContacts rows when the tab has
   * them, else the student's Sheet1 guardians (name is last-name-first; we
   * treat all its words as both-first-and-last since the format is loose).
   * @return {{source:'pickup'|'guardians'|'none', contacts:Array}}
   */
  function contactsForStudent(pickupIndex, student, studentId) {
    var rows = (pickupIndex || {})[studentId];
    if (rows && rows.length) return { source: 'pickup', contacts: rows };
    var gs = (student && student.guardians) || [];
    if (gs.length) {
      return {
        source: 'guardians',
        contacts: gs.filter(function (g) { return g.name; }).map(function (g, i) {
          return { id: 'g' + i, first: g.name, last: g.name, relationship: '' };
        })
      };
    }
    return { source: 'none', contacts: [] };
  }

  function tokenMatches_(R, typed, candidate) {
    if (!typed || !candidate) return false;
    if (typed === candidate) return true;
    if (typed.length >= 3 && candidate.indexOf(typed) === 0) return true;   // Chris → Christopher
    if (candidate.length >= 3 && typed.indexOf(candidate) === 0) return true;
    var budget = R.Fuzzy.budget(typed);
    if (!budget) return false;
    if (Math.abs(typed.length - candidate.length) > budget) return false;
    return R.Fuzzy.editDistance(typed, candidate) <= budget;
  }

  /**
   * The hard check. @return {{match:boolean, contactId?, relationship?}} —
   * caller (KioskApi) forwards ONLY {match} to the kiosk client; contactId/
   * relationship go on the Event row for the office.
   */
  function matchTypedName(contacts, typedName) {
    var R = ref_();
    var typedTokens = R.NameRules.nameTokens(typedName);
    if (typedTokens.length < 2) return { match: false, reason: 'need-full-name' };

    for (var i = 0; i < (contacts || []).length; i++) {
      var c = contacts[i];
      var firstTokens = R.NameRules.nameTokens(c.first);
      var lastTokens = R.NameRules.nameTokens(c.last);
      var firstHit = false, lastHit = false;
      for (var t = 0; t < typedTokens.length; t++) {
        var tok = typedTokens[t];
        if (!firstHit && firstTokens.some(function (f) { return tokenMatches_(R, tok, f); })) { firstHit = true; continue; }
        if (!lastHit && lastTokens.some(function (l) { return tokenMatches_(R, tok, l); })) { lastHit = true; }
      }
      if (firstHit && lastHit) {
        return { match: true, contactId: c.id, relationship: c.relationship || '' };
      }
    }
    return { match: false };
  }

  return {
    parsePickupContacts: parsePickupContacts,
    contactsForStudent: contactsForStudent,
    matchTypedName: matchTypedName
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Pickup;

/* ===================== logic/presence.js ===================== */
'use strict';
/**
 * presence.js — the fold: today's Events rows → who's on campus right now.
 * Presence is ALWAYS derived (event-sourced doctrine, docs/SCHEMA.md) — this
 * file is the only place the rules live.
 *
 * Rules (approved plan):
 *   - open visitor_in (no linked visitor_out)          ⇒ visitor present at destination
 *   - student_early_out with PickupMatch ≠ 'mismatch'  ⇒ student OFF until student_return_in
 *   - student_late_in                                  ⇒ present, annotated "arrived HH:mm"
 *   - movement                                         ⇒ current building = last ToBuilding
 *                                                        (in transit until a linked 'arrived' leg)
 *   - pickup_flag                                      ⇒ NO effect, ever
 *   - everyone else: assumed in homeroom building (FACTS + grade map) — the
 *     board legend states this; there is no attendance feed by design.
 */

var Presence = (function () {
  function hhmmOf_(ts) {
    // Timestamp strings are 'yyyy-MM-dd HH:mm:ss'
    var m = /\d{4}-\d{2}-\d{2} (\d{2}:\d{2})/.exec(String(ts || ''));
    return m ? m[1] : '';
  }

  /**
   * @param {Array<Object>} events today's Events objects (schema column names
   *        as keys), in append order (append order ≈ time order).
   * @param {Object} opts { studentsById, gradeBuildingMap }
   * @return {{visitors, studentsOff, late, moved, flags, counts}}
   */
  function derive(events, opts) {
    opts = opts || {};
    var studentsById = opts.studentsById || {};
    var gradeMap = opts.gradeBuildingMap || {};

    var visitorsOpen = {};   // visitor PersonKey -> visitor_in event
    var lastStudent = {};    // studentId -> { earlyOut?, returnIn?, lateIn?, movement? } latest per kind
    var openMismatch = 0;

    (events || []).forEach(function (e) {
      switch (e.Type) {
        case 'visitor_in':
          visitorsOpen[e.PersonKey] = e;
          break;
        case 'visitor_out':
          delete visitorsOpen[e.PersonKey];
          break;
        case 'student_late_in':
          (lastStudent[e.PersonKey] = lastStudent[e.PersonKey] || {}).lateIn = e;
          break;
        case 'student_early_out':
          if (e.PickupMatch !== 'mismatch') {
            var st = lastStudent[e.PersonKey] = lastStudent[e.PersonKey] || {};
            st.earlyOut = e;
            st.returnIn = null; // a fresh early-out supersedes an older return
          }
          break;
        case 'student_return_in':
          (lastStudent[e.PersonKey] = lastStudent[e.PersonKey] || {}).returnIn = e;
          break;
        case 'movement':
          (lastStudent[e.PersonKey] = lastStudent[e.PersonKey] || {}).movement = e;
          break;
        case 'pickup_flag':
          if (e.FlagStatus === 'open') openMismatch++;
          break;
        // volunteer_*/staff_* reserved: ignored until a flow exists
      }
    });

    function buildingOf_(e) {
      if (e.HomeBuilding) return e.HomeBuilding;
      var s = studentsById[e.PersonKey];
      return (s && gradeMap[s.grade]) || gradeMap[e.Grade] || 'Other';
    }

    var visitors = Object.keys(visitorsOpen).map(function (k) {
      var e = visitorsOpen[k];
      return { name: e.PersonName, badge: e.BadgeID, building: e.ToBuilding || 'Other',
               in: hhmmOf_(e.Timestamp), dest: e.Reason, eventId: e.EventID };
    });

    var studentsOff = [], late = [], moved = [];
    Object.keys(lastStudent).forEach(function (id) {
      var st = lastStudent[id];
      if (st.earlyOut && !st.returnIn) {
        studentsOff.push({
          id: id, name: st.earlyOut.PersonName, grade: st.earlyOut.Grade,
          building: buildingOf_(st.earlyOut), out: hhmmOf_(st.earlyOut.Timestamp),
          with: st.earlyOut.GuardianName || '', eventId: st.earlyOut.EventID
        });
        return; // off-campus dominates late/moved for the board
      }
      if (st.lateIn) {
        late.push({ id: id, name: st.lateIn.PersonName, grade: st.lateIn.Grade,
                    building: buildingOf_(st.lateIn), at: hhmmOf_(st.lateIn.Timestamp) });
      }
      if (st.movement) {
        var m = st.movement;
        // A trip is CLOSED by a return leg. 'returned' is what the kiosk's
        // "coming back" flow writes; 'arrived' is the movement doPost API's
        // documented sentinel — both must close, or a student who came back
        // would read as still out.
        var closed = m.Reason === 'returned' || m.Reason === 'arrived';
        moved.push({
          id: id, name: m.PersonName, grade: m.Grade,
          from: m.FromBuilding, to: m.ToBuilding,
          at: hhmmOf_(m.Timestamp),
          expectedBack: m.ExpectedBack || '',
          reason: closed ? '' : (m.Reason || ''),
          away: !closed,          // still in another building
          inTransit: !closed      // retained name; the board reads this
        });
      }
    });

    var counts = { visitors: visitors.length, studentsOff: studentsOff.length,
                   late: late.length, moved: moved.length, byBuilding: {} };
    function bump_(bld, key) {
      var b = counts.byBuilding[bld] = counts.byBuilding[bld] || { visitors: 0, off: 0, moved: 0 };
      b[key]++;
    }
    visitors.forEach(function (v) { bump_(v.building, 'visitors'); });
    studentsOff.forEach(function (s) { bump_(s.building, 'off'); });
    // Only students still AWAY shift a building count — that is the whole point
    // during a drill ("which building do I look in?"). Once they are back, the
    // homeroom-building assumption is correct again and needs no adjustment.
    moved.forEach(function (m) { if (m.away) bump_(m.to, 'moved'); });

    return { visitors: visitors, studentsOff: studentsOff, late: late, moved: moved,
             flags: { openMismatch: openMismatch }, counts: counts };
  }

  /** The Door-Sheet / board roll-up JSON (shape v1, docs/SCHEMA.md). */
  function buildRollup(presence, checkedAtIso) {
    return {
      v: 1,
      checkedAt: checkedAtIso,
      counts: presence.counts,
      visitors: presence.visitors.map(function (v) {
        return { n: v.name, badge: v.badge, bld: v.building, in: v.in, dest: v.dest };
      }),
      studentsOff: presence.studentsOff.map(function (s) {
        return { n: s.name, grade: s.grade, bld: s.building, out: s.out, with: s.with };
      }),
      // Only the students actually away — a lockdown roll-call needs to know who
      // is NOT where the roster says, not who already came back.
      moved: presence.moved.filter(function (m) { return m.away; }).map(function (m) {
        return { n: m.name, from: m.from, to: m.to, at: m.at,
                 back: m.expectedBack || '', why: m.reason || '' };
      }),
      flags: presence.flags
    };
  }

  return { derive: derive, buildRollup: buildRollup };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Presence;

/* ===================== logic/search.js ===================== */
'use strict';
/**
 * search.js — kiosk student search: fuzzy name matching with a deliberately
 * MINIMAL projection. Adapted from facts-directory-search Search.gs
 * searchPeople (2026-08-04) with the kiosk privacy constraints baked in:
 *   - query must be ≥ MIN_QUERY_CHARS after trimming
 *   - matches ONLY against the student's own name (+grade token) — never
 *     guardians, never teachers, never IDs/emails (roster-fishing surface)
 *   - returns at most MAX_RESULTS of {id, name, grade} — nothing else, ever
 */

/* global Fuzzy */

var Search = (function () {
  var MIN_QUERY_CHARS = 3;
  var MAX_RESULTS = 8;

  function ref_() {
    if (typeof module !== 'undefined') return require('./fuzzy.js');
    return Fuzzy; // GAS global, assigned by the time any endpoint runs
  }

  /** One matching pass. fuzzySets=null ⇒ exact substring only (the fast path).
   *  Records which name words matched by close spelling so a caller can
   *  highlight them differently from exact hits (FACTS Finder convention). */
  function matchPass_(students, tokens, fuzzySets) {
    var matches = [];
    (students || []).forEach(function (p) {
      var own = (p.name + ' | ' + p.grade).toLowerCase();
      var words = fuzzySets ? p.name.toLowerCase().split(/[\s,]+/) : null;
      var exactCount = 0;
      var fuzzyWords = {};
      var ok = tokens.every(function (t, i) {
        if (own.indexOf(t) !== -1) { exactCount++; return true; }
        if (!fuzzySets) return false;
        var hit = words.filter(function (w) { return fuzzySets[i][w]; });
        hit.forEach(function (w) { fuzzyWords[w] = true; });
        return hit.length > 0;
      });
      if (!ok) return;
      var nameLower = p.name.toLowerCase();
      var nameHits = tokens.filter(function (t) { return nameLower.indexOf(t) !== -1; }).length;
      matches.push({ p: p, allExact: exactCount === tokens.length, nameHits: nameHits,
                     fuzzyWords: Object.keys(fuzzyWords) });
    });
    return matches;
  }

  /** Close-spelling sets per token, built from the student-name vocabulary. */
  function buildFuzzySets_(F, students, tokens) {
    var vocab = {};
    (students || []).forEach(function (p) {
      p.name.split(/[\s,]+/).forEach(function (w) {
        if (w.length >= 2) vocab[w.toLowerCase()] = true;
      });
    });
    var vocabWords = Object.keys(vocab);
    return tokens.map(function (t) {
      var budget = F.budget(t);
      var set = {};
      if (budget) {
        vocabWords.forEach(function (w) {
          if (Math.abs(w.length - t.length) > budget) return;
          if (F.editDistance(t, w) <= budget) set[w] = true;
        });
      }
      return set;
    });
  }

  /**
   * @param {Array} students from Directory.buildStudents (enrolled only)
   * @param {string} query
   * @return {{query, ok:boolean, reason?:string, total:number, truncated:boolean,
   *           results:Array<{id,name,grade,close:boolean}>}}
   */
  function searchStudents(students, query) {
    var F = ref_();
    var q = String(query || '').trim();
    var out = { query: q, ok: false, total: 0, truncated: false, results: [] };
    if (q.replace(/\s+/g, '').length < MIN_QUERY_CHARS) {
      out.reason = 'short';
      return out;
    }
    out.ok = true;
    var tokens = q.toLowerCase().split(/\s+/).filter(function (t) { return t; });

    // FAST PATH: try exact substring matching first. Correctly-spelled names —
    // the overwhelming majority of kiosk searches — never pay for the
    // vocabulary build + edit-distance sweep, which only runs on a miss.
    var matches = matchPass_(students, tokens, null);
    if (!matches.length) {
      matches = matchPass_(students, tokens, buildFuzzySets_(F, students, tokens));
    }
    matches.sort(function (a, b) {
      return (b.allExact - a.allExact) || (b.nameHits - a.nameHits) ||
             (a.p.name < b.p.name ? -1 : a.p.name > b.p.name ? 1 : 0);
    });

    out.total = matches.length;
    out.truncated = matches.length > MAX_RESULTS;
    out.results = matches.slice(0, MAX_RESULTS).map(function (m) {
      return { id: m.p.id, name: m.p.name, grade: m.p.grade, close: !m.allExact };
    });
    return out;
  }

  /**
   * STAFF-SIDE filter (the muster roster), as opposed to searchStudents' kiosk
   * projection: no result cap, no 3-char floor, and it hands back the tokens and
   * close-spelling words so the page can mark exact hits green and close ones
   * yellow — the same convention as FACTS Finder. An empty query returns
   * everyone, so it doubles as the "no filter" path.
   * @param {Array} people any objects carrying {name, grade}
   * @return {{ok, query, tokens, total, results:Array}} results keep every
   *   original field, plus close:boolean and fuzzyWords:string[]
   */
  function filterPeople(people, query) {
    var F = ref_();
    var q = String(query || '').trim();
    var list = people || [];
    var out = { ok: true, query: q, tokens: [], total: list.length, results: list.slice() };
    if (!q) return out;

    var tokens = q.toLowerCase().split(/\s+/).filter(function (t) { return t; });
    out.tokens = tokens;
    var matches = matchPass_(list, tokens, null);          // exact first
    if (!matches.length) {                                  // then close spellings
      matches = matchPass_(list, tokens, buildFuzzySets_(F, list, tokens));
    }
    matches.sort(function (a, b) {
      return (b.allExact - a.allExact) || (b.nameHits - a.nameHits) ||
             (a.p.name < b.p.name ? -1 : a.p.name > b.p.name ? 1 : 0);
    });
    out.results = matches.map(function (m) {
      var row = {};
      for (var k in m.p) row[k] = m.p[k];
      row.close = !m.allExact;
      row.fuzzyWords = m.fuzzyWords;
      return row;
    });
    out.total = out.results.length;
    return out;
  }

  return { searchStudents: searchStudents, filterPeople: filterPeople,
           MIN_QUERY_CHARS: MIN_QUERY_CHARS, MAX_RESULTS: MAX_RESULTS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Search;

/* ===================== logic/metrics.js ===================== */
'use strict';
/**
 * metrics.js — the Metrics page's aggregation engine. Pure and unit-tested: the
 * server reads EVENTS once, this folds it, and the page renders the result.
 *
 * Why aggregate on the server rather than ship the whole log: a school year is
 * thousands of rows, and re-sending them on every filter change would make the
 * page feel worse the longer the school uses it. So the payload is small
 * summaries plus a CAPPED row list for the table and drill-down.
 *
 * SCHOOL YEAR: a year runs from the start month (default August) to the day
 * before the next start. So on 2026-09-08 "this school year" began 2026-08-01,
 * and "last school year" is 2025-08-01 … 2026-07-31.
 */

/* global EVENT_TYPES */

var Metrics = (function () {
  function ref_() {
    if (typeof module !== 'undefined') return require('./schema.js');
    return { EVENT_TYPES: EVENT_TYPES };
  }

  // The types the metrics page counts. pickup_flag is tracked separately: it is
  // a SAFETY signal, not a sign-out, and must never inflate dismissal counts.
  var COUNTED = ['student_late_in', 'student_early_out', 'student_return_in', 'visitor_in', 'movement'];

  var LABELS = {
    student_late_in: 'Late arrivals',
    student_early_out: 'Early dismissals',
    student_return_in: 'Returns',
    visitor_in: 'Visitors',
    movement: 'Movements'
  };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  /** Inclusive day-key range for a named preset. `today` is a Date. */
  function rangeFor(preset, today, startMonth) {
    var m = startMonth || 8;                       // 1-12; August by default
    var y = today.getFullYear();
    var d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    // Which school year does `today` fall in? Before the start month, it's the
    // year that began LAST calendar year.
    var syStart = new Date((today.getMonth() + 1 >= m) ? y : y - 1, m - 1, 1);

    switch (preset) {
      case 'week': {                               // Monday-based, week to date
        var dow = (d.getDay() + 6) % 7;            // Mon=0 … Sun=6
        var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
        return { from: ymd(mon), to: ymd(d), label: 'This week' };
      }
      case 'month':
        return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(d), label: 'This month' };
      case 'year':
        return { from: ymd(syStart), to: ymd(d), label: 'This school year' };
      case 'lastyear': {
        var prevStart = new Date(syStart.getFullYear() - 1, m - 1, 1);
        var prevEnd = new Date(syStart.getTime() - 86400000); // day before this year began
        return { from: ymd(prevStart), to: ymd(prevEnd), label: 'Last school year' };
      }
      case 'all':
        return { from: '0000-01-01', to: '9999-12-31', label: 'All time' };
      default:
        return { from: ymd(d), to: ymd(d), label: 'Today' };
    }
  }

  function inRange(dayKey, from, to) {
    return dayKey >= from && dayKey <= to;
  }

  function bump_(map, key) {
    if (!key) return;
    map[key] = (map[key] || 0) + 1;
  }

  /** {key,count} pairs sorted by count desc, then key — stable for the UI. */
  function toSorted(map) {
    return Object.keys(map).map(function (k) { return { key: k, count: map[k] }; })
      .sort(function (a, b) { return (b.count - a.count) || (a.key < b.key ? -1 : 1); });
  }

  /**
   * @param {Array<Object>} events EVENTS rows as objects (schema column names)
   * @param {Object} opts {from, to, maxRows=2000, types=null (array to keep)}
   * @return {Object} the whole page payload
   */
  function build(events, opts) {
    var R = ref_();
    opts = opts || {};
    var from = opts.from || '0000-01-01';
    var to = opts.to || '9999-12-31';
    var maxRows = opts.maxRows || 2000;
    var keepTypes = opts.types && opts.types.length ? opts.types : null;

    var kpi = { total: 0, flags: 0, students: 0, visitors: 0, days: 0, autoClosed: 0 };
    var byType = {}, byReason = {}, byBuilding = {}, byStation = {}, byGrade = {};
    var byHour = {}, byWeekday = {};
    var perDay = {};        // dayKey -> {type: n}
    var perStudent = {};    // personKey -> {name, grade, counts}
    var studentSeen = {};
    var daysSeen = {};
    var rows = [];
    var truncated = false;

    (events || []).forEach(function (e) {
      var day = String(e.Date || '').slice(0, 10);
      if (!day || !inRange(day, from, to)) return;

      // Auto-closed visitors are written as visitor_out, which COUNTED excludes,
      // so this has to be tallied BEFORE the type filter — behind it the counter
      // could never fire and the KPI read a permanent zero.
      if (String(e.Notes || '').indexOf('auto sign-out') !== -1) kpi.autoClosed++;

      // Safety signal, counted and surfaced on its own — never a dismissal.
      if (e.Type === 'pickup_flag') {
        kpi.flags++;
        daysSeen[day] = true;
        if (rows.length < maxRows) {
          rows.push(rowOf_(e, day));
        } else { truncated = true; }
        return;
      }
      if (COUNTED.indexOf(e.Type) === -1) return;            // visitor_out etc: the visit is counted at sign-in
      if (keepTypes && keepTypes.indexOf(e.Type) === -1) return;

      kpi.total++;
      daysSeen[day] = true;
      bump_(byType, e.Type);
      (perDay[day] = perDay[day] || {})[e.Type] = ((perDay[day] || {})[e.Type] || 0) + 1;

      if (e.Type === 'visitor_in') kpi.visitors++;
      if (e.Reason) bump_(byReason, String(e.Reason).split(' — ')[0]); // strip the free-text tail
      if (e.HomeBuilding || e.ToBuilding) bump_(byBuilding, e.HomeBuilding || e.ToBuilding);
      if (e.Station) bump_(byStation, e.Station);
      if (e.Grade) bump_(byGrade, e.Grade);

      var hm = /^\d{4}-\d{2}-\d{2} (\d{2}):/.exec(String(e.Timestamp || ''));
      if (hm) bump_(byHour, hm[1]);
      var dt = day.split('-');
      if (dt.length === 3) {
        var wd = new Date(Number(dt[0]), Number(dt[1]) - 1, Number(dt[2])).getDay();
        bump_(byWeekday, String(wd));
      }
      if (e.PersonType === 'student' && e.PersonKey) {
        if (!studentSeen[e.PersonKey]) { studentSeen[e.PersonKey] = true; kpi.students++; }
        var s = perStudent[e.PersonKey] = perStudent[e.PersonKey] ||
          { id: e.PersonKey, name: e.PersonName, grade: e.Grade, lateIn: 0, earlyOut: 0, total: 0 };
        s.name = e.PersonName || s.name;
        s.grade = e.Grade || s.grade;
        if (e.Type === 'student_late_in') s.lateIn++;
        if (e.Type === 'student_early_out') s.earlyOut++;
        s.total++;
      }

      if (rows.length < maxRows) rows.push(rowOf_(e, day));
      else truncated = true;
    });

    kpi.days = Object.keys(daysSeen).length;

    // Daily series, chronological and GAP-FILLED across the observed span so a
    // quiet day reads as zero rather than vanishing and flattering the trend.
    var dayKeys = Object.keys(perDay).sort();
    var daily = [];
    if (dayKeys.length) {
      var cur = new Date(dayKeys[0] + 'T00:00:00');
      var end = new Date(dayKeys[dayKeys.length - 1] + 'T00:00:00');
      var guard = 0;
      while (cur <= end && guard++ < 4000) {
        var k = ymd(cur);
        var got = perDay[k] || {};
        var rec = { date: k };
        COUNTED.forEach(function (t) { rec[t] = got[t] || 0; });
        daily.push(rec);
        cur = new Date(cur.getTime() + 86400000);
      }
    }

    var students = Object.keys(perStudent).map(function (k) { return perStudent[k]; })
      .sort(function (a, b) {
        return (b.total - a.total) || (b.earlyOut - a.earlyOut) ||
               (String(a.name) < String(b.name) ? -1 : 1);
      });

    return {
      range: { from: from, to: to },
      kpi: kpi,
      labels: LABELS,
      countedTypes: COUNTED.slice(),
      byType: toSorted(byType),
      byReason: toSorted(byReason),
      byBuilding: toSorted(byBuilding),
      byStation: toSorted(byStation),
      byGrade: toSorted(byGrade),
      byHour: toSorted(byHour).sort(function (a, b) { return a.key < b.key ? -1 : 1; }),
      byWeekday: toSorted(byWeekday).sort(function (a, b) { return Number(a.key) - Number(b.key); }),
      daily: daily,
      students: students,
      rows: rows,
      truncated: truncated
    };
  }

  function rowOf_(e, day) {
    return {
      date: day,
      time: (/^\d{4}-\d{2}-\d{2} (\d{2}:\d{2})/.exec(String(e.Timestamp || '')) || [, ''])[1],
      type: e.Type,
      name: e.PersonName,
      grade: e.Grade,
      building: e.HomeBuilding || e.ToBuilding || '',
      station: e.Station,
      reason: e.Reason,
      withWhom: e.GuardianName,
      match: e.PickupMatch,
      flag: e.FlagStatus
    };
  }

  return { build: build, rangeFor: rangeFor, COUNTED: COUNTED, LABELS: LABELS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Metrics;

/* ===================== logic/notify.js ===================== */
'use strict';
/**
 * notify.js — early-dismissal follow-up resolution. Pure decisions only; the
 * GAS side (Mailer / the pending-row alert bus) executes them.
 *
 * WHO IS IN SCOPE FOR MAIL (Josh, 2026-09-15): the front line, and homeroom
 * teachers up to grade 6. Above that boundary an early dismissal alerts the
 * board rather than emailing the teacher — 'dismissal.followup.maxgrade'.
 *
 * All four modes exist (Josh picks the live one in Settings later):
 *   email_teacher — resolve the student's teacher and email them
 *   office_alert  — mark the event FollowUpStatus=pending (board chime/toast)
 *   page_student  — pending row rendered as a PAGE card (staff taps Paged)
 *   record_only   — nothing
 * A pickup MISMATCH always alerts regardless of mode (decided in the API
 * layer by emitting pickup_flag with FollowUpStatus=pending — not here).
 */

var Notify = (function () {
  var MODES = ['email_teacher', 'office_alert', 'page_student', 'record_only'];

  /**
   * Resolve a student's teacher email.
   * Grades 7–12: Sheet1 'Homeroom Teacher' → Staff-tab email.
   * K5–6: Student Schedules Homeroom row → Staff tab, then ELC side-car.
   * @param {Object} student  from Directory.buildStudents
   * @param {Object} ctx { staffEmailFor:fn(name), hrByStudent:{}, elcEmails:{},
   *                        elcEmailFor?:fn(elcEmails, name) — Directory.elcEmailFor, which
   *                        understands 'Burge Angela' as well as 'Burge, Angela' }
   * @return {{teacherName, email, via:'staff'|'elc'|'none'}}
   */
  function resolveTeacherEmail(student, ctx) {
    var name = (student && student.homeroomTeacher) || (ctx.hrByStudent || {})[student && student.id] || '';
    if (!name) return { teacherName: '', email: '', via: 'none' };
    var email = ctx.staffEmailFor ? ctx.staffEmailFor(name) : '';
    if (email) return { teacherName: name, email: email, via: 'staff' };
    // The side-car is hand-kept, so the name in it may not be spelled the way
    // the schedules spell it. elcEmailFor tries every form; the flat key stays
    // as the fallback so a caller that does not pass it still behaves as before.
    email = ctx.elcEmailFor
      ? ctx.elcEmailFor(ctx.elcEmails, name)
      : ((ctx.elcEmails || {})[name.toLowerCase().replace(/\s+/g, '')] || '');
    if (email) return { teacherName: name, email: email, via: 'elc' };
    return { teacherName: name, email: '', via: 'none' };
  }

  /**
   * Decide the follow-up for an early dismissal.
   * @return {{mode, sendEmail?:{to,cc,teacherName}, pending:boolean, degraded?:string}}
   *   pending=true ⇒ the event row is written FollowUpStatus='pending' (alert bus).
   */
  function resolveFollowUp(settings, student, ctx) {
    var mode = (settings || {})['dismissal.followup.mode'] || 'record_only';
    if (MODES.indexOf(mode) === -1) mode = 'record_only';
    var cc = (settings || {})['dismissal.followup.cc'] || '';

    if (mode === 'email_teacher') {
      // Out of mail scope → the board still alerts, so nothing is LOST; the
      // front desk simply carries it instead of the teacher's inbox. Degrading
      // rather than falling silent is the whole point: a dismissal that
      // notified nobody would be worse than one that notified the wrong desk.
      if (!gradeInMailScope(settings, student && student.grade)) {
        return { mode: 'office_alert', pending: true, degraded: 'grade-out-of-mail-scope' };
      }
      var t = resolveTeacherEmail(student, ctx || {});
      if (t.email) return { mode: mode, sendEmail: { to: t.email, cc: cc, teacherName: t.teacherName }, pending: false };
      // Unresolvable teacher → degrade to office_alert and say so on the event.
      return { mode: 'office_alert', pending: true, degraded: 'teacher-unresolved' + (t.teacherName ? ':' + t.teacherName : '') };
    }
    if (mode === 'office_alert') return { mode: mode, pending: true };
    if (mode === 'page_student') return { mode: mode, pending: true };
    return { mode: 'record_only', pending: false };
  }

  /**
   * Is this grade one whose TEACHER we email?
   *
   * Josh, 2026-09-15: "for now, I only want the emails going to the front line
   * employees and the k4 thru 6th grade teachers." The 7-12 teachers are not
   * on the list yet, so their students' dismissals alert the board instead.
   * Kept as a Settings value, not a constant, because "for now" is doing real
   * work in that sentence — widening it later is one cell, not a deploy.
   */
  function gradeInMailScope(settings, grade) {
    var max = gradeNum((settings || {})['dismissal.followup.maxgrade'] || '6');
    return gradeNum(grade) <= max;
  }

  /** 'K4'/'K5' sort below grade 1; anything unreadable sorts to 0 (in scope),
   *  because an unknown grade is likelier to be a young child than a senior. */
  function gradeNum(token) {
    var t = String(token == null ? '' : token).trim().toUpperCase();
    if (t === 'K4' || t === 'K5' || t === 'K') return 0;
    var n = parseInt(t, 10);
    return isNaN(n) ? 0 : n;
  }

  return { MODES: MODES, resolveTeacherEmail: resolveTeacherEmail, resolveFollowUp: resolveFollowUp,
           gradeInMailScope: gradeInMailScope };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Notify;
