// Testler için küçük bir `vscode` modülü yerine geçen sahte. Yalnızca Panoptent'in kullandığı parçalar.
// esbuild ile paketlenirken `vscode` buraya yönlendirilir (test/run.mjs). Ayarlar ve pencere davranışı
// `stub` nesnesinden değiştirilir (ör. stub.config['panoptent.mcpPort'] = 48821).

import * as fs from 'fs';
import * as path from 'path';

type Fn = (...a: any[]) => any;

export const stub = {
  config: {} as Record<string, unknown>,
  language: 'en',
  workspaceRoot: '',
  inputBox: undefined as string | undefined,
  /** Önizleme paneli oluşturulunca çağrılır (e2e: HTML'i tarayıcıya verir, mesajları taşır). */
  onWebview: undefined as undefined | ((w: FakeWebviewPanel) => void),
  mediaBase: 'http://127.0.0.1:1/media',
  messages: [] as { kind: string; text: string }[],
  clipboard: '',
  opened: [] as string[],
};

class Emitter<T = any> {
  private ls = new Set<(e: T) => void>();
  event = (l: (e: T) => void) => {
    this.ls.add(l);
    return { dispose: () => this.ls.delete(l) };
  };
  fire(e: T) {
    for (const l of [...this.ls]) l(e);
  }
  dispose() {
    this.ls.clear();
  }
}
export { Emitter as EventEmitter };

export class Disposable {
  constructor(private fn: Fn = () => {}) {}
  dispose() {
    this.fn();
  }
}

export class Uri {
  private constructor(readonly scheme: string, readonly fsPath: string, readonly raw: string) {}
  static file(p: string) {
    return new Uri('file', p, 'file://' + p);
  }
  static parse(s: string) {
    return new Uri(s.split(':')[0], s.startsWith('file://') ? s.slice(7) : s, s);
  }
  get path() {
    return this.fsPath;
  }
  toString() {
    return this.raw;
  }
}

export class RelativePattern {
  constructor(readonly base: string, readonly pattern: string) {}
}

export enum ViewColumn { One = 1, Two = 2, Beside = -2 }
export enum ConfigurationTarget { Global = 1, Workspace = 2, WorkspaceFolder = 3 }
export enum QuickPickItemKind { Separator = -1, Default = 0 }
export enum TreeItemCollapsibleState { None = 0, Collapsed = 1, Expanded = 2 }
export enum StatusBarAlignment { Left = 1, Right = 2 }

export class TreeItem {
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  resourceUri?: Uri;
  command?: unknown;
  constructor(readonly label: string, readonly collapsibleState?: TreeItemCollapsibleState) {}
}
export class ThemeIcon {
  constructor(readonly id: string) {}
}
export class Position {
  constructor(readonly line: number, readonly character: number) {}
}
export class Range {
  constructor(readonly start: Position, readonly end: Position) {}
}
export class Selection extends Range {}
export class WorkspaceEdit {}

