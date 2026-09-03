/* mock.js — Directory Search demo backend.

   The real app is unusual among these tools: it fetches its whole searchable dataset ONCE
   (`tabsApi`) and then does every search, profile lookup and "what class is on right now"
   calculation in the browser. So this mock only has to serve the bootstrap calls — the app's
   own untouched JavaScript does the rest, exactly as in production.

   Backend methods the client calls:
     tabsApi()            the SIS export tabs (see data.js)
     nowApi()             school-time clock + quarter config -> pinned to a school day here
     bellTodayApi()       today's bell schedule
     bellForDateApi(date) any date's bells — powers the ?sim= time-travel switch
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

  return {
    tabsApi: function () {
      return clone(D.tabs);
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
      return window.searchPeople(D.tabs, query);
    },
    personApi: function (id) {
      return window.personDetail(D.tabs, id);
    },
    teacherApi: function (id) {
      return window.teacherDetail(D.tabs, id);
    },
    classApi: function (key) {
      return window.classDetail(D.tabs, key);
    }
  };
})();
