# Repository Guidelines
Use this guide when contributing to SFSS, a local-first, client-side screenwriting PWA. Keep changes small, documented, and mindful of offline behavior and browser storage.

## Project Structure & Module Organization
- Entry point: `index.html` (contains modal HTML) with `sw.js` and `manifest.json` for PWA behavior.
- Core logic: `assets/js-mod/` holds ES module classes (e.g., `SFSS.js`, `EditorHandler.js`, `PageRenderer.js`, `TreatmentManager.js`, `FeatureManager.js`). Keep feature logic in dedicated managers.
- Styling: `assets/css/` segmented by concern (`base.css`, `layout.css`, `components.css`, `editor.css`, `print.css`, `treatment.css`, `reports.css`, `collab.css`).
- Assets: `assets/images/`, `assets/fontawesome/`, `assets/googlefonts/`, `trystero.min.js`, and `script.js` bootstrapper.
- Reference docs: `devAndInfoMds/` for feature notes, format specs, and portability guidance.

## Build, Test, and Development Commands
- No build pipeline; run directly. Open `index.html` or serve locally: `python3 -m http.server 8000` then visit `http://localhost:8000/`.
- When changing service worker or cached assets, hard-refresh (Ctrl+Shift+R) or unregister the worker in devtools to bypass stale caches.
- For portable single-file output, use the in-app Feature Management → Generate Single-File flow; the repo does not store the generated file.

## Coding Style & Naming Conventions
- JavaScript: vanilla ES modules, 4-space indentation, classes in PascalCase files within `assets/js-mod/`. Keep orchestration in `SFSS.js`; place feature logic in specific managers/renderers.
- Avoid new runtime dependencies; prefer small, local utilities. Keep browser APIs (IndexedDB/LocalStorage) guarded with existence checks.
- CSS: modular files aligned to features/areas; prefer CSS variables already defined in `base.css`. Use descriptive class names tied to UI components.

## Testing Guidelines
- No automated test suite. Perform manual smoke tests per feature touched: open a script, create/edit scenes, toggle Page View/Print modal, and verify Treatment/Reports modals render without console errors.
- For storage changes, reload to confirm data loads from IndexedDB/LocalStorage and that offline mode still works after a hard refresh.
- For service worker or caching changes, validate install/offline behavior in an incognito session after unregistering old workers.

## Commit & Pull Request Guidelines
- Existing history favors concise summaries (e.g., “bug fixes”, “Prepare&print v1 completed”). Use short, present-tense subjects that mention the area touched (e.g., “Fix treatment card drag order”).
- PRs should include: scope/intent, user-visible changes (screenshots or gifs for UI), manual test notes (browsers used, offline check), and any feature flags toggled.
- Link related issues when available and call out any migration steps (data format changes, cache clears) in the description.
