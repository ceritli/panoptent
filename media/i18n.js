/* Panoptent i18n core — shared by the VS Code panel, the page overlay and the Chrome extension.
 *
 * Each UI file registers its own strings:
 *   PanoptentI18n.add({ en: { 'pop.queue': 'Add to queue' }, tr: { 'pop.queue': 'Kuyruğa ekle' } });
 * and looks them up with:
 *   t('pop.queue')            → "Add to queue"
 *   t('img.size', name, kb)   → replaces {0}, {1}, … in the string
 * English is the fallback for any missing key. To add a language, add a new
 * block (e.g. `de: {...}`) next to `en`/`tr` in each file and list it in LANGS.
 *
 * Static markup can use attributes and be refreshed with localize(root):
 *   data-i18n="key"        → textContent
 *   data-i18n-title="key"  → title
 *   data-i18n-ph="key"     → placeholder
 *   data-i18n-html="key"   → innerHTML (trusted strings only)
 */
(function (root) {
  if (root.PanoptentI18n) return;
  var LANGS = [
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Türkçe' },
  ];
  var dict = { en: {} };
  var lang = 'en';
  var listeners = [];

  function norm(l) {
    l = String(l || '').toLowerCase().split(/[-_]/)[0];
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === l) return l;
    return 'en';
  }
  function detect() {
    try {
      var a = root.document && root.document.documentElement && root.document.documentElement.getAttribute('data-panoptent-lang');
      if (a) return norm(a);
    } catch (e) { /* ignore */ }
    try { return norm(root.navigator && (root.navigator.language || (root.navigator.languages || [])[0])); } catch (e) { return 'en'; }
  }

  function add(table) {
    for (var l in table) {
      if (!dict[l]) dict[l] = {};
      for (var k in table[l]) dict[l][k] = table[l][k];
    }
  }
  function t(key) {
    var s = (dict[lang] && dict[lang][key]);
    if (s == null) s = dict.en[key];
    if (s == null) return key;
    var args = arguments;
    return String(s).replace(/\{(\d+)\}/g, function (m, i) {
      var v = args[+i + 1];
      return v == null ? '' : String(v);
    });
  }
  function localize(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;
    var set = function (attr, fn) {
      var els = rootEl.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < els.length; i++) fn(els[i], els[i].getAttribute(attr));
    };
    set('data-i18n', function (el, k) { el.textContent = t(k); });
    set('data-i18n-html', function (el, k) { el.innerHTML = t(k); });
    set('data-i18n-title', function (el, k) { el.title = t(k); });
    set('data-i18n-ph', function (el, k) { el.placeholder = t(k); });
    set('data-i18n-aria', function (el, k) { el.setAttribute('aria-label', t(k)); });
  }
  function setLang(l) {
    var n = norm(l);
    if (n === lang) return false;
    lang = n;
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](lang); } catch (e) { /* ignore */ } }
    return true;
  }
  function onChange(fn) { listeners.push(fn); }

  lang = detect();
  var api = {
    LANGS: LANGS,
    add: add,
    t: t,
    localize: localize,
    setLang: setLang,
    onChange: onChange,
    norm: norm,
    get lang() { return lang; },
  };
  root.PanoptentI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
