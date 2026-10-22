# Contributing to Panoptent

**Every kind of contribution is welcome** — bug reports, ideas, documentation fixes, translations, screenshots, tests and code. You don't need to ask before opening an issue or a pull request.

## Ways to help

- **Report a bug** — [open an issue](https://github.com/ceritli/panoptent/issues/new/choose) with your OS, VS Code version, framework (Next.js, Vite, Nuxt…) and the steps to reproduce.
- **Suggest a feature** — describe what you want to do and why; rough ideas are fine.
- **Improve the docs** — the guide is a single page: [`docs/index.html`](docs/index.html) (Turkish and English side by side).
- **Translate** — the UI ships in English and Turkish; new languages are very welcome. Strings live next to the code that uses them (`media/i18n.js` + its `LANGS` list, the `PanoptentI18n.add({ en, tr })` blocks at the top of `media/overlay.js`, `media/panel.js`, `chrome/content.js`, `chrome/popup.js`, the `addStrings` blocks in `src/*.ts`), plus `package.nls.<lang>.json`, `chrome/_locales/<lang>/messages.json` and `media/SETUP.<lang>.md`. See [Adding a language](https://ceritli.github.io/panoptent/#gelistirme) in the docs.
- **Send code** — fork, create a branch, open a pull request against `main`.

## Development setup

```bash
npm install
npm run typecheck
npm run package          # → panoptent-x.y.z.vsix
npm run package:chrome   # → panoptent-chrome-x.y.z.zip
```

Press `F5` in VS Code with this folder open to run the extension in a development host. Load `chrome/` unpacked after `npm run package:chrome`.

Before opening a pull request, please make sure `npm run typecheck` passes and describe how you tested the change. CI runs the same checks.

## Code of conduct

Be kind and constructive. We're happy to help first-time contributors.

---

# Katkıda bulunma

**Her türlü katkıya açığız** — hata bildirimi, fikir, belge düzeltmesi, çeviri, ekran görüntüsü, test ve kod. Issue ya da pull request açmadan önce izin istemene gerek yok.

- **Hata bildir:** [Issue aç](https://github.com/ceritli/panoptent/issues/new/choose); işletim sistemi, VS Code sürümü, framework ve adımları yaz.
- **Özellik öner:** Ne yapmak istediğini ve nedenini anlat; taslak fikirler de olur.
- **Belgeleri geliştir:** Rehber tek sayfa: [`docs/index.html`](docs/index.html).
- **Çeviri:** Arayüz İngilizce ve Türkçe; yeni dillere çeviri katkısı çok değerli. Hangi dosyaların değişeceği rehberdeki [Yeni dil eklemek](https://ceritli.github.io/panoptent/#gelistirme) bölümünde.
- **Kod gönder:** Fork'la, dal aç, `main`'e pull request gönder. Göndermeden önce `npm run typecheck` çalıştır ve nasıl test ettiğini yaz.

Nazik ve yapıcı olalım; ilk katkısını yapanlara seve seve yardım ederiz.
