/* demo-banner.js — injects a "← Gallery" link and a "Sample data" tag into each
   demo. Reads window.DEMO_META = { name, tagline }. Loaded with `defer` so it
   runs after the DOM is parsed, without touching the app's own markup/logic. */
(function () {
  'use strict';
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    var meta = window.DEMO_META || {};

    var back = document.createElement('a');
    back.className = 'sc-demo-back';
    back.href = '../../index.html';
    back.setAttribute('target', '_top');
    back.innerHTML = '← Gallery';
    document.body.appendChild(back);

    var tag = document.createElement('div');
    tag.className = 'sc-demo-tag';
    tag.title = 'Interactive demo running on realistic sample data — no real records.';
    tag.innerHTML = '<span class="dot"></span> Live demo · sample data';
    document.body.appendChild(tag);

    if (meta.name) {
      var base = (document.title || '').replace(/\s*—\s*Showcase.*$/, '');
      document.title = base + ' — Showcase demo';
    }
  });
})();
