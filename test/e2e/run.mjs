// Test ve Karar — uçtan uca deneme (VS Code önizlemesi yolu).
// Eklentinin gerçek kodu (activate, PreviewPanel, DevProxy, MCP sunucusu, overlay.js, panel.js) sahte `vscode`
// modülüyle çalışır; webview HTML'i başsız Chromium'da açılır. Chrome köprüsü kapalıdır, MCP sunucusu
// 47821-47830 dışında rastgele bir portta açılır: çalışan bir Panoptent'e dokunulmaz.
//
//   npm run test:e2e -- --playwright /yol/node_modules/playwright --out /tmp/pt-e2e
//
// Playwright bu deponun bağımlılığı değildir: kurulu bir kopyanın yolu verilir (ya da `playwright` çözülebilir olmalı).
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import assert from 'assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const out = path.resolve(arg('--out', fs.mkdtempSync(path.join(os.tmpdir(), 'pt-e2e-'))));
const shots = path.join(out, 'shots');
fs.mkdirSync(shots, { recursive: true });
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(arg('--playwright', 'playwright'));
} catch (err) {
  console.log('SKIP: Playwright bulunamadı (--playwright <yol> verin): ' + err.message);
  process.exit(0);
}

// ---------- eklentiyi paketle ----------
const bundle = path.join(repo, 'dist', 'test', 'e2e-harness.js');
await esbuild.build({
  entryPoints: [path.join(here, 'harness.ts')],
  bundle: true,
  outfile: bundle,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['bufferutil', 'utf-8-validate'],
  logLevel: 'warning',
  plugins: [{ name: 'vscode-stub', setup: (b) => b.onResolve({ filter: /^vscode$/ }, () => ({ path: path.join(repo, 'test', 'vscode-stub.ts') })) }],
});
const H = require(bundle);

// ---------- örnek uygulama (sayfa stilleri panele sızmamalı) ----------
const HOSTILE = '<style>*{font-family:Georgia,serif!important}button{all:unset;color:red!important}div{letter-spacing:3px}</style>';
const PAGES = {
  '/': `<!doctype html><html><head><meta charset="utf-8"><title>Örnek</title>${HOSTILE}</head><body style="margin:0;padding:24px;background:#f7f5ee">
    <h1 id="title">Örnek uygulama</h1><p><a id="toOrders" href="/admin/orders">Siparişler</a></p><button class="save">Kaydet</button></body></html>`,
  '/admin/orders': `<!doctype html><html><head><meta charset="utf-8"><title>Siparişler</title>${HOSTILE}</head><body style="margin:0;padding:24px;background:#f7f5ee">
    <h1 id="ordersTitle">Siparişler</h1><table border="1" cellpadding="6"><tr><th>No</th><th>Tutar</th></tr><tr><td>12</td><td>$ 1.200</td></tr><tr><td>13</td><td>$ 980</td></tr></table>
    <p><button id="export">Dışa aktar</button> <a href="/">Ana sayfa</a></p></body></html>`,
};
const app = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const body = PAGES[p];
  res.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' }).end(body || 'yok');
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
const appUrl = `http://127.0.0.1:${app.address().port}`;

// ---------- webview kaynakları (media/) ve webview HTML'i ----------
let webviewHtml = '';
let pageHtml = ''; // Test ve Kararlar tam sayfa webview'i
// VS Code tema değişkenleri (koyu); webview CSP'si yalnız bu kökenden stil kabul eder
const THEME = ':root{--vscode-editor-background:#1f1f1f;--vscode-foreground:#cccccc;--vscode-descriptionForeground:#9d9d9d;--vscode-panel-border:#2b2b2b;' +
  '--vscode-sideBar-background:#181818;--vscode-input-background:#313131;--vscode-input-foreground:#cccccc;--vscode-button-background:#0078d4;' +
  '--vscode-button-foreground:#fff;--vscode-focusBorder:#0078d4;--vscode-font-family:system-ui,sans-serif;--vscode-font-size:13px;--vscode-textLink-foreground:#4daafc;' +
  '--vscode-list-activeSelectionBackground:#04395e;--vscode-editorWidget-background:#202020}';
