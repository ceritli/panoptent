# Panoptent — Chrome Web Store form text

Copy each block into the matching field in the Developer Dashboard.

---

## Package
Upload: `panoptent-chrome-x.y.z.zip` from the GitHub release (or `npm run package:chrome`).
Item ID: `kmikbnmoacgjjigohbcbmppccjidmacc`

---

## Store listing (English — default)

**Description**

> The first submission was rejected for "keyword spam" because of a list of framework names
> ("React, Next.js, Vue, Nuxt, Vite or plain HTML"). Don't list technologies or long comma-separated
> feature lists in the description.

```
Panoptent lets you edit your web app by pointing at it.

Turn on Select, click any element on your local development site and describe the change you want. Panoptent knows which source file and line the element comes from and hands your request to Claude Code in VS Code, which edits the code. Your dev server reloads and you see the result right away.

WHAT YOU CAN DO
• Write a request right next to the element, for example "make this section two columns"
• Adjust an element's look live in a small style panel before applying it
• Double-click to edit text in place, remove an element, or replace an image
• Collect several changes in a queue, undo or redo them, then apply them all at once
• Mark a change as mobile-only or tablet-only
• Undo the last apply: only the changes Panoptent made are reverted

HOW IT WORKS
This Chrome extension works together with the free Panoptent extension for VS Code. The two connect locally on your own computer, and the first connection needs your approval in VS Code. The code edits are made by Claude Code using your own Claude subscription.

REQUIREMENTS
• The Panoptent extension for VS Code
• Claude Code for VS Code
• Your web app running on a local development server

PRIVACY
Panoptent collects no data and has no servers. Everything stays on your computer.

Interface in English and Turkish. Open source (MIT): https://github.com/ceritli/panoptent
Guide: https://ceritli.github.io/panoptent/
```

**Category:** Developer Tools
**Language:** English

**Graphic assets**
- Store icon: `assets/icon-128.png`
- Screenshots (1280×800): `assets/screenshot-1-hero.png` … `assets/screenshot-5-settings.png`
- Small promo tile (440×280): `assets/promo-small-440x280.png`
- Marquee promo tile (1400×560, optional): `assets/promo-marquee-1400x560.png`

**Additional fields**
- Official URL: (leave empty, or none)
- Homepage URL: `https://ceritli.github.io/panoptent/`
- Support URL: `https://github.com/ceritli/panoptent/issues`
- Mature content: No

---

## Store listing (Turkish — add via "Localize" / language: Türkçe)

```
Panoptent ile web uygulamanı göstererek düzenlersin.

Seç'i aç, yerel geliştirme sitende bir öğeye tıkla ve ne değişsin istediğini yaz. Panoptent öğenin hangi dosyanın hangi satırından geldiğini bilir ve isteği VS Code'daki Claude Code'a iletir; Claude Code kodu düzenler. Dev sunucun yenilenir, sonucu hemen görürsün.

NELER YAPABİLİRSİN
• Öğenin hemen yanında istek yaz, örneğin "bu bölümü iki sütun yap"
• Uygulamadan önce öğenin görünümünü küçük bir stil panelinde canlı ayarla
• Çift tıklayıp metni yerinde düzenle, öğeyi kaldır ya da görseli değiştir
• Birden fazla değişikliği kuyruğa al, geri al/yinele, sonra hepsini tek seferde uygula
• Bir değişikliği sadece mobil ya da tablet için işaretle
• Son uygulamayı geri al: yalnızca Panoptent'in yaptığı değişiklikler geri alınır

NASIL ÇALIŞIR
Bu Chrome eklentisi, VS Code için ücretsiz Panoptent eklentisiyle birlikte çalışır. İkisi kendi bilgisayarında yerel olarak bağlanır; ilk bağlantıyı VS Code'da onaylarsın. Kod düzenlemelerini kendi Claude aboneliğinle Claude Code yapar.

GEREKSİNİMLER
• VS Code için Panoptent eklentisi
• VS Code için Claude Code
• Yerel geliştirme sunucusunda çalışan web uygulaman

GİZLİLİK
Panoptent veri toplamaz, sunucusu yoktur. Her şey bilgisayarında kalır.

Türkçe ve İngilizce arayüz. Açık kaynak (MIT): https://github.com/ceritli/panoptent
Rehber: https://ceritli.github.io/panoptent/?lang=tr
```

---

## Privacy practices tab

**Single purpose description**
```
Lets developers select elements on their local development site and send change requests to the Panoptent VS Code extension on the same computer, which applies them to the source code via Claude Code.
```

**Permission justifications**

storage:
```
Stores the user's per-site on/off choice, the pending change queue, panel preferences, language choice and the local pairing token for VS Code. Stored only in chrome.storage.local.
```

scripting:
```
Injects the selection overlay (bundled in the extension) into the page the user turned Panoptent on for, so they can highlight and select elements.
```

activeTab:
```
Lets the user turn Panoptent on for the current tab from the toolbar button or keyboard shortcut, including sites that are not localhost, only when they choose to.
```

Host permissions (localhost, 127.0.0.1, *.localhost):
```
Panoptent works on local development servers. Host access to localhost/127.0.0.1 is needed to show the selection toolbar on the user's local dev site and to connect to the Panoptent VS Code extension running on the same computer (127.0.0.1:47811-47820). No other hosts are accessed.
```

**Are you using remote code?** → **No, I am not using remote code.**

**Data usage** → check **none** of the data types (the extension collects no user data).

Tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**
```
https://ceritli.github.io/panoptent/privacy.html
```

---

## Distribution tab
- Visibility: **Public**
- Regions: **All regions**
- Pricing: Free

---

## Regenerating the promo tiles
Open `store/promo.html` in Chromium and screenshot `#small` (440×280) and `#marquee` (1400×560).
