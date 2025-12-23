import * as constants from './Constants.js';
import { StorageManager } from './StorageManager.js';
import { PageRenderer } from './PageRenderer.js';

export class MobileApp {
    constructor() {
        // Core DOM References
        this.editor = document.getElementById('editor-container');
        this.pageViewContainer = document.getElementById('page-view-container');
        this.sidebar = document.getElementById('sidebar');
        this.mainArea = document.getElementById('main-area');
        
        // Config & State
        this.activeScriptId = null;
        this.pageViewActive = false;
        this.meta = { title: '', author: '', contact: '', showTitlePage: true, showSceneNumbers: false, showDate: false };
        this.sceneMeta = {};
        this.characters = new Set();
        
        // Page rendering constants
        this.PAGE_HEIGHT_PX = 11 * 96;
        this.PAGE_MARGIN_TOP_PX = 1 * 96;
        this.PAGE_MARGIN_BOTTOM_PX = 1 * 96;
        this.CONTENT_HEIGHT_PX = this.PAGE_HEIGHT_PX - this.PAGE_MARGIN_TOP_PX - this.PAGE_MARGIN_BOTTOM_PX;
        this.lineHeight = 14; 

        // Modules
        this.storageManager = new StorageManager(this);
    }

    async init() {
        document.body.classList.add('mobile-view', 'mobile-sandbox'); 
        
        // Inject styles for Mobile Page View (A4 on Mobile)
        const style = document.createElement('style');
        style.innerHTML = `
            .mobile-sandbox #page-view-container .page {
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
            .mobile-sandbox #page-view-container {
                width: 8.5in;
                transform-origin: top left;
                overflow: visible;
                padding: 1rem 0;
            }
        `;
        document.head.appendChild(style);

        // Force hide the desktop sidebar button
        const desktopSidebarBtn = document.getElementById('show-sidebar-btn');
        if (desktopSidebarBtn) desktopSidebarBtn.style.display = 'none';

        // Force show page view button (overriding CSS)
        const pageViewBtn = document.getElementById('page-view-btn');
        if (pageViewBtn) pageViewBtn.style.display = 'flex';

        // Hide "New Screenplay" from mobile menu
        const newScreenplayBtn = document.querySelector('[data-action="new-screenplay"]');
        if (newScreenplayBtn) newScreenplayBtn.style.display = 'none';

        this.measureLineHeight();
        this.pageRenderer = new PageRenderer(this.lineHeight);
        this.bindEventListeners();
        
        // Initialize Theme
        const storedTheme = localStorage.getItem('sfss_theme');
        if (storedTheme === 'dark' || (!storedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark-mode');
        }

        // Load Data
        const activeScriptId = await this.storageManager.init();
        await this.loadScript(activeScriptId);
        
        this.cleanupDesktopUI();

        if (window.deferredInstallPrompt) {
            window.showPwaInstallButton();
        }
        
        // Handle file opening (if triggered via OS)
        if ('launchQueue' in window) {
            launchQueue.setConsumer(async (launchParams) => {
                if (!launchParams.files || launchParams.files.length === 0) return;
                for (const fileHandle of launchParams.files) {
                    const file = await fileHandle.getFile();
                    const fileText = await file.text();
                    this.handleFileUpload(file.name, fileText);
                }
            });
        }
    }
    
    getHeaderText() {
        if (!this.meta.showDate) return '';
        let text = (this.meta.title || 'Untitled Screenplay').replace(/"/g, "'");
        text += ` / ${new Date().toLocaleDateString()}`;
        return text;
    }
    
    cleanupDesktopUI() {
        const desktopOnly = document.querySelectorAll('.desktop-only');
        desktopOnly.forEach(el => el.classList.add('hidden'));
        this.editor.contentEditable = false;
        const player = document.getElementById('music-player');
        if(player) player.classList.add('hidden');
    }

    bindEventListeners() {
        // Toolbar & Menu
        document.getElementById('mobile-menu-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('hide-sidebar-btn').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('menu-overlay').addEventListener('click', () => this.toggleSidebar());
        
        // Page View Toggle
        document.getElementById('page-view-btn').addEventListener('click', () => this.togglePageView());
        
        // Toolbar Theme Toggle
        document.getElementById('theme-toggle-btn').addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            localStorage.setItem('sfss_theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');
        });

        // Mobile Sidebar Actions
        // Note: New Screenplay is hidden now.
        
        // File Open
        const fileInput = document.getElementById('file-input');
        document.querySelector('[data-action="open-from-file"]').addEventListener('click', () => { 
            fileInput.click(); 
            this.toggleSidebar(); 
        });
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => this.handleFileUpload(file.name, ev.target.result);
            reader.readAsText(file);
            e.target.value = ''; 
        });

