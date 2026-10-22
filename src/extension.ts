import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DevProxy } from './proxy';
import { pickCandidate, setupPrompt, runInstall } from './codeInspector';
import { Engine } from './engine';
import { Bridge } from './bridge';

let current: PreviewPanel | undefined;
let engine: Engine | undefined;
let bridge: Bridge | undefined;
let output: vscode.OutputChannel | undefined;

function getOutput() {
  if (!output) output = vscode.window.createOutputChannel('Panoptent');
  return output;
}

/** Çalışma alanı başına tek motor (panel ve Chrome köprüsü ortak kullanır). */
function getEngine(context: vscode.ExtensionContext): Engine | undefined {
  if (engine) return engine;
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) return undefined;
  engine = new Engine(context, root, getOutput());
  return engine;
}

export function activate(context: vscode.ExtensionContext) {
  // Sol menüdeki (activity bar) Panoptent görünümü: içerik package.json'daki karşılama ekranından gelir
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('panoptent.home', {
      getChildren: () => [],
      getTreeItem: (x: vscode.TreeItem) => x,
    }),
  );

  const startBridge = () => {
    const e = getEngine(context);
    if (!e || bridge) return;
    if (vscode.workspace.getConfiguration('panoptent').get<boolean>('chromeBridge') === false) return;
    bridge = new Bridge(context, e, getOutput());
    bridge.start().catch((err) => getOutput().appendLine('Chrome köprüsü başlatılamadı: ' + err.message));
  };
  startBridge();
  context.subscriptions.push(
    // proje klasörü sonradan açılırsa köprüyü o zaman başlat
    vscode.workspace.onDidChangeWorkspaceFolders(() => startBridge()),
    vscode.workspace.onDidChangeConfiguration((ev) => {
      if (!ev.affectsConfiguration('panoptent.chromeBridge') && !ev.affectsConfiguration('panoptent.bridgePort')) return;
      bridge?.stop();
      bridge = undefined;
      startBridge();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('panoptent.open', async () => {
      if (current) {
        current.reveal();
        return;
      }
      const e = getEngine(context);
      if (!e) {
        vscode.window.showErrorMessage('Panoptent: Önce proje klasörünü aç (Dosya → Klasör Aç).');
        return;
      }
      const cfg = vscode.workspace.getConfiguration('panoptent');
      const last = context.workspaceState.get<string>('panoptent.lastUrl') || cfg.get<string>('defaultUrl') || 'http://localhost:3000';
      const url = await vscode.window.showInputBox({
        title: 'Panoptent',
        prompt: 'Dev sunucunun adresi (önce projende "npm run dev" çalışıyor olmalı)',
        value: last,
        validateInput: (v) => {
          try {
            const u = new URL(v);
            return /^https?:$/.test(u.protocol) ? undefined : 'http:// veya https:// ile başlamalı';
          } catch {
            return 'Geçerli bir adres gir, örn. http://localhost:3000';
          }
        },
      });
      if (!url) return;
      await context.workspaceState.update('panoptent.lastUrl', url);
      try {
        current = await PreviewPanel.create(context, e, url);
        current.onDispose(() => (current = undefined));
      } catch (err: any) {
        vscode.window.showErrorMessage(`Panoptent başlatılamadı: ${err.message}`);
      }
    }),
    vscode.commands.registerCommand('panoptent.toggleSelect', () => current?.toggleSelect()),
    vscode.commands.registerCommand('panoptent.setupGuide', () => showSetupGuide(context)),
    vscode.commands.registerCommand('panoptent.setupCodeInspector', async () => {
      const e = getEngine(context);
      if (!e) return;
      const c = await pickCandidate(e.root);
      if (!c) return;
      if (!c.installed) runInstall(c);
      await e.sendInstruction(setupPrompt(c), `code-inspector kurulumu (${c.rel}, ${c.framework})`);
    }),
    vscode.commands.registerCommand('panoptent.chromeStatus', () => bridge?.showStatus()),
    vscode.commands.registerCommand('panoptent.forgetChrome', async () => {
      await context.globalState.update('panoptent.chromeTokens', []);
      bridge?.dropAll();
      vscode.window.showInformationMessage('Panoptent: Tüm Chrome eşleştirmeleri silindi.');
    }),
  );
}

export function deactivate() {
  current?.dispose();
  bridge?.stop();
  engine?.dispose();
}

class PreviewPanel {
  private panel: vscode.WebviewPanel;
  private disposeHandlers: (() => void)[] = [];
  private disposed = false;
  private sub: vscode.Disposable;

  static async create(context: vscode.ExtensionContext, engine: Engine, url: string) {
    const overlayPath = path.join(context.extensionPath, 'media', 'overlay.js');
    const proxy = new DevProxy({
      target: url,
      overlayScript: () => fs.readFileSync(overlayPath, 'utf8'),
      log: (m) => engine.output.appendLine(m),
    });
    const port = await proxy.start();
    // Uzak (SSH/Codespaces) senaryolarında da çalışsın diye dış adrese çevir
    const external = await vscode.env.asExternalUri(vscode.Uri.parse(`http://127.0.0.1:${port}/`));
    return new PreviewPanel(context, engine, proxy, external.toString(true));
  }

  private constructor(
    private context: vscode.ExtensionContext,
    private engine: Engine,
    private proxy: DevProxy,
    private proxyBase: string,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'panoptent.preview',
      'Panoptent',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))],
      },
    );
    this.panel.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.svg'));
    this.panel.webview.html = this.html();
    this.panel.webview.onDidReceiveMessage((m) => this.onMessage(m));
    this.panel.onDidDispose(() => this.dispose());
    // motordan gelen olaylar: bana özel olanlar ve herkese yayınlananlar
    this.sub = engine.on((msg, to) => {
      if (!to || to === 'panel') this.post(msg);
    });
  }

  reveal() {
    this.panel.reveal();
  }

  onDispose(fn: () => void) {
    this.disposeHandlers.push(fn);
  }

  toggleSelect() {
    this.post({ type: 'toggleSelect' });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.sub.dispose();
    this.proxy.stop();
    this.panel.dispose();
    this.disposeHandlers.forEach((f) => f());
  }

  private post(msg: any) {
    if (!this.disposed) this.panel.webview.postMessage(msg);
  }

  private async onMessage(m: any) {
    const e = this.engine;
    switch (m.type) {
      case 'ready':
        this.post({
          type: 'init',
          proxyBase: this.proxyBase,
          target: this.proxy.targetOrigin,
          initialPath: this.initialPath(),
          layout: this.context.globalState.get('panoptent.layout'),
          ...e.settings(),
        });
        break;
      case 'saveLayout':
        await this.context.globalState.update('panoptent.layout', m.layout);
        break;
      case 'setSendTo':
        await e.setSendTo(m.value);
        break;
      case 'setTarget': {
        try {
          const u = new URL(m.url);
          this.proxy.setTarget(u.origin);
          await this.context.workspaceState.update('panoptent.lastUrl', u.toString());
          this.post({ type: 'retarget', target: this.proxy.targetOrigin, path: u.pathname + u.search + u.hash });
        } catch {
          vscode.window.showWarningMessage('Panoptent: Geçersiz adres.');
        }
        break;
      }
      case 'openSource':
        await e.openSource(m.item, !!m.quiet);
        break;
      case 'setupCodeInspector':
        vscode.commands.executeCommand('panoptent.setupCodeInspector');
        break;
      case 'setOpenOnSelect':
        await e.setOpenOnSelect(!!m.value);
        break;
      case 'quickEdit':
        await e.quickEdit(m.item, m.newText, 'panel');
        break;
      case 'newSession':
        e.newSession();
        break;
      case 'stop':
        e.runner.stop();
        break;
      case 'run': // eski sürümlerle uyumluluk
        await e.applyEntries(
          [{ token: 'run' + Date.now(), kind: 'prompt', text: m.prompt, items: m.items || [] }],
          m.pageUrl || this.proxy.targetOrigin,
          !!m.continueSession,
          false,
          'panel',
        );
        break;
      case 'applyEntries':
        await e.applyEntries(m.entries || [], m.pageUrl || this.proxy.targetOrigin, !!m.continueSession, !!m.fromQueue, 'panel');
        break;
      case 'rollback':
        await e.rollback('panel');
        break;
      case 'openSettings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'panoptent');
        break;
      case 'setupGuide':
        showSetupGuide(this.context);
        break;
      case 'openFile':
        await e.openFile(m.file);
        break;
      case 'openExternal':
        vscode.env.openExternal(vscode.Uri.parse(m.url));
        break;
    }
  }

  private initialPath() {
    const last = this.context.workspaceState.get<string>('panoptent.lastUrl');
    if (!last) return '/';
    try {
      const u = new URL(last);
      return u.pathname + u.search + u.hash;
    } catch {
      return '/';
    }
  }

  private html(): string {
    const w = this.panel.webview;
    const media = (f: string) => w.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', f)));
    const nonce = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    const frameOrigin = new URL(this.proxyBase).origin;
    return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${frameOrigin} http://127.0.0.1:* http://localhost:*; style-src ${w.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${w.cspSource} data:; font-src ${w.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${media('panel.css')}">
<title>Panoptent</title>
</head>
<body>
<div id="app">
  <header class="bar">
    <button id="selBtn" class="tool" aria-pressed="false" title="Seçim modu (Ctrl/Cmd+Shift+E) — Alt basılı tutarak da tıklayabilirsin">
      <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M2 2h4v1.5H3.5V6H2V2zm8 0h4v4h-1.5V3.5H10V2zM2 10h1.5v2.5H6V14H2v-4zm5.2-2.6 7 2.6-3 1.1 2.3 2.3-1.1 1.1-2.3-2.3-1.1 3-1.8-7.8z"/></svg>
      <span>Seç</span>
    </button>
    <div class="url">
      <button id="reloadBtn" class="icon" title="Yenile">↻</button>
      <input id="urlInput" spellcheck="false" aria-label="Sayfa adresi">
    </div>
    <div class="seg" role="group" aria-label="Ekran genişliği">
      <button data-vp="full" class="on" title="Tam genişlik">Tam</button>
      <button data-vp="1024" title="1024 px">Tablet</button>
      <button data-vp="390" title="390 px">Mobil</button>
    </div>
    <div class="seg dock" role="group" aria-label="Panel konumu">
      <button data-dock="left" title="Panel solda"><svg viewBox="0 0 16 16" width="16" height="16"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor"/><rect x="2" y="3" width="4.5" height="10" fill="currentColor"/></svg></button>
      <button data-dock="bottom" title="Panel altta"><svg viewBox="0 0 16 16" width="16" height="16"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor"/><rect x="2" y="9" width="12" height="4" fill="currentColor"/></svg></button>
      <button data-dock="right" title="Panel sağda"><svg viewBox="0 0 16 16" width="16" height="16"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor"/><rect x="9.5" y="3" width="4.5" height="10" fill="currentColor"/></svg></button>
    </div>
    <button id="sideToggle" class="tool square" aria-pressed="true" title="Paneli gizle">
      <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M2 3h12v1.5H2zM2 7.25h12v1.5H2zM2 11.5h8v1.5H2z"/></svg>
      <span id="selCount" class="badge" hidden>0</span>
    </button>
  </header>
  <main id="main" class="dock-right">
    <section class="stage" id="stage">
      <div class="frameWrap" id="frameWrap"><iframe id="frame" title="Önizleme"></iframe></div>
      <div class="qbar" id="qbar" hidden>
        <span class="qinfo" id="qinfo"><span class="qdot"></span><b id="qcount">0</b> değişiklik bekliyor</span>
        <button class="qb" id="qUndo" title="Geri al (Ctrl/Cmd+Z)">↶</button>
        <button class="qb" id="qRedo" title="Yinele (Ctrl/Cmd+Shift+Z)">↷</button>
        <button class="qb" id="qList">Listele</button>
        <button class="qb" id="qClear">Temizle</button>
        <button class="qb pri" id="qApply">Uygula</button>
        <span class="qsep" id="qsep" hidden></span>
        <button class="qb" id="qRollback" hidden title="Son uygulamada yalnızca Panoptent'in ve onun gönderdiği isteğin yaptığı değişiklikleri geri alır">↶ Son uygulamayı geri al</button>
      </div>
    </section>
    <div class="splitter" id="splitter" title="Sürükle: boyutlandır · Çift tık: gizle"></div>
    <aside class="side" id="side">
      <div class="col colSel">
        <div id="support" class="support" hidden></div>
        <div class="sectionHead" id="queueHead" hidden><span>Kuyruk</span><button class="link" id="qApply2">Hepsini uygula</button></div>
        <div id="queue" class="queue" hidden></div>
        <div class="sectionHead"><span>Seçilenler</span><button id="clearBtn" class="link" hidden>Temizle</button></div>
        <div id="items" class="items"></div>
      </div>
      <div class="col colCompose">
        <div class="compose">
          <textarea id="prompt" rows="3" placeholder="Ne değişsin? Örn: bu butonu daha büyük yap ve yeşil tonlarına çevir"></textarea>
          <div class="composeRow">
            <select id="sendTo" class="sendTo" title="İstek nereye gitsin?">
              <option value="claudePanel">Claude Code paneli</option>
              <option value="cli">Arka planda (CLI)</option>
            </select>
            <button id="queueBtn" class="secondary" title="Kuyruğa ekle (Ctrl/Cmd+Enter)">Kuyruğa</button>
            <button id="sendBtn" class="primary" title="Hemen gönder (Ctrl/Cmd+Shift+Enter)">Aktar</button>
            <button id="stopBtn" class="danger" hidden>Durdur</button>
          </div>
          <div class="composeRow sub">
            <label class="chk" id="contWrap"><input type="checkbox" id="cont" checked> <span id="contLabel">Son konuşmaya ekle</span></label>
            <button id="newSess" class="link" hidden>Yeni oturum</button>
          </div>
          <div class="composeRow sub">
            <label class="chk"><input type="checkbox" id="popChk" checked> Seçince öğenin yanında kutu aç</label>
          </div>
          <div class="composeRow sub">
            <label class="chk" title="Seçtiğin öğenin kaynak dosyası, odağı önizlemeden almadan editörde açılır"><input type="checkbox" id="openSrcChk" checked> Seçince kodunu da yanda aç</label>
          </div>
        </div>
      </div>
      <div class="col colLog">
        <div class="sectionHead"><span>Etkinlik</span></div>
        <div id="log" class="log"><div class="muted">Henüz bir şey yok.</div></div>
      </div>
    </aside>
  </main>
</div>
<script nonce="${nonce}" src="${media('panel.js')}"></script>
</body>
</html>`;
  }
}

function showSetupGuide(context: vscode.ExtensionContext) {
  const file = path.join(context.extensionPath, 'media', 'SETUP.md');
  vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(file));
}
