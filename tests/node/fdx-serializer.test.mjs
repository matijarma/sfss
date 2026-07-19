import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFDX, mapFDXParagraphs } from '../../assets/js-mod/FDXSerializer.js';
import { tokensToRuns } from '../../assets/js-mod/InlineMarkup.js';
import { formatEighths } from '../../assets/js-mod/Utils.js';
import * as constants from '../../assets/js-mod/Constants.js';

const T = constants.ELEMENT_TYPES;

// ---------- buildFDX ----------

test('buildFDX emits the FDX skeleton', () => {
    const xml = buildFDX({});
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="no" ?>'));
    assert.match(xml, /<FinalDraft DocumentType="Script" Template="No" Version="1">/);
    assert.ok(xml.includes('<Content>'));
    assert.ok(xml.includes('<TitlePage>'));
    assert.ok(xml.includes('<SmartType>'));
    assert.ok(xml.trimEnd().endsWith('</FinalDraft>'));
});

test('buildFDX title page: positional layout, no literal labels', () => {
    const xml = buildFDX({
        meta: { title: 'THE BIG ONE', author: 'Jane Doe', contact: 'Jane Doe\n555-1234' }
    });
    const tp = xml.slice(xml.indexOf('<TitlePage>'), xml.indexOf('</TitlePage>'));

    // No key/value labels anywhere (the legacy SFSS bug).
    assert.ok(!/Title:|Author:|Contact:/.test(xml), 'no literal Title:/Author:/Contact: labels');

    // Title ~1/3 down: a stack of empty centered spacer paragraphs precedes it.
    const titleIdx = tp.indexOf('<Text>THE BIG ONE</Text>');
    assert.ok(titleIdx > -1, 'title paragraph present');
    const spacersBefore = (tp.slice(0, titleIdx).match(/<Text><\/Text>/g) || []).length;
    assert.ok(spacersBefore >= 10, `title dropped by spacer paragraphs (got ${spacersBefore})`);

    // Author sits under a "Written by" line, all centered.
    const byIdx = tp.indexOf('<Text>Written by</Text>');
    const authorIdx = tp.indexOf('<Text>Jane Doe</Text>', byIdx);
    assert.ok(byIdx > titleIdx, '"Written by" after the title');
    assert.ok(authorIdx > byIdx, 'author after "Written by"');

    // Contact lines are left-aligned at the bottom.
    assert.ok(tp.includes('<Paragraph Alignment="Left">\n<Text>555-1234</Text>'), 'contact left-aligned');
    assert.ok(tp.lastIndexOf('<Paragraph Alignment="Left">') > authorIdx, 'contact below the author block');
});

test('buildFDX: transitions get Alignment="Right"', () => {
    const xml = buildFDX({ blocks: [{ id: 't1', type: T.TRANSITION, text: 'CUT TO:' }] });
    assert.ok(xml.includes('<Paragraph Type="Transition" Alignment="Right">'));
});

test('buildFDX: centered action gets Alignment="Center", plain action gets none', () => {
    const xml = buildFDX({
        blocks: [
            { id: 'a1', type: T.ACTION, text: 'THE END', centered: true },
            { id: 'a2', type: T.ACTION, text: 'Plain line.' }
        ]
    });
    assert.ok(xml.includes('<Paragraph Type="Action" Alignment="Center">\n<Text>THE END</Text>'));
    assert.ok(xml.includes('<Paragraph Type="Action">\n<Text>Plain line.</Text>'));
});

test('buildFDX: emphasis markers become multiple <Text Style> runs', () => {
    const xml = buildFDX({ blocks: [{ id: 'a1', type: T.ACTION, text: '**b** plain *i*' }] });
    assert.ok(xml.includes(
        '<Text Style="Bold">b</Text>\n<Text> plain </Text>\n<Text Style="Italic">i</Text>'
    ));
    const content = xml.slice(xml.indexOf('<Content>'), xml.indexOf('</Content>'));
    assert.ok(!content.includes('**'), 'no raw markers in the content');
});

test('buildFDX: combined styles join with "+"', () => {
    const xml = buildFDX({ blocks: [{ id: 'a1', type: T.ACTION, text: 'it _**explodes**_.' }] });
    assert.ok(xml.includes('<Text Style="Bold+Underline">explodes</Text>'));
});

