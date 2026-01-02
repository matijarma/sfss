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