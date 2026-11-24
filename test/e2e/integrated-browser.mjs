// VS Code Integrated Browser önizlemesi — uçtan uca deneme (başsız Chromium).
// Eklentinin gerçek `activate()` kodu sahte `vscode` modülüyle çalışır. `workbench.action.browser.open` sahte bir komutla
// karşılanır: açmak istediği adres (Panoptent proxy'si) Chromium'da açılır. Sayfaya Chrome eklentisinin arayüzü
// (chrome/content.js + media/pagehost.js) enjekte edilir; Test ve Karar paneli ve MCP sayfa araçları bu yoldan sınanır.
//   node test/e2e/integrated-browser.mjs --playwright <playwright yolu> [--out <klasör>]
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
const out = path.resolve(arg('--out', fs.mkdtempSync(path.join(os.tmpdir(), 'pt-ib-'))));
fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require(arg('--playwright', 'playwright'));
} catch (err) {
  console.log('SKIP: Playwright bulunamadı (--playwright <yol> verin): ' + err.message);
  process.exit(0);
}

const bundle = path.join(repo, 'dist', 'test', 'e2e-harness-ib.js');
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

const PAGES = {
  '/': `<!doctype html><html><head><meta charset="utf-8"><title>Örnek</title></head><body style="margin:0;padding:24px;background:#f7f5ee">
    <h1 id="title">Örnek uygulama</h1><button id="save" style="background:#2563eb;color:#fff;padding:8px 14px;border:0">Kaydet</button></body></html>`,
};
const app = http.createServer((req, res) => {
  const body = PAGES[new URL(req.url, 'http://x').pathname];
  res.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' }).end(body || 'yok');
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
const appUrl = `http://127.0.0.1:${app.address().port}`;

const ws = path.join(out, 'ws');
fs.rmSync(ws, { recursive: true, force: true });
fs.mkdirSync(ws, { recursive: true });
spawnSync('git', ['-C', ws, 'init', '-q']);

const mcpPort = 49000 + Math.floor(Math.random() * 9000);
Object.assign(H.stub, { workspaceRoot: ws, language: 'tr', inputBox: appUrl + '/' });
Object.assign(H.stub.config, {
  'panoptent.chromeBridge': false, // gerçek Chrome köprüsü açılmaz; sayfa proxy kanalıyla bağlanır
  'panoptent.previewIn': 'integratedBrowser',
  'panoptent.mcpPort': mcpPort,
  'panoptent.openSourceOnSelect': false,
  'panoptent.language': 'tr',
  'panoptent.checks.userName': 'deneme-kullanici',
});

// VS Code 1.109+'daki Integrated Browser komutu yerine: istenen adresi yakala
let opened;
const gotUrl = new Promise((resolve) => (opened = resolve));
H.commands.registerCommand('workbench.action.browser.open', (o) => opened(o));

H.activate(H.fakeContext(repo, 'e2e-ib'));
await new Promise((r) => setTimeout(r, 300));

const { Client } = require(path.join(repo, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'client', 'index.js'));
const { StreamableHTTPClientTransport } = require(path.join(repo, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'client', 'streamableHttp.js'));
async function mcpRaw(name, a = {}) {
  const c = new Client({ name: 'e2e', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${mcpPort}/mcp`)));
  const r = await c.callTool({ name, arguments: a });
  await c.close();
  return r;
}
async function mcp(name, a = {}) {
  const r = await mcpRaw(name, a);
  const text = (r.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('');
  if (r.isError) throw new Error(name + ': ' + text);
  return JSON.parse(text);
}
const step = (s) => console.log('✓ ' + s);
async function until(fn, what, ms = 8000) {
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

await mcp('save_check_topic', {
  id: 'kaydet',
  name: 'Kaydet düğmesi',
  tests: [{ id: 't1', t: 'Kaydet çalışıyor', url: '/', d: 'Kaydet düğmesine bas.', e: 'Kaydedildi yazısı çıkar.' }],
  decisions: [{ id: 'k1', t: 'Düğme rengi', o: ['Mavi (bugünkü durum)', 'Yeşil'] }],
});

// ---------- Önizleme → Integrated Browser ----------
H.commands.executeCommand('panoptent.open');
const req = await until(() => gotUrl, 'workbench.action.browser.open çağrısı');
assert.ok(/^http:\/\/127\.0\.0\.1:\d+\/$/.test(req.url), 'proxy adresi açılmalı: ' + req.url);
step('Önizlemeyi Aç → Integrated Browser komutu proxy adresiyle çağrıldı');

const browser = await playwright.chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(req.url);
await page.waitForSelector('#title');
const ui = page.locator('panoptent-ui');
await ui.locator('#bar').waitFor({ state: 'visible' });
step('Sayfada Chrome çubuğu (content.js) göründü');

// Test ve Karar: rozet, panel (checks.js katmanla birlikte yüklenmeli), işaretleme dosyaya yazılır
const ckBtn = ui.locator('#ckBtn');
await ckBtn.waitFor({ state: 'visible' });
await until(async () => (await ui.locator('#ckN').textContent()) === '2', 'rozet 2 (1 test + 1 karar)');
await ckBtn.click();
const ck = page.locator('panoptent-overlay .ck');
await ck.waitFor({ state: 'visible' });
await ck.locator('.ckRow', { hasText: 'Kaydet çalışıyor' }).locator('input[type=checkbox]').check();
const topicFile = path.join(ws, '.panoptent', 'checks', 'open', 'kaydet.json');
await until(() => JSON.parse(fs.readFileSync(topicFile, 'utf8')).tests[0].result?.state === 'ok', 't1 dosyada ok');
assert.equal(JSON.parse(fs.readFileSync(topicFile, 'utf8')).tests[0].result.by, 'deneme-kullanici');
step('Test paneli açıldı, adım işaretlendi → dosyada state ok, by deneme-kullanici');
await page.screenshot({ path: path.join(out, '1-test-paneli.png') });
await page.locator('panoptent-overlay #ckX').click();

// Seçim → MCP get_selection
await ui.locator('#sel').click();
await page.locator('#save').click();
let lastSel;
await until(async () => { lastSel = await mcpRaw('get_selection'); return /#save|Kaydet/.test(JSON.stringify(lastSel.content)); }, 'get_selection öğeyi görmeli').catch((e) => { console.log(JSON.stringify(lastSel).slice(0, 800)); throw e; });
step('Seç + tıkla → MCP get_selection öğeyi görüyor');

// MCP sayfa araçları
const hl = await mcp('highlight', { selector: '#title', label: 'Başlık', seconds: 5 });
assert.ok(hl.highlighted >= 1 || hl.ok !== false, 'highlight: ' + JSON.stringify(hl));
await until(() => page.evaluate(() => !!document.querySelector('panoptent-overlay')?.shadowRoot?.textContent.includes('Başlık')), 'vurgu etiketi');
step('MCP highlight → sayfada etiketli çerçeve');

const shot = await mcpRaw('screenshot_element', { selector: '#save' });
assert.ok(!shot.isError, 'screenshot_element hata: ' + JSON.stringify(shot.content));
const img = (shot.content || []).find((x) => x.type === 'image');
assert.ok(img && img.data.length > 100, 'görüntü dönmeli');
fs.writeFileSync(path.join(out, '2-screenshot-element.' + (img.mimeType.includes('png') ? 'png' : 'svg')), Buffer.from(img.data, 'base64'));
step('MCP screenshot_element → görüntü döndü (sekme yakalama yok, DOM çizimi)');

const pv = await mcp('preview_style', { selector: '#save', styles: { background: 'rgb(22, 163, 74)' } });
assert.ok(pv, 'preview_style yanıtı');
await until(() => page.evaluate(() => getComputedStyle(document.getElementById('save')).backgroundColor === 'rgb(22, 163, 74)'), 'stil önizlemesi uygulandı');
step('MCP preview_style → düğme yeşil göründü');
await page.screenshot({ path: path.join(out, '3-preview-style.png') });

assert.deepEqual(errors, [], 'sayfa hataları');
await browser.close();
H.deactivate?.();
app.close();
console.log('integrated-browser e2e: tamam');
process.exit(0);
