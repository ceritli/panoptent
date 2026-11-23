// Test ve Karar deposu: şema doğrulama, kimlik ve yol güvenliği, atomik / eşzamanlı yazma, arşiv,
// "yalnız değişenler", `by` alanı, bilinmeyen alanların korunması.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn, spawnSync } from 'child_process';
import { CheckError, ChecksStore, UserResolver, checkUrl, cleanName, isId, readTopic, summarize, validateInput, whoAmI } from '../src/checks';

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pt-checks-'));
}

let clock = Date.parse('2026-11-23T10:00:00.000Z');
const tick = () => new Date((clock += 1000));

function store(root = tmpRoot(), who = 'Ayşe') {
  return new ChecksStore(root, { who: () => who, now: tick });
}

const TOPIC = {
  id: 'siparis-aktar',
  name: 'Sipariş dışa aktarma',
  date: '23.11.2026',
  lead: 'CSV dışa aktarma eklendi.',
  tests: [
    { id: 't1', t: 'CSV indir', url: '/admin/orders?tab=all#12', d: 'Siparişler → Dışa aktar', e: '3 satır', agent: true },
    { id: 't2', t: 'Boş liste', url: '/admin/orders', d: 'Süzgeç: yok', e: 'Uyarı görünür' },
  ],
  decisions: [{ id: 'k1', t: 'Ayraç', o: ['Virgül (bugünkü durum)', 'Noktalı virgül: Excel TR doğrudan açar'] }],
  infos: ['**Bilgi:** migration yok'],
};

const errCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof CheckError, 'CheckError beklenirdi: ' + err);
    return (err as CheckError).code;
  }
  assert.fail('hata beklenirdi');
};

test('kimlik: yalnızca küçük harf, rakam ve tire', () => {
  for (const ok of ['a', 'a1', 'siparis-aktar', 'x-1-y', 'a'.repeat(64)]) assert.ok(isId(ok), ok);
  for (const bad of ['', 'A', 'a_b', '-a', 'a-', 'a/b', '../x', '..', 'a.b', 'a b', 'ş', 'a'.repeat(65), 'a\u0000', null, 3])
    assert.ok(!isId(bad), String(bad));
});

test('şema: geçerli konu, eksik ve hatalı alanlar', () => {
  const v = validateInput(TOPIC);
  assert.equal(v.tests!.length, 2);
  assert.equal(errCode(() => validateInput({ ...TOPIC, id: '../../etc' })), 'invalid');
  assert.equal(errCode(() => validateInput({ ...TOPIC, name: '' })), 'invalid');
  assert.equal(errCode(() => validateInput({ ...TOPIC, tests: [{ id: 't1', t: 'x' }, { id: 't1', t: 'y' }] })), 'invalid');
  assert.equal(errCode(() => validateInput({ ...TOPIC, decisions: [{ id: 'k1', t: 'x', o: ['tek'] }] })), 'invalid');
  assert.equal(errCode(() => validateInput({ ...TOPIC, tests: [{ id: 'T1', t: 'x' }] })), 'invalid');
  assert.equal(errCode(() => validateInput({ ...TOPIC, lead: 'x'.repeat(5000) })), 'invalid');
  assert.equal(errCode(() => validateInput('metin')), 'invalid');
});

test('şema: adres yalnızca uygulama yolu ya da http(s)', () => {
  assert.equal(checkUrl('/admin/x?a=1#2'), '/admin/x?a=1#2');
  assert.equal(checkUrl('https://localhost:4000/a'), 'https://localhost:4000/a');
  for (const bad of ['javascript:alert(1)', '//evil.example/x', 'data:text/html,x', 'admin/x', '/a b', '/a\nb', 'file:///etc/passwd'])
    assert.equal(errCode(() => checkUrl(bad)), 'invalid', bad);
});

