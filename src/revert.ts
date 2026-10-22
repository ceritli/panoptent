// Panoptent'in YALNIZCA kendi yaptığı değişiklikleri geri alma.
//
// Her "Uygula" bir kimlik (PE-xxxx) taşır. Claude Code her konuşmayı
// ~/.claude/projects/<proje>/<oturum>.jsonl dosyasına yazar ve her Edit/Write için
// değişikliğin tam yamasını (structuredPatch) saklar. Bu modül, kimliğin geçtiği
// kullanıcı mesajından sonraki (bir sonraki kullanıcı mesajına kadar) dosya
// değişikliklerini bulur ve yamaları TERSİNE uygular. Böylece kullanıcının ya da
// sonraki konuşmaların yaptığı değişikliklere dokunulmaz.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/** Geri alınabilir tek bir dosya değişikliği. */
export type RevOp =
  | { kind: 'patch'; file: string; hunks: Hunk[]; source: string }
  | { kind: 'create'; file: string; content: string; source: string }
  | { kind: 'strings'; file: string; oldStr: string; newStr: string; replaceAll?: boolean; line?: number; source: string }
  | { kind: 'image'; file: string; size: number; source: string };

export interface ApplyRecord {
  id: string; // PE-xxxx
  label: string; // saat
  time: number;
  ops: RevOp[]; // Panoptent'in kendisinin yaptıkları (doğrudan metin, görsel)
  cliOps: RevOp[]; // CLI akışından yakalananlar (transkript bulunamazsa yedek)
  sentToClaude: boolean;
}

export function newApplyId(): string {
  return 'PT-' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);
}

// ---------- Claude Code transkriptleri ----------

function projectsDir(): string {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
}

function transcriptDirs(root: string): string[] {
  const base = projectsDir();
  const enc = root.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  try {
    return fs
      .readdirSync(base)
      .filter((d) => d.toLowerCase() === enc)
      .map((d) => path.join(base, d));
  } catch {
    return [];
  }
}

function listJsonl(dir: string, since: number, depth = 0): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name.endsWith('.jsonl')) {
      try {
        if (fs.statSync(p).mtimeMs >= since - 60_000) out.push(p);
      } catch {
        /* yok say */
      }
    } else if (e.isDirectory() && depth < 3) {
      out.push(...listJsonl(p, since, depth + 1)); // alt ajan transkriptleri
    }
  }
  return out;
}

function contentText(msg: any): { text: string; isToolResult: boolean } {
  const c = msg?.message?.content;
  if (typeof c === 'string') return { text: c, isToolResult: false };
  if (Array.isArray(c)) {
    const isToolResult = c.length > 0 && c.every((x: any) => x?.type === 'tool_result');
    const text = c
      .map((x: any) => (x?.type === 'text' ? x.text : x?.type === 'tool_result' ? '' : ''))
      .join('\n');
    return { text, isToolResult };
  }
  return { text: '', isToolResult: false };
}

export interface TranscriptResult {
  found: boolean;
  ops: RevOp[];
  bashCount: number; // terminal komutları (geri alınamaz)
  pending: boolean; // Claude henüz bir şey yazmamış olabilir
}

