// Fountain inline markup: **bold**, *italic*, _underline_, ***bold italic***,
// [[notes]], with backslash escapes (\*, \_, \[, \], \\).
//
// Canonical storage keeps the markers literally inside block text, and the
// EDITOR SHOWS THEM (dimmed) — so block.textContent === model text always
// holds. Three consumers of this module:
//   editor  — decorateBlock / toggleEmphasis (markers visible, styled)
//   output  — markupToNodes / plainText (markers hidden, notes dropped)
//   parsers — tokensToRuns / runsToFountain (FDX <Text Style> runs),
//             splitBoneyard (multi-line /* boneyard */ extraction)
// tokenize/plainText/toggleMarkers/runsToFountain/splitBoneyard are pure and
// Node-testable; the DOM helpers are only called in the browser.

import * as constants from './Constants.js';
import { generateLineId } from './Utils.js';

const MARKERS = { b: '**', i: '*', u: '_' };
const STYLE_FLAGS = {
    bi: { b: true, i: true },
    b: { b: true },
    i: { i: true },
    u: { u: true }
};

// ---------- Tokenizer ----------

// Escaped chars are masked with NUL (same length) so regexes never match
// them, while all indices keep pointing into the original string. NUL rather
// than space so an escaped char still counts as non-whitespace at emphasis
// boundaries (*foo\** is valid italic ending in a literal star).
const MASK = '\u0000\u0000';

function maskEscapes(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\\' && i + 1 < text.length && '\\*_[]'.includes(text[i + 1])) {
            out += MASK;
            i++;
        } else {
            out += text[i];
        }
    }
    return out;
}

export function unescapeText(text) {
    return String(text).replace(/\\([\\*_[\]])/g, '$1');
}

// Priority order matters: at equal start positions the earlier pattern wins
// (*** before ** before *).
const PATTERNS = [
    { kind: 'note', style: null, markerLen: 2, re: /\[\[([\s\S]+?)\]\]/g },
    { kind: 'em', style: 'bi', markerLen: 3, re: /\*\*\*(\S|\S[\s\S]*?\S)\*\*\*/g },
    { kind: 'em', style: 'b', markerLen: 2, re: /\*\*(\S|\S[\s\S]*?\S)\*\*/g },
    { kind: 'em', style: 'i', markerLen: 1, re: /\*(\S|\S[\s\S]*?\S)\*/g },
    { kind: 'em', style: 'u', markerLen: 1, re: /_(\S|\S[\s\S]*?\S)_/g }
];

function findNext(masked, pos, to) {
    let best = null;
    for (const p of PATTERNS) {
        p.re.lastIndex = pos;
        const m = p.re.exec(masked);
        if (!m || m.index + m[0].length > to) continue;
        if (best && m.index >= best.start) continue;
        best = { start: m.index, end: m.index + m[0].length, pattern: p };
    }
    return best;
}

// Returns a token tree over the ORIGINAL string: {kind:'text',start,end} |
// {kind:'note',start,end} | {kind:'em',style,markerLen,start,end,children}.
export function tokenize(text, _masked = null, _from = 0, _to = null) {
    const masked = _masked === null ? maskEscapes(text) : _masked;
    const to = _to === null ? text.length : _to;
    const tokens = [];
    let pos = _from;
    while (pos < to) {
        const match = findNext(masked, pos, to);
        if (!match) break;
        if (match.start > pos) tokens.push({ kind: 'text', start: pos, end: match.start });
        const p = match.pattern;
        if (p.kind === 'note') {
            tokens.push({ kind: 'note', start: match.start, end: match.end });
        } else {
            tokens.push({
                kind: 'em',
                style: p.style,
                markerLen: p.markerLen,
                start: match.start,
                end: match.end,
                children: tokenize(text, masked, match.start + p.markerLen, match.end - p.markerLen)
            });
        }
        pos = match.end;
    }
    if (pos < to) tokens.push({ kind: 'text', start: pos, end: to });
    return tokens;
}

export function hasMarkup(text) {
    return tokenize(text).some(t => t.kind !== 'text');
}

// ---------- Plain text (markers stripped) ----------

// Counters/stats/exports that must ignore markers and [[notes]] use this.
export function plainText(text, { notes = false } = {}) {
    let out = '';
    const walk = (tokens) => {
        for (const t of tokens) {
            if (t.kind === 'text') out += unescapeText(text.slice(t.start, t.end));
            else if (t.kind === 'note') {
                if (notes) out += text.slice(t.start + 2, t.end - 2);
            } else walk(t.children);
        }
    };
    walk(tokenize(text));
    return out;
}

export const stripMarkers = plainText;

// ---------- Editor decoration (markers VISIBLE, dimmed) ----------

function markerSpan(str) {
    const span = document.createElement('span');
    span.className = 'fmt-marker';
    span.textContent = str;
    return span;
}

