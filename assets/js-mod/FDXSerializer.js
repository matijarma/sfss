// FDXSerializer — pure Final Draft XML construction (buildFDX) and its import
// inverse (mapFDXParagraphs). No DOM access anywhere: buildFDX emits a
// complete XML string from canonical blocks, mapFDXParagraphs consumes plain
// paragraph objects that IOManager extracts with DOMParser — the DOM stays on
// IOManager's side of the seam, so this module is Node-testable.
//
// Documented limitations:
//   - [[notes]] are DROPPED from FDX output (InlineMarkup.tokensToRuns omits
//     note tokens; emitting <ScriptNote> definitions is a future upgrade).
//   - Dual dialogue is not modeled: blocks pass through as sequential
//     paragraphs (the app-wide documented limitation, spec §4).

import * as constants from './Constants.js';
import { escapeXML, generateLineId } from './Utils.js';
import { tokensToRuns, runsToFountain, plainText } from './InlineMarkup.js';

// A US Letter title page has ~54 live lines. The title sits ~1/3 down
// (spec §3.5 positional layout — never literal "Title:" labels), so 17
// centered spacer paragraphs precede it; bottom spacers push the contact
// block toward the lower-left corner.
const TITLE_PAGE_LINES = 54;
const TITLE_DROP_LINES = 17;

function styleAttr(run) {
    const parts = [];
    if (run.bold) parts.push('Bold');
    if (run.italic) parts.push('Italic');
    if (run.underline) parts.push('Underline');
    return parts.length ? ` Style="${parts.join('+')}"` : '';
}

// Block text -> one or more <Text> elements. Emphasis markers become
// Style="Bold"/"Italic"/"Underline" (and + combos); [[notes]] are dropped.
function textRunsXML(text) {
    const runs = tokensToRuns(text || '');
    if (!runs.length) return '<Text></Text>\n';
    return runs.map(r => `<Text${styleAttr(r)}>${escapeXML(r.text)}</Text>\n`).join('');
}

// <SceneProperties> for a scene heading. Length arrives pre-normalized from
// the caller (Utils.formatEighths(e, 'fdx') — "1 3/8", never "16/8").
function scenePropertiesXML(stats) {
    const length = stats.length || '1/8';
    const page = stats.page || 1;
    let xml = `<SceneProperties Length="${escapeXML(String(length))}" Page="${escapeXML(String(page))}" Title="">\n`;
    if (stats.description) {
        xml += '<Summary>\n';
        String(stats.description).split('\n').forEach(line => {
            xml += '<Paragraph Alignment="Left" FirstIndent="0.00" Leading="Regular" LeftIndent="0.00" RightIndent="1.39" SpaceBefore="0" Spacing="1" StartsNewPage="No">\n';
            xml += `<Text AdornmentStyle="0" Background="#FFFFFFFFFFFF" Color="#000000000000" Font="Courier Final Draft" RevisionID="0" Size="12" Style="">${escapeXML(line)}</Text>\n`;
            xml += '</Paragraph>\n';
        });
        xml += '</Summary>\n';
    }
    xml += '</SceneProperties>\n';
    return xml;
}

function tpParagraph(alignment, text) {
    return `<Paragraph Alignment="${alignment}">\n<Text>${escapeXML(text)}</Text>\n</Paragraph>\n`;
}

// Positional title page (spec §3.5): centered spacers, title, blank,
// "Written by", author; contact left-aligned at the bottom.
function buildTitlePage(meta) {
    const title = String(meta.title || '').trim();
    const author = String(meta.author || '').trim();
    const contactLines = String(meta.contact || '').split('\n')
        .map(l => l.trim()).filter(l => l !== '');

    const paras = [];
    for (let i = 0; i < TITLE_DROP_LINES; i++) paras.push(['Center', '']);
    paras.push(['Center', title]);
    if (author) {
        paras.push(['Center', '']);
        paras.push(['Center', 'Written by']);
        paras.push(['Center', '']);
        paras.push(['Center', author]);
    }
    if (contactLines.length) {
        const pad = Math.max(1, TITLE_PAGE_LINES - 4 - paras.length - contactLines.length);
        for (let i = 0; i < pad; i++) paras.push(['Center', '']);
        contactLines.forEach(line => paras.push(['Left', line]));
    }

    let xml = '<TitlePage>\n<Content>\n';
    paras.forEach(([align, text]) => { xml += tpParagraph(align, text); });
    xml += '</Content>\n</TitlePage>\n';
    return xml;
}

