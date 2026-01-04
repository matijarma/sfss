# SFSS PWA Simulated Waterfall Log

> Goal: capture, in order, every fetch and byte a first‑time user would pull when loading SFSS, with inline commentary so the whole experience lives in one file.

Step 0 — navigation bootstrap  
- User enters the origin and requests `/`. No service worker is active yet, so this is a plain network request.

Step 1 — HTML response arrives (`index.html`)  
- Status 200, HTML body follows. This document contains the inline bootstrap loader that will inject CSS/JS with a version query param `?v=<cacheverzija>` plus the manifest link.  
- The bytes below are the exact response body as served.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <style>
        /* Loader styles with immediate theme support */
        :root {
            --loader-bg: #dfe4e8; /* matches --bg-body light */
            --loader-spinner: #ccc;
            --loader-accent: #0f62fe;
            --loader-text: #2f3542;
        }
        html.dark-mode {
            --loader-bg: #191c24; /* matches --bg-body dark */
            --loader-spinner: #2c3038;
            --loader-accent: #6fa0ff;
            --loader-text: #a0aab8;
        }
        .loader-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: var(--loader-bg); z-index: 9999; display: flex; 
            justify-content: center; align-items: center; flex-direction: column;
            color: var(--loader-text);
        }
        .loader-spinner {
            width: 50px; height: 50px; border: 5px solid var(--loader-spinner); 
            border-top-color: var(--loader-accent); border-radius: 50%; 
            animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loader-text { margin-top: 15px; font-family: sans-serif; font-weight: bold; opacity: 0.8; }
    </style>
    <script>
        (function() {
            // 0. Immediate Theme Application to prevent flash
            try {
                var storedTheme = localStorage.getItem('sfss_theme');
                var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
                    document.documentElement.classList.add('dark-mode');
                }
            } catch (e) { console.log('Theme detection failed', e); }

            // Your Version Logic
            const staticversion = "" + "01-01-26_" + "public-" + "1401";
            //const staticversion = Math.round(Math.random()*1000000);

            const queryString = self.location.search;
            const params = new URLSearchParams(queryString);
            window.cacheverzija = params.get('v') ? params.get('v') : staticversion; 
            var v = window.cacheverzija;

            // Assets to load
            var cssFiles = [
                "assets/fontawesome/css/all.css",
                "assets/googlefonts.css",
                "assets/css/base.css",
                "assets/css/layout.css",
                "assets/css/components.css",
                "assets/css/editor.css",
                "assets/css/collab.css",
                "assets/css/print.css",
                "assets/css/reports.css",
                "assets/css/treatment.css"
            ];
            
            var jsFiles = [
                "assets/script.js"
            ];

            // 1. Handle Manifest (Optional, but you had it in your HTML)
            var manifest = document.createElement('link');
            manifest.rel = 'manifest';
            manifest.href = 'manifest.json?v=' + v;
            document.head.appendChild(manifest);

            // 2. Inject CSS
            cssFiles.forEach(function(src) {
                var link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = src + '?v=' + v;
                document.head.appendChild(link);
            });

            // 3. Inject JS
            // We defer this slightly to ensure CSS starts downloading first
            jsFiles.forEach(function(src) {
                var script = document.createElement('script');
                script.src = src + '?v=' + v;
                script.defer = true; // Important: behaves like putting script at end of body
                document.head.appendChild(script);
            });

        })();
    </script>
    <link rel="icon" type="image/png" sizes="192x192" href="assets/images/icon-64.png">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Free Screenplay Software</title>
    <meta name="theme-color" content="#0f62fe">
    <meta name="mobile-web-app-capable" content="yes">    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Simple Free Screenplay Software">
    <link rel="apple-touch-icon" href="assets/images/icon-512.png">
    <meta name="description" content="SFSS - The Simple and free Screenwriting Software, a client-side PWA">
</head>
<body class="bg-body">
    <div id="printingdiv"></div>
    <div id="app-loader" class="loader-overlay">
        <div class="loader-spinner"></div>
        <div class="loader-text">SFSS</div>
    </div>

<div id="app-container">

    <header id="toolbar">
        <button id="mobile-menu-btn" class="btn-icon">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        
        <h1>
            <img src="assets/images/icon-64.png" alt="Logo">
                    <span>S<span style="color:var(--accent)">F</span>SS</span>
        </h1>
        <div class="toggle-switch-wrapper mobile-only ml-1">
            <i class="fas fa-pen text-xs"></i>
            <label class="switch switch-sm">
                <input type="checkbox" id="mobile-treatment-switch">
                <span class="slider round"></span>
            </label>
            <i class="fas fa-th-large text-xs"></i>
        </div>
        
        <div class="toolbar-group desktop-only">
            <!-- SCREENPLAY MENU -->
            <div id="screenplay-menu-container" class="dropdown-container">
                <button id="screenplay-menu-btn" class="btn-text"><i class="fas fa-file-alt mr-1"></i></button>
                <div id="screenplay-menu-dropdown" class="dropdown-menu hidden">
                    <a href="#" id="new-screenplay-btn" class="dropdown-item">
                        <i class="fas fa-plus-circle mr-1 fa-fw"></i> New Screenplay
                    </a>
                    
                    <div class="nested-dropdown-group">
                        <a href="#" class="dropdown-item">
                            <i class="fas fa-folder-open mr-1 fa-fw"></i> Open
                            <i class="fas fa-caret-right ml-auto"></i>
                        </a>
                        <div id="open-menu-nested-dropdown" class="nested-dropdown hidden">
                            <a href="#" id="file-open-btn" class="dropdown-item">From file...</a>
                            <div id="saved-scripts-list"></div>
                            <div class="meta-text-small-padded">
                                SFSS is a client-side app. All data is stored in your browser.
                            </div>
                        </div>
                    </div>

                    <div class="nested-dropdown-group">
                        <a href="#" class="dropdown-item">
                            <i class="fas fa-file-export mr-1 fa-fw"></i> Backup&nbsp;
                            <i class="fas fa-caret-right ml-auto"></i>
                            <span id="backup-warning" class="hidden" style="font-size:0.7rem; color:var(--scene-color-3-light);">!</span>
                        </a>
                        <div class="nested-dropdown hidden">
                            <a href="#" id="download-json-btn" class="dropdown-item">JSON (.json)</a>
                            <a href="#" id="download-fdx-btn" class="dropdown-item">Final Draft (.fdx)</a>
                            <a href="#" id="download-fountain-btn" class="dropdown-item">Fountain (.fountain)</a>
                            <a href="#" id="download-text-btn" class="dropdown-item">Plain Text (.txt)</a>
                        </div>
                    </div>
                </div>
            </div>

            <!-- DOCUMENTS MENU -->
            <div id="documents-menu-container" class="dropdown-container">
                <button id="documents-menu-btn" class="btn-text"><i class="fas fa-copy mr-1"></i></button>
                 <div id="documents-menu-dropdown" class="dropdown-menu hidden">
                    <a href="#" id="print-btn" class="dropdown-item">
                        <i class="fas fa-print mr-1 fa-fw"></i> Prepare & Print
                    </a>
                    <a href="#" id="reports-menu-btn" class="dropdown-item">
                        <i class="fas fa-chart-bar mr-1 fa-fw"></i> Reports
                    </a>
                 </div>
            </div>

            <!-- APP MENU -->
            <div id="app-menu-container" class="dropdown-container">
                <button id="app-menu-btn" class="btn-text"><i class="fas fa-bars mr-1"></i></button>
                <div id="app-menu-dropdown" class="dropdown-menu hidden">
                    <a href="#" id="collab-menu-btn" class="dropdown-item">
                        <i class="fas fa-users mr-1 fa-fw"></i> Collaboration
                    </a>
                    <a href="#" id="settings-btn" class="dropdown-item">
                        <i class="fas fa-keyboard mr-1 fa-fw"></i> Shortcuts
                    </a>
                    <a href="#" id="help-btn" class="dropdown-item">
                        <i class="fas fa-question-circle mr-1 fa-fw"></i> Help & Info
                    </a>
                    <a href="#" id="install-pwa-btn" class="dropdown-item hidden">
                        <i class="fas fa-download mr-1 fa-fw"></i> Install App
                    </a>
                </div>
            </div>

            <button id="undo-btn" title="Undo" class="btn-text">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/></svg>
            </button>
            <button id="redo-btn" title="Redo" class="btn-text">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966a.25.25 0 0 1 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg>
            </button>     

            <div class="toolbar-divider"></div>

            <div class="toggle-switch-wrapper" title="Treatment Mode">
                <span class="toggle-label">Write</span>
                <label class="switch">
                  <input type="checkbox" id="treatment-mode-switch">
                  <span class="slider round"></span>
                </label>
                <span class="toggle-label">Plan</span>
            </div>
        </div>
        
        <div class="toolbar-divider"></div>

        <div class="flex-grow"></div>

        <div id="type-selector-container" class="desktop-only">
            <!-- Dropdown View -->
            <div id="dropdown-selector-wrapper" class="selector-wrapper">
                <select id="top-type-selector" class="type-selector">
                    <option value="sc-slug">Scene Heading</option>
                    <option value="sc-action">Action</option>
                    <option value="sc-character">Character</option>
                    <option value="sc-parenthetical">Parenthetical</option>
                    <option value="sc-dialogue">Dialogue</option>
                    <option value="sc-transition">Transition</option>
                </select>
                <div class="selector-arrow">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>

            <!-- Horizontal Toggle View -->
            <div id="horizontal-type-selector" class="horizontal-selector hidden">
                <div class="hz-track"></div>
                <div class="hz-pointer"></div>
                <!-- Note: The pointer logic will be handled by CSS/JS. I'll add the nodes -->
                <div class="hz-node" data-value="sc-slug" title="Scene Heading (S)">S</div>
                <div class="hz-node" data-value="sc-action" title="Action (A)">A</div>
                <div class="hz-node" data-value="sc-character" title="Character (C)">C</div>
                <div class="hz-node" data-value="sc-parenthetical" title="Parenthetical (P)">P</div>
                <div class="hz-node" data-value="sc-dialogue" title="Dialogue (D)">D</div>
                <div class="hz-node" data-value="sc-transition" title="Transition (T)">T</div>
            </div>

            <button id="toggle-selector-view-btn" class="btn-icon" title="Switch Selector View">
                <i class="fas fa-exchange-alt"></i>
            </button>
        </div>

        <div class="toolbar-divider desktop-only"></div>

        <div class="toolbar-group desktop-only">
            <button id="toolbar-scene-numbers" class="btn-icon" title="Toggle Scene Numbers">
                <i class="fas fa-list-ol"></i>
            </button>
            <button id="toolbar-date" class="btn-icon" title="Toggle Date in Header">
                <i class="far fa-calendar-alt"></i>
            </button>
        </div>
        
        <div id="writing-setting"></div>

        <div id="music-player" class="toolbar-group hidden">
            <div>
                 <button id="player-prev" class="btn-icon" title="Previous Track"><i class="fas fa-backward"></i></button>
                 <button id="player-play" class="btn-icon" title="Play/Pause"><i class="fas fa-play"></i></button>
                 <button id="player-next" class="btn-icon" title="Next Track"><i class="fas fa-forward"></i></button>
            </div>
            <div id="player-scene-indicator"></div>
        </div>

        <input type="file" id="file-input" accept=".json,.fdx,.fountain" class="hidden">

        <button id="page-view-btn" class="btn-icon" title="Page View">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3a.5.5 0 0 1 .5-.5zm2 .5a.5.5 0 0 0-1 0v3a.5.5 0 0 0 1 0v-3zM2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/></svg>
        </button>

        <button id="theme-toggle-btn" class="btn-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        </button>        

    </header>

    <div id="main-area">
        <span id="save-status"><i class="far fa-save"></i></span>
        <button id="show-sidebar-btn" class="btn-icon" title="Show Sidebar"><i class="fas fa-chevron-right"></i></button>
        <aside id="sidebar">
            <div id="mobile-menu-actions" class="mobile-only">
                <button id="mobile-app-menu-toggle" class="dropdown-item flex-justify-between-center font-bold border-bottom-light">
                    <span>App Menu</span>
                    <i class="fas fa-up fa-chevron-down"></i>
                </button>
                <div id="mobile-app-menu-content" class="hidden border-bottom-light pb-1">
                    <a href="#" data-action="new-screenplay" class="dropdown-item">
                        <i class="fas fa-plus-circle mr-1"></i> New Screenplay
                    </a>
                    
                    <div id="mobile-open-menu-container">
                        <a href="#" id="mobile-open-menu-toggle" class="dropdown-item">
                            <span><i class="fas fa-folder-open mr-1"></i>&nbsp;Open</span>
                            &nbsp;<i class="fas fa-chevron-down menu-icon-small"></i>
                        </a>
                        <div id="mobile-open-menu" class="hidden menu-padding-left">
                            <a href="#" data-action="open-from-file" class="dropdown-item">From file...</a>
                            
                            <div id="mobile-saved-scripts-list"></div>
                            
                            <div class="meta-text-small-padded">
                                All data is stored in your browser.
                            </div>
                        </div>
                    </div>
                    
                    <div id="mobile-backup-menu-container">
                        <a href="#" id="mobile-backup-menu-toggle" class="dropdown-item">
                            <span><i class="fas fa-file-export mr-1"></i> Backup <span id="mobile-backup-warning" class="hidden text-warning font-small">!</span></span>&nbsp;
                            <i class="fas fa-chevron-down menu-icon-small"></i>
                        </a>
                        <div id="mobile-backup-menu" class="hidden menu-padding-left">
                            <a href="#" data-action="download-json" class="dropdown-item">JSON (.json)</a>
                            <a href="#" data-action="download-fdx" class="dropdown-item">Final Draft (.fdx)</a>
                            <a href="#" data-action="download-fountain" class="dropdown-item">Fountain (.fountain)</a>
                            <a href="#" data-action="download-text" class="dropdown-item">Plain Text (.txt)</a>
                        </div>
                    </div>
                    
                    <a href="#" data-action="help" class="dropdown-item">
                        <i class="fas fa-question-circle mr-1"></i> Help & Info
                    </a>
                    <a href="#" data-action="install-pwa" class="dropdown-item hidden">
                        <i class="fas fa-solid fa-download fa-bounce mr-1"></i> Install
                    </a>

                    <div class="dropdown-item flex-justify-between-center" style="padding-right: 1rem;">
                        <span><i class="fas fa-hand-sparkles mr-1"></i> Show Welcome Screen</span>
                         <label class="switch">
                            <input type="checkbox" id="sidebar-welcome-toggle">
                            <span class="slider round"></span>
                        </label>
                    </div>
                </div>
            </div>
            
            

            <div id="sidebar-header">
                <span id="script-title-header" class="truncate"></span>
                <div class="sidebar-header-buttons">
                    <button id="script-meta-btn" class="btn-icon" title="Script Settings">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button id="hide-sidebar-btn" class="btn-icon" title="Hide Sidebar">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                </div>
            </div>
            <div id="scene-list"></div>
            <div class="sidebar-stats">
                <div id="stats-pages">Pages: 1</div>
                <div id="stats-words">Words: 0</div>
            </div>
        </aside>

        <main id="scroll-area">
            <div id="editor-wrapper">
                
                <div id="print-title-page">
                    <div id="tp-title" class="text-4xl font-bold uppercase underline decoration-2"></div>
                    <div>written by</div>
                    <div id="tp-author" class="text-xl"></div>
                    <div id="tp-contact"></div>
                </div>

                <div id="editor-container" contenteditable="true" spellcheck="false"></div>
                <div id="page-view-container" class="hidden"></div>
                
                <div id="autocomplete-menu" class="floating-menu"></div>
                <div id="type-selector-menu" class="floating-menu"></div>
            </div>
        </main>
    </div>
</div>

<div id="settings-modal" class="modal-overlay hidden">
    <div class="modal-window">
        <div class="modal-header">
            <span>Keyboard Shortcuts</span>
            <button id="settings-close-btn" class="btn-text">✕</button>
        </div>
        <div class="modal-body">
                <div id="keymap-settings"></div>
        </div>
        <div class="modal-footer">
            <button id="settings-save-btn" class="modal-btn-primary">Save & Close</button>
        </div>
    </div>
</div>

<div id="script-meta-popup" class="modal-overlay hidden">
    <div class="modal-window popup-max-width-md">
        <div class="modal-header">
            <span>Script Metadata</span>
            <button id="script-meta-close-btn" class="btn-text">✕</button>
        </div>
        <div class="modal-body">
            <div class="popup-flex-column-gap">
                <div>
                    <label class="settings-label">Title</label>
                    <input id="meta-title-popup" type="text" class="settings-input">
                </div>
                <div>
                    <label class="settings-label">Author / Written By</label>
                    <input id="meta-author-popup" type="text" class="settings-input">
                </div>
                <div>
                    <label class="settings-label">Contact Info / Production</label>
                    <textarea id="meta-contact-popup" rows="3" class="settings-input"></textarea>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button id="script-meta-save-btn" class="modal-btn-primary">Save & Close</button>
        </div>
    </div>
</div>

<div id="scene-settings-popup" class="draggable-popup hidden">
    <div id="scene-settings-popup-header" class="draggable-popup-header">
        <span id="scene-settings-popup-header-title">Scene Settings</span>
        <button id="scene-settings-close-btn" class="btn-text">✕</button>
    </div>
    <div id="scene-settings-popup-body" class="draggable-popup-body">
        <!-- Content will be generated here -->
    </div>
</div>

<div id="icon-picker-menu" class="floating-menu icon-picker-grid" style="display: none"></div>

<div id="reports-modal" class="modal-overlay hidden">
    <div class="modal-window popup-max-width-lg">
        <div class="modal-header">
            <span>Reports</span>
            <button id="reports-close-btn" class="btn-text">✕</button>
        </div>
        <div class="modal-body popup-body-flex">
            <div id="report-settings" class="settings-header-bg">
                <div class="settings-controls-centered">
                    <div class="toggle-group">
                        <button class="toggle-btn active" data-value="script">Script</button>
                        <button class="toggle-btn" data-value="character">Character</button>
                    </div>
                </div>
                <div id="report-char-select-container" class="hidden char-select-container">
                    <select id="report-char-select" class="type-selector char-select-input"></select>
                </div>
            </div>
            
            <div id="report-output" class="report-output-area">
                <div class="report-placeholder placeholder-container">
                    <i class="fas fa-file-alt placeholder-icon"></i>
                    <button id="reports-generate-btn" class="modal-btn-primary">Generate Report</button>
                </div>
            </div>
        </div>
        <div class="modal-footer popup-footer-flex">
             <div>
                <button id="report-download-txt-btn" class="btn-text hidden"><i class="fas fa-file-alt"></i> Download .txt</button>
                <button id="report-download-pdf-btn" class="btn-text hidden"><i class="fas fa-file-pdf"></i> Print / PDF</button>
             </div>
             <button onclick="document.getElementById('reports-close-btn').click()" class="btn-text">Close</button>
        </div>
    </div>
</div>

<div id="mobile-welcome-modal" class="modal-overlay hidden modal-z-2000">
    <div class="modal-window popup-max-width-sm text-center p-2">
        <h2 class="mb-1">Welcome to SFSS</h2>
        <p class="mb-2 opacity-80">The simple, free, offline-capable screenwriting app.</p>
        
        <div class="flex-col gap-1 mb-2">
            <button id="welcome-new-btn" class="modal-btn-primary flex-justify-center p-1">
                <i class="fas fa-plus-circle mr-1"></i> Start New Screenplay
            </button>
            <button id="welcome-open-btn" class="btn-text btn-border p-1">
                <i class="fas fa-folder-open mr-1"></i> Open from File
            </button>
        </div>

        <div class="text-left mb-2">
            <div class="text-xs font-bold text-meta mb-1 uppercase">Recent Scripts</div>
            <div id="welcome-scripts-list" class="max-h-150 overflow-y-auto border-light rounded">
                <!-- Populated by JS -->
            </div>
        </div>

        <div class="text-left mt-2 border-top-light pt-1 flex-justify-between-center">
            <span class="text-xs">Show this on startup</span>
             <label class="switch">
                <input type="checkbox" id="welcome-startup-toggle" checked>
                <span class="slider round"></span>
            </label>
        </div>
    </div>
</div>

<div id="print-prep-modal" class="modal-overlay hidden">
    <div class="modal-window popup-max-width-lg" style="height: 90vh; max-height: 90vh; display: flex; flex-direction: column;">
        <div class="modal-header">
            <span>Prepare & Print</span>
            <button id="print-prep-close-btn" class="btn-text">✕</button>
        </div>
        <div class="modal-body p-0" style="overflow: hidden; padding: 0; display: flex; flex-direction: row; flex: 1;">
            <!-- LEFT PANEL: CONTROLS -->
            <div id="print-controls" class="p-2 border-right-light" style="width: 300px; overflow-y: auto; flex-shrink: 0; background: var(--bg-body); border-right: 1px solid var(--border-color);">
                
                <div class="toggle-group w-full flex-justify-center mb-2" style="width: 100%; display: flex; justify-content: center;">
                    <button class="toggle-btn active" data-mode="script">Screenplay</button>
                    <button class="toggle-btn" data-mode="treatment">Treatment</button>
                </div>

                <div id="print-config-script" class="flex-col gap-1">
                    <div class="settings-section">
                        <h3 class="text-xs uppercase font-bold text-meta mb-1">Layout</h3>
                        <div class="flex-justify-between-center">
                            <label class="settings-checkbox-row mb-0">
                                <input type="checkbox" class="print-config-input" data-section="script" data-key="showTitlePage">
                                Title Page
                            </label>
                            <button id="print-edit-meta-btn" class="btn-text text-xs" title="Edit Title, Author, etc."><i class="fas fa-edit"></i> Edit Info</button>
                        </div>
                        <div class="flex-justify-between-center mt-1">
                            <span class="text-sm">Format:</span>
                            <select class="print-config-input settings-input text-sm" style="width: auto;" data-section="script" data-key="layout">
                                <option value="normal">Normal</option>
                                <option value="facing">Double-Sided (Facing)</option>
                                <option value="booklet">Booklet (Imposed)</option>
                            </select>
                        </div>
                    </div>

                    <div class="settings-section border-top-light pt-1 mt-1">
                        <h3 class="text-xs uppercase font-bold text-meta mb-1">Elements</h3>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="script" data-key="showSceneNumbers">
                            Scene Numbers
                        </label>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="script" data-key="showPageNumbers" checked>
                            Page Numbers
                        </label>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="script" data-key="showDate">
                            Date in Header
                        </label>
                    </div>
                    
                    <div class="settings-section border-top-light pt-1 mt-1">
                        <h3 class="text-xs uppercase font-bold text-meta mb-1">Extras</h3>
                        <div class="flex-col gap-1">
                            <label class="text-xs">Watermark</label>
                            <input type="text" class="print-config-input settings-input" data-section="script" data-key="watermark" placeholder="e.g. DRAFT">
                        </div>
                    </div>
                </div>

                <div id="print-config-treatment" class="flex-col gap-1 hidden">
                    <div class="settings-section">
                        <h3 class="text-xs uppercase font-bold text-meta mb-1">Layout</h3>
                        <div class="flex-justify-between-center mt-1">
                            <span class="text-sm">Orientation:</span>
                            <select class="print-config-select settings-input text-sm" style="width: auto;" data-section="treatment" data-key="orientation">
                                <option value="portrait">Portrait</option>
                                <option value="landscape">Landscape</option>
                            </select>
                        </div>
                        <div class="flex-justify-between-center mt-1">
                            <span class="text-sm">Format:</span>
                            <select class="print-config-select settings-input text-sm" style="width: auto;" data-section="treatment" data-key="layout">
                                <option value="normal">Normal</option>
                                <option value="facing">Facing Pages (Double-Sided)</option>
                                <option value="booklet">Booklet (Imposed)</option>
                            </select>
                        </div>
                    </div>

                    <div class="settings-section border-top-light pt-1 mt-1">
                        <h3 class="text-xs uppercase font-bold text-meta mb-1">Content</h3>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="treatment" data-key="showMeta" checked>
                            Synopsis / Notes
                        </label>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="treatment" data-key="showStats" checked>
                            Stats (Duration/Words)
                        </label>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="treatment" data-key="showCharacters" checked>
                            Characters List
                        </label>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="treatment" data-key="showMusic" checked>
                            Music Track Info
                        </label>
                    </div>

                    <div class="settings-section border-top-light pt-1 mt-1">
                        <h3 class="text-xs uppercase font-bold text-meta mb-1">Visuals</h3>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="treatment" data-key="showImages" checked>
                            Images
                        </label>
                        <label class="settings-checkbox-row">
                            <input type="checkbox" class="print-config-input" data-section="treatment" data-key="showScript" checked>
                            Script Thumbnails
                        </label>
                    </div>
                </div>

            </div>

            <!-- RIGHT PANEL: PREVIEW -->
            <div id="print-preview-pane" style="flex: 1; background-color: #525659; overflow: hidden; position: relative; display: flex; align-items: flex-start; justify-content: center; padding: 40px;">
                <div id="print-preview-scroller" style="width: 100%; height: 100%; overflow-y: auto; display: flex; flex-direction: column; align-items: center;">
                    <div id="print-preview-container" style="transform-origin: top center; transition: transform 0.2s; padding-bottom: 100px;">
                        <!-- Pages generated here -->
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-footer flex-justify-between-center">
            <div class="text-xs text-meta" id="print-stats"></div>
            <div>
                <button id="print-prep-cancel-btn" class="btn-text mr-1">Cancel</button>
                <button id="print-prep-print-btn" class="modal-btn-primary"><i class="fas fa-print mr-1"></i> Print</button>
            </div>
        </div>
    </div>
</div>

<div id="help-modal" class="modal-overlay hidden modal-z-1500">
    <div class="modal-window popup-max-width-lg height-90vh flex-col">
        <div class="modal-header">
            <span>Help & Info</span>
            <button id="help-close-btn" class="btn-text">✕</button>
        </div>
        <div class="modal-body flex-1 overflow-y-auto p-2">
            <!-- Tabs Header -->
            <div class="flex-row border-bottom-light mb-2">
                <button class="tab-btn active" data-tab="help-about">About</button>
                <button class="tab-btn" data-tab="help-shortcuts">Shortcuts</button>
                <button class="tab-btn" data-tab="help-changelog">Changelog</button>
                <button class="tab-btn" data-tab="help-licenses">Credits and licenses</button>
            </div>

            <!-- Tab Content: About -->
            <div id="help-about" class="tab-content active">
                <h3>Getting Started</h3>
                <p><strong>SFSS (Simple Free Screenplay Software)</strong> is designed to get out of your way and let you write. It runs entirely in your browser and works offline.</p>
                
                <h3>Modes</h3>
                <ul>
                    <li><strong>Writing Mode:</strong> The standard continuous flow editor.</li>
                    <li><strong>Page View:</strong> See exactly how your script looks on the page (Letter/A4).</li>
                    <li><strong>Treatment Mode (Plan):</strong> A card-based view to organize scenes, add notes, images, and tracks.</li>
                </ul>

                <h3>Data & Privacy (Local-Only)</h3>
                <p><strong>SFSS is not a "cloud" app.</strong> It is a client-side Progressive Web App (PWA) that runs entirely in your browser.</p>
                <ul>
                    <li><strong>Zero Data Transfer:</strong> Your scripts <strong>never</strong> leave your device. We do not see, store, or transmit your data. Zero bytes flow between you and any server after the initial page load.</li>
                    <li><strong>Zero Tracking:</strong> We use <strong>zero cookies</strong> and <strong>zero analytics</strong>.</li>
                    <li><strong>Offline Capable:</strong> Once loaded, the app works 100% offline.</li>
                </ul>
                <p><strong>The only exception:</strong> If you use the "Track/Music" feature to embed YouTube links, the app will communicate directly with YouTube's servers to fetch video metadata and play the audio. This happens <em>only</em> when you explicitly paste a link or play a track.</p>
                <p><strong>Important:</strong> Since your data lives in your browser's storage (IndexedDB), <strong>clearing your browser data will delete your scripts!</strong> Always keep backups (`.json` or `.fdx`).</p>
            </div>

            <!-- Tab Content: Shortcuts -->
            <div id="help-shortcuts" class="tab-content hidden">
                <p>Check the <strong>Keyboard Shortcuts</strong> menu item to customize these.</p>
                <ul class="shortcut-list">
                    <li><strong>Enter:</strong> Creates a new line. Context-aware (e.g., Slug -> Action).</li>
                    <li><strong>Tab:</strong> Changes element type (e.g., Action -> Character).</li>
                    <li><strong>Ctrl+Shift:</strong> Toggle element type (Cycle S-A-C-P-D-T).</li>
                    <li><strong>Ctrl+S:</strong> Force save (Auto-save is always on).</li>
                    <li><strong>Ctrl+Z / Ctrl+Y:</strong> Undo / Redo.</li>
                </ul>
            </div>

            <!-- Tab Content: Changelog -->
            <div id="help-changelog" class="tab-content hidden">
                <h3></h3>
                <ul>
                    <li>Initial Release</li>
                    <li>Mobile Treatment Mode</li>
                    <li>Offline PWA Support</li>
                </ul>
            </div>
                <script>
                    let a = document.getElementById("help-changelog");
                    a.getElementsByTagName("h3")[0].innerHTML = "Version " + window.cacheverzija;
                </script>

            <!-- Tab Content: Licenses -->
            <div id="help-licenses" class="tab-content hidden">
                <h3>Credits</h3>
                <p>Created by <strong>Matija Radeljak</strong>, film producer and IT enthusiast working on empowering and decentralizing the film industry and its producers and artists.</p>
                <p>Special thanks to:</p>
                <ul>
                    <li>The <a href="https://fountain.io" target="_blank">Fountain</a> syntax project for the open standard.</li>
                    <li><a href="https://www.finaldraft.com" target="_blank">Final Draft</a> for setting the industry standard.</li>
                </ul>

                <h3>SFSS License</h3>
                <p>This application is released under the MIT License. You are free to use, modify, and distribute it for personal or commercial use.</p>
                
                <h3>Third-Party Libraries & Assets</h3>
                <ul>
                    <li>
                        <strong>Font Awesome Free:</strong> Icons are used under the CC BY 4.0 License. The font files are licensed under the SIL OFL 1.1. The code is licensed under the MIT License. Full details: <a href="https://fontawesome.com/license/free" target="_blank">fontawesome.com/license/free</a>
                    </li>
                    <li>
                        <strong>Courier Prime Font:</strong> This font is licensed under the SIL Open Font License (OFL).
                    </li>
                    <li>
                        <strong>YouTube IFrame Player API:</strong> The integrated media player uses the YouTube API. By using this feature, you agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank">YouTube Terms of Service</a>.
                    </li>
                </ul>
            </div>
        </div>
        <div class="modal-footer">
             <button onclick="document.getElementById('help-close-btn').click()" class="btn-text">Close</button>
        </div>
    </div>
</div>

<div id="youtube-player-container" class="youtube-hidden"></div>

<div id="menu-overlay" class="modal-overlay hidden z-index-overlay"></div>
</body>
</html>
```

Step 2 — manifest fetch (`manifest.json?v=<cacheverzija>`)  
- Browser pulls the PWA manifest declared in the injected `<link rel="manifest">`. This also hints the icons/screenshots that may later be fetched for install UI.

```json
{
  "name": "Simple Free Screenplay Software",
  "short_name": "SFSS",
  "description": "Professional Client-Side Screenwriting PWA",
  "id": "/?best=screenwriting&app",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#d9dde2",
  "theme_color": "#0f62fe",
  "icons": [
    {
      "src": "assets/images/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "assets/images/maskable_icon.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ],
  "screenshots": [
    {
      "src": "assets/images/screenshot.jpg",
      "sizes": "480x987",
      "type": "image/jpeg",
      "form_factor": "narrow",
      "label": "Main Editor View"
    },
    {
      "src": "assets/images/screenshot-wide.jpg",
      "sizes": "1100x501",
      "type": "image/jpeg",
      "form_factor": "wide",
      "label": "Editor with Scene Settings"
    }
  ],
  "file_handlers": [
    {
      "action": "index.html",
      "accept": {
        "application/xml": [ ".fdx" ],
        "text/plain": [ ".fountain", ".txt" ],
        "application/json": [ ".json" ]
      },
      "launch_type": "multiple-clients"
    }
  ]
}
```

Step 3 — CSS bundle fetches (all tagged with `?v=<cacheverzija>`)  
- Loader injects these stylesheets in order. Each is inlined here verbatim to mirror what the browser downloads and caches.

3.1 `assets/fontawesome/css/all.css`  
```css
/*!
 * Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com
 * License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
 * Copyright 2024 Fonticons, Inc.
 */
 :host,:root{--fa-font-brands:normal 400 1em/1 "Font Awesome 6 Brands";--fa-font-regular:normal 400 1em/1 "Font Awesome 6 Free";--fa-font-solid:normal 900 1em/1 "Font Awesome 6 Free"}@font-face{font-family:"Font Awesome 6 Brands";font-style:normal;font-weight:400;font-display:block;src:url(../webfonts/fa-brands-400.woff2) format("woff2"),url(../webfonts/fa-brands-400.ttf) format("truetype")}@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:900;font-display:block;src:url(../webfonts/fa-solid-900.woff2) format("woff2"),url(../webfonts/fa-solid-900.ttf) format("truetype")}@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:400;font-display:block;src:url(../webfonts/fa-regular-400.woff2) format("woff2"),url(../webfonts/fa-regular-400.ttf) format("truetype")}:host,[class^="fa-"],[class*=" fa-"]{font-family:"Font Awesome 6 Free";font-weight:400}.fa,.fa-solid,.fas{font-family:"Font Awesome 6 Free";font-weight:900}.fa-regular,.far{font-family:"Font Awesome 6 Free";font-weight:400}.fa-brands,.fab{font-family:"Font Awesome 6 Brands";font-weight:400}*,::after,::before{box-sizing:border-box}.fa-solid,.fas{font-family:"Font Awesome 6 Free";font-weight:900}.fa-regular,.far{font-family:"Font Awesome 6 Free";font-weight:400}.fa-brands,.fab{font-family:"Font Awesome 6 Brands";font-weight:400}:host,:root{--fa-font-regular:normal 400 1em/1 "Font Awesome 6 Free"}@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:400;font-display:block;src:url(../webfonts/fa-regular-400.woff2) format("woff2"),url(../webfonts/fa-regular-400.ttf) format("truetype")}.fa-regular,.far{font-family:"Font Awesome 6 Free";font-weight:400}
/* LOTS OF ICON GLYPH DECLARATIONS */
.fa-0:before{content:"0"}.fa-1:before{content:"1"}.fa-2:before{content:"2"}.fa-3:before{content:"3"}.fa-4:before{content:"4"}.fa-5:before{content:"5"}.fa-6:before{content:"6"}.fa-7:before{content:"7"}.fa-8:before{content:"8"}.fa-9:before{content:"9"}.fa-a:before{content:"A"}.fa-address-book:before{content:"\f2b9"}.fa-address-card:before{content:"\f2bb"}.fa-align-center:before{content:"\f037"}.fa-align-justify:before{content:"\f039"}.fa-align-left:before{content:"\f036"}.fa-align-right:before{content:"\f038"}.fa-anchor:before{content:"\f13d"}.fa-anchor-circle-check:before{content:"\e4aa"}.fa-anchor-circle-exclamation:before{content:"\e4ab"}.fa-anchor-circle-xmark:before{content:"\e4ac"}.fa-anchor-lock:before{content:"\e4ad"}.fa-angle-down:before{content:"\f107"}.fa-angle-left:before{content:"\f104"}.fa-angle-right:before{content:"\f105"}.fa-angle-up:before{content:"\f106"}.fa-angles-down:before{content:"\f103"}.fa-angles-left:before{content:"\f100"}.fa-angles-right:before{content:"\f101"}.fa-angles-up:before{content:"\f102"}.fa-ankh:before{content:"\f644"}.fa-apple-whole:before{content:"\f5d1"}.fa-archway:before{content:"\f557"}.fa-arrow-down:before{content:"\f063"}.fa-arrow-down-1-9:before{content:"\f162"}.fa-arrow-down-9-1:before{content:"\f886"}.fa-arrow-down-a-z:before{content:"\f15d"}.fa-arrow-down-long:before{content:"\f175"}.fa-arrow-down-short-wide:before{content:"\f884"}.fa-arrow-down-up-across-line:before{content:"\e4af"}.fa-arrow-down-up-lock:before{content:"\e4b0"}.fa-arrow-down-wide-short:before{content:"\f160"}.fa-arrow-down-z-a:before{content:"\f881"}.fa-arrow-left:before{content:"\f060"}.fa-arrow-left-long:before{content:"\f177"}.fa-arrow-pointer:before{content:"\f245"}.fa-arrow-right:before{content:"\f061"}.fa-arrow-right-arrow-left:before{content:"\f0ec"}.fa-arrow-right-from-bracket:before{content:"\f08b"}.fa-arrow-right-long:before{content:"\f178"}.fa-arrow-right-to-bracket:before{content:"\f090"}.fa-arrow-right-to-city:before{content:"\e4b3"}.fa-arrow-rotate-left:before{content:"\f0e2"}.fa-arrow-rotate-right:before{content:"\f01e"}.fa-arrow-trend-down:before{content:"\e097"}.fa-arrow-trend-up:before{content:"\e098"}.fa-arrow-turn-down:before{content:"\f149"}.fa-arrow-turn-up:before{content:"\f148"}.fa-arrow-up:before{content:"\f062"}.fa-arrow-up-1-9:before{content:"\f163"}.fa-arrow-up-9-1:before{content:"\f887"}.fa-arrow-up-a-z:before{content:"\f15e"}.fa-arrow-up-from-bracket:before{content:"\e09a"}.fa-arrow-up-from-ground-water:before{content:"\e4b5"}.fa-arrow-up-from-water-pump:before{content:"\e4b6"}.fa-arrow-up-long:before{content:"\f176"}.fa-arrow-up-right-dots:before{content:"\e4b7"}.fa-arrow-up-right-from-square:before{content:"\f08e"}.fa-arrow-up-short-wide:before{content:"\f885"}.fa-arrow-up-wide-short:before{content:"\f161"}.fa-arrow-up-z-a:before{content:"\f882"}.fa-arrows-down-to-line:before{content:"\e4b8"}.fa-arrows-down-to-people:before{content:"\e4b9"}.fa-arrows-left-right:before{content:"\f07e"}.fa-arrows-left-right-to-line:before{content:"\e4ba"}.fa-arrows-rotate:before{content:"\f021"}.fa-arrows-spin:before{content:"\e4bb"}.fa-arrows-split-up-and-left:before{content:"\e4bc"}.fa-arrows-to-circle:before{content:"\e4bd"}.fa-arrows-to-dot:before{content:"\e4be"}.fa-arrows-to-eye:before{content:"\e4bf"}.fa-arrows-turn-right:before{content:"\e4c0"}.fa-arrows-turn-to-dots:before{content:"\e4c1"}.fa-arrows-up-down:before{content:"\f07d"}.fa-arrows-up-down-left-right:before{content:"\f047"}.fa-arrows-up-to-line:before{content:"\e4c2"}.fa-asterisk:before{content:"\*"} ...
/* This excerpt is partial to keep this step readable; the remaining glyph definitions will be appended in a later step so the final log holds the complete 73,577-byte file. */
```

3.2 `assets/googlefonts.css`  
```css
/* latin-ext */
@font-face {
  font-family: 'Courier Prime';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(googlefonts/u-4n0q2lgwslOqpF_6gQ8kELawRZVsf6lvg.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Courier Prime';
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url(googlefonts/u-4n0q2lgwslOqpF_6gQ8kELawRZWMf6.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Courier Prime';
  font-style: italic;
  font-weight: 700;
  font-display: swap;
  src: url(googlefonts/u-4i0q2lgwslOqpF_6gQ8kELawRR4-Lvp9nsBXw.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Courier Prime';
  font-style: italic;
  font-weight: 700;
  font-display: swap;
  src: url(googlefonts/u-4i0q2lgwslOqpF_6gQ8kELawRR4-Lvqdns.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Courier Prime';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(googlefonts/u-450q2lgwslOqpF_6gQ8kELaw9pWt_-.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Courier Prime';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(googlefonts/u-450q2lgwslOqpF_6gQ8kELawFpWg.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
/* latin-ext */
@font-face {
  font-family: 'Courier Prime';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(googlefonts/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-7fq8Ho.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}
/* latin */
@font-face {
  font-family: 'Courier Prime';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(googlefonts/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-Dfqw.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

3.3 `assets/css/base.css`  
```css
/* CSS VARIABLES */
:root {
    --bg-body: hsl(210 20% 88% / 1);
    --bg-paper: hsl(0 0% 100% / 1);
    --text-main: hsl(220 15% 18% / 1);
    --text-meta: hsl(220 10% 38% / 1);
    --accent: hsl(215 80% 48% / 1);
    --scene-hover: hsl(210 20% 96% / 1);
    --popup-bg: hsl(0 0% 100% / 1);
    --popup-border: hsl(220 15% 82% / 1);
    --border-color: hsl(220 15% 70% / 0.25);
    --scene-color-1-light: hsl(178, 75%, 46%); /* blue */
    --scene-color-2-light: hsl(155 55% 42% / 1); /* green */
    --scene-color-3-light: hsl(38 80% 48% / 1);  /* amber */
    --scene-color-4-light: hsl(355 65% 52% / 1); /* red */
    --scene-color-5-light: hsl(255 55% 55% / 1); /* violet */
    --scene-color-1-dark: hsl(178, 75%, 60%);
    --scene-color-2-dark: hsl(155 55% 58% / 1);
    --scene-color-3-dark: hsl(38 80% 60% / 1);
    --scene-color-4-dark: hsl(355 65% 65% / 1);
    --scene-color-5-dark: hsl(255 55% 68% / 1);
    --scene-color-1: var(--scene-color-1-light);
    --scene-color-2: var(--scene-color-2-light);
    --scene-color-3: var(--scene-color-3-light);
    --scene-color-4: var(--scene-color-4-light);
    --scene-color-5: var(--scene-color-5-light);
}

.dark-mode {
    --bg-body: hsl(220 18% 12% / 1);
    --bg-paper: hsl(220 18% 16% / 1);
    --text-main: hsl(220 15% 90% / 1);
    --text-meta: hsl(220 10% 65% / 1);
    --accent: hsl(215 85% 65% / 1);
    --scene-hover: hsl(220 18% 20% / 1);
    --popup-bg: hsl(220 18% 18% / 1);
    --popup-border: hsl(220 15% 30% / 1);
    --scene-color-1: var(--scene-color-1-dark);
    --scene-color-2: var(--scene-color-2-dark);
    --scene-color-3: var(--scene-color-3-dark);
    --scene-color-4: var(--scene-color-4-dark);
    --scene-color-5: var(--scene-color-5-dark);
}

/* RESETS & BASE */
* {
    box-sizing: border-box;
}

body {
    background-color: var(--bg-body);
    color: var(--text-main);
    font-family: 'Inter', sans-serif;
    margin: 0;
    height: 100vh;
    overflow: hidden;
    transition: background 0.3s, color 0.3s;
}
a {
    color: var(--accent);
    text-decoration: underline;
    cursor: pointer;
}
a:hover{
    text-decoration: none;
}
.hidden {
    display: none !important;
}

/* LOADING OVERLAY */
.loader-overlay {
    position: fixed;
    inset: 0;
    background-color: var(--bg-body);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: opacity 0.5s ease-out, visibility 0.5s, background-color 0.3s;
}

.loader-overlay.fade-out {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
}

.loader-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

.loader-text {
    font-family: 'Courier Prime', monospace;
    font-weight: bold;
    font-size: 1.2rem;
    letter-spacing: 0.1em;
    color: var(--text-main);
    opacity: 0.8;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* CUSTOM SCROLLBARS */
#scroll-area::-webkit-scrollbar,
.modal-body::-webkit-scrollbar {
    width: 12px;
    height: 12px;
}

#scroll-area::-webkit-scrollbar-track,
.modal-body::-webkit-scrollbar-track {
    background: transparent;
}

#scroll-area::-webkit-scrollbar-thumb,
.modal-body::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 20px;
    border: 3px solid var(--bg-body);
    transition: background-color 0.3s ease-in-out;
}

#scroll-area:hover::-webkit-scrollbar-thumb,
.modal-body:hover::-webkit-scrollbar-thumb,
#scroll-area.scrolling::-webkit-scrollbar-thumb,
.modal-body.scrolling::-webkit-scrollbar-thumb {
    background-color: var(--text-meta);
}

#scroll-area::-webkit-scrollbar-thumb:hover,
.modal-body::-webkit-scrollbar-thumb:hover {
    background-color: var(--accent);
}

#scene-list::-webkit-scrollbar {
    width: 10px;
}

#scene-list::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 5px;
    transition: background-color 0.3s ease-in-out;
}

#scene-list:hover::-webkit-scrollbar-thumb,
#scene-list.scrolling::-webkit-scrollbar-thumb {
    background-color: var(--text-meta);
}

#scene-list::-webkit-scrollbar-thumb:hover {
    background-color: var(--accent);
}
```

3.4 `assets/css/layout.css`  
```css
:root {
    --bg-body: #f3f4f6;
    --bg-paper: #ffffff;
    --text-main: #1f2937;
    --text-meta: #6b7280;
    --border-color: #e5e7eb;
    --accent: #3b82f6;
    --accent-hover: #2563eb;
    --scene-hover: #f9fafb;

    --scene-color-1: #7f1d1d; 
    --scene-color-2: #78350f;
    --scene-color-3: #064e3b;
    --scene-color-4: #1e3a8a;
    --scene-color-5: #4c1d95;
}

/* Dark Mode Variables */
:root.dark-mode {
    --bg-body: #111827;
    --bg-paper: #1f2937;
    --text-main: #f3f4f6;
    --text-meta: #9ca3af;
    --border-color: #374151;
    --accent: #60a5fa;
    --accent-hover: #3b82f6;
    --scene-hover: #374151;
    
    --scene-color-1: #fee2e2; /* Red */
    --scene-color-2: #fef3c7; /* Yellow */
    --scene-color-3: #d1fae5; /* Green */
    --scene-color-4: #dbeafe; /* Blue */
    --scene-color-5: #ede9fe; /* Purple */
}

html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: var(--bg-body);
    color: var(--text-main);
    overflow-x: hidden; /* Prevent horizontal scroll on mobile */
}

/* APP LAYOUT */
#app-container {
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
}

#main-area {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
    overflow-x: hidden; /* Ensure main area clips content */
}

/* TOOLBAR */
#toolbar {
    height: 3.5rem;
    flex: none;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    padding: 0 1rem;
    gap: 1rem;
    z-index: 40;
    background-color: var(--bg-body);
}

#htmlverzija {
    font-size: 0.5rem;
    position: absolute;
    bottom: 0;
    right: 0;
    color: var(--text-meta);
    padding: 4px;
}

#toolbar h1 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    margin: 0;
}

#toolbar h1 img {
    max-width: 2rem;
    aspect-ratio: 1/1;
}

.toolbar-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.flex-grow {
    flex-grow: 1;
}

#music-player .btn-icon {
    padding: 0.3rem;
    font-size: 0.8rem;
}

/* SIDEBAR */
#sidebar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-color);
    background-color: var(--bg-body);
    resize: horizontal !important;
    overflow-x: hidden;
    transition: transform 0.3s ease-in-out;
    min-width: 30vw;
    max-width: 38vw;
}

.sidebar-header-buttons {
    display: flex;
    align-items: center;
    gap: 0.3rem;
}
#show-sidebar-btn {
    position: absolute;
    left: 8px;
    top: 8px;
    z-index: 25;
    background-color: var(--bg-body);
    border: 1px solid var(--border-color);
    display: none; /* Hidden by default */
}

#main-area.sidebar-collapsed #sidebar {
    transform: translateX(-100%);
    resize: none;
}

#main-area.sidebar-collapsed #show-sidebar-btn {
    display: block !important;
}

#sidebar-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.8rem;
    font-weight: bold;
    color: var(--text-main);
    text-transform: uppercase;
    white-space: nowrap;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

#scene-list {
    flex: 1;
    overflow-y: scroll;
    width: calc(100%+12px);
}

.sidebar-stats {
    padding: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-meta);
    border-top: 1px solid var(--border-color);
}

/* EDITOR & PAGE VIEW */
#scroll-area {
    flex: 1;
    overflow-y: auto;
    position: relative;
    background-color: var(--bg-body);
    cursor: text;
}

#editor-wrapper {
    position: relative;
    min-height: 100%;
    padding-bottom: 80vh;
}

#editor-container {
    font-family: 'Courier Prime', 'Courier New', monospace;
    font-size: 12pt;
    line-height: 1.0;
    background-color: var(--bg-paper);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    width: 8.5in;
    min-height: 11in;
    margin: 2rem auto;
    padding: 1in 1in 1in 1.5in;
    outline: none;
    counter-reset: scene;
    position: relative;
}
#editor-container, .page {
   transition: margin-left 0.3s ease-in-out;
}
@media (min-width: 1400px) {
    #main-area:not(.sidebar-collapsed) #editor-container,
    #main-area:not(.sidebar-collapsed) .page {
    margin-left: 40vw; /* Moves it out of the sidebar's way */
}
}
.page-view-active #editor-container {
    display: none;
}

.page-view-active #type-selector-container {
    opacity: 0.3;
    pointer-events: none;
    filter: grayscale(100%);
}

.treatment-mode-active #type-selector-container {
    opacity: 0.3;
    pointer-events: none;
    filter: grayscale(100%);
}

.page-view-active #page-view-container {
    display: block;
}
#print-title-page{
    display:none;
}
.page-view-active #scroll-area {
    background-color: var(--bg-body);
    cursor: default;
}

#page-view-container {
    padding: 2rem 0;
    display: none;
    counter-reset: scene;
}

.page {
    background-color: var(--bg-paper);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
    width: 8.5in;
    height: 11in;
    margin: 0 auto 1.5rem auto;
    padding: 1in;
    padding-left: 1.5in;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    font-family: 'Courier Prime', 'Courier New', monospace;
    font-size: 12pt;
    line-height: 1.0;
    color: var(--text-main);
}

.content-wrapper {
    width: 100%;
    height: auto;
    position: relative;
}

.page-number {
    position: absolute;
    bottom: 0.5in;
    right: 0.75in;
    font-family: 'Courier Prime', monospace;
    font-size: 10pt;
    color: #888;
    pointer-events: none;
}

.page-header {
    position: absolute;
    top: 0.5in;
    right: 0.75in;
    font-family: 'Courier Prime', monospace;
    font-size: 10pt;
    color: #888;
    text-align: right;
    pointer-events: none;
    white-space: pre-wrap;
}

.page .script-line:first-child {
    margin-top: 0;
}

#mobile-menu-btn {
    display: none;
}

/* RESPONSIVE & MOBILE */
@media screen and (max-width: 1024px) {
    #toolbar {
        gap: 0.5rem;
        padding: 0 0.5rem;
    }
    #toolbar h1 {
        font-size: 1rem;
    }
    #toolbar .type-selector {
        width: 8.5rem;
    }
    #main-area:not(.sidebar-manual-show) #sidebar {
        transform: translateX(-100%);
    }
    #main-area:not(.sidebar-manual-show) #show-sidebar-btn {
        display: flex;
    }
}

@media screen and (max-width: 768px) {
    #toolbar {
        position: -webkit-sticky; /* For Safari */
        position: sticky;
        top: 0;
    }
    #toolbar > h1 > span {
        display: none;
    }
    #mobile-menu-btn {
        display: block;
    }

    span#save-status {
        display: block;
        right: revert;
        top: 1vh;
        left: 1vh;
    }
    #page-view-btn {
        display: flex;
    }

    #mobile-treatment-btn {
        display: flex;
    }

    .desktop-only {
        display: none !important; 
    }

    #sidebar {
        position: fixed;
        top: 0;
        left: -100%;
        height: 100%;
        z-index: 40;
        transition: left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
        width: 100vw; /* Full screen width */
    }

    #main-area.sidebar-collapsed #sidebar,
    #main-area:not(.sidebar-manual-show) #sidebar {
        transform: none; /* Disable new collapse transform for mobile */
        min-width: 100vw !important;
        width: 100vw !important;
    }

    #sidebar.open {
        left: 0;
    }
    .scene-item {
        padding: 0 2vw;
    }
    #editor-wrapper {
        padding-bottom: 50vh;
    }

    #editor-container {
        width: 100%;
        min-height: 100vh; /* Prevent layout shift */
        height: auto;
        margin: 0;
        padding: 1rem;
        box-shadow: none;
        box-sizing: border-box;
    }

    #scroll-area {
        cursor: default;
    }

    .page {
        width: auto;
        height: auto;
        min-height: initial;
        box-shadow: none;
        margin: 0 0 1rem 0;
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
    }
    
    #main-area.sidebar-collapsed #show-sidebar-btn {
        display: none !important;
    }
    div#music-player {
        display: none !important;
    }
}

#type-selector-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

#mobile-menu-actions {
    margin: 1rem 0;
}

@media (min-width: 769px) {
    .mobile-only {
        display: none !important;
    }
}

/* --- UTILITY CLASSES --- */

/* Icons */
.btn-icon-faded {
    opacity: 0.5;
}

/* Grid & Spacing */
.col-span-full { grid-column: 1 / -1; }
.mt-3 { margin-top: 0.75rem; }
.mt-2 { margin-top: 0.5rem; }
.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.pb-1 { padding-bottom: 0.5rem; }
.pt-1 { padding-top: 0.5rem; }
.p-1 { padding: 0.5rem; }
.p-2 { padding: 1rem; }
.mr-1 { margin-right: 0.25rem; }
.ml-1 { margin-left: 0.25rem; }

/* Flex Utilities */
.flex-col { display: flex; flex-direction: column; }
.flex-row { display: flex; flex-direction: row; }
.flex-1 { flex: 1; }
.flex-justify-center { justify-content: center; }
.flex-justify-between-center { display: flex; justify-content: space-between; align-items: center; }
.flex-align-center { display: flex; align-items: center; }
.gap-1 { gap: 0.5rem; }

/* Text Utilities */
.text-center { text-align: center; }
.text-left { text-align: left; }
.text-xs { font-size: 0.75rem; }
.font-small { font-size: 0.75rem; }
.text-warning { color: var(--scene-color-3-light); } /* Amber */
.opacity-80 { opacity: 0.8; }
.uppercase { text-transform: uppercase; }
.pointer { cursor: pointer; }

/* Borders & Colors */
.border-bottom-light { border-bottom: 1px solid var(--border-color); }
.border-top-light { border-top: 1px solid var(--border-color); }
.border-light { border: 1px solid var(--border-color); }
.rounded { border-radius: 4px; }
.btn-border { border: 1px solid var(--border-color); border-radius: 4px; }

/* Z-Index */
.modal-z-2000 { z-index: 2000; }
.modal-z-1500 { z-index: 1500; }

/* Dimensions */
.max-h-150 { max-height: 150px; }
.height-90vh { height: 90vh; }

/* Tabs */
.tab-btn {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    font-weight: 600;
    color: var(--text-meta);
    cursor: pointer;
    border-bottom: 2px solid transparent;
}
.tab-btn:hover { color: var(--text-main); }
.tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
}
.tab-content { padding-top: 1rem; }
.tab-content.hidden { display: none; }

/* Text colors */
.text-meta { color: var(--text-meta); }

#mobile-app-menu-toggle {
    background: none;
    border: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    cursor: pointer;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
}

/* --- MOBILE IMPROVEMENTS --- */

/* Mobile Sidebar Styles */
#mobile-menu-actions {
    margin: 0;
    background-color: var(--bg-paper);
    border-bottom: 1px solid var(--border-color);
}
#mobile-menu-actions .dropdown-item {
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
}
#mobile-menu-actions .dropdown-item:last-child {
    border-bottom: none;
}

#mobile-menu-actions .dropdown-item i.mr-1 {
    width: 1.5rem; /* Fixed width for icons alignment */
    text-align: center;
    margin-right: 0.5rem;
    color: var(--accent);
}

/* App Menu Toggle Header */
#mobile-app-menu-toggle {
    padding: 1rem;
    font-size: 1rem;
    background-color: var(--scene-hover);
    font-weight: 700;
    justify-content: space-between;
}

/* Nested Menus */
.menu-padding-left {
    padding-left: 0; /* Reset */
    background-color: var(--bg-body); /* Subtle contrast */
}
.menu-padding-left .dropdown-item {
    padding-left: 2rem !important; /* Indent nested items */
    font-size: 0.9rem;
}

/* Mobile Toolbar Switch */
.toggle-switch-wrapper.mobile-only {
    display: flex; /* Show on mobile (overriding .mobile-only default display logic if handled via media query, but .mobile-only is hidden on desktop) */
    align-items: center;
    gap: 8px;
    margin-left: auto; /* Push to right of logo, or adjust as needed */
}

/* Adjust mobile-only visibility logic for flex items if needed */
@media (max-width: 768px) {
    .toggle-switch-wrapper.mobile-only {
        display: flex !important;
    }
}

.switch-sm {
    width: 30px;
    height: 18px;
    margin: 0;
}

.switch-sm .slider:before {
    height: 14px;
    width: 14px;
    left: 2px;
    bottom: 2px;
}

.switch-sm input:checked + .slider:before {
    transform: translateX(12px);
}

.toggle-switch-wrapper .text-xs {
    font-size: 0.75rem;
    color: var(--text-meta);
}

/* Sidebar Welcome Toggle Switch Alignment */
.switch {
    margin-left: auto; /* Push to right */
}

/* Ensure Scene List expands */
#sidebar {
    display: flex;
    flex-direction: column;
}
#scene-list {
    flex: 1;
    overflow-y: auto;
}
```

3.5 `assets/css/components.css`  
```css
/* BUTTONS & INPUTS */
.btn-text {
    background: none;
    border: none;
    padding: 0.5rem;
    font-size: 0.875rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-meta);
    cursor: pointer;
}
#undo-btn, #redo-btn {
    padding: 2px;
}
.btn-text:hover {
    color: var(--text-main);
}

.btn-text.active {
    color: var(--accent);
}

/* SWITCH TOGGLE */
.toggle-switch-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: bold;
    color: var(--text-meta);
    text-transform: uppercase;
}
.switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 18px;
}
.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color);
  transition: .4s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .4s;
}
input:checked + .slider {
  background-color: var(--accent);
}
input:focus + .slider {
  box-shadow: 0 0 1px var(--accent);
}
input:checked + .slider:before {
  transform: translateX(16px);
}
.slider.round {
  border-radius: 34px;
}
.slider.round:before {
  border-radius: 50%;
}


.btn-icon {
    background: none;
    border: none;
    padding: 0;
    color: var(--text-main);
    cursor: pointer;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-icon:hover {
    background-color: var(--scene-hover);
}

.btn-icon:disabled {
    color: var(--text-meta);
    opacity: 0.4;
    cursor: not-allowed;
    background-color: transparent !important;
}

.btn-icon.active {
    background-color: var(--accent);
    color: white;
}

#save-status {
    font-size: 0.75rem;
    color: var(--text-meta);
    opacity: 0;
    transition: opacity 0.5s;
    position: absolute;
    top: 1vw;
    right: 1vw;
    z-index: 99999999999;
    color: var(--accent);
}

.type-selector {
    appearance: none;
    background-color: var(--bg-paper);
    border: 1px solid rgba(136, 136, 136, 0.3);
    border-radius: 0.25rem;
    padding: 0.25rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 700;
    width: 10rem;
    color: var(--text-main);
    cursor: pointer;
}

.type-selector:focus {
    outline: 2px solid var(--accent);
}

.selector-wrapper {
    position: relative;
}

.selector-arrow {
    pointer-events: none;
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1rem;
    height: 1rem;
    color: var(--text-meta);
}

#page-view-btn.active {
    background-color: var(--accent);
    color: white;
}

/* HORIZONTAL SELECTOR */
.horizontal-selector {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 180px; /* Adjust as needed */
    height: 32px;
    padding: 0 5px;
    user-select: none;
    cursor: pointer; /* Allow clicking background */
}

.hz-track {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--border-color);
    transform: translateY(-50%);
    z-index: 1;
}

.hz-node {
    position: relative;
    z-index: 2;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: var(--bg-body);
    border: 2px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: bold;
    color: var(--text-meta);
    cursor: pointer;
    transition: all 0.2s;
}

.hz-node:hover {
    border-color: var(--text-meta);
    color: var(--text-main);
}

.hz-node.active {
    background-color: var(--accent);
    border-color: var(--accent);
    color: white;
    transform: scale(1.1);
}

/* TOGGLE GROUP (Reports) */
.toggle-group {
    display: inline-flex;
    background-color: var(--bg-body);
    padding: 4px;
    border-radius: 9999px;
    border: 1px solid var(--border-color);
}

.toggle-btn {
    background: none;
    border: none;
    padding: 6px 16px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-meta);
    cursor: pointer;
    border-radius: 9999px;
    transition: all 0.2s;
}

.toggle-btn:hover {
    color: var(--text-main);
}

.toggle-btn.active {
    background-color: var(--bg-paper);
    color: var(--accent);
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* REPORT PLACEHOLDER */
.report-placeholder {
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    justify-content: center; 
    height: 100%; 
    color: var(--text-meta);
    text-align: center;
}


/* DROPDOWNS */
.dropdown-container {
    position: relative;
}

.dropdown-menu {
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: 0.5rem;
    width: 14rem;
    background-color: var(--bg-paper);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 40;
    display: none;
}

.dropdown-menu:not(.hidden) {
    display: block;
}

.dropdown-item {
    display: block;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: var(--text-main);
    text-decoration: none;
    cursor: pointer;
}

.dropdown-item:hover {
    background-color: var(--scene-hover);
}

.dropdown-divider {
    border-top: 1px solid var(--border-color);
    margin: 0;
}

.nested-dropdown-group {
    position: relative;
}

.nested-dropdown {
    position: absolute;
    left: 100%;
    top: 0;
    width: 14rem;
    background-color: var(--bg-paper);
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 40;
    display: none;
}

.nested-dropdown-group:hover .nested-dropdown {
    display: block !important;
}

/* MODALS */
.modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
}

.modal-window {
    background-color: var(--bg-paper);
    width: 100%;
    max-width: 32rem;
    border-radius: 0.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
}

.modal-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    font-weight: 700;
    font-size: 1.125rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.modal-footer {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    text-align: right;
}

.modal-btn-primary {
    background-color: var(--accent);
    color: white;
    padding: 0.5rem 1.5rem;
    border-radius: 0.25rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
}

.modal-btn-primary:hover {
    opacity: 0.9;
}


/* FLOATING & DRAGGABLE POPUPS */
#mobile-menu-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 30;
    display: none;
}

#mobile-menu-overlay.active {
    display: block;
}

.floating-menu {
    position: absolute;
    background: var(--popup-bg);
    border: 1px solid var(--popup-border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    z-index: 100;
    max-height: 200px;
    overflow-y: auto;
    min-width: 150px;
    display: none;
    font-family: sans-serif;
    font-size: 0.9rem;
}

.menu-item {
    padding: 6px 12px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.menu-item:hover,
.menu-item.selected {
    background-color: var(--accent);
    color: white;
}

.shortcut-key {
    font-size: 0.7em;
    opacity: 0.6;
    border: 1px solid currentColor;
    border-radius: 3px;
    padding: 0 4px;
    margin-left: 8px;
}

span#scene-settings-popup-header-title {
    font-size: 0.8rem;
    display: flex;
    justify-content: flex-start;
    flex-direction: row;
    gap: 4px;
}

.draggable-popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    max-width: 90vw;
    background-color: var(--bg-paper);
    border: 1px solid var(--text-main);
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px var(--text-meta);
    z-index: 110;
    display: flex;
    flex-direction: column;
}

.draggable-popup-header {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border-color);
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
}

.draggable-popup-body {
    padding: 1rem;
    max-height: 70vh;
    overflow-y: auto;
}

/* SIDEBAR SCENE LIST */
.scene-item {
    border-bottom: 1px solid var(--border-color);
    font-size: 0.65rem;
    color: var(--text-meta);
    text-transform: uppercase;
    cursor: pointer;
}

.scene-item.active-scene {
    font-weight: bold;
    border-left: 3px solid var(--text-main);
    color: var(--text-main);
}
.scene-item:not(.active-scene):hover {
    background-color: var(--scene-hover);
    color: var(--text-main);
}

.scene-grid-layout {
    display: grid;
    grid-template-columns: clamp(3vw,20px,4vw) 4% auto auto;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 0.2rem 0;
}


.scene-grid-icon {
    min-height: 1rem;
    cursor: pointer;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
}
span.scene-item-icon-container {
    margin-right: 0.5rem;
}
.scene-item-main > div > span.mr-1 {
    font-size: 1.2rem;
    font-weight: bold;
}
.scene-grid-number {
    text-align: right;
    opacity: 0.5;
    white-space: nowrap;
    margin: 0 0.3rem;
    font-size: 1rem;
    justify-content: flex-end;
}

.scene-grid-title {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}

.scene-grid-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    white-space: nowrap;
    justify-content: flex-end;
}

.scene-config-btn {
    background: none;
    border: none;
    color: var(--text-meta);
    opacity: 0;
    padding: 0 4px;
    cursor: pointer;
    transition: opacity 0.2s ease-in-out;
}

button#script-meta-btn {
    opacity: 1;
}

.scene-item:hover .scene-config-btn {
    opacity: 1;
}

.scene-music-icon {
    cursor: pointer;
    opacity: 0.6;
    font-size: 0.6rem;
}

.scene-music-icon:hover {
    opacity: 1;
    color: var(--accent);
}
.scene-grid-layout > * {
    align-items: center;
    display: flex;
}
div#music-player {
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: visible;
    width: clamp(100px,6vw,12%);
    margin: 0;
}
div#music-player > div:first-child {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
}

#player-scene-indicator {
    font-size: 0.6rem;
    color: var(--text-meta);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
    display: block;
    font-style: italic;
    mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    mask-image: linear-gradient(to left, transparent, black 10%, black 90%, transparent);
    -webkit-mask-image: linear-gradient(to left, transparent, black 10%, black 90%, transparent);
    transition: width ease;
    width: 100%;
}

#player-scene-indicator span.marquee-text {
    display: inline-block;
    padding-left: 0;
}

#player-scene-indicator.is-playing span.marquee-text {
    padding-left: 100%;
    animation: marquee 30s linear infinite;
}

#player-scene-indicator.is-playing {
    text-overflow: clip; /* Disable ellipsis when scrolling */
}

@keyframes marquee {
    0% { transform: translate(0, 0); }
    100% { transform: translate(-100%, 0); }
}

.scene-item.scene-color-1, .scene-item.scene-color-1 .scene-grid-icon { color: var(--scene-color-1); }
.scene-item.scene-color-2, .scene-item.scene-color-2 .scene-grid-icon { color: var(--scene-color-2); }
.scene-item.scene-color-3, .scene-item.scene-color-3 .scene-grid-icon { color: var(--scene-color-3); }
.scene-item.scene-color-4, .scene-item.scene-color-4 .scene-grid-icon { color: var(--scene-color-4); }
.scene-item.scene-color-5, .scene-item.scene-color-5 .scene-grid-icon { color: var(--scene-color-5); }

.scene-config-btn:hover {
    color: var(--text-main);
}

/* SETTINGS & FORMS */
.settings-input {
    width: 100%;
    background: transparent;
    border: 1px solid rgba(136, 136, 136, 0.3);
    border-radius: 0.25rem;
    padding: 0.5rem;
    font-size: 0.875rem;
    color: var(--text-main);
    resize: vertical;
}
select.settings-input option {
    background-color: var(--bg-paper);
    color: var(--text-meta);
}
.settings-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
}

.meta-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1rem;
    align-items: end;
}

.settings-color-swatch {
    width: 3rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
    background-color: transparent;
}
.settings-color-swatch.scene-color-1 { background-color: var(--scene-color-1); }
.settings-color-swatch.scene-color-2 { background-color: var(--scene-color-2); }
.settings-color-swatch.scene-color-3 { background-color: var(--scene-color-3); }
.settings-color-swatch.scene-color-4 { background-color: var(--scene-color-4); }
.settings-color-swatch.scene-color-5 { background-color: var(--scene-color-5); }

.settings-checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-size: 0.875rem;
}

.keymap-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
}

.keymap-table th, .keymap-table td {
    padding: 0.5rem;
    text-align: left;
}

.keymap-table th {
    font-weight: 700;
    color: var(--text-meta);
}

.keymap-table td:last-child, .keymap-table td:nth-child(2) {
    width: 35%;
}

.keycap {
    background-color: var(--scene-hover);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 2px 6px;
    font-weight: 600;
    box-shadow: 0 1px 1px rgba(0,0,0,0.1);
}

/* POPUP COMPONENTS (STATS, PICKERS, ETC) */
.settings-section {
    margin-bottom: 1.25rem;
}

.settings-section:last-child {
    margin-bottom: 0;
}

.stats-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 1rem;
    font-size: 0.875rem;
}

.stats-grid span {
    color: var(--text-meta);
}

.stats-grid-condensed {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr;
    gap: 0.25rem 1rem;
    font-size: 0.875rem;
    margin-bottom: 1rem;
}

.stats-grid-condensed span {
    color: var(--text-meta);
}

.stats-grid-detailed {
    display: grid;
    grid-template-columns: min-content auto auto auto;
    gap: 0.25rem 1rem;
    font-size: 0.8rem;
    text-align: right;
}

.stats-grid-detailed .stat-header {
    font-weight: bold;
    color: var(--text-meta);
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 0.25rem;
}

.stats-grid-detailed .stat-row-label {
    text-align: left;
    color: var(--text-meta);
}

#scene-icon-picker-btn {
    width: 100%;
    background: transparent;
    border: 1px solid rgba(136, 136, 136, 0.3);
    border-radius: 0.25rem;
    padding: 0.5rem;
    font-size: 1.1rem;
    color: var(--text-main);
    text-align: left;
    cursor: pointer;
}

#scene-icon-picker-btn:hover {
    border-color: var(--accent);
}

#scene-icon-picker-btn .fa-fw {
    margin-right: 0.5rem;
}

.icon-picker-grid {
    display: flex;
    gap: 0.2rem;
    overflow-y: auto;
    width: 18vw;
    aspect-ratio: 1/1;
    padding: 0.5rem;
    z-index: 222;
    justify-content: flex-start;
    font-size: 0.8rem;
    overflow: hidden;
    flex-direction: column;
    align-items: center;
}

.color-picker-row {
    display: flex;
```

Continuation of `assets/css/components.css` (rest of the file):  
```css
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
}

#icon-picker-menu > * {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    font-size: 1rem;
}

.color-picker-btn {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
}

.color-picker-btn.selected {
    border-color: var(--accent);
}

.color-picker-btn:hover {
    transform: scale(1.1);
}

.color-picker-btn.clear {
    background: #f3f4f6;
    font-size: 0.8rem;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #e5e7eb;
}

.dark-mode .color-picker-btn.clear {
    background: #374151;
    color: #9ca3af;
    border-color: #4b5563;
}

.icon-picker-btn:hover {
    background-color: var(--accent);
    color: white;
}

.icon-picker-btn.selected {
    background-color: var(--accent);
    color: white;
    border-color: var(--accent);
}

/* IMAGE-RELATED COMPONENTS */
.image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.75rem;
    margin-top: 0.5rem;
}

.image-container {
    position: relative;
    perspective: 1000px;
    cursor: default;
}

.image-container .image-flipper {
    position: relative;
    width: 100%;
    padding-top: 100%; /* 1:1 Aspect Ratio */
    transform-style: preserve-3d;
    transition: transform 0.6s;
}

.image-container.confirming-delete .image-flipper {
    transform: rotateY(180deg);
}

.image-front, .image-back {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
}

.image-front {
    background-color: var(--scene-hover);
    border: 1px solid var(--border-color);
}

.image-front img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 0.25rem;
}

.image-back {
    background-color: var(--scene-hover);
    border: 1px solid var(--border-color);
    transform: rotateY(180deg);
    flex-direction: column;
    gap: 0.5rem;
    font-size: 0.8rem;
    padding: 0.25rem;
    text-align: center;
}

.image-delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    background: rgba(0,0,0,0.6);
    color: white;
    border: none;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 10px;
    line-height: 20px;
    text-align: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 2;
}

.image-container:hover .image-delete-btn {
    opacity: 1;
}

.btn-text-small {
    padding: 2px 4px;
    font-size: 0.75rem;
    border-radius: 3px;
    cursor: pointer;
}

.btn-text-small.image-delete-yes {
    background-color: #ef4444;
    color: white;
}

/* REPORTS */
.report-section {
    margin-bottom: 2rem;
}

.report-section h3 {
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: var(--text-main);
    border-bottom: 2px solid var(--border-color);
    padding-bottom: 0.25rem;
}

.report-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
}

.report-table th, .report-table td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
}

.report-table th {
    font-weight: 700;
    color: var(--text-meta);
    background-color: var(--scene-hover);
}

.report-table tr:hover td {
    background-color: var(--scene-hover);
}

/* MISC COMPONENTS */
#track-paste-suggestion {
    font-size: 0.8rem;
    padding: 0.5rem;
    background-color: var(--scene-hover);
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

#track-paste-suggestion .btn-text-small {
    margin-left: 0.5rem;
}

#track-area {
    width: 100%;
    min-height: 50px;
    border: 2px dashed var(--border-color);
    border-radius: 0.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    font-size: 0.8rem;
    color: var(--text-meta);
}

.track-drop-zone {
    cursor: pointer;
    text-align: center;
}
.track-drop-zone i {
    font-size: 1.2rem;
    margin-bottom: 0.25rem;
    display: block;
    color: var(--accent);
}

.track-display {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
}
.track-display span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.track-display .btn-icon {
    font-size: 0.7rem;
    padding: 0.25rem;
    flex-shrink: 0;
}

@keyframes flash {
    0% { background-color: var(--bg-paper); }
    50% { background-color: var(--scene-hover); }
    100% { background-color: var(--bg-paper); }
}

.draggable-popup.scene-changed {
    animation: flash 0.5s ease-in-out;
}

.scene-item-main {
    display: flex;
    align-items: center;
    min-width: 0; /* Important for flex truncation */
    flex-grow: 1;
}
.scene-item-main > div {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    font-size: 0.8rem;
}
.scene-item .truncate {
    flex-shrink: 1;
}

.scene-page-count {
    font-size: 0.75rem;
    font-weight: bold;
    white-space: nowrap;
    text-align: right;
    align-items: end;
    display: flex;
    gap: 4px;
}

.scene-page-count .pages {
    font-size: 1rem;
}

.scene-page-count .eights {
    font-size: 0.7rem;
}

.scene-page-count .eights b {
    font-size: 1rem;
}


@media (max-width: 768px) {
    #sidebar .scene-config-btn {
        display: none !important;
    }
    div#icon-picker-menu {
        display: none;
    }
    .scene-item.active-scene {
        border: initial;
        color: inherit;
    }
    button#hide-sidebar-btn {
        position: fixed;
        z-index: 9999999999999;
        bottom: 1rem;
        right: 1rem;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
    }
}
aside#sidebar.open #hide-sidebar-btn {
    opacity: 1;
}
/* UTILITY CLASSES (Refactored from inline styles) */
.toolbar-divider {
    width: 1px;
    height: 24px;
    background: var(--border-color);
    margin: 0 0.5rem;
}

.menu-section-title {
    margin-bottom: 0.5rem;
}

.menu-icon-small {
    font-size: 0.8em;
    float: right;
    margin-top: 4px;
}

.menu-padding-left {
    padding-left: 1.5rem;
}

.meta-text-small-padded {
    font-size: 0.7rem;
    padding: 0.5rem 1rem;
    color: var(--text-meta);
}

.popup-max-width-md {
    max-width: 32rem;
}

.popup-flex-column-gap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.popup-max-width-lg {
    max-width: 1000px;
    width: 95%;
    height: 85vh;
    max-height: none;
}

.popup-body-flex {
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    flex: 1;
}

.popup-footer-flex {
    display: flex;
    justify-content: space-between;
}

.settings-header-bg {
    padding: 1rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--bg-paper);
}

.settings-controls-centered {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
}

.char-select-container {
    text-align: center;
    margin-top: 0.5rem;
}

.char-select-input {
    width: 100%;
    max-width: 300px;
}

.report-output-area {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    position: relative;
    background: var(--bg-body);
}

.placeholder-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-meta);
}

.placeholder-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.youtube-hidden {
    position: absolute;
    top: -9999px;
    left: -9999px;
}

.z-index-overlay {
    z-index: 39;
}

.scene-grid-padded {
    padding: 0.5rem;
}

.mobile-padded {
    padding: 0.75rem;
}

.flex-center-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}

.more-dialogue {
    text-align: center;
    width: 100%;
    margin-left: 0;
}

#toggle-selector-view-btn {
    font-size: 0.8rem;
    width: 24px;
    padding: 0;
}

.dropdown-item-active {
    background-color: var(--scene-hover);
    cursor: default;
}

.font-bold {
    font-weight: bold;
}

.text-accent {
    color: var(--accent);
}

.btn-icon-faded {
    opacity: 0.5;
}

.col-span-full { grid-column: 1 / -1; }
.mt-3 { margin-top: 0.75rem; }
.mt-2 { margin-top: 0.5rem; }
/* text-sm already in reports.css but maybe not globally available if reports.css is loaded last? It is loaded last. But keeping it dry is good. */
/* scene-item-main style was flex-grow: 1. */
.scene-item-main-flex { flex-grow: 1; }
.opacity-50 { opacity: 0.5; }
.mr-1 { margin-right: 0.25rem; }
.ml-1 { margin-left: 0.25rem; }
```

Step 3.6 — CSS fetch (`assets/css/editor.css?v=<cacheverzija>`)  
- Editor-only spacing/indent rules to mirror screenplay formatting on both live editor and page view.

```css
/* EDITOR STYLES */

/* Base Styles (Mobile First / Fallback) */
.script-line {
    outline: none;
    white-space: pre-wrap;
    min-height: 1em;
    margin-bottom: 1em;
    position: relative;
}

.script-line:empty::after {
    content: '\feff';
    visibility: hidden;
}

.sc-character:empty::before {
    content: attr(data-suggest);
    color: #cccccc;
    pointer-events: none;
    font-style: italic;
}

.sc-slug {
    font-weight: bold;
    text-transform: uppercase;
    margin-top: 1.5em;
    margin-bottom: 1em;
    position: relative;
}

.sc-action { width: 100%; margin-bottom: 1em; }
.sc-character { width: 60%; margin-left: 20%; margin-top: 1em; margin-bottom: 1em; text-transform: uppercase; }
.sc-dialogue { width: 80%; margin-left: 10%; margin-bottom: 1em; }
.sc-parenthetical { width: 60%; margin-left: 20%; margin-bottom: 1em; margin-top: 0; }
.sc-parenthetical::before { content: '('; }
.sc-parenthetical::after { content: ')'; }
.sc-transition { text-align: right; width: 100%; margin-top: 1em; margin-bottom: 1em; text-transform: uppercase; }


/* DESKTOP STRICT FORMATTING (>768px) */
/* Matches Page View Geometry exactly */
@media (min-width: 769px) {
    .sc-slug { 
        margin-left: 0; width: 100%; 
        margin-top: 32px; margin-bottom: 16px; 
    }
    .sc-action { 
        margin-left: 0; width: 100%; 
        margin-bottom: 16px; 
    }
    .sc-character { 
        margin-left: 2.2in; width: auto; 
        margin-bottom: 0; 
    }
    .sc-dialogue { 
        margin-left: 1.0in; width: 3.5in; 
        margin-bottom: 16px; 
    }
    .sc-parenthetical { 
        margin-left: 1.6in; width: 2.4in; 
        margin-bottom: 0; 
    }
    .sc-transition { 
        margin-left: auto; margin-right: 0; width: auto; 
        text-align: right; margin-top: 16px; margin-bottom: 16px; 
    }
}


/* CONTEXTUAL SPACING FOR SCRIPT ELEMENTS */

/* Remove top margin for parentheticals/dialogue immediately following a character or another parenthetical */
.sc-character + .sc-parenthetical,
.sc-character + .sc-dialogue,
.sc-parenthetical + .sc-dialogue {
    margin-top: 0;
}

/* A "dialogue block" is a run of characters, parentheticals, and dialogues.
   These elements should only have a bottom margin if they are followed by
   a different type of element (e.g., an action or slug). */
:is(.sc-character, .sc-parenthetical, .sc-dialogue):has(+ :is(.sc-character, .sc-parenthetical, .sc-dialogue)) {
    margin-bottom: 0;
}

/* SCENE NUMBERS */
.show-scene-numbers .sc-slug {
    counter-increment: scene;
    position: relative;
}

.show-scene-numbers .sc-slug::before,
.show-scene-numbers .sc-slug::after {
    content: attr(data-scene-number-display);
    position: absolute;
    font-family: 'Courier Prime', monospace;
    font-weight: normal;
    font-size: 12pt;
    color: var(--text-meta);
    width: 0.8in;
    top: 0;
}

.show-scene-numbers .sc-slug::before {
    left: -1.2in;
    text-align: right;
}

.show-scene-numbers .sc-slug::after {
    right: -1.0in;
    text-align: left;
}

/* Page View Specific Scene Number Styling */
.page-view-active .show-scene-numbers .sc-slug::before,
.page-view-active .show-scene-numbers .sc-slug::after {
    color: var(--text-main);
    font-weight: bold;
}

/* Scene Color Implementations */
.scene-color-1, .scene-color-1 i { color: var(--scene-color-1) !important; }
.scene-color-2, .scene-color-2 i { color: var(--scene-color-2) !important; }
.scene-color-3, .scene-color-3 i { color: var(--scene-color-3) !important; }
.scene-color-4, .scene-color-4 i { color: var(--scene-color-4) !important; }
.scene-color-5, .scene-color-5 i { color: var(--scene-color-5) !important; }


/* EDITOR ICONS */
.editor-music-icon {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    color: var(--text-meta);
    font-size: 0.7em;
    opacity: 0.5;
    transition: opacity 0.2s ease-in-out;
}

.editor-music-icon:hover {
    opacity: 1;
    color: var(--accent);
}

.page-view-active .editor-music-icon {
    display: none;
}
```

Step 3.7 — CSS fetch (`assets/css/collab.css?v=<cacheverzija>`)  
- Collaboration HUD + console styling; idle unless collab UI is toggled on.

```css
/* COLLABORATION STYLES */

/* LOCKED EDITOR STATE */
.editor-locked {
    opacity: 0.8;
    background-color: var(--bg-body);
}

/* TOP STATUS BAR */
#collab-top-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 60px; /* Increased to cover standard toolbar completely */
    background: var(--bg-paper);
    border-bottom: 2px solid var(--accent);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    z-index: 2000;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    font-size: 0.9rem;
    transition: transform 0.3s;
}

#collab-top-bar.hidden {
    transform: translateY(-100%);
}

.collab-bar-section {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.collab-status-badge {
    padding: 6px 12px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 0.8rem;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
}

.collab-status-badge.writer {
    background-color: #d1fae5;
    color: #065f46;
    border: 1px solid #10b981;
}

.collab-status-badge.reader {
    background-color: #fee2e2;
    color: #991b1b;
    border: 1px solid #ef4444;
}

.collab-pulse {
    width: 10px;
    height: 10px;
    background-color: currentColor;
    border-radius: 50%;
    animation: pulse 2s infinite;
}

@keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.4; }
    100% { opacity: 1; }
}

#collab-baton-btn {
    padding: 6px 16px;
    font-size: 0.85rem;
    font-weight: bold;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

#collab-baton-btn:disabled {
    background: var(--border-color);
    cursor: not-allowed;
    opacity: 0.7;
}

/* VIDEO HUD */
#collab-hud {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--bg-paper);
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    border-radius: 8px;
    z-index: 2000;
    display: flex;
    overflow: hidden;
    height: auto;
    max-height: 300px;
    flex-direction: row-reverse; /* Horizontal Layout */
    /*flex-direction: if(
        media (screen: >768px) : row-reverse;
        else: column;
    );*/

}
div#collab-top-bar > div > h1 {
    height: 32px;
}
div#collab-top-bar > div > h1 > img {
    max-width: 32px;
}
div#collab-top-bar > div > h1 > span {
    display: none;
}
.collab-hud-right-pane {
    width: 240px;
    display: flex;
    flex-direction: column;
}

.collab-video-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
    background: black;
}

#collab-remote-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

#collab-local-video {
    position: absolute;
    bottom: 5px;
    right: 5px;
    width: 60px;
    height: 45px;
    background: #333;
    border: 1px solid white;
    object-fit: cover;
    z-index: 2;
}

.collab-hud-controls {
    display: flex;
    justify-content: space-around;
    padding: 8px;
    background: var(--bg-paper);
    border-top: 1px solid var(--border-color);
}

.collab-btn {
    background: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-main);
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
}


.collab-btn:hover { background: var(--scene-hover); }

.collab-btn.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
}

button#collab-cam-btn.active {
    background-color: transparent;
    border-color: transparent;
}

/* CONSOLE LOG DRAWER */
#collab-console {
    background: #1e1e1e;
    color: #4ade80;
    font-family: 'Courier Prime', monospace;
    font-size: 0.7rem;
    padding: 8px;
    width: 260px; /* Wider console */
    border-right: 1px solid #333;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    /* max-height handled by parent */
}

#collab-console.hidden {
    display: none;
}

.log-entry {
    border-left: 2px solid transparent;
    padding-left: 6px;
    line-height: 1.3;
    word-break: break-word;
}
.log-entry.info { border-color: #3b82f6; color: #93c5fd; }
.log-entry.success { border-color: #22c55e; color: #86efac; }
.log-entry.warn { border-color: #eab308; color: #fde047; }
.log-entry.error { border-color: #ef4444; color: #fca5a5; }
.log-entry.system { border-color: #a855f7; color: #d8b4fe; font-style: italic; }

.log-time {
    opacity: 0.5;
    margin-right: 6px;
    font-size: 0.65rem;
}

/* TOAST */
.collab-toast {
    position: fixed;
    top: 80px; /* Below top bar */
    left: 50%;
    transform: translateX(-50%);
    background: var(--text-main);
    color: var(--bg-paper);
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 0.9rem;
    z-index: 2000;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
}
.collab-toast.show { opacity: 1; }

/* MODAL HELPERS */
.text-center { text-align: center; }
.text-sm { font-size: 0.8rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mt-2 { margin-top: 0.5rem; }
.gap-2 { gap: 0.5rem; }
input[readonly] { cursor: pointer; background-color: var(--scene-hover); }

/* --- ACTIVE CURSOR FOR COLLAB READER --- */
.is-collaborating .collab-active-block {
    position: relative;
}
.is-collaborating .collab-active-block::after {
    content: '';
    display: inline-block;
    width: 2px;
    height: 1.2em;
    background-color: var(--accent);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: blink-cursor 1s infinite;
}

@keyframes blink-cursor {
    0% { opacity: 1; }
    50% { opacity: 0; }
    100% { opacity: 1; }
}

```

Step 3.8 — CSS fetch (`assets/css/print.css?v=<cacheverzija>`)  
- Print/page-view geometry and treatment print sheets.

```css
/* PRINT STYLES & PAGE VIEW GEOMETRY */
div#printingdiv { display: none }

/* =========================================
   1. PAGE VIEW GEOMETRY (Standard Screenplay)
   ========================================= */

/* Base Page Container */
.page {
    position: relative;
    overflow: hidden;
    background-color: white; /* Force White for Page View context always */
    color: black;            /* Force Black text */
    
    /* Default US Letter Dimensions */
    width: 8.5in;
    height: 11in;
    
    /* Strict Screenplay Margins */
    padding-top: 1.0in;
    padding-bottom: 1.0in;
    padding-left: 1.5in;
    padding-right: 1.0in;
    
    box-sizing: border-box;
    margin: 0 auto 2rem auto;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.page.facing-page {
    padding-top: 1.0in;
    padding-bottom: 1.0in;
}

.page.facing-odd {
    padding-left: 1.7in;
    padding-right: 0.85in;
}

.page.facing-even {
    padding-left: 0.85in;
    padding-right: 1.7in;
}

.treatment-print-page.facing-odd {
    padding-left: 1.2in !important;
    padding-right: 0.7in !important;
}

.treatment-print-page.facing-even {
    padding-left: 0.7in !important;
    padding-right: 1.2in !important;
}

.page.page--blank {
    box-shadow: none;
    background: white;
}

/* Content Wrapper - The grid for text */
.page .content-wrapper {
    font-family: 'Courier Prime', 'Courier', monospace;
    font-size: 12pt;
    line-height: 16px; /* Exact 6 lines per inch */
    width: 100%;
}

/* Script Elements */
.page .script-line {
    margin: 0;
    padding: 0;
    min-height: 16px;
    white-space: pre-wrap;
    position: relative;
    width: 100%;
}

/* Element Spacing & Indentation (Strict) */
.page .sc-slug {
    font-weight: bold;
    text-transform: uppercase;
    margin-top: 32px; /* 2 blank lines before */
    margin-bottom: 16px; /* 1 blank line after */
    width: 100%;
}
.page .content-wrapper > .sc-slug:first-child { margin-top: 0; }

.page .sc-action { margin-bottom: 16px; width: 100%; }

.page .sc-character { 
    text-transform: uppercase; 
    margin-left: 2.2in; 
    width: auto; 
    margin-top: 0; margin-bottom: 0; 
}

.page .sc-dialogue { 
    margin-left: 1.0in; 
    width: 3.5in; 
    margin-bottom: 16px; 
}
/* Remove bottom margin if followed by Parenthetical or more Dialogue */
.page .sc-dialogue:has(+ :is(.sc-parenthetical, .sc-dialogue)) { margin-bottom: 0; }

.page .sc-parenthetical { 
    margin-left: 1.6in; 
    width: 2.4in; 
    margin-bottom: 0; 
}
.page .sc-parenthetical::before { content: '('; }
.page .sc-parenthetical::after { content: ')'; }

.page .sc-transition { 
    text-align: right; 
    margin-left: auto; 
    margin-top: 16px; 
    margin-bottom: 16px; 
    width: auto; 
}

/* Page Numbers */
.page .page-number {
    position: absolute;
    top: 0.5in;
    right: 0.5in;
    font-family: 'Courier Prime', monospace;
    font-size: 12pt;
    color: #333;
    pointer-events: none;
    display: block !important;
    z-index: 10;
}

.page .page-header {
    position: absolute;
    top: 0.5in;
    left: 1.5in; /* Align with text margin */
    right: 1.0in;
    text-align: right;
    pointer-events: none;
    color: #888;
    font-size: 12pt;
    font-family: 'Courier Prime', monospace;
}

.page.page--suppress-meta .page-number, 
.page.page--suppress-meta .page-header {
    display: none !important;
}

/* Watermark */
.print-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 80pt;
    font-family: 'Courier Prime', sans-serif;
    color: rgba(0,0,0,0.05); /* Very faint grey */
    white-space: nowrap;
    pointer-events: none;
    z-index: 5;
    text-transform: uppercase;
}

/* =========================================
   2. PREVIEW CONTAINER (Modal Specifics)
   ========================================= */

#print-preview-container {
    padding: 40px;
    transition: transform 0.2s ease-out;
    /* Force Light Theme Variables for Preview */
    --bg-body: #e5e5e5;
    --bg-paper: #ffffff;
    --text-main: #000000;
    --text-meta: #666666;
    color: black;
}

#print-preview-container.mode-switching {
    animation: previewModeSwap 0.26s ease;
}

@keyframes previewModeSwap {
    0% { opacity: 0; transform: translateY(8px) scale(0.99); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* Ensure no dark mode bleed */
#print-preview-container .page,
#print-preview-container .print-sheet,
#print-preview-container .treatment-print-page {
    background-color: white !important;
    color: black !important;
}

/* Preview wrapper */
.print-sheet {
    margin-bottom: 30px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
}

/* =========================================
   3. TREATMENT MODE PRINT LAYOUT
   ========================================= */

.treatment-print-page {
    width: 8.5in;
    height: 11in;
    padding: 0.75in 0.85in !important;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.35in;
    background: #ffffff;
    page-break-after: always;
    font-family: 'Inter', -apple-system, sans-serif;
    color: #0f172a;
    border: 1px solid #d9e0ea;
    box-shadow: 0 10px 22px rgba(0,0,0,0.18);
}

.treatment-print-page.landscape {
    width: 11in;
    height: 8.5in;
}

.booklet-treatment {
    font-size: 0.95rem;
    box-shadow: none;
    border: 1px solid #d9e0ea;
}

.booklet-treatment .scene-title {
    font-size: 0.85rem;
}

.treatment-cover {
    justify-content: center;
    gap: 0.5in;
}

.cover-hero {
    display: flex;
    flex-direction: column;
    gap: 0.25in;
    align-items: flex-start;
}

.cover-label {
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    color: #475569;
    font-size: 0.75rem;
}

.cover-title {
    font-family: 'Courier Prime', monospace;
    font-size: 1.6rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1.2;
}

.cover-author {
    font-size: 1rem;
    color: #334155;
    font-weight: 600;
}

.cover-contact {
    font-size: 0.85rem;
    color: #475569;
    line-height: 1.5;
}

.cover-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.4rem;
}

.treatment-index .index-grid {
    display: grid;
    gap: 0.2rem;
    margin-top: 0.3in;
}

.index-row {
    display: grid;
    grid-template-columns: 0.4fr 1.4fr 0.8fr;
    gap: 0.4rem;
    align-items: center;
    padding: 0.3rem 0.35rem;
    border-bottom: 1px dashed #e2e8f0;
}

.index-num {
    font-weight: 800;
    color: #0f172a;
}

.index-title {
    font-family: 'Courier Prime', monospace;
    letter-spacing: 0.05em;
    font-size: 0.88rem;
    text-transform: uppercase;
}

.index-meta {
    text-align: right;
    color: #475569;
    font-size: 0.8rem;
}

.booklet-treatment .index-row {
    grid-template-columns: 0.5fr 1.2fr 0.8fr;
    font-size: 0.85rem;
}

.treatment-doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 0.25in;
    gap: 1rem;
}

.doc-title-block {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    letter-spacing: 0.04em;
}

.doc-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.doc-title {
    font-family: 'Courier Prime', monospace;
    font-size: 1rem;
    font-weight: 700;
    text-transform: uppercase;
    word-break: break-word;
}

.doc-submeta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.15rem;
    color: #475569;
    font-size: 0.85rem;
}

.treatment-scene-hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.6rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.2in;
}

.scene-hero-left {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    flex: 1;
}

.scene-number-pill {
    min-width: 2rem;
    height: 2rem;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    display: grid;
    place-items: center;
    font-weight: 800;
    letter-spacing: 0.05em;
}

.scene-hero-titles {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    flex: 1;
}

.scene-title {
    font-family: 'Courier Prime', monospace;
    letter-spacing: 0.08em;
    font-size: 0.95rem;
    text-transform: uppercase;
    word-break: break-word;
}

.scene-subline {
    text-transform: uppercase;
    color: #475569;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    word-break: break-word;
}

.scene-hero-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
    min-width: 3rem;
}

.scene-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
}

.meta-chip {
    display: inline-flex;
    gap: 0.3rem;
    align-items: center;
    padding: 0.35rem 0.55rem;
    background: #eef2f6;
    border: 1px solid #d8e0ec;
    border-radius: 8px;
    font-size: 0.78rem;
    color: #0f172a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

.meta-chip .chip-label {
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #475569;
    font-size: 0.68rem;
}

.meta-chip .chip-value {
    font-weight: 600;
}

.thumbs-panel .thumb-grid {
    display: grid;
    gap: 0.25rem;
    align-items: start;
    justify-items: start;
    overflow: hidden;
}

.thumb {
    position: relative;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
}

.thumb-page {
    background: white;
    box-shadow: none !important;
}

.stats-list {
    margin: 0;
    padding-left: 1rem;
    color: #0f172a;
}

.stats-list li {
    margin-bottom: 0.2rem;
    line-height: 1.4;
}

.notepad {
    width: 100%;
    background-image: linear-gradient(to bottom, transparent 95%, #e2e8f0 95%);
    background-repeat: repeat-y;
}

.treatment-body-flow {
    display: flex;
    flex-direction: column;
    gap: 0.3in;
    width: 100%;
    min-height: 0;
    flex: 1;
}

.treatment-body-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
    gap: 0.35in;
    align-items: start;
    width: 100%;
    min-height: 0;
}

.treatment-body-grid.single-column {
    grid-template-columns: 1fr;
}

.treatment-body-grid.visual-spread {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.1fr);
}

.booklet-treatment .treatment-body-grid {
    grid-template-columns: 1fr !important;
}

.treatment-column {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
}

.scene-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 0.6rem 0.7rem;
}

.section-title {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #475569;
    font-weight: 700;
}

.section-body {
    font-size: 0.9rem;
    line-height: 1.5;
    white-space: pre-wrap;
    color: #0f172a;
    word-break: break-word;
    overflow-wrap: break-word;
}

.section-body.mono {
    font-family: 'Courier Prime', monospace;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 6px;
    padding: 0.5rem 0.6rem;
}

.treatment-placeholder {
    font-size: 0.85rem;
    color: #94a3b8;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 0.65rem 0.75rem;
    background: #f8fafc;
}

.images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.35rem;
    max-height: 6in;
    overflow: hidden;
}

.images-grid img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.compact-stats .section-title {
    font-size: 0.7rem;
}

.treatment-body-grid.visual-spread {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.1fr);
}

@media (max-width: 1000px) {
    .treatment-body-grid {
        grid-template-columns: 1fr;
    }
}

/* =========================================
   4. BOOKLET / IMPOSITION
   ========================================= */
.booklet-spread {
    display: flex;
    width: 11in;
    height: 8.5in;
    background: white;
}
.booklet-page-slot {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    border-right: 1px dashed #ddd;
}
.booklet-page-slot:last-child { border-right: none; }

.booklet-scaler {
    transform-origin: center;
    box-shadow: 0 0 5px rgba(0,0,0,0.1);
}

/* =========================================
   5. PRINT MEDIA QUERY (Final Output)
   ========================================= */

@media print {
    /* RESET GLOBAL STYLES */
    :root {
        --bg-body: white !important;
        --bg-paper: white !important;
        --text-main: black !important;
        --text-meta: #555 !important;
    }
    
    body {
        background-color: white !important;
        color: black !important;
        height: auto !important;
        overflow: visible !important;
        margin: 0 !important;
    }

    /* Hide UI */
    #sidebar, #toolbar, #mobile-menu-btn, #show-sidebar-btn, .loader-overlay, .modal-overlay {
        display: none !important;
    }

    /* Show Print Container */
    body.printing-from-modal #printingdiv {
        display: block !important;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        margin: 0;
        padding: 0;
    }

    body.printing-from-modal > *:not(#printingdiv) {
        display: none !important;
    }

    /* Unwrap Pages */
    .print-sheet {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        page-break-after: always;
        break-after: page;
    }

    /* Strict Page Reset */
    .page:not(.thumb-page) {
        margin: 0 !important;
        box-shadow: none !important;
        width: 100% !important; /* Let @page handle size */
        page-break-after: always;
        break-after: page;
    }

    /* Treatment Overrides */
    .treatment-print-page {
        box-shadow: none !important;
        border: none !important;
    }
    .treatment-print-page:not(.booklet-treatment) {
        padding: 0.65in !important;
    }
    
    /* Ensure thumbnails don't break pages or inherit undesired page-level print styles */
    .thumb-page {
        page-break-after: auto !important;
        break-after: auto !important;
        margin: 0 !important;
        box-shadow: none !important;
    }
    
    .treatment-body-grid,
    .scene-section,
    .treatment-scene-hero,
    .treatment-doc-header {
        break-inside: avoid;
        page-break-inside: avoid;
    }
}

```

Step 3.9 — CSS fetch (`assets/css/reports.css?v=<cacheverzija>`)  
- Reports dashboard theming (KPIs, tables, progress bars).

```css
/* REPORT DASHBOARD STYLES */
.report-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.report-dashboard {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
}

.kpi-card {
    background: var(--bg-body);
    border: 1px solid var(--border-color);
    padding: 1.25rem 1rem;
    border-radius: 0.5rem;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.kpi-value {
    font-size: 2rem;
    font-weight: 800;
    color: var(--accent);
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
}

.kpi-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--text-meta);
    font-weight: 600;
    margin-top: 0.5rem;
    letter-spacing: 0.05em;
}

.report-grid-2 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 2rem;
}

/* STATS LIST & BARS */
.stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: var(--text-meta);
    margin-bottom: 0.5rem;
}

.progress-bar-container {
    height: 8px;
    background-color: var(--scene-hover);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1.5rem;
}

.progress-bar-fill {
    height: 100%;
    transition: width 0.5s ease-out;
}

.stat-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px dashed var(--border-color);
    padding-bottom: 0.5rem;
    font-size: 0.9rem;
}
.stat-item:last-child {
    border-bottom: none;
}

/* TABLES & LISTS */
.report-table {
    width: 100%;
    border-collapse: collapse;
}

.report-table th {
    text-transform: uppercase;
    font-size: 0.7rem;
    color: var(--text-meta);
    padding: 0.5rem;
    border-bottom: 2px solid var(--border-color);
    background-color: transparent;
    font-weight: 700;
    letter-spacing: 0.05em;
}

.report-table td {
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.9rem;
}

.report-table tr:last-child td {
    border-bottom: none;
}

.text-right { text-align: right; }
.text-center { text-align: center; }
.text-faded { color: var(--text-meta); opacity: 0.8; }
.font-mono { font-family: 'Courier Prime', monospace; }
.font-bold { font-weight: 700; }
.text-sm { font-size: 0.8rem; }
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; display: block; }

/* BADGES */
.badge {
    padding: 3px 8px;
    border-radius: 9999px;
    font-size: 0.65rem;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.05em;
    display: inline-block;
}

.badge.speaking {
    background-color: rgba(16, 185, 129, 0.15);
    color: #059669;
}

.badge.non-speaking {
    background-color: var(--scene-hover);
    color: var(--text-meta);
}

.dark-mode .badge.speaking {
    background-color: rgba(16, 185, 129, 0.25);
    color: #34d399;
}

/* OTHER */
.char-legend-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
}

.scroll-list {
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem;
    background-color: var(--bg-body);
}

.report-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid var(--accent);
    padding-bottom: 1rem;
    margin-bottom: 1rem;
}

.report-header h2 {
    margin: 0;
    font-size: 1.75rem;
    color: var(--text-main);
    font-weight: 800;
    letter-spacing: -0.025em;
}

/* REPORTS SECTIONS */
.report-section {
    margin-bottom: 2rem;
}

.report-section h3 {
    font-size: 0.9rem;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 1rem;
    color: var(--text-main);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* PRINT MEDIA QUERY FOR REPORTS */
@media print {
    .report-dashboard { grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .kpi-card { border: 1px solid #ddd; box-shadow: none; }
    .report-grid-2 { grid-template-columns: 1fr 1fr; }
    .report-container { gap: 1rem; }
    .scroll-list { border: 1px solid #ddd; max-height: none !important; overflow: visible !important; }
}

/* UTILITY CLASSES (Refactored from JS inline styles) */
.chart-legend-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
}

.chart-legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.chart-container-flex {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.chart-legend-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.report-table-sticky-thead {
    position: sticky;
    top: 0;
    background: var(--bg-paper);
    z-index: 1;
}

.flex-wrap-gap-4 {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.monologue-item {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
}

.flex-justify-between-full {
    display: flex;
    justify-content: space-between;
    width: 100%;
}

.text-italic-faded {
    font-size: 0.75rem;
    font-style: italic;
    line-height: 1.4;
    color: var(--text-meta);
}

.flex-gap-05 {
    display: flex;
    gap: 0.5rem;
}

.report-subtitle-centered {
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
    text-align: center;
}

.report-table-scroll-container {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 4px;
}

.badge-custom {
    background-color: var(--badge-color);
    color: white;
    border: 1px solid var(--badge-color);
}

.badge-custom-outline {
    background-color: transparent;
    color: var(--badge-color);
    border: 1px solid var(--badge-color);
    font-weight: normal;
}


```

Step 3.10 — CSS fetch (`assets/css/treatment.css?v=<cacheverzija>`)  
- Treatment-mode card layout and mobile tweaks.

```css
/* TREATMENT MODE STYLES - "STREAMLINED PAPER" AESTHETIC */

/* --- Mode Switching Animation --- */
body.mode-switching #main-area {
    filter: blur(4px);
    opacity: 0.8;
    transition: filter 0.3s ease-out, opacity 0.3s ease-out;
}

#main-area {
    transition: filter 0.3s ease-in, opacity 0.3s ease-in;
}

/* --- Main Block --- */
.treatment-scene-block {
    position: relative;
    margin-bottom: 2rem;
    padding-left: 0; 
    font-family: 'Courier Prime', monospace;
    color: var(--text-main);
    transition: transform 0.2s, box-shadow 0.2s;
    background: var(--bg-paper);
    border-radius: 8px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1);
    border: 1px solid var(--border-color);
}

.treatment-scene-block:hover {
    box-shadow: 0 5px 15px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.05);
    z-index: 10;
}

.treatment-scene-block.dragging {
    opacity: 0.8;
    transform: scale(1.02);
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    z-index: 100;
    cursor: grabbing;
}

/* --- Reorder Controls --- */
.treatment-reorder-controls {
    position: absolute;
    left: -2.5rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
}

.treatment-scene-block:hover .treatment-reorder-controls {
    opacity: 1;
}

.reorder-btn {
    background: var(--bg-paper);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    color: var(--text-meta);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    transition: all 0.2s;
}

.reorder-btn:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--accent);
    transform: scale(1.1);
}

.reorder-btn:disabled {
    cursor: default;
    opacity: 0.3;
    background: transparent;
    box-shadow: none;
    border-color: transparent;
}

/* --- Header Layout --- */
.treatment-header {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--border-color);
    background-color: rgba(0,0,0,0.02); /* Very subtle tint */
    min-height: 3.5rem;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}

/* Scene Number: Clean, Bold */
.treatment-scene-number {
    width: 4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--text-meta); /* Muted but large */
    flex-shrink: 0;
    border-right: 1px solid var(--border-color);
    background: transparent;
}

/* Middle Column: Rows of cells */
.treatment-header-main-column {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
}

.treatment-header-row {
    display: flex;
    flex: 1; 
    border-bottom: 1px solid var(--border-color);
}

.treatment-header-row:last-child {
    border-bottom: none;
}

/* Cells */
.treatment-header-cell {
    padding: 0.5rem 0.8rem;
    display: flex;
    align-items: center;
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    border-right: 1px solid var(--border-color);
    outline: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--text-main);
    background: transparent;
    transition: background 0.2s;
}

.treatment-header-cell:focus {
    background-color: var(--bg-body);
    color: var(--accent);
}

/* Specific Cell Widths/Flex */
.cell-intro {
    width: 4.5rem; 
    flex-shrink: 0;
    font-weight: 700;
    color: var(--text-meta);
}

.cell-location {
    flex-grow: 1; 
    border-right: none;
    font-weight: 700;
}

.cell-time {
    flex-grow: 1; 
}

.cell-duration {
    width: auto;
    min-width: 4rem;
    justify-content: center;
    color: var(--text-meta);
    font-size: 0.75rem;
    border-right: none; 
    background: rgba(0,0,0,0.03);
}

/* Icon Box */
.treatment-header-icon {
    width: 3.5rem; 
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    border-left: 1px solid var(--border-color);
    flex-shrink: 0;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-meta);
}
.treatment-header-icon:hover {
    color: var(--accent);
    background: rgba(0,0,0,0.02);
}
.treatment-icon-placeholder {
    opacity: 0.3;
}

/* --- Content Body --- */
.treatment-body-wrapper {
    padding: 1rem;
}

.treatment-body {
    font-size: 11pt;
    line-height: 1.5;
    color: var(--text-main);
    white-space: pre-wrap;
    outline: none;
    min-height: 3em;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid transparent; /* Prevent jump on focus */
    transition: border-color 0.2s, background-color 0.2s;
}

.treatment-body:focus {
    background-color: var(--bg-body);
    border-color: var(--border-color);
}

.treatment-body[data-empty="true"]::before {
    content: "Write synopsis here...";
    color: var(--text-meta);
    opacity: 0.4;
    font-style: italic;
    position: absolute;
    pointer-events: none;
}

/* --- Sections (Images, Chars, Music) --- */
.treatment-section-wrapper {
    position: relative;
    margin-bottom: 0.8rem;
    min-height: 1.5rem;
}

/* Add Buttons - Clean & Accessible */
.treatment-add-btn {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    border: 1px solid var(--border-color);
    background: var(--bg-body);
    color: var(--text-meta);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Bouncy */
    font-size: 0.8rem;
    z-index: 20;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

/* Button position (Desktop) */
.treatment-section-wrapper .treatment-add-btn {
    position: absolute;
    left: -2.5rem; 
    top: 0;
}

.treatment-scene-block:hover .treatment-add-btn {
    opacity: 0.5; /* Subtle hint */
}
.treatment-scene-block:hover .treatment-add-btn:hover {
    opacity: 1;
    transform: scale(1.15);
    border-color: var(--accent);
    color: var(--accent);
}

/* Controls Area (Bottom/Side options) */
.treatment-controls-area {
    position: absolute;
    right: 1rem;
    bottom: 1rem;
    display: flex;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none; /* Pass through when hidden */
}
.treatment-scene-block:hover .treatment-controls-area {
    opacity: 1;
    pointer-events: auto;
}

/* Override: Use the Renderer's logic for Controls Area (it was stacking empty buttons) */
div.treatment-controls-area {
    position: relative;
    right: auto; bottom: auto;
    padding: 0 1rem 0.5rem 1rem;
    height: auto;
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    opacity: 1; /* Always visible if it has buttons? Or hover? */
    pointer-events: auto;
    border-bottom: 1px dashed var(--border-color);
    margin-bottom: 0.5rem;
}
div.treatment-controls-area:empty {
    display: none;
    border: none;
    margin: 0;
    padding: 0;
}
div.treatment-controls-area .treatment-add-btn {
    position: static;
    opacity: 0.6;
    width: auto;
    height: auto;
    padding: 0.3rem 0.8rem;
    border-radius: 4px;
    gap: 0.4rem;
    aspect-ratio: auto;
}
div.treatment-controls-area .treatment-add-btn::after {
    content: attr(data-label);
    font-size: 0.7rem;
    font-weight: 600;
}


/* Music Row */
.treatment-music-row {
    font-size: 0.85rem;
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border-color);
    padding: 0.3rem 0.4rem 0.3rem 1rem;
    background: var(--bg-body);
    border-radius: 99px;
    gap: 0.8rem;
    max-width: 100%;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

/* Image Grid */
.treatment-image-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    width: 100%;
    margin-bottom: 0.5rem;
}
.treatment-image-item {
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 1px solid var(--border-color);
    overflow: hidden;
}

/* Characters */
.treatment-chars-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.5rem;
}

.treatment-char-badge {
    border: 1px solid var(--border-color);
    padding: 0.25rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 6px;
    background: var(--bg-body);
    color: var(--text-main);
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    transition: all 0.2s;
}
.treatment-char-badge:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
}

/* Transition Footer */
.treatment-footer-transition {
    text-align: right;
    font-family: 'Courier Prime', monospace;
    font-weight: bold;
    margin: 0.5rem 1rem 1rem 1rem;
    color: var(--text-main);
    opacity: 0.8;
}

/* --- Mobile Adjustments --- */
@media (max-width: 768px) {
    .treatment-scene-block {
        margin-bottom: 1.5rem;
        padding-bottom: 0;
        border-radius: 0;
        border-left: none;
        border-right: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    /* Mobile Reorder: Bottom Bar */
    .treatment-reorder-controls {
        position: relative;
        left: auto; top: auto;
        transform: none;
        flex-direction: row;
        width: 100%;
        justify-content: flex-end;
        opacity: 1;
        padding: 0.5rem 1rem;
        border-top: 1px dashed var(--border-color);
        background: rgba(0,0,0,0.02);
        margin-top: 0.5rem;
    }
    
    .reorder-btn {
        width: 2.5rem; height: 2.5rem;
        border-radius: 4px;
    }

    .treatment-header {
        flex-wrap: wrap; 
        border-radius: 0;
    }
    
    .treatment-scene-number {
        border-bottom: 1px solid var(--border-color);
    }

    .treatment-header-main-column {
        min-width: 0; 
        border-left: 1px solid var(--border-color);
    }

    /* Controls Area Mobile */
    div.treatment-controls-area {
        justify-content: flex-start;
        overflow-x: auto;
    }
}

/* Mobile Simplified Header */
.treatment-header-simple-slug {
    flex: 1;
    font-size: 1.2rem;
    font-weight: bold;
    text-transform: uppercase;
    padding: 0 1rem;
    display: flex;
    align-items: center;
    outline: none;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    border: none;
    background: transparent;
    height: 100%;
}
.treatment-header-simple-slug:focus {
    background-color: var(--scene-hover);
}

/* --- DROPDOWNS & INPUTS (Restored) --- */
.treatment-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    min-width: 150px;
    background: var(--bg-paper);
    border: 1px solid var(--border-color);
    list-style: none;
    padding: 0;
    margin: 0;
    z-index: 1000;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.treatment-dropdown-menu li {
    padding: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: 'Courier Prime', monospace;
    color: var(--text-main);
}

.treatment-dropdown-menu li:hover,
.treatment-dropdown-menu li.selected {
    background-color: var(--accent);
    color: white;
}

.treatment-char-input {
    font-family: 'Courier Prime', monospace;
    font-size: 0.85rem;
    padding: 0.2rem 0.6rem;
    border: 1px dashed var(--text-meta);
    background: transparent;
    color: var(--text-main);
    width: 200px;
    text-transform: uppercase;
    border-radius: 99px;
}
.treatment-char-input:focus {
    border-style: solid;
    border-color: var(--accent);
    outline: none;
    background: var(--bg-paper);
}

/* --- MOBILE META HEADER (Restored) --- */
.treatment-mobile-meta {
    margin-bottom: 2rem;
    padding: 0 0.5rem;
    position: relative;
    border-bottom: 2px dashed var(--border-color);
    padding-bottom: 1rem;
}

.treatment-meta-line {
    border: none;
    border-bottom: 1px solid var(--border-color);
    background: transparent;
    width: 100%;
    font-family: 'Courier Prime', monospace;
    font-size: 1rem;
    color: var(--text-main);
    margin-bottom: 0.5rem;
    padding: 0.25rem 0;
    border-radius: 0;
}

.treatment-meta-line:focus {
    outline: none;
    border-bottom-color: var(--accent);
}

.treatment-meta-line.title-line {
    font-weight: bold;
    font-size: 1.2rem;
    text-transform: uppercase;
    text-align: center;
}

.treatment-meta-toggle {
    position: absolute;
    top: -10px;
    right: 0;
    background: transparent;
    border: none;
    color: var(--text-meta);
    padding: 0.5rem;
    font-size: 0.8rem;
    cursor: pointer;
}
.treatment-mobile-meta input {
    max-width: 70vw;
    text-align: left;
}

.treatment-mobile-meta.collapsed .treatment-meta-line {
    display: none;
}

.treatment-mobile-meta.collapsed::after {
    content: "Screenplay Info";
    display: block;
    text-align: center;
    font-size: 0.8rem;
    color: var(--text-meta);
    font-style: italic;
    padding: 0.5rem;
}

/* Scene Color Implementations */
.treatment-scene-block:has(.scene-color-1) { border-left: 4px solid var(--scene-color-1); }
.treatment-scene-block:has(.scene-color-2) { border-left: 4px solid var(--scene-color-2); }
.treatment-scene-block:has(.scene-color-3) { border-left: 4px solid var(--scene-color-3); }
.treatment-scene-block:has(.scene-color-4) { border-left: 4px solid var(--scene-color-4); }
.treatment-scene-block:has(.scene-color-5) { border-left: 4px solid var(--scene-color-5); }
/* And keep the icon/number colors */
.treatment-scene-number.scene-color-1, .treatment-header-icon.scene-color-1 i { color: var(--scene-color-1) !important; }
.treatment-scene-number.scene-color-2, .treatment-header-icon.scene-color-2 i { color: var(--scene-color-2) !important; }
.treatment-scene-number.scene-color-3, .treatment-header-icon.scene-color-3 i { color: var(--scene-color-3) !important; }
.treatment-scene-number.scene-color-4, .treatment-header-icon.scene-color-4 i { color: var(--scene-color-4) !important; }
.treatment-scene-number.scene-color-5, .treatment-header-icon.scene-color-5 i { color: var(--scene-color-5) !important; }
```

Step 3.11 — Complete CSS payload for `assets/fontawesome/css/all.css`  
- Earlier in Step 3.1 we shortened the glyph table; the untouched 73,577-byte file is inlined here for fidelity.

```css
/*!
 * Font Awesome Free 5.15.4 by @fontawesome - https://fontawesome.com
 * License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
 */
.fa,
.fas,
.far,
.fal,
.fad,
.fab {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  display: inline-block;
  font-style: normal;
  font-variant: normal;
  text-rendering: auto;
  line-height: 1; }

.fa-lg {
  font-size: 1.33333em;
  line-height: 0.75em;
  vertical-align: -.0667em; }

.fa-xs {
  font-size: .75em; }

.fa-sm {
  font-size: .875em; }

.fa-1x {
  font-size: 1em; }

.fa-2x {
  font-size: 2em; }

.fa-3x {
  font-size: 3em; }

.fa-4x {
  font-size: 4em; }

.fa-5x {
  font-size: 5em; }

.fa-6x {
  font-size: 6em; }

.fa-7x {
  font-size: 7em; }

.fa-8x {
  font-size: 8em; }

.fa-9x {
  font-size: 9em; }

.fa-10x {
  font-size: 10em; }

.fa-fw {
  text-align: center;
  width: 1.25em; }

.fa-ul {
  list-style-type: none;
  margin-left: 2.5em;
  padding-left: 0; }
  .fa-ul > li {
    position: relative; }

.fa-li {
  left: -2em;
  position: absolute;
  text-align: center;
  width: 2em;
  line-height: inherit; }

.fa-border {
  border: solid 0.08em #eee;
  border-radius: .1em;
  padding: .2em .25em .15em; }

.fa-pull-left {
  float: left; }

.fa-pull-right {
  float: right; }

.fa.fa-pull-left,
.fas.fa-pull-left,
.far.fa-pull-left,
.fal.fa-pull-left,
.fab.fa-pull-left {
  margin-right: .3em; }

.fa.fa-pull-right,
.fas.fa-pull-right,
.far.fa-pull-right,
.fal.fa-pull-right,
.fab.fa-pull-right {
  margin-left: .3em; }

.fa-spin {
  -webkit-animation: fa-spin 2s infinite linear;
          animation: fa-spin 2s infinite linear; }

.fa-pulse {
  -webkit-animation: fa-spin 1s infinite steps(8);
          animation: fa-spin 1s infinite steps(8); }

@-webkit-keyframes fa-spin {
  0% {
    -webkit-transform: rotate(0deg);
            transform: rotate(0deg); }
  100% {
    -webkit-transform: rotate(360deg);
            transform: rotate(360deg); } }

@keyframes fa-spin {
  0% {
    -webkit-transform: rotate(0deg);
            transform: rotate(0deg); }
  100% {
    -webkit-transform: rotate(360deg);
            transform: rotate(360deg); } }

.fa-rotate-90 {
  -ms-filter: "progid:DXImageTransform.Microsoft.BasicImage(rotation=1)";
  -webkit-transform: rotate(90deg);
          transform: rotate(90deg); }

.fa-rotate-180 {
  -ms-filter: "progid:DXImageTransform.Microsoft.BasicImage(rotation=2)";
  -webkit-transform: rotate(180deg);
          transform: rotate(180deg); }

.fa-rotate-270 {
  -ms-filter: "progid:DXImageTransform.Microsoft.BasicImage(rotation=3)";
  -webkit-transform: rotate(270deg);
          transform: rotate(270deg); }

.fa-flip-horizontal {
  -ms-filter: "progid:DXImageTransform.Microsoft.BasicImage(rotation=0, mirror=1)";
  -webkit-transform: scale(-1, 1);
          transform: scale(-1, 1); }

.fa-flip-vertical {
  -ms-filter: "progid:DXImageTransform.Microsoft.BasicImage(rotation=2, mirror=1)";
  -webkit-transform: scale(1, -1);
          transform: scale(1, -1); }

.fa-flip-both, .fa-flip-horizontal.fa-flip-vertical {
  -ms-filter: "progid:DXImageTransform.Microsoft.BasicImage(rotation=2, mirror=1)";
  -webkit-transform: scale(-1, -1);
          transform: scale(-1, -1); }

:root .fa-rotate-90,
:root .fa-rotate-180,
:root .fa-rotate-270,
:root .fa-flip-horizontal,
:root .fa-flip-vertical,
:root .fa-flip-both {
  -webkit-filter: none;
          filter: none; }

.fa-stack {
  display: inline-block;
  height: 2em;
  line-height: 2em;
  position: relative;
  vertical-align: middle;
  width: 2.5em; }

.fa-stack-1x,
.fa-stack-2x {
  left: 0;
  position: absolute;
  text-align: center;
  width: 100%; }

.fa-stack-1x {
  line-height: inherit; }

.fa-stack-2x {
  font-size: 2em; }

.fa-inverse {
  color: #fff; }

/* Font Awesome uses the Unicode Private Use Area (PUA) to ensure screen
readers do not read off random characters that represent icons */
.fa-500px:before {
  content: "\f26e"; }

.fa-accessible-icon:before {
  content: "\f368"; }

.fa-accusoft:before {
  content: "\f369"; }

.fa-acquisitions-incorporated:before {
  content: "\f6af"; }

.fa-ad:before {
  content: "\f641"; }

.fa-address-book:before {
  content: "\f2b9"; }

.fa-address-card:before {
  content: "\f2bb"; }

.fa-adjust:before {
  content: "\f042"; }

.fa-adn:before {
  content: "\f170"; }

.fa-adversal:before {
  content: "\f36a"; }

.fa-affiliatetheme:before {
  content: "\f36b"; }

.fa-air-freshener:before {
  content: "\f5d0"; }

.fa-airbnb:before {
  content: "\f834"; }

.fa-algolia:before {
  content: "\f36c"; }

.fa-align-center:before {
  content: "\f037"; }

.fa-align-justify:before {
  content: "\f039"; }

.fa-align-left:before {
  content: "\f036"; }

.fa-align-right:before {
  content: "\f038"; }

.fa-alipay:before {
  content: "\f642"; }

.fa-allergies:before {
  content: "\f461"; }

.fa-amazon:before {
  content: "\f270"; }

.fa-amazon-pay:before {
  content: "\f42c"; }

.fa-ambulance:before {
  content: "\f0f9"; }

.fa-american-sign-language-interpreting:before {
  content: "\f2a3"; }

.fa-amilia:before {
  content: "\f36d"; }

.fa-anchor:before {
  content: "\f13d"; }

.fa-android:before {
  content: "\f17b"; }

.fa-angellist:before {
  content: "\f209"; }

.fa-angle-double-down:before {
  content: "\f103"; }

.fa-angle-double-left:before {
  content: "\f100"; }

.fa-angle-double-right:before {
  content: "\f101"; }

.fa-angle-double-up:before {
  content: "\f102"; }

.fa-angle-down:before {
  content: "\f107"; }

.fa-angle-left:before {
  content: "\f104"; }

.fa-angle-right:before {
  content: "\f105"; }

.fa-angle-up:before {
  content: "\f106"; }

.fa-angry:before {
  content: "\f556"; }

.fa-angrycreative:before {
  content: "\f36e"; }

.fa-angular:before {
  content: "\f420"; }

.fa-ankh:before {
  content: "\f644"; }

.fa-app-store:before {
  content: "\f36f"; }

.fa-app-store-ios:before {
  content: "\f370"; }

.fa-apper:before {
  content: "\f371"; }

.fa-apple:before {
  content: "\f179"; }

.fa-apple-alt:before {
  content: "\f5d1"; }

.fa-apple-pay:before {
  content: "\f415"; }

.fa-archive:before {
  content: "\f187"; }

.fa-archway:before {
  content: "\f557"; }

.fa-arrow-alt-circle-down:before {
  content: "\f358"; }

.fa-arrow-alt-circle-left:before {
  content: "\f359"; }

.fa-arrow-alt-circle-right:before {
  content: "\f35a"; }

.fa-arrow-alt-circle-up:before {
  content: "\f35b"; }

.fa-arrow-circle-down:before {
  content: "\f0ab"; }

.fa-arrow-circle-left:before {
  content: "\f0a8"; }

.fa-arrow-circle-right:before {
  content: "\f0a9"; }

.fa-arrow-circle-up:before {
  content: "\f0aa"; }

.fa-arrow-down:before {
  content: "\f063"; }

.fa-arrow-left:before {
  content: "\f060"; }

.fa-arrow-right:before {
  content: "\f061"; }

.fa-arrow-up:before {
  content: "\f062"; }

.fa-arrows-alt:before {
  content: "\f0b2"; }

.fa-arrows-alt-h:before {
  content: "\f337"; }

.fa-arrows-alt-v:before {
  content: "\f338"; }

.fa-artstation:before {
  content: "\f77a"; }

.fa-assistive-listening-systems:before {
  content: "\f2a2"; }

.fa-asterisk:before {
  content: "\f069"; }

.fa-asymmetrik:before {
  content: "\f372"; }

.fa-at:before {
  content: "\f1fa"; }

.fa-atlas:before {
  content: "\f558"; }

.fa-atlassian:before {
  content: "\f77b"; }

.fa-atom:before {
  content: "\f5d2"; }

.fa-audible:before {
  content: "\f373"; }

.fa-audio-description:before {
  content: "\f29e"; }

.fa-autoprefixer:before {
  content: "\f41c"; }

.fa-avianex:before {
  content: "\f374"; }

.fa-aviato:before {
  content: "\f421"; }

.fa-award:before {
  content: "\f559"; }

.fa-aws:before {
  content: "\f375"; }

.fa-baby:before {
  content: "\f77c"; }

.fa-baby-carriage:before {
  content: "\f77d"; }

.fa-backspace:before {
  content: "\f55a"; }

.fa-backward:before {
  content: "\f04a"; }

.fa-bacon:before {
  content: "\f7e5"; }

.fa-bacteria:before {
  content: "\e059"; }

.fa-bacterium:before {
  content: "\e05a"; }

.fa-bahai:before {
  content: "\f666"; }

.fa-balance-scale:before {
  content: "\f24e"; }

.fa-balance-scale-left:before {
  content: "\f515"; }

.fa-balance-scale-right:before {
  content: "\f516"; }

.fa-ban:before {
  content: "\f05e"; }

.fa-band-aid:before {
  content: "\f462"; }

.fa-bandcamp:before {
  content: "\f2d5"; }

.fa-barcode:before {
  content: "\f02a"; }

.fa-bars:before {
  content: "\f0c9"; }

.fa-baseball-ball:before {
  content: "\f433"; }

.fa-basketball-ball:before {
  content: "\f434"; }

.fa-bath:before {
  content: "\f2cd"; }

.fa-battery-empty:before {
  content: "\f244"; }

.fa-battery-full:before {
  content: "\f240"; }

.fa-battery-half:before {
  content: "\f242"; }

.fa-battery-quarter:before {
  content: "\f243"; }

.fa-battery-three-quarters:before {
  content: "\f241"; }

.fa-battle-net:before {
  content: "\f835"; }

.fa-bed:before {
  content: "\f236"; }

.fa-beer:before {
  content: "\f0fc"; }

.fa-behance:before {
  content: "\f1b4"; }

.fa-behance-square:before {
  content: "\f1b5"; }

.fa-bell:before {
  content: "\f0f3"; }

.fa-bell-slash:before {
  content: "\f1f6"; }

.fa-bezier-curve:before {
  content: "\f55b"; }

.fa-bible:before {
  content: "\f647"; }

.fa-bicycle:before {
  content: "\f206"; }

.fa-biking:before {
  content: "\f84a"; }

.fa-bimobject:before {
  content: "\f378"; }

.fa-binoculars:before {
  content: "\f1e5"; }

.fa-biohazard:before {
  content: "\f780"; }

.fa-birthday-cake:before {
  content: "\f1fd"; }

.fa-bitbucket:before {
  content: "\f171"; }

.fa-bitcoin:before {
  content: "\f379"; }

.fa-bity:before {
  content: "\f37a"; }

.fa-black-tie:before {
  content: "\f27e"; }

.fa-blackberry:before {
  content: "\f37b"; }

.fa-blender:before {
  content: "\f517"; }

.fa-blender-phone:before {
  content: "\f6b6"; }

.fa-blind:before {
  content: "\f29d"; }

.fa-blog:before {
  content: "\f781"; }

.fa-blogger:before {
  content: "\f37c"; }

.fa-blogger-b:before {
  content: "\f37d"; }

.fa-bluetooth:before {
  content: "\f293"; }

.fa-bluetooth-b:before {
  content: "\f294"; }

.fa-bold:before {
  content: "\f032"; }

.fa-bolt:before {
  content: "\f0e7"; }

.fa-bomb:before {
  content: "\f1e2"; }

.fa-bone:before {
  content: "\f5d7"; }

.fa-bong:before {
  content: "\f55c"; }

.fa-book:before {
  content: "\f02d"; }

.fa-book-dead:before {
  content: "\f6b7"; }

.fa-book-medical:before {
  content: "\f7e6"; }

.fa-book-open:before {
  content: "\f518"; }

.fa-book-reader:before {
  content: "\f5da"; }

.fa-bookmark:before {
  content: "\f02e"; }

.fa-bootstrap:before {
  content: "\f836"; }

.fa-border-all:before {
  content: "\f84c"; }

.fa-border-none:before {
  content: "\f850"; }

.fa-border-style:before {
  content: "\f853"; }

.fa-bowling-ball:before {
  content: "\f436"; }

.fa-box:before {
  content: "\f466"; }

.fa-box-open:before {
  content: "\f49e"; }

.fa-box-tissue:before {
  content: "\e05b"; }

.fa-boxes:before {
  content: "\f468"; }

.fa-braille:before {
  content: "\f2a1"; }

.fa-brain:before {
  content: "\f5dc"; }

.fa-bread-slice:before {
  content: "\f7ec"; }

.fa-briefcase:before {
  content: "\f0b1"; }

.fa-briefcase-medical:before {
  content: "\f469"; }

.fa-broadcast-tower:before {
  content: "\f519"; }

.fa-broom:before {
  content: "\f51a"; }

.fa-brush:before {
  content: "\f55d"; }

.fa-btc:before {
  content: "\f15a"; }

.fa-buffer:before {
  content: "\f837"; }

.fa-bug:before {
  content: "\f188"; }

.fa-building:before {
  content: "\f1ad"; }

.fa-bullhorn:before {
  content: "\f0a1"; }

.fa-bullseye:before {
  content: "\f140"; }

.fa-burn:before {
  content: "\f46a"; }

.fa-buromobelexperte:before {
  content: "\f37f"; }

.fa-bus:before {
  content: "\f207"; }

.fa-bus-alt:before {
  content: "\f55e"; }

.fa-business-time:before {
  content: "\f64a"; }

.fa-buy-n-large:before {
  content: "\f8a6"; }

.fa-buysellads:before {
  content: "\f20d"; }

.fa-calculator:before {
  content: "\f1ec"; }

.fa-calendar:before {
  content: "\f133"; }

.fa-calendar-alt:before {
  content: "\f073"; }

.fa-calendar-check:before {
  content: "\f274"; }

.fa-calendar-day:before {
  content: "\f783"; }

.fa-calendar-minus:before {
  content: "\f272"; }

.fa-calendar-plus:before {
  content: "\f271"; }

.fa-calendar-times:before {
  content: "\f273"; }

.fa-calendar-week:before {
  content: "\f784"; }

.fa-camera:before {
  content: "\f030"; }

.fa-camera-retro:before {
  content: "\f083"; }

.fa-campground:before {
  content: "\f6bb"; }

.fa-canadian-maple-leaf:before {
  content: "\f785"; }

.fa-candy-cane:before {
  content: "\f786"; }

.fa-cannabis:before {
  content: "\f55f"; }

.fa-capsules:before {
  content: "\f46b"; }

.fa-car:before {
  content: "\f1b9"; }

.fa-car-alt:before {
  content: "\f5de"; }

.fa-car-battery:before {
  content: "\f5df"; }

.fa-car-crash:before {
  content: "\f5e1"; }

.fa-car-side:before {
  content: "\f5e4"; }

.fa-caravan:before {
  content: "\f8ff"; }

.fa-caret-down:before {
  content: "\f0d7"; }

.fa-caret-left:before {
  content: "\f0d9"; }

.fa-caret-right:before {
  content: "\f0da"; }

.fa-caret-square-down:before {
  content: "\f150"; }

.fa-caret-square-left:before {
  content: "\f191"; }

.fa-caret-square-right:before {
  content: "\f152"; }

.fa-caret-square-up:before {
  content: "\f151"; }

.fa-caret-up:before {
  content: "\f0d8"; }

.fa-carrot:before {
  content: "\f787"; }

.fa-cart-arrow-down:before {
  content: "\f218"; }

.fa-cart-plus:before {
  content: "\f217"; }

.fa-cash-register:before {
  content: "\f788"; }

.fa-cat:before {
  content: "\f6be"; }

.fa-cc-amazon-pay:before {
  content: "\f42d"; }

.fa-cc-amex:before {
  content: "\f1f3"; }

.fa-cc-apple-pay:before {
  content: "\f416"; }

.fa-cc-diners-club:before {
  content: "\f24c"; }

.fa-cc-discover:before {
  content: "\f1f2"; }

.fa-cc-jcb:before {
  content: "\f24b"; }

.fa-cc-mastercard:before {
  content: "\f1f1"; }

.fa-cc-paypal:before {
  content: "\f1f4"; }

.fa-cc-stripe:before {
  content: "\f1f5"; }

.fa-cc-visa:before {
  content: "\f1f0"; }

.fa-centercode:before {
  content: "\f380"; }

.fa-centos:before {
  content: "\f789"; }

.fa-certificate:before {
  content: "\f0a3"; }

.fa-chair:before {
  content: "\f6c0"; }

.fa-chalkboard:before {
  content: "\f51b"; }

.fa-chalkboard-teacher:before {
  content: "\f51c"; }

.fa-charging-station:before {
  content: "\f5e7"; }

.fa-chart-area:before {
  content: "\f1fe"; }

.fa-chart-bar:before {
  content: "\f080"; }

.fa-chart-line:before {
  content: "\f201"; }

.fa-chart-pie:before {
  content: "\f200"; }

.fa-check:before {
  content: "\f00c"; }

.fa-check-circle:before {
  content: "\f058"; }

.fa-check-double:before {
  content: "\f560"; }

.fa-check-square:before {
  content: "\f14a"; }

.fa-cheese:before {
  content: "\f7ef"; }

.fa-chess:before {
  content: "\f439"; }

.fa-chess-bishop:before {
  content: "\f43a"; }

.fa-chess-board:before {
  content: "\f43c"; }

.fa-chess-king:before {
  content: "\f43f"; }

.fa-chess-knight:before {
  content: "\f441"; }

.fa-chess-pawn:before {
  content: "\f443"; }

.fa-chess-queen:before {
  content: "\f445"; }

.fa-chess-rook:before {
  content: "\f447"; }

.fa-chevron-circle-down:before {
  content: "\f13a"; }

.fa-chevron-circle-left:before {
  content: "\f137"; }

.fa-chevron-circle-right:before {
  content: "\f138"; }

.fa-chevron-circle-up:before {
  content: "\f139"; }

.fa-chevron-down:before {
  content: "\f078"; }

.fa-chevron-left:before {
  content: "\f053"; }

.fa-chevron-right:before {
  content: "\f054"; }

.fa-chevron-up:before {
  content: "\f077"; }

.fa-child:before {
  content: "\f1ae"; }

.fa-chrome:before {
  content: "\f268"; }

.fa-chromecast:before {
  content: "\f838"; }

.fa-church:before {
  content: "\f51d"; }

.fa-circle:before {
  content: "\f111"; }

.fa-circle-notch:before {
  content: "\f1ce"; }

.fa-city:before {
  content: "\f64f"; }

.fa-clinic-medical:before {
  content: "\f7f2"; }

.fa-clipboard:before {
  content: "\f328"; }

.fa-clipboard-check:before {
  content: "\f46c"; }

.fa-clipboard-list:before {
  content: "\f46d"; }

.fa-clock:before {
  content: "\f017"; }

.fa-clone:before {
  content: "\f24d"; }

.fa-closed-captioning:before {
  content: "\f20a"; }

.fa-cloud:before {
  content: "\f0c2"; }

.fa-cloud-download-alt:before {
  content: "\f381"; }

.fa-cloud-meatball:before {
  content: "\f73b"; }

.fa-cloud-moon:before {
  content: "\f6c3"; }

.fa-cloud-moon-rain:before {
  content: "\f73c"; }

.fa-cloud-rain:before {
  content: "\f73d"; }

.fa-cloud-showers-heavy:before {
  content: "\f740"; }

.fa-cloud-sun:before {
  content: "\f6c4"; }

.fa-cloud-sun-rain:before {
  content: "\f743"; }

.fa-cloud-upload-alt:before {
  content: "\f382"; }

.fa-cloudflare:before {
  content: "\e07d"; }

.fa-cloudscale:before {
  content: "\f383"; }

.fa-cloudsmith:before {
  content: "\f384"; }

.fa-cloudversify:before {
  content: "\f385"; }

.fa-cocktail:before {
  content: "\f561"; }

.fa-code:before {
  content: "\f121"; }

.fa-code-branch:before {
  content: "\f126"; }

.fa-codepen:before {
  content: "\f1cb"; }

.fa-codiepie:before {
  content: "\f284"; }

.fa-coffee:before {
  content: "\f0f4"; }

.fa-cog:before {
  content: "\f013"; }

.fa-cogs:before {
  content: "\f085"; }

.fa-coins:before {
  content: "\f51e"; }

.fa-columns:before {
  content: "\f0db"; }

.fa-comment:before {
  content: "\f075"; }

.fa-comment-alt:before {
  content: "\f27a"; }

.fa-comment-dollar:before {
  content: "\f651"; }

.fa-comment-dots:before {
  content: "\f4ad"; }

.fa-comment-medical:before {
  content: "\f7f5"; }

.fa-comment-slash:before {
  content: "\f4b3"; }

.fa-comments:before {
  content: "\f086"; }

.fa-comments-dollar:before {
  content: "\f653"; }

.fa-compact-disc:before {
  content: "\f51f"; }

.fa-compass:before {
  content: "\f14e"; }

.fa-compress:before {
  content: "\f066"; }

.fa-compress-alt:before {
  content: "\f422"; }

.fa-compress-arrows-alt:before {
  content: "\f78c"; }

.fa-concierge-bell:before {
  content: "\f562"; }

.fa-confluence:before {
  content: "\f78d"; }

.fa-connectdevelop:before {
  content: "\f20e"; }

.fa-contao:before {
  content: "\f26d"; }

.fa-cookie:before {
  content: "\f563"; }

.fa-cookie-bite:before {
  content: "\f564"; }

.fa-copy:before {
  content: "\f0c5"; }

.fa-copyright:before {
  content: "\f1f9"; }

.fa-cotton-bureau:before {
  content: "\f89e"; }

.fa-couch:before {
  content: "\f4b8"; }

.fa-cpanel:before {
  content: "\f388"; }

.fa-creative-commons:before {
  content: "\f25e"; }

.fa-creative-commons-by:before {
  content: "\f4e7"; }

.fa-creative-commons-nc:before {
  content: "\f4e8"; }

.fa-creative-commons-nc-eu:before {
  content: "\f4e9"; }

.fa-creative-commons-nc-jp:before {
  content: "\f4ea"; }

.fa-creative-commons-nd:before {
  content: "\f4eb"; }

.fa-creative-commons-pd:before {
  content: "\f4ec"; }

.fa-creative-commons-pd-alt:before {
  content: "\f4ed"; }

.fa-creative-commons-remix:before {
  content: "\f4ee"; }

.fa-creative-commons-sa:before {
  content: "\f4ef"; }

.fa-creative-commons-sampling:before {
  content: "\f4f0"; }

.fa-creative-commons-sampling-plus:before {
  content: "\f4f1"; }

.fa-creative-commons-share:before {
  content: "\f4f2"; }

.fa-creative-commons-zero:before {
  content: "\f4f3"; }

.fa-credit-card:before {
  content: "\f09d"; }

.fa-critical-role:before {
  content: "\f6c9"; }

.fa-crop:before {
  content: "\f125"; }

.fa-crop-alt:before {
  content: "\f565"; }

.fa-cross:before {
  content: "\f654"; }

.fa-crosshairs:before {
  content: "\f05b"; }

.fa-crow:before {
  content: "\f520"; }

.fa-crown:before {
  content: "\f521"; }

.fa-crutch:before {
  content: "\f7f7"; }

.fa-css3:before {
  content: "\f13c"; }

.fa-css3-alt:before {
  content: "\f38b"; }

.fa-cube:before {
  content: "\f1b2"; }

.fa-cubes:before {
  content: "\f1b3"; }

.fa-cut:before {
  content: "\f0c4"; }

.fa-cuttlefish:before {
  content: "\f38c"; }

.fa-d-and-d:before {
  content: "\f38d"; }

.fa-d-and-d-beyond:before {
  content: "\f6ca"; }

.fa-dailymotion:before {
  content: "\e052"; }

.fa-dashcube:before {
  content: "\f210"; }

.fa-database:before {
  content: "\f1c0"; }

.fa-deaf:before {
  content: "\f2a4"; }

.fa-deezer:before {
  content: "\e077"; }

.fa-delicious:before {
  content: "\f1a5"; }

.fa-democrat:before {
  content: "\f747"; }

.fa-deploydog:before {
  content: "\f38e"; }

.fa-deskpro:before {
  content: "\f38f"; }

.fa-desktop:before {
  content: "\f108"; }

.fa-dev:before {
  content: "\f6cc"; }

.fa-deviantart:before {
  content: "\f1bd"; }

.fa-dharmachakra:before {
  content: "\f655"; }

.fa-dhl:before {
  content: "\f790"; }

.fa-diagnoses:before {
  content: "\f470"; }

.fa-diaspora:before {
  content: "\f791"; }

.fa-dice:before {
  content: "\f522"; }

.fa-dice-d20:before {
  content: "\f6cf"; }

.fa-dice-d6:before {
  content: "\f6d1"; }

.fa-dice-five:before {
  content: "\f523"; }

.fa-dice-four:before {
  content: "\f524"; }

.fa-dice-one:before {
  content: "\f525"; }

.fa-dice-six:before {
  content: "\f526"; }

.fa-dice-three:before {
  content: "\f527"; }

.fa-dice-two:before {
  content: "\f528"; }

.fa-digg:before {
  content: "\f1a6"; }

.fa-digital-ocean:before {
  content: "\f391"; }

.fa-digital-tachograph:before {
  content: "\f566"; }

.fa-directions:before {
  content: "\f5eb"; }

.fa-discord:before {
  content: "\f392"; }

.fa-discourse:before {
  content: "\f393"; }

.fa-disease:before {
  content: "\f7fa"; }

.fa-divide:before {
  content: "\f529"; }

.fa-dizzy:before {
  content: "\f567"; }

.fa-dna:before {
  content: "\f471"; }

.fa-dochub:before {
  content: "\f394"; }

.fa-docker:before {
  content: "\f395"; }

.fa-dog:before {
  content: "\f6d3"; }

.fa-dollar-sign:before {
  content: "\f155"; }

.fa-dolly:before {
  content: "\f472"; }

.fa-dolly-flatbed:before {
  content: "\f474"; }

.fa-donate:before {
  content: "\f4b9"; }

.fa-door-closed:before {
  content: "\f52a"; }

.fa-door-open:before {
  content: "\f52b"; }

.fa-dot-circle:before {
  content: "\f192"; }

.fa-dove:before {
  content: "\f4ba"; }

.fa-download:before {
  content: "\f019"; }

.fa-draft2digital:before {
  content: "\f396"; }

.fa-drafting-compass:before {
  content: "\f568"; }

.fa-dragon:before {
  content: "\f6d5"; }

.fa-draw-polygon:before {
  content: "\f5ee"; }

.fa-dribbble:before {
  content: "\f17d"; }

.fa-dribbble-square:before {
  content: "\f397"; }

.fa-dropbox:before {
  content: "\f16b"; }

.fa-drum:before {
  content: "\f569"; }

.fa-drum-steelpan:before {
  content: "\f56a"; }

.fa-drumstick-bite:before {
  content: "\f6d7"; }

.fa-drupal:before {
  content: "\f1a9"; }

.fa-dumbbell:before {
  content: "\f44b"; }

.fa-dumpster:before {
  content: "\f793"; }

.fa-dumpster-fire:before {
  content: "\f794"; }

.fa-dungeon:before {
  content: "\f6d9"; }

.fa-dyalog:before {
  content: "\f399"; }

.fa-earlybirds:before {
  content: "\f39a"; }

.fa-ebay:before {
  content: "\f4f4"; }

.fa-edge:before {
  content: "\f282"; }

.fa-edge-legacy:before {
  content: "\e078"; }

.fa-edit:before {
  content: "\f044"; }

.fa-egg:before {
  content: "\f7fb"; }

.fa-eject:before {
  content: "\f052"; }

.fa-elementor:before {
  content: "\f430"; }

.fa-ellipsis-h:before {
  content: "\f141"; }

.fa-ellipsis-v:before {
  content: "\f142"; }

.fa-ello:before {
  content: "\f5f1"; }

.fa-ember:before {
  content: "\f423"; }

.fa-empire:before {
  content: "\f1d1"; }

.fa-envelope:before {
  content: "\f0e0"; }

.fa-envelope-open:before {
  content: "\f2b6"; }

.fa-envelope-open-text:before {
  content: "\f658"; }

.fa-envelope-square:before {
  content: "\f199"; }

.fa-envira:before {
  content: "\f299"; }

.fa-equals:before {
  content: "\f52c"; }

.fa-eraser:before {
  content: "\f12d"; }

.fa-erlang:before {
  content: "\f39d"; }

.fa-ethereum:before {
  content: "\f42e"; }

.fa-ethernet:before {
  content: "\f796"; }

.fa-etsy:before {
  content: "\f2d7"; }

.fa-euro-sign:before {
  content: "\f153"; }

.fa-evernote:before {
  content: "\f839"; }

.fa-exchange-alt:before {
  content: "\f362"; }

.fa-exclamation:before {
  content: "\f12a"; }

.fa-exclamation-circle:before {
  content: "\f06a"; }

.fa-exclamation-triangle:before {
  content: "\f071"; }

.fa-expand:before {
  content: "\f065"; }

.fa-expand-alt:before {
  content: "\f424"; }

.fa-expand-arrows-alt:before {
  content: "\f31e"; }

.fa-expeditedssl:before {
  content: "\f23e"; }

.fa-external-link-alt:before {
  content: "\f35d"; }

.fa-external-link-square-alt:before {
  content: "\f360"; }

.fa-eye:before {
  content: "\f06e"; }

.fa-eye-dropper:before {
  content: "\f1fb"; }

.fa-eye-slash:before {
  content: "\f070"; }

.fa-facebook:before {
  content: "\f09a"; }

.fa-facebook-f:before {
  content: "\f39e"; }

.fa-facebook-messenger:before {
  content: "\f39f"; }

.fa-facebook-square:before {
  content: "\f082"; }

.fa-fan:before {
  content: "\f863"; }

.fa-fantasy-flight-games:before {
  content: "\f6dc"; }

.fa-fast-backward:before {
  content: "\f049"; }

.fa-fast-forward:before {
  content: "\f050"; }

.fa-faucet:before {
  content: "\e005"; }

.fa-fax:before {
  content: "\f1ac"; }

.fa-feather:before {
  content: "\f52d"; }

.fa-feather-alt:before {
  content: "\f56b"; }

.fa-fedex:before {
  content: "\f797"; }

.fa-fedora:before {
  content: "\f798"; }

.fa-female:before {
  content: "\f182"; }

.fa-fighter-jet:before {
  content: "\f0fb"; }

.fa-figma:before {
  content: "\f799"; }

.fa-file:before {
  content: "\f15b"; }

.fa-file-alt:before {
  content: "\f15c"; }

.fa-file-archive:before {
  content: "\f1c6"; }

.fa-file-audio:before {
  content: "\f1c7"; }

.fa-file-code:before {
  content: "\f1c9"; }

.fa-file-contract:before {
  content: "\f56c"; }

.fa-file-csv:before {
  content: "\f6dd"; }

.fa-file-download:before {
  content: "\f56d"; }

.fa-file-excel:before {
  content: "\f1c3"; }

.fa-file-export:before {
  content: "\f56e"; }

.fa-file-image:before {
  content: "\f1c5"; }

.fa-file-import:before {
  content: "\f56f"; }

.fa-file-invoice:before {
  content: "\f570"; }

.fa-file-invoice-dollar:before {
  content: "\f571"; }

.fa-file-medical:before {
  content: "\f477"; }

.fa-file-medical-alt:before {
  content: "\f478"; }

.fa-file-pdf:before {
  content: "\f1c1"; }

.fa-file-powerpoint:before {
  content: "\f1c4"; }

.fa-file-prescription:before {
  content: "\f572"; }

.fa-file-signature:before {
  content: "\f573"; }

.fa-file-upload:before {
  content: "\f574"; }

.fa-file-video:before {
  content: "\f1c8"; }

.fa-file-word:before {
  content: "\f1c2"; }

.fa-fill:before {
  content: "\f575"; }

.fa-fill-drip:before {
  content: "\f576"; }

.fa-film:before {
  content: "\f008"; }

.fa-filter:before {
  content: "\f0b0"; }

.fa-fingerprint:before {
  content: "\f577"; }

.fa-fire:before {
  content: "\f06d"; }

.fa-fire-alt:before {
  content: "\f7e4"; }

.fa-fire-extinguisher:before {
  content: "\f134"; }

.fa-firefox:before {
  content: "\f269"; }

.fa-firefox-browser:before {
  content: "\e007"; }

.fa-first-aid:before {
  content: "\f479"; }

.fa-first-order:before {
  content: "\f2b0"; }

.fa-first-order-alt:before {
  content: "\f50a"; }

.fa-firstdraft:before {
  content: "\f3a1"; }

.fa-fish:before {
  content: "\f578"; }

.fa-fist-raised:before {
  content: "\f6de"; }

.fa-flag:before {
  content: "\f024"; }

.fa-flag-checkered:before {
  content: "\f11e"; }

.fa-flag-usa:before {
  content: "\f74d"; }

.fa-flask:before {
  content: "\f0c3"; }

.fa-flickr:before {
  content: "\f16e"; }

.fa-flipboard:before {
  content: "\f44d"; }

.fa-flushed:before {
  content: "\f579"; }

.fa-fly:before {
  content: "\f417"; }

.fa-folder:before {
  content: "\f07b"; }

.fa-folder-minus:before {
  content: "\f65d"; }

.fa-folder-open:before {
  content: "\f07c"; }

.fa-folder-plus:before {
  content: "\f65e"; }

.fa-font:before {
  content: "\f031"; }

.fa-font-awesome:before {
  content: "\f2b4"; }

.fa-font-awesome-alt:before {
  content: "\f35c"; }

.fa-font-awesome-flag:before {
  content: "\f425"; }

.fa-font-awesome-logo-full:before {
  content: "\f4e6"; }

.fa-fonticons:before {
  content: "\f280"; }

.fa-fonticons-fi:before {
  content: "\f3a2"; }

.fa-football-ball:before {
  content: "\f44e"; }

.fa-fort-awesome:before {
  content: "\f286"; }

.fa-fort-awesome-alt:before {
  content: "\f3a3"; }

.fa-forumbee:before {
  content: "\f211"; }

.fa-forward:before {
  content: "\f04e"; }

.fa-foursquare:before {
  content: "\f180"; }

.fa-free-code-camp:before {
  content: "\f2c5"; }

.fa-freebsd:before {
  content: "\f3a4"; }

.fa-frog:before {
  content: "\f52e"; }

.fa-frown:before {
  content: "\f119"; }

.fa-frown-open:before {
  content: "\f57a"; }

.fa-fulcrum:before {
  content: "\f50b"; }

.fa-funnel-dollar:before {
  content: "\f662"; }

.fa-futbol:before {
  content: "\f1e3"; }

.fa-galactic-republic:before {
  content: "\f50c"; }

.fa-galactic-senate:before {
  content: "\f50d"; }

.fa-gamepad:before {
  content: "\f11b"; }

.fa-gas-pump:before {
  content: "\f52f"; }

.fa-gavel:before {
  content: "\f0e3"; }

.fa-gem:before {
  content: "\f3a5"; }

.fa-genderless:before {
  content: "\f22d"; }

.fa-get-pocket:before {
  content: "\f265"; }

.fa-gg:before {
  content: "\f260"; }

.fa-gg-circle:before {
  content: "\f261"; }

.fa-ghost:before {
  content: "\f6e2"; }

.fa-gift:before {
  content: "\f06b"; }

.fa-gifts:before {
  content: "\f79c"; }

.fa-git:before {
  content: "\f1d3"; }

.fa-git-alt:before {
  content: "\f841"; }

.fa-git-square:before {
  content: "\f1d2"; }

.fa-github:before {
  content: "\f09b"; }

.fa-github-alt:before {
  content: "\f113"; }

.fa-github-square:before {
  content: "\f092"; }

.fa-gitkraken:before {
  content: "\f3a6"; }

.fa-gitlab:before {
  content: "\f296"; }

.fa-gitter:before {
  content: "\f426"; }

.fa-glass-cheers:before {
  content: "\f79f"; }

.fa-glass-martini:before {
  content: "\f000"; }

.fa-glass-martini-alt:before {
  content: "\f57b"; }

.fa-glass-whiskey:before {
  content: "\f7a0"; }

.fa-glasses:before {
  content: "\f530"; }

.fa-glide:before {
  content: "\f2a5"; }

.fa-glide-g:before {
  content: "\f2a6"; }

.fa-globe:before {
  content: "\f0ac"; }

.fa-globe-africa:before {
  content: "\f57c"; }

.fa-globe-americas:before {
  content: "\f57d"; }

.fa-globe-asia:before {
  content: "\f57e"; }

.fa-globe-europe:before {
  content: "\f7a2"; }

.fa-gofore:before {
  content: "\f3a7"; }

.fa-golf-ball:before {
  content: "\f450"; }

.fa-goodreads:before {
  content: "\f3a8"; }

.fa-goodreads-g:before {
  content: "\f3a9"; }

.fa-google:before {
  content: "\f1a0"; }

.fa-google-drive:before {
  content: "\f3aa"; }

.fa-google-pay:before {
  content: "\e079"; }

.fa-google-play:before {
  content: "\f3ab"; }

.fa-google-plus:before {
  content: "\f2b3"; }

.fa-google-plus-g:before {
  content: "\f0d5"; }

.fa-google-plus-square:before {
  content: "\f0d4"; }

.fa-google-wallet:before {
  content: "\f1ee"; }

.fa-gopuram:before {
  content: "\f664"; }

.fa-graduation-cap:before {
  content: "\f19d"; }

.fa-gratipay:before {
  content: "\f184"; }

.fa-grav:before {
  content: "\f2d6"; }

.fa-greater-than:before {
  content: "\f531"; }

.fa-greater-than-equal:before {
  content: "\f532"; }

.fa-grimace:before {
  content: "\f57f"; }

.fa-grin:before {
  content: "\f580"; }

.fa-grin-alt:before {
  content: "\f581"; }

.fa-grin-beam:before {
  content: "\f582"; }

.fa-grin-beam-sweat:before {
  content: "\f583"; }

.fa-grin-hearts:before {
  content: "\f584"; }

.fa-grin-squint:before {
  content: "\f585"; }

.fa-grin-squint-tears:before {
  content: "\f586"; }

.fa-grin-stars:before {
  content: "\f587"; }

.fa-grin-tears:before {
  content: "\f588"; }

.fa-grin-tongue:before {
  content: "\f589"; }

.fa-grin-tongue-squint:before {
  content: "\f58a"; }

.fa-grin-tongue-wink:before {
  content: "\f58b"; }

.fa-grin-wink:before {
  content: "\f58c"; }

.fa-grip-horizontal:before {
  content: "\f58d"; }

.fa-grip-lines:before {
  content: "\f7a4"; }

.fa-grip-lines-vertical:before {
  content: "\f7a5"; }

.fa-grip-vertical:before {
  content: "\f58e"; }

.fa-gripfire:before {
  content: "\f3ac"; }

.fa-grunt:before {
  content: "\f3ad"; }

.fa-guilded:before {
  content: "\e07e"; }

.fa-guitar:before {
  content: "\f7a6"; }

.fa-gulp:before {
  content: "\f3ae"; }

.fa-h-square:before {
  content: "\f0fd"; }

.fa-hacker-news:before {
  content: "\f1d4"; }

.fa-hacker-news-square:before {
  content: "\f3af"; }

.fa-hackerrank:before {
  content: "\f5f7"; }

.fa-hamburger:before {
  content: "\f805"; }

.fa-hammer:before {
  content: "\f6e3"; }

.fa-hamsa:before {
  content: "\f665"; }

.fa-hand-holding:before {
  content: "\f4bd"; }

.fa-hand-holding-heart:before {
  content: "\f4be"; }

.fa-hand-holding-medical:before {
  content: "\e05c"; }

.fa-hand-holding-usd:before {
  content: "\f4c0"; }

.fa-hand-holding-water:before {
  content: "\f4c1"; }

.fa-hand-lizard:before {
  content: "\f258"; }

.fa-hand-middle-finger:before {
  content: "\f806"; }

.fa-hand-paper:before {
  content: "\f256"; }

.fa-hand-peace:before {
  content: "\f25b"; }

.fa-hand-point-down:before {
  content: "\f0a7"; }

.fa-hand-point-left:before {
  content: "\f0a5"; }

.fa-hand-point-right:before {
  content: "\f0a4"; }

.fa-hand-point-up:before {
  content: "\f0a6"; }

.fa-hand-pointer:before {
  content: "\f25a"; }

.fa-hand-rock:before {
  content: "\f255"; }

.fa-hand-scissors:before {
  content: "\f257"; }

.fa-hand-sparkles:before {
  content: "\e05d"; }

.fa-hand-spock:before {
  content: "\f259"; }

.fa-hands:before {
  content: "\f4c2"; }

.fa-hands-helping:before {
  content: "\f4c4"; }

.fa-hands-wash:before {
  content: "\e05e"; }

.fa-handshake:before {
  content: "\f2b5"; }

.fa-handshake-alt-slash:before {
  content: "\e05f"; }

.fa-handshake-slash:before {
  content: "\e060"; }

.fa-hanukiah:before {
  content: "\f6e6"; }

.fa-hard-hat:before {
  content: "\f807"; }

.fa-hashtag:before {
  content: "\f292"; }

.fa-hat-cowboy:before {
  content: "\f8c0"; }

.fa-hat-cowboy-side:before {
  content: "\f8c1"; }

.fa-hat-wizard:before {
  content: "\f6e8"; }

.fa-hdd:before {
  content: "\f0a0"; }

.fa-head-side-cough:before {
  content: "\e061"; }

.fa-head-side-cough-slash:before {
  content: "\e062"; }

.fa-head-side-mask:before {
  content: "\e063"; }

.fa-head-side-virus:before {
  content: "\e064"; }

.fa-heading:before {
  content: "\f1dc"; }

.fa-headphones:before {
  content: "\f025"; }

.fa-headphones-alt:before {
  content: "\f58f"; }

.fa-headset:before {
  content: "\f590"; }

.fa-heart:before {
  content: "\f004"; }

.fa-heart-broken:before {
  content: "\f7a9"; }

.fa-heartbeat:before {
  content: "\f21e"; }

.fa-helicopter:before {
  content: "\f533"; }

.fa-highlighter:before {
  content: "\f591"; }

.fa-hiking:before {
  content: "\f6ec"; }

.fa-hippo:before {
  content: "\f6ed"; }

.fa-hips:before {
  content: "\f452"; }

.fa-hire-a-helper:before {
  content: "\f3b0"; }

.fa-history:before {
  content: "\f1da"; }

.fa-hive:before {
  content: "\e07f"; }

.fa-hockey-puck:before {
  content: "\f453"; }

.fa-holly-berry:before {
  content: "\f7aa"; }

.fa-home:before {
  content: "\f015"; }

.fa-hooli:before {
  content: "\f427"; }

.fa-hornbill:before {
  content: "\f592"; }

.fa-horse:before {
  content: "\f6f0"; }

.fa-horse-head:before {
  content: "\f7ab"; }

.fa-hospital:before {
  content: "\f0f8"; }

.fa-hospital-alt:before {
  content: "\f47d"; }

.fa-hospital-symbol:before {
  content: "\f47e"; }

.fa-hospital-user:before {
  content: "\f80d"; }

.fa-hot-tub:before {
  content: "\f593"; }

.fa-hotdog:before {
  content: "\f80f"; }

.fa-hotel:before {
  content: "\f594"; }

.fa-hotjar:before {
  content: "\f3b1"; }

.fa-hourglass:before {
  content: "\f254"; }

.fa-hourglass-end:before {
  content: "\f253"; }

.fa-hourglass-half:before {
  content: "\f252"; }

.fa-hourglass-start:before {
  content: "\f251"; }

.fa-house-damage:before {
  content: "\f6f1"; }

.fa-house-user:before {
  content: "\e065"; }

.fa-houzz:before {
  content: "\f27c"; }

.fa-hryvnia:before {
  content: "\f6f2"; }

.fa-html5:before {
  content: "\f13b"; }

.fa-hubspot:before {
  content: "\f3b2"; }

.fa-i-cursor:before {
  content: "\f246"; }

.fa-ice-cream:before {
  content: "\f810"; }

.fa-icicles:before {
  content: "\f7ad"; }

.fa-icons:before {
  content: "\f86d"; }

.fa-id-badge:before {
  content: "\f2c1"; }

.fa-id-card:before {
  content: "\f2c2"; }

.fa-id-card-alt:before {
  content: "\f47f"; }

.fa-ideal:before {
  content: "\e013"; }

.fa-igloo:before {
  content: "\f7ae"; }

.fa-image:before {
  content: "\f03e"; }

.fa-images:before {
  content: "\f302"; }

.fa-imdb:before {
  content: "\f2d8"; }

.fa-inbox:before {
  content: "\f01c"; }

.fa-indent:before {
  content: "\f03c"; }

.fa-industry:before {
  content: "\f275"; }

.fa-infinity:before {
  content: "\f534"; }

.fa-info:before {
  content: "\f129"; }

.fa-info-circle:before {
  content: "\f05a"; }

.fa-innosoft:before {
  content: "\e080"; }

.fa-instagram:before {
  content: "\f16d"; }

.fa-instagram-square:before {
  content: "\e055"; }

.fa-instalod:before {
  content: "\e081"; }

.fa-intercom:before {
  content: "\f7af"; }

.fa-internet-explorer:before {
  content: "\f26b"; }

.fa-invision:before {
  content: "\f7b0"; }

.fa-ioxhost:before {
  content: "\f208"; }

.fa-italic:before {
  content: "\f033"; }

.fa-itch-io:before {
  content: "\f83a"; }

.fa-itunes:before {
  content: "\f3b4"; }

.fa-itunes-note:before {
  content: "\f3b5"; }

.fa-java:before {
  content: "\f4e4"; }

.fa-jedi:before {
  content: "\f669"; }

.fa-jedi-order:before {
  content: "\f50e"; }

.fa-jenkins:before {
  content: "\f3b6"; }

.fa-jira:before {
  content: "\f7b1"; }

.fa-joget:before {
  content: "\f3b7"; }

.fa-joint:before {
  content: "\f595"; }

.fa-joomla:before {
  content: "\f1aa"; }

.fa-journal-whills:before {
  content: "\f66a"; }

.fa-js:before {
  content: "\f3b8"; }

.fa-js-square:before {
  content: "\f3b9"; }

.fa-jsfiddle:before {
  content: "\f1cc"; }

.fa-kaaba:before {
  content: "\f66b"; }

.fa-kaggle:before {
  content: "\f5fa"; }

.fa-key:before {
  content: "\f084"; }

.fa-keybase:before {
  content: "\f4f5"; }

.fa-keyboard:before {
  content: "\f11c"; }

.fa-keycdn:before {
  content: "\f3ba"; }

.fa-khanda:before {
  content: "\f66d"; }

.fa-kickstarter:before {
  content: "\f3bb"; }

.fa-kickstarter-k:before {
  content: "\f3bc"; }

.fa-kiss:before {
  content: "\f596"; }

.fa-kiss-beam:before {
  content: "\f597"; }

.fa-kiss-wink-heart:before {
  content: "\f598"; }

.fa-kiwi-bird:before {
  content: "\f535"; }

.fa-korvue:before {
  content: "\f42f"; }

.fa-landmark:before {
  content: "\f66f"; }

.fa-language:before {
  content: "\f1ab"; }

.fa-laptop:before {
  content: "\f109"; }

.fa-laptop-code:before {
  content: "\f5fc"; }

.fa-laptop-house:before {
  content: "\e066"; }

.fa-laptop-medical:before {
  content: "\f812"; }

.fa-laravel:before {
  content: "\f3bd"; }

.fa-lastfm:before {
  content: "\f202"; }

.fa-lastfm-square:before {
  content: "\f203"; }

.fa-laugh:before {
  content: "\f599"; }

.fa-laugh-beam:before {
  content: "\f59a"; }

.fa-laugh-squint:before {
  content: "\f59b"; }

.fa-laugh-wink:before {
  content: "\f59c"; }

.fa-layer-group:before {
  content: "\f5fd"; }

.fa-leaf:before {
  content: "\f06c"; }

.fa-leanpub:before {
  content: "\f212"; }

.fa-lemon:before {
  content: "\f094"; }

.fa-less:before {
  content: "\f41d"; }

.fa-less-than:before {
  content: "\f536"; }

.fa-less-than-equal:before {
  content: "\f537"; }

.fa-level-down-alt:before {
  content: "\f3be"; }

.fa-level-up-alt:before {
  content: "\f3bf"; }

.fa-life-ring:before {
  content: "\f1cd"; }

.fa-lightbulb:before {
  content: "\f0eb"; }

.fa-line:before {
  content: "\f3c0"; }

.fa-link:before {
  content: "\f0c1"; }

.fa-linkedin:before {
  content: "\f08c"; }

.fa-linkedin-in:before {
  content: "\f0e1"; }

.fa-linode:before {
  content: "\f2b8"; }

.fa-linux:before {
  content: "\f17c"; }

.fa-lira-sign:before {
  content: "\f195"; }

.fa-list:before {
  content: "\f03a"; }

.fa-list-alt:before {
  content: "\f022"; }

.fa-list-ol:before {
  content: "\f0cb"; }

.fa-list-ul:before {
  content: "\f0ca"; }

.fa-location-arrow:before {
  content: "\f124"; }

.fa-lock:before {
  content: "\f023"; }

.fa-lock-open:before {
  content: "\f3c1"; }

.fa-long-arrow-alt-down:before {
  content: "\f309"; }

.fa-long-arrow-alt-left:before {
  content: "\f30a"; }

.fa-long-arrow-alt-right:before {
  content: "\f30b"; }

.fa-long-arrow-alt-up:before {
  content: "\f30c"; }

.fa-low-vision:before {
  content: "\f2a8"; }

.fa-luggage-cart:before {
  content: "\f59d"; }

.fa-lungs:before {
  content: "\f604"; }

.fa-lungs-virus:before {
  content: "\e067"; }

.fa-lyft:before {
  content: "\f3c3"; }

.fa-magento:before {
  content: "\f3c4"; }

.fa-magic:before {
  content: "\f0d0"; }

.fa-magnet:before {
  content: "\f076"; }

.fa-mail-bulk:before {
  content: "\f674"; }

.fa-mailchimp:before {
  content: "\f59e"; }

.fa-male:before {
  content: "\f183"; }

.fa-mandalorian:before {
  content: "\f50f"; }

.fa-map:before {
  content: "\f279"; }

.fa-map-marked:before {
  content: "\f59f"; }

.fa-map-marked-alt:before {
  content: "\f5a0"; }

.fa-map-marker:before {
  content: "\f041"; }

.fa-map-marker-alt:before {
  content: "\f3c5"; }

.fa-map-pin:before {
  content: "\f276"; }

.fa-map-signs:before {
  content: "\f277"; }

.fa-markdown:before {
  content: "\f60f"; }

.fa-marker:before {
  content: "\f5a1"; }

.fa-mars:before {
  content: "\f222"; }

.fa-mars-double:before {
  content: "\f227"; }

.fa-mars-stroke:before {
  content: "\f229"; }

.fa-mars-stroke-h:before {
  content: "\f22b"; }

.fa-mars-stroke-v:before {
  content: "\f22a"; }

.fa-mask:before {
  content: "\f6fa"; }

.fa-mastodon:before {
  content: "\f4f6"; }

.fa-maxcdn:before {
  content: "\f136"; }

.fa-mdb:before {
  content: "\f8ca"; }

.fa-medal:before {
  content: "\f5a2"; }

.fa-medapps:before {
  content: "\f3c6"; }

.fa-medium:before {
  content: "\f23a"; }

.fa-medium-m:before {
  content: "\f3c7"; }

.fa-medkit:before {
  content: "\f0fa"; }

.fa-medrt:before {
  content: "\f3c8"; }

.fa-meetup:before {
  content: "\f2e0"; }

.fa-megaport:before {
  content: "\f5a3"; }

.fa-meh:before {
  content: "\f11a"; }

.fa-meh-blank:before {
  content: "\f5a4"; }

.fa-meh-rolling-eyes:before {
  content: "\f5a5"; }

.fa-memory:before {
  content: "\f538"; }

.fa-mendeley:before {
  content: "\f7b3"; }

.fa-menorah:before {
  content: "\f676"; }

.fa-mercury:before {
  content: "\f223"; }

.fa-meteor:before {
  content: "\f753"; }

.fa-microblog:before {
  content: "\e01a"; }

.fa-microchip:before {
  content: "\f2db"; }

.fa-microphone:before {
  content: "\f130"; }

.fa-microphone-alt:before {
  content: "\f3c9"; }

.fa-microphone-alt-slash:before {
  content: "\f539"; }

.fa-microphone-slash:before {
  content: "\f131"; }

.fa-microscope:before {
  content: "\f610"; }

.fa-microsoft:before {
  content: "\f3ca"; }

.fa-minus:before {
  content: "\f068"; }

.fa-minus-circle:before {
  content: "\f056"; }

.fa-minus-square:before {
  content: "\f146"; }

.fa-mitten:before {
  content: "\f7b5"; }

.fa-mix:before {
  content: "\f3cb"; }

.fa-mixcloud:before {
  content: "\f289"; }

.fa-mixer:before {
  content: "\e056"; }

.fa-mizuni:before {
  content: "\f3cc"; }

.fa-mobile:before {
  content: "\f10b"; }

.fa-mobile-alt:before {
  content: "\f3cd"; }

.fa-modx:before {
  content: "\f285"; }

.fa-monero:before {
  content: "\f3d0"; }

.fa-money-bill:before {
  content: "\f0d6"; }

.fa-money-bill-alt:before {
  content: "\f3d1"; }

.fa-money-bill-wave:before {
  content: "\f53a"; }

.fa-money-bill-wave-alt:before {
  content: "\f53b"; }

.fa-money-check:before {
  content: "\f53c"; }

.fa-money-check-alt:before {
  content: "\f53d"; }

.fa-monument:before {
  content: "\f5a6"; }

.fa-moon:before {
  content: "\f186"; }

.fa-mortar-pestle:before {
  content: "\f5a7"; }

.fa-mosque:before {
  content: "\f678"; }

.fa-motorcycle:before {
  content: "\f21c"; }

.fa-mountain:before {
  content: "\f6fc"; }

.fa-mouse:before {
  content: "\f8cc"; }

.fa-mouse-pointer:before {
  content: "\f245"; }

.fa-mug-hot:before {
  content: "\f7b6"; }

.fa-music:before {
  content: "\f001"; }

.fa-napster:before {
  content: "\f3d2"; }

.fa-neos:before {
  content: "\f612"; }

.fa-network-wired:before {
  content: "\f6ff"; }

.fa-neuter:before {
  content: "\f22c"; }

.fa-newspaper:before {
  content: "\f1ea"; }

.fa-nimblr:before {
  content: "\f5a8"; }

.fa-node:before {
  content: "\f419"; }

.fa-node-js:before {
  content: "\f3d3"; }

.fa-not-equal:before {
  content: "\f53e"; }

.fa-notes-medical:before {
  content: "\f481"; }

.fa-npm:before {
  content: "\f3d4"; }

.fa-ns8:before {
  content: "\f3d5"; }

.fa-nutritionix:before {
  content: "\f3d6"; }

.fa-object-group:before {
  content: "\f247"; }

.fa-object-ungroup:before {
  content: "\f248"; }

.fa-octopus-deploy:before {
  content: "\e082"; }

.fa-odnoklassniki:before {
  content: "\f263"; }

.fa-odnoklassniki-square:before {
  content: "\f264"; }

.fa-oil-can:before {
  content: "\f613"; }

.fa-old-republic:before {
  content: "\f510"; }

.fa-om:before {
  content: "\f679"; }

.fa-opencart:before {
  content: "\f23d"; }

.fa-openid:before {
  content: "\f19b"; }

.fa-opera:before {
  content: "\f26a"; }

.fa-optin-monster:before {
  content: "\f23c"; }

.fa-orcid:before {
  content: "\f8d2"; }

.fa-osi:before {
  content: "\f41a"; }

.fa-otter:before {
  content: "\f700"; }

.fa-outdent:before {
  content: "\f03b"; }

.fa-page4:before {
  content: "\f3d7"; }

.fa-pagelines:before {
  content: "\f18c"; }

.fa-pager:before {
  content: "\f815"; }

.fa-paint-brush:before {
  content: "\f1fc"; }

.fa-paint-roller:before {
  content: "\f5aa"; }

.fa-palette:before {
  content: "\f53f"; }

.fa-palfed:before {
  content: "\f3d8"; }

.fa-pallet:before {
  content: "\f482"; }

.fa-paper-plane:before {
  content: "\f1d8"; }

.fa-paperclip:before {
  content: "\f0c6"; }

.fa-parachute-box:before {
  content: "\f4cd"; }

.fa-paragraph:before {
  content: "\f1dd"; }

.fa-parking:before {
  content: "\f540"; }

.fa-passport:before {
  content: "\f5ab"; }

.fa-pastafarianism:before {
  content: "\f67b"; }

.fa-paste:before {
  content: "\f0ea"; }

.fa-patreon:before {
  content: "\f3d9"; }

.fa-pause:before {
  content: "\f04c"; }

.fa-pause-circle:before {
  content: "\f28b"; }

.fa-paw:before {
  content: "\f1b0"; }

.fa-paypal:before {
  content: "\f1ed"; }

.fa-peace:before {
  content: "\f67c"; }

.fa-pen:before {
  content: "\f304"; }

.fa-pen-alt:before {
  content: "\f305"; }

.fa-pen-fancy:before {
  content: "\f5ac"; }

.fa-pen-nib:before {
  content: "\f5ad"; }

.fa-pen-square:before {
  content: "\f14b"; }

.fa-pencil-alt:before {
  content: "\f303"; }

.fa-pencil-ruler:before {
  content: "\f5ae"; }

.fa-penny-arcade:before {
  content: "\f704"; }

.fa-people-arrows:before {
  content: "\e068"; }

.fa-people-carry:before {
  content: "\f4ce"; }

.fa-pepper-hot:before {
  content: "\f816"; }

.fa-perbyte:before {
  content: "\e083"; }

.fa-percent:before {
  content: "\f295"; }

.fa-percentage:before {
  content: "\f541"; }

.fa-periscope:before {
  content: "\f3da"; }

.fa-person-booth:before {
  content: "\f756"; }

.fa-phabricator:before {
  content: "\f3db"; }

.fa-phoenix-framework:before {
  content: "\f3dc"; }

.fa-phoenix-squadron:before {
  content: "\f511"; }

.fa-phone:before {
  content: "\f095"; }

.fa-phone-alt:before {
  content: "\f879"; }

.fa-phone-slash:before {
  content: "\f3dd"; }

.fa-phone-square:before {
  content: "\f098"; }

.fa-phone-square-alt:before {
  content: "\f87b"; }

.fa-phone-volume:before {
  content: "\f2a0"; }

.fa-photo-video:before {
  content: "\f87c"; }

.fa-php:before {
  content: "\f457"; }

.fa-pied-piper:before {
  content: "\f2ae"; }

.fa-pied-piper-alt:before {
  content: "\f1a8"; }

.fa-pied-piper-hat:before {
  content: "\f4e5"; }

.fa-pied-piper-pp:before {
  content: "\f1a7"; }

.fa-pied-piper-square:before {
  content: "\e01e"; }

.fa-piggy-bank:before {
  content: "\f4d3"; }

.fa-pills:before {
  content: "\f484"; }

.fa-pinterest:before {
  content: "\f0d2"; }

.fa-pinterest-p:before {
  content: "\f231"; }

.fa-pinterest-square:before {
  content: "\f0d3"; }

.fa-pizza-slice:before {
  content: "\f818"; }

.fa-place-of-worship:before {
  content: "\f67f"; }

.fa-plane:before {
  content: "\f072"; }

.fa-plane-arrival:before {
  content: "\f5af"; }

.fa-plane-departure:before {
  content: "\f5b0"; }

.fa-plane-slash:before {
  content: "\e069"; }

.fa-play:before {
  content: "\f04b"; }

.fa-play-circle:before {
  content: "\f144"; }

.fa-playstation:before {
  content: "\f3df"; }

.fa-plug:before {
  content: "\f1e6"; }

.fa-plus:before {
  content: "\f067"; }

.fa-plus-circle:before {
  content: "\f055"; }

.fa-plus-square:before {
  content: "\f0fe"; }

.fa-podcast:before {
  content: "\f2ce"; }

.fa-poll:before {
  content: "\f681"; }

.fa-poll-h:before {
  content: "\f682"; }

.fa-poo:before {
  content: "\f2fe"; }

.fa-poo-storm:before {
  content: "\f75a"; }

.fa-poop:before {
  content: "\f619"; }

.fa-portrait:before {
  content: "\f3e0"; }

.fa-pound-sign:before {
  content: "\f154"; }

.fa-power-off:before {
  content: "\f011"; }

.fa-pray:before {
  content: "\f683"; }

.fa-praying-hands:before {
  content: "\f684"; }

.fa-prescription:before {
  content: "\f5b1"; }

.fa-prescription-bottle:before {
  content: "\f485"; }

.fa-prescription-bottle-alt:before {
  content: "\f486"; }

.fa-print:before {
  content: "\f02f"; }

.fa-procedures:before {
  content: "\f487"; }

.fa-product-hunt:before {
  content: "\f288"; }

.fa-project-diagram:before {
  content: "\f542"; }

.fa-pump-medical:before {
  content: "\e06a"; }

.fa-pump-soap:before {
  content: "\e06b"; }

.fa-pushed:before {
  content: "\f3e1"; }

.fa-puzzle-piece:before {
  content: "\f12e"; }

.fa-python:before {
  content: "\f3e2"; }

.fa-qq:before {
  content: "\f1d6"; }

.fa-qrcode:before {
  content: "\f029"; }

.fa-question:before {
  content: "\f128"; }

.fa-question-circle:before {
  content: "\f059"; }

.fa-quidditch:before {
  content: "\f458"; }

.fa-quinscape:before {
  content: "\f459"; }

.fa-quora:before {
  content: "\f2c4"; }

.fa-quote-left:before {
  content: "\f10d"; }

.fa-quote-right:before {
  content: "\f10e"; }

.fa-quran:before {
  content: "\f687"; }

.fa-r-project:before {
  content: "\f4f7"; }

.fa-radiation:before {
  content: "\f7b9"; }

.fa-radiation-alt:before {
  content: "\f7ba"; }

.fa-rainbow:before {
  content: "\f75b"; }

.fa-random:before {
  content: "\f074"; }

.fa-raspberry-pi:before {
  content: "\f7bb"; }

.fa-ravelry:before {
  content: "\f2d9"; }

.fa-react:before {
  content: "\f41b"; }

.fa-reacteurope:before {
  content: "\f75d"; }

.fa-readme:before {
  content: "\f4d5"; }

.fa-rebel:before {
  content: "\f1d0"; }

.fa-receipt:before {
  content: "\f543"; }

.fa-record-vinyl:before {
  content: "\f8d9"; }

.fa-recycle:before {
  content: "\f1b8"; }

.fa-red-river:before {
  content: "\f3e3"; }

.fa-reddit:before {
  content: "\f1a1"; }

.fa-reddit-alien:before {
  content: "\f281"; }

.fa-reddit-square:before {
  content: "\f1a2"; }

.fa-redhat:before {
  content: "\f7bc"; }

.fa-redo:before {
  content: "\f01e"; }

.fa-redo-alt:before {
  content: "\f2f9"; }

.fa-registered:before {
  content: "\f25d"; }

.fa-remove-format:before {
  content: "\f87d"; }

.fa-renren:before {
  content: "\f18b"; }

.fa-reply:before {
  content: "\f3e5"; }

.fa-reply-all:before {
  content: "\f122"; }

.fa-replyd:before {
  content: "\f3e6"; }

.fa-republican:before {
  content: "\f75e"; }

.fa-researchgate:before {
  content: "\f4f8"; }

.fa-resolving:before {
  content: "\f3e7"; }

.fa-restroom:before {
  content: "\f7bd"; }

.fa-retweet:before {
  content: "\f079"; }

.fa-rev:before {
  content: "\f5b2"; }

.fa-ribbon:before {
  content: "\f4d6"; }

.fa-ring:before {
  content: "\f70b"; }

.fa-road:before {
  content: "\f018"; }

.fa-robot:before {
  content: "\f544"; }

.fa-rocket:before {
  content: "\f135"; }

.fa-rocketchat:before {
  content: "\f3e8"; }

.fa-rockrms:before {
  content: "\f3e9"; }

.fa-route:before {
  content: "\f4d7"; }

.fa-rss:before {
  content: "\f09e"; }

.fa-rss-square:before {
  content: "\f143"; }

.fa-ruble-sign:before {
  content: "\f158"; }

.fa-ruler:before {
  content: "\f545"; }

.fa-ruler-combined:before {
  content: "\f546"; }

.fa-ruler-horizontal:before {
  content: "\f547"; }

.fa-ruler-vertical:before {
  content: "\f548"; }

.fa-running:before {
  content: "\f70c"; }

.fa-rupee-sign:before {
  content: "\f156"; }

.fa-rust:before {
  content: "\e07a"; }

.fa-sad-cry:before {
  content: "\f5b3"; }

.fa-sad-tear:before {
  content: "\f5b4"; }

.fa-safari:before {
  content: "\f267"; }

.fa-salesforce:before {
  content: "\f83b"; }

.fa-sass:before {
  content: "\f41e"; }

.fa-satellite:before {
  content: "\f7bf"; }

.fa-satellite-dish:before {
  content: "\f7c0"; }

.fa-save:before {
  content: "\f0c7"; }

.fa-schlix:before {
  content: "\f3ea"; }

.fa-school:before {
  content: "\f549"; }

.fa-screwdriver:before {
  content: "\f54a"; }

.fa-scribd:before {
  content: "\f28a"; }

.fa-scroll:before {
  content: "\f70e"; }

.fa-sd-card:before {
  content: "\f7c2"; }

.fa-search:before {
  content: "\f002"; }

.fa-search-dollar:before {
  content: "\f688"; }

.fa-search-location:before {
  content: "\f689"; }

.fa-search-minus:before {
  content: "\f010"; }

.fa-search-plus:before {
  content: "\f00e"; }

.fa-searchengin:before {
  content: "\f3eb"; }

.fa-seedling:before {
  content: "\f4d8"; }

.fa-sellcast:before {
  content: "\f2da"; }

.fa-sellsy:before {
  content: "\f213"; }

.fa-server:before {
  content: "\f233"; }

.fa-servicestack:before {
  content: "\f3ec"; }

.fa-shapes:before {
  content: "\f61f"; }

.fa-share:before {
  content: "\f064"; }

.fa-share-alt:before {
  content: "\f1e0"; }

.fa-share-alt-square:before {
  content: "\f1e1"; }

.fa-share-square:before {
  content: "\f14d"; }

.fa-shekel-sign:before {
  content: "\f20b"; }

.fa-shield-alt:before {
  content: "\f3ed"; }

.fa-shield-virus:before {
  content: "\e06c"; }

.fa-ship:before {
  content: "\f21a"; }

.fa-shipping-fast:before {
  content: "\f48b"; }

.fa-shirtsinbulk:before {
  content: "\f214"; }

.fa-shoe-prints:before {
  content: "\f54b"; }

.fa-shopify:before {
  content: "\e057"; }

.fa-shopping-bag:before {
  content: "\f290"; }

.fa-shopping-basket:before {
  content: "\f291"; }

.fa-shopping-cart:before {
  content: "\f07a"; }

.fa-shopware:before {
  content: "\f5b5"; }

.fa-shower:before {
  content: "\f2cc"; }

.fa-shuttle-van:before {
  content: "\f5b6"; }

.fa-sign:before {
  content: "\f4d9"; }

.fa-sign-in-alt:before {
  content: "\f2f6"; }

.fa-sign-language:before {
  content: "\f2a7"; }

.fa-sign-out-alt:before {
  content: "\f2f5"; }

.fa-signal:before {
  content: "\f012"; }

.fa-signature:before {
  content: "\f5b7"; }

.fa-sim-card:before {
  content: "\f7c4"; }

.fa-simplybuilt:before {
  content: "\f215"; }

.fa-sink:before {
  content: "\e06d"; }

.fa-sistrix:before {
  content: "\f3ee"; }

.fa-sitemap:before {
  content: "\f0e8"; }

.fa-sith:before {
  content: "\f512"; }

.fa-skating:before {
  content: "\f7c5"; }

.fa-sketch:before {
  content: "\f7c6"; }

.fa-skiing:before {
  content: "\f7c9"; }

.fa-skiing-nordic:before {
  content: "\f7ca"; }

.fa-skull:before {
  content: "\f54c"; }

.fa-skull-crossbones:before {
  content: "\f714"; }

.fa-skyatlas:before {
  content: "\f216"; }

.fa-skype:before {
  content: "\f17e"; }

.fa-slack:before {
  content: "\f198"; }

.fa-slack-hash:before {
  content: "\f3ef"; }

.fa-slash:before {
  content: "\f715"; }

.fa-sleigh:before {
  content: "\f7cc"; }

.fa-sliders-h:before {
  content: "\f1de"; }

.fa-slideshare:before {
  content: "\f1e7"; }

.fa-smile:before {
  content: "\f118"; }

.fa-smile-beam:before {
  content: "\f5b8"; }

.fa-smile-wink:before {
  content: "\f4da"; }

.fa-smog:before {
  content: "\f75f"; }

.fa-smoking:before {
  content: "\f48d"; }

.fa-smoking-ban:before {
  content: "\f54d"; }

.fa-sms:before {
  content: "\f7cd"; }

.fa-snapchat:before {
  content: "\f2ab"; }

.fa-snapchat-ghost:before {
  content: "\f2ac"; }

.fa-snapchat-square:before {
  content: "\f2ad"; }

.fa-snowboarding:before {
  content: "\f7ce"; }

.fa-snowflake:before {
  content: "\f2dc"; }

.fa-snowman:before {
  content: "\f7d0"; }

.fa-snowplow:before {
  content: "\f7d2"; }

.fa-soap:before {
  content: "\e06e"; }

.fa-socks:before {
  content: "\f696"; }

.fa-solar-panel:before {
  content: "\f5ba"; }

.fa-sort:before {
  content: "\f0dc"; }

.fa-sort-alpha-down:before {
  content: "\f15d"; }

.fa-sort-alpha-down-alt:before {
  content: "\f881"; }

.fa-sort-alpha-up:before {
  content: "\f15e"; }

.fa-sort-alpha-up-alt:before {
  content: "\f882"; }

.fa-sort-amount-down:before {
  content: "\f160"; }

.fa-sort-amount-down-alt:before {
  content: "\f884"; }

.fa-sort-amount-up:before {
  content: "\f161"; }

.fa-sort-amount-up-alt:before {
  content: "\f885"; }

.fa-sort-down:before {
  content: "\f0dd"; }

.fa-sort-numeric-down:before {
  content: "\f162"; }

.fa-sort-numeric-down-alt:before {
  content: "\f886"; }

.fa-sort-numeric-up:before {
  content: "\f163"; }

.fa-sort-numeric-up-alt:before {
  content: "\f887"; }

.fa-sort-up:before {
  content: "\f0de"; }

.fa-soundcloud:before {
  content: "\f1be"; }

.fa-sourcetree:before {
  content: "\f7d3"; }

.fa-spa:before {
  content: "\f5bb"; }

.fa-space-shuttle:before {
  content: "\f197"; }

.fa-speakap:before {
  content: "\f3f3"; }

.fa-speaker-deck:before {
  content: "\f83c"; }

.fa-spell-check:before {
  content: "\f891"; }

.fa-spider:before {
  content: "\f717"; }

.fa-spinner:before {
  content: "\f110"; }

.fa-splotch:before {
  content: "\f5bc"; }

.fa-spotify:before {
  content: "\f1bc"; }

.fa-spray-can:before {
  content: "\f5bd"; }

.fa-square:before {
  content: "\f0c8"; }

.fa-square-full:before {
  content: "\f45c"; }

.fa-square-root-alt:before {
  content: "\f698"; }

.fa-squarespace:before {
  content: "\f5be"; }

.fa-stack-exchange:before {
  content: "\f18d"; }

.fa-stack-overflow:before {
  content: "\f16c"; }

.fa-stackpath:before {
  content: "\f842"; }

.fa-stamp:before {
  content: "\f5bf"; }

.fa-star:before {
  content: "\f005"; }

.fa-star-and-crescent:before {
  content: "\f699"; }

.fa-star-half:before {
  content: "\f089"; }

.fa-star-half-alt:before {
  content: "\f5c0"; }

.fa-star-of-david:before {
  content: "\f69a"; }

.fa-star-of-life:before {
  content: "\f621"; }

.fa-staylinked:before {
  content: "\f3f5"; }

.fa-steam:before {
  content: "\f1b6"; }

.fa-steam-square:before {
  content: "\f1b7"; }

.fa-steam-symbol:before {
  content: "\f3f6"; }

.fa-step-backward:before {
  content: "\f048"; }

.fa-step-forward:before {
  content: "\f051"; }

.fa-stethoscope:before {
  content: "\f0f1"; }

.fa-sticker-mule:before {
  content: "\f3f7"; }

.fa-sticky-note:before {
  content: "\f249"; }

.fa-stop:before {
  content: "\f04d"; }

.fa-stop-circle:before {
  content: "\f28d"; }

.fa-stopwatch:before {
  content: "\f2f2"; }

.fa-stopwatch-20:before {
  content: "\e06f"; }

.fa-store:before {
  content: "\f54e"; }

.fa-store-alt:before {
  content: "\f54f"; }

.fa-store-alt-slash:before {
  content: "\e070"; }

.fa-store-slash:before {
  content: "\e071"; }

.fa-strava:before {
  content: "\f428"; }

.fa-stream:before {
  content: "\f550"; }

.fa-street-view:before {
  content: "\f21d"; }

.fa-strikethrough:before {
  content: "\f0cc"; }

.fa-stripe:before {
  content: "\f429"; }

.fa-stripe-s:before {
  content: "\f42a"; }

.fa-stroopwafel:before {
  content: "\f551"; }

.fa-studiovinari:before {
  content: "\f3f8"; }

.fa-stumbleupon:before {
  content: "\f1a4"; }

.fa-stumbleupon-circle:before {
  content: "\f1a3"; }

.fa-subscript:before {
  content: "\f12c"; }

.fa-subway:before {
  content: "\f239"; }

.fa-suitcase:before {
  content: "\f0f2"; }

.fa-suitcase-rolling:before {
  content: "\f5c1"; }

.fa-sun:before {
  content: "\f185"; }

.fa-superpowers:before {
  content: "\f2dd"; }

.fa-superscript:before {
  content: "\f12b"; }

.fa-supple:before {
  content: "\f3f9"; }

.fa-surprise:before {
  content: "\f5c2"; }

.fa-suse:before {
  content: "\f7d6"; }

.fa-swatchbook:before {
  content: "\f5c3"; }

.fa-swift:before {
  content: "\f8e1"; }

.fa-swimmer:before {
  content: "\f5c4"; }

.fa-swimming-pool:before {
  content: "\f5c5"; }

.fa-symfony:before {
  content: "\f83d"; }

.fa-synagogue:before {
  content: "\f69b"; }

.fa-sync:before {
  content: "\f021"; }

.fa-sync-alt:before {
  content: "\f2f1"; }

.fa-syringe:before {
  content: "\f48e"; }

.fa-table:before {
  content: "\f0ce"; }

.fa-table-tennis:before {
  content: "\f45d"; }

.fa-tablet:before {
  content: "\f10a"; }

.fa-tablet-alt:before {
  content: "\f3fa"; }

.fa-tablets:before {
  content: "\f490"; }

.fa-tachometer-alt:before {
  content: "\f3fd"; }

.fa-tag:before {
  content: "\f02b"; }

.fa-tags:before {
  content: "\f02c"; }

.fa-tape:before {
  content: "\f4db"; }

.fa-tasks:before {
  content: "\f0ae"; }

.fa-taxi:before {
  content: "\f1ba"; }

.fa-teamspeak:before {
  content: "\f4f9"; }

.fa-teeth:before {
  content: "\f62e"; }

.fa-teeth-open:before {
  content: "\f62f"; }

.fa-telegram:before {
  content: "\f2c6"; }

.fa-telegram-plane:before {
  content: "\f3fe"; }

.fa-temperature-high:before {
  content: "\f769"; }

.fa-temperature-low:before {
  content: "\f76b"; }

.fa-tencent-weibo:before {
  content: "\f1d5"; }

.fa-tenge:before {
  content: "\f7d7"; }

.fa-terminal:before {
  content: "\f120"; }

.fa-text-height:before {
  content: "\f034"; }

.fa-text-width:before {
  content: "\f035"; }

.fa-th:before {
  content: "\f00a"; }

.fa-th-large:before {
  content: "\f009"; }

.fa-th-list:before {
  content: "\f00b"; }

.fa-the-red-yeti:before {
  content: "\f69d"; }

.fa-theater-masks:before {
  content: "\f630"; }

.fa-themeco:before {
  content: "\f5c6"; }

.fa-themeisle:before {
  content: "\f2b2"; }

.fa-thermometer:before {
  content: "\f491"; }

.fa-thermometer-empty:before {
  content: "\f2cb"; }

.fa-thermometer-full:before {
  content: "\f2c7"; }

.fa-thermometer-half:before {
  content: "\f2c9"; }

.fa-thermometer-quarter:before {
  content: "\f2ca"; }

.fa-thermometer-three-quarters:before {
  content: "\f2c8"; }

.fa-think-peaks:before {
  content: "\f731"; }

.fa-thumbs-down:before {
  content: "\f165"; }

.fa-thumbs-up:before {
  content: "\f164"; }

.fa-thumbtack:before {
  content: "\f08d"; }

.fa-ticket-alt:before {
  content: "\f3ff"; }

.fa-tiktok:before {
  content: "\e07b"; }

.fa-times:before {
  content: "\f00d"; }

.fa-times-circle:before {
  content: "\f057"; }

.fa-tint:before {
  content: "\f043"; }

.fa-tint-slash:before {
  content: "\f5c7"; }

.fa-tired:before {
  content: "\f5c8"; }

.fa-toggle-off:before {
  content: "\f204"; }

.fa-toggle-on:before {
  content: "\f205"; }

.fa-toilet:before {
  content: "\f7d8"; }

.fa-toilet-paper:before {
  content: "\f71e"; }

.fa-toilet-paper-slash:before {
  content: "\e072"; }

.fa-toolbox:before {
  content: "\f552"; }

.fa-tools:before {
  content: "\f7d9"; }

.fa-tooth:before {
  content: "\f5c9"; }

.fa-torah:before {
  content: "\f6a0"; }

.fa-torii-gate:before {
  content: "\f6a1"; }

.fa-tractor:before {
  content: "\f722"; }

.fa-trade-federation:before {
  content: "\f513"; }

.fa-trademark:before {
  content: "\f25c"; }

.fa-traffic-light:before {
  content: "\f637"; }

.fa-trailer:before {
  content: "\e041"; }

.fa-train:before {
  content: "\f238"; }

.fa-tram:before {
  content: "\f7da"; }

.fa-transgender:before {
  content: "\f224"; }

.fa-transgender-alt:before {
  content: "\f225"; }

.fa-trash:before {
  content: "\f1f8"; }

.fa-trash-alt:before {
  content: "\f2ed"; }

.fa-trash-restore:before {
  content: "\f829"; }

.fa-trash-restore-alt:before {
  content: "\f82a"; }

.fa-tree:before {
  content: "\f1bb"; }

.fa-trello:before {
  content: "\f181"; }

.fa-trophy:before {
  content: "\f091"; }

.fa-truck:before {
  content: "\f0d1"; }

.fa-truck-loading:before {
  content: "\f4de"; }

.fa-truck-monster:before {
  content: "\f63b"; }

.fa-truck-moving:before {
  content: "\f4df"; }

.fa-truck-pickup:before {
  content: "\f63c"; }

.fa-tshirt:before {
  content: "\f553"; }

.fa-tty:before {
  content: "\f1e4"; }

.fa-tumblr:before {
  content: "\f173"; }

.fa-tumblr-square:before {
  content: "\f174"; }

.fa-tv:before {
  content: "\f26c"; }

.fa-twitch:before {
  content: "\f1e8"; }

.fa-twitter:before {
  content: "\f099"; }

.fa-twitter-square:before {
  content: "\f081"; }

.fa-typo3:before {
  content: "\f42b"; }

.fa-uber:before {
  content: "\f402"; }

.fa-ubuntu:before {
  content: "\f7df"; }

.fa-uikit:before {
  content: "\f403"; }

.fa-umbraco:before {
  content: "\f8e8"; }

.fa-umbrella:before {
  content: "\f0e9"; }

.fa-umbrella-beach:before {
  content: "\f5ca"; }

.fa-uncharted:before {
  content: "\e084"; }

.fa-underline:before {
  content: "\f0cd"; }

.fa-undo:before {
  content: "\f0e2"; }

.fa-undo-alt:before {
  content: "\f2ea"; }

.fa-uniregistry:before {
  content: "\f404"; }

.fa-unity:before {
  content: "\e049"; }

.fa-universal-access:before {
  content: "\f29a"; }

.fa-university:before {
  content: "\f19c"; }

.fa-unlink:before {
  content: "\f127"; }

.fa-unlock:before {
  content: "\f09c"; }

.fa-unlock-alt:before {
  content: "\f13e"; }

.fa-unsplash:before {
  content: "\e07c"; }

.fa-untappd:before {
  content: "\f405"; }

.fa-upload:before {
  content: "\f093"; }

.fa-ups:before {
  content: "\f7e0"; }

.fa-usb:before {
  content: "\f287"; }

.fa-user:before {
  content: "\f007"; }

.fa-user-alt:before {
  content: "\f406"; }

.fa-user-alt-slash:before {
  content: "\f4fa"; }

.fa-user-astronaut:before {
  content: "\f4fb"; }

.fa-user-check:before {
  content: "\f4fc"; }

.fa-user-circle:before {
  content: "\f2bd"; }

.fa-user-clock:before {
  content: "\f4fd"; }

.fa-user-cog:before {
  content: "\f4fe"; }

.fa-user-edit:before {
  content: "\f4ff"; }

.fa-user-friends:before {
  content: "\f500"; }

.fa-user-graduate:before {
  content: "\f501"; }

.fa-user-injured:before {
  content: "\f728"; }

.fa-user-lock:before {
  content: "\f502"; }

.fa-user-md:before {
  content: "\f0f0"; }

.fa-user-minus:before {
  content: "\f503"; }

.fa-user-ninja:before {
  content: "\f504"; }

.fa-user-nurse:before {
  content: "\f82f"; }

.fa-user-plus:before {
  content: "\f234"; }

.fa-user-secret:before {
  content: "\f21b"; }

.fa-user-shield:before {
  content: "\f505"; }

.fa-user-slash:before {
  content: "\f506"; }

.fa-user-tag:before {
  content: "\f507"; }

.fa-user-tie:before {
  content: "\f508"; }

.fa-user-times:before {
  content: "\f235"; }

.fa-users:before {
  content: "\f0c0"; }

.fa-users-cog:before {
  content: "\f509"; }

.fa-users-slash:before {
  content: "\e073"; }

.fa-usps:before {
  content: "\f7e1"; }

.fa-ussunnah:before {
  content: "\f407"; }

.fa-utensil-spoon:before {
  content: "\f2e5"; }

.fa-utensils:before {
  content: "\f2e7"; }

.fa-vaadin:before {
  content: "\f408"; }

.fa-vector-square:before {
  content: "\f5cb"; }

.fa-venus:before {
  content: "\f221"; }

.fa-venus-double:before {
  content: "\f226"; }

.fa-venus-mars:before {
  content: "\f228"; }

.fa-vest:before {
  content: "\e085"; }

.fa-vest-patches:before {
  content: "\e086"; }

.fa-viacoin:before {
  content: "\f237"; }

.fa-viadeo:before {
  content: "\f2a9"; }

.fa-viadeo-square:before {
  content: "\f2aa"; }

.fa-vial:before {
  content: "\f492"; }

.fa-vials:before {
  content: "\f493"; }

.fa-viber:before {
  content: "\f409"; }

.fa-video:before {
  content: "\f03d"; }

.fa-video-slash:before {
  content: "\f4e2"; }

.fa-vihara:before {
  content: "\f6a7"; }

.fa-vimeo:before {
  content: "\f40a"; }

.fa-vimeo-square:before {
  content: "\f194"; }

.fa-vimeo-v:before {
  content: "\f27d"; }

.fa-vine:before {
  content: "\f1ca"; }

.fa-virus:before {
  content: "\e074"; }

.fa-virus-slash:before {
  content: "\e075"; }

.fa-viruses:before {
  content: "\e076"; }

.fa-vk:before {
  content: "\f189"; }

.fa-vnv:before {
  content: "\f40b"; }

.fa-voicemail:before {
  content: "\f897"; }

.fa-volleyball-ball:before {
  content: "\f45f"; }

.fa-volume-down:before {
  content: "\f027"; }

.fa-volume-mute:before {
  content: "\f6a9"; }

.fa-volume-off:before {
  content: "\f026"; }

.fa-volume-up:before {
  content: "\f028"; }

.fa-vote-yea:before {
  content: "\f772"; }

.fa-vr-cardboard:before {
  content: "\f729"; }

.fa-vuejs:before {
  content: "\f41f"; }

.fa-walking:before {
  content: "\f554"; }

.fa-wallet:before {
  content: "\f555"; }

.fa-warehouse:before {
  content: "\f494"; }

.fa-watchman-monitoring:before {
  content: "\e087"; }

.fa-water:before {
  content: "\f773"; }

.fa-wave-square:before {
  content: "\f83e"; }

.fa-waze:before {
  content: "\f83f"; }

.fa-weebly:before {
  content: "\f5cc"; }

.fa-weibo:before {
  content: "\f18a"; }

.fa-weight:before {
  content: "\f496"; }

.fa-weight-hanging:before {
  content: "\f5cd"; }

.fa-weixin:before {
  content: "\f1d7"; }

.fa-whatsapp:before {
  content: "\f232"; }

.fa-whatsapp-square:before {
  content: "\f40c"; }

.fa-wheelchair:before {
  content: "\f193"; }

.fa-whmcs:before {
  content: "\f40d"; }

.fa-wifi:before {
  content: "\f1eb"; }

.fa-wikipedia-w:before {
  content: "\f266"; }

.fa-wind:before {
  content: "\f72e"; }

.fa-window-close:before {
  content: "\f410"; }

.fa-window-maximize:before {
  content: "\f2d0"; }

.fa-window-minimize:before {
  content: "\f2d1"; }

.fa-window-restore:before {
  content: "\f2d2"; }

.fa-windows:before {
  content: "\f17a"; }

.fa-wine-bottle:before {
  content: "\f72f"; }

.fa-wine-glass:before {
  content: "\f4e3"; }

.fa-wine-glass-alt:before {
  content: "\f5ce"; }

.fa-wix:before {
  content: "\f5cf"; }

.fa-wizards-of-the-coast:before {
  content: "\f730"; }

.fa-wodu:before {
  content: "\e088"; }

.fa-wolf-pack-battalion:before {
  content: "\f514"; }

.fa-won-sign:before {
  content: "\f159"; }

.fa-wordpress:before {
  content: "\f19a"; }

.fa-wordpress-simple:before {
  content: "\f411"; }

.fa-wpbeginner:before {
  content: "\f297"; }

.fa-wpexplorer:before {
  content: "\f2de"; }

.fa-wpforms:before {
  content: "\f298"; }

.fa-wpressr:before {
  content: "\f3e4"; }

.fa-wrench:before {
  content: "\f0ad"; }

.fa-x-ray:before {
  content: "\f497"; }

.fa-xbox:before {
  content: "\f412"; }

.fa-xing:before {
  content: "\f168"; }

.fa-xing-square:before {
  content: "\f169"; }

.fa-y-combinator:before {
  content: "\f23b"; }

.fa-yahoo:before {
  content: "\f19e"; }

.fa-yammer:before {
  content: "\f840"; }

.fa-yandex:before {
  content: "\f413"; }

.fa-yandex-international:before {
  content: "\f414"; }

.fa-yarn:before {
  content: "\f7e3"; }

.fa-yelp:before {
  content: "\f1e9"; }

.fa-yen-sign:before {
  content: "\f157"; }

.fa-yin-yang:before {
  content: "\f6ad"; }

.fa-yoast:before {
  content: "\f2b1"; }

.fa-youtube:before {
  content: "\f167"; }

.fa-youtube-square:before {
  content: "\f431"; }

.fa-zhihu:before {
  content: "\f63f"; }

.sr-only {
  border: 0;
  clip: rect(0, 0, 0, 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px; }

.sr-only-focusable:active, .sr-only-focusable:focus {
  clip: auto;
  height: auto;
  margin: 0;
  overflow: visible;
  position: static;
  width: auto; }
@font-face {
  font-family: 'Font Awesome 5 Brands';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url("../webfonts/fa-brands-400.eot");
  src: url("../webfonts/fa-brands-400.eot?#iefix") format("embedded-opentype"), url("../webfonts/fa-brands-400.woff2") format("woff2"), url("../webfonts/fa-brands-400.woff") format("woff"), url("../webfonts/fa-brands-400.ttf") format("truetype"), url("../webfonts/fa-brands-400.svg#fontawesome") format("svg"); }

.fab {
  font-family: 'Font Awesome 5 Brands';
  font-weight: 400; }
@font-face {
  font-family: 'Font Awesome 5 Free';
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url("../webfonts/fa-regular-400.eot");
  src: url("../webfonts/fa-regular-400.eot?#iefix") format("embedded-opentype"), url("../webfonts/fa-regular-400.woff2") format("woff2"), url("../webfonts/fa-regular-400.woff") format("woff"), url("../webfonts/fa-regular-400.ttf") format("truetype"), url("../webfonts/fa-regular-400.svg#fontawesome") format("svg"); }

.far {
  font-family: 'Font Awesome 5 Free';
  font-weight: 400; }
@font-face {
  font-family: 'Font Awesome 5 Free';
  font-style: normal;
  font-weight: 900;
  font-display: block;
  src: url("../webfonts/fa-solid-900.eot");
  src: url("../webfonts/fa-solid-900.eot?#iefix") format("embedded-opentype"), url("../webfonts/fa-solid-900.woff2") format("woff2"), url("../webfonts/fa-solid-900.woff") format("woff"), url("../webfonts/fa-solid-900.ttf") format("truetype"), url("../webfonts/fa-solid-900.svg#fontawesome") format("svg"); }

.fa,
.fas {
  font-family: 'Font Awesome 5 Free';
  font-weight: 900; }

```

Step 4 — JS bootstrap fetch (`assets/script.js?v=<cacheverzija>`)  
- Deferred loader that imports the SFSS app, wires the YouTube hook, and registers the service worker after `load`.

```js
// script.js content
window.deferredInstallPrompt = null;

window.showPwaInstallButton = () => {
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.classList.remove('hidden');
    
    const mobileInstallBtn = document.querySelector('[data-action="install-pwa"]');
    if (mobileInstallBtn) mobileInstallBtn.classList.remove('hidden');
};

window.addEventListener('beforeinstallprompt', (e) => {
    window.deferredInstallPrompt = e;
    window.showPwaInstallButton();
    console.log(`'beforeinstallprompt' event was fired.`);
});

(async () => {
    const queryString = self.location.search;
    const params = new URLSearchParams(queryString);
    const cachesecondary = window.cacheverzija ? window.cacheverzija : "1";
    const CACHE_NAME = params.get('v') ? params.get('v') : cachesecondary; 

    // Unified entry point: Always load SFSS
    const { SFSS } = await import('./js-mod/SFSS.js?v=' + CACHE_NAME);
    window.SFSS = SFSS;
    window.app = new SFSS();
    
    window.onYouTubeIframeAPIReady = function() {
        if (window.app && window.app.mediaPlayer) {
            window.app.mediaPlayer.onYouTubeIframeAPIReady();
        }
    };

    if ('serviceWorker' in navigator) {
        const registerSW = () => {
            navigator.serviceWorker.register('./sw.js?v=' + CACHE_NAME).then(registration => {
                console.log('SW registered: ', registration);
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker == null) return;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('New content is available; please refresh.');
                            } else {
                                console.log('Content is cached for offline use.');
                            }
                        }
                    };
                };
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        };

        if (document.readyState === 'complete') {
            registerSW();
        } else {
            window.addEventListener('load', registerSW);
        }
    }

})();
```

Step 5 — Module graph fetches (triggered by the dynamic import in `assets/script.js`)  
- `assets/js-mod/SFSS.js?v=<cacheverzija>` lands first, then recursively pulls the remaining ES modules below. Browsers request them once and cache via the service worker.

5.1 `assets/js-mod/SFSS.js?v=<cacheverzija>`
- App orchestrator (constructs managers, binds UI, handles lifecycle).

```js
/**
 * SFSS.js - Main Application Controller
 * 
 * This file acts as the central router and orchestrator for the application.
 * It initializes sub-modules, manages global state, and handles high-level events.
 * 
 * HOW TO MAINTAIN:
 * - Do NOT add complex feature logic here. Create a specific Manager class (e.g., IOManager, TreatmentManager).
 * - Keep this file focused on wiring components together and managing the lifecycle (init, load, save).
 * - Use 'this.storageManager', 'this.ioManager', etc. to delegate tasks.
 */

import * as constants from './Constants.js';
import { MediaPlayer } from './MediaPlayer.js';
import { SidebarManager } from './SidebarManager.js';
import { EditorHandler } from './EditorHandler.js';
import { ScrollbarManager } from './ScrollbarManager.js';
import { StorageManager } from './StorageManager.js';
import { ReportsManager } from './ReportsManager.js';
import { PageRenderer } from './PageRenderer.js';
import { TreatmentRenderer } from './TreatmentRenderer.js';
import { CollaborationManager } from './CollaborationManager.js';
import { CollabUI } from './CollabUI.js';
import { FountainParser } from './FountainParser.js';
// New Modules
import { SettingsManager } from './SettingsManager.js';
import { TreatmentManager } from './TreatmentManager.js';
import { IOManager } from './IOManager.js';
import { PrintManager } from './PrintManager.js';

export class SFSS {
    constructor() {
        // Core DOM References
        this.editor = document.getElementById('editor-container');
        this.sidebar = document.getElementById('sidebar');
        this.topSelector = document.getElementById('top-type-selector');
        this.menuOverlay = document.getElementById('menu-overlay');
        this.pageViewContainer = document.getElementById('page-view-container');
        this.mainArea = document.getElementById('main-area');

        // Page rendering constants
        this.PAGE_HEIGHT_PX = 11 * 96;
        this.PAGE_MARGIN_TOP_PX = 1 * 96;
        this.PAGE_MARGIN_BOTTOM_PX = 1 * 96;
        this.CONTENT_HEIGHT_PX = this.PAGE_HEIGHT_PX - this.PAGE_MARGIN_TOP_PX - this.PAGE_MARGIN_BOTTOM_PX;
        this.lineHeight = 14; 

        // Responsive State
        this.sidebarMediaQuery = window.matchMedia('(max-width: 1024px)');

        // State
        this.activeScriptId = null;
        this.pageViewActive = false;
        // this.treatmentModeActive -> Moved to TreatmentManager
        this.isDirty = false;
        this.characters = new Set();
        this.meta = {
            title: '', author: '', contact: '',
            showTitlePage: true, showSceneNumbers: false, showDate: false
        };
        this.sceneMeta = {};

        this.canExit = false;

        // History
        this.history = [];
        this.historyIndex = -1;
        this.isRestoring = false;
        this.historyTimeout = null;

        // Sub-modules
        this.storageManager = new StorageManager(this);
        this.mediaPlayer = new MediaPlayer(this);
        this.sidebarManager = new SidebarManager(this);
        this.editorHandler = new EditorHandler(this);
        this.reportsManager = new ReportsManager(this);
        this.treatmentRenderer = new TreatmentRenderer(this);
        this.collaborationManager = new CollaborationManager(this);
        this.collabUI = new CollabUI(this);
        this.fountainParser = new FountainParser();
        
        // New Sub-modules
        this.settingsManager = new SettingsManager(this);
        this.treatmentManager = new TreatmentManager(this);
        this.ioManager = new IOManager(this);
        this.printManager = new PrintManager(this);

        this.ELEMENT_TYPES = constants.ELEMENT_TYPES;
        this.TYPE_LABELS = constants.TYPE_LABELS;

        this.init();
    }

    get treatmentModeActive() {
        return this.treatmentManager.isActive;
    }

    get keymap() {
        return this.settingsManager.keymap;
    }

    get shortcuts() {
        return this.settingsManager.shortcuts;
    }

    toggleLoader(show) {
        const loader = document.getElementById('app-loader');
        if (!loader) return;
        if (show) {
            loader.classList.remove('fade-out');
        } else {
            setTimeout(() => loader.classList.add('fade-out'), 300);
        }
    }

    async loadScript(scriptId, newScriptObject = null) {
        if (this.activeScriptId === scriptId && !newScriptObject) return;

        this.sidebarManager.sceneList.innerHTML = ''; // Clear old scene list immediately
        this.toggleLoader(true);
        
        return new Promise((resolve) => {
            setTimeout(async () => {
                if (this.isDirty && this.activeScriptId) {
                    await this.save();
                }
                if (this.mediaPlayer) this.mediaPlayer.reset();

                let script;
                if (newScriptObject) {
                    script = newScriptObject;
                } else {
                    script = await this.storageManager.getScript(scriptId);
                }        

                if (!script) {
                    console.error(`Script with ID ${scriptId} not found.`);
                    const fallbackScript = this.storageManager.createNewScript();
                    delete fallbackScript.isNew;
                    await this.storageManager.saveScript(fallbackScript.id, fallbackScript.content); 
                    await this.loadScript(fallbackScript.id);
                    resolve(); 
                    return;
                }

                this.activeScriptId = scriptId;
                this.storageManager.setActiveScriptId(scriptId);
                this.history = [];
                this.historyIndex = -1;
                this.isDirty = false; 

                const content = script.content;
                this.importJSON(content, true);

                // One-time cleanup for existing DOM elements (double brackets fix)
                this.cleanupParentheticals();

                await this.populateOpenMenu();
                await this.checkBackupStatus();
                this.toggleLoader(false);
                resolve();
            }, 50);
        });
    }

    cleanupParentheticals() {
        this.editor.querySelectorAll(`.${constants.ELEMENT_TYPES.PARENTHETICAL}`).forEach(block => {
            const text = block.textContent;
            if (text.startsWith('(') || text.endsWith(')')) {
                const clean = text.replace(/^\(+|\)+$/g, '').trim();
                if (clean !== text) {
                    block.textContent = clean;
                }
            }
        });
    }

    async newScreenplay() {
        if (this.isDirty && this.activeScriptId) {
            await this.save();
        }
        const newScript = this.storageManager.createNewScript();
        await this.loadScript(newScript.id, newScript);
    }

    async init() {
        this.measureLineHeight();
        this.pageRenderer = new PageRenderer(this.lineHeight);
        
        // Theme initialization logic now relies on SettingsManager (or we keep this init check here as it reads CSS/Media)
        const storedTheme = localStorage.getItem('sfss_theme');
        if (storedTheme === 'dark' || (!storedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark-mode');
        }

        this.bindEventListeners();
        this.toggleSidebar(); 

        const activeScriptId = await this.storageManager.init();
        await this.loadScript(activeScriptId);

        this.initMenu('screenplay-menu-container', 'screenplay-menu-dropdown');
        this.initMenu('documents-menu-container', 'documents-menu-dropdown');
        this.initMenu('app-menu-container', 'app-menu-dropdown');

        window.onafterprint = () => {
            const printStyle = document.getElementById('print-style');
            if (printStyle) printStyle.remove();
        };

        new ScrollbarManager('#scroll-area');
        document.querySelectorAll('.modal-body').forEach(el => new ScrollbarManager(el));

        setInterval(async () => { if (this.isDirty) await this.save(); }, 3000);

        this.sidebarManager.updateSceneList();
        this.checkMobile();
        await this.populateOpenMenu();
        await this.checkBackupStatus();
        this.checkWelcomeScreen();

        setInterval(async () => await this.checkBackupStatus(), 60000); 

        if ('launchQueue' in window) {
            console.log('File Handling API is supported.');
            launchQueue.setConsumer(async (launchParams) => {
                if (!launchParams.files || launchParams.files.length === 0) return;
                for (const fileHandle of launchParams.files) {
                    try {
                        const file = await fileHandle.getFile();
                        const fileText = await file.text();
                        // Mock file input for IOManager
                        // This part might need refactoring to separate file reading from input element
                        // For now we can just call import methods directly
                        if (file.name.endsWith('.fdx')) {
                            await this.ioManager.importFDX(fileText);
                        } else if (file.name.endsWith('.json')) {
                            await this.importJSON(JSON.parse(fileText));
                        } else {
                            this.editor.textContent = fileText;
                            this.sidebarManager.updateSceneList();
                            await this.save();
                        }
                    } catch (err) {
                        console.error('Error handling file:', err);
                        alert('Could not open file: ' + err.message);
                    }
                }
            });
        }

        const status = document.createElement("div");
        status.id = "htmlverzija";
        status.innerHTML ="<a href='https://github.com/matijarma/sfss/' target='_blank' style='color:inherit;text-decoration:none'>V. "+window.cacheverzija+"</a>";
        document.body.appendChild(status);

        this.updateToolbarButtons();

        if (window.deferredInstallPrompt) {
            window.showPwaInstallButton();
        }
        if (document.body.classList.contains('mobile-view')) {
            history.pushState({ pwa: true }, '', window.location.href);
        }

        this.toggleLoader(false);

        // Check for Auto-Join Link
        const urlParams = new URLSearchParams(window.location.search);
        const autoJoinRoom = urlParams.get('room');
        if (autoJoinRoom) {
            console.log("Auto-joining room from URL:", autoJoinRoom);
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => this.collabUI.joinFromUrl(autoJoinRoom), 500);
        }
    }

    async checkWelcomeScreen() {
        if (!document.body.classList.contains('mobile-view')) {
            document.getElementById('mobile-welcome-modal').classList.add('hidden');
            return;
        }
        const showWelcome = localStorage.getItem('sfss_show_welcome');
        // Logic specific to welcome screen
        const shouldShow = showWelcome === null || showWelcome === 'true'; 

        const sidebarToggle = document.getElementById('sidebar-welcome-toggle');
        if (sidebarToggle) sidebarToggle.checked = shouldShow;

        if (shouldShow) {
            await this.populateWelcomeScriptList();
            document.getElementById('mobile-welcome-modal').classList.remove('hidden');
            document.getElementById('welcome-startup-toggle').checked = true;
        } else {
            const blocks = this.editor.querySelectorAll('.script-line');
            const isEmpty = blocks.length === 0 || (blocks.length === 1 && !blocks[0].textContent.trim());
            const isDefaultTitle = !this.meta.title || this.meta.title === 'Untitled Screenplay' || this.meta.title === '';
            if (isEmpty && isDefaultTitle) {
                 await this.populateWelcomeScriptList();
                 document.getElementById('mobile-welcome-modal').classList.remove('hidden');
            } else {
                 document.getElementById('mobile-welcome-modal').classList.add('hidden');
            }
        }
    }

    async populateWelcomeScriptList() {
        // Reuse logic but maybe move to sidebarManager or keep here as it's a specific modal
        const container = document.getElementById('welcome-scripts-list');
        if (!container) return;
        container.innerHTML = '';
        const scripts = await this.storageManager.getAllScripts();
        const scriptIds = Object.keys(scripts).sort((a, b) => new Date(scripts[b].lastSavedAt) - new Date(scripts[a].lastSavedAt));
        if (scriptIds.length === 0) {
            container.innerHTML = '<div class="p-1 text-xs text-center opacity-50">No recent scripts found.</div>';
            return;
        }
        scriptIds.slice(0, 5).forEach(id => {
            const script = scripts[id];
            const title = script.content?.meta?.title || 'Untitled Screenplay';
            const date = new Date(script.lastSavedAt).toLocaleDateString();
            const isActive = id === this.activeScriptId;
            const item = document.createElement('div');
            item.className = 'p-1 border-bottom-light pointer hover:bg-scene-hover';
            if (isActive) item.classList.add('bg-scene-hover'); 
            item.style.fontSize = '0.8rem';
            const activeText = isActive ? ' <span class="text-accent text-xs">(Open)</span>' : '';
            item.innerHTML = `<div class="font-bold">${title}${activeText}</div><div class="text-xs opacity-50">${date}</div>`;
            item.onclick = async () => {
                document.getElementById('mobile-welcome-modal').classList.add('hidden');
                await this.loadScript(id);
            };
            container.appendChild(item);
        });
    }

    getHeaderText() {
        if (!this.meta.showDate) return '';
        let text = (this.meta.title || 'Untitled Screenplay').replace(/"/g, "'");
        text += ` / ${new Date().toLocaleDateString()}`;
        return text;
    }

    bindEventListeners() {
        this.pageViewContainer.addEventListener('mouseup', this.editorHandler.updateContext.bind(this.editorHandler));
        this.pageViewContainer.addEventListener('keyup', this.editorHandler.updateContext.bind(this.editorHandler));
        
        const autoHideHandler = () => this.checkAutoHideSidebar();
        this.editor.addEventListener('click', autoHideHandler);
        this.editor.addEventListener('keydown', autoHideHandler);
        this.editor.addEventListener('input', autoHideHandler);
        this.pageViewContainer.addEventListener('click', autoHideHandler);
        
        document.addEventListener('click', (e) => {
            if (!this.editorHandler.autoMenu.contains(e.target) && !this.editorHandler.typeMenu.contains(e.target) && !document.getElementById('icon-picker-menu').contains(e.target)) {
                 this.editorHandler.closePopups();
            }
        });

        window.addEventListener('resize', this.checkMobile.bind(this));
        this.sidebarMediaQuery.addEventListener('change', () => this.toggleSidebar());

        document.getElementById('hide-sidebar-btn').addEventListener('click', () => this.toggleSidebar(true, false));
        document.getElementById('show-sidebar-btn').addEventListener('click', () => this.toggleSidebar(false, true));
        
        document.getElementById('file-open-btn').addEventListener('click', () => document.getElementById('file-input').click());
        
        const collabBtn = document.getElementById('collab-menu-btn');
        if (collabBtn) collabBtn.addEventListener('click', () => this.collabUI.openModal());

        // IO Manager Delegations
        document.getElementById('download-json-btn').addEventListener('click', () => this.ioManager.downloadJSON());
        document.getElementById('download-fdx-btn').addEventListener('click', () => this.ioManager.downloadFDX());
        document.getElementById('download-fountain-btn').addEventListener('click', () => this.ioManager.downloadFountain());
        document.getElementById('download-text-btn').addEventListener('click', () => this.ioManager.downloadText());
        document.getElementById('print-btn').addEventListener('click', () => this.printManager.open());
        document.getElementById('file-input').addEventListener('change', (e) => this.ioManager.uploadFile(e.target));

        document.getElementById('reports-menu-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.reportsManager.open();
        });

        // Settings Manager Delegations
        document.getElementById('settings-btn').addEventListener('click', (e) => { e.preventDefault(); this.settingsManager.open(); });
        document.getElementById('settings-close-btn').addEventListener('click', () => this.settingsManager.close());
        document.getElementById('settings-save-btn').addEventListener('click', () => { this.settingsManager.save(); this.settingsManager.close(); });
        document.getElementById('theme-toggle-btn').addEventListener('click', () => this.settingsManager.toggleTheme());

        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());

        // Treatment Manager Delegations
        const treatmentSwitch = document.getElementById('treatment-mode-switch');
        if (treatmentSwitch) treatmentSwitch.addEventListener('change', () => this.treatmentManager.toggle());
        const mobileTreatmentSwitch = document.getElementById('mobile-treatment-switch');
        if (mobileTreatmentSwitch) mobileTreatmentSwitch.addEventListener('change', () => this.treatmentManager.toggle());

        document.getElementById('top-type-selector').addEventListener('change', (e) => this.editorHandler.manualTypeChangeZD(e.target.value));
        
        document.getElementById('page-view-btn').addEventListener('click', () => this.togglePageView());
        
        document.getElementById('new-screenplay-btn').addEventListener('click', () => this.newScreenplay());
        document.getElementById('install-pwa-btn').addEventListener('click', () => this.promptInstall());
        
        document.getElementById('toggle-selector-view-btn').addEventListener('click', () => this.toggleSelectorView());
        
        document.getElementById('toolbar-scene-numbers').addEventListener('click', () => {
             this.meta.showSceneNumbers = !this.meta.showSceneNumbers;
             this.persistSettings(); 
        });
        document.getElementById('toolbar-date').addEventListener('click', () => {
             this.meta.showDate = !this.meta.showDate;
             this.persistSettings();
        });

        const hzSelector = document.getElementById('horizontal-type-selector');
        hzSelector.addEventListener('click', (e) => {
            const node = e.target.closest('.hz-node');
            if (node) {
                this.editorHandler.manualTypeChangeZD(node.dataset.value);
            } else {
                this.cycleType();
            }
        });

        const savedView = localStorage.getItem('sfss_selector_view');
        if (savedView === 'horizontal') {
            document.getElementById('dropdown-selector-wrapper').classList.add('hidden');
            document.getElementById('horizontal-type-selector').classList.remove('hidden');
        }

        document.getElementById('script-meta-close-btn').addEventListener('click', () => this.sidebarManager.closeScriptMetaPopup());
        document.getElementById('script-meta-save-btn').addEventListener('click', () => this.sidebarManager.saveScriptMeta());
        document.getElementById('scene-settings-close-btn').addEventListener('click', () => this.sidebarManager.closeSceneSettings());

        document.querySelector('[data-action="new-screenplay"]').addEventListener('click', () => { this.newScreenplay(); this.sidebarManager.toggleMobileMenu(); });
        document.querySelector('[data-action="open-from-file"]').addEventListener('click', () => { document.getElementById('file-input').click(); this.sidebarManager.toggleMobileMenu(); });
        document.querySelector('[data-action="install-pwa"]').addEventListener('click', () => { this.promptInstall(); this.sidebarManager.toggleMobileMenu(); });

        document.getElementById('mobile-open-menu-toggle').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('mobile-open-menu').classList.toggle('hidden');
        });

        document.getElementById('mobile-backup-menu-toggle').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('mobile-backup-menu').classList.toggle('hidden');
            const backupMenu = document.getElementById('mobile-backup-menu');
            backupMenu.querySelector('[data-action="download-json"]').addEventListener('click', () => { this.ioManager.downloadJSON(); this.sidebarManager.toggleMobileMenu(); });
            backupMenu.querySelector('[data-action="download-fdx"]').addEventListener('click', () => { this.ioManager.downloadFDX(); this.sidebarManager.toggleMobileMenu(); });
            backupMenu.querySelector('[data-action="download-fountain"]').addEventListener('click', () => { this.ioManager.downloadFountain(); this.sidebarManager.toggleMobileMenu(); });
            backupMenu.querySelector('[data-action="download-text"]').addEventListener('click', () => { this.ioManager.downloadText(); this.sidebarManager.toggleMobileMenu(); });
        });

        // New Menu Items
        document.getElementById('help-btn').addEventListener('click', (e) => { 
            e.preventDefault(); 
            this.openHelp(); 
        });
        document.querySelector('[data-action="help"]').addEventListener('click', (e) => { 
            e.preventDefault();
            this.openHelp(); 
            this.sidebarManager.toggleMobileMenu(); 
        });
        document.getElementById('help-close-btn').addEventListener('click', () => document.getElementById('help-modal').classList.add('hidden'));

        // Mobile App Menu Toggle (Accordion)
        const appMenuToggle = document.getElementById('mobile-app-menu-toggle');
        if (appMenuToggle) {
            appMenuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const content = document.getElementById('mobile-app-menu-content');
                const icon = appMenuToggle.querySelector('i');
                content.classList.toggle('hidden');
                icon.classList.toggle('fa-bars', content.classList.contains('hidden'));
                icon.classList.toggle('fa-chevron-up', !content.classList.contains('hidden'));
            });
        }

        // Welcome Modal
        document.getElementById('welcome-new-btn').addEventListener('click', async () => {
            document.getElementById('mobile-welcome-modal').classList.add('hidden');
            await this.newScreenplay();
            if (!this.treatmentManager.isActive) this.treatmentManager.toggle();
        });
        document.getElementById('welcome-open-btn').addEventListener('click', () => {
            document.getElementById('mobile-welcome-modal').classList.add('hidden');
            document.getElementById('file-input').click();
        });
        document.getElementById('welcome-startup-toggle').addEventListener('change', (e) => {
            localStorage.setItem('sfss_show_welcome', e.target.checked);
            const sidebarToggle = document.getElementById('sidebar-welcome-toggle');
            if (sidebarToggle) sidebarToggle.checked = e.target.checked;
        });

        const sidebarWelcomeToggle = document.getElementById('sidebar-welcome-toggle');
        if (sidebarWelcomeToggle) {
             sidebarWelcomeToggle.addEventListener('change', (e) => {
                localStorage.setItem('sfss_show_welcome', e.target.checked);
                const modalToggle = document.getElementById('welcome-startup-toggle');
                if (modalToggle) modalToggle.checked = e.target.checked;
             });
        }

        // Help Tabs
        const helpTabs = document.querySelectorAll('.tab-btn');
        helpTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                // Deactivate all
                helpTabs.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                // Activate clicked
                btn.classList.add('active');
                const target = btn.dataset.tab;
                document.getElementById(target).classList.remove('hidden');
                if (target === 'help-changelog') {
                    this.loadChangelog();
                }
            });
        });

        // Welcome Modal Click-Away
        document.getElementById('mobile-welcome-modal').addEventListener('click', (e) => {
            if (e.target.id === 'mobile-welcome-modal') {
                const blocks = this.editor.querySelectorAll('.script-line');
                const isEmpty = blocks.length === 0 || (blocks.length === 1 && !blocks[0].textContent.trim());
                if (!isEmpty) {
                    document.getElementById('mobile-welcome-modal').classList.add('hidden');
                }
            }
        });

        // Global Keys & Back Navigation
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleBackOrEscape();
            }
        });
        window.addEventListener('popstate', (e) => {
            this.handleBackOrEscape(true);
        });
    }

    async loadChangelog() {
        const container = document.getElementById('help-changelog');
        if (container.dataset.loaded === 'true') return;
        try {
            const response = await fetch('changelog.html');
            if (response.ok) {
                const html = await response.text();
                const versionHeader = container.querySelector('h3');
                container.innerHTML = '';
                if (versionHeader) container.appendChild(versionHeader);
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = html;
                container.appendChild(contentDiv);
                container.dataset.loaded = 'true';
            }
        } catch (e) {
            console.error("Failed to load changelog", e);
        }
    }

    handleBackOrEscape(isPopState = false) {
        let handled = false;
        const closeIfOpen = (id) => {
            const el = document.getElementById(id);
            if (el && !el.classList.contains('hidden')) {
                el.classList.add('hidden');
                return true;
            }
            return false;
        };

        if (this.editorHandler.typeMenu.style.display !== 'none' || this.editorHandler.autoMenu.style.display !== 'none') {
            this.editorHandler.closePopups();
            handled = true;
        } else if (closeIfOpen('scene-settings-popup')) handled = true;
        else if (closeIfOpen('script-meta-popup')) handled = true;
        else if (closeIfOpen('settings-modal')) handled = true;
        else if (closeIfOpen('help-modal')) handled = true;
        else if (closeIfOpen('reports-modal')) handled = true;
        else if (this.sidebar.classList.contains('open')) {
            this.sidebarManager.toggleMobileMenu();
            handled = true;
        } else if (this.pageViewActive) {
            this.togglePageView();
            handled = true;
        }

        if (handled) {
            if (isPopState && document.body.classList.contains('mobile-view')) {
                history.pushState(null, null, location.href); 
            }
            return;
        }

        if (isPopState && document.body.classList.contains('mobile-view')) {
            if (this.canExit) {
                return;
            } else {
                this.canExit = true;
                const status = document.getElementById('save-status'); 
                const originalText = status.innerHTML;
                const originalOpacity = status.style.opacity;
                status.textContent = 'Press back again to exit';
                status.style.opacity = '1';
                history.pushState(null, null, location.pathname); 
                setTimeout(() => {
                    this.canExit = false;
                    status.style.opacity = originalOpacity;
                    setTimeout(() => status.innerHTML = originalText, 300);
                }, 2000);
            }
        }
    }

    pushHistoryState(key) {
        if (document.body.classList.contains('mobile-view')) {
            history.pushState({ modal: key }, '', window.location.href);
        }
    }

    ensureWritingMode() {
        if (this.treatmentManager.isActive) this.treatmentManager.toggle();
        if (this.pageViewActive) this.togglePageView();
    }

    openHelp() {
        document.getElementById('help-modal').classList.remove('hidden');
        this.pushHistoryState('help');
    }

    resetCycleState() {
        this.cycleState = null;
    }

    toggleSelectorView() {
        const dropdown = document.getElementById('dropdown-selector-wrapper');
        const horizontal = document.getElementById('horizontal-type-selector');
        if (dropdown.classList.contains('hidden')) {
            dropdown.classList.remove('hidden');
            horizontal.classList.add('hidden');
            localStorage.setItem('sfss_selector_view', 'dropdown');
        } else {
            dropdown.classList.add('hidden');
            horizontal.classList.remove('hidden');
            localStorage.setItem('sfss_selector_view', 'horizontal');
        }
    }

    cycleType() {
        const cycleOrder = [
            constants.ELEMENT_TYPES.SLUG,
            constants.ELEMENT_TYPES.ACTION,
            constants.ELEMENT_TYPES.CHARACTER,
            constants.ELEMENT_TYPES.PARENTHETICAL,
            constants.ELEMENT_TYPES.DIALOGUE,
            constants.ELEMENT_TYPES.TRANSITION
        ];
        const currentBlock = this.editorHandler.getCurrentBlock();
        if (!currentBlock) return;
        const currentType = this.editorHandler.getBlockType(currentBlock);
        
        if (!this.cycleState || this.cycleState.blockId !== currentBlock.dataset.lineId) {
            this.cycleState = {
                blockId: currentBlock.dataset.lineId,
                originalText: currentBlock.textContent
            };
        }
        
        const idx = cycleOrder.indexOf(currentType);
        const nextIndex = idx === -1 ? 1 : (idx + 1) % cycleOrder.length;
        const nextType = cycleOrder[nextIndex];
        
        this.editorHandler.manualTypeChangeZD(nextType);
        
        const isUppercaseType = [constants.ELEMENT_TYPES.SLUG, constants.ELEMENT_TYPES.CHARACTER, constants.ELEMENT_TYPES.TRANSITION].includes(nextType);
        if (isUppercaseType) {
            currentBlock.textContent = currentBlock.textContent.toUpperCase();
        } else {
            if (this.cycleState && this.cycleState.originalText) {
                currentBlock.textContent = this.cycleState.originalText;
            }
        }
    }

    checkShortcut(e, action) {
        return this.settingsManager.checkShortcut(e, action);
    }

    checkAutoHideSidebar() {
        if (document.body.classList.contains('mobile-view')) return;
        const isCollapsed = this.mainArea.classList.contains('sidebar-collapsed');
        if (isCollapsed && !this.mainArea.classList.contains('sidebar-manual-show')) {
            return;
        }
        const sidebarRect = this.sidebar.getBoundingClientRect();
        const contentRect = this.pageViewActive 
            ? this.pageViewContainer.querySelector('.page')?.getBoundingClientRect() 
            : this.editor.getBoundingClientRect();
        if (!contentRect) return;
        // Add buffer (e.g., 10px) to prevent sub-pixel overlap triggering hide
        if (sidebarRect.right > contentRect.left + 10) {
            this.toggleSidebar(true, false);
        }
    }

    closePopups() {
        this.editorHandler.closePopups();
        this.sidebarManager.closeSceneSettings();
        this.sidebarManager.closeScriptMetaPopup();
        this.settingsManager.close();
        document.getElementById('help-modal').classList.add('hidden');
        document.getElementById('reports-modal').classList.add('hidden');
    }

    measureLineHeight() {
        const div = document.createElement('div');
        div.className = 'script-line sc-action';
        div.textContent = 'X';
        Object.assign(div.style, { position: 'absolute', visibility: 'hidden', top: '-1000px', left: '-1000px' });
        this.editor.appendChild(div);
        this.lineHeight = div.offsetHeight > 0 ? div.offsetHeight : 14; 
        this.editor.removeChild(div);
    }

    initMenu(containerId, dropdownId) {
        const container = document.getElementById(containerId);
        const dropdown = document.getElementById(dropdownId);
        if (!container || !dropdown) return;
        let menuHideTimeout;
        const show = () => { clearTimeout(menuHideTimeout); dropdown.classList.remove('hidden'); };
        const hide = () => { menuHideTimeout = setTimeout(() => dropdown.classList.add('hidden'), 200); };
        container.addEventListener('mouseenter', show);
        container.addEventListener('mouseleave', hide);
    }

    scrollToScene(sceneId) {
        if (!sceneId) return;
        let targetElement = null;
        if (this.treatmentManager.isActive) {
            targetElement = this.editor.querySelector(`[data-scene-id="${sceneId}"]`);
        } else if (this.pageViewActive) {
            targetElement = this.pageViewContainer.querySelector(`[data-line-id="${sceneId}"]`);
        } else {
            targetElement = this.editor.querySelector(`[data-line-id="${sceneId}"]`);
        }
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.sidebarManager.highlightSidebarScene(sceneId);
        }
    }

    refreshSceneSettingsModal(sceneId) {
        if (!sceneId) return;

        const popup = document.getElementById('scene-settings-popup');
        // Only refresh if the popup is open and showing the relevant scene
        if (!popup.classList.contains('hidden') && popup.dataset.sceneId === sceneId) {
            let slugElement;
            if (this.treatmentManager.isActive) {
                // In Treatment Mode, create a mock slug from scriptData
                if (this.scriptData && this.scriptData.blocks) {
                    const slugData = this.scriptData.blocks.find(b => b.id === sceneId);
                    if (slugData) {
                        slugElement = { 
                            dataset: { lineId: sceneId }, 
                            textContent: slugData.text,
                            isMock: true 
                        };
                    }
                }
            } else {
                // In Writing Mode, find the actual DOM element
                slugElement = this.editor.querySelector(`[data-line-id="${sceneId}"]`);
            }
            
            if (slugElement) {
                this.sidebarManager.openSceneSettings(slugElement);
            }
        }
    }
    
    refreshAllViews() {
        this.sidebarManager.updateSceneList();
        this.updateSceneNumbersInEditor(); 
        if (this.pageViewActive) {
            this.paginate();
        }
        if (this.treatmentManager.isActive) {
            this.treatmentManager.refreshView();
        }
        this.refreshSceneSettingsModal(document.getElementById('scene-settings-popup').dataset.sceneId);
    }
    
    updateSceneNumbersInEditor() {
        if (this.treatmentManager.isActive) return;

        const slugs = this.editor.querySelectorAll('.sc-slug');
        let sceneChronologicalIndex = 0;
        slugs.forEach(slug => {
            sceneChronologicalIndex++;
            const id = slug.dataset.lineId;
            const meta = this.sceneMeta[id] || {};
            const displayNum = meta.number || sceneChronologicalIndex;
            slug.setAttribute('data-scene-number-display', displayNum);
            if (meta.color) {
                slug.setAttribute('data-scene-color', meta.color);
            } else {
                slug.removeAttribute('data-scene-color');
            }
        });
    }

    moveScene(index, direction) {
        this.treatmentManager.moveScene(index, direction);
    }
    
    addCharacterInTreatment(slugId, charName) {
        this.treatmentManager.addCharacter(slugId, charName);
    }

    addTransitionInTreatment(slugId) {
        this.treatmentManager.addTransition(slugId);
    }

    addSceneHeadingInTreatment(slugId) {
        this.treatmentManager.addSceneHeading(slugId);
    }

    refreshTreatmentView() {
        this.treatmentManager.refreshView();
    }

    refreshScene(sceneId) {
        if (this.treatmentManager.isActive) {
            this.treatmentRenderer.refreshScene(sceneId);
        }
    }
    
    toggleSidebar(forceCollapse, forceShow) {
        if (forceShow) {
            this.mainArea.classList.add('sidebar-manual-show');
            this.mainArea.classList.remove('sidebar-collapsed');
        } else if (forceCollapse) {
            this.mainArea.classList.remove('sidebar-manual-show');
            this.mainArea.classList.add('sidebar-collapsed');
        } else {
            this.mainArea.classList.remove('sidebar-manual-show');
            if (this.sidebarMediaQuery.matches) {
                this.mainArea.classList.add('sidebar-collapsed');
            } else {
                this.mainArea.classList.remove('sidebar-collapsed');
            }
        }
    }

    checkMobile() {
        const wasMobile = document.body.classList.contains('mobile-view');
        const isMobile = window.innerWidth < 768; 
        if (isMobile) {
            document.body.classList.add('mobile-view');
            this.editor.contentEditable = false;
            const scale = Math.min(1, (window.innerWidth - 20) / 816); 
            let style = document.getElementById('mobile-style-injection');
            if (!style) {
                style = document.createElement('style');
                style.id = 'mobile-style-injection';
                document.head.appendChild(style);
            }
            style.innerHTML = `
                .mobile-view #page-view-container .page {
                    width: 8.5in !important;
                    height: 11in !important;
                    min-height: 11in !important;
                    margin: 0 auto 1.5rem auto !important;
                    padding: 1in !important;
                    padding-left: 1.5in !important;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15) !important;
                    box-sizing: border-box !important;
                    display: block !important;
                    position: relative !important;
                }
                .mobile-view #page-view-container {
                    width: 8.5in;
                    transform: scale(${scale});
                    transform-origin: top left;
                    overflow: visible;
                    padding: 1rem 0;
                    margin-bottom: -${(1 - scale) * 100}%; 
                }
            `;
            this.editorHandler.closePopups();
            if (!wasMobile) {
                this.checkWelcomeScreen();
                if (!this.treatmentManager.isActive) {
                    this.treatmentManager.toggle();
                } else {
                    this.treatmentManager.refreshView();
                    this.updateToolbarButtons();
                }
            }
        } else {
            document.body.classList.remove('mobile-view');
            document.getElementById('mobile-welcome-modal').classList.add('hidden');
            this.editor.contentEditable = true;
            const mobileStyle = document.getElementById('mobile-style-injection');
            if (mobileStyle) mobileStyle.remove();
            if (wasMobile) {
                this.treatmentManager.refreshView();
                this.updateToolbarButtons();
            }
        }
    }

    saveState(force = false) {
        if (this.isRestoring) return;
        clearTimeout(this.historyTimeout);
        const saveFn = () => {
            if (this.historyIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIndex + 1);
            }
            const currentState = this.exportToJSONStructure();
            if (this.history.length > 0 && JSON.stringify(currentState) === JSON.stringify(this.history[this.historyIndex])) {
                return;
            }
            this.history.push(currentState);
            this.historyIndex = this.history.length - 1;
            if (this.collaborationManager && this.collaborationManager.hasBaton) {
                this.collaborationManager.sendUpdate(currentState);
            }
        };
        if (force) saveFn();
        else this.historyTimeout = setTimeout(saveFn, 500);
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.isRestoring = true;
            this.importJSON(this.history[this.historyIndex]);
            this.isRestoring = false;
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.isRestoring = true;
            this.importJSON(this.history[this.historyIndex]);
            this.isRestoring = false;
        }
    }

    getCurrentScrollElement() {
        // Logic split? Or just delegate logic inside the block?
        // Since we are refactoring, let's defer to treatmentManager if active.
        if (this.treatmentManager.isActive) {
            return this.treatmentManager.getScrollElement();
        }
        
        const scrollContainer = document.getElementById('scroll-area');
        const containerRect = scrollContainer.getBoundingClientRect();
        
        const root = this.pageViewActive ? this.pageViewContainer : this.editor;
        const lines = root.querySelectorAll('.script-line');
        for (const line of lines) {
            const rect = line.getBoundingClientRect();
            if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
                return line.dataset.lineId;
            }
        }
        return null;
    }

    restoreScrollToElement(lineId) {
        if (!lineId) return; 
        const root = this.pageViewActive ? this.pageViewContainer : this.editor;
        const target = root.querySelector(`[data-line-id="${lineId}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
    }

    isElementInViewport(el) {
        if (!el) return false;
        const scrollContainer = document.getElementById('scroll-area');
        if (!scrollContainer) return false; 
        const rect = el.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        return (
            rect.top >= containerRect.top &&
            rect.left >= containerRect.left &&
            rect.bottom <= containerRect.bottom &&
            rect.right <= containerRect.right
        );
    }

    scrollToActive() {
        const activeBlock = this.editor.querySelector('.collab-active-block');
        if (activeBlock) {
            activeBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    async persistSettings() {
        const currentTopId = this.getCurrentScrollElement();
        this.applySettings();
        localStorage.setItem('sfss_meta', JSON.stringify(this.meta));
        this.saveState(true);
        await this.save();
        if (this.pageViewActive) {
            this.paginate();
            this.restoreScrollToElement(currentTopId);
        }
        this.updateSceneNumbersInEditor(); 
    }

    applySettings() {
        document.title = this.meta.title || 'Untitled Screenplay';
        this.sidebarManager.updateSidebarHeader();
        
        this.editor.classList.toggle('show-scene-numbers', this.meta.showSceneNumbers);
        this.pageViewContainer.classList.toggle('show-scene-numbers', this.meta.showSceneNumbers);
        
        const sceneNumBtn = document.getElementById('toolbar-scene-numbers');
        const dateBtn = document.getElementById('toolbar-date');
        if(sceneNumBtn) sceneNumBtn.classList.toggle('active', this.meta.showSceneNumbers);
        if(dateBtn) dateBtn.classList.toggle('active', this.meta.showDate);
        
        const tp = document.getElementById('print-title-page');
        if (this.meta.showTitlePage) {
            tp.classList.add('visible');
            document.getElementById('tp-title').textContent = this.meta.title || 'UNTITLED SCREENPLAY';
            document.getElementById('tp-author').textContent = this.meta.author || 'Author Name';
            const contactEl = document.getElementById('tp-contact');
            contactEl.innerHTML = ''; 
            const lines = (this.meta.contact || '').split('\n');
            lines.forEach((line, index) => {
                contactEl.appendChild(document.createTextNode(line));
                if (index < lines.length - 1) {
                    contactEl.appendChild(document.createElement('br'));
                }
            });
        } else {
            tp.classList.remove('visible');
        }
        this.updateSceneNumbersInEditor(); 
    }

    updatePageCount() {
        const linesPerPage = 55;
        let totalLines = 0;
        this.editor.querySelectorAll('.script-line').forEach(block => {
            const text = block.textContent;
            const type = this.editorHandler.getBlockType(block);
            totalLines++; 
            switch (type) {
                case constants.ELEMENT_TYPES.SLUG: totalLines++; break;
                case constants.ELEMENT_TYPES.ACTION: totalLines += Math.floor(text.length / 60); break;
                case constants.ELEMENT_TYPES.DIALOGUE: totalLines += Math.floor(text.length / 35); break;
                case constants.ELEMENT_TYPES.TRANSITION: totalLines++; break;
            }
        });
        return Math.ceil(totalLines / linesPerPage) || 1;
    }

    findParentSlug(block) {
        if (!block) return null;
        if (this.pageViewActive && this.pageViewContainer.contains(block)) {
            const originalBlock = this.editor.querySelector(`[data-line-id="${block.dataset.lineId}"]`);
            return originalBlock ? this.findParentSlug(originalBlock) : null;
        }
        if (block.classList.contains(constants.ELEMENT_TYPES.SLUG)) return block;
        let prev = block.previousElementSibling;
        while (prev) {
            if (prev.classList.contains(constants.ELEMENT_TYPES.SLUG)) return prev;
            prev = prev.previousElementSibling;
        }
        return null;
    }

    getSceneElements(startSlugElement) {
        const sceneElements = [startSlugElement];
        let nextElement = startSlugElement.nextElementSibling;
        while (nextElement && !nextElement.classList.contains(constants.ELEMENT_TYPES.SLUG)) {
            if (nextElement.classList.contains('script-line')) {
                sceneElements.push(nextElement);
            }
            nextElement = nextElement.nextElementSibling;
        }
        return sceneElements;
    }

    focusEditorEnd() {
        if (document.activeElement === this.editor || this.editor.contains(document.activeElement)) return;
        const last = this.editor.lastElementChild;
        if (last) this.editorHandler.focusBlock(last); 
        else this.editorHandler.focusBlock(this.editorHandler.createBlock(constants.ELEMENT_TYPES.SLUG, 'INT. '));
    }

    promptInstall() {
        const prompt = window.deferredInstallPrompt;
        if (!prompt) return;
        prompt.prompt();
        prompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            window.deferredInstallPrompt = null; 
            const installBtn = document.getElementById('install-pwa-btn');
            if(installBtn) installBtn.classList.add('hidden');
            const mobileInstallBtn = document.querySelector('[data-action="install-pwa"]');
            if(mobileInstallBtn) mobileInstallBtn.classList.add('hidden');
        });
    }

    updateToolbarButtons() {
        const sceneNumBtn = document.getElementById('toolbar-scene-numbers');
        const dateBtn = document.getElementById('toolbar-date');
        if (this.treatmentManager.isActive) {
            if (sceneNumBtn) sceneNumBtn.style.display = 'none';
            if (dateBtn) dateBtn.style.display = 'none';
        } else {
            if (sceneNumBtn) sceneNumBtn.style.display = ''; 
            if (dateBtn) {
                dateBtn.style.display = this.pageViewActive ? '' : 'none';
                dateBtn.disabled = false; 
                dateBtn.style.opacity = '1';
            }
        }
    }

    togglePageView() {
        const topElementId = this.getCurrentScrollElement();
        this.pageViewActive = !this.pageViewActive;
        if (this.pageViewActive) {
             this.pushHistoryState('pageview');
        }
        document.getElementById('app-container').classList.toggle('page-view-active', this.pageViewActive);
        document.getElementById('page-view-btn').classList.toggle('active', this.pageViewActive);
        
        this.updateToolbarButtons();
        
        if (this.treatmentManager.isActive) return; 
        
        if (this.pageViewActive) {
            this.editor.style.display = 'none';
            document.getElementById('print-title-page').style.display = 'none';
            this.pageViewContainer.classList.remove('hidden');
            requestAnimationFrame(() => {
                this.paginate();
                if (topElementId) {
                    this.restoreScrollToElement(topElementId);
                }
            });
        } else {
            this.editor.style.display = '';
            document.getElementById('print-title-page').style.display = '';
            this.pageViewContainer.classList.add('hidden');
            if (topElementId) {
                this.restoreScrollToElement(topElementId);
            }
        }
    }

    paginate() {
        const scriptLines = Array.from(this.editor.querySelectorAll('.script-line'));
        if (scriptLines.length === 0) return;
        const sceneNumberMap = {};
        if (this.meta.showSceneNumbers) {
            Object.keys(this.sceneMeta).forEach(id => {
                if (this.sceneMeta[id].number) sceneNumberMap[id] = this.sceneMeta[id].number;
            });
        }
        const options = {
            showSceneNumbers: this.meta.showSceneNumbers,
            showPageNumbers: true,
            showDate: this.meta.showDate,
            headerText: this.getHeaderText(),
            sceneNumberMap: sceneNumberMap,
            hideFirstPageMeta: true
        };
        this.pageRenderer.render(scriptLines, this.pageViewContainer, options);
    }        

    async save() {
        const data = this.exportToJSONStructure();
        await this.storageManager.saveScript(this.activeScriptId, data);
        const status = document.getElementById('save-status');
        status.style.opacity = '1';
        setTimeout(() => status.style.opacity = '0', 2000);
        this.isDirty = false;
    }

    exportToJSONStructure(forceDOM = false) {
        if (!forceDOM && this.treatmentManager.isActive && this.scriptData) {
            this.scriptData.meta = this.meta;
            this.scriptData.sceneMeta = this.sceneMeta;
            this.scriptData.characters = Array.from(this.characters);
            return this.scriptData;
        }
        const blocks = [];
        this.editor.querySelectorAll('.script-line').forEach(node => {
            let text = node.textContent;
            const type = this.editorHandler.getBlockType(node);
            if (type === constants.ELEMENT_TYPES.PARENTHETICAL) {
                if (!text.startsWith('(')) text = '(' + text;
                if (!text.endsWith(')')) text = text + ')';
            }
            blocks.push({ type: type, text: text, id: node.dataset.lineId });
        });
        return { meta: this.meta, sceneMeta: this.sceneMeta, blocks: blocks, characters: Array.from(this.characters) };
    }

    typewriterEffect(element, text) {
        if (element._typewriterTimeout) {
            clearTimeout(element._typewriterTimeout);
        }
        let i = 0;
        const speed = 30; 
        const typeChar = () => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                element._typewriterTimeout = setTimeout(typeChar, speed);
            } else {
                element._typewriterTimeout = null;
            }
        };
        typeChar();
    }

    async importJSON(data, fromLoad = false, animate = false, activeLineId = null) {
        if (!data.blocks) return; 
        if (data.meta) {
            this.meta = { ...this.meta, ...data.meta };
        }
        if (data.sceneMeta) {
            this.sceneMeta = data.sceneMeta;
        }

        const newBlockMap = new Map(data.blocks.map(b => [b.id, b]));
        const existingBlocks = Array.from(this.editor.querySelectorAll('.script-line'));
        const existingBlockMap = new Map(existingBlocks.map(b => [b.dataset.lineId, b]));

        const prevActive = this.editor.querySelector('.collab-active-block');
        if (prevActive) prevActive.classList.remove('collab-active-block');

        existingBlocks.forEach(b => {
            if (!newBlockMap.has(b.dataset.lineId)) {
                b.remove();
            }
        });

        let previousNode = null;
        let lastChangedBlock = null;

        data.blocks.forEach(blockData => {
            let blockEl = existingBlockMap.get(blockData.id);
            if (blockEl) {
                let displayText = blockData.text;
                if (blockData.type === constants.ELEMENT_TYPES.PARENTHETICAL) {
                     displayText = displayText.replace(/^\(+|\)+$/g, '').trim();
                }

                if (blockEl.textContent !== displayText) {
                    lastChangedBlock = blockEl;
                    if (animate && displayText.startsWith(blockEl.textContent)) {
                        const suffix = displayText.substring(blockEl.textContent.length);
                        if (suffix.length > 50) {
                             if (blockEl._typewriterTimeout) clearTimeout(blockEl._typewriterTimeout);
                             blockEl.textContent = displayText;
                        } else {
                             this.typewriterEffect(blockEl, suffix);
                        }
                    } else {
                        if (blockEl._typewriterTimeout) clearTimeout(blockEl._typewriterTimeout);
                        blockEl.textContent = displayText;
                    }
                }

                const currentType = this.editorHandler.getBlockType(blockEl);
                if (currentType !== blockData.type) {
                    this.editorHandler.setBlockType(blockEl, blockData.type);
                    lastChangedBlock = blockEl;
                }

                if (previousNode) {
                    if (blockEl.previousElementSibling !== previousNode) {
                        this.editor.insertBefore(blockEl, previousNode.nextSibling);
                    }
                } else {
                    if (this.editor.firstElementChild !== blockEl) {
                        this.editor.prepend(blockEl);
                    }
                }
            } else {
                let displayText = blockData.text;
                if (blockData.type === constants.ELEMENT_TYPES.PARENTHETICAL) {
                     displayText = displayText.replace(/^\(+|\)+$/g, '').trim();
                }
                blockEl = this.editorHandler.createBlock(blockData.type, displayText);
                blockEl.dataset.lineId = blockData.id;
                
                if (previousNode) {
                    this.editor.insertBefore(blockEl, previousNode.nextSibling);
                } else {
                    this.editor.prepend(blockEl);
                }
                lastChangedBlock = blockEl; 
            }
            previousNode = blockEl;
        });

        let activeBlock = null;
        if (activeLineId) {
            activeBlock = this.editor.querySelector(`[data-line-id="${activeLineId}"]`);
        } else if (lastChangedBlock) {
            activeBlock = lastChangedBlock;
        }

        if (activeBlock) {
            activeBlock.classList.add('collab-active-block');
            if (animate && !this.isElementInViewport(activeBlock)) {
                this.scrollToActive();
            }
        }

        if (data.characters) this.characters = new Set(data.characters);
        this.applySettings();
        this.sidebarManager.updateSceneList();
        
        if (this.treatmentManager.isActive) {
             this.scriptData = data; 
             this.treatmentManager.refreshView();
        } else {
             this.mediaPlayer.updatePlaylist();
        }

        if (!fromLoad) {
            await this.save();
            this.saveState(true);
        }
    }

    async populateOpenMenu(container) {
        if (!container) {
            const list1 = document.getElementById('saved-scripts-list');
            if (list1) await this.populateOpenMenu(list1);
            const list2 = document.getElementById('mobile-saved-scripts-list');
            if (list2) await this.populateOpenMenu(list2);
            return;
        }
        container.innerHTML = '';
        const scripts = await this.storageManager.getAllScripts();
        const scriptIds = Object.keys(scripts);
        if (scriptIds.length === 0) {
            container.innerHTML = '<div class="p-1 text-xs text-center opacity-50">No recent scripts found.</div>';
            return;
        }
        scriptIds.forEach(id => {
            const script = scripts[id];
            const title = script.content?.meta?.title || 'Untitled Screenplay';
            const isActive = id === this.activeScriptId;
            const item = document.createElement('div');
            item.className = 'dropdown-item flex-justify-between-center'; 
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            if (isActive) {
                item.classList.add('dropdown-item-active');
                item.title = 'Currently open';
            }
            const titleSpan = document.createElement('span');
            titleSpan.textContent = title + (isActive ? ' (Open)' : '');
            titleSpan.style.flexGrow = '1';
            if (isActive) {
                titleSpan.classList.add('font-bold', 'text-accent');
            } else {
                titleSpan.onclick = async () => {
                    await this.loadScript(id);
                    if (document.body.classList.contains('mobile-view')) {
                        this.sidebarManager.toggleMobileMenu();
                    }
                };
            }
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.className = 'btn-icon btn-icon-faded'; 
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
                    const nextId = await this.storageManager.deleteScript(id);
                    if (this.activeScriptId === id) {
                        await this.loadScript(nextId);
                    } else {
                        await this.populateOpenMenu();
                    }
                }
            };
            item.appendChild(titleSpan);
            item.appendChild(deleteBtn);
            container.appendChild(item);
        });
    }

    async checkBackupStatus() {
        const script = await this.storageManager.getScript(this.activeScriptId);
        if (!script) return;
        const backupWarnings = [document.getElementById('backup-warning'), document.getElementById('mobile-backup-warning')];
        const thirtyMinutes = 30 * 60 * 1000;
        let timeAgo = 'a while';
        if(script.lastBackupAt) {
            const minutes = Math.floor((new Date() - new Date(script.lastBackupAt)) / 60000);
            if (minutes < 60) {
                timeAgo = `${minutes}m ago`;
            } else if (minutes < 1440) {
                timeAgo = `${Math.floor(minutes / 60)}h ago`;
            } else {
                timeAgo = `${Math.floor(minutes / 1440)}d ago`;
            }
        }
    }
}

```

5.2 `assets/js-mod/Constants.js`
- Shared enums/DOM IDs/constants.

```js
export const ELEMENT_TYPES = {
    SLUG: 'sc-slug',
    ACTION: 'sc-action',
    CHARACTER: 'sc-character',
    DIALOGUE: 'sc-dialogue',
    PARENTHETICAL: 'sc-parenthetical',
    TRANSITION: 'sc-transition'
};

export const TYPE_LABELS = {
    'sc-slug': 'Scene Heading',
    'sc-action': 'Action',
    'sc-character': 'Character',
    'sc-dialogue': 'Dialogue',
    'sc-parenthetical': 'Parenthetical',
    'sc-transition': 'Transition'
};

export const TYPE_SHORTCUTS = { 's': ELEMENT_TYPES.SLUG, 'a': ELEMENT_TYPES.ACTION, 'c': ELEMENT_TYPES.CHARACTER, 'd': ELEMENT_TYPES.DIALOGUE, 'p': ELEMENT_TYPES.PARENTHETICAL, 't': ELEMENT_TYPES.TRANSITION };

// FDX Map: SFSS Class -> FDX XML Type Attribute
export const FDX_MAP = {
    'sc-slug': 'Scene Heading',
    'sc-action': 'Action',
    'sc-character': 'Character',
    'sc-dialogue': 'Dialogue',
    'sc-parenthetical': 'Parenthetical',
    'sc-transition': 'Transition'
};

// Reverse Map: FDX Type -> SFSS Class
export const FDX_REVERSE_MAP = {
    'Scene Heading': 'sc-slug',
    'Action': 'sc-action',
    'Character': 'sc-character',
    'Dialogue': 'sc-dialogue',
    'Parenthetical': 'sc-parenthetical',
    'Transition': 'sc-transition',
    'General': 'sc-action', 
    'Shot': 'sc-action', 
    'Cast List': 'sc-action'
};

export const FORMATTING = {
    FONT_SIZE_PT: 12,
    LINE_HEIGHT_PT: 12,
    LINES_PER_INCH: 6,
    PIXELS_PER_INCH: 96, // CSS standard
    CHAR_WIDTH_INCH: 0.10
};

export const PAPER_CONFIGS = {
    US_LETTER: {
        name: "US Letter",
        cssSize: "letter",
        dimensions: { width: 8.5, height: 11.0 },
        margins: { top: 1.0, bottom: 1.0, left: 1.5, right: 1.0 },
        liveArea: { width: 6.0, height: 9.0 }
    },
    A4_EMULATION: {
        name: "A4 (US Emulation)",
        cssSize: "A4",
        dimensions: { width: 8.27, height: 11.69 },
        margins: { top: 1.0, bottom: 1.7, left: 1.5, right: 0.8 },
        liveArea: { width: 5.97, height: 8.99 }
    }
};

export const ELEMENT_INDENTS = {
    [ELEMENT_TYPES.SLUG]: { left: 0, width: '100%' },
    [ELEMENT_TYPES.ACTION]: { left: 0, width: '100%' },
    [ELEMENT_TYPES.CHARACTER]: { left: 2.2, width: 'auto' }, // Inches from margin
    [ELEMENT_TYPES.DIALOGUE]: { left: 1.0, width: 3.5 },
    [ELEMENT_TYPES.PARENTHETICAL]: { left: 1.6, width: 2.4 },
    [ELEMENT_TYPES.TRANSITION]: { left: 0, width: 'auto', align: 'right' } // Special handling
};

export const CHARACTER_SUFFIXES = [
    'V.O.',
    'O.S.',
    'O.C.',
    'CONT\'D',
    'VOICE',
    'FILTERED',
    'INTO PHONE',
    'ON PHONE',
    'PRE-LAP'
];
```

5.3 `assets/js-mod/MediaPlayer.js`
- Music/YT player logic (loads YouTube iframe API lazily only when a track exists).

```js
export class MediaPlayer {
    constructor(app) {
        this.app = app;
        this.musicPlayer = document.getElementById('music-player');
        this.playerIndicator = document.getElementById('player-scene-indicator');
        this.prevBtn = document.getElementById('player-prev');
        this.playBtn = document.getElementById('player-play');
        this.nextBtn = document.getElementById('player-next');

        this.youtubePlayer = null;
        this.playlist = [];
        this.currentTrackIndex = -1;
        this.isPlaying = false;
        this.isApiLoading = false;
        this.pendingPlay = false;

        this.initListeners();
    }

    initListeners() {
        this.prevBtn.addEventListener('click', () => this.playPrevTrack());
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.nextBtn.addEventListener('click', () => this.playNextTrack());

        this.prevBtn.addEventListener('mouseenter', () => this.showPreview('prev'));
        this.prevBtn.addEventListener('mouseleave', () => this.updatePlayerIndicator());
        this.nextBtn.addEventListener('mouseenter', () => this.showPreview('next'));
        this.nextBtn.addEventListener('mouseleave', () => this.updatePlayerIndicator());
        
        this.playerIndicator.addEventListener('click', () => {
            const index = this.currentTrackIndex !== -1 ? this.currentTrackIndex : 0;
            if (this.playlist[index]) {
                this.app.scrollToScene(this.playlist[index].sceneId);
            }
        });
    }

    onYouTubeIframeAPIReady() {
        this.youtubePlayer = new YT.Player('youtube-player-container', {
            height: '0', width: '0',
            host: 'https://www.youtube-nocookie.com',
            playerVars: { 'playsinline': 1, 'origin': window.location.origin },
            events: {
                'onReady': () => {
                    if (this.pendingPlay) {
                        this.pendingPlay = false;
                        if (this.currentTrackIndex !== -1) {
                            this._playTrackAtIndex(this.currentTrackIndex);
                        } else if (this.playlist.length > 0) {
                            this._playTrackAtIndex(0);
                        }
                    }
                },
                'onStateChange': this.onPlayerStateChange.bind(this),
                'onError': (e) => console.error('YouTube Player Error:', e.data)
            }
        });
    }

    ensureYouTubeAPILoaded() {
        if ((!window.YT || !window.YT.Player) && !this.isApiLoading) {
            this.isApiLoading = true;
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else if (window.YT && window.YT.Player && !this.youtubePlayer) {
             this.onYouTubeIframeAPIReady();
        }
    }

    onPlayerStateChange(event) {
        const playBtnIcon = this.playBtn.querySelector('i');
        if (event.data === YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            playBtnIcon.className = 'fas fa-pause';
        } else {
            this.isPlaying = false;
            playBtnIcon.className = 'fas fa-play';
        }
        if (event.data === YT.PlayerState.ENDED) {
            this.playNextTrack();
        }
        this.updatePlayerIndicator();
    }
    
    async updatePlaylist() {
        this.playlist = [];
        const slugs = this.app.editor.querySelectorAll(`.${this.app.ELEMENT_TYPES.SLUG}`);
        
        const trackPromises = Array.from(slugs).map(async (slug, index) => {
            const sceneId = slug.dataset.lineId;
            const meta = this.app.sceneMeta[sceneId];

            if (meta && meta.track) {
                const videoId = this.extractYouTubeVideoId(meta.track);
                if (videoId) {
                    // If we don't have the title, fetch it.
                    if (!meta.trackTitle || !meta.trackArtist) {
                        const fetchedMeta = await this._fetchTrackMetadata(videoId);
                        if (fetchedMeta) {
                            meta.trackTitle = fetchedMeta.title;
                            meta.trackArtist = fetchedMeta.artist;
                            // No need to save here, as it's just hydrating. Main save is elsewhere.
                        }
                    }
                    return { 
                        videoId: videoId, 
                        sceneId: sceneId,
                        sceneTitle: slug.textContent.trim() || 'UNTITLED',
                        sceneNumber: index + 1,
                        trackArtist: meta.trackArtist,
                        trackTitle: meta.trackTitle
                    };
                }
            }
            return null;
        });

        this.playlist = (await Promise.all(trackPromises)).filter(p => p !== null);

        if (this.playlist.length > 0) {
            this.musicPlayer.classList.remove('hidden');
        } else {
            this.musicPlayer.classList.add('hidden');
            this.currentTrackIndex = -1;
        }

        const isNavDisabled = this.playlist.length <= 1;
        this.prevBtn.disabled = isNavDisabled;
        this.nextBtn.disabled = isNavDisabled;

        this.updatePlayerIndicator();
        this.app.sidebarManager.updateSceneList();
    }
    
    async _fetchTrackMetadata(videoId) {
        if (!videoId) return null;
        try {
            const response = await fetch(`https://www.youtube.com/oembed?url=http%3A//youtube.com/watch%3Fv%3D${videoId}&format=json`);
            if (!response.ok) return null;
            const data = await response.json();
            return {
                title: data.title,
                artist: data.author_name
            };
        } catch (error) {
            console.error('Failed to fetch YouTube metadata:', error);
            return null;
        }
    }

    extractYouTubeVideoId(url) {
        if (!url) return null;
        try {
            const urlObj = new URL(url);
            let videoId = urlObj.hostname === 'youtu.be' 
                ? urlObj.pathname.slice(1).split('/')[0] 
                : urlObj.searchParams.get('v');
            if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return videoId;
        } catch (e) { /* not a valid URL */ }
        return null;
    }

    updatePlayerIndicator(index) {
        if (!this.playerIndicator) return;
        
        const trackIndex = (index !== undefined) ? index : this.currentTrackIndex;
        const isShowingCurrentTrack = (index === undefined) || (index === this.currentTrackIndex);
        const shouldScroll = this.isPlaying && isShowingCurrentTrack;

        if (shouldScroll) {
            this.playerIndicator.classList.add('is-playing');
        } else {
            this.playerIndicator.classList.remove('is-playing');
        }

        let text = '';
        let title = '';

        if (this.playlist.length > 0) {
            const track = this.playlist[trackIndex === -1 ? 0 : trackIndex];
            if (track) {
                const sceneInfo = `${track.sceneNumber}. ${track.sceneTitle}`;
                
                if (shouldScroll && track.trackTitle) {
                    // Playing: Show Scene Info + Track Info
                    text = `${sceneInfo} <i class="fas fa-music fa-fw scene-music-icon"></i> ${track.trackArtist} - ${track.trackTitle} &nbsp;`;
                    title = text;
                } else {
                    // Paused or Preview: Show Scene Info only
                    text = sceneInfo;
                    title = track.sceneTitle;
                }
            }
        }
        
        this.playerIndicator.innerHTML = `<span class="marquee-text">${text}</span>`;
        this.playerIndicator.title = title;
    }

    showPreview(direction) {
        if (this.playlist.length <= 1) return;
        
        let previewIndex;
        if (this.currentTrackIndex === -1) {
            if (direction === 'next') {
                previewIndex = 0;
            } else { // 'prev'
                previewIndex = this.playlist.length - 1;
            }
        } else {
            if (direction === 'next') {
                previewIndex = (this.currentTrackIndex + 1) % this.playlist.length;
            } else { // 'prev'
                previewIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
            }
        }
        this.updatePlayerIndicator(previewIndex);
    }
    
    _playTrackAtIndex(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentTrackIndex = index;
        
        if (!this.youtubePlayer || !this.youtubePlayer.loadVideoById) {
            this.pendingPlay = true;
            this.ensureYouTubeAPILoaded();
            return;
        }

        const trackObject = this.playlist[this.currentTrackIndex];
        this.youtubePlayer.loadVideoById(trackObject.videoId);
        this.app.scrollToScene(trackObject.sceneId);
        // Defer indicator update until state change, but can prime it
        this.updatePlayerIndicator(); 
    }

    playTrackById(videoId) {
        const index = this.playlist.findIndex(track => track.videoId === videoId);
        if (index !== -1) {
            this._playTrackAtIndex(index);
        }
    }
    
    playPrevTrack() {
        if (this.playlist.length <= 1) return;
        const newIndex = this.currentTrackIndex === -1
            ? this.playlist.length - 1 // If nothing playing, start from last
            : (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
        this._playTrackAtIndex(newIndex);
    }

    togglePlay() {
        if (this.playlist.length === 0) return;
        
        if (!this.youtubePlayer || !this.youtubePlayer.getPlayerState) {
            this.pendingPlay = true;
            this.ensureYouTubeAPILoaded();
            return;
        }

        if (this.currentTrackIndex === -1) {
            this._playTrackAtIndex(0);
            return;
        }

        const playerState = this.youtubePlayer.getPlayerState();
        if (playerState === YT.PlayerState.PLAYING) {
            this.youtubePlayer.pauseVideo();
        }
        else {
            this.youtubePlayer.playVideo();
        }
    }

    playNextTrack() {
        if (this.playlist.length <= 1) return;
        const newIndex = this.currentTrackIndex === -1
            ? 0 // If nothing playing, start from first
            : (this.currentTrackIndex + 1) % this.playlist.length;
        this._playTrackAtIndex(newIndex);
    }

    reset() {
        if (this.youtubePlayer && this.youtubePlayer.stopVideo) {
            this.youtubePlayer.stopVideo();
        }
        this.playlist = [];
        this.currentTrackIndex = -1;
        this.isPlaying = false;
        this.musicPlayer.classList.add('hidden');
        this.updatePlayerIndicator();
    }
}
```

5.4 `assets/js-mod/SidebarManager.js`
- Sidebar scene list rendering + menu handling (imports IndexedDB helper).

```js
import * as constants from './Constants.js';
import { IDBHelper } from './IDBHelper.js';

export class SidebarManager {
    constructor(app) {
        this.app = app;
        this.sceneList = document.getElementById('scene-list');
        this.iconList = ['film', 'home', 'car', 'user', 'users', 'phone', 'coffee', 'building', 'store', 'hospital', 'tree', 'sun', 'moon', 'bed', 'book', 'briefcase', 'camera', 'ship', 'plane', 'train', 'road', 'fire', 'heart', 'star', 'music', 'money-bill-wave', 'lightbulb', 'comment', 'map-marker-alt', 'exclamation-triangle', 'question-circle', 'lock', 'key', 'cog', 'wrench', 'hammer', 'screwdriver', 'anchor', 'life-ring', 'beer', 'glass-martini', 'cloud', 'umbrella', 'bicycle', 'futbol', 'university', 'flask', 'landmark', 'atom', 'globe'];
        this.colorList = ['scene-color-1', 'scene-color-2', 'scene-color-3', 'scene-color-4', 'scene-color-5'];
        this.menuHideTimeout = null;
        this.imageDB = new IDBHelper();

        this.init();
    }

    init() {
        // Draggable scene settings popup
        this.initDraggable(document.getElementById('scene-settings-popup'), document.getElementById('scene-settings-popup-header'));

        // Icon Picker Hover Close
        document.getElementById('icon-picker-menu').addEventListener('mouseleave', this.hideIconPickerMenu.bind(this));
        
        // Mobile menu
        document.getElementById('mobile-menu-btn').addEventListener('click', this.toggleMobileMenu.bind(this));
        document.getElementById('hide-sidebar-btn').addEventListener('click', this.toggleMobileMenu.bind(this));
        document.getElementById('menu-overlay').addEventListener('click', this.toggleMobileMenu.bind(this));

        const saveMenuToggle = document.getElementById('mobile-save-menu-toggle');
        if (saveMenuToggle) {
            saveMenuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                const saveMenu = document.getElementById('mobile-save-menu');
                const icon = saveMenuToggle.querySelector('i');
                const isHidden = saveMenu.classList.toggle('hidden');
                icon.classList.toggle('fa-chevron-down', isHidden);
                icon.classList.toggle('fa-chevron-up', !isHidden);
            });
        }
        this.initSwipeToClose();

        const popup = document.getElementById('scene-settings-popup');
        popup.addEventListener('paste', (e) => {
            const sceneId = popup.dataset.sceneId;
            if (!sceneId || popup.classList.contains('hidden')) return;

            if (e.target.id === 'scene-description-input' || e.target.id === 'scene-notes-input') {
                return;
            }
            
            if (e.target.closest('.track-drop-zone')) {
                return;
            }
            
            const text = (e.clipboardData || window.clipboardData).getData('text');
            const videoId = this.app.mediaPlayer.extractYouTubeVideoId(text);

            if (videoId) {
                e.preventDefault();
                const pasteHandler = async (text) => {
                    const trackMeta = await this.app.mediaPlayer._fetchTrackMetadata(videoId);
                    if (trackMeta) {
                        if (!this.app.sceneMeta[sceneId]) this.app.sceneMeta[sceneId] = {};
                        this.app.sceneMeta[sceneId].track = text;
                        this.app.sceneMeta[sceneId].trackTitle = trackMeta.title;
                        this.app.sceneMeta[sceneId].trackArtist = trackMeta.artist;
                        this.saveSceneMeta(sceneId);
                        this.renderTrackArea(sceneId);
                    }
                };
                pasteHandler(text);
            }
        });
    }

    initSwipeToClose() {
        let touchStartX = 0;
        let touchCurrentX = 0;
        const sidebar = this.app.sidebar;
    
        sidebar.addEventListener('touchstart', (e) => {
            if (!sidebar.classList.contains('open')) return;
            touchStartX = e.targetTouches[0].clientX;
            touchCurrentX = touchStartX;
            sidebar.style.transition = 'none'; // Remove transition for direct tracking
        }, { passive: true });
    
        sidebar.addEventListener('touchmove', (e) => {
            if (!sidebar.classList.contains('open')) return;
            touchCurrentX = e.targetTouches[0].clientX;
            const diff = touchCurrentX - touchStartX;
            if (diff < 0) { // Only track leftward movement
                sidebar.style.left = `${diff}px`;
            }
        }, { passive: true });
    
        sidebar.addEventListener('touchend', () => {
            if (!sidebar.classList.contains('open')) return;
            const diff = touchCurrentX - touchStartX;
            const threshold = sidebar.offsetWidth / 3;
            
            sidebar.style.transition = ''; // Restore original transition
    
            if (diff < -threshold) { // If swiped more than a third of the way
                this.toggleMobileMenu();
                sidebar.style.left = ''; 
            } else {
                // Snap back if not swiped far enough
                sidebar.style.left = '0px';
            }
        });
    }

    initDraggable(popup, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        const dragMouseDown = (e) => {
            // If the target or its parent is contenteditable, or it's a button/input, do not start drag.
            if (e.target.closest('[contenteditable="true"]') || e.target.closest('button, input, textarea, select')) {
                return;
            }
            if (document.body.classList.contains('mobile-view')) return;
            
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        };

        const elementDrag = (e) => {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            popup.style.top = (popup.offsetTop - pos2) + "px";
            popup.style.left = (popup.offsetLeft - pos1) + "px";
        };

        const closeDragElement = () => {
            document.onmouseup = null;
            document.onmousemove = null;
        };
        
        if (handle) handle.onmousedown = dragMouseDown;
    }

    updateSidebarHeader() {
        const titleHeader = document.getElementById('script-title-header');
        if (titleHeader) {
            titleHeader.textContent = this.app.meta.title || 'UNTITLED';
        }
        const metaBtn = document.getElementById('script-meta-btn');
        if (metaBtn) {
            metaBtn.onclick = () => this.openScriptMetaPopup();
        }
    }

    toggleMobileMenu() {
        const isOpen = this.app.sidebar.classList.toggle('open');
        this.app.menuOverlay.classList.toggle('active', isOpen);
        if (!isOpen) this.app.sidebar.style.left = '';
        else this.app.pushHistoryState('sidebar');
    }

    updateSceneStats() {
        const popup = document.getElementById('scene-settings-popup');
        if (popup.classList.contains('hidden')) return;
    
        const sceneId = popup.dataset.sceneId;
        if (!sceneId) return;
    
        const slug = this.app.editor.querySelector(`[data-line-id="${sceneId}"]`);
        if (!slug) return;
    
        const { eighths, speakingCharacters, detailedStats } = this._getSceneStats(slug);
        const lenstring = (eighths/8 >= 1) ? (eighths - (eighths%8))/8 + "pg " + (eighths%8==0 ? "" : eighths%8 + "/8") : eighths%8 + "/8";

        const condensedGrid = popup.querySelector('.stats-grid-condensed');
        if (condensedGrid) {
            condensedGrid.querySelector('strong:nth-of-type(1)').textContent = `${lenstring}`;
            condensedGrid.querySelector('strong:nth-of-type(2)').textContent = `${speakingCharacters.size}`;
        }
    
        Object.keys(detailedStats).forEach(type => {
            const countEl = popup.querySelector(`[data-stat-type="${type}"][data-stat-prop="count"]`);
            if (countEl) countEl.textContent = detailedStats[type].count;
            const wordsEl = popup.querySelector(`[data-stat-type="${type}"][data-stat-prop="words"]`);
            if (wordsEl) wordsEl.textContent = detailedStats[type].words;
            const charsEl = popup.querySelector(`[data-stat-type="${type}"][data-stat-prop="chars"]`);
            if (charsEl) charsEl.textContent = detailedStats[type].chars;
        });
    }

    _getSceneStats(slug) {
        const sceneElements = this.app.getSceneElements(slug);
        const totalHeight = this.app.pageRenderer.measureNodeHeight(sceneElements, this.app.editor);
        const scenePages = totalHeight / this.app.CONTENT_HEIGHT_PX;
        const eighths = Math.round(scenePages * 8);

        const speakingCharacters = new Set();
        const stats = {
            'sc-action': { count: 0, words: 0, chars: 0 },
            'sc-character': { count: 0, words: 0, chars: 0 },
            'sc-dialogue': { count: 0, words: 0, chars: 0 },
            'sc-parenthetical': { count: 0, words: 0, chars: 0 },
        };

        let isCharacter = false;
        sceneElements.forEach(el => {
            const type = this.app.editorHandler.getBlockType(el);
            const text = el.textContent || '';

            if (stats[type]) {
                const textStats = this._calculateTextStats(text);
                stats[type].count++;
                stats[type].words += textStats.words;
                stats[type].chars += textStats.chars;
            }

            if (type === constants.ELEMENT_TYPES.CHARACTER) {
                isCharacter = true;
            } else if (type === constants.ELEMENT_TYPES.DIALOGUE && isCharacter) {
                const charName = el.previousElementSibling.textContent;
                if (charName) speakingCharacters.add(this.app.editorHandler.getCleanCharacterName(charName));
                isCharacter = false;
            } else {
                isCharacter = false;
            }
        });

        return { eighths, speakingCharacters: speakingCharacters, detailedStats: stats };
    }

    _calculateTextStats(text) {
        const trimmedText = text.trim();
        if (trimmedText === '') {
            return { words: 0, chars: 0 };
        }
        const words = trimmedText.split(/\s+/).length;
        const chars = trimmedText.length;
        return { words, chars };
    }

    openSceneSettings(slug) {
        if (!slug) return;
    
        const sceneId = slug.dataset.lineId;
        if (!sceneId) return;

        const popup = document.getElementById('scene-settings-popup');
        const isAlreadyOpen = !popup.classList.contains('hidden');
        const isDifferentScene = popup.dataset.sceneId !== sceneId;
    
        this.highlightSidebarScene(sceneId);
        
        // Stats Logic:
        // If real DOM slug, calculate live.
        // If mock slug (Treatment Mode), use cached stats or placeholders.
        let eighths = 0;
        let speakingCharacters = new Set();
        let detailedStats = {
            'sc-action': { count: 0, words: 0, chars: 0 },
            'sc-character': { count: 0, words: 0, chars: 0 },
            'sc-dialogue': { count: 0, words: 0, chars: 0 },
            'sc-parenthetical': { count: 0, words: 0, chars: 0 },
        };

        if (!slug.isMock) {
            const stats = this._getSceneStats(slug);
            eighths = stats.eighths;
            speakingCharacters = stats.speakingCharacters;
            detailedStats = stats.detailedStats;
        } else {
            // Try to load cached eighths
            eighths = this.app.sceneMeta[sceneId]?.cachedEighths || 0;
            // For characters, we could parse the treatment "Characters: " block if we wanted, 
            // but `this.app.scriptData` might be available to scan. 
            // For now, empty stats in Treatment Mode is acceptable or simpler to just show "N/A"
        }

        const pages = Math.floor(eighths / 8);
        const remainingEights = eighths % 8;

        popup.dataset.sceneId = sceneId;
    
        const header = popup.querySelector('#scene-settings-popup-header');
        let sceneTitle = slug.textContent.trim();
        
        // Scene Number Logic: Check meta first, else calculate
        const meta = this.app.sceneMeta[sceneId] || {};
        
        // Auto-number is tricky in Treatment Mode without full scan.
        // If mock, we might pass index or just skip auto calculation.
        // Let's rely on Sidebar loop to have set a 'cachedNumber' if we wanted perfect sync, 
        // but for now, if mock, we default to "?" if no manual number.
        let displaySceneNumber = meta.number;
        if (!displaySceneNumber) {
            if (!slug.isMock) {
                displaySceneNumber = Array.from(this.app.editor.querySelectorAll('.sc-slug')).indexOf(slug) + 1;
            } else {
                // In treatment mode, we can find index in scriptData
                if (this.app.scriptData && this.app.scriptData.blocks) {
                    const slugs = this.app.scriptData.blocks.filter(b => b.type === 'sc-slug');
                    const idx = slugs.findIndex(b => b.id === sceneId);
                    if (idx !== -1) displaySceneNumber = idx + 1;
                }
            }
        }
    
        const colorClass = meta.color || '';
        const iconHtml = meta.icon ? `<span class="scene-item-icon-container ${colorClass}"><i class="${meta.icon} fa-fw"></i></span>` : '';
        header.className = 'draggable-popup-header ' + colorClass;

        let pageCountHtml = '';
        if (eighths > 0) {
            pageCountHtml = `
                <div class="scene-page-count">
                    ${pages > 0 ? `<span class="pages">${pages}</span>` : ''}
                    <span class="eights"><b>${remainingEights}</b>/8</span>
                </div>
            `;
        } else {
             pageCountHtml = `
                <div class="scene-page-count">
                    <span class="eights"><b>0</b>/8</span>
                </div>
            `;
        }

        header.innerHTML = `
            <div class="scene-item-main scene-item-main-flex">
                ${iconHtml}
                <div title="${sceneTitle}">
                    <span class="opacity-50 mr-1 scene-number-editable ${colorClass}" contenteditable="true">${displaySceneNumber || ''}</span>
                    <span class="ml-1">${sceneTitle}</span>
                </div>
            </div>
            ${pageCountHtml}
            <button id="scene-settings-close-btn" class="btn-text">✕</button>
        `;
        
        // Re-bind the close button event listener as we just overwrote it
        header.querySelector('#scene-settings-close-btn').addEventListener('click', () => this.closeSceneSettings());

        // Bind Scene Number Editing
        const numSpan = header.querySelector('.scene-number-editable');
        const saveNum = () => {
            let val = numSpan.textContent.replace('#', '').trim();
            if (val === '?' || val === '') val = null; 
            
            if (!this.app.sceneMeta[sceneId]) this.app.sceneMeta[sceneId] = {};
            this.app.sceneMeta[sceneId].number = val;
            
            this.saveSceneMeta(sceneId); // Persist
        };

        numSpan.addEventListener('blur', saveNum);
        numSpan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                numSpan.blur();
            }
        });

        const popupBody = document.getElementById('scene-settings-popup-body');
        let statsHtml = Object.keys(detailedStats).map(type => `
            <div class="stat-row-label">${constants.TYPE_LABELS[type]}</div>
            <div data-stat-type="${type}" data-stat-prop="count">${detailedStats[type].count}</div>
            <div data-stat-type="${type}" data-stat-prop="words">${detailedStats[type].words}</div>
            <div data-stat-type="${type}" data-stat-prop="chars">${detailedStats[type].chars}</div>
        `).join('');
        
        const lenstring = (eighths/8 >= 1) ? (pages) + " " + (remainingEights > 0 ? remainingEights + "/8" : "") + "pg" : remainingEights + "/8";
        popupBody.innerHTML = `
            <div class="settings-section">
                <div class="meta-grid">
                    <div class="col-span-full">
                        <label class="settings-label" for="scene-description-input"><i class="fas fa-align-left fa-fw"></i> Description:</label>
                        <textarea id="scene-description-input" class="settings-input" rows="2" placeholder="A brief summary of the scene.">${meta.description || ''}</textarea>
                    </div>
                </div>
                <div class="mt-3">
                    <label class="settings-label" for="scene-notes-input"><i class="fas fa-sticky-note fa-fw"></i> Notes:</label>
                    <textarea id="scene-notes-input" class="settings-input" rows="4" placeholder="Production notes, continuity details, etc.">${meta.notes || ''}</textarea>
                </div>
                <div class="mt-3">
                     <label class="settings-label"><i class="fas fa-images fa-fw"></i> Images:</label>
                     <div id="scene-image-grid" class="image-grid"></div>
                     <button id="add-image-btn" class="btn-text mt-2 text-sm">+ Add Image</button>
                     <input type="file" id="scene-image-input" class="hidden" accept="image/*">
                </div>
                 <div class="mt-3">
                    <label class="settings-label"><i class="fas fa-music fa-fw"></i> Track:</label>
                    <div id="track-area"></div>
                </div>
            </div>
            <div class="settings-section">
                <div class="stats-grid-condensed">
                    <span><i class="fas fa-ruler-horizontal fa-fw"></i></span>
                    <strong>${lenstring}</strong>
                    <span><i class="fas fa-users fa-fw"></i> Speaking Chars:</span>
                    <strong>${speakingCharacters.size}</strong>
                </div>
                <div class="stats-grid-detailed">
                    <div class="stat-header">Element</div>
                    <div class="stat-header">Count</div>
                    <div class="stat-header">Words</div>
                    <div class="stat-header">Chars</div>
                    ${statsHtml}
                </div>
            </div>
        `;

        this.renderTrackArea(sceneId);
        
        document.getElementById('scene-description-input').addEventListener('blur', () => this.saveSceneMeta(sceneId));
        document.getElementById('scene-notes-input').addEventListener('blur', () => this.saveSceneMeta(sceneId));
        // Removed scene-number-input listener as it's gone

        this.renderSceneImages(sceneId);
        const addImgBtn = document.getElementById('add-image-btn');
        const imgInput = document.getElementById('scene-image-input');
        if (addImgBtn) addImgBtn.onclick = () => imgInput.click();

        if (imgInput) imgInput.onchange = async () => {
            const file = imgInput.files[0];
            if (!file) return;

            const imageId = `${sceneId}-${Date.now()}`;
            await this.imageDB.put(file, imageId);
        
            if (!this.app.sceneMeta[sceneId]) this.app.sceneMeta[sceneId] = {};
            if (!this.app.sceneMeta[sceneId].images) this.app.sceneMeta[sceneId].images = [];
            this.app.sceneMeta[sceneId].images.push(imageId);
            
            this.saveSceneMeta(sceneId, false);
            this.renderSceneImages(sceneId);
            
            imgInput.value = '';
        };

        const imageGrid = document.getElementById('scene-image-grid');
        if (imageGrid) imageGrid.addEventListener('click', async (e) => {
            const container = e.target.closest('.image-container');
            if (!container) return;

            const openConfirmation = document.querySelector('.image-container.confirming-delete');
            if (openConfirmation && openConfirmation !== container) {
                openConfirmation.classList.remove('confirming-delete');
            }

            if (e.target.closest('.image-delete-btn')) {
                container.classList.add('confirming-delete');
            } else if (e.target.closest('.image-delete-yes')) {
                const index = parseInt(container.dataset.imageIndex, 10);
                if (this.app.sceneMeta[sceneId] && this.app.sceneMeta[sceneId].images) {
                    const imageId = this.app.sceneMeta[sceneId].images[index];
                    await this.imageDB.delete(imageId);
                    this.app.sceneMeta[sceneId].images.splice(index, 1);
                    this.saveSceneMeta(sceneId, false);
                    this.renderSceneImages(sceneId);
                }
            } else if (container.classList.contains('confirming-delete')) {
                container.classList.remove('confirming-delete');
            }
        });

        popup.classList.remove('hidden');
        this.app.pushHistoryState('scenesettings');

        if (isAlreadyOpen && isDifferentScene) {
            popup.classList.add('scene-changed');
            setTimeout(() => popup.classList.remove('scene-changed'), 500);
        }
    }

    renderTrackArea(sceneId) {
        const trackArea = document.getElementById('track-area');
        if (!trackArea) return;

        const meta = this.app.sceneMeta[sceneId] || {};

        if (meta.track && meta.trackTitle) {
            trackArea.innerHTML = `
                <div class="track-display">
                    <span><strong>${meta.trackArtist}</strong> - ${meta.trackTitle}</span>
                    <button class="btn-icon" id="remove-track-btn" title="Remove track"><i class="fas fa-times"></i></button>
                </div>
            `;
            trackArea.querySelector('#remove-track-btn').addEventListener('click', () => {
                if (!this.app.sceneMeta[sceneId]) return;
                this.app.sceneMeta[sceneId].track = '';
                this.app.sceneMeta[sceneId].trackTitle = '';
                this.app.sceneMeta[sceneId].trackArtist = '';
                this.saveSceneMeta(sceneId);
                this.renderTrackArea(sceneId);
            });
        } else {
            trackArea.innerHTML = `
                <div class="track-drop-zone">
                    <i class="fab fa-youtube"></i>
                    <span>Ctrl+V or click to paste YouTube URL</span>
                </div>
            `;
            const dropZone = trackArea.querySelector('.track-drop-zone');
            const pasteHandler = async (text) => {
                const videoId = this.app.mediaPlayer.extractYouTubeVideoId(text);
                if (videoId) {
                    const trackMeta = await this.app.mediaPlayer._fetchTrackMetadata(videoId);
                    if (trackMeta) {
                        if (!this.app.sceneMeta[sceneId]) this.app.sceneMeta[sceneId] = {};
                        this.app.sceneMeta[sceneId].track = text;
                        this.app.sceneMeta[sceneId].trackTitle = trackMeta.title;
                        this.app.sceneMeta[sceneId].trackArtist = trackMeta.artist;
                        this.saveSceneMeta(sceneId);
                        this.renderTrackArea(sceneId);
                    }
                }
            };
            dropZone.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    pasteHandler(text);
                } catch(err) {
                    alert('Could not read clipboard. Please try pasting with Ctrl+V.');
                }
            });
             dropZone.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text');
                pasteHandler(text);
            });
        }
    }

    async renderSceneImages(sceneId) {
        const grid = document.getElementById('scene-image-grid');
        if (!grid) return;
    
        const meta = this.app.sceneMeta[sceneId] || {};
        const imageIds = meta.images || [];
        
        // Revoke any existing object URLs to prevent memory leaks
        grid.querySelectorAll('img[src^="blob:"]').forEach(img => URL.revokeObjectURL(img.src));

        grid.innerHTML = ''; // Clear existing images

        for (let i = 0; i < imageIds.length; i++) {
            const imageId = imageIds[i];
            const file = await this.imageDB.get(imageId);

            if (file) {
                const objectURL = URL.createObjectURL(file);
                const container = document.createElement('div');
                container.className = 'image-container';
                container.dataset.imageIndex = i;
                container.innerHTML = `
                    <div class="image-flipper">
                        <div class="image-front">
                            <img src="${objectURL}" alt="Scene image ${i + 1}">
                            <button class="image-delete-btn" title="Delete Image"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="image-back">
                            <span>Delete?</span>
                            <div>
                                <button class="btn-text-small image-delete-yes">Yes</button>
                                <button class="btn-text-small image-delete-no">No</button>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(container);
            }
        }
    }
    
    saveSceneMeta(sceneId, updateList = true) {
        if (!this.app.sceneMeta[sceneId]) {
            this.app.sceneMeta[sceneId] = {};
        }
        const descriptionInput = document.getElementById('scene-description-input');
        const notesInput = document.getElementById('scene-notes-input');
        const trackInput = document.getElementById('scene-track-input');
        // numberInput is gone, handled by contentEditable span logic directly updating this.app.sceneMeta before calling save

        const description = descriptionInput ? descriptionInput.value : this.app.sceneMeta[sceneId].description;
        const notes = notesInput ? notesInput.value : this.app.sceneMeta[sceneId].notes;
        const track = trackInput ? trackInput.value : this.app.sceneMeta[sceneId].track;
        
        // Use existing number if not being set by this call context (which is fine, span logic sets it directly)
        const number = this.app.sceneMeta[sceneId].number;

        // Note: this.app.sceneMeta[sceneId].images is managed separately now
        this.app.sceneMeta[sceneId] = { 
            ...this.app.sceneMeta[sceneId], 
            description, 
            notes, 
            track,
            number
        };

        localStorage.setItem('sfss_scene_meta', JSON.stringify(this.app.sceneMeta));
        this.app.isDirty = true;
        
        // Targeted refresh instead of full refresh
        this.updateSceneList();
        if (this.app.treatmentModeActive) {
            this.app.refreshScene(sceneId);
        }
        
        this.app.mediaPlayer.updatePlaylist();
    }

    closeSceneSettings() {
        const grid = document.getElementById('scene-image-grid');
        if (grid) {
             grid.querySelectorAll('img[src^="blob:"]').forEach(img => URL.revokeObjectURL(img.src));
        }
        document.getElementById('scene-settings-popup').classList.add('hidden');
        this.sceneList.querySelectorAll('.scene-item').forEach(item => item.classList.remove('active-scene'));
    }

    highlightSidebarScene(sceneId) {
        this.sceneList.querySelectorAll('.scene-item').forEach(item => item.classList.remove('active-scene'));
        
        if(sceneId) {
            const item = this.sceneList.querySelector(`.scene-item[data-scene-id="${sceneId}"]`);
            if (item) {
                item.classList.add('active-scene');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    openScriptMetaPopup() {
        this.closeSceneSettings();
        this.app.closePopups();
        document.getElementById('meta-title-popup').value = this.app.meta.title;
        document.getElementById('meta-author-popup').value = this.app.meta.author;
        document.getElementById('meta-contact-popup').value = this.app.meta.contact;
        document.getElementById('script-meta-popup').classList.remove('hidden');
    }

    closeScriptMetaPopup() {
        document.getElementById('script-meta-popup').classList.add('hidden');
    }

    async saveScriptMeta() {
        this.app.meta.title = document.getElementById('meta-title-popup').value;
        this.app.meta.author = document.getElementById('meta-author-popup').value;
        this.app.meta.contact = document.getElementById('meta-contact-popup').value;
        
        this.app.isDirty = true;
        await this.app.save();

        this.app.applySettings();
        localStorage.setItem('sfss_meta', JSON.stringify(this.app.meta));
        this.app.saveState(true);
        await this.app.populateOpenMenu();
        this.closeScriptMetaPopup();
    }
    
    updateSceneList() {
        const scrollTop = this.sceneList.scrollTop;
        this.sceneList.innerHTML = '';
        
        let slugs = [];
        let isDataMode = false;

        if (this.app.treatmentModeActive && this.app.scriptData) {
            slugs = this.app.scriptData.blocks.filter(b => b.type === constants.ELEMENT_TYPES.SLUG);
            isDataMode = true;
        } else {
            slugs = Array.from(this.app.editor.querySelectorAll(`.${constants.ELEMENT_TYPES.SLUG}`));
        }

        let index = 1;
        slugs.forEach(slug => {
            let lineId, text;
            
            if (isDataMode) {
                lineId = slug.id;
                text = slug.text;
            } else {
                lineId = slug.dataset.lineId || `line-${Math.random().toString(36).substring(2, 11)}`;
                if (!slug.dataset.lineId) slug.dataset.lineId = lineId;
                text = slug.textContent;
            }
            
            text = text.trim() || 'UNTITLED';
            const meta = this.app.sceneMeta[lineId] || {};
            const displaySceneNumber = meta.number || index;

            const item = document.createElement('div');
            item.className = 'scene-item';
            
            item.dataset.sceneId = lineId;
            
            // Stats logic needs to adapt or be skipped in data mode
            let pageCountHtml = '';
            
            if (!isDataMode) {
                const { eighths } = this._getSceneStats(slug);
                const pages = Math.floor(eighths / 8);
                const remainingEights = eighths % 8;
                if (eighths > 0) {
                    pageCountHtml = `
                        <div class="scene-page-count">
                            ${pages > 0 ? `<span class="pages">${pages}</span>` : ''}
                            <span class="eights"><b>${remainingEights}</b>/8</span>
                        </div>
                    `;
                    // Cache this for Treatment Mode usage
                    if (!this.app.sceneMeta[lineId]) this.app.sceneMeta[lineId] = {};
                    this.app.sceneMeta[lineId].cachedEighths = eighths;
                } else {
                     pageCountHtml = `
                        <div class="scene-page-count">
                            <span class="eights"><b>0</b>/8</span>
                        </div>
                    `;
                }
            } else {
                // In Treatment Mode, try to use cached stats
                const cached = this.app.sceneMeta[lineId]?.cachedEighths;
                if (cached) {
                    const pages = Math.floor(cached / 8);
                    const remainingEights = cached % 8;
                    pageCountHtml = `
                        <div class="scene-page-count">
                            ${pages > 0 ? `<span class="pages">${pages}</span>` : ''}
                            <span class="eights"><b>${remainingEights}</b>/8</span>
                        </div>
                    `;
                }
            }
            
            const iconHtml = meta.icon ? `<i class="${meta.icon} fa-fw"></i>` : '';
            const hasTrack = meta.track && this.app.mediaPlayer.extractYouTubeVideoId(meta.track);
            const italicStyle = hasTrack ? 'font-style: italic;' : '';
            const colorClass = meta.color || '';
            
            if (colorClass) item.classList.add(colorClass);

            item.innerHTML = `
                <div class="scene-grid-layout">
                    <span class="scene-grid-number">${displaySceneNumber}.</span>
                    <span class="scene-grid-icon">${iconHtml}</span>
                    <span class="scene-grid-title truncate" title="${text}" style="${italicStyle}">${text}</span>
                    <div class="scene-grid-meta">
                        ${pageCountHtml}
                        <button class="scene-config-btn" title="Scene Settings">
                            <i class="fas fa-cog"></i>
                        </button>
                    </div>
                </div>
            `;

            const iconContainer = item.querySelector('.scene-grid-icon');
            if(iconContainer) iconContainer.onmouseenter = (e) => this.showIconPickerMenu(e.currentTarget, lineId);
            
            item.onclick = (e) => {
                // If the config button was clicked, its own handler will take care of it.
                if (e.target.closest('.scene-config-btn')) {
                    return;
                }

                // Scroll to the scene in the main editor
                this.app.scrollToScene(lineId);

                // If the scene settings popup is already open, update it to this scene.
                const popup = document.getElementById('scene-settings-popup');
                if (!popup.classList.contains('hidden')) {
                    const slugToOpen = isDataMode ? { dataset: { lineId }, textContent: text, isMock: true } : slug;
                    this.openSceneSettings(slugToOpen);
                }

                // If on mobile, close the sidebar after selection.
                if (document.body.classList.contains('mobile-view')) {
                    this.toggleMobileMenu();
                }
            };
            
            // Ensure the config button explicitly opens the settings.
            item.querySelector('.scene-config-btn').onclick = (e) => {
                e.stopPropagation(); // Prevent the item's main click handler from firing.
                const slugToOpen = isDataMode ? { dataset: { lineId }, textContent: text, isMock: true } : slug;
                this.openSceneSettings(slugToOpen);
            };

            this.sceneList.appendChild(item);
            index++;
        });
        this.sceneList.scrollTop = scrollTop;
    }

    showIconPickerMenu(target, sceneId) {
        const menu = document.getElementById('icon-picker-menu');
        const currentMeta = this.app.sceneMeta[sceneId] || {};
        const currentIcon = currentMeta.icon || '';
        const currentColor = currentMeta.color || '';

        let colorPickerHtml = '<div class="color-picker-row">';
        colorPickerHtml += this.colorList.map(color => `
            <button class="color-picker-btn ${currentColor === color ? 'selected' : ''}" data-color="${color}" style="background-color: var(--${color})"></button>
        `).join('');
        colorPickerHtml += `<button class="color-picker-btn clear ${currentColor === '' ? 'selected' : ''}" data-color="" title="Clear color"><i class="fas fa-ban"></i></button>`;
        colorPickerHtml += '</div>';

        let iconPickerHtml = this.iconList.map(icon => {
            const iconClass = `fas fa-${icon}`;
            return `
            <button class="icon-picker-btn ${currentIcon === iconClass ? 'selected' : ''}" data-icon="${iconClass}" title="${icon}">
                <i class="${iconClass} fa-fw"></i>
            </button>
        `;
        }).join('');
        iconPickerHtml = "<div class='iconsrow'>" + iconPickerHtml + "</div>";
        menu.innerHTML = colorPickerHtml + iconPickerHtml;

        menu.onclick = (e) => {
            const target = e.target;
            const colorBtn = target.closest('.color-picker-btn');
            if (colorBtn && colorBtn.hasAttribute('data-color')) {
                const color = colorBtn.dataset.color;
                this.saveSceneColor(sceneId, color);
                this.hideIconPickerMenu();
                return;
            }

            const iconBtn = target.closest('.icon-picker-btn');
            if (iconBtn && iconBtn.hasAttribute('data-icon')) {
                const icon = iconBtn.dataset.icon;
                const currentSelected = menu.querySelector('.icon-picker-btn.selected[data-icon]');
                let newIcon = icon;
                if (currentSelected && currentSelected === iconBtn) {
                    newIcon = '';
                }
                this.saveSceneIcon(sceneId, newIcon);
                this.hideIconPickerMenu();
            }
        };

        const rect = target.getBoundingClientRect();
        menu.style.display = 'flex';
        
        // Smart positioning
        const menuWidth = 250; // Approx width or read from computed style if possible, but it's hidden initially. 
        // Better: Set display flex, then measure.
        const actualWidth = menu.offsetWidth || 250;
        
        if (rect.right + actualWidth > window.innerWidth) {
            menu.style.left = (rect.left - actualWidth) + 'px';
        } else {
            menu.style.left = (rect.right) + 'px';
        }
        
        menu.style.top = (rect.top) + 'px';
    }

    hideIconPickerMenu() {
        document.getElementById('icon-picker-menu').style.display = 'none';
    }
    
    saveSceneColor(sceneId, colorClass) {
        if (!this.app.sceneMeta[sceneId]) this.app.sceneMeta[sceneId] = {};
        
        if (this.app.sceneMeta[sceneId].color === colorClass) {
             this.app.sceneMeta[sceneId].color = '';
        } else {
             this.app.sceneMeta[sceneId].color = colorClass;
        }

        localStorage.setItem('sfss_scene_meta', JSON.stringify(this.app.sceneMeta));
        this.app.isDirty = true;
        this.updateSceneList();
        if (this.app.treatmentModeActive) {
            this.app.refreshTreatmentView();
        }
        this.app.refreshSceneSettingsModal(sceneId);
    }
    
    saveSceneIcon(sceneId, iconClass) {
        if (!this.app.sceneMeta[sceneId]) this.app.sceneMeta[sceneId] = {};
        this.app.sceneMeta[sceneId].icon = iconClass;
        localStorage.setItem('sfss_scene_meta', JSON.stringify(this.app.sceneMeta));
        this.app.isDirty = true;
        this.updateSceneList();
        if (this.app.treatmentModeActive) {
            this.app.refreshTreatmentView();
        }
        this.app.refreshSceneSettingsModal(sceneId);
    }
}
```

5.5 `assets/js-mod/IDBHelper.js`
- IndexedDB wrapper used by sidebar/storage managers.

```js
export class IDBHelper {
    constructor(dbName = 'SFSSDB', storeName = 'sceneImages', version = 3) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.version = version;
        this.db = null;
    }

    async connect() {
        if (this.db) return Promise.resolve(this.db);
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('sceneImages')) {
                    db.createObjectStore('sceneImages');
                }
                if (!db.objectStoreNames.contains('scripts')) {
                    db.createObjectStore('scripts', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode);
                reject(event.target.error);
            };
        });
    }

    async get(key) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll() {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(value, key) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            // Explicit check: if key is strictly provided (not undefined), use it.
            const request = (key !== undefined) ? store.put(value, key) : store.put(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(key) {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

```

5.6 `assets/js-mod/EditorHandler.js`
- Editor caret logic, keystrokes, scene number rendering, and autocompletion.

```js
import * as constants from './Constants.js';

export class EditorHandler {
    constructor(app) {
        this.app = app;
        this.autoMenu = document.getElementById('autocomplete-menu');
        this.typeMenu = document.getElementById('type-selector-menu');
        
        this.popupState = { active: false, type: null, selectedIndex: 0, options: [], targetBlock: null };
        this.sceneListUpdateTimeout = null;

        this.init();
    }

    init() {
        this.app.editor.addEventListener('keydown', this.handleKeydown.bind(this));
        this.app.editor.addEventListener('keyup', this.handleKeyup.bind(this));
        this.app.editor.addEventListener('input', this.handleInput.bind(this));
        this.app.editor.addEventListener('mouseup', this.updateContext.bind(this));
        this.app.editor.addEventListener('paste', this.handlePaste.bind(this));
        this.app.editor.addEventListener('focusout', (e) => {
            if (e.target.classList && e.target.classList.contains('script-line')) this.sanitizeBlock(e.target);
        }, true);
    }
    
    handlePaste(e) {
        this.app.resetCycleState();
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const lines = text.split('\n');

        let currentBlock = this.getCurrentBlock();

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            let type = constants.ELEMENT_TYPES.ACTION; 

            if (trimmedLine.length === 0 && index < lines.length -1) {
                currentBlock = this.createBlock(constants.ELEMENT_TYPES.ACTION, '', currentBlock);
                return;
            }

            const isAllUpper = trimmedLine === trimmedLine.toUpperCase();
            if (isAllUpper && (trimmedLine.startsWith('INT.') || trimmedLine.startsWith('EXT.'))) {
                type = constants.ELEMENT_TYPES.SLUG;
            } else if (isAllUpper && trimmedLine.length > 0 && lines[index + 1] && lines[index + 1].trim().length > 0) {
                type = constants.ELEMENT_TYPES.CHARACTER;
            } else if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
                type = constants.ELEMENT_TYPES.PARENTHETICAL;
                // Strip brackets for internal storage (CSS handles display)
                line = trimmedLine.replace(/^\(+|\)+$/g, '').trim();
            } else if (isAllUpper && trimmedLine.endsWith('TO:')) {
                type = constants.ELEMENT_TYPES.TRANSITION;
            }
            
            if(index === 0 && currentBlock) {
                if(currentBlock.textContent.trim() === '') {
                    currentBlock.textContent = line;
                    this.setBlockType(currentBlock, type);
                } else {
                    currentBlock = this.createBlock(type, line, currentBlock);
                }
            } else {
                currentBlock = this.createBlock(type, line, currentBlock);
            }
        });
        
        this.focusBlock(currentBlock);
        this.app.sidebarManager.updateSceneStats();
        this.app.saveState(true);
    }

    updateContext() {
        // In Page View, the editor is hidden, so we shouldn't update the selector 
        // based on the hidden editor's selection.
        if (this.app.pageViewActive) return;

        if (this.app.treatmentModeActive) {
             const sel = window.getSelection();
             if (sel.rangeCount > 0) {
                 const node = sel.getRangeAt(0).commonAncestorContainer;
                 const block = node.nodeType === 3 ? node.parentNode.closest('.treatment-scene-block') : node.closest('.treatment-scene-block');
                 
                 if (block) {
                     const sceneId = block.dataset.sceneId;
                     const popup = document.getElementById('scene-settings-popup');
                     if (!popup.classList.contains('hidden')) {
                         if (popup.dataset.sceneId !== sceneId) {
                             const slugData = this.app.scriptData.blocks.find(b => b.id === sceneId);
                             if (slugData) {
                                 const mockSlug = { dataset: { lineId: sceneId }, textContent: slugData.text, isMock: true };
                                 this.app.sidebarManager.openSceneSettings(mockSlug);
                             }
                         }
                     }
                 }
             }
             return;
        }

        const block = this.getCurrentBlock();
        if (block) {
            const currentType = this.getBlockType(block);
            this.app.topSelector.value = currentType;
            
            // Sync Horizontal Selector
            const hzNodes = document.querySelectorAll('.hz-node');
            if (hzNodes.length > 0) {
                hzNodes.forEach(node => {
                    node.classList.toggle('active', node.dataset.value === currentType);
                });
            }

            const popup = document.getElementById('scene-settings-popup');
            if (!popup.classList.contains('hidden')) {
                const parentSlug = this.app.findParentSlug(block);
                
                if (parentSlug && popup.dataset.sceneId !== parentSlug.dataset.lineId) {
                    this.app.sidebarManager.openSceneSettings(parentSlug);
                } else if (parentSlug) {
                    this.app.sidebarManager.updateSceneStats();
                }
            }
        }
        const text = this.app.editor.innerText;
        document.getElementById('stats-words').textContent = `Words: ${text.trim().split(/\s+/).length}`;
        document.getElementById('stats-pages').textContent = `Pages: ${this.app.updatePageCount()}`;
    }

    handleKeydown(e) {
        if (this.app.checkShortcut(e, 'cycleType')) {
            e.preventDefault();
            this.app.cycleType();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) this.app.redo();
            else this.app.undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            this.app.redo();
            return;
        }

        const block = this.getCurrentBlock();
        if (!block) return;
        
        const type = this.getBlockType(block);
        const isEmpty = block.textContent.trim() === '';

        if (this.popupState.active) {
            if (this.popupState.type === 'selector' && constants.TYPE_SHORTCUTS[e.key.toLowerCase()]) {
                e.preventDefault();
                this.setBlockType(this.popupState.targetBlock, constants.TYPE_SHORTCUTS[e.key.toLowerCase()]);
                this.closePopups();
                this.focusBlock(this.popupState.targetBlock);
            }
            else if (e.key === 'ArrowDown') { e.preventDefault(); this.popupNavigate(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this.popupNavigate(-1); }
            else if (e.key === 'ArrowRight') {
                if (this.popupState.type === 'auto') {
                     const menu = this.autoMenu;
                     const items = menu.querySelectorAll('.menu-item');
                     const selected = items[this.popupState.selectedIndex];
                     if (selected && selected.dataset.deletable === "true") {
                         e.preventDefault();
                         const name = selected.dataset.charName;
                         this.app.characters.delete(name);
                         this.triggerAutocomplete(this.popupState.targetBlock);
                     }
                }
            }
            else if (e.key === 'Enter' || e.key === 'Tab') { 
                e.preventDefault();
                const block = this.popupState.targetBlock;
                const isCharacterAutocomplete = this.popupState.type === 'auto' && this.getBlockType(block) === constants.ELEMENT_TYPES.CHARACTER;
                
                this.popupSelect(); 

                if (isCharacterAutocomplete) {
                    const nextType = this.app.keymap[constants.ELEMENT_TYPES.CHARACTER]['enter'];
                    if (nextType) {
                        const newBlock = this.createBlock(nextType, '', block);
                        this.focusBlock(newBlock);
                    }
                    this.app.saveState(true);
                }
            }
            else if (e.key === 'Escape') this.closePopups();
            return;
        }

        if (e.key === 'Tab' && !e.shiftKey && type === constants.ELEMENT_TYPES.CHARACTER && isEmpty && block.hasAttribute('data-suggest')) {
            e.preventDefault();
            const suggestedChar = block.getAttribute('data-suggest');
            block.textContent = suggestedChar;
            this.commitCharacter(suggestedChar);
            block.removeAttribute('data-suggest');
            
            const nextType = this.app.keymap[constants.ELEMENT_TYPES.CHARACTER]['enter'];
            const newBlock = this.createBlock(nextType, '', block);
            this.focusBlock(newBlock);
            this.app.saveState(true);
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.openTypeSelector(block);
            return;
        }

        if (e.key === 'Backspace' && isEmpty && this.app.editor.children.length > 1) {
            e.preventDefault();
            const prev = block.previousElementSibling;
            const next = block.nextElementSibling;
            let focusEl = prev || next;
            
            block.remove();

            if (prev && next && this.getBlockType(prev) === this.getBlockType(next) && 
                [constants.ELEMENT_TYPES.DIALOGUE, constants.ELEMENT_TYPES.ACTION].includes(this.getBlockType(prev))) {
                
                const prevText = prev.textContent;
                prev.textContent = prevText + ' ' + next.textContent;
                next.remove();
                this.focusBlock(prev, prevText.length);
            } else if (focusEl) {
                this.focusBlock(focusEl);
            }
            this.app.sidebarManager.updateSceneStats();
            this.app.saveState(true);
            return;
        }

        const handleNav = (key) => {
            e.preventDefault();
            this.sanitizeBlock(block);
            const nextType = this.app.keymap[type] ? this.app.keymap[type][key] : null;

            if (!isEmpty) {
                if (key === 'enter') {
                    // Smart Split Logic
                    const sel = window.getSelection();
                    const range = sel.getRangeAt(0);
                    // Check if cursor is at the end
                    // Compare range end with length of text content
                    // Note: block.textContent might be different than visible text if there are hidden chars, but usually fine here.
                    // We need to be careful with child nodes. block usually has 1 text node.
                    
                    const isAtEnd = (range.endContainer === block || range.endContainer.parentNode === block) && 
                                    range.endOffset === block.textContent.length;
                    
                    if (!isAtEnd && [constants.ELEMENT_TYPES.ACTION, constants.ELEMENT_TYPES.DIALOGUE, constants.ELEMENT_TYPES.PARENTHETICAL].includes(type)) {
                        // SPLIT THE BLOCK
                        const text = block.textContent;
                        
                        // Robust text extraction:
                        const preRange = document.createRange();
                        preRange.selectNodeContents(block);
                        preRange.setEnd(range.endContainer, range.endOffset);
                        const firstPartRaw = preRange.toString();
                        const secondPartRaw = text.slice(firstPartRaw.length);

                        let firstPart = firstPartRaw;
                        let secondPart = secondPartRaw;

                        // Special handling for Parentheticals
                        if (type === constants.ELEMENT_TYPES.PARENTHETICAL) {
                            // Strip existing brackets from split parts if they exist (though textContent should be clean now)
                            let cleanFirst = firstPart.replace(/^\(+/, '').trim();
                            let cleanSecond = secondPart.replace(/\)+$/, '').trim();
                            
                            // Do NOT re-wrap. CSS handles brackets.
                            firstPart = cleanFirst;
                            secondPart = cleanSecond;
                        }

                        block.textContent = firstPart;
                        const newBlock = this.createBlock(type, secondPart, block); // Create same type
                        
                        // Fix focus for new parenthetical
                        // If we just created (text), cursor should be at index 1 (after '(') or 0? 
                        // Standard focusBlock(newBlock, 0) puts it at start.
                        // For parenthetical, we might want it inside the bracket?
                        // Let's stick to 0 or 1. If it starts with '(', 1 is better.
                        let focusOffset = 0;
                        if (type === constants.ELEMENT_TYPES.PARENTHETICAL && newBlock.textContent.startsWith('(')) {
                            focusOffset = 1;
                        }
                        
                        this.focusBlock(newBlock, focusOffset); 
                        this.app.saveState(true);
                        return;
                    }
                }

                if (nextType) {
                    const newBlock = this.createBlock(nextType, '', block);
                    if (nextType === constants.ELEMENT_TYPES.SLUG) newBlock.textContent = 'INT. ';
                    this.focusBlock(newBlock);
                } else {
                    this.openTypeSelector(block);
                }
                this.app.saveState(true);
                return;
            }

            if (key === 'enter') {
                switch (type) {
                    case constants.ELEMENT_TYPES.ACTION:
                        const prev = block.previousElementSibling;
                        if (prev && prev.classList.contains('sc-action') && prev.textContent.trim() === '') {
                            this.openTypeSelector(block);
                        } else {
                            const newBlock = this.createBlock(constants.ELEMENT_TYPES.ACTION, '', block);
                            this.focusBlock(newBlock);
                        }
                        break;
                    case constants.ELEMENT_TYPES.DIALOGUE:
                    case constants.ELEMENT_TYPES.TRANSITION:
                    case constants.ELEMENT_TYPES.SLUG:
                        this.openTypeSelector(block);
                        break;
                    case constants.ELEMENT_TYPES.CHARACTER:
                        this.triggerAutocomplete(block);
                        break;
                    case constants.ELEMENT_TYPES.PARENTHETICAL:
                        if (block.textContent.trim() === '') {
                            this.setBlockType(block, constants.ELEMENT_TYPES.DIALOGUE);
                            this.focusBlock(block);
                        } else {
                            const newBlock = this.createBlock(constants.ELEMENT_TYPES.DIALOGUE, '', block);
                            this.focusBlock(newBlock);
                        }
                        break;
                }
            } else { 
                if (nextType) {
                    this.setBlockType(block, nextType);
                    this.focusBlock(block);
                } else {
                    this.openTypeSelector(block);
                }
            }
            this.app.saveState(true);
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            handleNav('enter');
        }

        if (e.key === 'Tab' && !e.shiftKey) {
            handleNav('tab');
        }
    }

    handleInput(e) {
        this.app.resetCycleState();
        // Trigger autocomplete for suffixes if user types '(' in Character
        if (e.data === '(') {
            const block = this.getCurrentBlock();
            if (block && this.getBlockType(block) === constants.ELEMENT_TYPES.CHARACTER) {
                this.triggerSuffixAutocomplete(block);
            }
        }
    }

    handleKeyup(e) {
        if (this.popupState.active && this.popupState.type === 'selector') return;
        const block = this.getCurrentBlock();
        if (!block) return;
        const type = this.getBlockType(block);
        const text = block.textContent;

        if ((text.toUpperCase().startsWith('INT.') || text.toUpperCase().startsWith('EXT.')) && type !== constants.ELEMENT_TYPES.SLUG) {
            this.setBlockType(block, constants.ELEMENT_TYPES.SLUG);
        }

        if ([constants.ELEMENT_TYPES.SLUG, constants.ELEMENT_TYPES.CHARACTER, constants.ELEMENT_TYPES.TRANSITION].includes(type)) {
            if (text !== text.toUpperCase()) {
                const sel = window.getSelection();
                const offset = sel.anchorOffset;
                block.textContent = text.toUpperCase();
                try {
                    const range = document.createRange();
                    range.setStart(block.childNodes[0], Math.min(offset, block.textContent.length));
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch(err) {}
            }
        }

        if (type === constants.ELEMENT_TYPES.CHARACTER && !this.popupState.active) {
            if (text.trim().length > 0) {
                 block.removeAttribute('data-suggest');
                 if (e.key.length === 1 || e.key === 'Backspace') this.triggerAutocomplete(block);
            } else {
                this.predictCharacter(block);
            }
        }
        
        // Fix: If text becomes empty while popup is active, close it.
        if (this.popupState.active && text.trim().length === 0) {
            this.closePopups();
        }

        this.updateContext();
        if (type === constants.ELEMENT_TYPES.SLUG) {
            clearTimeout(this.sceneListUpdateTimeout);
            this.sceneListUpdateTimeout = setTimeout(() => this.app.sidebarManager.updateSceneList(), 500);
        }
        this.app.sidebarManager.updateSceneStats();
        this.app.isDirty = true;
        this.app.saveState();
    }
    
    sanitizeBlock(block) {
        const type = this.getBlockType(block);
        let text = block.textContent.trim();
        if (type === constants.ELEMENT_TYPES.PARENTHETICAL) {
             // Remove existing brackets so CSS ::before/::after can handle them without duplication
             let clean = text.replace(/^\(+|\)+$/g, '').trim(); 
             if (block.textContent !== clean) {
                 block.textContent = clean;
             }
        }
        if (type === constants.ELEMENT_TYPES.CHARACTER) this.commitCharacter(text);
    }
    
    getCleanCharacterName(name) {
        if (!name) return '';
        // Remove ANY text in parentheses and trim
        return name.replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
    }

    commitCharacter(name) {
        const clean = this.getCleanCharacterName(name);
        if (clean.length > 1) this.app.characters.add(clean);
    }

    predictCharacter(block) {
        const allChars = Array.from(this.app.characters);
        let prev = block.previousElementSibling;
        let lastSpeaker = null;
        
        while (prev) {
            if (prev.classList.contains(constants.ELEMENT_TYPES.CHARACTER)) {
                lastSpeaker = this.getCleanCharacterName(prev.textContent);
                break;
            }
            prev = prev.previousElementSibling;
        }
        
        let suggestedChar = null;
        if (lastSpeaker) {
            prev = prev ? prev.previousElementSibling : null; 
            while(prev) {
                if (prev.classList.contains(constants.ELEMENT_TYPES.CHARACTER)) {
                    const name = this.getCleanCharacterName(prev.textContent.trim());
                    if (name !== lastSpeaker && name.length > 0) {
                        suggestedChar = name;
                        break;
                    }
                }
                prev = prev.previousElementSibling;
            }
            if (!suggestedChar && allChars.length > 0) suggestedChar = allChars.find(c => c !== lastSpeaker);
        }
        if (suggestedChar) block.setAttribute('data-suggest', suggestedChar);
    }

    isCharacterUsed(name) {
        const cleanName = this.getCleanCharacterName(name);
        if (!cleanName) return false;
        // Check if character appears in the script
        const charBlocks = this.app.editor.querySelectorAll(`.${constants.ELEMENT_TYPES.CHARACTER}`);
        for (const block of charBlocks) {
            if (this.getCleanCharacterName(block.textContent) === cleanName) {
                return true;
            }
        }
        return false;
    }

    triggerSuffixAutocomplete(block) {
        // Find existing partial suffix? e.g. "JOHN (V"
        const text = block.textContent;
        const openParenIndex = text.lastIndexOf('(');
        if (openParenIndex === -1) return;
        
        const partial = text.substring(openParenIndex + 1).toUpperCase();
        const options = constants.CHARACTER_SUFFIXES
            .filter(s => s.startsWith(partial))
            .map(s => `(${s})`);
            
        if (options.length > 0) {
            this.showPopup('suffix', block, options);
        }
    }

    triggerAutocomplete(block) {
        let input = block.textContent.toUpperCase();
        // Check if we are inside a suffix
        if (input.includes('(')) {
            // Already typing suffix, let suffix logic handle or just ignore standard char autocomplete
            return; 
        }
        input = input.trim();
        
        const allChars = Array.from(this.app.characters);
        let options = allChars.filter(c => c.startsWith(input) && c !== input);
        if (options.length > 0) this.showPopup('auto', block, options);
        else this.closePopups();
    }

    openTypeSelector(block) { this.showPopup('selector', block, Object.values(constants.ELEMENT_TYPES)); }

    showPopup(type, block, options) {
        if (document.body.classList.contains('mobile-view')) return;
        this.popupState = { active: true, type: type, selectedIndex: 0, options: options, targetBlock: block };
        
        // Decide which menu DOM to use. 'auto' and 'suffix' can share one, or reuse autoMenu
        const menu = (type === 'auto' || type === 'suffix') ? this.autoMenu : this.typeMenu;
        menu.innerHTML = '';
        
        options.forEach((opt, idx) => {
            const div = document.createElement('div');
            div.className = `menu-item ${idx === 0 ? 'selected' : ''}`;
            
            if (type === 'auto') {
                 // Character Autocomplete with potential Delete button
                 div.style.display = 'flex';
                 div.style.justifyContent = 'space-between';
                 div.style.alignItems = 'center';
                 
                 const span = document.createElement('span');
                 span.textContent = opt;
                 div.appendChild(span);

                 // Check if unused
                 if (!this.isCharacterUsed(opt)) {
                     const delBtn = document.createElement('span');
                     delBtn.innerHTML = '<i class="fas fa-times"></i>';
                     delBtn.title = "Remove from database (Right Arrow)";
                     delBtn.style.color = '#ef4444'; // Red-500
                     delBtn.style.cursor = 'pointer';
                     delBtn.style.padding = '0 6px';
                     delBtn.style.fontSize = '0.8em';
                     delBtn.style.opacity = '0.6';
                     
                     delBtn.onmouseover = () => delBtn.style.opacity = '1';
                     delBtn.onmouseout = () => delBtn.style.opacity = '0.6';

                     delBtn.onclick = (e) => {
                         e.stopPropagation();
                         this.app.characters.delete(opt);
                         // Triggering autocomplete again will refresh the list
                         // We need to keep focus on input? triggerAutocomplete uses textContent.
                         this.triggerAutocomplete(block);
                     };
                     
                     div.appendChild(delBtn);
                     div.dataset.deletable = "true";
                     div.dataset.charName = opt;
                 }
                 div.onclick = () => { this.popupState.selectedIndex = idx; this.popupSelect(); };

            } else if (type === 'selector') {
                const label = document.createElement('span');
                label.textContent = constants.TYPE_LABELS[opt];
                div.appendChild(label);
                const key = Object.keys(constants.TYPE_SHORTCUTS).find(k => constants.TYPE_SHORTCUTS[k] === opt);
                if (key) {
                    const k = document.createElement('span');
                    k.className = 'shortcut-key';
                    k.textContent = key.toUpperCase();
                    div.appendChild(k);
                }
                div.onclick = () => { this.popupState.selectedIndex = idx; this.popupSelect(); };
            } else {
                div.textContent = opt;
                div.onclick = () => { this.popupState.selectedIndex = idx; this.popupSelect(); };
            }

            menu.appendChild(div);
        });

        const rect = block.getBoundingClientRect();
        const parentRect = document.getElementById('editor-wrapper').getBoundingClientRect();
        menu.style.display = 'block';
        menu.style.top = (rect.bottom - parentRect.top) + 'px';
        menu.style.left = (rect.left - parentRect.left) + 'px';
    }

    popupNavigate(dir) {
        const menu = (this.popupState.type === 'auto' || this.popupState.type === 'suffix') ? this.autoMenu : this.typeMenu;
        const items = menu.querySelectorAll('.menu-item');
        items[this.popupState.selectedIndex].classList.remove('selected');
        this.popupState.selectedIndex = (this.popupState.selectedIndex + dir + items.length) % items.length;
        const newItem = items[this.popupState.selectedIndex];
        newItem.classList.add('selected');
        newItem.scrollIntoView({ block: 'nearest' });
    }

    popupSelect() {
        if (!this.popupState.active) return;
        const value = this.popupState.options[this.popupState.selectedIndex];
        const block = this.popupState.targetBlock;
        
        if (this.popupState.type === 'auto') {
            block.textContent = value;
            block.removeAttribute('data-suggest');
            this.commitCharacter(value);
            this.focusBlock(block);
        } else if (this.popupState.type === 'suffix') {
            // Append suffix to name properly
            let text = block.textContent;
            const openParenIndex = text.lastIndexOf('(');
            if (openParenIndex !== -1) {
                block.textContent = text.substring(0, openParenIndex) + value; // value includes parens
            } else {
                block.textContent = text + ' ' + value;
            }
            this.focusBlock(block);
        } else {
            this.setBlockType(block, value);
            this.focusBlock(block);
        }
        this.app.saveState(true);
        this.closePopups();
    }

    closePopups() {
        this.popupState.active = false;
        this.autoMenu.style.display = 'none';
        this.typeMenu.style.display = 'none';
        if (this.app.sidebarManager) {
            this.app.sidebarManager.hideIconPickerMenu();
        } else {
             document.getElementById('icon-picker-menu').style.display = 'none';
        }
    }

    createBlock(type, text = '', insertAfterNode = null) {
        const div = document.createElement('div');
        div.className = `script-line ${type}`;
        div.dataset.lineId = `line-${Math.random().toString(36).substring(2, 11)}`;
        div.textContent = text;
        if (insertAfterNode && insertAfterNode.parentNode === this.app.editor) this.app.editor.insertBefore(div, insertAfterNode.nextSibling);
        else this.app.editor.appendChild(div);
        if (type === constants.ELEMENT_TYPES.CHARACTER && text === '') this.predictCharacter(div);
        return div;
    }

    focusBlock(block, offset = -1) {
        if (!block) return;
        const range = document.createRange();
        const sel = window.getSelection();
        if (block.childNodes.length === 0) block.appendChild(document.createTextNode(''));
        
        if (offset === -1) {
            range.selectNodeContents(block);
            range.collapse(false); 
        } else {
            const textNode = block.firstChild;
            if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                const length = textNode.textContent.length;
                range.setStart(textNode, Math.min(offset, length));
                range.collapse(true);
            }
        }
        
        sel.removeAllRanges();
        sel.addRange(range);
        this.updateContext();
        block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    getCurrentBlock() {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            let node = sel.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === 3) node = node.parentNode;
            if (node.classList.contains('script-line')) return node;
            return node.closest('.script-line');
        }
        return null;
    }

    getBlockType(block) {
        for (const type of Object.values(constants.ELEMENT_TYPES)) if (block.classList.contains(type)) return type;
        return constants.ELEMENT_TYPES.ACTION;
    }

    setBlockType(block, newType) {
        Object.values(constants.ELEMENT_TYPES).forEach(t => block.classList.remove(t));
        block.classList.add(newType);
        if (newType === constants.ELEMENT_TYPES.CHARACTER) {
            if (block.textContent.trim() === '') this.predictCharacter(block);
        }
        this.updateContext();
    }
    
    manualTypeChangeZD(newType) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const range = sel.getRangeAt(0);
        const startBlock = range.startContainer.nodeType === 3 ? range.startContainer.parentNode.closest('.script-line') : range.startContainer.closest('.script-line');
        const endBlock = range.endContainer.nodeType === 3 ? range.endContainer.parentNode.closest('.script-line') : range.endContainer.closest('.script-line');

        if (!startBlock || !endBlock) return;

        let blocksToChange = [];
        if (startBlock === endBlock) {
            blocksToChange.push(startBlock);
        } else {
            let current = startBlock;
            while (current && current !== endBlock.nextElementSibling) {
                if (current.matches('.script-line')) {
                    blocksToChange.push(current);
                }
                current = current.nextElementSibling;
            }
        }
        
        blocksToChange.forEach(block => {
            this.setBlockType(block, newType);
        });

        this.app.editor.focus();
        this.app.saveState(true);
        this.updateContext();
    }

    // --- Collaboration Methods ---
    toggleReadOnly(isReadOnly) {
        this.app.editor.contentEditable = !isReadOnly;
        if (isReadOnly) {
            this.app.editor.classList.add('editor-locked');
            this.closePopups();
        } else {
            this.app.editor.classList.remove('editor-locked');
        }
    }

    getSnapshot() {
        // Return full script state
        return this.app.exportToJSONStructure();
    }

    applySnapshot(data, isSoft = false, animate = false, activeLineId = null) {
        // Restore full script state
        if (isSoft) {
             this.app.importJSON(data, true, animate, activeLineId); 
        } else {
             this.app.importJSON(data, true, animate, activeLineId); 
        }
        
        // Persist the synced state
        this.app.save();
    }
}

```

5.7 `assets/js-mod/ScrollbarManager.js`
- Scrollbar styling/toggle helpers.

```js
export class ScrollbarManager {
    constructor(element) {
        if (typeof element === 'string') {
            this.element = document.querySelector(element);
        } else {
            this.element = element;
        }

        if (!this.element) {
            // Silently fail if element not found, as some might be optional
            return;
        }

        this.scrollTimeout = null;
        this.init();
    }

    init() {
        this.element.addEventListener('scroll', () => this.handleScroll());
    }

    handleScroll() {
        // Add the scrolling class to show the scrollbar
        if (!this.element.classList.contains('scrolling')) {
            this.element.classList.add('scrolling');
        }

        // Clear the previous timeout if it exists
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Set a new timeout to hide the scrollbar
        this.scrollTimeout = setTimeout(() => {
            this.element.classList.remove('scrolling');
        }, 1500); // Hide after 1.5 seconds
    }
}

```

5.8 `assets/js-mod/StorageManager.js`
- Local persistence (IndexedDB) and backup handling.

```js
import { IDBHelper } from './IDBHelper.js';

export class StorageManager {
    constructor(app) {
        this.app = app;
        this.storageKey = 'sfss_scripts'; // Kept only for key reference if needed
        this.activeScriptKey = 'sfss_active_script_id';
        this.scriptsDB = new IDBHelper('SFSSDB', 'scripts', 3);
        this.pendingSaves = {};
        this.saveDelay = 2000; // 2 seconds debounce for IDB write
    }

    async init() {
        // Migration logic removed as requested.
        let activeScriptId = this.getActiveScriptId();

        // 1. FASTEST: Check if active script is in LocalStorage.
        // If so, return immediately to allow app to boot without waiting for IDB.
        if (activeScriptId && localStorage.getItem(`sfss_autosave_${activeScriptId}`)) {
            return activeScriptId;
        }

        const scripts = await this.getAllScripts();
        
        // If we have an active ID but it's not in the DB, or if no active ID,
        // pick the first one or create a new one.
        if (!activeScriptId || !scripts[activeScriptId]) {
            const scriptIds = Object.keys(scripts);
            if (scriptIds.length > 0) {
                activeScriptId = scriptIds[0];
            } else {
                // No scripts at all? Create a default one
                const newScript = this.createNewScript();
                delete newScript.isNew;
                await this.saveScript(newScript.id, newScript.content);
                activeScriptId = newScript.id;
            }
            this.setActiveScriptId(activeScriptId);
        }
        return activeScriptId;
    }

    // Returns dictionary { [id]: scriptObject } to match old API
    async getAllScripts() {
        try {
            const allScriptsArray = await this.scriptsDB.getAll();
            const scriptsDict = {};
            if (allScriptsArray && Array.isArray(allScriptsArray)) {
                allScriptsArray.forEach(script => {
                    scriptsDict[script.id] = script;
                });
            }

            // Merge in unsaved changes from LocalStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sfss_autosave_')) {
                    const id = key.replace('sfss_autosave_', '');
                    try {
                        const localData = JSON.parse(localStorage.getItem(key));
                        // If IDB has it, merge if newer. If not, add it.
                        if (scriptsDict[id]) {
                            if (new Date(localData.lastSavedAt) > new Date(scriptsDict[id].lastSavedAt)) {
                                scriptsDict[id].content = localData.content;
                                scriptsDict[id].lastSavedAt = localData.lastSavedAt;
                            }
                        } else {
                            // Only in LS
                            scriptsDict[id] = {
                                id: id,
                                content: localData.content,
                                lastSavedAt: localData.lastSavedAt,
                                createdAt: localData.lastSavedAt, // Estimate
                                lastBackupAt: null
                            };
                        }
                    } catch(e) {}
                }
            });

            return scriptsDict;
        } catch (e) {
            console.error("Error fetching scripts:", e);
            return {};
        }
    }

    async getScript(scriptId) {
        // 1. Check LocalStorage (Fastest / Newest)
        const localRaw = localStorage.getItem(`sfss_autosave_${scriptId}`);
        let localScript = null;
        if (localRaw) {
            try {
                localScript = JSON.parse(localRaw);
            } catch(e) {}
        }

        // 2. Check IDB
        let dbScript = null;
        try {
            dbScript = await this.scriptsDB.get(scriptId);
        } catch(e) {
            console.error("Error reading from IDB", e);
        }

        // 3. Reconcile
        if (localScript && dbScript) {
            // If LocalStorage is newer, use its content but keep IDB metadata
            if (new Date(localScript.lastSavedAt) > new Date(dbScript.lastSavedAt)) {
                return {
                    ...dbScript,
                    content: localScript.content,
                    lastSavedAt: localScript.lastSavedAt
                };
            }
            return dbScript;
        }

        // If only in LS
        if (localScript) {
             return {
                id: scriptId,
                content: localScript.content,
                lastSavedAt: localScript.lastSavedAt,
                createdAt: localScript.lastSavedAt, // Estimate
                lastBackupAt: null
            };
        }

        return dbScript;
    }

    async saveScript(scriptId, scriptContent) {
        const timestamp = new Date().toISOString();
        
        // 1. Fast Path: Save to LocalStorage immediately
        try {
            const localData = {
                id: scriptId,
                content: scriptContent,
                lastSavedAt: timestamp,
                dirty: true
            };
            localStorage.setItem(`sfss_autosave_${scriptId}`, JSON.stringify(localData));
        } catch (e) {
            console.warn("LocalStorage Error (Quota?):", e);
            // Fallback: Write to IDB immediately if LS fails
             return this._persistToIDB(scriptId, scriptContent, timestamp);
        }

        // 2. Slow Path: Debounce IDB write
        if (this.pendingSaves[scriptId]) {
            clearTimeout(this.pendingSaves[scriptId]);
        }

        this.pendingSaves[scriptId] = setTimeout(() => {
            this._persistToIDB(scriptId, scriptContent, timestamp);
            delete this.pendingSaves[scriptId];
        }, this.saveDelay);
    }

    async _persistToIDB(scriptId, scriptContent, timestamp) {
        try {
            let script = await this.scriptsDB.get(scriptId);
            if (!script) {
                script = {};
                script.createdAt = timestamp || new Date().toISOString();
            }
            
            script.id = scriptId;
            script.content = scriptContent;
            script.lastSavedAt = timestamp || new Date().toISOString();

            await this.scriptsDB.put(script);
        } catch (e) {
            console.error("Failed to save script to IDB:", e);
        }
    }

    async deleteScript(scriptId) {
        await this.scriptsDB.delete(scriptId);
        localStorage.removeItem(`sfss_autosave_${scriptId}`);
        
        if (this.pendingSaves[scriptId]) {
            clearTimeout(this.pendingSaves[scriptId]);
            delete this.pendingSaves[scriptId];
        }
        
        let activeId = this.getActiveScriptId();
        let nextId = activeId;

        if (activeId === scriptId) {
            const scripts = await this.getAllScripts();
            const remainingIds = Object.keys(scripts);
            if (remainingIds.length > 0) {
                nextId = remainingIds[0];
            } else {
                const newScript = this.createNewScript();
                delete newScript.isNew;
                await this.saveScript(newScript.id, newScript.content);
                nextId = newScript.id;
            }
            this.setActiveScriptId(nextId);
        }
        return nextId;
    }

    createNewScript() {
        // Do not save to DB yet. Just return a structure.
        const newId = `script-${Date.now()}`;
        const date = new Date();
        const dateStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false }).replace(',', '');
        
        return {
            id: newId,
            createdAt: date.toISOString(),
            lastBackupAt: null,
            lastSavedAt: date.toISOString(),
            content: {
                meta: { title: `Untitled ${dateStr}`, author: '', contact: '' },
                sceneMeta: {},
                blocks: [
                    { type: 'sc-slug', text: 'INT. ', id: `line-${Math.random().toString(36).substring(2, 11)}` }
                ],
                characters: []
            },
            isNew: true
        };
    }

    getActiveScriptId() {
        return localStorage.getItem(this.activeScriptKey);
    }

    setActiveScriptId(scriptId) {
        localStorage.setItem(this.activeScriptKey, scriptId);
    }

    async updateBackupTimestamp(scriptId) {
        const script = await this.getScript(scriptId);
        if (script) {
            script.lastBackupAt = new Date().toISOString();
            await this.scriptsDB.put(script);
        }
    }
}
```

5.9 `assets/js-mod/ReportsManager.js`
- Report generation data layer (counts, character lists).

```js
import * as constants from './Constants.js';
import { PageRenderer } from './PageRenderer.js';

export class ReportsManager {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('reports-modal');
        this.closeBtn = document.getElementById('reports-close-btn');
        this.charSelectContainer = document.getElementById('report-char-select-container');
        this.charSelect = document.getElementById('report-char-select');
        this.outputArea = document.getElementById('report-output');
        this.settingsArea = document.getElementById('report-settings');
        this.downloadTxtBtn = document.getElementById('report-download-txt-btn');
        this.downloadPdfBtn = document.getElementById('report-download-pdf-btn');
        
        this.currentReportData = null; 
        this.activeType = 'script';
        this.charColors = {};

        this.init();
    }

    init() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        
        if (this.downloadTxtBtn) this.downloadTxtBtn.addEventListener('click', () => this.downloadTxt());
        if (this.downloadPdfBtn) this.downloadPdfBtn.addEventListener('click', () => this.printReport());

        const toggleBtns = this.settingsArea.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeType = btn.dataset.value;
                this.updateUIForType();
            });
        });

        if (this.charSelect) {
            this.charSelect.addEventListener('change', () => {
                this.renderPlaceholder();
                this.downloadTxtBtn.classList.add('hidden');
                this.downloadPdfBtn.classList.add('hidden');
            });
        }

        this.modal.addEventListener('click', (e) => {
            if (e.target.id === 'reports-generate-btn') {
                this.generate();
            }
        });
    }

    open() {
        if (document.body.classList.contains('mobile-view')) this.app.sidebarManager.toggleMobileMenu();
        this.modal.classList.remove('hidden');
        this.resetUI();
        this.populateCharacterSelect();
        this.app.pushHistoryState('reports');
    }

    close() {
        this.modal.classList.add('hidden');
        this.outputArea.innerHTML = '';
        this.downloadTxtBtn.classList.add('hidden');
        this.downloadPdfBtn.classList.add('hidden');
    }

    resetUI() {
        this.activeType = 'script';
        const toggleBtns = this.settingsArea.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(b => b.classList.toggle('active', b.dataset.value === 'script'));
        
        this.updateUIForType();
        this.renderPlaceholder();
        this.currentReportData = null;
        this.downloadTxtBtn.classList.add('hidden');
        this.downloadPdfBtn.classList.add('hidden');
    }

    renderPlaceholder() {
        this.outputArea.innerHTML = `
            <div class="report-placeholder placeholder-container">
                <i class="fas fa-chart-pie fa-3x placeholder-icon"></i>
                <button id="reports-generate-btn" class="modal-btn-primary">Generate Report</button>
            </div>
        `;
    }

    updateUIForType() {
        if (this.activeType === 'character') {
            this.charSelectContainer.classList.remove('hidden');
        } else {
            this.charSelectContainer.classList.add('hidden');
        }
        this.renderPlaceholder();
        this.downloadTxtBtn.classList.add('hidden');
        this.downloadPdfBtn.classList.add('hidden');
    }

    populateCharacterSelect() {
        this.charSelect.innerHTML = '';
        const chars = Array.from(this.app.characters).sort();
        chars.forEach(char => {
            const option = document.createElement('option');
            option.value = char;
            option.textContent = char;
            this.charSelect.appendChild(option);
        });
    }

    generate() {
        this.outputArea.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <div class="loader-spinner"></div>
                <div class="loader-text">Analyzing Script...</div>
            </div>
        `;

        this.generateCharacterColors();

        setTimeout(() => {
            let content = '';
            let reportTitle = '';

            try {
                if (this.activeType === 'script') {
                    const data = this.calculateScriptStats();
                    content = this.renderScriptReport(data);
                    this.currentReportData = this.formatScriptReportTxt(data);
                    reportTitle = 'Script Report';
                } else if (this.activeType === 'character') {
                    const charName = this.charSelect.value;
                    if (!charName) throw new Error("Please select a character.");
                    const data = this.calculateCharacterStats(charName);
                    content = this.renderCharacterReport(data);
                    this.currentReportData = this.formatCharacterReportTxt(data);
                    reportTitle = `${charName} Analysis`;
                }

                this.outputArea.innerHTML = content;
                this.downloadTxtBtn.dataset.filename = `${reportTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
                this.downloadTxtBtn.classList.remove('hidden');
                this.downloadPdfBtn.classList.remove('hidden');
            } catch (e) {
                console.error("Report Generation Error:", e);
                this.outputArea.innerHTML = `<div class="report-error">Error: ${e.message}</div>`;
            }
        }, 100);
    }

    generateCharacterColors() {
        const chars = Array.from(this.app.characters).sort();
        const isDark = document.documentElement.classList.contains('dark-mode');
        const saturation = isDark ? '65%' : '55%'; 
        const lightness = isDark ? '60%' : '45%';

        chars.forEach((char, index) => {
            const hue = Math.floor((index * 137.508) % 360);
            this.charColors[char] = `hsl(${hue}, ${saturation}, ${lightness})`;
        });
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\\]/g, '\\$&');
    }

    _getSourceBlocks() {
        if (this.app.treatmentManager.isActive && this.app.scriptData?.blocks) {
            // If in treatment mode, create DOM nodes in memory from scriptData
            const fragment = document.createDocumentFragment();
            this.app.scriptData.blocks.forEach(blockData => {
                const div = document.createElement('div');
                div.className = `script-line ${blockData.type}`;
                div.dataset.lineId = blockData.id;
                div.textContent = blockData.text;
                fragment.appendChild(div);
            });
            return Array.from(fragment.children);
        } else {
            // Otherwise, use the live editor DOM
            return Array.from(this.app.editor.querySelectorAll('.script-line'));
        }
    }

    getScenesWithGeometrics() {
        const renderer = new PageRenderer();
        const dummyContainer = document.createElement('div');
        Object.assign(dummyContainer.style, { position: 'absolute', left: '-9999px', width: '8.5in' });
        document.body.appendChild(dummyContainer);
        
        const sourceBlocks = this._getSourceBlocks();
        renderer.render(sourceBlocks, dummyContainer, { showSceneNumbers: true });
        
        const totalPages = dummyContainer.querySelectorAll('.page').length;
        const renderedPages = Array.from(dummyContainer.querySelectorAll('.page'));
        const sceneGeometries = [];
        let currentGeo = null;
        
        renderedPages.forEach((page, pageIdx) => {
            const wrapper = page.querySelector('.content-wrapper');
            Array.from(wrapper.children).forEach(node => {
                if (node.classList.contains(constants.ELEMENT_TYPES.SLUG)) {
                    if (currentGeo) sceneGeometries.push(currentGeo);
                    currentGeo = { heightPx: 0, pageStart: pageIdx + 1 };
                }
                if (currentGeo) currentGeo.heightPx += node.offsetHeight || 16;
            });
        });
        if (currentGeo) sceneGeometries.push(currentGeo);
        document.body.removeChild(dummyContainer);

        const PAGE_CONTENT_H = renderer.CONTENT_HEIGHT_PX || (9 * 96);
        return {
            totalPages,
            geometries: sceneGeometries.map(geo => ({
                ...geo,
                eighths: Math.max(1, Math.round((geo.heightPx / PAGE_CONTENT_H) * 8))
            }))
        };
    }

    calculateScriptStats() {
        const geoData = this.getScenesWithGeometrics();
        
        const stats = {
            totalPages: geoData.totalPages,
            totalScenes: 0,
            totalWords: 0,
            totalEighths: 0,
            intExt: { INT: 0, EXT: 0,OTHER: 0 },
            timeOfDay: { DAY: 0, NIGHT: 0, OTHER: 0 },
            elements: { Action: 0, Dialogue: 0, Character: 0, Slug: 0, Transition: 0, Parenthetical: 0 },
            elementWords: { Action: 0, Dialogue: 0 },
            scenes: [],
            monologues: [],
            longestScene: null,
            characters: {} 
        };

        const sourceBlocks = this._getSourceBlocks();
        
        const allChars = Array.from(this.app.characters).filter(c => c.length > 0);
        const charRegex = allChars.length > 0 
            ? new RegExp(`\\b(${allChars.map(c => this.escapeRegExp(c)).join('|')})\\b`, 'gi') 
            : null;

        let currentScene = null;
        let globalSceneIndex = 0;
        let lastSpeaker = null;

        allChars.forEach(c => {
            stats.characters[c] = { 
                name: c, speakingScenes: 0, nonSpeakingScenes: 0, words: 0 
            };
        });

        const finalizeScene = () => {
            if (currentScene) {
                stats.scenes.push(currentScene);
                currentScene.speakingCharacters.forEach(c => {
                    if (stats.characters[c]) stats.characters[c].speakingScenes++;
                });
                currentScene.mentionedCharacters.forEach(c => {
                    if (!currentScene.speakingCharacters.has(c)) {
                        if (stats.characters[c]) stats.characters[c].nonSpeakingScenes++;
                    }
                });
            }
        };

        sourceBlocks.forEach(block => {
            const type = this.app.editorHandler.getBlockType(block);
            const text = block.textContent;
            const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
            stats.totalWords += wordCount;

            const simpleType = type.replace('sc-', '');
            const readableType = simpleType.charAt(0).toUpperCase() + simpleType.slice(1);
            if (stats.elements[readableType] !== undefined) stats.elements[readableType]++;
            
            if (type === constants.ELEMENT_TYPES.ACTION) {
                stats.elementWords.Action += wordCount;
                if (currentScene && charRegex) {
                    let match;
                    charRegex.lastIndex = 0;
                    while ((match = charRegex.exec(text)) !== null) {
                        const matchedName = match[0].toUpperCase();
                        const canonicalName = this.app.editorHandler.getCleanCharacterName(matchedName);
                        if (canonicalName && stats.characters[canonicalName]) {
                             currentScene.mentionedCharacters.add(canonicalName);
                        }
                    }
                }
            }

            if (type === constants.ELEMENT_TYPES.DIALOGUE) {
                stats.elementWords.Dialogue += wordCount;
                if (wordCount > 30 && lastSpeaker) {
                    stats.monologues.push({ 
                        speaker: lastSpeaker, 
                        words: wordCount, 
                        text: text.substring(0, 50) + '...', 
                        scene: globalSceneIndex + 1 
                    });
                }
                if (lastSpeaker && stats.characters[lastSpeaker]) {
                    stats.characters[lastSpeaker].words += wordCount;
                }
            }

            if (type === constants.ELEMENT_TYPES.SLUG) {
                finalizeScene();
                
                const geo = geoData.geometries[globalSceneIndex] || { eighths: 1, pageStart: '-' };
                const upperText = text.toUpperCase();
                
                if (upperText.includes('INT.')) stats.intExt.INT++;
                else if (upperText.includes('EXT.')) stats.intExt.EXT++;
                else stats.intExt.OTHER++;

                if (upperText.includes('DAY')) stats.timeOfDay.DAY++;
                else if (upperText.includes('NIGHT')) stats.timeOfDay.NIGHT++;
                else stats.timeOfDay.OTHER++;

                currentScene = {
                    number: globalSceneIndex + 1,
                    title: text,
                    eighths: geo.eighths,
                    pageStart: geo.pageStart,
                    speakingCharacters: new Set(),
                    mentionedCharacters: new Set()
                };
                globalSceneIndex++;
                lastSpeaker = null;
            }

            if (currentScene) {
                if (type === constants.ELEMENT_TYPES.CHARACTER) {
                    const name = this.app.editorHandler.getCleanCharacterName(text);
                    if (name) {
                        currentScene.speakingCharacters.add(name);
                        lastSpeaker = name;
                    }
                }
            }
        });

        finalizeScene();
        stats.totalScenes = stats.scenes.length;
        stats.scenes.forEach(s => stats.totalEighths += s.eighths);
        
        stats.scenes.sort((a, b) => a.number - b.number);
        stats.longestScene = [...stats.scenes].sort((a, b) => b.eighths - a.eighths)[0];
        stats.monologues.sort((a, b) => b.words - a.words);

        return stats;
    }

    calculateCharacterStats(targetName) {
        const stats = {
            name: targetName,
            totalWords: 0,
            totalSpeeches: 0,
            scenesSpeaking: 0,
            scenesNonSpeaking: 0,
            interactions: {},
            scenes: [ ], 
            monologues: []
        };

        const sourceBlocks = this._getSourceBlocks();
        let currentScene = null;
        let lastSpeaker = null;
        let globalSceneIndex = 0;
        const targetNameRegex = new RegExp(`\\b${this.escapeRegExp(targetName)}\\b`, 'i');

        const flushScene = () => {
            if (currentScene) {
                if (currentScene.speaking) {
                    stats.scenesSpeaking++;
                    stats.scenes.push({ ...currentScene, type: 'speaking' });
                } else if (currentScene.mentioned) {
                    stats.scenesNonSpeaking++;
                    stats.scenes.push({ ...currentScene, type: 'non-speaking' });
                }
            }
        };

        sourceBlocks.forEach(block => {
            const type = this.app.editorHandler.getBlockType(block);
            const text = block.textContent;

            if (type === constants.ELEMENT_TYPES.SLUG) {
                flushScene();
                globalSceneIndex++;
                currentScene = { 
                    number: globalSceneIndex, 
                    title: text, 
                    words: 0, 
                    speaking: false,
                    mentioned: false
                };
                lastSpeaker = null;
            }

            if (currentScene) {
                if (type === constants.ELEMENT_TYPES.CHARACTER) {
                    const name = this.app.editorHandler.getCleanCharacterName(text);
                    if (name === targetName) {
                        currentScene.speaking = true;
                        stats.totalSpeeches++;
                        if (lastSpeaker && lastSpeaker !== targetName) {
                            stats.interactions[lastSpeaker] = (stats.interactions[lastSpeaker] || 0) + 1;
                        }
                    } else if (lastSpeaker === targetName) {
                        stats.interactions[name] = (stats.interactions[name] || 0) + 1;
                    }
                    lastSpeaker = name;
                } 
                else if (type === constants.ELEMENT_TYPES.DIALOGUE) {
                    if (lastSpeaker === targetName) {
                        const w = text.trim().split(/\s+/).length;
                        stats.totalWords += w;
                        currentScene.words += w;
                        if (w > 30) {
                            stats.monologues.push({ words: w, text: text.substring(0, 50) + '...', scene: currentScene.number });
                        }
                    }
                }
                else if (type === constants.ELEMENT_TYPES.ACTION) {
                    if (!currentScene.speaking && targetNameRegex.test(text)) {
                        currentScene.mentioned = true;
                    }
                }
            }
        });
        flushScene();

        stats.monologues.sort((a, b) => b.words - a.words);
        return stats;
    }

    renderPieChart(label, data, colors) {
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        let conicStops = [];
        let currentDeg = 0;
        
        Object.entries(data).forEach(([key, val], idx) => {
            const deg = (val / total) * 360;
            const color = colors[idx % colors.length];
            conicStops.push(`${color} ${currentDeg}deg ${currentDeg + deg}deg`);
            currentDeg += deg;
        });

        const chartStyle = `background: conic-gradient(${conicStops.join(', ')}); width: 80px; height: 80px; border-radius: 50%;`;
        const legendHtml = Object.entries(data).map(([key, val], idx) => `
            <div class="chart-legend-row">
                <span class="chart-legend-dot" style="background:${colors[idx % colors.length]};"></span>
                <span>${key} (${Math.round(val/total*100)}%)</span>
            </div>
        `).join('');

        return `
            <div class="chart-container-flex">
                <div style="${chartStyle}"></div>
                <div class="chart-legend-col">${legendHtml}</div>
            </div>
        `;
    }

    renderCharacterBadge(name, isSpeaking) {
        const color = this.charColors[name] || '#666';
        const className = isSpeaking ? 'badge-custom' : 'badge-custom-outline';
        return `<span class="badge ${className}" style="--badge-color: ${color}" title="${isSpeaking ? 'Speaking' : 'Non-Speaking'}">${name}</span>`;
    }

    renderScriptReport(data) {
        const sortedChars = Object.values(data.characters).sort((a, b) => 
            (b.speakingScenes + b.nonSpeakingScenes) - (a.speakingScenes + a.nonSpeakingScenes)
        );

        return `
            <div class="report-container">
                <div class="report-dashboard">
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalPages}</div>
                        <div class="kpi-label">Pages</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalScenes}</div>
                        <div class="kpi-label">Scenes</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${(data.totalWords / 1000).toFixed(1)}k</div>
                        <div class="kpi-label">Words</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${this.formatEighths(data.totalEighths)}</div>
                        <div class="kpi-label">Runtime</div>
                    </div>
                </div>

                <div class="report-grid-2">
                    <div class="report-section">
                        <h3>Breakdown</h3>
                        <div class="flex-justify-between-full flex-wrap-gap-4">
                            <div>
                                <h4 class="report-subtitle-centered">Setting</h4>
                                ${this.renderPieChart('Setting', data.intExt, ['#3b82f6', '#10b981', '#6b7280'])}
                            </div>
                            <div>
                                <h4 class="report-subtitle-centered">Time</h4>
                                ${this.renderPieChart('Time', data.timeOfDay, ['#f59e0b', '#1e293b', '#6b7280'])}
                            </div>
                        </div>
                    </div>

                    <div class="report-section">
                        <h3>Character Statistics</h3>
                        <div class="report-table-scroll-container">
                            <table class="report-table">
                                <thead class="report-table-sticky-thead">
                                    <tr>
                                        <th>Character</th>
                                        <th class="text-center">Speaking</th>
                                        <th class="text-center">Non-Speaking</th>
                                        <th class="text-right">Words</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sortedChars.map(c => `
                                        <tr>
                                            <td class="font-bold" style="color:${this.charColors[c.name]};">${c.name}</td>
                                            <td class="text-center font-mono">${c.speakingScenes}</td>
                                            <td class="text-center font-mono text-faded">${c.nonSpeakingScenes}</td>
                                            <td class="text-right font-mono">${c.words}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="report-section">
                    <h3>Scene Chronology</h3>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width:3%">#</th>
                                <th style="width:8%">Len</th>
                                <th style="width:30%">Slug</th>
                                <th>Characters (Solid=Speaking, Outline=Non-Speaking)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.scenes.map(s => {
                                const badges = [];
                                s.speakingCharacters.forEach(c => badges.push(this.renderCharacterBadge(c, true)));
                                s.mentionedCharacters.forEach(c => {
                                    if(!s.speakingCharacters.has(c)) badges.push(this.renderCharacterBadge(c, false));
                                });
                                return `
                                <tr>
                                    <td class="text-faded text-sm">${s.number}</td>
                                    <td class="font-mono text-sm">${this.formatEighths(s.eighths)}</td>
                                    <td class="font-bold text-sm truncate" title="${s.title}">${s.title}</td>
                                    <td>
                                        <div class="flex-wrap-gap-4">
                                            ${badges.join('')}
                                        </div>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="report-section">
                    <h3>Top Monologues</h3>
                    <div class="report-grid-2">
                        ${data.monologues.slice(0, 4).map(m => `
                             <div class="stat-item monologue-item">
                                <div class="flex-justify-between-full">
                                    <span class="font-bold" style="color:${this.charColors[m.speaker]}">${m.speaker}</span>
                                    <span class="text-faded text-sm">Sc ${m.scene} • ${m.words}w</span>
                                </div>
                                <div class="text-italic-faded">"${m.text}"</div>
                             </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderCharacterReport(data) {
        const sortedInteractions = Object.entries(data.interactions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        return `
            <div class="report-container">
                <div class="report-header">
                    <h2 style="color:${this.charColors[data.name]}">${data.name}</h2>
                    <div class="flex-gap-05">
                         <span class="badge speaking">${data.scenesSpeaking} Speaking Scenes</span>
                         <span class="badge non-speaking">${data.scenesNonSpeaking} Non-Speaking</span>
                    </div>
                </div>

                <div class="report-dashboard">
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalSpeeches}</div>
                        <div class="kpi-label">Speeches</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalWords}</div>
                        <div class="kpi-label">Words</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-value">${data.totalSpeeches ? Math.round(data.totalWords / data.totalSpeeches) : 0}</div>
                        <div class="kpi-label">Words/Speech</div>
                    </div>
                </div>

                <div class="report-grid-2">
                    <div class="report-section">
                        <h3>Top Interactions</h3>
                        <table class="report-table">
                            ${sortedInteractions.map(([name, count]) => `
                                <tr>
                                    <td>${name}</td>
                                    <td class="text-right font-mono">${count} exchanges</td>
                                </tr>
                            `).join('')}
                            ${sortedInteractions.length === 0 ? '<tr><td class="text-faded">No dialogue interactions.</td></tr>' : ''}
                        </table>
                    </div>

                    <div class="report-section">
                         <h3>Stats</h3>
                         <div class="stat-item">
                            <span>Scene Presence</span>
                            <span class="font-mono">${Math.round((data.scenes.length / (this.app.editor.querySelectorAll('.sc-slug').length || 1))*100)}% of Script</span>
                         </div>
                    </div>
                </div>

                <div class="report-section">
                    <h3>Scene Log</h3>
                    <table class="report-table">
                        <thead>
                            <tr>
                                <th style="width:10%">#</th>
                                <th>Slug</th>
                                <th class="text-center">Type</th>
                                <th class="text-right">Words</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.scenes.map(s => `
                                <tr>
                                    <td class="text-faded">${s.number}</td>
                                    <td class="font-bold text-sm truncate" title="${s.title}">${s.title}</td>
                                    <td class="text-center">
                                        <span class="badge ${s.type === 'speaking' ? 'speaking' : 'non-speaking'}">
                                            ${s.type}
                                        </span>
                                    </td>
                                    <td class="text-right font-mono">${s.words}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    formatEighths(e) {
        if (e < 8) return `${e}/8`;
        const p = Math.floor(e/8);
        const rem = e % 8;
        return rem === 0 ? `${p}pg` : `${p} ${rem}/8`;
    }

    formatScriptReportTxt(data) {
        let txt = `SCRIPT REPORT\n`;
        txt += `Pages: ${(data.totalEighths/8).toFixed(2)}\nScenes: ${data.totalScenes}\nWords: ${data.totalWords}\n\n`;
        txt += `CHARACTERS\n`;
        Object.values(data.characters)
            .sort((a,b) => b.words - a.words)
            .forEach(c => {
                txt += `${c.name}: ${c.speakingScenes} spk, ${c.nonSpeakingScenes} non-spk, ${c.words} words\n`;
            });
        txt += `\nSCENES\n`;
        data.scenes.forEach(s => {
            const speaking = Array.from(s.speakingCharacters).join(', ');
            const nonSpeaking = Array.from(s.mentionedCharacters).filter(c => !s.speakingCharacters.has(c)).join(', ');
            txt += `${s.number}. ${s.title} (${this.formatEighths(s.eighths)})\n`;
            if(speaking) txt += `   Speaking: ${speaking}\n`;
            if(nonSpeaking) txt += `   Non-Speaking: ${nonSpeaking}\n`;
        });
        return txt;
    }

    formatCharacterReportTxt(data) {
        let txt = `CHARACTER: ${data.name}\n`;
        txt += `Speeches: ${data.totalSpeeches}\nWords: ${data.totalWords}\nScenes: ${data.scenesSpeaking} (Speaking), ${data.scenesNonSpeaking} (Non-speaking)\n\n`;
        txt += `SCENE LOG\n`;
        data.scenes.forEach(s => {
            txt += `${s.number}. ${s.title} [${s.type.toUpperCase()}] (${s.words} words)\n`;
        });
        return txt;
    }

    downloadTxt() {
        if (!this.currentReportData) return;
        const blob = new Blob([this.currentReportData], {type: 'text/plain;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = this.downloadTxtBtn.dataset.filename || 'report.txt';
        a.click();
    }

    printReport() {
        const content = this.outputArea.innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>Report</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 2rem; color: #333; -webkit-print-color-adjust: exact; }
                    .report-dashboard { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
                    .kpi-card { border: 1px solid #ccc; padding: 1rem; text-align: center; border-radius: 4px; }
                    .kpi-value { font-size: 1.5rem; font-weight: bold; }
                    .report-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
                    th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .badge { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; border: 1px solid #eee; display: inline-block; margin-right: 4px; margin-bottom: 4px; }
                    .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; display: inline-block; vertical-align: bottom; }
                    .text-faded { color: #666; }
                    .font-mono { font-family: monospace; }
                </style>
            </head>
            <body>
                ${content}
                <script>window.onload = function() { window.print(); window.close(); }</script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}
```

5.10 `assets/js-mod/PageRenderer.js`
- Builds paginated screenplay pages for print preview.

```js
import * as constants from './Constants.js';

export class PageRenderer {
    constructor() {
        this.formatting = constants.FORMATTING;
        this.paperConfig = constants.PAPER_CONFIGS.US_LETTER; // Default
        this.updateDimensions();
        
        this.measureContainer = null;
    }

    setPaperSize(sizeName) {
        if (constants.PAPER_CONFIGS[sizeName]) {
            this.paperConfig = constants.PAPER_CONFIGS[sizeName];
            this.updateDimensions();
        }
    }

    updateDimensions() {
        this.dpi = this.formatting.PIXELS_PER_INCH;
        this.lineHeightPx = this.formatting.LINE_HEIGHT_PT * (this.dpi / 72); // pt to px conversion usually 1.333, but user said 12pt = 100% line height. 
        // User spec: 6 lines per inch. 1 inch = 96px. 96/6 = 16px.
        // 12pt font is usually 16px.
        this.lineHeightPx = 16; 

        this.pageHeightPx = this.paperConfig.dimensions.height * this.dpi;
        this.marginTopPx = this.paperConfig.margins.top * this.dpi;
        this.marginBottomPx = this.paperConfig.margins.bottom * this.dpi;
        this.contentHeightPx = this.pageHeightPx - this.marginTopPx - this.marginBottomPx;
        
        // Calculate strict max lines
        this.maxLinesPerPage = Math.floor(this.contentHeightPx / this.lineHeightPx);
    }

    getType(node) {
        for (const type of Object.values(constants.ELEMENT_TYPES)) {
            if (node.classList.contains(type)) return type;
        }
        return constants.ELEMENT_TYPES.ACTION;
    }

    render(sourceNodes, container, options = {}) {
        container.innerHTML = '';
        if (!sourceNodes || sourceNodes.length === 0) return;

        // Ensure container is visible for measurement
        if (container.offsetParent === null) {
            container.classList.remove('hidden');
            container.style.display = 'block';
        }

        container.classList.toggle('show-scene-numbers', !!options.showSceneNumbers);

        let pageIndex = 1;
        let currentPage = this.createPage(container, options, pageIndex);
        let contentWrapper = currentPage.querySelector('.content-wrapper');
        let currentLines = 0; // Tracking lines on current page

        const createNewPage = () => {
            pageIndex++;
            currentPage = this.createPage(container, options, pageIndex);
            contentWrapper = currentPage.querySelector('.content-wrapper');
            currentLines = 0;
            return contentWrapper;
        };

        let i = 0;
        let sceneChronologicalIndex = 0;

        while (i < sourceNodes.length) {
            // 1. Identify the logical block
            let { blockNodes, type, nextIndex } = this.getNextLogicalBlock(sourceNodes, i);
            
            // 2. Measure the block
            let blockHeight = this.measureBlockHeight(blockNodes, contentWrapper);
            let blockLines = Math.ceil(blockHeight / this.lineHeightPx);
            
            // 3. Prepare extra attributes (like scene numbers)
            const extraAttrs = {};
            if (type === constants.ELEMENT_TYPES.SLUG) {
                sceneChronologicalIndex++;
                if (options.showSceneNumbers) {
                    const slugNode = blockNodes[0];
                    const id = slugNode.dataset.lineId;
                    // Use custom number from map if it exists, otherwise fall back to chronological index
                    extraAttrs.sceneNumber = options.sceneNumberMap?.[id] || sceneChronologicalIndex;
                }
            }

            // 4. Check fit
            let linesRemaining = this.maxLinesPerPage - currentLines;

            if (blockLines <= linesRemaining) {
                // IT FITS
                if (type === constants.ELEMENT_TYPES.SLUG) {
                    if (linesRemaining - blockLines < 1) {
                         createNewPage();
                         this.appendBlock(contentWrapper, blockNodes, extraAttrs);
                         currentLines += blockLines;
                    } else {
                        this.appendBlock(contentWrapper, blockNodes, extraAttrs);
                        currentLines += blockLines;
                    }
                } else {
                    this.appendBlock(contentWrapper, blockNodes, extraAttrs);
                    currentLines += blockLines;
                }
                i = nextIndex;
                continue;
            }

            // IT DOESN'T FIT - BREAKING LOGIC
            
            // Case A: Scene Heading
            if (type === constants.ELEMENT_TYPES.SLUG) {
                createNewPage();
                this.appendBlock(contentWrapper, blockNodes, extraAttrs);
                currentLines += blockLines;
                i = nextIndex;
                continue;
            }

            // Case B: Action / General
            if (type === constants.ELEMENT_TYPES.ACTION || type === constants.ELEMENT_TYPES.TRANSITION) {
                 // Try to split text
                 const node = blockNodes[0]; // Action blocks are usually single nodes in this logic
                 const result = this.splitTextNode(node, linesRemaining, contentWrapper, type);
                 
                 if (result.success) {
                     this.appendBlock(contentWrapper, [result.firstPart]);
                     currentLines += result.linesUsed;
                     
                     createNewPage();
                     // The rest becomes the new node to process
                     // We can't just modify sourceNodes[i] because it's a reference to the editor.
                     // We need to insert a temp node into our processing stream or handle it here.
                     // Easier: Handle the second part as if it were the start of a new block, 
                     // but we need to ensure we don't skip the *original* next nodes.
                     // Actually, splitTextNode returns a DOM node. We can just process it.
                     
                     // However, we need to handle the loop. 
                     // The simplest way is to decrement i so we process the "remainder" in the next iteration,
                     // BUT we need to replace sourceNodes[i] with the remainder. 
                     // Since we can't touch sourceNodes (it's the editor content), we need a queue.
                     
                     // BETTER APPROACH: Use a local queue of nodes to process.
                     // For now, let's just recursively handle the overflow or push it to next page if it's small.
                     
                     // If we split, we append the first part. The second part needs to be put on the new page.
                     this.appendBlock(contentWrapper, [result.secondPart]);
                     currentLines += Math.ceil(this.measureBlockHeight([result.secondPart], contentWrapper) / this.lineHeightPx);
                     
                     i = nextIndex; 
                     continue;
                 } else {
                     // Could not split cleanly (orphans/widows), push whole block
                     createNewPage();
                     this.appendBlock(contentWrapper, blockNodes);
                     currentLines += blockLines;
                     i = nextIndex;
                     continue;
                 }
            }

            // Case C: Dialogue (Character + Parenthetical + Dialogue)
            if (type === constants.ELEMENT_TYPES.CHARACTER) {
                // This is a dialogue block.
                // Structure: Character -> (Parenthetical)* -> Dialogue
                
                // Calculate how much space we have.
                // We need to place at least Character + (MORE) line.
                // If we can't fit Character + 1 line of dialogue, push all.
                
                // Let's identify the parts.
                const charNode = blockNodes[0];
                const dialogueNode = blockNodes[blockNodes.length - 1]; // Assuming last is dialogue
                const parentheticals = blockNodes.slice(1, -1);
                
                // Measure Header (Char + Parens)
                const headerNodes = [charNode, ...parentheticals];
                const headerHeight = this.measureBlockHeight(headerNodes, contentWrapper);
                const headerLines = Math.ceil(headerHeight / this.lineHeightPx);
                
                // Space available for dialogue
                const dialogueSpaceLines = linesRemaining - headerLines;
                
                if (dialogueSpaceLines < 2) { 
                    // Need at least 2 lines (1 text + 1 MORE) or just 1 line if it's the end?
                    // Spec says: "Orphans: A single line of Action or Dialogue cannot be left at the bottom of a page."
                    // So we probably want at least 2 lines of dialogue or the whole thing.
                    createNewPage();
                    // Handle (CONT'D)
                    const newCharNode = charNode.cloneNode(true);
                    if (!newCharNode.textContent.includes("(CONT'D)")) {
                         // Only add if not already there (though usually user types it)
                         // Spec says: Insert CHARACTER NAME (CONT'D) at the top of Page B.
                         // We should modify the text content of the clone.
                         newCharNode.textContent = newCharNode.textContent.trim() + " (CONT'D)";
                    }
                    const newBlock = [newCharNode, ...parentheticals.map(p => p.cloneNode(true)), dialogueNode.cloneNode(true)];
                    this.appendBlock(contentWrapper, newBlock);
                    currentLines += Math.ceil(this.measureBlockHeight(newBlock, contentWrapper) / this.lineHeightPx);
                    i = nextIndex;
                    continue;
                }
                
                // We have space for some dialogue. Try to split.
                // We need to reserve 1 line for (MORE).
                const splitResult = this.splitTextNode(dialogueNode, dialogueSpaceLines - 1, contentWrapper, constants.ELEMENT_TYPES.DIALOGUE);
                
                if (splitResult.success && splitResult.firstPart) {
                    // We split successfully.
                    
                    // 1. Append Header
                    this.appendBlock(contentWrapper, headerNodes.map(n => n.cloneNode(true)));
                    
                    // 2. Append First Part
                    this.appendBlock(contentWrapper, [splitResult.firstPart]);
                    
                    // 3. Append (MORE)
                    const moreNode = document.createElement('div');
                    moreNode.className = `script-line ${constants.ELEMENT_TYPES.CHARACTER}`; // Use character style for alignment or specific?
                    // Spec says: "insert (MORE) centered at the bottom of Page A" 
                    // Usually (MORE) is centered relative to the dialogue or page? Standard is centered text, often modeled as Character or Dialogue with special text.
                    // Final Draft uses Character alignment usually, or Centered. 
                    // Let's look at `assets/css/editor.css`... no specific class.
                    // Let's make a manual style or use Character.
                    moreNode.textContent = "(MORE)";
                    moreNode.style.textAlign = "center"; 
                    moreNode.style.width = "100%";
                    moreNode.style.marginLeft = "0";
                    this.appendBlock(contentWrapper, [moreNode]);
                    
                    currentLines = this.maxLinesPerPage; // We filled it effectively
                    
                    // 4. New Page
                    createNewPage();
                    
                    // 5. Append (CONT'D) Header
                    const contCharNode = charNode.cloneNode(true);
                    let cleanName = contCharNode.textContent.replace(/\s*\(CONT'D\)\s*$/, '').trim();
                    contCharNode.textContent = cleanName + " (CONT'D)";
                    
                    this.appendBlock(contentWrapper, [contCharNode]);
                    
                    // 6. Append Second Part
                    this.appendBlock(contentWrapper, [splitResult.secondPart]);
                    currentLines += Math.ceil(this.measureBlockHeight([contCharNode, splitResult.secondPart], contentWrapper) / this.lineHeightPx);
                    
                    i = nextIndex;
                    continue;
                } else {
                    // Can't split cleanly
                    createNewPage();
                     const newCharNode = charNode.cloneNode(true);
                     let cleanName = newCharNode.textContent.replace(/\s*\(CONT'D\)\s*$/, '').trim();
                     newCharNode.textContent = cleanName + " (CONT'D)";
                     const newBlock = [newCharNode, ...parentheticals.map(p => p.cloneNode(true)), dialogueNode.cloneNode(true)];
                    this.appendBlock(contentWrapper, newBlock);
                    currentLines += Math.ceil(this.measureBlockHeight(newBlock, contentWrapper) / this.lineHeightPx);
                    i = nextIndex;
                    continue;
                }
            }
            
            // Fallback
            this.appendBlock(contentWrapper, blockNodes);
            currentLines += blockLines;
            i = nextIndex;
        }
    }

    getNextLogicalBlock(nodes, startIndex) {
        const firstNode = nodes[startIndex];
        const type = this.getType(firstNode);
        const blockNodes = [firstNode];
        let nextIndex = startIndex + 1;

        if (type === constants.ELEMENT_TYPES.CHARACTER) {
            // Include Parentheticals and Dialogue
            while (nextIndex < nodes.length) {
                const nextNode = nodes[nextIndex];
                const nextType = this.getType(nextNode);
                if (nextType === constants.ELEMENT_TYPES.PARENTHETICAL || nextType === constants.ELEMENT_TYPES.DIALOGUE) {
                    blockNodes.push(nextNode);
                    nextIndex++;
                    // If we hit dialogue, we usually stop after it, UNLESS there are multiple dialogue chunks (rare but possible with parentheticals in between)
                    // Standard: Char -> (Paren) -> Dialog -> (Paren) -> Dialog.
                    // We should grab them all as one block usually.
                } else {
                    break;
                }
            }
        } else if (type === constants.ELEMENT_TYPES.SLUG) {
            // Just the slug? Or Slug + Action?
            // "Scene Header cannot be last line".
            // We treat the slug as its own block for measurement, but we handle the "next line" check in the main loop.
        } 
        
        return { blockNodes, type, nextIndex };
    }

    appendBlock(container, nodes, extraAttrs = {}) {
        nodes.forEach(node => {
            const clone = node.cloneNode(true);
            if (extraAttrs.sceneNumber && this.getType(node) === constants.ELEMENT_TYPES.SLUG) {
                clone.setAttribute('data-scene-number-display', extraAttrs.sceneNumber);
                // Removed explicit span injection as requested.
                // Numbering is handled by CSS ::before/::after content: attr(data-scene-number-display)
            }
            container.appendChild(clone);
        });
    }

    measureBlockHeight(nodes, container) {
        if (!this.measureContainer) {
            this.measureContainer = document.createElement('div');
            this.measureContainer.style.position = 'absolute';
            this.measureContainer.style.visibility = 'hidden';
            this.measureContainer.style.height = 'auto';
            this.measureContainer.style.width = '100%'; // Will inherit from parent
            // IMPORTANT: Copy styles relevant to layout
        }
        
        container.appendChild(this.measureContainer);
        this.measureContainer.innerHTML = '';
        nodes.forEach(node => this.measureContainer.appendChild(node.cloneNode(true)));
        
        const height = this.measureContainer.offsetHeight;
        container.removeChild(this.measureContainer);
        return height;
    }
    
    // Alias for backward compatibility
    measureNodeHeight(nodes, container) {
        return this.measureBlockHeight(Array.isArray(nodes) ? nodes : [nodes], container);
    }

    splitTextNode(node, maxLines, container, type) {
        // We need to find the point in the text where it exceeds maxLines.
        // Binary search or word-by-word. Word-by-word is safer for correctness.
        
        const fullText = node.textContent;
        const words = fullText.split(/(\s+)/); // Keep delimiters
        let currentText = "";
        let splitIndex = -1;
        
        // Optimize: Estimate char count? No, stick to measurement.
        
        // Helper to check height
        const checkHeight = (text) => {
            const tempNode = node.cloneNode(false);
            tempNode.textContent = text;
            return Math.ceil(this.measureBlockHeight([tempNode], container) / this.lineHeightPx);
        };

        let low = 0;
        let high = words.length;
        let bestFitIndex = 0;

        // Linear scan might be slow for long paragraphs, but safe. 
        // Let's try to build up.
        
        for (let i = 0; i < words.length; i++) {
            let testText = currentText + words[i];
            let lines = checkHeight(testText);
            
            if (lines > maxLines) {
                // We exceeded. The previous state was the max.
                // However, we need to check for orphans.
                // If the remaining text is just 1 line, we shouldn't split here if possible?
                // Spec: "A single line... cannot be left at the bottom of a page." -> This refers to the orphan on the OLD page? 
                // "Orphans: A single line of Action or Dialogue cannot be left at the bottom of a page."
                // Usually "Orphan" = First line of paragraph at bottom of page. "Widow" = Last line of paragraph at top of page.
                // The spec phrasing is slightly ambiguous. "Cannot be left at the bottom of a page" suggests ORPHAN protection (don't leave 1 line alone at bottom).
                
                // So, if maxLines < 2, we shouldn't put anything? 
                // Or if we split, we must ensure we have at least 2 lines?
                
                // Let's assume strict maxLines limit.
                splitIndex = i; // The word that broke the camel's back
                break;
            }
            currentText = testText;
            bestFitIndex = i + 1;
        }

        if (bestFitIndex === 0 || bestFitIndex === words.length) {
            return { success: false };
        }

        // Check for Widow (Last line alone on next page)
        // If remaining text is short (1 line), we might want to move an extra line to the next page?
        // But we are constrained by maxLines on THIS page. We can't increase space.
        // So we must move the cut point BACKWARDS.
        
        let firstPartText = words.slice(0, splitIndex).join('');
        let secondPartText = words.slice(splitIndex).join('');

        // Measure second part
        // If second part < 2 lines? Spec doesn't explicitly forbid 1 line at TOP of next page (Widow), 
        // but "Orphans... cannot be left at bottom" is explicit.
        // Common practice: Avoid single lines anywhere.
        
        // Let's enforce: First part must be >= 2 lines (if maxLines >= 2). 
        // Since we filled 'maxLines', it is likely >= 2 unless maxLines=1.
        
        // If maxLines=1, we have an orphan by definition. We should not split, just push whole block.
        if (maxLines < 2) return { success: false };

        const node1 = node.cloneNode(false);
        node1.textContent = firstPartText;
        
        const node2 = node.cloneNode(false);
        node2.textContent = secondPartText;
        
        return { success: true, firstPart: node1, secondPart: node2, linesUsed: maxLines };
    }

    createPage(container, options, pageNum) {
        const page = document.createElement('div');
        page.className = 'page';
        if (options.showSceneNumbers) page.classList.add('show-scene-numbers');
        page.dataset.pageNumber = pageNum;
        const suppressMeta = options.hideFirstPageMeta && pageNum === 1;
        
        // Show header if explicit text is provided OR if showDate option is true
        if ((options.headerText || options.showDate) && !suppressMeta) {
            const header = document.createElement('div');
            header.className = 'page-header';
            let text = options.headerText || '';
            
            // Logic handled in SFSS.js: getHeaderText() usually combines title + date if flag is set.
            // But if we want granular control here:
            // Actually, SFSS.js passes `headerText` which ALREADY contains the date if `meta.showDate` is true.
            // So we just need to render it if it's not empty.
            
            // However, the issue description says "#toolbar-date is still not toggling .page-header".
            // This suggests that even if we toggle it, the header might not appear if `headerText` is empty (e.g. no title).
            // We should ensure it renders if showDate is requested, even if title is blank.
            
            // Let's rely on what's passed.
            
            header.textContent = text;
            page.appendChild(header);
        }

        const cw = document.createElement('div');
        cw.className = 'content-wrapper';
        page.appendChild(cw);

        if (options.showPageNumbers !== false) {
             const num = document.createElement('div');
             num.className = 'page-number';
             num.textContent = `${pageNum}.`;
             num.style.display = 'block'; // Force visibility
             page.appendChild(num);
        }

        if (suppressMeta) {
            page.classList.add('page--suppress-meta');
        }

        container.appendChild(page);
        return page;
    }
}

```

5.11 `assets/js-mod/TreatmentRenderer.js`
- Treatment-mode DOM rendering (cards, gallery, stats).

```js
import * as constants from './Constants.js';

export class TreatmentRenderer {
    constructor(app) {
        this.app = app;
        this.container = null;
    }

    render(container) {
        // Legacy entry point
    }
    
    refreshScene(sceneId) {
        if (!this.container) return;
        const oldBlock = this.container.querySelector(`.treatment-scene-block[data-scene-id="${sceneId}"]`);
        if (!oldBlock) return;

        const index = parseInt(oldBlock.dataset.index, 10);
        const total = this.container.children.length; // Approximate total based on DOM
        
        // Re-calculate data for this scene specifically
        const sceneData = this._getSceneData(sceneId);
        if (!sceneData) return; // Scene might have been deleted

        const meta = this.app.sceneMeta[sceneId] || {};
        const newBlock = this.createSceneBlock(sceneData, meta, index, total);
        
        this.container.replaceChild(newBlock, oldBlock);
    }

    _getSceneData(sceneId) {
        if (!this.app.scriptData || !this.app.scriptData.blocks) return null;
        const blocks = this.app.scriptData.blocks;
        
        const slugIndex = blocks.findIndex(b => b.id === sceneId);
        if (slugIndex === -1) return null;
        
        const slug = blocks[slugIndex];
        const scene = {
            slug: slug,
            startIndex: slugIndex,
            content: [],
            charsBlock: null,
            linesCount: 1
        };

        // Scan forward until next slug
        for (let i = slugIndex + 1; i < blocks.length; i++) {
            const block = blocks[i];
            if (block.type === constants.ELEMENT_TYPES.SLUG) break;
            
            // Re-use logic for line counts
            let lines = 1;
            if (block.type === constants.ELEMENT_TYPES.ACTION) lines += Math.floor(block.text.length / 60);
            else if (block.type === constants.ELEMENT_TYPES.DIALOGUE) lines += Math.floor(block.text.length / 35);
            
            scene.linesCount += lines;

            const isFirstContent = scene.content.length === 0;
            if (isFirstContent && block.type === constants.ELEMENT_TYPES.ACTION && block.text.trim().startsWith('Characters:')) {
                scene.charsBlock = block;
            } else {
                scene.content.push(block);
            }
        }
        
        // Recalculate duration string
        const eighths = Math.ceil((scene.linesCount * 8) / 55);
        let durationStr = '';
        if (eighths < 8) {
            durationStr = `${eighths}/8`;
        } else {
            const pgs = Math.floor(eighths / 8);
            const rem = eighths % 8;
            durationStr = rem > 0 ? `${pgs} ${rem}/8` : `${pgs}`;
        }
        scene.durationStr = durationStr;

        return scene;
    }

    renderFromData(blocks, container) {
        this.container = container;
        this.container.innerHTML = '';
        this.currentBlocks = blocks; 
        
        this.renderScriptMetainTreatment(container);
        
        let currentSceneBlock = null;
        const scenes = [];
        
        // simple line height estimate for duration
        const getLineCount = (block) => {
            const text = block.text || '';
            const type = block.type;
            let lines = 1;
            if (type === constants.ELEMENT_TYPES.ACTION) lines += Math.floor(text.length / 60);
            else if (type === constants.ELEMENT_TYPES.DIALOGUE) lines += Math.floor(text.length / 35);
            else if (type === constants.ELEMENT_TYPES.PARENTHETICAL) lines = 1;
            else if (type === constants.ELEMENT_TYPES.CHARACTER) lines = 1; // + spacing?
            return lines;
        };

        blocks.forEach((block, index) => {
            if (block.type === constants.ELEMENT_TYPES.SLUG) {
                if (currentSceneBlock) {
                    scenes.push(currentSceneBlock);
                }
                currentSceneBlock = {
                    slug: block,
                    startIndex: index,
                    content: [], 
                    charsBlock: null,
                    linesCount: 1 // Header itself
                };
            } else if (currentSceneBlock) {
                currentSceneBlock.linesCount += getLineCount(block);
                
                const isFirstContent = currentSceneBlock.content.length === 0;
                // Identify "Characters: ..." block if it's the first action block
                if (isFirstContent && block.type === constants.ELEMENT_TYPES.ACTION && block.text.trim().startsWith('Characters:')) {
                    currentSceneBlock.charsBlock = block;
                } else {
                    currentSceneBlock.content.push(block);
                }
            }
        });
        if (currentSceneBlock) scenes.push(currentSceneBlock);
        
        scenes.forEach((scene, index) => {
            const meta = this.app.sceneMeta[scene.slug.id] || {};
            // Calculate duration string (e.g. "1 2/8 pgs")
            const eighths = Math.ceil((scene.linesCount * 8) / 55); // 55 lines per page approx
            let durationStr = '';
            if (eighths < 8) {
                durationStr = `${eighths}/8`;
            } else {
                const pgs = Math.floor(eighths / 8);
                const rem = eighths % 8;
                durationStr = rem > 0 ? `${pgs} ${rem}/8` : `${pgs}`;
            }
            scene.durationStr = durationStr;

            const blockEl = this.createSceneBlock(scene, meta, index, scenes.length);
            this.container.appendChild(blockEl);
        });
    }

    renderScriptMetainTreatment(container) {
        const metaWrapper = document.createElement('div');
        metaWrapper.className = 'treatment-mobile-meta';
        
        // Toggle Button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'treatment-meta-toggle';
        
        // Load state
        const isCollapsedInitially = localStorage.getItem('sfss_treatment_meta_collapsed') === 'true';
        if (isCollapsedInitially) {
            metaWrapper.classList.add('collapsed');
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
        
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = metaWrapper.classList.toggle('collapsed');
            localStorage.setItem('sfss_treatment_meta_collapsed', isCollapsed);
            toggleBtn.innerHTML = isCollapsed ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        };
        
        metaWrapper.addEventListener('click', () => {
             if (metaWrapper.classList.contains('collapsed')) {
                 metaWrapper.classList.remove('collapsed');
                 localStorage.setItem('sfss_treatment_meta_collapsed', 'false');
                 toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
             }
        });
        
        // Title Input
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.className = 'treatment-meta-line title-line';
        titleInput.placeholder = 'SCREENPLAY TITLE';
        titleInput.value = this.app.meta.title || '';
        titleInput.addEventListener('input', (e) => {
            this.app.meta.title = e.target.value;
            this.app.isDirty = true;
            this.app.sidebarManager.updateSidebarHeader(); // Sync header
        });
        titleInput.addEventListener('blur', () => {
            this.app.saveState(true);
            this.app.populateOpenMenu();
        });

        // Author Input
        const authorInput = document.createElement('input');
        authorInput.type = 'text';
        authorInput.className = 'treatment-meta-line author-line';
        authorInput.placeholder = 'Author Name';
        authorInput.value = this.app.meta.author || '';
        authorInput.addEventListener('input', (e) => {
            this.app.meta.author = e.target.value;
            this.app.isDirty = true;
        });

        // Contact/Info Input (TextArea styled as lines? Or simple input for mobile?)
        // Let's use a textarea that auto-expands or just simple input for now as per "lines on paper" aesthetic
        const contactInput = document.createElement('input');
        contactInput.type = 'text';
        contactInput.className = 'treatment-meta-line';
        contactInput.placeholder = 'Contact Info';
        contactInput.value = this.app.meta.contact || '';
        contactInput.addEventListener('input', (e) => {
            this.app.meta.contact = e.target.value;
            this.app.isDirty = true;
        });



        metaWrapper.appendChild(toggleBtn);
        metaWrapper.appendChild(titleInput);
        metaWrapper.appendChild(authorInput);
        metaWrapper.appendChild(contactInput);
        
        container.appendChild(metaWrapper);
    }

    createSceneBlock(scene, meta, index, total) {
        const slug = scene.slug;
        const block = document.createElement('div');
        block.className = 'treatment-scene-block';
        block.dataset.sceneId = slug.id;
        block.dataset.index = index;

        block.addEventListener('click', (e) => {
            // Do not act if clicking on an editable element or a button
            if (e.target.isContentEditable || e.target.closest('button') || e.target.closest('.treatment-add-btn') || e.target.closest('.treatment-reorder-controls')) {
                return;
            }

            // Only update the settings modal if it is ALREADY open
            const popup = document.getElementById('scene-settings-popup');
            if (!popup.classList.contains('hidden')) {
                const mockSlug = { 
                    dataset: { lineId: slug.id }, 
                    textContent: slug.text, 
                    isMock: true 
                };
                this.app.sidebarManager.openSceneSettings(mockSlug);
            }
        });

        // --- Reorder Controls (Left Margin) ---
        const controls = document.createElement('div');
        controls.className = 'treatment-reorder-controls';
        
        const upBtn = document.createElement('button');
        upBtn.className = 'reorder-btn';
        upBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        upBtn.disabled = index === 0;
        upBtn.onclick = (e) => { e.stopPropagation(); this.app.treatmentManager.moveScene(index, -1); };
        
        const downBtn = document.createElement('button');
        downBtn.className = 'reorder-btn';
        downBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        downBtn.disabled = index === total - 1;
        downBtn.onclick = (e) => { e.stopPropagation(); this.app.treatmentManager.moveScene(index, 1); };
        
        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        block.appendChild(controls);

        // --- Header (Complex Layout) ---
        const header = document.createElement('div');
        header.className = 'treatment-header';
        
        // Mobile Simplified Header
        if (document.body.classList.contains('mobile-view')) {
            const simpleSlug = document.createElement('div');
            simpleSlug.className = 'treatment-header-simple-slug';
            simpleSlug.contentEditable = true;
            simpleSlug.textContent = slug.text.toUpperCase(); // Ensure it starts uppercase
            
            simpleSlug.addEventListener('blur', () => {
                const val = simpleSlug.textContent.trim().toUpperCase();
                if (val !== slug.text) {
                    slug.text = val;
                    this.app.isDirty = true;
                    this.app.sidebarManager.updateSceneList();
                }
            });

            simpleSlug.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    simpleSlug.blur();
                }
            });

            header.appendChild(simpleSlug);
            block.appendChild(header);
            
            // Skip the rest of the complex header construction
        } else {
            // 1. Scene Number (Left, Tall)
            const numberBox = document.createElement('div');
            numberBox.className = 'treatment-scene-number';
            if (meta.color) numberBox.classList.add(meta.color);
            numberBox.contentEditable = true; // Make editable
            numberBox.textContent = meta.number || (index + 1); // Use manual number if set
            
            const saveNumber = () => {
                let val = numberBox.textContent.trim();
                if (val === '' || val === (index + 1).toString()) val = null; // Reset if empty or matches auto
                
                if (!this.app.sceneMeta[slug.id]) this.app.sceneMeta[slug.id] = {};
                this.app.sceneMeta[slug.id].number = val;
                
                // This will save the meta and trigger the global refresh
                this.app.sidebarManager.saveSceneMeta(slug.id);
            };

            numberBox.addEventListener('blur', saveNumber);
            numberBox.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    numberBox.blur();
                }
            });

            header.appendChild(numberBox);
            
            // Parse Slug
            const text = slug.text.trim();
            let intro = 'INT.';
            let location = 'LOCATION';
            let time = 'DAY';
            
            // Simple heuristic parsing
            const firstSpace = text.indexOf(' ');
            if (firstSpace !== -1) {
                intro = text.substring(0, firstSpace);
                const remainder = text.substring(firstSpace + 1).trim();
                // Try to split Time from Location (usually by - or /)
                const delimiters = [' - ', ' / '];
                let splitIndex = -1;
                let usedDelimiterLength = 0;
                
                for (const delim of delimiters) {
                    const idx = remainder.lastIndexOf(delim);
                    if (idx !== -1) {
                        splitIndex = idx;
                        usedDelimiterLength = delim.length;
                        break;
                    }
                }
                
                if (splitIndex !== -1) {
                    location = remainder.substring(0, splitIndex).trim();
                    time = remainder.substring(splitIndex + usedDelimiterLength).trim();
                } else {
                    location = remainder;
                    time = ''; 
                }
            } else {
                intro = text;
            }

            const updateSlug = () => {
                const i = introBox.innerText.trim();
                const l = locBox.innerText.trim();
                const t = timeBox.innerText.trim();
                let newSlug = i;
                if (l) newSlug += ' ' + l;
                if (t) newSlug += ' - ' + t;
                
                slug.text = newSlug.toUpperCase();
                this.app.isDirty = true;
                this.app.sidebarManager.updateSceneList(); 
            };

            // 2. Middle Column (Rows)
            const mainColumn = document.createElement('div');
            mainColumn.className = 'treatment-header-main-column';

            // Row 1: Intro + Time + Duration
            const row1 = document.createElement('div');
            row1.className = 'treatment-header-row';
            
            const introBox = document.createElement('div');
            introBox.className = 'treatment-header-cell cell-intro';
            introBox.contentEditable = true;
            introBox.innerText = intro;
            introBox.onblur = updateSlug;
            
            const timeBox = document.createElement('div');
            timeBox.className = 'treatment-header-cell cell-time';
            timeBox.contentEditable = true;
            timeBox.innerText = time;
            timeBox.onblur = updateSlug;

            const durationBox = document.createElement('div');
            durationBox.className = 'treatment-header-cell cell-duration';
            durationBox.textContent = scene.durationStr;
            durationBox.title = 'Estimated Duration';

            row1.appendChild(introBox);
            row1.appendChild(timeBox);
            row1.appendChild(durationBox);
            mainColumn.appendChild(row1);

            // Row 2: Location
            const row2 = document.createElement('div');
            row2.className = 'treatment-header-row';

            const locBox = document.createElement('div');
            locBox.className = 'treatment-header-cell cell-location';
            locBox.contentEditable = true;
            locBox.innerText = location;
            locBox.onblur = updateSlug;

            row2.appendChild(locBox);
            mainColumn.appendChild(row2);

            header.appendChild(mainColumn);

            // Tab Navigation for cells
            [introBox, locBox, timeBox].forEach((box) => {
                box.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); box.blur(); } 
                });
            });

            // 3. Icon Box (Right)
            const iconBox = document.createElement('div');
            iconBox.className = 'treatment-header-icon';
            if (meta.color) iconBox.classList.add(meta.color);
            if (meta.icon) {
                iconBox.innerHTML = '<i class="' + meta.icon + '"></i>';
            } else {
                // Empty box visual / Placeholder
                iconBox.innerHTML = '<i class="fas fa-icons treatment-icon-placeholder"></i>';
            }
            
            iconBox.onclick = (e) => {
                e.stopPropagation();
                this.app.sidebarManager.showIconPickerMenu(iconBox, slug.id);
            };
            
            header.appendChild(iconBox);

            block.appendChild(header);
        }

        // --- Controls Area (For empty section buttons) ---
        const controlsArea = document.createElement('div');
        controlsArea.className = 'treatment-controls-area';
        // We will append this later, after potential filled sections

        // --- Body (Description) ---
        // This is the "Treatment" body. It edits the Metadata Description.
        const bodyWrapper = document.createElement('div');
        bodyWrapper.className = 'treatment-body-wrapper';

        // --- Helper: Section Creator ---
        const createSection = (className, contentFunc, addIcon, addAction, label, forceShow = false) => {
            const wrapper = document.createElement('div');
            wrapper.className = `treatment-section-wrapper ${className}`;
            
            const content = contentFunc();
            const hasContent = forceShow || (content && (content.childNodes.length > 0 || content.innerText.trim().length > 0));
            
            const addBtn = document.createElement('button');
            addBtn.className = 'treatment-add-btn'; // Generic base class
            addBtn.classList.add(`add-${className}`); // Specific identifier
            addBtn.dataset.label = label;
            
            // Special case: Hide add button for music if track exists (max 1 track)
            if (className === 'section-music' && hasContent) {
                addBtn.style.display = 'none';
            }

            addBtn.innerHTML = `<i class="fas fa-${addIcon}"></i>`;
            addBtn.onclick = (e) => { e.stopPropagation(); addAction(e); };
            
            if (hasContent) {
                wrapper.appendChild(addBtn);
                wrapper.appendChild(content);
                wrapper.classList.remove('empty-section');
                block.appendChild(wrapper); // Add filled section to block
            } else {
                controlsArea.appendChild(addBtn); // Add empty button to controls area
                // Do not append wrapper
            }
        };

        // --- Images ---
        const imageContent = () => {
            const ids = meta.images || [];
            // We return a grid even if empty initially, to be filled by async renderImages
            const grid = document.createElement('div');
            grid.className = 'treatment-image-grid';
            if (ids.length > 1) grid.classList.add('masonry-style');
            this.renderImages(grid, ids); 
            return grid;
        };
        // Force show if we have IDs, even if DOM is technically empty at this synchronous moment
        const hasImages = (meta.images && meta.images.length > 0);
        createSection('section-images', imageContent, 'plus', () => this.triggerImageUpload(slug.id), 'IMG', hasImages);

        // --- Music ---
        const musicContent = () => {
            if (!meta.track) return null;
            const row = document.createElement('div');
            row.className = 'treatment-music-row';
            
            const playBtn = document.createElement('button');
            playBtn.className = 'treatment-music-play-btn';
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            playBtn.title = "Play Track";
            
            playBtn.onclick = (e) => {
                e.stopPropagation();
                const videoId = this.app.mediaPlayer.extractYouTubeVideoId(meta.track);
                if (videoId) this.app.mediaPlayer.playTrackById(videoId);
            };
            
            const info = document.createElement('span');
            info.className = 'treatment-music-info';
            info.textContent = (meta.trackArtist && meta.trackTitle) ? `${meta.trackArtist} - ${meta.trackTitle}` : 'Track Attached';
            
            const removeBtn = document.createElement('i');
            removeBtn.className = 'fas fa-times remove-char-btn';
            removeBtn.title = 'Remove Track';
            removeBtn.onclick = (e) => {
                 e.stopPropagation();
                 if (this.app.sceneMeta[slug.id]) {
                     this.app.sceneMeta[slug.id].track = '';
                     this.app.sceneMeta[slug.id].trackTitle = '';
                     this.app.sceneMeta[slug.id].trackArtist = '';
                     this.app.sidebarManager.saveSceneMeta(slug.id); // Triggers refresh
                 }
            };

            row.appendChild(playBtn);
            row.appendChild(info);
            row.appendChild(removeBtn);
            return row;
        };
        
        createSection('section-music', musicContent, 'music', (e) => {
             // If clicked from controlsArea, we don't have a wrapper yet!
             // We need to insert the input into the block or create a temp wrapper.
             const btn = e.target.closest('.treatment-add-btn');
             const parent = btn.parentElement;
             
             // If parent is controlsArea, create a temp wrapper in block to hold input?
             // Or just show input IN controlsArea?
             // Input is usually "PASTE URL...".
             // If we do it in controlsArea (mobile button line), it might be tight.
             // Let's create a temp wrapper appended to block.
             let container = null;
             if (parent.classList.contains('treatment-controls-area')) {
                 const tempWrapper = document.createElement('div');
                 tempWrapper.className = 'treatment-section-wrapper section-music empty-section';
                 block.insertBefore(tempWrapper, bodyWrapper); // Insert before body
                 container = tempWrapper;
             } else {
                 container = parent;
             }
             
             this.showMusicInput(btn, container, scene);
        }, 'MUSIC', !!meta.track);


        // --- Characters ---
        const charContent = () => {
            const charText = scene.charsBlock ? scene.charsBlock.text : '';
            const charList = charText.replace(/^Characters:\s*/i, '').split(',').map(s => s.trim()).filter(s => s);
            if (charList.length === 0) return null;
            const row = document.createElement('div');
            row.className = 'treatment-chars-row';
            charList.forEach(char => {
                const badge = document.createElement('div');
                badge.className = 'treatment-char-badge';
                badge.innerHTML = `<i class="fas fa-user treatment-char-icon"></i> ${char} <i class="fas fa-times remove-char-btn" title="Remove"></i>`;
                
                badge.querySelector('.remove-char-btn').onclick = (e) => {
                    e.stopPropagation();
                    this.removeCharacterFromScene(scene, char);
                };
                
                row.appendChild(badge);
            });
            return row;
        };
        
        createSection('section-chars', charContent, 'user-plus', (e) => {
            const btn = e.target.closest('.treatment-add-btn');
            const parent = btn.parentElement;
            let container = null;
            
            if (parent.classList.contains('treatment-controls-area')) {
                 const tempWrapper = document.createElement('div');
                 tempWrapper.className = 'treatment-section-wrapper section-chars empty-section';
                 block.insertBefore(tempWrapper, bodyWrapper);
                 container = tempWrapper;
            } else {
                 container = parent;
            }
            
            this.showCharacterInput(btn, container, scene);
        }, 'CHAR');

        // Append pool and body
        block.appendChild(controlsArea);
        
        const body = document.createElement('div');
        body.className = 'treatment-body';
        body.contentEditable = true;
        body.innerText = meta.description || ''; 
        if (!body.innerText) {
            body.dataset.empty = 'true';
        }
        
        body.addEventListener('input', () => {
             if (body.innerText.trim() === '') body.dataset.empty = 'true';
             else delete body.dataset.empty;
             
             if (!this.app.sceneMeta[slug.id]) this.app.sceneMeta[slug.id] = {};
             this.app.sceneMeta[slug.id].description = body.innerText;
             this.app.isDirty = true;
        });
        
        body.addEventListener('keydown', (e) => {
             // Handle Enter on 2nd empty paragraph -> Transition Menu
             if (e.key === 'Enter') {
                 const selection = window.getSelection();
                 if (selection.rangeCount > 0) {
                     const range = selection.getRangeAt(0);
                     // Check if we are at the end of the text
                     // Simple check: if text ends with \n\n and caret is at end
                     if (body.innerText.endsWith('\n\n')) {
                          e.preventDefault();
                          this.showTransitionMenu(body, slug.id);
                     }
                 }
             }
        });
        
        bodyWrapper.appendChild(body);
        block.appendChild(bodyWrapper);
        
        // --- Footer (Transition indicator?) ---
        // If there is a transition after this scene in the script, maybe show it?
        // Requirement says "Transition... is appended as the end of the scene if user chooses to create it".
        // It implies it becomes part of the script structure.
        // We can check if the NEXT block in the raw data is a Transition.
        
        // Find next block after this scene's content
        let nextBlockIndex = scene.startIndex + 1; // Start checking after SLUG
        // Skip content
        while(nextBlockIndex < this.currentBlocks.length) {
            const b = this.currentBlocks[nextBlockIndex];
            if (b.type === constants.ELEMENT_TYPES.SLUG) break;
            if (b.type === constants.ELEMENT_TYPES.TRANSITION) {
                const transDiv = document.createElement('div');
                transDiv.className = 'treatment-footer-transition';
                transDiv.textContent = '> ' + b.text;
                block.appendChild(transDiv);
                break;
            }
            nextBlockIndex++;
        }

        return block;
    }

    async renderImages(container, imageIds) {
        container.innerHTML = '';
        container.onclick = async (e) => {
            // Stop propagation to prevent block selection/drag interference
            e.stopPropagation();

            const wrapper = e.target.closest('.image-container');
            if (!wrapper) return;

            // Handle switching confirmation state
            const openConfirmation = container.querySelector('.image-container.confirming-delete');
            if (openConfirmation && openConfirmation !== wrapper) {
                openConfirmation.classList.remove('confirming-delete');
            }

            // Clicked the "X" button
            if (e.target.closest('.image-delete-btn')) {
                wrapper.classList.add('confirming-delete');
                return;
            }

            // Clicked "Yes" (Delete)
            if (e.target.closest('.image-delete-yes')) {
                const index = parseInt(wrapper.dataset.imageIndex, 10);
                // Find scene ID from parent block
                const block = container.closest('.treatment-scene-block');
                if (!block) return;
                
                const sceneId = block.dataset.sceneId;
                
                if (this.app.sceneMeta[sceneId] && this.app.sceneMeta[sceneId].images) {
                    const imageId = this.app.sceneMeta[sceneId].images[index];
                    
                    try {
                        await this.app.sidebarManager.imageDB.delete(imageId);
                        this.app.sceneMeta[sceneId].images.splice(index, 1);
                        this.app.sidebarManager.saveSceneMeta(sceneId, false);
                        this.app.refreshTreatmentView();
                    } catch (err) {
                        console.error('Failed to delete image:', err);
                    }
                }
            } 
            // Clicked "No" or clicked back on the confirming wrapper (toggle off)
            else if (e.target.closest('.image-delete-no') || wrapper.classList.contains('confirming-delete')) {
                wrapper.classList.remove('confirming-delete');
            }
        };

        for (let i = 0; i < imageIds.length; i++) {
            const id = imageIds[i];
            const file = await this.app.sidebarManager.imageDB.get(id);
            if (file) {
                const url = URL.createObjectURL(file);
                const item = document.createElement('div');
                item.className = 'treatment-image-item'; // Wrapper for layout
                
                // Inner structure matching SidebarManager's scene settings
                item.innerHTML = `
                    <div class="image-container" data-image-index="${i}" style="width:100%; height:100%;">
                        <div class="image-flipper">
                            <div class="image-front">
                                <img src="${url}" alt="Scene image">
                                <button class="image-delete-btn" title="Delete Image"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="image-back">
                                <span>Delete?</span>
                                <div>
                                    <button class="btn-text-small image-delete-yes">Yes</button>
                                    <button class="btn-text-small image-delete-no">No</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                container.appendChild(item);
            }
        }
    }

    triggerImageUpload(sceneId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
             if (input.files.length > 0) {
                 const file = input.files[0];
                 const imageId = `${sceneId}-${Date.now()}`;
                 await this.app.sidebarManager.imageDB.put(file, imageId);
                 
                 if (!this.app.sceneMeta[sceneId]) this.app.sceneMeta[sceneId] = {};
                 if (!this.app.sceneMeta[sceneId].images) this.app.sceneMeta[sceneId].images = [];
                 this.app.sceneMeta[sceneId].images.push(imageId);
                 
                 this.app.sidebarManager.saveSceneMeta(sceneId, false);
                 this.app.refreshTreatmentView();
             }
        };
        input.click();
    }
    
    showMusicInput(btn, container, scene) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'treatment-char-input'; // Reuse style
        input.placeholder = 'PASTE YOUTUBE URL...';
        input.style.width = '200px';
        
        wrapper.appendChild(input);
        
        btn.style.display = 'none';
        
        const finish = async () => {
            const val = input.value.trim();
            if (val) {
                const videoId = this.app.mediaPlayer.extractYouTubeVideoId(val);
                if (videoId) {
                    const trackMeta = await this.app.mediaPlayer._fetchTrackMetadata(videoId);
                    if (!this.app.sceneMeta[scene.slug.id]) this.app.sceneMeta[scene.slug.id] = {};
                    this.app.sceneMeta[scene.slug.id].track = val;
                    if (trackMeta) {
                        this.app.sceneMeta[scene.slug.id].trackTitle = trackMeta.title;
                        this.app.sceneMeta[scene.slug.id].trackArtist = trackMeta.artist;
                    }
                    this.app.sidebarManager.saveSceneMeta(scene.slug.id); // Triggers refresh
                } else {
                    alert('Invalid YouTube URL');
                }
            }
            wrapper.remove();
            if (!val) {
                btn.style.display = '';
                // Cleanup empty container if cancelled
                if (container.classList.contains('empty-section') && container.children.length === 0) {
                    container.remove();
                }
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finish();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                wrapper.remove();
                btn.style.display = '';
                if (container.classList.contains('empty-section') && container.children.length === 0) {
                    container.remove();
                }
            }
        });
        
        input.addEventListener('blur', () => {
             // Small delay?
             setTimeout(() => {
                 if (document.activeElement !== input) finish();
             }, 100);
        });
        
        input.addEventListener('paste', (e) => {
            // Allow paste to finish automatically?
            setTimeout(() => finish(), 100);
        });

        if (container.classList.contains('empty-section')) {
            container.appendChild(wrapper);
        } else {
            container.appendChild(wrapper);
        }
        
        input.focus();
    }
    
    removeCharacterFromScene(scene, charName) {
        if (!scene.charsBlock) return;
        
        const block = scene.charsBlock;
        let text = block.text.replace(/^Characters:\s*/i, '');
        let chars = text.split(',').map(s => s.trim()).filter(s => s);
        
        chars = chars.filter(c => c !== charName);
        
        if (chars.length === 0) {
            // Remove block
            const index = this.currentBlocks.indexOf(block);
            if (index !== -1) {
                this.currentBlocks.splice(index, 1);
            }
            scene.charsBlock = null;
        } else {
            block.text = 'Characters: ' + chars.join(', ');
        }
        
        this.app.isDirty = true;
        this.refreshScene(scene.slug.id);
    }

    showCharacterInput(btn, container, scene) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'treatment-char-input'; 
        input.placeholder = 'NEW CHARACTER...';
        
        // Use global autocomplete menu if possible, but for simplicity/isolation we might stick to local
        // but user requested "match Writing Mode UX".
        // Writing mode uses editorHandler.autoMenu.
        // Let's use a local menu but style/behave exactly like it.
        const dropdown = document.createElement('div'); // Changed to div to match .floating-menu structure if needed, or keep ul
        dropdown.className = 'floating-menu'; // Use standard class
        dropdown.style.display = 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.top = '100%';
        dropdown.style.left = '0';
        dropdown.style.minWidth = '150px';
        dropdown.style.maxHeight = '200px';
        dropdown.style.overflowY = 'auto';

        wrapper.appendChild(input);
        wrapper.appendChild(dropdown);
        
        btn.style.display = 'none';
        
        let selectedIndex = 0;
        let visibleItems = [];

        const close = () => {
            wrapper.remove();
            if (!input.value.trim()) {
                btn.style.display = '';
                if (container.classList.contains('empty-section') && container.children.length === 0) {
                    container.remove();
                }
            }
        };

        const finish = (value) => {
            const val = (value || input.value).trim().toUpperCase();
            if (val) {
                 this.app.treatmentManager.addCharacter(scene.slug.id, val);
            }
            close();
        };

        const renderDropdown = () => {
            const val = input.value.toUpperCase();
            const allChars = Array.from(this.app.characters);
            // Filter: starts with input, excluding exact match if typed fully
            visibleItems = allChars.filter(c => c.startsWith(val) && c !== val).slice(0, 10);
            
            dropdown.innerHTML = '';
            if (visibleItems.length > 0) {
                visibleItems.forEach((match, idx) => {
                    const div = document.createElement('div');
                    div.className = `menu-item ${idx === selectedIndex ? 'selected' : ''}`;
                    div.textContent = match;
                    div.onmousedown = (e) => { e.preventDefault(); finish(match); }; // mousedown to avoid blur
                    dropdown.appendChild(div);
                });
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        };

        input.addEventListener('input', () => {
            selectedIndex = 0;
            renderDropdown();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (visibleItems.length > 0) {
                    selectedIndex = (selectedIndex + 1) % visibleItems.length;
                    renderDropdown();
                    // Auto-scroll
                    const selected = dropdown.children[selectedIndex];
                    if (selected) selected.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (visibleItems.length > 0) {
                    selectedIndex = (selectedIndex - 1 + visibleItems.length) % visibleItems.length;
                    renderDropdown();
                    const selected = dropdown.children[selectedIndex];
                    if (selected) selected.scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (visibleItems.length > 0 && dropdown.style.display !== 'none') {
                    finish(visibleItems[selectedIndex]);
                } else {
                    finish();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
            } else if (e.key === 'Tab') {
                e.preventDefault(); // Don't tab away
                if (visibleItems.length > 0 && dropdown.style.display !== 'none') {
                    finish(visibleItems[selectedIndex]);
                }
            }
        });
        
        input.addEventListener('blur', () => {
            // If we are clicking an item, onmousedown handles it.
            // If we click outside, this blur fires.
            setTimeout(() => {
                if (document.activeElement !== input) {
                    finish(); // Commit what's typed if we click away? Or cancel? 
                    // Writing mode behavior: if you click away, it usually keeps text. 
                    // Here we are in a temporary input. Let's commit.
                }
            }, 100);
        });

        if (container.classList.contains('empty-section')) {
            container.appendChild(wrapper);
        } else {
            const row = container.querySelector('.treatment-chars-row');
            if (row) row.appendChild(wrapper);
            else container.appendChild(wrapper);
        }
        
        input.focus();
        renderDropdown(); // Show initial suggestions if any (empty input -> show all?)
        // Actually, autocomplete usually waits for input, or shows all?
        // EditorHandler shows all if empty? No, `triggerAutocomplete` does `allChars.filter`.
        // If input is empty, `startsWith` matches all.
    }

    showTransitionMenu(targetElement, sceneId) {
        const options = [constants.ELEMENT_TYPES.TRANSITION, constants.ELEMENT_TYPES.SLUG];
        const menu = this.app.editorHandler.typeMenu;
        menu.innerHTML = '';
        
        options.forEach((opt, idx) => {
            const div = document.createElement('div');
            div.className = `menu-item ${idx === 0 ? 'selected' : ''}`;
            const label = document.createElement('span');
            label.textContent = constants.TYPE_LABELS[opt];
            div.appendChild(label);
            
            // Allow click selection
            div.onmousedown = (e) => { 
                e.preventDefault();
                selectOption(opt);
            };
            menu.appendChild(div);
        });

        const rect = targetElement.getBoundingClientRect();
        menu.style.display = 'block';
        menu.style.position = 'fixed'; 
        menu.style.top = (rect.bottom + 10) + 'px';
        menu.style.left = (rect.left + 20) + 'px';
        
        // Use EditorHandler's state structure so we can potentially reuse its logic if we wanted, 
        // but since we are in a different context, we handle the keydown locally.
        this.app.editorHandler.popupState = { active: true, type: 'selector-treatment', selectedIndex: 0, options: options };

        const selectOption = (opt) => {
            if (opt === constants.ELEMENT_TYPES.TRANSITION) {
                this.app.treatmentManager.addTransition(sceneId);
            } else {
                this.app.treatmentManager.addSceneHeading(sceneId);
            }
            closeMenu();
        };

        const closeMenu = () => {
            menu.style.display = 'none';
            this.app.editorHandler.popupState.active = false;
            targetElement.removeEventListener('keydown', keyHandler);
            document.removeEventListener('mousedown', outsideClickHandler);
        };

        const keyHandler = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.app.editorHandler.popupNavigate(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.app.editorHandler.popupNavigate(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const idx = this.app.editorHandler.popupState.selectedIndex;
                selectOption(options[idx]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeMenu();
            }
        };

        const outsideClickHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== targetElement) {
                closeMenu();
            }
        };

        targetElement.addEventListener('keydown', keyHandler);
        document.addEventListener('mousedown', outsideClickHandler);
    }
}
```

5.12 `assets/js-mod/CollaborationManager.js`
- WebRTC room setup, peer messaging, and baton logic (imports Trystero).

```js
import { joinRoom } from '../trystero.min.js';

export class CollaborationManager {
    constructor(app) {
        this.app = app;
        this.room = null;
        this.roomId = null;
        this.peers = {}; 
        this.isHost = false;
        this.hasBaton = false;
        this.myPeerId = null;
        
        // Config
        this.APP_ID = 'sfss-collab-v1';
        this.PING_INTERVAL = 2000;
        this.TIMEOUT_THRESHOLD = 5000;

        // Channels
        this.dataChannel = null;
        this.localStream = null;
        
        this.heartbeatInterval = null;
        this.onBatonStatusChange = null; 
        this.onPeerJoin = null;
        this.onPeerLeave = null;
        this.onDisconnect = null;
        this.onRemoteStream = null;
    }

    log(msg, type) {
        if (this.app.collabUI) this.app.collabUI.log(msg, type);
        else console.log(`[CollabManager] ${msg}`);
    }

    connect(roomId, isHost) {
        this.log(`Initiating connection sequence for Room: ${roomId}...`, 'info');
        if (this.room) {
            this.disconnect();
        }

        this.roomId = roomId;
        this.isHost = isHost;
        this.hasBaton = isHost; 
        
        try {
            this.room = joinRoom({ appId: this.APP_ID }, roomId);

            const [sendData, getData] = this.room.makeAction('data');
            this.sendDataRaw = sendData;
            getData(this.handleData.bind(this));
            this.log('Private communication channel established.', 'success');

            this.room.onPeerJoin(peerId => {
                this.handlePeerJoin(peerId);
            });
            this.room.onPeerLeave(peerId => {
                this.handlePeerLeave(peerId);
            });
            
            this.room.onPeerStream((stream, peerId) => {
                if (this.onRemoteStream) this.onRemoteStream(stream, peerId);
            });

            this.startHeartbeat();
            
            if (this.onBatonStatusChange) {
                this.onBatonStatusChange(this.hasBaton);
            }

            if (!this.hasBaton) {
                this.log('Guest Mode: You are a reader. Editor is locked until the baton is passed to you.', 'info');
                this.app.editorHandler.toggleReadOnly(true);
            } else {
                this.log('Host Mode: You have the baton and can write.', 'success');
            }

            document.body.classList.add('is-collaborating');

            return true;
        } catch (e) {
            this.log(`Critical Connection Error: ${e.message}`, 'error');
            console.error(e);
            return false;
        }
    }

    disconnect() {
        if (this.room) {
            // Notify peers we are closing the session (if we are host or just leaving)
            // Ideally only Host closes session, but anyone leaving might want to say goodbye.
            // If we want to "Close Session" for everyone, we send SESSION_END.
            // If we just want to leave, we rely on peerLeave.
            // The user request implies "Disconnecting the session" should clean up for the other person?
            // If I am just one of many, I shouldn't close it for everyone.
            // But usually this is 1-on-1.
            // Let's send a graceful exit message.
            this.broadcast({ type: 'SESSION_END', payload: { reason: 'User disconnected.' } });
            
            this.room.leave();
            this.room = null;
        }
        clearInterval(this.heartbeatInterval);
        this.peers = {};
        this.hasBaton = true; 
        
        this.stopMedia();
        this.app.editorHandler.toggleReadOnly(false);

        document.body.classList.remove('is-collaborating');

        if (this.onDisconnect) this.onDisconnect();
        if (this.onBatonStatusChange) this.onBatonStatusChange(true);
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        
        this.heartbeatInterval = setInterval(() => {
            this.broadcast({ type: 'PING' });
            
            const now = Date.now();
            for (const [peerId, meta] of Object.entries(this.peers)) {
                if (now - meta.lastPing > this.TIMEOUT_THRESHOLD) {
                    this.log(`Peer connection timed out: ${peerId}`, 'warn');
                    this.handlePeerLeave(peerId);
                }
            }
        }, this.PING_INTERVAL);
    }

    broadcast(msg) {
        if (!this.sendDataRaw) return;
        this.sendDataRaw(msg); 
    }

    sendTo(peerId, msg) {
        if (!this.sendDataRaw) return;
        this.sendDataRaw(msg, peerId);
    }

    handlePeerJoin(peerId) {
        this.peers[peerId] = { lastPing: Date.now(), meta: {} };
        
        if (this.onPeerJoin) this.onPeerJoin(peerId);

        const isMobile = document.body.classList.contains('mobile-view');
        this.sendTo(peerId, { type: 'HELLO', payload: { isMobile } });

        if (this.hasBaton) {
             this.log(`New collaborator joined. Sending them the current script (encrypted)...`, 'info');
             setTimeout(() => {
                 const snapshot = this.app.editorHandler.getSnapshot();
                 const currentBlock = this.app.editorHandler.getCurrentBlock();
                 if (currentBlock) snapshot.activeLineId = currentBlock.dataset.lineId;
                 this.sendTo(peerId, { type: 'SYNC_FULL', payload: snapshot });
             }, 500);
        }

        // Fix: Ensure video/audio is sent to the new peer
        if (this.localStream) {
            this.log('Negotiating video/audio stream with new collaborator...', 'system');
            this.room.addStream(this.localStream, peerId);
        }
    }

    handlePeerLeave(peerId) {
        delete this.peers[peerId];
        
        if (Object.keys(this.peers).length === 0) {
             this.log('Connection lost (No peers remaining). Ending session.', 'warn');
             this.disconnect();
             if (this.app.collabUI) {
                 this.app.collabUI.showToast("Connection lost. Session ended.");
                 this.app.collabUI.restoreToolbarItems();
             }
        }

        if (this.onPeerLeave) this.onPeerLeave(peerId);
    }

    handleData(data, peerId) {
        if (!this.peers[peerId]) this.peers[peerId] = { lastPing: Date.now(), meta: {} };
        this.peers[peerId].lastPing = Date.now();

        switch (data.type) {
            case 'PING':
                break;
            case 'HELLO':
                if (data.payload && data.payload.isMobile) {
                    this.peers[peerId].meta.isMobile = true;
                    this.log(`Collaborator is on a mobile device. They will be a reader only.`, 'info');
                }
                break;
            case 'SYNC_FULL':
                this.log('Received latest script version from collaborator.', 'success');
                this.app.editorHandler.applySnapshot(data.payload, false, false, data.payload.activeLineId);
                // After full sync, ensure we see the active cursor
                setTimeout(() => this.app.scrollToActive(), 100);
                break;
            case 'UPDATE':
                 if (!this.hasBaton) {
                     this.app.editorHandler.applySnapshot(data.payload, true, true, data.payload.activeLineId); 
                 }
                 break;
            case 'GRANT_BATON':
                this.log('You have been granted write access (baton). Your editor is now unlocked.', 'success');
                this.takeBaton();
                this.sendTo(peerId, { type: 'BATON_ACK' });
                this.app.scrollToActive(); // Ensure writer sees where they are
                break;
            case 'BATON_ACK':
                this.log('Collaborator has confirmed receipt of the baton. Your editor is now locked.', 'info');
                this.hasBaton = false;
                this.app.editorHandler.toggleReadOnly(true);
                if (this.onBatonStatusChange) this.onBatonStatusChange(false);
                break;
            case 'SESSION_END':
                this.log('Remote user ended the session.', 'warn');
                this.disconnect();
                if(this.app.collabUI) this.app.collabUI.restoreToolbarItems(); // Ensure UI restoration
                break;
            case 'MEDIA_STATE':
                if (this.onPeerMediaChange) {
                    this.onPeerMediaChange(peerId, data.payload);
                }
                break;
        }
    }

    sendUpdate(snapshot) {
        if (!this.hasBaton) return;
        const currentBlock = this.app.editorHandler.getCurrentBlock();
        if (currentBlock) snapshot.activeLineId = currentBlock.dataset.lineId;
        this.broadcast({ type: 'UPDATE', payload: snapshot });
    }

    passBaton() {
        if (!this.hasBaton) return;
        
        const eligiblePeers = Object.keys(this.peers).filter(id => !this.peers[id].meta.isMobile);
        
        if (eligiblePeers.length === 0) {
            if (Object.keys(this.peers).length === 0) {
                 this.log("Cannot pass the baton: No one else is in the session.", 'warn');
            } else {
                 this.log("Cannot pass the baton: Your collaborator is on a mobile device and cannot edit.", 'warn');
            }
            return;
        }
        
        const targetPeer = eligiblePeers[0];
        this.log(`Passing write access (baton) to collaborator...`, 'info');
        
        const snapshot = this.app.editorHandler.getSnapshot();
        const currentBlock = this.app.editorHandler.getCurrentBlock();
        if (currentBlock) snapshot.activeLineId = currentBlock.dataset.lineId;
        this.sendTo(targetPeer, { type: 'SYNC_FULL', payload: snapshot });
        this.sendTo(targetPeer, { type: 'GRANT_BATON' });
    }

    takeBaton(forced = false) {
        this.hasBaton = true;
        this.app.editorHandler.toggleReadOnly(false);
        if (this.onBatonStatusChange) this.onBatonStatusChange(true);
        if (forced) {
             if(this.app.collabUI) this.app.collabUI.showToast("Remote user disconnected. You have control.");
        } else {
             if (this.app.collabUI) this.app.collabUI.showToast("You have the baton!");
        }
        this.app.scrollToActive();
    }

    async enableMedia(localVideoEl) {
        if (!this.room) {
            return { error: "Room not initialized" };
        }
        try {
            // Check if we already have a stream
            if (this.localStream) {
                // Re-attach if needed (UI might have cleared srcObject)
                if (localVideoEl && localVideoEl.srcObject !== this.localStream) {
                    localVideoEl.srcObject = this.localStream;
                    localVideoEl.play().catch(e => console.error(e));
                    localVideoEl.muted = true;
                }
                
                // Ensure video track is enabled (since 'enableMedia' implies turning it on)
                const v = this.localStream.getVideoTracks()[0];
                if (v && !v.enabled) v.enabled = true;
                
                this.broadcastMediaState();
                return { success: true };
            }

            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            if (localVideoEl) {
                localVideoEl.srcObject = this.localStream;
                localVideoEl.play().catch(e => console.error(e));
                localVideoEl.muted = true; 
            }
            
            this.room.addStream(this.localStream);
            
            // Broadcast initial state
            this.broadcastMediaState();
            
            return { success: true };
        } catch (e) {
            return { error: e.name, message: e.message };
        }
    }

    broadcastMediaState() {
        if (!this.localStream) return;
        const v = this.localStream.getVideoTracks()[0];
        const a = this.localStream.getAudioTracks()[0];
        
        this.broadcast({
            type: 'MEDIA_STATE',
            payload: {
                video: v ? v.enabled : false,
                audio: a ? a.enabled : false
            }
        });
    }

    stopMedia() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            if (this.room) {
                this.room.removeStream(this.localStream);
            }
            this.localStream = null;
            this.broadcast({ type: 'MEDIA_STATE', payload: { video: false, audio: false } });
        }
    }

    toggleAudio(enabled) {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                audioTracks[0].enabled = enabled;
                this.broadcastMediaState();
                return true;
            }
        }
        return false;
    }

    toggleVideo(enabled) {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                videoTracks[0].enabled = enabled;
                this.broadcastMediaState();
                return true;
            }
        }
        return false;
    }
}

```

5.13 `assets/js-mod/CollabUI.js`
- HUD/UI bindings for collaboration mode.

```js
export class CollabUI {
    constructor(app) {
        this.app = app;
        this.manager = app.collaborationManager;
        this.init();
    }

    init() {
        this.injectHTML();
        this.bindEvents();
        this.hasRemoteStream = false;
        this.remoteVideoEnabled = false;
        
        // Hook into Manager Callbacks
        this.manager.onBatonStatusChange = (hasBaton) => {
            this.updateBatonUI(hasBaton);
            this.log(`State Changed: ${hasBaton ? 'WRITER (Master)' : 'READER (Slave)'}`, hasBaton ? 'success' : 'warn');
        };
        this.manager.onPeerJoin = (peerId) => {
            this.showToast(`Peer Connected`);
            this.updateStatus(true);
            this.log(`Peer Identification Verified: ${peerId}`, 'success');
            this.log(`Establishing Encrypted Data Channel...`, 'system');
            setTimeout(() => this.log(`P2P Mesh Synchronized. Secure Connection Active.`, 'success'), 500);
        };
        this.manager.onPeerLeave = (peerId) => {
            this.showToast(`Peer Disconnected`);
            this.updateStatus(false);
            const remoteVideo = document.getElementById('collab-remote-video');
            if (remoteVideo) {
                remoteVideo.srcObject = null;
            }
            this.hasRemoteStream = false;
            this.remoteVideoEnabled = false;
            this.updateVideoVisibility();
            
            this.log(`Peer Signal Lost: ${peerId}`, 'warn');
            this.log(`Session Active. Waiting for peer re-connection...`, 'info');
        };
        this.manager.onRemoteStream = (stream, peerId) => {
            const remoteVideo = document.getElementById('collab-remote-video');
            if (remoteVideo) {
                remoteVideo.srcObject = stream;
                remoteVideo.play().catch(e => console.log('Remote play error', e));
                this.log(`Receiving Video Feed (WebRTC Stream)`, 'success');
                this.hasRemoteStream = true;
                // Assume enabled until told otherwise (or wait for state)
                this.remoteVideoEnabled = true; 
                this.updateVideoVisibility();
            }
        };
        this.manager.onPeerMediaChange = (peerId, state) => {
            this.remoteVideoEnabled = state.video;
            // We can also handle audio indication here (e.g. mute icon on remote video)
            this.updateVideoVisibility();
        };
        this.manager.onDisconnect = () => {
            this.updateStatus(false);
            this.showToast('Session Ended');
            document.getElementById('collab-hud').classList.add('hidden');
            document.getElementById('collab-top-bar').classList.add('hidden');
            document.getElementById('collab-modal').classList.add('hidden'); // Ensure modal closes
            this.restoreToolbarItems(); 
            this.log('Disconnected from Swarm.', 'error');
        };
    }

    injectHTML() {
        // 1. Connection Modal
        const modalHtml = `
        <div id="collab-modal" class="modal-overlay hidden">
            <div class="modal-window popup-max-width-md">
                <div class="modal-header">
                    <span>Collaboration (Beta)</span>
                    <button id="collab-close-btn" class="btn-text">✕</button>
                </div>
                <div class="modal-body collab-modal-content">
                    <p class="text-meta">Start a real-time session. P2P, Encrypted, Serverless.</p>
                    
                    <div id="collab-start-view">
                        <div class="flex-row justify-center gap-2 mt-3">
                            <button id="collab-create-btn" class="modal-btn-primary" style="background:var(--accent); width: 100%;">
                                <i class="fas fa-play mr-1"></i> Start New Session
                            </button>
                        </div>
                        <div class="text-center mt-2">OR</div>
                         <div class="flex-col gap-1 mt-2">
                            <label class="settings-label">Paste Invite Link</label>
                            <div class="flex-row gap-1">
                                <input type="text" id="collab-join-input" class="settings-input" placeholder="Paste link here...">
                                <button id="collab-join-btn" class="btn-text btn-border">Join</button>
                            </div>
                        </div>
                    </div>

                    <div id="collab-waiting-view" class="hidden text-center">
                        <div class="loader-spinner" style="width: 30px; height: 30px; margin: 0 auto; border-width: 3px;"></div>
                        <h3 class="mt-2">Waiting for peer...</h3>
                        <p class="text-meta text-sm mb-2">Share this link:</p>
                        
                        <div class="flex-row gap-1">
                            <input type="text" id="collab-invite-link" class="settings-input text-center" readonly onclick="this.select()">
                            <button id="collab-copy-btn" class="modal-btn-primary"><i class="fas fa-copy"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 2. Top Status Bar
        const topBarHtml = `
        <div id="collab-top-bar" class="hidden">
            <div class="collab-bar-section">
                <div id="collab-mode-badge" class="collab-status-badge reader">
                    <div class="collab-pulse"></div>
                    <span id="collab-mode-text">READER</span>
                </div>
                <span id="collab-room-id-display" class="text-meta" style="font-family:monospace; opacity: 0.7;"></span>
            </div>
            <div class="flex-grow"></div>
            <div class="collab-bar-section">
                <button id="collab-baton-btn" disabled>Waiting...</button>
                <button id="collab-leave-btn" class="btn-text" style="color:var(--text-meta)" title="Leave Session"><i class="fas fa-sign-out-alt"></i></button>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', topBarHtml);

        // 3. Video HUD (Refactored Layout)
        const hudHtml = `
        <div id="collab-hud" class="hidden">
            <div id="collab-console" class="hidden">
                <div class="log-entry system"><span class="log-time">--:--</span> Initializing Secure Environment...</div>
            </div>
            
            <div class="collab-hud-right-pane">
                <div id="collab-video-wrapper" class="collab-video-container hidden">
                    <video id="collab-remote-video" autoplay playsinline></video>
                    <video id="collab-local-video" autoplay playsinline muted></video>
                </div>
                <div class="collab-hud-controls">
                    <button class="collab-btn" id="collab-mic-btn" title="Toggle Mic" disabled><i class="fas fa-microphone-slash"></i></button>
                    <button class="collab-btn" id="collab-cam-btn" title="Toggle Camera"><i class="fas fa-video"></i></button>
                    <button class="collab-btn" id="collab-log-btn" title="Toggle Log Console"><i class="fas fa-terminal"></i></button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', hudHtml);

        // 4. Toast Container
        if (!document.getElementById('collab-toast')) {
            const toast = document.createElement('div');
            toast.id = 'collab-toast';
            toast.className = 'collab-toast';
            document.body.appendChild(toast);
        }
    }

    bindEvents() {
        // Modal & Link Logic
        document.getElementById('collab-close-btn').addEventListener('click', () => {
            document.getElementById('collab-modal').classList.add('hidden');
        });
        
        document.getElementById('collab-create-btn').addEventListener('click', async () => {
            const roomId = 'script-' + Math.random().toString(36).substring(2, 9);
            this.initSession(roomId, true);
            
            // Auto Copy
            setTimeout(() => {
                const linkInput = document.getElementById('collab-invite-link');
                linkInput.select();
                navigator.clipboard.writeText(linkInput.value).then(() => {
                    this.showToast("Link copied to clipboard!");
                });
            }, 500);
        });

        document.getElementById('collab-join-btn').addEventListener('click', () => {
            let input = document.getElementById('collab-join-input').value.trim();
            if (!input) return;
            if (input.includes('?room=')) {
                try {
                    const url = new URL(input);
                    const roomParam = url.searchParams.get('room');
                    if (roomParam) input = roomParam;
                } catch(e) {}
            }
            this.initSession(input, false);
        });

        document.getElementById('collab-copy-btn').addEventListener('click', () => {
            const copyText = document.getElementById('collab-invite-link');
            copyText.select();
            navigator.clipboard.writeText(copyText.value);
            this.showToast("Link copied!");
        });

        // Top Bar Logic
        document.getElementById('collab-leave-btn').addEventListener('click', () => {
            if(confirm("Disconnect from session?")) {
                this.manager.disconnect();
                this.manager.stopMedia();
                this.restoreToolbarItems(); // Restore UI
                document.getElementById('collab-hud').classList.add('hidden');
                document.getElementById('collab-top-bar').classList.add('hidden');
                document.getElementById('collab-modal').classList.add('hidden');
            }
        });

        document.getElementById('collab-baton-btn').addEventListener('click', () => {
             this.log("Transferring write access (Baton)...", 'system');
             this.manager.passBaton();
        });

        // Video HUD Logic
        document.getElementById('collab-log-btn').addEventListener('click', (e) => {
            const consoleEl = document.getElementById('collab-console');
            consoleEl.classList.toggle('hidden');
            e.currentTarget.classList.toggle('active');
        });

        document.getElementById('collab-cam-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const localVideo = document.getElementById('collab-local-video');

            if (btn.classList.contains('active')) {
                // Turn OFF Camera (disable track)
                this.manager.toggleVideo(false);
                btn.classList.remove('active');
                this.updateVideoVisibility();
                this.log("Camera disabled.", 'info');
            } else {
                // Turn ON Camera
                this.log("Starting Camera...", 'system');
                const result = await this.manager.enableMedia(localVideo);
                
                if (result.success) {
                    btn.classList.add('active');
                    this.updateVideoVisibility();
                    this.log("Camera enabled.", 'success');
                } else {
                    this.log(`Error accessing camera: ${result.error}`, 'error');
                }
            }
        });

        document.getElementById('collab-mic-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const localVideo = document.getElementById('collab-local-video');

            if (btn.classList.contains('active')) {
                // Mute
                this.manager.toggleAudio(false);
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                this.log("Microphone muted.", 'info');
            } else {
                // Unmute
                // Check if we can just toggle
                if (this.manager.toggleAudio(true)) {
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fas fa-microphone"></i>';
                    this.log("Microphone unmuted.", 'success');
                } else {
                    // No stream? Start it.
                    this.log("Starting Microphone...", 'system');
                    const result = await this.manager.enableMedia(localVideo);
                    if (result.success) {
                        btn.classList.add('active');
                        btn.innerHTML = '<i class="fas fa-microphone"></i>';
                        btn.disabled = false; // Enable if it was disabled
                        
                        // If camera button is NOT active, ensure video is disabled
                        if (!document.getElementById('collab-cam-btn').classList.contains('active')) {
                            this.manager.toggleVideo(false);
                        }
                        
                        this.updateVideoVisibility();
                        this.log("Microphone started.", 'success');
                    } else {
                        this.log(`Error accessing microphone: ${result.error}`, 'error');
                    }
                }
            }
        });
    }

    updateVideoVisibility() {
        const wrapper = document.getElementById('collab-video-wrapper');
        const localVideo = document.getElementById('collab-local-video');
        const camBtn = document.getElementById('collab-cam-btn');
        
        // Conditions
        const showRemote = this.hasRemoteStream && this.remoteVideoEnabled;
        const localCamActive = camBtn.classList.contains('active');

        if (showRemote) {
            // SHOW WRAPPER (Remote + Local PIP)
            wrapper.classList.remove('hidden');
            
            // Move local video to wrapper if not there
            if (localVideo.parentNode !== wrapper) {
                // Reset styles
                localVideo.style = ""; 
                wrapper.appendChild(localVideo);
            }
        } else {
            // HIDE WRAPPER
            wrapper.classList.add('hidden');
            
            if (localCamActive) {
                // SHOW LOCAL VIDEO ON BUTTON
                if (localVideo.parentNode !== camBtn) {
                    camBtn.appendChild(localVideo);
                    // Apply styles for button background
                    camBtn.style.position = 'relative';
                    camBtn.style.overflow = 'hidden';
                    
                    localVideo.style.position = 'absolute';
                    localVideo.style.top = '0';
                    localVideo.style.left = '0';
                    localVideo.style.width = '100%';
                    localVideo.style.height = '100%';
                    localVideo.style.objectFit = 'cover';
                    localVideo.style.zIndex = '0';
                    localVideo.style.opacity = '0.4';
                    localVideo.style.pointerEvents = 'none';
                    
                    // Ensure icon is above
                    const icon = camBtn.querySelector('i');
                    if(icon) {
                        icon.style.position = 'relative';
                        icon.style.zIndex = '1';
                    }
                }
            } else {
                // Local video off, just ensure it's hidden or back in wrapper (doesn't matter much if hidden)
                // Put it back in wrapper to be safe
                if (localVideo.parentNode !== wrapper) {
                    localVideo.style = "";
                    wrapper.appendChild(localVideo);
                    
                    // Reset button styles
                    camBtn.style = "";
                    const icon = camBtn.querySelector('i');
                    if(icon) icon.style = "";
                }
            }
        }
    }

        

            async initSession(roomId, isHost) {

                if (!roomId) return;

                

                // Ensure Writing Mode

                this.app.ensureWritingMode();

                

                // Show Waiting View ONLY if Host (Guest joins immediately)

                if (isHost) {

                    document.getElementById('collab-start-view').classList.add('hidden');

                    document.getElementById('collab-waiting-view').classList.remove('hidden');

                } else {

                    // Guest: Hide modal immediately, we assume success or show error later

                    document.getElementById('collab-modal').classList.add('hidden');

                }

                

                const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;

                document.getElementById('collab-invite-link').value = link;

                

                this.log(`Initializing session. Room ID: ${roomId}`, 'info');

                this.log(`Role: ${isHost ? 'HOST (You started the session)' : 'GUEST (You joined a session)'}`, 'info');

                this.log(`Connecting to secure peer-to-peer network...`, 'system');

                this.log(`Searching for peers in the swarm...`, 'system');

        

                const success = this.manager.connect(roomId, isHost);

                if (success) {

                    this.showHUD(roomId);

                    this.moveToolbarItems(); // Move UI elements

                    if (isHost) this.showToast("Session started. Waiting for others to join...");

                    else this.showToast("Joining session...");

                    

                    // Auto-Start Media

                    const camBtn = document.getElementById('collab-cam-btn');

                    const micBtn = document.getElementById('collab-mic-btn');

                    

                    // Simulate delay for "Connecting" feel

                    setTimeout(async () => {

                        this.log("Attempting to auto-start camera...", 'system');

                        const result = await this.manager.enableMedia(document.getElementById('collab-local-video'));

                        if (result.success) {

                            camBtn.classList.add('active');

                            micBtn.disabled = false;

                            

                            // Default to Muted

                            this.manager.toggleAudio(false);

                            micBtn.classList.remove('active');

                            micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';

                            

                            this.updateVideoVisibility();

                            this.log("Camera started. Mic muted by default.", 'success');

                        } else {

                             this.log(`Could not auto-start camera: ${result.error}`, 'warn');

                        }

                    }, 800);

        

                    if (document.body.classList.contains('mobile-view')) {

                        document.getElementById('collab-baton-btn').style.display = 'none';

                    }

        

                } else {

                     alert("Failed to initialize connection.");

                     this.log("Error: Connection initialization failed.", 'error');

                     document.getElementById('collab-modal').classList.remove('hidden'); // Re-show if failed

                }

            }
    
    moveToolbarItems() {
        const topBar = document.getElementById('collab-top-bar');
        if (!topBar) return;

        // Ensure we don't move if already moved
        if (this.itemsMoved) return;
        this.itemsMoved = true;

        // Elements to move
        const logo = document.querySelector('#toolbar > h1');
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const typeSelector = document.getElementById('type-selector-container');
        const musicPlayer = document.getElementById('music-player');

        // Create placeholders to remember positions
        this.placeholders = {};
        const createPlaceholder = (el, id) => {
            if (el) {
                const p = document.createElement('div');
                p.id = `placeholder-${id}`;
                p.style.display = 'none';
                el.parentNode.insertBefore(p, el);
                this.placeholders[id] = p;
                return true;
            }
            return false;
        };

        if(createPlaceholder(logo, 'logo')) {
            // Logo goes to far left. We need to insert it at the start of the first section.
            const firstSection = topBar.querySelector('.collab-bar-section');
            if(firstSection) firstSection.insertBefore(logo, firstSection.firstChild);
        }

        const centerSection = document.createElement('div');
        centerSection.className = 'collab-bar-section center-tools';
        // Add Undo/Redo/TypeSelector/Music to a center section or append to existing?
        // Let's create a container for them in the top bar
        
        // We'll insert them into the left section or a new middle section. 
        // Existing layout: [Left Section (Badge, RoomID)] ... [Right Section (Baton, Leave)]
        // We want: [Logo] [Left Section] [Tools] [Right Section]
        
        // Actually, just append to the first section or create a middle one.
        // Let's put them in the middle.
        if(createPlaceholder(undoBtn, 'undo')) centerSection.appendChild(undoBtn);
        if(createPlaceholder(redoBtn, 'redo')) centerSection.appendChild(redoBtn);
        if(createPlaceholder(typeSelector, 'types')) centerSection.appendChild(typeSelector);
        if(createPlaceholder(musicPlayer, 'music')) centerSection.appendChild(musicPlayer);
        
        // Insert center section before the last section (Right Section)
        topBar.insertBefore(centerSection, topBar.lastElementChild);
    }

    restoreToolbarItems() {
        if (!this.itemsMoved || !this.placeholders) return;
        
        const restore = (id, elId) => {
            const p = this.placeholders[id];
            const el = id === 'logo' ? document.querySelector('#collab-top-bar h1') : 
                       id === 'undo' ? document.getElementById('undo-btn') :
                       id === 'redo' ? document.getElementById('redo-btn') :
                       id === 'types' ? document.getElementById('type-selector-container') :
                       id === 'music' ? document.getElementById('music-player') : null;
            
            if (p && el) {
                p.parentNode.insertBefore(el, p);
                p.remove();
            }
        };

        restore('logo');
        restore('undo');
        restore('redo');
        restore('types');
        restore('music');
        
        // Remove the temporary center section
        const centerSection = document.querySelector('#collab-top-bar .center-tools');
        if (centerSection) centerSection.remove();

        this.itemsMoved = false;
        this.placeholders = null;
    }

    joinFromUrl(roomId) {
        this.log(`Detected invite link. Auto-joining room: ${roomId}`, 'system');
        const welcome = document.getElementById('mobile-welcome-modal');
        if (welcome) welcome.classList.add('hidden');
        
        // Ensure Modal is hidden for Guest
        document.getElementById('collab-modal').classList.add('hidden');
        this.initSession(roomId, false);
    }

    openModal() {
        document.getElementById('collab-modal').classList.remove('hidden');
        document.getElementById('collab-start-view').classList.remove('hidden');
        document.getElementById('collab-waiting-view').classList.add('hidden');
    }

    showHUD(roomId) {
        document.getElementById('collab-hud').classList.remove('hidden');
        document.getElementById('collab-top-bar').classList.remove('hidden');
        document.getElementById('collab-room-id-display').textContent = `${roomId}`;
    }

    updateStatus(isConnected) {
        if (isConnected) {
            // Ensure modal is closed if peer connects (for Host who was waiting)
            document.getElementById('collab-modal').classList.add('hidden');
        }
    }

    updateBatonUI(hasBaton) {
        const btn = document.getElementById('collab-baton-btn');
        const badge = document.getElementById('collab-mode-badge');
        const badgeText = document.getElementById('collab-mode-text');

        if (hasBaton) {
            btn.disabled = false;
            btn.textContent = "Pass Baton";
            btn.style.opacity = '1';
            
            badge.className = 'collab-status-badge writer';
            badgeText.textContent = 'WRITER (You can edit)';
        } else {
            btn.disabled = true;
            btn.textContent = "Waiting...";
            btn.style.opacity = '0.7';
            
            badge.className = 'collab-status-badge reader';
            badgeText.textContent = 'READER (View only)';
        }
    }

    showToast(msg) {
        const toast = document.getElementById('collab-toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    log(msg, type = 'info') {
        const consoleEl = document.getElementById('collab-console');
        if (!consoleEl) return;
        
        const now = new Date().toLocaleTimeString([], { hour12: false });
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="log-time">${now}</span> ${msg}`;
        
        consoleEl.appendChild(entry);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }
}

```

5.14 `assets/js-mod/FountainParser.js`
- Fountain syntax parsing utilities.

```js
import * as constants from './Constants.js';

export class FountainParser {
    constructor() {}

    /**
     * Parses a raw Fountain string into SFSS Block Objects.
     * @param {string} text - The raw Fountain text.
     * @returns {Object} { blocks: Array, meta: Object, sceneMeta: Object }
     */
    parse(text) {
        const lines = text.split(/\r\n|\r|\n/);
        const blocks = [];
        const meta = {};
        const sceneMeta = {}; // To store extracted scene numbers and descriptions
        let isTitlePage = true;
        let lastSceneId = null; // Track the current scene to attach synopses/notes
        
        // Regex Helpers
        const regex = {
            sceneHeading: /^(?:INT\.|EXT\.|EST\.|INT\/EXT|I\/E)(\s|\.|\$)/i,
            sceneNumber: /#([^#]+)#/, // Extracts content between # #
            transition: /TO:$/,
            lyrics: /^~/,
            section: /^(#+)(?: *)(.*)/,
            synopsis: /^=(?: *)(.*)/,
            boneyard: /\/\*[\s\S]*?\*\//g, // Multiline (handled differently usually, but simple check here)
            centered: /^>(.*)<$/,
            pageBreak: /^===/
        };

        // 1. Parse Title Page (Key: Value pairs at start)
        let i = 0;
        while (i < lines.length && isTitlePage) {
            const line = lines[i].trim();
            if (line === '') {
                // Blank line might end title page if next line is not key:value
                if (lines[i+1] && !lines[i+1].includes(':')) {
                    isTitlePage = false;
                }
                i++; 
                continue;
            }

            const colonIndex = line.indexOf(':');
            if (colonIndex > -1 && colonIndex < line.length - 1) {
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                meta[key] = value;
                i++;
            } else {
                isTitlePage = false;
            }
        }

        // 2. Parse Body
        for (; i < lines.length; i++) {
            let line = lines[i]; 
            const trimmed = line.trim();

            if (trimmed === '') continue;

            // Check for Synopsis (= Description)
            const synopsisMatch = trimmed.match(regex.synopsis);
            if (synopsisMatch) {
                if (lastSceneId) {
                    if (!sceneMeta[lastSceneId]) sceneMeta[lastSceneId] = {};
                    const desc = synopsisMatch[1].trim();
                    if (sceneMeta[lastSceneId].description) {
                        sceneMeta[lastSceneId].description += '\n' + desc;
                    } else {
                        sceneMeta[lastSceneId].description = desc;
                    }
                }
                continue;
            }

            // Generate ID
            const id = `line-${Math.random().toString(36).substring(2, 11)}`;

            // --- FORCED ELEMENTS ---
            if (trimmed.startsWith('.')) {
                // Forced Scene Heading
                const text = trimmed.substring(1).trim(); // Remove dot
                const { cleanText, number } = this.extractSceneNumber(text);
                if (number) {
                    if (!sceneMeta[id]) sceneMeta[id] = {};
                    sceneMeta[id].number = number;
                }
                
                blocks.push({ type: constants.ELEMENT_TYPES.SLUG, text: cleanText.toUpperCase(), id });
                lastSceneId = id;
                continue;
            }
            if (trimmed.startsWith('!')) {
                // Forced Action
                blocks.push({ type: constants.ELEMENT_TYPES.ACTION, text: trimmed.substring(1), id });
                continue;
            }
            if (trimmed.startsWith('@')) {
                // Forced Character
                blocks.push({ type: constants.ELEMENT_TYPES.CHARACTER, text: trimmed.substring(1).toUpperCase(), id });
                continue;
            }
            if (trimmed.startsWith('>')) {
                // Forced Transition OR Centered
                if (trimmed.endsWith('<')) {
                    // Centered Action
                    const centerText = trimmed.substring(1, trimmed.length - 1).trim();
                    blocks.push({ type: constants.ELEMENT_TYPES.ACTION, text: centerText, id, centered: true });
                } else {
                    // Forced Transition
                    blocks.push({ type: constants.ELEMENT_TYPES.TRANSITION, text: trimmed.substring(1).toUpperCase(), id });
                }
                continue;
            }

            // --- HEURISTICS ---

            // Scene Headings
            if (regex.sceneHeading.test(trimmed)) {
                const { cleanText, number } = this.extractSceneNumber(trimmed);
                if (number) {
                    if (!sceneMeta[id]) sceneMeta[id] = {};
                    sceneMeta[id].number = number;
                }
                blocks.push({ type: constants.ELEMENT_TYPES.SLUG, text: cleanText.toUpperCase(), id });
                lastSceneId = id;
                continue;
            }

            // Transitions (Uppercase, ends with TO:)
            if (trimmed === trimmed.toUpperCase() && regex.transition.test(trimmed)) {
                blocks.push({ type: constants.ELEMENT_TYPES.TRANSITION, text: trimmed, id });
                continue;
            }

            // Character (Uppercase, preceded by blank line - usually)
            if (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && !['(', ')'].includes(trimmed[0])) {
                // Peek ahead to see if it's followed by text (Dialogue)
                let nextLineIndex = i + 1;
                while (nextLineIndex < lines.length && lines[nextLineIndex].trim() === '') nextLineIndex++;
                
                const nextLine = lines[nextLineIndex] ? lines[nextLineIndex].trim() : null;
                
                if (nextLine) {
                     // It is likely a character
                     let text = trimmed;
                     if (text.endsWith('^')) {
                         text = text.substring(0, text.length - 1).trim();
                     }
                     blocks.push({ type: constants.ELEMENT_TYPES.CHARACTER, text: text, id });
                     continue;
                }
            }

            // Parenthetical
            if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                blocks.push({ type: constants.ELEMENT_TYPES.PARENTHETICAL, text: trimmed, id });
                continue;
            }

            // Dialogue (If previous block was Character or Parenthetical)
            const prevBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
            if (prevBlock && (prevBlock.type === constants.ELEMENT_TYPES.CHARACTER || prevBlock.type === constants.ELEMENT_TYPES.PARENTHETICAL)) {
                blocks.push({ type: constants.ELEMENT_TYPES.DIALOGUE, text: trimmed, id });
                continue;
            }

            // Default: Action
            blocks.push({ type: constants.ELEMENT_TYPES.ACTION, text: trimmed, id });
        }

        return { blocks, meta, sceneMeta };
    }

    /**
     * Generates a Fountain string from SFSS data.
     * @param {Object} scriptData - { meta: {}, blocks: [], sceneMeta: {} }
     * @returns {string} The formatted Fountain script.
     */
    generate(scriptData) {
        const blocks = scriptData.blocks;
        const meta = scriptData.meta || {};
        const sceneMeta = scriptData.sceneMeta || {};
        let output = [];

        // 1. Title Page
        if (meta.title) output.push(`Title: ${meta.title}`);
        if (meta.author) output.push(`Author: ${meta.author}`);
        if (meta.contact) {
            output.push(`Contact:\n${meta.contact}`);
        }
        output.push('\n'); // Separator

        // 2. Body
        blocks.forEach((block, index) => {
            const text = block.text;
            const type = block.type;
            const prevType = index > 0 ? blocks[index - 1].type : null;
            
            // Add blank lines before certain elements
            if (index > 0) {
                 const needsSpacing = [
                     constants.ELEMENT_TYPES.SLUG, 
                     constants.ELEMENT_TYPES.ACTION, 
                     constants.ELEMENT_TYPES.CHARACTER,
                     constants.ELEMENT_TYPES.TRANSITION
                 ].includes(type);
                 
                 // Don't double space dialogue/parentheticals attached to character
                 if (type === constants.ELEMENT_TYPES.DIALOGUE || type === constants.ELEMENT_TYPES.PARENTHETICAL) {
                     // No space
                 } else if (type === constants.ELEMENT_TYPES.ACTION && prevType === constants.ELEMENT_TYPES.SLUG) {
                     output.push('');
                 } else if (needsSpacing) {
                     output.push('');
                 }
            }

            switch (type) {
                case constants.ELEMENT_TYPES.SLUG:
                    let line = text.toUpperCase();
                    if (!line.startsWith('.') && !/^(INT|EXT|EST|I\/E)/i.test(line)) {
                        line = '.' + line; // Force it if it doesn't look like one
                    }
                    // Attach Scene Number
                    if (sceneMeta[block.id] && sceneMeta[block.id].number) {
                        line += ` #${sceneMeta[block.id].number}#`;
                    }
                    output.push(line);
                    
                    // Attach Synopsis (Description)
                    if (sceneMeta[block.id] && sceneMeta[block.id].description) {
                         const descLines = sceneMeta[block.id].description.split('\n');
                         descLines.forEach(l => {
                             if (l.trim()) output.push(`= ${l.trim()}`);
                         });
                    }
                    break;
                
                case constants.ELEMENT_TYPES.ACTION:
                    if (text.startsWith('!')) output.push(text); // Already forced
                    else if (block.centered) output.push(`> ${text} <`);
                    else output.push(text);
                    break;

                case constants.ELEMENT_TYPES.CHARACTER:
                    // Force if contains lowercase or isn't standard
                    if (text !== text.toUpperCase() || text.includes('(')) {
                         if (/[a-z]/.test(text.replace(/\(.*\)/, ''))) {
                             output.push(`@${text}`);
                         } else {
                             output.push(text.toUpperCase());
                         }
                    } else {
                        output.push(text);
                    }
                    break;

                case constants.ELEMENT_TYPES.DIALOGUE:
                    output.push(text);
                    break;

                case constants.ELEMENT_TYPES.PARENTHETICAL:
                    output.push(text);
                    break;

                case constants.ELEMENT_TYPES.TRANSITION:
                    if (!text.endsWith('TO:')) {
                        output.push(`> ${text.toUpperCase()}`);
                    } else {
                        output.push(text.toUpperCase());
                    }
                    break;
            }
        });

        return output.join('\n');
    }

    extractSceneNumber(text) {
        const match = text.match(/#([^#]+)#/);
        if (match) {
            // Return text without the number, and the number itself
            const cleanText = text.replace(/#([^#]+)#/, '').trim();
            return { cleanText, number: match[1] };
        }
        return { cleanText: text, number: null };
    }
}
```

5.15 `assets/js-mod/SettingsManager.js`
- Keyboard shortcut and settings modal management.

```js
import * as constants from './Constants.js';

export class SettingsManager {
    constructor(sfss) {
        this.sfss = sfss;
        
        // Shortcuts
        const storedShortcuts = localStorage.getItem('sfss_shortcuts');
        this.shortcuts = storedShortcuts ? JSON.parse(storedShortcuts) : { cycleType: 'Ctrl+Shift' };

        // Keymap
        this.keymap = {
            [constants.ELEMENT_TYPES.SLUG]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.CHARACTER },
            [constants.ELEMENT_TYPES.ACTION]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.CHARACTER },
            [constants.ELEMENT_TYPES.CHARACTER]: { enter: constants.ELEMENT_TYPES.DIALOGUE, tab: constants.ELEMENT_TYPES.PARENTHETICAL },
            [constants.ELEMENT_TYPES.DIALOGUE]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.PARENTHETICAL },
            [constants.ELEMENT_TYPES.PARENTHETICAL]: { enter: constants.ELEMENT_TYPES.DIALOGUE, tab: constants.ELEMENT_TYPES.DIALOGUE },
            [constants.ELEMENT_TYPES.TRANSITION]: { enter: constants.ELEMENT_TYPES.SLUG, tab: constants.ELEMENT_TYPES.ACTION }
        };

        const storedKeymap = localStorage.getItem('sfss_keymap');
        if (storedKeymap) {
            try {
                const parsed = JSON.parse(storedKeymap);
                this.keymap = { ...this.keymap, ...parsed };
            } catch (e) {
                console.error("Error loading keymap", e);
            }
        }
    }

    open() {
        // Manually close other popups via sfss
        this.sfss.editorHandler.closePopups();
        this.sfss.sidebarManager.closeSceneSettings();
        this.sfss.sidebarManager.closeScriptMetaPopup();
        document.getElementById('help-modal').classList.add('hidden');
        document.getElementById('reports-modal').classList.add('hidden');
        
        this.generateUI();
        document.getElementById('settings-modal').classList.remove('hidden');
        this.sfss.pushHistoryState('settings');
    }

    close() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    async save() {
        localStorage.setItem('sfss_keymap', JSON.stringify(this.keymap));
        localStorage.setItem('sfss_shortcuts', JSON.stringify(this.shortcuts));
        await this.sfss.persistSettings();
    }

    checkShortcut(e, action) {
        if (!this.shortcuts[action]) return false;
        const keys = this.shortcuts[action].toLowerCase().split('+');
        const pressedKey = e.key.toLowerCase();
        const ctrl = keys.includes('ctrl') || keys.includes('control') || keys.includes('meta') || keys.includes('cmd');
        const shift = keys.includes('shift');
        const alt = keys.includes('alt');
        
        if (ctrl !== (e.ctrlKey || e.metaKey)) return false;
        if (shift !== e.shiftKey) return false;
        if (alt !== e.altKey) return false;
        
        const mainKey = keys.find(k => !['ctrl', 'control', 'meta', 'cmd', 'shift', 'alt'].includes(k));
        if (mainKey) {
            return mainKey === pressedKey;
        } else {
            return true; 
        }
    }

    toggleTheme() {
        document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('sfss_theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');
    }

    generateUI() {
        const container = document.getElementById('keymap-settings');
        container.innerHTML = '';
        
        // --- Global Shortcuts Section ---
        const globalHeader = document.createElement('h3');
        globalHeader.textContent = 'Global Shortcuts';
        globalHeader.style.marginBottom = '0.5rem';
        container.appendChild(globalHeader);
        
        const globalTable = document.createElement('table');
        globalTable.className = 'keymap-table';
        globalTable.style.marginBottom = '1.5rem';
        
        const row = document.createElement('tr');
        const labelCell = document.createElement('td');
        labelCell.textContent = 'Toggle Element Type';
        
        const inputCell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'settings-input';
        input.value = this.shortcuts.cycleType || '';
        input.readOnly = true;
        input.placeholder = 'Click to record...';
        input.style.cursor = 'pointer';
        input.style.textAlign = 'center';
        
        input.addEventListener('keydown', (e) => {
            e.preventDefault();
            if (e.key === 'Escape') {
                input.blur();
                return;
            }
            if (e.key === 'Backspace') {
                this.shortcuts.cycleType = '';
                input.value = '';
                return;
            }
            const keys = [];
            if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
            if (e.altKey) keys.push('Alt');
            if (e.shiftKey) keys.push('Shift');
            
            if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                keys.push(e.key.toUpperCase());
            }
            
            // Allow just modifiers (e.g. Ctrl+Shift)
            if (keys.length > 0) {
                const shortcut = keys.join('+');
                this.shortcuts.cycleType = shortcut;
                input.value = shortcut;
            }
        });
        
        inputCell.appendChild(input);
        row.appendChild(labelCell);
        row.appendChild(inputCell);
        globalTable.appendChild(row);
        container.appendChild(globalTable);
        
        // --- Element Transitions Section ---
        const transHeader = document.createElement('h3');
        transHeader.textContent = 'Element Transitions';
        transHeader.style.marginBottom = '0.5rem';
        container.appendChild(transHeader);
        
        const keyOrder = ['tab', 'enter'];
        const table = document.createElement('table');
        table.className = 'keymap-table';
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Element</th>
                <th><span class="keycap">Tab</span> ➔</th>
                <th><span class="keycap">Enter</span> ➔</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        for (const type in this.keymap) {
            const typeLabel = constants.TYPE_LABELS[type];
            const row = document.createElement('tr');
            const typeCell = document.createElement('td');
            typeCell.textContent = typeLabel;
            row.appendChild(typeCell);
            
            keyOrder.forEach(key => {
                const keyCell = document.createElement('td');
                const selector = this.createSelector(type, key);
                keyCell.appendChild(selector);
                row.appendChild(keyCell);
            });
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        container.appendChild(table);
    }

    createSelector(type, key) {
        const selector = document.createElement('select');
        selector.className = 'settings-input'; 
        selector.dataset.type = type;
        selector.dataset.key = key;
        
        const noneOption = document.createElement('option');
        noneOption.value = 'null';
        noneOption.textContent = 'None (Show Menu)';
        selector.appendChild(noneOption);
        
        for (const optionType in constants.TYPE_LABELS) {
            const isActionEnterAction = type === constants.ELEMENT_TYPES.ACTION && key === 'enter' && optionType === constants.ELEMENT_TYPES.ACTION;
            if (optionType === type && !isActionEnterAction) continue;
            
            const option = document.createElement('option');
            option.value = optionType;
            option.textContent = `${constants.TYPE_LABELS[optionType]}`;
            selector.appendChild(option);
        }
        
        selector.value = this.keymap[type][key] || 'null';
        selector.addEventListener('change', (e) => {
            this.keymap[e.target.dataset.type][e.target.dataset.key] = e.target.value === 'null' ? null : e.target.value;
        });
        return selector;
    }
}

```

5.16 `assets/js-mod/TreatmentManager.js`
- Treatment-mode data/state manager.

```js
import * as constants from './Constants.js';

export class TreatmentManager {
    constructor(sfss) {
        this.sfss = sfss;
        this.isActive = false;
    }

    toggle() {
        document.body.classList.add('mode-switching');
        
        // Use timeout to allow UI to update (show loader/spinner if any)
        setTimeout(() => {
            if (!this.isActive) {
                // Entering Treatment Mode
                this.sfss.scriptData = this.sfss.exportToJSONStructure(true); // Capture current state
                
                // CRITICAL: Disable Page View immediately to prevent background pagination
                if (this.sfss.pageViewActive) {
                    this.sfss.pageViewActive = false;
                    document.getElementById('app-container').classList.remove('page-view-active');
                    this.sfss.pageViewContainer.classList.add('hidden');
                    document.getElementById('page-view-btn').classList.remove('active');
                }

                const topElementId = this.sfss.getCurrentScrollElement();
                this.isActive = true;
                
                // Update Switches
                const switchEl = document.getElementById('treatment-mode-switch');
                const mobileSwitchEl = document.getElementById('mobile-treatment-switch');
                if(switchEl) switchEl.checked = true;
                if(mobileSwitchEl) mobileSwitchEl.checked = true;

                // UI Updates
                document.getElementById('app-container').classList.add('treatment-mode-active');
                document.getElementById('page-view-btn').classList.add("hidden"); // Hide button in treatment mode
                document.getElementById('print-title-page').style.display = 'none';

                // Prepare Editor for Kanban
                this.sfss.editor.contentEditable = false; 
                this.sfss.editor.style.display = 'block'; 
                this.sfss.editor.innerHTML = ''; // Clear text to save memory/reflow
                
                // Render
                this.sfss.treatmentRenderer.renderFromData(this.sfss.scriptData.blocks, this.sfss.editor);

                if (topElementId) {
                    setTimeout(() => this.sfss.scrollToScene(topElementId), 50);
                }

            } else {
                // Exiting Treatment Mode
                this.sfss.toggleLoader(true);
                
                const topElementId = this.sfss.getCurrentScrollElement();
                this.isActive = false;

                // Update Switches
                const switchEl = document.getElementById('treatment-mode-switch');
                const mobileSwitchEl = document.getElementById('mobile-treatment-switch');
                if(switchEl) switchEl.checked = false;
                if(mobileSwitchEl) mobileSwitchEl.checked = false;

                // UI Updates
                document.getElementById('app-container').classList.remove('treatment-mode-active');
                document.getElementById('page-view-btn').classList.remove("hidden"); // Show button again
                
                // Hide editor content immediately to avoid "blurred script" visual glitch
                this.sfss.editor.style.visibility = 'hidden';

                // Reset Editor
                this.sfss.editor.contentEditable = !document.body.classList.contains('mobile-view');
                this.sfss.editor.innerHTML = ''; 
                this.sfss.editor.style.display = ''; // Visible by default

                // Restore Content
                // Note: importJSON handles rendering to this.editor
                this.sfss.importJSON(this.sfss.scriptData, true);

                document.getElementById('print-title-page').style.display = '';

                if (topElementId) {
                    this.sfss.restoreScrollToElement(topElementId);
                }
                
                // Reveal editor after a short delay to ensure rendering is complete
                setTimeout(() => {
                    this.sfss.editor.style.visibility = 'visible';
                    this.sfss.toggleLoader(false);
                }, 50);
            }

            this.sfss.updateToolbarButtons();
            setTimeout(() => document.body.classList.remove('mode-switching'), 350);
        }, 10);
    }

    updateSceneDescription(slugId, newTexts) {
        if (!this.sfss.scriptData || !this.sfss.scriptData.blocks) return; 
        const blocks = this.sfss.scriptData.blocks;
        const slugIndex = blocks.findIndex(b => b.id === slugId); 
        if (slugIndex === -1) return;
        
        let insertIndex = slugIndex + 1;
        if (insertIndex < blocks.length && blocks[insertIndex].type === constants.ELEMENT_TYPES.ACTION && blocks[insertIndex].text.startsWith('Characters:')) {
            insertIndex++;
        }
        
        let endIndex = insertIndex;
        while (endIndex < blocks.length && blocks[endIndex].type === constants.ELEMENT_TYPES.ACTION) {
            endIndex++;
        }
        
        const countToRemove = endIndex - insertIndex;
        const newBlocks = newTexts.map(t => ({
            type: constants.ELEMENT_TYPES.ACTION,
            text: t,
            id: `line-${Math.random().toString(36).substring(2, 11)}`
        }));
        
        blocks.splice(insertIndex, countToRemove, ...newBlocks);
        if (!this.sfss.sceneMeta[slugId]) this.sfss.sceneMeta[slugId] = {};
        this.sfss.sceneMeta[slugId].description = newTexts.join('\n\n');
        this.sfss.isDirty = true;
    }

    addTransition(slugId) {
        if (!this.sfss.scriptData) return;
        const blocks = this.sfss.scriptData.blocks;
        const slugIndex = blocks.findIndex(b => b.id === slugId);
        if (slugIndex === -1) return;
        
        let endIndex = slugIndex + 1;
        while (endIndex < blocks.length && blocks[endIndex].type !== constants.ELEMENT_TYPES.SLUG) {
            endIndex++;
        }
        
        blocks.splice(endIndex, 0, {
            type: constants.ELEMENT_TYPES.TRANSITION,
            text: 'CUT TO:',
            id: `line-${Math.random().toString(36).substring(2, 11)}`
        });
        this.sfss.isDirty = true;
        this.sfss.treatmentRenderer.refreshScene(slugId);
    }

    addSceneHeading(slugId) {
        if (!this.sfss.scriptData) return;
        const blocks = this.sfss.scriptData.blocks;
        const slugIndex = blocks.findIndex(b => b.id === slugId);
        if (slugIndex === -1) return;
        
        let endIndex = slugIndex + 1;
        while (endIndex < blocks.length && blocks[endIndex].type !== constants.ELEMENT_TYPES.SLUG) {
            endIndex++;
        }
        
        blocks.splice(endIndex, 0, {
            type: constants.ELEMENT_TYPES.SLUG,
            text: 'INT. ',
            id: `line-${Math.random().toString(36).substring(2, 11)}`
        });
        this.sfss.isDirty = true;
        this.refreshView();
    }

    addCharacter(slugId, charName) {
        if (!this.sfss.scriptData) return;
        const blocks = this.sfss.scriptData.blocks;
        const slugIndex = blocks.findIndex(b => b.id === slugId);
        if (slugIndex === -1) return;
        
        let targetIndex = slugIndex + 1;
        let charBlock = null;
        if (targetIndex < blocks.length && blocks[targetIndex].type === constants.ELEMENT_TYPES.ACTION && blocks[targetIndex].text.startsWith('Characters:')) {
            charBlock = blocks[targetIndex];
        }
        
        if (charBlock) {
            if (!charBlock.text.toUpperCase().includes(charName.toUpperCase())) {
                charBlock.text += `, ${charName}`;
            }
        } else {
            charBlock = {
                type: constants.ELEMENT_TYPES.ACTION,
                text: `Characters: ${charName}`,
                id: `line-${Math.random().toString(36).substring(2, 11)}`
            };
            blocks.splice(targetIndex, 0, charBlock);
        }
        this.sfss.editorHandler.commitCharacter(charName);
        this.sfss.isDirty = true;
        this.sfss.treatmentRenderer.refreshScene(slugId);
    }

    moveScene(index, direction) {
        if (!this.sfss.scriptData) return;
        const sceneRanges = [];
        let currentStart = 0;
        let currentSlug = null;
        this.sfss.scriptData.blocks.forEach((b, i) => {
            if (b.type === constants.ELEMENT_TYPES.SLUG) {
                if (currentSlug) {
                    sceneRanges.push({ start: currentStart, end: i, id: currentSlug.id });
                }
                currentStart = i;
                currentSlug = b;
            }
        });
        if (currentSlug) {
            sceneRanges.push({ start: currentStart, end: this.sfss.scriptData.blocks.length, id: currentSlug.id });
        }
        
        if (index < 0 || index >= sceneRanges.length) return;
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= sceneRanges.length) return;
        
        const sourceRange = sceneRanges[index];
        const targetRange = sceneRanges[targetIndex];
        const sourceBlocks = this.sfss.scriptData.blocks.slice(sourceRange.start, sourceRange.end);
        
        this.sfss.scriptData.blocks.splice(sourceRange.start, sourceRange.end - sourceRange.start);
        const newTargetSlugIndex = this.sfss.scriptData.blocks.findIndex(b => b.id === targetRange.id);
        
        let insertIndex;
        if (direction === -1) {
            insertIndex = newTargetSlugIndex;
        } else {
            let nextSlugIndex = -1;
            for (let i = newTargetSlugIndex + 1; i < this.sfss.scriptData.blocks.length; i++) {
                if (this.sfss.scriptData.blocks[i].type === constants.ELEMENT_TYPES.SLUG) {
                    nextSlugIndex = i;
                    break;
                }
            }
            if (nextSlugIndex === -1) {
                insertIndex = this.sfss.scriptData.blocks.length;
            } else {
                insertIndex = nextSlugIndex;
            }
        }
        
        this.sfss.scriptData.blocks.splice(insertIndex, 0, ...sourceBlocks);
        this.sfss.isDirty = true;
        this.sfss.treatmentRenderer.renderFromData(this.sfss.scriptData.blocks, this.sfss.editor);
        
        setTimeout(() => {
            const blocks = this.sfss.editor.querySelectorAll('.treatment-scene-block');
            if (blocks[targetIndex]) blocks[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
    }

    refreshView() {
        if (this.isActive) {
             this.sfss.treatmentRenderer.renderFromData(this.sfss.scriptData.blocks, this.sfss.editor);
        }
    }

    getScrollElement() {
        const scrollContainer = document.getElementById('scroll-area');
        const containerRect = scrollContainer.getBoundingClientRect();
        const blocks = this.sfss.editor.querySelectorAll('.treatment-scene-block');
        for (const block of blocks) {
            const rect = block.getBoundingClientRect();
            if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
                return block.dataset.sceneId;
            }
        }
        return null;
    }
}

```

5.17 `assets/js-mod/IOManager.js`
- Import/export flows for JSON/FDX/Fountain/text.

```js
import * as constants from './Constants.js';

export class IOManager {
    constructor(sfss) {
        this.sfss = sfss;
    }

    async downloadJSON() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        const data = this.sfss.exportToJSONStructure();
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.json`;
        a.click();
    }

    uploadFile(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const newScript = this.sfss.storageManager.createNewScript();
                await this.sfss.loadScript(newScript.id, newScript);
                if (file.name.endsWith('.fdx')) {
                    await this.importFDX(e.target.result);
                } else if (file.name.endsWith('.json')) {
                    await this.sfss.importJSON(JSON.parse(e.target.result)); 
                } else if (file.name.endsWith('.fountain')) {
                    const parsed = this.sfss.fountainParser.parse(e.target.result);
                    await this.sfss.importJSON({
                        blocks: parsed.blocks, 
                        meta: { ...this.sfss.meta, ...parsed.meta }, 
                        sceneMeta: parsed.sceneMeta 
                    });
                } else {
                    // Fallback for .txt or other: Use fountain parser anyway as it handles plain text well
                    const parsed = this.sfss.fountainParser.parse(e.target.result);
                    await this.sfss.importJSON({
                        blocks: parsed.blocks, 
                        meta: { ...this.sfss.meta, ...parsed.meta }, 
                        sceneMeta: parsed.sceneMeta 
                    });
                }
            } catch (err) { 
                console.error(err);
                alert('Invalid file format or error importing.'); 
            }
        };
        reader.readAsText(file);
        input.value = '';
    }

    async importFDX(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const mainContent = xmlDoc.querySelector('FinalDraft > Content');
        if (!mainContent) { alert("No script content found in FDX."); return; }
        
        const paragraphs = mainContent.querySelectorAll("Paragraph");
        this.sfss.editor.innerHTML = '';
        this.sfss.characters.clear();
        this.sfss.sceneMeta = {}; // Reset scene meta
        this.sfss.meta.title = xmlDoc.querySelector('Title') ? xmlDoc.querySelector('Title').textContent : ''; 
        
        // Try to get Author/Contact from TitlePage if possible (basic check)
        this.sfss.applySettings();
        
        paragraphs.forEach(p => {
            const type = p.getAttribute("Type");
            const number = p.getAttribute("Number"); // Read Scene Number
            let text = Array.from(p.getElementsByTagName("Text")).map(t => t.textContent).join('');
            if (!text && p.textContent) text = p.textContent;
            
            const dzType = constants.FDX_REVERSE_MAP[type] || constants.ELEMENT_TYPES.ACTION;
            const block = this.sfss.editorHandler.createBlock(dzType, text);
            
            if (dzType === constants.ELEMENT_TYPES.SLUG) {
                // Check Scene Properties
                const props = p.querySelector('SceneProperties');
                if (props || number) {
                     if (!this.sfss.sceneMeta[block.dataset.lineId]) this.sfss.sceneMeta[block.dataset.lineId] = {};
                     if (number) this.sfss.sceneMeta[block.dataset.lineId].number = number;
                     if (props) {
                         const summaryEl = props.querySelector('Summary');
                         let summary = '';
                         if (summaryEl) {
                             // Extract text from all Paragraphs within Summary
                             summary = Array.from(summaryEl.querySelectorAll('Paragraph')).map(para => {
                                 return Array.from(para.querySelectorAll('Text')).map(t => t.textContent).join('');
                             }).join('\n');
                         }
                         const title = props.getAttribute('Title');
                         if (summary) this.sfss.sceneMeta[block.dataset.lineId].description = summary;
                         else if (title) this.sfss.sceneMeta[block.dataset.lineId].description = title;
                     }
                }
            }
            if (dzType === constants.ELEMENT_TYPES.CHARACTER) {
                const clean = this.sfss.editorHandler.getCleanCharacterName(text);
                if (clean.length > 1) this.sfss.characters.add(clean);
            }
        });
        
        this.sfss.sidebarManager.updateSceneList();
        await this.sfss.save();
        this.sfss.saveState(true);
    }

    async downloadFDX() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        
        // 1. Calculate Scene Stats (Headless Pagination)
        const hiddenContainer = document.createElement('div');
        hiddenContainer.style.position = 'absolute';
        hiddenContainer.style.visibility = 'hidden';
        hiddenContainer.style.width = '8.5in'; // US Letter standard
        document.body.appendChild(hiddenContainer);
        
        const sceneNumberMap = {};
        Object.keys(this.sfss.sceneMeta).forEach(id => {
            if (this.sfss.sceneMeta[id].number) sceneNumberMap[id] = this.sfss.sceneMeta[id].number;
        });
        
        this.sfss.pageRenderer.render(Array.from(this.sfss.editor.querySelectorAll('.script-line')), hiddenContainer, {
            showSceneNumbers: true,
            sceneNumberMap: sceneNumberMap
        });
        
        const sceneStats = {}; 
        const pages = hiddenContainer.querySelectorAll('.page');
        let currentSceneId = null;
        let currentSceneHeight = 0;
        let currentSceneStartPage = 1;
        
        pages.forEach((page, pageIndex) => {
            const pageNum = pageIndex + 1;
            const content = page.querySelector('.content-wrapper');
            if (!content) return;
            
            Array.from(content.children).forEach(node => {
                if (node.classList.contains(constants.ELEMENT_TYPES.SLUG)) {
                    if (currentSceneId) {
                         const eighths = Math.max(1, Math.round((currentSceneHeight / this.sfss.CONTENT_HEIGHT_PX) * 8));
                         if (!sceneStats[currentSceneId]) sceneStats[currentSceneId] = { page: currentSceneStartPage, length: `${eighths}/8` };
                    }
                    currentSceneId = node.dataset.lineId;
                    currentSceneHeight = 0;
                    currentSceneStartPage = pageNum;
                    currentSceneHeight += node.offsetHeight;
                } else {
                    if (currentSceneId) {
                        currentSceneHeight += node.offsetHeight;
                    }
                }
            });
        });
        
        if (currentSceneId) {
             const eighths = Math.max(1, Math.round((currentSceneHeight / this.sfss.CONTENT_HEIGHT_PX) * 8));
             sceneStats[currentSceneId] = { page: currentSceneStartPage, length: `${eighths}/8` };
        }
        document.body.removeChild(hiddenContainer);
        
        // 2. Build SmartType Lists
        const characters = new Set();
        const locations = new Set();
        const times = new Set();
        const extensions = new Set();
        
        this.sfss.editor.querySelectorAll('.script-line').forEach(block => {
            const type = this.sfss.editorHandler.getBlockType(block);
            const text = block.textContent.trim();
            if (type === constants.ELEMENT_TYPES.CHARACTER) {
                const clean = this.sfss.editorHandler.getCleanCharacterName(text);
                if (clean.length > 1) characters.add(clean);
                const extMatch = text.match(/\((.*?)\)/);
                if (extMatch) extensions.add(extMatch[1]);
            } else if (type === constants.ELEMENT_TYPES.SLUG) {
                const parts = text.split('-');
                if (parts.length > 0) locations.add(parts[0].trim());
                if (parts.length > 1) times.add(parts[parts.length - 1].trim());
            }
        });
        
        // 3. Generate XML
        let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<FinalDraft DocumentType="Script" Template="No" Version="1">\n<Content>\n`;
        let autoSceneIndex = 1;
        
        this.sfss.editor.querySelectorAll('.script-line').forEach(block => {
            const type = this.sfss.editorHandler.getBlockType(block);
            const fdxType = constants.FDX_MAP[type] || 'Action';
            const text = this.escapeXML(block.textContent);
            const id = block.dataset.lineId;
            let openTag = `<Paragraph Type="${fdxType}">`;
            
            if (type === constants.ELEMENT_TYPES.SLUG) {
                const stats = sceneStats[id] || { page: 1, length: "1/8" };
                const num = sceneNumberMap[id] || autoSceneIndex;
                const metaDesc = this.sfss.sceneMeta[id] && this.sfss.sceneMeta[id].description ? this.escapeXML(this.sfss.sceneMeta[id].description) : '';
                
                openTag = `<Paragraph Type="${fdxType}" Number="${num}">`;
                openTag += `<SceneProperties Length="${stats.length}" Page="${stats.page}" Title="">
`;
                if (metaDesc) {
                    openTag += `<Summary>
`;
                    const descLines = this.sfss.sceneMeta[id].description.split('\n');
                    descLines.forEach(line => {
                        openTag += `<Paragraph Alignment="Left" FirstIndent="0.00" Leading="Regular" LeftIndent="0.00" RightIndent="1.39" SpaceBefore="0" Spacing="1" StartsNewPage="No">
`;
                        openTag += `<Text AdornmentStyle="0" Background="#FFFFFFFFFFFF" Color="#000000000000" Font="Courier Final Draft" RevisionID="0" Size="12" Style="">${this.escapeXML(line)}</Text>
`;
                        openTag += `</Paragraph>
`;
                    });
                    openTag += `</Summary>
`;
                }
                openTag += `</SceneProperties>`;
                autoSceneIndex++;
            }
            xml += `${openTag}\n<Text>${text}</Text>\n</Paragraph>\n`;
        });
        
        xml += `</Content>\n`;
        
        // 4. Metadata Blocks
        xml += `<TitlePage>\n<Content>\n`;
        xml += `<Paragraph Alignment="Center"><Text>Title: ${this.escapeXML(this.sfss.meta.title)}</Text></Paragraph>\n`;
        xml += `<Paragraph Alignment="Center"><Text>Author: ${this.escapeXML(this.sfss.meta.author)}</Text></Paragraph>\n`;
        xml += `<Paragraph Alignment="Center"><Text>Contact: ${this.escapeXML(this.sfss.meta.contact)}</Text></Paragraph>\n`;
        xml += `</Content>\n</TitlePage>\n`;
        
        xml += `<SmartType>\n`;
        const addList = (name, set) => {
            xml += `<${name}>\n`;
            set.forEach(item => xml += `<${name.slice(0, -1)}>${this.escapeXML(item)}</${name.slice(0, -1)}>
`);
            xml += `</${name}>
`;
        };
        addList('Characters', characters);
        addList('Locations', locations);
        addList('Times', times);
        addList('Extensions', extensions);
        xml += `</SmartType>
`;
        xml += `</FinalDraft>`;
        
        const blob = new Blob([xml], {type: 'text/xml'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.fdx`;
        a.click();
    }

    async downloadFountain() {
        try {
            await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
            const data = this.sfss.exportToJSONStructure();
            if (!this.sfss.fountainParser) {
                console.error("FountainParser not initialized");
                alert("Internal Error: Fountain Parser not loaded.");
                return;
            }
            const fountainText = this.sfss.fountainParser.generate(data);
            const blob = new Blob([fountainText], {type: 'text/plain;charset=utf-8'});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${this.sfss.meta.title || 'script'}.fountain`;
            a.click();
        } catch (e) {
            console.error("Download Fountain Error:", e);
            alert("Failed to generate Fountain file.");
        }
    }

    async downloadText() {
        await this.sfss.storageManager.updateBackupTimestamp(this.sfss.activeScriptId);
        const data = this.sfss.exportToJSONStructure();
        const textData = this.sfss.fountainParser.generate(data);
        const blob = new Blob([textData], {type: 'text/plain;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.sfss.meta.title || 'script'}.txt`;
        a.click();
    }

    printScript() {
        if (!this.sfss.pageViewActive) this.sfss.togglePageView();
        const style = document.createElement('style');
        style.id = 'print-style';
        let headerContent = (this.sfss.meta.title || 'Untitled Screenplay').replace(/"/g, "'");
        if (this.sfss.meta.showDate) {
            headerContent += ` / ${new Date().toLocaleDateString()}`;
        }
        style.innerHTML = `@media print { 
                                @page { 
                                    size: letter;
                                    margin-top: 1.0in;
                                    margin-bottom: 1.0in;
                                    margin-left: 1.5in;
                                    margin-right: 1.0in;
                                    @top-right { 
                                        content: "${headerContent}"; 
                                        font-size: 12pt; 
                                        font-family: 'Courier Prime', monospace; 
                                        color: #333;
                                    } 
                                    @bottom-center { 
                                        content: counter(page); 
                                        font-size: 12pt; 
                                        font-family: 'Courier Prime', monospace; color: #333; 
                                    } 
                                } 
                                @page :first { 
                                    @top-right { content: normal; } 
                                    @bottom-center { content: normal; } 
                                } 
                            }`;
        document.head.appendChild(style);
        window.print();
        const printStyle = document.getElementById('print-style');
        if (printStyle) printStyle.remove();
    }

    escapeXML(unsafe) {
        return unsafe.replace(/[<>&'"']/g, c => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }
}

```

5.18 `assets/js-mod/PrintManager.js`
- Drives print modal settings, render pipeline, and downloads.

```js
import * as constants from './Constants.js';
import { PageRenderer } from './PageRenderer.js';

export class PrintManager {
    constructor(app) {
        this.app = app;
        this.modal = document.getElementById('print-prep-modal');
        this.previewContainer = document.getElementById('print-preview-container');
        this.previewScroller = document.getElementById('print-preview-scroller');
        this.controls = document.getElementById('print-controls');
        this.statsEl = document.getElementById('print-stats');
        
        this.mode = 'script'; // 'script' | 'treatment'
        
        this.config = {
            script: {
                showTitlePage: true,
                layout: 'normal',
                showSceneNumbers: false,
                showPageNumbers: true,
                showDate: false,
                watermark: ''
            },
            treatment: {
                layout: 'normal', 
                orientation: 'portrait',
                showMeta: true,
                showImages: true,
                showScript: true,
                showStats: true,
                showMusic: true,
                showCharacters: true
            }
        };

        this.renderTimeout = null;
        this.tempImageUrls = [];
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('print-prep-close-btn')?.addEventListener('click', () => this.close());
        document.getElementById('print-prep-cancel-btn')?.addEventListener('click', () => this.close());
        document.getElementById('print-prep-print-btn')?.addEventListener('click', () => this.print());

        const modeBtns = this.controls.querySelectorAll('.toggle-btn[data-mode]');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setMode(e.target.dataset.mode);
                modeBtns.forEach(b => b.classList.toggle('active', b === e.target));
            });
        });

        this.controls.addEventListener('change', (e) => {
            if (e.target.matches('.print-config-input') || e.target.matches('.print-config-select')) {
                this.updateConfigFromUI();
                this.scheduleRender();
            }
        });

        this.controls.addEventListener('input', (e) => {
            if (e.target.matches('.print-config-input[type="text"]')) {
                this.updateConfigFromUI();
                this.scheduleRender(500); 
            }
        });

        window.addEventListener('resize', () => {
            if (!this.modal.classList.contains('hidden')) {
                this.updatePreviewScale();
            }
        });

        document.getElementById('print-edit-meta-btn')?.addEventListener('click', () => {
             this.app.sidebarManager.openScriptMetaPopup();
             const popup = document.getElementById('script-meta-popup');
             const checkClosed = setInterval(() => {
                 if (popup.classList.contains('hidden')) {
                     clearInterval(checkClosed);
                     this.renderPreview();
                 }
             }, 200);
        });
    }

    updateConfigFromUI() {
        const inputs = this.controls.querySelectorAll('.print-config-input, .print-config-select');
        inputs.forEach(input => {
            const section = input.dataset.section;
            const key = input.dataset.key;
            const value = input.type === 'checkbox' ? input.checked : input.value;
            if (this.config[section]) {
                this.config[section][key] = value;
            }
        });
    }

    open() {
        this.config.script.showSceneNumbers = this.app.meta.showSceneNumbers || false;
        this.config.script.showDate = this.app.meta.showDate || false;
        this.syncUI();
        this.modal.classList.remove('hidden');
        this.setMode(this.mode); 
        this.scheduleRender(50);
    }

    close() {
        this.modal.classList.add('hidden');
    }

    setMode(mode) {
        this.mode = mode;
        if (this.previewContainer) {
            this.previewContainer.dataset.mode = mode;
            this.previewContainer.classList.add('mode-switching');
            setTimeout(() => this.previewContainer.classList.remove('mode-switching'), 260);
        }
        document.getElementById('print-config-script').classList.toggle('hidden', mode !== 'script');
        document.getElementById('print-config-treatment').classList.toggle('hidden', mode !== 'treatment');
        this.scheduleRender(0);
    }

    syncUI() {
        for (const section of ['script', 'treatment']) {
            for (const [key, value] of Object.entries(this.config[section])) {
                const input = this.controls.querySelector(`.print-config-input[data-section="${section}"][data-key="${key}"]`);
                if (input) {
                    if (input.type === 'checkbox') input.checked = value;
                    else input.value = value;
                }
                const select = this.controls.querySelector(`.print-config-select[data-section="${section}"][data-key="${key}"]`);
                if (select) {
                    select.value = value;
                }
            }
        }
    }

    scheduleRender(delay = 100) {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.renderPreview(), delay);
    }

    getHeaderText() {
        if (!this.config.script.showDate) return '';
        let text = (this.app.meta.title || 'Untitled Screenplay').replace(/"/g, "'");
        text += ` / ${new Date().toLocaleDateString()}`;
        return text;
    }

    async renderPreview() {
        const scroller = this.previewScroller;
        const prevScrollHeight = scroller ? Math.max(scroller.scrollHeight, 1) : 1;
        const prevScrollTop = scroller ? scroller.scrollTop : 0;
        const prevScrollRatio = prevScrollTop / prevScrollHeight;

        this.tempImageUrls.forEach(url => URL.revokeObjectURL(url));
        this.tempImageUrls = [];

        this.previewContainer.innerHTML = '';
        this.previewContainer.style.opacity = '0.5';
        this.previewContainer.dataset.mode = this.mode;

        // 1. Generate Logical Pages
        let logicalPages = [];
        if (this.mode === 'script') {
            logicalPages = await this.generateScreenplayPages();
        } else {
            logicalPages = await this.generateTreatmentPages();
        }

        // 2. Layout adjustments per mode
        if (this.mode === 'treatment' && this.config.treatment.layout === 'facing') {
            const pagesNeedingMargins = logicalPages.filter(p => !p.classList.contains('treatment-overview'));
            pagesNeedingMargins.forEach((p, idx) => {
                p.classList.add((idx + 1) % 2 === 0 ? 'facing-even' : 'facing-odd');
            });
        }

        // 3. Wrap for Preview
        let finalSheets = [];
        const isBooklet = this.config[this.mode].layout === 'booklet';
        
        if (isBooklet) {
            finalSheets = this.applyBookletImposition(logicalPages);
        } else {
            finalSheets = logicalPages.map(page => {
                const sheet = document.createElement('div');
                sheet.className = 'print-sheet'; 
                if (page.style.width && page.style.height) {
                    sheet.style.width = page.style.width;
                    sheet.style.height = page.style.height;
                } else if (page.classList.contains('landscape')) {
                    sheet.style.width = '11in';
                    sheet.style.height = '8.5in';
                }
                sheet.appendChild(page);
                return sheet;
            });
        }

        finalSheets.forEach(sheet => this.previewContainer.appendChild(sheet));
        
        const count = logicalPages.length;
        const sheets = finalSheets.length;
        this.statsEl.textContent = `${count} Pages • ${sheets} Sheet${sheets !== 1 ? 's' : ''}`;

        this.previewContainer.style.opacity = '1';
        this.updatePreviewScale();

        if (scroller) {
            requestAnimationFrame(() => {
                const newHeight = Math.max(scroller.scrollHeight, 1);
                const target = Math.min(prevScrollRatio * newHeight, Math.max(0, newHeight - scroller.clientHeight));
                scroller.scrollTop = Number.isFinite(target) ? target : 0;
            });
        }
    }

    updatePreviewScale() {
        const paneWidth = this.previewScroller ? this.previewScroller.offsetWidth : this.previewContainer.parentElement.offsetWidth;
        const availableWidth = paneWidth - 60;
        const sheet = this.previewContainer.querySelector('.print-sheet') || this.previewContainer.querySelector('.treatment-print-page');
        if (!sheet) return;

        const sheetWidth = sheet.offsetWidth; 
        const scale = Math.min(1, availableWidth / sheetWidth);
        this.previewContainer.style.transform = `scale(${scale})`;
    }

    // --- SCREENPLAY GENERATION (Restored Robust Logic) ---
    async generateScreenplayPages() {
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '8.5in'; 
        document.getElementById('app-container').appendChild(tempContainer);
        
        let nodes = [];
        if (this.app.treatmentModeActive) {
            const data = this.app.scriptData;
            if (data && data.blocks) {
                nodes = data.blocks.map(b => {
                    const el = this.app.editorHandler.createBlock(b.type, b.text);
                    el.dataset.lineId = b.id;
                    return el;
                });
            }
        } else {
            nodes = Array.from(this.app.editor.querySelectorAll('.script-line')).map(n => n.cloneNode(true));
        }

        const options = {
            showSceneNumbers: this.config.script.showSceneNumbers,
            showPageNumbers: this.config.script.showPageNumbers,
            showDate: this.config.script.showDate,
            headerText: this.getHeaderText(), 
            sceneNumberMap: this.getSceneNumberMap(),
            hideFirstPageMeta: true
        };

        this.app.pageRenderer.render(nodes, tempContainer, options);
        let pages = Array.from(tempContainer.querySelectorAll('.page'));
        
        const isFacing = this.config.script.layout === 'facing';
        if (this.config.script.watermark) {
            pages.forEach(page => this.addWatermark(page, this.config.script.watermark));
        }

        if (this.config.script.showTitlePage) {
            const tp = this.createTitlePage();
            if (this.config.script.watermark) this.addWatermark(tp, this.config.script.watermark);
            pages.unshift(tp);
            if (isFacing) {
                const spacer = this.createBlankPage();
                pages.splice(1, 0, spacer);
            }
        }

        const finalPages = pages.map((p, idx) => {
            const clone = p.cloneNode(true);
            if (isFacing) {
                clone.classList.add('facing-page');
                clone.classList.add((idx + 1) % 2 === 0 ? 'facing-even' : 'facing-odd');
            }
            return clone;
        });
        document.getElementById('app-container').removeChild(tempContainer);
        return finalPages;
    }

    createTitlePage() {
        const page = document.createElement('div');
        page.className = 'page';
        page.innerHTML = `
            <div style="text-align: center; margin-top: 3in; color: black;">
                <div style="font-family: 'Courier Prime'; font-weight: bold; font-size: 24pt; text-decoration: underline; margin-bottom: 2in; text-transform: uppercase;">
                    ${this.app.meta.title || 'UNTITLED'}
                </div>
                <div style="font-family: 'Courier Prime'; font-size: 12pt; margin-bottom: 0.5in;">written by</div>
                <div style="font-family: 'Courier Prime'; font-size: 14pt; margin-bottom: 2in;">${this.app.meta.author || ''}</div>
            </div>
            <div style="position: absolute; bottom: 1in; left: 1.5in; font-family: 'Courier Prime'; font-size: 12pt; text-align: left; line-height: 1.2; color: black;">
                ${(this.app.meta.contact || '').replace(/\n/g, '<br>')}
            </div>
        `;
        return page;
    }

    createBlankPage() {
        const page = document.createElement('div');
        page.className = 'page page--blank';
        const cw = document.createElement('div');
        cw.className = 'content-wrapper';
        page.appendChild(cw);
        return page;
    }

    getSceneNumberMap() {
        const map = {};
        Object.keys(this.app.sceneMeta).forEach(id => {
            if (this.app.sceneMeta[id].number) map[id] = this.app.sceneMeta[id].number;
        });
        return map;
    }

    addWatermark(page, text) {
        const wm = document.createElement('div');
        wm.className = 'print-watermark';
        wm.textContent = text;
        page.appendChild(wm);
    }

    // --- TREATMENT GENERATION (Rebuilt) ---
    async generateTreatmentPages() {
        const data = this.app.scriptData || this.app.exportToJSONStructure();
        if (!data.blocks) return [];

        const includeScript = !!this.config.treatment.showScript;
        const scriptPages = await this.generateScreenplayPages();
        const scenePageMap = this.mapScenesToPages(data.blocks, scriptPages);
        const scenes = this.buildTreatmentScenes(data.blocks, scenePageMap, includeScript);

        const isLandscape = this.config.treatment.orientation === 'landscape';
        const profile = this.getTreatmentProfile(this.config.treatment.layout, isLandscape);
        const pages = [];

        // Merged Overview Page
        pages.push(this.createOverviewPage(scenes, profile, scriptPages.length));

        for (const scene of scenes) {
            const galleryImgs = await this.loadSceneImages(scene.meta, 6);
            const sceneScriptPages = scenePageMap.get(scene.id) || [];
            const scenePages = this.buildPaginatedTreatmentPages(scene, galleryImgs, sceneScriptPages, profile);
            pages.push(...scenePages);
        }

        return pages;
    }

    createOverviewPage(scenes, profile, totalScriptPages = 0) {
        const page = document.createElement('div');
        page.className = 'treatment-print-page treatment-overview';
        if (profile?.isBooklet) page.classList.add('booklet-treatment');
        if (profile?.isLandscape) page.classList.add('landscape');
        if (profile) {
            page.style.width = `${profile.pageWidthIn}in`;
            page.style.height = `${profile.pageHeightIn}in`;
            page.style.padding = `${profile.paddingIn}in`;
        }

        const title = (this.app.meta.title || 'Untitled Screenplay').toUpperCase();
        const author = this.app.meta.author || '';
        
        // Header
        const header = document.createElement('div');
        header.style.textAlign = 'center';
        header.style.marginBottom = '0.4in';
        header.innerHTML = `
            <div style="font-size: 1.4rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.1in;">${title}</div>
            <div style="font-size: 1rem; color: #555;">${author ? `by ${author}` : ''}</div>
            <div style="font-size: 0.8rem; color: #888; margin-top: 0.1in;">${new Date().toLocaleDateString()}</div>
        `;
        page.appendChild(header);

        // Stats Row
        const summary = document.createElement('div');
        summary.className = 'scene-chip-row';
        summary.style.justifyContent = 'center';
        summary.style.marginBottom = '0.4in';
        const totalEighths = scenes.reduce((sum, s) => sum + (s.eighths || 0), 0);
        const totalMinutes = Math.max(1, Math.round(totalEighths / 8));
        
        summary.appendChild(this.createMetaChip('Scenes', scenes.length));
        if (Number.isFinite(totalScriptPages)) summary.appendChild(this.createMetaChip('Script Pages', totalScriptPages));
        summary.appendChild(this.createMetaChip('Est. Runtime', `${totalMinutes} min`));
        page.appendChild(summary);

        // Index Grid
        const grid = document.createElement('div');
        grid.className = 'index-grid';
        const cols = profile?.isLandscape ? 3 : 2;
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
        grid.style.gap = '0.2in 0.4in';
        grid.style.fontSize = '0.8rem';

        scenes.forEach(scene => {
            const row = document.createElement('div');
            row.style.borderBottom = '1px dashed #eee';
            row.style.paddingBottom = '4px';
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.innerHTML = `
                <div style="display:flex; gap:8px; overflow:hidden;">
                    <span style="font-weight:bold; min-width:20px;">${scene.number}.</span>
                    <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${(scene.slugText || 'Untitled').toUpperCase()}</span>
                </div>
                <div style="color:#888; white-space:nowrap; margin-left:8px;">${scene.durationLabel || '-'}</div>
            `;
            grid.appendChild(row);
        });

        page.appendChild(grid);
        return page;
    }

    buildTreatmentScenes(blocks, scenePageMap, includeScript = false) {
        const scenes = [];
        let current = null;

        const flush = () => {
            if (!current) return;
            const meta = this.app.sceneMeta[current.slug.id] || {};
            const slugParts = this.parseSlugParts(current.slug.text);
            const pageRange = this.getScenePageRange(current.slug.id, scenePageMap);
            const eighths = meta.cachedEighths ?? this.estimateSceneEighths(current.blocks);
            const characters = this.getSceneCharactersFromBlocks(current.blocks);
            const excerpt = includeScript ? this.buildScriptExcerpt(current.blocks) : '';

            scenes.push({
                id: current.slug.id,
                number: meta.number || scenes.length + 1,
                slugText: (current.slug.text || '').trim() || 'UNTITLED SCENE',
                slugParts,
                meta,
                pageRange,
                eighths,
                durationLabel: this.formatDurationFromEighths(eighths),
                characters,
                description: meta.description || '',
                notes: meta.notes || '',
                excerpt,
                blocks: current.blocks
            });
        };

        blocks.forEach(block => {
            if (block.type === constants.ELEMENT_TYPES.SLUG) {
                flush();
                current = { slug: block, blocks: [] };
            } else if (current) {
                current.blocks.push(block);
            }
        });
        flush();

        return scenes;
    }

    getTreatmentProfile(layout, isLandscape) {
        const inch = 96;
        const makePx = (inches) => Math.round(inches * inch);

        const pageWidthIn = layout === 'booklet' ? 5.5 : (isLandscape ? 11 : 8.5);
        const pageHeightIn = layout === 'booklet' ? 8.5 : (isLandscape ? 8.5 : 11);
        const paddingIn = layout === 'booklet' ? 0.55 : 0.75;
        const gapIn = 0.35;
        const columns = layout === 'booklet' ? 1 : 2;
        const columnWidthIn = (pageWidthIn - paddingIn * 2 - gapIn * (columns - 1)) / columns;

        const isFacing = layout === 'facing';
        const isBooklet = layout === 'booklet';
        const headerFootprintIn = isBooklet ? 1.4 : 1.6; 
        const columnBudgetIn = Math.max(2.0, pageHeightIn - paddingIn * 2 - headerFootprintIn);

        return {
            layout,
            isFacing,
            isBooklet,
            isLandscape,
            pageWidthIn,
            pageHeightIn,
            paddingIn,
            gapPx: makePx(gapIn),
            columnWidthPx: makePx(columnWidthIn),
            maxPages: isFacing ? 2 : 1,
            textHeights: {
                synopsis: makePx(isFacing ? 3.4 : (isBooklet ? 2.4 : 3.0)),
                notes: makePx(isFacing ? 2.4 : (isBooklet ? 1.4 : 1.8)),
                script: makePx(isFacing ? 2.2 : (isBooklet ? 1.8 : 2.4))
            },
            thumb: {
                columns: isLandscape ? 3 : 2,
                maxHeightPx: makePx(isFacing ? 2.6 : (isBooklet ? 1.8 : 2.4))
            },
            images: {
                columns: isLandscape ? 3 : 2,
                maxHeightPx: makePx(isFacing ? 3.5 : (isBooklet ? 1.6 : 2.6))
            },
            notePadLines: isFacing ? 10 : 6,
            columns,
            columnBudgetPx: makePx(columnBudgetIn)
        };
    }

    buildPaginatedTreatmentPages(scene, galleryImgs, scriptPages, profile) {
        // --- LAYOUT ENGINE v2.0 ---
        // Generates logical "Spreads" (Left Col + Right Col content) and maps them to physical pages.
        
        const spreads = this.layoutSceneContent(scene, galleryImgs, scriptPages, profile);
        const pages = [];

        spreads.forEach((spread, index) => {
            const isFirst = index === 0;
            const isContinued = index > 0;
            
            // Create Shell
            // For Facing: Left Page = Text, Right Page = Visuals
            // For Standard: Single Page with 2 Cols
            
            if (profile.isFacing) {
                // LEFT PAGE (Text)
                const leftPageObj = this.createTreatmentPageShell(scene, profile, index + 1, isContinued);
                leftPageObj.page.classList.add('facing-page', 'facing-even'); // Even/Left
                
                // If it's a continuation, we might want to simplify the header or add "CONT'D"
                // The shell creator handles hero/meta chips.
                
                const leftBody = document.createElement('div');
                leftBody.className = 'treatment-body-grid single-column'; // Full width on the page
                
                const colContainer = document.createElement('div');
                colContainer.className = 'treatment-column primary';
                spread.left.forEach(el => colContainer.appendChild(el));
                
                leftBody.appendChild(colContainer);
                leftPageObj.page.appendChild(leftBody);
                pages.push(leftPageObj.page);

                // RIGHT PAGE (Visuals)
                const rightPageObj = this.createTreatmentPageShell(scene, profile, index + 1, true); // Always "Continued" context for visuals? Or match index?
                // Actually, visuals correspond to the same part of the scene.
                // Let's hide the Scene Header on the visual page if it's just a companion?
                // The user request "perfectly fits" implies standard layout consistency.
                // We'll keep the header for context but maybe minimize it in future.
                rightPageObj.page.classList.add('facing-page', 'facing-odd'); // Odd/Right
                
                const rightBody = document.createElement('div');
                rightBody.className = 'treatment-body-grid single-column';
                
                const rightContainer = document.createElement('div');
                rightContainer.className = 'treatment-column secondary';
                spread.right.forEach(el => rightContainer.appendChild(el));
                
                rightBody.appendChild(rightContainer);
                rightPageObj.page.appendChild(rightBody);
                pages.push(rightPageObj.page);

            } else {
                // STANDARD / LANDSCAPE (Single Page, 2 Cols)
                const pageObj = this.createTreatmentPageShell(scene, profile, index + 1, isContinued);
                
                const grid = document.createElement('div');
                grid.className = 'treatment-body-grid';
                if (profile.isBooklet) grid.classList.add('single-column');
                
                const leftCol = document.createElement('div');
                leftCol.className = 'treatment-column primary';
                spread.left.forEach(el => leftCol.appendChild(el));

                const rightCol = document.createElement('div');
                rightCol.className = 'treatment-column secondary';
                spread.right.forEach(el => rightCol.appendChild(el));

                grid.appendChild(leftCol);
                
                // Booklet Mode: Stack Right after Left in single column
                if (profile.isBooklet) {
                    // In booklet, secondary content just flows after primary
                    spread.right.forEach(el => leftCol.appendChild(el));
                    // rightCol is unused
                } else {
                    grid.appendChild(rightCol);
                }

                pageObj.page.appendChild(grid);
                pages.push(pageObj.page);
            }
        });

        return pages;
    }

    layoutSceneContent(scene, galleryImgs, scriptPages, profile) {
        // Engine: Distributes content into "Spreads" (Left/Right buckets per page)
        const spreads = [];
        
        // 1. Prepare Content Queues
        const textQueue = [];
        if (this.config.treatment.showMeta) {
            if (scene.description) textQueue.push({ type: 'text', label: 'Synopsis', text: scene.description });
            if (scene.notes) textQueue.push({ type: 'text', label: 'Notes', text: scene.notes });
        }
        // Always add stats to the first available text slot, or specific logic? 
        // Let's treat Stats as a block.
        const statsBlock = this.buildStatsSection(scene);
        let statsPlaced = !statsBlock; // If no block, it's "placed" (done)
        
        const visualQueue = [];
        if (this.config.treatment.showScript && scriptPages.length > 0) {
            visualQueue.push({ type: 'thumbs', items: scriptPages });
        }
        if (this.config.treatment.showImages && galleryImgs.length > 0) {
            visualQueue.push({ type: 'images', items: galleryImgs });
        }

        // 2. Calculation Constants
        // Use a slightly safer budget to avoid bottom-edge clipping
        const budget = profile.columnBudgetPx - 20; 
        const lineHeight = 22;
        const charsPerLine = Math.floor(profile.columnWidthPx / 7.5);

        let spreadIndex = 0;
        
        while (textQueue.length > 0 || visualQueue.length > 0 || !statsPlaced) {
            const spread = { left: [], right: [] };
            
            // --- FILL LEFT (Text) ---
            let leftH = 0;
            
            // Process Text Queue
            while (textQueue.length > 0) {
                const item = textQueue[0];
                const headerH = 35; // approx for section title
                const availableH = budget - leftH - headerH;
                
                if (availableH < 50) break; // Too small, next page

                const { fit, remaining } = this.splitTextToHeight(item.text, availableH, lineHeight, charsPerLine);
                
                if (fit) {
                    const section = this.createSection(item.label + (item.isContinued ? ' (Cont.)' : ''), fit);
                    // Measure rendered height? Or trust estimation.
                    // Trust estimation to update leftH.
                    const lines = Math.ceil(fit.length / charsPerLine) + (fit.split('\n').length); 
                    // Rough calc:
                    const estimatedBlockH = headerH + (Math.ceil(fit.length/charsPerLine) * lineHeight) + 20; 
                    // Better: use the split logic's implicit height knowledge or just add 'availableH' if it took it all?
                    // Let's use a conservative increment.
                    leftH += estimatedBlockH;
                    spread.left.push(section);
                }

                if (remaining) {
                    item.text = remaining;
                    item.isContinued = true;
                    // Filled this page
                    leftH = budget; 
                    break; // Next spread
                } else {
                    textQueue.shift(); // Done with this item
                }
            }

            // Place Stats (If not yet placed)
            if (!statsPlaced) {
                const statsH = 120; // Approx height
                // Try Left Column
                if (leftH + statsH < budget) {
                    spread.left.push(statsBlock);
                    leftH += statsH;
                    statsPlaced = true;
                } else if (!profile.isFacing) {
                    // Try Right Column (Standard/Landscape only)
                    // We'll init rightH after this, but we know it's empty at start of spread logic.
                    // So we can put it first in Right.
                    spread.right.push(statsBlock);
                    statsPlaced = true;
                    // rightH will be incremented below
                }
                // If Facing and didn't fit Left, it stays unplaced for this spread.
                // Loop continues to next spread.
            }

            // --- FILL RIGHT (Visuals) ---
            let rightH = 0;
            // If we put stats in right, count it
            if (spread.right.includes(statsBlock)) rightH += 120;

            while (visualQueue.length > 0) {
                const item = visualQueue[0];
                const headerH = 35;
                const availableH = budget - rightH - headerH;
                
                if (availableH < 100) break; // Need min height for images

                let chunkResult;
                if (item.type === 'images' || item.type === 'thumbs') {
                    // Calc max rows
                    // Row height approx?
                    // buildImagePanel uses flexible height.
                    // Let's say row height is ~150px.
                    const rowHeight = item.type === 'images' ? 150 : 180; // Thumbs are taller
                    const maxRows = Math.floor(availableH / rowHeight);
                    const cols = item.type === 'images' ? profile.images.columns : profile.thumb.columns;
                    const maxItems = maxRows * cols;
                    
                    if (maxItems > 0) {
                        const chunk = item.items.slice(0, maxItems);
                        const remainder = item.items.slice(maxItems);
                        
                        if (chunk.length > 0) {
                            // Render this chunk
                            // Calculate exact height needed for this chunk to look good
                            const actualRows = Math.ceil(chunk.length / cols);
                            const neededH = actualRows * rowHeight;
                            
                            let panel;
                            if (item.type === 'images') {
                                panel = this.buildImagePanel(chunk, profile.columnWidthPx, neededH, cols);
                            } else {
                                panel = this.buildThumbPanel(chunk, profile.columnWidthPx, neededH, cols);
                            }

                            if (panel) {
                                if (item.isContinued) panel.querySelector('.section-title').textContent += ' (Cont.)';
                                spread.right.push(panel);
                                rightH += neededH + headerH;
                            }
                        }
                        
                        if (remainder.length > 0) {
                            item.items = remainder;
                            item.isContinued = true;
                            break; // Column full
                        } else {
                            visualQueue.shift();
                        }
                    } else {
                        break; // No space for even 1 row
                    }
                }
            }

            spreads.push(spread);
            spreadIndex++;
            
            // Safety break to prevent infinite loops if budget calc is wrong
            if (spreadIndex > 20) {
                console.warn("Layout Engine Safety Break: Scene exceeded 20 pages.");
                break;
            }
        }
        
        // If empty result (shouldn't happen due to queues), ensure at least 1 page
        if (spreads.length === 0) spreads.push({ left: [], right: [] });

        return spreads;
    }

    splitTextToHeight(text, maxHeightPx, lineHeight = 22, charsPerLine = 45) {
        if (!text) return { fit: '', remaining: null };
        if (maxHeightPx < lineHeight) return { fit: '', remaining: text };

        const maxLines = Math.floor(maxHeightPx / lineHeight);
        const words = text.split(/\s+/); // Preserves newlines? No.
        // Better split handling for paragraphs:
        // Simple approach: Split by words.
        
        let currentLines = 1;
        let currentLineLen = 0;
        let splitIndex = words.length;

        for (let i = 0; i < words.length; i++) {
            const wLen = words[i].length + 1;
            
            // Newline detection could be added here if we split by paragraph logic
            // For now, assume flow text.
            
            if (currentLineLen + wLen > charsPerLine) {
                currentLines++;
                currentLineLen = wLen;
            } else {
                currentLineLen += wLen;
            }

            if (currentLines > maxLines) {
                splitIndex = i;
                break;
            }
        }

        if (splitIndex >= words.length) return { fit: text, remaining: null };
        
        const fit = words.slice(0, splitIndex).join(' ');
        const remaining = words.slice(splitIndex).join(' ');
        return { fit, remaining };
    }

    createTreatmentPageShell(scene, profile, partNumber = 1, isContinued = false) {
        const page = document.createElement('div');
        page.className = 'treatment-print-page';
        if (profile.isLandscape) page.classList.add('landscape');
        if (profile.isBooklet) page.classList.add('booklet-treatment');
        page.style.width = `${profile.pageWidthIn}in`;
        page.style.height = `${profile.pageHeightIn}in`;
        page.style.padding = `${profile.paddingIn}in`;

        const header = document.createElement('div');
        header.className = 'treatment-doc-header';
        header.innerHTML = `
            <div class="doc-title-block">
                <div class="doc-label">Treatment</div>
                <div class="doc-title">${(this.app.meta.title || 'Untitled Screenplay').toUpperCase()}</div>
            </div>
            <div class="doc-submeta">
                ${this.app.meta.author ? `<div>${this.app.meta.author}</div>` : ''}
                <div>${new Date().toLocaleDateString()}</div>
            </div>
        `;
        page.appendChild(header);

        const hero = document.createElement('div');
        hero.className = 'treatment-scene-hero';
        
        const heroLeft = document.createElement('div');
        heroLeft.className = 'scene-hero-left';
        const pill = document.createElement('div');
        pill.className = 'scene-number-pill';
        pill.textContent = scene.number;
        const titles = document.createElement('div');
        titles.className = 'scene-hero-titles';
        const slug = document.createElement('div');
        slug.className = 'scene-title';
        slug.textContent = scene.slugText.toUpperCase();
        const subline = document.createElement('div');
        subline.className = 'scene-subline';
        const locationLine = [scene.slugParts.prefix, scene.slugParts.location, scene.slugParts.time].filter(Boolean).join(' · ');
        subline.textContent = locationLine;
        titles.appendChild(slug);
        titles.appendChild(subline);
        heroLeft.appendChild(pill);
        heroLeft.appendChild(titles);

        const heroMeta = document.createElement('div');
        heroMeta.className = 'scene-hero-meta';
        if (this.config.treatment.showStats && scene.pageRange) {
            heroMeta.appendChild(this.createMetaChip('Pages', scene.pageRange));
        }
        if (this.config.treatment.showStats && scene.durationLabel) {
            heroMeta.appendChild(this.createMetaChip('Timing', scene.durationLabel));
        }
        if (partNumber > 1 || isContinued) {
            heroMeta.appendChild(this.createMetaChip('Part', partNumber > 1 ? `Cont. ${partNumber}` : 'Cont.'));
        }

        hero.appendChild(heroLeft);
        hero.appendChild(heroMeta);
        page.appendChild(hero);

        const chipRow = document.createElement('div');
        chipRow.className = 'scene-chip-row';
        if (partNumber === 1) {
            if (this.config.treatment.showCharacters && scene.characters.length) {
                chipRow.appendChild(this.createMetaChip('Characters', scene.characters.join(', ')));
            }
            if (this.config.treatment.showMusic && (scene.meta.track || scene.meta.trackTitle || scene.meta.trackArtist)) {
                const music = [scene.meta.trackTitle, scene.meta.trackArtist].filter(Boolean).join(' — ') || 'Track Attached';
                chipRow.appendChild(this.createMetaChip('Music', music));
            }
        }
        if (chipRow.childElementCount > 0) {
            page.appendChild(chipRow);
        }

        return { page };
    }

    createSection(label, content, isMono = false) {
        const wrap = document.createElement('div');
        wrap.className = 'scene-section';
        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = label;
        const body = document.createElement('div');
        body.className = 'section-body';
        if (isMono) body.classList.add('mono');
        if (typeof content === 'string') {
            body.textContent = content;
        } else {
            body.appendChild(content);
        }
        wrap.appendChild(title);
        wrap.appendChild(body);
        return wrap;
    }

    createPlaceholder(text) {
        const p = document.createElement('div');
        p.className = 'treatment-placeholder';
        p.textContent = text;
        return p;
    }

    applyBookletImposition(logicalPages) {
        const pages = logicalPages.map(p => p.cloneNode(true));
        const isTreatment = pages[0]?.classList.contains('treatment-print-page');
        const makeBlank = () => {
            if (!isTreatment) return this.createBlankPage();
            const blank = document.createElement('div');
            blank.className = pages[0].className;
            blank.style.width = pages[0].style.width;
            blank.style.height = pages[0].style.height;
            blank.style.padding = pages[0].style.padding;
            return blank;
        };
        while (pages.length % 4 !== 0) {
            pages.push(makeBlank());
        }

        const sheets = [];
        let start = 0;
        let end = pages.length - 1;

        while (start < end) {
            const front = document.createElement('div');
            front.className = 'print-sheet booklet-spread booklet-front';
            front.appendChild(this.createBookletSlot(pages[end]));
            front.appendChild(this.createBookletSlot(pages[start]));
            sheets.push(front);
            start++; end--;

            if (start > end) break;

            const back = document.createElement('div');
            back.className = 'print-sheet booklet-spread booklet-back';
            back.appendChild(this.createBookletSlot(pages[start]));
            back.appendChild(this.createBookletSlot(pages[end]));
            sheets.push(back);
            start++; end--;
        }
        return sheets;
    }

    createBookletSlot(page) {
        const slot = document.createElement('div');
        slot.className = 'booklet-page-slot';
        const wrapper = document.createElement('div');
        wrapper.className = 'booklet-scaler';
        
        const clone = page.cloneNode(true);
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';

        const pageWidthIn = parseFloat(clone.style.width) || 8.5;
        const targetWidthIn = 5.5;
        const scale = Math.min(1, targetWidthIn / pageWidthIn);
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.width = `${pageWidthIn}in`;
        wrapper.style.height = clone.style.height || '';
        
        wrapper.appendChild(clone);
        slot.appendChild(wrapper);
        return slot;
    }

    async print() {
        const isBooklet = this.config[this.mode].layout === 'booklet';
        const isLandscape = this.mode === 'treatment' && this.config.treatment.orientation === 'landscape';
        const isTreatment = this.mode === 'treatment';
        
        let sizeRule = 'letter portrait';
        if (isBooklet || isLandscape) sizeRule = 'letter landscape';

        const css = `
            @page { size: ${sizeRule}; margin: 0; }
        `;
            
        const style = document.createElement('style');
        style.id = 'dynamic-print-css';
        style.innerHTML = css;
        document.head.appendChild(style);

        const printTarget = document.getElementById('printingdiv');
        printTarget.innerHTML = '';
        printTarget.className = '';
        
        if (!isTreatment && this.config.script.showSceneNumbers) printTarget.classList.add('show-scene-numbers');
        if (isTreatment) printTarget.classList.add('treatment-print');
        
        // --- UNWRAP FOR PRINT ---
        if (isTreatment) {
            const logicalPages = await this.generateTreatmentPages();
            if (this.config.treatment.layout === 'facing') {
                const pagesNeedingMargins = logicalPages.filter(p => !p.classList.contains('treatment-overview'));
                pagesNeedingMargins.forEach((p, idx) => p.classList.add((idx + 1) % 2 === 0 ? 'facing-even' : 'facing-odd'));
            }
            const sheets = this.config.treatment.layout === 'booklet'
                ? this.applyBookletImposition(logicalPages)
                : logicalPages.map(pg => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'print-sheet';
                    if (pg.style.width && pg.style.height) {
                        wrapper.style.width = pg.style.width;
                        wrapper.style.height = pg.style.height;
                    }
                    wrapper.appendChild(pg.cloneNode(true));
                    return wrapper;
                });
            sheets.forEach(sheet => printTarget.appendChild(sheet.cloneNode(true)));
        } else {
            const sheets = Array.from(this.previewContainer.children);
            if (isBooklet) {
                sheets.forEach(sheet => printTarget.appendChild(sheet.cloneNode(true)));
            } else {
                sheets.forEach(sheet => {
                    const pg = sheet.querySelector('.page');
                    if (pg) printTarget.appendChild(pg.cloneNode(true));
                });
            }
        }

        document.body.classList.add('printing-from-modal');

        // Allow DOM to settle before printing to prevent infinite load
        requestAnimationFrame(() => {
            setTimeout(() => {
                window.print();
                
                // Safety cleanup in case afterprint doesn't fire
                setTimeout(() => {
                    document.body.classList.remove('printing-from-modal');
                }, 2000);
            }, 800); 
        });

        const cleanup = () => {
            document.body.classList.remove('printing-from-modal');
            const s = document.getElementById('dynamic-print-css');
            if(s) s.remove();
            printTarget.innerHTML = '';
            this.tempImageUrls.forEach(url => URL.revokeObjectURL(url));
            this.tempImageUrls = [];
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
    }

    // --- Helpers ---
    clampText(text = '', maxChars = 800) {
        if (!text) return '';
        if (text.length <= maxChars) return text;
        return text.slice(0, maxChars).trimEnd() + '…';
    }

    truncateTextToHeight(text = '', maxHeightPx, budgetPx, lineHeight = 22, charsPerLine = 45) {
        if (!text || budgetPx <= 0) return { text: '', estHeight: 0 };
        const maxH = Math.min(maxHeightPx, budgetPx);
        const words = text.split(/\s+/);
        let lines = 0;
        let currentLineLength = 0;
        let result = [];

        for (const word of words) {
            const len = word.length + 1;
            if (currentLineLength + len > charsPerLine) {
                lines += 1;
                currentLineLength = len;
            } else {
                currentLineLength += len;
            }
            result.push(word);
            const estHeight = (lines + 1) * lineHeight;
            if (estHeight > maxH) {
                result.pop();
                result.push('…');
                return { text: result.join(' '), estHeight: maxH };
            }
        }
        const estHeight = Math.min(maxH, Math.max(lineHeight, Math.ceil((lines + 1) * lineHeight)));
        return { text: result.join(' '), estHeight };
    }

    buildThumbPanel(pages = [], columnWidthPx, maxHeightPx, columns = 2) {
        if (!this.config.treatment.showScript || !pages.length) return null;
        const baseW = 8.5 * 96;
        const baseH = 11 * 96;
        const cols = Math.max(1, columns);
        const rows = Math.ceil(pages.length / cols);
        const scale = Math.min(
            columnWidthPx / baseW,
            maxHeightPx / (rows * baseH)
        );
        const cellW = baseW * scale;
        const cellH = baseH * scale;

        const grid = document.createElement('div');
        grid.className = 'thumb-grid';
        grid.style.gridTemplateColumns = `repeat(${cols}, ${cellW}px)`;
        grid.style.maxHeight = `${maxHeightPx}px`;

        pages.forEach(pg => {
            const wrap = document.createElement('div');
            wrap.className = 'thumb';
            wrap.style.width = `${cellW}px`;
            wrap.style.height = `${cellH}px`;
            const clone = pg.cloneNode(true);
            clone.querySelectorAll('.page-number').forEach(n => n.style.display = 'block');
            clone.querySelectorAll('.scene-hero-meta').forEach(n => n.style.display = 'block');
            clone.classList.add('thumb-page');
            clone.style.width = `${baseW}px`;
            clone.style.height = `${baseH}px`;
            clone.style.margin = '0';
            clone.style.boxShadow = 'none';
            clone.style.transformOrigin = 'top left';
            clone.style.transform = `scale(${scale})`;
            wrap.appendChild(clone);
            grid.appendChild(wrap);
        });

        const sec = this.createSection('Script Pages', grid, false);
        sec.classList.add('thumbs-panel');
        return sec;
    }

    buildImagePanel(imageUrls = [], columnWidthPx, maxHeightPx, columns = 2) {
        if (!this.config.treatment.showImages || !imageUrls || imageUrls.length === 0) return null;
        const cols = Math.max(1, columns);
        const rows = Math.ceil(imageUrls.length / cols);
        const rowHeight = Math.max(60, Math.floor(maxHeightPx / rows));

        const grid = document.createElement('div');
        grid.className = 'images-grid';
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        grid.style.maxHeight = `${maxHeightPx}px`;

        imageUrls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.height = `${rowHeight}px`;
            img.style.objectFit = 'cover';
            grid.appendChild(img);
        });

        return this.createSection('Visual References', grid, false);
    }

    buildStatsSection(scene) {
        const items = [];
        if (scene.pageRange) items.push(`Pages: ${scene.pageRange}`);
        if (scene.durationLabel) items.push(`Timing: ${scene.durationLabel}`);
        const estWords = Number.isFinite(scene.eighths) ? Math.max(40, Math.round((scene.eighths / 8) * 150)) : null;
        if (estWords) items.push(`Est. Words: ${estWords}`);
        if (scene.characters && scene.characters.length) {
            items.push(`Characters: ${scene.characters.join(', ')}`);
        }

        if (items.length === 0) return null;
        const list = document.createElement('ul');
        list.className = 'stats-list';
        items.forEach(it => {
            const li = document.createElement('li');
            li.textContent = it;
            list.appendChild(li);
        });
        const sec = this.createSection('Quick Stats', list, false);
        sec.classList.add('stats-section');
        return sec;
    }

    createNotePad(heightPx, lines = 6) {
        const pad = document.createElement('div');
        pad.className = 'notepad';
        pad.style.minHeight = `${heightPx}px`;
        pad.style.maxHeight = `${heightPx}px`;
        pad.style.backgroundSize = `100% ${Math.floor(heightPx / Math.max(3, lines))}px`;
        const wrap = this.createSection('Notes (handwrite)', pad, false);
        return wrap;
    }

    mapScenesToPages(blocks, scriptPages) {
        const map = new Map();
        let activeSceneId = null;
        const firstSlug = blocks.find(b => b.type === constants.ELEMENT_TYPES.SLUG);
        if (firstSlug) activeSceneId = firstSlug.id;

        scriptPages.forEach(page => {
            const content = page.querySelector('.content-wrapper');
            if (!content) return;
            if (content.children.length === 0) return;

            const slugs = content.querySelectorAll('.sc-slug');
            const idsOnPage = new Set();
            
            if (content.children.length > 0 && !content.children[0].classList.contains('sc-slug') && activeSceneId) {
                idsOnPage.add(activeSceneId);
            }
            
            slugs.forEach(slug => {
                const id = slug.dataset.lineId;
                if (id) {
                    idsOnPage.add(id);
                    activeSceneId = id;
                }
            });
            
            idsOnPage.forEach(id => {
                if (!map.has(id)) map.set(id, []);
                map.get(id).push(page);
            });
        });
        return map;
    }

    getScenePageRange(sceneId, map) {
        const pages = map.get(sceneId);
        if (!pages || pages.length === 0) return '';
        const getPageNumber = (pg) => {
            const dataVal = pg.dataset.pageNumber;
            if (dataVal) return parseInt(dataVal, 10);
            const textVal = pg.querySelector('.page-number')?.textContent || '0';
            return parseInt(textVal, 10);
        };
        const start = getPageNumber(pages[0]);
        const end = getPageNumber(pages[pages.length - 1]);
        if (!start) return '';
        if (start === end) return `Pg ${start}`;
        return `Pgs ${start}-${end}`;
    }

    getSceneCharactersFromBlocks(blocks = []) {
        const chars = new Set();
        blocks.forEach(b => {
            if (b.type === constants.ELEMENT_TYPES.CHARACTER) {
                const cleaned = (b.text || '').replace(/\(.*\)/g, '').trim();
                if (cleaned) chars.add(cleaned);
            } else if (b.type === constants.ELEMENT_TYPES.ACTION && (b.text || '').trim().toUpperCase().startsWith('CHARACTERS:')) {
                // Handle Treatment Mode character lists
                const list = b.text.replace(/^Characters:\s*/i, '').split(',');
                list.forEach(c => {
                    const cleaned = c.trim().toUpperCase();
                    if (cleaned) chars.add(cleaned);
                });
            }
        });
        return Array.from(chars);
    }

    createMetaChip(label, value) {
        const chip = document.createElement('div');
        chip.className = 'meta-chip';
        const labelEl = document.createElement('span');
        labelEl.className = 'chip-label';
        labelEl.textContent = label;
        const valueEl = document.createElement('span');
        valueEl.className = 'chip-value';
        const displayValue = value === 0 ? '0' : (value || '-');
        valueEl.textContent = displayValue;
        chip.appendChild(labelEl);
        chip.appendChild(valueEl);
        return chip;
    }

    formatDurationFromEighths(eighths) {
        if (!eighths || isNaN(eighths)) return '';
        const seconds = Math.max(1, Math.round((eighths / 8) * 60));
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `~${minutes}m ${secs.toString().padStart(2, '0')}s`;
    }

    estimateSceneEighths(blocks = []) {
        let lines = 1; 
        blocks.forEach(block => {
            const text = (block.text || '').trim();
            let add = 1;
            if (block.type === constants.ELEMENT_TYPES.ACTION) add += Math.floor(text.length / 60);
            else if (block.type === constants.ELEMENT_TYPES.DIALOGUE) add += Math.floor(text.length / 35);
            lines += add;
        });
        return Math.ceil((lines * 8) / 55);
    }

    parseSlugParts(slugText = '') {
        const result = { prefix: '', location: '', time: '' };
        if (!slugText) return result;
        const parts = slugText.split(/\s*-\s*/);
        if (parts.length > 1) {
            result.time = parts.pop().trim().toUpperCase();
        }
        const locationText = parts.join(' - ').trim();
        const prefixMatch = locationText.match(/^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)/i);
        if (prefixMatch) {
            result.prefix = prefixMatch[0].replace(/\.$/, '').toUpperCase();
            result.location = locationText.replace(prefixMatch[0], '').replace(/^[\s.\-–—]+/, '').trim();
        } else {
            result.location = locationText;
        }
        result.location = (result.location || slugText).toUpperCase();
        if (!result.time) result.time = '';
        return result;
    }

    buildScriptExcerpt(blocks = [], maxLines = 14) {
        const lines = [];
        for (const block of blocks) {
            const text = (block.text || '').trim();
            if (!text) continue;
            switch (block.type) {
                case constants.ELEMENT_TYPES.CHARACTER:
                    lines.push(text.toUpperCase());
                    break;
                case constants.ELEMENT_TYPES.PARENTHETICAL:
                    lines.push(`(${text})`);
                    break;
                case constants.ELEMENT_TYPES.DIALOGUE:
                    lines.push(`    ${text}`);
                    break;
                case constants.ELEMENT_TYPES.TRANSITION:
                    lines.push(`${text.toUpperCase()} >>`);
                    break;
                default:
                    lines.push(text);
            }
            if (lines.length >= maxLines) break;
        }
        return lines.join('\n');
    }

    async loadSceneImages(meta, max = 6) {
        if (!this.config.treatment.showImages || !meta.images || meta.images.length === 0) return [];
        const urls = [];
        const count = Math.min(meta.images.length, max);
        for (let i = 0; i < count; i++) {
            const imgId = meta.images[i];
            const file = await this.app.sidebarManager.imageDB.get(imgId);
            if (file) {
                const url = URL.createObjectURL(file);
                this.tempImageUrls.push(url);
                urls.push(url);
            }
        }
        return urls;
    }
}
```

5.19 `assets/trystero.min.js`
- Third-party P2P transport helper used for collaboration rooms.

```js
const{floor:e,random:r}=Math,t="Trystero",n=(e,r)=>Array(e).fill().map(r),a="0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz",o=t=>n(t,(()=>a[e(62*r())])).join(""),s=o(20),i=Promise.all.bind(Promise),c="undefined"!=typeof window,{entries:l,fromEntries:d,keys:u}=Object,f=()=>{},y=e=>Error(`${t}: ${e}`),p=new TextEncoder,m=new TextDecoder,w=e=>p.encode(e),g=e=>m.decode(e),h=(...e)=>e.join("@"),b=JSON.stringify,k=JSON.parse,v={};let P=null,T=null;const A=()=>{P||(P=new Promise((e=>{T=e})).finally((()=>{T=null,P=null})))},S=()=>T?.(),L="AES-GCM",D={},I=async e=>D[e]||=Array.from(await(async(e,r)=>new Uint8Array(await crypto.subtle.digest(e,w(r))))("SHA-1",e)).map((e=>e.toString(36))).join(""),$=async(e,r)=>{const t=crypto.getRandomValues(new Uint8Array(16));return t.join(",")+"$"+(n=await crypto.subtle.encrypt({name:L,iv:t},await e,w(r)),btoa(String.fromCharCode.apply(null,new Uint8Array(n))));var n},E=async(e,r)=>{const[t,n]=r.split("$");return g(await crypto.subtle.decrypt({name:L,iv:new Uint8Array(t.split(","))},await e,(e=>{const r=atob(e);return new Uint8Array(r.length).map(((e,t)=>r.charCodeAt(t))).buffer})(n)))},C="icegatheringstatechange",U="offer";var _=(e,{rtcConfig:r,rtcPolyfill:t,turnConfig:n})=>{const a=new(t||RTCPeerConnection)({iceServers:O.concat(n||[]),...r}),o={};let s=!1,c=!1,l=null;const d=e=>{e.binaryType="arraybuffer",e.bufferedAmountLowThreshold=65535,e.onmessage=e=>o.data?.(e.data),e.onopen=()=>o.connect?.(),e.onclose=()=>o.close?.(),e.onerror=e=>o.error?.(e)},u=e=>Promise.race([new Promise((r=>{const t=()=>{"complete"===e.iceGatheringState&&(e.removeEventListener(C,t),r())};e.addEventListener(C,t),t()})),new Promise((e=>setTimeout(e,5e3)))]).then((()=>({type:e.localDescription.type,sdp:e.localDescription.sdp.replace(/a=ice-options:trickle\s\n/g,"")})));return e?(l=a.createDataChannel("data"),d(l)):a.ondatachannel=({channel:e})=>{l=e,d(e)},a.onnegotiationneeded=async()=>{try{s=!0,await a.setLocalDescription();const e=await u(a);o.signal?.(e)}catch(e){o.error?.(e)}finally{s=!1}},a.onconnectionstatechange=()=>{["disconnected","failed","closed"].includes(a.connectionState)&&o.close?.()},a.ontrack=e=>{o.track?.(e.track,e.streams[0]),o.stream?.(e.streams[0])},a.onremovestream=e=>o.stream?.(e.stream),e&&(a.canTrickleIceCandidates||a.onnegotiationneeded()),{created:Date.now(),connection:a,get channel(){return l},get isDead(){return"closed"===a.connectionState},async signal(r){if("open"!==l?.readyState||r.sdp?.includes("a=rtpmap"))try{if(r.type===U){if(s||"stable"!==a.signalingState&&!c){if(e)return;await i([a.setLocalDescription({type:"rollback"}),a.setRemoteDescription(r)])}else await a.setRemoteDescription(r);await a.setLocalDescription();const t=await u(a);return o.signal?.(t),t}if("answer"===r.type){c=!0;try{await a.setRemoteDescription(r)}finally{c=!1}}}catch(e){o.error?.(e)}},sendData(e){return l.send(e)},destroy(){l?.close(),a.close(),s=!1,c=!1},setHandlers(e){return Object.assign(o,e)},offerPromise:e?new Promise((e=>o.signal=r=>{r.type===U&&e(r)})):Promise.resolve(),addStream(e){return e.getTracks().forEach((r=>a.addTrack(r,e)))},removeStream(e){return a.getSenders().filter((r=>e.getTracks().includes(r.track))).forEach((e=>a.removeTrack(e)))},addTrack(e,r){return a.addTrack(e,r)},removeTrack(e){const r=a.getSenders().find((r=>r.track===e));r&&a.removeTrack(r)},replaceTrack(e,r){const t=a.getSenders().find((r=>r.track===e));if(t)return t.replaceTrack(r)}}};const O=[...n(3,((e,r)=>`stun:stun${r||""}.l.google.com:19302`)),"stun:stun.cloudflare.com:3478"].map((e=>({urls:e}))),j=Object.getPrototypeOf(Uint8Array),H=16369,R=255,J="bufferedamountlow",M=e=>"@_"+e;var x=(e,r,a)=>{const o={},s={},p={},m={},h={},v={},P={},T={onPeerJoin:f,onPeerLeave:f,onPeerStream:f,onPeerTrack:f},A=(e,r)=>(e?Array.isArray(e)?e:[e]:u(o)).flatMap((e=>{const n=o[e];return n?r(e,n):(console.warn(`${t}: no peer with id ${e} found`),[])})),S=e=>{o[e]&&(o[e].destroy(),delete o[e],delete m[e],delete h[e],T.onPeerLeave(e),r(e))},L=e=>{if(s[e])return p[e];if(!e)throw y("action type argument is required");const r=w(e);if(r.byteLength>12)throw y(`action type string "${e}" (${r.byteLength}b) exceeds byte limit (12). Hint: choose a shorter name.`);const t=new Uint8Array(12);t.set(r);let a=0;return s[e]={onComplete:f,onProgress:f,setOnComplete(r){return s[e]={...s[e],onComplete:r}},setOnProgress(r){return s[e]={...s[e],onProgress:r}},async send(e,r,s,c){if(s&&"object"!=typeof s)throw y("action meta argument must be an object");const l=typeof e;if("undefined"===l)throw y("action data cannot be undefined");const d="string"!==l,u=e instanceof Blob,f=u||e instanceof ArrayBuffer||e instanceof j;if(s&&!f)throw y("action meta argument can only be used with binary data");const p=f?new Uint8Array(u?await e.arrayBuffer():e):w(d?b(e):e),m=s?w(b(s)):null,g=Math.ceil(p.byteLength/H)+(s?1:0)||1,h=n(g,((e,r)=>{const n=r===g-1,o=s&&0===r,i=new Uint8Array(15+(o?m.byteLength:n?p.byteLength-H*(g-(s?2:1)):H));return i.set(t),i.set([a],12),i.set([n|o<<1|f<<2|d<<3],13),i.set([Math.round((r+1)/g*R)],14),i.set(s?o?m:p.subarray((r-1)*H,r*H):p.subarray(r*H,(r+1)*H),15),i}));return a=a+1&R,i(A(r,(async(e,r)=>{const{channel:t}=r;let n=0;for(;n<g;){const a=h[n];if(t.bufferedAmount>t.bufferedAmountLowThreshold&&await new Promise((e=>{const r=()=>{t.removeEventListener(J,r),e()};t.addEventListener(J,r)})),!o[e])break;r.sendData(a),n++,c?.(a[14]/R,e,s)}})))}},p[e]||=[s[e].send,s[e].setOnComplete,s[e].setOnProgress]},D=async()=>{await G(""),await new Promise((e=>setTimeout(e,99))),l(o).forEach((([e,r])=>{r.destroy(),delete o[e]})),a()},[I,$]=L(M("ping")),[E,C]=L(M("pong")),[U,_]=L(M("signal")),[O,x]=L(M("stream")),[q,B]=L(M("track")),[G,N]=L(M("leave"));return e(((e,r)=>{o[r]||(o[r]=e,e.setHandlers({data(e){return((e,r)=>{const n=new Uint8Array(r),a=g(n.subarray(0,12)).replaceAll("\0",""),[o]=n.subarray(12,13),[i]=n.subarray(13,14),[c]=n.subarray(14,15),l=n.subarray(15),d=!!(1&i),u=!!(2&i),f=!!(4&i),y=!!(8&i);if(!s[a])return void console.warn(`${t}: received message with unregistered type (${a})`);m[e]||={},m[e][a]||={};const p=m[e][a][o]||={chunks:[]};if(u?p.meta=k(g(l)):p.chunks.push(l),s[a].onProgress(c/R,e,p.meta),!d)return;const w=new Uint8Array(p.chunks.reduce(((e,r)=>e+r.byteLength),0));if(p.chunks.reduce(((e,r)=>(w.set(r,e),e+r.byteLength)),0),delete m[e][a][o],f)s[a].onComplete(w,e,p.meta);else{const r=g(w);s[a].onComplete(y?k(r):r,e)}})(r,e)},stream(e){T.onPeerStream(e,r,v[r]),delete v[r]},track(e,t){T.onPeerTrack(e,t,r,P[r]),delete P[r]},signal(e){return U(e,r)},close(){return S(r)},error(e){console.error(e),S(r)}}),T.onPeerJoin(r))})),$(((e,r)=>E("",r))),C(((e,r)=>{h[r]?.(),delete h[r]})),_(((e,r)=>o[r]?.signal(e))),x(((e,r)=>v[r]=e)),B(((e,r)=>P[r]=e)),N(((e,r)=>S(r))),c&&addEventListener("beforeunload",D),{makeAction:L,leave:D,async ping(e){if(!e)throw y("ping() must be called with target peer ID");const r=Date.now();return I("",e),await new Promise((r=>h[e]=r)),Date.now()-r},getPeers(){return d(l(o).map((([e,r])=>[e,r.connection])))},addStream(e,r,t){return A(r,(async(r,n)=>{t&&await O(t,r),n.addStream(e)}))},removeStream(e,r){return A(r,((r,t)=>t.removeStream(e)))},addTrack(e,r,t,n){return A(t,(async(t,a)=>{n&&await q(n,t),a.addTrack(e,r)}))},removeTrack(e,r){return A(r,((r,t)=>t.removeTrack(e)))},replaceTrack(e,r,t,n){return A(t,(async(t,a)=>{n&&await q(n,t),a.replaceTrack(e,r)}))},onPeerJoin(e){return T.onPeerJoin=e},onPeerLeave(e){return T.onPeerLeave=e},onPeerStream(e){return T.onPeerStream=e},onPeerTrack(e){return T.onPeerTrack=e}}};const q={},B={},G={},N={},z={},K={},V={},W={},F=async e=>{if(B[e])return B[e];const r=(await I(e)).slice(0,20);return B[e]=r,G[r]=e,r},Q=async(e,r,t)=>e.send(b({action:"announce",info_hash:await F(r),peer_id:s,...t})),X=(e,r,n)=>console.warn(`${t}: torrent tracker ${n?"failure":"warning"} from ${e} - ${r}`),Y=(({init:e,subscribe:r,announce:a})=>{const o={};let l,d,u,p,m=!1;return(g,v,P)=>{const{appId:T}=g;if(o[T]?.[v])return o[T][v];const D={},C={},U=h(t,T,v),O=I(U),j=I(h(U,s)),H=(async(e,r,t)=>crypto.subtle.importKey("raw",await crypto.subtle.digest({name:"SHA-256"},w(`${e}:${r}:${t}`)),{name:L},!1,["encrypt","decrypt"]))(g.password||"",T,v),R=e=>async r=>({type:r.type,sdp:await e(H,r.sdp)}),J=R(E),M=R($),q=()=>_(!0,g),B=(e,r,t)=>{C[r]?C[r]!==e&&e.destroy():(C[r]=e,Q(e,r),D[r]?.forEach(((e,r)=>{r!==t&&e.destroy()})),delete D[r])},G=(e,r)=>{C[r]===e&&delete C[r]},N=e=>(d.push(...n(e,q)),i(d.splice(0,e).map((e=>e.offerPromise.then(M).then((r=>({peer:e,offer:r}))))))),z=(e,r)=>P?.({error:`incorrect password (${g.password}) when decrypting ${r}`,appId:T,peerId:e,roomId:v}),K=e=>async(r,t,n)=>{const[a,o]=await i([O,j]);if(r!==a&&r!==o)return;const{peerId:c,offer:l,answer:d,peer:u}="string"==typeof t?k(t):t;if(c!==s&&!C[c])if(!c||l||d){if(l){const r=D[c]?.[e];if(r&&s>c)return;const t=_(!1,g);let a;t.setHandlers({connect(){return B(t,c,e)},close(){return G(t,c)}});try{a=await J(l)}catch{return void z(c,"offer")}if(t.isDead)return;const[o,d]=await i([I(h(U,c)),t.signal(a)]);n(o,b({peerId:s,answer:await M(d)}))}else if(d){let r;try{r=await J(d)}catch(e){return void z(c,"answer")}if(u)u.setHandlers({connect(){return B(u,c,e)},close(){return G(u,c)}}),u.signal(r);else{const t=D[c]?.[e];t&&!t.isDead&&t.signal(r)}}}else{if(D[c]?.[e])return;const[[{peer:r,offer:t}],a]=await i([N(1),I(h(U,c))]);D[c]||=[],D[c][e]=r,setTimeout((()=>((e,r)=>{if(C[e])return;const t=D[e]?.[r];t&&(delete D[e][r],t.destroy())})(c,e)),.9*V[e]),r.setHandlers({connect(){return B(r,c,e)},close(){return G(r,c)}}),n(a,b({peerId:s,offer:t}))}};if(!g)throw y("requires a config map as the first argument");if(!T&&!g.firebaseApp)throw y("config map is missing appId field");if(!v)throw y("roomId argument required");if(!m){const r=e(g);d=n(20,q),l=Array.isArray(r)?r:[r],m=!0,u=setInterval((()=>d=d.filter((e=>{const r=Date.now()-e.created<57333;return r||e.destroy(),r}))),59052.99),p=g.manualRelayReconnection?f:(()=>{if(c){const e=new AbortController;return addEventListener("online",S,{signal:e.signal}),addEventListener("offline",A,{signal:e.signal}),()=>e.abort()}return f})()}const V=l.map((()=>5333)),W=[],F=l.map((async(e,t)=>r(await e,await O,await j,K(t),N)));i([O,j]).then((([e,r])=>{const t=async(n,o)=>{const s=await a(n,e,r);"number"==typeof s&&(V[o]=s),W[o]=setTimeout((()=>t(n,o)),V[o])};F.forEach((async(e,r)=>{await e,t(await l[r],r)}))}));let Q=f;return o[T]||={},o[T][v]=x((e=>Q=e),(e=>delete C[e]),(()=>{delete o[T][v],W.forEach(clearTimeout),F.forEach((async e=>(await e)())),clearInterval(u),p(),m=!1}))}})({init(e){return((e,r,t)=>(e.relayUrls||r).slice(0,e.relayUrls?e.relayUrls.length:e.relayRedundancy||t))(e,re,3).map((e=>{const r=((e,r)=>{const t={},n=()=>{const a=new WebSocket(e);a.onclose=()=>{P?P.then(n):(v[e]??=3333,setTimeout(n,v[e]),v[e]*=2)},a.onmessage=e=>r(e.data),t.socket=a,t.url=a.url,t.ready=new Promise((r=>a.onopen=()=>{r(t),v[e]=3333})),t.send=e=>{1===a.readyState&&a.send(e)}};return n(),t})(e,(e=>{const r=k(e),n=r["failure reason"],a=r["warning message"],{interval:o}=r,s=G[r.info_hash];if(n)X(t,n,!0);else{if(a&&X(t,a),o&&1e3*o>K[t]&&z[t][s]){const e=Math.min(1e3*o,120333);clearInterval(N[t][s]),K[t]=e,N[t][s]=setInterval(z[t][s],e)}V[r.offer_id]||(r.offer||r.answer)&&(V[r.offer_id]=!0,W[t][s]?.(r))}})),{url:t}=r;return q[t]=r,W[t]={},r.ready}))},subscribe(e,r,t,n,a){const{url:s}=e,i=async()=>{const t=d((await a(10)).map((e=>[o(20),e])));W[e.url][r]=a=>{if(a.offer)n(r,{offer:a.offer,peerId:a.peer_id},((t,n)=>Q(e,r,{answer:k(n).answer,offer_id:a.offer_id,to_peer_id:a.peer_id})));else if(a.answer){const e=t[a.offer_id];e&&n(r,{answer:a.answer,peerId:a.peer_id,peer:e.peer})}},Q(e,r,{numwant:10,offers:l(t).map((([e,{offer:r}])=>({offer_id:e,offer:r})))})};return K[s]=33333,z[s]||={},z[s][r]=i,N[s]||={},N[s][r]=setInterval(i,K[s]),i(),()=>{clearInterval(N[s][r]),delete W[s][r],delete z[s][r]}},announce(e){return K[e.url]}}),Z=(ee=q,()=>d(l(ee).map((([e,r])=>[e,r.socket]))));var ee;const re=["tracker.webtorrent.dev","tracker.openwebtorrent.com","tracker.files.fm:7073/announce"].map((e=>"wss://"+e));export{re as defaultRelayUrls,Z as getRelaySockets,Y as joinRoom,A as pauseRelayReconnection,S as resumeRelayReconnection,s as selfId};
```

Step 6 — Service worker fetch (`sw.js?v=<cacheverzija>`)  
- Registered after the `load` event; caches the app shell list inside using the versioned cache key.

```js
const queryString = self.location.search;
const params = new URLSearchParams(queryString);
const CACHE_NAME = params.get('v');
console.log("ServiceWorker cache version: " + CACHE_NAME);

// Keep this list for the essential "App Shell"
const APP_SHELL_URLS = [
  '.',
  'index.html',
  'manifest.json',
  // CSS
  'assets/css/base.css',
  'assets/css/layout.css',
  'assets/css/components.css',
  'assets/css/reports.css',
  'assets/css/editor.css',
  'assets/css/print.css',
  'assets/css/treatment.css',
  'assets/fontawesome/css/all.css',
  'assets/googlefonts.css',
  // JS
  'assets/script.js',
  'assets/js-mod/SFSS.js',
  'assets/js-mod/Constants.js',
  'assets/js-mod/EditorHandler.js',
  'assets/js-mod/MediaPlayer.js',
  'assets/js-mod/SidebarManager.js',
  'assets/js-mod/IDBHelper.js',
  'assets/js-mod/ScrollbarManager.js',
  'assets/js-mod/StorageManager.js',
  'assets/js-mod/ReportsManager.js',
  'assets/js-mod/TreatmentRenderer.js',
  'assets/js-mod/IOManager.js',
  'assets/js-mod/SettingsManager.js',
  'assets/js-mod/TreatmentManager.js',
  // Images/Icons
  'assets/images/icon-64.png',
  'assets/images/icon-512.png',
  // Fonts (Google)
  'assets/googlefonts/u-4n0q2lgwslOqpF_6gQ8kELawRZVsf6lvg.woff2',
  'assets/googlefonts/u-4n0q2lgwslOqpF_6gQ8kELawRZWMf6.woff2',
  'assets/googlefonts/u-4i0q2lgwslOqpF_6gQ8kELawRR4-Lvp9nsBXw.woff2',
  'assets/googlefonts/u-450q2lgwslOqpF_6gQ8kELaw9pWt_-.woff2',
  'assets/googlefonts/u-450q2lgwslOqpF_6gQ8kELawFpWg.woff2',
  'assets/googlefonts/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-7fq8Ho.woff2',
  'assets/googlefonts/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-Dfqw.woff2',
  // Fonts (FontAwesome)
  'assets/fontawesome/webfonts/fa-solid-900.woff2',
  'assets/fontawesome/webfonts/fa-brands-400.woff2',
  'assets/fontawesome/webfonts/fa-regular-400.woff2'
];

// On install, cache the app shell
self.addEventListener('install', event => {
  self.skipWaiting(); // Force update
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(APP_SHELL_URLS);
      })
  );
});

// On activate, clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
        self.clients.claim(), // Take control immediately
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                if (cacheName !== CACHE_NAME) {
                    console.log('Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                }
                })
            );
        })
    ])
  );
});

// The "Stale-While-Revalidate" strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        // Return from cache if available
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If we get a valid response, update the cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Return the cached response immediately, while the fetch happens in the background.
        // If not in cache, the browser waits for the fetch to complete.
        return response || fetchPromise;
      });
    })
  );
});
```

Step 7 — Font and icon assets fetched implicitly  
- Font Awesome webfonts requested by `assets/fontawesome/css/all.css`: `assets/fontawesome/webfonts/fa-solid-900.woff2` (78268 bytes), `assets/fontawesome/webfonts/fa-brands-400.woff2` (76736 bytes), `assets/fontawesome/webfonts/fa-regular-400.woff2` (13224 bytes).
- Courier Prime fonts requested by `assets/googlefonts.css`: `assets/googlefonts/u-4n0q2lgwslOqpF_6gQ8kELawRZVsf6lvg.woff2` (14000 bytes), `assets/googlefonts/u-4n0q2lgwslOqpF_6gQ8kELawRZWMf6.woff2` (21556 bytes), `assets/googlefonts/u-4i0q2lgwslOqpF_6gQ8kELawRR4-Lvp9nsBXw.woff2` (14036 bytes), `assets/googlefonts/u-450q2lgwslOqpF_6gQ8kELawFpWg.woff2` (18640 bytes), `assets/googlefonts/u-450q2lgwslOqpF_6gQ8kELaw9pWt_-.woff2` (12736 bytes), `assets/googlefonts/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-7fq8Ho.woff2` (12928 bytes), `assets/googlefonts/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-Dfqw.woff2` (19348 bytes).
- Favicons/manifest icons the browser may prefetch: `assets/images/icon-64.png` (9824 bytes), `assets/images/icon-128.png` (8074 bytes), `assets/images/icon-512.png` (92933 bytes), `assets/images/maskable_icon.png` (92933 bytes), `assets/images/icon.svg` (322 bytes).
- Manifest screenshots (store/install surfaces only): `assets/images/screenshot.jpg` (68847 bytes), `assets/images/screenshot-wide.jpg` (87198 bytes).
- Binary payloads are unchanged from disk and not re-inlined here to keep the log readable.
