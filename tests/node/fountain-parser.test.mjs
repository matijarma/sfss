// Phase 0 characterization tests for FountainParser.parse().
//
// IMPORTANT: These tests pin down the parser's CURRENT actual behavior,
// bugs included. They are the baseline diff for the Phase 6 parser rewrite.
// Lines marked "CURRENT (buggy) behavior" assert output that contradicts
// devAndInfoMds/syntaxSpecification.md on purpose — do NOT "fix" the
// expectations without also fixing the parser.

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

/** [type, text] pairs, ignoring the random ids. */
function seq(blocks) {
    return blocks.map(b => [b.type, b.text]);
}

test('forces.fountain — forced heading/action/character/transition', () => {
    const { blocks, meta, sceneMeta } = parseFixture('forces.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'SNIPER SCOPE POV'],           // "." stripped, uppercased
        [ACTION, 'LOUD NOISES startle him.'], // "!" stripped, case preserved
        // CURRENT (buggy) behavior — will change in Phase 6: forced characters
        // are uppercased, destroying mixed-case names ("@McClane" should stay "McClane").
        [CHARACTER, 'MCCLANE'],
        [DIALOGUE, 'Yippee ki-yay.'],
        // CURRENT (buggy) behavior — will change in Phase 6: forced transition text is
        // substring(1) without trim, so the space after ">" is kept: " BURN TO PINK".
        [TRANSITION, ' BURN TO PINK'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('scene-headings.fountain — INT/EXT/EST/I-E variants and the INT./EXT. hole', () => {
    const { blocks, meta, sceneMeta } = parseFixture('scene-headings.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. HOUSE - DAY'],
        [ACTION, 'Some action here.'],
        [SLUG, 'EXT. FIELD - NIGHT'],
        [SLUG, 'EST. CITY SKYLINE - DUSK'],
        [SLUG, 'I/E CAR - CONTINUOUS'],
        [SLUG, 'INT. BASEMENT - NIGHT'], // lowercase "int." matched (/i) and uppercased
        [SLUG, 'INT/EXT SHED - DAY'],
        // CURRENT (buggy) behavior — will change in Phase 6: the sceneHeading regex
        // /^(?:INT\.|EXT\.|EST\.|INT\/EXT|I\/E)(\s|\.|\$)/i has no "INT./EXT." alternative,
        // so "INT./EXT. HOUSE - DAY" is not a slug. Being all-caps and followed by text,
        // it is misread as a CHARACTER and the following action line becomes DIALOGUE.
        [CHARACTER, 'INT./EXT. HOUSE - DAY'],
        [DIALOGUE, 'The slash-dot variant confuses the parser.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
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

test('sections-synopses.fountain — sections fall through to action, synopses go to sceneMeta', () => {
    const { blocks, meta, sceneMeta } = parseFixture('sections-synopses.fountain');
    assert.deepEqual(seq(blocks), [
        // CURRENT (buggy) behavior — will change in Phase 6: "# Section" lines are not
        // recognized (regex.section is defined but never used); they fall through to ACTION
        // blocks with the hashes kept, so they will print inside the script.
        [ACTION, '# Act 1'],
        [ACTION, '## Sequence 2'],
        [SLUG, 'INT. LAB - NIGHT'],
        [ACTION, 'Action line.'],
        [SLUG, 'EXT. ROOF - DAY'],
    ]);
    assert.deepEqual(meta, {});

    // Synopses attach to the last seen scene heading via sceneMeta[<slug id>].description.
    const slug1 = blocks[2];
    const slug2 = blocks[4];
    assert.deepEqual(sceneMeta[slug1.id], { description: 'The monster awakens.' });
    assert.deepEqual(sceneMeta[slug2.id], { description: 'Second scene synopsis.' });
    // CURRENT (buggy) behavior — will change in Phase 6: a synopsis appearing before any
    // scene heading (lastSceneId === null) is silently DROPPED — no block, no meta.
    assert.equal(Object.keys(sceneMeta).length, 2);
    assert.ok(!blocks.some(b => b.text.includes('Synopsis before any scene')));
});

test('boneyard.fountain — /* */ comments are not stripped', () => {
    const { blocks, meta, sceneMeta } = parseFixture('boneyard.fountain');
    assert.deepEqual(seq(blocks), [
        [ACTION, 'Action before.'],
        // CURRENT (buggy) behavior — will change in Phase 6: inline boneyard is kept
        // verbatim inside the action text instead of being removed.
        [ACTION, 'He nods. /* cut this */ She waves.'],
        // CURRENT (buggy) behavior — will change in Phase 6: a multi-line boneyard block is
        // not recognized at all (regex.boneyard is defined but never used). "/*" and "*/"
        // are all-caps-equal lines followed by text, so each is misread as a CHARACTER and
        // the lines after them become DIALOGUE — including real script content ("Action after.").
        [CHARACTER, '/*'],
        [DIALOGUE, 'Cut scene here.'],
        [CHARACTER, '*/'],
        [DIALOGUE, 'Action after.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('notes-emphasis.fountain — notes, emphasis and escapes pass through verbatim', () => {
    const { blocks, meta, sceneMeta } = parseFixture('notes-emphasis.fountain');
    // CURRENT behavior (documented): [[notes]], **bold**, *italic*, _underline_,
    // ***bold italic*** and escaped \* sequences are NOT interpreted or stripped by the
    // parser — the markup characters stay in the plain block text. Phase 6 must decide
    // note extraction / emphasis handling; today it is pure pass-through.
    assert.deepEqual(seq(blocks), [
        [ACTION, 'He waits. [[check the timing]]'],
        [ACTION, 'She uses **bold** and *italic* and _underline_ moves.'],
        [ACTION, 'He shouts ***bold italic*** words.'],
        [ACTION, 'A literal \\*asterisk\\* appears.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('dual-dialogue.fountain — caret is stripped, dual link is lost', () => {
    const { blocks, meta, sceneMeta } = parseFixture('dual-dialogue.fountain');
    assert.deepEqual(seq(blocks), [
        [CHARACTER, 'SIMON'],
        [DIALOGUE, 'Go left!'],
        // CURRENT (buggy) behavior — will change in Phase 6: "ALVIN ^" has the caret
        // stripped but NO dual-dialogue flag/link is recorded, so the simultaneous-speech
        // pairing is silently lost.
        [CHARACTER, 'ALVIN'],
        [DIALOGUE, 'Go right!'],
    ]);
    assert.ok(blocks.every(b => !('dual' in b) && !('dualDialogue' in b)));
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('title-page-multiline.fountain — single-line keys parse, multi-line values leak into body', () => {
    const { blocks, meta, sceneMeta } = parseFixture('title-page-multiline.fountain');
    // Keys are lowercased; only same-line "Key: Value" pairs are captured.
    assert.deepEqual(meta, {
        title: 'The Big One',
        credit: 'Written by',
        author: 'Jane Doe',
    });
    assert.deepEqual(seq(blocks), [
        // CURRENT (buggy) behavior — will change in Phase 6: a bare "Contact:" key with the
        // value on following indented lines (valid Fountain multi-line value) ends title-page
        // parsing; "Contact:" itself becomes an ACTION block and the indented value lines leak
        // into the body — "555-1234" is all-caps-equal (digits) followed by text, so it is
        // misread as a CHARACTER and "jane@example.com" becomes its DIALOGUE.
        [ACTION, 'Contact:'],
        [CHARACTER, '555-1234'],
        [DIALOGUE, 'jane@example.com'],
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

test('page-break-lyrics.fountain — "===" swallowed as synopsis, "~" lyrics fall through', () => {
    const { blocks, meta, sceneMeta } = parseFixture('page-break-lyrics.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. STAGE - NIGHT'],
        [ACTION, 'The band plays.'],
        // CURRENT (buggy) behavior — will change in Phase 6: "~" lyric lines are not
        // recognized (regex.lyrics is defined but never used); they fall through to ACTION
        // with the tilde kept in the text.
        [ACTION, '~These are the lyrics'],
        [ACTION, '~Of a happy song'],
        [ACTION, 'The next morning.'],
    ]);
    // CURRENT (buggy) behavior — will change in Phase 6: "===" (page break) matches the
    // synopsis regex /^=(?: *)(.*)/ first, so it produces NO block and instead appends the
    // leftover "==" to the current scene's description in sceneMeta.
    assert.deepEqual(sceneMeta[blocks[0].id], { description: '==' });
    assert.equal(Object.keys(sceneMeta).length, 1);
    assert.deepEqual(meta, {});
});

test('dialogue-two-spaces.fountain — two-space line breaks the dialogue block', () => {
    const { blocks, meta, sceneMeta } = parseFixture('dialogue-two-spaces.fountain');
    assert.deepEqual(seq(blocks), [
        [SLUG, 'INT. CASINO - NIGHT'],
        [CHARACTER, 'DEALER'],
        [DIALOGUE, 'Ten.'],
        // CURRENT (buggy) behavior — will change in Phase 6: per spec, a line containing
        // exactly two spaces keeps the dialogue block alive ("Four." should be DIALOGUE).
        // The parser trims every line, treats "  " as blank and skips it, and since the
        // previous block is DIALOGUE (not CHARACTER/PARENTHETICAL) "Four." defaults to ACTION.
        [ACTION, 'Four.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('character-numeric.fountain — R2D2 accepted, but so is bare "23"', () => {
    const { blocks, meta, sceneMeta } = parseFixture('character-numeric.fountain');
    assert.deepEqual(seq(blocks), [
        [CHARACTER, 'R2D2'], // correct: names may contain digits
        [DIALOGUE, 'Beep boop bee-doo.'],
        // CURRENT (buggy) behavior — will change in Phase 6: per spec a character name must
        // contain at least one letter; "23" === "23".toUpperCase() so a bare number followed
        // by text is misread as a CHARACTER, and the following action line becomes DIALOGUE.
        [CHARACTER, '23'],
        [DIALOGUE, 'People stand in line.'],
    ]);
    assert.deepEqual(meta, {});
    assert.deepEqual(sceneMeta, {});
});

test('simple.fountain — happy-path two-scene script', () => {
    const { blocks, meta, sceneMeta } = parseFixture('simple.fountain');
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
    // Every block gets a generated "line-*" id.
    for (const b of blocks) assert.match(b.id, /^line-[a-z0-9]{9}$/);
});
