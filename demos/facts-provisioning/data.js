/* data.js — fabricated, realistic sample data for the FACTS → Google → Microsoft 365
   identity provisioning console demo. No real students, staff, IDs, keys, or hosts.
   Names are invented; FACTS IDs are fake (31004xx range); domain/brand are the
   client's (HCS / @harfordchristian.org). Passwords use a kid-word list. */
window.PROVISIONING_DATA = {

  // ---- Pending new accounts (the hero table) ----
  // gStatus: pending | created | error | skipped-existing
  // m365.state: none | pending | licensed | error   (sku shown as label)
  // m365Fail: when true, the M365 sync flips this row's pending -> error
  pending: [
    { factsId:"3100412", name:"Olivia Brooks",   grade:"9",  email:"obrooks@harfordchristian.org",  ou:"/Students/2028-2029",
      password:"maple-otter-47",  gStatus:"pending", m365:{ state:"none" } },

    { factsId:"3100418", name:"Ethan Sandoval",  grade:"11", email:"esandoval@harfordchristian.org",ou:"/Students/2026-2027",
      password:"river-cocoa-08",  gStatus:"pending", m365:{ state:"none" } },

    { factsId:"3100423", name:"Ava Carter",      grade:"7",  email:"acarter@harfordchristian.org",  ou:"/Students/2030-2031",
      password:"sunny-pebble-63", gStatus:"pending", m365:{ state:"none" } },

    { factsId:"3100427", name:"Ava Carter",      grade:"4",  email:"acarter2@harfordchristian.org", ou:"/Students/2033-2034",
      password:"clover-badge-19", gStatus:"pending", m365:{ state:"none" },
      tagNote:"collision — 2nd A. Carter", gNote:"suffix +2" },

    { factsId:"3100431", name:"Liam O'Brien",    grade:"6",  email:"obrien@harfordchristian.org",   ou:"/Students/2031-2032",
      password:"acorn-turtle-52", gStatus:"pending", m365:{ state:"none" },
      gNote:"punctuation stripped" },

    { factsId:"3100436", name:"Sofia Delacroix", grade:"PK", email:"sdelacroix@harfordchristian.org",ou:"/Students/2038-2039",
      password:"bunny-marble-31", gStatus:"pending", m365:{ state:"none" } },

    { factsId:"3100440", name:"Noah Whitfield",  grade:"K",  email:"nwhitfield@harfordchristian.org",ou:"/Students/2037-2038",
      password:"comet-waffle-74", gStatus:"pending", m365:{ state:"none" } },

    { factsId:"3100445", name:"Maya Thompson",   grade:"10", email:"mthompson@harfordchristian.org",ou:"/Students/2027-2028",
      password:"willow-fox-26",   gStatus:"pending", m365:{ state:"none" } },

    { factsId:"3100449", name:"Caleb Nguyen",    grade:"2",  email:"cnguyen@harfordchristian.org",  ou:"/Students/2035-2036",
      password:"ginger-kite-90",  gStatus:"pending", m365:{ state:"none" } },

    { factsId:"3100453", name:"Harper Ellison",  grade:"12", email:"hellison@harfordchristian.org", ou:"/Students/2025-2026",
      password:"amber-panda-15",  gStatus:"pending", m365:{ state:"none" },
      m365Fail:true },

    // already provisioned — skipped, no create, no password
    { factsId:"3100404", name:"Isabella Fontaine",grade:"8", email:"ifontaine@harfordchristian.org",ou:"/Students/2029-2030",
      password:"", gStatus:"skipped-existing", m365:{ state:"licensed", sku:"A1 Students" },
      gNote:"account already exists" },

    // hard error — directory rejects the create
    { factsId:"3100459", name:"Mason Alvarado",  grade:"5",  email:"malvarado@harfordchristian.org",ou:"/Students/2032-2033",
      password:"tiger-pretzel-38",gStatus:"error", m365:{ state:"none" },
      gNote:"entity already exists (409)" }
  ],

  // ---- Other proposals ----
  proposals: [
    { action:"MOVE_OU",   account:"jbaptiste@harfordchristian.org", detail:"Grade drift: promoted G10→G11 · /Students/2028-2029 → /Students/2027-2028" },
    { action:"MOVE_OU",   account:"rkellerman@harfordchristian.org",detail:"Grad-year corrected after retention · → /Students/2029-2030" },
    { action:"MOVE_OU",   account:"tvasquez@harfordchristian.org",  detail:"OU mismatch vs FACTS grade · → /Students/2030-2031" },
    { action:"SUSPEND",   account:"dpalmer@harfordchristian.org",   detail:"Withdrawn in FACTS 07/09 · move to /_DISABLE ME/2027-2028 + suspend sign-in" },
    { action:"SUSPEND",   account:"lmercer@harfordchristian.org",   detail:"Withdrawn (transfer) · move to /_DISABLE ME/2031-2032 + suspend" },
    { action:"CREATE_OU", account:"",                               detail:"Missing org-unit for incoming PK cohort · create /Students/2038-2039" },
    { action:"CREATE_OU", account:"",                               detail:"Missing org-unit · create /Students/2037-2038 (Kindergarten)" },
    { action:"MOVE_OU",   account:"gholloway@harfordchristian.org", detail:"Staff reassigned to /Staff/Faculty from /Staff/Aides" },
    { action:"SUSPEND",   account:"nprentice@harfordchristian.org", detail:"Graduated senior past hold window · /_DISABLE ME/2025-2026 + suspend" }
  ],

  // ---- Review flags (non-actionable, human review) ----
  flags: [
    { type:"drift",  title:"Name drift — mismatch needs review",
      detail:"FACTS says “Katherine Rowley”, Google account displays “Kate Rowley” (krowley@harfordchristian.org). Left as-is; confirm legal vs preferred." },
    { type:"absent", title:"Absent from export — still active in Google",
      detail:"pquintero@harfordchristian.org active in Workspace but not in tonight’s FACTS export. Possible mid-year status change — not auto-suspended." },
    { type:"orphan", title:"Orphan account — no matching FACTS record",
      detail:"svolkov@harfordchristian.org has no FACTS ID match by name or email. Flagged for manual reconciliation before any action." }
  ],

  // ---- Microsoft 365 mapping panel ----
  // state: synced | pending | error
  msMap: [
    { ou:"/Students",       license:"Microsoft A1 (Students)", accounts:531, state:"synced" },
    { ou:"/Students/new",   license:"Microsoft A1 (Students)", accounts:15,  state:"pending" },
    { ou:"/Staff/Faculty",  license:"Microsoft A3 (Faculty)",  accounts:44,  state:"synced" },
    { ou:"/Staff/Aides",    license:"Microsoft A3 (Faculty)",  accounts:12,  state:"synced" },
    { ou:"/_DISABLE ME",    license:"— (license removed)",     accounts:7,   state:"synced" }
  ]
};
