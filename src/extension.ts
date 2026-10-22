import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DevProxy } from './proxy';
import { pickCandidate, setupPrompt, runInstall } from './codeInspector';
import { Engine } from './engine';
import { Bridge } from './bridge';
import { McpHost } from './mcp';
import { uiLang, addStrings, t } from './i18n';

addStrings({
  en: {
    'ext.bridgeFailed': 'Could not start the Chrome bridge: {0}',
    'ext.openFolder': 'Panoptent: Open your project folder first (File → Open Folder).',
    'ext.urlPrompt': 'Dev server address (your project should already be running "npm run dev")',
    'ext.urlScheme': 'Must start with http:// or https://',
    'ext.urlInvalid': 'Enter a valid address, e.g. http://localhost:3000',
    'ext.startFailed': 'Panoptent could not start: {0}',
    'ext.ciNote': 'code-inspector setup ({0}, {1})',
    'ext.chromeForgotten': 'Panoptent: All Chrome pairings were removed.',
    'ext.badUrl': 'Panoptent: Invalid address.',
    'ext.lang.title': 'Panoptent: Change Language',
    'ext.lang.auto': 'Auto',
    'ext.lang.autoDesc': 'Follow VS Code’s display language',
    'ext.lang.current': 'current',
    'ext.design.title': 'Panoptent: Design Rules File',
    'ext.design.ph': 'Pick the file Claude should follow for UI changes (e.g. design.md)',
    'ext.design.auto': 'Automatic',
    'ext.design.autoDesc': 'Use design.md / DESIGN.md / docs/design.md if the project has one',
    'ext.design.off': 'Off',
    'ext.design.offDesc': 'Don’t remind Claude of a design file',
    'ext.design.browse': 'Choose another file…',
    'ext.design.outside': 'Pick a file inside this project folder.',
    'ext.design.set': 'Panoptent: Claude will follow {0} for changes in this project.',
  },
  tr: {
    'ext.bridgeFailed': 'Chrome köprüsü başlatılamadı: {0}',
    'ext.openFolder': 'Panoptent: Önce proje klasörünü aç (Dosya → Klasör Aç).',
    'ext.urlPrompt': 'Dev sunucunun adresi (önce projende "npm run dev" çalışıyor olmalı)',
    'ext.urlScheme': 'http:// veya https:// ile başlamalı',
    'ext.urlInvalid': 'Geçerli bir adres gir, örn. http://localhost:3000',
    'ext.startFailed': 'Panoptent başlatılamadı: {0}',
    'ext.ciNote': 'code-inspector kurulumu ({0}, {1})',
    'ext.chromeForgotten': 'Panoptent: Tüm Chrome eşleştirmeleri silindi.',
    'ext.badUrl': 'Panoptent: Geçersiz adres.',
    'ext.lang.title': 'Panoptent: Dili Değiştir',
    'ext.lang.auto': 'Otomatik',
    'ext.lang.autoDesc': 'VS Code’un görüntüleme dilini izle',
    'ext.lang.current': 'şu anki',
    'ext.design.title': 'Panoptent: Tasarım Kuralları Dosyası',
    'ext.design.ph': 'Arayüz değişikliklerinde Claude’un uyacağı dosyayı seç (ör. design.md)',
    'ext.design.auto': 'Otomatik',
    'ext.design.autoDesc': 'Projede design.md / DESIGN.md / docs/design.md varsa onu kullan',
    'ext.design.off': 'Kapalı',
    'ext.design.offDesc': 'Claude’a tasarım dosyası hatırlatma',
    'ext.design.browse': 'Başka bir dosya seç…',
    'ext.design.outside': 'Bu proje klasörünün içinden bir dosya seç.',
    'ext.design.set': 'Panoptent: Bu projede Claude değişikliklerde {0} dosyasına uyacak.',
  },
});

