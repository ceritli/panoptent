// Chrome çubuğu (chrome/content.js) için kaynak denetimi. Tarayıcıda çalışan asıl test: test/e2e/chrome-drawer.mjs
// (npm run test:e2e). Bu dosya, tarayıcı olmadan da yakalanabilen iki gerilemeyi korur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'chrome', 'content.js'), 'utf8');

test('çekmece: ✕ düğmesine sekme işleyicisi bağlanmaz (0.11.2–0.13.1 hatası: ✕ çekmeceyi yeniden açıyordu)', () => {
  // ✕ (dclose) sekme satırındaki bir <button>; sekme seçicisi onu da yakalarsa openDrawer(undefined) çalışır
  assert.match(src, /<div class="tabs">[^\n]*id="dclose"/, 'düzen değiştiyse bu testi güncelle');
  const tabSelectors = [...src.matchAll(/querySelectorAll\('(\.tabs [^']*)'\)/g)].map((m) => m[1]);
  assert.ok(tabSelectors.length >= 2, 'sekme seçicileri bulunamadı');
  for (const sel of tabSelectors) assert.equal(sel, '.tabs button[data-tab]', `"${sel}" ✕ düğmesini de seçer`);
  assert.match(src, /\$\('dclose'\)\.addEventListener\('click', closeDrawer\)/);
});

test('Esc: seçim katmanının içinden gelen Esc çekmeceyi kapatmaz', () => {
  assert.match(src, /tagName === 'PANOPTENT-OVERLAY'/);
  assert.match(src, /e\.key === 'Escape' && ui\.drawer && !inField && !fromOverlay/);
});
