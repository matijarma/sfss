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
        this.treatmentModeActive = false;
        this.isDirty = false;
        this.characters = new Set();
        this.meta = {
            title: '', author: '', contact: '',
            showTitlePage: true, showSceneNumbers: false, showDate: false
        };
        this.sceneMeta = {};
        
        // Shortcuts
        const storedShortcuts = localStorage.getItem('sfss_shortcuts');
        this.shortcuts = storedShortcuts ? JSON.parse(storedShortcuts) : { cycleType: 'Ctrl+Shift' };
        this.canExit = false;
        
        // Keymap
        this.keymap = {
            [constants.ELEMENT_TYPES.SLUG]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.CHARACTER },
            [constants.ELEMENT_TYPES.ACTION]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.CHARACTER },
            [constants.ELEMENT_TYPES.CHARACTER]: { enter: constants.ELEMENT_TYPES.DIALOGUE, tab: constants.ELEMENT_TYPES.PARENTHETICAL },
            [constants.ELEMENT_TYPES.DIALOGUE]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.PARENTHETICAL },
            [constants.ELEMENT_TYPES.PARENTHETICAL]: { enter: constants.ELEMENT_TYPES.DIALOGUE, tab: constants.ELEMENT_TYPES.DIALOGUE },
            [constants.ELEMENT_TYPES.TRANSITION]: { enter: constants.ELEMENT_TYPES.SLUG, tab: constants.ELEMENT_TYPES.ACTION }
        };

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
        
        this.ELEMENT_TYPES = constants.ELEMENT_TYPES;
        this.TYPE_LABELS = constants.TYPE_LABELS;
        
        this.init();
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
                await this.populateOpenMenu();
                await this.checkBackupStatus();

                
                this.toggleLoader(false);
                resolve();
            }, 50);
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

        const storedTheme = localStorage.getItem('sfss_theme');
        if (storedTheme === 'dark' || (!storedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark-mode');
        }
        
        this.bindEventListeners();
        this.toggleSidebar(); 
        
        const activeScriptId = await this.storageManager.init();
        await this.loadScript(activeScriptId);
        
        this.initMenu('file-menu-container', 'file-menu-dropdown');

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
                        if (file.name.endsWith('.fdx')) {
                            await this.importFDX(fileText);
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
        status.innerHTML ="V. "+window.cacheverzija;
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
            // Delay slightly to ensure UI is ready
            setTimeout(() => this.collabUI.joinFromUrl(autoJoinRoom), 500);
        }
    }

    async checkWelcomeScreen() {
        if (!document.body.classList.contains('mobile-view')) {
            document.getElementById('mobile-welcome-modal').classList.add('hidden');
            return;
        }

        const showWelcome = localStorage.getItem('sfss_show_welcome');
        // Default to true if null, or if strictly 'true'
        const shouldShow = showWelcome === null || showWelcome === 'true';
        
        const sidebarToggle = document.getElementById('sidebar-welcome-toggle');
        if (sidebarToggle) sidebarToggle.checked = shouldShow;

        if (shouldShow) {
            await this.populateWelcomeScriptList();
            document.getElementById('mobile-welcome-modal').classList.remove('hidden');
            // Ensure checkbox reflects state
            document.getElementById('welcome-startup-toggle').checked = true;
        } else {
            // Only show if script is actually empty/untitled as a fallback for new users who might have unchecked it but cleared data? 
            // Or just respect the "False".
            // User requested: "if there is no last screenplay to open there should be a little welcome screen"
            // So if disabled, but script is empty, maybe still show? 
            // Let's stick to the "Show on startup" toggle being the master switch for the "Dashboard" behavior.
            // But if it's "False", we check if the script is empty/new.
            
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
            if (isActive) item.classList.add('bg-scene-hover'); // Slight highlight background
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
        document.getElementById('download-json-btn').addEventListener('click', () => this.downloadJSON());
        document.getElementById('download-fdx-btn').addEventListener('click', () => this.downloadFDX());
        document.getElementById('download-fountain-btn').addEventListener('click', () => this.downloadFountain());
        document.getElementById('download-text-btn').addEventListener('click', () => this.downloadText());
        document.getElementById('print-btn').addEventListener('click', () => this.printScript());
        document.getElementById('reports-menu-btn').addEventListener('click', () => this.reportsManager.open());
        document.getElementById('settings-btn').addEventListener('click', (e) => { e.preventDefault(); this.openSettings(); });
        document.getElementById('undo-btn').addEventListener('click', () => this.undo());
        document.getElementById('redo-btn').addEventListener('click', () => this.redo());
        
        const treatmentSwitch = document.getElementById('treatment-mode-switch');
        if (treatmentSwitch) treatmentSwitch.addEventListener('change', () => this.toggleTreatmentMode());
        
        const mobileTreatmentSwitch = document.getElementById('mobile-treatment-switch');
        if (mobileTreatmentSwitch) mobileTreatmentSwitch.addEventListener('change', () => this.toggleTreatmentMode());

        document.getElementById('top-type-selector').addEventListener('change', (e) => this.editorHandler.manualTypeChangeZD(e.target.value));
        document.getElementById('theme-toggle-btn').addEventListener('click', () => this.toggleTheme());
        document.getElementById('page-view-btn').addEventListener('click', () => this.togglePageView());
        document.getElementById('file-input').addEventListener('change', (e) => this.uploadFile(e.target));
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

        document.getElementById('settings-close-btn').addEventListener('click', () => this.closeSettings());
        document.getElementById('settings-save-btn').addEventListener('click', () => { this.saveSettingsFromModal(); this.closeSettings(); });

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
            backupMenu.querySelector('[data-action="download-json"]').addEventListener('click', () => { this.downloadJSON(); this.sidebarManager.toggleMobileMenu(); });
            backupMenu.querySelector('[data-action="download-fdx"]').addEventListener('click', () => { this.downloadFDX(); this.sidebarManager.toggleMobileMenu(); });
            backupMenu.querySelector('[data-action="download-fountain"]').addEventListener('click', () => { this.downloadFountain(); this.sidebarManager.toggleMobileMenu(); });
            backupMenu.querySelector('[data-action="download-text"]').addEventListener('click', () => { this.downloadText(); this.sidebarManager.toggleMobileMenu(); });
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
            if (!this.treatmentModeActive) this.toggleTreatmentMode();
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
            });
        });

        // Welcome Modal Click-Away
        document.getElementById('mobile-welcome-modal').addEventListener('click', (e) => {
            // Only allow closing if we have a script loaded (not effectively empty)
            // But user said: "if the app did load the latest open screenplay... make it possible to just click away"
            // So if we are showing the modal over an existing script, clicking the bg should close it.
            // The modal itself is the overlay.
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

    handleBackOrEscape(isPopState = false) {
        // Order of closing:
        // 1. Modals/Popups
        // 2. Sidebar
        // 3. Page View
        
        let handled = false;

        // Helper to close specific modal if open
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
                history.pushState(null, null, location.href); // Restore state if we consumed the back action for UI
            }
            return;
        }

        // Double Back to Exit (Mobile PWA)
        if (isPopState && document.body.classList.contains('mobile-view')) {
            if (this.canExit) {
                // Allow exit
                return;
            } else {
                this.canExit = true;
                const status = document.getElementById('save-status'); // Reuse save status or create toast
                const originalText = status.innerHTML;
                const originalOpacity = status.style.opacity;
                
                status.textContent = 'Press back again to exit';
                status.style.opacity = '1';
                
                history.pushState(null, null, location.href); // Push state back to trap
                
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
        if (this.treatmentModeActive) this.toggleTreatmentMode();
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
        // S-A-C-P-D-T
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
        
        // Handle Text Preservation
        if (!this.cycleState || this.cycleState.blockId !== currentBlock.dataset.lineId) {
            this.cycleState = {
                blockId: currentBlock.dataset.lineId,
                originalText: currentBlock.textContent
            };
        }

        const idx = cycleOrder.indexOf(currentType);
        // If current type not in cycle list (shouldn't happen), default to Action (index 1) -> next is C
        const nextIndex = idx === -1 ? 1 : (idx + 1) % cycleOrder.length;
        const nextType = cycleOrder[nextIndex];
        
        this.editorHandler.manualTypeChangeZD(nextType);
        
        // Restore/Force Case
        const isUppercaseType = [constants.ELEMENT_TYPES.SLUG, constants.ELEMENT_TYPES.CHARACTER, constants.ELEMENT_TYPES.TRANSITION].includes(nextType);
        
        if (isUppercaseType) {
            currentBlock.textContent = currentBlock.textContent.toUpperCase();
        } else {
            // Restore original text if available
            if (this.cycleState && this.cycleState.originalText) {
                // Check if current uppercase text matches original text uppercased.
                // If yes, user hasn't edited it, so safe to restore.
                // If no (user edited while in upper mode?), we should probably keep it?
                // But logic says "retype everything to normal caps".
                // If I cycle A->S (auto upper) -> A. Restoring original is good.
                // If I cycle A->S -> Edit -> A.
                // We need to know if edited.
                // `resetCycleState` will be called on input. So if edited, `cycleState` is null.
                // So here `cycleState` is NOT null only if no edits happened.
                currentBlock.textContent = this.cycleState.originalText;
            }
        }
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

        if (sidebarRect.right > contentRect.left) {
            this.toggleSidebar(true, false);
        }
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
    
    closePopups() {
        this.editorHandler.closePopups();
        this.sidebarManager.closeSceneSettings();
        this.sidebarManager.closeScriptMetaPopup();
        this.closeSettings();
    }

    printScript() {
        if (!this.pageViewActive) this.togglePageView();
        
        const style = document.createElement('style');
        style.id = 'print-style';
        let headerContent = (this.meta.title || 'Untitled Screenplay').replace(/"/g, "'");
        if (this.meta.showDate) {
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
        if (this.treatmentModeActive) {
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

    toggleTreatmentMode() {
        document.body.classList.add('mode-switching');

        if (!this.treatmentModeActive) {
             this.scriptData = this.exportToJSONStructure(true);
        }
        
        const topElementId = this.getCurrentScrollElement();
        
        this.treatmentModeActive = !this.treatmentModeActive;
        const switchEl = document.getElementById('treatment-mode-switch');
        const mobileSwitchEl = document.getElementById('mobile-treatment-switch');
        
        if(switchEl) switchEl.checked = this.treatmentModeActive;
        if(mobileSwitchEl) mobileSwitchEl.checked = this.treatmentModeActive; 
        
        if (this.treatmentModeActive) {
            // Enter Treatment Mode
            document.getElementById('app-container').classList.add('treatment-mode-active');
            document.getElementById('app-container').classList.remove('page-view-active');
            document.getElementById('page-view-btn').classList.toggle("hidden");

            this.editor.contentEditable = false; 
            this.editor.style.display = 'block'; 
            this.pageViewContainer.classList.add('hidden');
            document.getElementById('print-title-page').style.display = 'none';
            
            this.treatmentRenderer.renderFromData(this.scriptData.blocks, this.editor);
            
        } else {
            // Exit Treatment Mode
            document.getElementById('app-container').classList.remove('treatment-mode-active');
            this.editor.contentEditable = !document.body.classList.contains('mobile-view');
            this.editor.innerHTML = ''; 
            this.editor.style.display = '';
            
            document.getElementById('page-view-btn').classList.toggle("hidden");

            this.importJSON(this.scriptData, true);
            
            if (this.pageViewActive) {
                document.getElementById('app-container').classList.add('page-view-active');
                
                this.editor.style.display = 'none';
                this.pageViewContainer.classList.remove('hidden');
                this.paginate();
            }
        }
        
        if (topElementId) {
            setTimeout(() => this.scrollToScene(topElementId), 50);
        }
        
        this.updateToolbarButtons();

        setTimeout(() => document.body.classList.remove('mode-switching'), 350);
    }

    updateSceneDescriptionInTreatment(slugId, newTexts) {
        if (!this.scriptData || !this.scriptData.blocks) return; 
        
        const blocks = this.scriptData.blocks;
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
        
        if (!this.sceneMeta[slugId]) this.sceneMeta[slugId] = {};
        this.sceneMeta[slugId].description = newTexts.join('\n\n');
        
        this.isDirty = true;
    }
    
    addTransitionInTreatment(slugId) {
        if (!this.scriptData) return;
        const blocks = this.scriptData.blocks;
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
        
        this.isDirty = true;
    }
    
    addSceneHeadingInTreatment(slugId) {
        if (!this.scriptData) return;
        const blocks = this.scriptData.blocks;
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
        
        this.isDirty = true;
        this.refreshTreatmentView();
    }
    
    addCharacterInTreatment(slugId, charName) {
        if (!this.scriptData) return;
        const blocks = this.scriptData.blocks;
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
        
        this.editorHandler.commitCharacter(charName);
        this.isDirty = true;
        
        this.treatmentRenderer.renderFromData(this.scriptData.blocks, this.editor);
    }
    
    moveScene(index, direction) {
        if (!this.scriptData) return;
        
        const sceneRanges = [];
        let currentStart = 0;
        let currentSlug = null;
        
        this.scriptData.blocks.forEach((b, i) => {
            if (b.type === constants.ELEMENT_TYPES.SLUG) {
                if (currentSlug) {
                    sceneRanges.push({ start: currentStart, end: i, id: currentSlug.id });
                }
                currentStart = i;
                currentSlug = b;
            }
        });
        if (currentSlug) {
            sceneRanges.push({ start: currentStart, end: this.scriptData.blocks.length, id: currentSlug.id });
        }
        
        if (index < 0 || index >= sceneRanges.length) return;
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= sceneRanges.length) return;
        
        const sourceRange = sceneRanges[index];
        const targetRange = sceneRanges[targetIndex];
        
        const sourceBlocks = this.scriptData.blocks.slice(sourceRange.start, sourceRange.end);
        
        this.scriptData.blocks.splice(sourceRange.start, sourceRange.end - sourceRange.start);
        
        const newTargetSlugIndex = this.scriptData.blocks.findIndex(b => b.id === targetRange.id);
        
        let insertIndex;
        
        if (direction === -1) {
            insertIndex = newTargetSlugIndex;
        } else {
            let nextSlugIndex = -1;
            for (let i = newTargetSlugIndex + 1; i < this.scriptData.blocks.length; i++) {
                if (this.scriptData.blocks[i].type === constants.ELEMENT_TYPES.SLUG) {
                    nextSlugIndex = i;
                    break;
                }
            }
            
            if (nextSlugIndex === -1) {
                insertIndex = this.scriptData.blocks.length;
            } else {
                insertIndex = nextSlugIndex;
            }
        }
        
        this.scriptData.blocks.splice(insertIndex, 0, ...sourceBlocks);
        
        this.isDirty = true;
        
        this.treatmentRenderer.renderFromData(this.scriptData.blocks, this.editor);
        
        setTimeout(() => {
            const blocks = this.editor.querySelectorAll('.treatment-scene-block');
            if (blocks[targetIndex]) blocks[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
    }
    
    refreshTreatmentView() {
        if (this.treatmentModeActive) {
             this.treatmentRenderer.renderFromData(this.scriptData.blocks, this.editor);
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
                const wasCollapsed = this.mainArea.classList.contains('sidebar-collapsed');
                // Mobile behavior relies on 'open' class on sidebar element handled by SidebarManager? 
                // Wait, SFSS.js manages desktop collapsing. Mobile uses SidebarManager.toggleMobileMenu().
                // Let's verify. SidebarManager has toggleMobileMenu. SFSS has toggleSidebar.
                // toggleSidebar seems to be for Desktop collapsible state.
                // SidebarManager.toggleMobileMenu handles the mobile slide-out.
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
            
            const scale = Math.min(1, (window.innerWidth - 20) / 816); // 8.5in * 96 = 816px

            // Inject Mobile Page View Styles if not present or update them
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
                    margin-bottom: -${(1 - scale) * 100}%; /* Compensate for empty space */
                }
            `;
            
            this.editorHandler.closePopups();
            if (!wasMobile) {
                // Switching TO mobile
                this.checkWelcomeScreen();
                
                // Force Treatment Mode as default on Mobile
                if (!this.treatmentModeActive) {
                    this.toggleTreatmentMode();
                } else {
                    this.refreshTreatmentView();
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
                // Switching FROM mobile
                this.refreshTreatmentView();
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
            
            // Broadcast Real-time Update
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

    openSettings() {
        // Manually close other popups to avoid closing settings itself via closePopups()
        this.editorHandler.closePopups();
        this.sidebarManager.closeSceneSettings();
        this.sidebarManager.closeScriptMetaPopup();
        document.getElementById('help-modal').classList.add('hidden');
        document.getElementById('reports-modal').classList.add('hidden');

        this.generateKeymapSettings();
        document.getElementById('settings-modal').classList.remove('hidden');
        this.pushHistoryState('settings');
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.toggle('hidden');
    }
    
    async saveSettingsFromModal() {
        localStorage.setItem('sfss_keymap', JSON.stringify(this.keymap));
        localStorage.setItem('sfss_shortcuts', JSON.stringify(this.shortcuts));
        await this.persistSettings();
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

    getCurrentScrollElement() {
        const scrollContainer = document.getElementById('scroll-area');
        const containerRect = scrollContainer.getBoundingClientRect();
        
        if (this.treatmentModeActive) {
            const blocks = this.editor.querySelectorAll('.treatment-scene-block');
            for (const block of blocks) {
                const rect = block.getBoundingClientRect();
                if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
                    return block.dataset.sceneId;
                }
            }
            return null;
        }
        
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

            // Helper to scroll to the active cursor

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

        }

    

        applySettings() {

            this.updatePageTitle();

            this.sidebarManager.updateSidebarHeader();

            this.toggleSceneNumbers(this.meta.showSceneNumbers);

            

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

        }

    

        generateKeymapSettings() {

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

                    const selector = this.createKeymapSelector(type, key);

                    keyCell.appendChild(selector);

                    row.appendChild(keyCell);

                });

    

                tbody.appendChild(row);

            }

            table.appendChild(tbody);

            container.appendChild(table);

        }

    

        createKeymapSelector(type, key) {

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

    

        updatePageTitle() {

            document.title = this.meta.title || 'Untitled Screenplay';

        }

    

        toggleSceneNumbers(active) {

            this.editor.classList.toggle('show-scene-numbers', active);

            this.pageViewContainer.classList.toggle('show-scene-numbers', active);

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

    

        toggleTheme() {

            document.documentElement.classList.toggle('dark-mode');

            localStorage.setItem('sfss_theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');

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

    

            if (this.treatmentModeActive) {

                if (sceneNumBtn) sceneNumBtn.style.display = 'none';

                if (dateBtn) dateBtn.style.display = 'none';

            } else {

                if (sceneNumBtn) sceneNumBtn.style.display = ''; // Visible in Writing Mode (and Page View)

                

                if (dateBtn) {

                    // Only visible in Page View of Writing Mode

                    dateBtn.style.display = this.pageViewActive ? '' : 'none';

                    dateBtn.disabled = false; // Reset disabled state just in case

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

    

            if (this.treatmentModeActive) return; 

    

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

                

                const options = {

                    showSceneNumbers: this.meta.showSceneNumbers,

                    showPageNumbers: true,

                    showDate: this.meta.showDate,

                    headerText: this.getHeaderText()

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

            if (!forceDOM && this.treatmentModeActive && this.scriptData) {

                this.scriptData.meta = this.meta;

                this.scriptData.sceneMeta = this.sceneMeta;

                this.scriptData.characters = Array.from(this.characters);

                return this.scriptData;

            }

    

            const blocks = [];

            this.editor.querySelectorAll('.script-line').forEach(node => {

                blocks.push({ type: this.editorHandler.getBlockType(node), text: node.textContent, id: node.dataset.lineId });

            });

            return { meta: this.meta, sceneMeta: this.sceneMeta, blocks: blocks, characters: Array.from(this.characters) };

        }

    

        async downloadJSON() {

            await this.storageManager.updateBackupTimestamp(this.activeScriptId);

            const data = this.exportToJSONStructure();

            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});

            const a = document.createElement('a');

            a.href = URL.createObjectURL(blob);

            a.download = `${this.meta.title || 'script'}.json`;

            a.click();

        }

    

        uploadFile(input) {

            const file = input.files[0];

            if (!file) return;

            const reader = new FileReader();

            reader.onload = async (e) => {

                try {

                    const newScript = this.storageManager.createNewScript();

                    await this.loadScript(newScript.id, newScript);

    

                    if (file.name.endsWith('.fdx')) await this.importFDX(e.target.result);

                    else await this.importJSON(JSON.parse(e.target.result)); 

                } catch (err) { 

                    console.error(err);

                    alert('Invalid file format or error importing.'); 

                }

            };

            reader.readAsText(file);

            input.value = '';

        }

    

        typewriterEffect(element, text) {

            if (element._typewriterTimeout) {

                clearTimeout(element._typewriterTimeout);

            }

            

            let i = 0;

            const speed = 30; // ms per char

            

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

    

            // Smart DOM Update (Visual Optimization)

            const newBlockMap = new Map(data.blocks.map(b => [b.id, b]));

            const existingBlocks = Array.from(this.editor.querySelectorAll('.script-line'));

            const existingBlockMap = new Map(existingBlocks.map(b => [b.dataset.lineId, b]));

            

            // Remove active class from previous

            const prevActive = this.editor.querySelector('.collab-active-block');

            if (prevActive) prevActive.classList.remove('collab-active-block');

    

            // 1. Remove deleted blocks

            existingBlocks.forEach(b => {

                if (!newBlockMap.has(b.dataset.lineId)) {

                    b.remove();

                }

            });

    

            // 2. Update or Insert blocks

            let previousNode = null;

            let lastChangedBlock = null;

            

            data.blocks.forEach(blockData => {

                let blockEl = existingBlockMap.get(blockData.id);

                

                if (blockEl) {

                    // Update content if changed

                    if (blockEl.textContent !== blockData.text) {

                        // Mark as changed

                        lastChangedBlock = blockEl;

                        

                        if (animate && blockData.text.startsWith(blockEl.textContent)) {

                            const suffix = blockData.text.substring(blockEl.textContent.length);

                            // Only animate reasonable lengths to avoid lag

                            if (suffix.length > 50) {

                                 if (blockEl._typewriterTimeout) clearTimeout(blockEl._typewriterTimeout);

                                 blockEl.textContent = blockData.text;

                            } else {

                                 this.typewriterEffect(blockEl, suffix);

                            }

                        } else {

                            if (blockEl._typewriterTimeout) clearTimeout(blockEl._typewriterTimeout);

                            blockEl.textContent = blockData.text;

                        }

                    }

                    // Update type if changed

                    const currentType = this.editorHandler.getBlockType(blockEl);

                    if (currentType !== blockData.type) {

                        this.editorHandler.setBlockType(blockEl, blockData.type);

                        // Type change counts as a change for cursor position

                        lastChangedBlock = blockEl;

                    }

                    

                    // Ensure order

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

                    // Create new

                    blockEl = this.editorHandler.createBlock(blockData.type, blockData.text);

                    blockEl.dataset.lineId = blockData.id;

                    if (previousNode) {

                        this.editor.insertBefore(blockEl, previousNode.nextSibling);

                    } else {

                        this.editor.prepend(blockEl);

                    }

                    lastChangedBlock = blockEl; // New block is active

                }

                previousNode = blockEl;

            });

    

            // Apply Active Cursor

            // Priority: Explicit activeLineId > lastChangedBlock

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

            

            if (this.treatmentModeActive) {

                 this.scriptData = data; 

                 this.refreshTreatmentView();

            } else {

                 this.mediaPlayer.updatePlaylist();

            }

            

            if (!fromLoad) {

                await this.save();

                this.saveState(true);

            }

        }

    

        async importFDX(xmlText) {

            const parser = new DOMParser();

            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            const mainContent = xmlDoc.querySelector('FinalDraft > Content');

            if (!mainContent) { alert("No script content found in FDX."); return; }

            const paragraphs = mainContent.querySelectorAll("Paragraph");

            this.editor.innerHTML = '';

            this.characters.clear();

            this.meta.title = xmlDoc.querySelector('Title') ? xmlDoc.querySelector('Title').textContent : ''; 

            this.applySettings();

            paragraphs.forEach(p => {

                const type = p.getAttribute("Type");

                let text = Array.from(p.getElementsByTagName("Text")).map(t => t.textContent).join('');

                if (!text && p.textContent) text = p.textContent;

                const dzType = constants.FDX_REVERSE_MAP[type] || constants.ELEMENT_TYPES.ACTION;

                this.editorHandler.createBlock(dzType, text);

                if (dzType === constants.ELEMENT_TYPES.CHARACTER) {

                    const clean = this.editorHandler.getCleanCharacterName(text);

                    if (clean.length > 1) this.characters.add(clean);

                }

            });

            this.sidebarManager.updateSceneList();

            await this.save();

            this.saveState(true);

        }

        

    

        async downloadFDX() {

            await this.storageManager.updateBackupTimestamp(this.activeScriptId);

            let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<FinalDraft DocumentType="Script" Template="No" Version="1">\n<Content>\n`;

            this.editor.querySelectorAll('.script-line').forEach(block => {

                const type = this.editorHandler.getBlockType(block);

                const fdxType = constants.FDX_MAP[type] || 'Action';

                const text = this.escapeXML(block.textContent);

                xml += `<Paragraph Type="${fdxType}">\n<Text>${text}</Text>\n</Paragraph>\n`;

            });

            xml += `</Content>\n</FinalDraft>`;

            const blob = new Blob([xml], {type: 'text/xml'});

            const a = document.createElement('a');

            a.href = URL.createObjectURL(blob);

            a.download = `${this.meta.title || 'script'}.fdx`;

            a.click();

        }

        

        async downloadFountain() {

            await this.storageManager.updateBackupTimestamp(this.activeScriptId);

            let fountain = [];

            const title = this.meta.title || "Untitled";

            const author = this.meta.author || "Unknown";

            fountain.push(`Title: ${title}\nAuthor: ${author}\n`);

    

            const blocks = this.editor.querySelectorAll('.script-line');

            for (let i = 0; i < blocks.length; i++) {

                const block = blocks[i];

                const text = block.textContent;

                const type = this.editorHandler.getBlockType(block);

                let prevType = null;

                if (i > 0) {

                    prevType = this.editorHandler.getBlockType(blocks[i-1]);

                }

    

                if (type === constants.ELEMENT_TYPES.SLUG) {

                    if (i > 0) fountain.push('');

                    fountain.push(text.toUpperCase());

                } else if (type === constants.ELEMENT_TYPES.ACTION) {

                    if (prevType && ![constants.ELEMENT_TYPES.ACTION, constants.ELEMENT_TYPES.SLUG].includes(prevType)) {

                         fountain.push('');

                    }

                    fountain.push(text);

                } else if (type === constants.ELEMENT_TYPES.CHARACTER) {

                     if (prevType && ![constants.ELEMENT_TYPES.ACTION, constants.ELEMENT_TYPES.SLUG].includes(prevType)) {

                         fountain.push('');

                    }

                    fountain.push(text.toUpperCase());

                } else if (type === constants.ELEMENT_TYPES.DIALOGUE) {

                    fountain.push(text);

                } else if (type === constants.ELEMENT_TYPES.PARENTHETICAL) {

                    fountain.push(text);

                } else if (type === constants.ELEMENT_TYPES.TRANSITION) {

                    fountain.push('');

                    fountain.push(`> ${text.toUpperCase()}`);

                }

            }

    

            const fountainText = fountain.join('\n');

            const blob = new Blob([fountainText], {type: 'text/plain;charset=utf-8'});

            const a = document.createElement('a');

            a.href = URL.createObjectURL(blob);

            a.download = `${this.meta.title || 'script'}.fountain`;

            a.click();

        }

    

        async downloadText() {

            await this.storageManager.updateBackupTimestamp(this.activeScriptId);

            

            let txtfile = [];

    

            const blocks = this.editor.querySelectorAll('.script-line');

            for (let i = 0; i < blocks.length; i++) {

                const block = blocks[i];

                const text = block.textContent;

                const type = this.editorHandler.getBlockType(block);

                let prevType = null;

                if (i > 0) {

                    prevType = this.editorHandler.getBlockType(blocks[i-1]);

                }

    

                if (type === constants.ELEMENT_TYPES.SLUG) {

                    if (i > 0) txtfile.push('');

                    txtfile.push(text.toUpperCase());

                } else if (type === constants.ELEMENT_TYPES.ACTION) {

                    if (prevType && ![constants.ELEMENT_TYPES.ACTION, constants.ELEMENT_TYPES.SLUG].includes(prevType)) {

                         txtfile.push('');

                    }

                    txtfile.push(text);

                } else if (type === constants.ELEMENT_TYPES.CHARACTER) {

                     if (prevType && ![constants.ELEMENT_TYPES.ACTION, constants.ELEMENT_TYPES.SLUG].includes(prevType)) {

                         txtfile.push('');

                    }

                    txtfile.push(text.toUpperCase());

                } else if (type === constants.ELEMENT_TYPES.DIALOGUE) {

                    txtfile.push(text);

                } else if (type === constants.ELEMENT_TYPES.PARENTHETICAL) {

                    txtfile.push(text);

                } else if (type === constants.ELEMENT_TYPES.TRANSITION) {

                    txtfile.push('');

                    txtfile.push(`> ${text.toUpperCase()}`);

                }

            }

    

            const txtfajlstring = txtfile.join('\n');

            const blob = new Blob([txtfajlstring], {type: 'text/plain;charset=utf-8'});

            const a = document.createElement('a');

            a.href = URL.createObjectURL(blob);

            a.download = `${this.meta.title || 'script'}.txt`;

            a.click();

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

                container.innerHTML = '<span class="dropdown-item" style="color:var(--text-meta);">No saved scripts.</span>';

                return;

            }

    

            scriptIds.forEach(scriptId => {

                const script = scripts[scriptId];

                const title = script.content?.meta?.title || new Date(script.lastSavedAt).toLocaleString();

                const isActive = scriptId === this.activeScriptId;

    

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

                        await this.loadScript(scriptId);

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

                        const nextId = await this.storageManager.deleteScript(scriptId);

                        if (this.activeScriptId === scriptId) {

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

            const title = script.lastBackupAt ? `Last backup: ${timeAgo}` : 'Not backed up yet';

    

            backupWarnings.forEach(backupWarning => {

                if(!backupWarning) return;

                if (!script.lastBackupAt || (new Date() - new Date(script.lastBackupAt) > thirtyMinutes)) {

                    backupWarning.classList.remove('hidden');

                    backupWarning.title = title;

                } else {

                    backupWarning.classList.add('hidden');

                }

            });

        }

    

        escapeXML(str) {

            return str.replace(/[<>&'"']/g, c => {

                switch (c) {

                    case '<': return '&lt;';

                    case '>': return '&gt;';

                    case '&': return '&amp;';

                    case '\'': return '&apos;';

                    case '"':

                    default: return '&quot;';

                }

            });

        }

    }

    