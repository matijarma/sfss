// Find & Replace panel: the UI and DOM side of FindReplaceCore.
//
// The panel is a NON-MODAL <dialog> (dialog.show(), not in the top layer),
// so the writer keeps typing in the script while it is open and the app's
// own modals still cover it. It is deliberately not on ModalManager's stack
// (no aria-modal, no focus trap).
//
// It reads the live editor lines, never a cached copy, and re-reads them
// again at the moment of replacing — stale results are never written over
// newer text. Replacements follow the editor's one-undo-step pattern:
// saveState(true) -> change -> isDirty -> saveState(true).
//
// Write view only: Treatment and Page View render the script differently
// (no editable lines), and mobile cannot edit the script at all.

import * as constants from './Constants.js';
import * as Shortcuts from './Shortcuts.js';
import { FIND_META_TYPE, searchLines, applyMatches, fieldValues, matchKey, shiftKey } from './FindReplaceCore.js';
import { textRange, setTextRange, getTextOffset } from './InlineMarkup.js';
import { toast } from './Toast.js';

const FIND_HL_ALL = 'sfss-find';
const FIND_HL_CURRENT = 'sfss-find-current';
const FIND_MAX_HIGHLIGHTS = 2000;
const FIND_MAX_ROWS = 300;
const FIND_SNIPPET_CONTEXT = 26;

const FIND_SLUG_MODES = ['prefix', 'location', 'time'];

const FIND_CHIPS = [
    { type: constants.ELEMENT_TYPES.SLUG, label: 'Scene heading' },
    { type: constants.ELEMENT_TYPES.ACTION, label: 'Action' },
    { type: constants.ELEMENT_TYPES.CHARACTER, label: 'Character' },
    { type: constants.ELEMENT_TYPES.DIALOGUE, label: 'Dialogue' },
    { type: constants.ELEMENT_TYPES.PARENTHETICAL, label: 'Parenthetical' },
    { type: constants.ELEMENT_TYPES.TRANSITION, label: 'Transition' },
    { type: FIND_META_TYPE, label: 'Scene notes' }
];

export class FindReplaceManager {
    constructor(app) {
        this.app = app;
        this.dialog = document.getElementById('find-panel');
        if (!this.dialog) return; // markup absent (stripped build): feature off

        this.header = document.getElementById('find-panel-header');
        this.modeSelect = document.getElementById('find-mode');
        this.chipsEl = document.getElementById('find-chips');
        this.findLabel = document.getElementById('find-input-label');
        this.findInput = document.getElementById('find-input');
        this.replaceLabel = document.getElementById('find-replace-label');
        this.replaceInput = document.getElementById('find-replace-input');
        this.optCase = document.getElementById('find-opt-case');
        this.optWord = document.getElementById('find-opt-word');
        this.optEntire = document.getElementById('find-opt-entire');
        this.optKeepCase = document.getElementById('find-opt-keepcase');
        this.countEl = document.getElementById('find-count');
        this.prevBtn = document.getElementById('find-prev-btn');
        this.nextBtn = document.getElementById('find-next-btn');
        this.replaceBtn = document.getElementById('find-replace-btn');
        this.replaceAllBtn = document.getElementById('find-replace-all-btn');
        this.statusEl = document.getElementById('find-status');
        this.resultsEl = document.getElementById('find-results');

        const T = constants.ELEMENT_TYPES;
        this.state = {
            mode: 'text',
            textTypes: new Set([T.SLUG, T.ACTION, T.CHARACTER, T.DIALOGUE, T.PARENTHETICAL, T.TRANSITION]),
            mentionTypes: new Set([T.SLUG, T.ACTION, T.DIALOGUE, T.PARENTHETICAL, FIND_META_TYPE]),
            matchCase: false,
            wholeWord: false,
            entireValue: true,
            keepCase: false
        };

        this.lines = [];
        this.matches = [];
        this.ranges = [];
        this.current = -1;
        this.overrides = new Map();   // matchKey -> boolean (the writer's own ticks)
        this.anchor = null;           // caret position the panel was opened from
        this.showAllRows = false;
        this.lastAction = null;       // { count, lines } of the latest replace
        this.note = '';
        this.lastGeometry = null;
        this.fallbackLine = null;
        this.searchTimer = null;
        this.renderTimer = null;
        this.topRoom = 0;        // temporary scroll room above the page (px)
        this.topRoomBase = 0;
        this.positioned = false;
        this.canHighlight = typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';

        this.bind();
    }

    get isOpen() {
        return !!this.dialog && this.dialog.open;
    }

    // ---------- Availability ----------

