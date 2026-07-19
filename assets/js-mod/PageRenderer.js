import * as constants from './Constants.js';
import { generateLineId, normalizeParenText } from './Utils.js';
import { markupToNodes, serializeBlockElement } from './InlineMarkup.js';

// Matches a trailing "(CONT'D)" on a character cue. Single source of truth for
// both stripping and testing the marker (R6).
const CONTD_RE = /\s*\(CONT'D\)\s*$/i;

// Internal deque marker for forced page breaks (canonical `pageBreak` blocks).
const PAGE_BREAK = '__page-break__';

export class PageRenderer {
    // Legacy callers pass a measured line height; it is tolerated and ignored —
    // geometry is derived from Constants so every consumer paginates identically (R18).
    constructor(_legacyLineHeight) {
        this.formatting = constants.FORMATTING;
        this.paperConfig = constants.PAPER_CONFIGS.US_LETTER; // Default
        this.updateDimensions();

        this._layoutRoot = null;
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

    // Canonical block -> detached rendered element. THE single materialization
    // path: page view, print, reports and FDX geometry all render through here,
    // so their output is pixel-identical and marker-aware.
    //   { id, type, text, centered?, tight?, pageBreak? }
    // Markers (**b** *i* _u_) become styled nodes, [[notes]] are dropped, and
    // parenthetical text loses its outer parens (CSS ::before/::after supplies
    // them — the DOM never carries them).
    renderBlockElement(block, opts = {}) {
        const type = block.type || constants.ELEMENT_TYPES.ACTION;
        const el = document.createElement('div');
        el.className = `script-line ${type}`;
        el.dataset.lineId = block.id || generateLineId();
        let text = block.text || '';
        if (type === constants.ELEMENT_TYPES.PARENTHETICAL) {
            text = normalizeParenText(text);
        }
        el.appendChild(markupToNodes(text, { showNotes: !!opts.showNotes }));
        if (block.centered) el.classList.add('sc-centered');
        if (block.tight) el.classList.add('sc-tight');
        if (block.pageBreak) el.dataset.pageBreak = 'true';
        return el;
    }

    // Accepts either canonical blocks or live DOM elements; elements are
    // serialized through InlineMarkup.serializeBlockElement so EVERY input
    // funnels into the same canonical shape before materialization.
    _normalizeBlocks(source) {
        return Array.from(source || []).map(item =>
            (item && item.nodeType === 1) ? serializeBlockElement(item) : item
        );
    }

    // One persistent offscreen layout root, owned by the renderer. All
    // pagination measurement happens inside it (replaces the ad-hoc hidden
    // containers PrintManager/IOManager/ReportsManager used to create).
    _getLayoutRoot() {
        if (!this._layoutRoot || !this._layoutRoot.isConnected) {
            const root = document.createElement('div');
            root.id = 'sfss-renderer-layout-root';
            Object.assign(root.style, {
                position: 'absolute',
                left: '-9999px',
                top: '0',
                visibility: 'hidden',
                pointerEvents: 'none'
            });
            document.body.appendChild(root);
            this._layoutRoot = root;
        }
        this._layoutRoot.style.width = `${this.paperConfig.dimensions.width}in`;
        return this._layoutRoot;
    }

    // Paginates canonical blocks (or DOM elements) and returns
    //   { pageCount, scenes, totalEighths, pages }
    // where pages are DETACHED .page elements ready to append/clone and
    // scenes is [{ id, number, startPage, endPage, heightPx, eighths }]
    // keyed by slug lineId. Scene height follows the spec ("scene header
    // start to next scene header start", margins included, synthetic
    // pagination furniture included), summed across page splits.
    paginate(source, options = {}) {
        const blocks = this._normalizeBlocks(source);
        const root = this._getLayoutRoot();
        root.innerHTML = '';
        root.classList.toggle('show-scene-numbers', !!options.showSceneNumbers);

        if (blocks.length > 0) {
            this._layout(blocks, root, options);
        }

        const pages = Array.from(root.children);
        const { scenes, totalEighths } = this._collectSceneGeometry(pages, options);
        pages.forEach(p => p.remove());

        return { pageCount: pages.length, scenes, totalEighths, pages };
    }

    render(sourceNodes, container, options = {}) {
        container.innerHTML = '';
        container.classList.toggle('show-scene-numbers', !!options.showSceneNumbers);
        const result = this.paginate(sourceNodes, options);
        result.pages.forEach(page => container.appendChild(page));
        return result;
    }

    // Per-scene geometry, measured while the pages are still attached to the
    // layout root. A scene's height on a page runs from its slug's top (or the
    // page top for continuations) to the next slug's top (or the last node's
    // bottom), so inter-block margins and synthetic (MORE)/(CONT'D) nodes all
    // count — split scenes sum across pages (kills the R2 estimator class).
    _collectSceneGeometry(pages, options) {
        const liveHeightPx = this.paperConfig.liveArea.height * this.dpi;
        const scenes = [];
        const byId = new Map();
        let current = null;

        pages.forEach((page, pageIdx) => {
            const wrapper = page.querySelector('.content-wrapper');
            if (!wrapper || wrapper.childElementCount === 0) return;
            const wrapperTop = wrapper.getBoundingClientRect().top;
            const kids = Array.from(wrapper.children);
            let segStart = null; // top offset where the current scene's segment began

            const closeSegment = (toOffset) => {
                if (current && segStart !== null) {
                    current.heightPx += Math.max(0, toOffset - segStart);
                    current.endPage = pageIdx + 1;
                }
            };

            kids.forEach(node => {
                const rect = node.getBoundingClientRect();
                const top = rect.top - wrapperTop;
                const isSlug = node.classList.contains(constants.ELEMENT_TYPES.SLUG) &&
                    node.dataset.synthetic !== 'true';
                if (isSlug) {
                    closeSegment(top);
                    const id = node.dataset.lineId;
                    current = byId.get(id);
                    if (!current) {
                        const ordinal = scenes.length + 1;
                        current = {
                            id,
                            number: options.sceneNumberMap?.[id] || ordinal,
                            startPage: pageIdx + 1,
                            endPage: pageIdx + 1,
                            heightPx: 0,
                            eighths: 0
                        };
                        byId.set(id, current);
                        scenes.push(current);
                    }
                    segStart = top;
                } else if (current && segStart === null) {
                    // Continuation of a scene split onto this page.
                    segStart = top;
                }
            });

            if (kids.length > 0) {
                const last = kids[kids.length - 1];
                closeSegment(last.getBoundingClientRect().bottom - wrapperTop);
            }
        });

        let totalEighths = 0;
        scenes.forEach(scene => {
            scene.eighths = Math.max(1, Math.round((scene.heightPx / liveHeightPx) * 8));
            totalEighths += scene.eighths;
        });
        return { scenes, totalEighths };
    }

    _layout(blocks, container, options) {
        // Pre-scan the source into logical blocks. Split remainders are pushed
        // back onto the FRONT of this deque, so a remainder longer than a page
        // simply splits again on the next iteration — nothing can overflow (R7).
        const deque = this._buildBlockQueue(blocks, options);

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

            // Forced page break (`===`): the block renders nothing visible —
            // just break, unless the page is already empty.
            if (block.type === PAGE_BREAK) {
                if (contentWrapper.childElementCount > 0) newPage();
                continue;
            }

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
                    this._breakPage(contentWrapper, newPage);
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
                    this._breakPage(contentWrapper, newPage);
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
                this._breakPage(contentWrapper, newPage);
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

    // Pre-scan canonical blocks into logical blocks, materializing each one
    // through renderBlockElement (the single materialization path). Nothing
    // downstream ever touches the caller's live nodes — every element here is
    // freshly built.
    _buildBlockQueue(blocks, options) {
        const queue = [];
        let i = 0;
        let sceneChronologicalIndex = 0;
        while (i < blocks.length) {
            const block = blocks[i];

            // `===` page-break blocks force a break and render nothing.
            if (block.pageBreak) {
                queue.push({ type: PAGE_BREAK, nodes: [] });
                i++;
                continue;
            }

            const type = block.type || constants.ELEMENT_TYPES.ACTION;
            const nodes = [this.renderBlockElement(block)];
            i++;

            if (type === constants.ELEMENT_TYPES.SLUG) {
                sceneChronologicalIndex++;
                if (options.showSceneNumbers) {
                    // Custom number from map wins, else the chronological index.
                    // Numbering is rendered by CSS ::before/::after
                    // content: attr(data-scene-number-display).
                    const num = options.sceneNumberMap?.[block.id] || sceneChronologicalIndex;
                    nodes[0].setAttribute('data-scene-number-display', num);
                }
            } else if (type === constants.ELEMENT_TYPES.CHARACTER) {
                // Include Parentheticals and Dialogue:
                // Char -> (Paren) -> Dialog -> (Paren) -> Dialog...
                while (i < blocks.length && !blocks[i].pageBreak &&
                    (blocks[i].type === constants.ELEMENT_TYPES.PARENTHETICAL ||
                     blocks[i].type === constants.ELEMENT_TYPES.DIALOGUE)) {
                    nodes.push(this.renderBlockElement(blocks[i]));
                    i++;
                }
            }
            // Slugs are their own block; the "carry" rule is handled at placement time.

            queue.push({ type, nodes });
        }
        return queue;
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
    // Walks the offset chain up to the .page (position: relative), so it is
    // correct whether or not .content-wrapper is itself positioned (print.css
    // makes it position: relative), and it measures against the page origin —
    // catching top margins that collapse through the (padding-less) wrapper.
    _contentBottom(contentWrapper, node) {
        const page = contentWrapper.parentElement;
        let top = node.offsetTop;
        let anchor = node.offsetParent;
        while (anchor && anchor !== page && page.contains(anchor)) {
            top += anchor.offsetTop;
            anchor = anchor.offsetParent;
        }
        if (anchor === page) {
            return top - this.marginTopPx + node.offsetHeight;
        }
        // Fallback for exotic contexts: geometric difference.
        return node.getBoundingClientRect().bottom - contentWrapper.getBoundingClientRect().top;
    }

    // Break to a fresh page because the current block is being bumped whole.
    // The slug-carry probe only reserves 2 lines, but a bumped block may have
    // needed more (dialogue splits need cue + 2 lines + (MORE); action splits
    // can fail the widow rule) — so a bump can strand a scene heading as the
    // last line of the old page. Carry that slug over with the block (R5).
    // The slug travels only when something else remains above it.
    _breakPage(contentWrapper, newPage) {
        const last = contentWrapper.lastElementChild;
        const carry = (last &&
            contentWrapper.childElementCount > 1 &&
            last.classList.contains(constants.ELEMENT_TYPES.SLUG)) ? last : null;
        if (carry) carry.remove();
        const wrapper = newPage();
        if (carry) wrapper.appendChild(carry);
        return wrapper;
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
