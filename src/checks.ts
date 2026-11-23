// Test ve Karar: ajanın iş bitince yazdığı "ne denenecek, neye karar verilecek" konuları.
// Konu başına bir JSON dosyası: <proje>/.panoptent/checks/open/<id>.json (açık) ve .../archive/<id>.json
// (kapatılanlar, silinmez). Dosyalar git'e girebilir; içinde e-posta, şifre ya da jeton tutulmaz.
// vscode modülüne bağımlı değildir: VS Code motoru, MCP araçları ve HTTP uçları aynı deposu kullanır,
// ayrıca düz Node ile test edilebilir.
//
// Eşzamanlı yazma: her işlem tek bir alanı değiştirir (bir testin sonucu, bir kararın seçimi) ve dosyayı
// kilit altında diskten yeniden okuyup yazar (alan düzeyinde birleştirme). Ajanın konuyu güncellemesi de
// diskteki güncel sonuçları korur. Yazma atomiktir (geçici dosya + yeniden adlandırma).

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile, spawnSync } from 'child_process';
import { randomBytes } from 'crypto';

export const CHECKS_DIR = path.join('.panoptent', 'checks');
export const SCHEMA_VERSION = 1;

export type TestState = 'none' | 'ok' | 'bad';
export type Place = 'open' | 'archive';

export interface CheckResult {
  state: TestState;
  note?: string;
  by?: string;
  at?: string;
  [k: string]: unknown;
}
export interface CheckTest {
  id: string;
  t: string;
  url?: string;
  d?: string;
  e?: string;
  agent?: boolean;
  result: CheckResult;
  [k: string]: unknown;
}
export interface CheckPick {
  index: number;
  /** Seçilen seçeneğin metni: ajan seçenekleri yeniden sıralarsa seçim kaybolmasın. */
  option?: string;
  by?: string;
  at?: string;
  [k: string]: unknown;
}
export interface CheckDecision {
  id: string;
  t: string;
  o: string[];
  pick: CheckPick | null;
  [k: string]: unknown;
}
export interface CheckTopic {
  v: number;
  id: string;
  name: string;
  date: string;
  lead: string;
  tests: CheckTest[];
  decisions: CheckDecision[];
  infos: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  [k: string]: unknown;
}

export interface CheckCounts {
  tests: number;
  ok: number;
  bad: number;
  /** Kullanıcının henüz bakmadığı testler. */
  untested: number;
  decisions: number;
  decided: number;
  /** Kullanıcıdan beklenen: bakılmamış testler + seçilmemiş kararlar. */
  pending: number;
  /** Bütün testler tamam ve bütün kararlar verilmiş: ajan konuyu kapatabilir. */
  complete: boolean;
}

export type CheckErrorCode = 'invalid' | 'notFound' | 'conflict' | 'unsafe' | 'busy';

export class CheckError extends Error {
  constructor(message: string, readonly code: CheckErrorCode) {
    super(message);
  }
}

/** Sınırlar: dosyalar küçük kalsın, sayfaya ve ajana giden metin taşmasın. */
export const LIMITS = {
  id: 64,
  name: 200,
  date: 40,
  lead: 4000,
  title: 300,
  text: 4000,
  url: 2000,
  note: 4000,
  options: 12,
  option: 1000,
  tests: 200,
  decisions: 100,
  infos: 100,
  info: 4000,
  fileBytes: 512 * 1024,
};

const ID_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Konu / test / karar kimliği: küçük harf, rakam, tire (başta ve sonda tire yok). */
export function isId(v: unknown): v is string {
  return typeof v === 'string' && v.length <= LIMITS.id && ID_RE.test(v);
}

function assertId(v: unknown, what: string): string {
  if (!isId(v)) throw new CheckError(`${what} must use only lowercase letters, digits and dashes (max ${LIMITS.id}): ${JSON.stringify(v)}`, 'invalid');
  return v;
}

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

function str(v: unknown, what: string, max: number, required = false): string | undefined {
  if (v === undefined || v === null || v === '') {
    if (required) throw new CheckError(`${what} is required`, 'invalid');
    return undefined;
  }
  if (typeof v !== 'string') throw new CheckError(`${what} must be text`, 'invalid');
  const s = v.trim();
  if (required && !s) throw new CheckError(`${what} is required`, 'invalid');
  if (s.length > max) throw new CheckError(`${what} is longer than ${max} characters`, 'invalid');
  return s;
}

