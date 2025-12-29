import * as constants from './Constants.js';

export class PageRenderer {
    constructor() {
        this.formatting = constants.FORMATTING;
        this.paperConfig = constants.PAPER_CONFIGS.US_LETTER; // Default
        this.updateDimensions();
        
        this.measureContainer = null;
    }

    setPaperSize(sizeName) {
        if (constants.PAPER_CONFIGS[sizeName]) {
            this.paperConfig = constants.PAPER_CONFIGS[sizeName];
            this.updateDimensions();
        }
    }

    updateDimensions() {
        this.dpi = this.formatting.PIXELS_PER_INCH;
        this.lineHeightPx = this.formatting.LINE_HEIGHT_PT * (this.dpi / 72); // pt to px conversion usually 1.333, but user said 12pt = 100% line height. 
        // User spec: 6 lines per inch. 1 inch = 96px. 96/6 = 16px.
        // 12pt font is usually 16px.
        this.lineHeightPx = 16; 

        this.pageHeightPx = this.paperConfig.dimensions.height * this.dpi;
        this.marginTopPx = this.paperConfig.margins.top * this.dpi;
        this.marginBottomPx = this.paperConfig.margins.bottom * this.dpi;
        this.contentHeightPx = this.pageHeightPx - this.marginTopPx - this.marginBottomPx;
        
        // Calculate strict max lines
        this.maxLinesPerPage = Math.floor(this.contentHeightPx / this.lineHeightPx);
    }

    getType(node) {
        for (const type of Object.values(constants.ELEMENT_TYPES)) {
            if (node.classList.contains(type)) return type;
        }
        return constants.ELEMENT_TYPES.ACTION;
    }