test('buildFDX: scene headings carry Number + SceneProperties (normalized Length)', () => {
    const xml = buildFDX({
        blocks: [
            { id: 's1', type: T.SLUG, text: 'INT. LAB - NIGHT' },
            { id: 's2', type: T.SLUG, text: 'EXT. ROOF - DAY' }
        ],
        sceneStats: {
            s1: {
                page: 2,
                length: formatEighths(11, 'fdx'), // "1 3/8", never "11/8"
                number: '1A',
                description: 'Alien wakes.\nBadly.'
            }
            // s2 intentionally has no stats: falls back to defaults + auto number
        }
    });
    assert.ok(xml.includes('<Paragraph Type="Scene Heading" Number="1A">'));
    assert.ok(xml.includes('<SceneProperties Length="1 3/8" Page="2" Title="">'));
    assert.ok(xml.includes('>Alien wakes.</Text>'), 'summary line 1');
    assert.ok(xml.includes('>Badly.</Text>'), 'summary line 2');
    // Second slug: auto-numbered sequentially, default stats.
    assert.ok(xml.includes('<Paragraph Type="Scene Heading" Number="2">'));
    assert.ok(xml.includes('<SceneProperties Length="1/8" Page="1" Title="">'));
    assert.equal(formatEighths(16, 'fdx'), '2', 'caller-side normalization contract');
});

test('buildFDX: SmartType lists are emitted', () => {
    const xml = buildFDX({
        smartType: {
            characters: ['DR. VANCE'],
            locations: ['LAB'],
            times: ['NIGHT'],
            extensions: ['V.O.']
        }
    });
    assert.ok(xml.includes('<Characters>\n<Character>DR. VANCE</Character>\n</Characters>'));
    assert.ok(xml.includes('<Locations>\n<Location>LAB</Location>\n</Locations>'));
    assert.ok(xml.includes('<Times>\n<Time>NIGHT</Time>\n</Times>'));
    assert.ok(xml.includes('<Extensions>\n<Extension>V.O.</Extension>\n</Extensions>'));
});

test('buildFDX: quotes, apostrophes and angle brackets are XML-escaped', () => {
    const xml = buildFDX({
        meta: { title: `Bob's "Great" <Script>` },
        blocks: [{ id: 'a1', type: T.ACTION, text: '5 < 6 & "q"' }],
        smartType: { characters: [`O'BRIEN <THE ROCK>`] }
    });
    assert.ok(xml.includes('Bob&apos;s &quot;Great&quot; &lt;Script&gt;'));
    assert.ok(xml.includes('<Text>5 &lt; 6 &amp; &quot;q&quot;</Text>'));
    assert.ok(xml.includes('<Character>O&apos;BRIEN &lt;THE ROCK&gt;</Character>'));
    assert.ok(!xml.includes('<Script>'), 'no raw user-supplied tags');
});

test('buildFDX: [[notes]] are dropped from the output', () => {
    const xml = buildFDX({ blocks: [{ id: 'a1', type: T.ACTION, text: 'Look [[fix later]] here.' }] });
    assert.ok(!xml.includes('fix later'), 'note text absent');
    assert.ok(xml.includes('<Text>Look </Text>\n<Text> here.</Text>'), 'surrounding text kept');
});

test('buildFDX: empty text still emits a <Text> element', () => {
    const xml = buildFDX({ blocks: [{ id: 'a1', type: T.ACTION, text: '' }] });
    assert.ok(xml.includes('<Paragraph Type="Action">\n<Text></Text>\n</Paragraph>'));
});

// ---------- mapFDXParagraphs ----------

test('mapFDXParagraphs: style runs become canonical marker text', () => {
    const { blocks } = mapFDXParagraphs([{
        type: 'Action',
        textRuns: [
            { text: 'The alien ' },
            { text: 'SCREAMS', bold: true },
            { text: ' and ' },
            { text: 'hisses', italic: true },
            { text: ' before it ' },
            { text: 'explodes', bold: true, underline: true },
            { text: '.' }
        ]
    }]);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, T.ACTION);
    assert.equal(blocks[0].text, 'The alien **SCREAMS** and *hisses* before it _**explodes**_.');
});

test('mapFDXParagraphs: centered detection is Action-only', () => {
    const { blocks } = mapFDXParagraphs([
        { type: 'Action', alignment: 'Center', textRuns: [{ text: 'THE END' }] },
        { type: 'Action', textRuns: [{ text: 'Plain.' }] },
        { type: 'Transition', alignment: 'Center', textRuns: [{ text: 'CUT TO:' }] }
    ]);
    assert.equal(blocks[0].centered, true);
    assert.equal(blocks[1].centered, undefined);
    assert.equal(blocks[2].centered, undefined);
});

