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
                sides: 'single',
                showMeta: true,
                showImages: true,
                showScript: true,
                showStats: true,
                showMusic: true,
                showCharacters: true
            },
            report: {
                type: 'script',
                character: '',
                includeDialogues: true,
                includeScenes: false
            }
        };

        this.renderTimeout = null;
        this.tempImageUrls = [];
        this.globalThumbGeometry = null;
        this.measureSandbox = this.createMeasurementSandbox();
        this.lastPreview = null;
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('print-prep-close-btn')?.addEventListener('click', () => this.close());
        document.getElementById('print-prep-cancel-btn')?.addEventListener('click', () => this.close());
        document.getElementById('print-prep-print-btn')?.addEventListener('click', () => this.print());
        const reportRefreshBtn = document.getElementById('print-report-refresh-btn');
        if (reportRefreshBtn) {
            reportRefreshBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.syncReportCharacterSelect();
                this.scheduleRender(0);
            });
        }

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

        this.controls.addEventListener('click', (e) => {
            const btn = e.target.closest('.print-toggle');
            if (!btn || btn.disabled || btn.classList.contains('disabled')) return;
            const section = btn.dataset.section;
            const key = btn.dataset.key;
            const value = btn.dataset.value;
            if (!section || !key || value === undefined) return;
            if (this.config[section]) {
                this.config[section][key] = value;
                const hidden = this.controls.querySelector(`.print-config-input[data-section="${section}"][data-key="${key}"]`);
                if (hidden) hidden.value = value;
                if (section === 'treatment') this.enforceTreatmentConstraints();
                this.syncUI();
                this.scheduleRender(50);
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
        this.enforceTreatmentConstraints();
        this.syncUI();
    }

    enforceTreatmentConstraints() {
        const t = this.config.treatment;
        if (!t) return;
        if (!t.sides) t.sides = 'single';

        if (t.layout === 'booklet') {
            t.orientation = 'landscape';
            t.sides = 'double';
        } else if (t.layout === 'facing') {
            t.sides = 'double';
        }
    }

    open() {
        this.config.script.showSceneNumbers = this.app.meta.showSceneNumbers || false;
        this.config.script.showDate = this.app.meta.showDate || false;
        this.enforceTreatmentConstraints();
        this.syncReportCharacterSelect();
        this.syncUI();
        this.modal.classList.remove('hidden');
        this.setMode(this.mode); 
        this.scheduleRender(50);
    }

    close() {
        this.modal.classList.add('hidden');
    }

    openReportMode(options = {}) {
        if (options.type) this.config.report.type = options.type;
        if (options.character !== undefined) this.config.report.character = options.character;
        if (options.includeDialogues !== undefined) this.config.report.includeDialogues = !!options.includeDialogues;
        if (options.includeScenes !== undefined) this.config.report.includeScenes = !!options.includeScenes;
        this.syncReportCharacterSelect();
        this.syncUI();
        this.modal.classList.remove('hidden');
        this.setMode('report');
        this.scheduleRender(30);
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
        document.getElementById('print-config-report').classList.toggle('hidden', mode !== 'report');
        const modeBtns = this.controls.querySelectorAll('.toggle-btn[data-mode]');
        modeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
        if (mode === 'report') this.syncReportCharacterSelect();
        this.scheduleRender(0);
    }

    syncUI() {
        for (const section of ['script', 'treatment', 'report']) {
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
        this.syncToggleGroups();
        this.syncReportCharacterSelect();
    }

    scheduleRender(delay = 100) {
        if (this.renderTimeout) clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => this.renderPreview(), delay);
    }

    syncToggleGroups() {
        const t = this.config.treatment;
        if (!t) return;
        const layoutAllowed = new Set(['normal', 'facing', 'booklet']);
        const orientationAllowed = t.layout === 'booklet' ? new Set(['landscape']) : new Set(['portrait', 'landscape']);
        const sidesAllowed = (t.layout === 'booklet' || t.layout === 'facing') ? new Set(['double']) : new Set(['single', 'double']);

        this.syncToggleGroup('treatment', 'layout', t.layout, layoutAllowed);
        this.syncToggleGroup('treatment', 'orientation', t.orientation, orientationAllowed);
        this.syncToggleGroup('treatment', 'sides', t.sides, sidesAllowed);
    }

    syncToggleGroup(section, key, activeValue, allowedSet = null) {
        const buttons = this.controls.querySelectorAll(`.print-toggle[data-section="${section}"][data-key="${key}"]`);
        buttons.forEach(btn => {
            const value = btn.dataset.value;
            const allowed = !allowedSet || allowedSet.has(value);
            btn.disabled = !allowed;
            btn.classList.toggle('disabled', !allowed);
            btn.classList.toggle('active', value === activeValue);
        });
        const hidden = this.controls.querySelector(`.print-config-input[data-section="${section}"][data-key="${key}"]`);
        if (hidden) hidden.value = activeValue;
    }

    syncReportCharacterSelect() {
        const type = this.config.report?.type || 'script';
        const typeBtns = this.controls.querySelectorAll('.print-toggle[data-section="report"][data-key="type"]');
        typeBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.value === type));

        const select = this.controls.querySelector('.print-config-select[data-section="report"][data-key="character"]');
        const row = document.getElementById('print-report-character-row');
        const modeRow = document.getElementById('print-report-character-mode-row');
        if (!select || !row) return;

        const characters = Array.from(this.app.characters || []).sort();
        const prev = this.config.report.character;
        select.innerHTML = '';
        characters.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        });

        if (type !== 'character' || characters.length === 0) {
            row.classList.add('hidden');
            this.config.report.character = characters[0] || '';
            if (modeRow) modeRow.classList.add('hidden');
        } else {
            row.classList.remove('hidden');
            if (prev && characters.includes(prev)) {
                select.value = prev;
            } else {
                select.value = characters[0] || '';
            }
            this.config.report.character = select.value;
            if (modeRow) modeRow.classList.remove('hidden');
        }
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
        this.globalThumbGeometry = null;

        // 1. Generate Logical Pages
        const { logicalPages, finalSheets } = await this.buildSheetsForMode(this.mode);

        finalSheets.forEach(sheet => this.previewContainer.appendChild(sheet));
        
        const count = logicalPages.length;
        const sheets = finalSheets.length;
        this.statsEl.textContent = `${count} Pages • ${sheets} Sheet${sheets !== 1 ? 's' : ''}`;

        this.previewContainer.style.opacity = '1';
        this.updatePreviewScale();
        this.lastPreview = { mode: this.mode, logicalPages, finalSheets };

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

    // --- TREATMENT GENERATION (Strict Fit) ---
    async generateTreatmentPages() {
        this.enforceTreatmentConstraints();
        this.globalThumbGeometry = null;
        const data = this.app.scriptData || this.app.exportToJSONStructure();
        if (!data.blocks) return [];

        const includeScript = !!this.config.treatment.showScript;
        const scriptPages = includeScript ? await this.generateScreenplayPages() : [];
        const scenePageMap = includeScript ? this.mapScenesToPages(data.blocks, scriptPages) : new Map();
        const scenes = this.buildTreatmentScenes(data.blocks, scenePageMap, includeScript);

        const isLandscape = this.config.treatment.orientation === 'landscape';
        const profile = this.getTreatmentProfile(this.config.treatment.layout, isLandscape, this.config.treatment.sides);
        this.applyTreatmentVariables(profile);

        const pages = [];
        pages.push(this.createOverviewPage(scenes, profile, scriptPages.length));
        if (profile.sides === 'double') {
            pages.push(this.createBlankTreatmentPage(profile));
        }
        if (profile.layout === 'facing') {
            pages.push(this.createSecondaryTitlePage(profile));
        }

        for (const scene of scenes) {
            const galleryImgs = await this.loadSceneImages(scene.meta);
            const sceneScriptPages = scenePageMap.get(scene.id) || [];
            const scenePages = await this.buildStrictScenePages(scene, galleryImgs, sceneScriptPages, profile);
            pages.push(...scenePages);
        }

        return pages;
    }

    async generateReportPages() {
        const profile = this.getTreatmentProfile('normal', false, 'single');
        this.applyTreatmentVariables(profile);
        const report = this.app.reportsManager.buildPrintableReport(
            this.config.report.type,
            { 
                character: this.config.report.character, 
                includeDialogues: this.config.report.includeDialogues,
                includeScenes: this.config.report.includeScenes
            }
        );

        const wrapper = document.createElement('div');
        wrapper.innerHTML = report?.html || '';
        let root = wrapper.querySelector('.report-container') || wrapper;
        let sections = Array.from(root.children).filter(Boolean);
        if (sections.length === 0) {
            sections = [this.createReportPlaceholder(report?.message || 'No report data available.')];
        }

        let pages = this.layoutReportSections(sections, profile, report?.title || 'Report', report?.subtitle || '');

        if (report?.includeDialogues && report.dialogueData?.length) {
            pages = pages.concat(this.createDialoguePages(report.dialogueData));
        }

        if (report?.includeScenes && report.sceneIds?.length) {
            const data = this.app.scriptData || this.app.exportToJSONStructure();
            const scriptPages = await this.generateScreenplayPages();
            const scenePageMap = this.mapScenesToPages(data.blocks || [], scriptPages);
            const pageSet = new Map();
            report.sceneIds.forEach(id => {
                const pagesForScene = scenePageMap.get(id) || [];
                pagesForScene.forEach(pg => {
                    const num = parseInt(pg.dataset.pageNumber || '0', 10) || pagesForScene.indexOf(pg);
                    if (!pageSet.has(num)) pageSet.set(num, pg);
                });
            });
            const ordered = Array.from(pageSet.entries()).sort((a,b) => a[0]-b[0]).map(([,pg]) => pg.cloneNode(true));
            pages = pages.concat(ordered);
        }

        return pages;
    }

    applyTreatmentVariables(profile) {
        const targets = [
            document.documentElement,
            this.previewContainer,
            document.getElementById('printingdiv')
        ].filter(Boolean);

        targets.forEach(node => {
            node.style.setProperty('--treat-page-width', `${profile.pageWidthIn}in`);
            node.style.setProperty('--treat-page-height', `${profile.pageHeightIn}in`);
            node.style.setProperty('--treat-page-padding', `${profile.paddingIn}in`);
            node.style.setProperty('--treat-section-gap', `${profile.sectionGapPx}px`);
            node.style.setProperty('--treat-visual-floor', `${profile.visualFloorPx}px`);
            node.style.setProperty('--treat-column-gap', `${profile.columnGapPx}px`);
            node.style.setProperty('--page-width', `${profile.pageWidthIn}in`);
            node.style.setProperty('--page-height', `${profile.pageHeightIn}in`);
        });
    }

    createOverviewPage(scenes, profile, totalScriptPages = 0) {
        const page = document.createElement('div');
        page.className = 'treatment-print-page treatment-overview strict-fit-page';
        if (profile?.isBooklet) page.classList.add('booklet-treatment');
        if (profile?.isLandscape) page.classList.add('landscape');
        if (profile) {
            page.style.width = `${profile.pageWidthIn}in`;
            page.style.height = `${profile.pageHeightIn}in`;
            page.style.padding = `${profile.paddingIn}in`;
        }

        const title = (this.app.meta.title || 'Untitled Screenplay').toUpperCase();
        const author = this.app.meta.author || '';
        
        const header = document.createElement('div');
        header.className = 'overview-header';
        header.innerHTML = `
            <div class="overview-title">${title}</div>
            <div class="overview-author">${author ? `by ${author}` : ''}</div>
            <div class="overview-date">${new Date().toLocaleDateString()}</div>
        `;
        page.appendChild(header);

        const summary = document.createElement('div');
        summary.className = 'scene-chip-row overview-chips';
        const totalEighths = scenes.reduce((sum, s) => sum + (s.eighths || 0), 0);
        const totalPages = Math.max(1, Math.ceil(totalEighths / 8));
        const remainder = totalEighths % 8;

        summary.appendChild(this.createMetaChip('Scenes', scenes.length));
        if (Number.isFinite(totalScriptPages)) summary.appendChild(this.createMetaChip('Script Pages', totalScriptPages));
        summary.appendChild(this.createMetaChip('Length', remainder ? `${totalPages} pg ${remainder}/8` : `${totalPages} pg`));
        page.appendChild(summary);

        const grid = document.createElement('div');
        grid.className = 'index-grid strict-index-grid compact-index';
        const cols = profile?.isLandscape ? 3 : 2;
        grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;

        scenes.forEach(scene => {
            const row = document.createElement('div');
            row.className = 'index-row compact';
            row.innerHTML = `
                <div class="index-num">${scene.number}.</div>
                <div class="index-title" title="${scene.slugText}">${(scene.slugText || 'Untitled').toUpperCase()}</div>
                <div class="index-meta">${scene.lengthLabel || scene.pageRange || '-'}</div>
            `;
            grid.appendChild(row);
        });

        page.appendChild(grid);
        return page;
    }

    createSecondaryTitlePage(profile) {
        const page = document.createElement('div');
        page.className = 'treatment-print-page strict-fit-page secondary-title';
        if (profile?.isBooklet) page.classList.add('booklet-treatment');
        if (profile?.isLandscape) page.classList.add('landscape');
        page.style.width = `${profile.pageWidthIn}in`;
        page.style.height = `${profile.pageHeightIn}in`;
        page.style.padding = `${profile.paddingIn}in`;

        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        wrap.style.height = '100%';
        wrap.style.gap = '0.2in';

        const title = document.createElement('div');
        title.className = 'overview-title';
        title.textContent = (this.app.meta.title || 'Untitled Screenplay').toUpperCase();

        const sub = document.createElement('div');
        sub.className = 'overview-author';
        sub.textContent = this.app.meta.author || '';

        wrap.appendChild(title);
        if (sub.textContent) wrap.appendChild(sub);
        page.appendChild(wrap);
        return page;
    }

    createBlankTreatmentPage(profile) {
        const page = document.createElement('div');
        page.className = 'treatment-print-page strict-fit-page blank-treatment';
        page.style.width = `${profile.pageWidthIn}in`;
        page.style.height = `${profile.pageHeightIn}in`;
        page.style.padding = `${profile.paddingIn}in`;
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
            const excerpt = ''; // script excerpts removed for print cards

            scenes.push({
                id: current.slug.id,
                number: meta.number || scenes.length + 1,
                slugText: (current.slug.text || '').trim() || 'UNTITLED SCENE',
                slugParts,
                meta,
                pageRange,
                eighths,
                durationLabel: '',
                lengthLabel: this.formatEighthsLabel(eighths),
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

    getTreatmentProfile(layout, isLandscape, sides = 'single') {
        const inch = 96;
        const pageWidthIn = layout === 'booklet' ? 5.5 : (isLandscape ? 11 : 8.5);
        const pageHeightIn = layout === 'booklet' ? 8.5 : (isLandscape ? 8.5 : 11);
        const paddingIn = layout === 'booklet' ? 0.55 : 0.7;
        const sectionGapPx = layout === 'booklet' ? 10 : 14;

        let visualRatio = 0.3;
        if (layout === 'facing') visualRatio = isLandscape ? 0.48 : 0.52;
        else if (layout === 'normal' && isLandscape) visualRatio = 0.42;
        else if (layout === 'normal' && sides === 'double') visualRatio = 0.25;

        const minVisualPx = layout === 'booklet' ? 160 : 220;
        const visualFloorPx = Math.max(minVisualPx, Math.round(pageHeightIn * inch * visualRatio));
        const pageWidthPx = Math.round(pageWidthIn * inch);
        const pageHeightPx = Math.round(pageHeightIn * inch);
        const paddingPx = Math.round(paddingIn * inch);

        return {
            layout,
            isFacing: layout === 'facing',
            isBooklet: layout === 'booklet',
            isLandscape,
            orientation: isLandscape ? 'landscape' : 'portrait',
            pageWidthIn,
            pageHeightIn,
            pageWidthPx,
            pageHeightPx,
            paddingIn,
            paddingPx,
            sectionGapPx,
            columnGapPx: sectionGapPx,
            visualFloorPx,
            sides,
            thumbBase: { width: 8.5 * inch, height: 11 * inch }
        };
    }

    async buildStrictScenePages(scene, galleryImgs, scriptPages, profile) {
        const textContent = this.composeSceneText(scene);
        if (profile.layout === 'facing') {
            return this.buildFacingSpread(scene, textContent, galleryImgs, scriptPages, profile);
        }
        if (profile.layout === 'booklet') {
            const page = await this.buildPortraitStack(scene, textContent, galleryImgs, scriptPages, profile);
            return [page];
        }
        if (profile.layout === 'normal' && profile.sides === 'double') {
            return this.buildNormalDoubleSpread(scene, textContent, galleryImgs, scriptPages, profile);
        }
        if (profile.isLandscape) {
            const page = await this.buildLandscapeSpread(scene, textContent, galleryImgs, scriptPages, profile);
            return [page];
        }
        const page = await this.buildPortraitStack(scene, textContent, galleryImgs, scriptPages, profile);
        return [page];
    }

    composeSceneText(scene) {
        if (!this.config.treatment.showMeta) return '';
        const parts = [];
        if (scene.description) parts.push(scene.description.trim());
        if (scene.notes) parts.push(`Notes: ${scene.notes.trim()}`);
        return parts.filter(Boolean).join('\n\n');
    }

    async buildPortraitStack(scene, textContent, images, scriptPages, profile, options = {}) {
        const { page, body } = this.createTreatmentPageShell(scene, profile);

        const statsBlock = this.buildStatsSection(scene);
        const contentZone = document.createElement('div');
        contentZone.className = 'strict-zone';
        contentZone.style.display = 'flex';
        contentZone.style.flexDirection = 'column';
        contentZone.style.flex = '1';
        contentZone.style.minHeight = '0';
        contentZone.style.gap = `${profile.sectionGapPx}px`;

        const textSection = this.createSection('Synopsis & Notes', '');
        textSection.classList.add('strict-text-slot');

        const visualStruct = this.createVisualSection(profile);
        const visualSection = visualStruct.section;
        const visualGrid = visualStruct.grid;

        if (statsBlock) body.appendChild(statsBlock);
        body.appendChild(contentZone);
        if (this.config.treatment.showMeta && textContent) contentZone.appendChild(textSection);
        contentZone.appendChild(visualSection);

        this.measureSandbox.appendChild(page);

        const textBody = textSection.querySelector('.section-body');
        const textWidth = textBody.clientWidth || (profile.pageWidthPx - profile.paddingPx * 2);
        const contentHeight = contentZone.clientHeight;
        const textMaxHeight = Math.max(0, contentHeight - profile.visualFloorPx - profile.sectionGapPx);

        let textBlockHeight = 0;
        if (this.config.treatment.showMeta && textContent) {
            const clamped = this.clampTextToHeight(textContent, textWidth, textMaxHeight);
            textBody.textContent = clamped.text || ' ';
            textBody.style.maxHeight = `${textMaxHeight}px`;
            textBody.style.minHeight = `${clamped.height}px`;
            textBlockHeight = clamped.height;
        } else {
            textSection.remove();
        }

        const visualsHeight = Math.max(profile.visualFloorPx, contentHeight - textBlockHeight - profile.sectionGapPx);
        visualSection.style.height = `${visualsHeight}px`;
        const rendered = this.populateVisualGrid(
            visualGrid,
            options.imagesOnly ? images : images,
            options.thumbsOnly ? scriptPages : scriptPages,
            visualsHeight,
            profile
        );
        if (!rendered) {
            visualSection.remove();
        } else {
            visualSection.style.setProperty('--visual-container-height', `${visualsHeight}px`);
        }

        this.measureSandbox.removeChild(page);
        return page;
    }

    async buildLandscapeSpread(scene, textContent, images, scriptPages, profile, options = {}) {
        const { page, body } = this.createTreatmentPageShell(scene, profile);

        const grid = document.createElement('div');
        grid.className = 'treatment-body-grid strict-landscape';
        grid.style.columnGap = `${profile.columnGapPx}px`;
        grid.style.flex = '1';
        grid.style.minHeight = '0';
        grid.style.height = '100%';
        body.appendChild(grid);

        const leftCol = document.createElement('div');
        leftCol.className = 'treatment-column strict-column';
        const rightCol = document.createElement('div');
        rightCol.className = 'treatment-column strict-column';
        grid.appendChild(leftCol);
        grid.appendChild(rightCol);

        const statsBlock = this.buildStatsSection(scene);
        if (statsBlock) leftCol.appendChild(statsBlock);

        const textSection = this.createSection('Synopsis & Notes', '');
        textSection.classList.add('strict-text-slot');
        if (this.config.treatment.showMeta && textContent) leftCol.appendChild(textSection);

        const visualStruct = this.createVisualSection(profile);
        const visualSection = visualStruct.section;
        const visualGrid = visualStruct.grid;
        rightCol.appendChild(visualSection);

        this.measureSandbox.appendChild(page);

        const textBody = textSection.querySelector('.section-body');
        const textWidth = textBody.clientWidth || (profile.pageWidthPx / 2);
        const textMaxHeight = Math.max(0, leftCol.clientHeight - (statsBlock ? statsBlock.offsetHeight + profile.sectionGapPx : 0));
        if (this.config.treatment.showMeta && textContent) {
            const clamped = this.clampTextToHeight(textContent, textWidth, textMaxHeight);
            textBody.textContent = clamped.text || ' ';
            textBody.style.maxHeight = `${textMaxHeight}px`;
            textBody.style.minHeight = `${Math.min(clamped.height, textMaxHeight)}px`;
        } else {
            textSection.remove();
        }

        const visualsHeight = rightCol.clientHeight;
        visualSection.style.height = `${visualsHeight}px`;
        const rendered = this.populateVisualGrid(
            visualGrid,
            options.imagesOnly ? images : images,
            options.thumbsOnly ? scriptPages : scriptPages,
            visualsHeight,
            profile
        );
        if (!rendered) {
            visualSection.remove();
        } else {
            visualSection.style.setProperty('--visual-container-height', `${visualsHeight}px`);
        }

        this.measureSandbox.removeChild(page);
        return page;
    }

    async buildNormalDoubleSpread(scene, textContent, images, scriptPages, profile) {
        const frontThumbs = scriptPages && scriptPages.length ? scriptPages : [];
        const frontImages = frontThumbs.length ? [] : images; // prefer thumbs on front
        const backImages = images && images.length ? images : [];

        const front = profile.isLandscape
            ? await this.buildLandscapeSpread(scene, textContent, frontImages, frontThumbs, profile, { thumbsOnly: frontThumbs.length > 0 })
            : await this.buildPortraitStack(scene, textContent, frontImages, frontThumbs, profile, { thumbsOnly: frontThumbs.length > 0 });
        front.dataset.side = 'front';

        const back = await this.buildBackInfoPage(scene, backImages, frontThumbs.length ? [] : scriptPages, profile);
        back.dataset.side = 'back';
        return [front, back];
    }

    async buildBackInfoPage(scene, images, scriptPages, profile) {
        const { page, body } = this.createTreatmentPageShell(scene, profile, { role: 'back', secondary: true });

        const galleryStruct = this.createVisualSection(profile);
        const gallerySection = galleryStruct.section;
        const galleryGrid = galleryStruct.grid;

        body.appendChild(gallerySection);

        this.measureSandbox.appendChild(page);

        const available = Math.max(profile.visualFloorPx, body.clientHeight);
        gallerySection.style.height = `${available}px`;
        gallerySection.style.setProperty('--visual-container-height', `${available}px`);
        const rendered = this.populateVisualGrid(galleryGrid, images, scriptPages, available, profile);
        if (!rendered) gallerySection.remove();

        this.measureSandbox.removeChild(page);
        return page;
    }

    async buildFacingSpread(scene, textContent, images, scriptPages, profile) {
        const left = await this.buildFacingTextPage(scene, textContent, profile);
        const right = await this.buildFacingVisualPage(scene, images, scriptPages, profile);
        left.dataset.facingRole = 'left';
        right.dataset.facingRole = 'right';
        left.classList.add('facing-page');
        right.classList.add('facing-page');
        return [left, right];
    }

    async buildFacingTextPage(scene, textContent, profile) {
        const { page, body } = this.createTreatmentPageShell(scene, profile, { role: 'left' });

        const statsBlock = this.buildStatsSection(scene);
        const textSection = this.createSection('Synopsis & Notes', '');
        textSection.classList.add('strict-text-slot');

        if (statsBlock) body.appendChild(statsBlock);
        body.appendChild(textSection);

        this.measureSandbox.appendChild(page);

        const textBody = textSection.querySelector('.section-body');
        const textWidth = textBody.clientWidth || (profile.pageWidthPx - profile.paddingPx * 2);
        const availableHeight = Math.max(0, body.clientHeight - (statsBlock ? statsBlock.offsetHeight + profile.sectionGapPx : 0));
        const clamped = this.clampTextToHeight(textContent, textWidth, availableHeight);
        textBody.textContent = clamped.text || ' ';
        textBody.style.maxHeight = `${availableHeight}px`;
        textBody.style.minHeight = `${Math.min(availableHeight, clamped.height)}px`;

        this.measureSandbox.removeChild(page);
        return page;
    }

    async buildFacingVisualPage(scene, images, scriptPages, profile) {
        const { page, body } = this.createTreatmentPageShell(scene, profile, { role: 'right' });

        const visualStruct = this.createVisualSection(profile, 'Visuals');
        const visualSection = visualStruct.section;
        const visualGrid = visualStruct.grid;
        body.appendChild(visualSection);

        this.measureSandbox.appendChild(page);

        const visualsHeight = body.clientHeight;
        visualSection.style.height = `${visualsHeight}px`;
        visualSection.style.setProperty('--visual-container-height', `${visualsHeight}px`);
        this.populateVisualGrid(visualGrid, images, scriptPages, visualsHeight, profile);

        this.measureSandbox.removeChild(page);
        return page;
    }

    createVisualSection(profile) {
        const section = document.createElement('div');
        section.className = 'strict-visual-slot';
        const body = document.createElement('div');
        body.className = 'visual-body';
        section.appendChild(body);

        const grid = document.createElement('div');
        grid.className = 'strict-visual-grid';
        grid.style.minHeight = `${profile.visualFloorPx}px`;
        body.appendChild(grid);

        return { section, grid };
    }

    populateVisualGrid(grid, images, scriptPages, availableHeightPx, profile) {
        if (!grid) return false;

        grid.innerHTML = '';
        const visualItems = this.config.treatment.showImages && images ? images.slice() : [];
        const thumbItems = this.config.treatment.showScript && scriptPages ? scriptPages.slice() : [];
        let appended = false;

        if (visualItems.length === 0 && thumbItems.length === 0) {
            grid.style.display = 'none';
            grid.style.height = '0px';
            return false;
        }

        const gap = 8;
        const widthPx = grid.clientWidth || grid.parentElement?.clientWidth || (profile.pageWidthPx - profile.paddingPx * 2);
        const hasBoth = visualItems.length > 0 && thumbItems.length > 0;
        const imageHeight = hasBoth ? Math.floor(availableHeightPx * 0.65) : availableHeightPx;
        const thumbHeight = hasBoth ? Math.max(80, availableHeightPx - imageHeight - gap) : (thumbItems.length ? availableHeightPx : 0);

        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.gap = `${gap}px`;
        grid.style.height = `${availableHeightPx}px`;

        if (visualItems.length) {
            const imgGrid = this.buildImageGrid(visualItems, widthPx, imageHeight);
            if (imgGrid) {
                imgGrid.style.height = `${imageHeight}px`;
                grid.appendChild(imgGrid);
                appended = true;
            }
        }

        if (thumbItems.length && thumbHeight > 0) {
            const thumbGrid = this.buildThumbGrid(thumbItems, widthPx, thumbHeight, profile);
            if (thumbGrid) {
                thumbGrid.style.height = `${thumbHeight}px`;
                grid.appendChild(thumbGrid);
                appended = true;
            }
        }

        return appended;
    }

    buildThumbGrid(pages = [], widthPx, heightPx, profile) {
        if (!pages.length) return null;
        const baseW = profile.thumbBase.width;
        const baseH = profile.thumbBase.height;
        let geometry = this.calculateGrid(pages.length, widthPx, heightPx, 8, baseW / baseH);
        if (!this.globalThumbGeometry) {
            this.globalThumbGeometry = { cellWidth: geometry.cellWidth, cellHeight: geometry.cellHeight };
        } else {
            this.globalThumbGeometry.cellWidth = Math.min(this.globalThumbGeometry.cellWidth, geometry.cellWidth);
            this.globalThumbGeometry.cellHeight = Math.min(this.globalThumbGeometry.cellHeight, geometry.cellHeight);
        }

        const cellW = this.globalThumbGeometry.cellWidth;
        const cellH = this.globalThumbGeometry.cellHeight;
        const cols = Math.max(1, Math.floor((widthPx + 8) / (cellW + 8)));
        const rows = Math.ceil(pages.length / cols);

        const grid = document.createElement('div');
        grid.className = 'strict-thumb-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${cols}, ${cellW}px)`;
        grid.style.gridAutoRows = `${cellH}px`;
        grid.style.gap = '8px';
        grid.style.height = `${heightPx}px`;

        pages.forEach(pg => {
            const cell = document.createElement('div');
            cell.className = 'thumb';
            cell.style.width = `${cellW}px`;
            cell.style.height = `${cellH}px`;
            cell.appendChild(this.createThumbClone(pg, cellW, cellH, profile));
            grid.appendChild(cell);
        });

        return grid;
    }

    buildImageGrid(images = [], widthPx, heightPx) {
        if (!images.length) return null;
        const geometry = this.calculateGrid(images.length, widthPx, heightPx, 8);

        const grid = document.createElement('div');
        grid.className = 'strict-image-grid';
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = `repeat(${geometry.columns}, ${geometry.cellWidth}px)`;
        grid.style.gridAutoRows = `${geometry.cellHeight}px`;
        grid.style.gap = '8px';
        grid.style.height = `${heightPx}px`;

        images.forEach(url => {
            const cell = document.createElement('div');
            cell.className = 'visual-cell';
            cell.style.width = `${geometry.cellWidth}px`;
            cell.style.height = `${geometry.cellHeight}px`;
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Scene visual';
            img.loading = 'eager';
            img.decoding = 'sync';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            cell.appendChild(img);
            grid.appendChild(cell);
        });

        return grid;
    }

    createThumbClone(page, cellWidth, cellHeight, profile) {
        const wrap = document.createElement('div');
        wrap.className = 'thumb';
        wrap.style.width = `${cellWidth}px`;
        wrap.style.height = `${cellHeight}px`;

        const baseW = profile.thumbBase.width;
        const baseH = profile.thumbBase.height;
        const scale = Math.min(
            cellWidth / baseW,
            cellHeight / baseH
        );

        const clone = page.cloneNode(true);
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
        return wrap;
    }

    clampTextToHeight(text, widthPx, maxHeightPx) {
        if (!text || maxHeightPx <= 0 || widthPx <= 0) {
            return { text: '', height: 0, clamped: false };
        }

        const probe = document.createElement('div');
        probe.className = 'section-body measurement-probe';
        probe.style.width = `${widthPx}px`;
        probe.style.maxWidth = `${widthPx}px`;
        probe.style.maxHeight = `${maxHeightPx}px`;
        this.measureSandbox.appendChild(probe);

        const cleanText = text.trim();
        const fits = (candidate) => {
            probe.textContent = candidate;
            return probe.scrollHeight <= maxHeightPx;
        };

        if (fits(cleanText)) {
            const height = probe.scrollHeight;
            this.measureSandbox.removeChild(probe);
            return { text: cleanText, height, clamped: false };
        }

        let low = 0;
        let high = cleanText.length;
        let best = '…';

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const candidate = cleanText.slice(0, mid).trimEnd() + '…';
            if (fits(candidate)) {
                best = candidate;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        const height = Math.min(probe.scrollHeight, maxHeightPx);
        this.measureSandbox.removeChild(probe);
        return { text: best, height, clamped: true };
    }

    calculateGrid(itemCount, availableWidth, availableHeight, gap = 8, preferredRatio = null) {
        if (itemCount <= 0 || availableWidth <= 0 || availableHeight <= 0) {
            return { columns: 1, rows: 1, cellWidth: availableWidth, cellHeight: availableHeight };
        }

        let best = { columns: 1, rows: itemCount, area: 0, cellWidth: availableWidth, cellHeight: availableHeight };

        for (let cols = 1; cols <= itemCount; cols++) {
            const rows = Math.ceil(itemCount / cols);
            const totalGapX = gap * (cols - 1);
            const totalGapY = gap * (rows - 1);
            const cellWidth = (availableWidth - totalGapX) / cols;
            const cellHeight = (availableHeight - totalGapY) / rows;
            if (cellWidth <= 0 || cellHeight <= 0) continue;
            const area = cellWidth * cellHeight;
            const ratioScore = preferredRatio ? 1 - Math.abs((cellWidth / cellHeight) - preferredRatio) : 0;
            const score = area + ratioScore * 1000;
            if (score > best.area) {
                best = { columns: cols, rows, area: score, cellWidth, cellHeight };
            }
        }

        return best;
    }

    createTreatmentPageShell(scene, profile, options = {}) {
        const page = document.createElement('div');
        page.className = 'treatment-print-page strict-fit-page';
        if (profile.isLandscape) page.classList.add('landscape');
        if (profile.isBooklet) page.classList.add('booklet-treatment');
        page.style.width = `${profile.pageWidthIn}in`;
        page.style.height = `${profile.pageHeightIn}in`;
        page.style.padding = `${profile.paddingIn}in`;
        page.style.setProperty('--treat-section-gap', `${profile.sectionGapPx}px`);
        page.style.setProperty('--treat-column-gap', `${profile.columnGapPx}px`);
        page.style.setProperty('--treat-visual-floor', `${profile.visualFloorPx}px`);

        if (options.role) {
            page.dataset.facingRole = options.role;
        }

        const isSecondary = options.secondary || options.role === 'right' || options.role === 'back';

        if (!isSecondary) {
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
        }

        const hero = document.createElement('div');
        hero.className = 'treatment-scene-hero';
        if (isSecondary) hero.classList.add('compact-hero');

        const heroLeft = document.createElement('div');
        heroLeft.className = 'scene-hero-left';
        const iconWrap = document.createElement('div');
        iconWrap.className = 'scene-icon-pill';
        if (scene.meta?.icon) {
            iconWrap.innerHTML = `<i class="${scene.meta.icon}"></i>`;
        } else {
            iconWrap.innerHTML = `<i class="fas fa-icons"></i>`;
            iconWrap.classList.add('scene-icon-placeholder');
        }

        const pill = document.createElement('div');
        pill.className = 'scene-number-pill';
        pill.textContent = scene.number !== undefined ? String(scene.number) : '';
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
        heroLeft.appendChild(iconWrap);
        heroLeft.appendChild(pill);
        heroLeft.appendChild(titles);

        const heroMeta = document.createElement('div');
        heroMeta.className = 'scene-hero-meta';
        if (!isSecondary && this.config.treatment.showStats && scene.pageRange) {
            heroMeta.appendChild(this.createMetaChip('Pages', scene.pageRange));
        }
        if (options.role === 'back') {
            heroMeta.appendChild(this.createMetaChip('Side', 'Back'));
        } else if (options.role === 'left') {
            heroMeta.appendChild(this.createMetaChip('Side', 'Left'));
        } else if (options.role === 'right') {
            heroMeta.appendChild(this.createMetaChip('Side', 'Right'));
        }

        hero.appendChild(heroLeft);
        hero.appendChild(heroMeta);
        page.appendChild(hero);

        if (!isSecondary) {
            const chipRow = document.createElement('div');
            chipRow.className = 'scene-chip-row';
            if (this.config.treatment.showCharacters && scene.characters.length) {
                chipRow.appendChild(this.createMetaChip('Characters', scene.characters.join(', ')));
            }
            if (this.config.treatment.showMusic && (scene.meta.track || scene.meta.trackTitle || scene.meta.trackArtist)) {
                const music = [scene.meta.trackTitle, scene.meta.trackArtist].filter(Boolean).join(' — ') || 'Track Attached';
                chipRow.appendChild(this.createMetaChip('Music', music));
            }
            if (chipRow.childElementCount > 0) {
                page.appendChild(chipRow);
            }
        }

        const body = document.createElement('div');
        body.className = 'treatment-body strict-body';
        body.style.gap = `${profile.sectionGapPx}px`;
        page.appendChild(body);

        return { page, body };
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

    layoutReportSections(sections, profile, title, subtitle = '') {
        const pages = [];
        let page = this.createReportPageShell(title, subtitle, profile);
        let body = page.querySelector('.report-print-body');
        this.measureSandbox.appendChild(page);

        const flushPage = () => {
            this.measureSandbox.removeChild(page);
            pages.push(page);
            page = this.createReportPageShell(title, subtitle, profile);
            body = page.querySelector('.report-print-body');
            this.measureSandbox.appendChild(page);
        };

        sections.forEach(section => {
            const queue = [section.cloneNode(true)];
            while (queue.length > 0) {
                const block = queue.shift();
                body.appendChild(block);
                if (body.scrollHeight <= body.clientHeight + 2) continue;

                body.removeChild(block);
                if (body.children.length > 0) {
                    flushPage();
                    queue.unshift(block);
                    continue;
                }

                const splits = this.splitReportSection(block, body.clientHeight);
                if (splits.length > 1) {
                    queue.unshift(...splits);
                } else {
                    block.style.pageBreakInside = 'auto';
                    block.style.breakInside = 'auto';
                    body.appendChild(block);
                }
            }
        });

        this.measureSandbox.removeChild(page);
        pages.push(page);
        return pages;
    }

    splitReportSection(section, maxHeightPx = 0) {
        const table = section.querySelector('table');
        if (!table || maxHeightPx <= 0) return [section];

        const heading = section.querySelector('h3');
        const header = table.querySelector('thead');
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        if (!rows.length) return [section];

        const makeChunk = (rowSubset, chunkIndex = 0) => {
            const chunk = section.cloneNode(false);
            chunk.className = section.className || 'report-section';
            if (heading) {
                const title = heading.cloneNode(true);
                if (chunkIndex > 0) title.innerHTML = `${title.innerHTML} (cont.)`;
                chunk.appendChild(title);
            }
            const chunkTable = table.cloneNode(false);
            if (header) chunkTable.appendChild(header.cloneNode(true));
            const body = document.createElement('tbody');
            rowSubset.forEach(r => body.appendChild(r.cloneNode(true)));
            chunkTable.appendChild(body);
            chunk.appendChild(chunkTable);
            return chunk;
        };

        const chunks = [];
        let buffer = [];
        rows.forEach(row => {
            buffer.push(row);
            const test = makeChunk(buffer, chunks.length);
            this.measureSandbox.appendChild(test);
            const fits = test.offsetHeight <= maxHeightPx;
            this.measureSandbox.removeChild(test);
            if (!fits && buffer.length > 1) {
                buffer.pop();
                chunks.push(makeChunk(buffer, chunks.length));
                buffer = [row];
            }
        });
        if (buffer.length) {
            chunks.push(makeChunk(buffer, chunks.length));
        }
        return chunks;
    }

    createReportPageShell(title, subtitle, profile) {
        const page = document.createElement('div');
        page.className = 'treatment-print-page report-print-page strict-fit-page';
        page.style.width = `${profile.pageWidthIn}in`;
        page.style.height = `${profile.pageHeightIn}in`;
        page.style.padding = `${profile.paddingIn}in`;

        const header = document.createElement('div');
        header.className = 'treatment-doc-header report-doc-header';
        header.innerHTML = `
            <div class="doc-title-block">
                <div class="doc-label">Report</div>
                <div class="doc-title">${title || 'Report'}</div>
                ${subtitle ? `<div class="doc-submeta">${subtitle}</div>` : ''}
            </div>
            <div class="doc-submeta">
                ${this.app.meta.title ? `<div>${(this.app.meta.title || '').toUpperCase()}</div>` : ''}
                <div>${new Date().toLocaleDateString()}</div>
            </div>
        `;

        const body = document.createElement('div');
        body.className = 'report-print-body';
        page.appendChild(header);
        page.appendChild(body);
        return page;
    }

    createReportPlaceholder(message) {
        const placeholder = document.createElement('div');
        placeholder.className = 'report-section';
        placeholder.appendChild(this.createPlaceholder(message));
        return placeholder;
    }

    createScriptPageShell() {
        const page = document.createElement('div');
        page.className = 'page dialogue-page';
        const cw = document.createElement('div');
        cw.className = 'content-wrapper';
        page.appendChild(cw);
        return { page, body: cw };
    }

    createDialoguePages(dialogueData = []) {
        if (!dialogueData.length) return [];
        const pages = [];
        let { page, body } = this.createScriptPageShell();
        this.measureSandbox.appendChild(page);
        const getMaxHeight = () => {
            const styles = getComputedStyle(page);
            const pt = parseFloat(styles.paddingTop) || 0;
            const pb = parseFloat(styles.paddingBottom) || 0;
            return page.clientHeight - pt - pb;
        };
        let maxHeight = getMaxHeight();

        const flushPage = () => {
            this.measureSandbox.removeChild(page);
            pages.push(page);
            ({ page, body } = this.createScriptPageShell());
            this.measureSandbox.appendChild(page);
            maxHeight = getMaxHeight();
        };

        const appendBlock = (node) => {
            body.appendChild(node);
            if (body.scrollHeight > maxHeight) {
                body.removeChild(node);
                flushPage();
                body.appendChild(node);
            }
        };

        const makeLine = (cls, text) => {
            const el = document.createElement('div');
            el.className = `script-line ${cls}`.trim();
            el.textContent = text || '';
            return el;
        };

        dialogueData.forEach(scene => {
            const slugText = (scene.slug || 'UNTITLED').toUpperCase();
            appendBlock(makeLine('sc-slug', slugText));
            scene.clusters.forEach((cluster, idx) => {
                if (idx > 0) {
                    const sep = makeLine('sc-action dialogue-separator-line', '* * *');
                    sep.style.textAlign = 'center';
                    appendBlock(sep);
                }
                cluster.forEach(block => {
                    let node;
                    if (block.type === 'sc-character' || block.type === 'CHARACTER') {
                        node = makeLine('sc-character', (block.speaker || block.text || '').toUpperCase());
                    } else if (block.type === 'PARENTHETICAL' || block.type === 'sc-parenthetical') {
                        node = makeLine('sc-parenthetical', block.text || '');
                    } else {
                        node = makeLine('sc-dialogue', block.text || '');
                    }
                    if (!block.isTarget) node.classList.add('counterpart-line');
                    appendBlock(node);
                });
            });
        });

        this.measureSandbox.removeChild(page);
        pages.push(page);
        return pages;
    }

    createScenePagesSection(pages = []) {
        const section = document.createElement('div');
        section.className = 'report-section report-scene-pages';
        const title = document.createElement('h3');
        title.textContent = 'Scenes';
        section.appendChild(title);
        const grid = document.createElement('div');
        grid.className = 'scene-pages-grid';
        pages.forEach(p => grid.appendChild(p));
        section.appendChild(grid);
        return section;
    }

    clonePageForEmbed(page, profile) {
        const clone = page.cloneNode(true);
        clone.classList.add('thumb-page', 'embedded-scene-page');
        const wrapper = document.createElement('div');
        wrapper.className = 'scene-page-clone';
        const baseWidth = 8.5 * 96;
        const availableWidth = Math.max(1, profile.pageWidthPx - profile.paddingPx * 2);
        const scale = Math.min(1, availableWidth / baseWidth);
        const scaledWidthIn = 8.5 * scale;
        const scaledHeightIn = 11 * scale;
        wrapper.style.width = `${scaledWidthIn}in`;
        wrapper.style.height = `${scaledHeightIn}in`;
        wrapper.style.transform = `scale(${scale})`;
        wrapper.style.transformOrigin = 'top left';
        wrapper.style.overflow = 'hidden';
        wrapper.appendChild(clone);
        return wrapper;
    }

    async buildSheetsForMode(mode) {
        let logicalPages = [];
        if (mode === 'script') {
            logicalPages = await this.generateScreenplayPages();
        } else if (mode === 'treatment') {
            logicalPages = await this.generateTreatmentPages();
        } else {
            logicalPages = await this.generateReportPages();
        }

        if (mode === 'treatment' && this.config.treatment.layout === 'facing') {
            const pagesNeedingMargins = logicalPages.filter(p => !p.classList.contains('treatment-overview'));
            pagesNeedingMargins.forEach((p, idx) => {
                const role = p.dataset.facingRole;
                if (role === 'left') {
                    p.classList.add('facing-even');
                    p.classList.remove('facing-odd');
                } else if (role === 'right') {
                    p.classList.add('facing-odd');
                    p.classList.remove('facing-even');
                } else {
                    p.classList.add((idx + 1) % 2 === 0 ? 'facing-even' : 'facing-odd');
                }
            });
        }

        let finalSheets = [];
        const isBooklet = this.config[mode]?.layout === 'booklet';

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

        return { logicalPages, finalSheets };
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
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
            this.renderTimeout = null;
        }
        await this.renderPreview();

        const modeConfig = this.config[this.mode] || {};
        const isBooklet = modeConfig.layout === 'booklet';
        const isTreatment = this.mode === 'treatment';
        const isReport = this.mode === 'report';
        const isLandscape = isTreatment && this.config.treatment.orientation === 'landscape';
        
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
        
        if (!isTreatment && !isReport && this.config.script.showSceneNumbers) printTarget.classList.add('show-scene-numbers');
        if (isTreatment) printTarget.classList.add('treatment-print');
        if (isReport) printTarget.classList.add('report-print');
        
        const sourceSheets = (this.lastPreview && this.lastPreview.mode === this.mode && this.lastPreview.finalSheets?.length)
            ? this.lastPreview.finalSheets
            : (await this.buildSheetsForMode(this.mode)).finalSheets;

        sourceSheets.forEach(sheet => printTarget.appendChild(sheet.cloneNode(true)));

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
    createMeasurementSandbox() {
        const existing = document.getElementById('print-measure-sandbox');
        if (existing) return existing;

        const sandbox = document.createElement('div');
        sandbox.id = 'print-measure-sandbox';
        sandbox.style.position = 'absolute';
        sandbox.style.visibility = 'hidden';
        sandbox.style.pointerEvents = 'none';
        sandbox.style.left = '-9999px';
        sandbox.style.top = '0';
        sandbox.style.width = '1200px';
        sandbox.style.height = '0';
        sandbox.style.overflow = 'hidden';
        document.body.appendChild(sandbox);
        return sandbox;
    }

    clampText(text = '', maxChars = 800) {
        if (!text) return '';
        if (text.length <= maxChars) return text;
        return text.slice(0, maxChars).trimEnd() + '…';
    }

    buildStatsSection(scene) {
        if (!this.config.treatment.showStats) return null;
        const items = [];
        if (scene.pageRange) items.push(`Pages: ${scene.pageRange}`);
        if (scene.lengthLabel) items.push(`Length: ${scene.lengthLabel}`);
        const estWords = Number.isFinite(scene.eighths) ? Math.max(40, Math.round((scene.eighths / 8) * 150)) : null;
        if (estWords) items.push(`Est. Words: ${estWords}`);

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

    formatEighthsLabel(eighths) {
        if (!Number.isFinite(eighths) || eighths <= 0) return '';
        const pages = Math.floor(eighths / 8);
        const rem = eighths % 8;
        const parts = [];
        if (pages > 0) parts.push(`${pages}pg`);
        if (rem > 0) parts.push(`${rem}/8`);
        return parts.join(' ') || `${rem}/8`;
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

    async loadSceneImages(meta, max = Infinity) {
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
