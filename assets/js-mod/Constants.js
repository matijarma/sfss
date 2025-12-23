export const ELEMENT_TYPES = {
    SLUG: 'sc-slug',
    ACTION: 'sc-action',
    CHARACTER: 'sc-character',
    DIALOGUE: 'sc-dialogue',
    PARENTHETICAL: 'sc-parenthetical',
    TRANSITION: 'sc-transition'
};

export const TYPE_LABELS = {
    'sc-slug': 'Scene Heading',
    'sc-action': 'Action',
    'sc-character': 'Character',
    'sc-dialogue': 'Dialogue',
    'sc-parenthetical': 'Parenthetical',
    'sc-transition': 'Transition'
};

export const TYPE_SHORTCUTS = { 's': ELEMENT_TYPES.SLUG, 'a': ELEMENT_TYPES.ACTION, 'c': ELEMENT_TYPES.CHARACTER, 'd': ELEMENT_TYPES.DIALOGUE, 'p': ELEMENT_TYPES.PARENTHETICAL, 't': ELEMENT_TYPES.TRANSITION };

// FDX Map: SFSS Class -> FDX XML Type Attribute
export const FDX_MAP = {
    'sc-slug': 'Scene Heading',
    'sc-action': 'Action',
    'sc-character': 'Character',
    'sc-dialogue': 'Dialogue',
    'sc-parenthetical': 'Parenthetical',
    'sc-transition': 'Transition'
};

// Reverse Map: FDX Type -> SFSS Class
export const FDX_REVERSE_MAP = {
    'Scene Heading': 'sc-slug',
    'Action': 'sc-action',
    'Character': 'sc-character',
    'Dialogue': 'sc-dialogue',
    'Parenthetical': 'sc-parenthetical',
    'Transition': 'sc-transition',
    'General': 'sc-action', 
    'Shot': 'sc-action', 
    'Cast List': 'sc-action'
};

export const FORMATTING = {
    FONT_SIZE_PT: 12,
    LINE_HEIGHT_PT: 12,
    LINES_PER_INCH: 6,
    PIXELS_PER_INCH: 96, // CSS standard
    CHAR_WIDTH_INCH: 0.10
};

export const PAPER_CONFIGS = {
    US_LETTER: {
        name: "US Letter",
        cssSize: "letter",
        dimensions: { width: 8.5, height: 11.0 },
        margins: { top: 1.0, bottom: 1.0, left: 1.5, right: 1.0 },
        liveArea: { width: 6.0, height: 9.0 }
    },
    A4_EMULATION: {
        name: "A4 (US Emulation)",
        cssSize: "A4",
        dimensions: { width: 8.27, height: 11.69 },
        margins: { top: 1.0, bottom: 1.7, left: 1.5, right: 0.8 },
        liveArea: { width: 5.97, height: 8.99 }
    }
};

export const ELEMENT_INDENTS = {
    [ELEMENT_TYPES.SLUG]: { left: 0, width: '100%' },
    [ELEMENT_TYPES.ACTION]: { left: 0, width: '100%' },
    [ELEMENT_TYPES.CHARACTER]: { left: 2.2, width: 'auto' }, // Inches from margin
    [ELEMENT_TYPES.DIALOGUE]: { left: 1.0, width: 3.5 },
    [ELEMENT_TYPES.PARENTHETICAL]: { left: 1.6, width: 2.4 },
    [ELEMENT_TYPES.TRANSITION]: { left: 0, width: 'auto', align: 'right' } // Special handling
};

export const CHARACTER_SUFFIXES = [
    'V.O.',
    'O.S.',
    'O.C.',
    'CONT\'D',
    'VOICE',
    'FILTERED',
    'INTO PHONE',
    'ON PHONE',
    'PRE-LAP'
];