const media = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/webview.html') return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(webviewHtml);
  if (p === '/page.html') return void res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(pageHtml);
  if (p === '/theme.css') return void res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' }).end(THEME);
  const f = path.join(repo, 'media', path.basename(p));
  if (!p.startsWith('/media/') || !fs.existsSync(f)) return void res.writeHead(404).end();
  const type = f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type + '; charset=utf-8' }).end(fs.readFileSync(f));
});
await new Promise((r) => media.listen(0, '127.0.0.1', r));
const mediaOrigin = `http://127.0.0.1:${media.address().port}`;

// ---------- çalışma klasörü (git kullanıcı adı: by alanı) ----------
const ws = path.join(out, 'ws');
fs.rmSync(ws, { recursive: true, force: true });
fs.mkdirSync(ws, { recursive: true });
spawnSync('git', ['-C', ws, 'init', '-q']);
spawnSync('git', ['-C', ws, 'config', 'user.name', 'Deneme Kullanıcı']);
spawnSync('git', ['-C', ws, 'config', 'user.email', 'deneme@example.com']);

const mcpPort = 49000 + Math.floor(Math.random() * 9000);
Object.assign(H.stub, { workspaceRoot: ws, language: 'tr', inputBox: appUrl + '/', mediaBase: mediaOrigin + '/media' });
Object.assign(H.stub.config, { 'panoptent.chromeBridge': false, 'panoptent.mcpPort': mcpPort, 'panoptent.openSourceOnSelect': false, 'panoptent.language': 'tr', 'panoptent.checks.userName': 'deneme-kullanici' }); // gh'ye gidilmez, gerçek ad yazılmaz

const ctx = H.fakeContext(repo, 'e2e');
H.activate(ctx);
await new Promise((r) => setTimeout(r, 300));
const mcpUrl = `http://127.0.0.1:${mcpPort}/mcp`;

// ---------- MCP istemcisi ----------
const { Client } = require(path.join(repo, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'client', 'index.js'));
const { StreamableHTTPClientTransport } = require(path.join(repo, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'client', 'streamableHttp.js'));
async function mcp(name, a = {}) {
  const c = new Client({ name: 'e2e', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));
  const r = await c.callTool({ name, arguments: a });
  await c.close();
  const text = (r.content || []).map((x) => x.text).join('');
  if (r.isError) throw new Error(name + ': ' + text);
  return JSON.parse(text);
}

