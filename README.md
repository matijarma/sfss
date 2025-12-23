# SFSS - Simple Free Screenplay Software

**A professional, client-side Screenwriting Progressive Web App (PWA) designed for privacy, performance, and portability.**

**Simple Free Screenwriting Software** or **SFSS** is a powerful, open-source tool that brings an industry-standard writing experience directly to your browser. Built with a "local-first" philosophy, it ensures total privacy and offline capability without reliance on external servers or subscriptions. All your work is saved directly to your device.

## ✨ Core Features

The application is a feature-complete writing studio built with three primary modes: **Write**, **Plan**, and **Analyze**.

-   ### 📝 **Writing & Editing**
    -   **Industry Formatting:** A custom `PageRenderer.js` engine ensures 12pt Courier, correct margins, and standard element spacing.
    -   **Contextual Shortcuts:** `Enter` and `Tab` keys intelligently predict the next logical element (e.g., Character → Dialogue).
    -   **Page View:** A real-time preview of how your script will look on a printed page, with accurate pagination.
    -   **Smart Autocomplete:** Remembers characters and provides suggestions.
    -   **Customizable Keymap:** Remap `Enter` and `Tab` behavior for each screenplay element.
    -   **File Handling:** Supports drag-and-drop and OS-level file opening for `.json`, `.fdx`, and `.fountain` files.

-   ### 📋 **Planning & Outlining (Treatment Mode)**
    -   **Visual Scene Cards:** Organize your story with a drag-and-drop interface for scenes.
    -   **Scene Metadata:** Add descriptions, notes, reference images, and color-coded tags to each scene card.
    -   **Integrated Storyboarding:** Upload images to scene cards to create a visual storyboard.
    -   **Soundtrack:** Link a YouTube track to a scene to build a working soundtrack for your script.

-   ### 📊 **Analysis & Reports**
    -   **Script Dashboard:** Get a high-level overview with KPIs for page count, scene count, word count, and estimated runtime.
    -   **Character Analysis:** Generate detailed reports on any character, including dialogue statistics, scene presence, and top interactions.
    -   **Scene Chronology:** View a complete breakdown of all scenes, their length, and the characters within them.
    -   **Data Visualization:** Reports include pie charts and tables for easy analysis of script breakdown (INT. vs EXT., DAY vs. NIGHT).
    -   **Exportable:** Reports can be printed or saved to PDF.

-   ### ⚙️ **General**
    -   **100% Client-Side:** No database, no cloud logins. All work is saved locally via `IndexedDB`.
    -   **PWA Ready:** Installable on Desktop (Windows, Mac, Linux) and Mobile (iOS, Android) for a native app experience.
    -   **Full Offline Support:** Works completely offline once loaded.
    -   **Import/Export:** Supports `.json` (native), `.fdx` (Final Draft), `.fountain`, and plain `.txt`.
    -   **Light/Dark Mode:** Adapts to your system preference or can be toggled manually.

## 🚀 Getting Started

SFSS is a static web application and requires no server or build process to run.

1.  **Download:** Clone or download the repository.
2.  **Run:** Open `index.html` in a modern web browser (Chrome, Firefox, Safari).
3.  **Install (Optional):** Use the "Install" button in the app's menu (or the browser's PWA install prompt) to save it as a local application.

## 🛠️ Technical Deep Dive

### Technology Stack
*   **Core Logic:** **Vanilla JavaScript (ES6+ Modules)**. The app is intentionally dependency-free for maximum performance and longevity.
*   **Styling:** **Modular CSS** with CSS Variables for theming. No pre-processors are used.
*   **Storage:** `IndexedDB` for script and image data; `LocalStorage` for user settings.
*   **PWA:** `sw.js` (Service Worker) for offline caching and `manifest.json` for app installation.
*   **Icons & Fonts:** FontAwesome and Courier Prime (locally hosted).

### Project Structure
The codebase is organized into a modular, class-based architecture.

```
/
├── index.html              # Main application entry point, contains all modal HTML.
├── sw.js                   # Service Worker for PWA offline caching.
├── manifest.json           # PWA manifest for app installation properties.
├── assets/
│   ├── css/                # Style sheets, modularized by function.
│   │   ├── base.css        # Core variables, resets, and loader.
│   │   ├── layout.css      # Main application layout (toolbar, sidebar, editor).
│   │   ├── components.css  # Styles for reusable UI components (modals, buttons, etc.).
│   │   ├── editor.css      # Formatting for the main contenteditable editor.
│   │   ├── print.css       # Page geometry and @media print rules.
│   │   ├── reports.css     # Styles for the Reports Manager modal.
│   │   └── treatment.css   # Styles for the Treatment Mode (scene cards).
│   │
│   ├── js-mod/             # Core JavaScript source modules (ES6 Classes).
│   │   ├── SFSS.js         # Main controller, event bus, and state manager.
│   │   ├── EditorHandler.js# Manages all contenteditable logic and keyboard shortcuts.
│   │   ├── PageRenderer.js # Virtual pagination engine for "Page View" and printing.
│   │   ├── SidebarManager.js # Controls scene navigation, metadata, and assets.
│   │   ├── StorageManager.js # Handles all IndexedDB/LocalStorage interactions.
│   │   ├── ReportsManager.js # Generates script breakdowns and reports.
│   │   ├── TreatmentRenderer.js# Renders the card-based "Treatment Mode".
│   │   ├── MediaPlayer.js  # Manages the YouTube IFrame API player.
│   │   ├── Constants.js    # Defines element types and other static configs.
│   │   └── IDBHelper.js    # A wrapper for IndexedDB operations.
│   │
│   ├── script.js           # Main script bootstrapper, loads SFSS.js.
│   ├── fontawesome/        # Font Awesome library (local).
│   └── googlefonts/        # Courier Prime font files (local).
│
└── README.md               # This file.
```

## 📄 License

This project is distributed under the **MIT License**. See the `LICENSE` section in the app's "Help & Info" modal for more details on third-party licenses.