import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSlug, slugPartText, parseCharacterCue, cueNameText } from '../../assets/js-mod/ScriptParts.js';

const parts = (text) => ({
    prefix: slugPartText(text, 'prefix'),
    location: slugPartText(text, 'location'),
    time: slugPartText(text, 'time')
});

test('parseSlug splits a standard heading into prefix, location and time', () => {
    assert.deepEqual(parts('INT. KITCHEN - DAY'), { prefix: 'INT.', location: 'KITCHEN', time: 'DAY' });
    assert.deepEqual(parts('EXT. PARK - NIGHT'), { prefix: 'EXT.', location: 'PARK', time: 'NIGHT' });
});

test('parseSlug returns ranges into the original text', () => {
    const text = 'INT. KITCHEN - DAY';
    const p = parseSlug(text);
    assert.deepEqual(p.prefix, { start: 0, end: 4 });
    assert.deepEqual(p.location, { start: 5, end: 12 });
    assert.deepEqual(p.timeSep, { start: 12, end: 15 });
    assert.deepEqual(p.time, { start: 15, end: 18 });
    assert.equal(text.slice(p.location.start, p.location.end), 'KITCHEN');
});

test('parseSlug knows every prefix form', () => {
    assert.equal(parts('INT./EXT. CAR - DAY').prefix, 'INT./EXT.');
    assert.equal(parts('INT/EXT SHED - DAY').prefix, 'INT/EXT');
    assert.equal(parts('INT/EXT SHED - DAY').location, 'SHED');
    assert.equal(parts('EXT./INT. CAR - DAY').prefix, 'EXT./INT.');
    assert.equal(parts('I/E CAR - DAY').prefix, 'I/E');
    assert.equal(parts('I/E. CAR - DAY').prefix, 'I/E.');
    assert.equal(parts('EST. CITY SKYLINE - DAWN').prefix, 'EST.');
    assert.equal(parts('INT KITCHEN - DAY').prefix, 'INT');
    assert.equal(parts('int. kitchen - day').prefix, 'int.');
    assert.equal(parts('INT.KITCHEN - DAY').location, 'KITCHEN');
});

test('parseSlug does not mistake ordinary words for a prefix', () => {
    assert.deepEqual(parts('INTERCUT - PHONE CALL'), { prefix: '', location: 'INTERCUT', time: 'PHONE CALL' });
    assert.equal(parts('ESTABLISHING SHOT').prefix, '');
    assert.equal(parts('EXTERIOR WALL - DAY').prefix, '');
    assert.equal(parts('INTERIOR - DAY').prefix, '');
});

test('parseSlug accepts en and em dashes before the time', () => {
    assert.deepEqual(parts('INT. KITCHEN – NIGHT'), { prefix: 'INT.', location: 'KITCHEN', time: 'NIGHT' });
    assert.deepEqual(parts('INT. KITCHEN — NIGHT'), { prefix: 'INT.', location: 'KITCHEN', time: 'NIGHT' });
});

test('parseSlug handles a missing time, missing prefix, or just a prefix', () => {
    assert.deepEqual(parts('INT. KITCHEN'), { prefix: 'INT.', location: 'KITCHEN', time: '' });
    assert.equal(parseSlug('INT. KITCHEN').time, null);
    assert.deepEqual(parts('KITCHEN - LATER'), { prefix: '', location: 'KITCHEN', time: 'LATER' });
    assert.deepEqual(parts('LATER'), { prefix: '', location: 'LATER', time: '' });
    assert.deepEqual(parts('INT.'), { prefix: 'INT.', location: '', time: '' });
    assert.deepEqual(parts(''), { prefix: '', location: '', time: '' });
});

test('parseSlug keeps hyphenated words inside the location', () => {
    assert.deepEqual(parts('INT. 7-ELEVEN - NIGHT'), { prefix: 'INT.', location: '7-ELEVEN', time: 'NIGHT' });
    assert.deepEqual(parts("INT. JEAN-LUC'S FLAT"), { prefix: 'INT.', location: "JEAN-LUC'S FLAT", time: '' });
});

// The time rule is "the last dash-separated segment", the same rule the
// Treatment view uses. These are its known rough edges, pinned on purpose:
// the value picker shows them to the writer instead of hiding them.
test('parseSlug time rule: the last segment is the time (pinned behaviour)', () => {
    assert.deepEqual(parts('INT. HOUSE - KITCHEN - NIGHT'), { prefix: 'INT.', location: 'HOUSE - KITCHEN', time: 'NIGHT' });
    assert.deepEqual(parts('INT. HOUSE - KITCHEN'), { prefix: 'INT.', location: 'HOUSE', time: 'KITCHEN' });
    assert.deepEqual(parts('INT. BAR - NIGHT - LATER'), { prefix: 'INT.', location: 'BAR - NIGHT', time: 'LATER' });
    assert.equal(parts('INT. BAR - NIGHT (FLASHBACK)').time, 'NIGHT (FLASHBACK)');
});

test('parseSlug tolerates surrounding whitespace', () => {
    const text = '  INT.  KITCHEN  -  DAY  ';
    assert.deepEqual(parts(text), { prefix: 'INT.', location: 'KITCHEN', time: 'DAY' });
});

test('parseCharacterCue separates the name from its extensions', () => {
    const cue = (t) => {
        const c = parseCharacterCue(t);
        return { name: cueNameText(t), ext: c.extensions.map(e => t.slice(e.start, e.end)) };
    };
    assert.deepEqual(cue('ANNA'), { name: 'ANNA', ext: [] });
    assert.deepEqual(cue('ANNA (V.O.)'), { name: 'ANNA', ext: ['(V.O.)'] });
    assert.deepEqual(cue("ANNA (O.S.) (CONT'D)"), { name: 'ANNA', ext: ['(O.S.)', "(CONT'D)"] });
    assert.deepEqual(cue('DR. SMITH (INTO PHONE)'), { name: 'DR. SMITH', ext: ['(INTO PHONE)'] });
    assert.deepEqual(cue('  ANNA  (V.O.) '), { name: 'ANNA', ext: ['(V.O.)'] });
});

test('parseCharacterCue name range points into the original text', () => {
    const text = '  ANNA MARIA (V.O.)';
    const c = parseCharacterCue(text);
    assert.deepEqual(c.name, { start: 2, end: 12 });
});

test('parseCharacterCue tolerates an unclosed bracket and odd shapes', () => {
    assert.equal(cueNameText('ANNA (V.O'), 'ANNA');
    assert.equal(cueNameText('(O.S.) ANNA'), 'ANNA');
    assert.equal(cueNameText('(V.O.)'), '');
    assert.equal(parseCharacterCue('(V.O.)').name, null);
    assert.equal(cueNameText(''), '');
});

test('cueNameText keeps the typed case (forced mixed-case cues)', () => {
    assert.equal(cueNameText('McClane (V.O.)'), 'McClane');
});
