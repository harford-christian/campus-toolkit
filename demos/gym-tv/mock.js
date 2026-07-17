/* mock.js — Gym TV demo backend. Serves the control dashboard and the v3 slide-deck display.
   Display polls getGymState(); the wrapper's TV tabs pass ?mode=idle|game|emergency
   to show each operation. Mirrors GymControl.js return shapes (incl. schedule / sportEvents /
   ads added for the v3 display, and the setMessageAds promo-slide setter). */
window.MOCK_BACKEND = (function () {
  var D = window.GYMTV_DATA;

  function urlMode() { try { return new URLSearchParams(location.search).get('mode') || 'idle'; } catch (e) { return 'idle'; } }

  // ---- enrichment helpers (mirror GymControl _tokens_/_levelRank_/_opponent_/_enrichEvent_) ----
  function tokens(name) {
    name = ' ' + (name || '').toLowerCase() + ' ';
    var t = { level: '', gender: '', sport: '' };
    if (/\bjv\b/.test(name)) t.level = 'jv';
    else if (/\bms\b|middle\s*school/.test(name)) t.level = 'ms';
    else if (/\bvarsity\b|\bv\b/.test(name)) t.level = 'v';
    if (/\bboys?\b/.test(name)) t.gender = 'boys';
    else if (/\bgirls?\b/.test(name)) t.gender = 'girls';
    if (/basketball/.test(name)) t.sport = 'basketball';
    else if (/volleyball/.test(name)) t.sport = 'volleyball';
    else if (/wrestl/.test(name)) t.sport = 'wrestling';
    return t;
  }
  function levelRank(label) {
    label = (label || '').toUpperCase();
    if (label.indexOf('V ') === 0 || label.indexOf('VARSITY') >= 0) return 3;
    if (label.indexOf('JV') >= 0) return 2;
    if (label.indexOf('MS') >= 0) return 1;
    return 0;
  }
  function opponentOf(summary) {
    var m = String(summary || '').match(/(?:\bvs\.?\s+|@\s*|\bat\s+)(.+)$/i);
    return m ? m[1].trim() : '';
  }

  // One enriched 14d-style set powers events + schedule + sportEvents (like _getEnrichedSchedule_).
  function enriched() {
    return D.events.map(function (e) {
      var d = new Date(); d.setDate(d.getDate() + e.inDays);
      var hm = e.time.split(':'); d.setHours(+hm[0], +hm[1], 0, 0);
      var t = tokens(e.label);
      return {
        title: e.label + ' · ' + e.summary, label: e.label, summary: e.summary,
        sport: t.sport, gender: t.gender, level: t.level, levelRank: levelRank(e.label),
        homeAway: e.home ? 'home' : 'away', opponent: opponentOf(e.summary),
        start: d.toISOString(), end: '', allDay: false,
        location: e.home ? 'Eagles Gym (Home)' : 'Away'
      };
    });
  }
  function flatEvents(enr) {
    return enr.map(function (e) { return { title: e.title, start: e.start, allDay: e.allDay, location: e.location }; });
  }
  function sportEventsFor(sportLabel, enr) {
    var t = tokens(sportLabel);
    if (!t.sport) return [];
    return enr.filter(function (e) {
      if (e.sport !== t.sport) return false;
      if (t.gender && e.gender && e.gender !== t.gender) return false;
      return true;
    }).slice(0, 12);
  }

  function menuItems() {
    return D.menu.map(function (m) {
      var it = { id: m.id, name: m.name, type: m.type, category: m.category, priceCents: m.priceCents,
        discountable: m.discountable, stock: m.stock, lowStockThreshold: m.lowStockThreshold,
        backedBySpecial: m.backedBySpecial, cooking: null };
      if (m.cooking && m.cooking.readyInMin) it.cooking = { readyAtMs: Date.now() + m.cooking.readyInMin * 60000 };
      return it;
    });
  }

  // ---- promo/message ad slides (mirror _normalizeAd_ / _activeAds_) ----
  var _adSeq = 0;
  function normalizeAd(a) {
    a = a || {};
    return {
      id:        a.id || ('ad_' + (++_adSeq) + '_' + Date.now().toString(36)),
      headline:  String(a.headline || ''),
      subhead:   String(a.subhead || ''),
      dateText:  String(a.dateText || ''),
      opponent:  String(a.opponent || ''),
      theme:     String(a.theme || 'generic'),
      startShow: String(a.startShow || ''),
      endShow:   String(a.endShow || ''),
      enabled:   a.enabled !== false
    };
  }
  function ymd(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function activeAds(ads) {
    var today = ymd(new Date());
    return (ads || []).filter(function (a) {
      if (!a || a.enabled === false) return false;
      if (a.startShow && today < a.startShow) return false;
      if (a.endShow && today > a.endShow) return false;
      return true;
    });
  }

  // In-memory control doc (dashboard reads/writes this; TV tabs use ?mode for stable demos).
  var control = {
    rev: 12, updatedAt: '', updatedBy: D.demoUser,
    tickerMessages: D.tickerIdle.slice(),
    emergency: { active: false, message: '' },
    nightOff: { enabled: false, start: '22:00', end: '06:00' },
    content: {
      carousel: { images: D.carousel.slice(), interval: 8 },
      infoCards: D.infoCards.slice(),
      ads: (D.messageAds || []).map(normalizeAd)
    },
    gameMode: {
      state: 'auto', forcedSport: '', forcedUntil: '',
      config: { venueFilter: ['basketball', 'volleyball'], preLeadMin: 60, postBufferMin: 45, assumedGameLengthMin: 120,
        dailyWindow: { start: '15:30', end: '22:00' }, requireConfirmedHome: true, ignoreAllDay: false, homeValidated: true,
        homeLocMarkers: ['eagles gym'] },
      detected: { active: false, sport: '', startsAt: '', endsAt: '', allActive: [], source: 'calendar', checkedAt: '', note: 'no-games-in-window' }
    }
  };
  function bump() { control.rev++; control.updatedAt = new Date().toISOString(); return control; }

  function getGymState() {
    var mode = urlMode();
    var game = mode === 'game';
    var emergency = mode === 'emergency';
    var enr = enriched();
    var sport = game ? 'V Boys Basketball' : '';
    return {
      rev: control.rev, serverNow: Date.now(),
      mode: game ? 'game' : 'idle',
      sport: sport,
      gamePhotos: game ? D.gamePhotos.slice() : [],
      control: {
        emergency: { active: emergency, message: emergency ? 'Please follow staff instructions and proceed calmly to the nearest exit.' : '' },
        ticker: game ? D.tickerGame.slice() : D.tickerIdle.slice(),
        nightOff: { enabled: false, start: '22:00', end: '06:00' },
        carousel: { images: D.carousel.slice(), interval: 8 },
        infoCards: control.content.infoCards.slice()
      },
      menu: game ? { version: 'v7', halfOff: false, serverNow: Date.now(), items: menuItems() }
                 : { version: '', halfOff: false, items: [], stale: false },
      events: flatEvents(enr),
      schedule: enr,                                   // all sports, enriched (powers allSports board)
      sportEvents: game ? sportEventsFor(sport, enr) : [],   // current sport + same gender (game only)
      ads: activeAds(control.content.ads),             // active promo/message ad slides
      gameMode: {
        state: control.gameMode.state, forcedSport: control.gameMode.forcedSport, forcedUntil: control.gameMode.forcedUntil,
        config: control.gameMode.config,
        detected: game
          ? { active: true, sport: 'V Boys Basketball', startsAt: '', endsAt: '', allActive: [{ sport: 'V Boys Basketball', level: 3, homeness: 'home' }], source: 'calendar', checkedAt: new Date().toISOString(), note: 'ok' }
          : control.gameMode.detected
      }
    };
  }

  return {
    getGymState: getGymState,
    getGymControl: function () { return JSON.parse(JSON.stringify(control)); },
    whoAmI: function () { return { email: D.demoUser, isStaff: true }; },
    listGymSports: function () { return D.sports.slice(); },
    setGameOverride: function (state, sport, until) {
      control.gameMode.state = (['auto', 'on', 'off'].indexOf(state) >= 0 ? state : 'auto');
      control.gameMode.forcedSport = sport || ''; control.gameMode.forcedUntil = until || '';
      return bump();
    },
    setTicker: function (messages) { control.tickerMessages = messages || []; return bump(); },
    setInfoCards: function (cards) { control.content.infoCards = cards || []; return bump(); },
    setMessageAds: function (ads) {
      control.content.ads = Array.isArray(ads) ? ads.map(normalizeAd) : [];
      return bump();
    },
    setEmergency: function (active, message) { control.emergency = { active: !!active, message: message || '' }; return bump(); },
    setGymCarousel: function (folderRef, intervalSecs) {
      control.content.carousel = { images: D.carousel.slice(), interval: parseInt(intervalSecs, 10) || 8 };
      bump(); return { ok: true, count: D.carousel.length, interval: control.content.carousel.interval };
    },
    getSampleGameEvents: function () {
      return D.events.map(function (e) { return { sport: e.label, calendar: 'demo', summary: e.summary, location: e.home ? 'Home' : 'Away', start: '', end: '', allDay: false }; });
    }
  };
})();
