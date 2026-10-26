/* Panoptent seçim katmanı.
 * Proxy tarafından önizlenen sayfaya enjekte edilir. Öğeleri vurgular, tıklananı seçer,
 * yanında hızlı düzenleme kutusu açar (istek, stil, metin, silme, görsel) ve değişiklikleri
 * önizlemede canlı gösterir. Kalıcı değişiklik her zaman panel üzerinden koda yazılır.
 */
(function () {
  'use strict';
  if (window.__panoptentLoaded) return;
  window.__panoptentLoaded = true;
  // VS Code panelinde iframe içinde, Chrome eklentisinde ise sayfanın kendisinde çalışır
  var CHROME = document.documentElement.getAttribute('data-panoptent-host') === 'chrome';
  if (window.parent === window && !CHROME) return;
  var active = true;

  // ---------- Dil (i18n) ----------
  // i18n.js overlay.js'ten önce yüklenir; yine de yoksa küçük bir yedek tanımla
  if (typeof PanoptentI18n === 'undefined') {
    window.PanoptentI18n = (function () {
      var d = { en: {} }, lang = 'en', ls = [];
      function norm(l) { l = String(l || '').toLowerCase().split(/[-_]/)[0]; return l === 'tr' ? 'tr' : 'en'; }
      try { lang = norm(document.documentElement.getAttribute('data-panoptent-lang') || navigator.language); } catch (e) { /* yok say */ }
      function t(k) {
        var s = (d[lang] && d[lang][k]); if (s == null) s = d.en[k]; if (s == null) return k;
        var a = arguments;
        return String(s).replace(/\{(\d+)\}/g, function (m, i) { var v = a[+i + 1]; return v == null ? '' : String(v); });
      }
      return {
        add: function (tb) { for (var l in tb) { d[l] = d[l] || {}; for (var k in tb[l]) d[l][k] = tb[l][k]; } },
        t: t,
        localize: function (r) {
          if (!r || !r.querySelectorAll) return;
          [['data-i18n', 'textContent'], ['data-i18n-title', 'title'], ['data-i18n-ph', 'placeholder']].forEach(function (p) {
            Array.prototype.forEach.call(r.querySelectorAll('[' + p[0] + ']'), function (el) { el[p[1]] = t(el.getAttribute(p[0])); });
          });
        },
        setLang: function (l) { var n = norm(l); if (n === lang) return false; lang = n; ls.forEach(function (f) { try { f(lang); } catch (e) { /* yok say */ } }); return true; },
        onChange: function (f) { ls.push(f); },
        get lang() { return lang; },
      };
    })();
  }
  var I18N = PanoptentI18n;
  var t = I18N.t;
  I18N.add({
    en: {
      'ov.act.text': 'Edit text in place (double-click)',
      'ov.act.textOnly': 'Only for a single element that contains just text',
      'ov.act.img': 'Replace image',
      'ov.act.del': 'Delete element',
      'ov.act.code': 'Open in code',
      'ov.close': 'Close (Esc)',
      'ov.tab.ask': 'Request',
      'ov.tab.style': 'Style',
      'ov.ask.ph': 'What should change? e.g. make this section two columns',
      'ov.img.pick': 'Choose file…',
      'ov.img.urlPh': 'or image URL (https://…)',
      'ov.img.tooBig': 'File is larger than 8 MB.',
      'ov.img.fileInfo': '{0} · {1} KB — will be saved to the project when queued',
      'ov.img.badUrl': 'URL must start with http:// or https://.',
      'ov.img.urlPreview': 'Previewing image from URL',
      'ov.now': 'Send now',
      'ov.now.title': 'Send immediately without waiting for the queue',
      'ov.queue': 'Add to queue',
      'ov.hint': '{0}↵ queue · {0}⇧↵ now · Alt+arrows navigate',
      'ov.multi.one': '1 item selected',
      'ov.multi.many': '{0} items selected',
      'ov.crumb.parent': 'Select this parent element',
      'ov.src.unknown': 'source file unknown',
      'ov.vp.mobile': 'Only for mobile view (≤390px)',
      'ov.vp.tablet': 'Only for tablet view (≤1024px)',
      'ov.st.textColor': 'Text color',
      'ov.st.bg': 'Background',
      'ov.st.font': 'Font',
      'ov.st.align': 'Alignment',
      'ov.st.padding': 'Padding',
      'ov.st.margin': 'Margin',
      'ov.st.radius': 'Radius',
      'ov.st.border': 'border',
      'ov.st.opacity': 'Opacity %',
      'ov.st.addClass': 'Add class',
      'ov.st.classPh': 'e.g. shadow-lg rounded-xl',
      'ov.st.reset': 'Reset style changes',
      'ov.st.transparent': 'transparent',
      'ov.st.top': 'top',
      'ov.st.right': 'right',
      'ov.st.bottom': 'bottom',
      'ov.st.left': 'left',
      'ov.fw.300': 'Light',
      'ov.fw.400': 'Normal',
      'ov.fw.500': 'Medium',
      'ov.fw.600': 'Semibold',
      'ov.fw.700': 'Bold',
      'ov.fw.800': 'Extra bold',
      'ov.al.left': 'left',
      'ov.al.center': 'center',
      'ov.al.right': 'right',
      'ov.al.justify': 'justify',
      'ov.err.empty': 'Write a request, change a style or pick an image first.',
      'ov.busy.now': 'Sending…',
      'ov.busy.queue': 'Adding to queue…',
      'ov.edit.hint': 'Edit text · Enter saves, Esc cancels',
      'ov.truncated': '…(truncated)',
      'ov.agent': 'Claude',
      'ov.agent.preview': 'Claude’s preview',
    },
    tr: {
      'ov.act.text': 'Metni yerinde düzenle (çift tık)',
      'ov.act.textOnly': 'Yalnızca tek ve sadece metin içeren bir öğede',
      'ov.act.img': 'Görseli değiştir',
      'ov.act.del': 'Öğeyi sil',
      'ov.act.code': 'Kodda aç',
      'ov.close': 'Kapat (Esc)',
      'ov.tab.ask': 'İstek',
      'ov.tab.style': 'Stil',
      'ov.ask.ph': 'Ne değişsin? Örn: bu bölümü iki sütun yap',
      'ov.img.pick': 'Dosya seç…',
      'ov.img.urlPh': 'veya görsel adresi (https://…)',
      'ov.img.tooBig': 'Dosya 8 MB’tan büyük.',
      'ov.img.fileInfo': '{0} · {1} KB — kuyruğa eklenince projeye kaydedilecek',
      'ov.img.badUrl': 'Adres http:// veya https:// ile başlamalı.',
      'ov.img.urlPreview': 'Adresten görsel önizleniyor',
      'ov.now': 'Hemen gönder',
      'ov.now.title': 'Kuyruğu beklemeden hemen gönder',
      'ov.queue': 'Kuyruğa ekle',
      'ov.hint': '{0}↵ kuyruğa · {0}⇧↵ hemen · Alt+oklar gezin',
      'ov.multi.one': '1 öğe seçili',
      'ov.multi.many': '{0} öğe seçili',
      'ov.crumb.parent': 'Bu üst öğeyi seç',
      'ov.src.unknown': 'kaynak dosya bilinmiyor',
      'ov.vp.mobile': 'Sadece mobil görünüm (≤390px) için',
      'ov.vp.tablet': 'Sadece tablet görünüm (≤1024px) için',
      'ov.st.textColor': 'Metin rengi',
      'ov.st.bg': 'Arka plan',
      'ov.st.font': 'Yazı',
      'ov.st.align': 'Hizalama',
      'ov.st.padding': 'İç boşluk',
      'ov.st.margin': 'Dış boşluk',
      'ov.st.radius': 'Köşe',
      'ov.st.border': 'kenarlık',
      'ov.st.opacity': 'Opaklık %',
      'ov.st.addClass': 'Sınıf ekle',
      'ov.st.classPh': 'örn. shadow-lg rounded-xl',
      'ov.st.reset': 'Stil değişikliklerini sıfırla',
      'ov.st.transparent': 'şeffaf',
      'ov.st.top': 'üst',
      'ov.st.right': 'sağ',
      'ov.st.bottom': 'alt',
      'ov.st.left': 'sol',
      'ov.fw.300': 'İnce',
      'ov.fw.400': 'Normal',
      'ov.fw.500': 'Orta',
      'ov.fw.600': 'Yarı kalın',
      'ov.fw.700': 'Kalın',
      'ov.fw.800': 'Çok kalın',
      'ov.al.left': 'sol',
      'ov.al.center': 'orta',
      'ov.al.right': 'sağ',
      'ov.al.justify': 'iki yana',
      'ov.err.empty': 'Önce bir istek yaz, stil değiştir ya da görsel seç.',
      'ov.busy.now': 'Gönderiliyor…',
      'ov.busy.queue': 'Kuyruğa ekleniyor…',
      'ov.edit.hint': 'Metni düzenle · Enter kaydeder, Esc iptal',
      'ov.truncated': '…(kısaltıldı)',
      'ov.agent': 'Claude',
      'ov.agent.preview': 'Claude’un önizlemesi',
    },
  });

  var SRC = 'panoptent';
  var selectMode = false;
  var hoverEl = null;
  var nextId = 1;
  var selected = new Map(); // id -> Element
  var tokenSeq = 0;

  function post(msg) {
    msg.source = SRC;
    msg.dir = 'up';
    try { (CHROME ? window : window.parent).postMessage(msg, '*'); } catch (e) { /* yok say */ }
  }

  var ICON = {
    text: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M3 3h10v2.2h-1.4V4.4H8.7v7.2h1.5V13H5.8v-1.4h1.5V4.4H4.4v.8H3z"/></svg>',
    img: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v10H2zm1.4 1.4v6.1l2.8-2.8 2 2 1.6-1.6 2.8 2.8V4.4zM10.5 5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/></svg>',
    del: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M6 2h4l.6 1H13v1.4H3V3h2.4zM4 5.5h8l-.6 8.5H4.6zm2 1.4.3 5.7h1.1V6.9zm2.6 0v5.7h1.1L10 6.9z"/></svg>',
    code: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M5.3 4 1.5 8l3.8 4 1-1-2.8-3 2.8-3zm5.4 0-1 1 2.8 3-2.8 3 1 1 3.8-4z"/></svg>',
  };

  // ---------- Görsel katman (shadow DOM, sayfa stillerinden yalıtılmış) ----------
  var host = document.createElement('panoptent-overlay');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var FONT = 'system-ui,-apple-system,"Segoe UI",sans-serif';
  var MONO = 'ui-monospace,Menlo,Consolas,monospace';
  root.innerHTML =
    '<style>' +
    ':host{all:initial}[hidden]{display:none!important}*{box-sizing:border-box}' +
    '.box{position:fixed;pointer-events:none;border-radius:2px}' +
    '.hover{outline:2px solid #3b82f6;background:rgba(59,130,246,.08)}' +
    '.sel{outline:2px solid #f97316;background:rgba(249,115,22,.07)}' +
    '.lbl{position:fixed;pointer-events:none;font:600 11px/1.4 ' + MONO + ';' +
    'background:#1e293b;color:#fff;padding:2px 6px;border-radius:3px;white-space:nowrap;max-width:60vw;overflow:hidden;text-overflow:ellipsis}' +
    '.lbl b{color:#93c5fd;font-weight:600}.lbl i{color:#cbd5e1;font-style:normal;font-weight:400}' +
    '.num{position:fixed;pointer-events:none;font:700 10px/16px ' + FONT + ';min-width:16px;height:16px;text-align:center;' +
    'background:#f97316;color:#fff;border-radius:8px;padding:0 4px}' +
    // kutu
    '.pop{position:fixed;pointer-events:auto;width:360px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;' +
    'background:#1f2329;color:#e6e8eb;border:1px solid #3a3f47;border-radius:10px;' +
    'box-shadow:0 12px 32px rgba(0,0,0,.35),0 2px 6px rgba(0,0,0,.2);font:13px/1.45 ' + FONT + ';padding:10px;text-align:left}' +
    '.popHead{display:flex;align-items:center;gap:6px;min-width:0}' +
    '.n{flex-shrink:0;background:#f97316;color:#fff;border-radius:8px;min-width:16px;height:16px;padding:0 4px;font:700 10px/16px ' + FONT + ';text-align:center}' +
    '.crumbs{flex:1;min-width:0;display:flex;align-items:center;gap:2px;overflow:hidden;white-space:nowrap;font:12px/1.3 ' + MONO + ';color:#7d8693}' +
    '.crumbs button{all:unset;cursor:pointer;padding:1px 3px;border-radius:3px;color:#9aa4b2;max-width:90px;overflow:hidden;text-overflow:ellipsis}' +
    '.crumbs button:hover{background:#2c3138;color:#fff}.crumbs .cur{color:#93c5fd;font-weight:600;cursor:default}.crumbs .cur:hover{background:none;color:#93c5fd}' +
    '.crumbs .multi{color:#e6e8eb;font-family:' + FONT + '}' +
    '.acts{display:flex;gap:2px;flex-shrink:0}' +
    '.ic,.x{all:unset;cursor:pointer;width:24px;height:24px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#9aa4b2}' +
    '.ic:hover,.x:hover{background:#2c3138;color:#fff}.ic.danger:hover{color:#f87171}.ic[disabled]{opacity:.35;cursor:default}.ic.on{background:#3a2a1c;color:#fdba74}' +
    '.x{font-size:16px}' +
    '.srcline{margin:4px 0 8px;font:11px/1.3 ' + MONO + ';color:#6b7380;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.tabs{display:flex;gap:4px;margin-bottom:8px;border-bottom:1px solid #2c3138}' +
    '.tabs button{all:unset;cursor:pointer;padding:5px 8px;font-size:12px;color:#9aa4b2;border-bottom:2px solid transparent;margin-bottom:-1px}' +
    '.tabs button.on{color:#fff;border-color:#f97316}.tabs .dot{display:inline-block;width:6px;height:6px;border-radius:3px;background:#f97316;margin-left:5px;vertical-align:1px}' +
    'textarea,input[type=text],input[type=number],input[type=url],select{all:unset;box-sizing:border-box;background:#15181c;border:1px solid #3a3f47;border-radius:6px;color:#e6e8eb;font:12.5px/1.4 ' + FONT + '}' +
    'textarea{display:block;width:100%;min-height:58px;max-height:180px;overflow:auto;resize:vertical;padding:8px 9px;font-size:13px;white-space:pre-wrap}' +
    'textarea:focus,input:focus,select:focus{border-color:#f97316}' +
    'textarea::placeholder,input::placeholder{color:#6b7380}' +
    '.grid{display:grid;grid-template-columns:72px 1fr;gap:6px 8px;align-items:center;font-size:12px}' +
    '.grid>label{color:#9aa4b2}' +
    '.row{display:flex;gap:6px;align-items:center;min-width:0}' +
    'input[type=number]{width:64px;height:26px;padding:0 6px}' +
    '.box4 input[type=number]{width:100%;min-width:0;text-align:center;padding:0 2px}.box4{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;flex:1}' +
    'select{height:26px;padding:0 6px;cursor:pointer}' +
    'input[type=text],input[type=url]{height:26px;padding:0 8px;width:100%;min-width:0}' +
    'input[type=color]{width:30px;height:26px;padding:0;border:1px solid #3a3f47;border-radius:6px;background:none;cursor:pointer}' +
    '.hex{font:11px ' + MONO + ';color:#9aa4b2}' +
    '.seg{display:inline-flex;border:1px solid #3a3f47;border-radius:6px;overflow:hidden}' +
    '.seg button{all:unset;cursor:pointer;padding:3px 9px;font-size:12px;color:#9aa4b2}.seg button+button{border-left:1px solid #3a3f47}' +
    '.seg button.on{background:#2c3138;color:#fff}' +
    '.sub{font-size:10.5px;color:#6b7380;text-align:center}' +
    '.reset{all:unset;cursor:pointer;font-size:11.5px;color:#9aa4b2}.reset:hover{color:#fff;text-decoration:underline}' +
    '.imgbox{margin-top:8px;padding:8px;border:1px dashed #3a3f47;border-radius:7px;display:flex;flex-direction:column;gap:6px;font-size:12px;color:#9aa4b2}' +
    '.file{all:unset;cursor:pointer;padding:5px 9px;border-radius:5px;background:#2c3138;color:#e6e8eb;font-size:12px;text-align:center}' +
    '.file:hover{background:#363c44}' +
    '.vp{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#fdba74;cursor:pointer}' +
    '.vp input{accent-color:#f97316;margin:0}' +
    '.popFoot{display:flex;align-items:center;gap:6px;margin-top:8px}' +
    '.hint{flex:1;color:#6b7380;font-size:10.5px;line-height:1.3;min-width:0}' +
    '.btn{all:unset;cursor:pointer;font:600 12px/1 ' + FONT + ';padding:8px 11px;border-radius:6px;white-space:nowrap}' +
    '.btn.pri{background:#f97316;color:#fff}.btn.pri:hover{background:#ea6a0c}' +
    '.btn.sec{background:#2c3138;color:#e6e8eb}.btn.sec:hover{background:#363c44}' +
    '.btn[disabled]{opacity:.5;cursor:default}' +
    '.st{margin-top:8px;font-size:12px;color:#9aa4b2;display:flex;align-items:center;gap:6px}' +
    '.st.ok{color:#4ade80}.st.err{color:#f87171}' +
    '.sp{width:11px;height:11px;border-radius:50%;border:2px solid #3a3f47;border-top-color:#f97316;animation:r .8s linear infinite;flex-shrink:0}' +
    '@keyframes r{to{transform:rotate(360deg)}}' +
    '.editing{outline:2px dashed #f97316!important;outline-offset:2px}' +
    '.agent{outline:2px dashed #a855f7;outline-offset:2px;background:rgba(168,85,247,.08)}' +
    '.alb{position:fixed;pointer-events:none;font:600 11px/1.4 ' + FONT + ';background:#7c3aed;color:#fff;padding:2px 7px;border-radius:3px;' +
    'white-space:nowrap;max-width:50vw;overflow:hidden;text-overflow:ellipsis}' +
    '</style>' +
    '<div id="hover" class="box hover" hidden></div><div id="lbl" class="lbl" hidden></div><div id="sels"></div><div id="agentMarks"></div>' +
    '<div id="pop" class="pop" hidden>' +
    '<div class="popHead"><span class="n" id="popN">1</span><div class="crumbs" id="crumbs"></div>' +
    '<div class="acts">' +
    '<button class="ic" id="actText" data-i18n-title="ov.act.text" title="Metni yerinde düzenle (çift tık)">' + ICON.text + '</button>' +
    '<button class="ic" id="actImg" data-i18n-title="ov.act.img" title="Görseli değiştir" hidden>' + ICON.img + '</button>' +
    '<button class="ic danger" id="actDel" data-i18n-title="ov.act.del" title="Öğeyi sil">' + ICON.del + '</button>' +
    '<button class="ic" id="actCode" data-i18n-title="ov.act.code" title="Kodda aç">' + ICON.code + '</button>' +
    '<button class="x" id="popX" data-i18n-title="ov.close" title="Kapat (Esc)">×</button></div></div>' +
    '<div class="srcline" id="srcline"></div>' +
    '<div class="tabs"><button data-tab="ask" class="on"><span data-i18n="ov.tab.ask">İstek</span></button><button data-tab="style"><span data-i18n="ov.tab.style">Stil</span><span class="dot" id="styleDot" hidden></span></button></div>' +
    '<div id="tabAsk"><textarea id="popIn" rows="3" data-i18n-ph="ov.ask.ph" placeholder="Ne değişsin? Örn: bu bölümü iki sütun yap"></textarea></div>' +
    '<div id="tabStyle" hidden></div>' +
    '<div id="imgBox" class="imgbox" hidden><div class="row"><button class="file" id="imgPick" data-i18n="ov.img.pick">Dosya seç…</button>' +
    '<input type="url" id="imgUrl" data-i18n-ph="ov.img.urlPh" placeholder="veya görsel adresi (https://…)"></div><div id="imgInfo"></div>' +
    '<input type="file" id="imgFile" accept="image/*" hidden></div>' +
    '<label class="vp" id="vpRow" hidden><input type="checkbox" id="vpOnly"> <span id="vpName"></span></label>' +
    '<div class="popFoot"><span class="hint" id="popHint"></span>' +
    '<button class="btn sec" id="popNow" data-i18n-title="ov.now.title" title="Kuyruğu beklemeden hemen gönder">Hemen gönder</button>' +
    '<button class="btn pri" id="popQueue" data-i18n="ov.queue">Kuyruğa ekle</button></div>' +
    '<div class="st" id="popSt" hidden></div></div>';

  var q = function (id) { return root.getElementById ? root.getElementById(id) : root.querySelector('#' + id); };
  var hoverBox = q('hover'), label = q('lbl'), selsLayer = q('sels'), agentLayer = q('agentMarks');
  var pop = q('pop'), popN = q('popN'), crumbs = q('crumbs'), srcline = q('srcline'), popIn = q('popIn'),
    popQueue = q('popQueue'), popNow = q('popNow'), popX = q('popX'), popHint = q('popHint'), popSt = q('popSt'),
    tabAsk = q('tabAsk'), tabStyle = q('tabStyle'), styleDot = q('styleDot'),
    actText = q('actText'), actImg = q('actImg'), actDel = q('actDel'), actCode = q('actCode'),
    imgBox = q('imgBox'), imgPick = q('imgPick'), imgUrl = q('imgUrl'), imgInfo = q('imgInfo'), imgFile = q('imgFile'),
    vpRow = q('vpRow'), vpOnly = q('vpOnly'), vpName = q('vpName');

  var popAnchor = null; // seçili öğe kimliği
  var popEnabled = true;
  var popCloseTimer = null;
  var viewport = 'full';
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var MOD = isMac ? '⌘' : 'Ctrl';
  var nowLabel = null; // host'tan gelen (zaten çevrilmiş) "hemen" düğmesi etiketi
  var lastStatus = null; // { state, key } — yerel durum mesajı, dil değişince yeniden çizilir
  function localizeStatic() {
    I18N.localize(root);
    popHint.textContent = t('ov.hint', MOD);
    popNow.textContent = nowLabel || t('ov.now');
  }
  localizeStatic();

  function mount() {
    if (!host.isConnected) document.documentElement.appendChild(host);
  }
  mount();
  // Bazı çerçeveler (hidrasyon, sayfa geçişi) DOM'u yeniden kurabilir
  setInterval(mount, 1000);

  function isOurs(el) {
    return el === host || (el && el.closest && el.closest('panoptent-overlay, panoptent-ui'));
  }
  function fromOverlay(e) {
    var path = e.composedPath ? e.composedPath() : [];
    for (var i = 0; i < path.length; i++) if (path[i] && path[i].tagName === 'PANOPTENT-UI') return true;
    return path.indexOf(host) !== -1 || isOurs(e.target);
  }

  // ---------- Kaynak konumu bulma ----------
  function parseInsp(v) {
    // biçim: dosya/yolu.tsx:satır:sütun:etiket  (Windows'ta yol ':' içerebilir)
    var parts = v.split(':');
    if (parts.length < 4) return null;
    parts.pop(); // etiket
    var col = parseInt(parts.pop(), 10);
    var line = parseInt(parts.pop(), 10);
    if (isNaN(line)) return null;
    return { file: parts.join(':'), line: line, col: isNaN(col) ? 0 : col };
  }

  function reactFiber(el) {
    for (var k in el) {
      if (k.indexOf('__reactFiber$') === 0 || k.indexOf('__reactInternalInstance$') === 0) return el[k];
    }
    return null;
  }

  function componentChain(el) {
    var names = [];
    // React
    var n = el;
    while (n && n.nodeType === 1 && !names.length) {
      var f = reactFiber(n);
      if (f) {
        for (var cur = f; cur && names.length < 4; cur = cur.return) {
          var t = cur.type;
          if (typeof t === 'function' || (t && typeof t === 'object' && (t.render || t.type))) {
            var nm = t.displayName || t.name || (t.render && (t.render.displayName || t.render.name)) ||
              (t.type && (t.type.displayName || t.type.name));
            if (nm && names.indexOf(nm) === -1 && !/^(Inner|Outer)?(Layout|Router|Provider|Boundary|Context)/.test(nm)) names.push(nm);
          }
        }
        break;
      }
      n = n.parentElement;
    }
    // Vue
    if (!names.length) {
      n = el;
      while (n && n.nodeType === 1) {
        var c = n.__vueParentComponent;
        if (c) {
          for (var cc = c; cc && names.length < 4; cc = cc.parent) {
            var vn = cc.type && (cc.type.__name || cc.type.name);
            if (vn && names.indexOf(vn) === -1) names.push(vn);
          }
          break;
        }
        n = n.parentElement;
      }
    }
    return names;
  }

  function findSource(el) {
    // 1) code-inspector-plugin: data-insp-path (en kesin yöntem)
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var v = n.getAttribute && n.getAttribute('data-insp-path');
      if (v) {
        var p = parseInsp(v);
        if (p) return { file: p.file, line: p.line, col: p.col, exact: n === el, via: 'code-inspector' };
      }
    }
    // 2) React <=18 geliştirme modu: _debugSource
    for (n = el; n && n.nodeType === 1; n = n.parentElement) {
      var f = reactFiber(n);
      if (f) {
        for (var cur = f; cur; cur = cur.return) {
          var ds = cur._debugSource;
          if (ds && ds.fileName) {
            return { file: ds.fileName, line: ds.lineNumber || 0, col: ds.columnNumber || 0, exact: false, via: 'react' };
          }
        }
        break;
      }
    }
    // 3) Vue geliştirme modu: bileşen dosyası (satır yok)
    for (n = el; n && n.nodeType === 1; n = n.parentElement) {
      var c = n.__vueParentComponent;
      if (c && c.type && c.type.__file) {
        return { file: c.type.__file, line: 0, col: 0, exact: false, via: 'vue' };
      }
    }
    return null;
  }

  function detectSourceSupport() {
    if (document.querySelector('[data-insp-path]')) return 'code-inspector';
    var all = document.body ? document.body.querySelectorAll('*') : [];
    for (var i = 0; i < Math.min(all.length, 200); i++) {
      var el = all[i];
      if (el.__vueParentComponent) return el.__vueParentComponent.type && el.__vueParentComponent.type.__file ? 'vue' : 'vue-nofile';
      var f = reactFiber(el);
      if (f) {
        for (var cur = f; cur; cur = cur.return) if (cur._debugSource) return 'react';
        return 'react-nosource';
      }
    }
    return 'none';
  }

  // ---------- Öğe bilgisi ----------
  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function selectorFor(el) {
    var parts = [];
    for (var n = el, depth = 0; n && n.nodeType === 1 && n !== document.documentElement && depth < 5; n = n.parentElement, depth++) {
      var s = n.tagName.toLowerCase();
      if (n.id) { parts.unshift(s + '#' + cssEscape(n.id)); break; }
      var cls = (typeof n.className === 'string' ? n.className : '').trim().split(/\s+/).filter(function (c) {
        return c && !/[:\[\]/]/.test(c);
      }).slice(0, 2);
      if (cls.length) s += '.' + cls.map(cssEscape).join('.');
      var parent = n.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === n.tagName; });
        if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')';
      }
      parts.unshift(s);
    }
    return parts.join(' > ');
  }

  var STYLE_KEYS = ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'line-height',
    'padding', 'margin', 'border', 'border-radius', 'display', 'gap', 'width', 'height', 'text-align'];

  function stylesOf(el) {
    var cs = getComputedStyle(el);
    var out = {};
    STYLE_KEYS.forEach(function (k) {
      var v = cs.getPropertyValue(k);
      if (v && v !== 'normal' && v !== 'none' && v !== '0px' && v !== 'auto' && v !== 'rgba(0, 0, 0, 0)') out[k] = v;
    });
    return out;
  }

  function cleanHtml(el) {
    var clone = el.cloneNode(true);
    var strip = function (n) {
      if (n.removeAttribute) n.removeAttribute('data-insp-path');
    };
    strip(clone);
    if (clone.querySelectorAll) Array.prototype.forEach.call(clone.querySelectorAll('[data-insp-path]'), strip);
    var html = clone.outerHTML || '';
    return html.length > 1500 ? html.slice(0, 1500) + ' ' + t('ov.truncated') : html;
  }

  function describe(el, id) {
    var text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    var r = el.getBoundingClientRect();
    return {
      id: id,
      tag: el.tagName.toLowerCase(),
      elId: el.id || '',
      classes: typeof el.className === 'string' ? el.className.trim().slice(0, 300) : '',
      text: text.slice(0, 300),
      textOnly: el.childElementCount === 0 && text.length > 0 && text.length <= 500,
      fullText: el.childElementCount === 0 ? text : '',
      selector: selectorFor(el),
      source: findSource(el),
      components: componentChain(el),
      styles: stylesOf(el),
      html: cleanHtml(el),
      size: Math.round(r.width) + '×' + Math.round(r.height),
      href: location.href,
    };
  }

  // ---------- Çizim ----------
  function place(box, el) {
    var r = el.getBoundingClientRect();
    box.style.left = r.left + 'px';
    box.style.top = r.top + 'px';
    box.style.width = r.width + 'px';
    box.style.height = r.height + 'px';
    return r;
  }

  function labelText(el) {
    var t = el.tagName.toLowerCase();
    var cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    var src = findSource(el);
    var s = '<b>' + t + '</b>' + (cls ? '<i>.' + escapeHtml(cls) + '</i>' : '');
    if (src) {
      var file = src.file.split(/[\\/]/).pop();
      s += ' <i>· ' + escapeHtml(file) + (src.line ? ':' + src.line : '') + '</i>';
    }
    return s;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // ---------- Çizim ----------
  function render() {
    if ((selectMode || peek) && hoverEl && hoverEl.isConnected && !editingEl) {
      hoverBox.hidden = false;
      var r = place(hoverBox, hoverEl);
      label.hidden = false;
      var top = r.top - 22;
      if (top < 2) top = r.bottom + 4;
      label.style.top = top + 'px';
      label.style.left = Math.max(2, Math.min(r.left, window.innerWidth - 240)) + 'px';
    } else {
      hoverBox.hidden = true;
      label.hidden = true;
    }
    var i = 0;
    selected.forEach(function (el) {
      var box = selsLayer.children[i * 2];
      var num = selsLayer.children[i * 2 + 1];
      if (!box) {
        box = document.createElement('div');
        box.className = 'box sel';
        num = document.createElement('div');
        num.className = 'num';
        selsLayer.appendChild(box);
        selsLayer.appendChild(num);
      }
      if (!el.isConnected || getComputedStyle(el).display === 'none') {
        box.hidden = num.hidden = true;
      } else {
        box.hidden = num.hidden = false;
        var r2 = place(box, el);
        num.textContent = String(i + 1);
        num.style.left = Math.max(0, r2.left - 6) + 'px';
        num.style.top = Math.max(0, r2.top - 8) + 'px';
      }
      i++;
    });
    while (selsLayer.children.length > i * 2) selsLayer.removeChild(selsLayer.lastChild);
    renderAgentMarks();
    placePopover();
    requestAnimationFrame(render);
  }

  // ---------- Önizleme işlemleri (geri alınabilir) ----------
  var ops = {}; // token -> [geri alma fonksiyonları]
  function newToken() { return 'c' + Date.now().toString(36) + (++tokenSeq); }

  function setStyle(el, prop, val) {
    var prev = el.style.getPropertyValue(prop), pri = el.style.getPropertyPriority(prop);
    el.style.setProperty(prop, val, 'important');
    return function () {
      if (prev) el.style.setProperty(prop, prev, pri); else el.style.removeProperty(prop);
    };
  }
  function addClasses(el, classes) {
    var added = classes.split(/\s+/).filter(function (c) { return c && !el.classList.contains(c); });
    added.forEach(function (c) { el.classList.add(c); });
    return function () { added.forEach(function (c) { el.classList.remove(c); }); };
  }
  function setText(el, text) {
    var prev = el.textContent;
    el.textContent = text;
    return function () { el.textContent = prev; };
  }
  function setImg(el, src) {
    var prevSrc = el.getAttribute('src'), prevSet = el.getAttribute('srcset');
    el.setAttribute('src', src);
    el.removeAttribute('srcset');
    return function () {
      if (prevSrc === null) el.removeAttribute('src'); else el.setAttribute('src', prevSrc);
      if (prevSet !== null) el.setAttribute('srcset', prevSet);
    };
  }

  function previewEntry(entry, els) {
    var undo = [];
    els.forEach(function (el) {
      if (!el) return;
      if (entry.kind === 'style') {
        Object.keys(entry.diffs || {}).forEach(function (p) { undo.push(setStyle(el, p, entry.diffs[p].to)); });
        if (entry.classes) undo.push(addClasses(el, entry.classes));
      } else if (entry.kind === 'delete') {
        undo.push(setStyle(el, 'display', 'none'));
      } else if (entry.kind === 'text') {
        undo.push(setText(el, entry.to));
      } else if (entry.kind === 'image') {
        var img = imageEl(el);
        if (img) undo.push(setImg(img, entry.dataUrl || entry.url));
      }
    });
    return undo;
  }

  function revertToken(token) {
    var list = ops[token];
    if (!list) return;
    for (var i = list.length - 1; i >= 0; i--) { try { list[i](); } catch (e) { /* yok say */ } }
    delete ops[token];
  }

  function imageEl(el) {
    if (!el) return null;
    if (el.tagName === 'IMG') return el;
    if (el.tagName === 'PICTURE') return el.querySelector('img');
    return null;
  }

  // ---------- Hızlı kutu: yerleşim ve başlık ----------
  var snaps = new Map(); // id -> seçim anındaki öğe bilgisi
  function anchorEl() { return popAnchor !== null ? selected.get(popAnchor) : null; }
  function selectedEls() { var a = []; selected.forEach(function (el) { a.push(el); }); return a; }
  function selectedSnaps() {
    var a = [];
    selected.forEach(function (el, id) { a.push(snaps.get(id) || describe(el, id)); });
    return a;
  }

  function placePopover() {
    if (pop.hidden) return;
    var el = anchorEl();
    if (!el || !el.isConnected) return;
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var pw = pop.offsetWidth || 360, ph = pop.offsetHeight || 160;
    var top;
    if (r.bottom + 10 + ph <= vh) top = r.bottom + 10;
    else if (r.top - 10 - ph >= 0) top = r.top - 10 - ph;
    else top = Math.max(8, Math.min(vh - ph - 8, r.top + 10));
    var left = Math.max(8, Math.min(r.left, vw - pw - 8));
    pop.style.top = Math.round(top) + 'px';
    pop.style.left = Math.round(left) + 'px';
  }

  function shortName(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) return s + '#' + el.id;
    var c = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
    return c ? s + '.' + c : s;
  }

  function popTitle() {
    var n = selected.size;
    var el = anchorEl();
    var idx = 0, k = 0;
    selected.forEach(function (_, id) { k++; if (id === popAnchor) idx = k; });
    popN.textContent = String(idx || n);
    crumbs.innerHTML = '';
    if (!el) return;
    if (n > 1) {
      var m = document.createElement('span');
      m.className = 'multi';
      m.textContent = n === 1 ? t('ov.multi.one') : t('ov.multi.many', n);
      crumbs.appendChild(m);
    } else {
      var chain = [];
      for (var p = el.parentElement, d = 0; p && p !== document.body && p !== document.documentElement && d < 3; p = p.parentElement, d++) chain.unshift(p);
      chain.forEach(function (a) {
        var b = document.createElement('button');
        b.textContent = shortName(a);
        b.title = t('ov.crumb.parent');
        b.addEventListener('click', function () { navigate(a); });
        crumbs.appendChild(b);
        var sep = document.createElement('span');
        sep.textContent = '›';
        crumbs.appendChild(sep);
      });
      var cur = document.createElement('button');
      cur.className = 'cur';
      cur.textContent = shortName(el);
      crumbs.appendChild(cur);
      crumbs.scrollLeft = crumbs.scrollWidth;
    }
    var src = findSource(el);
    srcline.textContent = src ? src.file + (src.line ? ':' + src.line : '') : t('ov.src.unknown');
    actText.disabled = n > 1 || el.childElementCount > 0 || !(el.textContent || '').trim();
    actText.title = actText.disabled ? t('ov.act.textOnly') : t('ov.act.text');
    actImg.hidden = !imageEl(el);
    imgBox.hidden = imgBox.hidden || !imageEl(el);
    vpRow.hidden = viewport === 'full';
    vpName.textContent = viewport === '390' ? t('ov.vp.mobile') : t('ov.vp.tablet');
  }

  var activeTab = 'ask';
  function showTab(t) {
    activeTab = t;
    root.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    tabAsk.hidden = t !== 'ask';
    tabStyle.hidden = t !== 'style';
    if (t === 'style' && !tabStyle.dataset.built) buildStylePanel();
    if (t === 'ask') { clearTimeout(focusTimer); focusTimer = setTimeout(function () { if (!editingEl) popIn.focus(); }, 0); }
  }
  root.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.tab); });
  });

  function openPopover(id, keepText) {
    if (!popEnabled) return;
    clearTimeout(popCloseTimer);
    if (popAnchor !== id) discardDrafts();
    popAnchor = id;
    if (!keepText) popIn.value = '';
    setPopStatus(null);
    popQueue.disabled = popNow.disabled = false;
    imgBox.hidden = true;
    tabStyle.dataset.built = '';
    pop.hidden = false;
    popTitle();
    showTab(activeTab === 'style' ? 'style' : 'ask');
    placePopover();
    clearTimeout(focusTimer);
    if (activeTab === 'ask') focusTimer = setTimeout(function () { if (!editingEl) { try { popIn.focus({ preventScroll: true }); } catch (e) { popIn.focus(); } } }, 0);
  }
  var focusTimer = null;

  function closePopover() {
    clearTimeout(popCloseTimer);
    if (editingEl) finishTextEdit(false);
    discardDrafts();
    pop.hidden = true;
    popAnchor = null;
  }

  // Yerel (çevrilebilir) durum: dil değişince yeniden çizilir. 'edit' = döndürücüsüz bilgi satırı
  function setLocalStatus(state, key) {
    setPopStatus(state === 'edit' ? 'busy' : state, t(key));
    if (state === 'edit') { var sp = popSt.querySelector('.sp'); if (sp) sp.remove(); }
    lastStatus = { state: state, key: key };
  }
  function setPopStatus(state, text) {
    lastStatus = null;
    if (!state) { popSt.hidden = true; popSt.className = 'st'; return; }
    popSt.hidden = false;
    popSt.className = 'st' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : '');
    popSt.innerHTML = (state === 'busy' ? '<span class="sp"></span>' : state === 'ok' ? '✓ ' : '') + '<span></span>';
    popSt.lastChild.textContent = text || '';
  }

  // ---------- Stil paneli ----------
  var draft = null; // { undo: [], diffs: {}, classes: '' }
  function ensureDraft() {
    if (!draft) draft = { undo: [], diffs: {}, classes: '', classUndo: [] };
    return draft;
  }
  function draftSet(prop, val, fromVal) {
    var d = ensureDraft();
    selectedEls().forEach(function (el) { d.undo.push(setStyle(el, prop, val)); });
    if (d.diffs[prop]) d.diffs[prop].to = val; else d.diffs[prop] = { from: fromVal, to: val };
    styleDot.hidden = false;
  }
  function draftClasses(classes) {
    var d = ensureDraft();
    d.classUndo.forEach(function (f) { f(); });
    d.classUndo = [];
    d.classes = classes.trim();
    if (d.classes) selectedEls().forEach(function (el) { d.classUndo.push(addClasses(el, d.classes)); });
    styleDot.hidden = !d.classes && !Object.keys(d.diffs).length;
  }
  function discardDrafts() {
    if (draft) {
      draft.classUndo.forEach(function (f) { f(); });
      for (var i = draft.undo.length - 1; i >= 0; i--) draft.undo[i]();
    }
    draft = null;
    styleDot.hidden = true;
    if (pendingImage && pendingImage.undo) pendingImage.undo.forEach(function (f) { f(); });
    pendingImage = null;
    imgInfo.textContent = '';
    imgUrl.value = '';
  }

  function toHex(c) {
    var m = String(c).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/);
    if (!m) return { hex: '#000000', transparent: false };
    var h = '#' + [m[1], m[2], m[3]].map(function (x) { return ('0' + Math.round(+x).toString(16)).slice(-2); }).join('');
    return { hex: h, transparent: m[4] !== undefined && +m[4] === 0 };
  }
  function px(v) { var n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n * 10) / 10; }

  function buildStylePanel() {
    var el = anchorEl();
    if (!el) return;
    tabStyle.dataset.built = '1';
    var cs = getComputedStyle(el);
    tabStyle.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'grid';
    tabStyle.appendChild(grid);

    function row(labelText, content) {
      var l = document.createElement('label');
      l.textContent = labelText;
      grid.appendChild(l);
      var r = document.createElement('div');
      r.className = 'row';
      content.forEach(function (c) { r.appendChild(c); });
      grid.appendChild(r);
    }
    function color(prop) {
      var c = toHex(cs.getPropertyValue(prop));
      var inp = document.createElement('input');
      inp.type = 'color';
      inp.value = c.hex;
      var hx = document.createElement('span');
      hx.className = 'hex';
      hx.textContent = c.transparent ? t('ov.st.transparent') : c.hex;
      var from = cs.getPropertyValue(prop);
      inp.addEventListener('input', function () { hx.textContent = inp.value; draftSet(prop, inp.value, from); });
      return [inp, hx];
    }
    function num(prop, unit, min, max) {
      var inp = document.createElement('input');
      inp.type = 'number';
      if (min !== undefined) inp.min = min;
      if (max !== undefined) inp.max = max;
      var from = cs.getPropertyValue(prop);
      inp.value = unit === '%' ? Math.round(parseFloat(from) * 100) : px(from);
      inp.addEventListener('input', function () {
        if (inp.value === '') return;
        var v = unit === '%' ? String(Math.max(0, Math.min(100, +inp.value)) / 100) : inp.value + unit;
        draftSet(prop, v, from);
      });
      return inp;
    }
    function box4(prefix) {
      var wrap = document.createElement('div');
      wrap.className = 'box4';
      ['top', 'right', 'bottom', 'left'].forEach(function (side) {
        var i = num(prefix + '-' + side, 'px');
        i.title = prefix + '-' + side;
        wrap.appendChild(i);
      });
      return wrap;
    }
    function sel(prop, opts) {
      var s = document.createElement('select');
      var from = cs.getPropertyValue(prop);
      opts.forEach(function (o) {
        var op = document.createElement('option');
        op.value = o[0];
        op.textContent = o[1];
        s.appendChild(op);
      });
      s.value = String(from);
      if (s.value !== String(from)) {
        var cur = document.createElement('option');
        cur.value = from;
        cur.textContent = from;
        s.insertBefore(cur, s.firstChild);
        s.value = from;
      }
      s.addEventListener('change', function () { draftSet(prop, s.value, from); });
      return s;
    }
    function seg(prop, opts) {
      var w = document.createElement('div');
      w.className = 'seg';
      var from = cs.getPropertyValue(prop);
      opts.forEach(function (o) {
        var b = document.createElement('button');
        b.textContent = o[1];
        b.title = t('ov.al.' + o[0]);
        if (from === o[0] || (from === 'start' && o[0] === 'left')) b.classList.add('on');
        b.addEventListener('click', function () {
          w.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
          draftSet(prop, o[0], from);
        });
        w.appendChild(b);
      });
      return w;
    }

    row(t('ov.st.textColor'), color('color'));
    row(t('ov.st.bg'), color('background-color'));
    var fw = sel('font-weight', ['300', '400', '500', '600', '700', '800'].map(function (w) { return [w, t('ov.fw.' + w)]; }));
    var fs = num('font-size', 'px', 6, 200);
    var fsl = document.createElement('span'); fsl.className = 'hex'; fsl.textContent = 'px';
    row(t('ov.st.font'), [fs, fsl, fw]);
    row(t('ov.st.align'), [seg('text-align', [['left', '⇤'], ['center', '↔'], ['right', '⇥'], ['justify', '☰']])]);
    row(t('ov.st.padding'), [box4('padding')]);
    row(t('ov.st.margin'), [box4('margin')]);
    var subl = document.createElement('div'); subl.className = 'box4 sub';
    ['top', 'right', 'bottom', 'left'].forEach(function (k) { var s = document.createElement('span'); s.textContent = t('ov.st.' + k); subl.appendChild(s); });
    row('', [subl]);
    var bw = num('border-width', 'px', 0, 40);
    bw.addEventListener('input', function () {
      if (+bw.value > 0 && cs.getPropertyValue('border-style').indexOf('none') !== -1) draftSet('border-style', 'solid', cs.getPropertyValue('border-style'));
    });
    var bc = color('border-color');
    row(t('ov.st.radius'), [num('border-radius', 'px', 0, 999), (function () { var s = document.createElement('span'); s.className = 'hex'; s.textContent = t('ov.st.border'); return s; })(), bw, bc[0]]);
    row(t('ov.st.opacity'), [num('opacity', '%', 0, 100)]);
    var cls = document.createElement('input');
    cls.type = 'text';
    cls.placeholder = t('ov.st.classPh');
    if (draft && draft.classes) cls.value = draft.classes;
    var clsTimer;
    cls.addEventListener('input', function () { clearTimeout(clsTimer); clsTimer = setTimeout(function () { draftClasses(cls.value); }, 250); });
    row(t('ov.st.addClass'), [cls]);

    var foot = document.createElement('div');
    foot.style.cssText = 'display:flex;justify-content:flex-end;margin-top:6px';
    var reset = document.createElement('button');
    reset.className = 'reset';
    reset.textContent = t('ov.st.reset');
    reset.addEventListener('click', function () {
      var keepImg = pendingImage;
      pendingImage = null;
      if (draft) {
        draft.classUndo.forEach(function (f) { f(); });
        for (var i = draft.undo.length - 1; i >= 0; i--) draft.undo[i]();
      }
      draft = null;
      pendingImage = keepImg;
      styleDot.hidden = true;
      buildStylePanel();
    });
    foot.appendChild(reset);
    tabStyle.appendChild(foot);
  }

  // ---------- Görsel ----------
  var pendingImage = null; // { fileName, dataUrl } | { url }, undo
  actImg.addEventListener('click', function () {
    imgBox.hidden = !imgBox.hidden;
    actImg.classList.toggle('on', !imgBox.hidden);
  });
  imgPick.addEventListener('click', function () { imgFile.click(); });
  function previewImage(data, info) {
    var el = anchorEl();
    var img = imageEl(el);
    if (!img) return;
    if (pendingImage && pendingImage.undo) pendingImage.undo.forEach(function (f) { f(); });
    data.undo = [setImg(img, data.dataUrl || data.url)];
    pendingImage = data;
    imgInfo.textContent = info;
  }
  imgFile.addEventListener('change', function () {
    var f = imgFile.files && imgFile.files[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { imgInfo.textContent = t('ov.img.tooBig'); return; }
    var rd = new FileReader();
    rd.onload = function () {
      previewImage({ fileName: f.name, dataUrl: String(rd.result) }, t('ov.img.fileInfo', f.name, Math.round(f.size / 1024)));
    };
    rd.readAsDataURL(f);
    imgFile.value = '';
  });
  imgUrl.addEventListener('change', function () {
    var v = imgUrl.value.trim();
    if (!/^https?:\/\//.test(v)) { if (v) imgInfo.textContent = t('ov.img.badUrl'); return; }
    previewImage({ url: v }, t('ov.img.urlPreview'));
  });

  // ---------- Kuyruğa ekle / hemen gönder ----------
  function buildEntries() {
    var items = selectedSnaps();
    var vpo = !vpRow.hidden && vpOnly.checked ? viewport : null;
    var out = [];
    if (draft && (Object.keys(draft.diffs).length || draft.classes)) {
      var t1 = newToken();
      out.push({ token: t1, kind: 'style', diffs: draft.diffs, classes: draft.classes, items: items, viewportOnly: vpo });
      ops[t1] = draft.undo.concat(draft.classUndo);
      draft = null;
      styleDot.hidden = true;
      tabStyle.dataset.built = '';
    }
    if (pendingImage) {
      var t2 = newToken();
      var anchorSnap = snaps.get(popAnchor);
      out.push({ token: t2, kind: 'image', fileName: pendingImage.fileName, dataUrl: pendingImage.dataUrl, url: pendingImage.url, items: anchorSnap ? [anchorSnap] : items.slice(0, 1), viewportOnly: vpo });
      ops[t2] = pendingImage.undo || [];
      pendingImage = null;
      imgInfo.textContent = '';
      imgUrl.value = '';
    }
    var text = popIn.value.trim();
    if (text) out.push({ token: newToken(), kind: 'prompt', text: text, items: items, viewportOnly: vpo });
    return out;
  }

  function commit(mode) {
    if (editingEl) finishTextEdit(true);
    var entries = buildEntries();
    if (!entries.length) {
      setLocalStatus('err', 'ov.err.empty');
      showTab('ask');
      return;
    }
    popIn.value = '';
    if (activeTab === 'style') buildStylePanel();
    popQueue.disabled = popNow.disabled = true;
    setLocalStatus('busy', mode === 'now' ? 'ov.busy.now' : 'ov.busy.queue');
    post({ type: 'commit', mode: mode, entries: entries });
  }

  popQueue.addEventListener('click', function () { commit('queue'); });
  popNow.addEventListener('click', function () { commit('now'); });
  popX.addEventListener('click', closePopover);
  actCode.addEventListener('click', function () {
    var s = snaps.get(popAnchor);
    if (s) post({ type: 'openSourceReq', item: s });
  });
  actDel.addEventListener('click', function () {
    var items = selectedSnaps();
    var els = selectedEls();
    if (!els.length) return;
    var token = newToken();
    ops[token] = previewEntry({ kind: 'delete' }, els);
    post({ type: 'commit', mode: 'queue', entries: [{ token: token, kind: 'delete', items: items, viewportOnly: !vpRow.hidden && vpOnly.checked ? viewport : null }] });
    var ids = [];
    selected.forEach(function (_, id) { ids.push(id); });
    ids.forEach(function (id) { selected.delete(id); post({ type: 'unselect', id: id }); });
    closePopover();
  });

  // ---------- Metni yerinde düzenleme ----------
  var editingEl = null, editOrig = '', editPrevOutline = '';
  function startTextEdit() {
    var el = anchorEl();
    if (!el || actText.disabled) return;
    clearTimeout(focusTimer);
    editingEl = el;
    editOrig = el.textContent;
    editPrevOutline = el.style.outline;
    el.style.outline = '2px dashed #f97316';
    el.style.outlineOffset = '2px';
    try { el.contentEditable = 'plaintext-only'; } catch (e) { el.contentEditable = 'true'; }
    if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
    actText.classList.add('on');
    el.addEventListener('keydown', onEditKey, true);
    el.addEventListener('blur', onEditBlur, true);
    setLocalStatus('edit', 'ov.edit.hint');
  }
  function onEditKey(e) {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishTextEdit(true); }
    else if (e.key === 'Escape') { e.preventDefault(); finishTextEdit(false); }
  }
  function onEditBlur() { if (editingEl) finishTextEdit(true); }
  function finishTextEdit(save) {
    var el = editingEl;
    if (!el) return;
    editingEl = null;
    el.removeEventListener('keydown', onEditKey, true);
    el.removeEventListener('blur', onEditBlur, true);
    el.removeAttribute('contenteditable');
    el.style.outline = editPrevOutline;
    el.style.outlineOffset = '';
    actText.classList.remove('on');
    var now = el.textContent;
    if (!save || now.trim() === editOrig.trim() || !now.trim()) {
      el.textContent = editOrig;
      setPopStatus(null);
      return;
    }
    var token = newToken();
    var orig = editOrig;
    ops[token] = [function () { el.textContent = orig; }];
    var snap = snaps.get(popAnchor) || describe(el, popAnchor);
    post({
      type: 'commit', mode: 'queue',
      entries: [{ token: token, kind: 'text', from: orig.trim().replace(/\s+/g, ' '), to: now.trim(), items: [snap], viewportOnly: null }],
    });
    setLocalStatus('busy', 'ov.busy.queue');
  }
  actText.addEventListener('click', function () { if (editingEl) finishTextEdit(true); else startTextEdit(); });

  // ---------- Hiyerarşide gezinme ----------
  function navigate(el) {
    if (!el || el === document.body || el === document.documentElement || isOurs(el)) return;
    var oldId = popAnchor;
    if (oldId === null) return;
    discardDrafts();
    selected.delete(oldId);
    var id = nextId++;
    selected.set(id, el);
    var item = describe(el, id);
    snaps.set(id, item);
    post({ type: 'replace', oldId: oldId, item: item, nav: true });
    openPopover(id, true);
  }
  function navKey(e) {
    if (!e.altKey || pop.hidden || editingEl) return false;
    var el = anchorEl();
    if (!el) return false;
    var map = { ArrowUp: el.parentElement, ArrowDown: el.firstElementChild, ArrowLeft: el.previousElementSibling, ArrowRight: el.nextElementSibling };
    if (!(e.key in map)) return false;
    e.preventDefault();
    navigate(map[e.key]);
    return true;
  }

  // Kutunun içinde yazarken sayfanın kendi kısayolları devreye girmesin
  ['keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'paste', 'copy', 'cut'].forEach(function (ev) {
    pop.addEventListener(ev, function (e) {
      if (ev === 'keydown') {
        if (navKey(e)) { e.stopPropagation(); return; }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(e.shiftKey ? 'now' : 'queue'); }
        else if (e.key === 'Escape') { e.preventDefault(); closePopover(); }
      }
      e.stopPropagation();
    });
  });
  ['pointerdown', 'mousedown', 'click', 'dblclick', 'wheel'].forEach(function (ev) {
    pop.addEventListener(ev, function (e) { e.stopPropagation(); });
  });

  // ---------- Sayfa olayları ----------
  function targetOf(e) {
    if (fromOverlay(e)) return null;
    var t = e.composedPath ? e.composedPath()[0] : e.target;
    if (!t || t.nodeType !== 1) t = e.target;
    if (t && t.nodeType === 3) t = t.parentElement;
    if (!t || isOurs(t)) return null;
    if (t === document.documentElement || t === document.body) return null;
    return t;
  }

  function setMode(on, notify) {
    var wasOn = selectMode;
    selectMode = !!on;
    document.documentElement.style.cursor = selectMode ? 'crosshair' : '';
    if (!selectMode) hoverEl = null;
    // Seç kapatılınca sayfada seçili bir şey kalmasın (panel/Chrome listesi de temizlensin)
    if (wasOn && !selectMode) {
      selected.forEach(function (_, id) { post({ type: 'unselect', id: id }); });
      selected.clear();
      closePopover();
    }
    if (notify) post({ type: 'mode', on: selectMode });
  }

  // Seçim modu kapalıyken Alt (Option) basılı tutarak da seçilebilir
  var peek = false;
  window.addEventListener('pointermove', function (e) {
    if (!active) return;
    peek = e.altKey;
    if (!selectMode && !peek) { hoverEl = null; return; }
    var t = targetOf(e);
    if (t && t !== hoverEl) {
      hoverEl = t;
      label.innerHTML = labelText(t);
    }
  }, true);
  window.addEventListener('keyup', function (e) { if (e.key === 'Alt') { peek = false; if (!selectMode) hoverEl = null; } }, true);

  function select(el, additive) {
    var existing = null;
    selected.forEach(function (v, k) { if (v === el) existing = k; });
    // zaten tek seçili olan öğeye tekrar tıklandı: seçimi koru (çift tık ile metin düzenleme için)
    if (existing !== null && !additive && selected.size === 1) {
      if (pop.hidden) openPopover(existing, true);
      return;
    }
    if (!additive) { selected.clear(); existing = null; }
    if (existing !== null && additive) {
      selected.delete(existing);
      post({ type: 'unselect', id: existing });
      afterRemove(existing);
      return;
    }
    if (existing !== null && !additive) return;
    var id = nextId++;
    selected.set(id, el);
    var item = describe(el, id);
    snaps.set(id, item);
    post({ type: 'select', additive: !!additive, item: item });
    if (additive && !pop.hidden) { popAnchor = id; popTitle(); placePopover(); popIn.focus(); }
    else openPopover(id, false);
  }

  function afterRemove(id) {
    if (pop.hidden) return;
    if (!selected.size) return closePopover();
    if (popAnchor === id) {
      var last = null;
      selected.forEach(function (_, k) { last = k; });
      popAnchor = last;
    }
    popTitle();
  }

  function block(e) {
    var t = targetOf(e);
    if (editingEl && t && editingEl.contains(t)) return; // düzenlenen metne tıklamalar serbest
    if (!active) return;
    if (!selectMode && !e.altKey) return;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.type === 'dblclick') {
      var a = anchorEl();
      if (a && (a === t || a.contains(t)) && !actText.disabled) startTextEdit();
      return;
    }
    if (e.type === 'click') {
      if (editingEl) finishTextEdit(true);
      select(t, e.shiftKey || e.metaKey || e.ctrlKey);
    }
  }
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'].forEach(function (ev) {
    window.addEventListener(ev, block, true);
  });
  window.addEventListener('submit', function (e) { if (selectMode) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);

  window.addEventListener('keydown', function (e) {
    if (editingEl) return;
    if (fromOverlay(e)) return; // kutunun kendi dinleyicisi halleder
    if (navKey(e)) return;
    if (e.key === 'Escape' && !pop.hidden) {
      e.preventDefault();
      closePopover();
    } else if (e.key === 'Escape' && selectMode) {
      e.preventDefault();
      setMode(false, true);
    }
  }, true);

  // ---------- Ajan istekleri (MCP: highlight, preview_style, screenshot_element) ----------
  // Claude, Panoptent'in MCP sunucusu üzerinden sayfada öğe gösterebilir, stil önerisini canlı önizleyebilir
  // ve bir öğenin görüntüsünü alabilir. Hiçbiri kaynak koda dokunmaz; önizlemeler sayfa yenilenince kaybolur.
  var agentMarks = []; // { el, label, until }
  var agentPreviews = {}; // önizleme kimliği -> geri alma fonksiyonları
  var agentSeq = 0;
  var MAX_TARGETS = 50;

  function reply(m, data) {
    data.type = 'mcpResult';
    data.reqId = m.reqId;
    data.op = m.op;
    post(data);
  }

  /** Hedefler: seçimdeki kimlik (yoksa seçimdeki seçici) ve/veya sayfadaki CSS seçicisi. */
  function agentTargets(m) {
    var els = [];
    var add = function (el) { if (el && el.nodeType === 1 && !isOurs(el) && els.indexOf(el) < 0 && els.length < MAX_TARGETS) els.push(el); };
    (m.targets || []).forEach(function (tg) {
      var el = selected.get(tg.id);
      if (!el || !el.isConnected) { try { el = tg.selector ? document.querySelector(tg.selector) : null; } catch (e) { el = null; } }
      add(el);
    });
    if (m.selector) {
      try { Array.prototype.forEach.call(document.querySelectorAll(m.selector), add); } catch (e) { return { error: 'Invalid CSS selector: ' + m.selector }; }
    }
    return { els: els };
  }

  function brief(el) {
    var r = el.getBoundingClientRect();
    var src = findSource(el);
    return {
      tag: el.tagName.toLowerCase(),
      selector: selectorFor(el),
      source: src ? src.file + (src.line ? ':' + src.line : '') : undefined,
      size: Math.round(r.width) + '×' + Math.round(r.height),
    };
  }

  function renderAgentMarks() {
    var now = Date.now();
    agentMarks = agentMarks.filter(function (k) { return k.el.isConnected && (!k.until || k.until > now); });
    var i = 0;
    agentMarks.forEach(function (k) {
      var box = agentLayer.children[i * 2], lb = agentLayer.children[i * 2 + 1];
      if (!box) {
        box = document.createElement('div');
        box.className = 'box agent';
        lb = document.createElement('div');
        lb.className = 'alb';
        agentLayer.appendChild(box);
        agentLayer.appendChild(lb);
      }
      var r = place(box, k.el);
      box.hidden = lb.hidden = r.width === 0 && r.height === 0;
      if (lb.textContent !== k.label) lb.textContent = k.label;
      var top = r.top - 22;
      if (top < 2) top = r.bottom + 4;
      lb.style.top = top + 'px';
      lb.style.left = Math.max(2, Math.min(r.left, window.innerWidth - 200)) + 'px';
      i++;
    });
    while (agentLayer.children.length > i * 2) agentLayer.removeChild(agentLayer.lastChild);
  }

  function mark(els, label, seconds) {
    var until = seconds > 0 ? Date.now() + seconds * 1000 : 0;
    els.forEach(function (el) {
      agentMarks = agentMarks.filter(function (k) { return k.el !== el; });
      agentMarks.push({ el: el, label: label, until: until });
    });
    var r = els[0] && els[0].getBoundingClientRect();
    if (r && (r.bottom < 0 || r.top > window.innerHeight)) els[0].scrollIntoView({ block: 'center' });
  }

  function agentReset(id) {
    Object.keys(agentPreviews).forEach(function (k) {
      if (id && id !== 'all' && k !== id) return;
      var list = agentPreviews[k];
      for (var i = list.length - 1; i >= 0; i--) { try { list[i](); } catch (e) { /* yok say */ } }
      delete agentPreviews[k];
    });
  }

  var CSS_PROP = /^(--[\w-]+|-?[a-z][a-z0-9-]*)$/;

  function agentPreview(m, els) {
    var styles = m.styles || {};
    var props = Object.keys(styles).filter(function (p) { return CSS_PROP.test(p); });
    var bad = Object.keys(styles).filter(function (p) { return !CSS_PROP.test(p); });
    var undo = [];
    els.forEach(function (el) {
      props.forEach(function (p) { undo.push(setStyle(el, p, String(styles[p]).slice(0, 1000))); });
      if (m.classes) undo.push(addClasses(el, String(m.classes)));
    });
    var id = 'pv' + (++agentSeq);
    agentPreviews[id] = undo;
    mark(els, m.label || t('ov.agent.preview'), 6);
    // tarayıcının kabul etmediği değerleri bildir (ör. yazım hatası)
    var ignored = [];
    props.forEach(function (p) { if (!els[0].style.getPropertyValue(p)) ignored.push(p); });
    return { previewId: id, ignored: bad.concat(ignored) };
  }

  // --- Görüntü: DOM'u SVG foreignObject içinde çizer (VS Code önizlemesi ve Chrome yedeği) ---
  var baseStyles = {};
  var sandbox = null;
  function baseStyle(tag, pseudo) {
    var key = tag + (pseudo || '');
    if (baseStyles[key]) return baseStyles[key];
    if (!sandbox) {
      sandbox = document.createElement('div');
      sandbox.style.cssText = 'all:initial;position:fixed;left:-99999px;top:0;visibility:hidden';
      root.appendChild(sandbox);
    }
    var el;
    try { el = document.createElement(tag); } catch (e) { el = document.createElement('div'); }
    sandbox.appendChild(el);
    var cs = getComputedStyle(el, pseudo || null), out = {};
    for (var i = 0; i < cs.length; i++) out[cs[i]] = cs.getPropertyValue(cs[i]);
    sandbox.removeChild(el);
    return (baseStyles[key] = out);
  }
  function styleText(cs, base) {
    var s = '';
    for (var i = 0; i < cs.length; i++) {
      var k = cs[i], v = cs.getPropertyValue(k);
      if (base[k] !== v) s += k + ':' + v + ';';
    }
    return s;
  }

  var URL_RE = /url\((["']?)([^"')]+)\1\)/g;
  function toDataUrl(url, cache) {
    if (!url || /^data:/.test(url)) return Promise.resolve(url);
    if (cache[url]) return cache[url];
    cache[url] = fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.blob();
    }).then(function (b) {
      if (b.size > 3e6) throw new Error('too big');
      return new Promise(function (res, rej) {
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = rej;
        fr.readAsDataURL(b);
      });
    }).catch(function () { return url; });
    return cache[url];
  }
  function inlineUrls(text, base, cache) {
    var urls = [];
    text.replace(URL_RE, function (_, q, u) { if (u.charAt(0) !== '#') urls.push(u); return _; });
    if (!urls.length) return Promise.resolve(text);
    return Promise.all(urls.map(function (u) {
      var abs;
      try { abs = new URL(u, base).href; } catch (e) { abs = u; }
      return toDataUrl(abs, cache);
    })).then(function (data) {
      var i = 0;
      return text.replace(URL_RE, function (all, q, u) { return u.charAt(0) === '#' ? all : 'url("' + data[i++] + '")'; });
    });
  }

  /** Aynı kökenli stil sayfalarındaki @font-face kuralları (yazı tipleri görüntüde doğru görünsün). */
  function fontCss(cache) {
    var jobs = [];
    Array.prototype.forEach.call(document.styleSheets, function (sh) {
      var rules;
      try { rules = sh.cssRules; } catch (e) { return; } // başka kökenden: okunamaz
      Array.prototype.forEach.call(rules || [], function (r) {
        if (r.type === 5 && jobs.length < 30) jobs.push(inlineUrls(r.cssText, sh.href || location.href, cache));
      });
    });
    return Promise.all(jobs).then(function (a) { return a.join('\n'); });
  }

  function cloneTree(src, ctx, isRoot) {
    if (src.nodeType === 3) return document.createTextNode(src.nodeValue);
    if (src.nodeType !== 1 || isOurs(src)) return null;
    var tag = src.tagName;
    if (/^(SCRIPT|NOSCRIPT|TEMPLATE|STYLE|LINK|META)$/.test(tag)) return null;
    if (++ctx.count > 6000) throw new Error('The element is too large to render (over 6000 nodes). Pick a smaller element.');
    var cs = getComputedStyle(src);
    if (cs.display === 'none') return null;
    var c;
    if (tag === 'CANVAS') {
      c = document.createElement('img');
      try { c.setAttribute('src', src.toDataURL()); } catch (e) { /* kirli tuval */ }
    } else if (tag === 'IFRAME' || tag === 'VIDEO' || tag === 'OBJECT' || tag === 'EMBED') {
      c = document.createElement('div');
      if (tag === 'VIDEO' && src.poster) c.style.background = 'url("' + src.poster + '") center/cover';
    } else {
      c = src.cloneNode(false);
      if (tag === 'IMG' && (src.currentSrc || src.src)) {
        c.removeAttribute('srcset');
        c.removeAttribute('loading');
        (function (img, url) {
          ctx.jobs.push(toDataUrl(url, ctx.cache).then(function (d) { img.setAttribute('src', d); }));
        })(c, src.currentSrc || src.src);
      }
      if (tag === 'INPUT') {
        if (src.type === 'checkbox' || src.type === 'radio') { if (src.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked'); }
        else c.setAttribute('value', src.value);
      }
      if (tag === 'TEXTAREA') c.textContent = src.value;
      if (tag === 'SELECT') {
        Array.prototype.forEach.call(src.children, function (o) { var oc = o.cloneNode(true); if (o.selected) oc.setAttribute('selected', ''); c.appendChild(oc); });
      }
    }
    var css = styleText(cs, baseStyle(tag.toLowerCase())) + 'animation:none;transition:none;';
    if (isRoot) {
      css += 'margin:0;' + (cs.position === 'static' ? '' : 'position:relative;inset:auto;') + 'transform:none;';
    }
    if (/url\(/.test(css)) {
      (function (node, text) {
        ctx.jobs.push(inlineUrls(text, location.href, ctx.cache).then(function (v) { node.setAttribute('style', v); }));
      })(c, css);
    }
    c.setAttribute('style', css);
    ['::before', '::after'].forEach(function (ps) {
      var pcs = getComputedStyle(src, ps);
      var content = pcs.getPropertyValue('content');
      if (!content || content === 'none' || content === 'normal') return;
      var cls = 'pt-ps' + (++ctx.pseudo);
      c.setAttribute('class', ((c.getAttribute('class') || '') + ' ' + cls).trim());
      ctx.rules.push('.' + cls + ps + '{' + styleText(pcs, baseStyle(tag.toLowerCase(), ps)) + 'content:' + content + ';}');
    });
    if (tag !== 'SELECT' && tag !== 'TEXTAREA' && tag !== 'CANVAS') {
      var kids = src.shadowRoot ? src.shadowRoot.childNodes : src.childNodes;
      Array.prototype.forEach.call(kids, function (n) {
        var k = cloneTree(n, ctx, false);
        if (k) c.appendChild(k);
      });
    }
    return c;
  }

  function pageBackground(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
    }
    return '#fff';
  }

  function renderShot(el) {
    var r = el.getBoundingClientRect();
    var w = Math.max(1, Math.ceil(r.width)), h = Math.max(1, Math.ceil(r.height));
    var ctx = { count: 0, pseudo: 0, jobs: [], cache: {}, rules: [] };
    var clone = cloneTree(el, ctx, true);
    if (!clone) return Promise.reject(new Error('The element is not visible (display: none).'));
    return Promise.all([fontCss(ctx.cache)].concat(ctx.jobs)).then(function (a) {
      var wrap = document.createElement('div');
      wrap.setAttribute('style', 'width:' + w + 'px;height:' + h + 'px;overflow:hidden;background:' + pageBackground(el));
      var st = document.createElement('style');
      st.textContent = a[0] + '\n' + ctx.rules.join('\n');
      wrap.appendChild(st);
      wrap.appendChild(clone);
      var xml = new XMLSerializer().serializeToString(wrap);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xml + '</foreignObject></svg>';
      return new Promise(function (res, rej) {
        var img = new Image();
        img.onload = function () { res(img); };
        img.onerror = function () { rej(new Error('The browser could not render the element.')); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    }).then(function (img) {
      var scale = Math.min(Math.max(1, Math.min(window.devicePixelRatio || 1, 2)), 2000 / w, 4000 / h);
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * scale));
      cv.height = Math.max(1, Math.round(h * scale));
      var g = cv.getContext('2d');
      g.drawImage(img, 0, 0, cv.width, cv.height);
      var url = cv.toDataURL('image/png');
      if (url.length > 6e6) url = cv.toDataURL('image/jpeg', 0.85);
      var mime = url.slice(5, url.indexOf(';'));
      return { data: url.slice(url.indexOf(',') + 1), mime: mime, width: cv.width, height: cv.height };
    });
  }

  var hideTimer = null;
  function hideUi(on) {
    clearTimeout(hideTimer);
    host.style.visibility = on ? 'hidden' : '';
    if (on) hideTimer = setTimeout(function () { host.style.visibility = ''; }, 4000);
  }

  function onAgent(m) {
    var found = m.op === 'reset' || m.op === 'show' ? { els: [] } : agentTargets(m);
    if (found.error) return reply(m, { ok: false, error: found.error });
    var els = found.els;
    var need = m.op !== 'reset' && m.op !== 'show' && !(m.op === 'highlight' && m.clear && !(m.targets || []).length && !m.selector);
    if (need && !els.length) return reply(m, { ok: false, error: 'No matching element on the page (it may have been removed or the page reloaded).' });
    switch (m.op) {
      case 'highlight':
        if (m.clear) agentMarks = [];
        if (els.length) mark(els, String(m.label || t('ov.agent')).slice(0, 120), m.seconds === 0 ? 0 : (m.seconds || 8));
        return reply(m, { ok: true, found: els.length, elements: els.slice(0, 10).map(brief) });
      case 'preview': {
        if (m.reset) agentReset('all');
        var pv = agentPreview(m, els);
        return reply(m, { ok: true, found: els.length, previewId: pv.previewId, ignored: pv.ignored.length ? pv.ignored : undefined });
      }
      case 'reset':
        agentReset(m.previewId || 'all');
        agentMarks = [];
        return reply(m, { ok: true });
      case 'locate': {
        // Chrome: sekme görüntüsü için öğeyi görünür alana getir, kendi katmanını gizle
        var el = els[0];
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (m.hide) hideUi(true);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            var r = el.getBoundingClientRect();
            var fits = r.width > 0 && r.height > 0 && r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
            if (!fits) hideUi(false);
            reply(m, { ok: true, fits: fits, rect: { x: r.left, y: r.top, w: r.width, h: r.height }, vw: window.innerWidth, element: brief(el) });
          });
        });
        return;
      }
      case 'show':
        hideUi(false);
        return reply(m, { ok: true });
      case 'screenshot':
        renderShot(els[0]).then(function (shot) {
          shot.ok = true;
          shot.via = 'dom';
          shot.element = brief(els[0]);
          reply(m, shot);
        }, function (err) {
          reply(m, { ok: false, error: err.message || String(err) });
        });
        return;
    }
    reply(m, { ok: false, error: 'Unknown request ' + m.op });
  }

  // ---------- Dil değişimi: açık kutuyu yeniden çevir ----------
  function relocalize() {
    localizeStatic();
    if (pop.hidden) { tabStyle.dataset.built = ''; return; }
    popTitle();
    if (activeTab === 'style' && !tabStyle.hidden) buildStylePanel(); // taslak stiller korunur
    else tabStyle.dataset.built = '';
    if (lastStatus && !popSt.hidden) setLocalStatus(lastStatus.state, lastStatus.key);
  }
  I18N.onChange(relocalize);

  // ---------- Panelden gelen mesajlar ----------
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || m.source !== SRC || m.dir === 'up') return;
    if (!CHROME && e.source !== window.parent) return;
    switch (m.type) {
      case 'mode':
        setMode(m.on, false);
        break;
      case 'clear':
        selected.clear();
        closePopover();
        break;
      case 'remove':
        selected.delete(m.id);
        afterRemove(m.id);
        break;
      case 'config':
        if (typeof m.active === 'boolean') {
          active = m.active;
          if (!active) { setMode(false, false); selected.clear(); closePopover(); hoverEl = null; }
        }
        if (typeof m.popover === 'boolean') { popEnabled = m.popover; if (!popEnabled) closePopover(); }
        if (m.nowLabel) { nowLabel = m.nowLabel; popNow.textContent = m.nowLabel; }
        if (m.lang && I18N.setLang(m.lang)) relocalize();
        if (m.viewport) { viewport = String(m.viewport); if (!pop.hidden) popTitle(); }
        break;
      case 'popStatus':
        popQueue.disabled = popNow.disabled = m.state === 'busy';
        if (pop.hidden) break;
        setPopStatus(m.state, m.text);
        if (m.state === 'ok') {
          clearTimeout(popCloseTimer);
          if (m.closeAfter) popCloseTimer = setTimeout(closePopover, m.closeAfter);
        }
        break;
      case 'revert':
        (m.tokens || [m.token]).forEach(revertToken);
        break;
      case 'reapply':
        (m.entries || []).forEach(function (en) {
          if (ops[en.token]) return;
          var els = (en.items || []).map(function (it) {
            try { return document.querySelector(it.selector); } catch (err) { return null; }
          }).filter(Boolean);
          if (els.length) ops[en.token] = previewEntry(en, els);
        });
        break;
      case 'forget':
        // uygulandı: önizleme kalsın ama artık geri alınmayacak
        (m.tokens || []).forEach(function (t) { delete ops[t]; });
        break;
      case 'setText': {
        var el = selected.get(m.id);
        if (el) el.textContent = m.text;
        break;
      }
      case 'parent': {
        var cur = selected.get(m.id);
        if (cur && cur.parentElement && cur.parentElement !== document.body && cur.parentElement !== document.documentElement) {
          if (popAnchor === m.id) { navigate(cur.parentElement); break; }
          selected.delete(m.id);
          var pid = nextId++;
          selected.set(pid, cur.parentElement);
          var pitem = describe(cur.parentElement, pid);
          snaps.set(pid, pitem);
          post({ type: 'replace', oldId: m.id, item: pitem });
        }
        break;
      }
      case 'refresh': {
        selected.forEach(function (el2, id2) {
          if (el2.isConnected) {
            var it = describe(el2, id2);
            snaps.set(id2, it);
            post({ type: 'replace', oldId: id2, item: it });
          }
        });
        break;
      }
      case 'scrollTo': {
        var el3 = selected.get(m.id);
        if (el3) el3.scrollIntoView({ block: 'center', behavior: 'smooth' });
        break;
      }
      case 'mcpRequest':
        try { onAgent(m); } catch (err) { reply(m, { ok: false, error: err.message || String(err) }); }
        break;
      case 'openPopover': {
        var last = null;
        selected.forEach(function (_, k) { last = k; });
        if (last !== null) openPopover(last, true);
        break;
      }
    }
  });

  // ---------- Sayfa konumu ----------
  function reportLocation() {
    post({ type: 'location', href: location.href, title: document.title });
  }
  ['pushState', 'replaceState'].forEach(function (fn) {
    var orig = history[fn];
    history[fn] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(reportLocation, 0);
      return r;
    };
  });
  window.addEventListener('popstate', reportLocation);
  window.addEventListener('hashchange', reportLocation);

  requestAnimationFrame(render);
  function ready() {
    post({ type: 'ready', href: location.href, title: document.title, support: detectSourceSupport() });
  }
  if (document.readyState === 'complete') setTimeout(ready, 300);
  else window.addEventListener('load', function () { setTimeout(ready, 300); });
})();
