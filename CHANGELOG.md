# Changelog

## 0.14.0 — unreleased (branch `test-ve-karar`)

- **Test and Decisions.** An agent records what you should try and what you must decide as one topic in your project (`.panoptent/checks/open/<id>.json`, plain JSON, meant to be committed; closed topics move to `.panoptent/checks/archive/`). Format: [docs/checks.md](docs/checks.md)
  - A **Test** button with a badge in the Panoptent bar (VS Code preview and Chrome) opens a panel on top of your app: tick steps, report a **Problem** with a note, pick options, read the info lines. Steps for the page you are on come first (**on this page**). Every mark is saved to the file immediately with who and when; a failed save is shown and the mark goes back
  - **Also add to queue** turns a problem note (with the selected elements) into a normal queued change request
  - MCP tools `save_check_topic`, `get_check_topics`, `get_check_changes` (only what changed since the last read) and `close_check_topic`; prompt `/mcp__panoptent__checks`; `/panoptent checks` in Claude Code (the installed command text is updated on the next connect)
  - Local HTTP API on the MCP server (`POST /checks/list|get|result|pick|close|reopen`, `127.0.0.1` only, token required; copy it with *Panoptent: Test and Decisions*)
  - VS Code: **Test and Decisions** view in the Panoptent sidebar, commands *Panoptent: Test and Decisions* and *Panoptent: Show Test and Decisions on the Page*
  - Marks are signed with your **GitHub user name**: new setting `panoptent.checks.userName`, else the GitHub CLI (`gh api user`, asked once per session), else `git config github.user`; `git config user.name` / the system user only as a last resort. The view and the command show which source is used. E-mail addresses are never written
  - The in-page panel can be **moved** (title bar), **resized** (edges / corners, 300×160 px up to the visible area), **minimized** to its title bar with a "topics · waiting" counter and **maximized** (also double-click the title); arrow keys move it, Shift+arrows resize it. It always stays reachable on screen. Position, size and state are remembered by the host (VS Code webview state / Chrome extension storage), validated and clamped on every read
  - **Full page in VS Code**: *Panoptent: Open Test and Decisions as a Page*, the **⧉** button in the panel (from the preview or Chrome) or the view's title button opens every open topic in an editor tab, with counters and filters (problems / not looked at / undecided), marking, notes and decisions; it refreshes when files change. Strict CSP with nonce scripts; topic text is drawn as plain text
  - The panel runs inside the page you are developing, so scripts on that page can read the topic text: keep passwords, tokens and customer data out of topics (also stated in the tool descriptions for agents)