function smartTypeXML(smartType) {
    const lists = [
        ['Characters', 'Character', smartType.characters],
        ['Locations', 'Location', smartType.locations],
        ['Times', 'Time', smartType.times],
        ['Extensions', 'Extension', smartType.extensions]
    ];
    let xml = '<SmartType>\n';
    for (const [plural, singular, items] of lists) {
        xml += `<${plural}>\n`;
        for (const item of items || []) {
            xml += `<${singular}>${escapeXML(item)}</${singular}>\n`;
        }
        xml += `</${plural}>\n`;
    }
    xml += '</SmartType>\n';
    return xml;
}

/**
 * Builds a complete FDX document string.
 * @param {Object} input
 *   meta:       { title, author, contact } (display flags ignored here)
 *   blocks:     canonical [{ id, type, text, centered?, tight?, pageBreak? }]
 *   sceneStats: { [slugLineId]: { page, length, number?, description? } } —
 *               page/length computed by the caller via GeometryManager,
 *               number/description merged in from sceneMeta.
 *   smartType:  { characters:[], locations:[], times:[], extensions?:[] }
 * @returns {string} XML
 */
export function buildFDX({ meta = {}, blocks = [], sceneStats = {}, smartType = {} } = {}) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n';
    xml += '<FinalDraft DocumentType="Script" Template="No" Version="1">\n';
    xml += '<Content>\n';

    let autoSceneIndex = 1;
    // Dual dialogue is not modeled — blocks are emitted strictly in sequence.
    for (const block of blocks || []) {
        const type = block.type || constants.ELEMENT_TYPES.ACTION;
        const fdxType = constants.FDX_MAP[type] || 'Action';
        let attrs = ` Type="${fdxType}"`;
        // Transitions are right-aligned (spec §3.2.2); centered blocks
        // (Fountain "> x <") carry Alignment="Center".
        if (type === constants.ELEMENT_TYPES.TRANSITION) attrs += ' Alignment="Right"';
        else if (block.centered) attrs += ' Alignment="Center"';

        let inner = '';
        if (type === constants.ELEMENT_TYPES.SLUG) {
            const stats = sceneStats[block.id] || {};
            const num = stats.number || String(autoSceneIndex);
            attrs += ` Number="${escapeXML(String(num))}"`;
            inner += scenePropertiesXML(stats);
            autoSceneIndex++;
        }
        inner += textRunsXML(block.text);
        xml += `<Paragraph${attrs}>\n${inner}</Paragraph>\n`;
    }

    xml += '</Content>\n';
    xml += buildTitlePage(meta || {});
    xml += smartTypeXML(smartType || {});
    xml += '</FinalDraft>';
    return xml;
}

/**
 * Pure inverse for FDX import. Input paragraphs are plain objects the caller
 * extracted from the XML DOM:
 *   [{ type, number, alignment,
 *      textRuns: [{ text, bold, italic, underline }],
 *      sceneProps?: { description } }]
 * @returns {Object} { blocks, sceneMeta, characters }
 *   blocks:    canonical [{ id, type, text, centered? }] — style runs become
 *              marker text via InlineMarkup.runsToFountain
 *   sceneMeta: { [slugId]: { number?, description? } }
 *   characters: cleaned unique character names
 */
export function mapFDXParagraphs(paras) {
    const { SLUG, ACTION, CHARACTER, PARENTHETICAL } = constants.ELEMENT_TYPES;
    const blocks = [];
    const sceneMeta = {};
    const characters = [];

    for (const p of paras || []) {
        if (!p) continue;
        const type = constants.FDX_REVERSE_MAP[p.type] || ACTION;
        let text = runsToFountain(p.textRuns || []);
        if (type === PARENTHETICAL) {
            // Canonical JSON text carries the outer parens.
            if (!text.startsWith('(')) text = '(' + text;
            if (!text.endsWith(')')) text = text + ')';
        }

        const block = { id: generateLineId(), type, text };
        // FDX has no "centered" element: Alignment="Center" on Action is the
        // Fountain "> x <" equivalent.
        if (type === ACTION && p.alignment === 'Center' && text.trim() !== '') {
            block.centered = true;
        }
        blocks.push(block);

        if (type === SLUG) {
            const entry = {};
            if (p.number) entry.number = String(p.number);
            if (p.sceneProps && p.sceneProps.description) entry.description = p.sceneProps.description;
            if (Object.keys(entry).length) sceneMeta[block.id] = entry;
        }
        if (type === CHARACTER) {
            // Same cleaning rule as EditorHandler.getCleanCharacterName, but
            // pure — and marker-stripped so "**BOB**" still registers as BOB.
            const clean = plainText(text).replace(/\s*\(.*?\)\s*/g, '').trim().toUpperCase();
            if (clean.length > 1 && !characters.includes(clean)) characters.push(clean);
        }
    }

    return { blocks, sceneMeta, characters };
}
