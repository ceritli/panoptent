// Panoptent — Chrome içerik betiği (izole dünya)
// Sayfaya seçim katmanını (overlay.js, sayfanın kendi dünyasında) yükler, altta kuyruk/Uygula
// çubuğunu gösterir ve arka plan üzerinden VS Code'daki Panoptent ile konuşur.
(() => {
  'use strict';
  if (window.top !== window || window.__panoptentContent) return;
  window.__panoptentContent = true;

  const I18N = window.PanoptentI18n;
  I18N.add({
    en: {
      'cx.tab.queue': 'Queue', 'cx.tab.log': 'Activity', 'cx.tab.settings': 'Settings',
      'cx.logoTitle': 'Panoptent — toggle panel',
      'cx.searching': 'Looking for VS Code…',
      'cx.selTitle': 'Selection mode (Alt+Shift+E) — you can also hold Alt and click to select',
      'cx.select': 'Select',
      'cx.changes.one': 'change', 'cx.changes.many': 'changes',
      'cx.undoTitle': 'Undo (Ctrl/Cmd+Z)', 'cx.redoTitle': 'Redo (Ctrl/Cmd+Shift+Z)',
      'cx.list': 'List', 'cx.apply': 'Apply', 'cx.applyN': 'Apply ({0})', 'cx.applying': 'Applying…',
      'cx.claudeRunning': 'Claude is working…',
      'cx.rollbackTitle': 'Undo only the changes Panoptent made in the last apply',
      'cx.rollback': '↶ Undo last apply',
      'cx.gearTitle': 'Settings', 'cx.minTitle': 'Minimize',
      'cx.notConnected': 'Not connected to VS Code.',
      'cx.notConnectedShort': 'Not connected to VS Code',
      'cx.notConnectedLong': 'Not connected to VS Code. Your project must be open in VS Code with Panoptent installed.',
      'cx.notConnectedQueued': 'Not connected to VS Code; your changes are waiting in the queue.',
      'cx.rollbackConfirm': 'A confirmation dialog opened in VS Code.',
      'cx.busy': 'A previous operation is still running.',
      'cx.logQueue.one': 'Queue · {0} change', 'cx.logQueue.many': 'Queue · {0} changes',
      'cx.logQuick': 'Quick box', 'cx.logAuto': 'Automatic',
      'cx.kind.prompt': 'Request', 'cx.kind.style': 'Style', 'cx.kind.text': 'Text', 'cx.kind.delete': 'Delete', 'cx.kind.image': 'Image',
      'cx.vp.390': 'mobile', 'cx.vp.1024': 'tablet',
      'cx.wholePage': 'Whole page', 'cx.removeEl': 'Remove element', 'cx.newImage': 'New image: {0}',
      'cx.tool.Edit': '✎ Edited', 'cx.tool.MultiEdit': '✎ Edited', 'cx.tool.Write': '✎ Wrote', 'cx.tool.Read': '◦ Read',
      'cx.tool.Grep': '⌕ Searched', 'cx.tool.Glob': '⌕ Searched files', 'cx.tool.Bash': '$ Command',
      'cx.emptyQueue': 'Press <b>Select</b> (or hold <kbd>Alt</kbd> and click) and click an element on the page. In the box that opens next to it you can write a request, change its style, double-click its text to edit it, or delete it. <kbd>Ctrl/⌘+Enter</kbd> adds to the queue, <kbd>Ctrl/⌘+Shift+Enter</kbd> sends right away.',
      'cx.clear': 'Clear', 'cx.applyAll': 'Apply all',
      'cx.emptyLog': 'Nothing yet.', 'cx.stop': 'Stop',
      'cx.connOk': '✓ Connected to VS Code: <b>{0}</b>',
      'cx.connFound': 'Found the <b>{0}</b> window in VS Code.',
      'cx.pressAllow': 'Click <b>Allow</b> in the dialog that opened in VS Code.',
      'cx.connect': 'Connect',
      'cx.connNone': 'VS Code not found. Your project must be open in VS Code with the <b>Panoptent</b> extension installed.',
      'cx.workspace': 'Workspace',
      'cx.sendToLbl': 'Where requests go',
      'cx.sendTo.panel': 'Claude Code panel in VS Code',
      'cx.sendTo.cli': 'In the background (Claude Code CLI)',
      'cx.sendTo.mcp': 'Claude Code in VS Code, over MCP (no request file)',
      'cx.cont': 'Add to the open Claude Code conversation',
      'cx.pop': 'Open a box next to the element on select',
      'cx.openSrc': 'Open its code in VS Code on select',
      'cx.srcLbl': 'Source mapping',
      'cx.srcOk': '✓ Source mapping is active: elements are linked to file and line.',
      'cx.srcNone': 'No source mapping; Claude finds the element by searching.',
      'cx.ciSetup': 'Set up code-inspector automatically',
      'cx.off': 'Turn off Panoptent on this site',
      'cx.langLbl': 'Language', 'cx.lang.auto': 'VS Code setting (auto)',
      'cx.designLbl': 'Design rules file', 'cx.design.auto': '{0} (automatic)', 'cx.design.none': 'none', 'cx.design.off': 'off',
      'cx.design.missing': '{0} not found', 'cx.design.choose': 'Choose in VS Code', 'cx.design.chooseToast': 'A file picker opened in VS Code.',
      'cx.connectFirst': 'Connect to VS Code first.',
      'cx.ciStarted': 'Setup started in VS Code.',
      'cx.pairing': 'Waiting for pairing', 'cx.notFound': 'VS Code not found',
      'cx.sendNow': 'Send now', 'cx.runNow': 'Run now',
      'cx.queued': 'Added to queue · {0} total',
      'cx.askPair': 'VS Code is asking for connection permission: click <b>Allow</b> in the dialog that opened in VS Code.',
      'cx.direct.one': '✓ {0} text change was written directly to the file without AI.',
      'cx.direct.many': '✓ {0} text changes were written directly to the file without AI.',
      'cx.directToast': '✓ Written directly to the file', 'cx.directPop': 'Written directly to the file',
      'cx.failed': 'Could not apply.',
      'cx.ho.mention': 'Added to your Claude Code conversation — press Enter in VS Code',
      'cx.ho.mentionLong': 'The request was added to the open Claude Code conversation in VS Code. Press <b>Enter</b> there; the changes will show up on this page automatically.',
      'cx.ho.clipboard': 'Copied to clipboard — paste it into the Claude Code box',
      'cx.ho.clipboardLong': 'The prompt was <b>copied to the clipboard</b>; paste it into the Claude Code box in VS Code and press <b>Enter</b>.',
      'cx.ho.newTab': 'Opened in a new Claude Code tab in VS Code — press Enter',
      'cx.ho.newTabLong': 'The prompt is ready in a new Claude Code tab in VS Code; press <b>Enter</b>.',
      'cx.ho.mcp': 'Short command copied — paste it into Claude Code in VS Code',
      'cx.ho.mcpLong': 'Claude Code will fetch this change set from Panoptent over MCP. A one-line command was <b>copied</b>: paste it into your Claude Code conversation in VS Code and press <b>Enter</b>. Tip: you can also type <code>/mcp__panoptent__apply_queue</code> there instead of pressing Apply.',
      'cx.ho.mcpPrompt': 'Claude Code took the queue over MCP',
      'cx.ho.mcpPromptLong': 'Claude Code took the queued changes over MCP (<code>apply_queue</code>). You can undo them as usual.',
      'cx.panelFail': 'Couldn’t open the Claude Code panel', 'cx.panelFailLog': 'Couldn’t open the Claude Code panel.',
      'cx.done': '✓ Done', 'cx.changedFiles': 'Changed: {0}', 'cx.noFiles': ' · no files changed',
      'cx.claudeFail': 'Claude couldn’t finish the job.', 'cx.claudeFailShort': 'Claude couldn’t finish the job',
      'cx.doneShort': 'Done', 'cx.claudeDone': '✓ Claude finished',
      'cx.changed': '✎ Changed',
      'cx.rolledBack': '↶ Panoptent’s changes were reverted: {0}', 'cx.rolledBackToast': '↶ Reverted',
      'cx.untouched': 'Left untouched:',
    },
    tr: {
      'cx.tab.queue': 'Kuyruk', 'cx.tab.log': 'Etkinlik', 'cx.tab.settings': 'Ayarlar',
      'cx.logoTitle': 'Panoptent — paneli aç/kapat',
      'cx.searching': 'VS Code aranıyor…',
      'cx.selTitle': 'Seçim modu (Alt+Shift+E) — Alt basılıyken tıklayarak da seçebilirsin',
      'cx.select': 'Seç',
      'cx.changes.one': 'değişiklik', 'cx.changes.many': 'değişiklik',
      'cx.undoTitle': 'Geri al (Ctrl/Cmd+Z)', 'cx.redoTitle': 'Yinele (Ctrl/Cmd+Shift+Z)',
      'cx.list': 'Listele', 'cx.apply': 'Uygula', 'cx.applyN': 'Uygula ({0})', 'cx.applying': 'Uygulanıyor…',
      'cx.claudeRunning': 'Claude çalışıyor…',
      'cx.rollbackTitle': "Son uygulamada yalnızca Panoptent'in yaptığı değişiklikleri geri al",
      'cx.rollback': '↶ Son uygulamayı geri al',
      'cx.gearTitle': 'Ayarlar', 'cx.minTitle': 'Küçült',
      'cx.notConnected': 'VS Code’a bağlı değil.',
      'cx.notConnectedShort': 'VS Code’a bağlı değil',
      'cx.notConnectedLong': 'VS Code’a bağlı değil. VS Code’da proje açık ve Panoptent kurulu olmalı.',
      'cx.notConnectedQueued': 'VS Code’a bağlı değil; değişiklikler kuyrukta bekliyor.',
      'cx.rollbackConfirm': 'Onay penceresi VS Code’da açıldı.',
      'cx.busy': 'Önceki işlem hâlâ sürüyor.',
      'cx.logQueue.one': 'Kuyruk · {0} değişiklik', 'cx.logQueue.many': 'Kuyruk · {0} değişiklik',
      'cx.logQuick': 'Hızlı kutu', 'cx.logAuto': 'Otomatik',
      'cx.kind.prompt': 'İstek', 'cx.kind.style': 'Stil', 'cx.kind.text': 'Metin', 'cx.kind.delete': 'Sil', 'cx.kind.image': 'Görsel',
      'cx.vp.390': 'mobil', 'cx.vp.1024': 'tablet',
      'cx.wholePage': 'Tüm sayfa', 'cx.removeEl': 'Öğeyi kaldır', 'cx.newImage': 'Yeni görsel: {0}',
      'cx.tool.Edit': '✎ Düzenledi', 'cx.tool.MultiEdit': '✎ Düzenledi', 'cx.tool.Write': '✎ Yazdı', 'cx.tool.Read': '◦ Okudu',
      'cx.tool.Grep': '⌕ Aradı', 'cx.tool.Glob': '⌕ Dosya aradı', 'cx.tool.Bash': '$ Komut',
      'cx.emptyQueue': "<b>Seç</b>'e bas (veya <kbd>Alt</kbd> basılıyken tıkla) ve sayfada bir öğeye tıkla. Yanında açılan kutudan istek yazabilir, stilini değiştirebilir, metnine çift tıklayıp düzenleyebilir ya da silebilirsin. <kbd>Ctrl/⌘+Enter</kbd> kuyruğa ekler, <kbd>Ctrl/⌘+Shift+Enter</kbd> hemen gönderir.",
      'cx.clear': 'Temizle', 'cx.applyAll': 'Hepsini uygula',
      'cx.emptyLog': 'Henüz bir şey yok.', 'cx.stop': 'Durdur',
      'cx.connOk': '✓ VS Code’a bağlı: <b>{0}</b>',
      'cx.connFound': 'VS Code’daki <b>{0}</b> penceresi bulundu.',
      'cx.pressAllow': 'VS Code’da çıkan pencerede <b>İzin ver</b>’e bas.',
      'cx.connect': 'Bağlan',
      'cx.connNone': 'VS Code bulunamadı. Projen VS Code’da açık ve <b>Panoptent</b> eklentisi kurulu olmalı.',
      'cx.workspace': 'Çalışma alanı',
      'cx.sendToLbl': 'İstek nereye gitsin',
      'cx.sendTo.panel': 'VS Code’daki Claude Code paneli',
      'cx.sendTo.cli': 'Arka planda (Claude Code CLI)',
      'cx.sendTo.mcp': 'VS Code’daki Claude Code, MCP ile (istek dosyası yok)',
      'cx.cont': 'Açık Claude Code konuşmasına ekle',
      'cx.pop': 'Seçince öğenin yanında kutu aç',
      'cx.openSrc': 'Seçince kodunu VS Code’da aç',
      'cx.srcLbl': 'Kaynak eşleştirme',
      'cx.srcOk': '✓ Kaynak eşleştirme aktif: öğeler dosya ve satıra bağlanıyor.',
      'cx.srcNone': 'Kaynak eşleştirme yok; Claude öğeyi arayarak bulur.',
      'cx.ciSetup': 'code-inspector’ı otomatik kur',
      'cx.off': 'Bu sitede Panoptent’i kapat',
      'cx.langLbl': 'Dil', 'cx.lang.auto': 'VS Code ayarı (otomatik)',
      'cx.designLbl': 'Tasarım kuralları dosyası', 'cx.design.auto': '{0} (otomatik)', 'cx.design.none': 'yok', 'cx.design.off': 'kapalı',
      'cx.design.missing': '{0} bulunamadı', 'cx.design.choose': 'VS Code’da seç', 'cx.design.chooseToast': 'VS Code’da dosya seçme penceresi açıldı.',
      'cx.connectFirst': 'Önce VS Code’a bağlan.',
      'cx.ciStarted': 'Kurulum VS Code’da başladı.',
      'cx.pairing': 'Eşleştirme bekliyor', 'cx.notFound': 'VS Code bulunamadı',
      'cx.sendNow': 'Hemen aktar', 'cx.runNow': 'Hemen çalıştır',
      'cx.queued': 'Kuyruğa eklendi · toplam {0}',
      'cx.askPair': 'VS Code bağlantı izni istiyor: VS Code’da çıkan pencerede <b>İzin ver</b>’e bas.',
      'cx.direct.one': '✓ {0} metin değişikliği AI kullanmadan doğrudan dosyaya yazıldı.',
      'cx.direct.many': '✓ {0} metin değişikliği AI kullanmadan doğrudan dosyaya yazıldı.',
      'cx.directToast': '✓ Doğrudan dosyaya yazıldı', 'cx.directPop': 'Doğrudan dosyaya yazıldı',
      'cx.failed': 'Uygulanamadı.',
      'cx.ho.mention': 'Claude Code konuşmana eklendi — VS Code’da Enter’a bas',
      'cx.ho.mentionLong': 'İstek, VS Code’daki açık Claude Code konuşmasına eklendi. Orada <b>Enter</b>’a bas; değişiklikler bu sayfaya otomatik yansır.',
      'cx.ho.clipboard': 'Panoya kopyalandı — Claude Code kutusuna yapıştır',
      'cx.ho.clipboardLong': 'İstem <b>panoya kopyalandı</b>; VS Code’daki Claude Code kutusuna yapıştırıp <b>Enter</b>’a bas.',
      'cx.ho.newTab': 'VS Code’da yeni Claude Code sekmesinde açıldı — Enter’a bas',
      'cx.ho.newTabLong': 'İstem VS Code’da yeni bir Claude Code sekmesinde hazır; <b>Enter</b>’a bas.',
      'cx.ho.mcp': 'Kısa komut kopyalandı — VS Code’daki Claude Code’a yapıştır',
      'cx.ho.mcpLong': 'Claude Code bu değişiklik paketini MCP üzerinden Panoptent’ten kendisi alacak. Tek satırlık bir komut <b>kopyalandı</b>: VS Code’daki Claude Code konuşmana yapıştırıp <b>Enter</b>’a bas. İpucu: Uygula’ya basmadan oraya <code>/mcp__panoptent__apply_queue</code> da yazabilirsin.',
      'cx.ho.mcpPrompt': 'Claude Code kuyruğu MCP üzerinden aldı',
      'cx.ho.mcpPromptLong': 'Claude Code kuyruktaki değişiklikleri MCP üzerinden aldı (<code>apply_queue</code>). Her zamanki gibi geri alabilirsin.',
      'cx.panelFail': 'Claude Code paneli açılamadı', 'cx.panelFailLog': 'Claude Code paneli açılamadı.',
      'cx.done': '✓ Tamamlandı', 'cx.changedFiles': 'Değişen: {0}', 'cx.noFiles': ' · dosya değişmedi',
      'cx.claudeFail': 'Claude işi bitiremedi.', 'cx.claudeFailShort': 'Claude işi bitiremedi',
      'cx.doneShort': 'Tamamlandı', 'cx.claudeDone': '✓ Claude tamamladı',
      'cx.changed': '✎ Değişti',
      'cx.rolledBack': '↶ Panoptent’in değişiklikleri geri alındı: {0}', 'cx.rolledBackToast': '↶ Geri alındı',
      'cx.untouched': 'Dokunulmadı:',
    },
  });
  const t = I18N.t;
  const plural = (n, key) => t(key + (n === 1 ? '.one' : '.many'), n);

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
  let settings = { sendTo: 'claudePanel', openOnSelect: true, claudeExt: true, design: null };
  const logs = [];
  // Dil: VS Code ayarı esas; bağlı değilken yerel seçim ('lang') geçici olarak kullanılır.
  let langPref = 'auto'; // ayarlar sekmesindeki seçicinin gösterdiği değer

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const baseName = (p) => String(p).split(/[\\/]/).pop();
  let seq = 0;
  let syncTimer = 0;
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
      <div class="tabs"><button data-tab="queue" data-i18n="cx.tab.queue">Queue</button><button data-tab="log" data-i18n="cx.tab.log">Activity</button><button data-tab="settings" data-i18n="cx.tab.settings">Settings</button></div>
      <div class="body" id="dbody"></div>
      <div class="foot" id="dfoot"></div>
    </div>
    <div class="bar" id="bar">
      <button class="b logo" id="logo" data-i18n-title="cx.logoTitle">${EYE}</button>
      <span class="dot" id="dot"></span><span class="ws" id="ws" data-i18n="cx.searching">Looking for VS Code…</span>
      <span class="sep"></span>
      <button class="b sel" id="sel" aria-pressed="false" data-i18n-title="cx.selTitle">${SEL}<span data-i18n="cx.select">Select</span></button>
      <span class="sep" id="qsep" hidden></span>
      <span class="qn" id="qn" hidden><span class="qdot"></span><b id="qc">0</b> <span id="qcl">changes</span></span>
      <button class="b" id="undo" data-i18n-title="cx.undoTitle" hidden>↶</button>
      <button class="b" id="redo" data-i18n-title="cx.redoTitle" hidden>↷</button>
      <button class="b" id="list" data-i18n="cx.list" hidden>List</button>
      <button class="b pri" id="apply" data-i18n="cx.apply" hidden>Apply</button>
      <span class="sep" id="rsep" hidden></span>
      <button class="b" id="rollback" hidden data-i18n-title="cx.rollbackTitle" data-i18n="cx.rollback">↶ Undo last apply</button>
      <span class="sep"></span>
      <button class="b" id="gear" data-i18n-title="cx.gearTitle">⚙</button>
      <button class="b" id="minBtn" data-i18n-title="cx.minTitle">–</button>
    </div>
  </div>
  <button class="mini" id="mini" hidden title="Panoptent">${EYE}<span class="n" id="miniN" hidden>0</span></button>`;
  const $ = (id) => root.getElementById(id);
  const wrap = $('wrap'), bar = $('bar'), drawer = $('drawer'), dbody = $('dbody'), dfoot = $('dfoot'), toasts = $('toasts');

  // ---------- dil ----------
  function nowLabel() { return settings.sendTo === 'cli' ? t('cx.runNow') : t('cx.sendNow'); }
  function markLang() {
    // seçim katmanının i18n çekirdeği yüklenirken bu özniteliği okur
    document.documentElement.setAttribute('data-panoptent-lang', I18N.lang);
  }
  function relocalize() {
    markLang();
    I18N.localize(root);
    render();
    toOverlay({ type: 'config', lang: I18N.lang, nowLabel: nowLabel() });
  }
  I18N.onChange(relocalize);
  /** VS Code'dan gelen dil (esas kaynak). Yerel geçici seçimi siler. */
  function langFromVS(l) {
    if (!l) return;
    try { chrome.storage.local.remove('lang'); } catch (e) { /* eklenti yeniden yüklendi */ }
    if (!I18N.setLang(l)) markLang();
  }
  markLang();
  I18N.localize(root);

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
    markLang();
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
    clearTimeout(syncTimer);
    bg({ type: 'syncState', closed: true });
  }

  chrome.storage.local.get([KEY_ON, KEY_Q, KEY_UI, 'lang', 'vsLang', 'langPref'], (o) => {
    if (o.langPref) langPref = o.langPref;
    const l = o.lang || o.vsLang;
    if (l) I18N.setLang(l);
    markLang();
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
    toOverlay({ type: 'config', active: enabled, popover: ui.popover, viewport, lang: I18N.lang, nowLabel: nowLabel() });
  }
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(sendConfig, 200); });

  // ---------- kuyruk ----------
  const KINDS = ['prompt', 'style', 'text', 'delete', 'image'];
  const kindLabel = (k) => (KINDS.indexOf(k) !== -1 ? t('cx.kind.' + k) : k);
  const vpLabel = (v) => (v === '390' || v === '1024' ? t('cx.vp.' + v) : v);
  function targetLabel(en) {
    const it = (en.items || [])[0];
    if (!it) return t('cx.wholePage');
    const cls = it.classes ? '.' + it.classes.trim().split(/\s+/)[0] : '';
    const loc = it.source ? ' · ' + baseName(it.source.file) + (it.source.line ? ':' + it.source.line : '') : '';
    return `<${it.tag}${cls}>${loc}${en.items.length > 1 ? ` +${en.items.length - 1}` : ''}`;
  }
  function summary(en) {
    switch (en.kind) {
      case 'prompt': return en.text;
      case 'text': return `“${en.from}” → “${en.to}”`;
      case 'delete': return t('cx.removeEl');
      case 'image': return t('cx.newImage', en.fileName || en.url);
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
    if (!connected()) return toast(t('cx.notConnected'), 'err');
    bg({ type: 'rollback' });
    toast(t('cx.rollbackConfirm'), '', 2500);
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
      toast(t('cx.notConnectedLong'), 'err', 5000);
      if (popPending) { popPending = false; popStatus('err', t('cx.notConnectedShort')); }
      return false;
    }
    if (running || applying) {
      toast(t('cx.busy'), 'err');
      if (popPending) { popPending = false; popStatus('err', t('cx.busy')); }
      return false;
    }
    applying = true;
    addLog('user', () => {
      const lines = entries.map((en) => `• ${kindLabel(en.kind)}: ${summary(en)}`).join('\n');
      return `<span class="meta">${fromQueue ? plural(entries.length, 'cx.logQueue') : t('cx.logQuick')}</span>${esc(lines)}`;
    });
    bg({ type: 'applyEntries', entries, fromQueue, pageUrl: location.href, continueSession: settings.sendTo !== 'cli' ? ui.cont : false });
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

  /** html: dize ya da (dil değişince yeniden üretilebilmesi için) dize döndüren fonksiyon */
  function addLog(cls, html) {
    logs.push({ cls, html });
    if (logs.length > 120) logs.shift();
    if (ui.drawer && ui.tab === 'log') renderDrawer();
  }
  const logHtml = (l) => (typeof l.html === 'function' ? l.html() : l.html);
  const mdLite = (s) => esc(s).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
  const TOOLS = ['Edit', 'MultiEdit', 'Write', 'Read', 'Grep', 'Glob', 'Bash'];
  const toolLabel = (n) => (TOOLS.indexOf(n) !== -1 ? t('cx.tool.' + n) : n);
  const fileLinks = (files) => files.map((f) => `<a data-file="${esc(f)}">${esc(f)}</a>`).join(', ');

  function renderDrawer() {
    root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
    dfoot.innerHTML = '';
    if (ui.tab === 'queue') {
      dbody.innerHTML = queue.length
        ? queue.map((en) => `<div class="qi" data-token="${esc(en.token)}"><span class="qk k-${esc(en.kind)}">${esc(kindLabel(en.kind))}</span>
            <div class="qm"><div class="qt">${esc(targetLabel(en))}${en.viewportOnly ? `<span class="vp">${esc(vpLabel(en.viewportOnly))}</span>` : ''}</div>
            <div class="qs" title="${esc(summary(en))}">${esc(summary(en))}</div></div><button class="x" data-del>×</button></div>`).join('')
        : `<div class="empty">${t('cx.emptyQueue')}</div>`;
      if (queue.length) {
        dfoot.innerHTML = `<button class="btn2" id="dclear">${esc(t('cx.clear'))}</button><button class="b pri" id="dapply">${esc(t('cx.applyAll'))}</button>`;
        root.getElementById('dclear').addEventListener('click', qClear);
        root.getElementById('dapply').addEventListener('click', () => applyQueue());
      }
      dbody.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => qRemove(b.closest('.qi').dataset.token)));
    } else if (ui.tab === 'log') {
      dbody.innerHTML = logs.length ? logs.map((l) => `<div class="ev ${l.cls}">${logHtml(l)}</div>`).join('') + (running ? `<div class="ev"><span class="spin"></span>${esc(t('cx.claudeRunning'))}</div>` : '') : `<div class="empty">${esc(t('cx.emptyLog'))}</div>`;
      dbody.querySelectorAll('[data-file]').forEach((a) => a.addEventListener('click', () => bg({ type: 'openFile', file: a.dataset.file })));
      dbody.scrollTop = dbody.scrollHeight;
      if (running) {
        dfoot.innerHTML = `<button class="btn2" id="dstop">${esc(t('cx.stop'))}</button>`;
        root.getElementById('dstop').addEventListener('click', () => bg({ type: 'stop' }));
      }
    } else {
      const ready = workspaces.filter((w) => w.state === 'ready');
      const waiting = workspaces.filter((w) => w.state === 'needPair' || w.state === 'pairing');
      let conn;
      if (connected()) {
        conn = `<div class="card ok">${t('cx.connOk', esc((workspaces.find((w) => w.port === activePort) || {}).name))}</div>`;
      } else if (waiting.length) {
        conn = `<div class="card warn">${t('cx.connFound', esc(waiting[0].name))} ${waiting.some((w) => w.state === 'pairing') ? t('cx.pressAllow') : `<span class="link" id="pairBtn">${esc(t('cx.connect'))}</span>`}</div>`;
      } else {
        conn = `<div class="card warn">${t('cx.connNone')}</div>`;
      }
      const wsSel = ready.length > 1
        ? `<div class="lbl">${esc(t('cx.workspace'))}</div><div class="row"><select id="wsSel">${ready.map((w) => `<option value="${w.port}" ${w.port === activePort ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>`
        : '';
      const src = supportKind === 'code-inspector' || supportKind === 'react'
        ? `<div class="card ok">${esc(t('cx.srcOk'))}</div>`
        : `<div class="card warn">${esc(t('cx.srcNone'))} <span class="link" id="ciBtn">${esc(t('cx.ciSetup'))}</span></div>`;
      const langOpts = [`<option value="auto">${esc(t('cx.lang.auto'))}</option>`]
        .concat(I18N.LANGS.map((l) => `<option value="${l.code}">${esc(l.name)}</option>`)).join('');
      dbody.innerHTML = conn + wsSel + `
        <div class="lbl">${esc(t('cx.sendToLbl'))}</div>
        <div class="row"><select id="sendTo"><option value="claudePanel">${esc(t('cx.sendTo.panel'))}</option><option value="cli">${esc(t('cx.sendTo.cli'))}</option><option value="mcp">${esc(t('cx.sendTo.mcp'))}</option></select></div>
        <div class="row"><label><input type="checkbox" id="cont"> ${esc(t('cx.cont'))}</label></div>
        <div class="row"><label><input type="checkbox" id="pop"> ${esc(t('cx.pop'))}</label></div>
        <div class="row"><label><input type="checkbox" id="openSrc"> ${esc(t('cx.openSrc'))}</label></div>
        <div class="lbl">${esc(t('cx.designLbl'))}</div>
        <div class="row">${esc(designText())} · <span class="link" id="designBtn">${esc(t('cx.design.choose'))}</span></div>
        <div class="lbl">${esc(t('cx.langLbl'))}</div>
        <div class="row"><select id="langSel">${langOpts}</select></div>
        <div class="lbl">${esc(t('cx.srcLbl'))}</div>${src}
        <div class="row"><span class="link" id="offBtn">${esc(t('cx.off'))}</span></div>`;
      const g = (id) => root.getElementById(id);
      g('langSel').value = langPref === I18N.lang ? langPref : 'auto'; // VS Code başka dil gönderdiyse seçim geçersiz
      g('langSel').addEventListener('change', (e) => setLangPref(e.target.value));
      g('sendTo').value = settings.sendTo;
      g('cont').checked = ui.cont;
      g('cont').disabled = settings.sendTo === 'cli';
      g('pop').checked = ui.popover;
      g('openSrc').checked = settings.openOnSelect;
      g('sendTo').addEventListener('change', (e) => { settings.sendTo = e.target.value; bg({ type: 'setSendTo', value: settings.sendTo }); sendConfig(); renderDrawer(); });
      g('cont').addEventListener('change', (e) => { ui.cont = e.target.checked; saveUi(); });
      g('pop').addEventListener('change', (e) => { ui.popover = e.target.checked; saveUi(); sendConfig(); });
      g('openSrc').addEventListener('change', (e) => { settings.openOnSelect = e.target.checked; bg({ type: 'setOpenOnSelect', value: settings.openOnSelect }); });
      g('offBtn').addEventListener('click', disable);
      g('designBtn').addEventListener('click', () => { if (!connected()) return toast(t('cx.connectFirst'), 'err'); bg({ type: 'chooseDesignFile' }); toast(t('cx.design.chooseToast'), 'ok'); });
      if (g('pairBtn')) g('pairBtn').addEventListener('click', () => { pairAsked = true; bg({ type: 'pair' }); toast(t('cx.pressAllow'), '', 5000); });
      if (g('ciBtn')) g('ciBtn').addEventListener('click', () => { if (!connected()) return toast(t('cx.connectFirst'), 'err'); bg({ type: 'setupCodeInspector' }); toast(t('cx.ciStarted'), 'ok'); });
      if (g('wsSel')) g('wsSel').addEventListener('change', (e) => bg({ type: 'chooseWorkspace', port: Number(e.target.value) }));
    }
  }

  /** Ayarlar sekmesindeki dil seçimi: bağlıyken VS Code ayarını değiştirir, değilse yalnızca yerelde. */
  function setLangPref(v) {
    langPref = v;
    chrome.storage.local.set({ langPref: v });
    if (connected()) {
      bg({ type: 'setLang', value: v });
      if (v !== 'auto') I18N.setLang(v); // VS Code 'lang' ile onaylayacak
      return;
    }
    if (v === 'auto') {
      chrome.storage.local.remove('lang');
      chrome.storage.local.get('vsLang', (o) => {
        if (!I18N.setLang(o.vsLang || navigator.language)) render();
      });
    } else {
      chrome.storage.local.set({ lang: v });
      I18N.setLang(v);
    }
  }

  // Seçim ve kuyruğun son halini VS Code'a bildirir (MCP sunucusu buradan okur). Büyük görsel verisi gönderilmez.
  function syncSoon() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (!enabled || !connected()) return;
      bg({
        type: 'syncState',
        pageUrl: location.href,
        viewport,
        items,
        queue: queue.map((en) => (en.dataUrl ? Object.assign({}, en, { dataUrl: undefined, hasImageData: true }) : en)),
      });
    }, 250);
  }

  function designText() {
    const d = settings.design;
    if (!d) return '—';
    if (d.mode === 'off') return t('cx.design.off');
    if (d.file) return d.mode === 'auto' ? t('cx.design.auto', d.file) : d.file;
    return d.missing ? t('cx.design.missing', d.setting) : t('cx.design.none');
  }

  function render() {
    if (!enabled) return;
    syncSoon();
    mountUI();
    const n = queue.length;
    const w = workspaces.find((x) => x.port === activePort);
    const dot = $('dot');
    if (connected()) { dot.className = 'dot ok'; $('ws').textContent = w.name; }
    else if (workspaces.some((x) => x.state === 'pairing' || x.state === 'needPair')) { dot.className = 'dot wait'; $('ws').textContent = t('cx.pairing'); }
    else { dot.className = 'dot off'; $('ws').textContent = t('cx.notFound'); }
    $('qsep').hidden = $('qn').hidden = $('list').hidden = $('apply').hidden = !n;
    $('undo').hidden = !n && !undoStack.length;
    $('redo').hidden = !n && !redoStack.length;
    $('undo').disabled = !undoStack.length;
    $('redo').disabled = !redoStack.length;
    $('qc').textContent = String(n);
    $('qcl').textContent = t(n === 1 ? 'cx.changes.one' : 'cx.changes.many');
    $('apply').disabled = applying || running;
    $('apply').textContent = applying ? t('cx.applying') : running ? t('cx.claudeRunning') : t('cx.applyN', n);
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
        syncSoon();
        if (m.item.source) {
          bg({ type: 'hint', file: m.item.source.file });
          if (!m.additive && settings.openOnSelect && connected()) bg({ type: 'openSource', item: m.item, quiet: true });
        }
        break;
      case 'replace': {
        const i = items.findIndex((x) => x.id === m.oldId);
        if (i !== -1) items[i] = m.item;
        syncSoon();
        if (m.nav && settings.openOnSelect && m.item.source && connected()) bg({ type: 'openSource', item: m.item, quiet: true });
        break;
      }
      case 'unselect':
        items = items.filter((x) => x.id !== m.id);
        syncSoon();
        break;
      case 'commit':
        if (!userJustActed()) return; // sayfa betiklerinden gelen sahte istekleri yok say
        if (m.mode === 'queue') {
          qAdd(m.entries);
          popStatus('ok', t('cx.queued', queue.length), 1100);
        } else {
          popPending = true;
          if (!dispatch(m.entries, false)) toOverlay({ type: 'revert', tokens: m.entries.map((x) => x.token) });
        }
        break;
      case 'openSourceReq':
        if (!userJustActed()) return;
        if (connected()) bg({ type: 'openSource', item: m.item, quiet: false });
        else toast(t('cx.notConnected'), 'err');
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
          toast(t('cx.askPair'), '', 7000);
        }
        render();
        break;
      }
      case 'welcome':
        settings.sendTo = m.sendTo || settings.sendTo;
        settings.openOnSelect = m.openOnSelect !== false;
        settings.claudeExt = m.claudeExt !== false;
        if (m.design) settings.design = m.design;
        canRollback = !!m.canRollback;
        if (m.lang) langFromVS(m.lang);
        sendConfig();
        render();
        break;
      case 'lang':
        langFromVS(m.value);
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
          toast(t('cx.notConnectedQueued'), 'err', 5000);
          if (popPending) { popPending = false; popStatus('err', t('cx.notConnectedShort')); }
        }
        render();
        break;
      case 'design':
        settings.design = m;
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
        addLog('user', () => `<span class="meta">${esc(t('cx.logAuto'))}</span>${esc(m.text)}`);
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
        if (m.direct) { const nd = m.direct; addLog('done', () => esc(plural(nd, 'cx.direct'))); }
        if (m.ok && !m.sent) {
          toast(esc(t('cx.directToast')), 'ok');
          if (popPending) { popPending = false; popStatus('ok', t('cx.directPop'), 1600); }
        }
        if (!m.ok) {
          const msg = m.message;
          if (!m.reported) addLog('err', () => esc(msg || t('cx.failed')));
          toast(esc(msg || t('cx.failed')), 'err', 5000);
          if (popPending) { popPending = false; popStatus('err', msg || t('cx.failed')); }
        }
        render();
        break;
      }
      case 'handoff': {
        const how = ['mention', 'clipboard', 'mcp', 'mcpPrompt'].includes(m.how) ? m.how : 'newTab';
        const short = () => t('cx.ho.' + how);
        if (popPending) { popPending = false; popStatus(m.ok ? 'ok' : 'err', m.ok ? short() : t('cx.panelFail'), 2600); }
        if (m.ok) {
          addLog('handoff', () => '<b>→ Claude Code.</b> ' + t('cx.ho.' + how + 'Long'));
          toast('→ ' + esc(short()), 'ok', 4000);
        } else addLog('err', () => esc(t('cx.panelFailLog')));
        break;
      }
      case 'claude': {
        const ev = m.ev;
        if (ev.kind === 'start') { running = true; if (popPending) popStatus('busy', t('cx.claudeRunning')); }
        else if (ev.kind === 'text') addLog('text', mdLite(ev.text));
        else if (ev.kind === 'tool') addLog('tool' + (/Edit|Write/.test(ev.name) ? ' edit' : ''), () => `<b>${esc(toolLabel(ev.name))}</b> ${esc(ev.detail)}`);
        else if (ev.kind === 'done') {
          running = false;
          const files = fileLinks(ev.edited || []);
          if (ev.ok) addLog('done', () => esc(t('cx.done')) + (files ? '\n' + t('cx.changedFiles', files) : esc(t('cx.noFiles'))));
          else addLog('err', () => esc(t('cx.claudeFail')));
          if (popPending) { popPending = false; popStatus(ev.ok ? 'ok' : 'err', ev.ok ? t('cx.doneShort') : t('cx.claudeFailShort'), 2500); }
          toast(esc(ev.ok ? t('cx.claudeDone') : t('cx.claudeFailShort')), ev.ok ? 'ok' : 'err');
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
          const fl = fileLinks(m.files.slice(0, 4));
          addLog('tool edit', () => `<b>${esc(t('cx.changed'))}</b> ${fl}`);
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
          const fl = fileLinks(m.files || []);
          addLog('done', () => t('cx.rolledBack', fl));
          toast(esc(t('cx.rolledBackToast')), 'ok');
        } else if (m.message) {
          addLog('err', esc(m.message));
          toast(esc(m.message), 'err', 5000);
        }
        if (m.conflicts && m.conflicts.length) { const cf = m.conflicts.map(esc).join('\n'); addLog('err', () => esc(t('cx.untouched')) + '\n' + cf); }
        render();
        break;
      case 'quickEditResult':
        break;
    }
  }
})();
