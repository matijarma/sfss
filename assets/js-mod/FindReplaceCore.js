// Find & Replace engine — pure, no DOM, Node-testable.
//
// It works on plain lines { id, type, text } using the EDITOR's text
// conventions (a parenthetical carries no outer brackets; inline markers
// are literal, exactly as the Write view shows them).
//
// A TARGET says where to look:
//   { kind: 'text', types: [...] }            whole text of those element
//                                              types (FIND_META_TYPE = scene
//                                              descriptions and notes)
//   { kind: 'slug', part }                     one part of scene headings:
//                                              'prefix' | 'location' | 'time'
//   { kind: 'character', mentionTypes: [...] } a character name: the name
//                                              part of cue lines, plus
//                                              mentions in the listed types
//
// Every match carries `ticked`, its default checkbox state: risky matches
// (a related cue such as YOUNG ANNA, a hyphen-joined name) are found and
// listed but left for the writer to opt into.

import * as constants from './Constants.js';
import { parseSlug, slugPartText, parseCharacterCue, cueNameText } from './ScriptParts.js';

export const FIND_META_TYPE = 'meta';

// Stored (and styled) uppercase: matched case-insensitively and rewritten
// in uppercase, whatever the options say.
const FIND_UPPERCASE_TYPES = [
    constants.ELEMENT_TYPES.SLUG,
    constants.ELEMENT_TYPES.CHARACTER,
    constants.ELEMENT_TYPES.TRANSITION
];

const FIND_WORD_CHAR_RE = /[\p{L}\p{N}]/u;
const FIND_HYPHENS = '-‐‑';

