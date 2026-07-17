/* mock.js — Talon Hub · Staff demo backend. The untouched app funnels every
   server call through one dispatcher: call(fn,args) -> google.script.run.api(fn,args).
   So the ONLY backend method is api(fn, args); everything switches on fn. The live
   server's ENDPOINTS map has ~130 handlers; this mock reproduces the ones the Staff
   client actually calls, with shapes mirroring the real endpoints (see data.js).
   Every response is {ok:true,...} or {ok:false,code[,msg]}. State is held in memory
   and mutated in place, so writes change the data and reads reflect it. Event dates
   are resolved here (relative to today) so events stay upcoming. The _demo flag the
   real client adds is ignored — this mock always serves demo data. */
window.MOCK_BACKEND = (function () {
  'use strict';

  var D = window.STAFF_DATA;
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };

  // ---- mutable state (deep-cloned so a reload is stateless per page load) ----
  var state = {
    teams: clone(D.teams),
    rosters: clone(D.rosters),
    events: clone(D.events),
    directory: clone(D.directory),
    staff: clone(D.staff),
    announcements: clone(D.announcements),
    drills: clone(D.drills),
    sessions: clone(D.sessions),
    practiceRuns: clone(D.practiceRuns),
    lostFound: clone(D.lostFound),
    tryouts: clone(D.tryouts),
    prefs: clone(D.prefs),
    formLinks: clone(D.formLinks),
    groupOverrides: {},              // TeamID -> override email
    eventStatus: {},                 // EventID -> overridden Status
    eventScore: {},                  // EventID -> {result,home,away,json}
    eventFood: {},                   // EventID -> {name,address}
    eventMedia: {},                  // EventID -> {live,highlight}
    plans: {},                       // EventID -> practice plan {focus,objectives,blocks}
    comments: {},                    // sessionId -> [ {commentId,authorEmail,authorName,body,createdAt} ]
    lineups: {},                     // teamId -> [ {athleteId,position,role,ord,notes} ]
    gameStats: {},                   // teamId|eventId -> { athleteId: {key:val} }
    checkoffs: {},                   // EventID -> athleteId -> {out,ret}
    missing: {},                     // EventID -> [ {athleteId,status,reason,setBy,coachAck} ]
    seq: 0
  };
  state.events.forEach(function (ev) {
    var ck = state.checkoffs[ev.EventID] = {};
    (ev.seedChecked && ev.seedChecked.out || []).forEach(function (id) { (ck[id] = ck[id] || { out: false, ret: false }).out = true; });
    (ev.seedChecked && ev.seedChecked.ret || []).forEach(function (id) { (ck[id] = ck[id] || { out: false, ret: false }).ret = true; });
    state.missing[ev.EventID] = clone(ev.missing || []);
  });

  // ---- date helpers ----
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowIso() { return new Date().toISOString(); }
  function uid(p) { return p + '-' + (++state.seq) + '-' + Date.now().toString(36); }

  // ---- lookups ----
  function teamById(id) { return state.teams.filter(function (t) { return t.TeamID === id; })[0]; }
  function teamLabel(id) { var t = teamById(id); return t ? t.label : id; }
  function eventById(id) { return state.events.filter(function (e) { return e.EventID === id; })[0]; }
  function findAthlete(id) {
    var out = null;
    Object.keys(state.rosters).forEach(function (k) { state.rosters[k].forEach(function (a) { if (a.athleteId === id) out = a; }); });
    return out;
  }
  function nameOf(id) { var a = findAthlete(id); return a ? (a.first + ' ' + a.last) : id; }
  function emailFromName(name) { return String(name || '').trim().toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, '.') || 'guardian'; }

  function deriveMissingForms(c) {
    var m = [];
    if (!c.PhysicalOnFile) m.push('Physical');
    if (!c.ConcussionFormOnFile) m.push('Concussion form');
    if (!c.HandbookSigned) m.push('Handbook');
    return m;
  }

  // ---- serializers ----
  function teamRow(t) { return clone(t); }
  function eventRow(ev) {
    var sc = state.eventScore[ev.EventID] || {};
    var fd = state.eventFood[ev.EventID] || {};
    var md = state.eventMedia[ev.EventID] || {};
    return {
      EventID: ev.EventID, TeamID: ev.TeamID, Sport: ev.Sport, Gender: ev.Gender, Season: ev.Season, Level: ev.Level,
      EventType: ev.EventType, Date: fmtDate(ev.inDays), StartTime: ev.StartTime, EndTimeEst: ev.EndTimeEst,
      Opponent: ev.Opponent, HomeAway: ev.HomeAway, LocationName: ev.LocationName, LocationAddress: ev.LocationAddress,
      DepartTime: ev.DepartTime, ReturnEstTime: ev.ReturnEstTime, TransportMode: ev.TransportMode, UniformNote: ev.UniformNote,
      Status: state.eventStatus[ev.EventID] || ev.Status, StaffNotes: ev.StaffNotes,
      HomeScore: sc.home != null ? sc.home : '', AwayScore: sc.away != null ? sc.away : '', Result: sc.result || '', ScoreJson: sc.json || '',
      FoodStopName: fd.name || '', FoodStopAddress: fd.address || '',
      LiveStreamUrl: md.live || '', HighlightUrl: md.highlight || '',
      exceptionCount: ev.exceptionCount, teamLabel: teamLabel(ev.TeamID)
    };
  }
  function rosterRow(a, teamId) {
    return {
      athleteId: a.athleteId, first: a.first, last: a.last,
      gender: (teamById(teamId) || {}).Gender || '', grade: a.grade, jersey: a.jersey, position: a.position,
      status: 'Enrolled', pending: false, enrollmentId: 'ENR-' + teamId + '-' + a.athleteId,
      guardianCount: a.guardianCount, primaryGuardian: a.primaryGuardian,
      missingForms: deriveMissingForms(a.compliance), photo: a.photo || ''
    };
  }

  // ---- manifest (outbound + return legs) ----
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
  function missingList(ev) {
    return (state.missing[ev.EventID] || []).map(function (m) {
      return { athleteId: m.athleteId, name: nameOf(m.athleteId), status: m.status, reason: m.reason, setBy: m.setBy, coachAck: !!m.coachAck };
    });
  }

  // =====================================================================
  // Bundle / schedule / search
  // =====================================================================
  function getStaffBundle() {
    var sizes = {};
    Object.keys(state.rosters).forEach(function (k) { sizes[k] = state.rosters[k].length; });
    return {
      ok: true, features: clone(D.features), role: D.role, owner: !!D.owner, email: D.email, isGuardian: !!D.isGuardian,
      season: D.season, teams: state.teams.map(teamRow), announcements: state.announcements.filter(activeAnn).map(annRow),
      multiSport: clone(D.multiSport), events: state.events.map(eventRow), neverLoggedIn: D.neverLoggedIn,
      prefs: clone(state.prefs), teamSizes: sizes
    };
  }
  function getDeptSchedule() {
    var today = fmtDate(0);
    var evs = state.events.filter(function (e) { return (state.eventStatus[e.EventID] || e.Status) !== 'Cancelled' && fmtDate(e.inDays) >= today; }).map(eventRow);
    return { ok: true, events: evs };
  }
  function globalSearch(args) {
    var q = String(args.q || '').trim().toLowerCase();
    if (q.length < 2) return { ok: true, q: q, results: [] };
    var scope = args.scopeTeamIds || state.teams.map(function (t) { return t.TeamID; });
    var res = [];
    state.teams.filter(function (t) { return scope.indexOf(t.TeamID) !== -1 && t.label.toLowerCase().indexOf(q) !== -1; })
      .slice(0, 8).forEach(function (t) { res.push({ type: 'team', id: t.TeamID, title: t.label, sub: t.Season }); });
    var aCount = 0;
    scope.forEach(function (tid) {
      (state.rosters[tid] || []).forEach(function (a) {
        if (aCount < 8 && (a.first + ' ' + a.last).toLowerCase().indexOf(q) !== -1) { res.push({ type: 'athlete', id: a.athleteId, title: a.first + ' ' + a.last, sub: teamLabel(tid), teamId: tid }); aCount++; }
      });
    });
    state.events.filter(function (e) { return scope.indexOf(e.TeamID) !== -1; }).slice(0, 30).forEach(function (e) {
      if (res.filter(function (r) { return r.type === 'event'; }).length >= 8) return;
      var title = e.Opponent || (e.EventType === 'Practice' ? 'Practice' : e.EventType);
      if (String(title).toLowerCase().indexOf(q) !== -1) res.push({ type: 'event', id: e.EventID, title: title, sub: teamLabel(e.TeamID) + ' · ' + fmtDate(e.inDays) });
    });
    state.drills.filter(function (d) { return d.Name.toLowerCase().indexOf(q) !== -1; }).slice(0, 8).forEach(function (d) { res.push({ type: 'drill', id: d.DrillID, title: d.Name, sub: d.Category }); });
    return { ok: true, q: q, results: res };
  }

  // =====================================================================
  // Event board / travel legs
  // =====================================================================
  function getEventBoard(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    return { ok: true, event: eventRow(ev), manifest: buildManifest(ev), missing: missingList(ev) };
  }
  function getManifest(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    return { ok: true, event: eventRow(ev), manifest: buildManifest(ev) };
  }
  function getMissingList(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    return { ok: true, event: eventRow(ev), missing: missingList(ev) };
  }
  function setCheckoff(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'BAD_INPUT' };
    var ck = state.checkoffs[ev.EventID] = state.checkoffs[ev.EventID] || {};
    var f = ck[args.athleteId] = ck[args.athleteId] || { out: false, ret: false };
    if (args.leg === 'OUT') f.out = !!args.present; else f.ret = !!args.present;
    return { ok: true };
  }
  function ackAttendance(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'BAD_INPUT' };
    (state.missing[ev.EventID] || []).forEach(function (m) { if (m.athleteId === args.athleteId) m.coachAck = true; });
    return { ok: true, event: eventRow(ev), missing: missingList(ev) };
  }
  function setEventStatus(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    state.eventStatus[ev.EventID] = args.status;
    return { ok: true, status: args.status, notified: { sent: args.notify ? 12 : 0, refused: false } };
  }
  function setScore(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    var our = args.ourScore, opp = args.oppScore;
    if ((our === '' || our == null) && (opp === '' || opp == null) && (args.placeScore === '' || args.placeScore == null)) { delete state.eventScore[ev.EventID]; return { ok: true, result: '' }; }
    var result = '';
    if (args.model === 'places') { result = args.placeScore ? (args.placeScore + ' place') : ''; state.eventScore[ev.EventID] = { result: result, json: '' }; return { ok: true, result: result }; }
    var o = parseInt(our, 10), p = parseInt(opp, 10);
    if (isFinite(o) && isFinite(p)) result = (o > p ? 'W ' : o < p ? 'L ' : 'T ') + o + '–' + p;
    state.eventScore[ev.EventID] = { home: ev.HomeAway === 'Away' ? p : o, away: ev.HomeAway === 'Away' ? o : p, result: result, json: JSON.stringify({ model: args.model, our: o, opp: p, lines: args.linesText || '' }) };
    return { ok: true, result: result };
  }
  function setFoodStop(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    state.eventFood[ev.EventID] = { name: args.name || '', address: args.address || '' };
    return { ok: true };
  }
  function setEventMedia(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    state.eventMedia[ev.EventID] = { live: args.liveStreamUrl || '', highlight: args.highlightUrl || '' };
    return { ok: true };
  }

  // =====================================================================
  // Roster / directory / profile / guardians / enrollment
  // =====================================================================
  function searchDirectory(args) {
    var q = String(args.query || '').trim().toLowerCase();
    if (q.length < 2) return { ok: true, results: [] };
    var results = state.directory.filter(function (p) {
      return (p.first + ' ' + p.last).toLowerCase().indexOf(q) !== -1 || p.last.toLowerCase().indexOf(q) !== -1 || p.first.toLowerCase().indexOf(q) !== -1;
    }).slice(0, 30).map(function (p) {
      return { directoryKey: p.directoryKey, first: p.first, last: p.last, grade: p.grade, gradYear: p.gradYear, guardianCount: p.guardianCount };
    });
    return { ok: true, results: results };
  }
  function getTeamRoster(args) {
    var roster = state.rosters[args.teamId]; if (!roster) return { ok: false, code: 'NO_TEAM' };
    return { ok: true, roster: roster.map(function (a) { return rosterRow(a, args.teamId); }) };
  }
  function addToTeam(args) {
    var roster = state.rosters[args.teamId]; if (!roster) return { ok: false, code: 'NO_TEAM' };
    var d = state.directory.filter(function (p) { return p.directoryKey === args.directoryKey; })[0];
    if (!d) return { ok: false, code: 'NO_DIR', msg: 'Directory entry not found.' };
    var newId = 'ADD-' + (++state.seq) + '-' + d.directoryKey;
    roster.push({
      athleteId: newId, first: d.first, last: d.last, grade: d.grade, jersey: '', position: '',
      status: 'Enrolled', guardianCount: d.guardianCount, primaryGuardian: '', photo: '',
      compliance: { PhysicalOnFile: false, ConcussionFormOnFile: false, HandbookSigned: false },
      profile: { AthleteID: newId, PreferredName: '', SpiritWearSize: '', AthleteCellPhone: '', NotesToCoach: '', ShoeSize: '', JerseySize: '', ShortsSize: '', WarmupSize: '', BackpackNumber: '', EquipmentNotes: '', GearIssued: '' }
    });
    return getTeamRoster({ teamId: args.teamId });
  }
  function removeFromTeam(args) {
    var roster = state.rosters[args.teamId]; if (!roster) return { ok: false, code: 'NO_TEAM' };
    state.rosters[args.teamId] = roster.filter(function (a) { return a.athleteId !== args.athleteId; });
    return getTeamRoster({ teamId: args.teamId });
  }
  function getPlayerProfile(args) {
    var a = findAthlete(args.athleteId); if (!a) return { ok: false, code: 'DENIED' };
    return { ok: true, athleteId: a.athleteId, name: a.first + ' ' + a.last, photo: a.photo || '', compliance: clone(a.compliance), profile: clone(a.profile) };
  }
  function setPlayerProfile(args) {
    var a = findAthlete(args.athleteId); if (!a) return { ok: false, code: 'DENIED' };
    ['PreferredName', 'SpiritWearSize', 'AthleteCellPhone', 'NotesToCoach', 'ShoeSize', 'JerseySize', 'ShortsSize', 'WarmupSize', 'BackpackNumber', 'EquipmentNotes', 'GearIssued']
      .forEach(function (k) { if (args[k] !== undefined) a.profile[k] = args[k]; });
    if (args.PhysicalOnFile !== undefined) a.compliance.PhysicalOnFile = !!args.PhysicalOnFile;
    if (args.ConcussionFormOnFile !== undefined) a.compliance.ConcussionFormOnFile = !!args.ConcussionFormOnFile;
    if (args.HandbookSigned !== undefined) a.compliance.HandbookSigned = !!args.HandbookSigned;
    return getPlayerProfile({ athleteId: args.athleteId });
  }
  function uploadPhoto(args) {
    var a = findAthlete(args.athleteId); if (!a) return { ok: false, code: 'BAD_INPUT' };
    if (args.dataUri && String(args.dataUri).indexOf('data:image/') !== 0) return { ok: false, code: 'BAD_IMAGE', msg: 'Pick an image file.' };
    a.photo = args.dataUri || '';
    return { ok: true };
  }
  function getGuardians(args) {
    var a = findAthlete(args.athleteId); if (!a) return { ok: false, code: 'BAD_INPUT' };
    var g = [];
    if (a.primaryGuardian) g.push({ guardianId: a.athleteId + '#g1', name: a.primaryGuardian, email: emailFromName(a.primaryGuardian) + '@example.com', phone: '(410) 555-01' + pad((state.seq % 90) + 10), isPrimary: true });
    if (a.guardianCount > 1) g.push({ guardianId: a.athleteId + '#g2', name: a.last + ' household', email: emailFromName(a.first + ' ' + a.last) + '.2@example.com', phone: '', isPrimary: false });
    return { ok: true, guardians: g };
  }
  function upsertGuardian(args) { var a = findAthlete(args.athleteId); if (!a) return { ok: false, code: 'NO_ATHLETE' }; return { ok: true, guardianId: args.guardianId || (args.athleteId + '#g' + (++state.seq)) }; }
  function removeGuardian() { return { ok: true }; }
  function resyncGuardians(args) { var a = findAthlete(args.athleteId); if (!a) return { ok: false, code: 'NO_ATHLETE' }; return { ok: true, synced: a.guardianCount || 0 }; }
  function getCoachRecord() { return { ok: true, record: { CoachEval: '', SkillRatings: '', RoleNotes: '', HandoffSummary: '' }, released: { fields: [] } }; }
  function setCoachRecord(args) { return getCoachRecord(args); }
  function releaseCareer(args) { var f = args.fields || []; return { ok: true, released: f.length > 0, fields: f }; }
  function releaseCareerBulk(args) { return { ok: true, released: (args.athleteIds || []).length }; }
  function getCareerReleases() { return { ok: true, releases: [] }; }
  function confirmEnrollment(args) { return getTeamRoster({ teamId: rosterOfEnrollment(args.enrollmentId) }); }
  function confirmAllPending(args) { return getTeamRoster({ teamId: args.teamId }); }
  function setEnrollmentStatus(args) {
    if (['Enrolled', 'Withdrawn'].indexOf(args.status) === -1) return { ok: false, code: 'BAD_STATUS' };
    return getTeamRoster({ teamId: rosterOfEnrollment(args.enrollmentId) });
  }
  function rosterOfEnrollment(enrollmentId) { var m = String(enrollmentId || '').match(/^ENR-(.+?)-[A-Za-z]/); return m ? m[1] : (state.teams[0] && state.teams[0].TeamID); }

  // =====================================================================
  // Teams / phases / config / directory ops
  // =====================================================================
  function listTeams() { return { ok: true, teams: state.teams.map(teamRow) }; }
  function upsertTeam(args) {
    var existing = teamById(args.teamId);
    if (existing) { ['Sport', 'Gender', 'Level', 'Season', 'CalendarId', 'CoachEmails'].forEach(function (k) { var a = args[k.charAt(0).toLowerCase() + k.slice(1)]; if (a !== undefined) existing[k] = a; }); return { ok: true, teamId: existing.TeamID, created: false }; }
    var id = args.teamId || uid('TEAM');
    return { ok: true, teamId: id, created: true };
  }
  function setTeamPhase(args) {
    var t = teamById(args.teamId); if (!t) return { ok: false, code: 'BAD_PHASE' };
    var LBL = { Preseason: 'Preseason', InSeason: 'In season', Offseason: 'Offseason', Complete: 'Past season' };
    if (!LBL[args.phase]) return { ok: false, code: 'BAD_PHASE' };
    t.phase = args.phase; t.Phase = args.phase; t.phaseLabel = LBL[args.phase];
    return { ok: true, phase: args.phase, phaseLabel: LBL[args.phase] };
  }
  function rolloverTeam(args) {
    var t = teamById(args.teamId); if (!t) return { ok: false, code: 'NO_TEAM' };
    if (!args.newSeason) return { ok: false, code: 'BAD_SEASON', msg: 'Pick a season.' };
    return { ok: true, newTeamId: t.TeamID.replace(/-[^-]+$/, '-' + args.newSeason), newSeason: args.newSeason, carried: 10, graduated: 4, promotedOut: [], skipped: 1 };
  }
  function getTeamConfig(args) {
    var t = teamById(args.teamId); if (!t) return { ok: false, code: 'NO_TEAM' };
    return {
      ok: true, config: {
        key: 'soccer', name: 'Soccer', landingTab: 'gameday', clockModel: 'timed-periods', periods: 2, periodMin: 40, breakMin: 10,
        countDirection: 'up', runningClock: true, scoreModel: 'goals', scoreIncrements: [1], positions: clone(D.soccerPositions),
        squadDefault: 7, rosterRange: [16, 22], cut: true, drillCategories: ['Warm-up', 'Possession', 'Technical', 'Finishing', 'Tactical', 'Game'],
        practiceTimerMode: 'linear', eventShape: 'single-opponent', tryoutSeed: 'soccer', defaultTryouts: true,
        modules: clone(t.features), wizardComplete: t.wizardComplete !== false, overrides: clone(t.overrides || {})
      }
    };
  }
  function setTeamConfig(args) {
    var t = teamById(args.teamId); if (!t) return { ok: false, code: 'NO_TEAM' };
    if (args.modules) t.features = Object.assign({}, t.features, args.modules);
    if (args.overrides) t.overrides = Object.assign({}, t.overrides, args.overrides);
    if (args.wizardComplete !== undefined) t.wizardComplete = !!args.wizardComplete;
    return getTeamConfig({ teamId: args.teamId });
  }
  function finishOnboarding(args) { return { ok: true, teamId: args.teamId, packs: args.packs || [] }; }
  function importDirectory() { return { ok: true, imported: 214, athletes: 186 }; }
  function syncMyTeams() { return { ok: true, created: 2, updated: 3, skipped: 1, teams: 2 }; }

  // =====================================================================
  // Announcements
  // =====================================================================
  function activeAnn(a) { return a.Status === 'Active'; }
  function annRow(a) { var r = clone(a); if (!r.CreatedAt) r.CreatedAt = nowIso(); return r; }
  function listAnnouncements() { return { ok: true, announcements: state.announcements.filter(activeAnn).map(annRow) }; }
  function postAnnouncement(args) {
    if (!String(args.title || '').trim()) return { ok: false, code: 'BAD_INPUT', msg: 'Add a title.' };
    if (args.audience === 'Team' && !args.teamId) return { ok: false, code: 'BAD_INPUT', msg: 'Pick a team.' };
    state.announcements.unshift({
      AnnouncementID: uid('ANN'), Audience: args.audience || 'Team', TeamID: args.audience === 'Team' ? (args.teamId || '') : '',
      Title: String(args.title).slice(0, 120), Body: String(args.body || '').slice(0, 600), Severity: args.severity === 'urgent' ? 'urgent' : 'info',
      CreatedAt: nowIso(), ExpiresAt: args.expiresAt || '', PostedByName: 'Coach Turner', PostedByEmail: D.email, Status: 'Active'
    });
    return { ok: true, announcements: state.announcements.filter(activeAnn).map(annRow), emailed: { sent: args.alsoEmail ? 24 : 0, refused: false } };
  }
  function deleteAnnouncement(args) {
    var a = state.announcements.filter(function (x) { return x.AnnouncementID === args.id; })[0];
    if (!a) return { ok: false, code: 'NO_ITEM' };
    a.Status = 'Removed';
    return { ok: true, announcements: state.announcements.filter(activeAnn).map(annRow) };
  }

  // =====================================================================
  // Drills
  // =====================================================================
  function drillRow(d) { return Object.assign({ Scope: 'Program', TeamID: '', Status: 'Active', links: [], pinned: false, coachNote: '', useCount: 0, lastUsedAt: '' }, clone(d)); }
  function listDrills(args) {
    args = args || {};
    var list = state.drills.slice();
    if (args.category) list = list.filter(function (d) { return d.Category === args.category; });
    if (args.q) { var q = String(args.q).toLowerCase(); list = list.filter(function (d) { return d.Name.toLowerCase().indexOf(q) !== -1 || String(d.Tags || '').toLowerCase().indexOf(q) !== -1; }); }
    list.sort(function (a, b) { return a.Name < b.Name ? -1 : 1; });
    return { ok: true, drills: list.map(drillRow) };
  }
  function getDrill(args) { var d = state.drills.filter(function (x) { return x.DrillID === args.drillId; })[0]; return d ? { ok: true, drill: drillRow(d) } : { ok: false, code: 'NO_DRILL' }; }
  function upsertDrill(args) {
    if (!String(args.name || '').trim()) return { ok: false, code: 'BAD_INPUT', msg: 'Add a drill name.' };
    var d = args.drillId && state.drills.filter(function (x) { return x.DrillID === args.drillId; })[0];
    if (d) { d.Name = args.name; d.Category = args.category || d.Category; d.Tags = args.tags || ''; d.Description = args.description || ''; d.Equipment = args.equipment || ''; d.DurationMinDefault = args.durationMinDefault || d.DurationMinDefault; return { ok: true, drillId: d.DrillID }; }
    var id = uid('DRL');
    state.drills.push({ DrillID: id, Name: args.name, Category: args.category || 'Technical', Sport: args.sport || 'BSOC', Tags: args.tags || '', Description: args.description || '', Equipment: args.equipment || '', DurationMinDefault: args.durationMinDefault || 15 });
    return { ok: true, drillId: id };
  }
  function deleteDrill(args) { var i = state.drills.map(function (d) { return d.DrillID; }).indexOf(args.drillId); if (i === -1) return { ok: false, code: 'NO_DRILL' }; state.drills.splice(i, 1); return { ok: true }; }
  function setDrillPin() { return { ok: true }; }
  function setDrillNote() { return { ok: true }; }

  // =====================================================================
  // Practices: plans / sessions / runs / comments
  // =====================================================================
  function drillNameOf(id) { var d = state.drills.filter(function (x) { return x.DrillID === id; })[0]; return d ? d.Name : ''; }
  function planFor(ev) {
    var stored = state.plans[ev.EventID];
    var blocks = stored ? stored.blocks : [];
    return { eventId: ev.EventID, teamId: ev.TeamID, focus: stored ? stored.focus : '', objectives: stored ? stored.objectives : '', totalMinutes: blocks.reduce(function (s, b) { return s + (parseInt(b.durationMin, 10) || 0); }, 0), blocks: clone(blocks) };
  }
  function getPracticePlan(args) { var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' }; return { ok: true, plan: planFor(ev) }; }
  function savePracticePlan(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    var blocks = (args.blocks || []).map(function (b, i) { return { blockId: b.blockId || 'BLK-' + (i + 1), seq: i, title: b.title || '', durationMin: b.durationMin || '', notes: b.notes || '', drillId: b.drillId || '', drillName: drillNameOf(b.drillId) }; });
    state.plans[ev.EventID] = { focus: args.focus || '', objectives: args.objectives || '', blocks: blocks };
    return { ok: true, plan: planFor(ev) };
  }
  function saveEventPlanAsSession(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    var plan = planFor(ev);
    var id = uid('PS');
    state.sessions.unshift({ sessionId: id, title: plan.focus || (ev.EventType + ' plan'), scope: args.scope || 'Team', teamId: args.teamId || ev.TeamID, sport: ev.Sport, focus: plan.focus, objectives: plan.objectives, tags: '', estMinutes: plan.totalMinutes, blocks: plan.blocks });
    return { ok: true, sessionId: id };
  }
  function listSessions(args) {
    args = args || {};
    var list = state.sessions.slice();
    if (args.teamId) list = list.filter(function (s) { return s.teamId === args.teamId || s.scope === 'Program'; });
    if (args.q) { var q = String(args.q).toLowerCase(); list = list.filter(function (s) { return s.title.toLowerCase().indexOf(q) !== -1; }); }
    return { ok: true, sessions: list.map(function (s) { return { sessionId: s.sessionId, title: s.title, scope: s.scope, teamId: s.teamId, focus: s.focus, tags: s.tags, estMinutes: s.estMinutes }; }) };
  }
  function getSession(args) { var s = state.sessions.filter(function (x) { return x.sessionId === args.sessionId; })[0]; if (!s) return { ok: false, code: 'NO_SESSION' }; return { ok: true, session: clone(s) }; }
  function upsertSession(args) {
    if (!String(args.title || '').trim()) return { ok: false, code: 'BAD_INPUT', msg: 'Add a title.' };
    var blocks = (args.blocks || []).map(function (b, i) { return { blockId: b.blockId || 'BLK-' + (i + 1), seq: i, title: b.title || '', durationMin: b.durationMin || '', notes: b.notes || '', drillId: b.drillId || '', drillName: drillNameOf(b.drillId) }; });
    var est = blocks.reduce(function (s, b) { return s + (parseInt(b.durationMin, 10) || 0); }, 0);
    var s = args.sessionId && state.sessions.filter(function (x) { return x.sessionId === args.sessionId; })[0];
    if (s) { Object.assign(s, { title: args.title, scope: args.scope, teamId: args.teamId, sport: args.sport, focus: args.focus, objectives: args.objectives, tags: args.tags, estMinutes: est, blocks: blocks }); return { ok: true, sessionId: s.sessionId }; }
    var id = uid('PS');
    state.sessions.unshift({ sessionId: id, title: args.title, scope: args.scope || 'Team', teamId: args.teamId || '', sport: args.sport || '', focus: args.focus || '', objectives: args.objectives || '', tags: args.tags || '', estMinutes: est, blocks: blocks });
    return { ok: true, sessionId: id };
  }
  function deleteSession(args) { var i = state.sessions.map(function (s) { return s.sessionId; }).indexOf(args.sessionId); if (i === -1) return { ok: false, code: 'NO_SESSION' }; state.sessions.splice(i, 1); return { ok: true }; }
  function attachSessionToEvent(args) {
    var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' };
    var s = state.sessions.filter(function (x) { return x.sessionId === args.sessionId; })[0]; if (!s) return { ok: false, code: 'NO_SESSION' };
    state.plans[ev.EventID] = { focus: s.focus, objectives: s.objectives, blocks: clone(s.blocks) };
    return { ok: true, plan: planFor(ev) };
  }
  function listPracticeRuns() { return { ok: true, runs: state.practiceRuns.map(function (r) { return { runId: r.runId, title: r.title, teamId: r.teamId, ranOn: fmtDate(r.inDays), durationMin: r.durationMin }; }) }; }
  function buildPractice(args) {
    args = args || {};
    var picks = (args.selectedDrillIds && args.selectedDrillIds.length) ? args.selectedDrillIds : state.drills.slice(0, args.drillCount || 4).map(function (d) { return d.DrillID; });
    var per = args.perDrillMin || 15;
    var blocks = [];
    if (args.includeWarmup !== false) blocks.push({ blockId: 'W', title: 'Warm-up', durationMin: args.warmupMin || 10, notes: '', drillId: 'DRL-001', drillName: 'Dynamic warm-up circuit' });
    picks.forEach(function (id, i) { blocks.push({ blockId: 'B' + i, title: drillNameOf(id) || 'Drill', durationMin: per, notes: '', drillId: id, drillName: drillNameOf(id) }); });
    if (args.includeCooldown !== false) blocks.push({ blockId: 'C', title: 'Cool-down', durationMin: args.cooldownMin || 5, notes: '', drillId: '', drillName: '' });
    var total = blocks.reduce(function (s, b) { return s + (parseInt(b.durationMin, 10) || 0); }, 0);
    return { ok: true, blocks: blocks, meta: { totalMinutes: total, drillCount: picks.length } };
  }
  function logPracticeRun(args) { state.practiceRuns.unshift({ runId: uid('RUN'), title: args.title || 'Practice', teamId: args.teamId || '', inDays: 0, durationMin: args.durationMin || 0 }); return { ok: true }; }
  function listSessionComments(args) {
    var list = (state.comments[args.sessionId] || []).slice();
    return { ok: true, me: D.email, comments: list };
  }
  function postSessionComment(args) {
    if (!String(args.body || '').trim()) return { ok: false, code: 'BAD_INPUT' };
    (state.comments[args.sessionId] = state.comments[args.sessionId] || []).push({ commentId: uid('SC'), authorEmail: D.email, authorName: 'Coach Turner', body: String(args.body), createdAt: nowIso() });
    return listSessionComments(args);
  }
  function deleteSessionComment(args) {
    Object.keys(state.comments).forEach(function (sid) { state.comments[sid] = state.comments[sid].filter(function (c) { return c.commentId !== args.commentId; }); });
    return { ok: true, me: D.email, comments: [] };
  }

  // =====================================================================
  // Prefs / server time
  // =====================================================================
  function getCoachPrefs() { return { ok: true, prefs: clone(state.prefs) }; }
  function setCoachPrefs(args) {
    ['DefaultLengthMin', 'WarmupMin', 'CooldownMin', 'PerDrillMin', 'WaterBreakMin', 'WaterBreakEveryMin', 'DefaultTeamID', 'ScrimHalfMin', 'ScrimHalfCount', 'ScrimSquadSize', 'GameDayChecklist', 'LandingTab']
      .forEach(function (k) { if (args[k] !== undefined) state.prefs[k] = args[k]; });
    if (args.AutoAdvance !== undefined) state.prefs.AutoAdvance = !!args.AutoAdvance;
    if (args.ToneOn !== undefined) state.prefs.ToneOn = !!args.ToneOn;
    return { ok: true, prefs: clone(state.prefs) };
  }
  function getServerNow() { return { ok: true, now: Date.now() }; }

  // =====================================================================
  // Stats / lineup
  // =====================================================================
  function statsKey(args) { return (args.teamId || '') + '|' + (args.eventId || ''); }
  function getGameStats(args) { return { ok: true, stats: clone(state.gameStats[statsKey(args)] || {}) }; }
  function saveGameStats(args) {
    if (!args.eventId) return { ok: false, code: 'BAD_INPUT', msg: 'Pick a game first.' };
    var map = state.gameStats[statsKey(args)] = {};
    (args.rows || []).forEach(function (r) { map[r.athleteId] = r.stats || {}; });
    return { ok: true, saved: (args.rows || []).length };
  }
  function getSeasonStatMaps(args) {
    var roster = state.rosters[args.teamId] || [];
    return { ok: true, sport: 'Soccer', season: D.season, players: roster.map(function (a) { return { athleteId: a.athleteId, name: a.first + ' ' + a.last, games: 0, totals: {} }; }) };
  }
  function getSeasonStats() { return { ok: true, defs: [{ key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' }, { key: 'saves', label: 'Saves' }], leaders: [] }; }
  function getLineup(args) {
    var roster = state.rosters[args.teamId] || [];
    var saved = state.lineups[args.teamId];
    var rows = roster.map(function (a, i) {
      var s = saved && saved.filter(function (x) { return x.athleteId === a.athleteId; })[0];
      return { athleteId: a.athleteId, name: a.first + ' ' + a.last, gender: (teamById(args.teamId) || {}).Gender || '', position: (s && s.position) || a.position || '', role: (s && s.role) || (i < 11 ? 'Starter' : 'Bench'), ord: (s && s.ord) || (i + 1), notes: (s && s.notes) || '' };
    });
    return { ok: true, roster: rows, positions: clone(D.soccerPositions) };
  }
  function saveLineup(args) { state.lineups[args.teamId] = clone(args.rows || []); return { ok: true, saved: (args.rows || []).length }; }

  // =====================================================================
  // Race / XC (soccer demo doesn't surface these, but keep shape-correct)
  // =====================================================================
  function getPrBoard(args) { return { ok: true, board: [], season: D.season, courseRecords: [] }; }
  function getRaceResults() { return { ok: true, results: [] }; }
  function getRaceSplits(args) { var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' }; return { ok: true, distance: '5K', totalDistMi: 3.1, catalog: [], runners: [] }; }
  function saveRaceSplits() { return { ok: true, saved: 0, cleared: 0 }; }
  function saveRaceResults() { return { ok: true, saved: 0, prCount: 0 }; }
  function exportRaceResults(args) { var ev = eventById(args.eventId); if (!ev) return { ok: false, code: 'NO_EVENT' }; return { ok: true, csv: 'place,name,time\n', filename: 'results.csv', count: 0 }; }
  function raceSessionOut(sess) { return clone(sess); }
  function armRace(args) {
    if (!args.eventId && !args.teamId) return { ok: false, code: 'BAD_INPUT' };
    var sess = { sessionId: uid('RS'), eventId: args.eventId || '', teamId: args.teamId || '', status: 'Armed', startedAtMs: 0, mode: args.mode || 'combined', hostScored: !!args.hostScored, distance: args.distance || '5K', scoreMethod: args.scoreMethod || 'sticks' };
    state._race = sess;
    return { ok: true, session: raceSessionOut(sess) };
  }
  function startRace(args) { if (!state._race) return { ok: false, code: 'NO_SESSION' }; state._race.status = 'Running'; state._race.startedAtMs = Date.now(); return { ok: true, startedAtMs: state._race.startedAtMs, serverNow: Date.now() }; }
  function raceTap(args) { if (['boys', 'girls', 'time', 'spot', 'marker'].indexOf(args.role) === -1) return { ok: false, code: 'BAD_INPUT' }; return { ok: true }; }
  function raceTapCounts() { if (!state._race) return { ok: false, code: 'NO_SESSION' }; return { ok: true, counts: { boys: 0, girls: 0, time: 0, spot: 0, marker: 0 }, session: raceSessionOut(state._race), serverNow: Date.now() }; }
  function raceMergePreview() { if (!state._race) return { ok: false, code: 'NO_SESSION' }; return { ok: true, finishers: [], drift: { delta: 0 }, session: raceSessionOut(state._race) }; }
  function finalizeRace() { if (!state._race) return { ok: false, code: 'NO_SESSION' }; return { ok: true, finishers: [], drift: { delta: 0 }, saved: 0, prCount: 0, splits: 0, standings: null }; }
  function getRaceSession() { return state._race ? { ok: true, session: raceSessionOut(state._race), serverNow: Date.now() } : { ok: false, code: 'NO_SESSION' }; }
  function broadcastLive() { return { ok: true }; }
  function endBroadcast() { return { ok: true }; }

  // =====================================================================
  // Tryouts
  // =====================================================================
  function tryoutById(id) { return state.tryouts.filter(function (t) { return t.TryoutID === id; })[0]; }
  function tryoutRow(t) { return { TryoutID: t.TryoutID, Name: t.Name, Sport: t.Sport, Season: t.Season, TeamID: t.TeamID, Status: t.Status, EvalCode: t.EvalCode, CreatedBy: t.CreatedBy, CreatedAt: t.CreatedAt || nowIso() }; }
  function listTryouts() { return { ok: true, tryouts: state.tryouts.map(tryoutRow) }; }
  function createTryout(args) {
    if (!String(args.name || '').trim() || !String(args.season || '').trim()) return { ok: false, code: 'BAD_INPUT', msg: 'Name + season required.' };
    var id = uid('TRY');
    state.tryouts.unshift({ TryoutID: id, Name: args.name, Sport: 'BSOC', Season: args.season, TeamID: args.teamId || '', Status: 'Setup', EvalCode: evalCode(), CreatedBy: D.email, CreatedAt: nowIso(), events: [], candidates: [] });
    return { ok: true, tryoutId: id };
  }
  function evalCode() { var s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = ''; for (var i = 0; i < 6; i++) o += s.charAt(Math.floor(Math.random() * s.length)); return o; }
  function getTryout(args) { var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' }; return { ok: true, tryout: tryoutRow(t), events: clone(t.events || []), candidates: clone(t.candidates || []) }; }
  function setTryoutStatus(args) { var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' }; if (['Setup', 'Open', 'Closed'].indexOf(args.status) === -1) return { ok: false, code: 'BAD_STATUS' }; t.Status = args.status; return { ok: true, status: args.status }; }
  function rotateEvalCode(args) { var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' }; t.EvalCode = evalCode(); return { ok: true, evalCode: t.EvalCode }; }
  function importCandidates(args) {
    var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' };
    var lines = String(args.text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    lines.forEach(function (ln) { var m = ln.match(/^(\d+)\s+(.+)$/); var num = m ? m[1] : ''; var nm = (m ? m[2] : ln).split(/\s+/); t.candidates.push({ TryoutID: t.TryoutID, CandidateID: uid('CAND'), FirstName: nm[0] || '', LastName: nm.slice(1).join(' '), Grade: '', DirectoryKey: '', Number: num, Decision: '', AddedAt: nowIso() }); });
    return { ok: true, added: lines.length };
  }
  function removeCandidate(args) { var t = tryoutById(args.tryoutId); if (t) t.candidates = (t.candidates || []).filter(function (c) { return c.CandidateID !== args.candidateId; }); return { ok: true }; }
  function upsertTryoutEvent(args) {
    var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' };
    var e = (t.events || []).filter(function (x) { return x.EventKey === args.eventKey; })[0];
    if (e) { if (args.weight !== undefined) e.Weight = parseFloat(args.weight) || 0; if (args.active !== undefined) e.Active = !!args.active; if (args.name) e.Name = args.name; }
    return { ok: true, eventKey: args.eventKey };
  }
  function addCandidateFromDirectory(args) {
    var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' };
    var d = state.directory.filter(function (p) { return p.directoryKey === args.directoryKey; })[0]; if (!d) return { ok: false, code: 'NO_DIR' };
    var id = uid('CAND');
    t.candidates.push({ TryoutID: t.TryoutID, CandidateID: id, FirstName: d.first, LastName: d.last, Grade: d.grade, DirectoryKey: d.directoryKey, Number: '', Decision: '', AddedAt: nowIso() });
    return { ok: true, candidateId: id };
  }
  function addCandidateManual(args) {
    var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' };
    if (!args.first && !args.last) return { ok: false, code: 'BAD_INPUT' };
    var id = uid('CAND');
    t.candidates.push({ TryoutID: t.TryoutID, CandidateID: id, FirstName: args.first || '', LastName: args.last || '', Grade: args.grade || '', DirectoryKey: '', Number: args.number || '', Decision: '', AddedAt: nowIso() });
    return { ok: true, candidateId: id };
  }
  function standingsEvents(t) { return (t.events || []).filter(function (e) { return e.Active; }).map(function (e) { return { eventKey: e.EventKey, name: e.Name, weight: e.Weight, maxPoints: e.MaxPoints }; }); }
  function getStandings(args) {
    var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' };
    return { ok: true, events: standingsEvents(t), standings: [], evaluatorCount: 0 };
  }
  function setDecision(args) {
    var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'BAD_DECISION' };
    if (['', 'Keep', 'Cut'].indexOf(args.decision) === -1) return { ok: false, code: 'BAD_DECISION' };
    (t.candidates || []).forEach(function (c) { if (c.CandidateID === args.candidateId) c.Decision = args.decision; });
    return { ok: true, decision: args.decision };
  }
  function setFinal(args) { return getStandings(args); }
  function finalizeKeepers(args) { var t = tryoutById(args.tryoutId); if (!t) return { ok: false, code: 'NO_TRYOUT' }; var keeps = (t.candidates || []).filter(function (c) { return c.Decision === 'Keep'; }); return { ok: true, added: keeps.filter(function (c) { return c.DirectoryKey; }).length, needManual: keeps.filter(function (c) { return !c.DirectoryKey; }).map(function (c) { return c.FirstName + ' ' + c.LastName; }) }; }

  // =====================================================================
  // Staff management
  // =====================================================================
  function listStaff() { return { ok: true, staff: clone(state.staff) }; }
  function upsertStaff(args) {
    if (!String(args.email || '').trim()) return { ok: false, code: 'BAD_INPUT' };
    var s = state.staff.filter(function (x) { return x.email === args.email; })[0];
    if (s) s.role = args.role || s.role; else state.staff.push({ email: args.email, role: args.role || 'Coach', teams: [] });
    return listStaff();
  }
  function removeStaff(args) { var i = state.staff.map(function (s) { return s.email; }).indexOf(args.email); if (i === -1) return { ok: false, code: 'NO_STAFF' }; state.staff.splice(i, 1); return listStaff(); }
  function setCoachAssignment(args) {
    var s = state.staff.filter(function (x) { return x.email === args.email; })[0]; if (!s) return { ok: false, code: 'BAD_INPUT' };
    s.teams = s.teams || [];
    if (args.assign) { if (!s.teams.filter(function (t) { return t.teamId === args.teamId; }).length) { var tm = teamById(args.teamId); if (tm) s.teams.push({ teamId: tm.TeamID, label: tm.label, season: tm.Season }); } }
    else s.teams = s.teams.filter(function (t) { return t.teamId !== args.teamId; });
    return listStaff();
  }
  function inviteCoach(args) { if (!args.email) return { ok: false, code: 'BAD_INPUT' }; return { ok: true, sentTo: args.email }; }

  // =====================================================================
  // Form links / groups / archive / impersonation
  // =====================================================================
  function getFormLinks() { return { ok: true, links: clone(state.formLinks) }; }
  function setFormLinks(args) { ['physical', 'concussion', 'handbook'].forEach(function (k) { if (args[k] !== undefined) state.formLinks[k] = args[k]; }); return { ok: true }; }
  function groupConvention(t) { return String(t.label || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, '-') + '@harfordchristian.org'; }
  function getTeamGroups() { return { ok: true, teams: state.teams.map(function (t) { return { teamId: t.TeamID, label: t.label + ' · ' + t.Season, convention: groupConvention(t), override: state.groupOverrides[t.TeamID] || '' }; }) }; }
  function setTeamGroup(args) { var t = teamById(args.teamId); if (!t) return { ok: false, code: 'BAD_INPUT' }; state.groupOverrides[args.teamId] = args.groupEmail || ''; return { ok: true }; }
  function groupMembers(args) {
    var t = teamById(args.teamId); if (!t) return { ok: false, code: 'NO_GROUP', msg: 'No group for this team.' };
    var members = (state.rosters[args.teamId] || []).slice(0, 6).map(function (a) { return { email: emailFromName(a.primaryGuardian || (a.first + ' ' + a.last)) + '@example.com', role: 'MEMBER', status: 'ACTIVE' }; });
    return { ok: true, group: state.groupOverrides[args.teamId] || groupConvention(t), members: members };
  }
  function groupAddMember(args) { if (!args.email) return { ok: false, code: 'BAD_INPUT', msg: 'Enter an email.' }; return groupMembers(args); }
  function groupRemoveMember(args) { if (!args.email) return { ok: false, code: 'BAD_INPUT' }; return groupMembers(args); }
  function groupSyncRoster(args) { var t = teamById(args.teamId); if (!t) return { ok: false, code: 'NO_GROUP' }; return { ok: true, added: 3, failed: 0, rosterEmails: (state.rosters[args.teamId] || []).length }; }
  function archivableSeasons() { return { ok: true, seasons: ['F25', 'S25'], current: 'F26', archiveConfigured: true }; }
  function archivePreview(args) { if (!args.season) return { ok: false, code: 'BAD_INPUT' }; return { ok: true, dryRun: true, season: args.season, total: 42, per: { SCHEDULE: 18, SPORT_ENROLLMENTS: 24 }, archiveConfigured: true }; }
  function archiveSeason(args) { if (!args.season) return { ok: false, code: 'BAD_INPUT' }; if (args.season === 'F26') return { ok: false, code: 'CURRENT', msg: 'Cannot archive the current season.' }; return { ok: true, season: args.season, moved: { SCHEDULE: 18, SPORT_ENROLLMENTS: 24 }, total: 42 }; }
  function impersonateTargets() {
    var targets = [];
    Object.keys(state.rosters).forEach(function (k) { state.rosters[k].forEach(function (a) { targets.push({ athleteId: a.athleteId, name: a.first + ' ' + a.last, grade: a.grade }); }); });
    return { ok: true, targets: targets };
  }
  function impersonate() { return { ok: false, code: 'NO_SECRET', msg: 'Impersonation is disabled in the demo.' }; }
  function parentBridge() { return { ok: false, code: 'NOT_GUARDIAN', msg: 'Demo coach is not a guardian.' }; }

  // ---- utility ----
  function ping() { return { ok: true, app: 'staff', version: '0.1.0', build: 'demo-2026', role: D.role, now: nowIso() }; }
  function runSchemaCheck() { return { ok: true, tabs: 0, note: 'demo' }; }

  // =====================================================================
  // Single dispatcher
  // =====================================================================
  var ENDPOINTS = {
    getStaffBundle: getStaffBundle, getDeptSchedule: getDeptSchedule, globalSearch: globalSearch,
    getEventBoard: getEventBoard, getManifest: getManifest, getMissingList: getMissingList,
    setCheckoff: setCheckoff, ackAttendance: ackAttendance, setEventStatus: setEventStatus,
    setScore: setScore, setFoodStop: setFoodStop, setEventMedia: setEventMedia,
    searchDirectory: searchDirectory, getTeamRoster: getTeamRoster, addToTeam: addToTeam, removeFromTeam: removeFromTeam,
    getPlayerProfile: getPlayerProfile, setPlayerProfile: setPlayerProfile, uploadPhoto: uploadPhoto,
    getGuardians: getGuardians, upsertGuardian: upsertGuardian, removeGuardian: removeGuardian, resyncGuardians: resyncGuardians,
    getCoachRecord: getCoachRecord, setCoachRecord: setCoachRecord, releaseCareer: releaseCareer, releaseCareerBulk: releaseCareerBulk, getCareerReleases: getCareerReleases,
    confirmEnrollment: confirmEnrollment, confirmAllPending: confirmAllPending, setEnrollmentStatus: setEnrollmentStatus,
    listTeams: listTeams, upsertTeam: upsertTeam, setTeamPhase: setTeamPhase, rolloverTeam: rolloverTeam,
    getTeamConfig: getTeamConfig, setTeamConfig: setTeamConfig, finishOnboarding: finishOnboarding,
    importDirectory: importDirectory, syncMyTeams: syncMyTeams,
    listAnnouncements: listAnnouncements, postAnnouncement: postAnnouncement, deleteAnnouncement: deleteAnnouncement,
    listDrills: listDrills, getDrill: getDrill, upsertDrill: upsertDrill, deleteDrill: deleteDrill, setDrillPin: setDrillPin, setDrillNote: setDrillNote,
    getPracticePlan: getPracticePlan, savePracticePlan: savePracticePlan, saveEventPlanAsSession: saveEventPlanAsSession,
    listSessions: listSessions, getSession: getSession, upsertSession: upsertSession, deleteSession: deleteSession, attachSessionToEvent: attachSessionToEvent,
    listPracticeRuns: listPracticeRuns, buildPractice: buildPractice, logPracticeRun: logPracticeRun,
    listSessionComments: listSessionComments, postSessionComment: postSessionComment, deleteSessionComment: deleteSessionComment,
    getCoachPrefs: getCoachPrefs, setCoachPrefs: setCoachPrefs, getServerNow: getServerNow,
    getGameStats: getGameStats, saveGameStats: saveGameStats, getSeasonStatMaps: getSeasonStatMaps, getSeasonStats: getSeasonStats, getLineup: getLineup, saveLineup: saveLineup,
    getPrBoard: getPrBoard, getRaceResults: getRaceResults, getRaceSplits: getRaceSplits, saveRaceSplits: saveRaceSplits, saveRaceResults: saveRaceResults, exportRaceResults: exportRaceResults,
    armRace: armRace, startRace: startRace, raceTap: raceTap, raceTapCounts: raceTapCounts, raceMergePreview: raceMergePreview, finalizeRace: finalizeRace, getRaceSession: getRaceSession, broadcastLive: broadcastLive, endBroadcast: endBroadcast,
    listTryouts: listTryouts, createTryout: createTryout, getTryout: getTryout, setTryoutStatus: setTryoutStatus, rotateEvalCode: rotateEvalCode,
    importCandidates: importCandidates, removeCandidate: removeCandidate, upsertTryoutEvent: upsertTryoutEvent, addCandidateFromDirectory: addCandidateFromDirectory, addCandidateManual: addCandidateManual,
    getStandings: getStandings, setDecision: setDecision, setFinal: setFinal, finalizeKeepers: finalizeKeepers,
    listStaff: listStaff, upsertStaff: upsertStaff, removeStaff: removeStaff, setCoachAssignment: setCoachAssignment, inviteCoach: inviteCoach,
    getFormLinks: getFormLinks, setFormLinks: setFormLinks,
    getTeamGroups: getTeamGroups, setTeamGroup: setTeamGroup, groupMembers: groupMembers, groupAddMember: groupAddMember, groupRemoveMember: groupRemoveMember, groupSyncRoster: groupSyncRoster,
    archivableSeasons: archivableSeasons, archivePreview: archivePreview, archiveSeason: archiveSeason,
    impersonateTargets: impersonateTargets, impersonate: impersonate, parentBridge: parentBridge,
    ping: ping, runSchemaCheck: runSchemaCheck
  };

  function api(fn, args) {
    var h = ENDPOINTS[fn];
    if (typeof h !== 'function') return { ok: false, code: 'NO_SUCH_FN' };
    return h(args || {});
  }

  return { api: api };
})();
