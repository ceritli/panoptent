/* Panoptent — Test ve Kararlar tam sayfa (VS Code webview).
 * Bütün açık konular, süzgeçler, adım işaretleme ve karar seçme. Yazma, sayfadaki panelle aynı yoldan gider
 * (checksReq → motor → tek alan + kilit). Konu metni veridir: hepsi textContent ile basılır, yalnız **kalın** tanınır.
 */
(function () {
  'use strict';
  var vscode = acquireVsCodeApi();
  var I18N = window.PanoptentI18n;
  var t = I18N.t;
  var CK = window.PanoptentChecks;
  I18N.add({
    en: {
      'cp.title': 'Test and Decisions',
      'cp.sum': '{0} open topic(s) · {1} waiting for you · {2} problem(s)',
      'cp.who': 'Your name on marks: {0} ({1})',
      'cp.whoFix': 'Change',
      'cp.src.setting': 'Panoptent setting', 'cp.src.github-cli': 'GitHub CLI', 'cp.src.git-github-user': 'git config github.user',
      'cp.src.git-user-name': 'git user.name, not a GitHub user name', 'cp.src.os': 'system user, not a GitHub user name',
      'cp.filter': 'Show', 'cp.f.all': 'All', 'cp.f.bad': 'Problems', 'cp.f.none': 'Not looked at', 'cp.f.undecided': 'Undecided',
      'cp.topics': 'Topics', 'cp.allTopics': 'All topics',
      'cp.tests': 'Test', 'cp.decisions': 'Decide', 'cp.infos': 'Info',
      'cp.testCount': '{0}/{1} ok', 'cp.badCount': ' · {0} problem(s)', 'cp.decCount': '{0}/{1} decided',
      'cp.agent': 'Agent tried', 'cp.expected': 'Expected: ', 'cp.done': 'Done',
      'cp.open': 'Open page ↗', 'cp.bad': 'Problem', 'cp.badOn': 'Problem ✕', 'cp.notePh': 'What did you see?',
      'cp.json': 'Open JSON', 'cp.onPage': 'Show on the page',
      'cp.by': '{0} · {1}', 'cp.saving': 'Saving…', 'cp.saveFail': 'Not saved: {0}', 'cp.timeout': 'No answer; this mark was not saved. Try again.',
      'cp.empty': 'No open topics. When an agent finishes a piece of work, it adds what to try and what to decide here.',
      'cp.nothing': 'Nothing to show with this filter.',
      'cp.fileErr': '{0} file(s) could not be read: {1}',
      'cp.warn': 'Steps and notes are saved in .panoptent/checks (committed with the project) and shown in the page you develop: never write passwords, tokens or customer data.',
    },
    tr: {
      'cp.title': 'Test ve Kararlar',
      'cp.sum': '{0} açık konu · {1} seni bekliyor · {2} sorun',
      'cp.who': 'İşaretlerdeki adın: {0} ({1})',
      'cp.whoFix': 'Değiştir',
      'cp.src.setting': 'Panoptent ayarı', 'cp.src.github-cli': 'GitHub CLI', 'cp.src.git-github-user': 'git config github.user',
      'cp.src.git-user-name': 'git user.name, GitHub kullanıcı adı değil', 'cp.src.os': 'sistem kullanıcısı, GitHub kullanıcı adı değil',
      'cp.filter': 'Göster', 'cp.f.all': 'Tümü', 'cp.f.bad': 'Sorunlu', 'cp.f.none': 'Bakılmamış', 'cp.f.undecided': 'Kararsız',
      'cp.topics': 'Konular', 'cp.allTopics': 'Bütün konular',
      'cp.tests': 'Test et', 'cp.decisions': 'Karar ver', 'cp.infos': 'Bilgi',
      'cp.testCount': '{0}/{1} tamam', 'cp.badCount': ' · {0} sorun', 'cp.decCount': '{0}/{1} karar',
      'cp.agent': 'Ajan denedi', 'cp.expected': 'Beklenen: ', 'cp.done': 'Tamam',
      'cp.open': 'Sayfayı aç ↗', 'cp.bad': 'Sorun', 'cp.badOn': 'Sorun ✕', 'cp.notePh': 'Ne gördün?',
      'cp.json': 'JSON dosyasını aç', 'cp.onPage': 'Sayfada göster',
      'cp.by': '{0} · {1}', 'cp.saving': 'Kaydediliyor…', 'cp.saveFail': 'Kaydedilmedi: {0}', 'cp.timeout': 'Yanıt gelmedi; bu işaret kaydedilmedi. Yeniden dene.',
      'cp.empty': 'Açık konu yok. Ajan bir işi bitirince ne denenecek ve neye karar verilecek listesini buraya ekler.',
      'cp.nothing': 'Bu süzgeçle gösterilecek bir şey yok.',
      'cp.fileErr': '{0} dosya okunamadı: {1}',
      'cp.warn': 'Adımlar ve notlar .panoptent/checks altında saklanır (projeyle commit edilir) ve geliştirdiğin sayfada da görünür: şifre, jeton ya da müşteri verisi yazma.',
    },
  });

  var saved = vscode.getState() || {};
  var S = {
    topics: [], errors: [], pending: 0, bad: 0, who: null,
    filter: ['all', 'bad', 'none', 'undecided'].indexOf(saved.filter) >= 0 ? saved.filter : 'all',
    topic: typeof saved.topic === 'string' ? saved.topic : '', // '' = bütün konular
  };
  var optim = {}; // 'r|konu|test' / 'p|konu|karar' -> { v, reqId, done }
  var pending = {}; // reqId -> { key, timer }
  var noteTimers = {};
  var seq = 0;
  var rendering = false;
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }
  function btn(cls, text, key, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (key) b.setAttribute('data-k', key);
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }
  function rich(parent, s) {
    CK.segments(s).forEach(function (sg) { parent.appendChild(sg.b ? el('b', null, sg.s) : document.createTextNode(sg.s)); });
    return parent;
  }
  function time(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(I18N.lang === 'tr' ? 'tr-TR' : 'en-US', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function save() { vscode.setState({ filter: S.filter, topic: S.topic }); }

  function resultOf(tp, x) { var o = optim['r|' + tp.id + '|' + x.id]; return o ? o.v : (x.result || { state: 'none' }); }
  function pickOf(tp, d) { var o = optim['p|' + tp.id + '|' + d.id]; return o ? o.v : (d.pick ? d.pick.index : null); }
  function findTest(topicId, testId) {
    var tp = S.topics.filter(function (x) { return x.id === topicId; })[0];
    var x = tp && (tp.tests || []).filter(function (y) { return y.id === testId; })[0];
    return tp && x ? { tp: tp, x: x } : null;
  }

  function setMsg(kind, text) {
    var m = $('msg');
    m.className = 'msg ' + (kind || '');
    m.textContent = text || '';
    m.hidden = !text;
  }

  function write(op, data, key, value) {
    var reqId = 'cp' + Date.now().toString(36) + (++seq);
    optim[key] = { v: value, reqId: reqId, done: false };
    pending[reqId] = { key: key, timer: setTimeout(function () { done(reqId, false, t('cp.timeout')); }, 8000) };
    data.type = 'checksReq';
    data.reqId = reqId;
    data.op = op;
    vscode.postMessage(data);
    setMsg('', t('cp.saving'));
    render();
  }
  function done(reqId, ok, error) {
    var p = pending[reqId];
    if (!p) return;
    clearTimeout(p.timer);
    delete pending[reqId];
    var o = optim[p.key];
    if (o && o.reqId === reqId) { if (ok) o.done = true; else delete optim[p.key]; }
    if (!ok) setMsg('err', t('cp.saveFail', error || '?'));
    else if (!Object.keys(pending).length) setMsg('', '');
    render();
  }

  // ---------- çizim ----------
  function render() {
    if (rendering) return;
    rendering = true;
    try { draw(); } finally { rendering = false; }
  }

  function focusKey() {
    var a = document.activeElement;
    if (!a || !app.contains(a) || !a.getAttribute('data-k')) return null;
    return { key: a.getAttribute('data-k'), start: a.selectionStart, end: a.selectionEnd, value: a.tagName === 'TEXTAREA' ? a.value : null };
  }
  function restore(k) {
    if (!k) return;
    var n = app.querySelector('[data-k="' + k.key.replace(/["\\]/g, '\\$&') + '"]');
    if (!n) return;
    if (k.value != null) n.value = k.value;
    n.focus({ preventScroll: true });
    try { if (k.start != null) n.setSelectionRange(k.start, k.end); } catch (e) { /* yok */ }
  }

  function counts(tp) {
    var ok = 0, bad = 0, none = 0, decided = 0;
    (tp.tests || []).forEach(function (x) { var s = resultOf(tp, x).state; if (s === 'ok') ok++; else if (s === 'bad') bad++; else none++; });
    (tp.decisions || []).forEach(function (d) { if (pickOf(tp, d) != null) decided++; });
    return { ok: ok, bad: bad, none: none, tests: (tp.tests || []).length, decided: decided, decisions: (tp.decisions || []).length };
  }

  function draw() {
    var keep = focusKey();
    var scroll = window.scrollY;
    $('title').textContent = t('cp.title');
    $('sum').textContent = t('cp.sum', S.topics.length, S.pending, S.bad);
    var who = $('who');
    who.textContent = '';
    if (S.who) {
      who.appendChild(document.createTextNode(t('cp.who', S.who.name, t('cp.src.' + S.who.source)) + ' '));
      who.appendChild(btn('link', t('cp.whoFix'), 'who', function () { vscode.postMessage({ type: 'nameSetting' }); }));
    }
    $('warn').textContent = t('cp.warn');
    // süzgeç
    var f = $('filters');
    f.textContent = '';
    f.setAttribute('aria-label', t('cp.filter'));
    ['all', 'bad', 'none', 'undecided'].forEach(function (k) {
      var b = btn('seg' + (S.filter === k ? ' on' : ''), t('cp.f.' + k), 'f|' + k, function () { S.filter = k; save(); render(); });
      b.setAttribute('aria-pressed', String(S.filter === k));
      f.appendChild(b);
    });
    // konu listesi
    if (S.topic && !S.topics.some(function (x) { return x.id === S.topic; })) S.topic = '';
    var nav = $('nav');
    nav.textContent = '';
    nav.appendChild(el('div', 'navHead', t('cp.topics')));
    var navItem = function (id, name, c) {
      var b = btn('navItem' + (S.topic === id ? ' on' : ''), null, 'nav|' + id, function () { S.topic = id; save(); render(); });
      b.setAttribute('aria-current', String(S.topic === id));
      b.appendChild(el('span', 'navName', name));
      if (c) {
        b.appendChild(el('span', 'navCnt', c.ok + '/' + c.tests));
        if (c.bad) b.appendChild(el('span', 'pill bad', String(c.bad)));
      }
      nav.appendChild(b);
    };
    navItem('', t('cp.allTopics'), null);
    S.topics.forEach(function (tp) { navItem(tp.id, tp.name, counts(tp)); });
    // içerik
    var main = $('main');
    main.textContent = '';
    if (S.errors.length) main.appendChild(el('div', 'msg err', t('cp.fileErr', S.errors.length, S.errors.map(function (e) { return e.file + ' (' + e.error + ')'; }).join('; '))));
    if (!S.topics.length) {
      main.appendChild(el('p', 'empty', t('cp.empty')));
    } else {
      var shown = 0;
      S.topics.forEach(function (tp) {
        if (S.topic && tp.id !== S.topic) return;
        var card = topicCard(tp);
        if (card) { main.appendChild(card); shown++; }
      });
      if (!shown) main.appendChild(el('p', 'empty', t('cp.nothing')));
    }
    window.scrollTo(0, scroll);
    restore(keep);
  }

  function topicCard(tp) {
    var tests = (tp.tests || []).map(function (x, i) { return { x: x, i: i }; }).filter(function (r) {
      var s = resultOf(tp, r.x).state;
      return S.filter === 'all' || (S.filter === 'bad' && s === 'bad') || (S.filter === 'none' && s === 'none');
    });
    var decs = (tp.decisions || []).map(function (d, i) { return { d: d, i: i }; }).filter(function (r) {
      return S.filter === 'all' || (S.filter === 'undecided' && pickOf(tp, r.d) == null);
    });
    if (S.filter !== 'all' && !tests.length && !decs.length) return null;
    var c = counts(tp);
    var card = el('section', 'card');
    card.setAttribute('aria-label', tp.name);
    var head = el('div', 'cardHead');
    var h = el('h2', null, tp.name);
    head.appendChild(h);
    var acts = el('div', 'cardActs');
    acts.appendChild(btn('link', t('cp.json'), 'json|' + tp.id, function () { vscode.postMessage({ type: 'openFile', topic: tp.id }); }));
    acts.appendChild(btn('link', t('cp.onPage'), 'page|' + tp.id, function () { vscode.postMessage({ type: 'showOnPage' }); }));
    head.appendChild(acts);
    card.appendChild(head);
    if (tp.date || tp.lead) card.appendChild(el('p', 'lead', [tp.date, tp.lead].filter(Boolean).join(' · ')));

    if (S.filter !== 'undecided') {
      var sec = el('div', 'sec', '1 · ' + t('cp.tests'));
      sec.appendChild(el('span', 'secCnt', t('cp.testCount', c.ok, c.tests) + (c.bad ? t('cp.badCount', c.bad) : '')));
      card.appendChild(sec);
      tests.forEach(function (r) { card.appendChild(testRow(tp, r.x, r.i)); });
    }
    if (S.filter === 'all' || S.filter === 'undecided') {
      sec = el('div', 'sec', '2 · ' + t('cp.decisions'));
      sec.appendChild(el('span', 'secCnt', t('cp.decCount', c.decided, c.decisions)));
      card.appendChild(sec);
      decs.forEach(function (r) { card.appendChild(decRow(tp, r.d, r.i)); });
    }
    if (S.filter === 'all' && (tp.infos || []).length) {
      card.appendChild(el('div', 'sec', '3 · ' + t('cp.infos')));
      (tp.infos || []).forEach(function (s) { card.appendChild(rich(el('p', 'info'), s)); });
    }
    return card;
  }

  function testRow(tp, x, i) {
    var key = 'r|' + tp.id + '|' + x.id;
    var res = resultOf(tp, x);
    var o = optim[key];
    var row = el('div', 'row ' + res.state + (o && !o.done ? ' saving' : ''));
    var cb = el('input');
    cb.type = 'checkbox';
    cb.checked = res.state === 'ok';
    cb.setAttribute('data-k', 'ok|' + tp.id + '|' + x.id);
    cb.setAttribute('aria-label', t('cp.done') + ': T' + (i + 1) + ' ' + x.t);
    cb.addEventListener('change', function () {
      write('result', { topic: tp.id, test: x.id, state: cb.checked ? 'ok' : 'none' }, key, { state: cb.checked ? 'ok' : 'none', note: res.note });
    });
    row.appendChild(cb);
    var body = el('div', 'rowBody');
    var head = el('div', 'rowHead');
    head.appendChild(el('span', 'code', 'T' + (i + 1)));
    head.appendChild(el('span', 'rowTitle', x.t));
    if (x.agent) head.appendChild(el('span', 'pill ok', t('cp.agent')));
    body.appendChild(head);
    if (x.d) body.appendChild(el('p', 'd', x.d));
    if (x.e) body.appendChild(el('p', 'e', t('cp.expected') + x.e));
    var acts = el('div', 'rowActs');
    if (x.url) acts.appendChild(btn('link', t('cp.open'), 'url|' + tp.id + '|' + x.id, function () { vscode.postMessage({ type: 'openUrl', url: x.url }); }));
    var bb = btn('btn' + (res.state === 'bad' ? ' on' : ''), res.state === 'bad' ? t('cp.badOn') : t('cp.bad'), 'bad|' + tp.id + '|' + x.id, function () {
      var on = res.state !== 'bad';
      write('result', { topic: tp.id, test: x.id, state: on ? 'bad' : 'none' }, key, { state: on ? 'bad' : 'none', note: res.note });
      if (on) setTimeout(function () { var n = app.querySelector('[data-k="note|' + tp.id + '|' + x.id + '"]'); if (n) n.focus(); }, 0);
    });
    bb.setAttribute('aria-pressed', String(res.state === 'bad'));
    acts.appendChild(bb);
    if (res.by && res.state !== 'none') acts.appendChild(el('span', 'by', (res.state === 'ok' ? '✓ ' : '✕ ') + t('cp.by', res.by, time(res.at))));
    body.appendChild(acts);
    if (res.state === 'bad') {
      var ta = el('textarea', 'note');
      ta.value = res.note || '';
      ta.placeholder = t('cp.notePh');
      ta.maxLength = 4000;
      ta.setAttribute('data-k', 'note|' + tp.id + '|' + x.id);
      ta.setAttribute('aria-label', t('cp.notePh') + ' T' + (i + 1));
      var flush = function () {
        var p = noteTimers[key];
        if (p) clearTimeout(p.timer);
        delete noteTimers[key];
        var value = p ? p.value : ta.value;
        var cur = findTest(tp.id, x.id);
        if (!cur) return;
        var r = resultOf(cur.tp, cur.x);
        if (r.state !== 'bad' || value === (r.note || '')) return;
        var go = function () { write('result', { topic: tp.id, test: x.id, state: 'bad', note: value }, key, { state: 'bad', note: value, by: r.by, at: r.at }); };
        if (rendering) setTimeout(go, 0); else go();
      };
      ta.addEventListener('input', function () {
        var p = noteTimers[key];
        if (p) clearTimeout(p.timer);
        noteTimers[key] = { value: ta.value, timer: setTimeout(flush, 700) };
      });
      ta.addEventListener('blur', function () { if (!rendering) flush(); });
      body.appendChild(ta);
    }
    row.appendChild(body);
    return row;
  }

  function decRow(tp, d, i) {
    var box = el('div', 'dec');
    box.setAttribute('role', 'radiogroup');
    box.setAttribute('aria-label', 'K' + (i + 1) + ' ' + d.t);
    var head = el('div', 'rowHead');
    head.appendChild(el('span', 'code', 'K' + (i + 1)));
    head.appendChild(el('span', 'rowTitle', d.t));
    box.appendChild(head);
    var cur = pickOf(tp, d);
    (d.o || []).forEach(function (opt, j) {
      var lab = el('label', 'opt');
      var rb = el('input');
      rb.type = 'radio';
      rb.name = 'cp-' + tp.id + '-' + d.id;
      rb.checked = cur === j;
      rb.setAttribute('data-k', 'pick|' + tp.id + '|' + d.id + '|' + j);
      rb.addEventListener('change', function () { if (rb.checked) write('pick', { topic: tp.id, decision: d.id, index: j }, 'p|' + tp.id + '|' + d.id, j); });
      lab.appendChild(rb);
      lab.appendChild(el('span', null, opt));
      box.appendChild(lab);
    });
    if (d.pick && d.pick.by && cur === d.pick.index) box.appendChild(el('div', 'by', '✓ ' + t('cp.by', d.pick.by, time(d.pick.at))));
    return box;
  }

  // ---------- mesajlar ----------
  window.addEventListener('message', function (e) {
    var m = e.data;
    if (!m || typeof m !== 'object') return;
    switch (m.type) {
      case 'init':
        if (m.lang) I18N.setLang(m.lang);
        if (m.who) S.who = m.who;
        render();
        break;
      case 'who':
        S.who = m.who || null;
        render();
        break;
      case 'lang':
        if (m.value && I18N.setLang(m.value)) render();
        break;
      case 'checks':
        S.topics = Array.isArray(m.topics) ? m.topics : [];
        S.errors = Array.isArray(m.errors) ? m.errors : [];
        S.pending = m.pending || 0;
        S.bad = m.bad || 0;
        Object.keys(optim).forEach(function (k) { if (optim[k].done) delete optim[k]; });
        render();
        break;
      case 'checksRes':
        done(m.reqId, !!m.ok, m.error);
        break;
    }
  });
  I18N.onChange(function () { document.documentElement.lang = I18N.lang; render(); });

  render();
  vscode.postMessage({ type: 'ready' });
})();
