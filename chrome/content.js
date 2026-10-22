// Panoptent — Chrome içerik betiği (izole dünya)
// Sayfaya seçim katmanını (overlay.js, sayfanın kendi dünyasında) yükler, altta kuyruk/Uygula
// çubuğunu gösterir ve arka plan üzerinden VS Code'daki Panoptent ile konuşur.
(() => {
  'use strict';
  if (window.top !== window || window.__panoptentContent) return;
  window.__panoptentContent = true;

  const SRC = 'panoptent';
  const KEY_ON = 'on:' + location.origin;
  const KEY_Q = 'queue:' + location.origin;
  const KEY_UI = 'ui';

  // ---------- durum ----------
  let enabled = false;
  let overlayReady = false;
  let selecting = false;
  let items = [];
  let queue = [];
  let undoStack = [];
  let redoStack = [];
  let running = false;
  let applying = false;
  let popPending = false;
  let pendingApplied = [];
  let canRollback = false;
  let supportKind = '';
  let workspaces = [];
  let activePort = null;
  let pairAsked = false;
  let viewport = 'full';
  let lastTrusted = 0;
  let ui = { popover: true, cont: true, drawer: false, tab: 'queue', min: false };
  let settings = { sendTo: 'claudePanel', openOnSelect: true, claudeExt: true };
  const logs = [];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const baseName = (p) => String(p).split(/[\\/]/).pop();
  let seq = 0;
  const newToken = () => 'k' + Date.now().toString(36) + ++seq;

  // Sayfa betikleri sahte "commit" mesajı üretemesin: yalnızca gerçek kullanıcı etkileşiminden hemen sonra kabul et
  ['pointerdown', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, (e) => { if (e.isTrusted) lastTrusted = Date.now(); }, true),
  );
  const userJustActed = () => Date.now() - lastTrusted < 4000;

  // ---------- arka planla bağlantı ----------
  let port = null;
  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: 'panoptent' });
    } catch (e) {
      return; // eklenti yeniden yüklendi
    }
    port.onMessage.addListener(onBg);
    port.onDisconnect.addListener(() => {
      port = null;
      setTimeout(connectPort, 800);
    });
    if (enabled) bg({ type: 'getState' });
  }
  function bg(m) {
    if (!port) connectPort();
    try { port && port.postMessage(m); } catch (e) { /* yeniden bağlanacak */ }
  }
  connectPort();

  // ---------- seçim katmanı (sayfa dünyası) ile konuşma ----------
  function toOverlay(m) {
    m.source = SRC;
    m.dir = 'down';
    window.postMessage(m, '*');
  }
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const m = e.data;
    if (!m || m.source !== SRC || m.dir !== 'up') return;
    onOverlay(m);
  });

  // ---------- arayüz ----------
  const host = document.createElement('panoptent-ui');
  host.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:2147483646;pointer-events:none;';
  const root = host.attachShadow({ mode: 'open' });
  const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 12S5.8 5.5 12 5.5 21.8 12 21.8 12c-.5.9-1.2 1.9-2.1 2.8"/><path d="M2.2 12s3.6 6.5 9.8 6.5c.6 0 1.2-.05 1.8-.15"/><circle cx="12" cy="12" r="3.1"/><path d="M15.6 15.1l6.1 2.3-2.7 1 2.1 2.1-1.1 1.1-2.1-2.1-1 2.7z" fill="currentColor" stroke="none"/></svg>';
  const SEL = '<svg viewBox="0 0 16 16" width="15" height="15"><path fill="currentColor" d="M2 2h4v1.5H3.5V6H2V2zm8 0h4v4h-1.5V3.5H10V2zM2 10h1.5v2.5H6V14H2v-4zm5.2-2.6 7 2.6-3 1.1 2.3 2.3-1.1 1.1-2.3-2.3-1.1 3-1.8-7.8z"/></svg>';
  const F = 'system-ui,-apple-system,"Segoe UI",sans-serif';
  root.innerHTML = `<style>
    :host{all:initial}*{box-sizing:border-box}[hidden]{display:none!important}
    .wrap{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;font:13px/1.4 ${F};color:#e6e8eb}
    .bar,.drawer,.toast,.mini{pointer-events:auto}
    .bar{display:flex;align-items:center;gap:4px;padding:5px;border-radius:12px;background:#1f2329;border:1px solid #3a3f47;box-shadow:0 12px 32px rgba(0,0,0,.35),0 2px 6px rgba(0,0,0,.2);white-space:nowrap}
    button{all:unset;cursor:pointer;font:inherit}
    .b{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:8px;color:#cbd2da}
    .b:hover:not([disabled]){background:#2c3138;color:#fff}.b[disabled]{opacity:.35;cursor:default}
    .b.logo{padding:0 8px;color:#f97316}
    .b.sel[aria-pressed=true]{background:#f97316;color:#fff}
    .b.pri{background:#f97316;color:#fff;font-weight:600}.b.pri:hover:not([disabled]){background:#ea6a0c}
    .sep{width:1px;height:20px;background:#3a3f47;margin:0 4px}
    .dot{width:8px;height:8px;border-radius:4px;background:#6b7380;flex-shrink:0}
    .dot.ok{background:#22c55e}.dot.wait{background:#f59e0b}.dot.off{background:#ef4444}
    .ws{font-size:11.5px;color:#9aa4b2;max-width:140px;overflow:hidden;text-overflow:ellipsis}
    .qn{display:inline-flex;align-items:center;gap:6px;padding:0 6px 0 4px;color:#e6e8eb}
    .qdot{width:8px;height:8px;border-radius:4px;background:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.25)}
    .drawer{width:380px;max-width:calc(100vw - 24px);max-height:min(60vh,520px);display:flex;flex-direction:column;border-radius:12px;background:#1f2329;border:1px solid #3a3f47;box-shadow:0 12px 32px rgba(0,0,0,.35);overflow:hidden}
    .tabs{display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid #2c3138}
    .tabs button{padding:7px 10px;font-size:12.5px;color:#9aa4b2;border-bottom:2px solid transparent;margin-bottom:-1px}
    .tabs button.on{color:#fff;border-color:#f97316}
    .body{overflow:auto;padding:10px 12px;flex:1}
    .empty{color:#8a93a0;font-size:12.5px;line-height:1.55}
    kbd{font:11px ui-monospace,Menlo,monospace;padding:0 4px;border:1px solid #3a3f47;border-radius:3px;background:#15181c}
    .qi{display:flex;gap:8px;align-items:flex-start;padding:7px 6px 7px 8px;border:1px solid #2f343c;border-radius:7px;margin-bottom:6px;background:#191c21}
    .qk{flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 6px;border-radius:3px;background:#2c3138;margin-top:1px}
    .k-style{color:#a78bfa}.k-text{color:#38bdf8}.k-delete{color:#f87171}.k-image{color:#34d399}.k-prompt{color:#fb923c}
    .qm{flex:1;min-width:0}.qt{font:11.5px ui-monospace,Menlo,monospace;color:#8a93a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .qs{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .vp{font-size:10.5px;color:#fb923c;border:1px solid currentColor;border-radius:3px;padding:0 4px;margin-left:4px}
    .x{width:22px;height:22px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#8a93a0;font-size:15px;flex-shrink:0}.x:hover{background:#2c3138;color:#fff}
    .foot{display:flex;justify-content:flex-end;gap:6px;padding:8px 12px;border-top:1px solid #2c3138}
    .ev{margin-bottom:8px;font-size:12.5px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
    .ev.user{padding:6px 8px;border-radius:6px;background:#15181c;border:1px solid #2c3138}
    .ev.user .meta{display:block;font-size:11px;color:#8a93a0;margin-bottom:2px}
    .ev.tool{font:11.5px ui-monospace,Menlo,monospace;color:#8a93a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px}
    .ev.tool b{color:#e6e8eb;font-weight:500}.ev.tool.edit b{color:#fb923c}
    .ev.done{color:#4ade80}.ev.err{color:#f87171}
    .ev.handoff{border:1px dashed #3a3f47;border-radius:6px;padding:6px 8px}.ev.handoff b{color:#fb923c}
    .ev a{color:#93c5fd;cursor:pointer;font:11.5px ui-monospace,Menlo,monospace}
    .ev code{font:11.5px ui-monospace,Menlo,monospace;background:#15181c;padding:0 3px;border-radius:3px}
    .row{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:12.5px}
    .row label{display:flex;align-items:center;gap:7px;cursor:pointer}
    .row input{accent-color:#f97316;margin:0}
    .lbl{color:#8a93a0;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:4px 0 6px}
    select{all:unset;box-sizing:border-box;height:28px;padding:0 8px;border:1px solid #3a3f47;border-radius:6px;background:#15181c;color:#e6e8eb;cursor:pointer;flex:1;font-size:12.5px}
    .card{padding:8px 10px;border-radius:8px;border:1px solid #2f343c;background:#191c21;margin-bottom:10px;font-size:12.5px;line-height:1.5}
    .card.warn{border-color:rgba(245,158,11,.5);background:rgba(245,158,11,.08)}
    .card.ok{border-color:rgba(34,197,94,.45)}
    .link{color:#93c5fd;text-decoration:underline;cursor:pointer}
    .btn2{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:6px;background:#2c3138;color:#e6e8eb;font-size:12.5px}
    .btn2:hover{background:#363c44}
    .toast{max-width:min(520px,calc(100vw - 24px));padding:8px 12px;border-radius:9px;background:#1f2329;border:1px solid #3a3f47;box-shadow:0 8px 24px rgba(0,0,0,.3);font-size:12.5px}
    .toast.ok{border-color:rgba(34,197,94,.5)}.toast.err{border-color:rgba(239,68,68,.6);color:#fca5a5}
    .mini{position:fixed;right:16px;bottom:16px;width:40px;height:40px;border-radius:20px;background:#1f2329;border:1px solid #3a3f47;color:#f97316;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.35)}
    .mini .n{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;background:#f97316;color:#fff;font:700 10px/16px ${F};text-align:center;padding:0 4px}
    .spin{width:12px;height:12px;border-radius:50%;border:2px solid #3a3f47;border-top-color:#f97316;animation:r .8s linear infinite;display:inline-block;vertical-align:-2px;margin-right:6px}
    @keyframes r{to{transform:rotate(360deg)}}
  </style>
  <div class="wrap" id="wrap">
    <div id="toasts"></div>
    <div class="drawer" id="drawer" hidden>
      <div class="tabs"><button data-tab="queue">Kuyruk</button><button data-tab="log">Etkinlik</button><button data-tab="settings">Ayarlar</button></div>
      <div class="body" id="dbody"></div>
      <div class="foot" id="dfoot"></div>
    </div>
    <div class="bar" id="bar">
      <button class="b logo" id="logo" title="Panoptent — paneli aç/kapat">${EYE}</button>
      <span class="dot" id="dot"></span><span class="ws" id="ws">VS Code aranıyor…</span>
      <span class="sep"></span>
      <button class="b sel" id="sel" aria-pressed="false" title="Seçim modu (Alt+Shift+E) — Alt basılıyken tıklayarak da seçebilirsin">${SEL}<span>Seç</span></button>
      <span class="sep" id="qsep" hidden></span>
      <span class="qn" id="qn" hidden><span class="qdot"></span><b id="qc">0</b> değişiklik</span>
      <button class="b" id="undo" title="Geri al (Ctrl/Cmd+Z)" hidden>↶</button>
      <button class="b" id="redo" title="Yinele (Ctrl/Cmd+Shift+Z)" hidden>↷</button>
      <button class="b" id="list" hidden>Listele</button>
      <button class="b pri" id="apply" hidden>Uygula</button>
      <span class="sep" id="rsep" hidden></span>
      <button class="b" id="rollback" hidden title="Son uygulamada yalnızca Panoptent'in yaptığı değişiklikleri geri al">↶ Son uygulamayı geri al</button>
      <span class="sep"></span>
      <button class="b" id="gear" title="Ayarlar">⚙</button>
      <button class="b" id="minBtn" title="Küçült">–</button>
    </div>
  </div>
  <button class="mini" id="mini" hidden title="Panoptent">${EYE}<span class="n" id="miniN" hidden>0</span></button>`;
  const $ = (id) => root.getElementById(id);
  const wrap = $('wrap'), bar = $('bar'), drawer = $('drawer'), dbody = $('dbody'), dfoot = $('dfoot'), toasts = $('toasts');

  function mountUI() {
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  function toast(text, kind, ms) {
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.innerHTML = text;
    toasts.appendChild(d);
    setTimeout(() => d.remove(), ms || 3500);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }

  // ---------- kalıcılık ----------
  function saveQueue() {
    const slim = queue.map((en) => (en.dataUrl && en.dataUrl.length > 2e6 ? Object.assign({}, en, { dataUrl: undefined }) : en));
    chrome.storage.local.set({ [KEY_Q]: slim });
  }
  function saveUi() {
    chrome.storage.local.set({ [KEY_UI]: { popover: ui.popover, cont: ui.cont, min: ui.min } });
  }

  // ---------- etkinleştirme ----------
  function enable(persist) {
    if (enabled) return;
    enabled = true;
    if (persist) chrome.storage.local.set({ [KEY_ON]: true });
    document.documentElement.setAttribute('data-panoptent-host', 'chrome');
    mountUI();
    if (!document.querySelector('panoptent-overlay')) bg({ type: 'injectOverlay' });
    else toOverlay({ type: 'config', active: true });
    bg({ type: 'getState' });
    render();
    sendConfig();
  }
  function disable() {
    if (!enabled) return;
    enabled = false;
    chrome.storage.local.remove(KEY_ON);
    setSelect(false);
    toOverlay({ type: 'config', active: false });
    if (queue.length) toOverlay({ type: 'revert', tokens: queue.map((x) => x.token) });
    host.remove();
  }

  chrome.storage.local.get([KEY_ON, KEY_Q, KEY_UI], (o) => {
    if (Array.isArray(o[KEY_Q])) queue = o[KEY_Q];
    if (o[KEY_UI]) Object.assign(ui, o[KEY_UI]);
    if (o[KEY_ON]) enable(false);
  });

  // ---------- seçim modu ----------
  function setSelect(on) {
    selecting = !!on;
    $('sel').setAttribute('aria-pressed', String(selecting));
    toOverlay({ type: 'mode', on: selecting });
  }
  $('sel').addEventListener('click', () => setSelect(!selecting));

  function sendConfig() {
    const w = window.innerWidth;
    viewport = w <= 480 ? '390' : w <= 1100 ? '1024' : 'full';
    toOverlay({ type: 'config', active: enabled, popover: ui.popover, viewport, nowLabel: settings.sendTo === 'cli' ? 'Hemen çalıştır' : 'Hemen aktar' });
  }
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(sendConfig, 200); });

  // ---------- kuyruk ----------
  const KIND = { prompt: 'İstek', style: 'Stil', text: 'Metin', delete: 'Sil', image: 'Görsel' };
  const VP = { '390': 'mobil', '1024': 'tablet' };
  function targetLabel(en) {
    const it = (en.items || [])[0];
    if (!it) return 'Tüm sayfa';
    const cls = it.classes ? '.' + it.classes.trim().split(/\s+/)[0] : '';
    const loc = it.source ? ' · ' + baseName(it.source.file) + (it.source.line ? ':' + it.source.line : '') : '';
    return `<${it.tag}${cls}>${loc}${en.items.length > 1 ? ` +${en.items.length - 1}` : ''}`;
  }
  function summary(en) {
    switch (en.kind) {
      case 'prompt': return en.text;
      case 'text': return `“${en.from}” → “${en.to}”`;
      case 'delete': return 'Öğeyi kaldır';
      case 'image': return en.fileName ? `Yeni görsel: ${en.fileName}` : `Yeni görsel: ${en.url}`;
      case 'style': {
        const parts = Object.keys(en.diffs || {}).map((k) => `${k}: ${en.diffs[k].to}`);
        if (en.classes) parts.push(`+ ${en.classes}`);
        return parts.join(' · ');
      }
    }
    return '';
  }
  function qAdd(entries) {
    queue = queue.concat(entries);
    undoStack.push({ op: 'add', entries });
    redoStack = [];
    saveQueue();
    render();
  }
  function qRemove(token) {
    const i = queue.findIndex((x) => x.token === token);
    if (i === -1) return;
    const en = queue.splice(i, 1)[0];
    toOverlay({ type: 'revert', tokens: [token] });
    undoStack.push({ op: 'remove', entries: [en], index: i });
    redoStack = [];
    saveQueue();
    render();
  }
  function qClear() {
    if (!queue.length) return;
    const entries = queue;
    queue = [];
    toOverlay({ type: 'revert', tokens: entries.map((x) => x.token) });
    undoStack.push({ op: 'clear', entries });
    redoStack = [];
    saveQueue();
    render();
  }
  function invert(step, isUndo) {
    const tokens = step.entries.map((x) => x.token);
    if ((step.op === 'add') === isUndo) {
      queue = queue.filter((x) => tokens.indexOf(x.token) === -1);
      toOverlay({ type: 'revert', tokens });
    } else {
      if (step.op === 'remove' && typeof step.index === 'number') queue.splice(step.index, 0, ...step.entries);
      else queue = queue.concat(step.entries);
      toOverlay({ type: 'reapply', entries: step.entries });
    }
  }
  function undo() { const s = undoStack.pop(); if (!s) return; invert(s, true); redoStack.push(s); saveQueue(); render(); }
  function redo() { const s = redoStack.pop(); if (!s) return; invert(s, false); undoStack.push(s); saveQueue(); render(); }

  $('undo').addEventListener('click', undo);
  $('redo').addEventListener('click', redo);
  $('apply').addEventListener('click', () => applyQueue());
  $('list').addEventListener('click', () => openDrawer('queue'));
  $('rollback').addEventListener('click', () => {
    if (!connected()) return toast('VS Code’a bağlı değil.', 'err');
    bg({ type: 'rollback' });
    toast('Onay penceresi VS Code’da açıldı.', '', 2500);
  });
  $('logo').addEventListener('click', () => (ui.drawer ? closeDrawer() : openDrawer(ui.tab)));
  $('gear').addEventListener('click', () => openDrawer('settings'));
  $('minBtn').addEventListener('click', () => { ui.min = true; saveUi(); closeDrawer(); render(); });
  $('mini').addEventListener('click', () => { ui.min = false; saveUi(); render(); });
  root.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.tab)));

  function connected() {
    return !!(activePort && workspaces.find((w) => w.port === activePort && w.state === 'ready'));
  }

  function applyQueue() {
    if (!queue.length) return;
    dispatch(queue.slice(), true);
  }
  function dispatch(entries, fromQueue) {
    if (!connected()) {
      toast('VS Code’a bağlı değil. VS Code’da proje açık ve Panoptent kurulu olmalı.', 'err', 5000);
      if (popPending) { popPending = false; popStatus('err', 'VS Code’a bağlı değil'); }
      return false;
    }
    if (running || applying) {
      toast('Önceki işlem hâlâ sürüyor.', 'err');
      if (popPending) { popPending = false; popStatus('err', 'Önceki işlem hâlâ sürüyor.'); }
      return false;
    }
    applying = true;
    const lines = entries.map((en) => `• ${KIND[en.kind]}: ${summary(en)}`).join('\n');
    addLog('user', `<span class="meta">${fromQueue ? `Kuyruk · ${entries.length} değişiklik` : 'Hızlı kutu'}</span>${esc(lines)}`);
    bg({ type: 'applyEntries', entries, fromQueue, pageUrl: location.href, continueSession: settings.sendTo === 'claudePanel' ? ui.cont : false });
    render();
    return true;
  }

  // ---------- çekmece ----------
  function openDrawer(tab) {
    ui.drawer = true;
    ui.tab = tab || ui.tab;
    if (ui.min) ui.min = false;
    render();
  }
  function closeDrawer() { ui.drawer = false; render(); }

  function addLog(cls, html) {
    logs.push({ cls, html });
    if (logs.length > 120) logs.shift();
    if (ui.drawer && ui.tab === 'log') renderDrawer();
  }
  const mdLite = (s) => esc(s).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  const TOOL_TR = { Edit: '✎ Düzenledi', MultiEdit: '✎ Düzenledi', Write: '✎ Yazdı', Read: '◦ Okudu', Grep: '⌕ Aradı', Glob: '⌕ Dosya aradı', Bash: '$ Komut' };

  function renderDrawer() {
    root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
    dfoot.innerHTML = '';
    if (ui.tab === 'queue') {
      dbody.innerHTML = queue.length
        ? queue.map((en) => `<div class="qi" data-token="${esc(en.token)}"><span class="qk k-${esc(en.kind)}">${esc(KIND[en.kind] || en.kind)}</span>
            <div class="qm"><div class="qt">${esc(targetLabel(en))}${en.viewportOnly ? `<span class="vp">${esc(VP[en.viewportOnly] || en.viewportOnly)}</span>` : ''}</div>
            <div class="qs" title="${esc(summary(en))}">${esc(summary(en))}</div></div><button class="x" data-del>×</button></div>`).join('')
        : `<div class="empty"><b>Seç</b>'e bas (veya <kbd>Alt</kbd> basılıyken tıkla) ve sayfada bir öğeye tıkla. Yanında açılan kutudan istek yazabilir, stilini değiştirebilir, metnine çift tıklayıp düzenleyebilir ya da silebilirsin. <kbd>Ctrl/⌘+Enter</kbd> kuyruğa ekler, <kbd>Ctrl/⌘+Shift+Enter</kbd> hemen gönderir.</div>`;
      if (queue.length) {
        dfoot.innerHTML = '<button class="btn2" id="dclear">Temizle</button><button class="b pri" id="dapply">Hepsini uygula</button>';
        root.getElementById('dclear').addEventListener('click', qClear);
        root.getElementById('dapply').addEventListener('click', () => applyQueue());
      }
      dbody.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => qRemove(b.closest('.qi').dataset.token)));
    } else if (ui.tab === 'log') {
      dbody.innerHTML = logs.length ? logs.map((l) => `<div class="ev ${l.cls}">${l.html}</div>`).join('') + (running ? '<div class="ev"><span class="spin"></span>Claude çalışıyor…</div>' : '') : '<div class="empty">Henüz bir şey yok.</div>';
      dbody.querySelectorAll('[data-file]').forEach((a) => a.addEventListener('click', () => bg({ type: 'openFile', file: a.dataset.file })));
      dbody.scrollTop = dbody.scrollHeight;
      if (running) {
        dfoot.innerHTML = '<button class="btn2" id="dstop">Durdur</button>';
        root.getElementById('dstop').addEventListener('click', () => bg({ type: 'stop' }));
      }
    } else {
      const ready = workspaces.filter((w) => w.state === 'ready');
      const waiting = workspaces.filter((w) => w.state === 'needPair' || w.state === 'pairing');
      let conn;
      if (connected()) {
        conn = `<div class="card ok">✓ VS Code’a bağlı: <b>${esc((workspaces.find((w) => w.port === activePort) || {}).name)}</b></div>`;
      } else if (waiting.length) {
        conn = `<div class="card warn">VS Code’daki <b>${esc(waiting[0].name)}</b> penceresi bulundu. ${waiting.some((w) => w.state === 'pairing') ? 'VS Code’da çıkan pencerede <b>İzin ver</b>’e bas.' : '<span class="link" id="pairBtn">Bağlan</span>'}</div>`;
      } else {
        conn = '<div class="card warn">VS Code bulunamadı. Projen VS Code’da açık ve <b>Panoptent</b> eklentisi kurulu olmalı.</div>';
      }
      const wsSel = ready.length > 1
        ? `<div class="lbl">Çalışma alanı</div><div class="row"><select id="wsSel">${ready.map((w) => `<option value="${w.port}" ${w.port === activePort ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>`
        : '';
      const src = supportKind === 'code-inspector' || supportKind === 'react'
        ? '<div class="card ok">✓ Kaynak eşleştirme aktif: öğeler dosya ve satıra bağlanıyor.</div>'
        : `<div class="card warn">Kaynak eşleştirme yok; Claude öğeyi arayarak bulur. <span class="link" id="ciBtn">code-inspector’ı otomatik kur</span></div>`;
      dbody.innerHTML = conn + wsSel + `
        <div class="lbl">İstek nereye gitsin</div>
        <div class="row"><select id="sendTo"><option value="claudePanel">VS Code’daki Claude Code paneli</option><option value="cli">Arka planda (Claude Code CLI)</option></select></div>
        <div class="row"><label><input type="checkbox" id="cont"> Açık Claude Code konuşmasına ekle</label></div>
        <div class="row"><label><input type="checkbox" id="pop"> Seçince öğenin yanında kutu aç</label></div>
        <div class="row"><label><input type="checkbox" id="openSrc"> Seçince kodunu VS Code’da aç</label></div>
        <div class="lbl">Kaynak eşleştirme</div>${src}
        <div class="row"><span class="link" id="offBtn">Bu sitede Panoptent’i kapat</span></div>`;
      const g = (id) => root.getElementById(id);
      g('sendTo').value = settings.sendTo;
      g('cont').checked = ui.cont;
      g('cont').disabled = settings.sendTo !== 'claudePanel';
      g('pop').checked = ui.popover;
      g('openSrc').checked = settings.openOnSelect;
      g('sendTo').addEventListener('change', (e) => { settings.sendTo = e.target.value; bg({ type: 'setSendTo', value: settings.sendTo }); sendConfig(); renderDrawer(); });
      g('cont').addEventListener('change', (e) => { ui.cont = e.target.checked; saveUi(); });
      g('pop').addEventListener('change', (e) => { ui.popover = e.target.checked; saveUi(); sendConfig(); });
      g('openSrc').addEventListener('change', (e) => { settings.openOnSelect = e.target.checked; bg({ type: 'setOpenOnSelect', value: settings.openOnSelect }); });
      g('offBtn').addEventListener('click', disable);
      if (g('pairBtn')) g('pairBtn').addEventListener('click', () => { pairAsked = true; bg({ type: 'pair' }); toast('VS Code’da çıkan pencerede <b>İzin ver</b>’e bas.', '', 5000); });
      if (g('ciBtn')) g('ciBtn').addEventListener('click', () => { if (!connected()) return toast('Önce VS Code’a bağlan.', 'err'); bg({ type: 'setupCodeInspector' }); toast('Kurulum VS Code’da başladı.', 'ok'); });
      if (g('wsSel')) g('wsSel').addEventListener('change', (e) => bg({ type: 'chooseWorkspace', port: Number(e.target.value) }));
    }
  }

  function render() {
    if (!enabled) return;
    mountUI();
    const n = queue.length;
    const w = workspaces.find((x) => x.port === activePort);
    const dot = $('dot');
    if (connected()) { dot.className = 'dot ok'; $('ws').textContent = w.name; }
    else if (workspaces.some((x) => x.state === 'pairing' || x.state === 'needPair')) { dot.className = 'dot wait'; $('ws').textContent = 'Eşleştirme bekliyor'; }
    else { dot.className = 'dot off'; $('ws').textContent = 'VS Code bulunamadı'; }
    $('qsep').hidden = $('qn').hidden = $('list').hidden = $('apply').hidden = !n;
    $('undo').hidden = !n && !undoStack.length;
    $('redo').hidden = !n && !redoStack.length;
    $('undo').disabled = !undoStack.length;
    $('redo').disabled = !redoStack.length;
    $('qc').textContent = String(n);
    $('apply').disabled = applying || running;
    $('apply').textContent = applying ? 'Uygulanıyor…' : running ? 'Claude çalışıyor…' : `Uygula (${n})`;
    $('rollback').hidden = $('rsep').hidden = !canRollback;
    drawer.hidden = !ui.drawer;
    bar.hidden = ui.min;
    $('mini').hidden = !ui.min;
    $('miniN').hidden = !n;
    $('miniN').textContent = String(n);
    if (ui.drawer) renderDrawer();
  }

  // ---------- kısayollar ----------
  document.addEventListener('keydown', (e) => {
    if (!enabled) return;
    const t = e.composedPath ? e.composedPath()[0] : e.target;
    const inField = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    if (!inField && mod && e.key.toLowerCase() === 'z' && (undoStack.length || redoStack.length)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) redo(); else undo();
    }
  }, true);

  // ---------- seçim katmanından gelenler ----------
  function popStatus(state, text, closeAfter) { toOverlay({ type: 'popStatus', state, text, closeAfter }); }

  function onOverlay(m) {
    if (!enabled) return;
    switch (m.type) {
      case 'ready':
        overlayReady = true;
        supportKind = m.support;
        items = [];
        sendConfig();
        if (selecting) toOverlay({ type: 'mode', on: true });
        if (queue.length) toOverlay({ type: 'reapply', entries: queue });
        render();
        break;
      case 'mode':
        selecting = m.on;
        $('sel').setAttribute('aria-pressed', String(selecting));
        break;
      case 'select':
        items = m.additive ? items.concat(m.item) : [m.item];
        if (m.item.source) {
          bg({ type: 'hint', file: m.item.source.file });
          if (!m.additive && settings.openOnSelect && connected()) bg({ type: 'openSource', item: m.item, quiet: true });
        }
        break;
      case 'replace': {
        const i = items.findIndex((x) => x.id === m.oldId);
        if (i !== -1) items[i] = m.item;
        if (m.nav && settings.openOnSelect && m.item.source && connected()) bg({ type: 'openSource', item: m.item, quiet: true });
        break;
      }
      case 'unselect':
        items = items.filter((x) => x.id !== m.id);
        break;
      case 'commit':
        if (!userJustActed()) return; // sayfa betiklerinden gelen sahte istekleri yok say
        if (m.mode === 'queue') {
          qAdd(m.entries);
          popStatus('ok', `Kuyruğa eklendi · toplam ${queue.length}`, 1100);
        } else {
          popPending = true;
          if (!dispatch(m.entries, false)) toOverlay({ type: 'revert', tokens: m.entries.map((x) => x.token) });
        }
        break;
      case 'openSourceReq':
        if (!userJustActed()) return;
        if (connected()) bg({ type: 'openSource', item: m.item, quiet: false });
        else toast('VS Code’a bağlı değil.', 'err');
        break;
    }
  }

  // ---------- arka plandan (VS Code) gelenler ----------
  function onBg(m) {
    switch (m.type) {
      case 'status': {
        workspaces = m.workspaces || [];
        activePort = m.active;
        if (enabled && !connected() && !pairAsked && workspaces.some((w) => w.state === 'needPair')) {
          pairAsked = true;
          bg({ type: 'pair' });
          toast('VS Code bağlantı izni istiyor: VS Code’da çıkan pencerede <b>İzin ver</b>’e bas.', '', 7000);
        }
        render();
        break;
      }
      case 'welcome':
        settings.sendTo = m.sendTo || settings.sendTo;
        settings.openOnSelect = m.openOnSelect !== false;
        settings.claudeExt = m.claudeExt !== false;
        canRollback = !!m.canRollback;
        sendConfig();
        render();
        break;
      case 'toggleEnabled':
        if (enabled) disable(); else enable(true);
        break;
      case 'toggleSelect':
        if (!enabled) enable(true);
        setSelect(!selecting);
        break;
      case 'toast':
        toast(esc(m.text), m.kind);
        break;
      case 'notConnected':
        applying = false;
        if (m.for === 'applyEntries') {
          toast('VS Code’a bağlı değil; değişiklikler kuyrukta bekliyor.', 'err', 5000);
          if (popPending) { popPending = false; popStatus('err', 'VS Code’a bağlı değil'); }
        }
        render();
        break;
      case 'sendTo':
        settings.sendTo = m.value;
        sendConfig();
        render();
        break;
      case 'openOnSelect':
        settings.openOnSelect = !!m.value;
        render();
        break;
      case 'checkpointState':
        canRollback = !!m.canRollback;
        render();
        break;
      case 'note':
        addLog('user', `<span class="meta">Otomatik</span>${esc(m.text)}`);
        break;
      case 'applied': {
        applying = false;
        const tokens = m.tokens || [];
        if (m.fromQueue && m.ok) {
          queue = queue.filter((x) => tokens.indexOf(x.token) === -1);
          undoStack = [];
          redoStack = [];
          saveQueue();
        }
        if (m.ok) pendingApplied = pendingApplied.concat(tokens);
        if (typeof m.canRollback === 'boolean') canRollback = m.canRollback;
        if (m.direct) addLog('done', `✓ ${m.direct} metin değişikliği AI kullanmadan doğrudan dosyaya yazıldı.`);
        if (m.ok && !m.sent) {
          toast('✓ Doğrudan dosyaya yazıldı', 'ok');
          if (popPending) { popPending = false; popStatus('ok', 'Doğrudan dosyaya yazıldı', 1600); }
        }
        if (!m.ok) {
          if (!m.reported) addLog('err', esc(m.message || 'Uygulanamadı.'));
          toast(esc(m.message || 'Uygulanamadı.'), 'err', 5000);
          if (popPending) { popPending = false; popStatus('err', m.message || 'Uygulanamadı.'); }
        }
        render();
        break;
      }
      case 'handoff': {
        const msgs = {
          mention: ['Claude Code konuşmana eklendi — VS Code’da Enter’a bas', 'İstek, VS Code’daki açık Claude Code konuşmasına eklendi. Orada <b>Enter</b>’a bas; değişiklikler bu sayfaya otomatik yansır.'],
          clipboard: ['Panoya kopyalandı — Claude Code kutusuna yapıştır', 'İstem <b>panoya kopyalandı</b>; VS Code’daki Claude Code kutusuna yapıştırıp <b>Enter</b>’a bas.'],
          newTab: ['VS Code’da yeni Claude Code sekmesinde açıldı — Enter’a bas', 'İstem VS Code’da yeni bir Claude Code sekmesinde hazır; <b>Enter</b>’a bas.'],
        };
        const t = msgs[m.how] || msgs.newTab;
        if (popPending) { popPending = false; popStatus(m.ok ? 'ok' : 'err', m.ok ? t[0] : 'Claude Code paneli açılamadı', 2600); }
        if (m.ok) {
          addLog('handoff', '<b>→ Claude Code.</b> ' + t[1]);
          toast('→ ' + t[0], 'ok', 4000);
        } else addLog('err', 'Claude Code paneli açılamadı.');
        break;
      }
      case 'claude': {
        const ev = m.ev;
        if (ev.kind === 'start') { running = true; if (popPending) popStatus('busy', 'Claude çalışıyor…'); }
        else if (ev.kind === 'text') addLog('text', mdLite(ev.text));
        else if (ev.kind === 'tool') addLog('tool' + (/Edit|Write/.test(ev.name) ? ' edit' : ''), `<b>${esc(TOOL_TR[ev.name] || ev.name)}</b> ${esc(ev.detail)}`);
        else if (ev.kind === 'done') {
          running = false;
          const files = (ev.edited || []).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ');
          if (ev.ok) addLog('done', `✓ Tamamlandı${files ? '\nDeğişen: ' + files : ' · dosya değişmedi'}`);
          else addLog('err', 'Claude işi bitiremedi.');
          if (popPending) { popPending = false; popStatus(ev.ok ? 'ok' : 'err', ev.ok ? 'Tamamlandı' : 'Claude işi bitiremedi', 2500); }
          toast(ev.ok ? '✓ Claude tamamladı' : 'Claude işi bitiremedi', ev.ok ? 'ok' : 'err');
        } else if (ev.kind === 'error') {
          running = false;
          addLog('err', esc(ev.message));
          if (popPending) { popPending = false; popStatus('err', ev.message.split('\n')[0]); }
        }
        render();
        break;
      }
      case 'filesChanged':
        if (m.files && m.files.length) {
          addLog('tool edit', `<b>✎ Değişti</b> ${m.files.slice(0, 4).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ')}`);
        }
        if (supportKind === 'none') {
          // hot reload olmayan sayfa: kuyruk korunur, önizleme yeniden uygulanır
          pendingApplied = [];
          setTimeout(() => location.reload(), 400);
        } else if (pendingApplied.length) {
          const toks = pendingApplied;
          pendingApplied = [];
          setTimeout(() => toOverlay({ type: 'revert', tokens: toks }), 1500);
          setTimeout(() => toOverlay({ type: 'refresh' }), 1800);
        }
        break;
      case 'rollbackResult':
        canRollback = !!m.canRollback;
        if (m.ok) {
          addLog('done', `↶ Panoptent’in değişiklikleri geri alındı: ${(m.files || []).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ')}`);
          toast('↶ Geri alındı', 'ok');
        } else if (m.message) {
          addLog('err', esc(m.message));
          toast(esc(m.message), 'err', 5000);
        }
        if (m.conflicts && m.conflicts.length) addLog('err', 'Dokunulmadı:\n' + m.conflicts.map(esc).join('\n'));
        render();
        break;
      case 'quickEditResult':
        break;
    }
  }
})();
