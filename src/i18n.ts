// Extension-host strings (notifications, dialogs, prompts sent to Claude).
// Language: setting `panoptent.language` ("auto" follows VS Code's display language).
// Add a language by adding a block to STRINGS (and to LANGS in media/i18n.js for the UI).
import * as vscode from 'vscode';

export type Lang = 'en' | 'tr';
export const LANG_CODES: Lang[] = ['en', 'tr'];

type Table = Record<string, string>;
const STRINGS: Record<Lang, Table> = { en: {}, tr: {} };

/** Register strings from a module: addStrings({ en: {...}, tr: {...} }). */
export function addStrings(t: Partial<Record<Lang, Table>>) {
  for (const l of Object.keys(t) as Lang[]) Object.assign(STRINGS[l] || (STRINGS[l] = {}), t[l]);
}

export function normLang(v: string | undefined): Lang {
  const l = String(v || '').toLowerCase().split(/[-_]/)[0] as Lang;
  return LANG_CODES.includes(l) ? l : 'en';
}

/** Effective UI language. */
export function uiLang(): Lang {
  const v = vscode.workspace.getConfiguration('panoptent').get<string>('language') || 'auto';
  return v === 'auto' ? normLang(vscode.env.language) : normLang(v);
}

/** Translate: t('key', a, b) replaces {0}, {1}. Falls back to English, then the key. */
export function t(key: string, ...args: (string | number | undefined)[]): string {
  const l = uiLang();
  const s = STRINGS[l]?.[key] ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\d+)\}/g, (_, i) => (args[+i] == null ? '' : String(args[+i])));
}