test('kaydet: dosya open/<id>.json, v:1, createdBy, geçici dosya kalmaz', () => {
  const s = store();
  const r = s.save(TOPIC);
  assert.equal(r.created, true);
  const file = path.join(s.root, '.panoptent', 'checks', 'open', 'siparis-aktar.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(json.v, 1);
  assert.equal(json.createdBy, 'Ayşe');
  assert.deepEqual(json.tests[0].result, { state: 'none' });
  assert.equal(json.decisions[0].pick, null);
  assert.ok(fs.readFileSync(file, 'utf8').endsWith('\n'));
  const names = fs.readdirSync(path.dirname(file)).concat(fs.readdirSync(path.join(s.root, '.panoptent', 'checks')));
  assert.ok(!names.some((n) => /\.(tmp|lock)$/.test(n)), names.join(','));
  // klasör commit edilebilir: yalnızca kilit ve geçici dosyalar yok sayılır
  const gi = fs.readFileSync(path.join(s.root, '.panoptent', 'checks', '.gitignore'), 'utf8');
  assert.match(gi, /\*\.lock/);
  assert.doesNotMatch(gi, /\*\.json|^\*$/m);
  assert.equal(s.rel('open', 'siparis-aktar'), '.panoptent/checks/open/siparis-aktar.json');
});

test('sonuç ve karar: by / at yazılır, not korunur, hatalar', () => {
  const s = store();
  s.save(TOPIC);
  let t = s.setResult('siparis-aktar', 't2', 'bad', 'liste boş değil');
  assert.equal(t.tests[1].result.state, 'bad');
  assert.equal(t.tests[1].result.note, 'liste boş değil');
  assert.equal(t.tests[1].result.by, 'Ayşe');
  assert.ok(t.tests[1].result.at);
  t = s.setResult('siparis-aktar', 't2', 'bad'); // not verilmedi: eski not kalır
  assert.equal(t.tests[1].result.note, 'liste boş değil');
  t = s.setResult('siparis-aktar', 't1', 'ok');
  assert.equal(t.tests[0].result.state, 'ok');
  assert.equal(errCode(() => s.setResult('siparis-aktar', 't1', 'done')), 'invalid');
  assert.equal(errCode(() => s.setResult('siparis-aktar', 't9', 'ok')), 'notFound');
  assert.equal(errCode(() => s.setResult('yok', 't1', 'ok')), 'notFound');
  assert.equal(errCode(() => s.setResult('../x', 't1', 'ok')), 'invalid');
  assert.equal(errCode(() => s.setResult('siparis-aktar', '../t1', 'ok')), 'invalid');
  t = s.setPick('siparis-aktar', 'k1', 1);
  assert.deepEqual({ index: t.decisions[0].pick!.index, option: t.decisions[0].pick!.option, by: t.decisions[0].pick!.by }, { index: 1, option: 'Noktalı virgül: Excel TR doğrudan açar', by: 'Ayşe' });
  assert.equal(errCode(() => s.setPick('siparis-aktar', 'k1', 2)), 'invalid');
  assert.equal(errCode(() => s.setPick('siparis-aktar', 'k1', '1')), 'invalid');
  assert.equal(errCode(() => s.setPick('siparis-aktar', 'k1', -1)), 'invalid');
  const c = summarize(t);
  assert.deepEqual(c, { tests: 2, ok: 1, bad: 1, untested: 0, decisions: 1, decided: 1, pending: 0, complete: false });
});

test('güncelleme: sonuçlar kimlikle korunur, retest sıfırlar, seçim seçenek metniyle taşınır', () => {
  const s = store();
  s.save(TOPIC);
  s.setResult('siparis-aktar', 't1', 'ok');
  s.setResult('siparis-aktar', 't2', 'bad', 'hata');
  s.setPick('siparis-aktar', 'k1', 1);
  // ajan seçenekleri yeniden sıraladı, t2'yi düzeltip yeniden denetlenmesini istedi
  const upd = {
    ...TOPIC,
    tests: [...TOPIC.tests, { id: 't3', t: 'Yeni adım' }],
    decisions: [{ id: 'k1', t: 'Ayraç', o: ['Virgül (bugünkü durum)', 'Sekme', 'Noktalı virgül: Excel TR doğrudan açar'] }],
  };
  let t = s.save(upd, { retest: ['t2'] }).topic;
  assert.equal(t.tests[0].result.state, 'ok');
  assert.equal(t.tests[1].result.state, 'none');
  assert.equal(t.tests[2].result.state, 'none');
  assert.equal(t.decisions[0].pick!.index, 2);
  // seçilen seçenek kalktı: seçim düşer (yanlış seçeneğe kaymaz)
  t = s.save({ ...TOPIC, decisions: [{ id: 'k1', t: 'Ayraç', o: ['Virgül (bugünkü durum)', 'Sekme'] }] }).topic;
  assert.equal(t.decisions[0].pick, null);
  assert.equal(errCode(() => s.save(TOPIC, { retest: ['t9'] })), 'invalid');
});

test('ileri uyum: dosyadaki bilinmeyen alanlar korunur', () => {
  const s = store();
  s.save(TOPIC);
  const file = s.file('open', 'siparis-aktar');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  j.steps = [['1', 'Model', 'done']];
  j.tests[0].needs = 'Yayın DB';
  j.tests[0].result.device = 'iPad';
  j.decisions[0].owner = 'ürün';
  fs.writeFileSync(file, JSON.stringify(j));
  s.setResult('siparis-aktar', 't2', 'ok');
  s.save({ ...TOPIC, lead: 'Güncellendi' });
  const k = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(k.steps, [['1', 'Model', 'done']]);
  assert.equal(k.tests[0].needs, 'Yayın DB');
  assert.equal(k.tests[0].result.device, 'iPad');
  assert.equal(k.decisions[0].owner, 'ürün');
  assert.equal(k.lead, 'Güncellendi');
});

test('kapat / yeniden aç: arşive taşınır, silinmez; kapalı konuya yazılmaz', () => {
  const s = store();
  s.save(TOPIC);
  const closed = s.close('siparis-aktar');
  assert.equal(closed.closedBy, 'Ayşe');
  assert.ok(!fs.existsSync(s.file('open', 'siparis-aktar')));
  const arch = JSON.parse(fs.readFileSync(s.file('archive', 'siparis-aktar'), 'utf8'));
  assert.ok(arch.closedAt);
  assert.equal(s.get('siparis-aktar')!.place, 'archive');
  assert.equal(errCode(() => s.setResult('siparis-aktar', 't1', 'ok')), 'conflict');
  assert.equal(errCode(() => s.close('siparis-aktar')), 'conflict');
  assert.equal(errCode(() => s.save(TOPIC)), 'conflict'); // eski kayıt ezilmesin
  assert.equal(s.list('open').topics.length, 0);
  assert.equal(s.list('archive').topics.length, 1);
  const re = s.reopen('siparis-aktar');
  assert.equal(re.closedAt, undefined);
  assert.equal(re.reopenedBy, 'Ayşe');
  assert.ok(fs.existsSync(s.file('open', 'siparis-aktar')));
  assert.ok(!fs.existsSync(s.file('archive', 'siparis-aktar')));
  assert.equal(errCode(() => s.reopen('siparis-aktar')), 'conflict');
  s.close('siparis-aktar');
  const r = s.save(TOPIC, { reopen: true });
  assert.equal(r.reopened, true);
  assert.equal(s.get('siparis-aktar')!.place, 'open');
});

test('yalnız değişenler: son okumadan sonra işaretlenenler ve kapatılanlar', () => {
  const s = store();
  s.save(TOPIC);
  s.save({ ...TOPIC, id: 'ikinci', name: 'İkinci' });
  const first = s.changes(); // ilk okuma: henüz işaret yok
  assert.equal(first.topics.length, 0);
  s.setResult('siparis-aktar', 't1', 'ok');
  s.setPick('ikinci', 'k1', 0);
  const c = s.changes();
  assert.equal(c.since, first.cursor);
  assert.deepEqual(c.topics.map((x) => x.id).sort(), ['ikinci', 'siparis-aktar']);
  const sa = c.topics.find((x) => x.id === 'siparis-aktar')!;
  assert.deepEqual(sa.tests.map((x) => [x.id, x.result.state, x.result.by]), [['t1', 'ok', 'Ayşe']]);
  assert.equal(c.topics.find((x) => x.id === 'ikinci')!.decisions[0].option, 'Virgül (bugünkü durum)');
  assert.equal(s.changes().topics.length, 0); // tekrar sorunca boş
  s.close('ikinci');
  const d = s.changes();
  assert.deepEqual(d.topics.map((x) => [x.id, x.place]), [['ikinci', 'archive']]);
  // açık imleç: eski bir imleçten beri olanlar yeniden gelir
  assert.equal(s.changes(first.cursor, false).topics.length, 2);
  assert.equal(errCode(() => s.changes('dün')), 'invalid');
});

test('yol güvenliği: kimlikten yol çıkmaz, dış klasöre bağ ve sembolik dosya reddedilir', () => {
  const s = store();
  assert.equal(errCode(() => s.file('open', '../../etc/passwd')), 'invalid');
  assert.equal(errCode(() => s.file('open', '..')), 'invalid');
  assert.equal(errCode(() => s.get('../x')), 'invalid');
  // .panoptent/checks/open proje dışını gösteren bir sembolik bağ
  const root = tmpRoot();
  const outside = tmpRoot();
  fs.mkdirSync(path.join(root, '.panoptent', 'checks'), { recursive: true });
  fs.symlinkSync(outside, path.join(root, '.panoptent', 'checks', 'open'));
  const s2 = store(root);
  assert.equal(errCode(() => s2.save(TOPIC)), 'unsafe');
  assert.deepEqual(fs.readdirSync(outside), []);
  // konu dosyası sembolik bağ: okunmaz / üstüne yazılmaz
  const root3 = tmpRoot();
  const s3 = store(root3);
  s3.save({ ...TOPIC, id: 'baska' });
  const target = path.join(tmpRoot(), 'hedef.json');
  fs.writeFileSync(target, JSON.stringify({ v: 1, id: 'siparis-aktar', name: 'x' }));
  fs.symlinkSync(target, s3.file('open', 'siparis-aktar'));
  assert.equal(errCode(() => s3.setResult('siparis-aktar', 't1', 'ok')), 'unsafe');
  assert.equal(JSON.parse(fs.readFileSync(target, 'utf8')).name, 'x');
});

test('okuma: bozuk / büyük / adı uymayan dosyalar listeyi düşürmez, hata olarak raporlanır', () => {
  const s = store();
  s.save(TOPIC);
  const dir = path.join(s.root, '.panoptent', 'checks', 'open');
  fs.writeFileSync(path.join(dir, 'bozuk.json'), '{ "v": 1, ');
  fs.writeFileSync(path.join(dir, 'Kotu_Ad.json'), '{}');
  fs.writeFileSync(path.join(dir, 'uyusmaz.json'), JSON.stringify({ v: 1, id: 'baska', name: 'x' }));
  fs.writeFileSync(path.join(dir, 'yeni-surum.json'), JSON.stringify({ v: 2, id: 'yeni-surum', name: 'x' }));
  fs.writeFileSync(path.join(dir, 'buyuk.json'), JSON.stringify({ v: 1, id: 'buyuk', name: 'x'.repeat(600 * 1024) }));
  const r = s.list('open');
  assert.deepEqual(r.topics.map((x) => x.id), ['siparis-aktar']);
  assert.equal(r.errors.length, 5);
  assert.ok(r.errors.every((e) => e.file.startsWith('.panoptent/checks/open/')));
  // eksik alanlar tamamlanır
  const t = readTopic({ id: 'az', tests: [{ id: 't1' }, { id: 'KÖTÜ' }], decisions: [{ id: 'k1', o: ['a', 'b'], pick: { index: 7 } }] }, 'az');
  assert.equal(t.tests.length, 1);
  assert.deepEqual(t.tests[0].result, { state: 'none' });
  assert.equal(t.decisions[0].pick, null);
});

test('kilit: takılı kalmış kilit kaldırılır, taze kilit "busy" verir', () => {
  const root = tmpRoot();
  const s = new ChecksStore(root, { who: () => 'A', now: tick, lockWait: 100 });
  s.save(TOPIC);
  const lock = path.join(root, '.panoptent', 'checks', 'siparis-aktar.lock');
  fs.writeFileSync(lock, '999');
  assert.equal(errCode(() => s.setResult('siparis-aktar', 't1', 'ok')), 'busy');
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(lock, old, old);
  s.setResult('siparis-aktar', 't1', 'ok');
  assert.ok(!fs.existsSync(lock));
});

test('eşzamanlı yazma: ayrı süreçler farklı alanları yazınca hiçbiri kaybolmaz', async () => {
  const root = tmpRoot();
  const s = store(root);
  const tests = Array.from({ length: 6 }, (_, i) => ({ id: 't' + i, t: 'Adım ' + i }));
  s.save({ ...TOPIC, tests });
  const worker = path.join(__dirname, 'checks.worker.js');
  const runs = tests.map(
    (x, i) =>
      new Promise<number>((resolve) => {
        const p = spawn(process.execPath, [worker, root, 'siparis-aktar', x.id, String(i % 2 ? 'bad' : 'ok'), '25'], { stdio: 'inherit' });
        p.on('exit', (code) => resolve(code ?? 1));
      }),
  );
  // aynı anda ajan da konuyu güncelliyor
  for (let i = 0; i < 10; i++) s.save({ ...TOPIC, tests, lead: 'tur ' + i });
  assert.deepEqual(await Promise.all(runs), tests.map(() => 0));
  const final = s.get('siparis-aktar')!.topic;
  assert.equal(final.lead, 'tur 9');
  final.tests.forEach((x, i) => {
    assert.equal(x.result.state, i % 2 ? 'bad' : 'ok', x.id);
    assert.equal(x.result.note, i % 2 ? 'not 24' : undefined, x.id);
  });
  const names = fs.readdirSync(path.join(root, '.panoptent', 'checks', 'open')).concat(fs.readdirSync(path.join(root, '.panoptent', 'checks')));
  assert.ok(!names.some((n) => /\.(tmp|lock)$/.test(n)), names.join(','));
});

test('belgedeki örnek dosya geçerli bir konu', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'checks.example.json'), 'utf8'));
  const t = readTopic(raw, 'order-export');
  assert.deepEqual(summarize(t), { tests: 2, ok: 0, bad: 1, untested: 1, decisions: 1, decided: 1, pending: 1, complete: false });
  validateInput(raw); // ajanın gönderdiği biçim olarak da geçerli
});

