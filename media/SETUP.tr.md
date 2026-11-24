# Kaynak eşleştirme kurulumu

Panoptent, önizlemede tıkladığın öğenin **hangi dosyanın hangi satırında** olduğunu bilirse Claude doğrudan oraya gider. Bunun için projene bir kez [code-inspector-plugin](https://github.com/zh-lx/code-inspector) eklemen yeterli. Eklenti sadece geliştirme modunda çalışır, canlı (production) çıktıyı etkilemez.

Kurmazsan da çalışır: Claude öğeyi metin, sınıf ve bileşen adlarından arayarak bulur, sadece biraz daha yavaş ve daha az kesin olur.

## 1. Paketi kur

```bash
npm i -D code-inspector-plugin
```

## 2. Yapılandırmaya ekle

### Vite (React veya Vue)

```js
// vite.config.js / vite.config.ts
import { codeInspectorPlugin } from 'code-inspector-plugin';

export default defineConfig({
  plugins: [
    codeInspectorPlugin({ bundler: 'vite' }),
    // react() veya vue() ...
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

### Next.js 15.3 ve üstü (Turbopack)

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

### Next.js 14 ve altı (veya `next dev --webpack`)

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

> Next.js 15.0–15.2 için `turbopack` yerine `experimental: { turbo: { rules: ... } }` kullanılır.

## 3. Dev sunucusunu yeniden başlat

`npm run dev` komutunu durdurup yeniden çalıştır, sonra Panoptent panelinde ↻ butonuna bas. Yan paneldeki uyarı **"✓ Kaynak eşleştirme aktif"** olarak değişmeli.

## Düz HTML/CSS projeleri

Build aracı olmayan sitelerde bu adıma gerek yok. Claude öğeyi HTML dosyalarında metin ve sınıflarından bulur. Hot reload olmadığı için önizleme, Claude dosyaları değiştirdikten sonra kendiliğinden yenilenir.

## Test ve Karar (isteğe bağlı)

Ajan bir işi bitirince ne denenecek ve neye karar verilecek listesini `.panoptent/checks/` altına bir konu olarak kaydedebilir (MCP aracı `save_check_topic`). Bu durumda Panoptent çubuğunda rozetli bir **Test** düğmesi çıkar; uygulamanın üstünde açılan panelde adımları işaretler, sorun bildirir ve kararları seçersin. Claude Code'da `/panoptent checks` ajana sonuçlarını okutur ve uygulatır.

- Kurulum: Claude Code'u bir kez **Panoptent: Claude Code'u Bağla (MCP)** ile bağla. Başka bir şey kurman gerekmez.
- `.panoptent/checks/` klasörünü projenle birlikte commit et; açık konuları başkası devralabilir. İçinde yalnız kilit ve geçici dosyalar yok sayılır.
- İşaretlerin **GitHub kullanıcı adınla** yazılır (GitHub CLI, sonra `git config github.user`). **Panoptent: Test ve Kararlar** komutunda ad ya da kaynak yanlışsa `panoptent.checks.userName` ayarını yaz.
- Panel geliştirdiğin sayfanın içinde çalışır; sayfadaki betikler konu metnini okuyabilir. Adımlara ve notlara şifre, jeton ya da müşteri verisi yazma.
- Yalnız yerel geliştirmede çalışır (önizleme proxy'si ya da Chrome eklentisi); canlı (production) çıktıya hiçbir şey eklenmez.