const steps = [];
const step = (s) => {
  steps.push(s);
  console.log('✓ ' + s);
};
const topicFile = (place = 'open') => path.join(ws, '.panoptent', 'checks', place, 'siparis-aktar.json');
const readTopic = () => JSON.parse(fs.readFileSync(topicFile(), 'utf8'));
async function until(fn, what, ms = 6000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (err) {
      last = err;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('zaman aşımı: ' + what + (last ? ' (' + last.message + ')' : ''));
}

// ---------- 1) Ajan konuyu ekler (MCP) ----------
const saved = await mcp('save_check_topic', {
  id: 'siparis-aktar',
  name: 'Sipariş dışa aktarma',
  date: '23.11.2026',
  lead: 'Siparişler sayfasına CSV dışa aktarma eklendi.',
  tests: [
    { id: 't1', t: 'CSV indir', url: '/admin/orders', agent: true, d: 'Siparişler → Dışa aktar düğmesine bas.', e: 'İndirilen dosyada 2 satır var.' },
    { id: 't2', t: 'Ana sayfa bağlantısı', url: '/', d: 'Ana sayfada "Siparişler" bağlantısına tıkla.', e: 'Siparişler tablosu açılır.' },
    { id: 't3', t: 'Süzgeçli liste <img src=x onerror="window.__pwned=1">', url: '/admin/orders?tab=open', d: 'Açık sekmesine geç.', e: 'Yalnız açık siparişler görünür.' },
  ],
  decisions: [{ id: 'k1', t: 'CSV ayracı', o: ['Virgül (bugünkü durum)', 'Noktalı virgül: Excel TR doğrudan açar'] }],
  infos: ['**Bilgi:** migration yok.', '**Denenemeyen:** e-posta ile gönderim. <b>bu etiket metin kalmalı</b>'],
});
assert.equal(saved.file, '.panoptent/checks/open/siparis-aktar.json');
assert.ok(fs.existsSync(topicFile()));
step('MCP save_check_topic → .panoptent/checks/open/siparis-aktar.json');

// ---------- 2) Önizlemeyi aç, webview'i tarayıcıda çalıştır ----------
const browser = await playwright.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(String(e)));
let fake;
const gotWebview = new Promise((resolve) => (H.stub.onWebview = resolve));
await page.exposeBinding('__ptUp', (_src, m) => fake && fake.receive(m));
H.commands.executeCommand('panoptent.open');
fake = await gotWebview;
fake.post = (m) => page.evaluate((x) => window.postMessage(x, '*'), m).catch(() => {});
const nonce = /nonce="([^"]+)"/.exec(fake.html)[1];
webviewHtml = fake.html.replace(
  '<body>',
  `<body><script nonce="${nonce}">window.acquireVsCodeApi=()=>({postMessage:(m)=>window.__ptUp(m),getState:()=>null,setState:()=>{}});</script>`,
);
await page.goto(mediaOrigin + '/webview.html');
const frame = await until(() => page.frames().find((f) => f.url().startsWith('http://127.0.0.1') && !f.url().startsWith(mediaOrigin) && f !== page.mainFrame()), 'önizleme çerçevesi');
await frame.waitForSelector('#title');
const btn = page.locator('#checksBtn');
await btn.waitFor({ state: 'visible' });
await until(async () => (await page.locator('#checksCount').textContent()) === '4', 'rozet 4 (3 test + 1 karar)');
step('Çubukta "Test" düğmesi ve rozet: 4 bekleyen');
await page.screenshot({ path: path.join(shots, '1-cubuk-rozet.png') });

// ---------- 3) Panel: bu sayfaya ait adım önce, metin kaçışı ----------
await btn.click();
const panel = frame.locator('panoptent-overlay .ck');
await panel.waitFor({ state: 'visible' });
const titles = async () => panel.locator('.ckRow .ckTt').allTextContents();
if (args.includes('--debug')) {
  await page.screenshot({ path: path.join(shots, 'debug.png') });
  console.log(await frame.evaluate(() => document.querySelector('panoptent-overlay').shadowRoot.getElementById('ck').outerHTML.slice(0, 3000)));
}
await until(async () => (await titles()).length === 3, 'panelde 3 test adımı');
assert.equal((await titles())[0], 'Ana sayfa bağlantısı', 'ana sayfadaki adım en üstte olmalı');
assert.equal(await panel.locator('.ckRow').first().locator('.ckTag.here').count(), 1);
assert.equal(await frame.locator('panoptent-overlay img').count(), 0, 'başlıktaki HTML öğe olmamalı');
assert.equal(await frame.evaluate(() => window.__pwned), undefined);
assert.ok((await titles()).some((x) => x.includes('<img src=x')), 'HTML düz metin olarak görünmeli');
assert.equal(await panel.locator('.ckInfo b').first().textContent(), 'Bilgi:');
assert.ok((await panel.locator('.ckInfo').nth(1).textContent()).includes('<b>bu etiket metin kalmalı</b>'));
// sayfanın stilleri panele sızmıyor
const font = await panel.locator('.ckBtn').first().evaluate((e) => getComputedStyle(e).fontFamily);
assert.ok(!/Georgia/.test(font), 'sayfa yazı tipi panele sızmamalı: ' + font);
step('Panel açıldı; "bu sayfada" adımı en üstte, HTML/öğe enjeksiyonu yok, sayfa stili sızmıyor');
await page.screenshot({ path: path.join(shots, '2-panel-ana-sayfa.png') });

// ---------- 4) Tamam işareti → dosyaya anında yazılır ----------
await panel.locator('.ckRow').first().locator('input[type=checkbox]').check();
await until(() => readTopic().tests[1].result.state === 'ok', 't2 ok dosyada');
const r2 = readTopic().tests[1].result;
assert.equal(r2.by, 'deneme-kullanici');
assert.ok(r2.at);
step('t2 işaretlendi → dosyada state "ok", by "deneme-kullanici" (ayardan)');

