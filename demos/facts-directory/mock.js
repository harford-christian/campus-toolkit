/* mock.js — Directory Search demo backend.

   The real app is unusual among these tools: it fetches its whole searchable dataset ONCE
   (`tabsApi`) and then does every search, profile lookup and "what class is on right now"
   calculation in the browser. So this mock only has to serve the bootstrap calls — the app's
   own untouched JavaScript does the rest, exactly as in production.

   Backend methods the client calls:
     tabsApi()            the SIS export tabs, MINUS the two collapsed-only contact tabs
     tabsExtrasApi()      those two tabs, fetched after first paint so the page is usable sooner
     presenceApi()        today's sign-in/out + dismissal overrides (status and time ONLY)
     nowApi()             school-time clock + quarter config -> pinned to a school day here
     bellTodayApi()       today's bell schedule
     bellForDateApi(date) any date's bells — powers the ?sim= time-travel switch
     favoritesApi()       the visitor's starred students
     favoriteToggleApi()  star / un-star one (really works for the length of the visit)
     athleticsApi(date)   today's games with the dismissal a coach typed into the calendar
     searchApi/personApi/teacherApi/classApi  server-side fallbacks, used only before the
                          dataset lands (kept faithful so the fallback path is demoable too)
*/
window.MOCK_BACKEND = (function () {
  'use strict';

  var D = window.DIRECTORY_DATA;
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };

  function isWeekend(dateStr) {
    var p = String(dateStr || '').split('-');
    var dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    return dow === 0 || dow === 6;
  }

  function bellsFor(dateStr) {
    if (isWeekend(dateStr)) {
      return { date: dateStr, mode: 'No School (closed)', source: 'closed', closed: true,
               periods: [], warning: null, ok: true };
    }
    return { date: dateStr, mode: 'Normal', source: 'base', closed: false,
             periods: clone(D.bellPeriods), warning: null, ok: true };
  }

  // Favourites are per-user in production (keyed by the signed-in email in Script Properties).
  // The demo has one visitor, so an in-memory array is the faithful equivalent — starring and
  // un-starring really works for the length of the visit.
  var favorites = (D.favorites || []).slice();
  var FAV_MAX = 20;

  return {
    /* The FIRST call: everything except the two collapsed-only contact tabs. Splitting these
       is what makes the real app usable sooner, and reproducing the split here keeps the
       "Loading…" state in Authorised Pickup / Emergency Contacts honest instead of showing an
       empty list that looks like "none on file". */
    tabsApi: function () {
      var deferred = D.deferredTabs || [];
      return clone(D.tabs.filter(function (t) { return deferred.indexOf(t.name) === -1; }));
    },

    /* The SECOND call, made after first paint. Delayed deliberately so the deferred-load
       behaviour is visible rather than instantaneous — this is a demo of the design. */
    tabsExtrasApi: function () {
      var deferred = D.deferredTabs || [];
      return clone(D.tabs.filter(function (t) { return deferred.indexOf(t.name) !== -1; }));
    },

    /* Live-ish data the real app deliberately keeps OUT of the cached bundle, because it
       changes during the day: today's sign-in/out and today's dismissal changes.
       Status and time only — no guardian name, relationship or reason (those are tiered
       OFFICE in Campus Presence and this tool is open to the whole staff OU). */
    presenceApi: function () {
      return {
        date: D.demoNow.date,
        presence: clone(D.presence || {}),
        overrides: clone(D.overrides || {}),
        signOutsOn: true,
        ok: true
      };
    },

    favoritesApi: function () { return favorites.slice(); },

    favoriteToggleApi: function (id, on) {
      var sid = String(id);
      var at = favorites.indexOf(sid);
      var full = false;
      if (on && at === -1) {
        if (favorites.length >= FAV_MAX) full = true;
        else favorites.push(sid);
      } else if (!on && at !== -1) {
        favorites.splice(at, 1);
      }
      return { ids: favorites.slice(), full: full };
    },

    /* Game-day dismissal. In production this fetches all 21 public team calendars and parses
       the dismissal out of whatever prose a coach typed into the event description; here the
       events arrive pre-parsed because the demo has no calendars to reach. The matching
       (sport + level from the class, gender from the STUDENT), the ordering and the
       have-left/will-leave wording are all the app's own untouched code. */
    athleticsApi: function (dateStr) {
      return {
        date: dateStr || D.demoNow.date,
        events: clone(D.athleticsEvents || []),
        teams: clone(D.athleticsTeams || []),
        ok: true
      };
    },

    nowApi: function () {
      // Pinned to a school day so the current-class highlight always has something to show.
      // The app derives its clock from this, then advances it in real time.
      return {
        date: D.demoNow.date,
        time: D.demoNow.time,
        dayOfWeek: D.demoNow.dayOfWeek,
        quarterDates: D.quarterDates // set, so semester-split classes resolve to one answer
      };
    },

    bellTodayApi: function () { return bellsFor(D.demoNow.date); },

    bellForDateApi: function (dateStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) throw new Error('Bad date: ' + dateStr);
      return bellsFor(dateStr);
    },

    /* ---- server-side fallbacks (the app uses these only until tabsApi resolves) ---- */
    searchApi: function (query) {
      return window.searchPeople(D.tabs, query,
        { today: D.demoNow.date, presence: D.presence || {} });
    },
    personApi: function (id) {
      return window.personDetail(D.tabs, id, D.demoNow.date, D.presence || {});
    },
    teacherApi: function (id) {
      return window.teacherDetail(D.tabs, id);
    },
    classApi: function (key) {
      return window.classDetail(D.tabs, key);
    }
  };
})();
