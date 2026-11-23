// Test ve Kararlar — VS Code'da tam sayfa (editör sekmesi). Bütün açık konular, süzgeçler, işaretleme ve karar seçme.
// Yazma sayfadaki panelle aynı yoldan gider (engine.checksMessage → tek alan + kilit); dosyalar değişince (panelden,
// git'ten, ajandan) motorun yayınladığı yeni hal bu sekmeye de gelir. Konu metni veridir: sayfada textContent ile basılır.

import * as vscode from 'vscode';
import * as path from 'path';
import { randomBytes } from 'crypto';
import type { Engine } from './engine';
import { isId } from './checks';
import { addStrings, t, uiLang } from './i18n';

addStrings({
  en: { 'ext.cp.title': 'Test and Decisions' },
  tr: { 'ext.cp.title': 'Test ve Kararlar' },
});

/** Motorun bu sekmeye yönelik mesajları için istemci adı. */
export const CHECKS_PAGE_CLIENT = 'checksPage';

export interface ChecksPageHost {
  /** Adımın adresini aç: önizleme açıksa orada, değilse tarayıcıda. */
  openUrl(url: string): void;
  showOnPage(): void;
}

export class ChecksPage {
  private static current: ChecksPage | undefined;

  static show(context: vscode.ExtensionContext, engine: Engine, host: ChecksPageHost): ChecksPage {
    if (ChecksPage.current) {
      ChecksPage.current.panel.reveal();
      return ChecksPage.current;
    }
    return (ChecksPage.current = new ChecksPage(context, engine, host));
  }

  /** Ayar ya da dil değişince açık sekmeye bildir. */
  static refreshWho() {
    ChecksPage.current?.sendWho();
  }

  private panel: vscode.WebviewPanel;
  private subs: vscode.Disposable[] = [];
  private disposed = false;

  private constructor(
    private context: vscode.ExtensionContext,
    private engine: Engine,
    private host: ChecksPageHost,
  ) {
    const media = vscode.Uri.file(path.join(context.extensionPath, 'media'));
    this.panel = vscode.window.createWebviewPanel('panoptent.checksPage', t('ext.cp.title'), vscode.ViewColumn.Active, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [media],
    });
    this.panel.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.svg'));
    this.panel.webview.html = this.html();
    this.subs.push(
      this.panel.webview.onDidReceiveMessage((m) => this.onMessage(m)),
      this.panel.onDidDispose(() => this.dispose()),
      // motorun yayınladığı yeni hal (her yazmada ve dosya değişince) ve bu sekmeye yönelik yanıtlar
      engine.on((msg, to) => {
        if (to && to !== CHECKS_PAGE_CLIENT) return;
        if (msg?.type === 'checks' || msg?.type === 'checksRes') this.post(msg);
        if (msg?.type === 'lang') {
          this.post(msg);
          this.panel.title = t('ext.cp.title');
        }
      }),
    );
  }

  private post(m: unknown) {
    if (!this.disposed) this.panel.webview.postMessage(m);
  }

  private sendWho() {
    const k = this.engine.users.known();
    if (k) this.post({ type: 'who', who: k });
    else this.engine.users.warm().then(() => this.post({ type: 'who', who: this.engine.users.known() || null }));
  }

  private onMessage(m: any) {
    switch (m?.type) {
      case 'ready':
        this.post({ type: 'init', lang: uiLang(), who: this.engine.users.known() || null });
        this.sendWho();
        this.engine.checksMessage({ op: 'list', reqId: 'init' }, CHECKS_PAGE_CLIENT);
        break;
      case 'checksReq':
        // yalnızca okuma ve tek alan yazma; kapatma / yeniden açma burada yok (ajan ya da HTTP API)
        if (m.op === 'list' || m.op === 'result' || m.op === 'pick') this.engine.checksMessage(m, CHECKS_PAGE_CLIENT);
        break;
      case 'openFile':
        if (isId(m.topic)) vscode.window.showTextDocument(vscode.Uri.file(this.engine.checks.file('open', m.topic)));
        break;
      case 'openUrl':
        if (typeof m.url === 'string' && m.url.length <= 2000) this.host.openUrl(m.url);
        break;
      case 'showOnPage':
        this.host.showOnPage();
        break;
      case 'nameSetting':
        vscode.commands.executeCommand('workbench.action.openSettings', 'panoptent.checks.userName');
        break;
    }
  }

  private html(): string {
    const w = this.panel.webview;
    const media = (f: string) => w.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', f)));
    const nonce = randomBytes(18).toString('base64').replace(/[^A-Za-z0-9]/g, '');
    const lang = uiLang();
    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource}; script-src 'nonce-${nonce}'; img-src ${w.cspSource}; font-src ${w.cspSource};">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${media('checks-page.css')}">
<title>${t('ext.cp.title')}</title>
</head>
<body>
<div id="app">
  <header class="top"><div class="topIn">
    <h1 id="title"></h1><span class="sum" id="sum"></span>
    <div class="filters" id="filters" role="group"></div>
    <div class="who" id="who"></div>
  </div><p class="warn" id="warn"></p></header>
  <div class="layout"><nav class="nav" id="nav"></nav><main id="main"></main></div>
  <div class="msg" id="msg" role="status" aria-live="polite" hidden></div>
</div>
<script nonce="${nonce}" src="${media('i18n.js')}"></script>
<script nonce="${nonce}">PanoptentI18n.setLang(${JSON.stringify(lang)});</script>
<script nonce="${nonce}" src="${media('checks.js')}"></script>
<script nonce="${nonce}" src="${media('checks-page.js')}"></script>
</body>
</html>`;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    ChecksPage.current = undefined;
    this.subs.forEach((d) => d.dispose());
    this.panel.dispose();
  }
}
