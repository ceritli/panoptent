// Sayfadaki Test ve Karar panelinin yeri ve ölçüsü (media/checks.js): sınırlar, büyüt / eski ölçü, bozuk saklanan değer.
import { test } from 'node:test';
import assert from 'node:assert/strict';

type G = { x: number; y: number; w: number; h: number | null; min: boolean; max: boolean; prev: any };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CK = require('../media/checks.js') as {
  GEO: { minW: number; minH: number; margin: number; keep: number; head: number; defW: number; gap: number };
  clampGeom(g: unknown, vw: number, vh: number): G;
  moveGeom(g: unknown, dx: number, dy: number, vw: number, vh: number): G;
  resizeGeom(g: unknown, edge: string, dx: number, dy: number, vw: number, vh: number, curH?: number): G;
  maximizeGeom(g: unknown, vw: number, vh: number): G;
  restoreGeom(g: unknown, vw: number, vh: number): G;
  packGeom(g: unknown): any;
};
const { GEO } = CK;
const VW = 1280, VH = 800;

/** Başlığın tutulabilir kısmı (soldaki başlık yazısı) ekranda mı? Sol kenardan taşmaz, sağda en az `keep` px görünür. */
function grabbable(g: G, vw = VW, vh = VH) {
  const visibleW = Math.min(g.x + g.w, vw) - Math.max(g.x, 0);
  return g.x >= 0 && g.y >= 0 && g.y + GEO.head <= vh && visibleW >= Math.min(GEO.keep, g.w, vw);
}

test('varsayılan: sağ üstte, 400 px genişlik, yükseklik içeriğe göre', () => {
  const g = CK.clampGeom({}, VW, VH);
  assert.deepEqual(g, { x: VW - 400 - GEO.gap, y: GEO.gap, w: 400, h: null, min: false, max: false, prev: null });
  const narrow = CK.clampGeom({}, 320, 600);
  assert.ok(narrow.w <= 320 - 2 * GEO.margin && narrow.x >= 0, JSON.stringify(narrow));
});

test('taşıma: görünüm alanından çıkamaz, başlığın tutulabilir kısmı ekranda kalır', () => {
  const start = CK.clampGeom({}, VW, VH);
  for (const [dx, dy] of [[5000, 0], [-5000, 0], [0, 5000], [0, -5000], [5000, 5000], [-5000, -5000]]) {
    const g = CK.moveGeom(start, dx, dy, VW, VH);
    assert.ok(grabbable(g), `${dx},${dy} → ${JSON.stringify(g)}`);
    assert.equal(g.w, start.w, 'taşıma ölçüyü değiştirmez');
  }
  assert.deepEqual(CK.moveGeom(start, -100, 50, VW, VH).x, start.x - 100);
  // pencere küçülünce yeniden sınırlanır
  const far = CK.clampGeom({ x: 1200, y: 760, w: 400, h: 300 }, VW, VH);
  const small = CK.clampGeom(far, 600, 400);
  assert.ok(grabbable(small, 600, 400), JSON.stringify(small));
});

test('boyutlandırma: en küçük / en büyük ölçü, sol kenarda sağ kenar sabit', () => {
  const g = CK.clampGeom({ x: 400, y: 100, w: 400, h: 300 }, VW, VH);
  const tiny = CK.resizeGeom(g, 'se', -5000, -5000, VW, VH);
  assert.equal(tiny.w, GEO.minW);
  assert.equal(tiny.h, GEO.minH);
  const huge = CK.resizeGeom(g, 'se', 5000, 5000, VW, VH);
  assert.ok(huge.x + huge.w <= VW && huge.w <= VW - 2 * GEO.margin, JSON.stringify(huge));
  assert.ok(huge.y + (huge.h as number) <= VH && (huge.h as number) <= VH - 2 * GEO.margin, JSON.stringify(huge));
  const left = CK.resizeGeom(g, 'w', -100, 0, VW, VH);
  assert.equal(left.x + left.w, g.x + g.w, 'sağ kenar yerinde kalır');
  assert.equal(left.w, 500);
  const leftMin = CK.resizeGeom(g, 'sw', 5000, 0, VW, VH);
  assert.equal(leftMin.w, GEO.minW);
  assert.equal(leftMin.x + leftMin.w, g.x + g.w);
  // yükseklik içeriğe göreyken (null) gerçek yükseklikten başlar
  const auto = CK.clampGeom({ x: 10, y: 10, w: 400, h: null }, VW, VH);
  assert.equal(CK.resizeGeom(auto, 's', 0, 40, VW, VH, 420).h, 460);
});

