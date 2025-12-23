import * as constants from './Constants.js';

export class TreatmentRenderer {
    constructor(app) {
        this.app = app;
        this.container = null;
    }

    render(container) {
        // Legacy entry point
    }
    
    renderFromData(blocks, container) {
        this.container = container;
        this.container.innerHTML = '';
        this.currentBlocks = blocks; 
        
        // Mobile Meta Header
        if (document.body.classList.contains('mobile-view')) {
            this.renderMobileMeta(container);
        }
        
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

    renderMobileMeta(container) {
        const metaWrapper = document.createElement('div');
        metaWrapper.className = 'treatment-mobile-meta';
        
        // Toggle Button
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'treatment-meta-toggle';
        
        // Load state
        const isCollapsedInitially = localStorage.getItem('draftzero_treatment_meta_collapsed') === 'true';
        if (isCollapsedInitially) {
            metaWrapper.classList.add('collapsed');
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
        
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = metaWrapper.classList.toggle('collapsed');
            localStorage.setItem('draftzero_treatment_meta_collapsed', isCollapsed);
            toggleBtn.innerHTML = isCollapsed ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        };
        
        metaWrapper.addEventListener('click', () => {
             if (metaWrapper.classList.contains('collapsed')) {
                 metaWrapper.classList.remove('collapsed');
                 localStorage.setItem('draftzero_treatment_meta_collapsed', 'false');
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

        // --- Reorder Controls (Left Margin) ---
        const controls = document.createElement('div');
        controls.className = 'treatment-reorder-controls';
        
        const upBtn = document.createElement('button');
        upBtn.className = 'reorder-btn';
        upBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
        upBtn.disabled = index === 0;
        upBtn.onclick = (e) => { e.stopPropagation(); this.app.moveScene(index, -1); };
        
        const downBtn = document.createElement('button');
        downBtn.className = 'reorder-btn';
        downBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        downBtn.disabled = index === total - 1;
        downBtn.onclick = (e) => { e.stopPropagation(); this.app.moveScene(index, 1); };
        
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
            numberBox.textContent = index + 1;
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
        this.app.refreshTreatmentView();
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
                 this.app.addCharacterInTreatment(scene.slug.id, val);
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
                this.app.addTransitionInTreatment(sceneId);
            } else {
                this.app.addSceneHeadingInTreatment(sceneId);
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