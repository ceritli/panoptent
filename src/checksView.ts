// Test ve Karar — VS Code tarafı: Panoptent görünümündeki konu listesi ve "Panoptent: Test ve Kararlar" komutu.
// Konuların kendisi .panoptent/checks altındaki JSON dosyalarıdır (bkz. checks.ts).

import * as vscode from 'vscode';
import type { Engine } from './engine';
import { summarize, type CheckTopic } from './checks';
import { addStrings, t } from './i18n';

addStrings({
  en: {
    'ext.ck.title': 'Panoptent: Test and Decisions',
    'ext.ck.ph': 'Open topics. Pick one to open its JSON file.',
    'ext.ck.show': 'Show the panel on the page',
    'ext.ck.showDesc': 'Opens the Test and Decisions panel in the preview / Chrome',
    'ext.ck.page': 'Open as a full page',
    'ext.ck.pageDesc': 'All topics in an editor tab, with filters',
    'ext.ck.open': 'Open topics',
    'ext.ck.archive': 'Archive (closed)',
    'ext.ck.counts': '{0}/{1} tests ok · {2} problem(s) · {3}/{4} decisions',
    'ext.ck.closed': 'closed {0}',
    'ext.ck.none': 'No open topics. An agent adds them with the Panoptent MCP tool save_check_topic.',
    'ext.ck.api': 'Copy the local HTTP API address and token',
    'ext.ck.apiCopied': 'Copied the Test and Decisions HTTP API details (valid until VS Code restarts).',
    'ext.ck.noMcp': 'The Panoptent MCP server is not running, so the HTTP API is off.',
    'ext.ck.errors': '{0} file(s) could not be read: {1}',
    'ext.ck.name': 'Your name on marks: {0}',
    'ext.ck.nameFrom': 'from {0}. Wrong? Set panoptent.checks.userName',
    'ext.ck.nameWait': 'Your name on marks: checking GitHub CLI…',
    'ext.ck.src.setting': 'the Panoptent setting',
    'ext.ck.src.github-cli': 'GitHub CLI (gh)',
    'ext.ck.src.git-github-user': 'git config github.user',
    'ext.ck.src.git-user-name': 'git config user.name (not a GitHub user name)',
    'ext.ck.src.os': 'the operating-system user (not a GitHub user name)',
  },
  tr: {
    'ext.ck.title': 'Panoptent: Test ve Kararlar',
    'ext.ck.ph': 'Açık konular. JSON dosyasını açmak için birini seç.',
    'ext.ck.show': 'Paneli sayfada göster',
    'ext.ck.showDesc': 'Test ve Karar panelini önizlemede / Chrome’da açar',
    'ext.ck.page': 'Tam sayfa aç',
    'ext.ck.pageDesc': 'Bütün konular bir editör sekmesinde, süzgeçlerle',
    'ext.ck.open': 'Açık konular',
    'ext.ck.archive': 'Arşiv (kapatılanlar)',
    'ext.ck.counts': '{0}/{1} test tamam · {2} sorun · {3}/{4} karar',
    'ext.ck.closed': '{0} kapatıldı',
    'ext.ck.none': 'Açık konu yok. Ajan konuları Panoptent MCP aracı save_check_topic ile ekler.',
    'ext.ck.api': 'Yerel HTTP API adresini ve jetonunu kopyala',
    'ext.ck.apiCopied': 'Test ve Karar HTTP API bilgileri kopyalandı (VS Code yeniden başlayana kadar geçerli).',
    'ext.ck.noMcp': 'Panoptent MCP sunucusu çalışmıyor; HTTP API kapalı.',
    'ext.ck.errors': '{0} dosya okunamadı: {1}',
    'ext.ck.name': 'İşaretlerdeki adın: {0}',
    'ext.ck.nameFrom': 'kaynak: {0}. Yanlışsa panoptent.checks.userName ayarından düzelt',
    'ext.ck.nameWait': 'İşaretlerdeki adın: GitHub CLI soruluyor…',
    'ext.ck.src.setting': 'Panoptent ayarı',
    'ext.ck.src.github-cli': 'GitHub CLI (gh)',
    'ext.ck.src.git-github-user': 'git config github.user',
    'ext.ck.src.git-user-name': 'git config user.name (GitHub kullanıcı adı değil)',
    'ext.ck.src.os': 'işletim sistemi kullanıcısı (GitHub kullanıcı adı değil)',
  },
});

const OPEN_NAME_SETTING = { command: 'workbench.action.openSettings', title: 'panoptent.checks.userName', arguments: ['panoptent.checks.userName'] };

/** "İşaretlerdeki adın: x" satırı; gh henüz sorulmadıysa bekleme metni (bitince `onReady` çağrılır). */
function nameLine(e: Engine, onReady?: () => void): { label: string; detail: string; ok: boolean } {
  const k = e.users.known();
  if (!k) {
    if (onReady) e.users.warm().then(onReady, onReady);
    return { label: t('ext.ck.nameWait'), detail: '', ok: false };
  }
  return { label: t('ext.ck.name', k.name), detail: t('ext.ck.nameFrom', t('ext.ck.src.' + k.source)), ok: k.source === 'setting' || k.source === 'github-cli' || k.source === 'git-github-user' };
}

