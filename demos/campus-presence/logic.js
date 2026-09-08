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

// Verbatim from campus-control monitoring (Monitor.js MONITOR_BUILDINGS +
// Dashboard.html BUILDING_ORDER) so presence reads consistently with the
// Monitoring board and the lockdown surfaces.
var BUILDINGS = ['High School', 'Elementary', 'Kindergarten', '6th Grade', 'Modular', 'Bus Barn', 'Other'];

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
var DEFAULT_DESK_GRADE_MAP = {
  'K4': 'el', 'K5': 'el', '1': 'el', '2': 'el', '3': 'el', '4': 'el', '5': 'el',
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
  // Reserved for later revisions (no v1 flow renders or accepts them):
  VOLUNTEER_IN: 'volunteer_in',
  VOLUNTEER_OUT: 'volunteer_out',
  STAFF_IN: 'staff_in',
  STAFF_OUT: 'staff_out'
};

var PERSON_TYPES = ['visitor', 'student', 'volunteer', 'staff']; // volunteer/staff reserved

var PICKUP_MATCH = ['matched', 'mismatch', 'override', 'n/a'];

var FOLLOWUP_MODES = ['email_teacher', 'office_alert', 'page_student', 'record_only'];

var STATION_IDS = ['hs', 'el', 'office', 'mobile']; // office = manual entries on the board; mobile = doPost movement devices

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
      { name: 'Source', tier: 'SYSTEM' }          // 'kiosk' | 'office' | 'system' | 'api'
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
      { name: 'AlertStation', tier: 'SYSTEM' }
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
  }
};

// Defaults seeded by RUN_bootstrapDb; the Settings tab value always wins at runtime.
var SETTINGS_DEFAULTS = {
  'dismissal.followup.mode': 'office_alert',      // FOLLOWUP_MODES — Josh picks the live mode at M6
  'dismissal.followup.cc': '',                    // fallback + cc address(es), comma-separated
  'dismissal.pickup.ui': 'type',                  // 'type' (never display contacts) | 'list'
  'late.parentdriven.maxgrade': '5',              // ≤ this grade token = parent signs the student in (Josh 2026-08-05: 6th self-serves like HS)
  'visitor.reasons': 'Meeting|Delivery|Maintenance|Family visit|Other',
  'late.reasons': 'Appointment|Overslept|Car trouble|Family|Other',
  'dismissal.reasons': 'Medical appointment|Family|Sports dismissal|Illness|Other',
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
   * Event ID: E-20260804-134210-4821. The 4-digit disambiguator is caller-supplied
   * (GAS: Math.floor(Math.random()*10000)); same-second collisions at 10–30
   * events/day are already vanishingly rare, the suffix makes them ignorable.
   */
  function makeEventId(d, disambig) {
    var n = ('000' + (disambig == null ? 0 : disambig)).slice(-4);
    return 'E-' + dayKey(d).replace(/-/g, '') + '-' +
      pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '-' + n;
  }

  return { dayKey: dayKey, timestamp: timestamp, hhmm: hhmm, makeEventId: makeEventId };
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
   * Staff email lookup by teacher display name. Staff tab has First/Last/Email;
   * teacher names elsewhere are 'Last, First'. Returns a matcher fn.
   */
  function staffEmailResolver(tabs) {
    var staff = tabByName(tabs, ['Staff']);
    var byKey = {};
    if (staff && (staff.values || []).length > 1) {
      var h = headerMap(staff.values[0]);
      for (var r = 1; r < staff.values.length; r++) {
        var row = staff.values[r];
        var first = cellToString(row[h['First Name']]).trim();
        var last = cellToString(row[h['Last Name']]).trim();
        var email = cellToString(row[h['Email']]).trim();
        if (!last || !email) continue;
        byKey[(last + ',' + first).toLowerCase().replace(/\s+/g, '')] = email;
      }
    }
    /** @param {string} teacherName 'Last, First' */
    return function (teacherName) {
      var key = String(teacherName || '').toLowerCase().replace(/\s+/g, '');
      return byKey[key] || '';
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
      if (name && email) out[name.toLowerCase().replace(/\s+/g, '')] = email;
    }
    return out;
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
    elcTeacherEmails: elcTeacherEmails
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
        moved.push({ id: id, name: m.PersonName, from: m.FromBuilding, to: m.ToBuilding,
                     at: hhmmOf_(m.Timestamp), inTransit: m.Reason !== 'arrived' });
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
    moved.forEach(function (m) { if (!m.inTransit) bump_(m.to, 'moved'); });

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
      moved: presence.moved.map(function (m) {
        return { n: m.name, from: m.from, to: m.to, at: m.at, transit: !!m.inTransit };
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
      if (String(e.Notes || '').indexOf('auto sign-out') !== -1) kpi.autoClosed++;

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
   * @param {Object} ctx { staffEmailFor:fn(name), hrByStudent:{}, elcEmails:{} }
   * @return {{teacherName, email, via:'staff'|'elc'|'none'}}
   */
  function resolveTeacherEmail(student, ctx) {
    var name = (student && student.homeroomTeacher) || (ctx.hrByStudent || {})[student && student.id] || '';
    if (!name) return { teacherName: '', email: '', via: 'none' };
    var email = ctx.staffEmailFor ? ctx.staffEmailFor(name) : '';
    if (email) return { teacherName: name, email: email, via: 'staff' };
    var key = name.toLowerCase().replace(/\s+/g, '');
    email = (ctx.elcEmails || {})[key] || '';
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
      var t = resolveTeacherEmail(student, ctx || {});
      if (t.email) return { mode: mode, sendEmail: { to: t.email, cc: cc, teacherName: t.teacherName }, pending: false };
      // Unresolvable teacher → degrade to office_alert and say so on the event.
      return { mode: 'office_alert', pending: true, degraded: 'teacher-unresolved' + (t.teacherName ? ':' + t.teacherName : '') };
    }
    if (mode === 'office_alert') return { mode: mode, pending: true };
    if (mode === 'page_student') return { mode: mode, pending: true };
    return { mode: 'record_only', pending: false };
  }

  return { MODES: MODES, resolveTeacherEmail: resolveTeacherEmail, resolveFollowUp: resolveFollowUp };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Notify;
