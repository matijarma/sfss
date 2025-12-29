import * as constants from './Constants.js';

export class FountainParser {
    constructor() {}

    /**
     * Parses a raw Fountain string into SFSS Block Objects.
     * @param {string} text - The raw Fountain text.
     * @returns {Object} { blocks: Array, meta: Object, sceneMeta: Object }
     */
    parse(text) {
        const lines = text.split(/\r\n|\r|\n/);
        const blocks = [];
        const meta = {};
        const sceneMeta = {}; // To store extracted scene numbers and descriptions
        let isTitlePage = true;
        let lastSceneId = null; // Track the current scene to attach synopses/notes
        
        // Regex Helpers
        const regex = {
            sceneHeading: /^(?:INT\.|EXT\.|EST\.|INT\/EXT|I\/E)(\s|\.|\$)/i,
            sceneNumber: /#([^#]+)#/, // Extracts content between # #
            transition: /TO:$/,
            lyrics: /^~/,
            section: /^(#+)(?: *)(.*)/,
            synopsis: /^=(?: *)(.*)/,
            boneyard: /\/\*[\s\S]*?\*\//g, // Multiline (handled differently usually, but simple check here)
            centered: /^>(.*)<$/,
            pageBreak: /^===/
        };

        // 1. Parse Title Page (Key: Value pairs at start)
        let i = 0;
        while (i < lines.length && isTitlePage) {
            const line = lines[i].trim();
            if (line === '') {
                // Blank line might end title page if next line is not key:value
                if (lines[i+1] && !lines[i+1].includes(':')) {
                    isTitlePage = false;
                }
                i++; 
                continue;
            }

            const colonIndex = line.indexOf(':');
            if (colonIndex > -1 && colonIndex < line.length - 1) {
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                meta[key] = value;
                i++;
            } else {
                isTitlePage = false;
            }
        }

        // 2. Parse Body
        for (; i < lines.length; i++) {
            let line = lines[i]; 
            const trimmed = line.trim();

            if (trimmed === '') continue;

            // Check for Synopsis (= Description)
            const synopsisMatch = trimmed.match(regex.synopsis);
            if (synopsisMatch) {
                if (lastSceneId) {
                    if (!sceneMeta[lastSceneId]) sceneMeta[lastSceneId] = {};
                    const desc = synopsisMatch[1].trim();
                    if (sceneMeta[lastSceneId].description) {
                        sceneMeta[lastSceneId].description += '\n' + desc;
                    } else {
                        sceneMeta[lastSceneId].description = desc;
                    }
                }
                continue;
            }

            // Generate ID
            const id = `line-${Math.random().toString(36).substring(2, 11)}`;

            // --- FORCED ELEMENTS ---
            if (trimmed.startsWith('.')) {
                // Forced Scene Heading
                const text = trimmed.substring(1).trim(); // Remove dot
                const { cleanText, number } = this.extractSceneNumber(text);
                if (number) {
                    if (!sceneMeta[id]) sceneMeta[id] = {};
                    sceneMeta[id].number = number;
                }
                
                blocks.push({ type: constants.ELEMENT_TYPES.SLUG, text: cleanText.toUpperCase(), id });
                lastSceneId = id;
                continue;
            }
            if (trimmed.startsWith('!')) {
                // Forced Action
                blocks.push({ type: constants.ELEMENT_TYPES.ACTION, text: trimmed.substring(1), id });
                continue;
            }
            if (trimmed.startsWith('@')) {
                // Forced Character
                blocks.push({ type: constants.ELEMENT_TYPES.CHARACTER, text: trimmed.substring(1).toUpperCase(), id });
                continue;
            }
            if (trimmed.startsWith('>')) {
                // Forced Transition OR Centered
                if (trimmed.endsWith('<')) {
                    // Centered Action
                    const centerText = trimmed.substring(1, trimmed.length - 1).trim();
                    blocks.push({ type: constants.ELEMENT_TYPES.ACTION, text: centerText, id, centered: true });
                } else {
                    // Forced Transition
                    blocks.push({ type: constants.ELEMENT_TYPES.TRANSITION, text: trimmed.substring(1).toUpperCase(), id });
                }
                continue;
            }

            // --- HEURISTICS ---

            // Scene Headings
            if (regex.sceneHeading.test(trimmed)) {
                const { cleanText, number } = this.extractSceneNumber(trimmed);
                if (number) {
                    if (!sceneMeta[id]) sceneMeta[id] = {};
                    sceneMeta[id].number = number;
                }
                blocks.push({ type: constants.ELEMENT_TYPES.SLUG, text: cleanText.toUpperCase(), id });
                lastSceneId = id;
                continue;
            }

            // Transitions (Uppercase, ends with TO:)
            if (trimmed === trimmed.toUpperCase() && regex.transition.test(trimmed)) {
                blocks.push({ type: constants.ELEMENT_TYPES.TRANSITION, text: trimmed, id });
                continue;
            }

            // Character (Uppercase, preceded by blank line - usually)
            if (trimmed === trimmed.toUpperCase() && trimmed.length > 0 && !['(', ')'].includes(trimmed[0])) {
                // Peek ahead to see if it's followed by text (Dialogue)
                let nextLineIndex = i + 1;
                while (nextLineIndex < lines.length && lines[nextLineIndex].trim() === '') nextLineIndex++;
                
                const nextLine = lines[nextLineIndex] ? lines[nextLineIndex].trim() : null;
                
                if (nextLine) {
                     // It is likely a character
                     let text = trimmed;
                     if (text.endsWith('^')) {
                         text = text.substring(0, text.length - 1).trim();
                     }
                     blocks.push({ type: constants.ELEMENT_TYPES.CHARACTER, text: text, id });
                     continue;
                }
            }

            // Parenthetical
            if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
                blocks.push({ type: constants.ELEMENT_TYPES.PARENTHETICAL, text: trimmed, id });
                continue;
            }

            // Dialogue (If previous block was Character or Parenthetical)
            const prevBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
            if (prevBlock && (prevBlock.type === constants.ELEMENT_TYPES.CHARACTER || prevBlock.type === constants.ELEMENT_TYPES.PARENTHETICAL)) {
                blocks.push({ type: constants.ELEMENT_TYPES.DIALOGUE, text: trimmed, id });
                continue;
            }

            // Default: Action
            blocks.push({ type: constants.ELEMENT_TYPES.ACTION, text: trimmed, id });
        }

        return { blocks, meta, sceneMeta };
    }

