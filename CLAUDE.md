# Panoptent — project notes

Panoptent = Panopt(es) + ag(ent). Click an element in a running web app, describe the change, and
Claude Code edits the source. Two parts: a **VS Code extension** (this repo root) and a companion
**Chrome MV3 extension** (`chrome/`). Owner: Fatih Ceritli (`ceritli`); co-copyright Alper LÜLE. MIT.
Open to every kind of contribution.

- Repo: https://github.com/ceritli/panoptent (public, default branch `main`)
- Guide (GitHub Pages, TR + EN): https://ceritli.github.io/panoptent/ — source in `docs/`
- VS Code Marketplace: `ceritli.panoptent` (publisher `ceritli`, marked preview)
- Chrome Web Store item: `kmikbnmoacgjjigohbcbmppccjidmacc` (see Status below)

## Layout
| Path | Role |
|---|---|
| `src/extension.ts` | activation, commands, VS Code preview panel (webview HTML template lives here) |
| `src/engine.ts` | apply / hand-off to Claude / undo; one engine per workspace, shared by panel and Chrome |
| `src/bridge.ts` | Chrome bridge: `ws` on 127.0.0.1:47811–47820, extension origins only, one-time pairing |
| `src/mcp.ts` | local MCP server (Streamable HTTP, 127.0.0.1:47821–47830, sticky per workspace): tools `get_selection`, `get_queue`, `get_page_context`, `get_apply`, `start_live` (returns a `curl` to `POST /live/wait?t=<token>` that Claude Code runs as a background task, ~590 s per round, like Impeccable's `live-poll`), `wait_for_apply` (MCP long-poll fallback, 50 s: clients time out at ~60 s), `mark_applied`, page tools `screenshot_element` / `highlight` / `preview_style` (engine `pageRequest` → `{type:'mcpRequest', op}` to the panel/Chrome tab → overlay `onAgent` → `mcpResult`; Chrome tries `captureVisibleTab` (needs activeTab) then falls back to the overlay's DOM → SVG foreignObject render), prompts `apply_queue`, `live`, `selection`; connecting also installs `~/.claude/commands/panoptent.md` (`/panoptent live|apply|selection`, never overwrites a file without its marker); reads page state the panel/Chrome push via `syncState`; `sendTo: mcp` makes Apply hand a one-line `PT-…` command instead of a request file; `connectClaudeCode` runs `claude mcp add -s local` |
| `src/revert.ts` | precise undo from Claude Code transcripts (`~/.claude/projects/...`), matches the `PT-…` id only |
| `src/entries.ts` | change entries → prompt for Claude (language follows UI), image saving |
| `src/claudePanel.ts` | sends to the open Claude Code conversation (`claude-vscode.insertAtMention` on `.claude/panoptent/istek-PT-*.md`), CLI helpers |
| `src/claude.ts` | CLI mode runner (`claude -p --output-format stream-json`) |
| `src/proxy.ts` | dev-server proxy that injects `i18n.js` + `overlay.js` |
| `src/codeInspector.ts` | code-inspector-plugin auto setup |
| `src/i18n.ts` | extension-host strings (`addStrings`, `t`, `uiLang`) |
| `media/i18n.js` | shared browser i18n core (`PanoptentI18n`) for panel, overlay, Chrome |
| `media/overlay.js` | in-page selection overlay (shared by VS Code preview and Chrome) |
| `media/panel.js`, `panel.css` | VS Code preview panel UI |
| `chrome/` | MV3 extension (`background.js`, `content.js`, `popup.*`, `_locales/`); `build.sh` copies `media/overlay.js` + `media/i18n.js` in |
| `docs/` | GitHub Pages site (`index.html` bilingual, `privacy.html`, `assets/` incl. `-en` screenshot variants) |
| `store/` | Chrome Web Store listing text (`LISTING.md`) and graphics (`assets/`) |