        // Sidebar Theme Toggle

        document.querySelector('[data-action="install-pwa"]').addEventListener('click', (e) => {
            e.preventDefault();
            this.promptInstall();
        });

        // Saved Scripts List
        const openMenuToggle = document.getElementById('mobile-open-menu-toggle');
        openMenuToggle.onclick = (e) => {
            e.preventDefault();
            const menu = document.getElementById('mobile-open-menu');
            menu.classList.toggle('hidden');
            if(!menu.classList.contains('hidden')) this.populateScriptList();
        };

        // Backup/Export Menu
        const backupMenuToggle = document.getElementById('mobile-backup-menu-toggle');
        backupMenuToggle.onclick = (e) => {
             e.preventDefault();
             document.getElementById('mobile-backup-menu').classList.toggle('hidden');
        };
        
        const backupMenu = document.getElementById('mobile-backup-menu');
        backupMenu.querySelector('[data-action="download-json"]').onclick = () => this.downloadJSON();
        backupMenu.querySelector('[data-action="download-fdx"]').onclick = () => this.downloadFDX();
        backupMenu.querySelector('[data-action="download-fountain"]').onclick = () => this.downloadFountain();
        backupMenu.querySelector('[data-action="download-text"]').onclick = () => this.downloadText();

        window.addEventListener('resize', () => {
            if (this.pageViewActive) this.updatePageScale();
        });
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

    async loadScript(scriptId) {
        const loader = document.getElementById('app-loader');
        if (loader) loader.classList.remove('fade-out');

        setTimeout(async () => {
            let script = await this.storageManager.getScript(scriptId);
            
            // Fallback if script not found or deleted
            if (!script) {
                // If the requested ID is invalid, try to find ANY script
                const allScripts = await this.storageManager.getAllScripts();
                const ids = Object.keys(allScripts);
                if (ids.length > 0) {
                    scriptId = ids[0];
                    script = allScripts[scriptId];
                } else {
                    // Create a new blank script if absolutely nothing exists
                    const newScript = this.storageManager.createNewScript();
                    delete newScript.isNew;
                    await this.storageManager.saveScript(newScript.id, newScript.content); 
                    script = newScript;
                    scriptId = newScript.id;
                }
            }

            this.activeScriptId = scriptId;
            this.storageManager.setActiveScriptId(scriptId);
            
            const content = script.content;
            if (content.meta) this.meta = { ...this.meta, ...content.meta };
            else this.meta = { title: '', author: '', contact: '', showTitlePage: true, showSceneNumbers: false, showDate: false };

            if (content.sceneMeta) this.sceneMeta = content.sceneMeta;
            else this.sceneMeta = {};

            if (content.characters) this.characters = new Set(content.characters);
            
            this.renderInfiniteView(content.blocks || []);
            this.updateTitle();
            this.populateSceneList();
            await this.populateScriptList(); // Refresh list to show active
            
            if (loader) loader.classList.add('fade-out');
        }, 50);
    }

