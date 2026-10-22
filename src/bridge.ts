// Chrome eklentisi ile VS Code arasındaki yerel köprü.
// Yalnızca 127.0.0.1 üzerinde dinler, yalnızca tarayıcı eklentisi kökenlerinden
// (chrome-extension://) gelen bağlantıları kabul eder ve ilk bağlantıda kullanıcıdan
// onay ister. Onaylanan tarayıcıya bir anahtar verilir; sonraki bağlantılar bu anahtarla olur.

import * as vscode from 'vscode';
import * as http from 'http';
import * as crypto from 'crypto';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import type { Engine } from './engine';

interface Conn {
  id: string;
  ws: WebSocket;
  authed: boolean;
  browser: string;
}

const TOKENS_KEY = 'panoptent.chromeTokens';
export const PORT_RANGE = 10;

export class Bridge {
  private server?: http.Server;
  private wss?: WebSocketServer;
  private conns = new Map<string, Conn>();
  private seq = 0;
  private sub?: vscode.Disposable;
  private status: vscode.StatusBarItem;
  port = 0;

  constructor(
    private context: vscode.ExtensionContext,
    private engine: Engine,
    private output: vscode.OutputChannel,
  ) {
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.status.command = 'panoptent.chromeStatus';
    this.updateStatus();
  }

  private get workspaceName() {
    return vscode.workspace.name || path.basename(this.engine.root);
  }

  async start() {
    const base = vscode.workspace.getConfiguration('panoptent').get<number>('bridgePort') || 47811;
    for (let p = base; p < base + PORT_RANGE; p++) {
      try {
        await this.listen(p);
        this.port = p;
        this.output.appendLine(`Chrome köprüsü hazır: ws://127.0.0.1:${p} (${this.workspaceName})`);
        break;
      } catch {
        /* port dolu (başka VS Code penceresi) — sıradakini dene */
      }
    }
    if (!this.port) throw new Error(`${base}-${base + PORT_RANGE - 1} aralığında boş port yok`);
    this.sub = this.engine.on((msg, to) => this.route(msg, to));
    this.updateStatus();
  }

