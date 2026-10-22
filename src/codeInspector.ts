// code-inspector-plugin'i projeye otomatik kurma yardımcıları.
// Paketi terminalde kurar; yapılandırma dosyasındaki değişikliği Claude'a (net talimatla) yaptırır,
// çünkü next/vite/nuxt yapılandırmaları projeden projeye çok farklı yazılıyor.

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
  const where = c.rel === '.' ? 'proje kökündeki' : `\`${c.rel}\` klasöründeki`;
  const cfg = c.config ? `\`${path.join(c.rel, c.config).split(path.sep).join('/')}\`` : `${where} ${c.framework} yapılandırma dosyası (yoksa oluştur)`;
  const L: string[] = [];
  L.push(`Bu projeye code-inspector-plugin'i Panoptent ile birlikte çalışacak şekilde yapılandır. Paket ${c.installed ? 'zaten kurulu' : 'şu anda terminalde kuruluyor'}; sen sadece ${cfg} dosyasını düzenle.`);
  L.push('');
  L.push(`Seçenekler her zaman şunlar olsun: \`${OPTS}\`.`);
  L.push('- `hotKeys: false`: code-inspector\'ın kendi Shift+Alt tık kısayolu Panoptent\'in seçimiyle çakışmasın.');
  L.push('- `showSwitch: false`, `hideConsole: true`: sayfaya ve konsola fazladan bir şey eklemesin.');
  L.push('- `hideDomPathAttr` seçeneğini KULLANMA; Panoptent `data-insp-path` özniteliğini okuyor.');
  L.push('');
  if (c.framework === 'nuxt') {
    L.push('Nuxt 3+ için:');
    L.push('```ts');
    L.push("import { codeInspectorPlugin } from 'code-inspector-plugin';");
    L.push(`export default defineNuxtConfig({ vite: { plugins: [codeInspectorPlugin({ bundler: 'vite', ${OPTS} })] } });`);
    L.push('```');
    L.push('Mevcut `vite.plugins` dizisi varsa ona ekle, diğer ayarları koru.');
  } else if (c.framework === 'vite') {
    L.push('Vite için `plugins` dizisinin EN BAŞINA ekle (react()/vue() eklentisinden önce):');
    L.push('```ts');
    L.push("import { codeInspectorPlugin } from 'code-inspector-plugin';");
    L.push(`codeInspectorPlugin({ bundler: 'vite', ${OPTS} }),`);
    L.push('```');
  } else if (c.framework === 'next') {
    const [maj, min] = nextMinor(c.nextVersion);
    L.push(`Next.js (${c.nextVersion || 'sürüm bilinmiyor'}) için hem webpack hem Turbopack ile çalışsın diye iki yeri de ayarla:`);
    L.push('```ts');
    L.push("import { codeInspectorPlugin } from 'code-inspector-plugin'; // CommonJS dosyadaysa require kullan");
    L.push('// webpack (next dev --webpack veya eski sürümler):');
    L.push(`webpack: (config) => { config.plugins.push(codeInspectorPlugin({ bundler: 'webpack', ${OPTS} })); return config; },`);
    if (maj > 15 || (maj === 15 && min >= 3)) {
      L.push('// Turbopack (Next 15.3+):');
      L.push(`turbopack: { rules: codeInspectorPlugin({ bundler: 'turbopack', ${OPTS} }) },`);
    } else if (maj === 15) {
      L.push('// Turbopack (Next 15.0–15.2):');
      L.push(`experimental: { turbo: { rules: codeInspectorPlugin({ bundler: 'turbopack', ${OPTS} }) } },`);
    }
    L.push('```');
    L.push('Var olan `webpack`/`turbopack` ayarları varsa birleştir; mevcut davranışı bozma.');
  } else {
    L.push('webpack için `plugins` dizisine ekle:');
    L.push('```js');
    L.push("const { codeInspectorPlugin } = require('code-inspector-plugin');");
    L.push(`codeInspectorPlugin({ bundler: 'webpack', ${OPTS} }),`);
    L.push('```');
  }
  L.push('');
  L.push('Eklenti yalnızca geliştirme modunda çalışır, production derlemesini etkilemez. Bitince dev sunucusunun yeniden başlatılması gerektiğini söyle, kendin başlatma. Ne değiştirdiğini kısaca Türkçe özetle.');
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
    vscode.window.showWarningMessage(
      'Panoptent: Projede Next.js, Nuxt veya Vite kullanan bir frontend bulunamadı. code-inspector bu projede kullanılamıyor; Panoptent yine çalışır, Claude öğeleri metin ve sınıflardan arar.',
    );
    return undefined;
  }
  if (list.length === 1) return list[0];
  const pick = await vscode.window.showQuickPick(
    list.map((c) => ({ label: c.rel, description: c.framework + (c.installed ? ' · zaten kurulu' : ''), c })),
    { title: 'code-inspector hangi frontend\'e kurulsun?' },
  );
  return pick?.c;
}

export function runInstall(c: Candidate) {
  const term = vscode.window.createTerminal({ name: 'Panoptent: code-inspector', cwd: c.dir });
  term.show(true);
  term.sendText(installCommand(c));
}
