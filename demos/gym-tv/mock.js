/* mock.js — Gym TV demo backend. Serves the control dashboard and the display.
   Display polls getGymState(); the wrapper's TV tabs pass ?mode=idle|game|emergency
   to show each operation. Mirrors GymControl.js return shapes. */
window.MOCK_BACKEND = (function () {
  var D = window.GYMTV_DATA;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function urlMode() { try { return new URLSearchParams(location.search).get('mode') || 'idle'; } catch (e) { return 'idle'; } }

  function events() {
    return D.events.map(function (e) {
      var d = new Date(); d.setDate(d.getDate() + e.inDays);
      var hm = e.time.split(':'); d.setHours(+hm[0], +hm[1], 0, 0);
      return { title: e.label + ' · ' + e.summary, start: d.toISOString(), allDay: false,
        location: e.home ? 'Eagles Gym (Home)' : 'Away' };
    });
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

  // In-memory control doc (dashboard reads/writes this; TV tabs use ?mode for stable demos).
  var control = {
    rev: 12, updatedAt: '', updatedBy: D.demoUser,
    tickerMessages: D.tickerIdle.slice(),
    emergency: { active: false, message: '' },
    nightOff: { enabled: false, start: '22:00', end: '06:00' },
    content: { carousel: { images: D.carousel.slice(), interval: 8 }, infoCards: D.infoCards.slice() },
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
    return {
      rev: control.rev, serverNow: Date.now(),
      mode: game ? 'game' : 'idle',
      sport: game ? 'V Boys Basketball' : '',
      gamePhotos: game ? D.gamePhotos.slice() : [],
      control: {
        emergency: { active: emergency, message: emergency ? 'Please follow staff instructions and proceed calmly to the nearest exit.' : '' },
        ticker: game ? D.tickerGame.slice() : D.tickerIdle.slice(),
        nightOff: { enabled: false, start: '22:00', end: '06:00' },
        carousel: { images: D.carousel.slice(), interval: 8 },
        infoCards: D.infoCards.slice()
      },
      menu: game ? { version: 'v7', halfOff: false, serverNow: Date.now(), items: menuItems() }
                 : { version: '', halfOff: false, items: [], stale: false },
      events: events(),
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