    // Whether the panel may open right now. Anywhere else the browser keeps
    // Ctrl+F, so its own find still works in Page View, Treatment, dialogs.
    isAvailable() {
        const app = this.app;
        if (!this.dialog) return false;
        if (document.body.classList.contains('mobile-view')) return false;
        if (app.tabGuard && app.tabGuard.passive) return false;
        if (app.treatmentModeActive || app.pageViewActive) return false;
        if (app.modalManager.stack.length > 0) return false;
        if (document.querySelector('.modal-overlay:not(.hidden)')) return false;
        return true;
    }

    // '' when replacing is allowed, otherwise the reason shown to the writer.
    // Flags are checked directly: editor.isContentEditable alone is not
    // reliable (some code paths re-enable it unconditionally).
    readOnlyReason() {
        const app = this.app;
        const collab = app.collaborationManager;
        if (app.tabGuard && app.tabGuard.passive) return 'This tab is read-only.';
        if (collab && collab.room && !collab.hasBaton) return 'Read-only: another writer holds the baton.';
        if (app.treatmentModeActive || app.pageViewActive || document.body.classList.contains('mobile-view')) {
            return 'Replacing works in the Write view.';
        }
        return '';
    }

    // Global shortcut entry (SFSS window keydown). Returns true if consumed.
    //   Windows/Linux: Ctrl+F find, Ctrl+H replace. AltGr arrives as
    //     Ctrl+Alt there (AltGr+F types "[" on Croatian layouts), so Alt
    //     must be up.
    //   Mac: ⌘F find, ⌘⌥F replace (⌘H hides the app). Control+F / Control+H
    //     move the caret in macOS text fields and are left alone.
    handleGlobalKey(e) {
        if (!this.dialog) return false;
        const key = (e.key || '').toLowerCase();
        let action = null;
        if (Shortcuts.IS_MAC) {
            if (e.metaKey && !e.ctrlKey && !e.shiftKey) {
                if (!e.altKey && key === 'f') action = 'find';
                else if (e.altKey && e.code === 'KeyF') action = 'replace';
            }
        } else if (e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
                   !(e.getModifierState && e.getModifierState('AltGraph'))) {
            if (key === 'f') action = 'find';
            else if (key === 'h') action = 'replace';
        }
        if (!action || !this.isAvailable()) return false;
        // Second Ctrl+F while already in the Find field: let the browser's
        // own find through.
        if (action === 'find' && this.isOpen && document.activeElement === this.findInput) return false;
        e.preventDefault();
        this.open({ focus: action });
        return true;
    }

    // ---------- Open / close ----------

    open({ focus = 'find' } = {}) {
        if (!this.dialog) return;
        if (!this.isAvailable()) {
            toast('Find & Replace works in the Write view');
            return;
        }
        const seed = this.selectionSeed();
        const anchor = this.caretAnchor();
        if (anchor) this.anchor = anchor;
        this.app.editorHandler.closePopups();

        if (!this.dialog.open) {
            this.dialog.show();
            this.place();
            this.lastAction = null;
        }
        if (seed) this.findInput.value = seed;
        this.syncControls();
        this.runSearch({ fromAnchor: true });

        const field = focus === 'replace' ? this.replaceInput : this.findInput;
        field.focus();
        field.select();
    }

    // selectMatch: put the editor selection on the current match (Esc from
    // the panel). focusEditor false: leave focus alone (a view is changing).
    close({ selectMatch = false, focusEditor = true } = {}) {
        if (!this.isOpen) return;
        const m = this.matches[this.current];
        const line = m ? this.lines[m.lineIndex] : null;
        clearTimeout(this.searchTimer);
        this.clearHighlights();
        this.removeTopRoom();
        this.dialog.close();
        if (!focusEditor) return;
        // dialog.close() hands focus back to whatever opened the panel (a
        // menu item would reopen its dropdown): always land in the script.
        const editor = this.app.editor;
        editor.focus({ preventScroll: true });
        if (selectMatch && line && line.el && line.el.isConnected &&
            line.el.textContent.slice(m.start, m.end) === m.text) {
            setTextRange(line.el, m.start, m.end);
        }
    }

    // Top-right of the writing area, below the "Saved" label, unless the
    // writer has dragged it somewhere still on screen.
    place() {
        const rect = this.dialog.getBoundingClientRect();
        const onScreen = this.positioned && rect.left >= 0 && rect.top >= 0 &&
            rect.right <= window.innerWidth && rect.top <= window.innerHeight - 60;
        if (onScreen) return;
        const main = document.getElementById('main-area');
        const top = (main ? main.getBoundingClientRect().top : 56) + 44;
        const left = Math.max(8, window.innerWidth - rect.width - 24);
        this.dialog.style.top = `${top}px`;
        this.dialog.style.left = `${left}px`;
        this.positioned = true;
    }