## Build & check
```bash
npm ci
npm run typecheck
npm run package          # → panoptent-x.y.z.vsix
npm run package:chrome   # → panoptent-chrome-x.y.z.zip
```
Keep element ids / data attributes / message types stable: the overlay ↔ panel ↔ content-script
protocol (`{source:'panoptent', type, ...}`) and e2e tests depend on them.

## i18n rules
- English is the default/fallback; Turkish is complete. Setting `panoptent.language` = `auto|en|tr`.
- Every user-visible string goes through `t()`. Each file registers its own keys at the top
  (`ov.*` overlay, `pn.*` panel, `cx.*` Chrome content, `pp.*` popup, `bg.*` background, `ext.*` host).
- Also: `package.nls.json` / `package.nls.tr.json`, `chrome/_locales/{en,tr}`, `media/SETUP.md` / `SETUP.tr.md`.
- Live switching must keep working (no reload). Docs pages are bilingual with `lang="tr"` / `lang="en"` twins.

## Release (automated)
1. Bump `version` in **both** `package.json` and `chrome/manifest.json`; add a `CHANGELOG.md` section.
2. Push to `main`. `.github/workflows/release.yml` then:
   - creates GitHub release `vX.Y.Z` with the `.vsix` and Chrome `.zip` (if it doesn't exist yet),
   - publishes to the VS Code Marketplace (secret `VSCE_PAT`, Azure DevOps PAT, Marketplace: Manage, expires ~Oct 2027),
   - publishes to Open VSX (namespace `ceritli`, verified): trusted publishing (OIDC, registration for
     `ceritli/panoptent` + `release.yml` on open-vsx.org), falling back to secret `OVSX_PAT`,
   - uploads + publishes to the Chrome Web Store if `CWS_SA_KEY` (service-account JSON) and `CWS_PUBLISHER_ID` are set.
3. `pages.yml` redeploys `docs/` on every push touching it. `ci.yml` builds every push/PR.

Claude sessions cannot push tags, create releases or change repo settings directly — use the
workflows (push to `main`, or `workflow_dispatch` via the API).

## Status (keep this section current)
- 0.13.0 (MCP page tools `screenshot_element`, `highlight`, `preview_style`; closes #3) in review.
- 0.12.0 (live mode `/panoptent live` / `/panoptent:live (MCP)`: `start_live` background `curl` wait, Apply goes straight to the waiting Claude conversation, unclaimed sets fall back after 30 s; `/panoptent` command; PR #17) merged 2026-10-25 and released by the release workflow. Next: package as a Claude Code plugin.
- 0.11.2 (Chrome drawer close button, ⚙ toggles, Esc closes; turning Select off clears the selection; PR #13) merged 2026-10-24 and released by the release workflow.
- 0.11.1 (settings page grouped into sections with labels/descriptions; settings links open
  `@ext:ceritli.panoptent`; panel Options card; compact Get Started view; PR #10) merged 2026-10-22 and released by the release workflow.
- 0.11.0 (design rules file `panoptent.designFile`, PR #7) released on GitHub and VS Code Marketplace;
  0.10.0 added the MCP server + `sendTo: mcp` (PR #6).
- Chrome Web Store: live since 2026-10-24 at https://chromewebstore.google.com/detail/panoptent/kmikbnmoacgjjigohbcbmppccjidmacc.
- Open VSX (#4, done 2026-10-24): namespace claim approved, `ceritli` verified; 0.11.2 live at
  https://open-vsx.org/extension/ceritli/panoptent (published by the release workflow).
- Chrome Web Store automation (#2, done 2026-10-25): service account `panoptent-publisher@panoptent.iam.gserviceaccount.com`
  (GCP project `panoptent`) linked in the CWS dashboard; secrets `CWS_SA_KEY` / `CWS_PUBLISHER_ID` set. Release run
  40147704574 uploaded 0.12.0 and submitted it for review (PR #18). Store was on 0.9.1 before that.
- Open tasks and ideas are tracked as GitHub issues (label `roadmap`).