test('ad: e-posta yazılmaz, satır sonu ve boşluk temizlenir', () => {
  assert.equal(cleanName('Ada Lovelace <ada@example.com>'), 'Ada Lovelace');
  assert.equal(cleanName('ada@example.com'), 'ada');
  assert.equal(cleanName('a\nb'), 'a b');
  assert.equal(cleanName(''), 'unknown');
});

/** Sahte komut çalıştırıcı: çağrıları kaydeder; `answers` anahtarı "komut argümanlar". */
function fakeRun(answers: Record<string, string | undefined>) {
  const calls: string[] = [];
  const run = (cmd: string, args: string[]) => {
    const k = [cmd, ...args].join(' ');
    calls.push(k);
    return answers[k];
  };
  return { calls, run, runAsync: async (cmd: string, args: string[]) => run(cmd, args) };
}
const GH = 'gh api user -q .login';
const GHU = 'git config github.user';
const GUN = 'git config user.name';

test('ad kaynağı: ayar → gh → git github.user → git user.name → işletim sistemi', () => {
  let setting = 'ayar-adi';
  const f = fakeRun({ [GH]: 'gh-login', [GHU]: 'gitgh', [GUN]: 'Git Adı' });
  const r = new UserResolver('/x', { setting: () => setting, run: f.run });
  assert.deepEqual(r.resolve(), { name: 'ayar-adi', source: 'setting' });
  assert.deepEqual(f.calls, [], 'ayar varken hiçbir komut çalışmaz');
  setting = '';
  assert.deepEqual(r.resolve(), { name: 'gh-login', source: 'github-cli' });
  assert.deepEqual(new UserResolver('/x', { run: fakeRun({ [GHU]: 'gitgh', [GUN]: 'Git Adı' }).run }).resolve(), { name: 'gitgh', source: 'git-github-user' });
  assert.deepEqual(new UserResolver('/x', { run: fakeRun({ [GUN]: 'Git Adı' }).run }).resolve(), { name: 'Git Adı', source: 'git-user-name' });
  const last = new UserResolver('/x', { run: fakeRun({}).run }).resolve();
  assert.equal(last.source, 'os');
  assert.ok(last.name && !last.name.includes('@'));
});