/**
 * Adımın adresi: uygulama içi yol (`/admin/x?id=3#12`) ya da http(s) adresi. `javascript:` gibi
 * şemalar ve satır sonu reddedilir.
 */
export function checkUrl(v: unknown): string | undefined {
  const s = str(v, 'url', LIMITS.url);
  if (!s) return undefined;
  if (/[\u0000-\u001f\u007f\s]/.test(s)) throw new CheckError('url must not contain spaces or control characters', 'invalid');
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^https?:\/\/[^/]/i.test(s)) return s;
  throw new CheckError('url must be an app path starting with "/" or an http(s) address', 'invalid');
}

/** Yalnızca bilinen alanları sıraya koyar, bilinmeyenleri (ileri uyum) arkaya ekler. */
function ordered<T extends Record<string, unknown>>(known: Record<string, unknown>, extra: Record<string, unknown> | undefined): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(known)) if (v !== undefined) out[k] = v;
  if (extra) for (const [k, v] of Object.entries(extra)) if (!(k in known) && v !== undefined) out[k] = v;
  return out as T;
}

const TEST_KEYS = ['id', 't', 'url', 'd', 'e', 'agent', 'result'];
const DEC_KEYS = ['id', 't', 'o', 'pick'];

function uniqueIds(list: { id: string }[], what: string) {
  const seen = new Set<string>();
  for (const x of list) {
    if (seen.has(x.id)) throw new CheckError(`duplicate ${what} id "${x.id}"`, 'invalid');
    seen.add(x.id);
  }
}

/** Ajanın gönderdiği konu tanımı (sonuçlar ve seçimler hariç): sıkı doğrulama. */
export interface TopicInput {
  id: string;
  name: string;
  date?: string;
  lead?: string;
  tests?: { id: string; t: string; url?: string; d?: string; e?: string; agent?: boolean; [k: string]: unknown }[];
  decisions?: { id: string; t: string; o: string[]; [k: string]: unknown }[];
  infos?: string[];
  [k: string]: unknown;
}

export function validateInput(raw: unknown): TopicInput {
  if (!isObj(raw)) throw new CheckError('topic must be an object', 'invalid');
  const id = assertId(raw.id, 'topic id');
  const name = str(raw.name, 'name', LIMITS.name, true)!;
  const date = str(raw.date, 'date', LIMITS.date);
  const lead = str(raw.lead, 'lead', LIMITS.lead);
  const tests = raw.tests === undefined ? [] : raw.tests;
  const decisions = raw.decisions === undefined ? [] : raw.decisions;
  const infos = raw.infos === undefined ? [] : raw.infos;
  if (!Array.isArray(tests) || tests.length > LIMITS.tests) throw new CheckError(`tests must be a list of at most ${LIMITS.tests}`, 'invalid');
  if (!Array.isArray(decisions) || decisions.length > LIMITS.decisions) throw new CheckError(`decisions must be a list of at most ${LIMITS.decisions}`, 'invalid');
  if (!Array.isArray(infos) || infos.length > LIMITS.infos) throw new CheckError(`infos must be a list of at most ${LIMITS.infos}`, 'invalid');
  const outTests = tests.map((x: unknown, i: number) => {
    if (!isObj(x)) throw new CheckError(`tests[${i}] must be an object`, 'invalid');
    return {
      ...x,
      id: assertId(x.id, `tests[${i}].id`),
      t: str(x.t, `tests[${i}].t`, LIMITS.title, true)!,
      url: checkUrl(x.url),
      d: str(x.d, `tests[${i}].d`, LIMITS.text),
      e: str(x.e, `tests[${i}].e`, LIMITS.text),
      agent: x.agent === undefined ? undefined : !!x.agent,
    };
  });
  const outDecs = decisions.map((x: unknown, i: number) => {
    if (!isObj(x)) throw new CheckError(`decisions[${i}] must be an object`, 'invalid');
    if (!Array.isArray(x.o) || x.o.length < 2 || x.o.length > LIMITS.options)
      throw new CheckError(`decisions[${i}].o must list 2 to ${LIMITS.options} options (the first is the current behaviour)`, 'invalid');
    const o = x.o.map((s: unknown, j: number) => str(s, `decisions[${i}].o[${j}]`, LIMITS.option, true)!);
    return { ...x, id: assertId(x.id, `decisions[${i}].id`), t: str(x.t, `decisions[${i}].t`, LIMITS.title, true)!, o };
  });
  uniqueIds(outTests, 'test');
  uniqueIds(outDecs, 'decision');
  const outInfos = infos.map((s: unknown, i: number) => str(s, `infos[${i}]`, LIMITS.info, true)!);
  return { ...raw, id, name, date, lead, tests: outTests, decisions: outDecs, infos: outInfos };
}

