// Panoptent motoru: kuyruğu uygulama, Claude'a aktarma, geri alma, kaynak açma.
// VS Code önizleme paneli ve Chrome köprüsü aynı motoru kullanır.

import * as vscode from 'vscode';
import { uiLang, normLang, addStrings, t } from './i18n';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeRunner } from './claude';
import { resolveFile, openAt, quickEditText } from './source';
import { claudeExtensionInstalled, openInClaudePanel, cliOnPath, findBundledClaude, sendToOpenConversation } from './claudePanel';
import { Entry, SelectedItem, buildBatchPrompt, saveImage } from './entries';
import { ApplyRecord, RevOp, newApplyId, opsFromTranscripts, planRevert } from './revert';
import { LiveHub } from './live';

addStrings({
  en: {
    'ext.fileNotFound': 'File not found: {0}',
    'ext.srcUnknown': 'Source file unknown.',
    'ext.nothingToApply': 'No changes to apply.',
    'ext.busy': 'Claude is still running the previous job.',
    'ext.noClaudeExt': 'Claude Code VS Code extension not found. Install it, or switch “Send to” to background (CLI).',
    'ext.log.direct': 'Written directly: {0} — “{1}” → “{2}”',
    'ext.log.imgSaved': 'Image saved: {0}',
    'ext.log.imgFailed': 'Could not save image: {0}',
    'ext.log.prompt': '──── Prompt ────',
    'ext.log.appendFailed': 'Could not add to the open conversation: {0}',
    'ext.log.bundled': '"claude" is not on PATH; using the copy bundled with the extension: {0}',
    'ext.log.error': 'ERROR: {0}',
    'ext.panelFailed': 'Could not open the Claude Code panel.',
    'ext.claudeFailed': 'Claude could not finish the job.',
    'ext.rb.none': 'There is no apply to undo.',
    'ext.rb.notRun': 'Claude Code does not seem to have run this request yet (did you press Enter in the panel?). There are no changes to undo.',
    'ext.rb.noChanges': 'No file changes to undo were found for this apply.',
    'ext.rb.removeRecord': 'Remove record',
    'ext.rb.cancel': 'Cancel',
    'ext.rb.deletedLine': '(created by Panoptent/Claude, will be moved to trash)',
    'ext.rb.detailOne': 'Only the change made by Panoptent and Claude in this apply will be undone. Your own changes and later conversations are left untouched.',
    'ext.rb.detailMany': 'Only the {0} changes made by Panoptent and Claude in this apply will be undone. Your own changes and later conversations are left untouched.',
    'ext.rb.more': '… and {0} more file(s)',
    'ext.rb.conflicts': 'Cannot be undone (these files will not be touched):',
    'ext.rb.bash': 'Note: Claude ran {0} terminal command(s) in this request; changes made from the terminal cannot be tracked and will not be undone.',
    'ext.rb.cannot': 'The apply from {0} could not be undone.',
    'ext.rb.cannotMsg': 'Could not undo: the changed lines were edited afterwards.',
    'ext.rb.confirm': 'Undo the apply from {0}?',
    'ext.rb.undo': 'Undo',
    'ext.rb.failed': 'Undo failed: {0}',
    'ext.mcp.applyLine': 'Apply the Panoptent change set {0}: get it with the Panoptent MCP tool get_apply (id {0}), make the edits, then call mark_applied with the same id.',
    'ext.mcp.markDone': 'When you are done, call the Panoptent MCP tool mark_applied with id {0}.',
    'ext.mcp.directOnly': 'Panoptent wrote the {0} text change(s) directly; there is nothing left to edit.',
    'ext.mcp.log.done': 'Claude finished {0} (via MCP)',
    'ext.live.on': 'Live: a Claude Code session is listening (/panoptent live); Apply goes straight to it.',
    'ext.live.off': 'Live: no Claude Code session is listening any more.',
  },
  tr: {
    'ext.fileNotFound': 'Dosya bulunamadı: {0}',
    'ext.srcUnknown': 'Kaynak dosya bilinmiyor.',
    'ext.nothingToApply': 'Uygulanacak değişiklik yok.',
    'ext.busy': 'Claude hâlâ önceki işi çalıştırıyor.',
    'ext.noClaudeExt': 'Claude Code VS Code eklentisi bulunamadı. Kur ya da gönderme yerini "Burada çalıştır" yap.',
    'ext.log.direct': 'Doğrudan yazıldı: {0} — “{1}” → “{2}”',
    'ext.log.imgSaved': 'Görsel kaydedildi: {0}',
    'ext.log.imgFailed': 'Görsel kaydedilemedi: {0}',
    'ext.log.prompt': '──── İstem ────',
    'ext.log.appendFailed': 'Açık konuşmaya eklenemedi: {0}',
    'ext.log.bundled': '"claude" PATH\'te yok, eklentideki kopya kullanılıyor: {0}',
    'ext.log.error': 'HATA: {0}',
    'ext.panelFailed': 'Claude Code paneli açılamadı.',
    'ext.claudeFailed': t('ext.claudeFailed'),
    'ext.rb.none': 'Geri alınacak bir uygulama yok.',
    'ext.rb.notRun': 'Claude Code bu isteği henüz çalıştırmamış görünüyor (panelde Enter’a bastın mı?). Geri alınacak bir değişiklik yok.',
    'ext.rb.noChanges': 'Bu uygulamada geri alınacak bir dosya değişikliği bulunamadı.',
    'ext.rb.removeRecord': 'Kaydı kaldır',
    'ext.rb.cancel': 'Vazgeç',
    'ext.rb.deletedLine': '(Panoptent/Claude oluşturmuştu, çöpe taşınır)',
    'ext.rb.detailOne': 'Yalnızca bu uygulamada Panoptent\'in ve Claude\'un yaptığı 1 değişiklik geri alınır. Senin ve sonraki konuşmaların değişikliklerine dokunulmaz.',
    'ext.rb.detailMany': 'Yalnızca bu uygulamada Panoptent\'in ve Claude\'un yaptığı {0} değişiklik geri alınır. Senin ve sonraki konuşmaların değişikliklerine dokunulmaz.',
    'ext.rb.more': '… ve {0} dosya daha',
    'ext.rb.conflicts': 'Geri alınamayacaklar (bu dosyalara dokunulmayacak):',
    'ext.rb.bash': 'Not: Claude bu istekte {0} terminal komutu çalıştırdı; terminalle yapılan değişiklikler izlenemediği için geri alınmaz.',
    'ext.rb.cannot': 'Saat {0} uygulaması geri alınamadı.',
    'ext.rb.cannotMsg': 'Geri alınamadı: değişen satırlar sonradan düzenlenmiş.',
    'ext.rb.confirm': 'Saat {0} uygulaması geri alınsın mı?',
    'ext.rb.undo': 'Geri al',
    'ext.rb.failed': 'Geri alma başarısız: {0}',
    'ext.mcp.applyLine': 'Panoptent değişiklik paketi {0}’i uygula: Panoptent MCP aracı get_apply ile al (id {0}), düzenlemeleri yap, sonra aynı id ile mark_applied çağır.',
    'ext.mcp.markDone': 'İşin bitince Panoptent MCP aracı mark_applied’ı {0} kimliğiyle çağır.',
    'ext.mcp.directOnly': 'Panoptent {0} metin değişikliğini doğrudan yazdı; düzenlenecek başka bir şey kalmadı.',
    'ext.mcp.log.done': 'Claude {0} işini bitirdi (MCP üzerinden)',
    'ext.live.on': 'Canlı: bir Claude Code oturumu dinliyor (/panoptent live); Uygula doğrudan ona gidiyor.',
    'ext.live.off': 'Canlı: dinleyen Claude Code oturumu kalmadı.',
  },
});

