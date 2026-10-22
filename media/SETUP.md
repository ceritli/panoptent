# Source mapping setup

If Panoptent knows **which file and line** the element you clicked in the preview comes from, Claude goes straight there. All it takes is adding [code-inspector-plugin](https://github.com/zh-lx/code-inspector) to your project once. The plugin only runs in development mode and does not affect the production build.

It works without it too: Claude finds the element by searching its text, classes and component names — just a bit slower and less precisely.

## 1. Install the package

```bash
npm i -D code-inspector-plugin
```

## 2. Add it to your config

### Vite (React or Vue)

```js
// vite.config.js / vite.config.ts
import { codeInspectorPlugin } from 'code-inspector-plugin';

export default defineConfig({
  plugins: [
    codeInspectorPlugin({ bundler: 'vite' }),
    // react() or vue() ...
  ],
});
```

### Nuxt 3+

```js
// nuxt.config.ts
import { codeInspectorPlugin } from 'code-inspector-plugin';

export default defineNuxtConfig({
  vite: {
    plugins: [codeInspectorPlugin({ bundler: 'vite' })],
  },
});
```

### Next.js 15.3 and later (Turbopack)

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { codeInspectorPlugin } from 'code-inspector-plugin';

const nextConfig: NextConfig = {
  turbopack: {
    rules: codeInspectorPlugin({ bundler: 'turbopack' }),
  },
};

export default nextConfig;
```

### Next.js 14 and earlier (or `next dev --webpack`)

```js
// next.config.js
const { codeInspectorPlugin } = require('code-inspector-plugin');

module.exports = {
  webpack: (config) => {
    config.plugins.push(codeInspectorPlugin({ bundler: 'webpack' }));
    return config;
  },
};
```

> For Next.js 15.0–15.2, use `experimental: { turbo: { rules: ... } }` instead of `turbopack`.

## 3. Restart the dev server

Stop `npm run dev` and run it again, then press the ↻ button in the Panoptent panel. The notice in the side panel should change to **"✓ Source mapping is active"**.

## Plain HTML/CSS projects

Sites without a build tool don't need this step. Claude finds the element in your HTML files by its text and classes. Since there is no hot reload, the preview refreshes on its own after Claude changes the files.