const STATES: TestState[] = ['none', 'ok', 'bad'];

/** Diskten okunan dosya: elle ya da git ile değişmiş olabilir; eksikler tamamlanır, bilinmeyenler korunur. */
export function readTopic(raw: unknown, expectId?: string): CheckTopic {
  if (!isObj(raw)) throw new CheckError('file is not a JSON object', 'invalid');
  const v = raw.v === undefined ? SCHEMA_VERSION : Number(raw.v);
  if (v !== SCHEMA_VERSION) throw new CheckError(`unsupported schema version ${raw.v} (this Panoptent reads v${SCHEMA_VERSION})`, 'invalid');
  const id = assertId(raw.id, 'topic id');
  if (expectId && id !== expectId) throw new CheckError(`topic id "${id}" does not match the file name "${expectId}.json"`, 'invalid');
  const s = (x: unknown) => (typeof x === 'string' ? x : x == null ? '' : String(x));
  const tests: CheckTest[] = (Array.isArray(raw.tests) ? raw.tests : []).filter(isObj).filter((x) => isId(x.id)).map((x) => {
    const r = isObj(x.result) ? x.result : {};
    const state = STATES.includes(r.state) ? (r.state as TestState) : 'none';
    return ordered<CheckTest>(
      {
        id: x.id,
        t: s(x.t),
        url: typeof x.url === 'string' && x.url ? x.url : undefined,
        d: typeof x.d === 'string' ? x.d : undefined,
        e: typeof x.e === 'string' ? x.e : undefined,
        agent: x.agent === undefined ? undefined : !!x.agent,
        result: ordered<CheckResult>({ state, note: typeof r.note === 'string' ? r.note : undefined, by: typeof r.by === 'string' ? r.by : undefined, at: typeof r.at === 'string' ? r.at : undefined }, r),
      },
      x,
    );
  });
  const decisions: CheckDecision[] = (Array.isArray(raw.decisions) ? raw.decisions : []).filter(isObj).filter((x) => isId(x.id)).map((x) => {
    const o = (Array.isArray(x.o) ? x.o : []).map(s);
    let pick: CheckPick | null = null;
    if (isObj(x.pick) && Number.isInteger(x.pick.index) && x.pick.index >= 0 && x.pick.index < o.length) {
      const p = x.pick;
      pick = ordered<CheckPick>({ index: p.index, option: typeof p.option === 'string' ? p.option : undefined, by: typeof p.by === 'string' ? p.by : undefined, at: typeof p.at === 'string' ? p.at : undefined }, p);
    }
    return ordered<CheckDecision>({ id: x.id, t: s(x.t), o, pick }, x);
  });
  return ordered<CheckTopic>(
    {
      v: SCHEMA_VERSION,
      id,
      name: s(raw.name) || id,
      date: s(raw.date),
      lead: s(raw.lead),
      tests,
      decisions,
      infos: (Array.isArray(raw.infos) ? raw.infos : []).map(s),
      createdBy: s(raw.createdBy),
      createdAt: s(raw.createdAt),
      updatedAt: s(raw.updatedAt),
      closedAt: typeof raw.closedAt === 'string' ? raw.closedAt : undefined,
      closedBy: typeof raw.closedBy === 'string' ? raw.closedBy : undefined,
    },
    raw,
  );
}

export function summarize(topic: CheckTopic): CheckCounts {
  const ok = topic.tests.filter((x) => x.result.state === 'ok').length;
  const bad = topic.tests.filter((x) => x.result.state === 'bad').length;
  const untested = topic.tests.length - ok - bad;
  const decided = topic.decisions.filter((x) => x.pick).length;
  return {
    tests: topic.tests.length,
    ok,
    bad,
    untested,
    decisions: topic.decisions.length,
    decided,
    pending: untested + topic.decisions.length - decided,
    complete: ok === topic.tests.length && decided === topic.decisions.length,
  };
}