function globRe(pattern: string) {
  let s = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      s += pattern[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += pattern[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') s += '[^/]*';
    else s += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + s + '$');
}

const watchers = new Set<{ close(): void }>();
function createFileSystemWatcher(p: RelativePattern) {
  const change = new Emitter<Uri>(), create = new Emitter<Uri>(), del = new Emitter<Uri>();
  const re = globRe(p.pattern);
  const fire = (rel: string) => {
    if (!re.test(rel)) return;
    const abs = path.join(p.base, ...rel.split('/'));
    const uri = Uri.file(abs);
    if (fs.existsSync(abs)) change.fire(uri);
    else del.fire(uri);
  };
  let w: fs.FSWatcher | undefined;
  try {
    w = fs.watch(p.base, { recursive: true }, (_ev, name) => {
      if (name) fire(String(name).split(path.sep).join('/'));
    });
    watchers.add(w);
  } catch {
    /* klasör yok */
  }
  // Linux'ta Node'un recursive fs.watch'ı, yerine rename edilen (tmp + rename) dosyanın sonraki değişikliklerini
  // kaçırabiliyor. Sahte izleyici bu yüzden kalıbın sabit önekini ayrıca 100 ms'de bir tarar (yalnız testler için).
  const prefix = p.pattern.slice(0, Math.max(0, p.pattern.indexOf('*'))).replace(/\/[^/]*$/, '');
  const seen = new Map<string, number>();
  const scan = (first: boolean) => {
    const now = new Map<string, number>();
    const walk = (dir: string, rel: string) => {
      let list: fs.Dirent[] = [];
      try {
        list = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const d of list) {
        if (d.name === '.git' || d.name === 'node_modules') continue;
        const r = rel ? rel + '/' + d.name : d.name;
        if (d.isDirectory()) walk(path.join(dir, d.name), r);
        else if (re.test(r)) {
          try {
            const st = fs.statSync(path.join(dir, d.name));
            now.set(r, st.mtimeMs * 1e3 + st.ino + st.size);
          } catch {
            /* silindi */
          }
        }
      }
    };
    walk(prefix ? path.join(p.base, ...prefix.split('/')) : p.base, prefix);
    if (!first) {
      for (const [r, v] of now) if (seen.get(r) !== v) fire(r);
      for (const r of seen.keys()) if (!now.has(r)) fire(r);
    }
    seen.clear();
    now.forEach((v, r) => seen.set(r, v));
  };
  scan(true);
  const timer = setInterval(() => scan(false), 100);
  const poll = { close: () => clearInterval(timer) };
  watchers.add(poll);
  return {
    onDidChange: change.event,
    onDidCreate: create.event,
    onDidDelete: del.event,
    dispose: () => {
      w?.close();
      if (w) watchers.delete(w);
      poll.close();
      watchers.delete(poll);
    },
  };
}
export function closeWatchers() {
  for (const w of watchers) w.close();
  watchers.clear();
}

const configListeners = new Emitter<any>();
export const workspace = {
  get workspaceFolders() {
    return stub.workspaceRoot ? [{ uri: Uri.file(stub.workspaceRoot), name: path.basename(stub.workspaceRoot), index: 0 }] : undefined;
  },
  get name() {
    return stub.workspaceRoot ? path.basename(stub.workspaceRoot) : undefined;
  },
  textDocuments: [] as unknown[],
  getConfiguration(section = '') {
    const key = (k: string) => (section ? section + '.' + k : k);
    return {
      get: <T>(k: string, d?: T) => (key(k) in stub.config ? (stub.config[key(k)] as T) : d),
      update: async (k: string, v: unknown) => {
        stub.config[key(k)] = v;
        configListeners.fire({ affectsConfiguration: (s: string) => s === key(k) || key(k).startsWith(s + '.') });
      },
    };
  },
  onDidChangeConfiguration: configListeners.event,
  onDidChangeWorkspaceFolders: new Emitter().event,
  createFileSystemWatcher,
  saveAll: async () => true,
  findFiles: async () => [],
  openTextDocument: async (u: Uri) => ({ uri: u, lineCount: 1, lineAt: () => ({ range: { end: new Position(0, 0) } }) }),
  fs: { delete: async () => {} },
};

export interface FakeWebviewPanel {
  html: string;
  post: (m: unknown) => void;
  receive: (m: unknown) => void;
  posted: unknown[];
  disposed: boolean;
}

export const window = {
  createOutputChannel: (_n: string) => ({ appendLine: (s: string) => stub.messages.push({ kind: 'log', text: s }), show() {}, dispose() {} }),
  createStatusBarItem: () => ({ show() {}, hide() {}, dispose() {}, text: '', tooltip: '', command: '' }),
  registerTreeDataProvider: (_id: string, _p: unknown) => new Disposable(),
  showInformationMessage: async (text: string) => (stub.messages.push({ kind: 'info', text }), undefined),
  showWarningMessage: async (text: string) => (stub.messages.push({ kind: 'warn', text }), undefined),
  showErrorMessage: async (text: string) => (stub.messages.push({ kind: 'error', text }), undefined),
  showInputBox: async () => stub.inputBox,
  showQuickPick: async () => undefined,
  showOpenDialog: async () => undefined,
  showTextDocument: async (u: Uri) => (stub.opened.push(u.fsPath), {}),
  tabGroups: { all: [], close: async () => {} },
  createWebviewPanel(_type: string, _title: string, _col: unknown, _opts: unknown) {
    const recv = new Emitter<unknown>();
    const disp = new Emitter<void>();
    const fake: FakeWebviewPanel = {
      html: '',
      post: () => {},
      receive: (m) => recv.fire(m),
      posted: [],
      disposed: false,
    };
    const panel = {
      webview: {
        set html(v: string) {
          fake.html = v;
        },
        get html() {
          return fake.html;
        },
        cspSource: new URL(stub.mediaBase).origin,
        asWebviewUri: (u: Uri) => Uri.parse(stub.mediaBase + '/' + path.basename(u.fsPath)),
        postMessage: async (m: unknown) => {
          fake.posted.push(m);
          fake.post(m);
          return true;
        },
        onDidReceiveMessage: recv.event,
      },
      iconPath: undefined as unknown,
      onDidDispose: disp.event,
      reveal() {},
      dispose() {
        if (fake.disposed) return;
        fake.disposed = true;
        disp.fire();
      },
    };
    setTimeout(() => stub.onWebview?.(fake), 0);
    return panel;
  },
};

const commandTable = new Map<string, Fn>();
export const commands = {
  registerCommand: (id: string, fn: Fn) => {
    commandTable.set(id, fn);
    return new Disposable(() => commandTable.delete(id));
  },
  executeCommand: async (id: string, ...args: unknown[]) => {
    const f = commandTable.get(id);
    if (f) return f(...args);
    if (id === 'vscode.open') stub.opened.push(String((args[0] as Uri)?.fsPath));
    return undefined;
  },
  getCommands: async () => [...commandTable.keys()],
};

export const env = {
  get language() {
    return stub.language;
  },
  clipboard: {
    writeText: async (s: string) => {
      stub.clipboard = s;
    },
    readText: async () => stub.clipboard,
  },
  asExternalUri: async (u: Uri) => u,
  openExternal: async () => true,
};

export const extensions = { getExtension: (_id: string) => undefined, all: [] as unknown[] };

/** Sahte ExtensionContext (bellekte). */
export function fakeContext(extensionPath: string, version = '0.0.0-test') {
  const memento = () => {
    const m = new Map<string, unknown>();
    return { get: <T>(k: string, d?: T) => (m.has(k) ? (m.get(k) as T) : d), update: async (k: string, v: unknown) => void m.set(k, v), keys: () => [...m.keys()] };
  };
  return {
    subscriptions: [] as { dispose(): void }[],
    extensionPath,
    extension: { packageJSON: { version } },
    workspaceState: memento(),
    globalState: memento(),
  };
}
