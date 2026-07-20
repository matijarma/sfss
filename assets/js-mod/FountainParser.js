import * as constants from './Constants.js';
import { generateLineId } from './Utils.js';
import { splitBoneyard } from './InlineMarkup.js';

// Scene headings: INT / EXT / EST / INT./EXT / INT/EXT / I/E followed by a
// period or a space (spec 2.2.1). Shared by parse() and generate().
const SCENE_HEADING_RE = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[. ]/i;

// Title-page keys generate() is allowed to emit, in canonical order.
const TITLE_PAGE_KEYS = [
    ['title', 'Title'],
    ['credit', 'Credit'],
    ['author', 'Author'],
    ['source', 'Source'],
    ['draft date', 'Draft date'],
    ['contact', 'Contact'],
    ['notes', 'Notes'],
    ['copyright', 'Copyright']
];

export class FountainParser {
    constructor() {}

    /**
     * Parses a raw Fountain string into SFSS Block Objects.
     * @param {string} text - The raw Fountain text.
     * @returns {Object} { blocks, meta, sceneMeta, boneyard }
     *   blocks:    [{ id, type, text, centered?, tight?, pageBreak? }]
     *   meta:      title-page key/values (plus synopsis/trailingSections when
     *              they have no slug to attach to)
     *   sceneMeta: { [slugId]: { number?, description?, sections? } }
     *   boneyard:  [{ anchorId, text }] - multi-line boneyard spans, anchored
     *              to the block emitted immediately before them (null = file
     *              start). Single-line inline boneyard stays in block text.
     */
    parse(text) {
        const { SLUG, ACTION, CHARACTER, DIALOGUE, PARENTHETICAL, TRANSITION } = constants.ELEMENT_TYPES;

        // Normalize line endings up front so every downstream consumer (the
        // boneyard pre-pass, the line loop, extracted boneyard text) sees LF
        // only — Windows-authored .fountain files arrive with CRLF.
        const normalized = String(text == null ? '' : text).replace(/\r\n?/g, '\n');

        // Boneyard pre-pass: multi-line comment spans are lifted out of the
        // text so the line parser never sees them; inline ones stay put.
        const boneyardSplit = splitBoneyard(normalized);
        const lines = boneyardSplit.text.split('\n');

        const blocks = [];
        const meta = {};
        const sceneMeta = {}; // Extracted scene numbers, descriptions, sections
        const boneyard = [];

        // Regex Helpers
        const regex = {
            sceneNumber: /#([^#]+)#/, // Extracts content between # #
            transition: /TO:$/,
            lyrics: /^~/,
            section: /^(#+)\s*(.*)$/,
            synopsis: /^=\s?(.*)$/,
            pageBreak: /^===+$/,
            forcedHeading: /^\.(?!\.)/, // single leading dot only ("..." stays Action)
            titleKey: /^\w[^:]*:/,
            titleContinuation: /^( {3,}|\t)/,
            dialogueContinuation: /^ {2,}$/ // untrimmed line of only 2+ spaces
        };

        // Boneyard entries anchor to the last block emitted before the line
        // where the span stood in the cleaned text.
        let boneyardCursor = 0;
        const flushBoneyard = (lineIndex) => {
            while (boneyardCursor < boneyardSplit.extracted.length &&
                   boneyardSplit.extracted[boneyardCursor].beforeLineIndex <= lineIndex) {
                boneyard.push({
                    anchorId: blocks.length ? blocks[blocks.length - 1].id : null,
                    text: boneyardSplit.extracted[boneyardCursor].text
                });
                boneyardCursor++;
            }
        };

        // 1. Parse Title Page - only if line 1 is a "Key: value" pair; it ends
        // at the first blank line. Indented lines (3+ spaces or a tab) continue
        // the current key's value (#17).
        let i = 0;
        if (lines.length && regex.titleKey.test(lines[0])) {
            let currentKey = null;
            while (i < lines.length) {
                const line = lines[i];
                if (line.trim() === '') { i++; break; }
                if (regex.titleContinuation.test(line) && currentKey) {
                    meta[currentKey] = meta[currentKey] === ''
                        ? line.trim()
                        : meta[currentKey] + '\n' + line.trim();
                } else if (regex.titleKey.test(line)) {
                    const colonIndex = line.indexOf(':');
                    currentKey = line.substring(0, colonIndex).trim().toLowerCase();
                    meta[currentKey] = line.substring(colonIndex + 1).trim();
                } else {
                    break; // Not title-page material; the body starts here
                }
                i++;
            }
        }

        // 2. Parse Body
        let prevLineBlank = true; // File start counts as a blank line
        let prevEmit = null;      // Block emitted by the immediately previous line
        let lastSceneId = null;   // Current scene, for synopses
        let pendingSections = []; // Buffered "#" lines, attached to the NEXT slug
        let pendingSynopsis = []; // "=" lines seen before the first slug

        const attachDescription = (slugId, desc) => {
            if (!sceneMeta[slugId]) sceneMeta[slugId] = {};
            if (sceneMeta[slugId].description) {
                sceneMeta[slugId].description += '\n' + desc;
            } else {
                sceneMeta[slugId].description = desc;
            }
        };

        for (; i < lines.length; i++) {
            flushBoneyard(i);
            const line = lines[i];
            const trimmed = line.trim();
            const prevBlock = blocks.length ? blocks[blocks.length - 1] : null;

            if (trimmed === '') {
                // Two-space continuation: a line of 2+ spaces inside an open
                // dialogue block keeps the speech together (spec 2.5.1).
                const inDialogue = !prevLineBlank && prevBlock &&
                    [CHARACTER, PARENTHETICAL, DIALOGUE].includes(prevBlock.type);
                if (regex.dialogueContinuation.test(line) && inDialogue) {
                    const cont = { type: DIALOGUE, text: '', id: generateLineId() };
                    blocks.push(cont);
                    prevEmit = cont; // prevLineBlank stays false
                } else {
                    prevLineBlank = true;
                    prevEmit = null;
                }
                continue;
            }

            const afterBlank = prevLineBlank;
            prevLineBlank = false;

            // Generate ID
            const id = generateLineId();

            const emit = (block) => {
                blocks.push(block);
                prevEmit = block;
            };
            // Tight = same visual paragraph as the previous action line (no
            // blank line between them in the source) - line-break integrity.
            const isTight = () => !!(prevEmit && prevEmit.type === ACTION && !prevEmit.pageBreak);
            const emitAction = (actionText, extra = {}) => {
                const block = { type: ACTION, text: actionText, id, ...extra };
                if (isTight()) block.tight = true;
                emit(block);
            };
            const emitSlug = (rawText) => {
                const { cleanText, number } = this.extractSceneNumber(rawText);
                if (number) {
                    if (!sceneMeta[id]) sceneMeta[id] = {};
                    sceneMeta[id].number = number;
                }
                if (pendingSections.length) {
                    if (!sceneMeta[id]) sceneMeta[id] = {};
                    sceneMeta[id].sections = pendingSections;
                    pendingSections = [];
                }
                emit({ type: SLUG, text: cleanText.toUpperCase(), id });
                lastSceneId = id;
                if (pendingSynopsis.length) {
                    pendingSynopsis.forEach(desc => attachDescription(id, desc));
                    pendingSynopsis = [];
                }
            };

            // Page break (===) - must be checked before the "=" synopsis rule
            // and the character heuristic ("===" is all-caps-equal).
            if (regex.pageBreak.test(trimmed)) {
                emit({ type: ACTION, text: '', pageBreak: true, id });
                prevEmit = null; // Nothing is "tight" against a page break
                continue;
            }

            // Sections (# Heading) - structural metadata, not printed blocks.
            const sectionMatch = trimmed.match(regex.section);
            if (sectionMatch) {
                pendingSections.push({ depth: sectionMatch[1].length, text: sectionMatch[2].trim() });
                prevEmit = null;
                continue;
            }

            // Synopsis (= Description) - attaches to the current scene; ones
            // seen before the first slug are buffered and attached to it.
            const synopsisMatch = trimmed.match(regex.synopsis);
            if (synopsisMatch) {
                const desc = synopsisMatch[1].trim();
                if (lastSceneId) {
                    attachDescription(lastSceneId, desc);
                } else {
                    pendingSynopsis.push(desc);
                }
                prevEmit = null;
                continue;
            }

            // --- FORCED ELEMENTS ---
            if (regex.forcedHeading.test(trimmed)) {
                // Forced Scene Heading
                emitSlug(trimmed.substring(1).trim());
                continue;
            }
            if (trimmed.startsWith('!')) {
                // Forced Action
                emitAction(trimmed.substring(1));
                continue;
            }
            if (trimmed.startsWith('@')) {
                // Forced Character - keeps its typed case: "@" exists exactly
                // to support mixed-case names like McClane (spec 2.1).
                let name = trimmed.substring(1).trim();
                if (name.endsWith('^')) name = name.slice(0, -1).trim();
                emit({ type: CHARACTER, text: name, id });
                continue;
            }
            if (trimmed.startsWith('>')) {
                // Forced Transition OR Centered
                if (trimmed.endsWith('<')) {
                    // Centered Action
                    emitAction(trimmed.substring(1, trimmed.length - 1).trim(), { centered: true });
                } else {
                    // Forced Transition (trimmed - no leading space kept)
                    emit({ type: TRANSITION, text: trimmed.substring(1).trim().toUpperCase(), id });
                }
                continue;
            }

            // Lyrics (~) - the tilde stays in the text; typed by context.
            if (regex.lyrics.test(trimmed)) {
                if (prevBlock && [CHARACTER, PARENTHETICAL, DIALOGUE].includes(prevBlock.type)) {
                    emit({ type: DIALOGUE, text: trimmed, id });
                } else {
                    emitAction(trimmed);
                }
                continue;
            }

            // --- HEURISTICS ---

            // Scene Headings (must be preceded by a blank line, spec 2.2.1)
            if (afterBlank && SCENE_HEADING_RE.test(trimmed)) {
                emitSlug(trimmed);
                continue;
            }

            // Transitions (Uppercase, ends with TO:)
            if (trimmed === trimmed.toUpperCase() && regex.transition.test(trimmed)) {
                emit({ type: TRANSITION, text: trimmed, id });
                continue;
            }

            // Character: preceded by a blank line, all-caps (parenthesized
            // extensions like (V.O.) may be lowercase), at least one letter in
            // the name, and immediately followed by a non-blank line (2.4.1).
            if (afterBlank && trimmed[0] !== '(') {
                const nameOnly = trimmed.replace(/\(.*?\)/g, '').trim();
                const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
                if (nameOnly === nameOnly.toUpperCase() && /[A-Z]/.test(nameOnly) && nextLine.trim() !== '') {
                    // Dual dialogue: the "^" caret is stripped but the pairing
                    // is NOT modeled - both speakers come through as plain,
                    // sequential Character blocks (documented limitation).
                    let name = trimmed;
                    if (name.endsWith('^')) name = name.slice(0, -1).trim();
                    emit({ type: CHARACTER, text: name, id });
                    continue;
                }
            }

            // Parenthetical
            if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                emit({ type: PARENTHETICAL, text: trimmed, id });
                continue;
            }

            // Dialogue: follows a Character/Parenthetical, or continues an
            // open Dialogue block across a non-blank boundary (two-space rule).
            if (prevBlock && (prevBlock.type === CHARACTER || prevBlock.type === PARENTHETICAL ||
                (prevBlock.type === DIALOGUE && !afterBlank))) {
                emit({ type: DIALOGUE, text: trimmed, id });
                continue;
            }

            // Default: Action
            emitAction(trimmed);
        }

        flushBoneyard(Infinity);
        if (pendingSections.length) meta.trailingSections = pendingSections;
        if (pendingSynopsis.length) meta.synopsis = pendingSynopsis.join('\n');

        return { blocks, meta, sceneMeta, boneyard };
    }