let current: PreviewPanel | undefined;
let engine: Engine | undefined;
let bridge: Bridge | undefined;
let mcp: McpHost | undefined;
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
    bridge.start().catch((err) => getOutput().appendLine(t('ext.bridgeFailed', err.message)));
  };
  startBridge();
  const startMcp = () => {
    const e = getEngine(context);
    if (!e || mcp) return;
    if (vscode.workspace.getConfiguration('panoptent').get<boolean>('mcpServer') === false) return;
    const m = new McpHost(e, getOutput());
    mcp = m;
    m.start()
      .then(() => m.refreshConnection())
      .catch((err) => {
        getOutput().appendLine(t('ext.mcp.failed', err.message));
        if (mcp === m) mcp = undefined;
      });
  };
  startMcp();
  context.subscriptions.push(
    // proje klasörü sonradan açılırsa köprüyü o zaman başlat
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      startBridge();
      startMcp();
    }),
    vscode.workspace.onDidChangeConfiguration((ev) => {
      if (ev.affectsConfiguration('panoptent.designFile') && engine) {
        engine.emit({ type: 'design', ...engine.designState() });
      }
      if (ev.affectsConfiguration('panoptent.language')) {
        engine?.emit({ type: 'lang', value: uiLang() });
        bridge?.refreshLang();
      }
      // MCP gönderimi seçildiyse ve Claude Code henüz bağlı değilse bağlamayı öner
      if (ev.affectsConfiguration('panoptent.sendTo') && engine?.sendTo() === 'mcp' && mcp && !mcp.connected) {
        mcp.connectClaudeCode(true);
      }
      if (ev.affectsConfiguration('panoptent.mcpServer') || ev.affectsConfiguration('panoptent.mcpPort')) {
        mcp?.stop();
        mcp = undefined;
        startMcp();
      }
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
        vscode.window.showErrorMessage(t('ext.openFolder'));
        return;
      }
      const cfg = vscode.workspace.getConfiguration('panoptent');
      const last = context.workspaceState.get<string>('panoptent.lastUrl') || cfg.get<string>('defaultUrl') || 'http://localhost:3000';
      const url = await vscode.window.showInputBox({
        title: 'Panoptent',
        prompt: t('ext.urlPrompt'),
        value: last,
        validateInput: (v) => {
          try {
            const u = new URL(v);
            return /^https?:$/.test(u.protocol) ? undefined : t('ext.urlScheme');
          } catch {
            return t('ext.urlInvalid');
          }
        },
      });
      if (!url) return;
      await context.workspaceState.update('panoptent.lastUrl', url);
      try {
        current = await PreviewPanel.create(context, e, url);
        current.onDispose(() => (current = undefined));
      } catch (err: any) {
        vscode.window.showErrorMessage(t('ext.startFailed', err.message));
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
      await e.sendInstruction(setupPrompt(c), t('ext.ciNote', c.rel, c.framework));
    }),
    vscode.commands.registerCommand('panoptent.chromeStatus', () => bridge?.showStatus()),
    vscode.commands.registerCommand('panoptent.forgetChrome', async () => {
      await context.globalState.update('panoptent.chromeTokens', []);
      bridge?.dropAll();
      vscode.window.showInformationMessage(t('ext.chromeForgotten'));
    }),
    vscode.commands.registerCommand('panoptent.changeLanguage', () => pickLanguage()),
    vscode.commands.registerCommand('panoptent.chooseDesignFile', () => {
      const e = getEngine(context);
      if (!e) return vscode.window.showErrorMessage(t('ext.openFolder'));
      return pickDesignFile(e);
    }),
    vscode.commands.registerCommand('panoptent.connectClaudeCode', async () => {
      if (!mcp?.port) {
        vscode.window.showWarningMessage(t('ext.mcp.notRunning'));
        return;
      }
      await mcp.connectClaudeCode(false);
      if (mcp.connected) vscode.window.showInformationMessage(t('ext.mcp.connected'));
    }),
    vscode.commands.registerCommand('panoptent.copyMcpCommand', async () => {
      if (!mcp?.port) {
        vscode.window.showWarningMessage(t('ext.mcp.notRunning'));
        return;
      }
      await vscode.env.clipboard.writeText(mcp.addCommand);
      vscode.window.showInformationMessage(t('ext.mcp.copied', mcp.addCommand));
    }),
  );
}

export function deactivate() {
  current?.dispose();
  bridge?.stop();
  mcp?.stop();
  engine?.dispose();
}

class PreviewPanel {
  private panel: vscode.WebviewPanel;
  private disposeHandlers: (() => void)[] = [];
  private disposed = false;
  private sub: vscode.Disposable;

