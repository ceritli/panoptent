// Seçimi VS Code'daki Claude Code paneline aktarma ve Claude Code eklentisiyle ilgili yardımcılar.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { addStrings, t } from './i18n';

addStrings({
  en: {
    'ext.req.header': '# Panoptent request\n\nThis file was created by Panoptent. Apply the changes below.\n\n',
  },
  tr: {
    'ext.req.header': '# Panoptent isteği\n\nBu dosya Panoptent tarafından oluşturuldu. Aşağıdaki değişiklikleri uygula.\n\n',
  },
});

export const CLAUDE_EXT_ID = 'anthropic.claude-code';

export function claudeExtensionInstalled(): boolean {
  return !!vscode.extensions.getExtension(CLAUDE_EXT_ID);
}

/**
 * İstemi Claude Code panelinde (yeni sekme veya mevcut oturum) önceden doldurulmuş olarak açar.
 * Claude Code eklentisinin resmi URI işleyicisini kullanır: <scheme>://anthropic.claude-code/open?prompt=…&session=…
 * İstem gönderilmez; kullanıcı panelde kontrol edip Enter'a basar.
 */
export async function openInClaudePanel(prompt: string, sessionId?: string): Promise<boolean> {
  const params = [`prompt=${encodeURIComponent(prompt)}`];
  if (sessionId) params.push(`session=${encodeURIComponent(sessionId)}`);
  const uri = vscode.Uri.from({
    scheme: vscode.env.uriScheme, // vscode, vscode-insiders, cursor…
    authority: CLAUDE_EXT_ID,
    path: '/open',
    query: params.join('&'),
  });
  return vscode.env.openExternal(uri);
}

/**
 * Bu proje klasöründeki en son Claude Code oturumunun kimliği.
 * Claude Code konuşmaları ~/.claude/projects/<kodlanmış-yol>/<oturum-id>.jsonl olarak saklar.
 */
export function findLatestSession(root: string): string | undefined {
  const base = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  const encoded = root.replace(/[^a-zA-Z0-9]/g, '-');
  let dir = path.join(base, encoded);
  if (!fs.existsSync(dir)) {
    // Büyük/küçük harf farkı (macOS/Windows) için klasörleri tara
    try {
      const hit = fs.readdirSync(base).find((d) => d.toLowerCase() === encoded.toLowerCase());
      if (!hit) return undefined;
      dir = path.join(base, hit);
    } catch {
      return undefined;
    }
  }
  try {
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    return files[0]?.f.replace(/\.jsonl$/, '');
  } catch {
    return undefined;
  }
}

/** "claude" komutu PATH'te var mı? */
export function cliOnPath(cmd: string): boolean {
  if (path.isAbsolute(cmd)) return fs.existsSync(cmd);
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 && !!r.stdout.trim();
}

/** Claude Code VS Code eklentisinin içinde gelen CLI kopyasını bulur (terminalde "claude" yoksa yedek). */
export function findBundledClaude(): string | undefined {
  const ext = vscode.extensions.getExtension(CLAUDE_EXT_ID);
  if (!ext) return undefined;
  const names = process.platform === 'win32' ? ['claude.exe'] : ['claude'];
  const walk = (dir: string, depth: number): string | undefined => {
    if (depth > 4) return undefined;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return undefined;
    }
    for (const e of entries) {
      if (e.isFile() && names.includes(e.name)) {
        const p = path.join(dir, e.name);
        try {
          if (process.platform === 'win32') return p;
          fs.accessSync(p, fs.constants.X_OK);
          return p;
        } catch {
          /* çalıştırılabilir değil */
        }
      }
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) {
        const hit = walk(path.join(dir, e.name), depth + 1);
        if (hit) return hit;
      }
    }
    return undefined;
  };
  return walk(ext.extensionPath, 0);
}

/**
 * İstemi, Claude Code panelinde AÇIK OLAN konuşmaya ekler.
 * (Claude Code'un open?session=… adresi, oturum zaten açıksa istemi uygulamıyor.)
 * Yöntem: istemi git'in yok saydığı .claude/panoptent/ altına bir dosyaya yazar, dosyayı seçili
 * hâlde açar ve Claude Code'un "Insert @-Mention Reference" komutuyla o dosyayı açık konuşmanın
 * giriş kutusuna ekler. Kullanıcı panelde Enter'a basar. İstem ayrıca panoya kopyalanır.
 */
export async function sendToOpenConversation(root: string, prompt: string, id = ''): Promise<'mention' | 'clipboard'> {
  await vscode.env.clipboard.writeText(prompt);

  const all = await vscode.commands.getCommands(true);
  const cmd =
    ['claude-vscode.insertAtMention', 'claude-code.insertAtMentioned'].find((c) => all.includes(c)) ||
    all.find((c) => /claude/i.test(c) && /mention/i.test(c));
  if (!cmd) return 'clipboard';

  const dir = path.join(root, '.claude', 'panoptent');
  fs.mkdirSync(dir, { recursive: true });
  const ignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  // eski istek dosyalarını temizle (son 20 kalsın)
  try {
    const old = fs.readdirSync(dir).filter((f) => /^(istek|request)-/.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - 20))) fs.rmSync(path.join(dir, f), { force: true });
  } catch {
    /* yok say */
  }
  const stamp = id || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const file = path.join(dir, `istek-${stamp}.md`);
  // Dosya adı dilden bağımsız olarak `istek-<kimlik>.md` kalır (temizlik bu öneki arar).
  const body = t('ext.req.header') + prompt + '\n';
  fs.writeFileSync(file, body);

  const uri = vscode.Uri.file(file);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preview: true, preserveFocus: false });
  const last = doc.lineAt(doc.lineCount - 1);
  editor.selection = new vscode.Selection(new vscode.Position(0, 0), last.range.end);
  try {
    await vscode.commands.executeCommand(cmd);
  } catch {
    return 'clipboard';
  }
  // geçici sekmeyi kapat (Claude sekmesine dokunmadan)
  setTimeout(() => {
    for (const g of vscode.window.tabGroups.all) {
      for (const t of g.tabs) {
        const input = t.input as { uri?: vscode.Uri } | undefined;
        if (input?.uri && input.uri.fsPath === uri.fsPath) vscode.window.tabGroups.close(t, true);
      }
    }
  }, 400);
  return 'mention';
}
