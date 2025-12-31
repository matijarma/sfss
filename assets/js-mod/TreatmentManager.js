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
        this.sfss.treatmentRenderer.renderFromData(this.sfss.scriptData.blocks, this.sfss.editor);
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