    render(sourceNodes, container, options = {}) {
        container.innerHTML = '';
        if (!sourceNodes || sourceNodes.length === 0) return;

        // Ensure container is visible for measurement
        if (container.offsetParent === null) {
            container.classList.remove('hidden');
            container.style.display = 'block';
        }

        container.classList.toggle('show-scene-numbers', !!options.showSceneNumbers);

        let pageIndex = 1;
        let currentPage = this.createPage(container, options, pageIndex);
        let contentWrapper = currentPage.querySelector('.content-wrapper');
        let currentLines = 0; // Tracking lines on current page

        const createNewPage = () => {
            pageIndex++;
            currentPage = this.createPage(container, options, pageIndex);
            contentWrapper = currentPage.querySelector('.content-wrapper');
            currentLines = 0;
            return contentWrapper;
        };

        let i = 0;
        let sceneIndex = 1; // Chronological counter

        while (i < sourceNodes.length) {
            // 1. Identify the logical block
            let { blockNodes, type, nextIndex } = this.getNextLogicalBlock(sourceNodes, i);
            
            // Handle Scene Numbers logic
            if (type === constants.ELEMENT_TYPES.SLUG && options.showSceneNumbers) {
                // Determine number to show: Manual (from map) or Auto (sceneIndex)
                const slugNode = blockNodes[0];
                const id = slugNode.dataset.lineId;
                let displayNum = sceneIndex;
                
                if (options.sceneNumberMap && options.sceneNumberMap[id]) {
                    displayNum = options.sceneNumberMap[id];
                }
                
                // We need to visually attach this number. 
                // The CSS relies on .script-line::before or similar? 
                // Or we can inject a span.
                // SFSS usually uses CSS counters or ::before. 
                // To support manual numbers, we should probably set a data attribute on the node clone.
                blockNodes[0].dataset.sceneNumber = displayNum;
                // And ensure CSS uses attr(data-scene-number) if available, or we inject a span.
                // Let's modify the node content slightly for the print view or rely on CSS.
                // Best approach: Add a specific span if not present.
                // But `blockNodes` are clones? No, `blockNodes` are references to source. 
                // We clone them in `appendBlock`. We should modify the clone there?
                // `appendBlock` takes nodes. We can modify them before appending.
                
                sceneIndex++;
            }

            // 2. Measure the block
            let blockHeight = this.measureBlockHeight(blockNodes, contentWrapper);
            let blockLines = Math.ceil(blockHeight / this.lineHeightPx);
            
            // ... (rest of logic)

            // 3. Check fit
            let linesRemaining = this.maxLinesPerPage - currentLines;
            
            const extraAttrs = {};
            if (type === constants.ELEMENT_TYPES.SLUG && options.showSceneNumbers) {
                // Determine number to show: Manual (from map) or Auto (sceneIndex)
                const slugNode = blockNodes[0];
                const id = slugNode.dataset.lineId;
                let displayNum = sceneIndex;
                if (options.sceneNumberMap && options.sceneNumberMap[id]) {
                    displayNum = options.sceneNumberMap[id];
                }
                extraAttrs.sceneNumber = displayNum;
                sceneIndex++;
            }

            if (blockLines <= linesRemaining) {
                // IT FITS
                if (type === constants.ELEMENT_TYPES.SLUG) {
                    if (linesRemaining - blockLines < 1) {
                         createNewPage();
                         this.appendBlock(contentWrapper, blockNodes, extraAttrs);
                         currentLines += blockLines;
                    } else {
                        this.appendBlock(contentWrapper, blockNodes, extraAttrs);
                        currentLines += blockLines;
                    }
                } else {
                    this.appendBlock(contentWrapper, blockNodes, extraAttrs);
                    currentLines += blockLines;
                }
                i = nextIndex;
                continue;
            }

            // IT DOESN'T FIT - BREAKING LOGIC
            
            // Case A: Scene Heading
            if (type === constants.ELEMENT_TYPES.SLUG) {
                createNewPage();
                this.appendBlock(contentWrapper, blockNodes, extraAttrs);
                currentLines += blockLines;
                i = nextIndex;
                continue;
            }

            // Case B: Action / General
            if (type === constants.ELEMENT_TYPES.ACTION || type === constants.ELEMENT_TYPES.TRANSITION) {
                 // Try to split text
                 const node = blockNodes[0]; // Action blocks are usually single nodes in this logic
                 const result = this.splitTextNode(node, linesRemaining, contentWrapper, type);
                 
                 if (result.success) {
                     this.appendBlock(contentWrapper, [result.firstPart]);
                     currentLines += result.linesUsed;
                     
                     createNewPage();
                     // The rest becomes the new node to process
                     // We can't just modify sourceNodes[i] because it's a reference to the editor.
                     // We need to insert a temp node into our processing stream or handle it here.
                     // Easier: Handle the second part as if it were the start of a new block, 
                     // but we need to ensure we don't skip the *original* next nodes.
                     // Actually, splitTextNode returns a DOM node. We can just process it.
                     
                     // However, we need to handle the loop. 
                     // The simplest way is to decrement i so we process the "remainder" in the next iteration,
                     // BUT we need to replace sourceNodes[i] with the remainder. 
                     // Since we can't touch sourceNodes (it's the editor content), we need a queue.
                     
                     // BETTER APPROACH: Use a local queue of nodes to process.
                     // For now, let's just recursively handle the overflow or push it to next page if it's small.
                     
                     // If we split, we append the first part. The second part needs to be put on the new page.
                     this.appendBlock(contentWrapper, [result.secondPart]);
                     currentLines += Math.ceil(this.measureBlockHeight([result.secondPart], contentWrapper) / this.lineHeightPx);
                     
                     i = nextIndex; 
                     continue;
                 } else {
                     // Could not split cleanly (orphans/widows), push whole block
                     createNewPage();
                     this.appendBlock(contentWrapper, blockNodes);
                     currentLines += blockLines;
                     i = nextIndex;
                     continue;
                 }
            }

            // Case C: Dialogue (Character + Parenthetical + Dialogue)
            if (type === constants.ELEMENT_TYPES.CHARACTER) {
                // This is a dialogue block.
                // Structure: Character -> (Parenthetical)* -> Dialogue
                
                // Calculate how much space we have.
                // We need to place at least Character + (MORE) line.
                // If we can't fit Character + 1 line of dialogue, push all.
                
                // Let's identify the parts.
                const charNode = blockNodes[0];
                const dialogueNode = blockNodes[blockNodes.length - 1]; // Assuming last is dialogue
                const parentheticals = blockNodes.slice(1, -1);
                
                // Measure Header (Char + Parens)
                const headerNodes = [charNode, ...parentheticals];
                const headerHeight = this.measureBlockHeight(headerNodes, contentWrapper);
                const headerLines = Math.ceil(headerHeight / this.lineHeightPx);
                
                // Space available for dialogue
                const dialogueSpaceLines = linesRemaining - headerLines;
                
                if (dialogueSpaceLines < 2) { 
                    // Need at least 2 lines (1 text + 1 MORE) or just 1 line if it's the end?
                    // Spec says: "Orphans: A single line of Action or Dialogue cannot be left at the bottom of a page."
                    // So we probably want at least 2 lines of dialogue or the whole thing.
                    createNewPage();
                    // Handle (CONT'D)
                    const newCharNode = charNode.cloneNode(true);
                    if (!newCharNode.textContent.includes("(CONT'D)")) {
                         // Only add if not already there (though usually user types it)
                         // Spec says: Insert CHARACTER NAME (CONT'D) at the top of Page B.
                         // We should modify the text content of the clone.
                         newCharNode.textContent = newCharNode.textContent.trim() + " (CONT'D)";
                    }
                    const newBlock = [newCharNode, ...parentheticals.map(p => p.cloneNode(true)), dialogueNode.cloneNode(true)];
                    this.appendBlock(contentWrapper, newBlock);
                    currentLines += Math.ceil(this.measureBlockHeight(newBlock, contentWrapper) / this.lineHeightPx);
                    i = nextIndex;
                    continue;
                }
                
                // We have space for some dialogue. Try to split.
                // We need to reserve 1 line for (MORE).
                const splitResult = this.splitTextNode(dialogueNode, dialogueSpaceLines - 1, contentWrapper, constants.ELEMENT_TYPES.DIALOGUE);
                
                if (splitResult.success && splitResult.firstPart) {
                    // We split successfully.
                    
                    // 1. Append Header
                    this.appendBlock(contentWrapper, headerNodes.map(n => n.cloneNode(true)));
                    
                    // 2. Append First Part
                    this.appendBlock(contentWrapper, [splitResult.firstPart]);
                    
                    // 3. Append (MORE)
                    const moreNode = document.createElement('div');
                    moreNode.className = `script-line ${constants.ELEMENT_TYPES.CHARACTER}`; // Use character style for alignment or specific?
                    // Spec says: "insert (MORE) centered at the bottom of Page A" 
                    // Usually (MORE) is centered relative to the dialogue or page? Standard is centered text, often modeled as Character or Dialogue with special text.
                    // Final Draft uses Character alignment usually, or Centered. 
                    // Let's look at `assets/css/editor.css`... no specific class.
                    // Let's make a manual style or use Character.
                    moreNode.textContent = "(MORE)";
                    moreNode.style.textAlign = "center"; 
                    moreNode.style.width = "100%";
                    moreNode.style.marginLeft = "0";
                    this.appendBlock(contentWrapper, [moreNode]);
                    
                    currentLines = this.maxLinesPerPage; // We filled it effectively
                    
                    // 4. New Page
                    createNewPage();
                    
                    // 5. Append (CONT'D) Header
                    const contCharNode = charNode.cloneNode(true);
                    let cleanName = contCharNode.textContent.replace(/\s*\(CONT'D\)\s*$/, '').trim();
                    contCharNode.textContent = cleanName + " (CONT'D)";
                    
                    this.appendBlock(contentWrapper, [contCharNode]);
                    
                    // 6. Append Second Part
                    this.appendBlock(contentWrapper, [splitResult.secondPart]);
                    currentLines += Math.ceil(this.measureBlockHeight([contCharNode, splitResult.secondPart], contentWrapper) / this.lineHeightPx);
                    
                    i = nextIndex;
                    continue;
                } else {
                    // Can't split cleanly
                    createNewPage();
                     const newCharNode = charNode.cloneNode(true);
                     let cleanName = newCharNode.textContent.replace(/\s*\(CONT'D\)\s*$/, '').trim();
                     newCharNode.textContent = cleanName + " (CONT'D)";
                     const newBlock = [newCharNode, ...parentheticals.map(p => p.cloneNode(true)), dialogueNode.cloneNode(true)];
                    this.appendBlock(contentWrapper, newBlock);
                    currentLines += Math.ceil(this.measureBlockHeight(newBlock, contentWrapper) / this.lineHeightPx);
                    i = nextIndex;
                    continue;
                }
            }
            
            // Fallback
            this.appendBlock(contentWrapper, blockNodes);
            currentLines += blockLines;
            i = nextIndex;
        }
    }

    getNextLogicalBlock(nodes, startIndex) {
        const firstNode = nodes[startIndex];
        const type = this.getType(firstNode);
        const blockNodes = [firstNode];
        let nextIndex = startIndex + 1;

        if (type === constants.ELEMENT_TYPES.CHARACTER) {
            // Include Parentheticals and Dialogue
            while (nextIndex < nodes.length) {
                const nextNode = nodes[nextIndex];
                const nextType = this.getType(nextNode);
                if (nextType === constants.ELEMENT_TYPES.PARENTHETICAL || nextType === constants.ELEMENT_TYPES.DIALOGUE) {
                    blockNodes.push(nextNode);
                    nextIndex++;
                    // If we hit dialogue, we usually stop after it, UNLESS there are multiple dialogue chunks (rare but possible with parentheticals in between)
                    // Standard: Char -> (Paren) -> Dialog -> (Paren) -> Dialog.
                    // We should grab them all as one block usually.
                } else {
                    break;
                }
            }
        } else if (type === constants.ELEMENT_TYPES.SLUG) {
            // Just the slug? Or Slug + Action?
            // "Scene Header cannot be last line".
            // We treat the slug as its own block for measurement, but we handle the "next line" check in the main loop.
        } 
        
        return { blockNodes, type, nextIndex };
    }

    appendBlock(container, nodes, extraAttrs = {}) {
        nodes.forEach(node => {
            const clone = node.cloneNode(true);
            if (extraAttrs.sceneNumber && this.getType(node) === constants.ELEMENT_TYPES.SLUG) {
                clone.setAttribute('data-scene-number-display', extraAttrs.sceneNumber);
                // Create the visual element for the number
                const numSpan = document.createElement('span');
                numSpan.className = 'scene-number-left';
                numSpan.textContent = `#${extraAttrs.sceneNumber}`;
                clone.prepend(numSpan);
                
                const numSpanRight = document.createElement('span');
                numSpanRight.className = 'scene-number-right';
                numSpanRight.textContent = `#${extraAttrs.sceneNumber}`;
                clone.appendChild(numSpanRight);
            }
            container.appendChild(clone);
        });
    }

    measureBlockHeight(nodes, container) {
        if (!this.measureContainer) {
            this.measureContainer = document.createElement('div');
            this.measureContainer.style.position = 'absolute';
            this.measureContainer.style.visibility = 'hidden';
            this.measureContainer.style.height = 'auto';
            this.measureContainer.style.width = '100%'; // Will inherit from parent
            // IMPORTANT: Copy styles relevant to layout
        }
        
        container.appendChild(this.measureContainer);
        this.measureContainer.innerHTML = '';
        nodes.forEach(node => this.measureContainer.appendChild(node.cloneNode(true)));
        
        const height = this.measureContainer.offsetHeight;
        container.removeChild(this.measureContainer);
        return height;
    }
    
    // Alias for backward compatibility
    measureNodeHeight(nodes, container) {
        return this.measureBlockHeight(Array.isArray(nodes) ? nodes : [nodes], container);
    }

    splitTextNode(node, maxLines, container, type) {
        // We need to find the point in the text where it exceeds maxLines.
        // Binary search or word-by-word. Word-by-word is safer for correctness.
        
        const fullText = node.textContent;
        const words = fullText.split(/(\s+)/); // Keep delimiters
        let currentText = "";
        let splitIndex = -1;
        
        // Optimize: Estimate char count? No, stick to measurement.
        
        // Helper to check height
        const checkHeight = (text) => {
            const tempNode = node.cloneNode(false);
            tempNode.textContent = text;
            return Math.ceil(this.measureBlockHeight([tempNode], container) / this.lineHeightPx);
        };

        let low = 0;
        let high = words.length;
        let bestFitIndex = 0;

        // Linear scan might be slow for long paragraphs, but safe. 
        // Let's try to build up.
        
        for (let i = 0; i < words.length; i++) {
            let testText = currentText + words[i];
            let lines = checkHeight(testText);
            
            if (lines > maxLines) {
                // We exceeded. The previous state was the max.
                // However, we need to check for orphans.
                // If the remaining text is just 1 line, we shouldn't split here if possible?
                // Spec: "A single line... cannot be left at the bottom of a page." -> This refers to the orphan on the OLD page? 
                // "Orphans: A single line of Action or Dialogue cannot be left at the bottom of a page."
                // Usually "Orphan" = First line of paragraph at bottom of page. "Widow" = Last line of paragraph at top of page.
                // The spec phrasing is slightly ambiguous. "Cannot be left at the bottom of a page" suggests ORPHAN protection (don't leave 1 line alone at bottom).
                
                // So, if maxLines < 2, we shouldn't put anything? 
                // Or if we split, we must ensure we have at least 2 lines?
                
                // Let's assume strict maxLines limit.
                splitIndex = i; // The word that broke the camel's back
                break;
            }
            currentText = testText;
            bestFitIndex = i + 1;
        }

        if (bestFitIndex === 0 || bestFitIndex === words.length) {
            return { success: false };
        }

        // Check for Widow (Last line alone on next page)
        // If remaining text is short (1 line), we might want to move an extra line to the next page?
        // But we are constrained by maxLines on THIS page. We can't increase space.
        // So we must move the cut point BACKWARDS.
        
        let firstPartText = words.slice(0, splitIndex).join('');
        let secondPartText = words.slice(splitIndex).join('');

        // Measure second part
        // If second part < 2 lines? Spec doesn't explicitly forbid 1 line at TOP of next page (Widow), 
        // but "Orphans... cannot be left at bottom" is explicit.
        // Common practice: Avoid single lines anywhere.
        
        // Let's enforce: First part must be >= 2 lines (if maxLines >= 2). 
        // Since we filled 'maxLines', it is likely >= 2 unless maxLines=1.
        
        // If maxLines=1, we have an orphan by definition. We should not split, just push whole block.
        if (maxLines < 2) return { success: false };

        const node1 = node.cloneNode(false);
        node1.textContent = firstPartText;
        
        const node2 = node.cloneNode(false);
        node2.textContent = secondPartText;
        
        return { success: true, firstPart: node1, secondPart: node2, linesUsed: maxLines };
    }

    createPage(container, options, pageNum) {
        const page = document.createElement('div');
        page.className = 'page';
        
        // Show header if explicit text is provided OR if showDate option is true
        if (options.headerText || options.showDate) {
            const header = document.createElement('div');
            header.className = 'page-header';
            let text = options.headerText || '';
            
            // Logic handled in SFSS.js: getHeaderText() usually combines title + date if flag is set.
            // But if we want granular control here:
            // Actually, SFSS.js passes `headerText` which ALREADY contains the date if `meta.showDate` is true.
            // So we just need to render it if it's not empty.
            
            // However, the issue description says "#toolbar-date is still not toggling .page-header".
            // This suggests that even if we toggle it, the header might not appear if `headerText` is empty (e.g. no title).
            // We should ensure it renders if showDate is requested, even if title is blank.
            
            // Let's rely on what's passed.
            
            header.textContent = text;
            page.appendChild(header);
        }

        const cw = document.createElement('div');
        cw.className = 'content-wrapper';
        page.appendChild(cw);

        if (options.showPageNumbers !== false) {
             const num = document.createElement('div');
             num.className = 'page-number';
             num.textContent = `${pageNum}.`;
             num.style.display = 'block'; // Force visibility
             page.appendChild(num);
        }

        container.appendChild(page);
        return page;
    }
}