test('ad kaynağı: gh oturum boyunca bir kez sorulur; gh yokken / bozuk çıktıda geri düşer; origin kullanılmaz', async () => {
  const f = fakeRun({ [GH]: 'ceritli-test' });
  const r = new UserResolver('/x', { run: f.run });
  for (let i = 0; i < 5; i++) assert.equal(r.name(), 'ceritli-test');
  assert.equal(f.calls.filter((c) => c === GH).length, 1, 'her yazmada süreç başlatılmaz');
  // gh kurulu değil / oturum yok (komut başarısız): bir kez denenir, sonra git'e düşülür
  const g = fakeRun({ [GUN]: 'Yerel Ad' });
  const r2 = new UserResolver('/x', { run: g.run });
  assert.deepEqual(r2.resolve(), { name: 'Yerel Ad', source: 'git-user-name' });
  r2.resolve();
  assert.equal(g.calls.filter((c) => c === GH).length, 1);
  assert.ok(!g.calls.some((c) => /remote|origin/.test(c)), 'depo origin adresinden çıkarım yapılmaz');
  // gh'nin hata metni ya da e-posta gibi geçersiz çıktısı kullanıcı adı sayılmaz
  assert.equal(new UserResolver('/x', { run: fakeRun({ [GH]: 'error: not logged in', [GUN]: 'B' }).run }).resolve().source, 'git-user-name');
  assert.equal(new UserResolver('/x', { run: fakeRun({ [GH]: 'a@b.c', [GHU]: 'x@y.z', [GUN]: 'ada@example.com' }).run }).resolve().name, 'ada');
  // ayardaki e-posta da kesilir
  assert.equal(new UserResolver('/x', { setting: () => 'ada@example.com', run: f.run }).resolve().name, 'ada');
  // arka planda ısıtma: sonra senkron çağrıda gh yeniden çalışmaz; ayar varken hiç çalışmaz
  const h = fakeRun({ [GH]: 'isinan' });
  const r3 = new UserResolver('/x', { run: h.run, runAsync: h.runAsync });
  assert.equal(r3.known(), undefined, 'gh beklenmeden bilinmiyor');
  await r3.warm();
  assert.deepEqual(r3.known(), { name: 'isinan', source: 'github-cli' });
  assert.equal(h.calls.filter((c) => c === GH).length, 1);
  const k = fakeRun({ [GH]: 'x' });
  await new UserResolver('/x', { setting: () => 'elle', run: k.run, runAsync: k.runAsync }).warm();
  assert.deepEqual(k.calls, []);
});