function flagClasses(flags) {
    let cls = 'fmt';
    if (flags.b) cls += ' fmt-b';
    if (flags.i) cls += ' fmt-i';
    if (flags.u) cls += ' fmt-u';
    return cls;
}

function appendDecorated(parent, text, tokens, inherited) {
    for (const t of tokens) {
        if (t.kind === 'text') {
            parent.appendChild(document.createTextNode(text.slice(t.start, t.end)));
        } else if (t.kind === 'note') {
            const span = document.createElement('span');
            span.className = 'fmt-note';
            span.appendChild(markerSpan('[['));
            span.appendChild(document.createTextNode(text.slice(t.start + 2, t.end - 2)));
            span.appendChild(markerSpan(']]'));
            parent.appendChild(span);
        } else {
            const flags = { ...inherited, ...STYLE_FLAGS[t.style] };
            const span = document.createElement('span');
            span.className = flagClasses(flags);
            span.appendChild(markerSpan(text.slice(t.start, t.start + t.markerLen)));
            appendDecorated(span, text, t.children, flags);
            span.appendChild(markerSpan(text.slice(t.end - t.markerLen, t.end)));
            parent.appendChild(span);
        }
    }
}

// Rebuilds a block's children as styled spans with visible markers, keeping
// textContent byte-identical and the caret at its char offset. Returns true
// if the DOM was touched.
export function decorateBlock(blockEl) {
    const text = blockEl.textContent;
    const tokens = tokenize(text);
    const marked = tokens.some(t => t.kind !== 'text');
    if (!marked && !blockEl.dataset.hasMarkup) return false;
    const caret = getTextOffset(blockEl);
    while (blockEl.firstChild) blockEl.removeChild(blockEl.firstChild);
    appendDecorated(blockEl, text, tokens, {});
    if (marked) blockEl.dataset.hasMarkup = '1';
    else delete blockEl.dataset.hasMarkup;
    if (caret !== null) setTextOffset(blockEl, caret);
    return true;
}

// ---------- Clean output (markers hidden, for page/print/reports) ----------

export function markupToNodes(text, { showNotes = false } = {}) {
    const frag = document.createDocumentFragment();
    const walk = (parent, tokens, inherited) => {
        for (const t of tokens) {
            if (t.kind === 'text') {
                parent.appendChild(document.createTextNode(unescapeText(text.slice(t.start, t.end))));
            } else if (t.kind === 'note') {
                if (showNotes) {
                    const span = document.createElement('span');
                    span.className = 'sfss-note';
                    span.textContent = text.slice(t.start + 2, t.end - 2);
                    parent.appendChild(span);
                }
            } else {
                const add = STYLE_FLAGS[t.style];
                const flags = { ...inherited, ...add };
                let host = parent;
                if (add.b && !inherited.b) host = host.appendChild(document.createElement('strong'));
                if (add.i && !inherited.i) host = host.appendChild(document.createElement('em'));
                if (add.u && !inherited.u) host = host.appendChild(document.createElement('u'));
                walk(host, t.children, flags);
            }
        }
    };
    walk(frag, tokenize(text), {});
    return frag;
}

// ---------- FDX bridge ----------

// Flattens block text into style runs for FDX <Text Style="..."> export.
// Notes are omitted (they become ScriptNotes or are dropped by the caller).
export function tokensToRuns(text) {
    const runs = [];
    const walk = (tokens, flags) => {
        for (const t of tokens) {
            if (t.kind === 'text') {
                const chunk = unescapeText(text.slice(t.start, t.end));
                if (chunk) runs.push({ text: chunk, bold: !!flags.b, italic: !!flags.i, underline: !!flags.u });
            } else if (t.kind === 'em') {
                walk(t.children, { ...flags, ...STYLE_FLAGS[t.style] });
            }
        }
    };
    walk(tokenize(text), {});
    return runs;
}