// ---------- Kişi adı (`by`, `createdBy`, `closedBy`, `reopenedBy`) ----------
// Kaynak sırası (ilk bulunan): 1) Panoptent ayarı `panoptent.checks.userName`, 2) GitHub CLI (`gh api user -q .login`),
// 3) `git config github.user`, 4) `git config user.name`, 5) işletim sistemi kullanıcısı. Depo `origin` adresinden
// çıkarım yapılmaz (başka birinin deposu olabilir). E-posta hiçbir durumda yazılmaz. Dış komutlar oturumda bir kez çalışır.

export type NameSource = 'setting' | 'github-cli' | 'git-github-user' | 'git-user-name' | 'os';
export type SyncRunner = (cmd: string, args: string[], cwd: string, timeoutMs: number) => string | undefined;
export type AsyncRunner = (cmd: string, args: string[], cwd: string, timeoutMs: number) => Promise<string | undefined>;

/** gh hiçbir zaman soru sormasın, güncelleme denetlemesin. */
const QUIET_ENV = { GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1', GIT_TERMINAL_PROMPT: '0' };

const runSync: SyncRunner = (cmd, args, cwd, timeoutMs) => {
  try {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs, windowsHide: true, env: { ...process.env, ...QUIET_ENV } });
    if (r.error || r.status !== 0) return undefined;
    return String(r.stdout || '').trim() || undefined;
  } catch {
    return undefined;
  }
};

const runAsync: AsyncRunner = (cmd, args, cwd, timeoutMs) =>
  new Promise((resolve) => {
    try {
      execFile(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs, windowsHide: true, env: { ...process.env, ...QUIET_ENV } }, (err, out) =>
        resolve(err ? undefined : String(out || '').trim() || undefined),
      );
    } catch {
      resolve(undefined);
    }
  });

/** GitHub kullanıcı adı biçimi: harf, rakam, tire; en fazla 39 karakter. */
export const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export interface UserResolverOptions {
  /** Panoptent ayarı (`panoptent.checks.userName`); her çağrıda okunur, önbelleğe alınmaz. */
  setting?: () => string | undefined;
  run?: SyncRunner;
  runAsync?: AsyncRunner;
  /** ms: gh için en uzun bekleme (ağ yoksa takılmasın). */
  ghTimeout?: number;
}

export class UserResolver {
  private gh: string | null | undefined; // undefined: henüz sorulmadı · null: yok
  private local: { name: string; source: NameSource } | undefined;
  private warming?: Promise<void>;

  constructor(readonly root: string, private opts: UserResolverOptions = {}) {}

  private setting(): string {
    try {
      return String(this.opts.setting?.() ?? '').trim();
    } catch {
      return '';
    }
  }

  private static login(v: string | undefined): string | null {
    const s = String(v || '').trim();
    return GITHUB_LOGIN.test(s) ? s : null;
  }

  private askGhSync() {
    if (this.gh !== undefined) return;
    this.gh = UserResolver.login((this.opts.run || runSync)('gh', ['api', 'user', '-q', '.login'], this.root, this.opts.ghTimeout ?? 2500));
  }

  /**
   * gh'yi arka planda bir kez sorar (önbelleği ısıtır); ayar doluysa hiç sormaz. Eklenti, Test ve Karar ilk
   * kullanıldığında çağırır: ilk yazma sırasında beklenmesin.
   */
  warm(): Promise<void> {
    if (this.setting() || this.gh !== undefined) return Promise.resolve();
    if (!this.warming) {
      this.warming = (this.opts.runAsync || runAsync)('gh', ['api', 'user', '-q', '.login'], this.root, this.opts.ghTimeout ?? 4000).then((out) => {
        if (this.gh === undefined) this.gh = UserResolver.login(out);
      });
    }
    return this.warming;
  }

  /** Adı ve nereden geldiğini döndürür. */
  resolve(): { name: string; source: NameSource } {
    const fromSetting = this.setting();
    if (fromSetting && cleanName(fromSetting) !== 'unknown') return { name: cleanName(fromSetting), source: 'setting' };
    this.askGhSync();
    if (this.gh) return { name: this.gh, source: 'github-cli' };
    if (!this.local) {
      const run = this.opts.run || runSync;
      const ghUser = UserResolver.login(run('git', ['config', 'github.user'], this.root, 3000));
      if (ghUser) this.local = { name: ghUser, source: 'git-github-user' };
      else {
        const gitName = cleanName(run('git', ['config', 'user.name'], this.root, 3000) || '');
        if (gitName !== 'unknown') this.local = { name: gitName, source: 'git-user-name' };
        else {
          let osName = '';
          try {
            osName = os.userInfo().username;
          } catch {
            /* yok */
          }
          this.local = { name: cleanName(osName), source: 'os' };
        }
      }
    }
    return this.local;
  }