    /**
     * Generates a Fountain string from SFSS data.
     * @param {Object} scriptData - { meta: {}, blocks: [], sceneMeta: {} }
     * @returns {string} The formatted Fountain script.
     */
    generate(scriptData) {
        const blocks = scriptData.blocks;
        const meta = scriptData.meta || {};
        const sceneMeta = scriptData.sceneMeta || {};
        let output = [];

        // 1. Title Page
        if (meta.title) output.push(`Title: ${meta.title}`);
        if (meta.author) output.push(`Author: ${meta.author}`);
        if (meta.contact) {
            output.push(`Contact:\n${meta.contact}`);
        }
        output.push('\n'); // Separator

        // 2. Body
        blocks.forEach((block, index) => {
            const text = block.text;
            const type = block.type;
            const prevType = index > 0 ? blocks[index - 1].type : null;
            
            // Add blank lines before certain elements
            if (index > 0) {
                 const needsSpacing = [
                     constants.ELEMENT_TYPES.SLUG, 
                     constants.ELEMENT_TYPES.ACTION, 
                     constants.ELEMENT_TYPES.CHARACTER,
                     constants.ELEMENT_TYPES.TRANSITION
                 ].includes(type);
                 
                 // Don't double space dialogue/parentheticals attached to character
                 if (type === constants.ELEMENT_TYPES.DIALOGUE || type === constants.ELEMENT_TYPES.PARENTHETICAL) {
                     // No space
                 } else if (type === constants.ELEMENT_TYPES.ACTION && prevType === constants.ELEMENT_TYPES.SLUG) {
                     output.push('');
                 } else if (needsSpacing) {
                     output.push('');
                 }
            }

            switch (type) {
                case constants.ELEMENT_TYPES.SLUG:
                    let line = text.toUpperCase();
                    if (!line.startsWith('.') && !/^(INT|EXT|EST|I\/E)/i.test(line)) {
                        line = '.' + line; // Force it if it doesn't look like one
                    }
                    // Attach Scene Number
                    if (sceneMeta[block.id] && sceneMeta[block.id].number) {
                        line += ` #${sceneMeta[block.id].number}#`;
                    }
                    output.push(line);
                    
                    // Attach Synopsis (Description)
                    if (sceneMeta[block.id] && sceneMeta[block.id].description) {
                         const descLines = sceneMeta[block.id].description.split('\n');
                         descLines.forEach(l => {
                             if (l.trim()) output.push(`= ${l.trim()}`);
                         });
                    }
                    break;
                
                case constants.ELEMENT_TYPES.ACTION:
                    if (text.startsWith('!')) output.push(text); // Already forced
                    else if (block.centered) output.push(`> ${text} <`);
                    else output.push(text);
                    break;

                case constants.ELEMENT_TYPES.CHARACTER:
                    // Force if contains lowercase or isn't standard
                    if (text !== text.toUpperCase() || text.includes('(')) {
                         if (/[a-z]/.test(text.replace(/\(.*\)/, ''))) {
                             output.push(`@${text}`);
                         } else {
                             output.push(text.toUpperCase());
                         }
                    } else {
                        output.push(text);
                    }
                    break;

                case constants.ELEMENT_TYPES.DIALOGUE:
                    output.push(text);
                    break;

                case constants.ELEMENT_TYPES.PARENTHETICAL:
                    output.push(text);
                    break;

                case constants.ELEMENT_TYPES.TRANSITION:
                    if (!text.endsWith('TO:')) {
                        output.push(`> ${text.toUpperCase()}`);
                    } else {
                        output.push(text.toUpperCase());
                    }
                    break;
            }
        });

        return output.join('\n');
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