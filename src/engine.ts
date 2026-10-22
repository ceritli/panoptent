// Panoptent motoru: kuyruğu uygulama, Claude'a aktarma, geri alma, kaynak açma.
// VS Code önizleme paneli ve Chrome köprüsü aynı motoru kullanır.

import * as vscode from 'vscode';
import { uiLang, normLang } from './i18n';
import * as fs from 'fs';
import * as path from 'path';
import { ClaudeRunner } from './claude';
import { resolveFile, openAt, quickEditText } from './source';
import { claudeExtensionInstalled, openInClaudePanel, cliOnPath, findBundledClaude, sendToOpenConversation } from './claudePanel';
import { Entry, SelectedItem, buildBatchPrompt, saveImage } from './entries';
import { ApplyRecord, RevOp, newApplyId, opsFromTranscripts, planRevert } from './revert';

export type Listener = (msg: any, to?: string) => void;

export class Engine {
  runner = new ClaudeRunner();
  sessionId?: string;
  private listeners = new Set<Listener>();
  private watcher: vscode.FileSystemWatcher;
  private changed = new Set<string>();
  private changeTimer?: NodeJS.Timeout;

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
    };
  }

  /** Change the UI language (writes the `panoptent.language` setting; the config listener broadcasts it). */
  async setLang(v: string) {
    const value = v === 'auto' ? 'auto' : normLang(v);
    await this.cfg().update('language', value, vscode.ConfigurationTarget.Global);
  }

  async setSendTo(v: string) {
    await this.cfg().update('sendTo', v === 'cli' ? 'cli' : 'claudePanel', vscode.ConfigurationTarget.Global);
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
      if (!quiet) vscode.window.showWarningMessage(`Dosya bulunamadı: ${item.source.file}`);
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
    if (!item.source) return fail('Kaynak dosya bilinmiyor.');
    const uri = await resolveFile(this.root, item.source.file);
    if (!uri) return fail(`Dosya bulunamadı: ${item.source.file}`);
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

  sendTo(): 'claudePanel' | 'cli' {
    return this.cfg().get<string>('sendTo') === 'cli' ? 'cli' : 'claudePanel';
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
  async applyEntries(entries: Entry[], pageUrl: string, continueSession: boolean, fromQueue: boolean, client?: string) {
    const tokens = entries.map((e) => e.token);
    const emit = (m: any) => {
      this.emit(m, client);
      if (m.type === 'applied') this.emit({ type: 'checkpointState', canRollback: this.canRollback() });
    };
    const fail = (message: string) => emit({ type: 'applied', ok: false, message, tokens, fromQueue, canRollback: this.canRollback() });
    if (!entries.length) return fail('Uygulanacak değişiklik yok.');
    if (this.runner.running) return fail('Claude hâlâ önceki işi çalıştırıyor.');
    const panelMode = this.sendTo() === 'claudePanel';
    if (panelMode && !claudeExtensionInstalled()) {
      return fail('Claude Code VS Code eklentisi bulunamadı. Kur ya da gönderme yerini "Burada çalıştır" yap.');
    }

    // Kaydedilmemiş dosyalar değişikliklerle çakışmasın
    await vscode.workspace.saveAll(false);

    // 1) Bu uygulamanın kaydı: geri alma YALNIZCA burada kaydedilen ve bu kimlikle
    //    Claude'a gönderilen isteğin yaptığı değişiklikleri kapsar.
    const label = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
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
              this.output.appendLine(`Doğrudan yazıldı: ${path.relative(this.root, uri.fsPath)} — “${e.from}” → “${e.to}”`);
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
          this.output.appendLine('Görsel kaydedildi: ' + e.saved.rel);
          const abs = path.join(this.root, e.saved.rel);
          rec.ops.push({ kind: 'image', file: abs, size: fs.statSync(abs).size, source: 'panoptent' });
        }
      } catch (err: any) {
        this.output.appendLine('Görsel kaydedilemedi: ' + err.message);
      }
      e.dataUrl = undefined;
    }

    if (!rest.length) {
      pushRecord();
      emit({ type: 'applied', ok: true, direct, sent: 0, tokens, fromQueue, checkpoint: !!cp, canRollback: this.canRollback() });
      return;
    }

    // 4) Kalanlar Claude'a
    const prompt = await buildBatchPrompt(rest, { id: rec.id, pageUrl: pageUrl || '(bilinmiyor)', detail: !panelMode, resolve: this.relPath });
    rec.sentToClaude = true;
    pushRecord();
    this.output.appendLine('──── İstem ────\n' + prompt);

    if (panelMode) {
      let ok = true;
      let how: 'mention' | 'clipboard' | 'newTab' = 'newTab';
      if (continueSession) {
        // Açık konuşmaya ekle (sağdaki panel)
        try {
          how = await sendToOpenConversation(this.root, prompt, rec.id);
        } catch (err: any) {
          this.output.appendLine('Açık konuşmaya eklenemedi: ' + err.message);
          await vscode.env.clipboard.writeText(prompt);
          how = 'clipboard';
        }
      } else {
        ok = await openInClaudePanel(prompt);
      }
      emit({ type: 'handoff', ok, how });
      emit({ type: 'applied', ok, direct, sent: rest.length, tokens, fromQueue, checkpoint: !!cp, canRollback: this.canRollback(), message: ok ? undefined : 'Claude Code paneli açılamadı.' });
      return;
    }

    const cfg = this.cfg();
    let cliPath = cfg.get<string>('claudePath') || 'claude';
    if (cliPath === 'claude' && !cliOnPath('claude')) {
      const bundled = findBundledClaude();
      if (bundled) {
        cliPath = bundled;
        this.output.appendLine(`"claude" PATH'te yok, eklentideki kopya kullanılıyor: ${bundled}`);
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
          this.output.appendLine('HATA: ' + ev.message);
          result = { ok: false, message: ev.message.split('\n')[0] };
        }
        if (ev.kind === 'done') result = { ok: ev.ok, message: ev.ok ? '' : 'Claude işi bitiremedi.' };
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
    if (!rec) return done(false, [], 'Geri alınacak bir uygulama yok.');

    const tr = rec.sentToClaude ? opsFromTranscripts(this.root, rec.id, rec.time) : { found: false, ops: [] as RevOp[], bashCount: 0, pending: false };
    const claudeOps = tr.ops.length ? tr.ops : rec.cliOps;
    const ops: RevOp[] = [...rec.ops, ...claudeOps];
    if (!ops.length) {
      const why = rec.sentToClaude && !tr.found
        ? 'Claude Code bu isteği henüz çalıştırmamış görünüyor (panelde Enter’a bastın mı?). Geri alınacak bir değişiklik yok.'
        : 'Bu uygulamada geri alınacak bir dosya değişikliği bulunamadı.';
      const pick = await vscode.window.showInformationMessage(why, 'Kaydı kaldır', 'Vazgeç');
      if (pick === 'Kaydı kaldır') this.records.pop();
      return done(false, [], undefined);
    }

    const isDirty = (f: string) => vscode.workspace.textDocuments.some((d) => d.uri.fsPath === f && d.isDirty);
    const plan = planRevert(ops, isDirty);
    const files = [...plan.changed.keys(), ...plan.deleted];
    const lines = [
      ...[...plan.changed.keys()].map((f) => '↺ ' + rel(f)),
      ...plan.deleted.map((f) => '✕ ' + rel(f) + ' (Panoptent/Claude oluşturmuştu, çöpe taşınır)'),
    ];
    const conflictLines = plan.conflicts.map((c) => `⚠ ${rel(c.file)} — ${c.reason}`);
    let detail = `Yalnızca bu uygulamada Panoptent'in ve Claude'un yaptığı ${plan.count} değişiklik geri alınır. Senin ve sonraki konuşmaların değişikliklerine dokunulmaz.`;
    if (lines.length) detail += '\n\n' + lines.slice(0, 15).join('\n') + (lines.length > 15 ? `\n… ve ${lines.length - 15} dosya daha` : '');
    if (conflictLines.length) detail += '\n\nGeri alınamayacaklar (bu dosyalara dokunulmayacak):\n' + conflictLines.join('\n');
    if (tr.bashCount) detail += `\n\nNot: Claude bu istekte ${tr.bashCount} terminal komutu çalıştırdı; terminalle yapılan değişiklikler izlenemediği için geri alınmaz.`;

    if (!files.length) {
      vscode.window.showWarningMessage(`Saat ${rec.label} uygulaması geri alınamadı.`, { modal: true, detail });
      return done(false, [], 'Geri alınamadı: değişen satırlar sonradan düzenlenmiş.', conflictLines);
    }
    const pick = await vscode.window.showWarningMessage(`Saat ${rec.label} uygulaması geri alınsın mı?`, { modal: true, detail }, 'Geri al');
    if (pick !== 'Geri al') return done(false, [], undefined);

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
      done(false, [], 'Geri alma başarısız: ' + err.message);
    }
  }

}