// ---------- 5) "Aç" ile adımın sayfasına git; panel açık kalır, adım öne çıkar ----------
await panel.locator('.ckRow', { hasText: 'CSV indir' }).locator('.ckBtn.link').click();
await frame.waitForURL(/\/admin\/orders$/);
await frame.waitForSelector('#ordersTitle');
await frame.locator('panoptent-overlay .ck').waitFor({ state: 'visible' });
await until(async () => (await titles())[0] === 'CSV indir', 'siparişler sayfasında CSV adımı en üstte');
step('"Aç" → /admin/orders; panel açık kaldı, CSV adımı "bu sayfada" olarak en üstte');

// ---------- 6) Sorun + not ----------
const csvRow = panel.locator('.ckRow', { hasText: 'CSV indir' });
await csvRow.locator('.ckBtn', { hasText: 'Sorun' }).click();
const note = csvRow.locator('textarea.ckNote');
await note.waitFor();
await note.fill('Dosya boş iniyor, başlık satırı da yok.');
await until(() => readTopic().tests[0].result.note === 'Dosya boş iniyor, başlık satırı da yok.', 'not dosyada');
assert.equal(readTopic().tests[0].result.state, 'bad');
step('t1 "Sorun" + not → dosyada state "bad" ve not');

// ---------- 7) Seçili öğeyle "Kuyruğa da ekle" (var olan kuyruk) ----------
await page.locator('#selBtn').click();
await frame.locator('#export').click();
await frame.locator('panoptent-overlay .pop').waitFor({ state: 'visible' });
await frame.locator('panoptent-overlay .pop textarea').press('Escape');
await csvRow.locator('.ckBtn', { hasText: 'Kuyruğa' }).click();
await until(async () => (await page.locator('#qcount').textContent()) === '1', 'kuyrukta 1 değişiklik');
await page.locator('#qList').click().catch(() => {});
const queued = await page.evaluate(() => document.querySelector('#queue')?.textContent || '');
assert.ok(queued.includes('Test sorunu: Sipariş dışa aktarma / T1 CSV indir. Dosya boş iniyor'), queued);
await page.locator('#selBtn').click();
step('"Kuyruğa da ekle" → var olan değişiklik kuyruğuna 1 istek (seçili #export öğesiyle)');

// ---------- 8) Karar seç ----------
await panel.locator('.ckOpt', { hasText: 'Noktalı virgül' }).locator('input').check();
await until(() => readTopic().decisions[0].pick?.index === 1, 'karar dosyada');
assert.equal(readTopic().decisions[0].pick.option, 'Noktalı virgül: Excel TR doğrudan açar');
step('K1 seçildi → dosyada pick.index 1, by/at');
await page.screenshot({ path: path.join(shots, '3-panel-siparisler-sorun-karar.png') });

// ---------- 9) Klavye: odak yeniden çizimden sonra korunur, Boşluk işaretler ----------
const t3box = panel.locator('.ckRow', { hasText: 'Süzgeçli liste' }).locator('input[type=checkbox]');
await t3box.focus();
await frame.page().keyboard.press('Space');
await until(() => readTopic().tests[2].result.state === 'ok', 't3 ok (klavye)');
await new Promise((r) => setTimeout(r, 400)); // yeni hal geldi, panel yeniden çizildi
const focusedKey = await frame.evaluate(() => document.querySelector('panoptent-overlay').shadowRoot.activeElement?.getAttribute('data-k'));
assert.equal(focusedKey, 'ok|t3', 'odak işaretlenen kutuda kalmalı');
step('Klavye: Boşluk ile t3 işaretlendi, yeniden çizimden sonra odak aynı kutuda');

// ---------- 10) MCP ile oku: kim, neyi, ne zaman ----------
const all = await mcp('get_check_topics');
const tp = all.topics.find((x) => x.id === 'siparis-aktar');
assert.deepEqual(tp.tests.map((x) => [x.id, x.result.state]), [['t1', 'bad'], ['t2', 'ok'], ['t3', 'ok']]);
assert.equal(tp.decisions[0].picked, 'Noktalı virgül: Excel TR doğrudan açar');
assert.equal(tp.counts.complete, false);
step('MCP get_check_topics: t1 bad (not), t2 ok, t3 ok, K1 "Noktalı virgül", by "deneme-kullanici"');

