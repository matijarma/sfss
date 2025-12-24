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
                            // Strip existing brackets from split parts if they exist
                            let cleanFirst = firstPart.replace(/^\(/, '').trim();
                            let cleanSecond = secondPart.replace(/\)$/, '').trim();
                            
                            // Re-wrap if content exists
                            firstPart = cleanFirst ? `(${cleanFirst})` : '';
                            secondPart = cleanSecond ? `(${cleanSecond})` : '';
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
                        this.setBlockType(block, constants.ELEMENT_TYPES.DIALOGUE);
                        this.focusBlock(block);
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
             // Remove existing brackets to clean up first
             let clean = text.replace(/^\(+|\)+$/g, '').trim(); 
             if (clean.length > 0) {
                 block.textContent = `(${clean})`;
             } else if (text.length > 0) {
                 // If it was just brackets, clear it or leave empty
                 block.textContent = ''; 
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
            if (type === 'selector') {
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
            } else div.textContent = opt;

            div.onclick = () => { this.popupState.selectedIndex = idx; this.popupSelect(); };
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

    applySnapshot(data, isSoft = false) {
        // Restore full script state
        if (isSoft) {
             const scrollArea = document.getElementById('scroll-area');
             const parentScroll = scrollArea ? scrollArea.scrollTop : 0;
             
             this.app.importJSON(data, true); 
             
             if (scrollArea) scrollArea.scrollTop = parentScroll;
        } else {
             this.app.importJSON(data, true); 
        }
        
        // Persist the synced state
        this.app.save();
    }
}