test('büyüt / eski ölçü: görünüm alanını kaplar, eski yer ve ölçüye döner', () => {
  const g = CK.clampGeom({ x: 300, y: 120, w: 450, h: 380 }, VW, VH);
  const m = CK.maximizeGeom(g, VW, VH);
  assert.deepEqual([m.x, m.y, m.w, m.h, m.max], [GEO.margin, GEO.margin, VW - 2 * GEO.margin, VH - 2 * GEO.margin, true]);
  assert.equal(CK.moveGeom(m, 50, 50, VW, VH).x, GEO.margin, 'büyükken taşınmaz');
  const r = CK.restoreGeom(m, VW, VH);
  assert.deepEqual([r.x, r.y, r.w, r.h, r.max], [300, 120, 450, 380, false]);
  // saklanıp geri okununca da aynı (sayfa yenileme)
  const back = CK.restoreGeom(CK.clampGeom(JSON.parse(JSON.stringify(CK.packGeom(m))), VW, VH), VW, VH);
  assert.deepEqual([back.x, back.y, back.w, back.h], [300, 120, 450, 380]);
});

test('küçültme durumu korunur, ölçüyü bozmaz', () => {
  const g = CK.clampGeom({ x: 100, y: 100, w: 420, h: 360, min: true }, VW, VH);
  assert.equal(g.min, true);
  const open = CK.clampGeom({ ...g, min: false }, VW, VH);
  assert.deepEqual([open.x, open.y, open.w, open.h], [100, 100, 420, 360]);
});

test('bozuk saklanan değer: türler, sonsuzluk, devasa sayılar, nesne olmayan değer', () => {
  const bads: unknown[] = [
    null, 'x', 42, [], { x: 'a', y: {}, w: NaN, h: Infinity }, { x: 1e12, y: -1e12, w: -5, h: 1e9 },
    { max: 'true', min: 1, prev: 'p' }, { max: true, prev: { x: 'q', w: 1e15 } }, { __proto__: { x: 5 } },
  ];
  for (const b of bads) {
    const packed = CK.packGeom(b);
    for (const k of ['x', 'y', 'w', 'h']) assert.ok(packed[k] === null || (Number.isFinite(packed[k]) && Math.abs(packed[k]) <= 100000), `${k}: ${packed[k]}`);
    assert.equal(typeof packed.min, 'boolean');
    assert.equal(typeof packed.max, 'boolean');
    const g = CK.clampGeom(packed, VW, VH);
    assert.ok(grabbable(g), `${JSON.stringify(b)} → ${JSON.stringify(g)}`);
    assert.ok(g.w >= Math.min(GEO.minW, VW) && g.w <= VW - 2 * GEO.margin);
    assert.ok(g.h === null || (g.h >= GEO.minH && g.h <= VH - 2 * GEO.margin));
  }
  assert.equal(CK.packGeom({ max: 'true' }).max, false, 'yalnız gerçek boolean');
  assert.deepEqual(Object.keys(CK.packGeom({ x: 1, evil: '<img>' })).sort(), ['h', 'max', 'min', 'prev', 'w', 'x', 'y']);
});

test('çok küçük görünüm alanı: sınırlar tutarlı kalır', () => {
  for (const [vw, vh] of [[200, 120], [1, 1], [0, 0]]) {
    const g = CK.clampGeom({ x: 50, y: 50, w: 400, h: 400 }, vw, vh);
    assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y) && g.w > 0, JSON.stringify(g));
    assert.ok(g.y >= 0 && g.x <= Math.max(vw, 1));
  }
});
