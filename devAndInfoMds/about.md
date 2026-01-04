# SFSS
**Professional Client-Side Screenwriting PWA**

## 1. Project Overview
SFSS is a professional, privacy-focused screenwriting application that runs entirely in your browser. It combines industry-standard formatting with a local-first, offline-capable delivery.

**Core Philosophy:**
*   **Local-First:** Your scripts never leave your device. Data is stored in your browser's `IndexedDB` and `LocalStorage`.
*   **Offline-Capable:** Functions as a fully installable Progressive Web App (PWA) that works without an internet connection.
*   **Zero-Distraction:** A clean, minimalist interface designed to keep you in the flow, handling formatting automatically.
*   **Current Alpha Status:** Collaboration is baton-based and read-only for guests without the baton (mobile is spectator-only); scene images and YouTube track links remain local and are not included in exports.

---

## 2. Key Features

### 🎬 Professional Formatting Engine
SFSS features a custom pagination and formatting engine (`PageRenderer.js`) tuned for screenplay output:
*   **Typography:** Courier Prime 12pt.
*   **Geometry:** US Letter with standard margins (1.5" left, 1.0" others) plus A4 emulation.
*   **Pagination:** Virtual page breaks for Page View/print; optional scene numbers and header date.
*   **Element Spacing:** Automatic handling of standard screenplay elements (Sluglines, Action, Character, Dialogue, Parentheticals, Transitions).

### 📝 Writing Experience
*   **Context-Aware Shortcuts:**
    *   `Enter`/`Tab`: Per-element transitions are configurable; a cycle shortcut rotates element classes.
*   **Smart Autocomplete:** Character suggestions, suffix completions, and "next speaker" hints.
*   **Focus Controls:** Sidebar auto-hide, dropdown/horizontal type selectors, and page-view toggle.
*   **Dark Mode:** Built-in high-contrast dark theme for late-night writing sessions.

### 📋 Treatment & Planning Mode
A dedicated **Treatment Mode** allows you to outline and structure your story before writing the script:
*   **Scene Cards:** Visualize your script as a card list projected from the screenplay.
*   **Metadata Editing:** Edit scene descriptions, notes, numbers, colors, and icons directly on cards.
*   **Assets:** Attach reference images and YouTube tracks to scenes (stored locally).
*   **Seamless Switching:** Toggle between the Script Editor and Treatment view; changes stay in sync.
*   **Export Scope:** Image binaries and track metadata stay local; use `.json` for the most faithful backup.

### 📊 Advanced Reports & Analytics
Gain insights into your screenplay with the built-in **Reports Manager**:
*   **Script Dashboard:** Setting (INT/EXT) and time-of-day breakdown, page/scene/word/runtime KPIs.
*   **Character Reports:** Dialogue counts, speaking vs. non-speaking scenes, interactions, monologues.
*   **Scene Chronology:** Scene lengths (eighths) with speaking/non-speaking badges and start pages.
*   **Export:** Copyable text output and printable modal with lightweight conic charts.

### 🗃️ Sidebar & Scene Management
The sidebar acts as your production hub:
*   **Navigation:** Clickable scene list with length badges and optional scene numbers.
*   **Mood Boards:** Upload reference images directly to scenes (stored in IndexedDB).
*   **Soundtrack Integration:** Link **YouTube** tracks to scenes; the integrated player follows the playlist.
*   **Organization:** Color-code scenes and assign semantic icons for quick visual reference.

### 🤝 Real-Time Collaboration (Beta)
Write with a partner in a serverless environment.
*   **Peer-to-Peer Connection:** Connect directly via Trystero (WebRTC).
*   **Baton Control:** Only one writer edits at a time; guests without the baton are read-only (mobile joins as spectator).
*   **State Sync:** Host shares snapshots and deltas; heartbeat detects disconnects.
*   **Optional Video/Audio:** WebRTC media streaming with basic mic/cam toggles.

### 💾 Import / Export
*   **SFSS JSON (`.json`)**: Full project backup including metadata (images remain local in IndexedDB).
*   **Final Draft (`.fdx`)**: Import and export compatibility with the industry standard.
*   **Fountain**: Support for the popular plain-text screenwriting markup.
*   **Plain Text (`.txt`)**: Simple text export.

---

## 3. Technical Architecture

SFSS is a **Single Page Application (SPA)** built with Vanilla JavaScript (ES Modules).

*   **Entry Point:** `index.html` initializes the app via `assets/script.js`, which loads the core `SFSS.js` module.
*   **State Management:** Centralized state in `SFSS.js` with a custom Undo/Redo history stack.
*   **Persistence:**
    *   **Scripts:** Stored in IndexedDB for capacity; LocalStorage keeps autosave shadow copies for fast boot.
    *   **Images:** Binary image data is stored in IndexedDB to bypass LocalStorage limits.
    *   **Settings/Meta:** User preferences and scene meta cache are saved in LocalStorage.
*   **Modular Design:**
    *   `EditorHandler.js`: Manages the `contenteditable` editor logic.
    *   `PageRenderer.js`: Handles virtual pagination and rendering for print/PDF.
    *   `SidebarManager.js`: Manages scene data, stats, settings popup, and assets.
    *   `IOManager.js`: Handles file imports/exports (FDX, JSON, Fountain).
    *   `SettingsManager.js`: Manages user preferences and keymaps.
    *   `ReportsManager.js`: Generates analytical data and visualizations.
    *   `TreatmentRenderer.js` & `TreatmentManager.js`: Manage the card-based planning view and its logic.

---

## 4. Usage Tips

*   **Install App:** Click the "Install" button in the sidebar (or browser address bar) to install SFSS as a native desktop or mobile app.
*   **Backup:** While data is saved automatically to your browser, regular backups to `.json` or `.fdx` are recommended.
*   **Mobile:** The interface automatically adapts to touch screens, offering a simplified "Reading Mode" and touch-friendly controls.

---
**License:** MIT