// ---------- 11) Ajan düzeltir: retest → panelde t1 yeniden "bakılmadı" ----------
await mcp('save_check_topic', {
  id: 'siparis-aktar',
  name: 'Sipariş dışa aktarma',
  date: '23.11.2026',
  lead: 'Siparişler sayfasına CSV dışa aktarma eklendi. Boş dosya hatası düzeltildi.',
  tests: readTopic().tests.map(({ result, ...x }) => x),
  decisions: [{ id: 'k1', t: 'CSV ayracı', o: ['Virgül (bugünkü durum)', 'Noktalı virgül: Excel TR doğrudan açar'] }],
  infos: ['**Bilgi:** migration yok.'],
  retest: ['t1'],
});
await until(async () => (await csvRow.locator('textarea.ckNote').count()) === 0 && !(await csvRow.getAttribute('class')).includes('bad'), 'panelde t1 sıfırlandı');
step('MCP save_check_topic retest:["t1"] → panelde t1 yeniden "bakılmadı" (sayfa yenilenmeden)');

// ---------- 12) Dosya elle / git ile değişti → panel yeniden okur ----------
const j = readTopic();
j.name = 'Sipariş dışa aktarma (git)';
fs.writeFileSync(topicFile(), JSON.stringify(j, null, 2) + '\n');
// tek konuda konu seçici gizli ama seçici düğmesi konu adını taşır
await until(async () => (await frame.locator('panoptent-overlay .ckPick').getAttribute('title')) === 'Sipariş dışa aktarma (git)', 'yeni konu adı panelde');
assert.ok((await panel.locator('.ckLead').textContent()).includes('düzeltildi'));
assert.equal((await mcp('get_check_topics', { id: 'siparis-aktar' })).topic.name, 'Sipariş dışa aktarma (git)');
step('Dosya diskte değişti (git pull benzeri) → izleyici yeni hali panele gönderdi');

// ---------- 13) Yazılamazsa kullanıcı görür (sessiz kayıp yok) ----------
// root için klasör izinleri yazmayı engellemez (ör. bulut kapsayıcıları): o durumda bu adım sınanamaz
if (process.getuid?.() === 0) {
  console.log('- ATLANDI (root): salt okunur klasörde yazma hatası sınanamaz');
} else {
  const openDir = path.dirname(topicFile());
  fs.chmodSync(openDir, 0o555);
  try {
    await csvRow.locator('input[type=checkbox]').click(); // check() değil: kutu bilerek geri döner
    await until(async () => /Kaydedilmedi/.test((await panel.locator('.ckMsg').textContent()) || ''), 'hata iletisi');
    await until(async () => !(await csvRow.locator('input[type=checkbox]').isChecked()), 'işaret geri alındı');
    await page.screenshot({ path: path.join(shots, '4-yazma-hatasi.png') });
  } finally {
    fs.chmodSync(openDir, 0o755);
  }
  assert.equal(readTopic().tests[0].result.state, 'none');
  step('Klasör salt okunurken işaret: panelde "Kaydedilmedi: …", kutu eski haline döndü');
}

// ---------- 14) Kapatma: eksikken reddedilir, tamamlanınca arşive taşınır ----------
await assert.rejects(mcp('close_check_topic', { id: 'siparis-aktar' }), /not complete/);
await csvRow.locator('input[type=checkbox]').check();
await until(() => readTopic().tests[0].result.state === 'ok', 't1 ok');
const ch = await mcp('get_check_changes');
const chT = ch.topics.find((x) => x.id === 'siparis-aktar');
assert.ok(chT && chT.counts.complete, JSON.stringify(ch));
assert.ok(chT.tests.some((x) => x.id === 't1' && x.result.state === 'ok'));
step('MCP get_check_changes: yalnız son okumadan beri değişenler (t1 ok), complete: true');
const closed = await mcp('close_check_topic', { id: 'siparis-aktar' });
assert.equal(closed.file, '.panoptent/checks/archive/siparis-aktar.json');
assert.ok(fs.existsSync(topicFile('archive')) && !fs.existsSync(topicFile()));
const arch = JSON.parse(fs.readFileSync(topicFile('archive'), 'utf8'));
assert.equal(arch.closedBy, 'deneme-kullanici');
await until(async () => (await panel.locator('.ckEmpty').count()) > 0, 'panel boş');
step('MCP close_check_topic → archive/siparis-aktar.json (closedAt, closedBy); panel "Açık konu yok"');
await page.screenshot({ path: path.join(shots, '5-kapatildi.png') });

