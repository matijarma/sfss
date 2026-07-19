// Phase 6 spec-compliance tests: parse -> generate -> parse must be a fixed
// point for EVERY fountain fixture (types, texts, flags, sceneMeta sections/
// descriptions/numbers and boneyard — ids excluded), plus targeted generate()
// output checks. Replaces the Phase 0 characterization baseline.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { FountainParser } from '../../assets/js-mod/FountainParser.js';

const FIXTURES = [
    'boneyard.fountain',
    'centered.fountain',
    'character-numeric.fountain',
    'dialogue-two-spaces.fountain',
    'dual-dialogue.fountain',
    'forces.fountain',
    'notes-emphasis.fountain',
    'page-break-lyrics.fountain',
    'scene-headings.fountain',
    'scene-numbers.fountain',
    'sections-synopses.fountain',
    'simple.fountain',
    'title-page-multiline.fountain',
];

function readFixture(name) {
    return fs.readFileSync(new URL(`../fixtures/fountain/${name}`, import.meta.url), 'utf8');
}

/** Id-independent view of a parse result: block indices replace block ids. */
function canonical(result) {
    const idToIndex = new Map(result.blocks.map((b, i) => [b.id, i]));
    return {
        blocks: result.blocks.map(b => ({
            type: b.type,
            text: b.text,
            centered: !!b.centered,
            tight: !!b.tight,
            pageBreak: !!b.pageBreak,
        })),
        meta: result.meta,
        sceneMeta: result.blocks.map(b => result.sceneMeta[b.id]
            ? {
                number: result.sceneMeta[b.id].number || null,
                description: result.sceneMeta[b.id].description || null,
                sections: result.sceneMeta[b.id].sections || null,
            }
            : null),
        boneyard: (result.boneyard || []).map(e => ({
            anchorIndex: e.anchorId === null ? null : idToIndex.get(e.anchorId),
            text: e.text,
        })),
    };
}

for (const name of FIXTURES) {
    test(`round-trip ${name} — parse -> generate -> parse is a fixed point`, () => {
        const parser = new FountainParser();
        const first = parser.parse(readFixture(name));
        const generated = parser.generate(first);
        const second = parser.parse(generated);
        assert.deepEqual(canonical(second), canonical(first));
    });
}

test('generate() has no leading blank-line artifact when meta is empty', () => {
    const parser = new FountainParser();
    const generated = parser.generate(parser.parse(readFixture('simple.fountain')));
    assert.ok(generated.startsWith('INT. KITCHEN - DAY'));
});

test('generate() re-attaches scene numbers to the slug line', () => {
    const parser = new FountainParser();
    const generated = parser.generate(parser.parse(readFixture('scene-numbers.fountain')));
    assert.ok(generated.includes('EXT. HOUSE - DAY #1A#'));
});

test('generate() emits multi-line title-page values as indented continuations (#17 fixed)', () => {
    const parser = new FountainParser();
    const generated = parser.generate({
        meta: {
            title: 'The Big One',
            author: 'Jane Doe',
            contact: 'Jane Doe\n555-1234\njane@example.com',
        },
        blocks: [
            { type: 'sc-slug', text: 'INT. ROOM - DAY', id: 'line-x1' },
            { type: 'sc-action', text: 'She opens the letter.', id: 'line-x2' },
        ],
        sceneMeta: {},
    });

    assert.equal(
        generated,
        'Title: The Big One\n' +
        'Author: Jane Doe\n' +
        'Contact:\n' +
        '   Jane Doe\n' +
        '   555-1234\n' +
        '   jane@example.com\n' +
        '\n' +
        'INT. ROOM - DAY\n' +
        '\n' +
        'She opens the letter.'
    );

    // The output is valid Fountain: re-parsing recovers the full contact value
    // and nothing leaks into the body.
    const reparsed = parser.parse(generated);
    assert.deepEqual(reparsed.meta, {
        title: 'The Big One',
        author: 'Jane Doe',
        contact: 'Jane Doe\n555-1234\njane@example.com',
    });
    assert.deepEqual(reparsed.blocks.map(b => [b.type, b.text]), [
        ['sc-slug', 'INT. ROOM - DAY'],
        ['sc-action', 'She opens the letter.'],
    ]);
});

test('generate() emits sections above their slug and synopses below it', () => {
    const parser = new FountainParser();
    const generated = parser.generate(parser.parse(readFixture('sections-synopses.fountain')));
    assert.ok(generated.startsWith(
        '# Act 1\n' +
        '\n' +
        '## Sequence 2\n' +
        '\n' +
        'INT. LAB - NIGHT\n' +
        '= Synopsis before any scene.\n' +
        '= The monster awakens.'
    ));
});

test('generate() emits === for page breaks and keeps lyric lines contiguous', () => {
    const parser = new FountainParser();
    const generated = parser.generate(parser.parse(readFixture('page-break-lyrics.fountain')));
    assert.ok(generated.includes('~These are the lyrics\n~Of a happy song\n\n===\n\nThe next morning.'));
});

test('generate() re-emits multi-line boneyard after its anchor block', () => {
    const parser = new FountainParser();
    const generated = parser.generate(parser.parse(readFixture('boneyard.fountain')));
    assert.ok(generated.includes(
        'He nods. /* cut this */ She waves.\n' +
        '\n' +
        '/*\n' +
        'Cut scene here.\n' +
        '*/'
    ));
});

test('generate() appends boneyard whose anchor block no longer exists', () => {
    const parser = new FountainParser();
    const generated = parser.generate({
        meta: {},
        blocks: [{ type: 'sc-action', text: 'Only line.', id: 'line-a' }],
        sceneMeta: {},
        boneyard: [{ anchorId: 'line-gone', text: ' lost scene ' }],
    });
    assert.equal(generated, 'Only line.\n\n/* lost scene */');
});

test('generate() forces "@" for character names that are not all-caps', () => {
    const parser = new FountainParser();
    const generated = parser.generate({
        meta: {},
        blocks: [
            { type: 'sc-character', text: 'McClane', id: 'line-c' },
            { type: 'sc-dialogue', text: 'Ho ho ho.', id: 'line-d' },
        ],
        sceneMeta: {},
    });
    assert.equal(generated, '@McClane\nHo ho ho.');
});

test('generate() suppresses the blank line before tight actions', () => {
    const parser = new FountainParser();
    const first = parser.parse('He looks.\nHe leaps.');
    assert.equal(first.blocks[1].tight, true);
    assert.equal(parser.generate(first), 'He looks.\nHe leaps.');
});

test('generate() keeps two-space dialogue continuation lines', () => {
    const parser = new FountainParser();
    const generated = parser.generate(parser.parse(readFixture('dialogue-two-spaces.fountain')));
    assert.equal(generated, 'INT. CASINO - NIGHT\n\nDEALER\nTen.\n  \nFour.');
});
