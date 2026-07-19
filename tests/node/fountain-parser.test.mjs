// Phase 6 spec-compliance tests for FountainParser.parse().
//
// These replace the Phase 0 characterization baseline: every expectation that
// was marked "CURRENT (buggy) behavior" has been flipped to the behavior
// devAndInfoMds/syntaxSpecification.md (sections 2.1-2.9) requires. parse()
// now also returns an additive `boneyard` array (multi-line /* */ spans).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { FountainParser } from '../../assets/js-mod/FountainParser.js';
import { ELEMENT_TYPES } from '../../assets/js-mod/Constants.js';

const { SLUG, ACTION, CHARACTER, DIALOGUE, PARENTHETICAL, TRANSITION } = ELEMENT_TYPES;

function parseFixture(name) {
    const text = fs.readFileSync(new URL(`../fixtures/fountain/${name}`, import.meta.url), 'utf8');
    return new FountainParser().parse(text);
}

function parseText(text) {
    return new FountainParser().parse(text);
}

/** [type, text] pairs, ignoring the random ids. */
function seq(blocks) {
    return blocks.map(b => [b.type, b.text]);
}

test('forces.fountain — forced heading/action/character/transition', () => {
    const { blocks, meta, sceneMeta, boneyard } = parseFixture('forces.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'SNIPER SCOPE POV'],           // "." stripped, uppercased
        [ACTION, 'LOUD NOISES startle him.'], // "!" stripped, case preserved
        [CHARACTER, 'McClane'],               // FIXED: "@" keeps the typed case
        [DIALOGUE, 'Yippee ki-yay.'],
        [TRANSITION, 'BURN TO PINK'],         // FIXED: "> " force is trimmed
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
    assert.deepEqual(boneyard, []);
});

test('scene-headings.fountain — INT/EXT/EST/I-E variants including INT./EXT.', () => {
    const { blocks, meta, sceneMeta } = parseFixture('scene-headings.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. HOUSE - DAY'],
        [ACTION, 'Some action here.'],
        [SLUG, 'EXT. FIELD - NIGHT'],
        [SLUG, 'EST. CITY SKYLINE - DUSK'],
        [SLUG, 'I/E CAR - CONTINUOUS'],
        [SLUG, 'INT. BASEMENT - NIGHT'], // lowercase "int." matched (/i) and uppercased
        [SLUG, 'INT/EXT SHED - DAY'],
        [SLUG, 'INT./EXT. HOUSE - DAY'], // FIXED: the slash-dot variant is a slug now (#13)
        [ACTION, 'The slash-dot variant confuses the parser.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('scene heading requires a preceding blank line (spec 2.2.1)', () => {
    const { blocks } = parseText('Some action.\nINT. HOUSE - DAY');
    assert.deepEqual(seq(blocks), [
        [ACTION, 'Some action.'],
        [ACTION, 'INT. HOUSE - DAY'], // no blank line before it -> not a slug
    ]);
    assert.equal(blocks[1].tight, true); // same visual paragraph as the line above
});

test('centered.fountain — "> TEXT <" becomes a centered action block', () => {
    const { blocks, meta, sceneMeta } = parseFixture('centered.fountain');
    assert.deepEqual(seq(blocks), [
        [ACTION, 'The room empties.'],
        [ACTION, 'THE END'], // wrappers stripped and trimmed
        [ACTION, 'Roll credits.'],
    ]);
    assert.equal(blocks[0].centered, undefined);
    assert.equal(blocks[1].centered, true); // centered flag only on the "> ... <" block
    assert.equal(blocks[2].centered, undefined);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('sections-synopses.fountain — sections into sceneMeta, pre-slug synopsis attached', () => {
    const { blocks, meta, sceneMeta } = parseFixture('sections-synopses.fountain');
    // FIXED: "# Section" lines are no longer printed ACTION blocks; they are
    // buffered and attached to the NEXT slug's sceneMeta entry (#9).
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. LAB - NIGHT'],
        [ACTION, 'Action line.'],
        [SLUG, 'EXT. ROOF - DAY'],
    ]);
    assert.deepEqual(meta, {});

    const slug1 = blocks[0];
    const slug2 = blocks[2];
    assert.deepEqual(sceneMeta[slug1.id], {
        sections: [
            { depth: 1, text: 'Act 1' },
            { depth: 2, text: 'Sequence 2' },
        ],
        // FIXED: a synopsis before any scene heading is no longer dropped —
        // it is buffered and attached to the first slug.
        description: 'Synopsis before any scene.\nThe monster awakens.',
    });
    assert.deepEqual(sceneMeta[slug2.id], { description: 'Second scene synopsis.' });
    assert.equal(Object.keys(sceneMeta).length, 2);
});

test('boneyard.fountain — multi-line /* */ extracted to boneyard[], inline kept', () => {
    const { blocks, meta, sceneMeta, boneyard } = parseFixture('boneyard.fountain');
    assert.deepEqual(seq(blocks), [
        [ACTION, 'Action before.'],
        // Inline (single-line) boneyard stays verbatim in the text — it
        // round-trips literally and InlineMarkup owns the rendering decision.
        [ACTION, 'He nods. /* cut this */ She waves.'],
        // FIXED: the multi-line boneyard no longer leaks "/*" and "*/" blocks
        // (previously misread as CHARACTERs); "Action after." is ACTION again.
        [ACTION, 'Action after.'],
    ]);
    assert.deepEqual(boneyard, [
        { anchorId: blocks[1].id, text: '\nCut scene here.\n' },
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('boneyard at file start anchors to null', () => {
    const { blocks, boneyard } = parseText('/*\nhidden\n*/\nAction line.');
    assert.deepEqual(seq(blocks), [[ACTION, 'Action line.']]);
    assert.deepEqual(boneyard, [{ anchorId: null, text: '\nhidden\n' }]);
});

test('notes-emphasis.fountain — notes, emphasis and escapes pass through verbatim', () => {
    const { blocks, meta, sceneMeta } = parseFixture('notes-emphasis.fountain');
    // [[notes]], **bold**, *italic*, _underline_, ***bold italic*** and \*
    // escapes are NOT interpreted by the parser — the markers stay literally
    // in block text (InlineMarkup owns tokenizing/rendering them).
    assert.deepEqual(seq(blocks), [
        [ACTION, 'He waits. [[check the timing]]'],
        [ACTION, 'She uses **bold** and *italic* and _underline_ moves.'],
        [ACTION, 'He shouts ***bold italic*** words.'],
        [ACTION, 'A literal \\*asterisk\\* appears.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('dual-dialogue.fountain — caret stripped, sequential plain characters', () => {
    const { blocks, meta, sceneMeta } = parseFixture('dual-dialogue.fountain');
    // Documented limitation: dual dialogue passes through uncorrupted but the
    // simultaneous-speech pairing is not modeled — no dual flag/link.
    assert.deepEqual(seq(blocks), [
        [CHARACTER, 'SIMON'],
        [DIALOGUE, 'Go left!'],
        [CHARACTER, 'ALVIN'],
        [DIALOGUE, 'Go right!'],
    ]);
    assert.ok(blocks.every(b => !('dual' in b) && !('dualDialogue' in b)));
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('title-page-multiline.fountain — indented continuation lines join the key value (#17)', () => {
    const { blocks, meta, sceneMeta } = parseFixture('title-page-multiline.fountain');
    // FIXED: a bare "Contact:" key with indented value lines is a valid
    // multi-line title-page value; nothing leaks into the body anymore.
    assert.deepEqual(meta, {
        title: 'The Big One',
        credit: 'Written by',
        author: 'Jane Doe',
        contact: '555-1234\njane@example.com',
    });
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. ROOM - DAY'],
        [ACTION, 'She opens the letter.'],
    ]);
    assert.deepEqual(sceneMeta, {});
});

test('scene-numbers.fountain — #1A# extracted into sceneMeta and stripped from slug text', () => {
    const { blocks, meta, sceneMeta } = parseFixture('scene-numbers.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'EXT. HOUSE - DAY'],
        [ACTION, 'They arrive.'],
    ]);
    assert.deepEqual(sceneMeta[blocks[0].id], { number: '1A' });
    assert.equal(Object.keys(sceneMeta).length, 1);
    assert.deepEqual(meta, {});
});

test('page-break-lyrics.fountain — "===" is a page break, "~" lyrics typed by context', () => {
    const { blocks, meta, sceneMeta } = parseFixture('page-break-lyrics.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. STAGE - NIGHT'],
        [ACTION, 'The band plays.'],
        // FIXED: "~" lyric lines keep the tilde and are typed by context —
        // ACTION here because the previous block is not dialogue-side (#9).
        [ACTION, '~These are the lyrics'],
        [ACTION, '~Of a happy song'],
        // FIXED: "===" no longer swallowed by the synopsis rule — it emits a
        // dedicated page-break block (empty ACTION with pageBreak: true) (#9).
        [ACTION, ''],
        [ACTION, 'The next morning.'],
    ]);
    assert.equal(blocks[3].tight, true);     // contiguous lyric lines stay one paragraph
    assert.equal(blocks[4].pageBreak, true);
    assert.equal(blocks[5].pageBreak, undefined);
    assert.deepEqual(sceneMeta, {});         // no bogus "==" description anymore
    assert.deepEqual(meta, {});
});

test('lyrics after a character/dialogue are typed DIALOGUE', () => {
    const { blocks } = parseText('BOB\n~La la la');
    assert.deepEqual(seq(blocks), [
        [CHARACTER, 'BOB'],
        [DIALOGUE, '~La la la'],
    ]);
});

test('dialogue-two-spaces.fountain — two-space line keeps the speech together', () => {
    const { blocks, meta, sceneMeta } = parseFixture('dialogue-two-spaces.fountain');
    // FIXED: a line of two spaces inside a speech emits an empty DIALOGUE
    // continuation block instead of terminating the dialogue, so "Four." is
    // DIALOGUE (was ACTION) per spec 2.5.1.
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. CASINO - NIGHT'],
        [CHARACTER, 'DEALER'],
        [DIALOGUE, 'Ten.'],
        [DIALOGUE, ''],
        [DIALOGUE, 'Four.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('character-numeric.fountain — R2D2 accepted, bare "23" is Action (#14)', () => {
    const { blocks, meta, sceneMeta } = parseFixture('character-numeric.fountain');
    assert.deepEqual(seq(blocks), [
        [CHARACTER, 'R2D2'], // names may contain digits...
        [DIALOGUE, 'Beep boop bee-doo.'],
        // FIXED: ...but need at least one letter; a bare number is Action and
        // the line after it stays Action too (same paragraph -> tight).
        [ACTION, '23'],
        [ACTION, 'People stand in line.'],
    ]);
    assert.equal(blocks[3].tight, true);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('simple.fountain — happy-path two-scene script', () => {
    const { blocks, meta, sceneMeta, boneyard } = parseFixture('simple.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. KITCHEN - DAY'],
        [ACTION, 'JOHN stands at the counter, pouring coffee.'],
        [CHARACTER, 'JOHN'],
        [PARENTHETICAL, '(muttering)'],
        [DIALOGUE, 'Not again.'],
        [ACTION, 'He sets the cup down.'],
        [TRANSITION, 'CUT TO:'],
        [SLUG, 'EXT. BACKYARD - DAY'],
        [ACTION, 'MARY digs a small hole near the fence.'],
        [CHARACTER, 'MARY'],
        [DIALOGUE, 'Found it.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
    assert.deepEqual(boneyard, []);
    // No stray flags on a plain script.
    assert.ok(blocks.every(b => !b.tight && !b.pageBreak && !b.centered));
    // Every block gets a generated "line-*" id.
    for (const b of blocks) assert.match(b.id, /^line-[a-z0-9]{9}$/);
});
