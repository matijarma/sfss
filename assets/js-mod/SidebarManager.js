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
    
        const { eighths, speakingCharacters, detailedStats } = this._getSceneStats(slug);
        const pages = Math.floor(eighths / 8);
        const remainingEights = eighths % 8;

        popup.dataset.sceneId = sceneId;
    
        const header = popup.querySelector('#scene-settings-popup-header');
        let sceneTitle = slug.textContent.trim();
        
        // Scene Number Logic: Check meta first, else calculate
        const meta = this.app.sceneMeta[sceneId] || {};
        const autoNumber = Array.from(this.app.editor.querySelectorAll('.sc-slug')).indexOf(slug) + 1;
        const displaySceneNumber = meta.number || autoNumber;
    
        const iconHtml = meta.icon ? `<span class="scene-item-icon-container"><i class="${meta.icon} fa-fw"></i></span>` : '';
        const colorClass = meta.color || '';
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
                <div class="truncate" title="${sceneTitle}">
                    <span class="opacity-50 mr-1">#${displaySceneNumber}</span>
                    <span class="ml-1">${sceneTitle}</span>
                </div>
            </div>
            ${pageCountHtml}
            <button id="scene-settings-close-btn" class="btn-text">✕</button>
        `;
        
        // Re-bind the close button event listener as we just overwrote it
        header.querySelector('#scene-settings-close-btn').addEventListener('click', () => this.closeSceneSettings());

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
                         <div style="display:flex; gap:10px; align-items:center; margin-bottom: 0.5rem;">
                             <label class="settings-label" for="scene-number-input" style="width: auto; margin:0;"># No:</label>
                             <input type="text" id="scene-number-input" class="settings-input" style="width: 60px; text-align:center;" value="${meta.number || ''}" placeholder="${autoNumber}">
                         </div>
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
        
        document.getElementById('scene-description-input').addEventListener('input', () => this.saveSceneMeta(sceneId));
        document.getElementById('scene-notes-input').addEventListener('input', () => this.saveSceneMeta(sceneId));
        document.getElementById('scene-number-input').addEventListener('input', () => this.saveSceneMeta(sceneId));

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
        const numberInput = document.getElementById('scene-number-input');

        const description = descriptionInput ? descriptionInput.value : this.app.sceneMeta[sceneId].description;
        const notes = notesInput ? notesInput.value : this.app.sceneMeta[sceneId].notes;
        const track = trackInput ? trackInput.value : this.app.sceneMeta[sceneId].track;
        const number = numberInput ? numberInput.value.trim() : this.app.sceneMeta[sceneId].number;

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
        if (updateList) {
            this.updateSceneList();
        }
        if (this.app.treatmentModeActive) {
            // Re-render Treatment View (now in editor)
            this.app.refreshTreatmentView();
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
            // We can't easily calc heights in data mode without DOM.
            // Use stored stats if we implement storage, otherwise show nothing or placeholder.
            // For now, let's skip strict page counts in Treatment Mode list update to avoid errors/0s.
            // Or try to use last known stats if cached?
            // SidebarManager doesn't cache stats per scene currently.
            
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
                } else {
                     pageCountHtml = `
                        <div class="scene-page-count">
                            <span class="eights"><b>0</b>/8</span>
                        </div>
                    `;
                }
            } else {
                // In Treatment Mode, we might not have accurate page counts.
                // Just show placeholder or nothing? 
                // Showing nothing is safer than showing "0/8".
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
                if (e.target.closest('.scene-config-btn')) return;

                this.app.scrollToScene(lineId);

                if (!document.getElementById('scene-settings-popup').classList.contains('hidden')) {
                    // We need a DOM element for openSceneSettings...
                    // In Treatment Mode, we have Treatment Blocks.
                    // But openSceneSettings expects a script slug?
                    // It uses it for stats.
                    // If in Treatment Mode, maybe we pass the Treatment Block?
                    // TreatmentRenderer creates blocks with dataset.sceneId.
                    // Let's find that block.
                    const block = this.app.editor.querySelector(`[data-scene-id="${lineId}"]`);
                    if (block && this.app.treatmentModeActive) {
                         // We can't really get script stats from the block easily.
                         // Maybe disable stats in popup for now?
                         // Or adapt openSceneSettings.
                    } else if (!isDataMode) {
                        this.openSceneSettings(slug);
                    }
                }

                if (document.body.classList.contains('mobile-view')) {
                    this.toggleMobileMenu();
                }
            };
            
            item.querySelector('.scene-config-btn').onclick = (e) => {
                e.stopPropagation();
                // Same issue as above.
                if (!isDataMode) this.openSceneSettings(slug);
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
        if (document.getElementById('scene-settings-popup').dataset.sceneId === sceneId) {
            const slug = this.app.editor.querySelector(`[data-line-id="${sceneId}"]`);
            if (slug) this.openSceneSettings(slug);
        }
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
    }
}