export type Listener = (msg: any, to?: string) => void;

/** Bir önizleme sayfasının (VS Code paneli ya da Chrome sekmesi) son bildirilen seçimi ve kuyruğu. MCP sunucusu bunu okur. */
export interface PageState {
  client: string;
  via: 'vscode' | 'chrome';
  pageUrl: string;
  viewport: string;
  items: SelectedItem[];
  queue: Entry[];
  at: number;
}

export class Engine {
  runner = new ClaudeRunner();
  /** `/panoptent live`: dinleyen Claude Code oturumuna doğrudan teslim */
  readonly live = new LiveHub();
  sessionId?: string;
  private listeners = new Set<Listener>();
  private watcher: vscode.FileSystemWatcher;
  private changed = new Set<string>();
  private changeTimer?: NodeJS.Timeout;
  private pages = new Map<string, PageState>();

  constructor(
    public readonly context: vscode.ExtensionContext,
    public readonly root: string,
    public readonly output: vscode.OutputChannel,
  ) {
    this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(root, '**/*'));
    const onChange = (u: vscode.Uri) => {
      const rel = path.relative(this.root, u.fsPath);
      if (/(^|[\\/])(node_modules|\.git|\.next|\.nuxt|\.output|dist|build|bin|obj|\.vs|\.claude)([\\/]|$)/.test(rel)) return;
      this.changed.add(rel);
      clearTimeout(this.changeTimer);
      this.changeTimer = setTimeout(() => {
        this.emit({ type: 'filesChanged', files: [...this.changed] });
        this.changed.clear();
      }, 700);
    };
    this.watcher.onDidChange(onChange);
    this.watcher.onDidCreate(onChange);
    this.live.onChange((on) => {
      this.output.appendLine(t(on ? 'ext.live.on' : 'ext.live.off'));
      this.emit({ type: 'live', on });
    });
  }

  on(l: Listener): vscode.Disposable {
    this.listeners.add(l);
    return { dispose: () => this.listeners.delete(l) };
  }

  /** `to` verilirse yalnızca o istemciye (panel / chrome sekmesi), verilmezse herkese. */
  emit(msg: any, to?: string) {
    for (const l of this.listeners) {
      try {
        l(msg, to);
      } catch {
        /* yok say */
      }
    }
  }

  cfg() {
    return vscode.workspace.getConfiguration('panoptent');
  }

  dispose() {
    this.live.dispose();
    this.runner.stop();
    this.watcher.dispose();
    clearTimeout(this.changeTimer);
  }

  settings() {
    return {
      sendTo: this.sendTo(),
      openOnSelect: this.cfg().get<boolean>('openSourceOnSelect') !== false,
      claudeExt: claudeExtensionInstalled(),
      canRollback: this.canRollback(),
      lang: uiLang(),
      design: this.designState(),
    };
  }

  /**
   * Tasarım kuralları dosyası (göreli yol). `panoptent.designFile`: boş = otomatik
   * (design.md / DESIGN.md / docs/design.md), "off" = kapalı, aksi hâlde seçilen dosya.
   */
  designFile(): string | undefined {
    const v = (this.cfg().get<string>('designFile') || '').trim();
    if (v === 'off') return undefined;
    const has = (rel: string) => {
      try {
        return fs.statSync(path.join(this.root, rel)).isFile();
      } catch {
        return false;
      }
    };
    if (v) return has(v) ? v.split(path.sep).join('/') : undefined;
    return ['design.md', 'DESIGN.md', 'Design.md', 'docs/design.md', 'docs/DESIGN.md'].find(has);
  }

  designState() {
    const v = (this.cfg().get<string>('designFile') || '').trim();
    const file = this.designFile() || null;
    return { mode: v === 'off' ? 'off' : v ? 'file' : 'auto', setting: v, file, missing: !!v && v !== 'off' && !file };
  }

  /** Panel / Chrome seçim ve kuyruk değiştikçe son halini bildirir (`syncState`). */
  syncPage(client: string, via: PageState['via'], m: any) {
    if (m.closed) {
      this.pages.delete(client);
      return;
    }
    this.pages.set(client, {
      client,
      via,
      pageUrl: String(m.pageUrl || ''),
      viewport: String(m.viewport || 'full'),
      items: Array.isArray(m.items) ? m.items : [],
      queue: Array.isArray(m.queue) ? m.queue : [],
      at: Date.now(),
    });
  }

  /** Kapanan panel ya da kopan Chrome bağlantısının sayfalarını unutur (`prefix` ile başlayan istemciler). */
  dropPages(prefix: string) {
    for (const k of [...this.pages.keys()]) if (k === prefix || k.startsWith(prefix)) this.pages.delete(k);
  }

  /** Bilinen sayfalar, en son güncellenen önce. */
  pageStates(): PageState[] {
    return [...this.pages.values()].sort((a, b) => b.at - a.at);
  }

  /** Change the UI language (writes the `panoptent.language` setting; the config listener broadcasts it). */
  async setLang(v: string) {
    const value = v === 'auto' ? 'auto' : normLang(v);
    await this.cfg().update('language', value, vscode.ConfigurationTarget.Global);
  }

  async setSendTo(v: string) {
    const value = v === 'cli' || v === 'mcp' ? v : 'claudePanel';
    await this.cfg().update('sendTo', value, vscode.ConfigurationTarget.Global);
    this.emit({ type: 'sendTo', value: this.sendTo() });
  }

  async setOpenOnSelect(v: boolean) {
    await this.cfg().update('openSourceOnSelect', !!v, vscode.ConfigurationTarget.Global);
    this.emit({ type: 'openOnSelect', value: !!v });
  }

  async openSource(item: SelectedItem, quiet: boolean) {
    if (!item?.source) return;
    const uri = await resolveFile(this.root, item.source.file);
    if (!uri) {
      if (!quiet) vscode.window.showWarningMessage(t('ext.fileNotFound', item.source.file));
      return;
    }
    await openAt(uri, item.source.line, item.source.col, quiet);
  }

  async openFile(file: string) {
    const uri = await resolveFile(this.root, file);
    if (uri) await openAt(uri, 1, 1);
  }

  async quickEdit(item: SelectedItem, newText: string, client?: string) {
    const fail = (message: string) => this.emit({ type: 'quickEditResult', id: item.id, ok: false, message }, client);
    if (!item.source) return fail(t('ext.srcUnknown'));
    const uri = await resolveFile(this.root, item.source.file);
    if (!uri) return fail(t('ext.fileNotFound', item.source.file));
    try {
      const r = await quickEditText(uri, item.source.line, item.fullText || item.text, newText);
      this.emit({ type: 'quickEditResult', id: item.id, ok: r.ok, message: r.message, newText }, client);
    } catch (err: any) {
      fail(err.message);
    }
  }

  newSession() {
    this.sessionId = undefined;
    this.emit({ type: 'session', sessionId: null });
  }

  /** Öğeye bağlı olmayan bir talimatı (ör. kurulum) normal gönderme yolundan yollar. */
  async sendInstruction(prompt: string, label: string) {
    this.emit({ type: 'note', text: label });
    await this.applyEntries([{ token: 'ins' + Date.now(), kind: 'prompt', text: prompt, items: [], raw: true }], '', false, false);
  }

  sendTo(): 'claudePanel' | 'cli' | 'mcp' {
    const v = this.cfg().get<string>('sendTo');
    return v === 'cli' || v === 'mcp' ? v : 'claudePanel';
  }

  /** MCP modunda Claude'un `get_apply` ile alacağı değişiklik paketleri (PT kimliğine göre). */
  private mcpApplies = new Map<string, { prompt: string; client?: string; tokens: string[] }>();

  mcpApplyPrompt(id: string): string | undefined {
    return this.mcpApplies.get(id)?.prompt;
  }

  /**
   * Claude işini bitirdiğini bildirir. `id`: Uygula/istem ile gelen paket (kuyruk zaten boşaltıldı).
   * `tokens`: Claude'un kuyruktan doğrudan uyguladığı girdiler; ilgili sayfanın kuyruğundan düşülür.
   */
  mcpMarkApplied(id?: string, tokens?: string[]): number {
    let n = 0;
    if (id && this.mcpApplies.delete(id)) {
      this.output.appendLine(t('ext.mcp.log.done', id));
      n++;
    }
    if (tokens?.length) {
      for (const p of this.pages.values()) {
        const hit = p.queue.filter((e) => tokens.includes(e.token)).map((e) => e.token);
        if (!hit.length) continue;
        p.queue = p.queue.filter((e) => !hit.includes(e.token));
        this.emit({ type: 'applied', ok: true, tokens: hit, fromQueue: true, sent: hit.length, canRollback: this.canRollback() }, p.client);
        n += hit.length;
      }
    }
    return n;
  }

  /** MCP istemi (`apply_queue`): en son sayfanın kuyruğunu uygular ve Claude'a gidecek istemi döndürür. */
  async mcpApplyQueue(): Promise<string | undefined> {
    const p = this.pageStates().find((x) => x.queue.length);
    if (!p) return undefined;
    const queue = p.queue;
    p.queue = []; // sayfa yeni durumu bildirene kadar aynı kuyruk ikinci kez alınmasın
    return this.applyEntries(queue, p.pageUrl, false, true, p.client, true);
  }

  records: ApplyRecord[] = [];

  canRollback() {
    return this.records.length > 0;
  }

  private relPath = async (file: string) => {
    const uri = await resolveFile(this.root, file);
    return uri ? path.relative(this.root, uri.fsPath).split(path.sep).join('/') : undefined;
  };

  /** Kuyruk veya hızlı kutudan gelen değişiklikleri uygular. */
  async applyEntries(entries: Entry[], pageUrl: string, continueSession: boolean, fromQueue: boolean, client?: string, viaMcpPrompt = false): Promise<string | undefined> {
    const tokens = entries.map((e) => e.token);
    const emit = (m: any) => {
      this.emit(m, client);
      if (m.type === 'applied') this.emit({ type: 'checkpointState', canRollback: this.canRollback() });
    };
    const fail = (message: string) => {
      emit({ type: 'applied', ok: false, message, tokens, fromQueue, canRollback: this.canRollback() });
      return undefined;
    };
    if (!entries.length) return fail(t('ext.nothingToApply'));
    if (this.runner.running) return fail(t('ext.busy'));
    // mcp: Claude değişiklikleri Panoptent'in MCP sunucusundan kendisi alır (istek dosyası yok)
    // live: bir Claude Code oturumu `/panoptent live` ile dinliyorsa paket ona doğrudan gider (CLI modu hariç)
    const liveOn = !viaMcpPrompt && this.sendTo() !== 'cli' && this.live.active;
    const mcpMode = viaMcpPrompt || liveOn || this.sendTo() === 'mcp';
    const panelMode = this.sendTo() !== 'cli';
    if (panelMode && !viaMcpPrompt && !liveOn && !claudeExtensionInstalled()) {
      return fail(t('ext.noClaudeExt'));
    }

    // Kaydedilmemiş dosyalar değişikliklerle çakışmasın
    await vscode.workspace.saveAll(false);

    // 1) Bu uygulamanın kaydı: geri alma YALNIZCA burada kaydedilen ve bu kimlikle
    //    Claude'a gönderilen isteğin yaptığı değişiklikleri kapsar.
    const label = new Date().toLocaleTimeString(uiLang() === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    const rec: ApplyRecord = { id: newApplyId(), label, time: Date.now(), ops: [], cliOps: [], sentToClaude: false };
    const cp = true;
    const pushRecord = () => {
      if (!rec.ops.length && !rec.sentToClaude) return;
      this.records.push(rec);
      if (this.records.length > 15) this.records.shift();
    };

    // 2) Metin değişikliklerini AI kullanmadan doğrudan yaz
    const rest: Entry[] = [];
    let direct = 0;
    for (const e of entries) {
      const it = e.items[0];
      if (e.kind === 'text' && it?.source && e.from && e.to !== undefined && !e.viewportOnly) {
        const uri = await resolveFile(this.root, it.source.file);
        if (uri) {
          try {
            const r = await quickEditText(uri, it.source.line, e.from, e.to);
            if (r.ok) {
              direct++;
              rec.ops.push({ kind: 'strings', file: uri.fsPath, oldStr: r.original ?? e.from, newStr: e.to, line: r.line, source: 'panoptent' });
              this.output.appendLine(t('ext.log.direct', path.relative(this.root, uri.fsPath), e.from, e.to));
              continue;
            }
          } catch {
            /* Claude'a bırak */
          }
        }
      }
      rest.push(e);
    }

    // 3) Yüklenen görselleri projeye kaydet
    for (const e of rest) {
      if (e.kind !== 'image' || !e.dataUrl) continue;
      const src = e.items[0]?.source ? await resolveFile(this.root, e.items[0].source.file) : undefined;
      try {
        e.saved = saveImage(this.root, src?.fsPath, e);
        if (e.saved) {
          this.output.appendLine(t('ext.log.imgSaved', e.saved.rel));
          const abs = path.join(this.root, e.saved.rel);
          rec.ops.push({ kind: 'image', file: abs, size: fs.statSync(abs).size, source: 'panoptent' });
        }
      } catch (err: any) {
        this.output.appendLine(t('ext.log.imgFailed', err.message));
      }
      e.dataUrl = undefined;
    }

    if (!rest.length) {
      pushRecord();
      emit({ type: 'applied', ok: true, direct, sent: 0, tokens, fromQueue, checkpoint: !!cp, canRollback: this.canRollback() });
      return viaMcpPrompt ? t('ext.mcp.directOnly', direct) : undefined;
    }

    if (mcpMode) {
      // İstem kimliği (PT-…) kullanıcı mesajında geçtiği için geri alma aynı şekilde çalışır
      const prompt =
        (await buildBatchPrompt(rest, { id: rec.id, pageUrl: pageUrl || t('ext.p.unknownPage'), detail: true, designFile: this.designFile(), resolve: this.relPath })) +
        '\n\n' + t('ext.mcp.markDone', rec.id);
      rec.sentToClaude = true;
      pushRecord();
      this.output.appendLine(t('ext.log.prompt') + '\n' + prompt);
      this.mcpApplies.set(rec.id, { prompt, client, tokens });
      if (this.mcpApplies.size > 15) this.mcpApplies.delete(this.mcpApplies.keys().next().value!);
      let ok = true;
      let how = 'mcpPrompt';
      if (liveOn && this.live.deliver({ type: 'apply', id: rec.id })) {
        how = 'live';
      } else if (!viaMcpPrompt) {
        const line = t('ext.mcp.applyLine', rec.id);
        if (continueSession) {
          // Açık Claude Code konuşmasının giriş kutusuna ekle (panel modundaki gibi): kullanıcı yalnızca Enter'a basar.
          // Claude Code'un komutu yoksa panoya kopyalanır.
          try {
            how = (await sendToOpenConversation(this.root, line, rec.id)) === 'mention' ? 'mention' : 'mcp';
          } catch (err: any) {
            this.output.appendLine(t('ext.log.appendFailed', err.message));
            await vscode.env.clipboard.writeText(line);
            how = 'mcp';
          }
        } else {
          ok = await openInClaudePanel(line);
          how = 'newTab';
        }
      }
      emit({ type: 'handoff', ok, how, id: rec.id });
      emit({ type: 'applied', ok, direct, sent: rest.length, tokens, fromQueue, checkpoint: !!cp, canRollback: this.canRollback(), message: ok ? undefined : t('ext.panelFailed') });
      return viaMcpPrompt ? prompt : undefined;
    }

    // 4) Kalanlar Claude'a
    const prompt = await buildBatchPrompt(rest, { id: rec.id, pageUrl: pageUrl || t('ext.p.unknownPage'), detail: !panelMode, designFile: this.designFile(), resolve: this.relPath });
    rec.sentToClaude = true;
    pushRecord();
    this.output.appendLine(t('ext.log.prompt') + '\n' + prompt);

    if (panelMode) {
      let ok = true;
      let how: 'mention' | 'clipboard' | 'newTab' = 'newTab';
      if (continueSession) {
        // Açık konuşmaya ekle (sağdaki panel)
        try {
          how = await sendToOpenConversation(this.root, prompt, rec.id);
        } catch (err: any) {
          this.output.appendLine(t('ext.log.appendFailed', err.message));
          await vscode.env.clipboard.writeText(prompt);
          how = 'clipboard';
        }
      } else {
        ok = await openInClaudePanel(prompt);
      }
      emit({ type: 'handoff', ok, how });
      emit({ type: 'applied', ok, direct, sent: rest.length, tokens, fromQueue, checkpoint: !!cp, canRollback: this.canRollback(), message: ok ? undefined : t('ext.panelFailed') });
      return;
    }

    const cfg = this.cfg();
    let cliPath = cfg.get<string>('claudePath') || 'claude';
    if (cliPath === 'claude' && !cliOnPath('claude')) {
      const bundled = findBundledClaude();
      if (bundled) {
        cliPath = bundled;
        this.output.appendLine(t('ext.log.bundled', bundled));
      }
    }
    let result = { ok: false, message: '' };
    await this.runner.run(
      {
        prompt,
        cwd: this.root,
        cliPath,
        permissionMode: cfg.get<string>('permissionMode') || 'acceptEdits',
        model: cfg.get<string>('model') || undefined,
        resume: continueSession ? this.sessionId : undefined,
      },
      (ev) => {
        if (ev.kind === 'session' || (ev.kind === 'done' && ev.sessionId)) {
          this.sessionId = (ev as any).sessionId;
          emit({ type: 'session', sessionId: this.sessionId });
        }
        if (ev.kind === 'error') {
          this.output.appendLine(t('ext.log.error', ev.message));
          result = { ok: false, message: ev.message.split('\n')[0] };
        }
        if (ev.kind === 'done') result = { ok: ev.ok, message: ev.ok ? '' : t('ext.claudeFailed') };
        emit({ type: 'claude', ev });
        if (ev.kind === 'done' && ev.edited.length && cfg.get<boolean>('reloadAfterEdit')) {
          setTimeout(() => emit({ type: 'reload' }), 600);
        }
      },
    );
    emit({ type: 'applied', ok: result.ok, message: result.message || undefined, reported: true, direct, sent: rest.length, tokens, fromQueue, checkpoint: !!cp, canRollback: this.canRollback() });
  }

  /** Son "Uygula"nın YALNIZCA kendi yaptığı değişiklikleri geri alır. */
  async rollback(client?: string) {
    const rec = this.records[this.records.length - 1];
    const rel = (f: string) => path.relative(this.root, f).split(path.sep).join('/') || f;
    const done = (ok: boolean, files: string[], message?: string, conflicts?: string[]) => {
      this.emit({ type: 'rollbackResult', ok, files, message, conflicts, canRollback: this.canRollback() }, client);
      this.emit({ type: 'checkpointState', canRollback: this.canRollback() });
    };
    if (!rec) return done(false, [], t('ext.rb.none'));

    const tr = rec.sentToClaude ? opsFromTranscripts(this.root, rec.id, rec.time) : { found: false, ops: [] as RevOp[], bashCount: 0, pending: false };
    const claudeOps = tr.ops.length ? tr.ops : rec.cliOps;
    const ops: RevOp[] = [...rec.ops, ...claudeOps];
    if (!ops.length) {
      const why = rec.sentToClaude && !tr.found
        ? t('ext.rb.notRun')
        : t('ext.rb.noChanges');
      const removeLabel = t('ext.rb.removeRecord');
      const pick = await vscode.window.showInformationMessage(why, removeLabel, t('ext.rb.cancel'));
      if (pick === removeLabel) this.records.pop();
      return done(false, [], undefined);
    }

    const isDirty = (f: string) => vscode.workspace.textDocuments.some((d) => d.uri.fsPath === f && d.isDirty);
    const plan = planRevert(ops, isDirty);
    const files = [...plan.changed.keys(), ...plan.deleted];
    const lines = [
      ...[...plan.changed.keys()].map((f) => '↺ ' + rel(f)),
      ...plan.deleted.map((f) => '✕ ' + rel(f) + ' ' + t('ext.rb.deletedLine')),
    ];
    const conflictLines = plan.conflicts.map((c) => `⚠ ${rel(c.file)} — ${c.reason}`);
    let detail = plan.count === 1 ? t('ext.rb.detailOne') : t('ext.rb.detailMany', plan.count);
    if (lines.length) detail += '\n\n' + lines.slice(0, 15).join('\n') + (lines.length > 15 ? '\n' + t('ext.rb.more', lines.length - 15) : '');
    if (conflictLines.length) detail += '\n\n' + t('ext.rb.conflicts') + '\n' + conflictLines.join('\n');
    if (tr.bashCount) detail += '\n\n' + t('ext.rb.bash', tr.bashCount);

    if (!files.length) {
      vscode.window.showWarningMessage(t('ext.rb.cannot', rec.label), { modal: true, detail });
      return done(false, [], t('ext.rb.cannotMsg'), conflictLines);
    }
    const undoLabel = t('ext.rb.undo');
    const pick = await vscode.window.showWarningMessage(t('ext.rb.confirm', rec.label), { modal: true, detail }, undoLabel);
    if (pick !== undoLabel) return done(false, [], undefined);

    try {
      for (const [f, content] of plan.changed) fs.writeFileSync(f, content);
      for (const f of plan.deleted) {
        try {
          await vscode.workspace.fs.delete(vscode.Uri.file(f), { useTrash: true });
        } catch {
          /* zaten yok */
        }
      }
      this.records.pop();
      done(true, files.map(rel), undefined, conflictLines);
    } catch (err: any) {
      done(false, [], t('ext.rb.failed', err.message));
    }
  }

}
