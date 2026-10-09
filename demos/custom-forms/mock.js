/* mock.js — the Custom Forms demo's stand-in for Google.

   Each page here is one of HCS Forms' real pages, built from the source; logic.js is the apps' own
   SERVER, vendored verbatim (FORMS_SERVER). This file supplies what Apps Script would put underneath
   that server, over plain JavaScript, and then gets out of the way:

     SpreadsheetApp   in-memory spreadsheets (values + header notes): the Contexts Registry, each
                      context's _System, and every form's Responses sheet
     DriveApp         folders and files: each form's folder, schema.json, uploads, logos
     CacheService     real TTLs, kept for the life of the page (as a GAS project cache is per project)
     PropertiesService  each app's own Script Properties (the five apps are five projects)
     Session / AdminDirectory  the signed-in staff account on the two DOMAIN apps; nobody on the
                      anonymous ones; a small fabricated directory decides who is staff
     Utilities        formatDate (America/New_York), a real HMAC-SHA256, base64, blobs, UUIDs
     MailApp          an outbox — shown on screen as the "Demo inbox"
     HtmlService      just enough for doGet: the template values it assigns are captured (DEMO_DOGET)
                      and the page reads them where the template had <?= ?> tags

   EXECUTION MODEL. Every google.script.run call is one fresh execution, as in Apps Script: the shared
   state is re-read from sessionStorage, FORMS_SERVER(app, google) evaluates the whole server, the
   named function runs, and the state is written back. So a form designed in the Builder, filled in on
   the parent page and approved back in the Builder all go through the same stored Drive and Sheets,
   in whichever frame or page the visitor uses — for this browser tab, until "Reset demo".

   THE ONE-TIME CODE. authRequestOtp derives each code from an HMAC of a fresh UUID and the time; the
   demo pins that one message shape's HMAC so every emailed code is FORMS_DEMO_DATA.otpCode (482193),
   labelled on screen. Hashing, the 10-minute expiry, the 5-try lockout and the session tokens are the
   app's own, untouched.

   Not reproduced: PDF templates (built on Google Slides + Drive thumbnails) and the branded PDF copy
   (Google's HTML->PDF converter) — those calls answer with a plain notice or are skipped, exactly as
   the server already tolerates a PDF failure. */
