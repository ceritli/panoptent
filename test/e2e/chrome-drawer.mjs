// Chrome çubuğunun çekmecesi (Kuyruk / Etkinlik / Ayarlar) ve Test ve Karar paneli — başsız Chromium.
// chrome/content.js'in gerçek kodu bir test sayfasında çalışır; `chrome.*` API'leri taklit edilir (köprüye, VS Code'a
// ya da gerçek bir Panoptent servisine bağlanılmaz). Arka planın yaptığı gibi i18n.js + checks.js + overlay.js
// sayfaya eklenir.
//   node test/e2e/chrome-drawer.mjs --playwright <playwright yolu> [--out <klasör>]
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(process.argv.includes('--root') ? process.argv[process.argv.indexOf('--root') + 1] : path.join(here, '..', '..'));
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const out = path.resolve(arg('--out', fs.mkdtempSync(path.join(os.tmpdir(), 'pt-chrome-'))));
fs.mkdirSync(out, { recursive: true });
let playwright;
try {
  playwright = createRequire(import.meta.url)(arg('--playwright', 'playwright'));
} catch (err) {
  console.log('SKIP: Playwright bulunamadı (--playwright <yol> verin): ' + err.message);
  process.exit(0);
}

// Arka planın (background.js) yerine geçen sahte chrome.* API'leri. Testler __bg(m) ile "VS Code'dan gelen" mesaj
// gönderir, __sent içinde içerik betiğinin gönderdiklerini görür.
const FAKE_CHROME = `
(function () {
  // eklenti deposu yeniden yüklemede kalsın diye test sayfasının sessionStorage'ında tutulur
  var store = null;
  try { store = JSON.parse(sessionStorage.getItem('__ptStore') || 'null'); } catch (e) { store = null; }
  if (!store) { store = {}; store['on:' + location.origin] = true; }
  var keep = function () { sessionStorage.setItem('__ptStore', JSON.stringify(store)); };
  window.__store = store;
  var listeners = [];
  window.__sent = [];
  function inject(files) {
    files.forEach(function (f) { var s = document.createElement('script'); s.src = '/media/' + f; s.async = false; document.documentElement.appendChild(s); });
  }
  var port = {
    onMessage: { addListener: function (f) { listeners.push(f); } },
    onDisconnect: { addListener: function () {} },
    postMessage: function (m) {
      window.__sent.push(m);
      if (m.type === 'injectOverlay') inject(['i18n.js', 'checks.js', 'overlay.js']);
      if (m.type === 'getState') setTimeout(function () {
        window.__bg({ type: 'status', workspaces: [{ port: 47999, name: 'Demo', root: '/tmp/demo', state: 'ready' }], active: 47999 });
        window.__bg({ type: 'welcome', sendTo: 'claudePanel', openOnSelect: false, claudeExt: true, canRollback: false, lang: 'tr' });
      }, 0);
    },
  };
  window.__bg = function (m) { listeners.forEach(function (f) { f(m); }); };
  window.chrome = {
    runtime: { connect: function () { return port; }, sendMessage: function () { return Promise.resolve(); } },
    storage: { local: {
      get: function (keys, cb) { var o = {}; [].concat(keys).forEach(function (k) { if (k in store) o[k] = store[k]; }); cb(o); },
      set: function (o, cb) { Object.assign(store, o); keep(); cb && cb(); },
      remove: function (k) { [].concat(k).forEach(function (x) { delete store[x]; }); keep(); },
    } },
  };
})();`;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Demo</title>
<style>body{font:15px system-ui;margin:0;padding:24px;background:#f7f5ee}</style></head>
<body><h1 id="title">Demo</h1><p>Panoptent Chrome çubuğu testi.</p>
<script>${FAKE_CHROME}</script><script src="/media/i18n.js"></script><script src="/chrome/content.js"></script></body></html>`;

const srv = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/' || p === '/admin/orders') return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE);
  const m = /^\/(media|chrome)\/([a-z0-9.]+\.js)$/.exec(p);
  const f = m && path.join(repo, m[1], m[2]);
  if (!f || !fs.existsSync(f)) return void res.writeHead(404).end();
  res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }).end(fs.readFileSync(f));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await playwright.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const steps = [];
const step = (s) => { steps.push(s); console.log('✓ ' + s); };
async function until(fn, what, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn().catch(() => false)) return;
    await page.waitForTimeout(50);
  }
  throw new Error('zaman aşımı: ' + what);
}

await page.goto(base + '/admin/orders');
const ui = page.locator('panoptent-ui');
const drawer = ui.locator('#drawer');
const open = () => drawer.isVisible();
await ui.locator('#bar').waitFor({ state: 'visible' });
await until(() => page.evaluate(() => !!document.querySelector('panoptent-overlay')), 'seçim katmanı yüklendi');
await page.waitForTimeout(400);

// 1) ✕ çekmeceyi kapatır
await ui.locator('#logo').click();
await until(open, 'çekmece açıldı');
await ui.locator('#dclose').click();
await page.waitForTimeout(150);
assert.equal(await open(), false, 'BUG: ✕ çekmeceyi kapatmadı');
step('✕ (dclose) çekmeceyi kapattı');

// 2) yeniden açılır; sekmeler çalışır; ✕ hangi sekmede olursa olsun kapatır
for (const tab of ['queue', 'log', 'settings']) {
  await ui.locator('#logo').click();
  await until(open, 'çekmece yeniden açıldı');
  await ui.locator(`.tabs button[data-tab="${tab}"]`).click();
  assert.equal(await ui.locator(`.tabs button[data-tab="${tab}"]`).getAttribute('class'), 'on');
  assert.ok(await open(), 'sekme değişince çekmece açık kalmalı');
  await ui.locator('#dclose').click();
  await page.waitForTimeout(100);
  assert.equal(await open(), false, `✕ ${tab} sekmesinde kapatmadı`);
}
step('Çekmece yeniden açılıyor; Kuyruk / Etkinlik / Ayarlar sekmelerinin her birinde ✕ kapatıyor');

// 3) ⚙ Ayarlar'ı aç / kapa; logo aç / kapa
await ui.locator('#gear').click();
await until(open, '⚙ açtı');
assert.equal(await ui.locator('.tabs button[data-tab="settings"]').getAttribute('class'), 'on');
await ui.locator('#gear').click();
await page.waitForTimeout(100);
assert.equal(await open(), false, '⚙ ikinci tıkta kapatmalı');
await ui.locator('#logo').click();
await until(open, 'logo açtı');
await ui.locator('#logo').click();
await page.waitForTimeout(100);
assert.equal(await open(), false, 'logo ikinci tıkta kapatmalı');
step('⚙ ve logo çekmeceyi açıp kapatıyor');

// 4) Esc çekmeceyi kapatır (sayfadayken)
await ui.locator('#logo').click();
await until(open, 'açıldı');
await page.locator('#title').click();
await page.keyboard.press('Escape');
await page.waitForTimeout(100);
assert.equal(await open(), false, 'Esc çekmeceyi kapatmalı');
step('Esc çekmeceyi kapatıyor');

// 5) Test ve Karar paneli ile çekmece birbirini etkilemez
await page.evaluate(() => window.__bg({
  type: 'checks', pending: 2, bad: 0, errors: [],
  topics: [{ id: 'demo', name: 'Demo konu', date: '', lead: '', counts: { ok: 0, tests: 1, bad: 0, decisions: 1, decided: 0, pending: 2 },
    tests: [{ id: 't1', t: 'Adım', url: '/admin/orders', result: { state: 'none' } }],
    decisions: [{ id: 'k1', t: 'Soru', o: ['Bugünkü durum', 'Diğer'], pick: null }], infos: [] }],
}));
const ckBtn = ui.locator('#ckBtn');
await ckBtn.waitFor({ state: 'visible' });
assert.equal(await ui.locator('#ckN').textContent(), '2');
const ck = page.locator('panoptent-overlay .ck');
const ckOpen = () => ck.isVisible();
await ckBtn.click();
await until(ckOpen, 'Test paneli açıldı');
await ui.locator('#logo').click();
await until(open, 'çekmece de açık');
await page.screenshot({ path: path.join(out, 'chrome-cekmece-ve-test-paneli.png') });
await ui.locator('#dclose').click();
await page.waitForTimeout(150);
assert.equal(await open(), false, 'çekmecenin ✕ düğmesi çekmeceyi kapatmalı');
assert.equal(await ckOpen(), true, 'çekmecenin ✕ düğmesi Test panelini kapatmamalı');
await ui.locator('#logo').click();
await until(open, 'çekmece yeniden açık');
await page.locator('panoptent-overlay #ckX').click();
await page.waitForTimeout(150);
assert.equal(await ckOpen(), false, 'Test panelinin × düğmesi paneli kapatmalı');
assert.equal(await open(), true, 'Test panelinin × düğmesi çekmeceyi kapatmamalı');
step('Çekmecenin ✕ düğmesi Test panelini, Test panelinin × düğmesi çekmeceyi etkilemiyor');

// 6) Test panelinde Esc yalnız Test panelini kapatır; çekmece açık kalır
await ckBtn.click();
await until(ckOpen, 'Test paneli yeniden açık');
// odak hem bir onay kutusunda hem bir düğmede ("Sorun") denenir
for (const sel of ['.ck input[type=checkbox]', '.ck .ckBtn']) {
  if (!(await ckOpen())) {
    await ckBtn.click();
    await until(ckOpen, 'Test paneli açık');
  }
  await page.locator('panoptent-overlay ' + sel).first().focus();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  assert.equal(await ckOpen(), false, `Esc Test panelini kapatmalı (${sel})`);
  assert.equal(await open(), true, `Test panelindeki Esc çekmeceyi kapatmamalı (${sel})`);
}
await ui.locator('#dclose').click();
await page.waitForTimeout(100);
assert.equal(await open(), false);
step('Test panelindeki Esc yalnız Test panelini kapatıyor; çekmece ✕ ile kapanıyor');
await page.screenshot({ path: path.join(out, 'chrome-kapali.png') });

// ---------- 7) Panelin yeri ve ölçüsü ----------
const CHECKS = {
  type: 'checks', pending: 2, bad: 0, errors: [],
  topics: [{ id: 'demo', name: 'Demo konu', date: '', lead: '', counts: { ok: 0, tests: 1, bad: 0, decisions: 1, decided: 0, pending: 2 },
    tests: [{ id: 't1', t: 'Adım', url: '/admin/orders', result: { state: 'none' } }],
    decisions: [{ id: 'k1', t: 'Soru', o: ['Bugünkü durum', 'Diğer'], pick: null }], infos: [] }],
};
const head = page.locator('panoptent-overlay #ckHead');
const box = async () => {
  const b = await ck.boundingBox();
  return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
};
const vp = () => page.viewportSize();
const grabbable = async () => {
  const b = await box(), v = vp();
  const vis = Math.min(b.x + b.w, v.width) - Math.max(b.x, 0);
  return b.y >= 0 && b.y + 38 <= v.height && vis >= Math.min(96, b.w);
};
async function drag(loc, dx, dy, opts = {}) {
  const b = await loc.boundingBox();
  const sx = b.x + (opts.ox ?? b.width / 2), sy = b.y + (opts.oy ?? b.height / 2);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + dx / 2, sy + dy / 2, { steps: 4 });
  await page.mouse.move(sx + dx, sy + dy, { steps: 4 });
  await page.mouse.up();
}
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;
await ckBtn.click();
await until(ckOpen, 'panel açık');
let b0 = await box();
assert.ok(near(b0.x + b0.w, vp().width - 12, 3) && near(b0.y, 12), 'varsayılan yer sağ üst: ' + JSON.stringify(b0));

// sayfanın kendi dinleyicileri sürüklemeyi görmez, metin seçilmez
await page.evaluate(() => {
  window.__pageMoves = 0;
  ['pointermove', 'mousemove', 'pointerup'].forEach((ev) => document.addEventListener(ev, () => window.__pageMoves++));
});
await drag(head, -300, 150, { ox: 60 });
let b1 = await box();
assert.ok(near(b1.x, b0.x - 300) && near(b1.y, b0.y + 150), 'sürükleme: ' + JSON.stringify([b0, b1]));
assert.equal(b1.w, b0.w, 'taşıma ölçüyü değiştirmez');
assert.equal(await page.evaluate(() => window.__pageMoves), 0, 'sayfa sürükleme olaylarını almamalı');
assert.equal(await page.evaluate(() => String(window.getSelection())), '', 'sürüklerken metin seçilmemeli');
await drag(head, -3000, 3000, { ox: 60 });
assert.ok(await grabbable(), 'sol alta fırlatınca başlık ekranda kalmalı: ' + JSON.stringify(await box()));
await drag(head, 4000, -4000, { ox: 60 });
assert.ok(await grabbable(), 'sağ üste fırlatınca başlık ekranda kalmalı: ' + JSON.stringify(await box()));
step('Başlıktan sürükleme taşıyor; görünüm alanının dışına çıkmıyor; sayfa olay almıyor, metin seçilmiyor');

// boyutlandırma: köşe ve sol kenar, sınırlar (önce paneli bilinen bir yere taşı)
async function moveTo(x, y) {
  const b = await box();
  await drag(head, x - b.x, y - b.y, { ox: 60 });
  const n = await box();
  assert.ok(near(n.x, x) && near(n.y, y), 'moveTo: ' + JSON.stringify(n));
}
await moveTo(300, 100);
b0 = await box();
const se = page.locator('panoptent-overlay .ckRz[data-edge=se]');
await drag(se, 150, 120);
b1 = await box();
assert.ok(near(b1.w, b0.w + 150, 3) && near(b1.h, b0.h + 120, 3), 'köşeden büyüt: ' + JSON.stringify([b0, b1]));
await drag(se, -3000, -3000);
b1 = await box();
assert.ok(near(b1.w, 300, 2) && near(b1.h, 160, 2), 'en küçük ölçü 300×160: ' + JSON.stringify(b1));
await drag(se, 5000, 5000);
b1 = await box();
assert.ok(b1.x + b1.w <= vp().width && b1.y + b1.h <= vp().height, 'en büyük ölçü görünüm alanı içinde: ' + JSON.stringify(b1));
const right = b1.x + b1.w;
await drag(page.locator('panoptent-overlay .ckRz[data-edge=w]'), 120, 0);
b1 = await box();
assert.ok(near(b1.x + b1.w, right, 3), 'sol kenarda sağ kenar sabit: ' + JSON.stringify(b1));
await drag(se, -200, -250);
step('Kenar / köşeden boyutlandırma; en küçük 300×160, en büyük görünüm alanı; sol kenarda sağ kenar sabit');

// büyüt / eski ölçü, küçült / aç
b0 = await box();
await page.locator('panoptent-overlay #ckMax').click();
b1 = await box();
assert.ok(near(b1.x, 8) && near(b1.y, 8) && near(b1.w, vp().width - 16, 3) && near(b1.h, vp().height - 16, 3), 'büyüt: ' + JSON.stringify(b1));
assert.equal(await page.locator('panoptent-overlay #ckMax').getAttribute('aria-label'), 'Eski ölçü');
await page.locator('panoptent-overlay #ckMax').click();
assert.deepEqual(await box(), b0, 'eski ölçüye dönmeli');
await page.locator('panoptent-overlay #ckMin').click();
b1 = await box();
assert.ok(b1.h <= 44, 'küçükken yalnız başlık şeridi: ' + JSON.stringify(b1));
assert.equal(await page.locator('panoptent-overlay .ckBody').isVisible(), false);
assert.match(await page.locator('panoptent-overlay #ckSum').textContent(), /1 konu · 2 bekliyor/);
assert.equal(await page.locator('panoptent-overlay #ckMin').getAttribute('aria-expanded'), 'false');
await page.screenshot({ path: path.join(out, 'chrome-panel-kucuk.png') });
await page.locator('panoptent-overlay #ckMin').click();
assert.deepEqual(await box(), b0, 'açınca eski yer ve ölçü');
assert.ok(await page.locator('panoptent-overlay .ckBody').isVisible());
await head.dblclick({ position: { x: 60, y: 15 } });
assert.ok(near((await box()).w, vp().width - 16, 3), 'çift tık büyütür');
await head.dblclick({ position: { x: 60, y: 15 } });
assert.deepEqual(await box(), b0);
step('Büyüt / eski ölçü ve küçült / aç: eski yer ve ölçüye dönüyor; küçükken başlıkta sayaç (1 konu · 2 bekliyor)');

// klavye: oklar taşır, Shift+oklar boyutlandırır
await head.focus();
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowDown');
b1 = await box();
assert.ok(near(b1.x, b0.x + 16) && near(b1.y, b0.y + 16), 'oklar 16 px taşır: ' + JSON.stringify([b0, b1]));
await page.keyboard.press('Shift+ArrowRight');
await page.keyboard.press('Shift+ArrowDown');
const b2 = await box();
assert.ok(near(b2.w, b1.w + 16) && near(b2.h, b1.h + 16), 'Shift+oklar 16 px büyütür: ' + JSON.stringify([b1, b2]));
assert.equal(await page.evaluate(() => document.querySelector('panoptent-overlay').shadowRoot.activeElement?.id), 'ckHead', 'odak başlıkta kalır');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
assert.equal(await ckOpen(), false, 'Esc başlıktayken de paneli kapatır');
await ckBtn.click();
await until(ckOpen, 'panel açık');
assert.deepEqual(await box(), b2, 'kapatıp açınca aynı yer ve ölçü');
step('Klavye: oklar taşıyor, Shift+oklar boyutlandırıyor; Esc kapatıyor; yeniden açınca aynı yer ve ölçü');
await page.screenshot({ path: path.join(out, 'chrome-panel-tasindi.png') });

// sayfa yenilenince hatırlanır (Chrome eklenti deposu)
await page.waitForTimeout(400); // kaydetme
await page.reload();
await until(() => page.evaluate(() => !!document.querySelector('panoptent-overlay')), 'katman yeniden yüklendi');
await page.waitForTimeout(400);
await page.evaluate((m) => window.__bg(m), CHECKS);
await until(ckOpen, 'yenilemeden sonra panel açık');
assert.deepEqual(await box(), b2, 'yenilemeden sonra aynı yer ve ölçü');
await page.locator('panoptent-overlay #ckMin').click();
await page.waitForTimeout(400);
await page.reload();
await until(() => page.evaluate(() => !!document.querySelector('panoptent-overlay')), 'katman yeniden yüklendi');
await page.waitForTimeout(400);
await page.evaluate((m) => window.__bg(m), CHECKS);
await until(ckOpen, 'panel açık');
assert.ok((await box()).h <= 44, 'küçük durum da hatırlanır');
await page.locator('panoptent-overlay #ckMin').click();
step('Sayfa yenilenince açık / küçük durumu, yeri ve ölçüsü hatırlanıyor');

// bozuk saklanan değerle açılış
await page.evaluate(() => {
  const s = JSON.parse(sessionStorage.getItem('__ptStore'));
  s.ui.checksGeom = { x: 'evil', y: 1e12, w: -50, h: 'Infinity', min: 'yes', max: 1, prev: '<img src=x onerror=alert(1)>' };
  s.ui.checks = true;
  sessionStorage.setItem('__ptStore', JSON.stringify(s));
});
await page.reload();
await until(() => page.evaluate(() => !!document.querySelector('panoptent-overlay')), 'katman');
await page.waitForTimeout(400);
await page.evaluate((m) => window.__bg(m), CHECKS);
await until(ckOpen, 'bozuk değerle panel açık');
b1 = await box();
assert.ok(await grabbable(), 'bozuk değerde panel ekranda: ' + JSON.stringify(b1));
assert.ok(b1.w >= 300 && b1.w <= vp().width - 16, JSON.stringify(b1));
assert.ok(await page.locator('panoptent-overlay .ckBody').isVisible(), "'yes' / 1 küçültme ya da büyütme sayılmaz");
// sayfa betiği katmana sahte konum gönderirse de ekranda kalır
await page.evaluate(() => window.postMessage({ source: 'panoptent', dir: 'down', type: 'checksPanel', open: true, geom: { x: -99999, y: -99999, w: 1e9, h: 1 } }, '*'));
await page.waitForTimeout(150);
assert.ok(await grabbable(), 'sahte mesajla da ekranda: ' + JSON.stringify(await box()));
step('Bozuk saklanan değer ve sayfa betiğinin sahte konumu: panel ekranda, ölçüler sınırlı, metin çalıştırılmıyor');

// pencere küçülünce yeniden sınırlanır; büyüyünce eski ölçü geri gelir
await drag(se, 200, 100);
const big = await box();
await page.setViewportSize({ width: 520, height: 420 });
await page.waitForTimeout(200);
assert.ok(await grabbable(), 'küçük pencerede ekranda: ' + JSON.stringify(await box()));
assert.ok((await box()).w <= 520 - 16);
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(200);
assert.deepEqual(await box(), big, 'pencere büyüyünce saklanan ölçü geri gelir');
step('Pencere küçülünce panel yeniden sınırlanıyor, büyüyünce saklanan ölçüye dönüyor');

// dokunma: işaretçi olayları (pointerType touch) başlıktan taşır
await moveTo(300, 200);
b0 = await box();
await page.evaluate(() => {
  const h = document.querySelector('panoptent-overlay').shadowRoot.getElementById('ckHead');
  const r = h.getBoundingClientRect();
  const x = r.left + 60, y = r.top + 15;
  const ev = (type, dx, dy) => h.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, composed: true, cancelable: true, clientX: x + dx, clientY: y + dy, button: 0 }));
  ev('pointerdown', 0, 0); ev('pointermove', -40, 30); ev('pointermove', -80, 60); ev('pointerup', -80, 60);
});
b1 = await box();
assert.ok(near(b1.x, b0.x - 80) && near(b1.y, b0.y + 60), 'dokunarak taşıma: ' + JSON.stringify([b0, b1]));
assert.equal(await head.evaluate((e) => getComputedStyle(e).touchAction), 'none', 'başlıkta dokunma kaydırma yapmaz');
step('Dokunma (pointerType touch) ile taşıma; başlıkta touch-action: none');

// tam sayfa düğmesi: yalnızca VS Code'a bağlıyken, VS Code'a haber verir
const pageBtn = page.locator('panoptent-overlay #ckPage');
assert.ok(await pageBtn.isVisible(), 'bağlıyken tam sayfa düğmesi görünür');
await page.evaluate(() => { window.__sent.length = 0; });
await pageBtn.click();
await until(() => page.evaluate(() => window.__sent.some((m) => m.type === 'checksOpenPage')), 'checksOpenPage VS Code\'a gitmeli');
await page.evaluate(() => window.__bg({ type: 'status', workspaces: [], active: null }));
await page.waitForTimeout(150);
assert.equal(await pageBtn.isVisible(), false, 'bağlı değilken tam sayfa düğmesi gizli');
// sayfa betiği uydurursa (kullanıcı etkileşimi olmadan) gönderilmez
await page.evaluate(() => window.__bg({ type: 'status', workspaces: [{ port: 47999, name: 'Demo', root: '/tmp/demo', state: 'ready' }], active: 47999 }));
await page.waitForTimeout(4200);
await page.evaluate(() => { window.__sent.length = 0; window.postMessage({ source: 'panoptent', dir: 'up', type: 'checksOpenPage' }, '*'); });
await page.waitForTimeout(150);
assert.equal(await page.evaluate(() => window.__sent.some((m) => m.type === 'checksOpenPage')), false, 'sahte istek gönderilmemeli');
step('Tam sayfa düğmesi: bağlıyken görünür ve VS Code\'a haber verir; bağlı değilken gizli; sayfa betiği uyduramaz');

// × hâlâ kapatır
await page.locator('panoptent-overlay #ckX').click();
await page.waitForTimeout(150);
assert.equal(await ckOpen(), false);
step('× paneli kapatıyor (yer / ölçü özellikleriyle birlikte)');

assert.deepEqual(errors, []);
await browser.close();
srv.close();
console.log(`\nChrome çekmecesi: ${steps.length} adım geçti. Ekran görüntüleri: ${out}`);
process.exit(0);
