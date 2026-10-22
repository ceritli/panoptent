// Claude Code CLI'yi başsız (headless) modda çalıştırır ve stream-json çıktısını olaylara çevirir.

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export type ClaudeEvent =
  | { kind: 'start' }
  | { kind: 'session'; sessionId: string; model?: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'stderr'; text: string }
  | { kind: 'done'; ok: boolean; sessionId?: string; summary?: string; costUsd?: number; durationMs?: number; edited: string[] }
  | { kind: 'error'; message: string };

export interface RunOptions {
  prompt: string;
  cwd: string;
  cliPath: string;
  permissionMode: string;
  model?: string;
  resume?: string;
}

export class ClaudeRunner {
  private proc?: ChildProcess;

  get running() {
    return !!this.proc;
  }

  stop() {
    if (!this.proc) return;
    try {
      if (process.platform === 'win32' && this.proc.pid) {
        spawn('taskkill', ['/pid', String(this.proc.pid), '/T', '/F']);
      } else {
        this.proc.kill('SIGINT');
      }
    } catch {
      /* yok say */
    }
  }

  run(opts: RunOptions, onEvent: (e: ClaudeEvent) => void): Promise<void> {
    if (this.proc) return Promise.reject(new Error('Claude zaten çalışıyor.'));

    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', opts.permissionMode];
    if (opts.model) args.push('--model', opts.model);
    if (opts.resume) args.push('--resume', opts.resume);

    return new Promise((resolve) => {
      const edited = new Set<string>();
      let sessionId = opts.resume;
      let finished = false;

      const finish = (e: ClaudeEvent) => {
        if (finished) return;
        finished = true;
        onEvent(e);
      };

      onEvent({ kind: 'start' });
      // VS Code bir Claude Code terminalinden açıldıysa, iç içe oturum değişkenlerini taşıma
      const env = { ...process.env };
      for (const k of Object.keys(env)) {
        if (k === 'CLAUDECODE' || k === 'CLAUDE_CODE_ENTRYPOINT' || /^CLAUDE_CODE_.*SESSION/.test(k)) delete env[k];
      }
      let proc: ChildProcess;
      try {
        proc = spawn(opts.cliPath, args, {
          cwd: opts.cwd,
          // Windows'ta "claude" bir .cmd betiğidir, kabuk gerekir
          shell: process.platform === 'win32',
          env,
        });
      } catch (err: any) {
        finish({ kind: 'error', message: err.message });
        resolve();
        return;
      }
      this.proc = proc;

      // İstem stdin üzerinden gider: tırnak/boşluk sorunlarından kaçınır
      proc.stdin?.write(opts.prompt);
      proc.stdin?.end();

      let buf = '';
      proc.stdout?.setEncoding('utf8');
      proc.stdout?.on('data', (chunk: string) => {
        buf += chunk;
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let msg: any;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          this.handle(msg, opts.cwd, edited, (id) => (sessionId = id), onEvent, finish);
        }
      });

      let stderr = '';
      proc.stderr?.setEncoding('utf8');
      proc.stderr?.on('data', (c: string) => {
        stderr += c;
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });

      proc.on('error', (err: NodeJS.ErrnoException) => {
        this.proc = undefined;
        const message =
          err.code === 'ENOENT'
            ? `Claude Code CLI bulunamadı ("${opts.cliPath}"). Claude Code'un kurulu olduğundan emin ol veya ayarlardaki "panoptent.claudePath" ile tam yolunu belirt.`
            : err.message;
        finish({ kind: 'error', message });
        resolve();
      });

      proc.on('close', (code) => {
        this.proc = undefined;
        if (!finished) {
          if (code === 0) {
            finish({ kind: 'done', ok: true, sessionId, edited: [...edited] });
          } else {
            const tail = stderr.trim().split('\n').slice(-6).join('\n');
            const notFound = /not recognized|command not found|No such file/i.test(tail);
            finish({
              kind: 'error',
              message: notFound
                ? `Claude Code CLI bulunamadı. Ayarlardaki "panoptent.claudePath" ile tam yolunu belirt.\n${tail}`
                : `Claude Code çıkış kodu ${code}.${tail ? '\n' + tail : ''}`,
            });
          }
        }
        resolve();
      });
    });
  }

  private handle(
    msg: any,
    cwd: string,
    edited: Set<string>,
    setSession: (id: string) => void,
    onEvent: (e: ClaudeEvent) => void,
    finish: (e: ClaudeEvent) => void,
  ) {
    if (msg.type === 'system' && msg.subtype === 'init') {
      if (msg.session_id) setSession(msg.session_id);
      onEvent({ kind: 'session', sessionId: msg.session_id, model: msg.model });
      return;
    }
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text?.trim()) {
          onEvent({ kind: 'text', text: block.text.trim() });
        } else if (block.type === 'tool_use') {
          const input = block.input || {};
          const rel = (p?: string) => (p ? path.relative(cwd, p) || p : '');
          let detail = '';
          switch (block.name) {
            case 'Edit':
            case 'MultiEdit':
            case 'Write':
              detail = rel(input.file_path);
              if (input.file_path) edited.add(rel(input.file_path));
              break;
            case 'Read':
              detail = rel(input.file_path);
              break;
            case 'Grep':
            case 'Glob':
              detail = String(input.pattern || '');
              break;
            case 'Bash':
              detail = String(input.command || '').slice(0, 120);
              break;
            case 'TodoWrite':
            case 'TaskCreate':
            case 'TaskUpdate':
              return; // gürültü
            default:
              detail = '';
          }
          onEvent({ kind: 'tool', name: block.name, detail });
        }
      }
      return;
    }
    if (msg.type === 'result') {
      if (msg.session_id) setSession(msg.session_id);
      finish({
        kind: 'done',
        ok: !msg.is_error,
        sessionId: msg.session_id,
        summary: typeof msg.result === 'string' ? msg.result : undefined,
        costUsd: msg.total_cost_usd,
        durationMs: msg.duration_ms,
        edited: [...edited],
      });
    }
  }
}
