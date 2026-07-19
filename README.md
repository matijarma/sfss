# SFSS - Simple Free Screenplay Software

**A professional, client-side Screenwriting Progressive Web App (PWA) designed for privacy, performance, and portability.**

**Simple Free Screenwriting Software** or **SFSS** brings an industry-standard writing experience directly to your browser. It is a *local-first* PWA: every script lives in your browser (IndexedDB + LocalStorage), with no servers, accounts, or dependencies beyond a modern browser.

## ✨ Core Features

The application is a writing studio built around three primary modes: **Write** (editor), **Plan** (Treatment mode), and **Analyze** (Reports).

-   ### 📝 **Writing & Editing**
    -   **Industry Formatting:** Custom `PageRenderer.js` virtual pagination targets 12pt Courier, standard margins, scene numbers, and print-oriented spacing.
    -   **Contextual Shortcuts:** `Enter`/`Tab` transitions are configurable per element; `Ctrl+E` cycles element types in place; `Ctrl+S` saves.
    -   **Fountain Authoring:** forces (`.slug`, `@Name`, `!action`, `> transition`, `> centered <`), inline `**bold**`/`*italic*`/`_underline_` via Ctrl+B/I/U (markers visible in the editor, hidden in output), `[[notes]]` excluded from print and counts.
    -   **Page View:** Switchable paginated view mirrors printed pages; print uses the same geometry.
    -   **Smart Autocomplete:** Character-name autocomplete + suffix suggestions; predictive “suggested character” hints.
    -   **Customizable Keymap:** Per-element `Enter`/`Tab` mappings persisted to LocalStorage; theme toggle.
    -   **Print Prep:** Unified print modal outputs script, treatment, or report layouts (facing/booklet/single) with watermarks, title pages, and page ranges mapped back to scenes.
    -   **File Handling:** Import/export `.json`, `.fdx`, `.fountain`, `.txt`; OS File Handling API supported when available.

-   ### 📋 **Planning & Outlining (Treatment Mode)**
    -   **Scene Cards:** Script is projected into a read-only, card-based view for high-level editing.
    -   **Scene Metadata:** Descriptions, notes, scene numbers, colors, and icons live alongside each slug.
    -   **Images & Tracks:** Attach reference images (stored in IndexedDB) and YouTube tracks per scene.
    -   **Inline Edits:** Adjust scene descriptions and ordering without touching the formatted script; drag scenes to reorder or insert transitions/scene headings inline.

-   ### 📊 **Analysis & Reports**
    -   **Script Dashboard:** KPIs for pages, scenes, words, runtime (eighths), and setting/time breakdown.
    -   **Character Analysis:** Per-character reports (speaking/non-speaking scenes, words, interactions, monologues).
    -   **Scene Chronology:** Scene list with length (eighths), starting page, and speaking/non-speaking badges.
    -   **Lightweight Charts:** Conic-gradient pie slices and sortable tables inside the modal; export text or print to PDF, or send to the Print Prep modal as a report package.

-   ### 🤝 **Real-Time Collaboration**
    -   **Peer-to-Peer:** Trystero-powered WebRTC rooms; invite by sharing a `?room=` link or room id.
    -   **Baton Passing:** Single-writer baton; guests without the baton are read-only. Mobile guests join as spectators by design.
    -   **State Sync:** Host sends full snapshots plus live updates; heartbeat auto-disconnects on timeouts and reclaims the editor cleanly.
    -   **Optional Media:** Webcam/mic streaming per session; HUD shows active media and click-to-join scene scroll.

-   ### ⚙️ **General**
    -   **Local-Only Data:** Scripts stored in IndexedDB with LocalStorage autosave and scene meta cache.
    -   **PWA Ready:** Installable; works offline after first load via `sw.js`; mobile welcome screen helps pick recent scripts.
    -   **Printing:** Print view shares pagination logic with Page View; title page can be toggled, and a dedicated print modal handles script/treatment/report output.
    -   **Light/Dark Mode:** Respects system preference; stored setting overrides.
    -   **Assets:** Scene images and YouTube track metadata stay local (IndexedDB) and are not embedded in exports.
    -   **Feature Toggles & Portable Build:** Feature Manager lets you enable/disable optional modules (Collab, Media) and export a single-file offline build (`file://`) that omits network-bound features.