    /**
     * Generates a Fountain string from SFSS data (inverse of parse(), so
     * parse -> generate -> parse is a fixed point).
     * @param {Object} scriptData - { meta: {}, blocks: [], sceneMeta: {}, boneyard: [] }
     * @returns {string} The formatted Fountain script.
     */
    generate(scriptData) {
        const { SLUG, ACTION, CHARACTER, DIALOGUE, PARENTHETICAL, TRANSITION } = constants.ELEMENT_TYPES;
        const blocks = scriptData.blocks || [];
        const meta = scriptData.meta || {};
        const sceneMeta = scriptData.sceneMeta || {};
        const boneyard = scriptData.boneyard || [];
        const output = [];

        const pushSection = (section) => {
            if (output.length && output[output.length - 1] !== '') output.push('');
            output.push('#'.repeat(section.depth) + (section.text ? ` ${section.text}` : ''));
        };

        // 1. Title Page - whitelisted keys only; multi-line values emitted as
        // indented continuation lines so they survive re-parsing (#17).
        let wroteTitlePage = false;
        for (const [key, label] of TITLE_PAGE_KEYS) {
            const value = meta[key];
            if (value === undefined || value === null || value === '') continue;
            const valueLines = String(value).split('\n');
            if (valueLines.length === 1) {
                output.push(`${label}: ${valueLines[0]}`);
            } else {
                output.push(`${label}:`);
                valueLines.forEach(l => output.push(`   ${l}`));
            }
            wroteTitlePage = true;
        }
        if (wroteTitlePage) output.push('');

        // Boneyard entries grouped by anchor block; file-start entries are
        // emitted right away, entries whose anchor no longer exists go last.
        const knownIds = new Set(blocks.map(b => b.id));
        const boneyardByAnchor = new Map();
        const looseBoneyard = [];
        for (const entry of boneyard) {
            if (entry.anchorId && knownIds.has(entry.anchorId)) {
                if (!boneyardByAnchor.has(entry.anchorId)) boneyardByAnchor.set(entry.anchorId, []);
                boneyardByAnchor.get(entry.anchorId).push(entry.text);
            } else if (!entry.anchorId) {
                output.push(`/*${entry.text}*/`);
                output.push('');
            } else {
                looseBoneyard.push(entry.text);
            }
        }

        // Pre-slug synopsis that never found a slug to attach to.
        if (meta.synopsis) {
            String(meta.synopsis).split('\n').forEach(l => output.push(`= ${l}`));
        }

        // 2. Body
        blocks.forEach((block, index) => {
            const text = block.text;
            const type = block.type;
            const sm = sceneMeta[block.id];

            // Sections are re-emitted above the slug they were buffered for.
            if (type === SLUG && sm && Array.isArray(sm.sections)) {
                sm.sections.forEach(pushSection);
            }

            // Blank-line separators: dialogue/parentheticals attach to their
            // character; "tight" actions attach to the previous action line.
            const attached = type === DIALOGUE || type === PARENTHETICAL || block.tight;
            if (output.length && !attached && output[output.length - 1] !== '') output.push('');

            switch (type) {
                case SLUG: {
                    let line = String(text).toUpperCase();
                    if (!SCENE_HEADING_RE.test(line)) {
                        line = '.' + line; // Force it if it doesn't scan as one
                    }
                    // Attach Scene Number
                    if (sm && sm.number) line += ` #${sm.number}#`;
                    output.push(line);
                    // Attach Synopsis (Description)
                    if (sm && sm.description) {
                        String(sm.description).split('\n').forEach(l => {
                            if (l.trim()) output.push(`= ${l.trim()}`);
                        });
                    }
                    break;
                }

                case ACTION:
                    if (block.pageBreak) output.push('===');
                    else if (block.centered) output.push(`> ${text} <`);
                    else if (this.needsActionForce(text)) output.push(`!${text}`);
                    else output.push(text);
                    break;

                case CHARACTER: {
                    // Re-parseable without forcing only if the name is all-caps
                    // with a letter, doesn't scan as a slug/transition, and
                    // speech follows immediately; otherwise the "@" force keeps
                    // the block a Character (and preserves mixed-case names).
                    const nameOnly = String(text).replace(/\(.*?\)/g, '').trim();
                    const next = blocks[index + 1];
                    const safe = nameOnly === nameOnly.toUpperCase() && /[A-Z]/.test(nameOnly) &&
                        !SCENE_HEADING_RE.test(text) && !/TO:$/.test(text) &&
                        next && (next.type === DIALOGUE || next.type === PARENTHETICAL) && next.text !== '';
                    output.push(safe ? text : `@${text}`);
                    break;
                }

                case DIALOGUE:
                    // An empty dialogue block is the two-space continuation line.
                    output.push(text === '' ? '  ' : text);
                    break;

                case PARENTHETICAL:
                    output.push(text);
                    break;

                case TRANSITION:
                    if (text === String(text).toUpperCase() && /TO:$/.test(text)) {
                        output.push(text);
                    } else {
                        output.push(`> ${text}`);
                    }
                    break;
            }

            const anchored = boneyardByAnchor.get(block.id);
            if (anchored) {
                anchored.forEach(t => {
                    output.push('');
                    output.push(`/*${t}*/`);
                });
            }
        });

        // Trailing sections that never found a following slug.
        if (Array.isArray(meta.trailingSections)) {
            meta.trailingSections.forEach(pushSection);
        }

        looseBoneyard.forEach(t => {
            output.push('');
            output.push(`/*${t}*/`);
        });

        return output.join('\n');
    }

    // An Action line that would be re-parsed as something else needs the "!"
    // force: leading force/structural characters, scene-heading lookalikes, or
    // all-caps lines (Character/Transition bait). "~" is excluded on purpose -
    // lyric lines keep their Action typing through the lyric rule.
    needsActionForce(text) {
        const t = String(text);
        if (t === '') return false;
        if (/^[.!@>#=]/.test(t)) return true;
        if (SCENE_HEADING_RE.test(t)) return true;
        const nameOnly = t.replace(/\(.*?\)/g, '').trim();
        return nameOnly === nameOnly.toUpperCase() && /[A-Z]/.test(nameOnly);
    }

    extractSceneNumber(text) {
        const match = text.match(/#([^#]+)#/);
        if (match) {
            // Return text without the number, and the number itself
            const cleanText = text.replace(/#([^#]+)#/, '').trim();
            return { cleanText, number: match[1] };
        }
        return { cleanText: text, number: null };
    }
}
