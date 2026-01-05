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
            if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                e.stopPropagation();
                this.printManager.open();
            }
        });
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
        const hide = (immediate = false) => {
            clearTimeout(menuHideTimeout);
            if (immediate) {
                dropdown.classList.add('hidden');
            } else {
                menuHideTimeout = setTimeout(() => dropdown.classList.add('hidden'), 120);
            }
        };
        const show = () => { 
            clearTimeout(menuHideTimeout); 
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                if (menu !== dropdown) menu.classList.add('hidden');
            });
            dropdown.classList.remove('hidden'); 
        };
        container.addEventListener('mouseenter', show);
        container.addEventListener('mouseleave', () => hide(false));
        dropdown.addEventListener('mouseenter', () => clearTimeout(menuHideTimeout));
        dropdown.addEventListener('mouseleave', () => hide(false));
        container.addEventListener('focusin', show);
        container.addEventListener('focusout', (e) => {
            if (!e.relatedTarget || !container.contains(e.relatedTarget)) hide(true);
        });
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
        const scrollBookmark = this.getCurrentScrollElement();
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
        if (scrollBookmark) {
            setTimeout(() => this.restoreScrollToElement(scrollBookmark), 30);
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
            return;
        }
        // Fallback for Treatment mode where blocks use data-scene-id
        if (this.treatmentManager.isActive) {
            this.scrollToScene(lineId);
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
                requestAnimationFrame(() => this.restoreScrollToElement(topElementId));
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
