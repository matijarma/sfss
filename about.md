# SFSS
**Professional Client-Side Screenwriting PWA**

## 1. Project Overview & Vision
SFSS is a "privacy-first, offline-first" Single Page Application (SPA) designed to bring industry-standard screenplay formatting to the browser without relying on server-side processing or cloud storage. 

**Core Philosophy:**
*   **Zero Latency:** Built on Vanilla JavaScript for instant startup and typing response.
*   **Zero Cloud Dependency:** All data lives in the user's browser (LocalStorage / IndexedDB). No sign-ups, no servers.
*   **Zero Distractions:** A clean, minimalist interface that enforces strict formatting rules automatically.

The application emulates the physical page geometry required by the film industry (US Letter, 12pt Courier Prime) to ensure that "one page equals roughly one minute of screen time."

---

## 2. Technical Architecture

SFSS is built as a modular, vanilla JavaScript application utilizing modern web standards.

### Technology Stack
*   **Frontend:** Vanilla ES6+ JavaScript (ES Modules).
*   **Styling:** Native CSS with CSS Variables for theming (Light/Dark modes).
*   **Frameworks:** None. Zero dependencies for core logic.
*   **Icons:** FontAwesome.
*   **Fonts:** Courier Prime (via Google Fonts).
*   **PWA:** Service Worker (`sw.js`) for offline caching and `manifest.json` for installation.

### Module Structure (`assets/js-mod/`)
The application logic is decentralized into specialized managers orchestrated by `SFSS.js`:
*   **`SFSS.js`**: Application entry point, state management, and event binding.
*   **`EditorHandler.js`**: Handles the `contenteditable` DOM manipulation, input sanitization, and context-aware shortcuts (Enter/Tab logic).
*   **`PageRenderer.js`**: A virtual pagination engine that calculates page breaks, "orphans", and "widows" based on strict pixel metrics (96dpi, 16px line height).
*   **`StorageManager.js`**: Manages persistence of script content to `IndexedDB`.
*   **`IDBHelper.js`**: Utility wrapper for `IndexedDB` interactions.
*   **`SidebarManager.js`**: Manages the scene navigation sidebar, drag-and-drop ordering, and scene metadata (colors, tags, music).
*   **`MediaPlayer.js`**: Integrates a YouTube IFrame API player to associate music tracks with specific scenes.
*   **`ReportsManager.js`**: Generates statistical breakdowns (character lines, scene lengths).

### Data Persistence
*   **Scripts:** Stored in `IndexedDB` (via `StorageManager`) for improved reliability and capacity.
*   **Images:** Scene reference images are stored in `IndexedDB` (via `IDBHelper`) to avoid `localStorage` quota limits.
*   **State:** The app uses a custom history stack for Undo/Redo functionality.

---

## 3. Practical Usage & Features

### Formatting Engine
SFSS enforces standard screenplay metrics:
*   **Font:** Courier Prime, 12pt.
*   **Line Height:** 12pt (approx. 6 lines per inch).
*   **Margins:** 1.5" Left, 1.0" Right, 1.0" Top/Bottom.
*   **Paper:** US Letter (with A4 emulation mode).

### Writing Tools & Shortcuts
The editor uses context-aware key bindings to speed up writing:
*   **Enter:** Creates the logical next element (e.g., `Scene Heading` $\to$ `Action`, `Character` $\to$ `Dialogue`).
*   **Tab:** Alternates elements (e.g., `Action` $\to$ `Character`, `Dialogue` $\to$ `Parenthetical`).
*   **Ctrl + Enter:** Opens the Element Type Selector popup.
*   **Smart Paste:** Automatically detects and formats FDX or plain text content pasted into the editor.

**Element Shortcuts (inside popup or type selector):**
*   `S` - Scene Heading (Slug)
*   `A` - Action
*   `C` - Character
*   `D` - Dialogue
*   `P` - Parenthetical
*   `T` - Transition

### Scene Management (Sidebar)
*   **Navigation:** Click any scene in the sidebar to scroll to it.
*   **Metadata:** Assign colors, FontAwesome icons, notes, and descriptions to scenes.
*   **Soundtrack:** Paste a YouTube URL into a scene's metadata to link a track. The built-in player controls playback while writing.
*   **Reference Images:** Upload images to specific scenes for mood boards/continuity.

### Import / Export
*   **SFSS JSON (`.json`)**: Full backup including metadata.
*   **Final Draft (`.fdx`)**: XML-based industry standard export.
*   **Fountain (`.fountain`)**: Plain text markup standard.
*   **Plain Text (`.txt`)**: Simple text dump.

---

## 4. Future Roadmap

The development focus is shifting towards robustness and expanded production features:

1.  **Advanced Printing:** Native PDF generation to replace the current browser-print dependency, ensuring pixel-perfect pagination across all devices.
2.  **Zoom Controls:** UI scaling for both the continuous editor and page view modes.
3.  **Revisions:** Tracking changes (colored revision pages, asterisks).
4.  **Enhanced Reports:** More detailed analytics and visualization of script pacing.
5.  **Script Bible Layout:** A dedicated view for generating a printable "Bible" containing character bios, location images, and notes alongside the script.
