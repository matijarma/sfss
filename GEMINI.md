# SFSS (Simple Free Screenplay Software) - Project Context

## 1. Project Overview

**SFSS** is a professional, client-side Screenwriting Progressive Web App (PWA). It provides an industry-standard writing environment directly in the browser, adhering to strict typographic rules (Courier 12pt, specific margins) where one page equals roughly one minute of screen time.

*   **Type:** Single Page Application (SPA) / Progressive Web App (PWA).
*   **Philosophy:** Local-First, Privacy-Focused, Offline-Capable.
*   **Core Value:** "WYSIWYG" screenplay formatting without server dependency.

## 2. Technology Stack

*   **Language:** Vanilla JavaScript (ES6 Modules). No frameworks (React/Vue/Angular).
*   **Styling:** Modular CSS (`assets/css/`). Uses CSS Variables for theming (Light/Dark).
*   **Storage:** `IndexedDB` (via `IDBHelper.js` wrapper) for scripts; `LocalStorage` for preferences.
*   **PWA:** `sw.js` (Service Worker), `manifest-testing.json`, and File Handling API support.
*   **External Assets:** FontAwesome (local), Courier Prime font (local).

## 3. Architecture & Key Modules

The application is built on a modular class-based architecture, orchestrated by a central controller.

### Entry & Initialization
*   **`index.html`**: The single entry point. Sets up the DOM skeleton, loads CSS, and bootstraps the app.
*   **`assets/script.js`**: Simple bootstrapper that imports and initializes the main `SFSS` class.

### Core Modules (`assets/js-mod/`)

| Class | Description |
| :--- | :--- |
| **`SFSS.js`** | **Main Controller**. Initializes sub-modules, handles global state, event binding, and high-level orchestration (Save/Load, Mode Switching). |
| **`EditorHandler.js`** | Manages the `contenteditable` editor. Handles text input, element types (Slug, Action, Dialogue), and keyboard shortcuts (Enter/Tab logic). |
| **`PageRenderer.js`** | **Critical**. The "Formatting Engine". Calculates virtual pagination based on strict physical dimensions (US Letter/A4) to simulate print output in the browser. |
| **`StorageManager.js`** | Handles data persistence. Manages CRUD operations for scripts in `IndexedDB` and handles Auto-Save/Backup logic. |
| **`SidebarManager.js`** | Controls the navigation sidebar, scene list, and script metadata UI. |
| **`TreatmentRenderer.js`**| Renders the "Treatment Mode" (Kanban-style scene cards) for planning and outlining. |
| **`ReportsManager.js`** | Generates statistical reports (Scene counts, Character interactions) and visualizations. |
| **`MediaPlayer.js`** | Integrates YouTube IFrame API for the soundtrack feature attached to scenes. |
| **`Constants.js`** | Defines static configuration, element types (`sc-slug`, `sc-action`, etc.), and format mappings (FDX/Fountain). |
| **`IDBHelper.js`** | specific wrapper for `IndexedDB` promises. |

## 4. Data Structures

### Script Data Model (JSON)
The internal storage format is a JSON object structure:
```json
{
  "id": "script-123456789",
  "createdAt": "ISO8601 String",
  "lastSavedAt": "ISO8601 String",
  "content": {
    "meta": { "title": "...", "author": "..." },
    "sceneMeta": { "line-id-xyz": { "description": "...", "color": "..." } },
    "blocks": [
      { 
        "type": "sc-slug", 
        "text": "INT. ROOM - DAY", 
        "id": "line-xyz" 
      },
      { 
        "type": "sc-action", 
        "text": "Something happens.", 
        "id": "line-abc" 
      }
    ],
    "characters": ["HERO", "VILLAIN"]
  }
}
```

### Element Types (CSS Classes)
The editor relies on specific CSS classes to style paragraphs:
*   `sc-slug`: Scene Heading (Bold, Uppercase)
*   `sc-action`: Action lines
*   `sc-character`: Character Name (Centered-ish)
*   `sc-dialogue`: Dialogue block
*   `sc-parenthetical`: Parenthetical instructions
*   `sc-transition`: Cut to/Fade out (Right aligned)

## 5. Development Workflow

Since this is a Vanilla JS project, there is no build step.

1.  **Run:** Serve the root directory using any static file server (e.g., `python3 -m http.server`, `php -S localhost:8000`, or VS Code Live Server).
2.  **Edit:** Modify files in `assets/js-mod/` or `assets/css/`.
3.  **Test:** Refresh the browser. Ensure Hard Refresh (Ctrl+F5) if caching is aggressive due to Service Worker.

### Key Conventions
*   **Strict Formatting:** Do not alter `PageRenderer.js` or `print.css` margins without understanding the "Screenplay Formatting Engine" specs (12pt Courier, 6 lines/inch).
*   **Separation of Concerns:** Keep UI logic in `SidebarManager`/`EditorHandler` and data logic in `SFSS`/`StorageManager`.
*   **Accessibility:** Ensure `aria-labels` and keyboard navigation are maintained.
*   **No External Dependencies:** Do not add npm packages. The project aims to be self-contained.

## 6. Formatting Rules (The "Engine")

Refer to `screenplay-formatting-engine.md` for the mathematical specifications of the layout.
*   **US Letter:** $8.5" \times 11"$. Live area $6" \times 9"$.
*   **A4 Emulation:** Specific margins are applied to A4 paper to force the text block to match US Letter flow exactly, preventing pagination drift between regions.