    renderInfiniteView(blocks) {
        this.editor.innerHTML = '';
        this.editor.style.display = 'block';
        this.pageViewContainer.classList.add('hidden');
        this.pageViewActive = false;
        document.getElementById('page-view-btn').classList.remove('active');

        const frag = document.createDocumentFragment();
        
        blocks.forEach(block => {
            const div = document.createElement('div');
            div.className = `script-line ${block.type}`;
            div.dataset.lineId = block.id;
            div.textContent = block.text;
            frag.appendChild(div);
        });
        
        this.editor.appendChild(frag);
    }
    
    updatePageScale() {
        const pageWidth = 816; // 8.5in * 96dpi
        const screenWidth = window.innerWidth;
        
        // Only scale if screen is smaller than page
        if (screenWidth < pageWidth) {
            const scale = (screenWidth) / pageWidth; 
            // Use a slightly smaller scale to ensure edges are not cut off by potential browser chrome or scrollbars
            const scaleWithBuffer = (screenWidth - 4) / pageWidth;
            this.pageViewContainer.style.transform = `scale(${scaleWithBuffer})`;
            
            const margin = (screenWidth - (pageWidth * scaleWithBuffer)) / 2;
            this.pageViewContainer.style.marginLeft = `${margin}px`;
        } else {
            this.pageViewContainer.style.transform = '';
            this.pageViewContainer.style.marginLeft = '';
             this.pageViewContainer.style.margin = '0 auto';
        }
    }