  static async create(context: vscode.ExtensionContext, engine: Engine, url: string) {
    const overlayPath = path.join(context.extensionPath, 'media', 'overlay.js');
    const i18nPath = path.join(context.extensionPath, 'media', 'i18n.js');
    const proxy = new DevProxy({
      target: url,
      overlayScript: () =>
        fs.readFileSync(i18nPath, 'utf8') +
        `\n;PanoptentI18n.setLang(${JSON.stringify(uiLang())});\n` +
        fs.readFileSync(overlayPath, 'utf8'),
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
    this.engine.dropPages('panel');
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
          vscode.window.showWarningMessage(t('ext.badUrl'));
        }
        break;
      }
      case 'openSource':
        await e.openSource(m.item, !!m.quiet);
        break;
      case 'setupCodeInspector':
        vscode.commands.executeCommand('panoptent.setupCodeInspector');
        break;
      case 'setLang':
        await e.setLang(m.value);
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
      case 'syncState':
        e.syncPage('panel', 'vscode', m);
        break;
      case 'applyEntries':
        await e.applyEntries(m.entries || [], m.pageUrl || this.proxy.targetOrigin, !!m.continueSession, !!m.fromQueue, 'panel');
        break;
      case 'rollback':
        await e.rollback('panel');
        break;
      case 'chooseDesignFile':
        vscode.commands.executeCommand('panoptent.chooseDesignFile');
        break;
      case 'openSettings':
        vscode.commands.executeCommand('workbench.action.openSettings', '@ext:ceritli.panoptent');
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
<html lang="${uiLang()}">
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
    <button id="selBtn" class="tool" aria-pressed="false" data-i18n-title="pn.select.title" title="Seçim modu (Ctrl/Cmd+Shift+E) — Alt basılı tutarak da tıklayabilirsin">
      <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M2 2h4v1.5H3.5V6H2V2zm8 0h4v4h-1.5V3.5H10V2zM2 10h1.5v2.5H6V14H2v-4zm5.2-2.6 7 2.6-3 1.1 2.3 2.3-1.1 1.1-2.3-2.3-1.1 3-1.8-7.8z"/></svg>
      <span data-i18n="pn.select">Seç</span>
    </button>
    <div class="url">
      <button id="reloadBtn" class="icon" data-i18n-title="pn.reload" title="Yenile">↻</button>
      <input id="urlInput" spellcheck="false" data-i18n-aria="pn.url.aria" aria-label="Sayfa adresi">
    </div>
    <div class="seg" role="group" data-i18n-aria="pn.vp.aria" aria-label="Ekran genişliği">
      <button data-vp="full" class="on" data-i18n-title="pn.vp.full.title" data-i18n="pn.vp.full" title="Tam genişlik">Tam</button>
      <button data-vp="1024" title="1024 px" data-i18n="pn.vp.tablet">Tablet</button>
      <button data-vp="390" title="390 px" data-i18n="pn.vp.mobile">Mobil</button>
    </div>
    <div class="seg dock" role="group" data-i18n-aria="pn.dock.aria" aria-label="Panel konumu">
      <button data-dock="left" data-i18n-title="pn.dock.left" title="Panel solda"><svg viewBox="0 0 16 16" width="16" height="16"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor"/><rect x="2" y="3" width="4.5" height="10" fill="currentColor"/></svg></button>
      <button data-dock="bottom" data-i18n-title="pn.dock.bottom" title="Panel altta"><svg viewBox="0 0 16 16" width="16" height="16"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor"/><rect x="2" y="9" width="12" height="4" fill="currentColor"/></svg></button>
      <button data-dock="right" data-i18n-title="pn.dock.right" title="Panel sağda"><svg viewBox="0 0 16 16" width="16" height="16"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor"/><rect x="9.5" y="3" width="4.5" height="10" fill="currentColor"/></svg></button>
    </div>
    <select id="langSel" class="langSel" data-i18n-title="pn.lang.title" data-i18n-aria="pn.lang.title" title="Arayüz dili" aria-label="Arayüz dili">
      <option value="auto" data-i18n="pn.lang.auto">Otomatik (VS Code)</option>
      <option value="en">English</option>
      <option value="tr">Türkçe</option>
    </select>
    <button id="sideToggle" class="tool square" aria-pressed="true" title="Paneli gizle">
      <svg viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M2 3h12v1.5H2zM2 7.25h12v1.5H2zM2 11.5h8v1.5H2z"/></svg>
      <span id="selCount" class="badge" hidden>0</span>
    </button>
  </header>
  <main id="main" class="dock-right">
    <section class="stage" id="stage">
      <div class="frameWrap" id="frameWrap"><iframe id="frame" data-i18n-title="pn.frame.title" title="Önizleme"></iframe></div>
      <div class="qbar" id="qbar" hidden>
        <span class="qinfo" id="qinfo"><span class="qdot"></span><b id="qcount">0</b> <span id="qinfoText">değişiklik bekliyor</span></span>
        <button class="qb" id="qUndo" data-i18n-title="pn.q.undo.title" title="Geri al (Ctrl/Cmd+Z)">↶</button>
        <button class="qb" id="qRedo" data-i18n-title="pn.q.redo.title" title="Yinele (Ctrl/Cmd+Shift+Z)">↷</button>
        <button class="qb" id="qList" data-i18n="pn.q.list">Listele</button>
        <button class="qb" id="qClear" data-i18n="pn.q.clear">Temizle</button>
        <button class="qb pri" id="qApply">Uygula</button>
        <span class="qsep" id="qsep" hidden></span>
        <button class="qb" id="qRollback" hidden data-i18n-title="pn.q.rollback.title" data-i18n="pn.q.rollback" title="Son uygulamada yalnızca Panoptent'in ve onun gönderdiği isteğin yaptığı değişiklikleri geri alır">↶ Son uygulamayı geri al</button>
      </div>
    </section>
    <div class="splitter" id="splitter" data-i18n-title="pn.splitter.title" title="Sürükle: boyutlandır · Çift tık: gizle"></div>
    <aside class="side" id="side">
      <div class="col colSel">
        <div id="support" class="support" hidden></div>
        <div class="sectionHead" id="queueHead" hidden><span data-i18n="pn.queue">Kuyruk</span><button class="link" id="qApply2" data-i18n="pn.queue.applyAll">Hepsini uygula</button></div>
        <div id="queue" class="queue" hidden></div>
        <div class="sectionHead"><span data-i18n="pn.selected">Seçilenler</span><button id="clearBtn" class="link" hidden data-i18n="pn.clear">Temizle</button></div>
        <div id="items" class="items"></div>
      </div>
      <div class="col colCompose">
        <div class="compose">
          <textarea id="prompt" rows="3" data-i18n-ph="pn.prompt.ph" placeholder="Ne değişsin? Örn: bu butonu daha büyük yap ve yeşil tonlarına çevir"></textarea>
          <div class="composeRow">
            <select id="sendTo" class="sendTo" data-i18n-title="pn.sendTo.title" title="İstek nereye gitsin?">
              <option value="claudePanel" data-i18n="pn.sendTo.panel">Claude Code paneli</option>
              <option value="cli" data-i18n="pn.sendTo.cli">Arka planda (CLI)</option>
              <option value="mcp" data-i18n="pn.sendTo.mcp">Claude Code (MCP)</option>
            </select>
            <button id="queueBtn" class="secondary" data-i18n-title="pn.queueBtn.title" data-i18n="pn.queueBtn" title="Kuyruğa ekle (Ctrl/Cmd+Enter)">Kuyruğa</button>
            <button id="sendBtn" class="primary" data-i18n-title="pn.sendBtn.title" title="Hemen gönder (Ctrl/Cmd+Shift+Enter)">Aktar</button>
            <button id="stopBtn" class="danger" hidden data-i18n="pn.stop">Durdur</button>
          </div>
          <div class="composeRow sub">
            <label class="chk" id="contWrap"><input type="checkbox" id="cont" checked> <span id="contLabel">Son konuşmaya ekle</span></label>
            <button id="newSess" class="link" hidden data-i18n="pn.newSess">Yeni oturum</button>
          </div>
          <div class="composeRow sub">
            <label class="chk"><input type="checkbox" id="popChk" checked> <span data-i18n="pn.popChk">Seçince öğenin yanında kutu aç</span></label>
          </div>
          <div class="composeRow sub">
            <label class="chk" data-i18n-title="pn.openSrc.title" title="Seçtiğin öğenin kaynak dosyası, odağı önizlemeden almadan editörde açılır"><input type="checkbox" id="openSrcChk" checked> <span data-i18n="pn.openSrc">Seçince kodunu da yanda aç</span></label>
          </div>
          <div class="composeRow sub">
            <span class="chk" data-i18n-title="pn.design.title" title="Claude değişiklikleri bu dosyadaki tasarım kurallarına göre yapar"><span data-i18n="pn.design">Tasarım kuralları:</span> <button id="designBtn" class="link">—</button></span>
          </div>
        </div>
      </div>
      <div class="col colLog">
        <div class="sectionHead"><span data-i18n="pn.activity">Etkinlik</span></div>
        <div id="log" class="log"><div class="muted" data-i18n="pn.log.empty">Henüz bir şey yok.</div></div>
      </div>
    </aside>
  </main>
</div>
<script nonce="${nonce}" src="${media('i18n.js')}"></script>
<script nonce="${nonce}">PanoptentI18n.setLang(${JSON.stringify(uiLang())});</script>
<script nonce="${nonce}" src="${media('panel.js')}"></script>
</body>
</html>`;
  }
}

function showSetupGuide(context: vscode.ExtensionContext) {
  const tr = path.join(context.extensionPath, 'media', 'SETUP.tr.md');
  const file = uiLang() === 'tr' && fs.existsSync(tr) ? tr : path.join(context.extensionPath, 'media', 'SETUP.md');
  vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(file));
}

/** Dil seçimi: Otomatik / English / Türkçe. Motor olmasa da çalışır (yalnızca ayarı yazar; yayını config dinleyicisi yapar). */
/** Tasarım kuralları dosyasını seçtirir; seçim bu çalışma alanının ayarına (`panoptent.designFile`) yazılır. */
async function pickDesignFile(e: Engine) {
  const cfg = vscode.workspace.getConfiguration('panoptent');
  const cur = (cfg.get<string>('designFile') || '').trim();
  const found = await vscode.workspace.findFiles('**/*.{md,mdx,txt}', '**/{node_modules,.git,dist,build,out,.next,.nuxt,.output,.claude,coverage}/**', 300);
  const rels = found
    .map((u) => path.relative(e.root, u.fsPath).split(path.sep).join('/'))
    .filter((r) => r && !r.startsWith('..'))
    .sort((a, b) => Number(!/design|style|brand|ui/i.test(a)) - Number(!/design|style|brand|ui/i.test(b)) || a.split('/').length - b.split('/').length || a.localeCompare(b));
  type Item = vscode.QuickPickItem & { value?: string; browse?: boolean };
  const items: Item[] = [
    { value: '', label: '$(sparkle) ' + t('ext.design.auto'), description: t('ext.design.autoDesc') },
    { value: 'off', label: '$(circle-slash) ' + t('ext.design.off'), description: t('ext.design.offDesc') },
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    ...rels.map((r) => ({ value: r, label: '$(file) ' + r })),
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    { browse: true, label: '$(folder-opened) ' + t('ext.design.browse') },
  ];
  for (const it of items) if (it.value === cur && !it.browse && it.kind !== vscode.QuickPickItemKind.Separator) it.description = (it.description ? it.description + ' · ' : '') + t('ext.lang.current');
  const pick = await vscode.window.showQuickPick(items, { title: t('ext.design.title'), placeHolder: t('ext.design.ph'), matchOnDescription: true });
  if (!pick) return;
  let value = pick.value;
  if (pick.browse) {
    const uri = (await vscode.window.showOpenDialog({ defaultUri: vscode.Uri.file(e.root), canSelectMany: false, openLabel: t('ext.design.title') }))?.[0];
    if (!uri) return;
    const rel = path.relative(e.root, uri.fsPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return vscode.window.showWarningMessage(t('ext.design.outside'));
    value = rel.split(path.sep).join('/');
  }
  if (value === undefined || value === cur) return;
  await cfg.update('designFile', value, vscode.ConfigurationTarget.Workspace);
  const file = e.designFile();
  if (file) vscode.window.showInformationMessage(t('ext.design.set', file));
}

async function pickLanguage() {
  const cfg = vscode.workspace.getConfiguration('panoptent');
  const cur = cfg.get<string>('language') || 'auto';
  const opts: (vscode.QuickPickItem & { value: string })[] = [
    { value: 'auto', label: t('ext.lang.auto'), description: t('ext.lang.autoDesc') },
    { value: 'en', label: 'English' },
    { value: 'tr', label: 'Türkçe' },
  ];
  for (const o of opts) if (o.value === cur) o.description = (o.description ? o.description + ' · ' : '') + t('ext.lang.current');
  const pick = await vscode.window.showQuickPick(opts, { title: t('ext.lang.title') });
  if (!pick || pick.value === cur) return;
  await cfg.update('language', pick.value, vscode.ConfigurationTarget.Global);
}