function countsText(tp: CheckTopic) {
  const c = summarize(tp);
  return t('ext.ck.counts', c.ok, c.tests, c.bad, c.decided, c.decisions);
}

/** Panoptent görünümündeki "Test ve Kararlar" listesi: açık konular; tıklayınca JSON dosyası açılır. */
export class ChecksTree implements vscode.TreeDataProvider<vscode.TreeItem> {
  private changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(private engine: () => Engine | undefined) {}

  refresh() {
    this.changed.fire();
  }

  getTreeItem(x: vscode.TreeItem) {
    return x;
  }

  getChildren(): vscode.TreeItem[] {
    const e = this.engine();
    if (!e) return [];
    const { topics } = e.checks.list('open');
    if (!topics.length) return []; // boşken karşılama metni görünsün
    const n = nameLine(e, () => this.refresh());
    const who = new vscode.TreeItem(n.label, vscode.TreeItemCollapsibleState.None);
    who.description = n.detail;
    who.tooltip = n.detail;
    who.iconPath = new vscode.ThemeIcon(n.ok ? 'account' : 'warning');
    who.command = OPEN_NAME_SETTING;
    return [who, ...topics.map((tp) => {
      const c = summarize(tp);
      const it = new vscode.TreeItem(tp.name, vscode.TreeItemCollapsibleState.None);
      it.description = countsText(tp);
      it.tooltip = [tp.name, tp.date, tp.lead].filter(Boolean).join('\n');
      it.iconPath = new vscode.ThemeIcon(c.bad ? 'warning' : c.complete ? 'pass' : 'checklist');
      const uri = vscode.Uri.file(e.checks.file('open', tp.id));
      it.resourceUri = uri;
      // Tıklayınca konu Test ve Kararlar sayfasında açılır (JSON dosyası komut listesinden açılır)
      it.command = { command: 'panoptent.checksPage', title: tp.name, arguments: [tp.id] };
      return it;
    })];
  }
}

type Item = vscode.QuickPickItem & { run?: () => unknown };

/** "Panoptent: Test ve Kararlar": paneli sayfada göster, konunun JSON dosyasını aç, HTTP API bilgisini kopyala. */
export async function pickChecks(e: Engine, showPanel: () => unknown, api: () => { url: string; token: string } | undefined) {
  const open = e.checks.list('open');
  const arch = e.checks.list('archive').topics.sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt))).slice(0, 15);
  const openFile = (place: 'open' | 'archive', id: string) => vscode.window.showTextDocument(vscode.Uri.file(e.checks.file(place, id)));
  await e.users.warm(); // gh en fazla birkaç saniye; sonuç oturum boyunca önbellekte
  const n = nameLine(e);
  const items: Item[] = [
    { label: '$(eye) ' + t('ext.ck.show'), description: t('ext.ck.showDesc'), run: showPanel },
    { label: '$(open-preview) ' + t('ext.ck.page'), description: t('ext.ck.pageDesc'), run: () => vscode.commands.executeCommand('panoptent.checksPage') },
    { label: (n.ok ? '$(account) ' : '$(warning) ') + n.label, description: n.detail, run: () => vscode.commands.executeCommand(OPEN_NAME_SETTING.command, ...OPEN_NAME_SETTING.arguments) },
  ];
  items.push({ label: t('ext.ck.open'), kind: vscode.QuickPickItemKind.Separator });
  if (!open.topics.length) items.push({ label: '$(info) ' + t('ext.ck.none') });
  for (const tp of open.topics) {
    items.push({ label: '$(checklist) ' + tp.name, description: countsText(tp), detail: e.checks.rel('open', tp.id), run: () => openFile('open', tp.id) });
  }
  if (arch.length) {
    items.push({ label: t('ext.ck.archive'), kind: vscode.QuickPickItemKind.Separator });
    for (const tp of arch) {
      items.push({ label: '$(archive) ' + tp.name, description: t('ext.ck.closed', (tp.closedAt || '').slice(0, 10)), detail: e.checks.rel('archive', tp.id), run: () => openFile('archive', tp.id) });
    }
  }
  items.push({ label: '', kind: vscode.QuickPickItemKind.Separator });
  items.push({
    label: '$(copy) ' + t('ext.ck.api'),
    run: async () => {
      const a = api();
      if (!a) return vscode.window.showWarningMessage(t('ext.ck.noMcp'));
      await vscode.env.clipboard.writeText(`POST ${a.url}/<list|get|result|pick|close|reopen>\nAuthorization: Bearer ${a.token}\nContent-Type: application/json`);
      vscode.window.showInformationMessage(t('ext.ck.apiCopied'));
    },
  });
  if (open.errors.length) vscode.window.showWarningMessage(t('ext.ck.errors', open.errors.length, open.errors.map((x) => `${x.file} (${x.error})`).join('; ')));
  const pick = await vscode.window.showQuickPick(items, { title: t('ext.ck.title'), placeHolder: t('ext.ck.ph'), matchOnDescription: true, matchOnDetail: true });
  await pick?.run?.();
}
