// code-inspector-plugin'i projeye otomatik kurma yardımcıları.
// Paketi terminalde kurar; yapılandırma dosyasındaki değişikliği Claude'a (net talimatla) yaptırır,
// çünkü next/vite/nuxt yapılandırmaları projeden projeye çok farklı yazılıyor.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { addStrings, t } from './i18n';

addStrings({
  en: {
    'ext.ci.whereRoot': 'the project root',
    'ext.ci.whereDir': 'the `{0}` folder',
    'ext.ci.cfgMissing': 'the {1} config file in {0} (create it if missing)',
    'ext.ci.installed': 'is already installed',
    'ext.ci.installing': 'is being installed in the terminal right now',
    'ext.ci.intro': 'Configure code-inspector-plugin in this project so it works with Panoptent. The package {0}; you only need to edit {1}.',
    'ext.ci.opts': 'Always use these options: `{0}`.',
    'ext.ci.optHotkeys': '- `hotKeys: false`: so code-inspector\'s own Shift+Alt click shortcut does not clash with Panoptent\'s selection.',
    'ext.ci.optSwitch': '- `showSwitch: false`, `hideConsole: true`: so it adds nothing extra to the page or the console.',
    'ext.ci.optDomPath': '- Do NOT use the `hideDomPathAttr` option; Panoptent reads the `data-insp-path` attribute.',
    'ext.ci.nuxt': 'For Nuxt 3+:',
    'ext.ci.nuxtMerge': 'If a `vite.plugins` array already exists, add it there and keep the other settings.',
    'ext.ci.vite': 'For Vite, add it at the VERY BEGINNING of the `plugins` array (before the react()/vue() plugin):',
    'ext.ci.next': 'For Next.js ({0}), configure both places so it works with webpack and Turbopack:',
    'ext.ci.nextUnknown': 'version unknown',
    'ext.ci.cjs': '// use require if the file is CommonJS',
    'ext.ci.webpackOld': '// webpack (next dev --webpack or older versions):',
    'ext.ci.nextMerge': 'If `webpack`/`turbopack` settings already exist, merge them; do not break the existing behavior.',
    'ext.ci.webpack': 'For webpack, add it to the `plugins` array:',
    'ext.ci.outro': 'The plugin only runs in development mode and does not affect the production build. When done, say that the dev server needs to be restarted, but do not restart it yourself. Briefly summarize what you changed.',
    'ext.ci.noFrontend': 'Panoptent: No frontend using Next.js, Nuxt or Vite was found in the project. code-inspector cannot be used here; Panoptent still works and Claude finds elements by their text and classes.',
    'ext.ci.alreadyInstalled': ' · already installed',
    'ext.ci.pickTitle': 'Which frontend should code-inspector be installed in?',
  },
  tr: {
    'ext.ci.whereRoot': 'proje kökündeki',
    'ext.ci.whereDir': '`{0}` klasöründeki',
    'ext.ci.cfgMissing': '{0} {1} yapılandırma dosyası (yoksa oluştur)',
    'ext.ci.installed': 'zaten kurulu',
    'ext.ci.installing': 'şu anda terminalde kuruluyor',
    'ext.ci.intro': 'Bu projeye code-inspector-plugin\'i Panoptent ile birlikte çalışacak şekilde yapılandır. Paket {0}; sen sadece {1} dosyasını düzenle.',
    'ext.ci.opts': 'Seçenekler her zaman şunlar olsun: `{0}`.',
    'ext.ci.optHotkeys': '- `hotKeys: false`: code-inspector\'ın kendi Shift+Alt tık kısayolu Panoptent\'in seçimiyle çakışmasın.',
    'ext.ci.optSwitch': '- `showSwitch: false`, `hideConsole: true`: sayfaya ve konsola fazladan bir şey eklemesin.',
    'ext.ci.optDomPath': '- `hideDomPathAttr` seçeneğini KULLANMA; Panoptent `data-insp-path` özniteliğini okuyor.',
    'ext.ci.nuxt': 'Nuxt 3+ için:',
    'ext.ci.nuxtMerge': 'Mevcut `vite.plugins` dizisi varsa ona ekle, diğer ayarları koru.',
    'ext.ci.vite': 'Vite için `plugins` dizisinin EN BAŞINA ekle (react()/vue() eklentisinden önce):',
    'ext.ci.next': 'Next.js ({0}) için hem webpack hem Turbopack ile çalışsın diye iki yeri de ayarla:',
    'ext.ci.nextUnknown': 'sürüm bilinmiyor',
    'ext.ci.cjs': '// CommonJS dosyadaysa require kullan',
    'ext.ci.webpackOld': '// webpack (next dev --webpack veya eski sürümler):',
    'ext.ci.nextMerge': 'Var olan `webpack`/`turbopack` ayarları varsa birleştir; mevcut davranışı bozma.',
    'ext.ci.webpack': 'webpack için `plugins` dizisine ekle:',
    'ext.ci.outro': 'Eklenti yalnızca geliştirme modunda çalışır, production derlemesini etkilemez. Bitince dev sunucusunun yeniden başlatılması gerektiğini söyle, kendin başlatma. Ne değiştirdiğini kısaca Türkçe özetle.',
    'ext.ci.noFrontend': 'Panoptent: Projede Next.js, Nuxt veya Vite kullanan bir frontend bulunamadı. code-inspector bu projede kullanılamıyor; Panoptent yine çalışır, Claude öğeleri metin ve sınıflardan arar.',
    'ext.ci.alreadyInstalled': ' · zaten kurulu',
    'ext.ci.pickTitle': 'code-inspector hangi frontend\'e kurulsun?',
  },
});