- Files under `.panoptent/` no longer count as "files changed" (no preview reload, no activity line)
- Chrome: the **✕** button of the drawer (Queue / Activity / Settings) closes it again. Since 0.11.2 the tab handler was also bound to ✕ and reopened the drawer right away. Esc pressed inside the page overlay (Test panel, element box) no longer closes the drawer as well
- `npm test`: unit and integration tests (Node's built-in test runner); CI runs them. `npm run test:e2e` also runs the Chrome bar (`chrome/content.js`) in headless Chromium with stubbed `chrome.*` APIs

## 0.13.1 — 2026-11-02

- **Live mode is quiet now.** The background wait renews itself every ~10 minutes without waking Claude, so the conversation no longer fills with "PANOPTENT WAITING" / "restart the wait" steps and "live mode is on" lines while nothing happens. Claude is only woken when you press **Apply**; if Claude Code ever stops the wait on its own time limit, Claude restarts it without writing anything
- If Panoptent restarted while live mode was on, the wait now says so (`PANOPTENT EXPIRED`) and Claude fetches a fresh command

## 0.13.0 — 2026-10-25

- **MCP: Claude can now see and point at the page.** Three new tools work in the VS Code preview and in Chrome:
  - `screenshot_element`: an image of a selected element (or any CSS selector) as it looks now, so Claude can check a change before and after editing. Chrome captures the tab when the extension has access to it (opened from its icon or shortcut); otherwise, and in the VS Code preview, the element is rendered from the page (cross-origin images and web fonts may be missing)
  - `highlight`: Claude draws a labelled purple outline around the elements it means and scrolls to them; nothing changes
  - `preview_style`: Claude shows a proposed style change live on the page without touching the code (outlined as *Claude's preview*), so you can compare options before it edits the source; `reset` undoes its previews, and a reload clears them
- The Chrome extension needs 0.13.0 for these tools; with an older one they say so instead of hanging

## 0.12.0 — 2026-10-24

- **Live mode: `/panoptent live`** in Claude Code. Claude waits for you; every time you press **Apply** in the VS Code preview or in Chrome, the change set goes straight to that conversation (no command to paste, no new tab), Claude makes the edits, calls `mark_applied` and waits for the next one. Claude restarts the wait before editing, so an Apply while it works is not lost; if no conversation picks a change set up within 30 seconds (live mode was interrupted), Panoptent sends it the usual way. Ask Claude to stop, or use `/panoptent stop`. Undo works as usual
- **`/panoptent` command for Claude Code**: *Panoptent: Connect Claude Code (MCP)* installs `~/.claude/commands/panoptent.md` with `/panoptent live`, `/panoptent apply` (apply the queue) and `/panoptent selection …` (work on the selected elements). A `panoptent.md` you wrote yourself is left alone
- Live mode waits with a quiet background command (`curl` to the local MCP server, ~10 minutes per round), so the conversation stays free and nothing piles up on screen
- MCP: new tools `start_live` and `wait_for_apply` (for clients without background commands) and prompts `live` and `selection` (`/mcp__panoptent__live`, `/mcp__panoptent__selection`)

## 0.11.2 — 2026-10-24

- Chrome: the drawer (Queue / Activity / Settings) has a **✕ close** button; the ⚙ button now toggles Settings, and **Esc** closes the drawer
- Turning **Select** off (button or Esc) now clears the selection: no highlighted elements or open box stay on the page, and the selected list in the panel / Chrome empties. Queued changes are kept

## 0.11.1 — 2026-10-22

- **Tidier settings page**: Panoptent's settings are grouped into sections (General, Sending to Claude, Background mode (CLI), Chrome extension, MCP server) in a sensible order, with readable option names (e.g. *Claude Code panel* / *In the background (CLI)* / *Claude Code (MCP)*), an explanation for every permission mode, clickable command links and a note that the CLI settings only apply in background mode
- The **Settings** links in the Panoptent view and panel now open only Panoptent's settings (`@ext:ceritli.panoptent`)
- Port settings only accept valid port numbers
- **Preview panel**: the options under the request box (popover, open source on select, design rules) moved into a collapsible **Options** card with switches, a design-file pill and an **All settings…** link
- **Get Started view**: one main button (Open Preview); setup, settings and language are compact links instead of a stack of full-width buttons

## 0.11.0 — 2026-10-22

- **Design rules file**: if the project has a design file (`design.md`, `DESIGN.md` or `docs/design.md`, or any file you pick), every request Panoptent sends to Claude, whether through the panel, CLI or MCP, adds a rule to follow it, and Claude reads it once per conversation. Choose it from the new **Design rules** row in the VS Code panel, the Chrome drawer's Settings tab, or *Panoptent: Choose Design Rules File*; setting `panoptent.designFile` (empty = automatic, `off` = disabled)
- MCP `get_page_context` reports the design file as `designRules`

## 0.10.0 — 2026-10-22

- **MCP server**: Panoptent now runs a local MCP server (`http://127.0.0.1:47821/mcp`, Streamable HTTP) so Claude Code CLI, Cursor, Windsurf and other MCP clients can pull context themselves. Tools: `get_selection` (selected elements with source file/line, component chain, selector, computed styles, HTML), `get_queue` (pending queued changes) and `get_page_context` (workspace, page URL, viewport, counts)
- The VS Code preview and the Chrome extension report their current selection and queue to VS Code (`syncState`); large image data is not sent
- New command *Panoptent: Copy MCP Connect Command*; new settings `panoptent.mcpServer` (default on) and `panoptent.mcpPort` (default 47821, next 9 tried)
- **Send to → Claude Code (MCP)**: Apply no longer attaches a request file; it copies a one-line command (`Apply the Panoptent change set PT-…`) and Claude fetches the change set with `get_apply`, then calls `mark_applied`. Undo keeps working (the `PT-…` id is in the user message)
- MCP prompt `apply_queue` (`/mcp__panoptent__apply_queue` in Claude Code) applies the whole queue without pressing Apply; tools `get_apply` and `mark_applied`
- *Panoptent: Connect Claude Code (MCP)* runs `claude mcp add` for the project (offered automatically when MCP is chosen); each project keeps its last MCP port so the registered address stays valid, and is re-registered silently if the port changes
- The MCP server refuses requests that carry an `Origin` header (web pages) or a foreign `Host`; the existing Apply → Claude Code flow is unchanged

## 0.9.1 — 2026-10-22

- Chrome: no longer requests the broad `tabs` permission (`activeTab` is enough)
- Privacy policy page (docs/privacy.html)
- Release workflow can publish to the Chrome Web Store
- README: install from the VS Code Marketplace

## 0.9.0 — 2026-10-22

- **English and Turkish UI** across the VS Code panel, page overlay, Chrome extension, popup and notifications, switchable live: `panoptent.language` setting (`auto` follows VS Code's display language), *Panoptent: Change Language* command and **Language** link in the Panoptent view, language select in the preview toolbar, and a **Language** select in the Chrome drawer's Settings tab (Chrome follows VS Code once connected; otherwise its own choice or the browser language)
- Prompts sent to Claude Code are written in the UI language, so Claude replies in it
- Chrome Web Store metadata localized (`_locales/en`, `_locales/tr`)
- Docs: English screenshots and demo shown when the page is in English; English UI labels throughout; lightbox for screenshots and image aspect-ratio fix
- Release workflow also publishes to the VS Code Marketplace and Open VSX (when the tokens are configured)
- Added `CONTRIBUTING.md`

## 0.8.0 — 2026-10-22

First public release under the name **Panoptent** (previously developed as *Panoptes Edit* / *Visual Edit*).

- VS Code preview with click-to-select overlay, inline request box, live style panel, inline text editing, delete, image replace, hierarchy navigation (`Alt` + arrows)
- Change queue with undo/redo and single **Apply**; text edits written directly without AI
- Requests go to the open Claude Code conversation (`@`-mention) or run in the background via Claude Code CLI
- Precise undo: reverses only the edits made for a given apply, using Claude Code's session log
- Mobile/tablet-only changes
- Chrome extension with local bridge (`127.0.0.1`, extension origins only, one-time pairing)
- code-inspector-plugin auto setup (Vite, Next.js webpack/Turbopack, Nuxt)
- Activity bar view, panel docking (left/bottom/right), collapsible side panel
- Chrome: silent port discovery (no `ERR_CONNECTION_REFUSED` noise in the extension error list)