test('mapFDXParagraphs: legacy vs standard paragraph shapes both map', () => {
    // Legacy SFSS export shape: bare Number attr, single unstyled run,
    // no Alignment, no sceneProps.
    const legacy = mapFDXParagraphs([
        { type: 'Scene Heading', number: '1', textRuns: [{ text: 'INT. OFFICE - DAY' }] }
    ]);
    assert.equal(legacy.blocks[0].type, T.SLUG);
    assert.deepEqual(legacy.sceneMeta[legacy.blocks[0].id], { number: '1' });

    // Standard shape: full attributes + SceneProperties description.
    const std = mapFDXParagraphs([
        {
            type: 'Scene Heading', number: '1A', alignment: 'Left',
            sceneProps: { description: 'Arrival.' },
            textRuns: [{ text: 'EXT. HOUSE - DAY', bold: false, italic: false, underline: false }]
        },
        { type: 'Shot', textRuns: [{ text: 'ANGLE ON the porch.' }] },
        { type: 'Nonsense Type', textRuns: [{ text: 'Falls back to action.' }] }
    ]);
    assert.deepEqual(std.sceneMeta[std.blocks[0].id], { number: '1A', description: 'Arrival.' });
    assert.equal(std.blocks[1].type, T.ACTION, 'Shot maps to action');
    assert.equal(std.blocks[2].type, T.ACTION, 'unknown types fall back to action');
});

test('mapFDXParagraphs: characters are collected clean and unique', () => {
    const { characters } = mapFDXParagraphs([
        { type: 'Character', textRuns: [{ text: 'DR. VANCE (V.O.)' }] },
        { type: 'Character', textRuns: [{ text: 'dr. vance' }] },
        { type: 'Character', textRuns: [{ text: 'X' }] } // too short: skipped
    ]);
    assert.deepEqual(characters, ['DR. VANCE']);
});

test('mapFDXParagraphs: parenthetical text gains canonical outer parens', () => {
    const { blocks } = mapFDXParagraphs([
        { type: 'Parenthetical', textRuns: [{ text: 'beat' }] },
        { type: 'Parenthetical', textRuns: [{ text: '(already wrapped)' }] }
    ]);
    assert.equal(blocks[0].text, '(beat)');
    assert.equal(blocks[1].text, '(already wrapped)');
});

test('mapFDXParagraphs: empty-input safety', () => {
    assert.deepEqual(mapFDXParagraphs(), { blocks: [], sceneMeta: {}, characters: [] });
    assert.deepEqual(mapFDXParagraphs(null), { blocks: [], sceneMeta: {}, characters: [] });
    assert.deepEqual(mapFDXParagraphs([]), { blocks: [], sceneMeta: {}, characters: [] });
    const { blocks } = mapFDXParagraphs([{ type: 'Action', textRuns: [] }, null]);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].text, '');
});

// ---------- round-trip ----------

test('round-trip: blocks -> runs -> mapFDXParagraphs preserves texts and flags', () => {
    const src = [
        { id: 'a', type: T.SLUG, text: 'INT. LAB - NIGHT' },
        { id: 'b', type: T.ACTION, text: 'The alien **SCREAMS** and *hisses*.' },
        { id: 'c', type: T.ACTION, text: 'THE END', centered: true },
        { id: 'd', type: T.CHARACTER, text: 'DR. VANCE (V.O.)' },
        { id: 'e', type: T.PARENTHETICAL, text: '(beat)' },
        { id: 'f', type: T.DIALOGUE, text: 'It was _**never**_ me.' },
        { id: 'g', type: T.ACTION, text: 'a \\*literal\\* star' },
        { id: 'h', type: T.TRANSITION, text: 'CUT TO:' }
    ];
    // Simulate export + DOM extraction: the exact runs buildFDX would emit,
    // read back as plain paragraph objects.
    const paras = src.map(b => ({
        type: constants.FDX_MAP[b.type],
        number: null,
        alignment: b.type === T.TRANSITION ? 'Right' : (b.centered ? 'Center' : null),
        textRuns: tokensToRuns(b.text)
    }));
    const { blocks } = mapFDXParagraphs(paras);
    assert.deepEqual(blocks.map(b => b.type), src.map(b => b.type));
    assert.deepEqual(blocks.map(b => b.text), src.map(b => b.text));
    assert.deepEqual(blocks.map(b => !!b.centered), src.map(b => !!b.centered));
});
