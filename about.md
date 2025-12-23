# SFSS
**Professional Client-Side Screenwriting PWA**

## 1. Project Overview
SFSS is a professional, privacy-focused screenwriting application that runs entirely in your browser. It combines the strict formatting standards of industry tools (like Final Draft) with the flexibility of modern web technologies.

**Core Philosophy:**
*   **Local-First:** Your scripts never leave your device. Data is stored in your browser's `IndexedDB` and `LocalStorage`.
*   **Offline-Capable:** Functions as a fully installable Progressive Web App (PWA) that works without an internet connection.
*   **Zero-Distraction:** A clean, minimalist interface designed to keep you in the flow, handling formatting automatically.

---

## 2. Key Features

### 🎬 Professional Formatting Engine
SFSS features a custom-built pagination and formatting engine (`PageRenderer.js`) that enforces industry standards:
*   **Typography:** Courier Prime 12pt.
*   **Geometry:** US Letter dimensions with precise margins (1.5" left, 1.0" others).
*   **Pagination:** Real-time calculation of page breaks, respecting "orphan" and "widow" rules to ensure professional flow.
*   **Element Spacing:** Automatic handling of standard screenplay elements (Sluglines, Action, Character, Dialogue, Parentheticals, Transitions).

### 📝 Writing Experience
*   **Context-Aware Shortcuts:**
    *   `Enter`: Intelligently creates the next logical element (e.g., `Character` $\to$ `Dialogue`).
    *   `Tab`: Cycles through valid element types for the current context.
*   **Smart Autocomplete:** Remembers your characters and locations, offering suggestions as you type.
*   **Focus Mode:** A distraction-free UI that can hide the sidebar and toolbars.
*   **Dark Mode:** Built-in high-contrast dark theme for late-night writing sessions.

### 📋 Treatment & Planning Mode
A dedicated **Treatment Mode** allows you to outline and structure your story before writing the script:
*   **Scene Cards:** Visualize your script as a list of drag-and-drop cards.
*   **Metadata Editing:** Edit scene descriptions, notes, and titles directly on the cards.
*   **Beat Planning:** Structure your narrative flow without worrying about script formatting.
*   **Seamless Switching:** Toggle between the Script Editor and Treatment view instantly; changes sync automatically.

### 📊 Advanced Reports & Analytics
Gain deep insights into your screenplay with the built-in **Reports Manager**:
*   **Script Dashboard:** Visualizes Setting (Int/Ext) balance, Time of Day distribution, and overall pacing.
*   **Character Reports:** Detailed breakdown of dialogue counts, speaking vs. non-speaking scenes, and interaction graphs.
*   **Scene Chronology:** A timeline view of your story's structure and length.
*   **PDF Generation:** Export professional reports directly to PDF.

### 🗃️ Sidebar & Scene Management
The powerful sidebar acts as your production hub:
*   **Navigation:** Clickable scene list for quick jumping.
*   **Mood Boards:** Upload reference images directly to specific scenes.
*   **Soundtrack Integration:** Link **YouTube** tracks to scenes. The integrated media player allows you to listen to your scene-specific playlist while writing.
*   **Organization:** Color-code scenes and assign semantic icons (e.g., Car, Home, Phone) for quick visual reference.

### 💾 Import / Export
*   **SFSS JSON (`.json`)**: Full project backup including metadata, images, and history.
*   **Final Draft (`.fdx`)**: Import and export compatibility with the industry standard.
*   **Fountain**: Support for the popular plain-text screenwriting markup.
*   **Plain Text (`.txt`)**: Simple text export.

---

## 3. Technical Architecture

SFSS is a **Single Page Application (SPA)** built with Vanilla JavaScript (ES Modules).

*   **Entry Point:** `index.html` initializes the app via `assets/script.js`, which loads the core `SFSS.js` module.
*   **State Management:** Centralized state in `SFSS.js` with a custom Undo/Redo history stack.
*   **Persistence:**
    *   **Scripts:** Stored in `IndexedDB` for high capacity and reliability.
    *   **Images:** Binary image data is stored in `IndexedDB` to bypass LocalStorage limits.
    *   **Settings:** User preferences are saved in `LocalStorage`.
*   **Modular Design:**
    *   `EditorHandler.js`: Manages the `contenteditable` editor logic.
    *   `PageRenderer.js`: Handles virtual pagination and rendering for print/PDF.
    *   `SidebarManager.js`: Manages scene data, drag-and-drop reordering, and assets.
    *   `ReportsManager.js`: Generates analytical data and visualizations.
    *   `TreatmentRenderer.js`: Renders the card-based planning view.

---

## 4. Usage Tips

*   **Install App:** Click the "Install" button in the sidebar (or browser address bar) to install SFSS as a native desktop or mobile app.
*   **Backup:** While data is saved automatically to your browser, regular backups to `.json` or `.fdx` are recommended.
*   **Mobile:** The interface automatically adapts to touch screens, offering a simplified "Reading Mode" and touch-friendly controls.

---
**Version:** 2025.12
**License:** MIT