  name(): string {
    return this.resolve().name;
  }

  /** gh'yi beklemeden bilinen ad (görünümler için); gh henüz sorulmadıysa `undefined` ve arka planda sorulur. */
  known(): { name: string; source: NameSource } | undefined {
    if (this.setting() || this.gh !== undefined) return this.resolve();
    void this.warm();
    return undefined;
  }

  /** Önbelleği boşalt (ör. kullanıcı gh'ye yeni giriş yaptıysa). */
  reset() {
    this.gh = undefined;
    this.local = undefined;
    this.warming = undefined;
  }
}

const defaultResolvers = new Map<string, UserResolver>();
function defaultResolver(root: string) {
  let r = defaultResolvers.get(root);
  if (!r) defaultResolvers.set(root, (r = new UserResolver(root)));
  return r;
}

/** Ayarsız varsayılan ad (gh → git github.user → git user.name → işletim sistemi). */
export function whoAmI(root: string): string {
  return defaultResolver(path.resolve(root)).name();
}

/** Ad e-posta gibi görünürse yalnızca @ öncesi kalır; satır sonları ve aşırı uzunluk temizlenir. */
export function cleanName(v: string): string {
  let s = String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  s = s.replace(/<[^>]*@[^>]*>/g, '').trim(); // "Ad <e@posta>"
  if (s.includes('@')) s = s.split('@')[0];
  return s.slice(0, 80).trim() || 'unknown';
}

const sleepBuf = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms: number) {
  Atomics.wait(sleepBuf, 0, 0, ms);
}

export interface StoreOptions {
  who?: () => string;
  now?: () => Date;
  /** ms: başka bir yazıcının kilidini bekleme süresi. */
  lockWait?: number;
}

export interface ChangeSet {
  since: string | null;
  cursor: string;
  topics: {
    id: string;
    name: string;
    place: Place;
    counts: CheckCounts;
    tests: (Pick<CheckTest, 'id' | 't'> & { result: CheckResult })[];
    decisions: { id: string; t: string; pick: CheckPick | null; option?: string }[];
    closedAt?: string;
    closedBy?: string;
  }[];
}

export class ChecksStore {
  readonly root: string;
  readonly dir: string;
  /** Ajanın son okuması (get_checks / get_check_changes): "yalnız değişenler" için varsayılan başlangıç. */
  lastRead: string | null = null;

  constructor(root: string, private opts: StoreOptions = {}) {
    this.root = path.resolve(root);
    this.dir = path.join(this.root, CHECKS_DIR);
  }

  who(): string {
    return cleanName(this.opts.who ? this.opts.who() : whoAmI(this.root));
  }

  private nowIso(): string {
    return (this.opts.now ? this.opts.now() : new Date()).toISOString();
  }

  private placeDir(place: Place) {
    return path.join(this.dir, place);
  }

  /** Konu dosyasının yolu; kimlik doğrulanır, yol klasör dışına çıkamaz. */
  file(place: Place, id: string): string {
    assertId(id, 'topic id');
    const dir = this.placeDir(place);
    const p = path.resolve(dir, id + '.json');
    if (path.dirname(p) !== dir) throw new CheckError('path escapes the checks folder', 'unsafe');
    return p;
  }

  /** Projeye göre yol (rapor ve "dosyayı aç" için). */
  rel(place: Place, id: string): string {
    return path.relative(this.root, this.file(place, id)).split(path.sep).join('/');
  }

  /**
   * Yazmadan önce: klasörleri oluşturur ve gerçek yolun (sembolik bağlar çözülmüş) çalışma klasörünün
   * içinde kaldığını doğrular. Kilit ve geçici dosyalar için küçük bir .gitignore koyar (veriler commit edilebilir).
   */
  private ensureDirs() {
    for (const place of ['open', 'archive'] as Place[]) fs.mkdirSync(this.placeDir(place), { recursive: true });
    const realRoot = fs.realpathSync(this.root);
    for (const d of [this.dir, this.placeDir('open'), this.placeDir('archive')]) {
      const real = fs.realpathSync(d);
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new CheckError(`${path.relative(this.root, d)} points outside the workspace`, 'unsafe');
    }
    const ignore = path.join(this.dir, '.gitignore');
    if (!fs.existsSync(ignore)) {
      try {
        fs.writeFileSync(ignore, '# Panoptent: only lock and temp files are ignored; topic files are meant to be committed\n*.lock\n*.tmp\n');
      } catch {
        /* yok say */
      }
    }
  }