/** Kimliğin geçtiği isteğe ait dosya değişikliklerini transkriptlerden çıkarır. */
export function opsFromTranscripts(root: string, id: string, since: number): TranscriptResult {
  const res: TranscriptResult = { found: false, ops: [], bashCount: 0, pending: false };
  for (const dir of transcriptDirs(root)) {
    for (const file of listJsonl(dir, since)) {
      let raw: string;
      try {
        raw = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      if (!raw.includes(id)) continue;
      const lines = raw.split('\n');
      const isSub = file.includes(`${path.sep}subagents${path.sep}`);
      let inside = isSub; // alt ajan dosyasında kimlik geçiyorsa tamamı o isteğe ait
      const okIds = new Set<string>();
      const results: { id: string; tur: any }[] = [];
      for (const ln of lines) {
        if (!ln.trim()) continue;
        let d: any;
        try {
          d = JSON.parse(ln);
        } catch {
          continue;
        }
        if (d.type === 'user' && !d.isSidechain && !d.isMeta) {
          const { text, isToolResult } = contentText(d);
          if (!isToolResult) {
            if (text.includes(id)) {
              inside = true;
              res.found = true;
              continue;
            } else if (inside && !isSub && text.trim()) {
              inside = false; // sonraki gerçek kullanıcı mesajı: bu isteğin kapsamı bitti
            }
          }
        }
        if (!inside) continue;
        if (isSub) res.found = true;
        const c = d.message?.content;
        if (d.type === 'assistant' && Array.isArray(c)) {
          for (const x of c) if (x?.type === 'tool_use' && x.name === 'Bash') res.bashCount++;
        }
        if (d.type === 'user' && Array.isArray(c)) {
          for (const x of c) {
            if (x?.type === 'tool_result' && !x.is_error) okIds.add(x.tool_use_id);
            if (x?.type === 'tool_result' && d.toolUseResult) results.push({ id: x.tool_use_id, tur: d.toolUseResult });
          }
        }
      }
      for (const r of results) {
        if (!okIds.has(r.id)) continue;
        const op = opFromToolResult(r.tur);
        if (op) res.ops.push(op);
      }
    }
  }
  res.pending = res.found && !res.ops.length;
  return res;
}

function opFromToolResult(t: any): RevOp | undefined {
  if (!t || typeof t !== 'object' || !t.filePath) return undefined;
  const file = String(t.filePath);
  if (t.type === 'create' || (t.originalFile === null && typeof t.content === 'string')) {
    return { kind: 'create', file, content: String(t.content ?? ''), source: 'claude' };
  }
  if (Array.isArray(t.structuredPatch) && t.structuredPatch.length) {
    return { kind: 'patch', file, hunks: t.structuredPatch, source: 'claude' };
  }
  if (typeof t.oldString === 'string' && typeof t.newString === 'string') {
    return { kind: 'strings', file, oldStr: t.oldString, newStr: t.newString, replaceAll: !!t.replaceAll, source: 'claude' };
  }
  return undefined;
}

// ---------- Tersine uygulama ----------

export interface RevertOutcome {
  changed: Map<string, string>; // dosya -> yeni içerik (yazılacak)
  deleted: string[];
  conflicts: { file: string; reason: string }[];
  count: number; // geri alınan değişiklik sayısı
}

function splitKeep(s: string): { lines: string[]; eol: string; trailing: boolean } {
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const trailing = s.endsWith('\n');
  const body = trailing ? s.slice(0, s.endsWith('\r\n') ? -2 : -1) : s;
  return { lines: body.length ? body.split(/\r?\n/) : [], eol, trailing };
}

function findBlock(hay: string[], needle: string[], expected: number): number {
  if (!needle.length) return Math.max(0, Math.min(expected, hay.length));
  const hits: number[] = [];
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    hits.push(i);
  }
  if (!hits.length) return -1;
  return hits.reduce((a, b) => (Math.abs(b - expected) < Math.abs(a - expected) ? b : a));
}

function reversePatch(content: string, hunks: Hunk[]): string | undefined {
  const { lines, eol, trailing } = splitKeep(content);
  // sondan başa: önceki hunk'ların satır numaraları kaymasın
  for (let h = hunks.length - 1; h >= 0; h--) {
    const hk = hunks[h];
    const body = hk.lines.filter((l) => !l.startsWith('\\'));
    const newOf = (b: string[]) => b.filter((l) => l[0] !== '-').map((l) => l.slice(1));
    const oldOf = (b: string[]) => b.filter((l) => l[0] !== '+').map((l) => l.slice(1));

    // 1) Bağlam satırlarıyla birlikte birebir eşleşme
    const full = newOf(body);
    let at = findBlock(lines, full, hk.newStart - 1);
    if (at >= 0) {
      lines.splice(at, full.length, ...oldOf(body));
      continue;
    }

    // 2) Bağlam satırları sonradan değişmiş olabilir: yalnızca değişen çekirdeği eşleştir
    const first = body.findIndex((l) => l[0] === '+' || l[0] === '-');
    let last = -1;
    for (let i = body.length - 1; i >= 0; i--) if (body[i][0] === '+' || body[i][0] === '-') { last = i; break; }
    if (first < 0) continue; // değişiklik yok
    const core = body.slice(first, last + 1);
    const coreNew = newOf(core);
    const coreOld = oldOf(core);
    const ctxBefore = body.slice(0, first).length;
    const expected = hk.newStart - 1 + ctxBefore;

    if (coreNew.length) {
      at = findBlock(lines, coreNew, expected);
      if (at < 0) return undefined;
      lines.splice(at, coreNew.length, ...coreOld);
      continue;
    }

    // 3) Saf silme (Claude satır silmiş): komşu bağlam satırlarına göre yerini bul
    const before = first > 0 ? body[first - 1].slice(1) : undefined;
    const after = last + 1 < body.length ? body[last + 1].slice(1) : undefined;
    const cands: number[] = [];
    for (let k = 0; k <= lines.length; k++) {
      const okB = before === undefined || lines[k - 1] === before;
      const okA = after === undefined || lines[k] === after;
      if (okB && okA && (before !== undefined || after !== undefined)) cands.push(k);
    }
    if (!cands.length) return undefined;
    const ins = cands.reduce((x, y) => (Math.abs(y - expected) < Math.abs(x - expected) ? y : x));
    lines.splice(ins, 0, ...coreOld);
  }
  return lines.join(eol) + (trailing || !lines.length ? eol : '');
}

