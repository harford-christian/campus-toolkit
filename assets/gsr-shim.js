/* ===========================================================================
   gsr-shim.js — a drop-in stand-in for google.script.run.

   Every showcase demo loads this in <head>, BEFORE the real app's own script.
   It installs a fake `google.script.run` so the untouched Apps Script UI runs
   in a plain browser: each backend method name resolves to
   window.MOCK_BACKEND[name](...args) and the result is delivered to the
   registered .withSuccessHandler() after a short fake latency.

   The real app code is used verbatim — we never edit its JS.
   =========================================================================== */
(function () {
  'use strict';

  function invoke(method, handlers, args) {
    var backend = window.MOCK_BACKEND || {};
    var fn = backend[method];
    var latency = (typeof window.DEMO_LATENCY === 'number') ? window.DEMO_LATENCY : 140;

    Promise.resolve()
      .then(function () {
        if (typeof fn !== 'function') {
          throw new Error('MOCK_BACKEND.' + method + '() is not defined — add it to this demo\'s mock.js');
        }
        return fn.apply(backend, args);
      })
      .then(function (result) {
        if (handlers.ok) setTimeout(function () { handlers.ok(result, handlers.userObject); }, latency);
      })
      .catch(function (err) {
        console.warn('[gsr-shim] ' + method + ' failed:', (err && err.message) ? err.message : err);
        if (handlers.err) setTimeout(function () { handlers.err(err, handlers.userObject); }, latency);
      });
  }

  function makeRunner(handlers) {
    handlers = handlers || {};
    return new Proxy(function () {}, {
      get: function (t, prop) {
        if (prop === 'withSuccessHandler') return function (fn) { return makeRunner(assign(handlers, 'ok', fn)); };
        if (prop === 'withFailureHandler') return function (fn) { return makeRunner(assign(handlers, 'err', fn)); };
        if (prop === 'withUserObject')     return function (o)  { return makeRunner(assign(handlers, 'userObject', o)); };
        if (typeof prop === 'symbol') return undefined;
        // Any other property is treated as a server function name.
        return function () { invoke(prop, handlers, Array.prototype.slice.call(arguments)); };
      }
    });
  }

  function assign(base, key, val) {
    var out = {}; for (var k in base) out[k] = base[k]; out[key] = val; return out;
  }

  window.google = window.google || {};
  window.google.script = {
    run: makeRunner(),
    host: {
      close: function () {}, setHeight: function () {}, setWidth: function () {},
      origin: '', editor: { focus: function () {} }
    },
    history: { push: function () {}, replace: function () {}, setChangeHandler: function () {} },
    url: { getLocation: function (cb) { if (cb) cb({ parameter: {}, parameters: {}, hash: '' }); } }
  };
})();
