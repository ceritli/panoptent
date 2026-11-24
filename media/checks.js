/* Panoptent Test ve Karar — sayfa katmanının (overlay.js) kullandığı saf yardımcılar.
 * DOM'a dokunmaz; Node testleri de aynı dosyayı yükler (module.exports).
 *
 *  matchUrl(stepUrl, pageHref)   → adım bu sayfaya mı ait? (yol eşleşir; adımdaki sorgu parametreleri sayfada
 *                                   da aynı değerle olmalı; "#/..." hash yönlendirmesi yol sayılır, "#12" gibi
 *                                   çapalar yok sayılır; köken (proxy / localhost) yok sayılır)
 *  openUrl(stepUrl, pageHref, rebase) → "Aç" düğmesinin gideceği adres; yalnızca http(s) ve uygulama yolu.
 *                                   rebase: VS Code önizlemesinde (proxy) mutlak adres bu sayfanın kökenine taşınır.
 *  segments(text)                → [{ b: true|false, s: '…' }]: yalnızca **kalın** biçimi; geri kalan düz metin.
 */
(function (root) {
  'use strict';
  if (root.PanoptentChecks) return;

  var BASE = 'http://panoptent.invalid/';

  function parse(u, base) {
    try { return new URL(String(u), base || BASE); } catch (e) { return null; }
  }

  function normPath(p) {
    p = String(p || '/');
    try { p = decodeURI(p); } catch (e) { /* olduğu gibi */ }
    p = p.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return p || '/';
  }

  /** Sayfanın "rotası": yol + sorgu. Hash yönlendirmeli uygulamalarda (#/x, #!/x) rota hash içindedir. */
  function route(u) {
    var h = u.hash || '';
    if (/^#!?\//.test(h)) {
      var hu = parse(h.replace(/^#!?/, ''), BASE);
      if (hu) return { path: normPath(hu.pathname), query: hu.searchParams, hash: true };
    }
    return { path: normPath(u.pathname), query: u.searchParams, hash: false };
  }

  function matchUrl(stepUrl, pageHref) {
    if (!stepUrl || !pageHref) return false;
    var page = parse(pageHref);
    var step = parse(stepUrl, page ? page.href : BASE);
    if (!page || !step) return false;
    if (!/^https?:$/.test(step.protocol)) return false;
    var a = route(step);
    // adım hash yönlendirmesi kullanıyorsa sayfanın hash rotasıyla, kullanmıyorsa gerçek yolla karşılaştır
    var b = a.hash ? route(page) : { path: normPath(page.pathname), query: page.searchParams, hash: false };
    if (a.hash && !b.hash) return false;
    if (a.path !== b.path) return false;
    var ok = true;
    a.query.forEach(function (v, k) { if (b.query.getAll(k).indexOf(v) === -1) ok = false; });
    return ok;
  }

  function openUrl(stepUrl, pageHref, rebase) {
    if (!stepUrl) return null;
    var page = parse(pageHref);
    if (!page) return null;
    var u = parse(stepUrl, page.href);
    if (!u || !/^https?:$/.test(u.protocol)) return null;
    if (rebase && page && u.origin !== page.origin) return page.origin + u.pathname + u.search + u.hash;
    return u.href;
  }

  function segments(text) {
    var s = String(text == null ? '' : text);
    var out = [];
    var re = /\*\*([^*\n][^\n]*?)\*\*/g;
    var last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ b: false, s: s.slice(last, m.index) });
      out.push({ b: true, s: m[1] });
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ b: false, s: s.slice(last) });
    return out;
  }

  // ---------- Panelin yeri ve ölçüsü ----------
  // g = { x, y, w, h, min, max, prev }: x/y sol üst köşe (px), h null = içeriğe göre (en fazla görünüm alanının altına
  // kadar), min = yalnız başlık şeridi, max = görünüm alanını kaplar (prev: büyütmeden önceki ölçü). Saklanan değer
  // sayfa betiklerince bozulmuş olabilir: her okumada doğrulanır ve görünüm alanına göre sınırlanır.
  var GEO = { minW: 300, minH: 160, margin: 8, keep: 96, head: 38, defW: 400, gap: 12, step: 16 };

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  function clamp(v, lo, hi) { return hi < lo ? lo : Math.min(hi, Math.max(lo, v)); }

  function clampGeom(g, vw, vh) {
    g = g && typeof g === 'object' ? g : {};
    vw = Math.max(1, num(vw) || 1);
    vh = Math.max(1, num(vh) || 1);
    var M = GEO.margin;
    var maxW = Math.max(120, vw - 2 * M), maxH = Math.max(GEO.head, vh - 2 * M);
    var minW = Math.min(GEO.minW, maxW), minH = Math.min(GEO.minH, maxH);
    if (g.max === true) {
      var prev = g.prev && typeof g.prev === 'object' ? clampGeom({ x: g.prev.x, y: g.prev.y, w: g.prev.w, h: g.prev.h }, vw, vh) : null;
      if (prev) { delete prev.min; delete prev.max; }
      return { x: M, y: M, w: maxW, h: maxH, min: g.min === true, max: true, prev: prev };
    }
    var w = num(g.w);
    w = w == null ? Math.min(GEO.defW, maxW) : clamp(Math.round(w), minW, maxW);
    var h = num(g.h);
    h = h == null ? null : clamp(Math.round(h), minH, maxH);
    var x = num(g.x);
    if (x == null) x = vw - w - GEO.gap;
    // başlığın tutulabilir kısmı (soldaki başlık yazısı; sağda düğmeler var) ekranda kalır: sol kenardan taşmaz,
    // sağa en fazla `keep` pikseli görünecek kadar gider; dikeyde başlığın tamamı görünür
    x = clamp(Math.round(x), 0, Math.max(0, vw - Math.min(GEO.keep, w)));
    var y = num(g.y);
    if (y == null) y = GEO.gap;
    y = clamp(Math.round(y), 0, Math.max(0, vh - GEO.head));
    return { x: x, y: y, w: w, h: h, min: g.min === true, max: false, prev: null };
  }

  function moveGeom(g, dx, dy, vw, vh) {
    var c = clampGeom(g, vw, vh);
    if (c.max) return c;
    return clampGeom({ x: c.x + (num(dx) || 0), y: c.y + (num(dy) || 0), w: c.w, h: c.h, min: c.min }, vw, vh);
  }

  /** edge: 'e' | 'w' | 's' | 'se' | 'sw'. curH: şu anki gerçek yükseklik (h null iken). Sol kenarda sağ kenar sabit kalır. */
  function resizeGeom(g, edge, dx, dy, vw, vh, curH) {
    var c = clampGeom(g, vw, vh);
    if (c.max) c = clampGeom(c.prev || {}, vw, vh);
    dx = num(dx) || 0;
    dy = num(dy) || 0;
    var M = GEO.margin;
    var maxW = Math.max(120, vw - 2 * M), maxH = Math.max(GEO.head, vh - 2 * M);
    var minW = Math.min(GEO.minW, maxW), minH = Math.min(GEO.minH, maxH);
    var n = { x: c.x, y: c.y, w: c.w, h: c.h == null ? (num(curH) || minH) : c.h, min: false };
    edge = String(edge || '');
    if (edge.indexOf('e') >= 0) n.w = clamp(c.w + dx, minW, Math.min(maxW, vw - c.x));
    if (edge.indexOf('w') >= 0) {
      var right = c.x + c.w;
      n.w = clamp(c.w - dx, minW, Math.min(maxW, right));
      n.x = right - n.w;
    }
    if (edge.indexOf('s') >= 0) n.h = clamp(n.h + dy, minH, Math.min(maxH, vh - c.y));
    return clampGeom(n, vw, vh);
  }

  function maximizeGeom(g, vw, vh) {
    var c = clampGeom(g, vw, vh);
    if (c.max) return c;
    return clampGeom({ max: true, prev: { x: c.x, y: c.y, w: c.w, h: c.h } }, vw, vh);
  }

  function restoreGeom(g, vw, vh) {
    var c = clampGeom(g, vw, vh);
    if (!c.max) return c;
    return clampGeom(c.prev || {}, vw, vh);
  }

  /**
   * Saklanacak / saklanmıştan okunan hal: yalnız bilinen alanlar, yalnız sonlu sayılar (±100000 içinde), boolean'lar.
   * Görünüm alanına göre sınırlama gösterirken yapılır (clampGeom); böylece pencere küçülüp büyüyünce ölçü kaybolmaz.
   */
  function packGeom(g) {
    var c = g && typeof g === 'object' ? g : {};
    var n = function (v) { v = num(v); return v == null || Math.abs(v) > 100000 ? null : Math.round(v); };
    var p = c.prev && typeof c.prev === 'object' ? { x: n(c.prev.x), y: n(c.prev.y), w: n(c.prev.w), h: n(c.prev.h) } : null;
    return { x: n(c.x), y: n(c.y), w: n(c.w), h: n(c.h), min: c.min === true, max: c.max === true, prev: p };
  }

  var api = {
    matchUrl: matchUrl, openUrl: openUrl, segments: segments, normPath: normPath,
    GEO: GEO, clampGeom: clampGeom, moveGeom: moveGeom, resizeGeom: resizeGeom, maximizeGeom: maximizeGeom, restoreGeom: restoreGeom, packGeom: packGeom,
  };
  root.PanoptentChecks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
