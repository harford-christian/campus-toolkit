/* mock.js — Lobby TV demo backend. Serves the management dashboard and the TV
   preview. Live control state is kept in localStorage (falling back to memory) so
   the dashboard and a plain preview share it; the wrapper's TV tabs pass ?mode=… to
   show canned operations. Mirrors WebApps.js / LobbyControl.js return shapes. */
window.MOCK_BACKEND = (function () {
  var D = window.LOBBYTV_DATA;
  var KEY = 'sc_lobby_control', PKEY = 'sc_lobby_presets';
  var mem = {};

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  function nowISO() { return new Date().toISOString(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // Deep-merge the known sub-objects (matches setLobbyControl behavior).
  var SUBS = ['emergency', 'content', 'nightOff', 'athletePhotos', 'tvPower'];
  function merge(baseObj, patch) {
    var out = clone(baseObj);
    Object.keys(patch || {}).forEach(function (k) {
      if (SUBS.indexOf(k) >= 0 && typeof patch[k] === 'object' && patch[k]) {
        out[k] = out[k] || {}; Object.keys(patch[k]).forEach(function (kk) { out[k][kk] = patch[k][kk]; });
      } else { out[k] = patch[k]; }
    });
    return out;
  }

  function current() {
    var raw = lsGet(KEY);
    if (raw) { try { return JSON.parse(raw); } catch (e) {} }
    return clone(D.base);
  }
  function store(ctrl) { lsSet(KEY, JSON.stringify(ctrl)); return ctrl; }

  function presets() {
    var raw = lsGet(PKEY);
    if (raw) { try { return JSON.parse(raw); } catch (e) {} }
    return clone(D.presets);
  }
  function storePresets(p) { lsSet(PKEY, JSON.stringify(p)); return p; }

  function urlMode() {
    try { return new URLSearchParams(location.search).get('mode'); } catch (e) { return null; }
  }

  // A plausible bell-schedule feed for the TV sidebar widget.
  function feed() {
    var d = new Date();
    var wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
    return {
      date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      weekday: wd, mode: 'Regular Day', source: 'demo', closed: false,
      periods: [
        { name: 'Period 1', start: '08:00', end: '08:50' },
        { name: 'Period 2', start: '08:55', end: '09:45' },
        { name: 'Chapel', start: '09:50', end: '10:20' },
        { name: 'Period 3', start: '10:25', end: '11:15' },
        { name: 'Lunch', start: '11:20', end: '12:00' },
        { name: 'Period 4', start: '12:05', end: '12:55' },
        { name: 'Period 5', start: '13:00', end: '13:50' },
        { name: 'Dismissal', start: '15:00', end: '15:00' }
      ],
      lunches: [
        { name: 'K–5 Lunch', start: '11:20', end: '11:50' },
        { name: '6–12 Lunch', start: '11:55', end: '12:25' }
      ],
      warning: '', generatedAt: nowISO()
    };
  }

  function events() {
    var out = [], titles = [
      { t: 'Varsity Boys Soccer · vs Riverdale', in: 1, h: 18, loc: 'Home' },
      { t: 'Fall Choir Concert', in: 3, h: 19, loc: 'Auditorium' },
      { t: 'JV Volleyball · at Northgate', in: 4, h: 17, loc: 'Away' },
      { t: 'Spirit Week Kickoff', in: 5, h: 8, loc: 'Campus', allDay: true },
      { t: 'Board of Trustees Meeting', in: 7, h: 18, loc: 'Media Center' },
      { t: 'Varsity Girls Basketball · vs Faith Prep', in: 9, h: 19, loc: 'Home' }
    ];
    titles.forEach(function (e) {
      var d = new Date(); d.setDate(d.getDate() + e.in); d.setHours(e.h, 0, 0, 0);
      out.push({
        title: e.t, allDay: !!e.allDay, location: e.loc,
        start: e.allDay ? (d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())) : d.toISOString()
      });
    });
    return out;
  }

  function withCarouselImages(ctrl) {
    // The carousel/pictures state stores images from the fabricated photo set.
    if (ctrl.content && ctrl.content.mode === 'carousel' && !ctrl.content.images) {
      ctrl.content.images = D.photos.slice();
    }
    return ctrl;
  }

  return {
    getLobbyControl: function () { return current(); },

    setLobbyControl: function (patch) {
      var merged = merge(current(), patch || {});
      merged.rev = (merged.rev || 0) + 1;
      merged.updatedAt = nowISO(); merged.updatedBy = 'demo@harfordchristian.org';
      return store(merged);
    },

    getPreviewData: function () {
      var m = urlMode();
      var ctrl = (m && D.modes[m]) ? merge(clone(D.base), D.modes[m]) : current();
      return { control: withCarouselImages(clone(ctrl)), feed: feed() };
    },

    getUpcomingEvents: function () { return events(); },

    listPresets: function () { return Object.keys(presets()); },
    savePreset: function (name) {
      var p = presets(); p[name] = current(); storePresets(p); return Object.keys(p);
    },
    applyPreset: function (name) {
      var p = presets();
      if (p[name]) return store(merge(clone(D.base), p[name]));
      return current();
    },
    deletePreset: function (name) {
      var p = presets(); delete p[name]; storePresets(p); return Object.keys(p);
    },

    setCarousel: function (folderRef, intervalSecs) {
      var iv = parseInt(intervalSecs, 10) || 8;
      store(merge(current(), { content: { mode: 'carousel', images: D.photos.slice(), interval: iv } }));
      return { ok: true, count: D.photos.length, interval: iv };
    },
    uploadPowerPoint: function () {
      store(merge(current(), { content: { mode: 'auto', slideUrl: '', videoId: '' } }));
      return { ok: true, file: 'Announcements.pptx', archived: 1 };
    },
    uploadImage: function () {
      store(merge(current(), { content: { mode: 'image', imageUrl: D.photos[0] } }));
      return { ok: true, url: D.photos[0] };
    },
    publishLobbyControlNow: function () { return 'published'; }
  };
})();