test('ad: gerçek git ile (gh kapalı) user.name kullanılır, e-posta dosyaya girmez', () => {
  const root = tmpRoot();
  const env = { ...process.env, HOME: root, GIT_CONFIG_GLOBAL: path.join(root, 'yok'), GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...a: string[]) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', env });
  if (git('init', '-q').status !== 0) return; // git yoksa geç
  git('config', 'user.name', 'Deneme Kişi');
  git('config', 'user.email', 'deneme@example.com');
  const run = (cmd: string, args: string[], cwd: string) => {
    if (cmd === 'gh') return undefined;
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env });
    return r.status === 0 ? r.stdout.trim() || undefined : undefined;
  };
  const users = new UserResolver(root, { run });
  assert.deepEqual(users.resolve(), { name: 'Deneme Kişi', source: 'git-user-name' });
  git('config', 'github.user', 'deneme-gh');
  assert.equal(users.name(), 'Deneme Kişi', 'oturum önbelleği');
  users.reset();
  assert.deepEqual(users.resolve(), { name: 'deneme-gh', source: 'git-github-user' });
  const s = new ChecksStore(root, { now: tick, who: () => users.name() });
  s.save(TOPIC);
  s.setResult('siparis-aktar', 't1', 'ok');
  const raw = fs.readFileSync(s.file('open', 'siparis-aktar'), 'utf8');
  assert.match(raw, /"createdBy": "deneme-gh"/);
  assert.match(raw, /"by": "deneme-gh"/);
  assert.doesNotMatch(raw, /@example\.com/);
  assert.equal(typeof whoAmI, 'function');
});
