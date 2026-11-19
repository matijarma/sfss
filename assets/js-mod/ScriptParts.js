// Pure parsers for the structured parts of screenplay lines: a scene
// heading's prefix / location / time of day, and a character cue's name
// versus its extensions ("(V.O.)", "(CONT'D)").
//
// Every result is a { start, end } range into the ORIGINAL text, so callers
// can search or rewrite one part and leave the rest of the line untouched.
// Used by Find & Replace. Import-safe under Node (no DOM).

// Scene-heading prefixes, longest first. A period, whitespace or the end of
// the text must follow, so INTERCUT / ESTABLISHING / EXTERIOR are not
// prefixes. Superset of FountainParser's SCENE_HEADING_RE.
const SLUG_PREFIX_RE = /^\s*(INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT|EST)(\.|(?=\s)|$)/i;

// Separator between location and time: a dash with whitespace on both
// sides ("7-ELEVEN" and "JEAN-LUC" stay inside the location).
const SLUG_TIME_SEP_RE = /\s+[-–—]\s+/g;

// Time of day is "the last dash-separated segment" — the same rule the
// Treatment view and the FDX export use, so all three agree.
export function parseSlug(text) {
    const src = String(text ?? '');
    const result = { prefix: null, location: null, time: null, timeSep: null };

    let pos = 0;
    const m = SLUG_PREFIX_RE.exec(src);
    if (m) {
        const end = m[0].length;
        result.prefix = { start: end - m[1].length - m[2].length, end };
        pos = end;
    }

    let start = pos;
    while (start < src.length && /\s/.test(src[start])) start++;
    let end = src.length;
    while (end > start && /\s/.test(src[end - 1])) end--;
    if (start >= end) return result;

    const rest = src.slice(start, end);
    let last = null;
    SLUG_TIME_SEP_RE.lastIndex = 0;
    for (let s = SLUG_TIME_SEP_RE.exec(rest); s; s = SLUG_TIME_SEP_RE.exec(rest)) last = s;

    if (last && last.index > 0) {
        const sepStart = start + last.index;
        const sepEnd = sepStart + last[0].length;
        result.location = { start, end: sepStart };
        result.timeSep = { start: sepStart, end: sepEnd };
        result.time = { start: sepEnd, end };
    } else {
        result.location = { start, end };
    }
    return result;
}

// Text of one part ('prefix' | 'location' | 'time'), '' when absent.
export function slugPartText(text, part) {
    const range = parseSlug(text)[part];
    return range ? String(text).slice(range.start, range.end) : '';
}

// A cue is a name plus any number of parenthesised extensions. The name is
// the first non-empty stretch of text outside the brackets (normally
// everything before the first one). An unclosed "(" still ends the name.
export function parseCharacterCue(text) {
    const src = String(text ?? '');
    const extensions = [];
    const outside = [];
    let cursor = 0;
    const re = /\([^()]*\)?/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
        if (m.index > cursor) outside.push({ start: cursor, end: m.index });
        extensions.push({ start: m.index, end: m.index + m[0].length });
        cursor = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
    }
    if (cursor < src.length) outside.push({ start: cursor, end: src.length });

    let name = null;
    for (const seg of outside) {
        let { start, end } = seg;
        while (start < end && /\s/.test(src[start])) start++;
        while (end > start && /\s/.test(src[end - 1])) end--;
        if (start < end) { name = { start, end }; break; }
    }
    return { name, extensions };
}

// The cue's name as typed (case kept), '' when the cue has none.
export function cueNameText(text) {
    const { name } = parseCharacterCue(text);
    return name ? String(text).slice(name.start, name.end) : '';
}