// Inverse: FDX style runs -> canonical marker text (used on FDX import).
// Adjacent same-style runs are merged before emitting.
export function runsToFountain(runs) {
    const merged = [];
    for (const run of runs) {
        if (!run.text) continue;
        const last = merged[merged.length - 1];
        if (last && last.bold === !!run.bold && last.italic === !!run.italic && last.underline === !!run.underline) {
            last.text += run.text;
        } else {
            merged.push({ text: run.text, bold: !!run.bold, italic: !!run.italic, underline: !!run.underline });
        }
    }
    let out = '';
    for (const run of merged) {
        let t = run.text.replace(/\\/g, '\\\\').replace(/([*_])/g, '\\$1').replace(/\[\[/g, '\\[[');
        if (run.bold && run.italic) t = `***${t}***`;
        else if (run.bold) t = `**${t}**`;
        else if (run.italic) t = `*${t}*`;
        if (run.underline) t = `_${t}_`;
        out += t;
    }
    return out;
}

// ---------- Emphasis toggling (pure core + DOM wrapper) ----------

// Pure string toggle for Ctrl+B/I/U. Returns adjusted text + selection.
export function toggleMarkers(text, selStart, selEnd, kind) {
    const m = MARKERS[kind];
    if (!m) return { text, selStart, selEnd };
    if (selStart > selEnd) [selStart, selEnd] = [selEnd, selStart];

    if (selStart === selEnd) {
        const nt = text.slice(0, selStart) + m + m + text.slice(selStart);
        return { text: nt, selStart: selStart + m.length, selEnd: selStart + m.length };
    }

    while (selStart < selEnd && /\s/.test(text[selStart])) selStart++;
    while (selEnd > selStart && /\s/.test(text[selEnd - 1])) selEnd--;
    const selected = text.slice(selStart, selEnd);

    // Selection includes the markers themselves: unwrap.
    if (selected.startsWith(m) && selected.endsWith(m) && selected.length >= 2 * m.length + 1) {
        const inner = selected.slice(m.length, selected.length - m.length);
        return {
            text: text.slice(0, selStart) + inner + text.slice(selEnd),
            selStart,
            selEnd: selEnd - 2 * m.length
        };
    }

    // Markers immediately around the selection: unwrap. The single-star
    // guard keeps Ctrl+I from eating one star of a ** pair.
    const before = text.slice(Math.max(0, selStart - m.length), selStart);
    const after = text.slice(selEnd, selEnd + m.length);
    const starSafe = kind !== 'i' || (text[selStart - m.length - 1] !== '*' && text[selEnd + m.length] !== '*');
    if (before === m && after === m && selStart - m.length >= 0 && starSafe) {
        return {
            text: text.slice(0, selStart - m.length) + selected + text.slice(selEnd + m.length),
            selStart: selStart - m.length,
            selEnd: selEnd - m.length
        };
    }

    // Wrap.
    return {
        text: text.slice(0, selStart) + m + selected + m + text.slice(selEnd),
        selStart: selStart + m.length,
        selEnd: selEnd + m.length
    };
}

export function toggleEmphasis(blockEl, kind, selStart, selEnd) {
    const res = toggleMarkers(blockEl.textContent, selStart, selEnd, kind);
    blockEl.textContent = res.text;
    decorateBlock(blockEl);
    setTextRange(blockEl, res.selStart, res.selEnd);
    return res;
}

// ---------- Serialization seam ----------

// Element -> canonical block. Inverse of PageRenderer.renderBlockElement and
// the single place the DOM->JSON conventions live (paren re-wrapping, flags).
export function serializeBlockElement(el) {
    let type = constants.ELEMENT_TYPES.ACTION;
    for (const t of Object.values(constants.ELEMENT_TYPES)) {
        if (el.classList.contains(t)) { type = t; break; }
    }
    let text = el.textContent;
    if (type === constants.ELEMENT_TYPES.PARENTHETICAL) {
        if (!text.startsWith('(')) text = '(' + text;
        if (!text.endsWith(')')) text = text + ')';
    }
    const block = { type, text, id: el.dataset.lineId || generateLineId() };
    if (el.classList.contains('sc-centered')) block.centered = true;
    if (el.dataset.tight) block.tight = true;
    if (el.dataset.pageBreak) block.pageBreak = true;
    return block;
}

// ---------- Boneyard pre-pass (Fountain import) ----------

// Extracts MULTI-LINE /* boneyard */ spans (single-line/inline ones stay in
// the text and round-trip literally). beforeLineIndex is the line number in
// the cleaned text where the boneyard stood.
export function splitBoneyard(raw) {
    const extracted = [];
    let clean = '';
    let lastIndex = 0;
    const re = /\/\*[\s\S]*?\*\//g;
    let m;
    while ((m = re.exec(raw)) !== null) {
        if (!m[0].includes('\n')) continue;
        clean += raw.slice(lastIndex, m.index);
        extracted.push({
            beforeLineIndex: clean.split('\n').length - 1,
            text: m[0].slice(2, -2)
        });
        lastIndex = m.index + m[0].length;
    }
    clean += raw.slice(lastIndex);
    return { text: clean, extracted };
}

// ---------- DOM text-offset helpers (span-safe caret/selection) ----------

export function getTextOffset(el) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
}

function findTextPosition(el, target) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, target);
    let node;
    let last = null;
    while ((node = walker.nextNode())) {
        last = node;
        if (remaining <= node.textContent.length) return { node, offset: remaining };
        remaining -= node.textContent.length;
    }
    if (last) return { node: last, offset: last.textContent.length };
    return { node: el, offset: 0 };
}

export function setTextRange(el, start, end) {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const s = findTextPosition(el, start);
    const e = end === start ? s : findTextPosition(el, end);
    range.setStart(s.node, s.offset);
    range.setEnd(e.node, e.offset);
    sel.removeAllRanges();
    sel.addRange(range);
}

export function setTextOffset(el, offset) {
    setTextRange(el, offset, offset);
}
