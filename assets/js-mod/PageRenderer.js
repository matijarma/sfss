import * as constants from './Constants.js';

// Matches a trailing "(CONT'D)" on a character cue. Single source of truth for
// both stripping and testing the marker (R6).
const CONTD_RE = /\s*\(CONT'D\)\s*$/i;

export class PageRenderer {
    // Legacy callers pass a measured line height; it is tolerated and ignored —
    // geometry is derived from Constants so every consumer paginates identically (R18).
    constructor(_legacyLineHeight) {
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
        this.lineHeightPx = this.dpi / this.formatting.LINES_PER_INCH; // 96/6 = 16px (12pt, 6 lines per inch)

        this.pageHeightPx = this.paperConfig.dimensions.height * this.dpi;
        this.marginTopPx = this.paperConfig.margins.top * this.dpi;
        this.marginBottomPx = this.paperConfig.margins.bottom * this.dpi;
        this.contentHeightPx = this.pageHeightPx - this.marginTopPx - this.marginBottomPx;

        // Calculate strict max lines (54 for US Letter)
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

        // Pre-scan the source into logical blocks. Split remainders are pushed
        // back onto the FRONT of this deque, so a remainder longer than a page
        // simply splits again on the next iteration — nothing can overflow (R7).
        const deque = this._buildBlockQueue(sourceNodes, options);

        let pageIndex = 1;
        let currentPage = this.createPage(container, options, pageIndex);
        let contentWrapper = currentPage.querySelector('.content-wrapper');

        const newPage = () => {
            pageIndex++;
            currentPage = this.createPage(container, options, pageIndex);
            contentWrapper = currentPage.querySelector('.content-wrapper');
            return contentWrapper;
        };

        while (deque.length > 0) {
            const block = deque.shift();

            // Materialize continuation remainders: a dialogue split pushed this
            // block back with a {contd} marker — it receives a synthetic
            // "NAME (CONT'D)" cue only now, at placement time (R6).
            let nodes = block.nodes;
            if (block.contd) {
                nodes = [this._makeContdCue(block.cueNode, block.contd), ...nodes];
            }

            // Case A: Scene heading. A slug may only stay on this page if at
            // least 2 lines of the FOLLOWING block fit beneath it (1 line if
            // that block is another slug or a transition). Otherwise the page
            // breaks BEFORE the slug (R5).
            if (block.type === constants.ELEMENT_TYPES.SLUG) {
                const probe = this._makeSlugProbe(deque[0]);
                const tryNodes = probe ? [...nodes, probe] : nodes;
                let placed = this._tryPlace(contentWrapper, tryNodes);
                if (!placed && contentWrapper.childElementCount > 0) {
                    newPage();
                    placed = this._tryPlace(contentWrapper, tryNodes);
                }
                if (placed) {
                    if (probe) placed.pop().remove();
                } else {
                    // Degenerate: slug (+probe) taller than an empty page.
                    this._forcePlace(contentWrapper, nodes);
                }
                continue;
            }

            // Case B: Dialogue block (Character-led).
            if (block.type === constants.ELEMENT_TYPES.CHARACTER) {
                let placed = this._tryPlace(contentWrapper, nodes);
                if (placed) continue;

                let split = this._splitDialogue(contentWrapper, nodes);
                if (!split && contentWrapper.childElementCount > 0) {
                    // Not enough room to split here: bump the WHOLE block to the
                    // next page, unchanged — bumped blocks never get (CONT'D) (R6).
                    newPage();
                    placed = this._tryPlace(contentWrapper, nodes);
                    if (placed) continue;
                    split = this._splitDialogue(contentWrapper, nodes);
                }

                if (split) {
                    const cueNode = nodes[0];
                    const charName = cueNode.textContent.replace(CONTD_RE, '').trim();
                    deque.unshift({
                        type: constants.ELEMENT_TYPES.CHARACTER,
                        nodes: split.remainder,
                        contd: charName,
                        cueNode: cueNode
                    });
                    newPage();
                } else if (!placed) {
                    // Degenerate: unsplittable block taller than an empty page.
                    this._forcePlace(contentWrapper, nodes);
                }
                continue;
            }

            // Case C: Action / Transition (and stray Dialogue or Parenthetical
            // without a Character cue). Fits whole, or splits recursively.
            let placed = this._tryPlace(contentWrapper, nodes);
            if (placed) continue;

            let split = nodes.length === 1
                ? this._splitTextNode(contentWrapper, [], nodes[0], [])
                : { success: false };
            if (!split.success && contentWrapper.childElementCount > 0) {
                newPage();
                placed = this._tryPlace(contentWrapper, nodes);
                if (placed) continue;
                if (nodes.length === 1) {
                    split = this._splitTextNode(contentWrapper, [], nodes[0], []);
                }
            }

            if (split.success) {
                if (!this._tryPlace(contentWrapper, [split.firstPart])) {
                    this._forcePlace(contentWrapper, [split.firstPart]);
                }
                deque.unshift({ type: block.type, nodes: [split.secondPart] });
                newPage();
            } else if (!placed) {
                // Degenerate: unsplittable node taller than an empty page.
                this._forcePlace(contentWrapper, nodes);
            }
        }
    }

    // Pre-scan sourceNodes into logical blocks. Nodes are cloned once here so
    // nothing downstream ever touches the caller's (editor's) live nodes.
    _buildBlockQueue(sourceNodes, options) {
        const queue = [];
        let i = 0;
        let sceneChronologicalIndex = 0;
        while (i < sourceNodes.length) {
            const { blockNodes, type, nextIndex } = this.getNextLogicalBlock(sourceNodes, i);
            const nodes = blockNodes.map(n => n.cloneNode(true));
            if (type === constants.ELEMENT_TYPES.SLUG) {
                sceneChronologicalIndex++;
                if (options.showSceneNumbers) {
                    const id = blockNodes[0].dataset.lineId;
                    // Use custom number from map if it exists, otherwise fall back to chronological index
                    const num = options.sceneNumberMap?.[id] || sceneChronologicalIndex;
                    // Numbering is rendered by CSS ::before/::after content: attr(data-scene-number-display)
                    nodes[0].setAttribute('data-scene-number-display', num);
                }
            }
            queue.push({ type, nodes });
            i = nextIndex;
        }
        return queue;
    }

    getNextLogicalBlock(nodes, startIndex) {
        const firstNode = nodes[startIndex];
        const type = this.getType(firstNode);
        const blockNodes = [firstNode];
        let nextIndex = startIndex + 1;

        if (type === constants.ELEMENT_TYPES.CHARACTER) {
            // Include Parentheticals and Dialogue: Char -> (Paren) -> Dialog -> (Paren) -> Dialog...
            while (nextIndex < nodes.length) {
                const nextNode = nodes[nextIndex];
                const nextType = this.getType(nextNode);
                if (nextType === constants.ELEMENT_TYPES.PARENTHETICAL || nextType === constants.ELEMENT_TYPES.DIALOGUE) {
                    blockNodes.push(nextNode);
                    nextIndex++;
                } else {
                    break;
                }
            }
        }
        // Slugs are their own block; the "carry" rule is handled at placement time.

        return { blockNodes, type, nextIndex };
    }

    // --- Place-then-check measurement (R12) ---
    // All fit decisions go through the REAL content wrapper, so sibling margin
    // collapse is modeled exactly. Appends clones of `nodes`; if the last one
    // ends within the live area (1px epsilon) the clones stay and are returned,
    // otherwise they are removed and false is returned.
    _tryPlace(contentWrapper, nodes) {
        if (!nodes || nodes.length === 0) return [];
        const clones = this._forcePlace(contentWrapper, nodes);
        const last = clones[clones.length - 1];
        if (this._contentBottom(contentWrapper, last) <= this.contentHeightPx + 1) {
            return clones;
        }
        clones.forEach(c => c.remove());
        return false;
    }

    _forcePlace(contentWrapper, nodes) {
        const clones = nodes.map(n => n.cloneNode(true));
        clones.forEach(c => contentWrapper.appendChild(c));
        return clones;
    }

    // Bottom edge of `node` relative to the top of the page's live area.
    // The content wrapper is NOT a positioned element, so offsetTop is relative
    // to the .page (position: relative). Measuring against the page origin also
    // catches top margins that collapse through the (padding-less) wrapper.
    _contentBottom(contentWrapper, node) {
        const page = contentWrapper.parentElement;
        if (node.offsetParent === page) {
            return node.offsetTop - this.marginTopPx + node.offsetHeight;
        }
        if (node.offsetParent === contentWrapper) {
            return node.offsetTop + node.offsetHeight;
        }
        // Fallback for exotic contexts: geometric difference.
        return node.getBoundingClientRect().bottom - contentWrapper.getBoundingClientRect().top;
    }

    // Probe used by the slug-carry rule (R5): an empty element with the classes
    // (and therefore margins) of the next block's first node, sized to the
    // number of lines the slug must carry with it.
    _makeSlugProbe(nextBlock) {
        if (!nextBlock || !nextBlock.nodes || nextBlock.nodes.length === 0) return null;
        const linesNeeded = (nextBlock.type === constants.ELEMENT_TYPES.SLUG ||
                             nextBlock.type === constants.ELEMENT_TYPES.TRANSITION) ? 1 : 2;
        const probe = nextBlock.nodes[0].cloneNode(false);
        probe.textContent = '';
        probe.style.height = `${linesNeeded * this.lineHeightPx}px`;
        probe.style.minHeight = probe.style.height;
        return probe;
    }

    // Synthetic pagination nodes carry data-synthetic="true" so consumers (and
    // tests) can separate generated furniture from source text.
    _makeMoreNode() {
        const el = document.createElement('div');
        el.className = 'script-line sc-more';
        el.dataset.synthetic = 'true';
        el.textContent = '(MORE)';
        return el;
    }

    _makeContdCue(cueNode, charName) {
        const cue = cueNode.cloneNode(true);
        cue.textContent = `${charName} (CONT'D)`;
        cue.dataset.synthetic = 'true';
        return cue;
    }

    // Split a Character-led block so the page ends with (MORE). Prefers the
    // latest possible cut: inside the last dialogue node first, then between
    // nodes, walking backwards. Returns { remainder } with the split's page
    // nodes already placed, or null when no legal cut exists (caller bumps).
    _splitDialogue(contentWrapper, nodes) {
        const moreNode = this._makeMoreNode();
        for (let j = nodes.length - 1; j >= 1; j--) {
            if (this.getType(nodes[j]) !== constants.ELEMENT_TYPES.DIALOGUE) continue;

            // (a) Cut BETWEEN nodes, after dialogue node j (only if something follows).
            if (j < nodes.length - 1) {
                const placed = this._tryPlace(contentWrapper, [...nodes.slice(0, j + 1), moreNode]);
                if (placed) {
                    // Orphan rule: never leave a single dialogue line above (MORE).
                    const cutClone = placed[placed.length - 2];
                    if (cutClone.offsetHeight >= 2 * this.lineHeightPx - 1) {
                        return { remainder: nodes.slice(j + 1) };
                    }
                    placed.forEach(el => el.remove());
                }
            }

            // (b) Cut INSIDE dialogue node j.
            const prefix = nodes.slice(0, j);
            const split = this._splitTextNode(contentWrapper, prefix, nodes[j], [moreNode]);
            if (split.success) {
                if (!this._tryPlace(contentWrapper, [...prefix, split.firstPart, moreNode])) {
                    this._forcePlace(contentWrapper, [...prefix, split.firstPart, moreNode]);
                }
                return { remainder: [split.secondPart, ...nodes.slice(j + 1)] };
            }
        }
        return null;
    }

    // Binary search over the word index for the max prefix of `node`'s text
    // that fits the current page when placed after `contextNodes` and followed
    // by `tailNodes` (R27: one in-situ measurement per iteration).
    // Widow rule (R9): if the remainder would be < 2 lines, retreat the cut by
    // one line; if that leaves the first part < 2 lines, fail (caller bumps).
    _splitTextNode(contentWrapper, contextNodes, node, tailNodes) {
        const parts = node.textContent.split(/(\s+)/);
        const wordIdx = [];
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].trim() !== '') wordIdx.push(i);
        }
        if (wordIdx.length < 2) return { success: false };

        const makeFirst = (k) => { // first k words
            const clone = node.cloneNode(false);
            clone.textContent = parts.slice(0, wordIdx[k - 1] + 1).join('').replace(/\s+$/, '');
            return clone;
        };
        const makeSecond = (k) => { // everything after the first k words
            const clone = node.cloneNode(false);
            clone.textContent = parts.slice(wordIdx[k - 1] + 1).join('').replace(/^\s+/, '');
            return clone;
        };
        const fits = (k) => {
            const placed = this._tryPlace(contentWrapper, [...contextNodes, makeFirst(k), ...tailNodes]);
            if (!placed) return false;
            placed.forEach(el => el.remove());
            return true;
        };
        const measureLines = (el) => {
            contentWrapper.appendChild(el);
            const lines = Math.max(1, Math.round(el.offsetHeight / this.lineHeightPx));
            el.remove();
            return lines;
        };

        // Upper bound: more characters than a full page can hold in any column
        // can never fit, so cap the search range (keeps probe clones small).
        const charsPerLine = Math.ceil(this.paperConfig.liveArea.width / this.formatting.CHAR_WIDTH_INCH);
        const maxChars = (this.maxLinesPerPage + 2) * (charsPerLine + 1);
        let hi = wordIdx.length - 1;
        let cum = 0;
        for (let k = 1; k <= wordIdx.length - 1; k++) {
            cum += parts[wordIdx[k - 1]].length + 1;
            if (cum > maxChars) { hi = Math.min(hi, k); break; }
        }

        // Max k in [1, hi] such that the first k words (+ tail) fit.
        let lo = 1;
        let best = 0;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (fits(mid)) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        if (best === 0) return { success: false };

        let cut = best;
        let firstNode = makeFirst(cut);
        let secondNode = makeSecond(cut);
        let firstLines = measureLines(firstNode);
        // Long remainders are trivially >= 2 lines; only measure near the boundary.
        let secondLines = secondNode.textContent.length > 4 * charsPerLine
            ? 2
            : measureLines(secondNode);

        if (secondLines < 2) {
            // Retreat the cut by one line.
            const targetLines = firstLines - 1;
            if (targetLines < 2) return { success: false };
            let rLo = 1, rHi = cut, retreat = 0;
            while (rLo <= rHi) {
                const mid = (rLo + rHi) >> 1;
                if (measureLines(makeFirst(mid)) <= targetLines) { retreat = mid; rLo = mid + 1; } else { rHi = mid - 1; }
            }
            if (retreat === 0) return { success: false };
            cut = retreat;
            firstNode = makeFirst(cut);
            secondNode = makeSecond(cut);
            firstLines = measureLines(firstNode);
            secondLines = measureLines(secondNode);
        }

        if (firstLines < 2 || secondLines < 2) return { success: false };
        return { success: true, firstPart: firstNode, secondPart: secondNode };
    }

    measureBlockHeight(nodes, container) {
        if (!this.measureContainer) {
            this.measureContainer = document.createElement('div');
            this.measureContainer.style.position = 'absolute';
            this.measureContainer.style.visibility = 'hidden';
            this.measureContainer.style.height = 'auto';
            this.measureContainer.style.width = '100%'; // Will inherit from parent
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

    createPage(container, options, pageNum) {
        const page = document.createElement('div');
        page.className = 'page';
        if (options.showSceneNumbers) page.classList.add('show-scene-numbers');
        page.dataset.pageNumber = pageNum;
        const suppressMeta = options.hideFirstPageMeta && pageNum === 1;

        // Show header if explicit text is provided OR if showDate option is true
        if ((options.headerText || options.showDate) && !suppressMeta) {
            const header = document.createElement('div');
            header.className = 'page-header';
            let text = options.headerText || '';

            // SFSS.js passes `headerText` which ALREADY contains the date if
            // `meta.showDate` is true; we just render whatever we were given.

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

        if (suppressMeta) {
            page.classList.add('page--suppress-meta');
        }

        container.appendChild(page);
        return page;
    }
}