## 📌 Current State & Limitations
-   **Local-first only:** Scene images and YouTube track links live in the browser (IndexedDB/LocalStorage) and are **not exported** with `.fdx/.fountain/.txt`; backups should use `.json`.
-   **Autosave model:** Content writes to LocalStorage immediately and is debounced into IndexedDB, with an unload-time flush and a single-writer lock across browser tabs (a second tab opens read-only with a takeover option).
-   **Collaboration:** Baton-passing model — exactly one writer at a time; peers without the baton are read-only and mobile peers join as spectators. Sessions speak collab protocol v2, so **both peers must run an up-to-date SFSS** (an older client's messages are ignored with a reload prompt). **Scene images stay on their author's device**: `sceneMeta` syncs across the session but the image blobs never leave the browser that added them — the other peer sees the rest of the scene data and missing images render gracefully. No app-layer encryption beyond WebRTC DTLS-SRTP. When a session empties out it waits 60 seconds for a reconnection before ending.
-   **Pagination:** one shared engine paginates Page View, print, reports, and FDX export identically (orphan/widow rules, `(MORE)`/`(CONT'D)`, scene-heading carry), covered by a browser test suite. Letter and A4 share identical pagination by design (constant live text area).
-   **Media playback:** Scene music relies on YouTube oEmbed/iframe; it requires network access even though the rest of the app is offline-capable. Portable builds replace metadata playback with clickable links.
-   **Portable build scope:** The single-file export removes Collaboration and the Media Player for `file://` compatibility; core editor/print/treatment/report features remain.

## 🚀 Getting Started

SFSS is a static web application and requires no server or build process to run.

1.  **Download:** Clone or download the repository.
2.  **Run:** Open `index.html` in a modern web browser (Chrome, Firefox, Safari) or serve the folder with any static server.
3.  **Install (Optional):** Use the in-app "Install" button or browser PWA prompt to install locally.
4.  **Create a portable file (Optional):** Open **Feature Management** in the App menu, set your feature toggles, and click **Generate Single-File** to download a `sfss_portable.html` you can open directly via `file://` (Collab/Media excluded).
## 🛠️ Technical Deep Dive

### Technology Stack
*   **Core Logic:** Vanilla JavaScript (ES modules). No bundler or external runtime deps beyond local vendor assets.
*   **P2P Networking:** Trystero (`trystero.min.js`) for serverless WebRTC.
*   **Styling:** Modular CSS with CSS variables for theming.
*   **Storage:** IndexedDB for scripts/images; LocalStorage for autosave cache, meta, settings, and keymap.
*   **PWA:** `sw.js` for offline caching and `manifest.json` for install metadata. File Handling API supported when the browser allows.
*   **Icons & Fonts:** FontAwesome and Courier Prime (locally hosted).
*   **Feature/runtime toggles:** `FeatureManager.js` persists enabled modules and gates optional imports; `SingleFileGenerator.js` flattens the app into a portable single-file build with stubs for disabled modules.
### Project Structure
The codebase is organized into a modular, class-based architecture.

``` #
/
├── index.html                       # Main application entry point, contains all modal HTML.
├── sw.js                            # Service Worker for PWA offline caching.
├── manifest.json                    # PWA manifest for app installation properties.
├── assets/
│   ├── css/                         # Style sheets, modularized by function.
│   │   ├── base.css                 # Core variables, resets, and loader.
│   │   ├── layout.css               # Main application layout (toolbar, sidebar, editor).
│   │   ├── components.css           # Styles for reusable UI components (modals, buttons, etc.).
│   │   ├── editor.css               # Formatting for the main contenteditable editor.
│   │   ├── collab.css               # Collaboration HUD/top bar styles.
│   │   ├── print.css                # Page geometry and @media print rules.
│   │   ├── reports.css              # Styles for the Reports Manager modal.
│   │   └── treatment.css            # Styles for the Treatment Mode (scene cards).
│   │
│   ├── js-mod/                      # Core JavaScript source modules (ES6 Classes).
│   │   ├── SFSS.js                  # Main controller, event bus, and state manager.
│   │   ├── EditorHandler.js         # Manages all contenteditable logic and keyboard shortcuts.
│   │   ├── PageRenderer.js          # Virtual pagination engine for "Page View" and printing.
│   │   ├── SidebarManager.js        # Controls scene navigation, metadata, and assets.
│   │   ├── StorageManager.js        # Handles all IndexedDB/LocalStorage interactions.
│   │   ├── ReportsManager.js        # Generates script/character reports and simple charts.
│   │   ├── PrintManager.js          # Print Prep modal for script/treatment/report output.
│   │   ├── TreatmentManager.js      # Treatment mode logic; delegates rendering to TreatmentRenderer.
│   │   ├── TreatmentRenderer.js     # Renders the card-based Treatment mode.
│   │   ├── MediaPlayer.js           # Manages the YouTube IFrame API player per scene.
│   │   ├── CollaborationManager.js  # Handles P2P connection, baton, and media streams.
│   │   ├── CollabUI.js              # Manages the UI for the collaboration feature.
│   │   ├── IOManager.js             # Import/export for JSON/FDX/Fountain/Text.
│   │   ├── SettingsManager.js       # Keymaps, theme, and preferences.
│   │   ├── FountainParser.js        # Fountain parsing/generation.
│   │   ├── ScrollbarManager.js      # Styled scrollbar helper.
│   │   ├── Constants.js             # Defines element types and other static configs.
│   │   └── IDBHelper.js             # A wrapper for IndexedDB operations.
│   │
│   ├── script.js                    # Main script bootstrapper, loads SFSS.js.
│   ├── trystero.min.js              # WebRTC helper library for P2P networking.
│   ├── fontawesome/                 # Font Awesome library (local).
│   └── googlefonts/                 # Courier Prime font files (local).
│
└── README.md                        # This file.
```

## 📄 License

This project is distributed under the **MIT License**. See the `LICENSE` section in the app's "Help & Info" modal for more details on third-party licenses.