(function () {
  'use strict';
  var D = window.FORMS_DEMO_DATA;
  var APP = window.DEMO_APP || 'builder';
  var SURFACE = window.DEMO_SURFACE || APP;
  var STORE_KEY = 'hcs-forms-demo-v1';
  var TZ = 'America/New_York';
  var APP_URL = { builder: 'builder.html', chooser: 'chooser.html', 'runner-public': 'parent.html', 'runner-staff': 'staff.html', 'runner-macs': 'macs.html' };
  // doGet's branch -> the built page that carries it (each page is one branch of its app's Index.html)
  var SURFACE_FOR = {
    'runner-public': { parent: 'parent', guest: 'parent', runner: 'parent-form' },
    'runner-staff': { portal: 'staff', runner: 'staff-form' },
    'runner-macs': { schoolGate: 'macs', guest: 'macs-portal', runner: 'macs-form' }
  };
  var DRIVE_URL = 'https://drive.example.invalid/file/';
  var PREVIEW_PAGE = /[?&]preview=1(&|$)/.test(location.search || '');

  /* ======================= storage ======================= */
  function store() { try { return window.sessionStorage; } catch (e) { return null; } }
  function encode(state) {
    return JSON.stringify(state, function (k, v) { var o = this[k]; return (o instanceof Date) ? { $d: o.getTime() } : v; });
  }
  function decode(s) {
    return JSON.parse(s, function (k, v) { return (v && typeof v === 'object' && typeof v.$d === 'number' && Object.keys(v).length === 1) ? new Date(v.$d) : v; });
  }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function loadState() { var s = store(); if (!s) return null; try { var raw = s.getItem(STORE_KEY); return raw ? decode(raw) : null; } catch (e) { return null; } }
  function saveState(st) { var s = store(); if (!s) return; try { s.setItem(STORE_KEY, encode(st)); } catch (e) { if (window.console) console.warn('[demo] could not persist state:', e && e.message); } }

  /* ======================= time ======================= */
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var partsFmt = (function () { try { return new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short', hour12: false }); } catch (e) { return null; } })();
  function wall(date, tz) {
    var d = date instanceof Date ? date : new Date(date);
    if (partsFmt && (!tz || tz === TZ)) {
      var p = {}; partsFmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      var H = +p.hour % 24;
      return { y: +p.year, M: +p.month, d: +p.day, H: H, m: +p.minute, s: +p.second, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
    }
    return { y: d.getFullYear(), M: d.getMonth() + 1, d: d.getDate(), H: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), dow: d.getDay() };
  }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function formatDate(date, tz, fmt) {
    var w = wall(date, tz);
    return String(fmt).replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|m|ss|s|a|u|Z/g, function (tok, lit) {
      if (lit !== undefined) return lit;
      switch (tok) {
        case 'yyyy': return String(w.y); case 'yy': return pad(w.y % 100);
        case 'MMMM': return MON[w.M - 1]; case 'MMM': return MON[w.M - 1].slice(0, 3); case 'MM': return pad(w.M); case 'M': return String(w.M);
        case 'dd': return pad(w.d); case 'd': return String(w.d);
        case 'EEEE': return DOW[w.dow]; case 'EEE': return DOW[w.dow].slice(0, 3);
        case 'HH': return pad(w.H); case 'H': return String(w.H);
        case 'hh': return pad(w.H % 12 || 12); case 'h': return String(w.H % 12 || 12);
        case 'mm': return pad(w.m); case 'm': return String(w.m); case 'ss': return pad(w.s); case 's': return String(w.s);
        case 'a': return w.H < 12 ? 'AM' : 'PM'; case 'u': return String(w.dow === 0 ? 7 : w.dow); case 'Z': return '-0400';
      }
      return tok;
    });
  }

  /* ======================= bytes, base64, SHA-256 ======================= */
  function utf8(str) {
    str = String(str); var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) { c = 0x10000 + ((c - 0xd800) << 10) + (str.charCodeAt(++i) - 0xdc00); }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function fromUtf8(bytes) {
    var s = '', i = 0;
    while (i < bytes.length) {
      var b = bytes[i++] & 255, c;
      if (b < 0x80) c = b;
      else if (b < 0xe0) c = ((b & 31) << 6) | (bytes[i++] & 63);
      else if (b < 0xf0) c = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      else c = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      if (c > 0xffff) { c -= 0x10000; s += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 1023)); } else s += String.fromCharCode(c);
    }
    return s;
  }
  function toBytes(x) { return typeof x === 'string' ? utf8(x) : Array.prototype.map.call(x || [], function (b) { return b & 255; }); }
  function signed(bytes) { return bytes.map(function (b) { b &= 255; return b > 127 ? b - 256 : b; }); }
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64enc(bytes, web) {
    bytes = toBytes(bytes); var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
    }
    return web ? out.replace(/\+/g, '-').replace(/\//g, '_') : out;
  }
  function b64dec(str) {
    str = String(str || '').replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
    var out = [], buf = 0, bits = 0;
    for (var i = 0; i < str.length; i++) { buf = (buf << 6) | B64.indexOf(str[i]); bits += 6; if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); } }
    return out;
  }
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length, m = bytes.slice(); m.push(0x80);
    while (m.length % 64 !== 56) m.push(0);
    var hi = Math.floor(l / 0x20000000), lo = (l * 8) >>> 0;
    m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var w = new Array(64);
    for (var i = 0; i < m.length; i += 64) {
      for (var t = 0; t < 16; t++) w[t] = (m[i + 4 * t] << 24) | (m[i + 4 * t + 1] << 16) | (m[i + 4 * t + 2] << 8) | m[i + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = []; H.forEach(function (v) { out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); });
    return out;
  }
  function hmacSha256(msg, key) {
    var k = toBytes(key); if (k.length > 64) k = sha256(k);
    while (k.length < 64) k.push(0);
    var ipad = k.map(function (b) { return b ^ 0x36; }), opad = k.map(function (b) { return b ^ 0x5c; });
    return sha256(opad.concat(sha256(ipad.concat(toBytes(msg)))));
  }
  // authRequestOtp / macsRequestOtp: HMAC(<uuid>:<epoch ms>) -> first four bytes -> the 6-digit code.
  var OTP_MESSAGE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:\d{10,}$/;
  function computeHmac(msg, key) {
    var out = hmacSha256(msg, key);
    if (typeof msg === 'string' && OTP_MESSAGE.test(msg)) {
      var n = Number(D.otpCode); // demo: pin the code (see the header)
      out[0] = 0; out[1] = (n >> 16) & 255; out[2] = (n >> 8) & 255; out[3] = n & 255;
    }
    return signed(out);
  }
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }

  /* ======================= blobs ======================= */
  var MimeType = { PLAIN_TEXT: 'text/plain', HTML: 'text/html', PDF: 'application/pdf', PNG: 'image/png', JPEG: 'image/jpeg', CSV: 'text/csv',
    JSON: 'application/json', FOLDER: 'application/vnd.google-apps.folder', GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet',
    GOOGLE_DOCS: 'application/vnd.google-apps.document', GOOGLE_SLIDES: 'application/vnd.google-apps.presentation',
    MICROSOFT_EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  function Blob_(bytes, type, name) { this.bytes = toBytes(bytes); this.type = type || 'application/octet-stream'; this.name = name || ''; }
  Blob_.prototype.getBytes = function () { return signed(this.bytes); };
  Blob_.prototype.getDataAsString = function () { return fromUtf8(this.bytes); };
  Blob_.prototype.getContentType = function () { return this.type; };
  Blob_.prototype.setContentType = function (t) { this.type = t; return this; };
  Blob_.prototype.getName = function () { return this.name; };
  Blob_.prototype.setName = function (n) { this.name = n; return this; };
  Blob_.prototype.copyBlob = function () { return new Blob_(this.bytes, this.type, this.name); };
  Blob_.prototype.getAs = function (type) {
    if (type === this.type) return this.copyBlob();
    if (type === MimeType.PDF && this.type === MimeType.HTML) return new Blob_(textPdf(this.getDataAsString()), MimeType.PDF, String(this.name || 'document').replace(/\.html?$/i, '') );
    throw new Error('Converting ' + this.type + ' to ' + type + ' happens on Google\'s servers — not in this browser-only demo.');
  };
  // Google converts the app's branded HTML receipt to PDF on its servers. The demo writes the same
  // receipt's TEXT into a plain one-font PDF instead, so "Download a copy" still hands over a real file.
  function textPdf(html) {
    var text = String(html).replace(/<(style|script)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>|<\/(p|div|tr|h\d|li|table)>/gi, '\n')
      .replace(/<\/t[dh]>/gi, '   ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
      .replace(/·/g, '-').replace(/…/g, '...').replace(/[^\x0a\x20-\x7e]/g, '');
    var lines = ['HCS Forms - submission copy (demo rendering: plain text of the receipt the app sends to Google\'s PDF converter)', ''];
    text.split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(function (l, i, a) { return l || (a[i - 1] || ''); }).forEach(function (l) {
      while (l.length > 92) { var cut = l.lastIndexOf(' ', 92); if (cut < 40) cut = 92; lines.push(l.slice(0, cut)); l = l.slice(cut).trim(); }
      lines.push(l);
    });
    var pages = []; for (var i = 0; i < lines.length; i += 54) pages.push(lines.slice(i, i + 54));
    var objs = [], kids = [];
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    pages.forEach(function (pg, n) {
      var pid = 4 + n * 2, cid = pid + 1;
      var body = 'BT /F1 10 Tf 13 TL 50 750 Td ' + pg.map(function (l) { return '(' + l.replace(/[\\()]/g, '\\$&') + ') Tj T*'; }).join(' ') + ' ET';
      objs[pid] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + cid + ' 0 R >>';
      objs[cid] = '<< /Length ' + body.length + ' >>\nstream\n' + body + '\nendstream';
      kids.push(pid + ' 0 R');
    });
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
    var out = '%PDF-1.4\n', offs = [];
    for (var k = 1; k < objs.length; k++) { offs[k] = out.length; out += k + ' 0 obj\n' + objs[k] + '\nendobj\n'; }
    var x = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n' + offs.slice(1).map(function (o) { return pad(o, 10) + ' 00000 n \n'; }).join('') +
      'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
    return out;
  }
  Blob_.prototype.isGoogleType = function () { return false; };

  /* ======================= the Google services, over one state object ======================= */
  function makeGoogle(st, app, cache) {
    var drive = st.drive, books = st.books;
    function nextId(kind) { st.seq = (st.seq || 0) + 1; return 'demo-' + kind + '-' + st.seq; }
    function nowMs() { return Date.now(); }

    /* ---------- Sheets ---------- */
    function blank(v) { return v === '' || v === null || v === undefined; }
    function tabLastRow(t) { for (var r = t.v.length - 1; r >= 0; r--) if ((t.v[r] || []).some(function (c) { return !blank(c); })) return r + 1; return 0; }
    function tabLastCol(t) { var w = 0; t.v.forEach(function (row) { for (var c = (row || []).length - 1; c >= 0; c--) if (!blank(row[c])) { if (c + 1 > w) w = c + 1; break; } }); return w; }
    function chainable(target) {
      // Formatting calls (setFontWeight, setNumberFormat, setBackground, autoResize...) have no
      // visible effect in a demo; any unknown setter/formatter is a chainable no-op. Unknown getters throw.
      return new Proxy(target, { get: function (o, p) {
        if (p in o || typeof p === 'symbol') return o[p];
        if (/^get|^is|^has/.test(p)) return function () { throw new Error('demo mock: ' + p + '() is not modelled'); };
        return function () { return this; };
      } });
    }
    function Range(book, tab, r, c, n, m) {
      var self = { book: book, tab: tab, r: r, c: c, n: n || 1, m: m || 1 };
      function cell(i, j) { var row = tab.v[r - 1 + i]; var x = row ? row[c - 1 + j] : ''; return blank(x) ? '' : x; }
      function put(grid, i, j, x) {
        var ri = r - 1 + i, ci = c - 1 + j;
        while (grid.length <= ri) grid.push([]);
        while (grid[ri].length < ci) grid[ri].push('');
        grid[ri][ci] = x;
      }
      function note(i, j) { var row = (tab.n || [])[r - 1 + i]; var x = row ? row[c - 1 + j] : ''; return blank(x) ? '' : String(x); }
      var api = {
        getValues: function () { var out = []; for (var i = 0; i < self.n; i++) { var row = []; for (var j = 0; j < self.m; j++) row.push(cell(i, j)); out.push(row); } return out; },
        getDisplayValues: function () { return api.getValues().map(function (row) { return row.map(function (v) { return v instanceof Date ? formatDate(v, TZ, 'M/d/yyyy H:mm:ss') : String(v); }); }); },
        getValue: function () { return cell(0, 0); },
        setValues: function (vals) {
          if (!vals || vals.length !== self.n || vals.some(function (row) { return row.length !== self.m; }))
            throw new Error('The number of rows or columns in the data does not match the range.');
          for (var i = 0; i < self.n; i++) for (var j = 0; j < self.m; j++) put(tab.v, i, j, vals[i][j]);
          return proxy;
        },
        setValue: function (x) { for (var i = 0; i < self.n; i++) for (var j = 0; j < self.m; j++) put(tab.v, i, j, x); return proxy; },
        getNotes: function () { var out = []; for (var i = 0; i < self.n; i++) { var row = []; for (var j = 0; j < self.m; j++) row.push(note(i, j)); out.push(row); } return out; },
        getNote: function () { return note(0, 0); },
        setNote: function (x) { tab.n = tab.n || []; for (var i = 0; i < self.n; i++) for (var j = 0; j < self.m; j++) put(tab.n, i, j, x == null ? '' : String(x)); return proxy; },
        setNotes: function (vals) { tab.n = tab.n || []; for (var i = 0; i < self.n; i++) for (var j = 0; j < self.m; j++) put(tab.n, i, j, vals[i][j]); return proxy; },
        clearContent: function () { for (var i = 0; i < self.n; i++) for (var j = 0; j < self.m; j++) if ((tab.v[r - 1 + i] || [])[c - 1 + j] !== undefined) put(tab.v, i, j, ''); return proxy; },
        clearContents: function () { return api.clearContent(); },
        clear: function () { return api.clearContent(); },
        getRow: function () { return r; }, getColumn: function () { return c; },
        getNumRows: function () { return self.n; }, getNumColumns: function () { return self.m; },
        getLastRow: function () { return r + self.n - 1; }, getLastColumn: function () { return c + self.m - 1; },
        getSheet: function () { return Sheet(book, tab); }
      };
      var proxy = chainable(api);
      return proxy;
    }
    function Sheet(book, tab) {
      var api = {
        _tab: tab,
        getName: function () { return tab.name; },
        setName: function (n) { tab.name = String(n); return proxy; },
        getSheetId: function () { return book.tabs.indexOf(tab); },
        getParent: function () { return Spreadsheet(book); },
        getLastRow: function () { return tabLastRow(tab); },
        getLastColumn: function () { return tabLastCol(tab); },
        getMaxRows: function () { return Math.max(tab.v.length, tab.maxRows || 1000); },
        getMaxColumns: function () { return Math.max(tabLastCol(tab), 26); },
        getFrozenRows: function () { return tab.frozen || 0; },
        setFrozenRows: function (n) { tab.frozen = n; return proxy; },
        insertRowsAfter: function (after, n) { tab.maxRows = Math.max(tab.v.length, tab.maxRows || 1000) + n; return proxy; },
        getRange: function (r, c, n, m) {
          if (typeof r === 'string') throw new Error('demo mock: A1 ranges are not modelled');
          if (r < 1 || c < 1) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
          return Range(book, tab, r, c, n, m);
        },
        getDataRange: function () { return Range(book, tab, 1, 1, Math.max(tabLastRow(tab), 1), Math.max(tabLastCol(tab), 1)); },
        appendRow: function (row) { var at = tabLastRow(tab); tab.v[at] = row.map(function (x) { return x === undefined ? '' : x; }); touch(book); return proxy; },
        deleteRow: function (r) { tab.v.splice(r - 1, 1); if (tab.n) tab.n.splice(r - 1, 1); return proxy; },
        deleteRows: function (r, n) { tab.v.splice(r - 1, n); if (tab.n) tab.n.splice(r - 1, n); return proxy; },
        clear: function () { tab.v = []; tab.n = []; return proxy; },
        clearContents: function () { tab.v = []; return proxy; },
        activate: function () { return proxy; }
      };
      var proxy = chainable(api);
      return proxy;
    }
    function touch(book) { var f = drive.files[book.id]; if (f) f.updated = nowMs(); }
    function Spreadsheet(book) {
      var api = {
        getId: function () { return book.id; },
        getName: function () { return drive.files[book.id] ? drive.files[book.id].name : book.id; },
        rename: function (n) { if (drive.files[book.id]) drive.files[book.id].name = n; return proxy; },
        getUrl: function () { return 'https://docs.example.invalid/spreadsheets/d/' + book.id; },
        getSheets: function () { return book.tabs.map(function (t) { return Sheet(book, t); }); },
        getSheetByName: function (n) { var t = book.tabs.filter(function (x) { return x.name === n; })[0]; return t ? Sheet(book, t) : null; },
        insertSheet: function (n) {
          n = n || ('Sheet' + (book.tabs.length + 1));
          if (book.tabs.some(function (x) { return x.name === n; })) throw new Error('A sheet with the name "' + n + '" already exists.');
          var t = { name: n, v: [], n: [] }; book.tabs.push(t); return Sheet(book, t);
        },
        deleteSheet: function (sh) { book.tabs = book.tabs.filter(function (t) { return t !== sh._tab; }); return proxy; },
        getActiveSheet: function () { return Sheet(book, book.tabs[0]); }
      };
      var proxy = chainable(api);
      return proxy;
    }
    function createBook(name, id, parentId) {
      id = id || nextId('sheet');
      books[id] = { id: id, tabs: [{ name: 'Sheet1', v: [], n: [] }] };
      drive.files[id] = { id: id, name: name, mime: MimeType.GOOGLE_SHEETS, parents: [parentId || 'root'], created: nowMs(), updated: nowMs(), trashed: false, desc: '' };
      return Spreadsheet(books[id]);
    }
    var SpreadsheetApp = {
      openById: function (id) {
        var b = books[id], f = drive.files[id];
        if (!b || (f && f.trashed)) throw new Error('Unexpected error while getting the method or property openById on object SpreadsheetApp. (no spreadsheet ' + id + ')');
        return Spreadsheet(b);
      },
      create: function (name) { return createBook(name); },
      flush: function () {}
    };

    /* ---------- Drive ---------- */
    function iter(list) { var i = 0; return { hasNext: function () { return i < list.length; }, next: function () { if (i >= list.length) throw new Error('No more items'); return list[i++]; } }; }
    function folderObj(f) {
      var api = {
        getId: function () { return f.id; }, getName: function () { return f.name; },
        setName: function (n) { f.name = String(n); return proxy; },
        getUrl: function () { return 'https://drive.example.invalid/drive/folders/' + f.id; },
        getDescription: function () { return f.desc || ''; }, setDescription: function (d) { f.desc = d; return proxy; },
        getDateCreated: function () { return new Date(f.created); }, getLastUpdated: function () { return new Date(f.updated || f.created); },
        isTrashed: function () { return !!f.trashed; }, setTrashed: function (b) { f.trashed = !!b; return proxy; },
        getParents: function () { return iter((f.parents || []).filter(function (p) { return drive.folders[p]; }).map(function (p) { return folderObj(drive.folders[p]); })); },
        createFolder: function (name) { return folderObj(newFolder(name, f.id)); },
        createFile: function (a, b, c) { return fileObj(newFile(a, b, c, f.id)); },
        addFile: function (file) { var x = drive.files[file.getId()]; if (x.parents.indexOf(f.id) < 0) x.parents.push(f.id); return proxy; },
        removeFile: function (file) { var x = drive.files[file.getId()]; x.parents = x.parents.filter(function (p) { return p !== f.id; }); return proxy; },
        addFolder: function (folder) { var x = drive.folders[folder.getId()]; if (x.parents.indexOf(f.id) < 0) x.parents.push(f.id); return proxy; },
        removeFolder: function (folder) { var x = drive.folders[folder.getId()]; x.parents = x.parents.filter(function (p) { return p !== f.id; }); return proxy; },
        moveTo: function (dest) { f.parents = [dest.getId()]; return proxy; },
        getFolders: function () { return iter(childFolders(f.id).map(folderObj)); },
        getFiles: function () { return iter(childFiles(f.id).map(fileObj)); },
        getFoldersByName: function (n) { return iter(childFolders(f.id).filter(function (x) { return x.name === n; }).map(folderObj)); },
        getFilesByName: function (n) { return iter(childFiles(f.id).filter(function (x) { return x.name === n; }).map(fileObj)); },
        setSharing: function () { return proxy; }, getSharingAccess: function () { return 'PRIVATE'; },
        addEditor: function () { return proxy; }, addViewer: function () { return proxy; }
      };
      var proxy = chainable(api);
      return proxy;
    }
    function childFolders(id) { return Object.keys(drive.folders).map(function (k) { return drive.folders[k]; }).filter(function (x) { return !x.trashed && x.parents.indexOf(id) > -1; }); }
    function childFiles(id) { return Object.keys(drive.files).map(function (k) { return drive.files[k]; }).filter(function (x) { return !x.trashed && x.parents.indexOf(id) > -1; }); }
    function newFolder(name, parentId) { var id = nextId('folder'); drive.folders[id] = { id: id, name: String(name), parents: [parentId || 'root'], created: nowMs(), trashed: false }; return drive.folders[id]; }
    var STORE_CAP = 1500000; // bytes kept per uploaded file in this tab's storage
    function newFile(a, b, c, parentId) {
      var blob = (a instanceof Blob_) ? a : new Blob_(utf8(b == null ? '' : String(b)), c || MimeType.PLAIN_TEXT, a);
      var id = nextId('file');
      var rec = { id: id, name: blob.name || 'Untitled', mime: blob.type, parents: [parentId || 'root'], created: nowMs(), updated: nowMs(), trashed: false, desc: '', size: blob.bytes.length };
      if (blob.bytes.length > STORE_CAP) rec.omitted = true; else rec.b64 = b64enc(blob.bytes);
      drive.files[id] = rec;
      return rec;
    }
    function fileObj(f) {
      if (f.mime === MimeType.FOLDER) return folderObj(f);
      var api = {
        getId: function () { return f.id; }, getName: function () { return f.name; },
        setName: function (n) { f.name = String(n); return proxy; },
        getMimeType: function () { return f.mime; },
        getUrl: function () { return DRIVE_URL + f.id; },
        getDownloadUrl: function () { return DRIVE_URL + f.id; },
        getSize: function () { return f.size || 0; },
        getDescription: function () { return f.desc || ''; }, setDescription: function (d) { f.desc = d; return proxy; },
        getDateCreated: function () { return new Date(f.created); }, getLastUpdated: function () { return new Date(f.updated || f.created); },
        isTrashed: function () { return !!f.trashed; }, setTrashed: function (b) { f.trashed = !!b; return proxy; },
        getParents: function () { return iter((f.parents || []).filter(function (p) { return drive.folders[p]; }).map(function (p) { return folderObj(drive.folders[p]); })); },
        getBlob: function () {
          if (books[f.id]) throw new Error('demo mock: exporting a spreadsheet is not modelled');
          return new Blob_(f.b64 ? b64dec(f.b64) : [], f.mime, f.name);
        },
        getAs: function (type) { return api.getBlob().getAs(type); },
        setContent: function (s) { var bytes = utf8(s); f.b64 = b64enc(bytes); f.size = bytes.length; f.updated = nowMs(); return proxy; },
        setSharing: function () { return proxy; }, getSharingAccess: function () { return 'PRIVATE'; },
        addEditor: function () { return proxy; }, addViewer: function () { return proxy; },
        moveTo: function (dest) { f.parents = [dest.getId()]; return proxy; },
        makeCopy: function (name, dest) {
          var id = nextId('file'); var copy = clone(f); copy.id = id; copy.name = name || ('Copy of ' + f.name);
          copy.parents = [dest ? dest.getId() : (f.parents[0] || 'root')]; copy.created = copy.updated = nowMs();
          drive.files[id] = copy; if (books[f.id]) { books[id] = clone(books[f.id]); books[id].id = id; }
          return fileObj(copy);
        },
        getThumbnail: function () { return null; }
      };
      var proxy = chainable(api);
      return proxy;
    }
    var DriveApp = {
      Access: { ANYONE: 'ANYONE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', DOMAIN: 'DOMAIN', DOMAIN_WITH_LINK: 'DOMAIN_WITH_LINK', PRIVATE: 'PRIVATE' },
      Permission: { VIEW: 'VIEW', EDIT: 'EDIT', COMMENT: 'COMMENT', NONE: 'NONE', OWNER: 'OWNER' },
      getRootFolder: function () { return folderObj(drive.folders.root); },
      getFolderById: function (id) { var f = drive.folders[id]; if (!f) throw new Error('No item with the given ID could be found, or you do not have permission to access it. (' + id + ')'); return folderObj(f); },
      getFileById: function (id) { var f = drive.files[id]; if (!f) throw new Error('No item with the given ID could be found, or you do not have permission to access it. (' + id + ')'); return fileObj(f); },
      getFoldersByName: function (n) { return iter(Object.keys(drive.folders).map(function (k) { return drive.folders[k]; }).filter(function (x) { return !x.trashed && x.name === n; }).map(folderObj)); },
      getFilesByName: function (n) { return iter(Object.keys(drive.files).map(function (k) { return drive.files[k]; }).filter(function (x) { return !x.trashed && x.name === n; }).map(fileObj)); },
      createFolder: function (n) { return folderObj(newFolder(n, 'root')); },
      createFile: function (a, b, c) { return fileObj(newFile(a, b, c, 'root')); }
    };

    /* ---------- the rest ---------- */
    var propStore = st.props[app] = st.props[app] || {};
    var props = {
      getProperty: function (k) { return Object.prototype.hasOwnProperty.call(propStore, k) ? propStore[k] : null; },
      setProperty: function (k, v) { propStore[k] = String(v); return props; },
      deleteProperty: function (k) { delete propStore[k]; return props; },
      getProperties: function () { return clone(propStore); },
      setProperties: function (o) { Object.keys(o).forEach(function (k) { propStore[k] = String(o[k]); }); return props; },
      getKeys: function () { return Object.keys(propStore); }
    };
    function alive(k) { var e = cache[k]; if (!e) return false; if (e.until && e.until < Date.now()) { delete cache[k]; return false; } return true; }
    var scriptCache = {
      get: function (k) { return alive(k) ? cache[k].v : null; },
      put: function (k, v, ttl) { cache[k] = { v: String(v), until: Date.now() + (ttl || 600) * 1000 }; },
      remove: function (k) { delete cache[k]; },
      getAll: function (keys) { var o = {}; (keys || []).forEach(function (k) { if (alive(k)) o[k] = cache[k].v; }); return o; },
      putAll: function (obj, ttl) { Object.keys(obj).forEach(function (k) { scriptCache.put(k, obj[k], ttl); }); },
      removeAll: function (keys) { (keys || []).forEach(function (k) { delete cache[k]; }); }
    };
    // The two DOMAIN apps always see the staff account. The anonymous apps see nobody — except on a
    // Builder "Preview" (?preview=1), which is the signed-in staff member's own browser: Apps Script
    // reports a same-domain Google account there too, and getFormPreview's requireStaff_ relies on it.
    var signedIn = (app === 'builder' || app === 'runner-staff' || PREVIEW_PAGE) ? D.staffUser : '';
    function notHere(what) {
      var thrower = function () { throw new Error(what + ' isn\'t available in this browser-only demo.'); };
      return new Proxy(thrower, { get: function (o, p) { return typeof p === 'symbol' ? undefined : notHere(what); }, apply: thrower });
    }
    function sendEmail(a, b, c, d) {
      var m = (a && typeof a === 'object') ? a : Object.assign({ to: a, subject: b, body: c }, d || {});
      st.outbox.push({ to: String(m.to || ''), cc: m.cc || '', bcc: m.bcc || '', subject: String(m.subject || ''), body: String(m.body || ''),
        htmlBody: m.htmlBody ? String(m.htmlBody) : '', name: m.name || '', at: Date.now(), app: app,
        attachments: (m.attachments || []).map(function (x) { return x && x.getName ? x.getName() : 'attachment'; }) });
      if (st.outbox.length > 60) st.outbox.splice(0, st.outbox.length - 60);
      st.newMail = (st.newMail || 0) + 1;
    }
    return {
      SpreadsheetApp: SpreadsheetApp, DriveApp: DriveApp, MimeType: MimeType,
      Drive: notHere('Drive file conversion (the Drive advanced service)'),
      Slides: notHere('Google Slides'), SlidesApp: notHere('Google Slides'),
      CacheService: { getScriptCache: function () { return scriptCache; }, getUserCache: function () { return scriptCache; } },
      PropertiesService: { getScriptProperties: function () { return props; }, getUserProperties: function () { return props; } },
      LockService: { getScriptLock: function () { return { waitLock: function () {}, tryLock: function () { return true; }, releaseLock: function () {}, hasLock: function () { return true; } }; } },
      Session: {
        getActiveUser: function () { return { getEmail: function () { return signedIn; } }; },
        getEffectiveUser: function () { return { getEmail: function () { return 'it@example.edu'; } }; },
        getScriptTimeZone: function () { return TZ; }, getTemporaryActiveUserKey: function () { return 'demo-user-key'; }
      },
      AdminDirectory: { Users: { get: function (email) {
        var u = D.directoryUsers[String(email || '').toLowerCase()];
        if (!u) throw new Error('Resource Not Found: userKey');
        return { primaryEmail: String(email).toLowerCase(), name: { fullName: u.name }, orgUnitPath: u.orgUnitPath, suspended: false };
      } } },
      Utilities: {
        formatDate: formatDate,
        getUuid: uuid,
        computeHmacSha256Signature: computeHmac,
        computeDigest: function (alg, value) { return signed(sha256(toBytes(value))); },
        DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF-8' },
        base64Encode: function (x) { return b64enc(x); }, base64EncodeWebSafe: function (x) { return b64enc(x, true); },
        base64Decode: function (s) { return signed(b64dec(s)); }, base64DecodeWebSafe: function (s) { return signed(b64dec(s)); },
        newBlob: function (data, type, name) { return new Blob_(data, type, name); },
        sleep: function () {},
        formatString: function (f) { var a = [].slice.call(arguments, 1), i = 0; return String(f).replace(/%[sd]/g, function () { return String(a[i++]); }); }
      },
      MailApp: { sendEmail: sendEmail, getRemainingDailyQuota: function () { return 1500; } },
      ScriptApp: {
        getService: function () { return { getUrl: function () { return APP_URL[app] || ''; } }; },
        getProjectTriggers: function () { return []; }, deleteTrigger: function () {}, getOAuthToken: function () { return 'demo-oauth-token'; },
        newTrigger: function () { var b = { timeBased: function () { return b; }, everyHours: function () { return b; }, everyDays: function () { return b; }, atHour: function () { return b; }, create: function () { return {}; } }; return b; }
      },
      HtmlService: {
        XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
        createTemplateFromFile: function (name) {
          var t = {};
          Object.defineProperty(t, 'evaluate', { enumerable: false, value: function () { st.lastTemplate = { file: name, vars: Object.assign({}, t) }; return htmlOut('', st.lastTemplate); } });
          return t;
        },
        createHtmlOutputFromFile: function (name) { return htmlOut(''); },
        createHtmlOutput: function (html) { return htmlOut(String(html || ''), null); }
      },
      ContentService: { MimeType: { JSON: 'JSON', TEXT: 'TEXT' }, createTextOutput: function (s) { var o = { content: s, setMimeType: function () { return o; }, getContent: function () { return s; } }; return o; } },
      UrlFetchApp: { fetch: function (url) { return { getResponseCode: function () { return 200; }, getContentText: function () { return ''; }, getHeaders: function () { return {}; } }; } },
      Logger: { log: function () { if (window.FORMS_DEMO_DEBUG && window.console) console.log.apply(console, ['[Logger]'].concat([].slice.call(arguments))); } }
    };
    function htmlOut(content, tmpl) {
      var o = { content: content, template: tmpl || null, title: '', metas: [] };
      o.setTitle = function (t) { o.title = t; return o; };
      o.addMetaTag = function (n, c) { o.metas.push([n, c]); return o; };
      o.setXFrameOptionsMode = function () { return o; };
      o.setSandboxMode = function () { return o; };
      o.getContent = function () { return o.content; };
      o.getTitle = function () { return o.title; };
      return o;
    }
  }

  /* ======================= first visit: build both contexts with the app's own code ======================= */
  var REGISTRY_ID = window.FORMS_SERVER('builder', {}).CONTEXTS_REGISTRY_SHEET_ID;
  var IDS = { hcsRoot: 'demo-folder-hcs', macsRoot: 'demo-folder-macs', hcsSys: 'demo-sheet-hcs-system', macsSys: 'demo-sheet-macs-system', parent: 'demo-folder-forms' };

  function freshState() {
    return { version: 1, seq: 100, drive: { folders: { root: { id: 'root', name: 'My Drive', parents: [], created: Date.now(), trashed: false } }, files: {} },
      books: {}, outbox: [], newMail: 0,
      props: {
        builder: { SYSTEM_SHEET_ID: IDS.hcsSys, FORMS_ROOT_FOLDER_ID: IDS.hcsRoot, AUTH_HMAC_SECRET: 'demo-secret-builder-7f3a', APP_HANDOFF_SECRET: 'demo-handoff-secret-21c9', EDIT_LINK_SECRET: 'demo-edit-link-secret-9d44', DEVELOPER_OVERRIDE: 'false' },
        'runner-public': { SYSTEM_SHEET_ID: IDS.hcsSys, FORMS_ROOT_FOLDER_ID: IDS.hcsRoot, AUTH_HMAC_SECRET: 'demo-secret-public-c18e', APP_HANDOFF_SECRET: 'demo-handoff-secret-21c9', EDIT_LINK_SECRET: 'demo-edit-link-secret-9d44', DEVELOPER_OVERRIDE: 'false' },
        'runner-staff': { SYSTEM_SHEET_ID: IDS.hcsSys, FORMS_ROOT_FOLDER_ID: IDS.hcsRoot, AUTH_HMAC_SECRET: 'demo-secret-staff-55b0', APP_HANDOFF_SECRET: 'demo-handoff-secret-21c9', EDIT_LINK_SECRET: 'demo-edit-link-secret-9d44', DEVELOPER_OVERRIDE: 'false' },
        'runner-macs': { CONTEXT_ID: 'macs', AUTH_HMAC_SECRET: 'demo-secret-macs-0be2', EDIT_LINK_SECRET: 'demo-edit-link-secret-9d44', DEVELOPER_OVERRIDE: 'false' },
        chooser: {}
      } };
  }

  function bootstrap() {
    var st = freshState(), cache = {};
    var g = makeGoogle(st, 'builder', cache);
    var S = window.FORMS_SERVER('builder', g);
    var drive = st.drive;
    // Drive: one shared "HCS Forms" umbrella with a folder per context (CLAUDE.md's layout)
    drive.folders[IDS.parent] = { id: IDS.parent, name: 'HCS Forms', parents: ['root'], created: Date.now(), trashed: false };
    drive.folders[IDS.hcsRoot] = { id: IDS.hcsRoot, name: 'HCS', parents: [IDS.parent], created: Date.now(), trashed: false };
    drive.folders[IDS.macsRoot] = { id: IDS.macsRoot, name: 'MACS', parents: [IDS.parent], created: Date.now(), trashed: false };
    function book(id, name, parent) {
      st.books[id] = { id: id, tabs: [{ name: 'Sheet1', v: [], n: [] }] };
      drive.files[id] = { id: id, name: name, mime: MimeType.GOOGLE_SHEETS, parents: [parent], created: Date.now(), updated: Date.now(), trashed: false, desc: '' };
      return g.SpreadsheetApp.openById(id);
    }
    // The Contexts Registry (adminBootstrapContextsRegistry's shape)
    var reg = book(REGISTRY_ID, 'Forms Contexts Registry', IDS.parent);
    var regTab = reg.insertSheet(S.CONTEXTS_REGISTRY_TAB); regTab.appendRow(S.CONTEXTS_REGISTRY_HEADERS); reg.deleteSheet(reg.getSheetByName('Sheet1'));
    var created = new Date().toISOString();
    var CTX = {
      hcs: { contextId: 'hcs', displayName: 'Harford Christian School', theme: {}, systemSheetId: IDS.hcsSys, rootFolderId: IDS.hcsRoot, authMode: 'facts-otp', runnerUrl: 'parent.html', active: true, createdAt: created, brandName: 'HCS Forms', logoUrl: '', devOverride: '' },
      macs: { contextId: 'macs', displayName: 'MACS', theme: JSON.parse(D.macs.config.THEME_JSON), systemSheetId: IDS.macsSys, rootFolderId: IDS.macsRoot, authMode: 'open-picker', runnerUrl: 'macs.html', active: true, createdAt: created, brandName: 'MACS Forms', logoUrl: '', devOverride: '' }
    };
    regTab.appendRow(S.contextObjToRow_(CTX.hcs)); regTab.appendRow(S.contextObjToRow_(CTX.macs));

    function context(key, data) {
      var ss = book(CTX[key].systemSheetId, '_System', CTX[key].rootFolderId);
      S = window.FORMS_SERVER('builder', g);
      S.setActiveContext_(CTX[key]);
      S.provisionSystemSpreadsheet_(ss);                        // every _System tab, headers, Config + Admins seeds
      var T = S.SYS.TABS;
      Object.keys(data.config).forEach(function (k) { S.cfSetConfig_(k, data.config[k]); });
      // ADMINS_SEED names the real school's admins (aliased in logic.js); the demo's Admins tab lists
      // its own fabricated admins plus the deploying account the code always treats as admin.
      var adm = ss.getSheetByName(T.ADMINS);
      while (adm.getLastRow() > 1) adm.deleteRow(2);
      (data.admins || []).concat([['it@example.edu', 'Deploying account']]).forEach(function (r) { adm.appendRow(r); });
      [[T.DIRECTORY, data.directory], [T.CLASSES, data.classes], [T.FACTS_STAFF, data.factsStaff], [T.STAFF, data.staff],
       [T.GROUPS, data.approvalGroups], [T.APPS, data.apps], [T.MACS_SCHOOLS, data.schools]].forEach(function (p) {
        var sh = ss.getSheetByName(p[0]); (p[1] || []).forEach(function (r) { sh.appendRow(r); });
      });
      return S;
    }
    function addForms(S, list) {
      (list || []).forEach(function (f) {
        var schema = clone(f.schema); schema.id = f.formId;
        var close = f.closeInDays ? formatDate(new Date(Date.now() + f.closeInDays * 86400000), TZ, 'yyyy-MM-dd') : '';
        if (close) schema.settings.closeDate = close;
        var folder = S.getFormFolder_(f.formId, schema.title);
        var now = new Date(Date.now() - 86400000 * 3).toISOString();
        S.sysTab_(S.SYS.TABS.REGISTRY).appendRow([f.formId, schema.title, f.owner, f.lifecycle, f.access, false, now, now, '', folder.getId(), '', 1,
          !!f.isTemplate, f.templateScope || '', '', f.category || '', '', '', f.classCode || '', f.classTeacher || '', close]);
        S.saveSchemaObj_(f.formId, schema);
        if (f.lifecycle === 'published' && !f.isTemplate) S.ensureResponseSheet_(f.formId, schema);
      });
    }
    var seq = 0;
    function addSubmissions(S, list) {
      (list || []).forEach(function (s) {
        var schema = S.loadSchemaObj_(s.formId);
        var fields = S.inputFields_(schema), values = {};
        fields.forEach(function (f) { values[f.id] = S.normalizeAnswer_(f, s.values[f.id]); });
        var approval = S.resolveApproval_(schema, values);
        var when = new Date(Date.now() - s.daysAgo * 86400000 - (seq * 37 + 95) * 60000);
        S.writeResponse_(s.formId, schema, { submissionId: 'SUB-' + formatDate(when, TZ, 'yyyyMMddHHmmss') + '-' + pad(++seq * 7, 3),
          timestamp: when, respondentEmail: s.email, verifiedVia: s.via, status: approval.required ? 'Pending Approval' : 'Submitted',
          approvers: approval.approvers.join(', '), values: values });
      });
    }
    // HCS: the source's own built-in forms (Seeds.js, adminReseedForms' path), signed in as the demo admin
    S = context('hcs', D.hcs);
    S.seedAllForms_();
    Object.keys(D.hcs.closeInDays || {}).forEach(function (id) {
      var close = formatDate(new Date(Date.now() + D.hcs.closeInDays[id] * 86400000), TZ, 'yyyy-MM-dd');
      var schema = S.loadSchemaObj_(id); schema.settings.closeDate = close; S.saveSchemaObj_(id, schema); S.regSet_(id, 'CloseDate', close);
    });
    addForms(S, D.hcs.forms);
    addSubmissions(S, D.hcs.submissions);
    S = context('macs', D.macs);
    addForms(S, D.macs.forms);
    addSubmissions(S, D.macs.submissions);
    st.outbox = []; st.newMail = 0;
    delete st.lastTemplate;
    return st;
  }

  function state() {
    var st = loadState();
    if (!st || st.version !== 1) { st = bootstrap(); saveState(st); }
    return st;
  }

  /* ======================= one execution per call ======================= */
  var PAGE_CACHE = {};   // CacheService for this page's app, for the life of the page
  function execute(name, args) {
    var st = state();
    var S = window.FORMS_SERVER(APP, makeGoogle(st, APP, PAGE_CACHE));
    if (typeof S[name] !== 'function') throw new Error('Script function not found: ' + name);
    try { return clone(S[name].apply(null, clone(args || []))); }
    finally { saveState(st); setTimeout(renderInbox, 0); }
  }

  // Builder calls that need Google Slides / Drive thumbnails / pdf-lib to do anything at all.
  var SLIDES_ONLY = { addPdfTemplate: 1, replacePdfTemplateSource: 1, buildPdfTemplate: 1, adminRebuildSubmissionPdf: 1, adminRebuildAllSubmissionPdfs: 1, adminDeleteLastPdfRebuild: 1 };

  // The methods each page calls (verify.mjs checks this list equals a scan of the built page).
  var RUNNER_METHODS = ['authRequestOtp', 'authVerifyOtp', 'getFormPreview', 'getPriorAnswersForSchool', 'getPriorAnswersForStudent', 'getPublicForm',
    'getSubmissionForEdit', 'macsRequestOtp', 'macsVerifyOtp', 'submitForm', 'updateSubmission', 'withdrawSubmission'];
  var PORTAL_METHODS = ['authRequestOtp', 'authVerifyOtp', 'getAppHandoffUrl', 'getGuestView', 'getParentBridgeUrl', 'getPortalView'];
  var BUILDER_METHODS = ['addAdmin', 'addPdfTemplate', 'adminAddApp', 'adminAddContext', 'adminCheckAllAppsStatus', 'adminCheckAppStatus', 'adminCreateContext',
    'adminDeleteApp', 'adminDeleteApprovalGroup', 'adminDeleteLastPdfRebuild', 'adminDeleteStaff', 'adminFactsDiagnose', 'adminFactsStatus', 'adminFactsSyncNow',
    'adminFactsValidate', 'adminGetEditLink', 'adminGetSiteSettings', 'adminListApprovalGroups', 'adminListApps', 'adminListContexts', 'adminListStaff',
    'adminMigrateResponseSheet', 'adminMoveApp', 'adminMoveForm', 'adminRebuildAllSubmissionPdfs', 'adminRebuildSubmissionPdf', 'adminRenameSubmissionFolders',
    'adminSaveApprovalGroup', 'adminSaveSiteSettings', 'adminSaveStaff', 'adminSetFactsSource', 'adminSignOutAllParents', 'adminUpdateApp', 'adminUpdateContext',
    'adminUploadAppLogo', 'buildPdfTemplate', 'createForm', 'createFromTemplate', 'decideApproval', 'decideTemplateRequest', 'deleteForm', 'deletePdfTemplate',
    'duplicateForm', 'exportResponsesCsv', 'getMyClassOptions', 'getResponses', 'getShareUrl', 'getTemplatePreview', 'getTemplateRequests', 'listAdmins',
    'listAllForms', 'listLibrary', 'listMyApprovalQueue', 'listMyForms', 'loadFormForEdit', 'removeAdmin', 'renamePdfTemplate', 'replacePdfTemplateSource',
    'requestPublishTemplate', 'saveAsTemplate', 'saveForm', 'savePdfTemplateMapping', 'setFormClassTag', 'setFormMeta', 'setFormState', 'setTemplateScope',
    'uploadFormIcon', 'whoAmI'];
  var METHODS = { builder: BUILDER_METHODS, chooser: [], parent: PORTAL_METHODS, staff: PORTAL_METHODS, 'macs-portal': PORTAL_METHODS,
    'parent-form': RUNNER_METHODS, 'staff-form': RUNNER_METHODS, 'macs-form': RUNNER_METHODS, macs: [] }[SURFACE] || [];
  var backend = {};
  METHODS.forEach(function (name) {
    backend[name] = SLIDES_ONLY[name]
      ? function () { throw new Error('PDF templates are built on Google Slides and Drive thumbnails, which this browser-only demo can\'t run. Everything else on this tab works.'); }
      : function () { return execute(name, [].slice.call(arguments)); };
  });
  window.MOCK_BACKEND = backend;

  /* ======================= doGet: this page's template values ======================= */
  function queryParams() {
    var p = {}, ps = {};
    new URLSearchParams(location.search).forEach(function (v, k) { if (!(k in p)) p[k] = v; (ps[k] = ps[k] || []).push(v); });
    return { parameter: p, parameters: ps, queryString: location.search.replace(/^\?/, ''), contextPath: '', contentLength: -1 };
  }
  var DOGET = { mode: '' }, HOPPING = false;
  (function runDoGet() {
    var st = state();
    var S = window.FORMS_SERVER(APP, makeGoogle(st, APP, PAGE_CACHE));
    var out = S.doGet(queryParams());
    var tmpl = out && out.template && out.template.file === 'pages/Index' ? out.template.vars : null;
    if (tmpl) { DOGET = tmpl; } else { DOGET = { denied: out ? out.getContent() : 'Unavailable' }; }
    var theme = '';
    try { S.include_('pages/Theme'); theme = (st.lastTemplate && st.lastTemplate.file === 'pages/Theme') ? (st.lastTemplate.vars.themeCss || '') : ''; } catch (e) {}
    delete st.lastTemplate;
    saveState(st);
    if (out && out.title) document.title = out.title;
    (out && out.metas || []).forEach(function (m) { var el = document.createElement('meta'); el.name = m[0]; el.content = m[1]; document.head.appendChild(el); });
    if (theme) { var style = document.createElement('style'); style.setAttribute('data-demo', 'themeCss'); style.textContent = ':root {\n' + theme + '\n}'; document.head.appendChild(style); }
    // The template's one branch a static page cannot carry: hop to the page built for doGet's branch.
    var want = SURFACE_FOR[APP] && SURFACE_FOR[APP][DOGET.mode];
    if (want && want !== SURFACE) { HOPPING = true; location.replace(want + '.html' + location.search + location.hash); }
  })();
  window.DEMO_DOGET = DOGET;

  /* ======================= navigation stays in this tab ======================= */
  // The pages open forms and previews in new tabs (target=_blank, window.open). A new tab would start
  // with an empty sessionStorage and miss everything done so far, so same-folder links open in place.
  function local(url) { return url && !/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^\/\//.test(url); }
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf(DRIVE_URL) === 0) { ev.preventDefault(); openDriveFile(href.slice(DRIVE_URL.length)); return; }
    if (/^https:\/\/(docs|drive)\.example\.invalid\//.test(href)) {
      ev.preventDefault();
      toast('That spreadsheet or folder lives in the demo\'s pretend Google Drive — what the app reads from it is what you see on this page.');
      return;
    }
    if (local(href) && a.target && a.target !== '_self') a.target = '_self';
  }, true);
  var nativeOpen = window.open;
  window.open = function (url) {
    if (local(url)) { location.href = url; return null; }
    if (url && String(url).indexOf(DRIVE_URL) === 0) { openDriveFile(String(url).slice(DRIVE_URL.length)); return null; }
    return nativeOpen.apply(window, arguments);
  };
  function openDriveFile(id) {
    var st = state(), f = st.drive.files[id];
    if (!f || f.omitted || !f.b64) { toast('That file is in the demo\'s pretend Drive, but too large to keep in this tab.'); return; }
    var bytes = new Uint8Array(b64dec(f.b64));
    var url = URL.createObjectURL(new Blob([bytes], { type: f.mime || 'application/octet-stream' }));
    nativeOpen.call(window, url, '_blank');
  }

  /* ======================= the demo inbox ======================= */
  var CSS = '.fd-inbox{position:fixed;right:16px;bottom:64px;z-index:2147482000;font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;max-width:min(420px,calc(100vw - 32px))}' +
    '.fd-inbox .fd-btn{display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer;background:#1b1b1f;color:#fff;font-weight:700;padding:9px 14px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.28);float:right}' +
    '.fd-inbox .fd-btn b{background:#C79A3D;color:#322400;border-radius:999px;padding:0 7px;font-size:12px}' +
    '.fd-panel{clear:both;margin-bottom:8px;background:#fff;color:#1f2430;border:1px solid #d9dce1;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.22);max-height:min(70vh,560px);overflow:auto}' +
    '.fd-panel header{position:sticky;top:0;background:#f6f7f9;border-bottom:1px solid #e3e5e8;padding:10px 12px}' +
    '.fd-panel header strong{display:block;font-size:13px}.fd-panel header small{color:#555;display:block;margin-top:3px}' +
    '.fd-panel .fd-tip{margin-top:6px;background:#fff6dc;border:1px solid #ecd9a3;border-radius:8px;padding:6px 8px;color:#5d4500}' +
    '.fd-panel .fd-tip code{font-weight:700;font-size:12.5px}' +
    '.fd-msg{padding:10px 12px;border-bottom:1px solid #eef0f2}.fd-msg .fd-sub{font-weight:700}.fd-msg .fd-meta{color:#666;font-size:12px}' +
    '.fd-msg details summary{cursor:pointer;color:#8B1E1E;font-size:12px;margin-top:4px}.fd-msg .fd-body{margin-top:6px;border:1px solid #eee;border-radius:8px;overflow:hidden}' +
    '.fd-msg .fd-body iframe{width:100%;height:260px;border:0;background:#fff}.fd-msg pre{white-space:pre-wrap;margin:0;padding:8px;font:12px/1.45 ui-monospace,Consolas,monospace}' +
    '.fd-panel footer{padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px;color:#666;font-size:12px}' +
    '.fd-panel footer button{border:1px solid #cfd3da;background:#fff;border-radius:8px;padding:5px 10px;cursor:pointer;font:inherit}' +
    '.fd-toast{position:fixed;right:16px;bottom:112px;z-index:2147482001;background:#1f2430;color:#fff;padding:10px 14px;border-radius:10px;font:13px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:340px}';
  var open = false, toastT = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) {
    if (!document.body) return;
    var t = document.querySelector('.fd-toast');
    if (!t) { t = document.createElement('div'); t.className = 'fd-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = 'none'; }, 5200);
  }
  function tipHtml() {
    if (SURFACE === 'parent' || SURFACE === 'parent-form') return '<div class="fd-tip">Parent sign-in: <code>' + esc(D.demoParent) + '</code> (or any family in the demo directory) — every emailed code is <code>' + esc(D.otpCode) + '</code>.</div>';
    if (/^macs/.test(SURFACE)) return '<div class="fd-tip">Northside Christian Academy verifies by school email: <code>' + esc(D.demoMacsEmail) + '</code> — every emailed code is <code>' + esc(D.otpCode) + '</code>.</div>';
    if (SURFACE === 'builder' || SURFACE === 'staff' || SURFACE === 'staff-form') return '<div class="fd-tip">Signed in with Google as <code>' + esc(D.staffUser) + '</code> — an HCS Forms admin.</div>';
    return '';
  }
  function renderInbox() {
    if (!document.body) return;
    var st = loadState() || { outbox: [] };
    var box = document.querySelector('.fd-inbox');
    if (!box) {
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      box = document.createElement('div'); box.className = 'fd-inbox'; document.body.appendChild(box);
      box.addEventListener('click', function (ev) {
        if (ev.target.closest('.fd-btn')) { open = !open; renderInbox(); }
        if (ev.target.closest('[data-fd-reset]')) {
          if (ev.target.getAttribute('data-armed')) { var ss = store(); if (ss) ss.removeItem(STORE_KEY); location.reload(); }
          else { ev.target.setAttribute('data-armed', '1'); ev.target.textContent = 'Click again to reset'; }
        }
      });
    }
    var mail = (st.outbox || []).slice().reverse();
    if (st.newMail) {
      var last = mail[0];
      if (last) toast('📬 Email sent to ' + last.to + ': “' + last.subject + '” — open the Demo inbox to read it.');
      st.newMail = 0; saveState(st);
    }
    var html = '<button class="fd-btn" type="button" aria-expanded="' + open + '">📬 Demo inbox <b>' + mail.length + '</b></button>';
    if (open) {
      html += '<div class="fd-panel"><header><strong>Every email the app sent this visit</strong><small>Mail is caught here instead of delivered — nothing leaves this browser tab.</small>' + tipHtml() + '</header>' +
        (mail.length ? mail.map(function (m) {
          var body = m.htmlBody ? '<iframe sandbox="" srcdoc="' + esc(m.htmlBody) + '"></iframe>' : '<pre>' + esc(m.body) + '</pre>';
          return '<div class="fd-msg"><div class="fd-sub">' + esc(m.subject) + '</div><div class="fd-meta">To ' + esc(m.to) + ' · ' + esc(formatDate(new Date(m.at), TZ, 'h:mm a')) +
            (m.attachments && m.attachments.length ? ' · 📎 ' + esc(m.attachments.join(', ')) : '') + '</div><details><summary>Show message</summary><div class="fd-body">' + body + '</div></details></div>';
        }).join('') : '<div class="fd-msg fd-meta">No email yet. Request a sign-in code, submit a form, or approve a request.</div>') +
        '<footer><span>Shared by every page of this demo, in this tab.</span><button type="button" data-fd-reset>Reset demo</button></footer></div>';
    }
    box.innerHTML = html;
  }
  window.FORMS_DEMO = { state: function () { return loadState(); }, execute: execute, reset: function () { var s = store(); if (s) s.removeItem(STORE_KEY); }, doGet: DOGET, renderInbox: renderInbox };
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  // Sign-in hints: when one of the app's code screens appears, its empty email/code boxes get a
  // "Demo: ..." placeholder. Placeholders only — the visitor still types (or pastes) the values.
  var HINTS = { otpEmail: function () { return 'Demo: ' + D.demoParent; }, svEmail: function () { return 'Demo: ' + D.demoMacsEmail; },
    schoolOtpEmail: function () { return 'Demo: ' + D.demoMacsEmail; }, otpCode: function () { return 'Demo code: ' + D.otpCode; },
    svCode: function () { return 'Demo code: ' + D.otpCode; }, schoolOtpCode: function () { return 'Demo code: ' + D.otpCode; } };
  // Uploaded form icons / app logos: the server hands back a Drive thumbnail URL for the file it just
  // stored. That file lives in the demo's pretend Drive, so the <img> is pointed at its bytes instead.
  var THUMB = /^https:\/\/drive\.google\.com\/thumbnail\?id=(demo-file-\d+)/;
  function thumbs() {
    var imgs = document.querySelectorAll('img[src^="https://drive.google.com/thumbnail?id=demo-file-"]');
    if (!imgs.length) return;
    var st = loadState(); if (!st) return;
    [].forEach.call(imgs, function (img) {
      var f = st.drive.files[(THUMB.exec(img.getAttribute('src')) || [])[1]];
      if (f && f.b64) img.src = 'data:' + (f.mime || 'image/png') + ';base64,' + f.b64;
    });
  }
  function hint() {
    thumbs();
    if (/^(builder|chooser|staff)$/.test(SURFACE)) return;
    Object.keys(HINTS).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.getAttribute('data-demo-hint')) { el.setAttribute('data-demo-hint', '1'); el.placeholder = HINTS[id](); }
    });
  }
  ready(function () {
    if (HOPPING || !document.body) return;
    if (DOGET.denied !== undefined) document.body.innerHTML = DOGET.denied;
    if (window.MutationObserver) { hint(); new MutationObserver(hint).observe(document.body, { childList: true, subtree: true }); }
    renderInbox();
    if ((SURFACE === 'parent' || SURFACE === 'macs') && !sessionStorageFlag('fd-tip-' + SURFACE)) { open = true; renderInbox(); }
  });
  function sessionStorageFlag(k) { var s = store(); if (!s) return true; try { if (s.getItem(k)) return true; s.setItem(k, '1'); } catch (e) { return true; } return false; }
})();