    // A short single-line selection in the script pre-fills Find.
    selectionSeed() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return '';
        const range = sel.getRangeAt(0);
        if (!this.app.editor.contains(range.commonAncestorContainer)) return '';
        const text = sel.toString();
        if (!text.trim() || text.length > 80 || /[\r\n]/.test(text)) return '';
        return text.trim();
    }

    caretAnchor() {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        let node = sel.getRangeAt(0).startContainer;
        if (!this.app.editor.contains(node)) return null;
        if (node.nodeType === 3) node = node.parentNode;
        const block = node.closest ? node.closest('.script-line') : null;
        if (!block) return null;
        return { lineId: block.dataset.lineId, offset: getTextOffset(block) ?? 0 };
    }

    // ---------- Wiring ----------

    bind() {
        this.modeSelect.addEventListener('change', () => {
            this.state.mode = this.modeSelect.value;
            this.overrides.clear();
            this.lastAction = null;
            this.note = '';
            this.syncControls();
            this.runSearch({ fromAnchor: true });
            this.findInput.focus();
        });

        this.chipsEl.addEventListener('click', (e) => {
            const chip = e.target.closest('button[data-type]');
            if (!chip) return;
            const set = this.state.mode === 'character' ? this.state.mentionTypes : this.state.textTypes;
            if (set.has(chip.dataset.type)) set.delete(chip.dataset.type);
            else set.add(chip.dataset.type);
            this.syncControls();
            this.runSearch();
        });

        const toggle = (btn, key) => btn.addEventListener('click', () => {
            this.state[key] = !this.state[key];
            this.syncControls();
            this.runSearch();
        });
        toggle(this.optCase, 'matchCase');
        toggle(this.optWord, 'wholeWord');
        toggle(this.optEntire, 'entireValue');
        toggle(this.optKeepCase, 'keepCase');

        this.findInput.addEventListener('input', () => {
            this.lastAction = null;
            this.note = '';
            this.scheduleSearch(120, { fromAnchor: true });
        });
        this.replaceInput.addEventListener('input', () => this.scheduleRender(120));

        this.prevBtn.addEventListener('click', () => this.step(-1));
        this.nextBtn.addEventListener('click', () => this.step(1));
        this.replaceBtn.addEventListener('click', () => this.replaceCurrent());
        this.replaceAllBtn.addEventListener('click', () => this.replaceAll());
        document.getElementById('find-close-btn').addEventListener('click', () => this.close({ selectMatch: true }));

        this.statusEl.addEventListener('click', (e) => {
            if (e.target.closest('#find-undo-btn')) this.undoLast();
        });

        this.resultsEl.addEventListener('click', (e) => {
            const value = e.target.closest('button[data-value]');
            if (value) {
                this.findInput.value = value.dataset.value;
                this.runSearch({ fromAnchor: true });
                this.replaceInput.focus();
                return;
            }
            if (e.target.closest('#find-show-all')) {
                this.showAllRows = true;
                this.render();
                return;
            }
            const row = e.target.closest('[data-index]');
            if (!row) return;
            const index = Number(row.dataset.index);
            if (e.target.matches('input[type="checkbox"]')) {
                const m = this.matches[index];
                if (m) this.overrides.set(matchKey(m), e.target.checked);
                this.render();
                return;
            }
            this.goTo(index);
        });

        // The panel owns its keys: Esc is consumed here so the app's single
        // Escape handler never also acts on it.
        this.dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.close({ selectMatch: true });
                return;
            }
            if (e.key !== 'Enter' || e.isComposing) return;
            if (e.target.closest('button, select, input[type="checkbox"]') && !(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) this.replaceAll();
            else if (e.target === this.replaceInput) this.replaceCurrent();
            else this.step(e.shiftKey ? -1 : 1);
        });

        // The document can change under an open panel: typing, undo/redo,
        // imports, remote collaboration updates.
        this.app.editor.addEventListener('input', () => {
            if (this.isOpen) this.scheduleSearch(200);
        });
        document.addEventListener('sfss-geometry', (e) => {
            // Fires after every keyup, changed or not: the cached result
            // keeps its identity when nothing moved.
            if (!this.isOpen || e.detail === this.lastGeometry) return;
            this.lastGeometry = e.detail;
            this.scheduleSearch(60);
        });

        if (this.app.sidebarManager && this.app.sidebarManager.initDraggable) {
            this.app.sidebarManager.initDraggable(this.dialog, this.header);
        }
    }

    scheduleSearch(delay, opts) {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => { if (this.isOpen) this.runSearch(opts); }, delay);
    }

    scheduleRender(delay) {
        clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => { if (this.isOpen) this.render(); }, delay);
    }

    // ---------- Search ----------

    currentTarget() {
        const s = this.state;
        if (s.mode === 'text') return { kind: 'text', types: [...s.textTypes] };
        if (s.mode === 'character') return { kind: 'character', mentionTypes: [...s.mentionTypes] };
        return { kind: 'slug', part: s.mode };
    }

    currentOptions() {
        const s = this.state;
        return {
            matchCase: s.mode === 'text' && s.matchCase,
            wholeWord: s.mode !== 'character' && s.wholeWord,
            entireValue: s.entireValue,
            keepCase: s.mode === 'text' && s.keepCase,
            query: this.findInput.value
        };
    }

    wantsSceneNotes() {
        const s = this.state;
        if (s.mode === 'text') return s.textTypes.has(FIND_META_TYPE);
        if (s.mode === 'character') return s.mentionTypes.has(FIND_META_TYPE);
        return false;
    }

    // Live lines straight from the editor DOM, in document order. Scene
    // descriptions and notes ride along as virtual lines after their heading.
    collectLines() {
        const app = this.app;
        const lines = [];
        const withNotes = this.wantsSceneNotes();
        let sceneNo = 0;
        for (const el of app.editor.querySelectorAll('.script-line')) {
            const type = app.editorHandler.getBlockType(el);
            const id = el.dataset.lineId;
            if (type === constants.ELEMENT_TYPES.SLUG) sceneNo++;
            lines.push({ id, type, text: el.textContent, el, sceneNo });
            if (withNotes && type === constants.ELEMENT_TYPES.SLUG) {
                const meta = app.sceneMeta[id];
                for (const field of ['description', 'notes']) {
                    if (meta && typeof meta[field] === 'string' && meta[field]) {
                        lines.push({ id: `meta:${id}:${field}`, type: FIND_META_TYPE, text: meta[field], sceneId: id, metaField: field, sceneNo });
                    }
                }
            }
        }
        return lines;
    }

    isTicked(m) {
        const key = matchKey(m);
        return this.overrides.has(key) ? this.overrides.get(key) : m.ticked;
    }

    // Keeps the writer's ticks attached to "the same" match when a line was
    // edited outside the panel and offsets moved: same line, same text, same
    // occurrence number.
    carryOverrides(oldLines, oldMatches, newLines, newMatches) {
        if (!this.overrides.size) return;
        const oldText = new Map(oldLines.map(l => [l.id, l.text]));
        const changed = new Set(newLines.filter(l => oldText.has(l.id) && oldText.get(l.id) !== l.text).map(l => l.id));
        const nth = (list) => {
            const seen = new Map();
            return list.map(m => {
                const k = `${m.lineId}|${m.text}`;
                const n = seen.get(k) || 0;
                seen.set(k, n + 1);
                return `${k}|${n}`;
            });
        };
        const oldNth = nth(oldMatches);
        const carried = new Map();
        oldMatches.forEach((m, i) => {
            const key = matchKey(m);
            if (this.overrides.has(key) && changed.has(m.lineId)) carried.set(oldNth[i], this.overrides.get(key));
        });
        const newNth = nth(newMatches);
        const next = new Map();
        newMatches.forEach((m, i) => {
            const key = matchKey(m);
            if (changed.has(m.lineId)) {
                if (carried.has(newNth[i])) next.set(key, carried.get(newNth[i]));
            } else if (this.overrides.has(key)) {
                next.set(key, this.overrides.get(key));
            }
        });
        this.overrides = next;
    }

    // fromAnchor: restart from the caret the panel was opened at (a new
    // query). anchor: restart from an explicit position (just past a match
    // that was replaced). Otherwise the current match is kept.
    runSearch({ fromAnchor = false, anchor = null, render = true } = {}) {
        clearTimeout(this.searchTimer);
        const oldLines = this.lines;
        const oldMatches = this.matches;
        const currentKey = this.matches[this.current] ? matchKey(this.matches[this.current]) : null;

        this.lines = this.collectLines();
        this.matches = searchLines(this.lines, this.currentTarget(), this.findInput.value, this.currentOptions()).matches;
        this.carryOverrides(oldLines, oldMatches, this.lines, this.matches);

        const startAt = anchor || (fromAnchor ? this.anchor : null);
        let index = -1;
        if (!startAt && currentKey) index = this.matches.findIndex(m => matchKey(m) === currentKey);
        if (index === -1) index = this.firstIndexFromAnchor(startAt, this.current);
        this.current = index;
        this.showAllRows = this.showAllRows && this.matches.length > FIND_MAX_ROWS;
        if (!render) return;
        this.render();
        // A new query (or resuming after a replace) shows where it landed;
        // re-searches caused by typing in the script never move the view.
        const m = startAt ? this.matches[this.current] : null;
        if (m && this.lines[m.lineIndex].el) this.reveal(this.lines[m.lineIndex].el, this.ranges[this.current]);
    }

    // First match at or after the caret the panel was opened from; failing
    // that, keep the position in the list (after a replace the next match
    // slides into the same index).
    firstIndexFromAnchor(anchor, previousIndex) {
        if (!this.matches.length) return -1;
        if (anchor) {
            const lineIndex = this.lines.findIndex(l => l.id === anchor.lineId);
            if (lineIndex !== -1) {
                const i = this.matches.findIndex(m =>
                    m.lineIndex > lineIndex || (m.lineIndex === lineIndex && m.end > anchor.offset));
                return i === -1 ? 0 : i;
            }
        }
        if (previousIndex >= 0) return Math.min(previousIndex, this.matches.length - 1);
        return 0;
    }

    // ---------- Navigation ----------

    step(delta) {
        const n = this.matches.length;
        if (!n) return;
        this.goTo(((this.current < 0 ? (delta > 0 ? -1 : 0) : this.current) + delta + n) % n);
    }

    goTo(index) {
        const m = this.matches[index];
        if (!m) return;
        this.current = index;
        const line = this.lines[m.lineIndex];
        if (line.el) this.reveal(line.el, this.ranges[index]);
        else if (line.sceneId) this.app.scrollToScene(line.sceneId); // a scene note has no line of its own
        this.paintCurrent();
        this.renderCount();
        this.syncButtons();
        this.resultsEl.querySelectorAll('.find-result.current').forEach(r => r.classList.remove('current'));
        const row = this.resultsEl.querySelector(`[data-index="${index}"]`);
        if (row) {
            row.classList.add('current');
            row.scrollIntoView({ block: 'nearest' });
        }
    }

    // Brings a match on screen and out from under the panel, which floats
    // over the right side of the page: the match is scrolled to just below
    // the panel. Near the top of the script there is nothing to scroll, so
    // temporary room is added above the page first (see addTopRoom).
    reveal(el, range) {
        if (!this.app.isElementInViewport(el)) el.scrollIntoView({ block: 'center' });
        const rect = (range || el).getBoundingClientRect();
        const panel = this.dialog.getBoundingClientRect();
        const covered = rect.right > panel.left && rect.left < panel.right &&
            rect.bottom > panel.top && rect.top < panel.bottom;
        if (!covered) return;
        const scroller = document.getElementById('scroll-area');
        if (!scroller || window.innerHeight - panel.bottom < 80) return; // no room below: drag the panel
        const down = (panel.bottom + 24) - rect.top; // how far the text must move down
        if (down > scroller.scrollTop) this.addTopRoom(scroller, down - scroller.scrollTop);
        scroller.scrollTop -= down;
    }

    // Extra scroll room above the page while the panel is open. The scroll
    // position is moved by the same amount, so nothing shifts on screen — it
    // only becomes possible to scroll the first lines further down.
    addTopRoom(scroller, px) {
        if (!this.topRoom) this.topRoomBase = parseFloat(getComputedStyle(scroller).paddingTop) || 0;
        this.topRoom = (this.topRoom || 0) + Math.ceil(px);
        scroller.style.paddingTop = `${this.topRoomBase + this.topRoom}px`;
        scroller.scrollTop += Math.ceil(px);
    }

    removeTopRoom() {
        if (!this.topRoom) return;
        const scroller = document.getElementById('scroll-area');
        if (scroller) {
            const top = scroller.scrollTop;
            scroller.style.paddingTop = '';
            scroller.scrollTop = Math.max(0, top - this.topRoom);
        }
        this.topRoom = 0;
    }

    // ---------- Highlights ----------

    buildRanges() {
        this.ranges = [];
        if (!this.canHighlight) return;
        let made = 0;
        this.matches.forEach((m, i) => {
            const line = this.lines[m.lineIndex];
            if (!line.el || (made >= FIND_MAX_HIGHLIGHTS && i !== this.current)) return;
            const range = textRange(line.el, m.start, m.end);
            if (range) { this.ranges[i] = range; made++; }
        });
    }

    // CSS Custom Highlight API: styles the ranges without touching the
    // editor's DOM (injected <mark>s would be wiped by decorateBlock and
    // typed into). Without the API the current match's line is outlined.
    paintCurrent() {
        if (this.canHighlight) {
            const all = new Highlight();
            const cur = new Highlight();
            this.ranges.forEach((range, i) => { if (range) (i === this.current ? cur : all).add(range); });
            cur.priority = 1;
            CSS.highlights.delete(FIND_HL_ALL);
            CSS.highlights.delete(FIND_HL_CURRENT);
            CSS.highlights.set(FIND_HL_ALL, all);
            CSS.highlights.set(FIND_HL_CURRENT, cur);
            return;
        }
        if (this.fallbackLine) this.fallbackLine.classList.remove('find-current-line');
        const m = this.matches[this.current];
        this.fallbackLine = m ? this.lines[m.lineIndex].el || null : null;
        if (this.fallbackLine) this.fallbackLine.classList.add('find-current-line');
    }

    clearHighlights() {
        if (this.canHighlight) {
            CSS.highlights.delete(FIND_HL_ALL);
            CSS.highlights.delete(FIND_HL_CURRENT);
        }
        if (this.fallbackLine) this.fallbackLine.classList.remove('find-current-line');
        this.fallbackLine = null;
        this.ranges = [];
    }

    // ---------- Replace ----------

    replaceCurrent() {
        const cur = this.matches[this.current];
        if (!cur) return;
        const key = matchKey(cur);
        this.applyWhere(m => matchKey(m) === key, cur);
    }

    replaceAll() {
        this.applyWhere(m => this.isTicked(m));
    }

    // `single`: the one match being replaced by "Replace" — afterwards the
    // search resumes just past the text put in its place, so a replacement
    // that itself contains the query (cat -> cats) is never matched again.
    applyWhere(predicate, single = null) {
        const reason = this.readOnlyReason();
        if (reason) { this.note = reason; this.render(); return; }

        // Fresh read: never write results computed from older text.
        this.runSearch({ render: false });
        const chosen = this.matches.filter(predicate);
        const target = this.currentTarget();
        const options = this.currentOptions();
        const replaceText = this.replaceInput.value;
        if (!chosen.length) { this.render(); return; }
        if (target.kind === 'character' && !replaceText.trim()) {
            this.note = 'Type the new name first.';
            this.render();
            this.replaceInput.focus();
            return;
        }

        const { texts, edits } = applyMatches(this.lines, chosen, replaceText, target, options);
        if (!texts.size) {
            this.note = 'Nothing to change: the replacement is the same text.';
            this.render();
            return;
        }

        const app = this.app;
        const eh = app.editorHandler;
        const T = constants.ELEMENT_TYPES;
        const active = document.activeElement;
        const focusInPanel = this.dialog.contains(active);
        // decorateBlock restores the caret of the block it rebuilds, which
        // can drag focus out of the panel: drop the editor selection first.
        if (focusInPanel) {
            const sel = window.getSelection();
            if (sel) sel.removeAllRanges();
        }

        app.saveState(true); // capture pending typing -> one-step undo
        const byId = new Map(this.lines.map(l => [l.id, l]));
        const retiredNames = new Set();
        let headingsChanged = false;
        let notesChanged = false;
        let renamedTo = '';

        for (const [id, text] of texts) {
            const line = byId.get(id);
            if (line.type === FIND_META_TYPE) {
                // Straight into the model: saveSceneMeta reads the popup's fields.
                if (!app.sceneMeta[line.sceneId]) app.sceneMeta[line.sceneId] = {};
                app.sceneMeta[line.sceneId][line.metaField] = text;
                notesChanged = true;
                continue;
            }
            const el = line.el;
            if (el._typewriterTimeout) {
                clearTimeout(el._typewriterTimeout);
                el._typewriterTimeout = null;
            }
            if (line.type === T.CHARACTER) retiredNames.add(eh.getCleanCharacterName(line.text));
            el.textContent = text;
            eh.maybeDecorate(el);
            if (line.type === T.SLUG) headingsChanged = true;
            if (line.type === T.CHARACTER) {
                eh.commitCharacter(text);
                renamedTo = eh.getCleanCharacterName(text);
            }
        }

        // Autocomplete: forget names no cue uses any more, and stop empty
        // cues from suggesting them (Tab would bring the old name back).
        for (const name of retiredNames) {
            if (!name || eh.isCharacterUsed(name)) continue;
            app.characters.delete(name);
            app.editor.querySelectorAll('[data-suggest]').forEach(el => {
                if (el.getAttribute('data-suggest') !== name) return;
                if (renamedTo) el.setAttribute('data-suggest', renamedTo);
                else el.removeAttribute('data-suggest');
            });
        }

        if (headingsChanged || notesChanged) app.refreshAllViews();
        eh.updateContext();
        app.sidebarManager.updateSceneStats();
        app.isDirty = true;
        app.saveState(true);

        // The writer's ticks follow the text they belong to.
        const ticksBefore = new Map(this.overrides);
        const moved = new Map();
        for (const [key, value] of this.overrides) {
            const next = shiftKey(key, edits);
            if (next !== null) moved.set(next, value);
        }
        this.overrides = moved;

        let replaced = 0;
        for (const list of edits.values()) replaced += list.length;
        this.lastAction = { count: replaced, lines: texts.size, ticksBefore };
        this.note = '';
        this.lastGeometry = null;

        let resumeAt = null;
        if (single) {
            const edit = (edits.get(single.lineId) || [])[0];
            resumeAt = { lineId: single.lineId, offset: edit ? edit.start + edit.length : single.end };
        }
        // The keys were just moved by hand: forget the pre-replace snapshot
        // so the search does not try to re-map them a second time.
        this.lines = [];
        this.matches = [];
        this.runSearch({ anchor: resumeAt });
        if (focusInPanel && active && active.isConnected) active.focus();
    }

    async undoLast() {
        const last = this.lastAction;
        await this.app.undo();
        // The text is back where it was, so the ticks from before the
        // replace fit it again.
        if (last && last.ticksBefore) this.overrides = last.ticksBefore;
        this.lastAction = null;
        this.note = 'Undone.';
        this.lines = [];
        this.matches = [];
        this.runSearch({ fromAnchor: true });
        this.findInput.focus(); // undo puts focus (and the caret) back in the script
    }

    // ---------- Rendering ----------

    syncControls() {
        const s = this.state;
        const slugMode = FIND_SLUG_MODES.includes(s.mode);
        const charMode = s.mode === 'character';
        this.modeSelect.value = s.mode;

        this.findLabel.textContent = charMode ? 'Name' : 'Find';
        this.replaceLabel.textContent = charMode ? 'New name' : 'Replace';
        this.findInput.placeholder = charMode ? 'Character to rename' : slugMode ? 'Pick below or type' : '';

        this.optCase.hidden = s.mode !== 'text';
        this.optKeepCase.hidden = s.mode !== 'text';
        this.optWord.hidden = charMode;
        this.optEntire.hidden = !slugMode;
        for (const [btn, key] of [[this.optCase, 'matchCase'], [this.optWord, 'wholeWord'], [this.optEntire, 'entireValue'], [this.optKeepCase, 'keepCase']]) {
            btn.setAttribute('aria-pressed', String(!!s[key]));
        }

        // Chips: element types to search (Text), or where else a renamed
        // character is mentioned (Character). Cue lines are always renamed.
        this.chipsEl.hidden = slugMode;
        this.chipsEl.textContent = '';
        if (!slugMode) {
            const set = charMode ? s.mentionTypes : s.textTypes;
            const lead = document.createElement('span');
            lead.className = 'find-chips-lead';
            lead.textContent = charMode ? 'Also rename in' : 'In';
            this.chipsEl.appendChild(lead);
            for (const chip of FIND_CHIPS) {
                if (charMode && chip.type === constants.ELEMENT_TYPES.CHARACTER) continue;
                if (charMode && chip.type === constants.ELEMENT_TYPES.TRANSITION) continue;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'find-chip';
                btn.dataset.type = chip.type;
                btn.textContent = chip.label;
                btn.setAttribute('aria-pressed', String(set.has(chip.type)));
                this.chipsEl.appendChild(btn);
            }
        }
    }

    render() {
        clearTimeout(this.renderTimer);
        this.buildRanges();
        this.paintCurrent();
        this.renderCount();
        this.renderStatus();
        this.renderResults();
        this.syncButtons();
    }

    renderCount() {
        const n = this.matches.length;
        const hasQuery = !!this.findInput.value.trim();
        this.countEl.textContent = n ? `${this.current + 1} of ${n}` : hasQuery ? 'No matches' : '';
    }

    syncButtons() {
        const n = this.matches.length;
        const blocked = !!this.readOnlyReason();
        const ticked = this.matches.reduce((sum, m) => sum + (this.isTicked(m) ? 1 : 0), 0);
        this.prevBtn.disabled = n === 0;
        this.nextBtn.disabled = n === 0;
        this.replaceBtn.disabled = blocked || this.current < 0;
        this.replaceAllBtn.disabled = blocked || ticked === 0;
        this.replaceAllBtn.textContent = ticked ? `Replace all (${ticked})` : 'Replace all';
    }

    renderStatus() {
        this.statusEl.textContent = '';
        const add = (text, cls) => {
            const span = document.createElement('span');
            if (cls) span.className = cls;
            span.textContent = text;
            this.statusEl.appendChild(span);
            return span;
        };
        const reason = this.readOnlyReason();
        if (reason) { add(reason, 'find-status-warn'); return; }

        const merge = this.mergeWarning();
        if (merge) add(merge, 'find-status-warn');
        if (this.note) add(this.note);
        if (this.lastAction) {
            const { count, lines } = this.lastAction;
            add(`Replaced ${count} in ${lines} ${lines === 1 ? 'line' : 'lines'}`);
            const undo = document.createElement('button');
            undo.type = 'button';
            undo.id = 'find-undo-btn';
            undo.className = 'find-link';
            undo.textContent = 'Undo';
            this.statusEl.appendChild(undo);
        }
    }

    // Renaming onto a name that already has cues merges the two characters.
    mergeWarning() {
        if (this.state.mode !== 'character') return '';
        const norm = (t) => t.trim().replace(/\s+/g, ' ').toUpperCase();
        const from = norm(this.findInput.value);
        const to = norm(this.replaceInput.value);
        if (!from || !to || from === to) return '';
        const exists = fieldValues(this.lines, { kind: 'character' }).some(v => v.value === to);
        return exists ? `${to} already exists — the two characters will become one.` : '';
    }

    whereLabel(m, line) {
        const scene = line.sceneNo ? `Sc ${line.sceneNo}` : 'Top';
        let what;
        if (line.type === FIND_META_TYPE) what = line.metaField === 'notes' ? 'Scene notes' : 'Scene description';
        else what = constants.TYPE_LABELS[line.type] || 'Line';
        let label = `${scene} · ${what}`;
        if (m.field === 'cue-related') label += ' · related cue';
        else if (m.field === 'mention' && !m.ticked) label += ' · part of another name';
        return label;
    }

    renderResults() {
        const el = this.resultsEl;
        const scroll = el.scrollTop;
        el.textContent = '';
        const s = this.state;
        const structured = s.mode !== 'text';

        if (!this.findInput.value.trim()) {
            if (structured) this.renderValuePicker();
            return;
        }
        if (!this.matches.length) return;

        const target = this.currentTarget();
        const options = this.currentOptions();
        const replaceText = this.replaceInput.value;
        // Previews only once something is typed in Replace: an empty field
        // would otherwise mark every match as "to be deleted".
        const preview = replaceText !== '' && !this.readOnlyReason();
        const limit = this.showAllRows ? this.matches.length : Math.min(this.matches.length, FIND_MAX_ROWS);
        const frag = document.createDocumentFragment();

        for (let i = 0; i < limit; i++) {
            const m = this.matches[i];
            const line = this.lines[m.lineIndex];
            const row = document.createElement('div');
            row.className = 'find-result' + (i === this.current ? ' current' : '');
            row.dataset.index = String(i);
            row.setAttribute('role', 'listitem');

            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = this.isTicked(m);
            box.title = 'Include in Replace all';
            box.setAttribute('aria-label', 'Include in Replace all');
            row.appendChild(box);

            const main = document.createElement('button');
            main.type = 'button';
            main.className = 'find-result-main';

            const where = document.createElement('span');
            where.className = 'find-result-where';
            where.textContent = this.whereLabel(m, line);
            main.appendChild(where);

            const snippet = document.createElement('span');
            snippet.className = 'find-result-snippet';
            const from = Math.max(0, m.start - FIND_SNIPPET_CONTEXT);
            const to = Math.min(line.text.length, m.end + FIND_SNIPPET_CONTEXT);
            snippet.append((from > 0 ? '…' : '') + line.text.slice(from, m.start));
            const hit = document.createElement('mark');
            hit.textContent = m.text;
            snippet.appendChild(hit);
            if (preview) {
                // What this one match would become, from the same code that
                // performs the replacement.
                const { texts } = applyMatches([line], [m], replaceText, target, options);
                if (texts.has(line.id)) {
                    const after = texts.get(line.id);
                    const added = after.length - line.text.length + (m.end - m.start);
                    const start = Math.min(m.start, after.length);
                    const ins = document.createElement('ins');
                    ins.textContent = after.slice(start, Math.max(start, start + added)) || '∅';
                    hit.classList.add('find-old');
                    snippet.appendChild(ins);
                }
            }
            snippet.append(line.text.slice(m.end, to) + (to < line.text.length ? '…' : ''));
            main.appendChild(snippet);

            row.appendChild(main);
            frag.appendChild(row);
        }

        if (limit < this.matches.length) {
            const more = document.createElement('button');
            more.type = 'button';
            more.id = 'find-show-all';
            more.className = 'find-link';
            more.textContent = `Show all ${this.matches.length} matches`;
            frag.appendChild(more);
        }
        el.appendChild(frag);
        el.scrollTop = scroll;
    }

    // Structured modes with an empty Find field: the values that exist in
    // the script, most used first. Clicking one fills Find.
    renderValuePicker() {
        const values = fieldValues(this.lines, this.currentTarget());
        const head = document.createElement('div');
        head.className = 'find-picker-head';
        const noun = { prefix: 'INT/EXT values', location: 'Locations', time: 'Times of day', character: 'Characters' }[this.state.mode];
        head.textContent = values.length ? `${noun} in this script` : `No ${noun.toLowerCase()} in this script yet`;
        this.resultsEl.appendChild(head);
        for (const { value, count } of values) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'find-value';
            btn.dataset.value = value;
            const name = document.createElement('span');
            name.textContent = value;
            const num = document.createElement('span');
            num.className = 'find-value-count';
            num.textContent = String(count);
            btn.append(name, num);
            this.resultsEl.appendChild(btn);
        }
    }
}