  private listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        // basit sağlık kontrolü (eklenti hangi pencere olduğunu görebilsin)
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ app: 'panoptent', workspace: this.workspaceName }));
      });
      const wss = new WebSocketServer({
        server,
        verifyClient: (info: { origin: string }) => /^(chrome|moz)-extension:\/\//.test(info.origin || ''),
      });
      wss.on('connection', (ws, req) => this.onConnection(ws, String(req.headers.origin || '')));
      wss.on('error', () => {}); // port hatası sunucu üzerinden ele alınıyor
      server.once('error', (err) => {
        wss.close();
        reject(err);
      });
      server.listen(port, '127.0.0.1', () => {
        server.off('error', reject);
        this.server = server;
        this.wss = wss;
        resolve();
      });
    });
  }

  stop() {
    this.sub?.dispose();
    for (const c of this.conns.values()) c.ws.close();
    this.conns.clear();
    this.wss?.close();
    this.server?.close();
    this.status.dispose();
  }

  dropAll() {
    for (const c of this.conns.values()) c.ws.close(4001, 'eşleştirme silindi');
    this.conns.clear();
    this.updateStatus();
  }

  private send(c: Conn, msg: any) {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
  }

  private welcome(c: Conn) {
    this.send(c, {
      type: 'welcome',
      workspace: { name: this.workspaceName, root: this.engine.root, port: this.port },
      ...this.engine.settings(),
    });
  }

  private onConnection(ws: WebSocket, origin: string) {
    const c: Conn = { id: 'c' + ++this.seq, ws, authed: false, browser: origin };
    this.conns.set(c.id, c);
    ws.on('message', (data) => {
      let m: any;
      try {
        m = JSON.parse(String(data));
      } catch {
        return;
      }
      this.onMessage(c, m).catch((err) => this.output.appendLine('Köprü hatası: ' + err.message));
    });
    ws.on('close', () => {
      this.conns.delete(c.id);
      this.updateStatus();
    });
    this.send(c, { type: 'hi', workspace: { name: this.workspaceName, root: this.engine.root, port: this.port } });
  }

  private tokens(): string[] {
    return this.context.globalState.get<string[]>(TOKENS_KEY) || [];
  }

  private async pair(c: Conn) {
    this.send(c, { type: 'pairing' });
    const pick = await vscode.window.showInformationMessage(
      `Chrome'daki Panoptent eklentisi bu çalışma alanına (${this.workspaceName}) bağlanmak istiyor. İzin verirsen Chrome'da seçtiğin öğeler ve istekler buraya gelir.`,
      { modal: true },
      'İzin ver',
    );
    if (pick !== 'İzin ver') {
      this.send(c, { type: 'denied' });
      c.ws.close(4003, 'reddedildi');
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    await this.context.globalState.update(TOKENS_KEY, [...this.tokens(), token].slice(-10));
    c.authed = true;
    this.send(c, { type: 'paired', token });
    this.welcome(c);
    this.updateStatus();
  }

  private async onMessage(c: Conn, m: any) {
    if (!c.authed) {
      if (m.type !== 'hello') return;
      if (m.token && this.tokens().includes(m.token)) {
        c.authed = true;
        this.welcome(c);
        this.updateStatus();
      } else if (m.pair) {
        await this.pair(c);
      } else {
        this.send(c, { type: 'needPair' });
      }
      return;
    }
    const client = `${c.id}:${m.tab ?? 'x'}`;
    const e = this.engine;
    switch (m.type) {
      case 'getState':
        this.welcome(c);
        break;
      case 'applyEntries':
        await e.applyEntries(m.entries || [], m.pageUrl || '', !!m.continueSession, !!m.fromQueue, client);
        break;
      case 'rollback':
        await e.rollback(client);
        break;
      case 'openSource':
        await e.openSource(m.item, !!m.quiet);
        break;
      case 'openFile':
        await e.openFile(m.file);
        break;
      case 'quickEdit':
        await e.quickEdit(m.item, m.newText, client);
        break;
      case 'setSendTo':
        await e.setSendTo(m.value);
        break;
      case 'setOpenOnSelect':
        await e.setOpenOnSelect(!!m.value);
        break;
      case 'setLang':
        await e.setLang(m.value);
        break;
      case 'stop':
        e.runner.stop();
        break;
      case 'newSession':
        e.newSession();
        break;
      case 'setupCodeInspector':
        vscode.commands.executeCommand('panoptent.setupCodeInspector');
        break;
      case 'focusVSCode':
        vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        break;
    }
  }

  /** Motor olaylarını ilgili Chrome sekmesine (veya herkese) iletir. */
  private route(msg: any, to?: string) {
    for (const c of this.conns.values()) {
      if (!c.authed) continue;
      if (!to) this.send(c, { ...msg, tab: null });
      else if (to.startsWith(c.id + ':')) {
        const tab = to.slice(c.id.length + 1);
        this.send(c, { ...msg, tab: tab === 'x' ? null : Number(tab) });
      }
    }
  }

  private updateStatus() {
    const n = [...this.conns.values()].filter((c) => c.authed).length;
    if (!this.port) {
      this.status.hide();
      return;
    }
    this.status.text = n ? `$(eye) Chrome ${n > 1 ? n : ''}`.trim() : '$(eye)';
    this.status.tooltip = n
      ? `Panoptent: Chrome bağlı (${this.workspaceName}, port ${this.port})`
      : `Panoptent: Chrome köprüsü hazır (port ${this.port}). Chrome eklentisinden bağlan.`;
    this.status.show();
  }

  showStatus() {
    const n = [...this.conns.values()].filter((c) => c.authed).length;
    vscode.window.showInformationMessage(
      this.port
        ? `Panoptent Chrome köprüsü: port ${this.port}, ${n} bağlı tarayıcı. Çalışma alanı: ${this.workspaceName}.`
        : 'Panoptent Chrome köprüsü çalışmıyor.',
      'Eşleştirmeleri sil',
    ).then((p) => {
      if (p === 'Eşleştirmeleri sil') vscode.commands.executeCommand('panoptent.forgetChrome');
    });
  }
}
