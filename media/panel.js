// Panoptent paneli (VS Code webview tarafı)
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();
  const $ = (s) => document.querySelector(s);
  const I18N = window.PanoptentI18n;
  const t = I18N.t;

  I18N.add({
    en: {
      'pn.select.title': 'Selection mode (Ctrl/Cmd+Shift+E) — or hold Alt and click',
      'pn.select': 'Select',
      'pn.reload': 'Reload',
      'pn.url.aria': 'Page address',
      'pn.vp.aria': 'Screen width',
      'pn.vp.full.title': 'Full width',
      'pn.vp.full': 'Full',
      'pn.vp.tablet': 'Tablet',
      'pn.vp.mobile': 'Mobile',
      'pn.dock.aria': 'Panel position',
      'pn.dock.left': 'Panel on the left',
      'pn.dock.bottom': 'Panel at the bottom',
      'pn.dock.right': 'Panel on the right',
      'pn.side.hide': 'Hide panel',
      'pn.side.show': 'Show panel',
      'pn.lang.title': 'Interface language',
      'pn.lang.auto': 'Auto (VS Code)',
      'pn.frame.title': 'Preview',
      'pn.q.pending.one': 'change pending',
      'pn.q.pending.many': 'changes pending',
      'pn.q.undo.title': 'Undo (Ctrl/Cmd+Z)',
      'pn.q.redo.title': 'Redo (Ctrl/Cmd+Shift+Z)',
      'pn.q.list': 'List',
      'pn.q.clear': 'Clear',
      'pn.q.apply': 'Apply ({0})',
      'pn.q.applying': 'Applying…',
      'pn.q.rollback': '↶ Undo last apply',
      'pn.q.rollback.title': 'Reverts only the changes made by Panoptent and the request it sent in the last apply',
      'pn.q.remove': 'Remove from queue',
      'pn.splitter.title': 'Drag to resize · Double-click to hide',
      'pn.queue': 'Queue',
      'pn.queue.applyAll': 'Apply all',
      'pn.selected': 'Selected',
      'pn.clear': 'Clear',
      'pn.prompt.ph': 'What should change? E.g. make this button bigger and turn it green',
      'pn.sendTo.title': 'Where should the request go?',
      'pn.sendTo.panel': 'Claude Code panel',
      'pn.sendTo.cli': 'In the background (CLI)',
      'pn.sendTo.mcp': 'Claude Code (MCP)',
      'pn.queueBtn': 'Add to queue',
      'pn.queueBtn.title': 'Add to queue (Ctrl/Cmd+Enter)',
      'pn.sendBtn.title': 'Send now (Ctrl/Cmd+Shift+Enter)',
      'pn.send.panel': 'Send to Claude Code',
      'pn.send.cli': 'Send to Claude',
      'pn.cont.panel': 'Add to the open Claude Code conversation',
      'pn.cont.cli': 'Continue the conversation',
      'pn.stop': 'Stop',
      'pn.newSess': 'New session',
      'pn.popChk': 'Open a box next to the element on select',
      'pn.openSrc': 'Also open its code on select',
      'pn.openSrc.title': "Opens the selected element's source file in the editor without taking focus from the preview",
      'pn.design': 'Design rules:',
      'pn.design.title': "Claude follows the design rules in this file for every change (click to choose another file or turn it off)",
      'pn.design.auto': '{0} (automatic)',
      'pn.design.none': 'none — choose a file',
      'pn.design.off': 'off',
      'pn.design.missing': '{0} not found — choose again',
      'pn.activity': 'Activity',
      'pn.log.empty': 'Nothing yet.',
      'pn.now.panel': 'Send now',
      'pn.now.cli': 'Run now',
      'pn.sup.auto': 'Set up automatically',
      'pn.sup.guide': 'Guide',
      'pn.sup.ci': '✓ Source mapping is active: elements link to file and line.',
      'pn.sup.react': '✓ Using React development-mode source info.',
      'pn.sup.vue': 'The Vue component file is found but not the line. Add code-inspector-plugin for exact lines.',
      'pn.sup.none': 'No source mapping: Claude will locate the element by its text and classes (slower). Add code-inspector-plugin to your project to jump to the exact line.',
      'pn.src.component': 'component',
      'pn.src.near': 'nearby',
      'pn.src.componentName': 'Component: {0}',
      'pn.src.unknown': 'Source unknown',
      'pn.items.empty': 'Turn on <b>Select</b> and click an element in the preview; in the box that opens next to it you can write a request, change its style, edit its text or delete it.<br><kbd>Shift</kbd> multiple elements, <kbd>Alt</kbd> select without the mode, <kbd>Alt</kbd>+arrows parent/child element.',
      'pn.qe.aria': 'Edit text',
      'pn.qe.save': 'Save',
      'pn.qe.save.title': 'Write straight to the file without AI',
      'pn.qe.ask': 'Ask Claude',
      'pn.qe.prompt': 'Change this element\'s text to "{0}".',
      'pn.card.scroll': 'Show in preview',
      'pn.card.parent': 'Select parent element',
      'pn.card.remove': 'Remove from selection',
      'pn.kind.prompt': 'Request',
      'pn.kind.style': 'Style',
      'pn.kind.text': 'Text',
      'pn.kind.delete': 'Delete',
      'pn.kind.image': 'Image',
      'pn.vpTag.390': 'mobile',
      'pn.vpTag.1024': 'tablet',
      'pn.wholePage': 'Whole page',
      'pn.sum.delete': 'Remove element',
      'pn.sum.image': 'New image: {0}',
      'pn.busy.pop': 'The previous task is still running.',
      'pn.busy.log': "Can't send a new request until the previous one finishes.",
      'pn.meta.queue.one': 'Applying queue · 1 change',
      'pn.meta.queue.many': 'Applying queue · {0} changes',
      'pn.meta.quick': 'Quick box',
      'pn.meta.sel.one': '1 element selected',
      'pn.meta.sel.many': '{0} elements selected',
      'pn.tool.Edit': '✎ Edited',
      'pn.tool.Write': '✎ Wrote',
      'pn.tool.Read': '◦ Read',
      'pn.tool.Grep': '⌕ Searched',
      'pn.tool.Glob': '⌕ Found files',
      'pn.tool.Bash': '$ Command',
      'pn.tool.WebFetch': '◦ Web',
      'pn.tool.WebSearch': '⌕ Web search',
      'pn.working': 'Claude is working…',
      'pn.secs': '{0} s',
      'pn.done': '✓ Done',
      'pn.changedFiles': 'Changed:',
      'pn.noFiles': 'no files changed',
      'pn.failed': "Claude couldn't finish the task.",
      'pn.pop.doneUpdating': 'Done, updating the preview',
      'pn.pop.doneNoFiles': 'Done (no files changed)',
      'pn.pop.failed': "Claude couldn't finish — details in the panel.",
      'pn.settings': 'Settings',
      'pn.queued': 'Added to queue · {0} total',
      'pn.noClaudeExt': 'The Claude Code VS Code extension doesn\'t seem to be installed. Install it or use the "In the background (CLI)" option.',
      'pn.direct.one': '✓ 1 text change was written straight to the file without AI.',
      'pn.direct.many': '✓ {0} text changes were written straight to the file without AI.',
      'pn.pop.direct': 'Written straight to the file',
      'pn.applyFailed': "Couldn't apply.",
      'pn.rollback.done': "↶ Panoptent's changes were undone: {0}",
      'pn.rollback.none': 'there were no changes',
      'pn.rollback.untouched': 'Left untouched:',
      'pn.ho.mention.short': "Added to your Claude Code conversation — press Enter in the panel",
      'pn.ho.mention.long': 'The request was attached as a file to the input box of your open Claude Code conversation (<code>@.claude/panoptent/…</code>). Press <b>Enter</b> in the panel; changes show up in the preview automatically.',
      'pn.ho.clipboard.short': 'Copied to clipboard — paste it into Claude Code',
      'pn.ho.clipboard.long': "Couldn't add it to the Claude Code box automatically; the prompt was <b>copied to the clipboard</b>. Click the Claude Code panel, then <b>Cmd/Ctrl+V</b> and <b>Enter</b>.",
      'pn.ho.newTab.short': 'Opened in a new Claude Code tab — press Enter',
      'pn.ho.newTab.long': 'The prompt is ready in a new Claude Code tab. Review it and press <b>Enter</b>.',
      'pn.ho.mcp.short': 'Short command copied — paste it into Claude Code and press Enter',
      'pn.ho.mcp.long': 'Claude Code will fetch this change set from Panoptent over MCP. A one-line command was <b>copied</b>: click your Claude Code conversation, press <b>Cmd/Ctrl+V</b> and <b>Enter</b>. Tip: you can also type <code>/mcp__panoptent__apply_queue</code> in Claude Code instead of pressing Apply.',
      'pn.ho.mcpPrompt.short': 'Claude Code took the queue over MCP',
      'pn.ho.mcpPrompt.long': 'Claude Code took the queued changes over MCP (<code>apply_queue</code>). You can undo them here as usual.',
      'pn.ho.failShort': "Couldn't open the Claude Code panel",
      'pn.ho.failLong': 'Couldn\'t open the Claude Code panel. Try setting the destination to "In the background (CLI)".',
      'pn.changed': '✎ Changed',
      'pn.auto': 'Auto',
    },
    tr: {
      'pn.select.title': 'Seçim modu (Ctrl/Cmd+Shift+E) — Alt basılı tutarak da tıklayabilirsin',
      'pn.select': 'Seç',
      'pn.reload': 'Yenile',
      'pn.url.aria': 'Sayfa adresi',
      'pn.vp.aria': 'Ekran genişliği',
      'pn.vp.full.title': 'Tam genişlik',
      'pn.vp.full': 'Tam',
      'pn.vp.tablet': 'Tablet',
      'pn.vp.mobile': 'Mobil',
      'pn.dock.aria': 'Panel konumu',
      'pn.dock.left': 'Panel solda',
      'pn.dock.bottom': 'Panel altta',
      'pn.dock.right': 'Panel sağda',
      'pn.side.hide': 'Paneli gizle',
      'pn.side.show': 'Paneli göster',
      'pn.lang.title': 'Arayüz dili',
      'pn.lang.auto': 'Otomatik (VS Code)',
      'pn.frame.title': 'Önizleme',
      'pn.q.pending.one': 'değişiklik bekliyor',
      'pn.q.pending.many': 'değişiklik bekliyor',
      'pn.q.undo.title': 'Geri al (Ctrl/Cmd+Z)',
      'pn.q.redo.title': 'Yinele (Ctrl/Cmd+Shift+Z)',
      'pn.q.list': 'Listele',
      'pn.q.clear': 'Temizle',
      'pn.q.apply': 'Uygula ({0})',
      'pn.q.applying': 'Uygulanıyor…',
      'pn.q.rollback': '↶ Son uygulamayı geri al',
      'pn.q.rollback.title': "Son uygulamada yalnızca Panoptent'in ve onun gönderdiği isteğin yaptığı değişiklikleri geri alır",
      'pn.q.remove': 'Kuyruktan çıkar',
      'pn.splitter.title': 'Sürükle: boyutlandır · Çift tık: gizle',
      'pn.queue': 'Kuyruk',
      'pn.queue.applyAll': 'Hepsini uygula',
      'pn.selected': 'Seçilenler',
      'pn.clear': 'Temizle',
      'pn.prompt.ph': 'Ne değişsin? Örn: bu butonu daha büyük yap ve yeşil tonlarına çevir',
      'pn.sendTo.title': 'İstek nereye gitsin?',
      'pn.sendTo.panel': 'Claude Code paneli',
      'pn.sendTo.cli': 'Arka planda (CLI)',
      'pn.sendTo.mcp': 'Claude Code (MCP)',
      'pn.queueBtn': 'Kuyruğa',
      'pn.queueBtn.title': 'Kuyruğa ekle (Ctrl/Cmd+Enter)',
      'pn.sendBtn.title': 'Hemen gönder (Ctrl/Cmd+Shift+Enter)',
      'pn.send.panel': "Claude Code'a aktar",
      'pn.send.cli': "Claude'a gönder",
      'pn.cont.panel': 'Açık Claude Code konuşmasına ekle',
      'pn.cont.cli': 'Konuşmayı sürdür',
      'pn.stop': 'Durdur',
      'pn.newSess': 'Yeni oturum',
      'pn.popChk': 'Seçince öğenin yanında kutu aç',
      'pn.openSrc': 'Seçince kodunu da yanda aç',
      'pn.openSrc.title': 'Seçtiğin öğenin kaynak dosyası, odağı önizlemeden almadan editörde açılır',
      'pn.design': 'Tasarım kuralları:',
      'pn.design.title': 'Claude her değişiklikte bu dosyadaki tasarım kurallarına uyar (başka dosya seçmek ya da kapatmak için tıkla)',
      'pn.design.auto': '{0} (otomatik)',
      'pn.design.none': 'yok — dosya seç',
      'pn.design.off': 'kapalı',
      'pn.design.missing': '{0} bulunamadı — yeniden seç',
      'pn.activity': 'Etkinlik',
      'pn.log.empty': 'Henüz bir şey yok.',
      'pn.now.panel': 'Hemen aktar',
      'pn.now.cli': 'Hemen çalıştır',
      'pn.sup.auto': 'Otomatik kur',
      'pn.sup.guide': 'Rehber',
      'pn.sup.ci': '✓ Kaynak eşleştirme aktif: öğeler dosya ve satıra bağlanıyor.',
      'pn.sup.react': '✓ React geliştirme modu kaynak bilgisi kullanılıyor.',
      'pn.sup.vue': 'Vue bileşen dosyası bulunuyor ama satır bilinmiyor. Kesin satır için code-inspector-plugin ekle.',
      'pn.sup.none': 'Kaynak eşleştirme yok: Claude öğeyi metin ve sınıflardan arayarak bulacak (daha yavaş). Projeye code-inspector-plugin eklersen tam satıra gider.',
      'pn.src.component': 'bileşen',
      'pn.src.near': 'yakın konum',
      'pn.src.componentName': 'Bileşen: {0}',
      'pn.src.unknown': 'Kaynak bilinmiyor',
      'pn.items.empty': '<b>Seç</b> modunu aç ve önizlemede bir öğeye tıkla; yanında açılan kutudan istek yazabilir, stilini değiştirebilir, metnini düzenleyebilir ya da silebilirsin.<br><kbd>Shift</kbd> birden çok öğe, <kbd>Alt</kbd> modu açmadan seçim, <kbd>Alt</kbd>+oklar üst/alt öğe.',
      'pn.qe.aria': 'Metni düzenle',
      'pn.qe.save': 'Kaydet',
      'pn.qe.save.title': 'AI kullanmadan doğrudan dosyaya yaz',
      'pn.qe.ask': "Claude'a sor",
      'pn.qe.prompt': 'Bu öğenin metnini "{0}" olarak değiştir.',
      'pn.card.scroll': 'Önizlemede göster',
      'pn.card.parent': 'Üst öğeyi seç',
      'pn.card.remove': 'Seçimden çıkar',
      'pn.kind.prompt': 'İstek',
      'pn.kind.style': 'Stil',
      'pn.kind.text': 'Metin',
      'pn.kind.delete': 'Sil',
      'pn.kind.image': 'Görsel',
      'pn.vpTag.390': 'mobil',
      'pn.vpTag.1024': 'tablet',
      'pn.wholePage': 'Tüm sayfa',
      'pn.sum.delete': 'Öğeyi kaldır',
      'pn.sum.image': 'Yeni görsel: {0}',
      'pn.busy.pop': 'Önceki işlem hâlâ sürüyor.',
      'pn.busy.log': 'Önceki işlem bitmeden yenisi gönderilemez.',
      'pn.meta.queue.one': 'Kuyruk uygulanıyor · 1 değişiklik',
      'pn.meta.queue.many': 'Kuyruk uygulanıyor · {0} değişiklik',
      'pn.meta.quick': 'Hızlı kutu',
      'pn.meta.sel.one': '1 öğe seçili',
      'pn.meta.sel.many': '{0} öğe seçili',
      'pn.tool.Edit': '✎ Düzenledi',
      'pn.tool.Write': '✎ Yazdı',
      'pn.tool.Read': '◦ Okudu',
      'pn.tool.Grep': '⌕ Aradı',
      'pn.tool.Glob': '⌕ Dosya aradı',
      'pn.tool.Bash': '$ Komut',
      'pn.tool.WebFetch': '◦ Web',
      'pn.tool.WebSearch': '⌕ Web araması',
      'pn.working': 'Claude çalışıyor…',
      'pn.secs': '{0} sn',
      'pn.done': '✓ Tamamlandı',
      'pn.changedFiles': 'Değişen:',
      'pn.noFiles': 'dosya değişmedi',
      'pn.failed': 'Claude işi bitiremedi.',
      'pn.pop.doneUpdating': 'Tamamlandı, önizleme güncelleniyor',
      'pn.pop.doneNoFiles': 'Tamamlandı (dosya değişmedi)',
      'pn.pop.failed': 'Claude işi bitiremedi, ayrıntılar panelde.',
      'pn.settings': 'Ayarlar',
      'pn.queued': 'Kuyruğa eklendi · toplam {0}',
      'pn.noClaudeExt': 'Claude Code VS Code eklentisi kurulu görünmüyor. Kur ya da "Burada çalıştır" seçeneğini kullan.',
      'pn.direct.one': '✓ 1 metin değişikliği AI kullanmadan doğrudan dosyaya yazıldı.',
      'pn.direct.many': '✓ {0} metin değişikliği AI kullanmadan doğrudan dosyaya yazıldı.',
      'pn.pop.direct': 'Doğrudan dosyaya yazıldı',
      'pn.applyFailed': 'Uygulanamadı.',
      'pn.rollback.done': "↶ Panoptent'in değişiklikleri geri alındı: {0}",
      'pn.rollback.none': 'değişiklik yoktu',
      'pn.rollback.untouched': 'Dokunulmadı:',
      'pn.ho.mention.short': "Claude Code konuşmana eklendi — panelde Enter'a bas",
      'pn.ho.mention.long': "İstek, açık Claude Code konuşmanın giriş kutusuna dosya olarak eklendi (<code>@.claude/panoptent/…</code>). Panelde <b>Enter</b>'a bas; değişiklikler önizlemeye otomatik yansır.",
      'pn.ho.clipboard.short': 'Panoya kopyalandı — Claude Code kutusuna yapıştır',
      'pn.ho.clipboard.long': 'Claude Code kutusuna otomatik eklenemedi; istem <b>panoya kopyalandı</b>. Claude Code paneline tıklayıp <b>Cmd/Ctrl+V</b> ve <b>Enter</b>.',
      'pn.ho.newTab.short': "Yeni Claude Code sekmesinde açıldı — Enter'a bas",
      'pn.ho.newTab.long': "İstem yeni bir Claude Code sekmesinde hazır. Kontrol edip <b>Enter</b>'a bas.",
      'pn.ho.mcp.short': 'Kısa komut kopyalandı — Claude Code’a yapıştırıp Enter’a bas',
      'pn.ho.mcp.long': 'Claude Code bu değişiklik paketini MCP üzerinden Panoptent’ten kendisi alacak. Tek satırlık bir komut <b>kopyalandı</b>: Claude Code konuşmana tıkla, <b>Cmd/Ctrl+V</b> ve <b>Enter</b>. İpucu: Uygula’ya basmadan Claude Code’a <code>/mcp__panoptent__apply_queue</code> da yazabilirsin.',
      'pn.ho.mcpPrompt.short': 'Claude Code kuyruğu MCP üzerinden aldı',
      'pn.ho.mcpPrompt.long': 'Claude Code kuyruktaki değişiklikleri MCP üzerinden aldı (<code>apply_queue</code>). Her zamanki gibi buradan geri alabilirsin.',
      'pn.ho.failShort': 'Claude Code paneli açılamadı',
      'pn.ho.failLong': 'Claude Code paneli açılamadı. Gönderme yerini "Arka planda (CLI)" yapmayı dene.',
      'pn.changed': '✎ Değişti',
      'pn.auto': 'Otomatik',
    },
  });
  I18N.localize(document.body);
  document.documentElement.lang = I18N.lang;

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
  const qinfoText = $('#qinfoText') || document.createElement('span');
  const langSel = $('#langSel');
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
  let syncTimer = 0;
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

  // ---------- tasarım kuralları dosyası ----------
  const designBtn = $('#designBtn');
  let design = { mode: 'auto', file: null, missing: false };
  function renderDesign() {
    if (!designBtn) return;
    const d = design;
    designBtn.textContent = d.mode === 'off' ? t('pn.design.off')
      : d.file ? (d.mode === 'auto' ? t('pn.design.auto', d.file) : d.file)
      : d.missing ? t('pn.design.missing', d.setting) : t('pn.design.none');
  }
  if (designBtn) designBtn.addEventListener('click', () => vscode.postMessage({ type: 'chooseDesignFile' }));
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
    sideToggle.title = layout.collapsed ? t('pn.side.show') : t('pn.side.hide');
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
    const guide = ` <button class="link" data-auto>${esc(t('pn.sup.auto'))}</button> · <button class="link" data-guide>${esc(t('pn.sup.guide'))}</button>`;
    if (kind === 'code-inspector') {
      supportEl.className = 'support ok';
      supportEl.innerHTML = esc(t('pn.sup.ci'));
    } else if (kind === 'react') {
      supportEl.className = 'support ok';
      supportEl.innerHTML = esc(t('pn.sup.react'));
    } else if (kind === 'vue') {
      supportEl.className = 'support warn';
      supportEl.innerHTML = esc(t('pn.sup.vue')) + guide;
    } else {
      supportEl.className = 'support warn';
      supportEl.innerHTML = esc(t('pn.sup.none')) + guide;
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
        (it.source.exact ? '' : ` <span class="dim">(${esc(it.source.via === 'vue' ? t('pn.src.component') : t('pn.src.near'))})</span>`);
    }
    if (it.components && it.components.length) return `<span class="dim">${esc(t('pn.src.componentName', it.components[0]))}</span>`;
    return `<span class="warn">${esc(t('pn.src.unknown'))}</span>`;
  }

  // Seçim ve kuyruğun son halini eklentiye bildirir (MCP sunucusu buradan okur). Büyük görsel verisi gönderilmez.
  function syncSoon() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      vscode.postMessage({
        type: 'syncState',
        pageUrl: displayUrl(pageHref),
        viewport,
        items,
        queue: queue.map((en) => (en.dataUrl ? Object.assign({}, en, { dataUrl: undefined, hasImageData: true }) : en)),
      });
    }, 250);
  }

  function renderItems() {
    syncSoon();
    clearBtn.hidden = !items.length;
    selCount.hidden = !items.length && !queue.length;
    selCount.textContent = String(queue.length || items.length);
    selCount.classList.toggle('q', !!queue.length);
    if (!items.length) {
      itemsEl.innerHTML = '<div class="empty">' + t('pn.items.empty') + '</div>';
      return;
    }
    itemsEl.innerHTML = items.map((it, i) => {
      const cls = it.classes ? '.' + it.classes.trim().split(/\s+/).slice(0, 4).join('.') : '';
      const st = qeState[it.id];
      const qe = it.textOnly && it.source
        ? `<div class="qe"><input data-qe value="${esc(it.fullText || it.text)}" aria-label="${esc(t('pn.qe.aria'))}"><button class="secondary" data-act="qe" title="${esc(t('pn.qe.save.title'))}">${esc(t('pn.qe.save'))}</button></div>` +
          (st ? `<div class="qeMsg ${st.ok ? 'ok' : 'bad'}">${esc(st.message)}${st.ok ? '' : ` <button class="link" data-act="askText">${esc(t('pn.qe.ask'))}</button>`}</div>` : '')
        : (it.text ? `<div class="txt" title="${esc(it.text)}">“${esc(it.text)}”</div>` : '');
      return `<div class="card" data-id="${it.id}">
        <div class="cardHead" data-act="scroll" title="${esc(t('pn.card.scroll'))}">
          <span class="num">${i + 1}</span><code class="tag">&lt;${esc(it.tag)}&gt;</code><span class="cls">${esc(cls)}</span>
          <span class="grow"></span>
          <button class="icon" data-act="parent" title="${esc(t('pn.card.parent'))}">⤒</button>
          <button class="icon" data-act="remove" title="${esc(t('pn.card.remove'))}">×</button>
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
        promptEl.value = t('pn.qe.prompt', v);
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
  const KINDS = ['prompt', 'style', 'text', 'delete', 'image'];
  const kindLabel = (k) => (KINDS.indexOf(k) !== -1 ? t('pn.kind.' + k) : k);
  const vpLabel = (v) => (v === '390' || v === '1024' || v === 390 || v === 1024 ? t('pn.vpTag.' + v) : v);

  function targetLabel(en) {
    const it = (en.items || [])[0];
    if (!it) return t('pn.wholePage');
    const cls = it.classes ? '.' + it.classes.trim().split(/\s+/)[0] : '';
    const loc = it.source ? ' · ' + baseName(it.source.file) + (it.source.line ? ':' + it.source.line : '') : '';
    return `<${it.tag}${cls}>${loc}${en.items.length > 1 ? ` +${en.items.length - 1}` : ''}`;
  }
  function entrySummary(en) {
    switch (en.kind) {
      case 'prompt': return en.text;
      case 'text': return `“${en.from}” → “${en.to}”`;
      case 'delete': return t('pn.sum.delete');
      case 'image': return t('pn.sum.image', en.fileName || en.url);
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
    qinfoText.textContent = n === 1 ? t('pn.q.pending.one') : t('pn.q.pending.many');
    qinfo.hidden = qUndo.hidden = qRedo.hidden = qList.hidden = qClear.hidden = qApply.hidden = !n;
    qUndo.disabled = !undoStack.length;
    qRedo.disabled = !redoStack.length;
    qApply.disabled = applying || running;
    qApply.textContent = applying ? t('pn.q.applying') : t('pn.q.apply', n);
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
        <span class="qk qk-${esc(en.kind)}">${esc(kindLabel(en.kind))}</span>
        <div class="qmain"><div class="qt">${esc(targetLabel(en))}${en.viewportOnly ? ` <span class="qvp">${esc(vpLabel(en.viewportOnly))}</span>` : ''}</div>
        <div class="qs" title="${esc(entrySummary(en))}">${esc(entrySummary(en))}</div></div>
        <button class="icon" data-act="qdel" title="${esc(t('pn.q.remove'))}">×</button>
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
      if (popPending) popStatus('err', t('pn.busy.pop'));
      addLog('err', esc(t('pn.busy.log')));
      return false;
    }
    applying = true;
    renderQueue();
    const lines = entries.map((en) => `• ${kindLabel(en.kind)}: ${entrySummary(en)}`).join('\n');
    const meta = fromQueue
      ? (entries.length === 1 ? t('pn.meta.queue.one') : t('pn.meta.queue.many', entries.length))
      : (popPending ? t('pn.meta.quick') : (items.length ? (items.length === 1 ? t('pn.meta.sel.one') : t('pn.meta.sel.many', items.length)) : t('pn.wholePage')));
    addLog('user', `<span class="meta">${esc(meta)}</span>${esc(lines)}`);
    vscode.postMessage({
      type: 'applyEntries',
      entries,
      fromQueue,
      pageUrl: displayUrl(pageHref),
      continueSession: sendTo !== 'cli' ? contChk.checked : !!(sessionId && contChk.checked),
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
  const TOOL_KEYS = {
    Edit: 'Edit', MultiEdit: 'Edit', Write: 'Write', Read: 'Read',
    Grep: 'Grep', Glob: 'Glob', Bash: 'Bash', WebFetch: 'WebFetch', WebSearch: 'WebSearch',
  };
  const toolLabel = (name) => (TOOL_KEYS[name] ? t('pn.tool.' + TOOL_KEYS[name]) : name);
  function renderWorking() {
    if (workingEl) workingEl.innerHTML = `<span class="spin"></span><span>${esc(t('pn.working'))}</span>`;
  }
  function setRunning(on) {
    running = on;
    sendBtn.hidden = queueBtn.hidden = on;
    stopBtn.hidden = !on;
    if (on) {
      workingEl = document.createElement('div');
      workingEl.className = 'working';
      renderWorking();
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
        if (popPending) popStatus('busy', t('pn.working'));
        break;
      case 'text': sawText = true; addLog('text', mdLite(ev.text)); break;
      case 'tool': {
        const label = toolLabel(ev.name);
        addLog('tool' + (/Edit|Write/.test(ev.name) ? ' edit' : ''), `<b>${esc(label)}</b> ${esc(ev.detail)}`);
        break;
      }
      case 'done': {
        setRunning(false);
        if (!sawText && ev.summary) addLog('text', mdLite(ev.summary));
        const secs = ev.durationMs ? ' · ' + esc(t('pn.secs', Math.round(ev.durationMs / 1000))) : '';
        const files = (ev.edited || []).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ');
        if (ev.ok) addLog('done', `${esc(t('pn.done'))}${secs}${files ? '<br>' + esc(t('pn.changedFiles')) + ' ' + files : ' · ' + esc(t('pn.noFiles'))}`);
        else addLog('err', esc(t('pn.failed')) + (ev.summary ? '\n' + esc(ev.summary) : ''));
        if (popPending) {
          popPending = false;
          if (ev.ok) popStatus('ok', (ev.edited || []).length ? t('pn.pop.doneUpdating') : t('pn.pop.doneNoFiles'), 2500);
          else popStatus('err', t('pn.pop.failed'));
        }
        break;
      }
      case 'error': {
        setRunning(false);
        if (popPending) { popPending = false; popStatus('err', ev.message.split('\n')[0]); }
        const d = addLog('err', esc(ev.message) + ` <button class="link" data-settings>${esc(t('pn.settings'))}</button>`);
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
    const panel = sendTo !== 'cli';
    sendBtn.textContent = panel ? t('pn.send.panel') : t('pn.send.cli');
    contLabel.textContent = panel ? t('pn.cont.panel') : t('pn.cont.cli');
    contWrap.hidden = !panel && !sessionId;
    newSessBtn.hidden = panel || !sessionId;
    sendFrameConfig();
  }
  function sendFrameConfig() {
    toFrame({
      type: 'config',
      popover: layout.popover,
      viewport,
      lang: I18N.lang,
      nowLabel: sendTo !== 'cli' ? t('pn.now.panel') : t('pn.now.cli'),
    });
    syncSoon();
  }
  sendToSel.addEventListener('change', () => {
    sendTo = sendToSel.value;
    applySendTo();
    vscode.postMessage({ type: 'setSendTo', value: sendTo });
  });

  // ---------- arayüz dili ----------
  // langPref: kullanıcının bu panelden seçtiği tercih ('auto' | 'en' | 'tr'); ekranda gösterilir.
  let langPref = saved.langPref === 'auto' ? 'auto' : I18N.lang;
  function showLangPref() {
    if (langSel) langSel.value = langPref === 'auto' ? 'auto' : I18N.lang;
  }
  function refreshLang() {
    document.documentElement.lang = I18N.lang;
    I18N.localize(document.body);
    showLangPref();
    applyLayout(false); // sideToggle başlığı
    if (!supportEl.hidden && supportKind) showSupport(supportKind);
    renderWorking();
    renderQueue(); // renderItems'ı da çağırır
    applySendTo(); // gönder düğmesi, etiket ve overlay'e config (lang + nowLabel)
    renderDesign();
  }
  function setLangFromHost(v) {
    if (langPref !== 'auto') langPref = I18N.norm(v);
    if (!I18N.setLang(v)) showLangPref(); // değiştiyse onChange → refreshLang
  }
  I18N.onChange(refreshLang);
  if (langSel) {
    langSel.addEventListener('change', () => {
      const v = langSel.value;
      langPref = v === 'auto' ? 'auto' : I18N.norm(v);
      persist({ langPref: langPref === 'auto' ? 'auto' : undefined });
      vscode.postMessage({ type: 'setLang', value: v });
      if (v !== 'auto') I18N.setLang(v); // anında geçiş; host'tan 'lang' de gelecek
      showLangPref();
    });
  }

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
        syncSoon();
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
          popStatus('ok', t('pn.queued', queue.length), 1100);
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
        if (m.lang) setLangFromHost(m.lang);
        if (m.layout && !(vscode.getState() || {}).layout) {
          layout = Object.assign(layout, m.layout);
          applyLayout(false);
        }
        sendTo = m.sendTo || 'claudePanel';
        claudeExt = m.claudeExt !== false;
        canRollback = !!m.canRollback;
        openOnSelect = m.openOnSelect !== false;
        openSrcChk.checked = openOnSelect;
        if (m.design) { design = m.design; renderDesign(); }
        applySendTo();
        if (sendTo !== 'cli' && !claudeExt) {
          addLog('err', esc(t('pn.noClaudeExt')));
        }
        proxyBase = m.proxyBase;
        target = m.target;
        urlInput.value = target + (m.initialPath || '/');
        navigate(m.initialPath || '/');
        renderQueue();
        break;
      case 'lang':
        if (m.value) setLangFromHost(m.value);
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
      case 'design':
        design = m;
        renderDesign();
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
        if (m.direct) addLog('done', esc(Number(m.direct) === 1 ? t('pn.direct.one') : t('pn.direct.many', m.direct)));
        if (m.ok && !m.sent && popPending) { popPending = false; popStatus('ok', t('pn.pop.direct'), 1600); }
        if (!m.ok) {
          if (!m.reported) addLog('err', esc(m.message || t('pn.applyFailed')));
          if (popPending) { popPending = false; popStatus('err', m.message || t('pn.applyFailed')); }
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
        if (m.ok) {
          const links = (m.files || []).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ') || esc(t('pn.rollback.none'));
          addLog('done', esc(t('pn.rollback.done', '\u0000')).replace('\u0000', links));
        } else if (m.message) addLog('err', esc(m.message));
        if (m.conflicts && m.conflicts.length) addLog('err', esc(t('pn.rollback.untouched')) + '\n' + m.conflicts.map(esc).join('\n'));
        renderQueue();
        if (m.ok && supportKind === 'none') setTimeout(reloadFrame, 300);
        break;
      case 'handoff': {
        const how = ['mention', 'clipboard', 'mcp', 'mcpPrompt'].includes(m.how) ? m.how : 'newTab';
        if (popPending) {
          popPending = false;
          popStatus(m.ok ? 'ok' : 'err', m.ok ? t('pn.ho.' + how + '.short') : t('pn.ho.failShort'), 2600);
        }
        if (m.ok) {
          lastHandoff = Date.now();
          addLog('handoff', '<b>→ Claude Code.</b> ' + t('pn.ho.' + how + '.long'));
        } else {
          addLog('err', esc(t('pn.ho.failLong')));
        }
        break;
      }
      case 'filesChanged': {
        const recent = running || Date.now() - lastHandoff < 20 * 60 * 1000;
        if (recent && m.files && m.files.length && !running) {
          const shown = m.files.slice(0, 4).map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ');
          addLog('tool edit', `<b>${esc(t('pn.changed'))}</b> ${shown}${m.files.length > 4 ? ` +${m.files.length - 4}` : ''}`);
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
        addLog('user', `<span class="meta">${esc(t('pn.auto'))}</span>${esc(m.text)}`);
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
  showLangPref();
  vscode.postMessage({ type: 'ready' });
})();