    getCurrentScrollElement() {
        // Find the first visible element in the current view
        const container = this.pageViewActive ? this.pageViewContainer : this.editor;
        // On mobile, page view is inside a container that might not be the scroller itself if scale is applied?
        // Actually #scroll-area is the scroller for both.
        const scrollArea = document.getElementById('scroll-area');
        const scrollRect = scrollArea.getBoundingClientRect();
        
        // We look for elements within the container
        const elements = container.querySelectorAll('.script-line');
        for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom > scrollRect.top && rect.top < scrollRect.bottom) {
                return el.dataset.lineId;
            }
        }
        return null;
    }

    restoreScrollToElement(lineId) {
        if (!lineId) return;
        const container = this.pageViewActive ? this.pageViewContainer : this.editor;
        const target = container.querySelector(`[data-line-id="${lineId}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
    }

    togglePageView() {
        const currentLineId = this.getCurrentScrollElement();

        this.pageViewActive = !this.pageViewActive;
        const btn = document.getElementById('page-view-btn');
        btn.classList.toggle('active', this.pageViewActive);
        document.getElementById('app-container').classList.toggle('page-view-active', this.pageViewActive);
        
        if (this.pageViewActive) {
            this.editor.style.display = 'none';
            this.pageViewContainer.classList.remove('hidden');
            this.pageViewContainer.style.display = 'block'; // Ensure visibility for measurement
            this.renderPageView();
            this.updatePageScale();
        } else {
            this.pageViewContainer.classList.add('hidden');
            this.pageViewContainer.style.display = ''; // Reset inline style
            this.editor.style.display = 'block';
            this.pageViewContainer.style.transform = '';
            this.pageViewContainer.style.marginLeft = '';
        }
        
        if (currentLineId) {
            // Short timeout to allow layout to update (especially with scale)
            setTimeout(() => this.restoreScrollToElement(currentLineId), 10);
        }

        this.sidebar.classList.remove('open');
        document.getElementById('menu-overlay').classList.remove('active');
    }

    renderPageView() {
        const scriptLines = Array.from(this.editor.querySelectorAll('.script-line'));
        if (scriptLines.length === 0) return;
        
        // Ensure container is visible for measurement
        if (this.pageViewContainer.offsetParent === null) {
             this.pageViewContainer.classList.remove('hidden');
             this.pageViewContainer.style.display = 'block';
        }
        
        const options = {
            showSceneNumbers: true, // Always show on mobile page view for clarity, or can link to meta
            showPageNumbers: true,
            headerText: this.getHeaderText()
        };
        
        this.pageRenderer.render(scriptLines, this.pageViewContainer, options);
    }

    populateSceneList() {
        const list = document.getElementById('scene-list');
        list.innerHTML = '';
        const slugs = this.editor.querySelectorAll(`.${constants.ELEMENT_TYPES.SLUG}`);
        let index = 1;
        
        slugs.forEach(slug => {
            const text = slug.textContent.trim() || 'UNTITLED';
            const sceneId = slug.dataset.lineId;
            const meta = this.sceneMeta[sceneId] || {};
            
            const item = document.createElement('div');
            item.className = 'scene-item';
            
            const colorClass = meta.color || '';
            const iconHtml = meta.icon ? `<i class="${meta.icon} fa-fw"></i>` : '';
            const hasTrack = !!meta.track;
            const italicStyle = hasTrack ? 'font-style: italic;' : '';

            // Add color class
            if (colorClass) item.classList.add(colorClass);

            item.innerHTML = `
                <div class="scene-grid-layout" style="padding: 0.5rem;">
                    <span class="scene-grid-number">${index}.</span>
                    <span class="scene-grid-icon">${iconHtml}</span>
                    <span class="scene-grid-title truncate" style="${italicStyle}">${text}</span>
                    <div class="scene-grid-meta"></div>
                </div>
            `;
            
            item.onclick = () => {
                this.scrollToScene(sceneId);
                this.toggleSidebar();
            };
            
            list.appendChild(item);
            index++;
        });
    }

    async populateScriptList() {
        const container = document.getElementById('mobile-saved-scripts-list');
        container.innerHTML = '';
        const scripts = await this.storageManager.getAllScripts();
        const scriptIds = Object.keys(scripts);

        if (scriptIds.length === 0) {
            container.innerHTML = '<span class="dropdown-item">No saved scripts.</span>';
            return;
        }

        scriptIds.forEach(id => {
            const script = scripts[id];
            const title = script.content?.meta?.title || new Date(script.lastSavedAt).toLocaleString();
            const isActive = id === this.activeScriptId;
            
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.textContent = title + (isActive ? ' (Open)' : '');
            
            if(isActive) item.style.fontWeight = 'bold';
            else item.onclick = () => {
                this.loadScript(id);
                this.toggleSidebar();
            };
            
            container.appendChild(item);
        });
    }

    scrollToScene(sceneId) {
        if (!sceneId) return;
        const container = this.pageViewActive ? this.pageViewContainer : this.editor;
        const target = container.querySelector(`[data-line-id="${sceneId}"]`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    toggleSidebar() {
        const sidebar = this.sidebar;
        const overlay = document.getElementById('menu-overlay');
        const isOpen = sidebar.classList.toggle('open');
        overlay.classList.toggle('active', isOpen);
        
    }
    
    updateTitle() {
        const titleEl = document.getElementById('script-title-header');
        if(titleEl) titleEl.textContent = this.meta.title || 'UNTITLED';
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
            window.deferredInstallPrompt = null; // Clear the prompt
            
            const installBtn = document.getElementById('install-pwa-btn');
            if(installBtn) installBtn.classList.add('hidden');
            
            const mobileInstallBtn = document.querySelector('[data-action="install-pwa"]');
            if(mobileInstallBtn) mobileInstallBtn.classList.add('hidden');
        });
    }

    async handleFileUpload(fileName, fileText) {
        try {
            if (fileName.endsWith('.fdx')) {
                await this.importFDX(fileText);
            } else {
                await this.importJSON(JSON.parse(fileText));
            }
        } catch (e) {
            alert("Error reading file: " + e.message);
        }
    }

    // IMPORTS (Saves to DB)
    async importJSON(data) {
        if (!data.blocks) return; 
        
        // Create new script entry
        const newScript = this.storageManager.createNewScript();
        newScript.content.blocks = data.blocks;
        if (data.meta) newScript.content.meta = { ...newScript.content.meta, ...data.meta };
        if (data.sceneMeta) newScript.content.sceneMeta = data.sceneMeta;
        if (data.characters) newScript.content.characters = data.characters;
        
        delete newScript.isNew;
        await this.storageManager.saveScript(newScript.id, newScript.content);
        await this.loadScript(newScript.id);
    }

    async importFDX(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const mainContent = xmlDoc.querySelector('FinalDraft > Content');
        if (!mainContent) { alert("No script content found in FDX."); return; }
        
        const paragraphs = mainContent.querySelectorAll("Paragraph");
        const blocks = [];
        const chars = new Set();
        
        // Map FDX to Blocks
        paragraphs.forEach(p => {
            const type = p.getAttribute("Type");
            let text = Array.from(p.getElementsByTagName("Text")).map(t => t.textContent).join('');
            if (!text && p.textContent) text = p.textContent;
            
            const dzType = constants.FDX_REVERSE_MAP[type] || constants.ELEMENT_TYPES.ACTION;
            blocks.push({
                type: dzType,
                text: text,
                id: `line-${Math.random().toString(36).substring(2, 11)}`
            });
            
            if (dzType === constants.ELEMENT_TYPES.CHARACTER) {
                const clean = text.trim().toUpperCase().replace(/\s*\([^)]*\)$/, '').trim();
                if (clean.length > 1) chars.add(clean);
            }
        });

        // Save
        const newScript = this.storageManager.createNewScript();
        newScript.content.blocks = blocks;
        newScript.content.characters = Array.from(chars);
        const title = xmlDoc.querySelector('Title') ? xmlDoc.querySelector('Title').textContent : ''; 
        if(title) newScript.content.meta.title = title;

        delete newScript.isNew;
        await this.storageManager.saveScript(newScript.id, newScript.content);
        await this.loadScript(newScript.id);
    }

    // EXPORTS
    async downloadJSON() {
        const script = await this.storageManager.getScript(this.activeScriptId);
        if(!script) return;
        const blob = new Blob([JSON.stringify(script.content, null, 2)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.meta.title || 'script'}.json`;
        a.click();
    }
    
    async downloadText() {
        const script = await this.storageManager.getScript(this.activeScriptId);
        if(!script || !script.content.blocks) return;

        let txt = [];
        script.content.blocks.forEach(block => {
            const text = block.text;
            const type = block.type; 
            if (type === constants.ELEMENT_TYPES.SLUG) txt.push('\n' + text.toUpperCase());
            else if (type === constants.ELEMENT_TYPES.CHARACTER) txt.push('\n' + text.toUpperCase());
            else if (type === constants.ELEMENT_TYPES.TRANSITION) txt.push('\n' + text.toUpperCase());
            else txt.push(text);
        });
        const blob = new Blob([txt.join('\n')], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.meta.title || 'script'}.txt`;
        a.click();
    }

    async downloadFDX() {
        const script = await this.storageManager.getScript(this.activeScriptId);
        if(!script || !script.content.blocks) return;

        let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<FinalDraft DocumentType="Script" Template="No" Version="1">\n<Content>\n`;
        script.content.blocks.forEach(block => {
             let fdxType = constants.FDX_MAP[block.type] || 'Action';
             const text = block.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
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
         const script = await this.storageManager.getScript(this.activeScriptId);
         if(!script || !script.content.blocks) return;

         let txt = [];
         txt.push(`Title: ${this.meta.title}`);
         txt.push(`Author: ${this.meta.author}`);
         txt.push('\n');
         
         script.content.blocks.forEach(block => {
            const text = block.text;
            if (block.type === constants.ELEMENT_TYPES.SLUG) txt.push('\n' + text.toUpperCase());
            else if (block.type === constants.ELEMENT_TYPES.CHARACTER) txt.push('\n' + text.toUpperCase());
            else if (block.type === constants.ELEMENT_TYPES.TRANSITION) txt.push('\n> ' + text.toUpperCase());
            else txt.push(text);
        });
        const blob = new Blob([txt.join('\n')], {type: 'text/plain'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.meta.title || 'script'}.fountain`;
        a.click();
    }
}