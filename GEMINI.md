# SFSS - Project Context

## Project Overview
**SFSS** is a professional, client-side Screenwriting Progressive Web App (PWA). It is designed to provide industry-standard screenplay formatting directly in the browser, with offline capabilities and local data persistence.

The application is built as a Single Page Application (SPA). It features a custom "screenplay formatting engine" that enforces strict typographic rules (Courier 12pt, specific margins) to ensure one page equals roughly one minute of screen time.

## Technology Stack

*   **Frontend Core:** Vanilla JavaScript (ES Modules).
*   **Styling:** CSS (Modularized in `assets/css/`).
*   **PWA:** Service Worker (`sw.js`), Web App Manifest (`manifest.json`), File Handling API.
*   **Storage:** Browser LocalStorage / IndexedDB (via `StorageManager`).
*   **Icons:** FontAwesome.
*   **Fonts:** Courier Prime (via Google Fonts).

## Architecture

The application follows a modular architecture using ES6 Classes.

### Entry Point
*   **`index.html`**: The main entry point. It sets up the HTML skeleton, includes CSS/Fonts, handles cache-busting and initializes the application by loading `assets/script.js`.

### Core Logic (`assets/js-mod/`)
The JavaScript logic is centralized in `assets/js-mod/SFSS.js`, which orchestrates several specialized manager classes:

*   **`SFSS.js`**: The main controller class. Initializes the app, binds events, and coordinates between modules.
*   **`EditorHandler.js`**: Manages the `contenteditable` interface, text input, and formatting logic.
*   **`SidebarManager.js`**: Controls the scene navigation sidebar and scene metadata.
*   **`StorageManager.js`**: Handles persistence of scripts (Saving/Loading/Deleting) to `IndexedDB`.
*   **`PageRenderer.js`**: Responsible for the "Page View" mode, calculating pagination based on strict physical dimensions.
*   **`MediaPlayer.js`**: Manages the built-in music/audio player.
*   **`ReportsManager.js`**: Generates script breakdowns and reports.
*   **`Constants.js`**: Defines element types (Slug, Action, Character, etc.) and other static configuration.

### Formatting Engine
The core value proposition is the "Formatting Engine," detailed in `screenplay-formatting-engine.md`. It enforces:
*   **Font:** 12pt Courier (10 pitch).
*   **Line Height:** 12pt (6 lines per inch).
*   **Margins:** Specific US Letter and A4 emulation margins to ensure consistent pagination.

## Key Directories

*   **`assets/`**: Contains all static assets (CSS, JS, Fonts, Icons).
    *   **`js-mod/`**: Core JavaScript source modules.
    *   **`css/`**: Stylesheets split by function (`base.css`, `layout.css`, `editor.css`, etc.).
    *   **`icons/`**: App icons for PWA manifest.

## Development & Usage

### Conventions
*   **JavaScript:** Use ES6 classes and modules.
*   **CSS:** standard CSS variables are used for theming (light/dark mode).
*   **State:** The application state is transient in memory and persisted to LocalStorage on change.
*   **File Handling:** Supports importing/exporting `.json` (internal format), `.fdx` (Final Draft), and `.fountain`.

## Formatting Rules (Summary)
*   **Live Text Area:** $6.0" \times 9.0"$.
*   **US Letter:** Standard margins.
*   **A4:** "Emulation" margins to force the text block to match US Letter flow.