// Panoptent paneli (VS Code webview tarafı)
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();
  const $ = (s) => document.querySelector(s);

  const frame = $('#frame');
  const frameWrap = $('#frameWrap');
  const urlInput = $('#urlInput');
  const selBtn = $('#selBtn');
  const itemsEl = $('#items');
  const promptEl = $('#prompt');
  const sendBtn = $('#sendBtn');
  const queueBtn = $('#queueBtn');
  const stopBtn = $('#stopBtn');
  const logEl = $('#log');
  const supportEl = $('#support');
  const clearBtn = $('#clearBtn');
  const contWrap = $('#contWrap');
  const contChk = $('#cont');
  const newSessBtn = $('#newSess');
  const sendToSel = $('#sendTo');
  const contLabel = $('#contLabel');
  const qbar = $('#qbar');
  const qcount = $('#qcount');
  const qinfo = $('#qinfo');
  const qUndo = $('#qUndo');
  const qRedo = $('#qRedo');
  const qList = $('#qList');
  const qClear = $('#qClear');
  const qApply = $('#qApply');
  const qRollback = $('#qRollback');
  const qsep = $('#qsep');
  const queueEl = $('#queue');
  const queueHead = $('#queueHead');

  let sendTo = 'claudePanel';
  let claudeExt = true;
  let lastHandoff = 0;
  let proxyBase = '';
  let target = '';
  let items = [];
  let selecting = false;
  let running = false;
  let applying = false;
  let sessionId = null;
  let pageHref = '';
  let workingEl = null;
  let sawText = false;
  let supportKind = '';
  let viewport = 'full';
  let canRollback = false;
  let popPending = false;
  let pendingApplied = []; // dosyalar değişince önizlemeden kaldırılacak işlemler
  const qeState = {};

  const saved = vscode.getState() || {};
  let queue = Array.isArray(saved.queue) ? saved.queue : [];
  let undoStack = [];
  let redoStack = [];

  // ---------- yardımcılar ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const baseName = (p) => String(p).split(/[\\/]/).pop();
  let seq = 0;
  const newToken = () => 'p' + Date.now().toString(36) + (++seq);

  function toFrame(msg) {
    msg.source = 'panoptent';
    try { frame.contentWindow.postMessage(msg, '*'); } catch (e) { /* yok say */ }
  }
  function persist(patch) {
    vscode.setState(Object.assign({}, vscode.getState() || {}, patch));
  }
  function proxyUrl(p) {
    if (!p || p[0] !== '/') p = '/' + (p || '');
    return proxyBase.replace(/\/$/, '') + p;
  }
  function displayUrl(href) {
    try {
      const u = new URL(href);
      return target + u.pathname + u.search + u.hash;
    } catch (e) {
      return href;
    }
  }
  function navigate(p) { frame.src = proxyUrl(p); }
  function reloadFrame() { try { frame.contentWindow.location.reload(); } catch (e) { frame.src = frame.src; } }

  // ---------- seçim modu ----------
  function setSelect(on) {
    selecting = !!on;
    selBtn.setAttribute('aria-pressed', String(selecting));
    frameWrap.classList.toggle('selecting', selecting);
    toFrame({ type: 'mode', on: selecting });
  }
  selBtn.addEventListener('click', () => setSelect(!selecting));

  // ---------- adres çubuğu ----------
  urlInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const v = urlInput.value.trim();
    if (!v) return;
    if (v[0] === '/') return navigate(v);
    let u;
    try { u = new URL(/^https?:\/\//.test(v) ? v : 'http://' + v); } catch (err) { return; }
    if (u.origin === target) navigate(u.pathname + u.search + u.hash);
    else vscode.postMessage({ type: 'setTarget', url: u.toString() });
  });
  $('#reloadBtn').addEventListener('click', reloadFrame);

  // ---------- panel yerleşimi: sol / sağ / alt, aç-kapa, boyut ----------
  const mainEl = $('#main');
  const sideEl = $('#side');
  const splitter = $('#splitter');
  const sideToggle = $('#sideToggle');
  const selCount = $('#selCount');
  const popChk = $('#popChk');
  const openSrcChk = $('#openSrcChk');
  let openOnSelect = true;
  openSrcChk.addEventListener('change', () => {
    openOnSelect = openSrcChk.checked;
    vscode.postMessage({ type: 'setOpenOnSelect', value: openOnSelect });
  });
  function revealSource(item) {
    if (openOnSelect && item && item.source) vscode.postMessage({ type: 'openSource', item, quiet: true });
  }
  let layout = Object.assign({ dock: 'right', collapsed: false, w: 340, h: 280, popover: true }, saved.layout || {});

  function applyLayout(save) {
    mainEl.classList.remove('dock-left', 'dock-right', 'dock-bottom');
    mainEl.classList.add('dock-' + layout.dock);
    mainEl.classList.toggle('collapsed', layout.collapsed);
    sideEl.style.setProperty('--side-w', layout.w + 'px');
    sideEl.style.setProperty('--side-h', layout.h + 'px');
    document.querySelectorAll('[data-dock]').forEach((b) => b.classList.toggle('on', b.dataset.dock === layout.dock));
    sideToggle.setAttribute('aria-pressed', String(!layout.collapsed));
    sideToggle.title = layout.collapsed ? 'Paneli göster' : 'Paneli gizle';
    popChk.checked = layout.popover;
    if (save) {
      persist({ layout });
      vscode.postMessage({ type: 'saveLayout', layout });
    }
  }
  document.querySelectorAll('[data-dock]').forEach((b) =>
    b.addEventListener('click', () => {
      layout.dock = b.dataset.dock;
      layout.collapsed = false;
      applyLayout(true);
    }),
  );
  sideToggle.addEventListener('click', () => {
    layout.collapsed = !layout.collapsed;
    applyLayout(true);
  });
  popChk.addEventListener('change', () => {
    layout.popover = popChk.checked;
    applyLayout(true);
    sendFrameConfig();
  });
  splitter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitter.setPointerCapture(e.pointerId);
    mainEl.classList.add('dragging');
    const rect = mainEl.getBoundingClientRect();
    const move = (ev) => {
      if (layout.dock === 'bottom') layout.h = Math.round(Math.max(140, Math.min(rect.height * 0.75, rect.bottom - ev.clientY)));
      else if (layout.dock === 'left') layout.w = Math.round(Math.max(240, Math.min(rect.width * 0.7, ev.clientX - rect.left)));
      else layout.w = Math.round(Math.max(240, Math.min(rect.width * 0.7, rect.right - ev.clientX)));
      applyLayout(false);
    };
    const up = () => {
      mainEl.classList.remove('dragging');
      splitter.removeEventListener('pointermove', move);
      splitter.removeEventListener('pointerup', up);
      applyLayout(true);
    };
    splitter.addEventListener('pointermove', move);
    splitter.addEventListener('pointerup', up);
  });
  splitter.addEventListener('dblclick', () => {
    layout.collapsed = true;
    applyLayout(true);
  });
  applyLayout(false);

  // ---------- ekran genişliği ----------
  document.querySelectorAll('[data-vp]').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-vp]').forEach((x) => x.classList.toggle('on', x === b));
      viewport = b.dataset.vp;
      if (viewport === 'full') {
        frameWrap.style.width = '100%';
        frameWrap.classList.remove('narrow');
      } else {
        frameWrap.style.width = viewport + 'px';
        frameWrap.classList.add('narrow');
      }
      sendFrameConfig();
    });
  });

  // ---------- kaynak eşleştirme durumu ----------
  function showSupport(kind) {
    supportKind = kind;
    supportEl.hidden = false;
    const guide = ' <button class="link" data-auto>Otomatik kur</button> · <button class="link" data-guide>Rehber</button>';
    if (kind === 'code-inspector') {
      supportEl.className = 'support ok';
      supportEl.innerHTML = '✓ Kaynak eşleştirme aktif: öğeler dosya ve satıra bağlanıyor.';
    } else if (kind === 'react') {
      supportEl.className = 'support ok';
      supportEl.innerHTML = '✓ React geliştirme modu kaynak bilgisi kullanılıyor.';
    } else if (kind === 'vue') {
      supportEl.className = 'support warn';
      supportEl.innerHTML = 'Vue bileşen dosyası bulunuyor ama satır bilinmiyor. Kesin satır için code-inspector-plugin ekle.' + guide;
    } else {
      supportEl.className = 'support warn';
      supportEl.innerHTML = 'Kaynak eşleştirme yok: Claude öğeyi metin ve sınıflardan arayarak bulacak (daha yavaş). Projeye code-inspector-plugin eklersen tam satıra gider.' + guide;
    }
    const g = supportEl.querySelector('[data-guide]');
    if (g) g.addEventListener('click', () => vscode.postMessage({ type: 'setupGuide' }));
    const a = supportEl.querySelector('[data-auto]');
    if (a) a.addEventListener('click', () => vscode.postMessage({ type: 'setupCodeInspector' }));
  }

  // ---------- seçilenler ----------
  function srcHtml(it) {
    if (it.source) {
      const loc = it.source.line ? ':' + it.source.line : '';
      return `<a data-act="open" title="${esc(it.source.file)}">${esc(baseName(it.source.file))}${loc}</a>` +
        (it.source.exact ? '' : ` <span class="dim">(${it.source.via === 'vue' ? 'bileşen' : 'yakın konum'})</span>`);
    }
    if (it.components && it.components.length) return `<span class="dim">Bileşen: ${esc(it.components[0])}</span>`;
    return '<span class="warn">Kaynak bilinmiyor</span>';
  }

  function renderItems() {
    clearBtn.hidden = !items.length;
    selCount.hidden = !items.length && !queue.length;
    selCount.textContent = String(queue.length || items.length);
    selCount.classList.toggle('q', !!queue.length);
    if (!items.length) {
      itemsEl.innerHTML =
        '<div class="empty"><b>Seç</b> modunu aç ve önizlemede bir öğeye tıkla; yanında açılan kutudan istek yazabilir, stilini değiştirebilir, metnini düzenleyebilir ya da silebilirsin.<br>' +
        '<kbd>Shift</kbd> birden çok öğe, <kbd>Alt</kbd> modu açmadan seçim, <kbd>Alt</kbd>+oklar üst/alt öğe.</div>';
      return;
    }
    itemsEl.innerHTML = items.map((it, i) => {
      const cls = it.classes ? '.' + it.classes.trim().split(/\s+/).slice(0, 4).join('.') : '';
      const st = qeState[it.id];
      const qe = it.textOnly && it.source
        ? `<div class="qe"><input data-qe value="${esc(it.fullText || it.text)}" aria-label="Metni düzenle"><button class="secondary" data-act="qe" title="AI kullanmadan doğrudan dosyaya yaz">Kaydet</button></div>` +
          (st ? `<div class="qeMsg ${st.ok ? 'ok' : 'bad'}">${esc(st.message)}${st.ok ? '' : ' <button class="link" data-act="askText">Claude\'a sor</button>'}</div>` : '')
        : (it.text ? `<div class="txt" title="${esc(it.text)}">“${esc(it.text)}”</div>` : '');
      return `<div class="card" data-id="${it.id}">
        <div class="cardHead" data-act="scroll" title="Önizlemede göster">
          <span class="num">${i + 1}</span><code class="tag">&lt;${esc(it.tag)}&gt;</code><span class="cls">${esc(cls)}</span>
          <span class="grow"></span>
          <button class="icon" data-act="parent" title="Üst öğeyi seç">⤒</button>
          <button class="icon" data-act="remove" title="Seçimden çıkar">×</button>
        </div>
        <div class="src">${srcHtml(it)}</div>
        ${qe}
      </div>`;
    }).join('');
  }

  itemsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    const card = e.target.closest('.card');
    if (!btn || !card) return;
    const id = Number(card.dataset.id);
    const it = items.find((x) => x.id === id);
    if (!it) return;
    switch (btn.dataset.act) {
      case 'open': vscode.postMessage({ type: 'openSource', item: it }); break;
      case 'remove':
        items = items.filter((x) => x.id !== id);
        toFrame({ type: 'remove', id });
        renderItems();
        break;
      case 'parent': toFrame({ type: 'parent', id }); break;
      case 'scroll': toFrame({ type: 'scrollTo', id }); break;
      case 'qe': quickEdit(card, it); break;
      case 'askText': {
        const v = card.querySelector('[data-qe]').value;
        promptEl.value = `Bu öğenin metnini "${v}" olarak değiştir.`;
        promptEl.focus();
        break;
      }
    }
    e.stopPropagation();
  });
  itemsEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-qe]')) {
      const card = e.target.closest('.card');
      const it = items.find((x) => x.id === Number(card.dataset.id));
      if (it) quickEdit(card, it);
    }
  });
  function quickEdit(card, it) {
    vscode.postMessage({ type: 'quickEdit', item: it, newText: card.querySelector('[data-qe]').value });
  }
  clearBtn.addEventListener('click', () => {
    items = [];
    toFrame({ type: 'clear' });
    renderItems();
  });

  // ---------- değişiklik kuyruğu ----------
  const KIND = { prompt: 'İstek', style: 'Stil', text: 'Metin', delete: 'Sil', image: 'Görsel' };
  const VP = { '390': 'mobil', '1024': 'tablet' };

  function targetLabel(en) {
    const it = (en.items || [])[0];
    if (!it) return 'Tüm sayfa';
    const cls = it.classes ? '.' + it.classes.trim().split(/\s+/)[0] : '';
    const loc = it.source ? ' · ' + baseName(it.source.file) + (it.source.line ? ':' + it.source.line : '') : '';
    return `<${it.tag}${cls}>${loc}${en.items.length > 1 ? ` +${en.items.length - 1}` : ''}`;
  }
  function entrySummary(en) {
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

  function saveQueue() {
    // çok büyük görselleri kalıcı durumda tutma (kuyruk yine bellekte kalır)
    const slim = queue.map((en) => (en.dataUrl && en.dataUrl.length > 3e6 ? Object.assign({}, en, { dataUrl: undefined, lostData: true }) : en));
    persist({ queue: slim });
  }

  function renderQueue() {
    const n = queue.length;
    qcount.textContent = String(n);
    qinfo.hidden = qUndo.hidden = qRedo.hidden = qList.hidden = qClear.hidden = qApply.hidden = !n;
    qUndo.disabled = !undoStack.length;
    qRedo.disabled = !redoStack.length;
    qApply.disabled = applying || running;
    qApply.textContent = applying ? 'Uygulanıyor…' : `Uygula (${n})`;
    qRollback.hidden = !canRollback;
    qsep.hidden = !(n && canRollback);
    qbar.hidden = !n && !canRollback && !undoStack.length;
    if (!n && undoStack.length && !canRollback) {
      // boş kuyrukta yalnızca geri al göster
      qUndo.hidden = false;
    }
    queueHead.hidden = !n;
    queueEl.hidden = !n;
    queueEl.innerHTML = queue.map((en) =>
      `<div class="qitem" data-token="${esc(en.token)}">
        <span class="qk qk-${esc(en.kind)}">${esc(KIND[en.kind] || en.kind)}</span>
        <div class="qmain"><div class="qt">${esc(targetLabel(en))}${en.viewportOnly ? ` <span class="qvp">${esc(VP[en.viewportOnly] || en.viewportOnly)}</span>` : ''}</div>
        <div class="qs" title="${esc(entrySummary(en))}">${esc(entrySummary(en))}</div></div>
        <button class="icon" data-act="qdel" title="Kuyruktan çıkar">×</button>
      </div>`).join('');
    renderItems();
  }

  function qAdd(entries) {
    queue = queue.concat(entries);
    undoStack.push({ op: 'add', entries });
    redoStack = [];
    saveQueue();
    renderQueue();
  }
  function qRemove(token) {
    const i = queue.findIndex((x) => x.token === token);
    if (i === -1) return;
    const en = queue.splice(i, 1)[0];
    toFrame({ type: 'revert', tokens: [token] });
    undoStack.push({ op: 'remove', entries: [en], index: i });
    redoStack = [];
    saveQueue();
    renderQueue();
  }
  function qClearAll() {
    if (!queue.length) return;
    const entries = queue;
    queue = [];
    toFrame({ type: 'revert', tokens: entries.map((x) => x.token) });
    undoStack.push({ op: 'clear', entries });
    redoStack = [];
    saveQueue();
    renderQueue();
  }
  function invert(step, isUndo) {
    const tokens = step.entries.map((x) => x.token);
    const removeIt = (step.op === 'add') === isUndo;
    if (removeIt) {
      queue = queue.filter((x) => tokens.indexOf(x.token) === -1);
      toFrame({ type: 'revert', tokens });
    } else {
      if (step.op === 'remove' && typeof step.index === 'number') queue.splice(step.index, 0, ...step.entries);
      else queue = queue.concat(step.entries);
      toFrame({ type: 'reapply', entries: step.entries });
    }
  }
  function undo() {
    const step = undoStack.pop();
    if (!step) return;
    invert(step, true);
    redoStack.push(step);
    saveQueue();
    renderQueue();
  }
  function redo() {
    const step = redoStack.pop();
    if (!step) return;
    invert(step, false);
    undoStack.push(step);
    saveQueue();
    renderQueue();
  }

  queueEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act="qdel"]');
    const row = e.target.closest('.qitem');
    if (b && row) qRemove(row.dataset.token);
  });
  qUndo.addEventListener('click', undo);
  qRedo.addEventListener('click', redo);
  qClear.addEventListener('click', qClearAll);
  qApply.addEventListener('click', () => applyQueue());
  $('#qApply2').addEventListener('click', () => applyQueue());
  qList.addEventListener('click', () => {
    if (layout.collapsed) { layout.collapsed = false; applyLayout(true); }
    queueHead.scrollIntoView({ block: 'start', behavior: 'smooth' });
    queueEl.classList.remove('flash');
    void queueEl.offsetWidth;
    queueEl.classList.add('flash');
  });
  qRollback.addEventListener('click', () => vscode.postMessage({ type: 'rollback' }));

  function applyQueue() {
    if (!queue.length) return;
    dispatchEntries(queue.slice(), true);
  }

  function dispatchEntries(entries, fromQueue) {
    if (running || applying) {
      if (popPending) popStatus('err', 'Önceki işlem hâlâ sürüyor.');
      addLog('err', 'Önceki işlem bitmeden yenisi gönderilemez.');
      return false;
    }
    applying = true;
    renderQueue();
    const lines = entries.map((en) => `• ${KIND[en.kind]}: ${entrySummary(en)}`).join('\n');
    const meta = fromQueue ? `Kuyruk uygulanıyor · ${entries.length} değişiklik` : (popPending ? 'Hızlı kutu' : (items.length ? `${items.length} öğe seçili` : 'Tüm sayfa'));
    addLog('user', `<span class="meta">${esc(meta)}</span>${esc(lines)}`);
    vscode.postMessage({
      type: 'applyEntries',
      entries,
      fromQueue,
      pageUrl: displayUrl(pageHref),
      continueSession: sendTo === 'claudePanel' ? contChk.checked : !!(sessionId && contChk.checked),
    });
    return true;
  }

  // ---------- etkinlik günlüğü ----------
  function addLog(cls, html) {
    const first = logEl.querySelector('.muted:only-child');
    if (first) first.remove();
    const d = document.createElement('div');
    d.className = 'ev ' + cls;
    d.innerHTML = html;
    if (workingEl && workingEl.parentNode === logEl) logEl.insertBefore(d, workingEl);
    else logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
    return d;
  }
  function mdLite(s) {
    return esc(s).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  }
  const TOOL_TR = {
    Edit: '✎ Düzenledi', MultiEdit: '✎ Düzenledi', Write: '✎ Yazdı', Read: '◦ Okudu',
    Grep: '⌕ Aradı', Glob: '⌕ Dosya aradı', Bash: '$ Komut', WebFetch: '◦ Web', WebSearch: '⌕ Web araması',
  };
  function setRunning(on) {
    running = on;
    sendBtn.hidden = queueBtn.hidden = on;
    stopBtn.hidden = !on;
    if (on) {
      workingEl = document.createElement('div');
      workingEl.className = 'working';
      workingEl.innerHTML = '<span class="spin"></span><span>Claude çalışıyor…</span>';
      logEl.appendChild(workingEl);
      logEl.scrollTop = logEl.scrollHeight;
    } else if (workingEl) {
      workingEl.remove();
      workingEl = null;
    }
    renderQueue();
  }

  function onClaude(ev) {
    switch (ev.kind) {
      case 'start':
        sawText = false;
        setRunning(true);
        if (popPending) popStatus('busy', 'Claude çalışıyor…');
        break;
      case 'text': sawText = true; addLog('text', mdLite(ev.text)); break;
      case 'tool': {
        const label = TOOL_TR[ev.name] || ev.name;
        addLog('tool' + (/Edit|Write/.test(ev.name) ? ' edit' : ''), `<b>${esc(label)}</b> ${esc(ev.detail)}`);
        break;
      }
      case 'done': {
        setRunning(false);
        if (!sawText && ev.summary) addLog('text', mdLite(ev.summary));
        const secs = ev.durationMs ? ` · ${Math.round(ev.durationMs / 1000)} sn` : '';
        const files = (ev.edited || []).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ');
        if (ev.ok) addLog('done', `✓ Tamamlandı${secs}${files ? '<br>Değişen: ' + files : ' · dosya değişmedi'}`);
        else addLog('err', 'Claude işi bitiremedi.' + (ev.summary ? '\n' + esc(ev.summary) : ''));
        if (popPending) {
          popPending = false;
          if (ev.ok) popStatus('ok', (ev.edited || []).length ? 'Tamamlandı, önizleme güncelleniyor' : 'Tamamlandı (dosya değişmedi)', 2500);
          else popStatus('err', 'Claude işi bitiremedi, ayrıntılar panelde.');
        }
        break;
      }
      case 'error': {
        setRunning(false);
        if (popPending) { popPending = false; popStatus('err', ev.message.split('\n')[0]); }
        const d = addLog('err', esc(ev.message) + ' <button class="link" data-settings>Ayarlar</button>');
        d.querySelector('[data-settings]').addEventListener('click', () => vscode.postMessage({ type: 'openSettings' }));
        break;
      }
    }
  }
  logEl.addEventListener('click', (e) => {
    const a = e.target.closest('[data-file]');
    if (a) vscode.postMessage({ type: 'openFile', file: a.dataset.file });
  });

  // ---------- gönderme yeri ----------
  function applySendTo() {
    sendToSel.value = sendTo;
    const panel = sendTo === 'claudePanel';
    sendBtn.textContent = panel ? "Claude Code'a aktar" : "Claude'a gönder";
    contLabel.textContent = panel ? 'Açık Claude Code konuşmasına ekle' : 'Konuşmayı sürdür';
    contWrap.hidden = !panel && !sessionId;
    newSessBtn.hidden = panel || !sessionId;
    sendFrameConfig();
  }
  function sendFrameConfig() {
    toFrame({
      type: 'config',
      popover: layout.popover,
      viewport,
      nowLabel: sendTo === 'claudePanel' ? 'Hemen aktar' : 'Hemen çalıştır',
    });
  }
  sendToSel.addEventListener('change', () => {
    sendTo = sendToSel.value;
    applySendTo();
    vscode.postMessage({ type: 'setSendTo', value: sendTo });
  });

  // ---------- yan paneldeki istek kutusu ----------
  function popStatus(state, text, closeAfter) {
    toFrame({ type: 'popStatus', state, text, closeAfter });
  }
  function promptEntry() {
    const text = promptEl.value.trim();
    if (!text) { promptEl.focus(); return null; }
    return { token: newToken(), kind: 'prompt', text, items: items.slice(), viewportOnly: null };
  }
  function send() {
    const en = promptEntry();
    if (!en) return;
    popPending = false;
    if (dispatchEntries([en], false)) promptEl.value = '';
  }
  function addPromptToQueue() {
    const en = promptEntry();
    if (!en) return;
    qAdd([en]);
    promptEl.value = '';
  }
  sendBtn.addEventListener('click', send);
  queueBtn.addEventListener('click', addPromptToQueue);
  stopBtn.addEventListener('click', () => vscode.postMessage({ type: 'stop' }));
  promptEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) send(); else addPromptToQueue();
    }
  });
  newSessBtn.addEventListener('click', () => vscode.postMessage({ type: 'newSession' }));

  document.addEventListener('keydown', (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      setSelect(!selecting);
    } else if (mod && !inField && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (mod && !inField && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (e.key === 'Escape' && selecting) {
      setSelect(false);
    }
  });

  // ---------- mesajlar ----------
  function onOverlay(m) {
    switch (m.type) {
      case 'ready':
        pageHref = m.href;
        urlInput.value = displayUrl(m.href);
        showSupport(m.support);
        items = [];
        renderItems();
        if (selecting) toFrame({ type: 'mode', on: true });
        sendFrameConfig();
        if (queue.length) toFrame({ type: 'reapply', entries: queue });
        break;
      case 'location':
        pageHref = m.href;
        if (document.activeElement !== urlInput) urlInput.value = displayUrl(m.href);
        break;
      case 'select':
        items = m.additive ? items.concat(m.item) : [m.item];
        renderItems();
        if (!m.additive) revealSource(m.item);
        if (!m.additive && !layout.popover && !layout.collapsed) promptEl.focus();
        break;
      case 'unselect':
        items = items.filter((x) => x.id !== m.id);
        renderItems();
        break;
      case 'replace': {
        const i = items.findIndex((x) => x.id === m.oldId);
        if (i !== -1) {
          items[i] = m.item;
          renderItems();
          if (m.nav) revealSource(m.item);
        }
        break;
      }
      case 'mode':
        selecting = m.on;
        selBtn.setAttribute('aria-pressed', String(selecting));
        frameWrap.classList.toggle('selecting', selecting);
        break;
      case 'commit':
        if (m.mode === 'queue') {
          qAdd(m.entries);
          popStatus('ok', `Kuyruğa eklendi · toplam ${queue.length}`, 1100);
        } else {
          popPending = true;
          if (!dispatchEntries(m.entries, false)) {
            popPending = false;
            toFrame({ type: 'revert', tokens: m.entries.map((x) => x.token) });
          }
        }
        break;
      case 'openSourceReq':
        vscode.postMessage({ type: 'openSource', item: m.item });
        break;
    }
  }

  function onHost(m) {
    switch (m.type) {
      case 'init':
        if (m.layout && !(vscode.getState() || {}).layout) {
          layout = Object.assign(layout, m.layout);
          applyLayout(false);
        }
        sendTo = m.sendTo || 'claudePanel';
        claudeExt = m.claudeExt !== false;
        canRollback = !!m.canRollback;
        openOnSelect = m.openOnSelect !== false;
        openSrcChk.checked = openOnSelect;
        applySendTo();
        if (sendTo === 'claudePanel' && !claudeExt) {
          addLog('err', 'Claude Code VS Code eklentisi kurulu görünmüyor. Kur ya da "Burada çalıştır" seçeneğini kullan.');
        }
        proxyBase = m.proxyBase;
        target = m.target;
        urlInput.value = target + (m.initialPath || '/');
        navigate(m.initialPath || '/');
        renderQueue();
        break;
      case 'retarget':
        target = m.target;
        navigate(m.path || '/');
        break;
      case 'toggleSelect':
        setSelect(!selecting);
        break;
      case 'quickEditResult': {
        qeState[m.id] = { ok: m.ok, message: m.ok ? '✓ ' + m.message : m.message };
        if (m.ok && m.newText != null) {
          toFrame({ type: 'setText', id: m.id, text: m.newText });
          const it = items.find((x) => x.id === m.id);
          if (it) { it.text = it.fullText = m.newText; }
        }
        renderItems();
        break;
      }
      case 'session':
        sessionId = m.sessionId;
        applySendTo();
        break;
      case 'sendTo':
        sendTo = m.value;
        applySendTo();
        break;
      case 'applied': {
        applying = false;
        const tokens = (m.tokens || []);
        if (m.fromQueue && m.ok) {
          queue = queue.filter((x) => tokens.indexOf(x.token) === -1);
          undoStack = [];
          redoStack = [];
          saveQueue();
        }
        if (m.ok) pendingApplied = pendingApplied.concat(tokens);
        if (m.checkpoint) canRollback = true;
        if (m.direct) addLog('done', `✓ ${m.direct} metin değişikliği AI kullanmadan doğrudan dosyaya yazıldı.`);
        if (m.ok && !m.sent && popPending) { popPending = false; popStatus('ok', 'Doğrudan dosyaya yazıldı', 1600); }
        if (!m.ok) {
          if (!m.reported) addLog('err', esc(m.message || 'Uygulanamadı.'));
          if (popPending) { popPending = false; popStatus('err', m.message || 'Uygulanamadı.'); }
        }
        renderQueue();
        break;
      }
      case 'checkpointState':
        canRollback = !!m.canRollback;
        renderQueue();
        break;
      case 'rollbackResult':
        canRollback = !!m.canRollback;
        if (m.ok) addLog('done', `↶ Panoptent'in değişiklikleri geri alındı: ${(m.files || []).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ') || 'değişiklik yoktu'}`);
        else if (m.message) addLog('err', esc(m.message));
        if (m.conflicts && m.conflicts.length) addLog('err', 'Dokunulmadı:\n' + m.conflicts.map(esc).join('\n'));
        renderQueue();
        if (m.ok && supportKind === 'none') setTimeout(reloadFrame, 300);
        break;
      case 'handoff': {
        const msgs = {
          mention: ['Claude Code konuşmana eklendi — panelde Enter\'a bas', 'İstek, açık Claude Code konuşmanın giriş kutusuna dosya olarak eklendi (<code>@.claude/panoptent/…</code>). Panelde <b>Enter</b>\'a bas; değişiklikler önizlemeye otomatik yansır.'],
          clipboard: ['Panoya kopyalandı — Claude Code kutusuna yapıştır', 'Claude Code kutusuna otomatik eklenemedi; istem <b>panoya kopyalandı</b>. Claude Code paneline tıklayıp <b>Cmd/Ctrl+V</b> ve <b>Enter</b>.'],
          newTab: ['Yeni Claude Code sekmesinde açıldı — Enter\'a bas', 'İstem yeni bir Claude Code sekmesinde hazır. Kontrol edip <b>Enter</b>\'a bas.'],
        };
        const t = msgs[m.how] || msgs.newTab;
        if (popPending) {
          popPending = false;
          popStatus(m.ok ? 'ok' : 'err', m.ok ? t[0] : 'Claude Code paneli açılamadı', 2600);
        }
        if (m.ok) {
          lastHandoff = Date.now();
          addLog('handoff', '<b>→ Claude Code.</b> ' + t[1]);
        } else {
          addLog('err', 'Claude Code paneli açılamadı. Gönderme yerini "Arka planda (CLI)" yapmayı dene.');
        }
        break;
      }
      case 'filesChanged': {
        const recent = running || Date.now() - lastHandoff < 20 * 60 * 1000;
        if (recent && m.files && m.files.length && !running) {
          const shown = m.files.slice(0, 4).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ');
          addLog('tool edit', `<b>✎ Değişti</b> ${shown}${m.files.length > 4 ? ` +${m.files.length - 4}` : ''}`);
        }
        if (supportKind === 'none') {
          pendingApplied = [];
          setTimeout(reloadFrame, 300);
        } else {
          // Kod değişti: önizlemedeki geçici denemeleri kaldır, gerçek sonuç görünsün
          if (pendingApplied.length) {
            const toks = pendingApplied;
            pendingApplied = [];
            setTimeout(() => toFrame({ type: 'revert', tokens: toks }), 1500);
          }
          setTimeout(() => toFrame({ type: 'refresh' }), 1800);
        }
        break;
      }
      case 'claude':
        onClaude(m.ev);
        break;
      case 'note':
        addLog('user', `<span class="meta">Otomatik</span>${esc(m.text)}`);
        break;
      case 'reload':
        reloadFrame();
        break;
    }
  }

  window.addEventListener('message', (e) => {
    if (e.source === frame.contentWindow) {
      if (e.data && e.data.source === 'panoptent') onOverlay(e.data);
      return;
    }
    if (e.data && e.data.type) onHost(e.data);
  });

  renderItems();
  applySendTo();
  renderQueue();
  vscode.postMessage({ type: 'ready' });
})();
