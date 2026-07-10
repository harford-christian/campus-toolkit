/* mock.js — Talon Hub · Staff demo backend. The untouched app funnels every
   server call through one dispatcher: call(fn,args) -> google.script.run.api(fn,args).
   So the ONLY backend method is api(fn, args); everything switches on fn.
   Every response is {ok:true,...} or {ok:false,code}. State is held in memory and
   mutated in place, so setCheckoff / ackAttendance / setEventStatus / addToTeam /
   removeFromTeam / setPlayerProfile change the data and return the refreshed payload.
   Event dates are resolved here (relative to today) so events stay upcoming. */
window.MOCK_BACKEND = (function () {
  'use strict';

  var D = window.STAFF_DATA;

  // ---- mutable state (deep-cloned from data so reloads are stateless per page load) ----
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  var state = {
    teams: clone(D.teams),
    rosters: clone(D.rosters),
    events: clone(D.events),
    directory: clone(D.directory),
    eventStatus: {},                 // EventID -> overridden Status
    checkoffs: {},                   // EventID -> athleteId -> {out,ret}
    missing: {},                     // EventID -> [ {athleteId,status,reason,setBy,coachAck} ]
    addSeq: 0
  };
  // seed per-event checkoff flags + mutable missing lists
  state.events.forEach(function (ev) {
    var ck = state.checkoffs[ev.EventID] = {};
    (ev.seedChecked && ev.seedChecked.out || []).forEach(function (id) { (ck[id] = ck[id] || { out: false, ret: false }).out = true; });
    (ev.seedChecked && ev.seedChecked.ret || []).forEach(function (id) { (ck[id] = ck[id] || { out: false, ret: false }).ret = true; });
    state.missing[ev.EventID] = clone(ev.missing || []);
  });

  // ---- date helpers (events stored as inDays offsets) ----
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // ---- lookups ----
  function teamById(id) { return state.teams.filter(function (t) { return t.TeamID === id; })[0]; }
  function teamLabel(id) { var t = teamById(id); return t ? t.label : id; }
  function eventById(id) { return state.events.filter(function (e) { return e.EventID === id; })[0]; }
  function findAthlete(id) {
    var out = null;
    Object.keys(state.rosters).forEach(function (k) {
      state.rosters[k].forEach(function (a) { if (a.athleteId === id) out = a; });
    });
    return out;
  }
  function nameOf(id) { var a = findAthlete(id); return a ? (a.first + ' ' + a.last) : id; }

  function deriveMissingForms(c) {
    var m = [];
    if (!c.PhysicalOnFile) m.push('Physical');
    if (!c.ConcussionFormOnFile) m.push('Concussion form');
    if (!c.HandbookSigned) m.push('Handbook');
    return m;
  }

  // ---- serializers ----
  function teamRow(t) {
    return {
      TeamID: t.TeamID, Sport: t.Sport, Level: t.Level, Gender: t.Gender, Season: t.Season,
      CoachEmails: t.CoachEmails, Active: t.Active, label: t.label, CalendarId: t.CalendarId
    };
  }
  function eventRow(ev) {
    return {
      EventID: ev.EventID, TeamID: ev.TeamID, Sport: ev.Sport, Gender: ev.Gender, Season: ev.Season, Level: ev.Level,
      EventType: ev.EventType, Date: fmtDate(ev.inDays), StartTime: ev.StartTime, EndTimeEst: ev.EndTimeEst,
      Opponent: ev.Opponent, HomeAway: ev.HomeAway, LocationName: ev.LocationName, LocationAddress: ev.LocationAddress,
      DepartTime: ev.DepartTime, ReturnEstTime: ev.ReturnEstTime, TransportMode: ev.TransportMode, UniformNote: ev.UniformNote,
      Status: state.eventStatus[ev.EventID] || ev.Status, StaffNotes: ev.StaffNotes,
      exceptionCount: ev.exceptionCount, teamLabel: teamLabel(ev.TeamID)
    };
  }
  function rosterRow(a) {
    return {
      athleteId: a.athleteId, first: a.first, last: a.last, grade: a.grade, jersey: a.jersey, position: a.position,
      status: 'Enrolled', guardianCount: a.guardianCount, primaryGuardian: a.primaryGuardian,
      missingForms: deriveMissingForms(a.compliance), photo: a.photo || ''
    };
  }

  // ---- manifest ----
  function checkFlags(evId, id) { var ck = state.checkoffs[evId] || {}; return ck[id] || { out: false, ret: false }; }
  function entry(evId, id) { var f = checkFlags(evId, id); return { athleteId: id, name: nameOf(id), checkedOut: !!f.out, checkedReturn: !!f.ret }; }
  function entryG(evId, g) { var e = entry(evId, g.athleteId); e.authorizedBy = g.authorizedBy; e.isOverride = !!g.isOverride; e.note = g.note || ''; return e; }

  function buildManifest(ev) {
    var roster = state.rosters[ev.TeamID] || [];
    var miss = ev.missing || [];
    var absentIds = miss.filter(function (m) { return m.status === 'ABSENT'; }).map(function (m) { return m.athleteId; });
    var selfIds = miss.filter(function (m) { return m.status === 'SELF'; }).map(function (m) { return m.athleteId; });
    var rp = ev.returnPlan || { guardian: [], self: [], other: [] };
    var retGuardianIds = rp.guardian.map(function (g) { return g.athleteId; });
    var retSelfIds = rp.self || [];
    var retOtherIds = rp.other.map(function (g) { return g.athleteId; });
    var outSpecial = absentIds.concat(selfIds);
    var retSpecial = absentIds.concat(retGuardianIds, retSelfIds, retOtherIds);

    var outTeam = roster.filter(function (a) { return outSpecial.indexOf(a.athleteId) === -1; }).map(function (a) { return entry(ev.EventID, a.athleteId); });
    var retTeam = roster.filter(function (a) { return retSpecial.indexOf(a.athleteId) === -1; }).map(function (a) { return entry(ev.EventID, a.athleteId); });

    var outboundChecked = outTeam.filter(function (e) { return e.checkedOut; }).length;
    var returnChecked = retTeam.filter(function (e) { return e.checkedReturn; }).length;

    return {
      outbound: {
        team: outTeam,
        self: selfIds.map(function (id) { return entry(ev.EventID, id); }),
        absent: absentIds.map(function (id) { return entry(ev.EventID, id); })
      },
      returnLeg: {
        team: retTeam,
        guardian: rp.guardian.map(function (g) { return entryG(ev.EventID, g); }),
        self: retSelfIds.map(function (id) { return entry(ev.EventID, id); }),
        other: rp.other.map(function (g) { return entryG(ev.EventID, g); })
      },
      counts: {
        outboundExpected: outTeam.length, outboundChecked: outboundChecked,
        returnExpected: retTeam.length, returnChecked: returnChecked
      }
    };
  }

  // ---- endpoint implementations ----
  function getStaffBundle() {
    return {
      ok: true, role: D.role, season: D.season,
      teams: state.teams.map(teamRow),
      multiSport: clone(D.multiSport),
      events: state.events.map(eventRow),
      neverLoggedIn: D.neverLoggedIn
    };
  }

  function getManifest(args) {
    var ev = eventById(args.eventId);
    if (!ev) return { ok: false, code: 'NO_EVENT' };
    return { ok: true, event: eventRow(ev), manifest: buildManifest(ev) };
  }

  function getMissingList(args) {
    var ev = eventById(args.eventId);
    if (!ev) return { ok: false, code: 'NO_EVENT' };
    var list = (state.missing[ev.EventID] || []).map(function (m) {
      return { athleteId: m.athleteId, name: nameOf(m.athleteId), status: m.status, reason: m.reason, setBy: m.setBy, coachAck: !!m.coachAck };
    });
    return { ok: true, event: eventRow(ev), missing: list };
  }

  function setCheckoff(args) {
    var ev = eventById(args.eventId);
    if (!ev) return { ok: false, code: 'NO_EVENT' };
    var ck = state.checkoffs[ev.EventID] = state.checkoffs[ev.EventID] || {};
    var f = ck[args.athleteId] = ck[args.athleteId] || { out: false, ret: false };
    if (args.leg === 'OUT') f.out = !!args.present; else f.ret = !!args.present;
    return getManifest({ eventId: args.eventId });
  }

  function ackAttendance(args) {
    var ev = eventById(args.eventId);
    if (!ev) return { ok: false, code: 'NO_EVENT' };
    (state.missing[ev.EventID] || []).forEach(function (m) { if (m.athleteId === args.athleteId) m.coachAck = true; });
    return getMissingList({ eventId: args.eventId });
  }

  function setEventStatus(args) {
    var ev = eventById(args.eventId);
    if (!ev) return { ok: false, code: 'NO_EVENT' };
    state.eventStatus[ev.EventID] = args.status;
    return { ok: true, status: args.status, notified: { sent: 12, refused: false } };
  }

  function searchDirectory(args) {
    var q = String(args.query || '').trim().toLowerCase();
    if (q.length < 2) return { ok: true, results: [] };
    var results = state.directory.filter(function (p) {
      return (p.first + ' ' + p.last).toLowerCase().indexOf(q) !== -1 ||
             p.last.toLowerCase().indexOf(q) !== -1 || p.first.toLowerCase().indexOf(q) !== -1;
    }).map(function (p) {
      return { directoryKey: p.directoryKey, first: p.first, last: p.last, grade: p.grade, gradYear: p.gradYear, guardianCount: p.guardianCount };
    });
    return { ok: true, results: results };
  }

  function getTeamRoster(args) {
    var roster = state.rosters[args.teamId];
    if (!roster) return { ok: false, code: 'NO_TEAM' };
    return { ok: true, roster: roster.map(rosterRow) };
  }

  function addToTeam(args) {
    var roster = state.rosters[args.teamId];
    if (!roster) return { ok: false, code: 'NO_TEAM' };
    var d = state.directory.filter(function (p) { return p.directoryKey === args.directoryKey; })[0];
    if (!d) return { ok: false, code: 'NO_DIRECTORY_ENTRY' };
    var newId = 'ADD-' + (++state.addSeq) + '-' + d.directoryKey;
    if (!findAthlete(newId)) {
      roster.push({
        athleteId: newId, first: d.first, last: d.last, grade: d.grade, jersey: '', position: '',
        status: 'Enrolled', guardianCount: d.guardianCount, primaryGuardian: '', photo: '',
        compliance: { PhysicalOnFile: false, ConcussionFormOnFile: false, HandbookSigned: false },
        profile: {
          AthleteID: newId, PreferredName: '', SpiritWearSize: '', AthleteCellPhone: '', NotesToCoach: '',
          ShoeSize: '', JerseySize: '', ShortsSize: '', WarmupSize: '', BackpackNumber: '', EquipmentNotes: '', GearIssued: ''
        }
      });
    }
    return getTeamRoster({ teamId: args.teamId });
  }

  function removeFromTeam(args) {
    var roster = state.rosters[args.teamId];
    if (!roster) return { ok: false, code: 'NO_TEAM' };
    state.rosters[args.teamId] = roster.filter(function (a) { return a.athleteId !== args.athleteId; });
    return getTeamRoster({ teamId: args.teamId });
  }

  function getPlayerProfile(args) {
    var a = findAthlete(args.athleteId);
    if (!a) return { ok: false, code: 'NO_ATHLETE' };
    return {
      ok: true, athleteId: a.athleteId, name: a.first + ' ' + a.last, photo: a.photo || '',
      compliance: clone(a.compliance), profile: clone(a.profile)
    };
  }

  function setPlayerProfile(args) {
    var a = findAthlete(args.athleteId);
    if (!a) return { ok: false, code: 'NO_ATHLETE' };
    var fields = ['PreferredName', 'SpiritWearSize', 'AthleteCellPhone', 'NotesToCoach', 'ShoeSize',
      'JerseySize', 'ShortsSize', 'WarmupSize', 'BackpackNumber', 'EquipmentNotes', 'GearIssued'];
    fields.forEach(function (k) { if (args[k] !== undefined) a.profile[k] = args[k]; });
    if (args.PhysicalOnFile !== undefined) a.compliance.PhysicalOnFile = !!args.PhysicalOnFile;
    if (args.ConcussionFormOnFile !== undefined) a.compliance.ConcussionFormOnFile = !!args.ConcussionFormOnFile;
    if (args.HandbookSigned !== undefined) a.compliance.HandbookSigned = !!args.HandbookSigned;
    return getPlayerProfile({ athleteId: args.athleteId });
  }

  // Photo upload (the untouched app's Profile view calls this). Stateful for a
  // complete demo experience; unlisted server fns still fall through to NO_SUCH_FN.
  function uploadPhoto(args) {
    var a = findAthlete(args.athleteId);
    if (!a) return { ok: false, code: 'NO_ATHLETE' };
    a.photo = args.dataUri || '';
    return { ok: true, photo: a.photo };
  }

  function importDirectory() { return { ok: true, imported: 214, athletes: 186 }; }
  function syncMyTeams() { return { ok: true, created: 2, updated: 3, skipped: 1, teams: 2 }; }

  // ---- single dispatcher ----
  function api(fn, args) {
    args = args || {};
    switch (fn) {
      case 'getStaffBundle': return getStaffBundle();
      case 'getManifest': return getManifest(args);
      case 'getMissingList': return getMissingList(args);
      case 'setCheckoff': return setCheckoff(args);
      case 'ackAttendance': return ackAttendance(args);
      case 'setEventStatus': return setEventStatus(args);
      case 'searchDirectory': return searchDirectory(args);
      case 'getTeamRoster': return getTeamRoster(args);
      case 'addToTeam': return addToTeam(args);
      case 'removeFromTeam': return removeFromTeam(args);
      case 'getPlayerProfile': return getPlayerProfile(args);
      case 'setPlayerProfile': return setPlayerProfile(args);
      case 'uploadPhoto': return uploadPhoto(args);
      case 'importDirectory': return importDirectory();
      case 'syncMyTeams': return syncMyTeams();
      default: return { ok: false, code: 'NO_SUCH_FN' };
    }
  }

  return { api: api };
})();