interface Candidate {
  dir: string;
  rel: string;
  framework: 'next' | 'nuxt' | 'vite' | 'webpack';
  nextVersion?: string;
  installed: boolean;
  pm: 'npm' | 'pnpm' | 'yarn' | 'bun';
  config?: string;
}

function readJson(p: string): any {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return undefined;
  }
}

function detectPm(dir: string, root: string): Candidate['pm'] {
  for (let d = dir; d.startsWith(root); d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(d, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(d, 'bun.lockb')) || fs.existsSync(path.join(d, 'bun.lock'))) return 'bun';
    if (fs.existsSync(path.join(d, 'package-lock.json'))) return 'npm';
    if (d === path.dirname(d)) break;
  }
  return 'npm';
}

function findConfig(dir: string, base: string): string | undefined {
  for (const ext of ['ts', 'mts', 'js', 'mjs', 'cjs']) {
    const f = `${base}.config.${ext}`;
    if (fs.existsSync(path.join(dir, f))) return f;
  }
  return undefined;
}

export async function findCandidates(root: string): Promise<Candidate[]> {
  const files = await vscode.workspace.findFiles(
    new vscode.RelativePattern(root, '**/package.json'),
    '**/{node_modules,.next,.nuxt,.output,dist,build,bin,obj}/**',
    60,
  );
  const out: Candidate[] = [];
  for (const f of files) {
    const pkg = readJson(f.fsPath);
    if (!pkg) continue;
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const dir = path.dirname(f.fsPath);
    let framework: Candidate['framework'] | undefined;
    let config: string | undefined;
    if (deps.nuxt) {
      framework = 'nuxt';
      config = findConfig(dir, 'nuxt');
    } else if (deps.next) {
      framework = 'next';
      config = findConfig(dir, 'next');
    } else if (deps.vite) {
      framework = 'vite';
      config = findConfig(dir, 'vite');
    } else if (deps.webpack && (deps.react || deps.vue)) {
      framework = 'webpack';
      config = findConfig(dir, 'webpack') || findConfig(dir, 'vue');
    }
    if (!framework) continue;
    out.push({
      dir,
      rel: path.relative(root, dir) || '.',
      framework,
      nextVersion: deps.next ? String(deps.next).replace(/^[^\d]*/, '') : undefined,
      installed: !!deps['code-inspector-plugin'],
      pm: detectPm(dir, root),
      config,
    });
  }
  return out;
}

const OPTS = "hotKeys: false, showSwitch: false, hideConsole: true";

function nextMinor(v?: string): [number, number] {
  const m = (v || '').match(/(\d+)\.(\d+)/);
  return m ? [+m[1], +m[2]] : [0, 0];
}

