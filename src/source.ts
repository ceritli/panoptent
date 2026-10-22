// Seçilen öğenin kaynak dosyasını bulma, açma ve hızlı metin düzenleme.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { addStrings, t } from './i18n';

addStrings({
  en: {
    'ext.qe.empty': 'The old text is empty.',
    'ext.qe.same': 'No change.',
    'ext.qe.notFound': 'The text was not found verbatim in the source file (it may come from a translation, a variable or data).',
    'ext.qe.ambiguous': 'The text appears in more than one place in the file; could not be sure which one.',
    'ext.qe.failed': 'The edit could not be applied.',
    'ext.qe.saved': 'Saved.',
  },
  tr: {
    'ext.qe.empty': 'Eski metin boş.',
    'ext.qe.same': 'Değişiklik yok.',
    'ext.qe.notFound': 'Metin kaynak dosyada birebir bulunamadı (çeviri, değişken veya veriden geliyor olabilir).',
    'ext.qe.ambiguous': 'Metin dosyada birden fazla yerde geçiyor, emin olamadım.',
    'ext.qe.failed': 'Düzenleme uygulanamadı.',
    'ext.qe.saved': 'Kaydedildi.',
  },
});

export interface SourceLoc {
  file: string;
  line: number;
  col: number;
  exact: boolean;
  via: string;
}

/** Overlay'den gelen (göreli/mutlak) yolu çalışma alanındaki gerçek dosyaya çevirir. */
export async function resolveFile(root: string, file: string): Promise<vscode.Uri | undefined> {
  if (!file) return undefined;
  // webpack/vite bazen sorgu ekler: Header.tsx?vue&type=template
  const clean = file.split('?')[0].replace(/^file:\/\//, '');
  const candidates: string[] = [];
  if (path.isAbsolute(clean) || /^[a-zA-Z]:[\\/]/.test(clean)) candidates.push(clean);
  candidates.push(path.join(root, clean));
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return vscode.Uri.file(c);
    } catch {
      /* yok */
    }
  }
  // Son çare: dosya adına göre ara, yol sonu en çok eşleşeni seç
  const base = path.basename(clean);
  const found = await vscode.workspace.findFiles(`**/${base}`, '**/{node_modules,.next,.nuxt,.output,dist,build}/**', 20);
  if (!found.length) return undefined;
  const norm = clean.replace(/\\/g, '/');
  const score = (u: vscode.Uri) => {
    const p = u.fsPath.replace(/\\/g, '/');
    let i = 0;
    while (i < Math.min(p.length, norm.length) && p[p.length - 1 - i] === norm[norm.length - 1 - i]) i++;
    return i;
  };
  return found.sort((a, b) => score(b) - score(a))[0];
}

export async function openAt(uri: vscode.Uri, line: number, col: number, preserveFocus = false) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const pos = new vscode.Position(Math.max(0, line - 1), Math.max(0, col - 1));
  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.One,
    selection: new vscode.Range(pos, pos),
    preserveFocus,
    preview: preserveFocus ? true : undefined,
  });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface QuickEditResult {
  ok: boolean;
  message: string;
  line?: number;
  original?: string; // dosyada gerçekten değiştirilen metin (geri alma için)
}

/**
 * Öğenin metnini kaynak dosyada bulup değiştirir. Kaynak satırına en yakın eşleşmeyi seçer.
 * Satır bilgisi yoksa (ör. Vue bileşen dosyası) yalnızca tek eşleşme varsa değiştirir.
 */
export async function quickEditText(
  uri: vscode.Uri,
  line: number,
  oldText: string,
  newText: string,
): Promise<QuickEditResult> {
  oldText = oldText.trim();
  if (!oldText) return { ok: false, message: t('ext.qe.empty') };
  if (oldText === newText) return { ok: true, message: t('ext.qe.same') };

  const doc = await vscode.workspace.openTextDocument(uri);
  const src = doc.getText();

  // Kelimeler arası boşluk/satır sonu farklarına toleranslı arama
  const words = oldText.split(/\s+/).map(escapeRegex);
  const re = new RegExp(words.join('\\s+'), 'g');
  const matches: { index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    matches.push({ index: m.index, length: m[0].length });
    if (matches.length > 50) break;
  }
  if (!matches.length) {
    return { ok: false, message: t('ext.qe.notFound') };
  }

  let pick = matches[0];
  if (line > 0) {
    const target = doc.offsetAt(new vscode.Position(line - 1, 0));
    pick = matches.reduce((best, cur) =>
      Math.abs(cur.index - target) < Math.abs(best.index - target) ? cur : best,
    );
    const pickLine = doc.positionAt(pick.index).line + 1;
    if (Math.abs(pickLine - line) > 40 && matches.length > 1) {
      return { ok: false, message: t('ext.qe.ambiguous') };
    }
  } else if (matches.length > 1) {
    return { ok: false, message: t('ext.qe.ambiguous') };
  }

  const range = new vscode.Range(doc.positionAt(pick.index), doc.positionAt(pick.index + pick.length));
  const edit = new vscode.WorkspaceEdit();
  edit.replace(uri, range, newText);
  const applied = await vscode.workspace.applyEdit(edit);
  if (!applied) return { ok: false, message: t('ext.qe.failed') };
  await doc.save();
  return { ok: true, message: t('ext.qe.saved'), line: range.start.line + 1, original: src.slice(pick.index, pick.index + pick.length) };
}
