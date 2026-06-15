# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tacit is a single-screen lifelog PWA (Japanese UI). The user taps a point on a 2D
graph to record a situation's **mood** (X: 0 bad → 100 good) and **assertiveness**
(Y: 0 suppressed → 100 assertive), optionally adds a note, and saves. All data lives
in the browser's LocalStorage and can be exported as JSON.

## Running

No build step, no package manager, no tests. It is plain HTML/CSS/JS served statically.
The Service Worker requires HTTP (not `file://`):

```bash
python3 -m http.server 8000   # → http://localhost:8000
```

Deployed via GitHub Pages from `main` / root. All asset paths are relative (`./`), so
it works under a subdirectory — keep new paths relative.

## Architecture

Everything is in five top-level files; there is no framework.

- `index.html` — the entire markup for the single screen. Elements are wired to JS by
  `id`. Lucide icons load from a CDN `<script>` and are placeholders (`<i data-lucide="...">`).
- `app.js` — all logic, wrapped in one IIFE. Grabs DOM nodes by id at the top, holds
  `current` (the in-progress `{x, y}` selection) and `logs` (the saved array) as the
  only state. Key flow: `pickPoint` (pointer → 0–100 coords, note the inverted screen Y)
  → `renderDot` → `save` (prepends to `logs`, `persist`s, re-renders). Storage key is
  `tacit.logs.v1`.
- `style.css` — oklch-based slate-blue minimal theme; design tokens are CSS custom
  properties at the top.
- `manifest.json` + `sw.js` — PWA install + offline. `sw.js` is network-first for
  navigations (so updates land), cache-first for static assets.
- `icons/` — SVG app icons.

## Conventions that matter here

- **Bump cache versions together when assets change.** `sw.js` has `CACHE = "tacit-v1"`
  and an `ASSETS` list; if you add/rename a cached file, update both or offline users
  get stale/missing assets.
- **After injecting DOM that contains `data-lucide` icons, call `refreshIcons()`** (wraps
  `window.lucide.createIcons()`), as `renderHistory` and the copy-button states do.
- **Log entry shape** is `{ id, timestamp, x, y, note }` where `id` is `String(Date.now())`
  and `timestamp` is ISO with milliseconds stripped. Preserve this — exported JSON and
  any future import depend on it.
- UI text is Japanese; match the existing tone.
