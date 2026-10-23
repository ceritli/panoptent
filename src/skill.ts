// Installs the `/panoptent` Claude Code skill (personal scope: ~/.claude/skills/panoptent/SKILL.md),
// which provides `/panoptent live`, `/panoptent stop` and `/panoptent`. The template lives in
// media/claude-skill/SKILL.md and carries a version marker; a file without the marker belongs to the
// user and is never touched.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addStrings, t } from './i18n';

addStrings({
  en: {
    'ext.skill.ask': 'Add the /panoptent command to Claude Code? Then “/panoptent live” keeps a Claude Code conversation listening, and Apply in the page goes straight to it (no paste, no Enter). It is saved to {0}.',
    'ext.skill.install': 'Add command',
    'ext.skill.later': 'Not now',
    'ext.skill.done': 'Added. In Claude Code, type /panoptent live in a new conversation (in this project), then use Apply in the page.',
    'ext.skill.foreign': 'There is already a /panoptent skill at {0} that Panoptent did not create, so it was left as is.',
    'ext.skill.failed': 'Could not add the /panoptent command: {0}',
    'ext.skill.updated': 'Updated the /panoptent Claude Code command to the latest version.',
  },
  tr: {
    'ext.skill.ask': 'Claude Code’a /panoptent komutu eklensin mi? Böylece “/panoptent live” bir Claude Code konuşmasını dinlemede tutar ve sayfadaki Uygula doğrudan ona gider (yapıştırma yok, Enter yok). {0} konumuna kaydedilir.',
    'ext.skill.install': 'Komutu ekle',
    'ext.skill.later': 'Şimdi değil',
    'ext.skill.done': 'Eklendi. Claude Code’da (bu projede) yeni bir konuşmada /panoptent live yaz, sonra sayfada Uygula’yı kullan.',
    'ext.skill.foreign': '{0} konumunda Panoptent’in oluşturmadığı bir /panoptent skill’i var, olduğu gibi bırakıldı.',
    'ext.skill.failed': '/panoptent komutu eklenemedi: {0}',
    'ext.skill.updated': '/panoptent Claude Code komutu son sürüme güncellendi.',
  },
});

const MARKER = /panoptent-skill-version:\s*(\d+)/;
const ASKED_KEY = 'panoptent.skillAsked';

function skillFile() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, 'skills', 'panoptent', 'SKILL.md');
}

function template(context: vscode.ExtensionContext) {
  return fs.readFileSync(path.join(context.extensionPath, 'media', 'claude-skill', 'SKILL.md'), 'utf8');
}

function versionOf(text: string): number | undefined {
  const m = MARKER.exec(text);
  return m ? Number(m[1]) : undefined;
}

export type SkillState = 'missing' | 'current' | 'outdated' | 'foreign';

export function skillState(context: vscode.ExtensionContext): SkillState {
  let text: string;
  try {
    text = fs.readFileSync(skillFile(), 'utf8');
  } catch {
    return 'missing';
  }
  const have = versionOf(text);
  if (have === undefined) return 'foreign';
  const want = versionOf(template(context)) ?? 0;
  if (have > want) return 'current'; // a newer Panoptent wrote it
  return have === want && text === template(context) ? 'current' : 'outdated';
}

function write(context: vscode.ExtensionContext) {
  const file = skillFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, template(context));
}

/** On activation: keep our own skill file up to date (never touches a user's own skill). */
export function refreshSkill(context: vscode.ExtensionContext, output: vscode.OutputChannel) {
  try {
    if (skillState(context) === 'outdated') {
      write(context);
      output.appendLine(t('ext.skill.updated'));
    }
  } catch {
    /* ignore: not critical */
  }
}

/**
 * Installs the skill. `ask`: confirm first (and only once per machine unless `force`).
 * Returns true when the skill is in place afterwards.
 */
export async function installSkill(context: vscode.ExtensionContext, opts: { ask: boolean; force?: boolean }): Promise<boolean> {
  const state = skillState(context);
  if (state === 'current') {
    if (opts.force) vscode.window.showInformationMessage(t('ext.skill.done'));
    return true;
  }
  if (state === 'foreign') {
    if (opts.force) vscode.window.showWarningMessage(t('ext.skill.foreign', skillFile()));
    return false;
  }
  if (state === 'missing' && opts.ask) {
    if (!opts.force && context.globalState.get<boolean>(ASKED_KEY)) return false;
    await context.globalState.update(ASKED_KEY, true);
    const yes = t('ext.skill.install');
    const pick = await vscode.window.showInformationMessage(t('ext.skill.ask', skillFile()), yes, t('ext.skill.later'));
    if (pick !== yes) return false;
  }
  try {
    write(context);
  } catch (err: any) {
    vscode.window.showErrorMessage(t('ext.skill.failed', err?.message || String(err)));
    return false;
  }
  vscode.window.showInformationMessage(t('ext.skill.done'));
  return true;
}
