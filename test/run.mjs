// Birim / bütünleşik testler: test/*.test.ts dosyalarını esbuild ile paketler (`vscode` → test/vscode-stub.ts)
// ve Node'un yerleşik test çalıştırıcısıyla koşar. Yeni bağımlılık gerektirmez.
//   npm test
import * as esbuild from 'esbuild';
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'dist', 'test');
const only = process.argv.slice(2);
const entries = readdirSync(here)
  .filter((f) => /\.(test|worker)\.ts$/.test(f))
  .filter((f) => !only.length || f.endsWith('.worker.ts') || only.some((o) => f.includes(o)))
  .map((f) => path.join(here, f));

const vscodeStub = {
  name: 'vscode-stub',
  setup(b) {
    b.onResolve({ filter: /^vscode$/ }, () => ({ path: path.join(here, 'vscode-stub.ts') }));
  },
};

await esbuild.build({
  entryPoints: entries,
  bundle: true,
  outdir: out,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  plugins: [vscodeStub],
  external: ['bufferutil', 'utf-8-validate'],
  sourcemap: 'inline',
  logLevel: 'warning',
});

const tests = entries.filter((f) => f.endsWith('.test.ts')).map((f) => path.join(out, path.basename(f).replace(/\.ts$/, '.js')));
const r = spawnSync(process.execPath, ['--test', ...tests], { stdio: 'inherit' });
process.exit(r.status ?? 1);
