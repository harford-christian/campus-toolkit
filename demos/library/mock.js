/* mock.js — Library demo backend. Mirrors PortalServer.js return shapes so the
   real BrowseCatalog.html runs unchanged. (One deliberate difference: the live
   getBrowseCounts hides genres with <10 books; here we show every genre so the
   smaller sample catalog still fills the browse grid.) */
window.MOCK_BACKEND = (function () {
  var BOOKS = window.LIBRARY_DATA.books;

  // Light "public inventory" projection — matches the fields BrowseCatalog reads.
  function pub(b) {
    return {
      uid: b.uid, title: b.title, author: b.author, status: b.status,
      coverUrl: b.coverUrl || '', genre: b.genre, readingLevel: b.readingLevel,
      dueDate: b.dueDate || ''
    };
  }

  var LEVEL_ORDER = ['Pre-K', 'K-2', 'Grades 1-3', 'Grades 3-5', 'Grades 4-6', 'Grades 5+', 'Middle School'];
  function levelRank(n) { var i = LEVEL_ORDER.indexOf(n); return i < 0 ? 99 : i; }

  return {
    getStaffPicks: function () {
      return BOOKS.filter(function (b) { return b.note; }).slice(0, 24)
        .map(function (b) { var o = pub(b); o.note = b.note; return o; });
    },

    getBrowseCounts: function () {
      var g = {}, l = {};
      BOOKS.forEach(function (b) {
        if (b.genre) g[b.genre] = (g[b.genre] || 0) + 1;
        if (b.readingLevel) l[b.readingLevel] = (l[b.readingLevel] || 0) + 1;
      });
      var genres = Object.keys(g).map(function (k) { return { name: k, count: g[k] }; })
        .sort(function (a, b) { return b.count - a.count; });
      var levels = Object.keys(l).map(function (k) { return { name: k, count: l[k] }; })
        .sort(function (a, b) { return levelRank(a.name) - levelRank(b.name); });
      return { genres: genres, levels: levels, total: BOOKS.length };
    },

    getInventoryPage: function (offset, limit) {
      offset = Math.max(0, parseInt(offset, 10) || 0);
      limit = Math.max(1, parseInt(limit, 10) || 500);
      var total = BOOKS.length;
      if (offset >= total) return { total: total, offset: offset, books: [] };
      var books = BOOKS.slice(offset, offset + limit).map(pub);
      return { total: total, offset: offset, books: books };
    },

    getBookDetail: function (uid) {
      var key = String(uid).trim();
      for (var i = 0; i < BOOKS.length; i++) {
        if (String(BOOKS[i].uid).trim() === key) {
          return { description: BOOKS[i].description || '', callNumber: BOOKS[i].callNumber || '' };
        }
      }
      return { description: '', callNumber: '' };
    },

    // For the Student Dashboard view (not linked from the catalog nav in this demo).
    getUserContext: function () {
      var s = window.LIBRARY_DATA.studentBooks;
      return { loggedIn: true, email: s.email, isStudent: true, name: s.studentName, studentId: s.studentId };
    },
    getStudentBooks: function () { return window.LIBRARY_DATA.studentBooks; }
  };
})();
