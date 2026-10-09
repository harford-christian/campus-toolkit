/* fan-logic.js — the Talon Hub fan app's OWN pure server modules, copied VERBATIM from
   athletics/talon-hub/apps/fan/server/lib/ (generated there from logic/*.js by the source
   project's `npm run build`). Nothing here is a demo reimplementation: mock.js hands the staff
   demo's fabricated SCHEDULE rows to FanView.publicSchedule — the same field-by-field whitelist the
   production publicSchedule endpoint applies — so what the fan page shows is exactly what the real
   whitelist lets out.

   Wrapped in one function scope; only window.TalonFanLogic is exported, so these modules' globals
   cannot collide with the page's own. GENERATED — do not hand-edit. Rebuild with:
     node demos/talon-hub/build-logic.mjs
   demos/talon-hub/verify.mjs fails if this bundle drifts from the source modules.
*/
(function (window) {

/* ===================== apps/fan/server/lib/schema.js ===================== */
/* GENERATED FILE — DO NOT HAND-EDIT.
 * Source of truth: logic/*.js and gas-shared/*.js (unit-tested in Node).
 * Regenerate with: npm run build
 */
'use strict';
/**
 * schema.js — THE single load-bearing definition of the TalonHub_DB data model.
 *
 * Four consumers, all reading this constant (the anti-drift mechanism):
 *   1. SheetGateway.bootstrapSheets_() creates tabs/headers from cols[].name order
 *   2. SheetGateway reads build their column-index maps from it
 *   3. projection.js filters rows and projects columns from cols[].tier
 *   4. tools/wrap.js regenerates docs/SCHEMA.md from it for human review
 *
 * Tiers (who a column may be serialized to):
 *   ALL    — parents, after row filtering to their own children
 *   STAFF  — coaches + admin only
 *   ADMIN  — Josh / AD only
 *   SYSTEM — never serialized to ANY client; visible only in the raw sheet
 *
 * rowScope (which rows a parent-tier caller may receive):
 *   athlete — only rows whose athleteCol value is in caller.athleteIds
 *   public  — all rows (columns still projected)
 *   staff   — no rows to parent-tier callers, ever
 *
 * GUARDIAN MODEL: guardians live in the GUARDIANS tab (N per athlete, one
 * primary), NOT as columns on ATHLETE_REGISTRY — FACTS split-household exports
 * routinely have 3+ guardians. Parents never receive GUARDIANS rows
 * (rowScope 'staff'); a caller learns only their OWN isPrimary flag, resolved
 * by requireParent_ from their guardianship lookup.
 */

var TIER = { ALL: 0, STAFF: 1, ADMIN: 2, SYSTEM: 3 };

var SCHEMA = {
  // School-wide staging table, refreshed weekly from the FACTS export. Coaches
  // search this and "add to team", which materializes ATHLETE_REGISTRY +
  // GUARDIANS + SPORT_ENROLLMENTS rows.
  DIRECTORY: {
    key: ['DirectoryKey'],
    rowScope: 'staff',
    cols: [
      { name: 'DirectoryKey', tier: 'STAFF' }, // student school email, else last-first-grade slug
      { name: 'StudentLast', tier: 'STAFF' },
      { name: 'StudentFirst', tier: 'STAFF' },
      { name: 'Grade', tier: 'STAFF' },
      { name: 'GradYear', tier: 'STAFF' },
      { name: 'StudentEmail', tier: 'STAFF' },
      { name: 'GuardiansJson', tier: 'STAFF' }, // [{name,email,household}] merged across FACTS rows
      { name: 'SourceRows', tier: 'STAFF' },
      { name: 'ImportedAt', tier: 'SYSTEM' },
      { name: 'Gender', tier: 'STAFF' } // from FACTS; gender-filters parent-recovered players onto gendered teams (append-at-end for the additive migration)
    ]
  },

  ATHLETE_REGISTRY: {
    key: ['AthleteID'],
    rowScope: 'athlete',
    athleteCol: 'AthleteID',
    cols: [
      { name: 'AthleteID', tier: 'ALL' },
      { name: 'FirstName', tier: 'ALL' },
      { name: 'LastName', tier: 'ALL' },
      { name: 'Grade', tier: 'ALL' },
      { name: 'GradYear', tier: 'ALL' },
      { name: 'Gender', tier: 'ALL' },
      { name: 'StudentEmail', tier: 'STAFF' },
      { name: 'DirectoryKey', tier: 'STAFF' },
      // Compliance booleans are ALL-tier: a parent should see (and be nudged
      // about) THEIR OWN child's outstanding forms. No PHI — booleans only.
      { name: 'PhysicalOnFile', tier: 'ALL' },
      { name: 'ConcussionFormOnFile', tier: 'ALL' }, // RETIRED 2026-07-24 — no surface reads/writes it; column stays (schema is append-only), do not remove/reorder
      { name: 'HandbookSigned', tier: 'ALL' },
      { name: 'Status', tier: 'STAFF' },
      { name: 'CoachNotes', tier: 'STAFF' },
      { name: 'DisciplineFlag', tier: 'ADMIN' },
      { name: 'RecruitingNotes', tier: 'ADMIN' },
      { name: 'CreatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedBy', tier: 'SYSTEM' },
      // Small downscaled headshot data URI (staff-uploaded). ALL tier: a parent
      // sees their own child's photo (row-filtered). Appended last so the
      // add-missing-columns migration can extend the live sheet safely.
      { name: 'PhotoThumb', tier: 'ALL' },
      // Physical expiry tracking (2026-08-20). Appended last so the
      // add-missing-columns migration extends the live sheet safely.
      // Dates are ALL-tier for the same reason the compliance booleans are: a
      // parent sees their own child's state (row-filtered). A date is not a
      // diagnosis. PhysicalDocRef is STAFF-tier AND must never be serialized —
      // the document itself is PHI and lives only in the Custom Forms Drive
      // folder. PhysicalOnFile above stays authoritative for "has one at all".
      { name: 'PhysicalDate', tier: 'ALL' },           // yyyy-MM-dd, as entered
      { name: 'PhysicalExpires', tier: 'ALL' },        // yyyy-MM-dd; blank = unknown, treated as ok
      { name: 'PhysicalSource', tier: 'STAFF' },       // customforms | jotform | staff
      { name: 'PhysicalDocRef', tier: 'STAFF' },       // Drive FILE ID only, never a URL
      { name: 'PhysicalSubmissionId', tier: 'SYSTEM' },// SUB-… or legacy:<key>; idempotency marker
      { name: 'PhysicalNoticeStage', tier: 'SYSTEM' }  // '' | '30' | '7' | '0'
    ]
  },

  // N guardians per athlete; exactly one IsPrimary=true (the alert target).
  // OTP identity = any Email here. Never serialized to parents.
  GUARDIANS: {
    key: ['GuardianID'],
    rowScope: 'staff',
    cols: [
      { name: 'GuardianID', tier: 'STAFF' }, // AthleteID + '#' + slug(email)
      { name: 'AthleteID', tier: 'STAFF' },
      { name: 'Name', tier: 'STAFF' },
      { name: 'Email', tier: 'STAFF' },
      { name: 'Phone', tier: 'STAFF' },
      { name: 'IsPrimary', tier: 'STAFF' },
      { name: 'Household', tier: 'STAFF' },
      { name: 'CanEditReturn', tier: 'STAFF' },
      { name: 'AddedAt', tier: 'SYSTEM' }
    ]
  },

  // Per-athlete profile. Parent-editable fields are ALL tier (written by the
  // parent app); uniform/gear fields are STAFF (written by the staff app).
  // Column-ownership doctrine: the two apps write different columns.
  PLAYER_PROFILE: {
    key: ['AthleteID'],
    rowScope: 'athlete',
    athleteCol: 'AthleteID',
    // Tier = VISIBILITY. Edit control is enforced by which endpoint writes a
    // field (parent setProfile vs staff setPlayerProfile), so several fields
    // are ALL-visible yet coach-edited-only. Column-ownership still holds:
    //   parent writes  PreferredName, SpiritWearSize, AthleteCellPhone,
    //                  NotesToCoach, ShoeSize
    //   staff writes   JerseySize, ShortsSize, WarmupSize, BackpackNumber,
    //                  EquipmentNotes, GearIssued
    cols: [
      { name: 'AthleteID', tier: 'ALL' },
      { name: 'PreferredName', tier: 'ALL' },       // parent-editable
      { name: 'SpiritWearSize', tier: 'ALL' },      // parent-editable
      { name: 'AthleteCellPhone', tier: 'ALL' },    // parent-editable
      { name: 'NotesToCoach', tier: 'ALL' },        // parent-editable
      { name: 'ShoeSize', tier: 'ALL' },            // parent-editable (moved from staff)
      { name: 'JerseySize', tier: 'ALL' },          // coach-edit, parent-visible
      { name: 'ShortsSize', tier: 'ALL' },          // coach-edit, parent-visible
      { name: 'WarmupSize', tier: 'ALL' },          // coach-edit, parent-visible
      { name: 'BackpackNumber', tier: 'ALL' },      // coach-edit, parent-visible (new)
      { name: 'EquipmentNotes', tier: 'ALL' },      // coach-edit, parent-visible
      { name: 'GearIssued', tier: 'STAFF' },        // coach-only, hidden from parents
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedBy', tier: 'SYSTEM' },
      // Parent-granted, season-long: may this student set their OWN travel plans
      // in the student app? (ALL tier so the student reads their own grant.)
      { name: 'StudentTravelSelf', tier: 'ALL' },
      // Handbook dual-acceptance (2026-07): BOTH the player (student app) and
      // ANY one guardian (parent app) must accept the sports excerpt before
      // ATHLETE_REGISTRY.HandbookSigned flips true. AckAt timestamps are ALL so
      // each side sees the other's status; AckBy emails stay SYSTEM (a parent
      // must never see which specific guardian accepted — just "a parent did").
      //   student writes HandbookPlayerAckAt/By; parent writes HandbookParentAckAt/By
      { name: 'HandbookPlayerAckAt', tier: 'ALL' },
      { name: 'HandbookParentAckAt', tier: 'ALL' },
      { name: 'HandbookPlayerAckBy', tier: 'SYSTEM' },
      { name: 'HandbookParentAckBy', tier: 'SYSTEM' }
    ]
  },

  // Team-PRIVATE coaching record: one per athlete per team. Only that team's
  // coaches (or Admin) may read/write it — enforced by requireTeamAccess_ on the
  // endpoints (projection is tier-only). rowScope 'staff' keeps it out of the
  // parent app entirely. Crosses to another team ONLY via an explicit release
  // snapshot (CAREER_RELEASE). Supersedes the dormant global ATHLETE_REGISTRY.CoachNotes.
  COACH_RECORD: {
    key: ['AthleteID', 'TeamID'],
    rowScope: 'staff',
    cols: [
      { name: 'AthleteID', tier: 'STAFF' },
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'Sport', tier: 'STAFF' },
      { name: 'CoachEval', tier: 'STAFF' },       // free-text career notes / evaluation
      { name: 'SkillRatings', tier: 'STAFF' },     // lightweight ratings (text/JSON for now)
      { name: 'RoleNotes', tier: 'STAFF' },        // position / role writeup
      { name: 'HandoffSummary', tier: 'STAFF' },   // "for the next coach" summary
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedBy', tier: 'SYSTEM' }
    ]
  },

  // Frozen consent snapshot: the coaching-record fields a coach chose to release
  // upward (e.g. MS → Varsity at promotion). One per athlete per source team;
  // re-releasing overwrites. The receiving coach reads this (never the live
  // COACH_RECORD of a team they don't coach). rowScope 'staff' → never to parents.
  CAREER_RELEASE: {
    key: ['AthleteID', 'FromTeamID'],
    rowScope: 'staff',
    cols: [
      { name: 'AthleteID', tier: 'STAFF' },
      { name: 'FromTeamID', tier: 'STAFF' },
      { name: 'FromSport', tier: 'STAFF' },
      { name: 'FromLevel', tier: 'STAFF' },
      { name: 'FromLabel', tier: 'STAFF' },
      { name: 'FieldsJson', tier: 'STAFF' },     // released field keys (empty = withdrawn)
      { name: 'SnapshotJson', tier: 'STAFF' },   // frozen field values at release time
      { name: 'ReleasedBy', tier: 'STAFF' },
      { name: 'ReleasedAt', tier: 'SYSTEM' }
    ]
  },

  // ---- Tryouts (all rowScope 'staff' → never serialized to parents) ----------
  // Single-writer doctrine, corrected 2026-08-25 (event-builder spec §1b): the
  // staff app owns every column of TRYOUT_EVENTS; the anonymous TRYOUT app may
  // CREATE rows (evaluator-authored events) and may WRITE the format columns
  // an evaluator's Format Editor owns — Name, InputType, ConfigJson,
  // MaxPoints, Weight, AllEvaluators, DayKey, SetupNotes, Equipment. TRYOUTS,
  // TRYOUT_CANDIDATES, TRYOUT_FINALS, TRYOUT_BLOCKS and TRYOUT_DAYS remain
  // staff-only. The tryout app also owns TRYOUT_SCORES + AUDIT_TRYOUT outright.
  TRYOUTS: {
    key: ['TryoutID'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'Name', tier: 'STAFF' },
      { name: 'Sport', tier: 'STAFF' },
      { name: 'Season', tier: 'STAFF' },
      { name: 'TeamID', tier: 'STAFF' },        // target team for kept players
      { name: 'Status', tier: 'STAFF' },        // Setup | Open | Closed
      { name: 'EvalCode', tier: 'STAFF' },      // access code evaluators enter
      { name: 'CreatedBy', tier: 'SYSTEM' },
      { name: 'CreatedAt', tier: 'SYSTEM' },
      { name: 'TiersJson', tier: 'STAFF' },     // [{tier,teamId,cap?}] cut tiers; empty → default Keep/Cut
      // Family-facing results gate (2026-08-22). Nothing about a tryout reaches a
      // player or parent until a coach flips this — scores must not be watchable
      // while the coach is still deciding. Appended last (schema is append-only).
      { name: 'ResultsPublished', tier: 'STAFF' },    // TRUE → families may see their OWN results
      { name: 'ResultsPublishedAt', tier: 'SYSTEM' },
      { name: 'ResultsPublishedBy', tier: 'SYSTEM' },
      // A coach-written line shown at the top of every family's results page —
      // e.g. "make-ups are next week". The app can infer THAT results are
      // provisional; only the coach knows when they stop being provisional.
      { name: 'ResultsNote', tier: 'STAFF' }
    ]
  },

  TRYOUT_EVENTS: {
    key: ['TryoutID', 'EventKey'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'EventKey', tier: 'STAFF' },
      { name: 'Name', tier: 'STAFF' },
      { name: 'InputType', tier: 'STAFF' },     // ladder | bucket | ratedTally | manual
      { name: 'ConfigJson', tier: 'STAFF' },    // scoring rule (reduce/map/max/cohort)
      { name: 'MaxPoints', tier: 'STAFF' },
      { name: 'Weight', tier: 'STAFF' },        // per-event multiplier (default 1)
      { name: 'EventOrder', tier: 'STAFF' },
      { name: 'AllEvaluators', tier: 'STAFF' }, // true = scrimmage-style (everyone scores)
      { name: 'Active', tier: 'STAFF' },
      { name: 'DayKey', tier: 'STAFF' },        // which tryout day this event is scored on ('' = ungrouped)
      // How to RUN the event — shown to whoever is scoring it (the "ⓘ How to run
      // this" panel) and rolled up into the day's setup/equipment list.
      // APPENDED LAST so gwAddMissingColumns_ appends without shifting columns.
      { name: 'SetupNotes', tier: 'STAFF' },    // dimensions + execution ("two cones 20m apart…")
      { name: 'Equipment', tier: 'STAFF' },     // comma-separated ("2 cones, stopwatch, speaker")
      { name: 'DiagramUrl', tier: 'STAFF' },    // optional image link
      { name: 'LinksJson', tier: 'STAFF' },     // [{label,url}] demo videos
      // APPENDED LAST (2026-08-24) so gwAddMissingColumns_ adds it to the LIVE
      // tab without shifting a single existing column. BLANK READS TRUE — every
      // pre-existing row must keep counting, so the day this ships no rank moves.
      { name: 'CountsInStandings', tier: 'STAFF' } // false = recorded + visible to coaches, but out of the ranking and hidden from families
    ]
  },

  TRYOUT_CANDIDATES: {
    key: ['TryoutID', 'CandidateID'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'CandidateID', tier: 'STAFF' },   // minted CAND-<TryoutID>-<seq>
      { name: 'FirstName', tier: 'STAFF' },
      { name: 'LastName', tier: 'STAFF' },
      { name: 'Grade', tier: 'STAFF' },
      { name: 'DirectoryKey', tier: 'STAFF' },  // nullable — walk-ons have none
      { name: 'Number', tier: 'STAFF' },        // bib / jersey number
      { name: 'Decision', tier: 'STAFF' },      // '' | tier name (default Keep|Cut; TiersJson defines others)
      { name: 'DecidedBy', tier: 'STAFF' },
      { name: 'AddedAt', tier: 'SYSTEM' },
      { name: 'CoachEval', tier: 'STAFF' },     // coach narrative write-up per candidate
      { name: 'EvalBy', tier: 'STAFF' },
      { name: 'EvalAt', tier: 'SYSTEM' },
      { name: 'Position', tier: 'STAFF' },      // 'GK' → ranked on the goalkeeper list (gkOnly events)
      // Shareable feedback (2026-08-22). DISTINCT from CoachEval above, which stays
      // candid and staff-only: this is written FOR the family and is the only note
      // text the results endpoint will ever emit. STAFF-tier so no projection can
      // leak it by accident — it reaches a family only through the computed
      // tryout-results payload, and only for their own athlete.
      { name: 'Feedback', tier: 'STAFF' },
      { name: 'FeedbackBy', tier: 'SYSTEM' },
      { name: 'FeedbackAt', tier: 'SYSTEM' },
      // Did this player actually COMPETE? (2026-08-23) Decision says Keep/Cut but
      // could never say 'didn't take part' — so a JV-only player, or one who
      // pulled out mid-week, still ranked against everyone. 'Withdrawn' keeps the
      // row, the scores and the notes; it only removes them from standings, the
      // anonymised peer field, the missing-scores badge and finalize. Blank =
      // Active, so every existing row keeps competing.
      { name: 'Participation', tier: 'STAFF' },      // '' | 'Active' | 'Withdrawn'
      { name: 'ParticipationBy', tier: 'SYSTEM' },
      { name: 'ParticipationAt', tier: 'SYSTEM' }
    ]
  },

  // Written ONLY by the anonymous tryout app; append-only (no lock) so many
  // evaluators can score at once — reads dedup to latest At per key.
  TRYOUT_SCORES: {
    key: ['TryoutID', 'EventKey', 'CandidateID', 'EvaluatorID'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'EventKey', tier: 'STAFF' },
      { name: 'CandidateID', tier: 'STAFF' },
      { name: 'EvaluatorID', tier: 'STAFF' },
      { name: 'EvaluatorName', tier: 'STAFF' },
      { name: 'RawJson', tier: 'STAFF' },       // raw inputs entered
      { name: 'Points', tier: 'STAFF' },        // computed at write (intermediate for cohort events)
      { name: 'Rating', tier: 'STAFF' },        // scrimmage quick rating
      { name: 'Note', tier: 'STAFF' },
      { name: 'At', tier: 'SYSTEM' }
    ]
  },

  // Head-coach final override per event/candidate (staff-owned, keeps scores single-writer).
  TRYOUT_FINALS: {
    key: ['TryoutID', 'EventKey', 'CandidateID'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'EventKey', tier: 'STAFF' },
      { name: 'CandidateID', tier: 'STAFF' },
      { name: 'FinalPoints', tier: 'STAFF' },
      { name: 'SetBy', tier: 'STAFF' },
      { name: 'SetAt', tier: 'SYSTEM' }
    ]
  },

  AUDIT_TRYOUT: {
    key: [],
    rowScope: 'staff',
    cols: [
      { name: 'At', tier: 'SYSTEM' },
      { name: 'Fn', tier: 'SYSTEM' },
      { name: 'Actor', tier: 'SYSTEM' },
      { name: 'Detail', tier: 'SYSTEM' }
    ]
  },

  // Multi-day tryout week agenda (staff-owned). Seeded by sport (soccer = Josh's
  // 5-day week); each TRYOUT_EVENTS row's DayKey ties a scored event to a day.
  TRYOUT_DAYS: {
    key: ['TryoutID', 'DayKey'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'DayKey', tier: 'STAFF' },        // D1..D5
      { name: 'Label', tier: 'STAFF' },
      { name: 'Date', tier: 'STAFF' },
      { name: 'DayOrder', tier: 'STAFF' },
      { name: 'SessionsJson', tier: 'STAFF' },  // [{time,title,detail}] agenda
      { name: 'Active', tier: 'STAFF' },
      { name: 'UpdatedBy', tier: 'STAFF' },
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      // APPENDED LAST 2026-08-16 (designer) — run RUN_addMissingColumns.
      { name: 'Locked', tier: 'STAFF' }         // '1' → day plan locked in the designer (edits refused until unlocked)
    ]
  },

  // Per-candidate per-day check-in (staff-owned).
  // The tryout week's PEOPLE (coaches/helpers/specialists). StaffID is a stable
  // SLOT token ('HC','AC','GK','H1'..'H4', or custom) — block assignments
  // reference slots, so swapping the person in a slot (or bulk-reassigning a
  // slot's duties when a helper drops) never rewrites the plan itself.
  TRYOUT_STAFF: {
    key: ['TryoutID', 'StaffID'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'StaffID', tier: 'STAFF' },       // slot token
      { name: 'Name', tier: 'STAFF' },
      { name: 'Role', tier: 'STAFF' },          // Coach | Helper | Specialist
      { name: 'Days', tier: 'STAFF' },          // '*' or CSV of DayKeys (Trevor P. = 'D4')
      { name: 'Active', tier: 'STAFF' },
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'Email', tier: 'STAFF' },         // where the evaluator invite goes
      { name: 'InvitedAt', tier: 'SYSTEM' },    // invite-sent stamp (green check in the crew card)
      { name: 'LastSeenAt', tier: 'SYSTEM' }    // last login/score from this slot (live board)
    ]
  },

  // The structured day plan: every time block of the tryout week (setup,
  // sessions, station rotations, breaks), with location, the player-facing
  // "what", linked scored events, and per-slot assignments. Modeled 1:1 on
  // Josh's 2025 operations doc (docs/tryout-docs/Varsity Soccer Tryouts
  // (2025-2026).pdf). Staff app is the only writer.
  TRYOUT_BLOCKS: {
    key: ['TryoutID', 'BlockID'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'BlockID', tier: 'STAFF' },
      { name: 'DayKey', tier: 'STAFF' },        // ties to TRYOUT_DAYS
      { name: 'StartTime', tier: 'STAFF' },     // display string ('6:15 PM')
      { name: 'EndTime', tier: 'STAFF' },
      { name: 'Title', tier: 'STAFF' },
      { name: 'Category', tier: 'STAFF' },      // e.g. 'Physical Fitness', 'Technical Skills'
      { name: 'What', tier: 'STAFF' },          // player-facing description
      { name: 'Location', tier: 'STAFF' },      // Lower Field | Upper Field | Trail | …
      { name: 'Kind', tier: 'STAFF' },          // setup | session | station | break
      { name: 'ParentBlockID', tier: 'STAFF' }, // stations nest under their rotation block
      { name: 'EventKeysJson', tier: 'STAFF' }, // linked scored TRYOUT_EVENTS keys
      { name: 'AssignmentsJson', tier: 'STAFF' },// [{slot,task}] — slot = TRYOUT_STAFF.StaffID
      { name: 'BlockOrder', tier: 'STAFF' },
      { name: 'Active', tier: 'STAFF' },
      { name: 'UpdatedBy', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'Equipment', tier: 'STAFF' }      // NON-event gear this block needs (pinnies, coolers, goals)
    ]
  },

  TRYOUT_ATTENDANCE: {
    key: ['TryoutID', 'CandidateID', 'DayKey'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'CandidateID', tier: 'STAFF' },
      { name: 'DayKey', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },        // Present | Absent | Late | Excused
      { name: 'By', tier: 'STAFF' },
      { name: 'At', tier: 'SYSTEM' }
    ]
  },

  // Program-wide lost & found board. rowScope 'public' → every parent browses
  // all open items. Single-appender doctrine: the STAFF app is the only writer
  // that APPENDS + owns Description/FoundWhere/When/Photo/Status/PostedBy; the
  // PARENT app only UPDATES its own claim cells (Claimed/ClaimedBy*) on an
  // existing row — no cell has two writers. Who-claimed is STAFF-tier so other
  // parents see only that an item is claimed, never by whom.
  LOST_FOUND: {
    key: ['ItemID'],
    rowScope: 'public',
    cols: [
      { name: 'ItemID', tier: 'ALL' },
      { name: 'Description', tier: 'ALL' },
      { name: 'FoundWhere', tier: 'ALL' },
      { name: 'FoundWhen', tier: 'ALL' },
      { name: 'PhotoThumb', tier: 'ALL' },
      { name: 'Status', tier: 'ALL' },          // Open | Returned (staff-written)
      { name: 'Claimed', tier: 'ALL' },          // bool (parent-written)
      { name: 'PostedBy', tier: 'STAFF' },
      { name: 'PostedAt', tier: 'SYSTEM' },
      { name: 'ClaimedByName', tier: 'STAFF' },   // parent-written
      { name: 'ClaimedByEmail', tier: 'STAFF' },  // parent-written
      { name: 'ClaimedAt', tier: 'SYSTEM' },      // parent-written
      { name: 'Season', tier: 'ALL' }             // set at post → board is scoped to the current season (cross-sport within it)
    ]
  },

  // Announcement board — admin/coach posts shown as a dismissible top banner in
  // every app. rowScope 'public' → reaches all; the bundle does audience/expiry
  // filtering (filterRows only knows athlete/public/staff, not team-scoped).
  // Single writer = the STAFF app.
  ANNOUNCEMENTS: {
    key: ['AnnouncementID'],
    rowScope: 'public',
    cols: [
      { name: 'AnnouncementID', tier: 'ALL' },
      { name: 'Audience', tier: 'ALL' },        // Program | Team
      { name: 'TeamID', tier: 'ALL' },          // blank when Program-wide
      { name: 'Title', tier: 'ALL' },
      { name: 'Body', tier: 'ALL' },
      { name: 'Severity', tier: 'ALL' },        // info | urgent
      { name: 'CreatedAt', tier: 'ALL' },
      { name: 'ExpiresAt', tier: 'ALL' },        // yyyy-MM-dd or blank (never)
      { name: 'PostedByName', tier: 'ALL' },
      { name: 'PostedByEmail', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },         // Active | Removed (builder filters before projecting)
      // Per-recipient audience toggles (Announcements.active filters on these).
      // APPENDED LAST so gwAddMissingColumns_ appends without shifting columns.
      // Blank = default: shown to players/parents, hidden from fans (back-compat).
      { name: 'ShowPlayers', tier: 'ALL' },      // '1' default on
      { name: 'ShowParents', tier: 'ALL' },      // '1' default on
      { name: 'ShowFans', tier: 'ALL' },         // '' default OFF (opt-in for the public board)
      // Several teams at once (2026-08-23): an AD announcing to three sports had
      // to choose between ONE team and the ENTIRE program. CSV of TeamIDs; blank
      // falls back to the single TeamID above, so every existing row keeps
      // working untouched.
      { name: 'TeamIDs', tier: 'ALL' },
      // [{name,url}] of coach-attached files (public Drive links — the team-photo
      // pattern). ALL tier: rows are already audience-gated; the links inside are
      // anyone-with-link by construction. APPENDED LAST.
      { name: 'AttachmentsJson', tier: 'ALL' }
    ]
  },

  // Event item sign-up ("who's bringing what" — e.g. the tryout overnight
  // cookout). Cell ownership (sanctioned split, like ATTENDANCE): the STAFF app
  // appends lists + seeded items and writes Label/Category/Status; the PARENT
  // and STUDENT apps write ONLY the Claimed* columns (atomic gwClaimIfEmpty)
  // and append their own Custom='1' "Other" rows. Families never see WHO
  // claimed — ClaimedByName is STAFF-tier by design (privacy call, Josh 2026-08).
  POTLUCK_LISTS: {
    key: ['ListID'],
    rowScope: 'public',
    cols: [
      { name: 'ListID', tier: 'ALL' },
      { name: 'Title', tier: 'ALL' },
      { name: 'EventDate', tier: 'ALL' },        // display string (e.g. "Fri Aug 15 – Sat Aug 16")
      { name: 'Status', tier: 'ALL' },           // Draft | Open | Closed
      { name: 'AnnouncementID', tier: 'SYSTEM' },// the auto-posted announcement; retired on close
      { name: 'CreatedBy', tier: 'SYSTEM' },
      { name: 'CreatedAt', tier: 'SYSTEM' },
      // Event-atom reorg (2026-08-16). APPENDED LAST — run RUN_addMissingColumns.
      // Blank TeamID = program-wide (the pre-migration legacy list keeps working).
      { name: 'TeamID', tier: 'ALL' },           // scoping: only this team's families see/claim; one Open list PER TEAM
      { name: 'EventID', tier: 'ALL' },          // optional SCHEDULE link — renders on the event, dies with it
      { name: 'EventDateISO', tier: 'ALL' },     // machine 'yyyy-MM-dd' — enables auto-retire (EventDate stays the display string)
      { name: 'Season', tier: 'STAFF' },         // stamped at create; blank = legacy — drives season archive
      // A sign-up list can carry a photo and a note — what turns "who's bringing
      // what" into a spirit-shirt store: a picture of the shirt and how to pay
      // (Venmo). ALL tier so families see both. APPENDED LAST — run
      // RUN_addMissingColumns.
      { name: 'ImageUrl', tier: 'ALL' },         // public Drive link (the announcement-attachment pattern)
      { name: 'Note', tier: 'ALL' },             // free text shown under the title (e.g. "$15 each · Venmo @HCS-Soccer")
      // A SALE (spirit wear) vs a plain cookout SIGN-UP, and multi-team scope so
      // one sale reaches JV + Varsity families at once. APPENDED LAST — run
      // RUN_addMissingColumns.
      { name: 'Kind', tier: 'ALL' },             // '' | 'signup' | 'sale'
      { name: 'TeamIDsCsv', tier: 'ALL' }        // CSV of TeamIDs; when set, visibility/announce span all of them (TeamID stays the first, for legacy single-team code)
    ]
  },

  POTLUCK_ITEMS: {
    key: ['ItemID'],
    rowScope: 'public',
    cols: [
      { name: 'ItemID', tier: 'ALL' },
      { name: 'ListID', tier: 'ALL' },
      { name: 'Category', tier: 'ALL' },         // one of Potluck.CATEGORIES
      { name: 'Label', tier: 'ALL' },
      { name: 'Claimed', tier: 'ALL' },          // '1' | '' — the crossed-off flag families see
      { name: 'ClaimedByName', tier: 'STAFF' },  // coach view only — families see "✓ Covered", never who
      { name: 'ClaimedByEmail', tier: 'SYSTEM' },// authoritative claim owner (unclaim-own check)
      { name: 'ClaimedAt', tier: 'SYSTEM' },
      { name: 'Custom', tier: 'ALL' },           // '1' = added via "Other"
      { name: 'Status', tier: 'ALL' },           // Open | Removed
      { name: 'CreatedAt', tier: 'SYSTEM' }
    ]
  },

  // Quick team polls (coach asks, families/players answer one option per
  // athlete — "who needs a ride from school to the scrimmage?"). Appending
  // apps: staff writes POLLS; parent AND student write POLL_RESPONSES via
  // key-matched gwUpsert (cross-project race tolerated — reads are FIRST-row-
  // wins per PollID+AthleteID, matching upsert's update target).
  POLLS: {
    key: ['PollID'],
    rowScope: 'public',
    cols: [
      { name: 'PollID', tier: 'ALL' },
      { name: 'TeamID', tier: 'ALL' },
      { name: 'Question', tier: 'ALL' },
      { name: 'OptionsJson', tier: 'ALL' },      // JSON array of option labels (2–6)
      { name: 'AllowNote', tier: 'ALL' },        // '1' → responders may attach a short note
      { name: 'Status', tier: 'ALL' },           // Open | Closed (builders show Open only)
      { name: 'CreatedAt', tier: 'ALL' },        // display string, America/New_York
      { name: 'CreatedByName', tier: 'ALL' },
      { name: 'CreatedByEmail', tier: 'STAFF' },
      { name: 'ClosedAt', tier: 'STAFF' },
      // Deadline + auto-remind (2026-08-15). APPENDED LAST — run RUN_addMissingColumns.
      { name: 'Deadline', tier: 'ALL' },         // 'yyyy-MM-dd HH:mm' NY or '' (never); past-deadline = answers locked, card hidden
      { name: 'AutoRemind', tier: 'STAFF' },     // '1' → daily 5pm sweep emails non-responders until answered/closed/deadline
      { name: 'LastRemindAt', tier: 'STAFF' },   // sweep stamp — one auto-reminder per day max
      { name: 'ShowTotals', tier: 'ALL' },       // '1' → families/players see live ANONYMOUS counts (never names)
      { name: 'IncludePending', tier: 'STAFF' }, // '1' → audience also includes Pending ("Trying out") athletes — preseason polls reach tryout families
      // Event-atom reorg (2026-08-16). APPENDED LAST — run RUN_addMissingColumns.
      { name: 'EventID', tier: 'ALL' },          // optional SCHEDULE link — poll renders ON the event, deadline defaults to it, auto-closes after it
      { name: 'Season', tier: 'STAFF' },         // stamped at create (CurrentSeason); blank = legacy — drives season archive
      // [{name,url,mimeType}] of coach-attached files — same public-Drive
      // pattern as ANNOUNCEMENTS.AttachmentsJson, rendered by the same
      // TalonUI.attachmentsHtml (images inline, everything else a link).
      // "Which of these two designs?" needs to SHOW the two designs.
      // ALL tier: the poll row is already audience-gated, and the links inside
      // are anyone-with-link by construction. APPENDED LAST.
      { name: 'AttachmentsJson', tier: 'ALL' }
    ]
  },

  POLL_RESPONSES: {
    key: ['PollID', 'AthleteID'],
    rowScope: 'athlete',                         // families see ONLY their own kids' answers
    athleteCol: 'AthleteID',
    cols: [
      { name: 'PollID', tier: 'ALL' },
      { name: 'AthleteID', tier: 'ALL' },
      { name: 'Choice', tier: 'ALL' },           // must equal one OptionsJson label
      { name: 'Note', tier: 'ALL' },
      { name: 'ByName', tier: 'STAFF' },         // who answered (parent name / player) — coach view only
      { name: 'ByEmail', tier: 'SYSTEM' },
      { name: 'At', tier: 'STAFF' }              // display string, America/New_York
    ]
  },

  // Crew self-reporting during a live tryout: "✓ I'm in position" at a remote
  // station, "done" on a setup block. Owned by the TRYOUT app (the staff app
  // owns TRYOUT_BLOCKS, so a helper tapping done must not write there).
  TRYOUT_CREW_STATUS: {
    key: ['TryoutID', 'DayKey', 'BlockID', 'Slot'],
    rowScope: 'staff',
    cols: [
      { name: 'TryoutID', tier: 'STAFF' },
      { name: 'DayKey', tier: 'STAFF' },
      { name: 'BlockID', tier: 'STAFF' },
      { name: 'Slot', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },   // ready | done | '' (cleared)
      { name: 'At', tier: 'STAFF' }
    ]
  },

  TEAMS: {
    key: ['TeamID'],
    rowScope: 'staff',
    cols: [
      { name: 'TeamID', tier: 'STAFF' }, // e.g. SOC-BV-F26
      { name: 'Sport', tier: 'STAFF' },
      { name: 'Level', tier: 'STAFF' },
      { name: 'Gender', tier: 'STAFF' },
      { name: 'Season', tier: 'STAFF' },
      { name: 'CalendarId', tier: 'STAFF' },
      { name: 'CoachEmails', tier: 'STAFF' },
      { name: 'Active', tier: 'STAFF' },
      { name: 'Phase', tier: 'STAFF' },    // Preseason | InSeason | Offseason | Complete (drives visibility; Active mirrors Phase!=='Complete')
      { name: 'GradeMin', tier: 'STAFF' }, // eligibility floor (e.g. MS=6); blank = no floor
      { name: 'GradeMax', tier: 'STAFF' }, // eligibility ceiling (e.g. MS=8); rollover promotes players above this OUT instead of carrying them
      { name: 'GradeTiersJson', tier: 'STAFF' }, // per-grade tier map {"5":"N","6":"A",...,"12":"P"} P=Preferred A=Allowable N=Not-Authorized; coach-set (GradeTiers). Empty → falls back to the GradeMin/GradeMax band.
      { name: 'StreamUrl', tier: 'STAFF' }, // per-team default livestream (XBotGo→YouTube channel /live). A game with no own LiveStreamUrl inherits this during its live window.
      { name: 'TeamPhotoUrl', tier: 'STAFF' }, // coach-uploaded team photo (public Drive link); used on team pages later.
      { name: 'ShowPracticesPublic', tier: 'STAFF' }, // '1' → this team's Practice events also appear on the PUBLIC fan calendar (else games-only). Per-team opt-in so a new sport can't leak its practice times/locations.
      // Team managers (student managers / stat keepers), CSV of school emails.
      // Deliberately SEPARATE from CoachEmails: everything that gates on
      // requireTeamAccess_ — roster, settings, announcements, tryouts — reads
      // CoachEmails only, so a manager can never reach any of it. A coach adds
      // their own; see epSetTeamManager_. APPENDED LAST.
      { name: 'ManagerEmails', tier: 'STAFF' }
    ]
  },

  SPORT_ENROLLMENTS: {
    key: ['EnrollmentID'],
    rowScope: 'athlete',
    athleteCol: 'AthleteID',
    cols: [
      { name: 'EnrollmentID', tier: 'ALL' },
      { name: 'AthleteID', tier: 'ALL' },
      { name: 'TeamID', tier: 'ALL' },
      { name: 'Sport', tier: 'ALL' },
      { name: 'Gender', tier: 'ALL' },
      { name: 'Season', tier: 'ALL' },
      { name: 'Level', tier: 'ALL' },
      { name: 'JerseyNumber', tier: 'ALL' },
      { name: 'Position', tier: 'ALL' },
      { name: 'Status', tier: 'STAFF' }, // Enrolled|Pending|Withdrawn — raw stays STAFF; families get the DERIVED "Trying out" state for Pending via logic/candidacy.js (bundle.tryingOut)
      { name: 'EligibilityOK', tier: 'STAFF' },
      { name: 'EnrolledAt', tier: 'SYSTEM' }
    ]
  },

  // Student self-service sports sign-up (the Player app is the SOLE writer; the
  // staff app READS these to materialize Pending SPORT_ENROLLMENTS a coach then
  // confirms — never writes here). Keyed on DirectoryKey (a signer-upper may have
  // no AthleteID yet) + Sport, one Active row per (student, sport); unchecking a
  // sport sets Status:'Withdrawn'. All STAFF/SYSTEM tier — the student endpoint
  // hand-serializes only the caller's own row, so projection never leaks it.
  SPORT_SIGNUPS: {
    key: ['DirectoryKey', 'Sport'],
    rowScope: 'staff',
    cols: [
      { name: 'DirectoryKey', tier: 'STAFF' },      // FACTS Student ID (match key to DIRECTORY)
      { name: 'Sport', tier: 'STAFF' },             // catalog base code (SOC/BBK/VB/XC/BASE/SOFT)
      { name: 'SportLabel', tier: 'STAFF' },        // snapshot display name
      { name: 'Term', tier: 'STAFF' },              // F/W/S from the catalog (informational)
      { name: 'StudentFirst', tier: 'STAFF' },
      { name: 'StudentLast', tier: 'STAFF' },
      { name: 'Grade', tier: 'STAFF' },
      { name: 'Gender', tier: 'STAFF' },            // genderToken snapshot (M/F/C)
      { name: 'StudentEmail', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },            // Active | Withdrawn
      { name: 'Note', tier: 'STAFF' },              // optional note to coach
      { name: 'GuardianName', tier: 'STAFF' },      // snapshot of the confirmed primary guardian
      { name: 'GuardianEmail', tier: 'STAFF' },
      { name: 'GuardianConfirmed', tier: 'STAFF' }, // student confirmed the guardian is correct
      { name: 'GuardianFlaggedWrong', tier: 'STAFF' }, // student flagged it wrong (coach follows up)
      { name: 'ConsentAck', tier: 'STAFF' },        // true on every saved row (submit gate)
      { name: 'ConsentAt', tier: 'SYSTEM' },
      { name: 'SignedUpSeason', tier: 'SYSTEM' },   // CONFIG.CurrentSeason at signup (audit/staleness)
      { name: 'CreatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  SCHEDULE: {
    key: ['EventID'],
    rowScope: 'public',
    cols: [
      { name: 'EventID', tier: 'ALL' },
      { name: 'TeamID', tier: 'ALL' },
      { name: 'Sport', tier: 'ALL' },
      { name: 'Gender', tier: 'ALL' },
      { name: 'Season', tier: 'ALL' },
      { name: 'Level', tier: 'ALL' },
      { name: 'EventType', tier: 'ALL' },
      { name: 'Date', tier: 'ALL' },
      { name: 'StartTime', tier: 'ALL' },
      { name: 'EndTimeEst', tier: 'ALL' },
      { name: 'Opponent', tier: 'ALL' },
      { name: 'HomeAway', tier: 'ALL' },
      { name: 'LocationName', tier: 'ALL' },
      { name: 'LocationAddress', tier: 'ALL' },
      { name: 'DepartTime', tier: 'ALL' },
      { name: 'ReturnEstTime', tier: 'ALL' },
      { name: 'TransportMode', tier: 'ALL' },
      { name: 'UniformNote', tier: 'ALL' },
      { name: 'Status', tier: 'ALL' },
      { name: 'StaffNotes', tier: 'STAFF' },
      { name: 'CalendarEventId', tier: 'SYSTEM' }, // Google iCalUID — sync join key
      { name: 'LastChangedAt', tier: 'SYSTEM' },
      { name: 'LastChangedBy', tier: 'SYSTEM' },
      // Final score + food stop (appended last for additive migration). ALL tier:
      // parents see results and where the team is eating on away trips.
      { name: 'HomeScore', tier: 'ALL' },
      { name: 'AwayScore', tier: 'ALL' },
      { name: 'Result', tier: 'ALL' },          // friendly, HCS perspective: "W 3–1"
      { name: 'FoodStopName', tier: 'ALL' },
      { name: 'FoodStopAddress', tier: 'ALL' },
      // Livestream link hub (appended last for additive migration). ALL tier:
      // the coach pastes a YouTube/Facebook watch link; parents/fans get a
      // "Watch live" button + LIVE badge, and the highlight/film link post-game.
      { name: 'LiveStreamUrl', tier: 'ALL' },
      { name: 'HighlightUrl', tier: 'ALL' },
      // Model-aware recorded final (appended last for additive migration). ALL
      // tier — parents render it. Shape = Scoreboard.finalScore(): volleyball
      // set lines, baseball linescore, XC place score. Contains only score
      // data, never PII. HomeScore/AwayScore stay for the simple integer sports.
      { name: 'ScoreJson', tier: 'ALL' },
      // Event-atom reorg (2026-08-16). APPENDED LAST — run RUN_addMissingColumns.
      // ETA broadcasts used to leave no trace; the event hub shows "last ETA".
      { name: 'EtaLastText', tier: 'STAFF' },    // e.g. "≈ 7:20 PM"
      { name: 'EtaLastAt', tier: 'STAFF' },      // display string, America/New_York
      // Per-GAME starting formation + XI (2026-08-28). APPENDED LAST — run
      // RUN_addMissingColumns. STAFF tier on purpose: a starting lineup is
      // coaching information, not something families or fans are shown.
      // (LINEUP the tab is the SEASON depth chart — a different thing.)
      { name: 'Formation', tier: 'STAFF' },      // '4-4-2' — the shape, keeper implied
      { name: 'LineupJson', tier: 'STAFF' },     // Formations.normalize() shape
      { name: 'LineupImageUrl', tier: 'STAFF' }, // optional uploaded formation sheet (Drive link)
      // School-dismissal time (2026-09-17). APPENDED LAST — run RUN_addMissingColumns.
      // When students leave class to travel; distinct from DepartTime (bus leaves).
      // ALL tier — families plan around it. Parsed from the calendar details by
      // CalendarSync.parseTravelTimes, or set in the event's travel editor.
      { name: 'DismissalTime', tier: 'ALL' }
    ]
  },

  ATTENDANCE: {
    key: ['EventID', 'AthleteID'],
    rowScope: 'athlete',
    athleteCol: 'AthleteID',
    cols: [
      { name: 'EventID', tier: 'ALL' },
      { name: 'AthleteID', tier: 'ALL' },
      { name: 'OutboundStatus', tier: 'ALL' },
      { name: 'ReturnStatus', tier: 'ALL' },
      { name: 'Reason', tier: 'ALL' },
      { name: 'SetByEmail', tier: 'ALL' },
      { name: 'SetAt', tier: 'ALL' },
      { name: 'OverrideFlag', tier: 'ALL' },
      { name: 'CoachAck', tier: 'STAFF' },
      { name: 'CoachNote', tier: 'STAFF' },
      { name: 'AlertSentAt', tier: 'SYSTEM' }
    ]
  },

  TRAVEL_CHECKOFF: {
    key: ['EventID', 'AthleteID', 'Leg'],
    rowScope: 'staff',
    cols: [
      { name: 'EventID', tier: 'STAFF' },
      { name: 'AthleteID', tier: 'STAFF' },
      { name: 'Leg', tier: 'STAFF' },
      { name: 'Present', tier: 'STAFF' },
      { name: 'CheckedBy', tier: 'STAFF' },
      { name: 'CheckedAt', tier: 'STAFF' }
    ]
  },

  CONFIG: {
    key: ['Key'],
    rowScope: 'staff',
    cols: [
      { name: 'Key', tier: 'SYSTEM' },
      { name: 'Value', tier: 'SYSTEM' }
    ]
  },

  STAFF_ROSTER: {
    key: ['Email'],
    rowScope: 'staff',
    cols: [
      { name: 'Email', tier: 'SYSTEM' },
      { name: 'Role', tier: 'SYSTEM' }, // Coach | AD | Admin (Admin = Owner/IT)
      { name: 'Sports', tier: 'SYSTEM' }, // comma-separated sport codes, or *
      // Appended 2026-07 for the AD Staff & Assignments screen. Names are resolved
      // from the Workspace directory when the coach is picked (blank for legacy
      // rows and manually-typed externals). SetupSentAt/LastLoginAt drive the
      // "invited ✓" check and last-seen display; both are Date stamps.
      { name: 'FirstName', tier: 'SYSTEM' },
      { name: 'LastName', tier: 'SYSTEM' },
      { name: 'SetupSentAt', tier: 'SYSTEM' },
      { name: 'LastLoginAt', tier: 'SYSTEM' }
    ]
  },

  AUDIT_PARENT: {
    key: [],
    rowScope: 'staff',
    cols: [
      { name: 'At', tier: 'SYSTEM' },
      { name: 'Fn', tier: 'SYSTEM' },
      { name: 'Actor', tier: 'SYSTEM' },
      { name: 'AthleteID', tier: 'SYSTEM' },
      { name: 'EventID', tier: 'SYSTEM' },
      { name: 'Detail', tier: 'SYSTEM' }
    ]
  },

  AUDIT_STUDENT: {
    key: [],
    rowScope: 'staff',
    cols: [
      { name: 'At', tier: 'SYSTEM' },
      { name: 'Fn', tier: 'SYSTEM' },
      { name: 'Actor', tier: 'SYSTEM' },
      { name: 'AthleteID', tier: 'SYSTEM' },
      { name: 'EventID', tier: 'SYSTEM' },
      { name: 'Detail', tier: 'SYSTEM' }
    ]
  },

  AUDIT_STAFF: {
    key: [],
    rowScope: 'staff',
    cols: [
      { name: 'At', tier: 'SYSTEM' },
      { name: 'Fn', tier: 'SYSTEM' },
      { name: 'Actor', tier: 'SYSTEM' },
      { name: 'AthleteID', tier: 'SYSTEM' },
      { name: 'EventID', tier: 'SYSTEM' },
      { name: 'Detail', tier: 'SYSTEM' }
    ]
  },

  ALERT_LOG: {
    // ADMIN tier (not SYSTEM): the one log an admin reviews in-app via
    // getAlertLog → Projection.forAdmin. Contains guardian emails, so Coach
    // role never sees it (endpoint is requireRole_('Admin')).
    key: [],
    rowScope: 'staff',
    cols: [
      { name: 'At', tier: 'ADMIN' },
      { name: 'EventID', tier: 'ADMIN' },
      { name: 'AthleteID', tier: 'ADMIN' },
      { name: 'ChangedBy', tier: 'ADMIN' },
      { name: 'NotifiedEmail', tier: 'ADMIN' },
      { name: 'OldStatus', tier: 'ADMIN' },
      { name: 'NewStatus', tier: 'ADMIN' },
      { name: 'Collapsed', tier: 'ADMIN' }
    ]
  },

  // Coach drills & video library (staff-only, team-private or program-wide).
  // rowScope 'staff' + all-STAFF cols → invisible to parent/student apps by
  // construction. Scope=Team is team-scoped at the endpoint (requireTeamAccess_);
  // Scope=Program is shared across staff. Referenced by PRACTICE_BLOCK.DrillID.
  DRILLS: {
    key: ['DrillID'],
    rowScope: 'staff',
    cols: [
      { name: 'DrillID', tier: 'STAFF' },        // DRL-####
      { name: 'Name', tier: 'STAFF' },
      { name: 'Scope', tier: 'STAFF' },          // Team | Program
      { name: 'TeamID', tier: 'STAFF' },          // set when Scope=Team
      { name: 'Sport', tier: 'STAFF' },
      { name: 'Category', tier: 'STAFF' },
      { name: 'Tags', tier: 'STAFF' },            // comma-separated
      { name: 'Description', tier: 'STAFF' },
      { name: 'LinksJson', tier: 'STAFF' },       // JSON [{label,url}] of video/article links
      { name: 'Equipment', tier: 'STAFF' },
      { name: 'DurationMinDefault', tier: 'STAFF' },
      { name: 'CreatedBy', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },          // Active | Removed (soft delete)
      { name: 'CreatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // Practice planner (staff-only). A plan header hangs off a synced SCHEDULE
  // Practice/Other event (key EventID); blocks are its ordered children. Both
  // rowScope 'staff' + all-STAFF cols → never reach parents/students.
  PRACTICE_PLAN: {
    key: ['EventID'],
    rowScope: 'staff',
    cols: [
      { name: 'EventID', tier: 'STAFF' },
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'Focus', tier: 'STAFF' },
      { name: 'Objectives', tier: 'STAFF' },
      { name: 'UpdatedBy', tier: 'STAFF' },
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'SourceSessionID', tier: 'STAFF' }  // appended: provenance when attached from a saved PRACTICE_SESSION
    ]
  },

  PRACTICE_BLOCK: {
    key: ['EventID', 'BlockID'],
    rowScope: 'staff',
    cols: [
      { name: 'EventID', tier: 'STAFF' },
      { name: 'BlockID', tier: 'STAFF' },        // BLK-<n>, re-minted on each save
      { name: 'Seq', tier: 'STAFF' },
      { name: 'Title', tier: 'STAFF' },
      { name: 'DurationMin', tier: 'STAFF' },
      { name: 'Notes', tier: 'STAFF' },
      { name: 'DrillID', tier: 'STAFF' },         // optional → DRILLS.DrillID
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // Standalone reusable practice library (staff-only). Authored anytime, NOT
  // tied to a calendar event; can be snapshot-copied onto a synced Practice
  // event (attachSessionToEvent) — the app never writes the calendar. Scope
  // model mirrors DRILLS (Program = shared, Team = team-private).
  PRACTICE_SESSION: {
    key: ['SessionID'],
    rowScope: 'staff',
    cols: [
      { name: 'SessionID', tier: 'STAFF' },       // PS-####
      { name: 'Title', tier: 'STAFF' },
      { name: 'Scope', tier: 'STAFF' },           // Team | Program
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'Sport', tier: 'STAFF' },
      { name: 'Focus', tier: 'STAFF' },
      { name: 'Objectives', tier: 'STAFF' },
      { name: 'Tags', tier: 'STAFF' },
      { name: 'EstMinutes', tier: 'STAFF' },       // denormalized total, recomputed each save
      { name: 'CreatedBy', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },           // Active | Removed
      { name: 'CreatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  PRACTICE_SESSION_BLOCK: {
    key: ['SessionID', 'BlockID'],
    rowScope: 'staff',
    cols: [
      { name: 'SessionID', tier: 'STAFF' },
      { name: 'BlockID', tier: 'STAFF' },          // BLK-<n>, re-minted on each save
      { name: 'Seq', tier: 'STAFF' },
      { name: 'Title', tier: 'STAFF' },
      { name: 'DurationMin', tier: 'STAFF' },
      { name: 'Notes', tier: 'STAFF' },
      { name: 'DrillID', tier: 'STAFF' },          // optional → DRILLS.DrillID
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // Practice history — one row appended when a coach finishes running a live
  // practice. Feeds a history list + a truer "ran it" signal into drill usage.
  // Staff-only, append-only.
  PRACTICE_RUN: {
    key: ['RunID'],
    rowScope: 'staff',
    cols: [
      { name: 'RunID', tier: 'STAFF' },           // RUN-####
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'SessionID', tier: 'STAFF' },
      { name: 'EventID', tier: 'STAFF' },
      { name: 'Title', tier: 'STAFF' },
      { name: 'DrillIdsJson', tier: 'STAFF' },     // JSON array of DrillIDs run
      { name: 'DurationMin', tier: 'STAFF' },
      { name: 'RanBy', tier: 'STAFF' },
      { name: 'RanOn', tier: 'STAFF' },            // yyyy-MM-dd
      { name: 'CreatedAt', tier: 'SYSTEM' }
    ]
  },

  // Shared comment thread on a reusable PRACTICE_SESSION (assistant ↔ head
  // coach). Append-per-comment (multi-writer, mirrors TRYOUT_SCORES: a fresh id
  // per post, no contended cell). Staff-only. Distinct from the private
  // per-coach DRILL_COACH.Notes.
  SESSION_COMMENT: {
    key: ['CommentID'],
    rowScope: 'staff',
    cols: [
      { name: 'CommentID', tier: 'STAFF' },       // SC-####
      { name: 'SessionID', tier: 'STAFF' },
      { name: 'AuthorEmail', tier: 'STAFF' },
      { name: 'AuthorName', tier: 'STAFF' },
      { name: 'Body', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },           // Active | Removed
      { name: 'CreatedAt', tier: 'SYSTEM' }
    ]
  },

  // Per-coach overlay on shared DRILLS: favorites/pins + private notes. Keyed by
  // email+drill (mirrors NOTIFY_PREFS email-keyed single-writer). Staff-only.
  DRILL_COACH: {
    key: ['Email', 'DrillID'],
    rowScope: 'staff',
    cols: [
      { name: 'Email', tier: 'STAFF' },
      { name: 'DrillID', tier: 'STAFF' },
      { name: 'Pinned', tier: 'STAFF' },
      { name: 'Notes', tier: 'STAFF' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // Per-coach practice/timer/scrimmage defaults. Email-keyed single-writer
  // (mirrors NOTIFY_PREFS); staff-only. Read into the staff bundle as state.prefs.
  COACH_PREFS: {
    key: ['Email'],
    rowScope: 'staff',
    cols: [
      { name: 'Email', tier: 'STAFF' },
      { name: 'WarmupMin', tier: 'STAFF' },
      { name: 'CooldownMin', tier: 'STAFF' },
      { name: 'WaterBreakMin', tier: 'STAFF' },
      { name: 'WaterBreakEveryMin', tier: 'STAFF' },
      { name: 'DefaultLengthMin', tier: 'STAFF' },
      { name: 'PerDrillMin', tier: 'STAFF' },
      { name: 'AutoAdvance', tier: 'STAFF' },
      { name: 'ToneOn', tier: 'STAFF' },
      { name: 'DefaultTeamID', tier: 'STAFF' },
      { name: 'ScrimHalfMin', tier: 'STAFF' },
      { name: 'ScrimHalfCount', tier: 'STAFF' },
      { name: 'ScrimSquadSize', tier: 'STAFF' },
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'GameDayChecklist', tier: 'STAFF' },  // FS-D: newline-separated checklist template (added last)
      { name: 'LandingTab', tier: 'STAFF' },        // OB-0 display prefs (appended last)
      { name: 'TabOrderJson', tier: 'STAFF' },
      { name: 'HiddenTabsJson', tier: 'STAFF' },
      { name: 'Density', tier: 'STAFF' }
    ]
  },

  // Per-team app configuration set by the Design Wizard: which modules are on
  // (ModulesJson) + per-team blueprint overrides (OverridesJson, e.g. periodMin,
  // squad size). TeamID-keyed single-writer; staff-only. Seeded from the sport
  // blueprint (logic/sports.js) and resolved into each team in the staff bundle.
  TEAM_CONFIG: {
    key: ['TeamID'],
    rowScope: 'staff',
    cols: [
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'ModulesJson', tier: 'STAFF' },
      { name: 'OverridesJson', tier: 'STAFF' },
      { name: 'WizardComplete', tier: 'STAFF' },
      { name: 'UpdatedBy', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // Per-guardian email-notification preferences. Single writer = parent app
  // (a guardian edits only their own row, keyed by their normalized email);
  // parent/staff/student apps all READ it before sending. All prefs are STAFF
  // tier — the row carries a guardian's own email, never reaches other families
  // through projection; the parent endpoint hands each caller only their row.
  NOTIFY_PREFS: {
    key: ['Email'],
    rowScope: 'staff',
    cols: [
      { name: 'Email', tier: 'STAFF' },
      { name: 'PlanChanges', tier: 'STAFF' },       // default ON  — travel/plan change alerts
      { name: 'EventStatus', tier: 'STAFF' },        // default ON  — event change/cancellation fanout
      { name: 'AnnouncementEmail', tier: 'STAFF' },  // default OFF — announcement emails
      { name: 'FormReminder', tier: 'STAFF' },       // default OFF — missing-form reminders
      { name: 'UpdatedAt', tier: 'SYSTEM' },
      { name: 'EventReminder', tier: 'STAFF' },        // default ON — day-before game reminders; APPENDED LAST so gwAddMissingColumns_ can add it without shifting existing NOTIFY_PREFS columns
      { name: 'ReturnEta', tier: 'STAFF' }             // default ON — coach's live bus-return ETA broadcasts; APPENDED LAST
    ]
  },

  // ---- Cross-country race timing (XT-2/XT-3) --------------------------------
  // A synced race session: the shared-clock anchor + role coordination. Staff-
  // only (coaches of the XC team). StartedAtMs is a server epoch every device
  // derives its own clock from (no push).
  RACE_SESSION: {
    key: ['SessionID'],
    rowScope: 'staff',
    cols: [
      { name: 'SessionID', tier: 'STAFF' },        // RS-####
      { name: 'EventID', tier: 'STAFF' },
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },           // Armed | Running | Stopped | Locked (legacy 'Final' reads as Stopped)
      { name: 'StartedAtMs', tier: 'STAFF' },      // server epoch ms clock anchor
      { name: 'Mode', tier: 'STAFF' },             // combined | single
      { name: 'HostScored', tier: 'STAFF' },       // true when HCS hosts (full scoring)
      { name: 'CreatedBy', tier: 'STAFF' },
      { name: 'CreatedAt', tier: 'SYSTEM' },
      { name: 'Distance', tier: 'STAFF' },         // "5K" | "2mi" — for PR compare (appended last)
      { name: 'ScoreMethod', tier: 'STAFF' },      // sticks (chute order) | bibs (record bib #) — appended last
      // A MEET is one event that holds SEVERAL races (2026-09-06). XC is offered
      // as ONE co-ed team spanning grades 5–12 (offerings.js), so the varsity and
      // middle-school races at the same meet share an EventID — and the old
      // one-open-session-per-event rule made two clocks impossible. At HCS the MS
      // race starts ~40 min after varsity, so both clocks genuinely run at once.
      // Open-ended on purpose: a meet may add a JV race or split heats.
      { name: 'RaceKey', tier: 'STAFF' },          // stable slug within the event: 'varsity' | 'ms' | …
      { name: 'RaceLabel', tier: 'STAFF' },        // display: "Varsity" | "Middle School"
      // The finalized full finish order for THIS race, written once at reconcile:
      // [{place,timeMs,bib,firstName,lastName,school,gender,genderPlace,athleteId}].
      // The durable record for the whole field (all schools) — RACE_RESULT only
      // holds HCS runners, so team scoring and the results board read this.
      // APPENDED LAST — run RUN_addMissingColumns.
      { name: 'ResultJson', tier: 'STAFF' }
    ]
  },
  // Everyone running at a meet, including OTHER SCHOOLS' runners — Talon Hub has
  // never had anywhere to put them (OPPONENT_PLAYERS is a scouting tab with no
  // bib). Entered in two passes: name/school/gender/grade before the meet, then
  // the physical bib number recorded day-of. Bibs are pre-printed and fixed, so
  // the app RECORDS which vest went to whom; it never assigns one.
  //
  // Every column is STAFF tier and rowScope 'staff': these rows carry the names
  // and grades of children from other schools. They exist to order and score a
  // race, and they must never reach a family payload. HCS runners' own results
  // stay in RACE_RESULT, which is athlete-scoped and family-facing.
  MEET_ENTRIES: {
    key: ['EntryID'],
    rowScope: 'staff',
    cols: [
      { name: 'EntryID', tier: 'STAFF' },          // ME-<eventSeq>
      { name: 'EventID', tier: 'STAFF' },
      { name: 'RaceKey', tier: 'STAFF' },          // which race this competitor runs
      { name: 'Bib', tier: 'STAFF' },              // physical bib; blank until assigned day-of
      { name: 'FirstName', tier: 'STAFF' },
      { name: 'LastName', tier: 'STAFF' },
      { name: 'School', tier: 'STAFF' },           // 'HCS' or the visiting school's name
      { name: 'Gender', tier: 'STAFF' },           // B | G — drives gender place
      { name: 'Grade', tier: 'STAFF' },
      // Set ONLY for our own runners, linking to ATHLETE_REGISTRY so a finish can
      // become a RACE_RESULT row (PRs, the family-facing board). Blank for every
      // visiting runner — they are scored, never stored as athletes.
      { name: 'AthleteID', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },           // Active | Scratched
      { name: 'CreatedBy', tier: 'STAFF' },
      { name: 'CreatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },
  // Meet-day task presence: who's on each job right now, so the role menu can
  // show "Funnel — John Smith". One row per device per meet (upserted); read
  // back for rows touched in the last ~30 min. STAFF-tier — carries volunteers'
  // typed names, seen only by staff/other volunteers on that meet. NEW TAB —
  // run RUN_addNewTabs to enable (presence is a no-op until it exists).
  MEET_ROLES: {
    key: ['EventID', 'DeviceId'],
    rowScope: 'staff',
    cols: [
      { name: 'EventID', tier: 'STAFF' },
      { name: 'DeviceId', tier: 'STAFF' },     // per-device random id (localStorage)
      { name: 'Who', tier: 'STAFF' },          // typed name (volunteer) or coach email
      { name: 'Role', tier: 'STAFF' },         // time | chute | spot | timekeeper | ''
      { name: 'RaceKey', tier: 'STAFF' },
      { name: 'At', tier: 'SYSTEM' }
    ]
  },
  // Append-only finish taps, one row per crossing per role (multi-writer, the
  // TRYOUT_SCORES pattern — each device appends its own, no contended cell).
  RACE_TAP: {
    key: ['TapID'],
    rowScope: 'staff',
    cols: [
      { name: 'TapID', tier: 'STAFF' },            // TP-<sessionSeq>
      { name: 'SessionID', tier: 'STAFF' },
      { name: 'Role', tier: 'STAFF' },             // time | chute | spot | marker (legacy boys/girls no longer produced)
      { name: 'Seq', tier: 'STAFF' },              // 1..N within the role
      { name: 'ElapsedMs', tier: 'STAFF' },        // from the shared clock
      { name: 'Bib', tier: 'STAFF' },
      { name: 'Gender', tier: 'STAFF' },
      { name: 'AthleteID', tier: 'STAFF' },
      { name: 'By', tier: 'STAFF' },
      { name: 'At', tier: 'SYSTEM' },
      { name: 'Marker', tier: 'STAFF' },           // '' for a finish tap; m1/m2/… for a mile-marker split tap (appended last)
      // Repair, without breaking append-only (2026-09-06). The chute method joins
      // a time-only stream to a bib-only stream BY POSITION, so one missed or
      // doubled tap silently mis-times every runner after it. Both fixes are new
      // rows, never edits:
      //   Void='1'  → excluded from the merge (a double-tap)
      //   SortKey   → position within the role; defaults to Seq. A bib missed at
      //               13 is inserted as 13.5, and everything after re-orders.
      // Merge sorts by SortKey and uses POSITION, never the Seq value, so gaps
      // and insertions both come out right.
      { name: 'Void', tier: 'STAFF' },
      { name: 'SortKey', tier: 'STAFF' }
    ]
  },
  // Durable per-runner race result → PR board + family-facing. Athlete-scoped
  // (mirrors ATTENDANCE): a family sees only their own runner's time/place/PR.
  RACE_RESULT: {
    key: ['EventID', 'AthleteID'],
    rowScope: 'athlete',
    athleteCol: 'AthleteID',
    cols: [
      { name: 'EventID', tier: 'ALL' },
      { name: 'AthleteID', tier: 'ALL' },
      { name: 'Season', tier: 'ALL' },
      { name: 'Distance', tier: 'ALL' },           // "5K" | "2mi" | "3mi" — PRs compare within a distance
      { name: 'TimeSec', tier: 'ALL' },
      { name: 'OverallPlace', tier: 'ALL' },
      { name: 'GenderPlace', tier: 'ALL' },
      { name: 'TeamPlace', tier: 'ALL' },
      { name: 'IsPR', tier: 'ALL' },
      { name: 'RecordedBy', tier: 'STAFF' },
      { name: 'RecordedAt', tier: 'SYSTEM' }
    ]
  },
  // Mile splits (Phase 2 XC): one row per runner per marker. CumSec is the
  // CUMULATIVE elapsed time at the marker (what a coach reads off a watch); the
  // split board derives segment times + pace. rowScope 'athlete' so a family
  // sees only their own runner's splits, projected like RACE_RESULT.
  RACE_SPLIT: {
    key: ['EventID', 'AthleteID', 'Marker'],
    rowScope: 'athlete',
    athleteCol: 'AthleteID',
    cols: [
      { name: 'EventID', tier: 'ALL' },
      { name: 'AthleteID', tier: 'ALL' },
      { name: 'Season', tier: 'ALL' },
      { name: 'Marker', tier: 'ALL' },        // m1 | m2 | … — stable key within an event
      { name: 'MarkerLabel', tier: 'ALL' },   // "Mile 1"
      { name: 'DistMi', tier: 'ALL' },        // distance-from-start in miles (for pace)
      { name: 'CumSec', tier: 'ALL' },        // cumulative elapsed seconds at the marker
      { name: 'RecordedBy', tier: 'STAFF' },
      { name: 'RecordedAt', tier: 'SYSTEM' }
    ]
  },
  // Game Center (GC-1): one opt-in live-broadcast row per event. Public game
  // data only (a composed score string + clock) — NO PII, so rowScope 'public'
  // and every public column is 'ALL'. Single-writer = staff (the coach running
  // the live tool); fan/parent/student read it. UpdatedBy (coach email) stays
  // STAFF-tier so it never serializes to parents/fans.
  LIVE_SCORE: {
    key: ['EventID'],
    rowScope: 'public',
    cols: [
      { name: 'EventID', tier: 'ALL' },
      { name: 'Status', tier: 'ALL' },        // Live | Halftime | Final | Ended (broadcast off)
      { name: 'Label', tier: 'ALL' },         // composed score string (Scoreboard.resultLabel) — sport-agnostic
      { name: 'Detail', tier: 'ALL' },        // clock/period, e.g. "2nd 12:34" or "Set 3"
      { name: 'HomeScore', tier: 'ALL' },     // optional numerics for a compact render
      { name: 'AwayScore', tier: 'ALL' },
      { name: 'UpdatedAtMs', tier: 'ALL' },   // epoch ms — client staleness + sort (no PII)
      { name: 'UpdatedBy', tier: 'STAFF' },   // coach email — never public
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },
  // Player stats (FS-B) — COACHES ONLY. rowScope 'staff' → never serialized to
  // parents/students/fans. One row per (event, athlete); StatsJson holds the
  // sport-aware {key:value} map (logic/stats.js). Single writer = staff.
  GAME_STATS: {
    key: ['EventID', 'AthleteID'],
    rowScope: 'staff',
    cols: [
      { name: 'EventID', tier: 'STAFF' },
      { name: 'AthleteID', tier: 'STAFF' },
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'Season', tier: 'STAFF' },
      { name: 'StatsJson', tier: 'STAFF' },   // {statKey: value} — sport-aware
      { name: 'RecordedBy', tier: 'STAFF' },
      { name: 'RecordedAt', tier: 'SYSTEM' }
    ]
  },

  // Append-only live-stat event stream (soccer live pad; one clock-stamped row per
  // tap, à la RACE_TAP). SoccerLive.reduceGame turns it into the box score + live
  // score + minutes + timeline; finalize rolls it into GAME_STATS + SCHEDULE.
  // STAFF-only — never serialized to families (they see the derived LIVE_SCORE).
  GAME_EVENT: {
    key: ['EventID', 'Seq'],
    rowScope: 'staff',
    cols: [
      { name: 'EventID', tier: 'STAFF' },
      { name: 'Seq', tier: 'STAFF' },          // client-assigned monotonic # (idempotent on retry)
      { name: 'Side', tier: 'STAFF' },         // US | OPP
      { name: 'AthleteID', tier: 'STAFF' },    // '' for OPP
      { name: 'StatType', tier: 'STAFF' },     // GOAL|ASSIST|SHOT|SOG|SAVE|GA|YC|RC|SUBIN|SUBOUT
      { name: 'LinkSeq', tier: 'STAFF' },      // ASSIST → its GOAL's Seq
      { name: 'MatchMin', tier: 'STAFF' },     // period-aware match minute
      { name: 'Period', tier: 'STAFF' },       // clock block index
      { name: 'Void', tier: 'STAFF' },         // TRUE = undone (kept for an honest log)
      { name: 'ClockSec', tier: 'SYSTEM' },
      { name: 'CreatedBy', tier: 'STAFF' },
      { name: 'CreatedAt', tier: 'SYSTEM' }
    ]
  },
  // Depth chart / lineup (FS-C) — coach-built, but athlete-scoped so a student
  // sees ONLY their own position/role in the student app. One row per (team,
  // athlete). Coach sees the whole chart via staff read-scoping.
  LINEUP: {
    key: ['TeamID', 'AthleteID'],
    rowScope: 'athlete',
    athleteCol: 'AthleteID',
    cols: [
      { name: 'TeamID', tier: 'ALL' },
      { name: 'AthleteID', tier: 'ALL' },
      { name: 'Position', tier: 'ALL' },      // sport position (student sees own)
      { name: 'Role', tier: 'ALL' },          // Starter | Bench
      { name: 'Ord', tier: 'ALL' },           // display order within the chart
      { name: 'Notes', tier: 'STAFF' },       // coach-only note — NOT shown to the student
      { name: 'UpdatedBy', tier: 'STAFF' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // Opponent scouting notebook (coach-authored, STAFF-only, season-independent).
  // Keyed by ProgramKey (sport-gender-level, season-stripped so notes carry across
  // the yearly TeamID rollover) + OpponentKey (slug) + PlayerKey (slug(last)-number).
  // Populated by the Scouting tool; a scanned roster photo is read by Gemini, never stored.
  OPPONENT_PLAYERS: {
    key: ['ProgramKey', 'OpponentKey', 'PlayerKey'],
    rowScope: 'staff',
    cols: [
      { name: 'ProgramKey', tier: 'STAFF' },   // Sports.keyFor(sport)+'-'+genderToken+'-'+level
      { name: 'OpponentKey', tier: 'STAFF' },  // Directory.slug(OpponentName)
      { name: 'PlayerKey', tier: 'STAFF' },    // Directory.slug(last)+'-'+number (match key)
      { name: 'OpponentName', tier: 'STAFF' },
      { name: 'PlayerName', tier: 'STAFF' },
      { name: 'Number', tier: 'STAFF' },
      { name: 'Position', tier: 'STAFF' },
      { name: 'Grade', tier: 'STAFF' },
      { name: 'Notes', tier: 'STAFF' },
      { name: 'CreatedBy', tier: 'STAFF' },
      { name: 'Status', tier: 'STAFF' },       // Active | Removed (soft delete)
      { name: 'CreatedAt', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // ---- Uniform turn-in (AD console) -----------------------------------------
  // Three tabs, and the season split is load-bearing: TURNIN is this season's
  // collection state (archived with the season), while KIT and GARMENT are
  // PERSISTENT asset records that must outlive it — a note like "small tear on
  // the left sleeve" has to still be there when the article is issued next year.
  // All staff-scoped: uniforms are an equipment ledger, never family-visible.

  // What a team issues. Per TEAM, not per sport: Varsity soccer carries a
  // backpack, JV/MS don't (Josh 2026-08).
  UNIFORM_KIT: {
    key: ['TeamID', 'ItemKey'],
    rowScope: 'staff',
    cols: [
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'ItemKey', tier: 'STAFF' },        // jersey_home | jersey_away | shorts | backpack | custom
      { name: 'Label', tier: 'STAFF' },
      { name: 'Numbered', tier: 'STAFF' },       // true = the article carries a number (garment notes need one)
      // Size chart by number band ('1-3: AS, 4-12: AM, 13+: AL'). Kit is issued
      // by number, so the band is stored once per item instead of a size typed
      // on every player. APPENDED 2026-08-28 — run RUN_addMissingColumns.
      { name: 'SizeMap', tier: 'STAFF' },
      { name: 'ItemOrder', tier: 'STAFF' },
      { name: 'Active', tier: 'STAFF' },
      { name: 'UpdatedBy', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // One row per athlete × item for a season's collection. Season is
  // DENORMALIZED on purpose — Archive.matches() compares row.Season, and a tab
  // without it silently never archives (logic/archive.js).
  UNIFORM_TURNIN: {
    key: ['TeamID', 'AthleteID', 'ItemKey'],
    rowScope: 'staff',
    cols: [
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'Season', tier: 'STAFF' },          // from the TEAM's Season, never global CurrentSeason
      { name: 'AthleteID', tier: 'STAFF' },
      { name: 'ItemKey', tier: 'STAFF' },
      { name: 'GarmentNumber', tier: 'STAFF' },   // which physical article came back
      { name: 'Returned', tier: 'STAFF' },
      { name: 'ReturnedAt', tier: 'SYSTEM' },     // auto-stamped at turn-in (no manual date entry)
      { name: 'TurnInCondition', tier: 'STAFF' }, // Good | Fair | Damaged | Lost (defaults Good)
      { name: 'TurnInNote', tier: 'STAFF' },
      // Per-player override when someone was handed a size the chart doesn't
      // give them. Blank = whatever the item's SizeMap says for their number.
      // APPENDED 2026-08-28 — run RUN_addMissingColumns.
      { name: 'Size', tier: 'STAFF' },
      { name: 'CheckedInBy', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  },

  // The article ledger: notes that survive seasons, keyed to the GARMENT
  // (team + item + number) so they follow the jersey, not the player. Cleared
  // by the "Replaced" action. Never archived.
  UNIFORM_GARMENT: {
    key: ['TeamID', 'ItemKey', 'GarmentNumber'],
    rowScope: 'staff',
    cols: [
      { name: 'TeamID', tier: 'STAFF' },
      { name: 'ItemKey', tier: 'STAFF' },
      { name: 'GarmentNumber', tier: 'STAFF' },
      { name: 'GarmentNote', tier: 'STAFF' },     // carried forward until the article is replaced
      { name: 'LastCondition', tier: 'STAFF' },
      { name: 'FlaggedAt', tier: 'SYSTEM' },
      { name: 'FlaggedBy', tier: 'SYSTEM' },
      { name: 'ReplacedAt', tier: 'SYSTEM' },
      { name: 'ReplacedBy', tier: 'SYSTEM' },
      { name: 'UpdatedAt', tier: 'SYSTEM' }
    ]
  }
};

/* Phase 2 reserved tab names (do NOT create yet; add here when built):
   OPPONENTS, TRYOUTS, STATS, LOST_FOUND, FAN_ACCESS */

if (typeof module !== 'undefined') module.exports = { TIER: TIER, SCHEMA: SCHEMA };

/* ===================== apps/fan/server/lib/projection.js ===================== */
/* GENERATED FILE — DO NOT HAND-EDIT.
 * Source of truth: logic/*.js and gas-shared/*.js (unit-tested in Node).
 * Regenerate with: npm run build
 */
'use strict';
/**
 * projection.js — the row-level-security + column-projection engine.
 *
 * Every payload that leaves either app passes through project()/filterRows()
 * via the dispatcher's respond_() — the ONLY serializer. No endpoint may
 * return gateway objects directly.
 *
 * LOAD-ORDER RULE (learned the hard way): GAS loads project files
 * alphabetically, so projection.js executes BEFORE schema.js and the global
 * SCHEMA/TIER are still unassigned at load time. The schema ref must be
 * resolved LAZILY inside each call — never captured at the top level.
 */

/* global SCHEMA, TIER */

var Projection = (function () {
  function ref_() {
    if (typeof module !== 'undefined') return require('./schema.js');
    return { SCHEMA: SCHEMA, TIER: TIER }; // GAS globals, assigned by the time any endpoint runs
  }

  function tabDef_(S, tab) {
    var def = S.SCHEMA[tab];
    if (!def) throw new Error('Projection: unknown tab ' + tab);
    return def;
  }

  /** ISO-stringify Dates so google.script.run never chokes on payloads. */
  function serializeValue_(v) {
    if (v instanceof Date) return v.toISOString();
    return v;
  }

  /**
   * Drop every column above callerTier. SYSTEM columns are never emitted to
   * any caller, including ADMIN — they exist only inside the server.
   */
  function project(tab, rows, callerTier) {
    var S = ref_();
    var def = tabDef_(S, tab);
    var tierNum = typeof callerTier === 'number' ? callerTier : S.TIER[callerTier];
    if (tierNum === undefined || tierNum === null) throw new Error('Projection: bad tier ' + callerTier);
    var keep = def.cols.filter(function (c) {
      return S.TIER[c.tier] <= tierNum && c.tier !== 'SYSTEM';
    });
    return rows.map(function (row) {
      var out = {};
      keep.forEach(function (c) {
        out[c.name] = serializeValue_(row[c.name]);
      });
      return out;
    });
  }

  /**
   * Row-level security for parent-tier callers.
   *  - rowScope 'athlete': only rows whose athleteCol is in athleteIds
   *  - rowScope 'public' : all rows
   *  - rowScope 'staff'  : NO rows, ever
   * Staff/Admin callers skip this (they pass allowAll=true from a guard).
   */
  function filterRows(tab, rows, athleteIds, allowAll) {
    if (allowAll === true) return rows;
    var S = ref_();
    var def = tabDef_(S, tab);
    if (def.rowScope === 'public') return rows;
    if (def.rowScope === 'staff') return [];
    var ids = {};
    (athleteIds || []).forEach(function (id) { ids[id] = true; });
    return rows.filter(function (row) { return ids[row[def.athleteCol]] === true; });
  }

  /** Convenience: filter then project — the standard parent-payload path. */
  function forParent(tab, rows, athleteIds) {
    return project(tab, filterRows(tab, rows, athleteIds, false), ref_().TIER.ALL);
  }

  function forStaff(tab, rows) {
    return project(tab, rows, ref_().TIER.STAFF);
  }

  function forAdmin(tab, rows) {
    return project(tab, rows, ref_().TIER.ADMIN);
  }

  /**
   * Column names that are NEVER visible at maxTier in ANY tab — the safe list
   * for the adversarial column-leak scan. (A name like "Status" is STAFF in
   * ATHLETE_REGISTRY but ALL in SCHEDULE, so it can't be scanned by name.)
   */
  function forbiddenColumns(maxTier) {
    var S = ref_();
    var tierNum = typeof maxTier === 'number' ? maxTier : S.TIER[maxTier];
    var above = {};
    var visible = {};
    Object.keys(S.SCHEMA).forEach(function (tab) {
      S.SCHEMA[tab].cols.forEach(function (c) {
        if (S.TIER[c.tier] > tierNum) above[c.name] = true;
        else visible[c.name] = true;
      });
    });
    return Object.keys(above).filter(function (name) { return !visible[name]; });
  }

  return {
    project: project,
    filterRows: filterRows,
    forParent: forParent,
    forStaff: forStaff,
    forAdmin: forAdmin,
    forbiddenColumns: forbiddenColumns
  };
})();

if (typeof module !== 'undefined') module.exports = Projection;

/* ===================== apps/fan/server/lib/announcements.js ===================== */
/* GENERATED FILE — DO NOT HAND-EDIT.
 * Source of truth: logic/*.js and gas-shared/*.js (unit-tested in Node).
 * Regenerate with: npm run build
 */
'use strict';
/**
 * announcements.js — pure filter for the announcement board. The GAS caller
 * (gwActiveAnnouncements_) normalizes any Date-typed ExpiresAt to 'yyyy-MM-dd'
 * and passes today; everything visible-vs-hidden is decided here so it unit-tests.
 */

var Announcements = (function () {
  /**
   * Whether a row is visible to a given recipient type. Flags store '1' (on) or
   * '0' (off); a BLANK flag = legacy row = default (players/parents ON, fans
   * OFF), so pre-existing announcements never leak to the public board and always
   * reach players/parents. 'staff' (manager) sees everything.
   */
  function forAudience_(a, audienceType) {
    switch (audienceType) {
      case 'player': return String(a.ShowPlayers) !== '0'; // blank/'1' → show
      case 'parent': return String(a.ShowParents) !== '0';
      case 'fan': return String(a.ShowFans) === '1';       // opt-in only
      default: return true; // 'staff' / manager view
    }
  }

  /**
   * Rows a caller should see: Active, not past ExpiresAt, scoped Program-wide or
   * to a team the caller is on, AND allowed for `audienceType`
   * ('player'|'parent'|'fan'|'staff'/omitted). `today`/`ExpiresAt` are yyyy-MM-dd
   * (lexical compare); blank ExpiresAt = never expires.
   */
  /** Every team an announcement targets. TeamIDs (CSV) when present, else the
   *  legacy single TeamID — so rows written before multi-team still match. */
  function teamsOf(a) {
    var csv = String((a && a.TeamIDs) || '').trim();
    if (csv) return csv.split(',').map(function (t) { return String(t).trim(); }).filter(Boolean);
    var one = String((a && a.TeamID) || '').trim();
    return one ? [one] : [];
  }

  /**
   * Normalize an expiry to 'yyyy-MM-dd HH:mm' for lexical compare.
   * A date-only expiry means "visible THROUGH that day" (the rule since day
   * one), so it becomes 23:59. A stored midnight ALSO becomes 23:59: Sheets
   * types a plain '2026-08-30' cell as a Date at 00:00, which is
   * indistinguishable from an explicit midnight — treating 00:00 as
   * end-of-day keeps every legacy row visible on its expiry day instead of
   * silently killing them all at the stroke of midnight.
   */
  function expiryOf_(exp) {
    exp = String(exp || '').trim();
    if (!exp) return '';
    if (exp.length <= 10) return exp + ' 23:59';
    if (/ 00:00$/.test(exp)) return exp.slice(0, 10) + ' 23:59';
    return exp;
  }

  function active(rows, teamIds, today, audienceType) {
    var set = {};
    (teamIds || []).forEach(function (t) { set[String(t)] = true; });
    // `today` may be date-only ('yyyy-MM-dd', legacy callers) or minute-precise
    // ('yyyy-MM-dd HH:mm') — lexical compare is correct for both against the
    // normalized expiry.
    return (rows || []).filter(function (a) {
      if (String(a.Status) !== 'Active') return false;
      var exp = expiryOf_(a.ExpiresAt);
      if (exp && exp < String(today)) return false;
      if (!forAudience_(a, audienceType)) return false;
      if (String(a.Audience) === 'Team') return teamsOf(a).some(function (t) { return !!set[t]; });
      return true; // Program-wide
    });
  }

  return { active: active, teamsOf: teamsOf };
})();

if (typeof module !== 'undefined') module.exports = Announcements;

/* ===================== apps/fan/server/lib/labels.js ===================== */
/* GENERATED FILE — DO NOT HAND-EDIT.
 * Source of truth: logic/*.js and gas-shared/*.js (unit-tested in Node).
 * Regenerate with: npm run build
 */
'use strict';
/**
 * labels.js — friendly display names from the terse codes. Pure. Used
 * server-side to enrich payloads (client just renders), so there's one source.
 */

var Labels = (function () {
  // Sport codes → sport name (gender is a separate field, so strip any B/G).
  var SPORT = {
    BSOC: 'Soccer', GSOC: 'Soccer', SOC: 'Soccer',
    BBB: 'Basketball', GBB: 'Basketball', BBK: 'Basketball', GBK: 'Basketball', BSK: 'Basketball',
    BASE: 'Baseball', SOFT: 'Softball', VB: 'Volleyball', VOLL: 'Volleyball',
    XC: 'Cross-Country', GOLF: 'Golf', FF: 'Flag Football', FB: 'Football'
  };
  var LEVEL = { V: 'Varsity', JV: 'JV', MS: 'Middle School' };

  // Sport code → sprite symbol id (mirrors the GLYPH map in ui/Theme.html;
  // keep the two in sync — the labels.test.js lock guards this side).
  var GLYPH = {
    BSOC: 'sp-soccer', GSOC: 'sp-soccer', SOC: 'sp-soccer',
    BBB: 'sp-basketball', GBB: 'sp-basketball', BBK: 'sp-basketball', GBK: 'sp-basketball', BSK: 'sp-basketball',
    VB: 'sp-volleyball', VOLL: 'sp-volleyball', BASE: 'sp-baseball', SOFT: 'sp-softball',
    XC: 'sp-xc', GOLF: 'sp-golf', FF: 'sp-football', FB: 'sp-football'
  };
  var LEVEL_LETTER = { V: 'V', JV: 'JV', MS: 'MS' };

  function sportName(code) { return SPORT[String(code).toUpperCase()] || String(code || ''); }
  function levelName(l) { return LEVEL[String(l).toUpperCase()] || String(l || ''); }
  function glyphId(code) { return GLYPH[String(code).toUpperCase()] || 'sp-generic'; }
  function levelLetter(l) { return LEVEL_LETTER[String(l).toUpperCase()] || String(l || ''); }

  /** e.g. ('Boys','V','BSOC') → "Boys Varsity Soccer". */
  function teamLabel(gender, level, sport) {
    return [String(gender || ''), levelName(level), sportName(sport)]
      .filter(function (s) { return s; }).join(' ').trim();
  }

  /** From HCS's perspective → "W 3–1" / "L 1–2" / "T 2–2"; '' if either score
   *  is blank/non-numeric (used both to render and to detect a recorded final). */
  function resultLabel(ourScore, oppScore) {
    var o = Number(ourScore), p = Number(oppScore);
    if (ourScore === '' || oppScore === '' || ourScore == null || oppScore == null || !isFinite(o) || !isFinite(p)) return '';
    var letter = o > p ? 'W' : (o < p ? 'L' : 'T');
    return letter + ' ' + o + '–' + p;
  }

  return { sportName: sportName, levelName: levelName, teamLabel: teamLabel,
    glyphId: glyphId, levelLetter: levelLetter, resultLabel: resultLabel };
})();

if (typeof module !== 'undefined') module.exports = Labels;

/* ===================== apps/fan/server/lib/scoreboard.js ===================== */
/* GENERATED FILE — DO NOT HAND-EDIT.
 * Source of truth: logic/*.js and gas-shared/*.js (unit-tested in Node).
 * Regenerate with: npm run build
 */
'use strict';
/**
 * scoreboard.js — pure, serializable score/progression state for every sport's
 * game model. No GAS, no DOM, no Date/random (state is a plain object the client
 * persists to localStorage for mid-game reload-resume, and the server formats for
 * a recorded final). The live game tool (MX-2) drives this; SCHEDULE result
 * capture (MX-2c) formats a final via resultLabel/finalScore.
 *
 * Models (from Sports.get(code).scoreModel):
 *   goals  — two-sided integer (soccer). W/L/T by goal count.
 *   points — two-sided integer, multi-value increments (basketball 1/2/3).
 *   sets   — points within a set + sets won (volleyball). Auto-detects set/match
 *            win by pointsPerSet / decidingSetPoints / winBy / setsToWin.
 *   runs   — runs per half-inning + outs (baseball). Home bats the bottom.
 *   places — finish order → team place-sum (cross-country). Lower is better.
 *
 * 'home' is HCS's side throughout (the tool seeds homeName = HCS); resultLabel is
 * written from that perspective.
 */

var Scoreboard = (function () {
  function n(v, d) { var x = parseInt(v, 10); return isFinite(x) ? x : (d || 0); }

  /** Fresh state for a model. opts carries the volleyball set rules + team names. */
  function create(model, opts) {
    opts = opts || {};
    var base = { model: model, homeName: opts.homeName || 'HCS', awayName: opts.awayName || 'Opponent', log: [] };
    if (model === 'sets') {
      return Object.assign(base, {
        setsToWin: n(opts.setsToWin, 3), pointsPerSet: n(opts.pointsPerSet, 25),
        decidingSetPoints: n(opts.decidingSetPoints, 15), winBy: n(opts.winBy, 2),
        sets: [{ home: 0, away: 0 }], setIndex: 0
      });
    }
    if (model === 'runs') {
      return Object.assign(base, {
        innings: n(opts.innings, 7), inningIndex: 0, half: 'top', outs: 0,
        lines: [{ top: 0, bottom: 0 }]
      });
    }
    if (model === 'places') return Object.assign(base, { finishers: [] });
    return Object.assign(base, { home: 0, away: 0 }); // goals / points
  }

  // ---- goals / points ------------------------------------------------------
  function score(state, side, delta, atSec) {
    if (side !== 'home' && side !== 'away') return state;
    if (state.model === 'sets') return setPoint(state, side, delta, atSec);
    state[side] = Math.max(0, n(state[side]) + n(delta));
    if (n(delta) > 0) state.log.push({ side: side, pts: n(delta), at: n(atSec) });
    return state;
  }

  // ---- sets (volleyball) ---------------------------------------------------
  function isDecidingSet(state) {
    var w = setsWonBefore(state, state.setIndex);
    return w.home === state.setsToWin - 1 && w.away === state.setsToWin - 1;
  }
  function setTarget(state) { return isDecidingSet(state) ? state.decidingSetPoints : state.pointsPerSet; }
  /** Winner of a specific set object given a point target + win-by, or null. */
  function winnerOfSet(set, target, winBy) {
    var h = n(set.home), a = n(set.away);
    if (h >= target && h - a >= winBy) return 'home';
    if (a >= target && a - h >= winBy) return 'away';
    return null;
  }
  function setsWonBefore(state, idx) {
    var w = { home: 0, away: 0 };
    for (var i = 0; i < idx && i < state.sets.length; i++) {
      // completed sets use the target that applied when they were the decider or not;
      // recompute conservatively with the standard target (a completed earlier set
      // is never the decider, so pointsPerSet is correct for i < last).
      var deciding = state.setsToWin - 1 === w.home && state.setsToWin - 1 === w.away;
      var win = winnerOfSet(state.sets[i], deciding ? state.decidingSetPoints : state.pointsPerSet, state.winBy);
      if (win) w[win]++;
    }
    return w;
  }
  function setsWon(state) {
    if (state.model !== 'sets') return null;
    var w = { home: 0, away: 0 };
    for (var i = 0; i < state.sets.length; i++) {
      var deciding = w.home === state.setsToWin - 1 && w.away === state.setsToWin - 1;
      var win = winnerOfSet(state.sets[i], deciding ? state.decidingSetPoints : state.pointsPerSet, state.winBy);
      if (win) w[win]++;
    }
    return w;
  }
  function currentSetWinner(state) { return winnerOfSet(state.sets[state.setIndex], setTarget(state), state.winBy); }
  function setPoint(state, side, delta, atSec) {
    var cur = state.sets[state.setIndex]; if (!cur) return state;
    // Don't score a set that's already decided (wait for nextSet), but allow −1 to correct.
    if (n(delta) > 0 && currentSetWinner(state)) return state;
    cur[side] = Math.max(0, n(cur[side]) + n(delta));
    if (n(delta) > 0) state.log.push({ side: side, pts: 1, at: n(atSec), set: state.setIndex + 1 });
    return state;
  }
  function nextSet(state) {
    if (state.model !== 'sets') return state;
    if (!currentSetWinner(state) || matchOver(state)) return state;
    state.sets.push({ home: 0, away: 0 }); state.setIndex++;
    return state;
  }

  // ---- runs (baseball) -----------------------------------------------------
  function runs(state, delta, atSec) {
    if (state.model !== 'runs') return state;
    var line = state.lines[state.inningIndex]; if (!line) return state;
    var key = state.half === 'top' ? 'top' : 'bottom';
    line[key] = Math.max(0, n(line[key]) + n(delta));
    if (n(delta) > 0) state.log.push({ side: state.half === 'top' ? 'away' : 'home', pts: n(delta), at: n(atSec), inning: state.inningIndex + 1, half: state.half });
    return state;
  }
  function out(state) {
    if (state.model !== 'runs') return state;
    state.outs = n(state.outs) + 1;
    if (state.outs >= 3) {
      state.outs = 0;
      if (state.half === 'top') { state.half = 'bottom'; }
      else { state.half = 'top'; state.inningIndex++; if (!state.lines[state.inningIndex]) state.lines.push({ top: 0, bottom: 0 }); }
    }
    return state;
  }

  // ---- places (cross-country) ---------------------------------------------
  // extra (optional) carries { athleteId, gender } so a finish links to a roster
  // runner (XT-2 single-device capture: tap the runner as they cross).
  function finish(state, name, atSec, extra) {
    if (state.model !== 'places') return state;
    var f = { name: String(name || ('Runner ' + (state.finishers.length + 1))), place: state.finishers.length + 1, at: n(atSec) };
    if (extra && typeof extra === 'object') { if (extra.athleteId) f.athleteId = String(extra.athleteId); if (extra.gender) f.gender = String(extra.gender); }
    state.finishers.push(f);
    return state;
  }
  function undoFinish(state) { if (state.model === 'places') state.finishers.pop(); return state; }
  /** Sum of the top-N HCS finish places (lower = better). */
  function placeScore(state, topN) {
    topN = topN || 5;
    var top = state.finishers.slice(0, topN);
    return top.length ? top.reduce(function (s, f) { return s + n(f.place); }, 0) : null;
  }

  // ---- totals + status -----------------------------------------------------
  function totals(state) {
    if (state.model === 'runs') {
      var h = 0, a = 0; state.lines.forEach(function (l) { h += n(l.bottom); a += n(l.top); });
      return { home: h, away: a };
    }
    if (state.model === 'sets') return setsWon(state);
    if (state.model === 'places') return { home: placeScore(state), away: null };
    return { home: n(state.home), away: n(state.away) };
  }
  function matchOver(state) {
    if (state.model !== 'sets') return false;
    var w = setsWon(state);
    return w.home >= state.setsToWin || w.away >= state.setsToWin;
  }

  // ---- final formatting (used live + for SCHEDULE result capture) ----------
  function letter(h, a) { return h > a ? 'W' : (h < a ? 'L' : 'T'); }
  /** HCS-perspective final string, model-aware. */
  function resultLabel(state) {
    var t = totals(state);
    if (state.model === 'places') {
      var ps = placeScore(state);
      return ps == null ? '' : 'Place score ' + ps;
    }
    if (t.home == null && t.away == null) return '';
    if (state.model === 'sets') {
      var lines = state.sets.filter(function (s) { return n(s.home) || n(s.away); }).map(function (s) { return n(s.home) + '-' + n(s.away); }).join(', ');
      return letter(t.home, t.away) + ' ' + t.home + '–' + t.away + (lines ? ' (' + lines + ')' : '');
    }
    return letter(t.home, t.away) + ' ' + t.home + '–' + t.away; // goals / points / runs
  }
  /** Compact serializable final for SCHEDULE (HomeScore/AwayScore + ScoreJson). */
  function finalScore(state) {
    var t = totals(state);
    var out = { model: state.model, home: t.home, away: t.away, result: resultLabel(state) };
    if (state.model === 'sets') out.sets = state.sets.filter(function (s) { return n(s.home) || n(s.away); });
    if (state.model === 'runs') out.lines = state.lines;
    if (state.model === 'places') { out.placeScore = placeScore(state); out.finishers = state.finishers; }
    return out;
  }

  // ---- Recorded finals (SCHEDULE.ScoreJson) ---------------------------------
  /**
   * Compose a recorded final from manual score entry, HCS-first ('home' = HCS,
   * matching the live tool). opts: {our, opp, linesText, placeScore}.
   * linesText (sets) = "25-20, 23-25, 25-18" our-score-first per set.
   * Returns the ScoreJson shape ({model, home, away, result, ...}) or null
   * when there's nothing recordable.
   */
  function composeRecorded(model, opts) {
    opts = opts || {};
    if (model === 'places') {
      var ps = parseInt(opts.placeScore, 10);
      if (!isFinite(ps)) return null;
      return { model: 'places', home: ps, away: null, placeScore: ps, result: 'Place score ' + ps };
    }
    var our = parseInt(opts.our, 10), opp = parseInt(opts.opp, 10);
    if (!isFinite(our) || !isFinite(opp)) return null;
    var out = { model: model || 'goals', home: our, away: opp, result: letter(our, opp) + ' ' + our + '–' + opp };
    if (model === 'sets') {
      var lines = String(opts.linesText || '').split(',').map(function (s) {
        var m = s.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/);
        return m ? { home: parseInt(m[1], 10), away: parseInt(m[2], 10) } : null;
      }).filter(function (x) { return x; });
      if (lines.length) {
        out.sets = lines;
        out.result += ' (' + lines.map(function (s) { return s.home + '-' + s.away; }).join(', ') + ')';
      }
    }
    return out;
  }

  /**
   * Render-safe recorded result for an event row: {text, tone} or null when
   * nothing is recorded. Never fabricates "42–null" — the Result string (or
   * ScoreJson.result) wins; integer Home/AwayScore only used when BOTH parse.
   * tone: win/loss from a leading W/L, else 'plain' (ties, XC place scores).
   */
  function recordedResult(ev) {
    if (!ev) return null;
    var text = String(ev.Result || '');
    if (!text && ev.ScoreJson) {
      try { var sj = typeof ev.ScoreJson === 'string' ? JSON.parse(ev.ScoreJson) : ev.ScoreJson; if (sj && sj.result) text = String(sj.result); } catch (e) {}
    }
    if (!text) {
      var h = Number(ev.HomeScore), a = Number(ev.AwayScore);
      var hasH = ev.HomeScore !== '' && ev.HomeScore != null, hasA = ev.AwayScore !== '' && ev.AwayScore != null;
      if (hasH && hasA && isFinite(h) && isFinite(a)) text = h + '–' + a;
      else return null;
    }
    var tone = /^w/i.test(text) ? 'win' : (/^l/i.test(text) ? 'loss' : 'plain');
    return { text: text, tone: tone };
  }

  return {
    create: create, score: score, runs: runs, out: out, nextSet: nextSet,
    composeRecorded: composeRecorded, recordedResult: recordedResult,
    finish: finish, undoFinish: undoFinish, placeScore: placeScore,
    totals: totals, setsWon: setsWon, currentSetWinner: currentSetWinner,
    isDecidingSet: isDecidingSet, setTarget: setTarget, matchOver: matchOver,
    resultLabel: resultLabel, finalScore: finalScore
  };
})();

if (typeof module !== 'undefined') module.exports = Scoreboard;

/* ===================== apps/fan/server/lib/fanview.js ===================== */
/* GENERATED FILE — DO NOT HAND-EDIT.
 * Source of truth: logic/*.js and gas-shared/*.js (unit-tested in Node).
 * Regenerate with: npm run build
 */
'use strict';
/**
 * fanview.js — THE public-data contract for the anonymous fan surface (Phase C).
 * No GAS, no DOM. This is the security boundary: an anonymous fan may see ONLY
 * what these functions emit.
 *
 * Doctrine: build each public object field-by-field from an explicit whitelist —
 * NEVER spread or copy a raw row. That way a new column added to SCHEDULE later
 * (a note, a PII field, an internal flag) can never silently become public; it
 * simply isn't referenced here. There is deliberately NO path that emits athlete
 * names, rosters, attendance, travel, guardians, contact info, or any PII —
 * only team-level schedule + final scores + public stream links.
 */

var FanView = (function () {
  function s(v) { return v == null ? '' : String(v); }

  /** One public event. opts: { teamLabel, resultText, resultTone }. */
  function publicEvent(ev, opts) {
    if (!ev) return null;
    opts = opts || {};
    return {
      id: s(ev.EventID),
      sport: s(ev.Sport),
      level: s(ev.Level),
      gender: s(ev.Gender),
      team: s(opts.teamLabel),
      type: s(ev.EventType),
      date: s(ev.Date),
      time: s(ev.StartTime),
      opponent: s(ev.Opponent),
      homeAway: s(ev.HomeAway),
      location: s(ev.LocationName),
      status: s(ev.Status),
      result: s(opts.resultText),
      resultTone: s(opts.resultTone),
      liveStreamUrl: ev.LiveStreamUrl ? s(ev.LiveStreamUrl) : '',
      highlightUrl: ev.HighlightUrl ? s(ev.HighlightUrl) : ''
    };
  }

  /**
   * Map raw SCHEDULE rows → public events. opts:
   *   labelFn(ev)       → team display label (no PII)
   *   resultFn(ev)      → { text, tone } | null  (recorded final)
   *   practiceTeamIds   → { TeamID: true } teams that opted PRACTICES into the
   *                       public calendar. Practices are excluded for every other
   *                       team (games/meets are always public).
   */
  var PUBLIC_TYPES = { Game: 1, Scrimmage: 1, Tournament: 1, Meet: 1, Match: 1, Other: 1, '': 1 };
  function publicSchedule(events, opts) {
    opts = opts || {};
    var labelFn = opts.labelFn || function () { return ''; };
    var resultFn = opts.resultFn || function () { return null; };
    var practiceTeams = opts.practiceTeamIds || {};
    return (events || [])
      .filter(function (ev) {
        if (!ev) return false;
        var type = s(ev.EventType);
        // Practices only for teams that explicitly opted in (per-team flag) —
        // never blanket, so onboarding a sport can't leak its practice times.
        if (type === 'Practice') return practiceTeams[s(ev.TeamID)] === true;
        return PUBLIC_TYPES[type] || false;
      })
      .map(function (ev) {
        var r = resultFn(ev) || {};
        return publicEvent(ev, { teamLabel: labelFn(ev), resultText: r.text, resultTone: r.tone });
      })
      .filter(Boolean);
  }

  return { publicEvent: publicEvent, publicSchedule: publicSchedule };
})();

if (typeof module !== 'undefined') module.exports = FanView;

/* ===================== export (demo wrapper) ===================== */
window.TalonFanLogic = { SCHEMA: SCHEMA, TIER: TIER, Projection: Projection, Announcements: Announcements,
  Labels: Labels, Scoreboard: Scoreboard, FanView: FanView };
})(typeof window !== 'undefined' ? window : this);
