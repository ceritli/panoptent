/* Panoptent — VS Code Integrated Browser host.
 *
 * Runs the Chrome extension's in-page UI (chrome/content.js) inside VS Code's Integrated
 * Browser, where there is no `chrome.*` API. The preview proxy injects this file, then
 * content.js, wrapped in one closure where `chrome` is the small stand-in below:
 *
 *   chrome.runtime.connect()  → a WebSocket to the proxy's own origin (same session token
 *                               guards it), which VS Code attaches to the Chrome bridge
 *   chrome.storage.local      → localStorage of the preview origin
 *
 * It also does the few jobs chrome/background.js does in Chrome: loads the selection layer
 * on request, reports the (single) VS Code workspace as connected, and answers
 * `notConnected` while the socket is down.
 */
// eslint-disable-next-line no-unused-vars
function PanoptentChromeShim(cfg) {
  'use strict';
  var PREFIX = 'panoptent:';

  // ---------- storage.local → localStorage ----------
  function read(k) {
    // sayfa içi arayüz Integrated Browser'da her açılışta etkin
    if (String(k).indexOf('on:') === 0) return true;
    try {
      var v = localStorage.getItem(PREFIX + k);
      return v == null ? undefined : JSON.parse(v);
    } catch (e) {
      return undefined;
    }
  }
  function write(k, v) {
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* dolu ya da kapalı */ }
  }
  function drop(k) {
    try { localStorage.removeItem(PREFIX + k); } catch (e) { /* yok say */ }
  }
  function later(cb, v) {
    if (typeof cb === 'function') setTimeout(function () { cb(v); }, 0);
  }
  var storage = {
    local: {
      get: function (keys, cb) {
        var out = {};
        var list = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || {});
        list.forEach(function (k) {
          var v = read(k);
          if (v !== undefined) out[k] = v;
        });
        later(cb, out);
      },
      set: function (obj, cb) {
        Object.keys(obj || {}).forEach(function (k) { write(k, obj[k]); });
        later(cb);
      },
      remove: function (keys, cb) {
        (Array.isArray(keys) ? keys : [keys]).forEach(drop);
        later(cb);
      },
    },
  };

  // ---------- runtime.connect → proxy kanalı ----------
  function connect() {
    var onMsg = [];
    var onDisc = [];
    var pending = [];
    var closed = false;
    var ws;
    function emit(m) {
      onMsg.forEach(function (f) { try { f(m); } catch (e) { /* yok say */ } });
    }
    function status(ws0) {
      emit({ type: 'status', workspaces: ws0 ? [ws0] : [], active: ws0 ? ws0.port : null });
    }
    try {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + cfg.channel);
    } catch (e) {
      ws = null;
    }
    if (ws) {
      ws.onopen = function () {
        var q = pending;
        pending = [];
        q.forEach(function (d) { ws.send(d); });
      };
      ws.onmessage = function (ev) {
        var m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (!m || typeof m.type !== 'string') return;
        if (m.type === 'welcome') {
          // background.js'in yaptığı gibi: önce bağlı pencereyi bildir, dili hatırla
          var w = m.workspace || {};
          status({ port: w.port || 1, name: w.name || 'VS Code', root: w.root || '', state: 'ready' });
          if (m.lang) { write('vsLang', m.lang); drop('lang'); }
        } else if (m.type === 'lang' && m.value) {
          write('vsLang', m.value);
          drop('lang');
        }
        emit(m);
      };
      ws.onclose = function () {
        if (closed) return;
        closed = true;
        status(null);
        onDisc.forEach(function (f) { try { f(); } catch (e) { /* yok say */ } });
      };
    }
    function out(m) {
      if (!m || typeof m.type !== 'string') return;
      switch (m.type) {
        case 'injectOverlay':
          if (!document.querySelector('script[data-panoptent-layer]')) {
            var s = document.createElement('script');
            s.src = cfg.layer;
            s.setAttribute('data-panoptent-layer', '');
            (document.head || document.documentElement).appendChild(s);
          }
          return;
        case 'pair':
        case 'chooseWorkspace':
        case 'hint':
          return; // tek çalışma alanı, eşleştirme yok
      }
      var data = JSON.stringify(m);
      if (ws && ws.readyState === 1) return ws.send(data);
      if (ws && ws.readyState === 0) { pending.push(data); return; }
      if (m.type !== 'syncState' && m.type !== 'getState') {
        emit({ type: 'notConnected', for: m.type, tokens: (m.entries || []).map(function (e) { return e.token; }) });
      }
    }
    if (!ws) {
      setTimeout(function () {
        closed = true;
        onDisc.forEach(function (f) { try { f(); } catch (e) { /* yok say */ } });
      }, 0);
    }
    return {
      name: 'panoptent',
      postMessage: out,
      disconnect: function () { closed = true; try { ws && ws.close(); } catch (e) { /* yok say */ } },
      onMessage: { addListener: function (f) { onMsg.push(f); } },
      onDisconnect: { addListener: function (f) { onDisc.push(f); } },
    };
  }

  return { runtime: { connect: connect }, storage: storage };
}
