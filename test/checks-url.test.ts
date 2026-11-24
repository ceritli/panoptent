// Sayfa katmanının saf yardımcıları (media/checks.js): adım ↔ geçerli sayfa eşleşmesi, "Aç" adresi, güvenli biçim.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CK = require('../media/checks.js') as {
  matchUrl(step: string, page: string): boolean;
  openUrl(step: string, page: string, rebase: boolean): string | null;
  segments(s: unknown): { b: boolean; s: string }[];
};

const PAGE = 'http://localhost:4000/admin/orders?tab=all&page=2#12';

test('eşleşme: yol aynıysa köken, sondaki / ve çapa (#12) yok sayılır', () => {
  assert.ok(CK.matchUrl('/admin/orders', PAGE));
  assert.ok(CK.matchUrl('/admin/orders/', PAGE));
  assert.ok(CK.matchUrl('/admin/orders#99', PAGE));
  assert.ok(CK.matchUrl('http://localhost:4000/admin/orders', PAGE));
  // VS Code önizlemesi proxy kökeninden açılır: localhost:4000 adresi 127.0.0.1:<port> sayfasıyla eşleşmeli
  assert.ok(CK.matchUrl('http://localhost:4000/admin/orders', 'http://127.0.0.1:51234/admin/orders'));
  assert.ok(!CK.matchUrl('/admin/orders/12', PAGE));
  assert.ok(!CK.matchUrl('/admin', PAGE));
  assert.ok(!CK.matchUrl('/Admin/orders', PAGE), 'yol büyük/küçük harfe duyarlı');
  assert.ok(CK.matchUrl('/admin/%C3%BCr%C3%BCn', 'http://x/admin/ürün'));
});

test('eşleşme: adımdaki sorgu parametreleri sayfada aynı değerle olmalı', () => {
  assert.ok(CK.matchUrl('/admin/orders?tab=all', PAGE));
  assert.ok(CK.matchUrl('/admin/orders?page=2&tab=all', PAGE));
  assert.ok(!CK.matchUrl('/admin/orders?tab=open', PAGE));
  assert.ok(!CK.matchUrl('/admin/orders?id=3', PAGE));
});

test('eşleşme: hash yönlendirmesi (#/yol) yol sayılır', () => {
  const hashPage = 'http://localhost:8080/#/settings/users?role=admin';
  assert.ok(CK.matchUrl('/#/settings/users', hashPage));
  assert.ok(CK.matchUrl('/#/settings/users?role=admin', hashPage));
  assert.ok(!CK.matchUrl('/#/settings', hashPage));
  assert.ok(!CK.matchUrl('/#/settings/users?role=x', hashPage));
  assert.ok(!CK.matchUrl('/#/settings/users', 'http://localhost:8080/settings/users'));
  assert.ok(CK.matchUrl('/', hashPage), 'hash rotası olmayan "/" adresi kök sayfadır');
});

test('eşleşme: boş, geçersiz ve http dışı adresler eşleşmez', () => {
  assert.ok(!CK.matchUrl('', PAGE));
  assert.ok(!CK.matchUrl('javascript:alert(1)', PAGE));
  assert.ok(!CK.matchUrl('/admin/orders', ''));
});

test('"Aç" adresi: önizlemede kökene taşınır, http dışı reddedilir', () => {
  const proxy = 'http://127.0.0.1:51234/admin';
  assert.equal(CK.openUrl('/admin/orders?x=1#2', proxy, true), 'http://127.0.0.1:51234/admin/orders?x=1#2');
  assert.equal(CK.openUrl('http://localhost:4000/a/b?c=1', proxy, true), 'http://127.0.0.1:51234/a/b?c=1');
  assert.equal(CK.openUrl('http://localhost:4000/a/b', 'http://localhost:4000/x', false), 'http://localhost:4000/a/b');
  assert.equal(CK.openUrl('https://other.example/a', 'http://localhost:4000/x', false), 'https://other.example/a');
  assert.equal(CK.openUrl('javascript:alert(1)', proxy, true), null);
  assert.equal(CK.openUrl('data:text/html,x', proxy, false), null);
  assert.equal(CK.openUrl('', proxy, false), null);
});

test('biçim: yalnızca **kalın**; HTML olduğu gibi metin kalır', () => {
  assert.deepEqual(CK.segments('**Bilgi:** migration yok'), [{ b: true, s: 'Bilgi:' }, { b: false, s: ' migration yok' }]);
  assert.deepEqual(CK.segments('<b>x</b><img src=x onerror=alert(1)>'), [{ b: false, s: '<b>x</b><img src=x onerror=alert(1)>' }]);
  assert.deepEqual(CK.segments('a **b** c **d**'), [{ b: false, s: 'a ' }, { b: true, s: 'b' }, { b: false, s: ' c ' }, { b: true, s: 'd' }]);
  assert.deepEqual(CK.segments('tek ** yıldız'), [{ b: false, s: 'tek ** yıldız' }]);
  assert.deepEqual(CK.segments(null), []);
});