function reverseStrings(content: string, op: Extract<RevOp, { kind: 'strings' }>): string | undefined {
  const { oldStr, newStr } = op;
  if (!newStr) return undefined; // silme işlemi: yer bilinmeden geri konamaz
  if (op.replaceAll) return content.includes(newStr) ? content.split(newStr).join(oldStr) : undefined;
  const idx: number[] = [];
  for (let i = content.indexOf(newStr); i !== -1 && idx.length < 50; i = content.indexOf(newStr, i + 1)) idx.push(i);
  if (!idx.length) return undefined;
  let pick = idx[0];
  if (idx.length > 1) {
    if (!op.line) return undefined;
    const lineStart = (n: number) => content.split('\n').slice(0, n - 1).join('\n').length;
    const target = lineStart(op.line);
    pick = idx.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
  }
  return content.slice(0, pick) + oldStr + content.slice(pick + newStr.length);
}

/**
 * İşlemleri (kronolojik sırayla verilmiş) sondan başa tersine uygular.
 * `isDirty`: editörde kaydedilmemiş değişikliği olan dosyalar çakışma sayılır.
 */
export function planRevert(ops: RevOp[], isDirty: (file: string) => boolean): RevertOutcome {
  const out: RevertOutcome = { changed: new Map(), deleted: [], conflicts: [], count: 0 };
  const current = (f: string): string | undefined => {
    if (out.changed.has(f)) return out.changed.get(f);
    if (out.deleted.includes(f)) return undefined;
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      return undefined;
    }
  };
  const failed = new Set<string>();
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (failed.has(op.file)) continue; // bir dosyada çakışma varsa o dosyaya dokunma
    if (isDirty(op.file)) {
      out.conflicts.push({ file: op.file, reason: 'editörde kaydedilmemiş değişiklik var' });
      failed.add(op.file);
      continue;
    }
    const cur = current(op.file);
    if (op.kind === 'image') {
      try {
        if (cur !== undefined && fs.statSync(op.file).size === op.size) {
          out.deleted.push(op.file);
          out.changed.delete(op.file);
          out.count++;
        }
      } catch {
        /* zaten yok */
      }
      continue;
    }
    if (cur === undefined) {
      out.conflicts.push({ file: op.file, reason: 'dosya artık yok' });
      failed.add(op.file);
      continue;
    }
    if (op.kind === 'create') {
      if (cur === op.content) {
        out.deleted.push(op.file);
        out.changed.delete(op.file);
        out.count++;
      } else {
        out.conflicts.push({ file: op.file, reason: 'Claude’un oluşturduğu dosya sonradan değiştirilmiş' });
        failed.add(op.file);
      }
      continue;
    }
    const next = op.kind === 'patch' ? reversePatch(cur, op.hunks) : reverseStrings(cur, op);
    if (next === undefined) {
      out.conflicts.push({ file: op.file, reason: 'değiştirilen satırlar sonradan yeniden düzenlenmiş' });
      failed.add(op.file);
      out.changed.delete(op.file);
      continue;
    }
    out.changed.set(op.file, next);
    out.count++;
  }
  for (const f of failed) out.changed.delete(f);
  out.count = ops.filter((o) => !failed.has(o.file) && (out.changed.has(o.file) || out.deleted.includes(o.file))).length;
  return out;
}
