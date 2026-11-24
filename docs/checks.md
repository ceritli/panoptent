# Test and Decisions — file format (v1)

*[Türkçe aşağıda](#türkçe)*

When an AI agent finishes a piece of work, it records **what the user should try** and **what the user must decide** as one *topic*. The user ticks the steps and picks the options in the Panoptent panel on top of the running app; every mark is written to the topic's file at once. The agent reads the results over MCP, applies the decisions and closes the topic.

The format is plain JSON and does not depend on Panoptent: any tool can read or write it.

## Folder

```
<project>/.panoptent/checks/
  open/<topic-id>.json      open topics (shown in the panel)
  archive/<topic-id>.json   closed topics (history, never deleted)
  .gitignore                ignores only *.lock and *.tmp
```

- One file per topic, so two people working on different topics do not get git conflicts.
- The folder is meant to be **committed**: another developer (or agent) can take over the open topics. Keep personal or secret data out of it: no e-mail addresses, passwords, tokens or customer data.
- Files changed by hand or by git (pull, checkout) are read again and the panel updates.

> **The panel runs inside the page you are developing**, so scripts on that page can read the topic text. Never write passwords, tokens or customer data into test steps or notes.

## Schema

| Field | Type | Notes |
|---|---|---|
| `v` | `1` | Schema version. Files with another version are listed as unreadable, not changed. |
| `id` | string | `[a-z0-9-]`, no dash at the start or end, max 64. Same as the file name. |
| `name` | string | Short title (topic tab). |
| `date` | string | Free text shown with the topic (default `YYYY-MM-DD`). |
| `lead` | string | One or two sentences: what the work did. |
| `tests[]` | object | See below. |
| `decisions[]` | object | See below. |
| `infos[]` | string | Short info lines. Only `**bold**` is formatted; anything else (HTML too) is shown as plain text. |
| `createdBy`, `createdAt`, `updatedAt` | string | Name (see `by`) and ISO times. |
| `closedAt`, `closedBy` | string | Only in `archive/`. |
| `reopenedAt`, `reopenedBy` | string | Set when an archived topic is reopened. |

**Test** — `{ id, t, url?, d?, e?, agent?, result }`

| Field | Notes |
|---|---|
| `id` | `[a-z0-9-]`, unique in the topic, stable: results are kept by id when the agent updates the topic. |
| `t` | Short title. |
| `url` | App path (`/admin/orders?tab=open#12`) or `http(s)://` address. Other schemes are refused. |
| `d` / `e` | What to do / what should be seen. |
| `agent` | `true` only if the agent ran the step itself. |
| `result` | `{ state: "none" \| "ok" \| "bad", note?, by?, at? }` — written by the user's marks. |

**Decision** — `{ id, t, o[], pick }`

| Field | Notes |
|---|---|
| `o` | 2–12 options, each with its consequence. **The first option is today's behaviour** and says so. |
| `pick` | `null` or `{ index, option, by, at }`. `option` repeats the chosen text so the choice survives a reordering of `o`. |

`by` (and `createdBy`, `closedBy`, `reopenedBy`) is your **GitHub user name**, taken from the first of:

1. the setting `panoptent.checks.userName` (type it yourself if the automatic one is wrong),
2. the GitHub CLI: `gh api user -q .login` (only if `gh` is installed and signed in; asked once per session with a short time limit, so no network means no wait),
3. `git config github.user`,
4. as a last resort `git config user.name`, then the operating-system user name (these are not GitHub user names).

The repository's `origin` address is never used to guess a name (it may belong to someone else). *Panoptent: Test and Decisions* and the **Test and Decisions** view show the name and where it came from. Names already stored in files are not converted. An e-mail address is never written (a name that looks like one is cut at `@`).

**Unknown fields are kept.** A newer Panoptent or another tool may add fields (`steps`, `needs`, …); reading and writing a topic preserves them.

Example: [`checks.example.json`](checks.example.json).

## How a "this page" step is found

A step belongs to the current page when its `url` path equals the page path (trailing `/` and the origin are ignored, so the VS Code preview proxy matches `http://localhost:3000/...`), and every query parameter in the step has the same value on the page. A plain anchor (`#12`) is ignored; a hash route (`#/settings`) counts as the path. Such steps are listed first with an **on this page** tag.

## Rules for the agent

Writing a topic:
- Each test checks one thing; `d` names the page, record and button; `e` is concrete (numbers, text, colour); `url` points at the page.
- `agent: true` only for steps the agent actually ran. Untried steps are never written as tried: list them as their own step or as an info line starting `**Not tried:**`.
- Every rule the agent chose without asking is a decision. The first option is the current behaviour. While a decision has no pick, the code keeps the current behaviour.
- If test data was created, the last step is cleaning it up.

When results come in:
- `ok`: done. `bad`: read the note, fix it, then update the topic with `retest: ["<test id>"]`. `none`: leave it.
- Decision index 0: no code change. Another option: apply it, test it, add a short test step if useful. No pick: leave it.
- When every test is `ok` and every decision is picked, close the topic. Decisions that should last go into the project's own documents first; the archive is history, not documentation.

## Access

- **MCP tools** (Panoptent MCP server): `save_check_topic` (add / update; `retest`, `reopen`), `get_check_topics` (open topics with results; `id`, `archived`), `get_check_changes` (only what changed since the last read or since a `cursor`), `close_check_topic` (refuses an incomplete topic unless `force: true`). Prompt: `/mcp__panoptent__checks`. Claude Code command: `/panoptent checks`.
- **Local HTTP API** on the same server (`127.0.0.1` only): `POST /checks/list | get | result | pick | close | reopen` with a JSON body and `Authorization: Bearer <token>`. The token changes every time VS Code starts; copy the address and token with *Panoptent: Test and Decisions*. Requests with an `Origin` header (web pages), a foreign `Host`, no token, or a body over 16 KB are refused.
- **In the page**: the **Test** button in the Panoptent bar (VS Code preview and Chrome) shows how many steps and decisions wait for you and opens the panel. Marks are saved immediately; if a save fails, the panel says so and the mark goes back.
  - The panel can be **moved** (drag the title bar), **resized** (drag an edge or corner; at least 300×160 px, at most the visible area), **minimized** to its title bar (with "N topics · M waiting") and **maximized**; double-click the title bar to maximize / restore. With the title bar focused, arrow keys move it and Shift+arrows resize it. It never leaves the visible area: its left edge stays on screen and the title stays reachable.
  - Position, size and the open / minimized state are kept by the host, not by the page: in the VS Code preview in the webview state, in Chrome in the extension's storage. They survive page reloads and route changes. Every stored value is checked and limited to the visible area before use, so a page script that tampers with it can only move the panel.
  - **⧉** opens the full page in VS Code (only while the page is connected to VS Code).
- **In VS Code, full page**: *Panoptent: Open Test and Decisions as a Page* (also the ⧉ button in the panel, the button in the **Test and Decisions** view and *Panoptent: Test and Decisions*) opens an editor tab with every open topic, counters, filters (**problems**, **not looked at**, **undecided**), marking, notes and decisions. It writes through the same per-field, locked path and refreshes itself when a file changes (from the panel, git or an agent). **Open page ↗** opens the step's address in the preview if it is open, otherwise in the browser. The tab has a strict Content Security Policy with nonce scripts and draws topic text as plain text.

## Writes

- Every write changes one field (one test result, one pick) and is done under a per-topic lock file: the file is read again from disk, changed and written to a temporary file that is then renamed over it. Two people (or the agent and the user) writing different fields of the same topic never overwrite each other; the last write to the *same* field wins.
- An agent update keeps the results and picks stored on disk at that moment.

---

## Türkçe

Ajan bir işi bitirince **ne denenecek** ve **neye karar verilecek** listesini bir *konu* olarak kaydeder. Kullanıcı çalışan uygulamanın üstündeki Panoptent panelinden adımları işaretler ve kararları seçer; her işaret anında konunun dosyasına yazılır. Ajan sonuçları MCP ile okur, kararları uygular ve konuyu kapatır.

- Klasör: `.panoptent/checks/open/<konu-id>.json` (açık), `.panoptent/checks/archive/<konu-id>.json` (kapatılan; silinmez). Konu başına bir dosya. Klasör **commit edilir**; içinde e-posta, şifre, jeton ya da müşteri verisi bulunmaz.
- Şema yukarıdaki tablolardaki gibidir (`v: 1`). Kimlikler yalnız `[a-z0-9-]`. Test sonucu `none` (bakılmadı) / `ok` (tamam) / `bad` (sorun + not). Kararın ilk seçeneği **bugünkü durumdur**. `by` (ve `createdBy`, `closedBy`, `reopenedBy`): **GitHub kullanıcı adın**; sıra: `panoptent.checks.userName` ayarı → GitHub CLI (`gh api user -q .login`, oturumda bir kez, kısa zaman aşımıyla) → `git config github.user` → son çare `git config user.name`, sonra işletim sistemi kullanıcısı. Depo `origin` adresinden ad çıkarılmaz. Adın nereden geldiği *Panoptent: Test ve Kararlar* komutunda ve görünümde yazar; yanlışsa ayardan düzelt. Dosyadaki eski adlar dönüştürülmez. E-posta yazılmaz. Bilinmeyen alanlar korunur.
- **Panel geliştirdiğin sayfanın içinde çalışır; sayfadaki betikler konu metnini okuyabilir.** Test adımlarına ve notlara şifre, jeton ya da müşteri verisi yazma.
- "Bu sayfada": adımın yolu geçerli sayfanın yoluyla aynıysa (köken ve sondaki `/` yok sayılır; adımdaki sorgu parametreleri sayfada da aynı değerle olmalı; `#12` gibi çapa yok sayılır, `#/yol` hash yönlendirmesi yol sayılır) adım en üstte ve **bu sayfada** rozetiyle görünür.
- Ajan kuralları: her adım tek şeyi sınar; `agent: true` yalnız ajanın gerçekten denediği adımda; denenemeyen şey denenmiş gibi yazılmaz (`**Denenemeyen:**` bilgi satırı ya da ayrı adım); ajanın sormadan seçtiği her kural bir karardır, ilk seçenek bugünkü durumdur ve kullanıcı seçmeden uygulanmaz; sonuç gelince `bad` → düzelt ve `retest`, seçilmemiş karar → dokunma; bütün testler tamam ve bütün kararlar verilmişse konu kapatılır, kalıcı kurallar önce projenin kendi belgelerine yazılır.
- Sayfadaki panel **taşınır** (başlıktan sürükle), **boyutlandırılır** (kenar / köşe; en az 300×160 px, en fazla görünüm alanı), **küçültülür** (yalnız başlık şeridi ve "N konu · M bekliyor"), **büyütülür** (başlığa çift tık da büyütür / eski ölçüye döndürür); başlık odaktayken oklar taşır, Shift+oklar boyutlandırır. Görünüm alanından çıkmaz. Yer, ölçü ve açık / küçük durumu sayfada değil host'ta saklanır (VS Code önizlemesinde webview durumu, Chrome'da eklenti deposu); her okumada doğrulanır ve sınırlanır. **⧉** VS Code'da tam sayfa açar.
- **Tam sayfa (VS Code):** *Panoptent: Test ve Kararları Tam Sayfa Aç* bütün açık konuları bir editör sekmesinde gösterir: sayaçlar, süzgeçler (**Sorunlu**, **Bakılmamış**, **Kararsız**), işaretleme, not, karar. Aynı tek alan + kilit yolundan yazar; dosya değişince kendini yeniler. **Sayfayı aç ↗** adımın adresini önizleme açıksa orada, değilse tarayıcıda açar.
- Erişim: MCP araçları `save_check_topic`, `get_check_topics`, `get_check_changes`, `close_check_topic`; Claude Code'da `/panoptent checks`; yerel HTTP API `POST /checks/...` (yalnız 127.0.0.1, jetonla; jeton *Panoptent: Test ve Kararlar* komutuyla kopyalanır).
- Yazma: her işlem tek alanı değiştirir, konu başına kilit altında diskten yeniden okur ve geçici dosya + yeniden adlandırma ile yazar. Farklı alanlara yazan iki kişi birbirini ezmez; aynı alana son yazan geçerli olur.
