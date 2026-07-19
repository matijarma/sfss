import * as constants from './Constants.js';
import { generateLineId } from './Utils.js';
import { getTextOffset, setTextOffset, decorateBlock, toggleEmphasis, plainText } from './InlineMarkup.js';
import { toast } from './Toast.js';

// Emphasis v1 scope: uppercase-rewritten types (SLUG/CHARACTER/TRANSITION)
// are excluded from marker decoration and Ctrl+B/I/U.
const EMPHASIS_TYPES = [
    constants.ELEMENT_TYPES.ACTION,
    constants.ELEMENT_TYPES.DIALOGUE,
    constants.ELEMENT_TYPES.PARENTHETICAL
];

export class EditorHandler {
    constructor(app) {
        this.app = app;
        this.autoMenu = document.getElementById('autocomplete-menu');
        this.typeMenu = document.getElementById('type-selector-menu');

        this.popupState = { active: false, type: null, selectedIndex: 0, options: [], targetBlock: null };
        this.activePopupCleanup = null;
        this.sceneListUpdateTimeout = null;
        this.isComposing = false;

        this.init();
    }

    init() {
        this.app.editor.addEventListener('keydown', this.handleKeydown.bind(this));
        this.app.editor.addEventListener('keyup', this.handleKeyup.bind(this));
        this.app.editor.addEventListener('input', this.handleInput.bind(this));
        this.app.editor.addEventListener('mouseup', this.updateContext.bind(this));
        this.app.editor.addEventListener('paste', this.handlePaste.bind(this));
        // Never decorate mid-IME-composition: rebuilding the block's DOM
        // would break the composition session. Decorate once it commits.
        this.app.editor.addEventListener('compositionstart', () => { this.isComposing = true; });
        this.app.editor.addEventListener('compositionend', () => {
            this.isComposing = false;
            this.maybeDecorate(this.getCurrentBlock());
        });
        // Newlines are always represented as new blocks (the keydown handlers
        // create them); never let the browser insert <br>/paragraphs, which
        // the textContent-based export would silently drop.
        this.app.editor.addEventListener('beforeinput', (e) => {
            if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
                e.preventDefault();
            }
        });
        this.app.editor.addEventListener('focusout', (e) => {
            if (e.target.classList && e.target.classList.contains('script-line')) {
                this.handleBlockBlur(e.target);
            } else if (e.target === this.app.editor &&
                       (!e.relatedTarget || !this.app.editor.contains(e.relatedTarget))) {
                // contenteditable hosts receive the focus events, not their
                // child lines: commit the block that held the caret and clear
                // every force-suppression flag (data-forced lives "until blur").
                const block = this.getCurrentBlock();
                if (block) this.handleBlockBlur(block);
                this.app.editor.querySelectorAll('[data-forced]').forEach(b => delete b.dataset.forced);
            }
        }, true);
    }

    // Blur commit point: `>`-forces resolve, strays are sanitized, and the
    // data-forced suppression flag (set by live @/! forces) is cleared.
    handleBlockBlur(block) {
        this.checkCommitForces(block);
        this.sanitizeBlock(block);
        delete block.dataset.forced;
    }

    // Marker decoration (visible, iA-Writer style) for types in emphasis v1
    // scope. No-ops mid-IME-composition and while a collab typewriter
    // animation owns the block (SFSS.typewriterEffect decorates on finish).
    maybeDecorate(block) {
        if (!block || this.isComposing || block._typewriterTimeout) return false;
        if (!EMPHASIS_TYPES.includes(this.getBlockType(block))) return false;
        return decorateBlock(block);
    }

    // Span-safe caret helpers: offsets are character offsets into
    // block.textContent, independent of any styled-span structure.
    getCaretPosition() {
        const block = this.getCurrentBlock();
        if (!block) return null;
        const offset = getTextOffset(block);
        if (offset === null) return null;
        return { blockId: block.dataset.lineId, offset };
    }

    setCaret(blockEl, offset) {
        if (!blockEl) return;
        if (blockEl.childNodes.length === 0) blockEl.appendChild(document.createTextNode(''));
        const clamped = Math.max(0, Math.min(offset, blockEl.textContent.length));
        setTextOffset(blockEl, clamped);
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
                    this.maybeDecorate(currentBlock);
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

            // Centered toggle: enabled for ACTION blocks, lit when the
            // current block carries sc-centered.
            const centeredBtn = document.getElementById('toolbar-centered');
            if (centeredBtn) {
                const isAction = currentType === constants.ELEMENT_TYPES.ACTION;
                centeredBtn.disabled = !isAction;
                centeredBtn.classList.toggle('active', isAction && block.classList.contains('sc-centered'));
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
        // Markers and [[notes]] never skew the word count (plan item 13).
        const text = plainText(this.app.editor.innerText).trim();
        document.getElementById('stats-words').textContent = `Words: ${text ? text.split(/\s+/).length : 0}`;
        // stats-pages is updated by the 'sfss-geometry' event listener in
        // SFSS.bindEventListeners (single pagination engine — R1).
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

        if ((e.ctrlKey || e.metaKey) && !e.altKey && { b: 'b', i: 'i', u: 'u' }[e.key.toLowerCase()]) {
            // ALWAYS suppressed — native execCommand <b>/<i>/<u> must never
            // enter the DOM, even for types outside emphasis v1 scope.
            e.preventDefault();
            this.toggleEmphasisAtSelection(e.key.toLowerCase());
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
            // Re-read the type: a commit force just before handleNav('enter')
            // may have converted the block (ACTION -> TRANSITION/centered).
            const type = this.getBlockType(block);
            const nextType = this.app.keymap[type] ? this.app.keymap[type][key] : null;

            if (!isEmpty) {
                if (key === 'enter') {
                    // Smart Split: Enter mid-text splits the block in two.
                    const sel = window.getSelection();
                    const range = sel.getRangeAt(0);
                    const isAtEnd = (range.endContainer === block || range.endContainer.parentNode === block) &&
                                    range.endOffset === block.textContent.length;

                    if (!isAtEnd && [constants.ELEMENT_TYPES.ACTION, constants.ELEMENT_TYPES.DIALOGUE, constants.ELEMENT_TYPES.PARENTHETICAL].includes(type)) {
                        this.splitBlockAtCaret(block, type);
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

        if (e.key === 'Enter' && e.shiftKey) {
            // Shift+Enter: split into a new block of the SAME type at the
            // caret (never a <br> — that data was lost on export).
            e.preventDefault();
            this.splitBlockAtCaret(block, type);
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            // Commit-time forces ('> text' / '> text <') resolve before the
            // keymap transition so the NEW type picks the next block.
            this.checkCommitForces(block);
            handleNav('enter');
        }

        if (e.key === 'Tab' && !e.shiftKey) {
            handleNav('tab');
        }
    }

    // Splits `block` at the caret; text after the caret moves into a new
    // block of `newType` which receives focus at offset 0.
    splitBlockAtCaret(block, newType) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(block);
        preRange.setEnd(range.endContainer, range.endOffset);
        let firstPart = preRange.toString();
        let secondPart = block.textContent.slice(firstPart.length);

        if (newType === constants.ELEMENT_TYPES.PARENTHETICAL) {
            // DOM text carries no outer parens (CSS supplies them); strip strays.
            firstPart = firstPart.replace(/^\(+/, '').trim();
            secondPart = secondPart.replace(/\)+$/, '').trim();
        }

        block.textContent = firstPart;
        const newBlock = this.createBlock(newType, secondPart, block);
        this.focusBlock(newBlock, 0);
        this.app.saveState(true);
        return newBlock;
    }

    // Ctrl+B/I/U seam: computes character offsets of the current selection
    // (span-safe pre-range math, same convention as getTextOffset) and hands
    // them to InlineMarkup.toggleEmphasis. Empty selection inserts a marker
    // pair with the caret in between (toggleMarkers handles it).
    toggleEmphasisAtSelection(kind) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const blockOf = (node) => {
            if (!node) return null;
            if (node.nodeType === 3) node = node.parentNode;
            return node.closest ? node.closest('.script-line') : null;
        };
        const anchorBlock = blockOf(sel.anchorNode);
        const focusBlock = blockOf(sel.focusNode);
        if (!anchorBlock || !focusBlock) return;
        if (anchorBlock !== focusBlock) {
            toast('Select within a single line to format');
            return;
        }
        const block = anchorBlock;
        if (!EMPHASIS_TYPES.includes(this.getBlockType(block))) return;

        const range = sel.getRangeAt(0);
        const pre = range.cloneRange();
        pre.selectNodeContents(block);
        pre.setEnd(range.startContainer, range.startOffset);
        const selStart = pre.toString().length;
        const selEnd = selStart + range.toString().length;

        toggleEmphasis(block, kind, selStart, selEnd);
        this.app.saveState(true);
    }

    // Fountain forces, live variant (plan D5): '@' / '!' / '.' prefixes
    // convert the block as soon as a real character follows the marker.
    // History is snapshotted BEFORE the mutation so one undo restores the
    // literal typed text. Returns true if a conversion happened.
    checkForces(block, text) {
        if (!block || this.popupState.active || block.dataset.forced) return false;
        const type = this.getBlockType(block);

        // '@' -> Character, typed case kept. data-forced suppresses the
        // keyup auto-uppercase rewrite until the block blurs.
        if (type !== constants.ELEMENT_TYPES.CHARACTER && /^@./.test(text)) {
            this._applyForce(block, constants.ELEMENT_TYPES.CHARACTER, text.slice(1), true, 'Character');
            return true;
        }
        // '!' -> Action. data-forced suppresses reclassification (the
        // INT./EXT. auto-slug) so "!INT. HOUSE" stays action.
        if (/^!./.test(text)) {
            this._applyForce(block, constants.ELEMENT_TYPES.ACTION, text.slice(1), true, 'Action');
            return true;
        }
        // '.' -> Scene Heading. Ellipsis-guarded: '..' and '. ' never force.
        if (type !== constants.ELEMENT_TYPES.SLUG && /^\.(?![. ])./.test(text)) {
            this._applyForce(block, constants.ELEMENT_TYPES.SLUG, text.slice(1), false, 'Scene Heading');
            return true;
        }
        return false;
    }

    _applyForce(block, newType, newText, setForced, label) {
        const offset = getTextOffset(block);
        this.app.saveState(true); // pre-conversion snapshot -> one-step undo
        block.textContent = newText;
        this.setBlockType(block, newType);
        if (setForced) block.dataset.forced = 'true';
        if (offset !== null) this.setCaret(block, Math.max(0, offset - 1));
        this.showTypeHint(block, label);
    }

    // Fountain forces, commit variant (Enter/blur): '> text <' -> centered
    // action, '> text' -> transition. Only plain ACTION blocks convert —
    // typing '>' inside dialogue stays literal.
    checkCommitForces(block) {
        if (!block) return false;
        if (this.getBlockType(block) !== constants.ELEMENT_TYPES.ACTION) return false;
        const text = block.textContent;

        let m = text.match(/^>\s*(.+?)\s*<$/);
        if (m) {
            this.app.saveState(true);
            block.textContent = m[1];
            block.classList.add('sc-centered');
            this.maybeDecorate(block);
            this.setCaret(block, block.textContent.length);
            this.showTypeHint(block, 'Centered');
            return true;
        }
        m = text.match(/^>\s*(.+)/);
        if (m) {
            this.app.saveState(true);
            block.textContent = m[1].trim().toUpperCase();
            this.setBlockType(block, constants.ELEMENT_TYPES.TRANSITION);
            this.setCaret(block, block.textContent.length);
            this.showTypeHint(block, 'Transition');
            return true;
        }
        return false;
    }

    // Transient chip ("Scene Heading", "Transition", ...) shown next to a
    // just-force-converted block; CSS animation fades it out (~1.2s).
    showTypeHint(block, label) {
        const wrapper = document.getElementById('editor-wrapper');
        if (!wrapper || !block.getBoundingClientRect) return;
        const chip = document.createElement('div');
        chip.className = 'type-hint';
        chip.textContent = label;
        const rect = block.getBoundingClientRect();
        const parentRect = wrapper.getBoundingClientRect();
        chip.style.top = (rect.top - parentRect.top) + 'px';
        chip.style.left = Math.max(0, rect.left - parentRect.left) + 'px';
        wrapper.appendChild(chip);
        setTimeout(() => chip.remove(), 1300);
    }

    // Toolbar centered toggle (ACTION blocks only): flip the sc-centered
    // class and snapshot — serializeBlockElement reads the class back as the
    // canonical `centered` flag on export.
    toggleCentered() {
        const block = this.getCurrentBlock();
        if (!block || this.getBlockType(block) !== constants.ELEMENT_TYPES.ACTION) return;
        this.app.saveState(true);
        block.classList.toggle('sc-centered');
        this.app.saveState(true);
        this.updateContext();
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
        // Re-decorate inline markers as they are typed. e.target is the
        // contenteditable host on real input events; fall back to selection.
        const block = (e.target && e.target.closest && e.target.closest('.script-line')) || this.getCurrentBlock();
        this.maybeDecorate(block);
    }

    handleKeyup(e) {
        if (this.popupState.active && this.popupState.type === 'selector') return;
        const block = this.getCurrentBlock();
        if (!block) return;
        let type = this.getBlockType(block);
        let text = block.textContent;

        // Fountain forces run BEFORE the INT./EXT. auto-slug so an explicit
        // marker always wins; a conversion changes type/text mid-pass. Only
        // editing keys count ("on next typed char") — merely navigating into
        // a block with a literal '@'/'!'/'.' prefix must not convert it.
        const isEditKey = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete';
        if (isEditKey && !this.isComposing && this.checkForces(block, text)) {
            type = this.getBlockType(block);
            text = block.textContent;
        }

        if (!block.dataset.forced &&
            (text.toUpperCase().startsWith('INT.') || text.toUpperCase().startsWith('EXT.')) && type !== constants.ELEMENT_TYPES.SLUG) {
            this.setBlockType(block, constants.ELEMENT_TYPES.SLUG);
            type = constants.ELEMENT_TYPES.SLUG;
        }

        if ([constants.ELEMENT_TYPES.SLUG, constants.ELEMENT_TYPES.CHARACTER, constants.ELEMENT_TYPES.TRANSITION].includes(type)) {
            // data-forced (an '@' force keeping typed case) suspends the
            // uppercase rewrite until the block blurs.
            if (!block.dataset.forced && text !== text.toUpperCase()) {
                const offset = getTextOffset(block);
                block.textContent = text.toUpperCase();
                if (offset !== null) this.setCaret(block, offset);
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
        // No <br> may survive in a block: the model is one block per line.
        block.querySelectorAll('br').forEach(br => br.remove());
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

    openTypeSelector(block) { this.showPopup('selector', block, constants.TYPE_ORDER); }

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
        menu.style.position = ''; // TreatmentRenderer may have left position:fixed behind
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

    // Returns true if any popup/menu was actually open (Escape dispatch needs
    // to know whether the event was consumed).
    closePopups() {
        const iconPicker = document.getElementById('icon-picker-menu');
        const wasOpen = this.popupState.active ||
            this.autoMenu.style.display !== 'none' ||
            this.typeMenu.style.display !== 'none' ||
            (iconPicker && iconPicker.style.display !== 'none') ||
            !!this.activePopupCleanup;
        if (this.activePopupCleanup) {
            const cleanup = this.activePopupCleanup;
            this.activePopupCleanup = null;
            cleanup();
        }
        this.popupState.active = false;
        this.autoMenu.style.display = 'none';
        this.typeMenu.style.display = 'none';
        if (this.app.sidebarManager) {
            this.app.sidebarManager.hideIconPickerMenu();
        } else if (iconPicker) {
            iconPicker.style.display = 'none';
        }
        return wasOpen;
    }

    createBlock(type, text = '', insertAfterNode = null) {
        const div = document.createElement('div');
        div.className = `script-line ${type}`;
        div.dataset.lineId = generateLineId();
        div.textContent = text;
        if (text) this.maybeDecorate(div); // imported/pasted text may carry markers
        if (insertAfterNode && insertAfterNode.parentNode === this.app.editor) this.app.editor.insertBefore(div, insertAfterNode.nextSibling);
        else this.app.editor.appendChild(div);
        if (type === constants.ELEMENT_TYPES.CHARACTER && text === '') this.predictCharacter(div);
        return div;
    }

    focusBlock(block, offset = -1) {
        if (!block) return;
        this.setCaret(block, offset === -1 ? block.textContent.length : offset);
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