export function setupPrompt(c: Candidate): string {
  const where = c.rel === '.' ? t('ext.ci.whereRoot') : t('ext.ci.whereDir', c.rel);
  const cfg = c.config ? `\`${path.join(c.rel, c.config).split(path.sep).join('/')}\`` : t('ext.ci.cfgMissing', where, c.framework);
  const L: string[] = [];
  L.push(t('ext.ci.intro', c.installed ? t('ext.ci.installed') : t('ext.ci.installing'), cfg));
  L.push('');
  L.push(t('ext.ci.opts', OPTS));
  L.push(t('ext.ci.optHotkeys'));
  L.push(t('ext.ci.optSwitch'));
  L.push(t('ext.ci.optDomPath'));
  L.push('');
  if (c.framework === 'nuxt') {
    L.push(t('ext.ci.nuxt'));
    L.push('```ts');
    L.push("import { codeInspectorPlugin } from 'code-inspector-plugin';");
    L.push(`export default defineNuxtConfig({ vite: { plugins: [codeInspectorPlugin({ bundler: 'vite', ${OPTS} })] } });`);
    L.push('```');
    L.push(t('ext.ci.nuxtMerge'));
  } else if (c.framework === 'vite') {
    L.push(t('ext.ci.vite'));
    L.push('```ts');
    L.push("import { codeInspectorPlugin } from 'code-inspector-plugin';");
    L.push(`codeInspectorPlugin({ bundler: 'vite', ${OPTS} }),`);
    L.push('```');
  } else if (c.framework === 'next') {
    const [maj, min] = nextMinor(c.nextVersion);
    L.push(t('ext.ci.next', c.nextVersion || t('ext.ci.nextUnknown')));
    L.push('```ts');
    L.push("import { codeInspectorPlugin } from 'code-inspector-plugin'; " + t('ext.ci.cjs'));
    L.push(t('ext.ci.webpackOld'));
    L.push(`webpack: (config) => { config.plugins.push(codeInspectorPlugin({ bundler: 'webpack', ${OPTS} })); return config; },`);
    if (maj > 15 || (maj === 15 && min >= 3)) {
      L.push('// Turbopack (Next 15.3+):');
      L.push(`turbopack: { rules: codeInspectorPlugin({ bundler: 'turbopack', ${OPTS} }) },`);
    } else if (maj === 15) {
      L.push('// Turbopack (Next 15.0–15.2):');
      L.push(`experimental: { turbo: { rules: codeInspectorPlugin({ bundler: 'turbopack', ${OPTS} }) } },`);
    }
    L.push('```');
    L.push(t('ext.ci.nextMerge'));
  } else {
    L.push(t('ext.ci.webpack'));
    L.push('```js');
    L.push("const { codeInspectorPlugin } = require('code-inspector-plugin');");
    L.push(`codeInspectorPlugin({ bundler: 'webpack', ${OPTS} }),`);
    L.push('```');
  }
  L.push('');
  L.push(t('ext.ci.outro'));
  return L.join('\n');
}

export function installCommand(c: Candidate): string {
  switch (c.pm) {
    case 'pnpm':
      return 'pnpm add -D code-inspector-plugin';
    case 'yarn':
      return 'yarn add -D code-inspector-plugin';
    case 'bun':
      return 'bun add -d code-inspector-plugin';
    default:
      return 'npm i -D code-inspector-plugin';
  }
}

/** Kullanıcıya hangi frontend klasörüne kurulacağını sorar (birden fazlaysa). */
export async function pickCandidate(root: string): Promise<Candidate | undefined> {
  const list = await findCandidates(root);
  if (!list.length) {
    vscode.window.showWarningMessage(t('ext.ci.noFrontend'));
    return undefined;
  }
  if (list.length === 1) return list[0];
  const pick = await vscode.window.showQuickPick(
    list.map((c) => ({ label: c.rel, description: c.framework + (c.installed ? t('ext.ci.alreadyInstalled') : ''), c })),
    { title: t('ext.ci.pickTitle') },
  );
  return pick?.c;
}

export function runInstall(c: Candidate) {
  const term = vscode.window.createTerminal({ name: 'Panoptent: code-inspector', cwd: c.dir });
  term.show(true);
  term.sendText(installCommand(c));
}