function escapeFindLiteral(text) {
    return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// Literal query -> global Unicode RegExp. Whole-word uses Unicode
// lookarounds (\b is ASCII-only and breaks on Š, Č, Đ). `looseSpaces` lets
// any run of whitespace in the text stand for a space in the query.
export function buildFindRegex(query, { matchCase = false, wholeWord = false, looseSpaces = false } = {}) {
    const raw = String(query ?? '');
    let source = looseSpaces
        ? raw.trim().split(/\s+/).filter(Boolean).map(escapeFindLiteral).join('\\s+')
        : escapeFindLiteral(raw);
    if (!source) return null;
    if (wholeWord) source = `(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`;
    return new RegExp(source, matchCase ? 'gu' : 'giu');
}

// All matches of `regex` lying fully inside text[from, to).
function findIn(text, regex, from, to) {
    const out = [];
    regex.lastIndex = from;
    for (let m = regex.exec(text); m; m = regex.exec(text)) {
        if (m[0].length === 0) { regex.lastIndex++; continue; }
        if (m.index >= to) break;
        const end = m.index + m[0].length;
        if (end <= to) out.push({ start: m.index, end, text: m[0] });
    }
    return out;
}

function isUppercaseLine(line) {
    return FIND_UPPERCASE_TYPES.includes(line.type) && line.text === line.text.toUpperCase();
}

function normName(text) {
    return String(text ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

// ---------- Text and scene-heading targets ----------

function regionsFor(line, target) {
    if (target.kind === 'text') {
        return (target.types || []).includes(line.type)
            ? [{ start: 0, end: line.text.length, field: 'text' }]
            : [];
    }
    if (target.kind === 'slug' && line.type === constants.ELEMENT_TYPES.SLUG) {
        const range = parseSlug(line.text)[target.part];
        return range ? [{ start: range.start, end: range.end, field: target.part }] : [];
    }
    return [];
}

// A parenthetical's brackets are drawn by CSS, not stored. A query written
// with them ("(beat)") still means "the bracket is right here", so the
// bracket is dropped from the query and becomes an anchor to that edge.
function splitParenQuery(query) {
    let text = query;
    const anchorStart = text.startsWith('(');
    if (anchorStart) text = text.slice(1);
    const anchorEnd = text.endsWith(')');
    if (anchorEnd) text = text.slice(0, -1);
    return { text, anchorStart, anchorEnd };
}

export function searchLines(lines, target, query, options = {}) {
    if (target.kind === 'character') return { matches: searchCharacter(lines, target, query) };

    const matches = [];
    const q = String(query ?? '');
    if (!q.trim()) return { matches };

    const entire = target.kind === 'slug' && options.entireValue !== false;
    const plans = new Map();
    const planFor = (type) => {
        if (plans.has(type)) return plans.get(type);
        const isParen = type === constants.ELEMENT_TYPES.PARENTHETICAL;
        const parts = isParen ? splitParenQuery(q) : { text: q, anchorStart: false, anchorEnd: false };
        const regex = buildFindRegex(parts.text, {
            matchCase: !!options.matchCase && target.kind === 'text' && !FIND_UPPERCASE_TYPES.includes(type),
            wholeWord: !!options.wholeWord
        });
        const plan = regex && parts.text.trim() ? { ...parts, regex } : null;
        plans.set(type, plan);
        return plan;
    };

    lines.forEach((line, lineIndex) => {
        const regions = regionsFor(line, target);
        if (!regions.length) return;
        const plan = planFor(line.type);
        if (!plan) return;
        for (const region of regions) {
            for (const m of findIn(line.text, plan.regex, region.start, region.end)) {
                if (entire && (m.start !== region.start || m.end !== region.end)) continue;
                if (plan.anchorStart && m.start !== 0) continue;
                if (plan.anchorEnd && m.end !== line.text.length) continue;
                matches.push({ lineId: line.id, lineIndex, start: m.start, end: m.end, text: m.text, field: region.field, ticked: true });
            }
        }
    });
    return { matches };
}

// ---------- Character rename ----------

function hyphenJoined(text, m) {
    const before = text[m.start - 1];
    const after = text[m.end];
    return (FIND_HYPHENS.includes(before) && FIND_WORD_CHAR_RE.test(text[m.start - 2] || '')) ||
        (FIND_HYPHENS.includes(after) && FIND_WORD_CHAR_RE.test(text[m.end + 1] || ''));
}

// Cue lines: the name part must BE the name (ANNA never hits ANNABELLE);
// cues that merely contain it (YOUNG ANNA, ANNA & BOB) are listed unticked.
// Mentions elsewhere: whole word, any case, but starting with a capital —
// renaming WILL must not collect every "will". A mention that is part of a
// longer known character name, or hyphen-joined, is listed unticked.
function searchCharacter(lines, target, query) {
    const matches = [];
    const wanted = normName(query);
    if (!wanted) return matches;
    const nameRe = buildFindRegex(wanted, { wholeWord: true, looseSpaces: true });
    const mentionTypes = target.mentionTypes || [];

    const longerNames = new Set();
    for (const line of lines) {
        if (line.type !== constants.ELEMENT_TYPES.CHARACTER) continue;
        const name = normName(cueNameText(line.text));
        if (name.length > wanted.length && findIn(name, nameRe, 0, name.length).length) longerNames.add(name);
    }
    const longerRes = [...longerNames].map(n => buildFindRegex(n, { wholeWord: true, looseSpaces: true }));

    lines.forEach((line, lineIndex) => {
        const push = (m, field, ticked) =>
            matches.push({ lineId: line.id, lineIndex, start: m.start, end: m.end, text: m.text, field, ticked });

        if (line.type === constants.ELEMENT_TYPES.CHARACTER) {
            const { name } = parseCharacterCue(line.text);
            if (!name) return;
            const cueText = line.text.slice(name.start, name.end);
            if (normName(cueText) === wanted) {
                push({ start: name.start, end: name.end, text: cueText }, 'cue', true);
            } else {
                for (const m of findIn(line.text, nameRe, name.start, name.end)) push(m, 'cue-related', false);
            }
            return;
        }

        if (!mentionTypes.includes(line.type)) return;
        const covered = [];
        for (const re of longerRes) covered.push(...findIn(line.text, re, 0, line.text.length));
        for (const m of findIn(line.text, nameRe, 0, line.text.length)) {
            const first = m.text.charAt(0);
            if (first === first.toLowerCase() && first !== first.toUpperCase()) continue; // lowercase start
            const insideLonger = covered.some(c => c.start <= m.start && m.end <= c.end);
            push(m, 'mention', !insideLonger && !hyphenJoined(line.text, m));
        }
    });
    return matches;
}

// ---------- Replacement ----------

function titleCaseText(text) {
    return text.toLowerCase().replace(/(^|[^\p{L}'’])(\p{L})/gu, (all, lead, letter) => lead + letter.toUpperCase());
}

// "Keep case": shape the replacement like the matched text — ALL CAPS,
// Capitalised, or lower. A replacement the writer typed in deliberate mixed
// case (McCoy) is never re-capitalised.
export function mirrorCase(sample, replacement) {
    const rep = String(replacement ?? '');
    const src = String(sample ?? '');
    const letters = src.replace(/[^\p{L}]/gu, '');
    const upper = letters.toUpperCase();
    const lower = letters.toLowerCase();
    if (!letters || upper === lower) return rep;
    if (letters === upper && letters.length > 1) return rep.toUpperCase();
    if (letters === lower) return rep.toLowerCase();

    const words = src.match(/\p{L}+/gu) || [];
    const capitalised = (w) => w[0] !== w[0].toLowerCase() && w.slice(1) === w.slice(1).toLowerCase();
    const titled = words.length > 0 && capitalised(words[0]) &&
        words.every(w => capitalised(w) || w === w.toLowerCase());
    if (!titled) return rep;
    const repLetters = rep.replace(/[^\p{L}]/gu, '');
    const uniform = repLetters === repLetters.toUpperCase() || repLetters === repLetters.toLowerCase();
    return uniform ? titleCaseText(rep) : rep;
}

function replacementFor(line, m, replaceText, target, options) {
    let rep = String(replaceText ?? '');
    if (target.kind === 'text' && line.type === constants.ELEMENT_TYPES.PARENTHETICAL) {
        const q = String(options.query ?? '');
        if (q.startsWith('(') && rep.startsWith('(')) rep = rep.slice(1);
        if (q.endsWith(')') && rep.endsWith(')')) rep = rep.slice(0, -1);
    }
    if (target.kind === 'character') rep = mirrorCase(m.text, rep.trim().replace(/\s+/g, ' '));
    else if (options.keepCase) rep = mirrorCase(m.text, rep);
    if (isUppercaseLine(line)) rep = rep.toUpperCase();
    return rep;
}

// Applies `matches` (already filtered to the ones to replace) and returns
//   texts: Map<lineId, newText>            only lines that actually changed
//   edits: Map<lineId, [{start, end, length}]>  original range -> new length
// A match whose text no longer sits at its offsets is skipped, so stale
// results can never be written over newer text.
export function applyMatches(lines, matches, replaceText, target, options = {}) {
    const byId = new Map(lines.map(l => [l.id, l]));
    const grouped = new Map();
    for (const m of matches) {
        if (!grouped.has(m.lineId)) grouped.set(m.lineId, []);
        grouped.get(m.lineId).push(m);
    }

    const texts = new Map();
    const edits = new Map();
    for (const [lineId, list] of grouped) {
        const line = byId.get(lineId);
        if (!line) continue;
        const slug = target.kind === 'slug' ? parseSlug(line.text) : null;
        let text = line.text;
        const lineEdits = [];
        // Right to left, so earlier offsets stay valid while the text changes.
        for (const m of [...list].sort((a, b) => b.start - a.start)) {
            if (line.text.slice(m.start, m.end) !== m.text) continue;
            const rep = replacementFor(line, m, replaceText, target, options);
            let { start, end } = m;
            if (slug && rep === '') {
                // Emptying a whole heading part takes its separator with it.
                const range = slug[target.part];
                if (range && start === range.start && end === range.end) {
                    if (target.part === 'time' && slug.timeSep) start = slug.timeSep.start;
                    if (target.part === 'prefix') {
                        while (end < line.text.length && /\s/.test(line.text[end])) end++;
                    }
                }
            }
            text = text.slice(0, start) + rep + text.slice(end);
            lineEdits.push({ start, end, length: rep.length });
        }
        if (text !== line.text) {
            texts.set(lineId, text);
            edits.set(lineId, lineEdits);
        }
    }
    return { texts, edits };
}

// ---------- Tick state across edits ----------

// Identity of a match for remembering its checkbox: line + offset + text.
export function matchKey(m) {
    return `${m.lineId}|${m.start}|${m.text}`;
}

// Where a remembered match sits after `edits` were applied to its line:
// the new key, the same key if its line was not edited, or null if an edit
// swallowed it.
export function shiftKey(key, edits) {
    const first = key.indexOf('|');
    const second = key.indexOf('|', first + 1);
    const lineId = key.slice(0, first);
    const start = Number(key.slice(first + 1, second));
    const text = key.slice(second + 1);
    const lineEdits = edits.get(lineId);
    if (!lineEdits) return key;
    const end = start + text.length;
    let delta = 0;
    for (const e of lineEdits) {
        if (e.end <= start) delta += e.length - (e.end - e.start);
        else if (e.start < end) return null;
    }
    return `${lineId}|${start + delta}|${text}`;
}

export function shiftKeys(keys, edits) {
    const out = new Set();
    for (const key of keys) {
        const next = shiftKey(key, edits);
        if (next !== null) out.add(next);
    }
    return out;
}

// ---------- Value pickers ----------

// Distinct values that exist in the script for a structured target, most
// frequent first: heading prefixes / locations / times, or character names
// (always read from cue lines, never from the autocomplete list).
export function fieldValues(lines, target) {
    const counts = new Map();
    const add = (value) => {
        const v = normName(value);
        if (v) counts.set(v, (counts.get(v) || 0) + 1);
    };
    for (const line of lines) {
        if (target.kind === 'slug' && line.type === constants.ELEMENT_TYPES.SLUG) {
            add(slugPartText(line.text, target.part));
        } else if (target.kind === 'character' && line.type === constants.ELEMENT_TYPES.CHARACTER) {
            add(cueNameText(line.text));
        }
    }
    return [...counts]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
