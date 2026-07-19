// Phase 0 characterization tests for FountainParser parse -> generate -> parse
// round-trips, plus generate() title-page output. Baseline for Phase 6.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { FountainParser } from '../../assets/js-mod/FountainParser.js';

function readFixture(name) {
    return fs.readFileSync(new URL(`../fixtures/fountain/${name}`, import.meta.url), 'utf8');
}

/** [type, text] pairs, ignoring the random ids. */
function seq(blocks) {
    return blocks.map(b => [b.type, b.text]);
}

test('round-trip simple.fountain — parse -> generate -> parse is stable', () => {
    const parser = new FountainParser();
    const first = parser.parse(readFixture('simple.fountain'));
    const generated = parser.generate(first);
    const second = parser.parse(generated);

    assert.deepEqual(seq(second.blocks), seq(first.blocks));
    assert.deepEqual(second.meta, first.meta);       // both {}
    assert.deepEqual(second.sceneMeta, {});          // no numbers/synopses involved

    // CURRENT behavior (cosmetic quirk): generate() unconditionally pushes a '\n'
    // separator even when meta is empty, so output starts with two blank lines.
    assert.ok(generated.startsWith('\n\n'));
});

test('round-trip scene-numbers.fountain — #1A# survives via sceneMeta', () => {
    const parser = new FountainParser();
    const first = parser.parse(readFixture('scene-numbers.fountain'));
    const generated = parser.generate(first);

    // The number is re-attached to the slug line on generate...
    assert.ok(generated.includes('EXT. HOUSE - DAY #1A#'));

    // ...and re-extracted into sceneMeta on the second parse.
    const second = parser.parse(generated);
    assert.deepEqual(seq(second.blocks), seq(first.blocks));
    assert.deepEqual(second.sceneMeta[second.blocks[0].id], { number: '1A' });
});

test('generate() with multi-line contact — known bug #17, output is not round-trippable', () => {
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

    // CURRENT (buggy) behavior — will change in Phase 6 (bug #17): the multi-line contact
    // value is emitted flush-left under a bare "Contact:" key. Valid Fountain requires
    // multi-line title-page values to be indented (3+ spaces or a tab); this output is not.
    assert.equal(
        generated,
        'Title: The Big One\n' +
        'Author: Jane Doe\n' +
        'Contact:\n' +
        'Jane Doe\n' +
        '555-1234\n' +
        'jane@example.com\n' +
        '\n' +          // generate() pushes a '\n' element, so joining yields a double break
        '\n' +
        'INT. ROOM - DAY\n' +
        '\n' +
        'She opens the letter.'
    );

    // CURRENT (buggy) behavior — will change in Phase 6: re-parsing this output loses the
    // contact entirely and leaks the value lines into the body ("555-1234" is even misread
    // as a CHARACTER with "jane@example.com" as its DIALOGUE).
    const reparsed = parser.parse(generated);
    assert.deepEqual(reparsed.meta, { title: 'The Big One', author: 'Jane Doe' }); // no contact
    assert.deepEqual(seq(reparsed.blocks), [
        ['sc-action', 'Contact:'],
        ['sc-action', 'Jane Doe'],
        ['sc-character', '555-1234'],
        ['sc-dialogue', 'jane@example.com'],
        ['sc-slug', 'INT. ROOM - DAY'],
        ['sc-action', 'She opens the letter.'],
    ]);
});