// ---------- 15) Esc paneli kapatır; uygulama tarafında .panoptent değişikliği "dosya değişti" sayılmadı ----------
await panel.locator('.x').focus();
await frame.page().keyboard.press('Escape');
await panel.waitFor({ state: 'hidden' });
const log = await page.locator('#log').textContent();
assert.ok(!/\.panoptent/.test(log), 'etkinlik günlüğünde .panoptent dosya değişikliği görünmemeli');
step('Esc paneli kapattı; .panoptent yazmaları "değişti" günlüğüne ve sayfa yenilemesine yol açmadı');
// ---------- 16) VS Code komutu paneli sayfada açar ----------
await H.commands.executeCommand('panoptent.showChecks');
await panel.waitFor({ state: 'visible' });
step('"Panoptent: Test ve Kararları Sayfada Göster" komutu paneli önizlemede açtı');

// ---------- 17) Kapatma düğmeleri: Test panelinin × düğmesi ve öğe kutusunun × düğmesi ----------
await frame.locator('panoptent-overlay #ckX').click();
await panel.waitFor({ state: 'hidden' });
// açık konu kalmadığı için Test düğmesi panel kapanınca gizlenir (doğru davranış); komutla yeniden aç
await page.locator('#checksBtn').waitFor({ state: 'hidden', timeout: 3000 });
await H.commands.executeCommand('panoptent.showChecks');
await panel.waitFor({ state: 'visible' });
await page.locator('#selBtn').click();
await frame.locator('#ordersTitle').click();
const pop = frame.locator('panoptent-overlay .pop');
await pop.waitFor({ state: 'visible' });
await frame.locator('panoptent-overlay #popX').click();
await pop.waitFor({ state: 'hidden' });
assert.ok(await panel.isVisible(), 'öğe kutusunun × düğmesi Test panelini kapatmamalı');
await frame.locator('panoptent-overlay #ckX').click();
await panel.waitFor({ state: 'hidden' });
await page.locator('#selBtn').click();
step('Önizlemede × düğmeleri: Test paneli ve öğe kutusu ayrı ayrı kapanıyor, birbirini etkilemiyor');

