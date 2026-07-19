# Feature Toggles & Portable Engine

## Overview
SFSS now ships with a Feature Manager and a built-in portable generator:
* **Feature toggles:** Let users enable/disable optional modules (Collaboration, Media Player). Changes are staged in the modal and applied on reload.
* **Portable build:** Flattens the ES module graph plus CSS/assets into a single `sfss_portable.html` that runs from `file://`. Collaboration and Media are intentionally excluded; scene tracks render as clickable YouTube links instead of inline playback.

## Runtime Behavior
* **FeatureManager.js**
  * Persists enabled flags under `sfss_features` in `localStorage`.
  * Uses `pendingFlags` in the modal so toggles don’t mutate the live session; `Apply & Reload` writes storage and reloads.
  * `downloadPortable` passes pending flags to the generator and streams logs to `#portable-log`.
* **Portable UI patches**
  * Hides Collaboration/Music controls, the App Builder entry, and replaces track displays with anchors.
  * Stubs Collaboration/Media classes to keep the rest of the app stable.
* **YouTube links (portable)**
  * Pasting a link stores the URL and shows it as an `<a target="_blank">` in scene settings and Treatment cards.
  * No metadata fetch or playback in portable builds.

## SingleFileGenerator.js
* **Bundling flow**
  * Loads `index.html`, strips scripts, inlines body images/icons.
  * Inlines CSS + fonts as data URIs; bundles JS in dependency order, strips ES module exports/imports, and injects globals.
  * Forces `media=false`, `collab=false` in portable output; Collaboration/Media modules are skipped and stubbed.
* **Logging**
  * Status + detailed log entries are streamed to `#portable-log` in the Feature Management modal.
* **Changelog**
  * Portable builds skip `changelog.html` fetches to avoid `file://` CORS errors.

## UX Notes
* Modal renamed to **Feature Management**. Apply & Reload sits with the toggles; portable generation has its own section with feature availability notes and a log.
* In portable builds, Collaboration and Media should never surface in the UI.

## Development Guidance
* When adding optional modules, register them in `FeatureManager.registry` and gate their imports through `FeatureManager.loadFeatures`.
* Keep portable compatibility in mind:
  * Avoid `fetch`ing local files in portable mode unless they are already inlined.
  * Ensure UI gracefully hides/marks features unavailable in portable builds.
* Update docs and Feature Management UI whenever new toggles or portable constraints are introduced.