  private readFile(p: string, id: string): CheckTopic | undefined {
    let st: fs.Stats;
    try {
      st = fs.lstatSync(p);
    } catch {
      return undefined;
    }
    if (!st.isFile()) throw new CheckError(`${path.basename(p)} is not a regular file`, 'unsafe');
    if (st.size > LIMITS.fileBytes) throw new CheckError(`${path.basename(p)} is larger than ${LIMITS.fileBytes} bytes`, 'invalid');
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (err: any) {
      throw new CheckError(`${path.basename(p)}: invalid JSON (${err.message})`, 'invalid');
    }
    return readTopic(raw, id);
  }

  /** Atomik yazma: aynı klasörde geçici dosya, sonra yeniden adlandırma. Sembolik bağın üstüne yazılmaz. */
  private writeFile(p: string, topic: CheckTopic) {
    try {
      if (fs.lstatSync(p).isSymbolicLink()) throw new CheckError(`${path.basename(p)} is a symbolic link; refusing to write`, 'unsafe');
    } catch (err) {
      if (err instanceof CheckError) throw err;
    }
    const tmp = `${p}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(topic, null, 2) + '\n', { flag: 'wx' });
      fs.renameSync(tmp, p);
    } catch (err) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* yok say */
      }
      throw err;
    }
  }

  /** Konu başına kilit (aynı projeyi açan başka bir VS Code penceresi ya da HTTP istemcisi için). */
  private withLock<T>(id: string, fn: () => T): T {
    this.ensureDirs();
    const lock = path.join(this.dir, id + '.lock');
    const wait = this.opts.lockWait ?? 3000;
    const start = Date.now();
    for (;;) {
      try {
        fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
        break;
      } catch (err: any) {
        if (err.code !== 'EEXIST') throw err;
        try {
          // takılı kalmış (çöken süreç) kilit: 10 sn'den eskiyse kaldır
          if (Date.now() - fs.statSync(lock).mtimeMs > 10000) fs.rmSync(lock, { force: true });
        } catch {
          /* bu arada kalktı */
        }
        if (Date.now() - start > wait) throw new CheckError(`topic "${id}" is being written by another process; try again`, 'busy');
        sleepSync(15);
      }
    }
    try {
      return fn();
    } finally {
      try {
        fs.rmSync(lock, { force: true });
      } catch {
        /* yok say */
      }
    }
  }

  /** Konunun bulunduğu yer ve güncel hali (diskten). */
  get(id: string): { topic: CheckTopic; place: Place } | undefined {
    for (const place of ['open', 'archive'] as Place[]) {
      const t = this.readFile(this.file(place, id), id);
      if (t) return { topic: t, place };
    }
    return undefined;
  }

  list(which: Place | 'all' = 'open'): { topics: (CheckTopic & { place: Place })[]; errors: { file: string; error: string }[] } {
    const topics: (CheckTopic & { place: Place })[] = [];
    const errors: { file: string; error: string }[] = [];
    const places: Place[] = which === 'all' ? ['open', 'archive'] : [which];
    for (const place of places) {
      let names: string[] = [];
      try {
        names = fs.readdirSync(this.placeDir(place));
      } catch {
        continue;
      }
      for (const n of names.sort()) {
        if (!n.endsWith('.json')) continue;
        const id = n.slice(0, -5);
        const rel = path.join(CHECKS_DIR, place, n).split(path.sep).join('/');
        if (!isId(id)) {
          errors.push({ file: rel, error: 'file name is not a valid topic id' });
          continue;
        }
        try {
          const t = this.readFile(this.file(place, id), id);
          if (t) topics.push(Object.assign(t, { place }));
        } catch (err: any) {
          errors.push({ file: rel, error: err.message });
        }
      }
    }
    // en yeni konu önce
    topics.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || a.id.localeCompare(b.id));
    return { topics, errors };
  }

  /**
   * Konu ekle / güncelle (ajan). Tanımlar gelen haliyle değişir; kullanıcının sonuçları ve seçimleri
   * kimlik üzerinden korunur. `retest`: ajan bir sorunu düzeltti, bu testler yeniden "bakılmadı" olur.
   * Arşivdeki bir kimlik `reopen` olmadan kullanılamaz (eski kayıt ezilmesin).
   */
  save(raw: unknown, opts: { retest?: string[]; reopen?: boolean } = {}): { topic: CheckTopic; created: boolean; reopened: boolean } {
    const input = validateInput(raw);
    const retest = new Set((opts.retest || []).map((x) => assertId(x, 'retest id')));
    for (const r of retest) if (!input.tests!.some((x) => x.id === r)) throw new CheckError(`retest: there is no test "${r}" in the topic`, 'invalid');
    return this.withLock(input.id, () => {
      const openPath = this.file('open', input.id);
      let prev = this.readFile(openPath, input.id);
      let reopened = false;
      const archPath = this.file('archive', input.id);
      if (!prev) {
        const arch = this.readFile(archPath, input.id);
        if (arch && !opts.reopen)
          throw new CheckError(`topic "${input.id}" is archived (closed ${arch.closedAt || ''}). Use a new id, or pass reopen: true to reopen and update it.`, 'conflict');
        if (arch) {
          prev = arch;
          reopened = true;
        }
      }
      const now = this.nowIso();
      const who = this.who();
      const prevTests = new Map((prev?.tests || []).map((x) => [x.id, x]));
      const prevDecs = new Map((prev?.decisions || []).map((x) => [x.id, x]));
      const tests: CheckTest[] = input.tests!.map((x) => {
        const old = prevTests.get(x.id);
        const result: CheckResult = retest.has(x.id) || !old ? (retest.has(x.id) ? { state: 'none', by: who, at: now } : { state: 'none' }) : old.result;
        return ordered<CheckTest>({ id: x.id, t: x.t, url: x.url, d: x.d, e: x.e, agent: x.agent, result }, { ...(old || {}), ...x });
      });
      const decisions: CheckDecision[] = input.decisions!.map((x) => {
        const old = prevDecs.get(x.id);
        let pick: CheckPick | null = null;
        if (old?.pick) {
          const text = old.pick.option ?? old.o[old.pick.index];
          const idx = text !== undefined ? x.o.indexOf(text) : -1;
          if (idx >= 0) pick = { ...old.pick, index: idx, option: x.o[idx] };
        }
        return ordered<CheckDecision>({ id: x.id, t: x.t, o: x.o, pick }, { ...(old || {}), ...x });
      });
      const known = { tests: 1, decisions: 1, infos: 1 };
      const extra: Record<string, unknown> = { ...(prev || {}) };
      for (const [k, v] of Object.entries(input)) if (!(k in known)) extra[k] = v;
      delete extra.place;
      if (reopened) {
        delete extra.closedAt;
        delete extra.closedBy;
      }
      const topic = ordered<CheckTopic>(
        {
          v: SCHEMA_VERSION,
          id: input.id,
          name: input.name,
          date: input.date ?? prev?.date ?? now.slice(0, 10),
          lead: input.lead ?? prev?.lead ?? '',
          tests,
          decisions,
          infos: input.infos!,
          createdBy: prev?.createdBy || who,
          createdAt: prev?.createdAt || now,
          updatedAt: now,
          closedAt: undefined,
          closedBy: undefined,
          reopenedAt: reopened ? now : prev?.reopenedAt,
          reopenedBy: reopened ? who : prev?.reopenedBy,
        },
        extra,
      );
      this.writeFile(openPath, topic);
      if (reopened) fs.rmSync(archPath, { force: true });
      return { topic, created: !prev, reopened };
    });
  }

  /** Açık bir konuyu kilit altında okuyup tek alanını değiştirir. */
  private update(id: string, fn: (t: CheckTopic) => void): CheckTopic {
    assertId(id, 'topic id');
    return this.withLock(id, () => {
      const p = this.file('open', id);
      const topic = this.readFile(p, id);
      if (!topic) {
        if (this.readFile(this.file('archive', id), id)) throw new CheckError(`topic "${id}" is closed (archived); reopen it first`, 'conflict');
        throw new CheckError(`there is no open topic "${id}"`, 'notFound');
      }
      fn(topic);
      topic.updatedAt = this.nowIso();
      this.writeFile(p, topic);
      return topic;
    });
  }

  /** Kullanıcı bir testi işaretledi: "tamam", "sorun" (notla) ya da "bakılmadı". `note` verilmezse eski not kalır. */
  setResult(topicId: string, testId: string, state: string, note?: string): CheckTopic {
    assertId(testId, 'test id');
    if (!STATES.includes(state as TestState)) throw new CheckError('state must be "none", "ok" or "bad"', 'invalid');
    const n = note === undefined ? undefined : str(note, 'note', LIMITS.note) || '';
    return this.update(topicId, (t) => {
      const test = t.tests.find((x) => x.id === testId);
      if (!test) throw new CheckError(`there is no test "${testId}" in topic "${topicId}"`, 'notFound');
      const keep = n === undefined ? test.result.note : n;
      test.result = ordered<CheckResult>({ state: state as TestState, note: keep || undefined, by: this.who(), at: this.nowIso() }, test.result);
      if (!keep) delete test.result.note;
    });
  }

  /** Kullanıcı bir karar seçti (seçenek sırası). */
  setPick(topicId: string, decisionId: string, index: unknown): CheckTopic {
    assertId(decisionId, 'decision id');
    return this.update(topicId, (t) => {
      const dec = t.decisions.find((x) => x.id === decisionId);
      if (!dec) throw new CheckError(`there is no decision "${decisionId}" in topic "${topicId}"`, 'notFound');
      if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= dec.o.length)
        throw new CheckError(`index must be an option number from 0 to ${dec.o.length - 1}`, 'invalid');
      const i = index as number;
      dec.pick = ordered<CheckPick>({ index: i, option: dec.o[i], by: this.who(), at: this.nowIso() }, undefined);
    });
  }

  /** Konuyu kapatır: open → archive (silinmez). */
  close(id: string): CheckTopic {
    assertId(id, 'topic id');
    return this.withLock(id, () => {
      const from = this.file('open', id);
      const topic = this.readFile(from, id);
      if (!topic) {
        if (this.readFile(this.file('archive', id), id)) throw new CheckError(`topic "${id}" is already closed`, 'conflict');
        throw new CheckError(`there is no open topic "${id}"`, 'notFound');
      }
      const now = this.nowIso();
      topic.closedAt = now;
      topic.closedBy = this.who();
      topic.updatedAt = now;
      this.writeFile(this.file('archive', id), topic);
      fs.rmSync(from, { force: true });
      return topic;
    });
  }

  /** Arşivdeki konuyu yeniden açar: archive → open. */
  reopen(id: string): CheckTopic {
    assertId(id, 'topic id');
    return this.withLock(id, () => {
      const from = this.file('archive', id);
      const topic = this.readFile(from, id);
      if (!topic) {
        if (this.readFile(this.file('open', id), id)) throw new CheckError(`topic "${id}" is already open`, 'conflict');
        throw new CheckError(`there is no archived topic "${id}"`, 'notFound');
      }
      const now = this.nowIso();
      delete topic.closedAt;
      delete topic.closedBy;
      topic.reopenedAt = now;
      topic.reopenedBy = this.who();
      topic.updatedAt = now;
      this.writeFile(this.file('open', id), topic);
      fs.rmSync(from, { force: true });
      return topic;
    });
  }

  /** Ajan bütün konuları okudu: "yalnız değişenler" bundan sonrasını verir. */
  markRead(): string {
    this.lastRead = this.nowIso();
    return this.lastRead;
  }

  /**
   * `since` (ISO zaman) sonrasında kullanıcının işaretledikleri ve seçtikleri; verilmezse ajanın son
   * okumasından beri. Kapatılan konular da (kapanış zamanıyla) listelenir. `mark`: bu okumayı "son okuma" say.
   */
  changes(since?: string | null, mark = true): ChangeSet {
    const from = since === undefined ? this.lastRead : since;
    if (from && isNaN(Date.parse(from))) throw new CheckError('since must be an ISO date-time (the cursor from an earlier call)', 'invalid');
    const cursor = this.nowIso();
    const after = (at?: string) => !!at && (!from || at > from);
    const out: ChangeSet = { since: from || null, cursor, topics: [] };
    for (const t of this.list('all').topics) {
      const tests = t.tests.filter((x) => after(x.result.at)).map((x) => ({ id: x.id, t: x.t, result: x.result }));
      const decisions = t.decisions.filter((x) => after(x.pick?.at)).map((x) => ({ id: x.id, t: x.t, pick: x.pick, option: x.pick ? x.o[x.pick.index] : undefined }));
      const closed = t.place === 'archive' && after(t.closedAt);
      if (!tests.length && !decisions.length && !closed) continue;
      out.topics.push({ id: t.id, name: t.name, place: t.place, counts: summarize(t), tests, decisions, closedAt: t.closedAt, closedBy: t.closedBy });
    }
    if (mark) this.lastRead = cursor;
    return out;
  }
}