// ---------- 18) Önizlemede panelin yeri ve ölçüsü yenilemede korunur ----------
await mcp('save_check_topic', {
  id: 'tam-sayfa',
  name: 'Tam sayfa konusu',
  lead: 'Tam sayfa denemesi.',
  tests: [
    { id: 't1', t: 'Sipariş listesi', url: '/admin/orders', d: 'Siparişler sayfasını aç.', e: 'İki satır görünür.' },
    { id: 't2', t: 'Ana sayfa', url: '/', d: 'Ana sayfayı aç.', e: 'Başlık görünür.' },
    { id: 't3', t: 'Betik <img src=x onerror="window.__pwned2=1"><script>window.__pwned2=1</script>', d: '<b>kalın değil</b>', e: 'metin olarak' },
  ],
  decisions: [{ id: 'k1', t: 'Sayfa başına satır', o: ['20 (bugünkü durum)', '50: daha az sayfa, daha uzun yükleme'] }],
  infos: ['**Bilgi:** betik denemesi <script>window.__pwned2=1</script>'],
});
await H.commands.executeCommand('panoptent.showChecks');
await panel.waitFor({ state: 'visible' });
const pbox = async () => { const b = await panel.boundingBox(); return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
const phead = frame.locator('panoptent-overlay #ckHead');
{
  const b = await phead.boundingBox();
  await page.mouse.move(b.x + 60, b.y + 15);
  await page.mouse.down();
  await page.mouse.move(b.x - 140, b.y + 95, { steps: 6 });
  await page.mouse.up();
  const se = await frame.locator('panoptent-overlay .ckRz[data-edge=se]').boundingBox();
  await page.mouse.move(se.x + 8, se.y + 8);
  await page.mouse.down();
  await page.mouse.move(se.x + 68, se.y - 92, { steps: 6 });
  await page.mouse.up();
}
const moved = await pbox();
await page.waitForTimeout(500);
await page.locator('#reloadBtn').click();
await frame.waitForSelector('#title, #ordersTitle');
await panel.waitFor({ state: 'visible' });
await page.waitForTimeout(300);
assert.deepEqual(await pbox(), moved, 'önizleme yenilenince yer ve ölçü korunmalı');
step('Önizleme: panel taşınıp boyutlandırıldı; sayfa yenilenince aynı yer ve ölçüde açıldı');

// ---------- 19) Tam sayfa: paneldeki düğme VS Code'da editör sekmesi açar ----------
let fakePage;
const gotPage = new Promise((r) => (H.stub.onWebview = r));
const ckPage = frame.locator('panoptent-overlay #ckPage');
assert.ok(await ckPage.isVisible(), 'önizlemede tam sayfa düğmesi görünür');
await ckPage.click();
fakePage = await gotPage;
const page2 = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const page2Errors = [];
page2.on('pageerror', (e) => page2Errors.push(String(e)));
await page2.exposeBinding('__ptUp2', (_s, m) => fakePage.receive(m));
fakePage.post = (m) => page2.evaluate((x) => window.postMessage(x, '*'), m).catch(() => {});
assert.match(fakePage.html, /script-src 'nonce-[A-Za-z0-9]+'/, 'sıkı CSP, nonce');
assert.doesNotMatch(fakePage.html, /unsafe-inline|unsafe-eval/, 'satır içi betik / stil izni yok');
const nonce2 = /nonce="([^"]+)"/.exec(fakePage.html)[1];
pageHtml = fakePage.html
  .replace('</head>', '<link rel="stylesheet" href="' + mediaOrigin + '/theme.css"></head>')
  .replace('<body>', `<body><script nonce="${nonce2}">window.acquireVsCodeApi=()=>({postMessage:(m)=>window.__ptUp2(m),getState:()=>null,setState:()=>{}});</script>`);
await page2.goto(mediaOrigin + '/page.html');
await page2.locator('.card').first().waitFor();
assert.ok((await page2.locator('#nav').textContent()).includes('Tam sayfa konusu'));
step('Paneldeki ⧉ düğmesi VS Code\'da "Test ve Kararlar" sekmesini açtı (sıkı CSP, nonce\'lu betik)');

// betik içeren konu metni çalışmaz, metin olarak görünür
assert.equal(await page2.evaluate(() => window.__pwned2), undefined);
assert.equal(await page2.locator('main img, main script').count(), 0);
assert.ok((await page2.locator('.rowTitle', { hasText: 'Betik' }).textContent()).includes('<img src=x'));
assert.ok((await page2.locator('.info').first().textContent()).includes('<script>'));
assert.equal(await page2.locator('.info b').first().textContent(), 'Bilgi:');
step('Tam sayfa: betik / HTML içeren konu metni çalışmadı, düz metin olarak göründü; yalnız **kalın** biçim');

// işaretleme, not, karar → dosyada
const tsFile = path.join(ws, '.panoptent', 'checks', 'open', 'tam-sayfa.json');
const tsRead = () => JSON.parse(fs.readFileSync(tsFile, 'utf8'));
const row2 = (name) => page2.locator('.row', { hasText: name });
await row2('Ana sayfa').locator('input[type=checkbox]').check();
await until(() => tsRead().tests[1].result.state === 'ok', 'tam sayfa: t2 ok');
await row2('Sipariş listesi').locator('.btn').click();
await row2('Sipariş listesi').locator('textarea.note').fill('Liste boş geliyor.');
await until(() => tsRead().tests[0].result.note === 'Liste boş geliyor.', 'tam sayfa: not');
assert.equal(tsRead().tests[0].result.by, 'deneme-kullanici');
step('Tam sayfa: adım tamam, sorun + not dosyaya yazıldı (by: deneme-kullanici)');

// süzgeçler
const filter = (name) => page2.locator('#filters button', { hasText: name }).click();
await filter('Sorunlu');
assert.deepEqual(await page2.locator('.row .rowTitle').allTextContents(), ['Sipariş listesi']);
assert.equal(await page2.locator('.dec').count(), 0);
await filter('Bakılmamış');
assert.equal((await page2.locator('.row .rowTitle').allTextContents()).length, 1);
assert.ok((await page2.locator('.row .rowTitle').first().textContent()).startsWith('Betik'));
await filter('Kararsız');
assert.equal(await page2.locator('.row').count(), 0);
assert.equal(await page2.locator('.dec').count(), 1);
await page2.locator('.opt', { hasText: '50:' }).locator('input').click(); // check() değil: seçilen karar "Kararsız" süzgecinden çıkar
await until(() => tsRead().decisions[0].pick?.index === 1, 'tam sayfa: karar');
await until(async () => (await page2.locator('.empty').count()) === 1, 'kararsız kalmadı');
await filter('Tümü');
step('Tam sayfa süzgeçleri: Sorunlu / Bakılmamış / Kararsız doğru adımları gösteriyor; karar seçildi');

// dosya değişince (git / ajan) sekme yenilenir
const tj = tsRead();
tj.name = 'Tam sayfa konusu (git)';
fs.writeFileSync(tsFile, JSON.stringify(tj, null, 2) + '\n');
await until(async () => (await page2.locator('.card h2').first().textContent()) === 'Tam sayfa konusu (git)', 'dosya değişince yenilendi');
await page.waitForTimeout(100);
assert.equal(await panel.locator('.ckTab').first().getAttribute('title'), 'Tam sayfa konusu (git)', 'sayfadaki panel de yenilendi');
step('Dosya diskte değişince tam sayfa sekmesi ve sayfadaki panel kendini yeniledi');
await page2.screenshot({ path: path.join(shots, '6-tam-sayfa.png') });

// adımın adresi önizlemede açılır
await page.evaluate(() => {}); // önizleme ön planda
const onHome = new URL(frame.url()).pathname === '/';
const [target, targetPath] = onHome ? ['Sipariş listesi', '/admin/orders'] : ['Ana sayfa', '/'];
await row2(target).locator('.link', { hasText: 'Sayfayı aç' }).click();
await until(() => new URL(frame.url()).pathname === targetPath, 'önizleme adımın sayfasına gitti: ' + targetPath);
step('Tam sayfadaki "Sayfayı aç" adımın adresini önizlemede açtı');
assert.deepEqual(page2Errors, []);
await page2.close();
assert.deepEqual(consoleErrors, []);

await browser.close();
H.deactivate();
H.closeWatchers();
app.close();
media.close();
fs.writeFileSync(path.join(out, 'steps.txt'), steps.join('\n') + '\n');
console.log(`\nUçtan uca: ${steps.length} adım geçti. Ekran görüntüleri: ${shots}`);
// Chrome çubuğu (chrome/content.js): çekmece ve Test paneli, taklit chrome.* ile
const chrome = spawnSync(process.execPath, [path.join(here, 'chrome-drawer.mjs'), ...args.filter((a, i) => a !== '--out' && args[i - 1] !== '--out'), '--out', path.join(out, 'chrome')], { stdio: 'inherit' });
if (chrome.status !== 0) process.exit(chrome.status ?? 1);
// VS Code Integrated Browser yolu: aynı arayüz proxy kanalıyla, Test ve Karar + MCP sayfa araçları
const ib = spawnSync(process.execPath, [path.join(here, 'integrated-browser.mjs'), ...args.filter((a, i) => a !== '--out' && args[i - 1] !== '--out'), '--out', path.join(out, 'integrated-browser')], { stdio: 'inherit' });
process.exit(ib.status ?? 1);
