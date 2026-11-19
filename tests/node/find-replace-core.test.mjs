import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    FIND_META_TYPE, searchLines, applyMatches, fieldValues, mirrorCase, matchKey, shiftKeys
} from '../../assets/js-mod/FindReplaceCore.js';

const SLUG = 'sc-slug', ACTION = 'sc-action', CHARACTER = 'sc-character',
    DIALOGUE = 'sc-dialogue', PAREN = 'sc-parenthetical', TRANSITION = 'sc-transition';
const ALL = [SLUG, ACTION, CHARACTER, DIALOGUE, PAREN, TRANSITION];

let seq = 0;
const L = (type, text) => ({ id: `l${++seq}`, type, text });
const textTarget = (types = ALL) => ({ kind: 'text', types });
const slugTarget = (part) => ({ kind: 'slug', part });
const charTarget = (mentionTypes = [ACTION, DIALOGUE, PAREN]) => ({ kind: 'character', mentionTypes });

const found = (lines, target, query, options) =>
    searchLines(lines, target, query, options).matches.map(m => `${lines[m.lineIndex].type.slice(3)}:${m.text}`);

// Search + replace everything ticked; returns the resulting texts in order.
const replaceAll = (lines, target, query, replacement, options = {}) => {
    const { matches } = searchLines(lines, target, query, options);
    const { texts } = applyMatches(lines, matches.filter(m => m.ticked), replacement, target, { ...options, query });
    return lines.map(l => texts.has(l.id) ? texts.get(l.id) : l.text);
};

// ---------- Text mode ----------

test('text mode finds a plain string in every ticked element type', () => {
    const lines = [L(SLUG, 'INT. DOOR SHOP - DAY'), L(ACTION, 'The door opens.'), L(DIALOGUE, 'Close the Door!')];
    assert.deepEqual(found(lines, textTarget(), 'door'), ['slug:DOOR', 'action:door', 'dialogue:Door']);
    assert.deepEqual(found(lines, textTarget([DIALOGUE]), 'door'), ['dialogue:Door']);
    assert.deepEqual(found(lines, textTarget([ACTION, DIALOGUE]), 'door', { matchCase: true }), ['action:door']);
});

test('text mode reports offsets and several matches per line', () => {
    const lines = [L(ACTION, 'tick tock tick')];
    const { matches } = searchLines(lines, textTarget(), 'tick');
    assert.deepEqual(matches.map(m => [m.start, m.end]), [[0, 4], [10, 14]]);
    assert.equal(matches[0].lineId, lines[0].id);
});

test('whole word is Unicode-aware', () => {
    const lines = [L(ACTION, 'Šime i Šimeon. ČEDO, ČEDOMIR. cat concat cat.')];
    assert.deepEqual(found(lines, textTarget(), 'Šime', { wholeWord: true }), ['action:Šime']);
    assert.deepEqual(found(lines, textTarget(), 'čedo', { wholeWord: true }), ['action:ČEDO']);
    assert.deepEqual(found(lines, textTarget(), 'cat', { wholeWord: true }), ['action:cat', 'action:cat']);
    assert.equal(found(lines, textTarget(), 'cat').length, 3);
});

test('regex metacharacters in the query are literal', () => {
    const lines = [L(DIALOGUE, 'What?! (really) a.b a+b [x]')];
    assert.deepEqual(found(lines, textTarget(), '?!'), ['dialogue:?!']);
    assert.deepEqual(found(lines, textTarget(), 'a.b'), ['dialogue:a.b']);
    assert.deepEqual(found(lines, textTarget(), '[x]'), ['dialogue:[x]']);
    assert.deepEqual(found(lines, textTarget(), '(really)'), ['dialogue:(really)']);
});

test('an empty or blank query finds nothing', () => {
    const lines = [L(ACTION, 'anything')];
    assert.deepEqual(found(lines, textTarget(), ''), []);
    assert.deepEqual(found(lines, textTarget(), '   '), []);
});

test('always-uppercase elements match regardless of case, even with match case on', () => {
    const lines = [L(SLUG, 'INT. KITCHEN - DAY'), L(TRANSITION, 'CUT TO:'), L(ACTION, 'the kitchen')];
    assert.deepEqual(found(lines, textTarget(), 'kitchen', { matchCase: true }), ['slug:KITCHEN', 'action:kitchen']);
    assert.deepEqual(found(lines, textTarget(), 'Cut To', { matchCase: true }), ['transition:CUT TO']);
});

test('text replace keeps always-uppercase elements uppercase', () => {
    const lines = [L(SLUG, 'INT. KITCHEN - DAY'), L(ACTION, 'The kitchen is dark.')];
    assert.deepEqual(replaceAll(lines, textTarget(), 'kitchen', 'attic'), ['INT. ATTIC - DAY', 'The attic is dark.']);
});

test('several matches in one line are all replaced, lengths changing', () => {
    const lines = [L(ACTION, 'a cat, a cat and a cat')];
    assert.deepEqual(replaceAll(lines, textTarget(), 'cat', 'giraffe'), ['a giraffe, a giraffe and a giraffe']);
    assert.deepEqual(replaceAll(lines, textTarget(), 'a cat', ''), [',  and ']);
});

test('keep case mirrors each match', () => {
    const lines = [L(ACTION, 'ROBOT sees a robot. Robot waves.')];
    assert.deepEqual(replaceAll(lines, textTarget(), 'robot', 'android', { keepCase: true }),
        ['ANDROID sees a android. Android waves.']);
    assert.deepEqual(replaceAll(lines, textTarget(), 'robot', 'android'), ['android sees a android. android waves.']);
});

test('mirrorCase', () => {
    assert.equal(mirrorCase('ANNA', 'maria'), 'MARIA');
    assert.equal(mirrorCase('Anna', 'MARIA'), 'Maria');
    assert.equal(mirrorCase('anna', 'MARIA'), 'maria');
    assert.equal(mirrorCase('Dr. Smith', 'DR. JONES'), 'Dr. Jones');
    assert.equal(mirrorCase('Anna', 'McCoy'), 'McCoy');     // mixed replacement is kept as typed
    assert.equal(mirrorCase('aNNa', 'Maria'), 'Maria');     // mixed sample: as typed
    assert.equal(mirrorCase('123', 'Maria'), 'Maria');
    assert.equal(mirrorCase('ŠIME', 'čedo'), 'ČEDO');
});

test('a "(beat)" query finds parentheticals, whose brackets are not stored', () => {
    const lines = [L(PAREN, 'beat'), L(ACTION, 'A beat. (beat)'), L(PAREN, 'a long beat')];
    assert.deepEqual(found(lines, textTarget(), '(beat)'), ['parenthetical:beat', 'action:(beat)']);
    assert.deepEqual(replaceAll(lines, textTarget([PAREN]), '(beat)', '(pause)'), ['pause', 'A beat. (beat)', 'a long beat']);
});

test('scene notes are searched only when ticked', () => {
    const lines = [L(ACTION, 'Rain.'), { id: 'meta:s1:notes', type: FIND_META_TYPE, text: 'Needs rain machine' }];
    assert.equal(found(lines, textTarget(), 'rain').length, 1);
    assert.equal(found(lines, textTarget([...ALL, FIND_META_TYPE]), 'rain').length, 2);
});

// ---------- Scene heading parts ----------

const HEADINGS = () => [
    L(SLUG, 'INT. KITCHEN - DAY'),
    L(ACTION, 'The kitchen. Day breaks. INT. is not a heading here.'),
    L(SLUG, 'EXT. HOUSE - KITCHEN GARDEN - NIGHT'),
    L(SLUG, 'INT. KITCHEN - NIGHT'),
    L(SLUG, 'INT./EXT. CAR - DAY'),
    L(SLUG, 'INT. DAY CARE')
];

test('location mode searches only the location part of scene headings', () => {
    const lines = HEADINGS();
    assert.deepEqual(found(lines, slugTarget('location'), 'kitchen'), ['slug:KITCHEN', 'slug:KITCHEN']);
    assert.deepEqual(found(lines, slugTarget('location'), 'kitchen', { entireValue: false }),
        ['slug:KITCHEN', 'slug:KITCHEN', 'slug:KITCHEN']);
    assert.deepEqual(found(lines, slugTarget('location'), 'day'), []);
    assert.deepEqual(found(lines, slugTarget('location'), 'day', { entireValue: false }), ['slug:DAY']);
});

test('location replace renames the location everywhere and nothing else', () => {
    const lines = HEADINGS();
    assert.deepEqual(replaceAll(lines, slugTarget('location'), 'Kitchen', 'dining room'), [
        'INT. DINING ROOM - DAY',
        'The kitchen. Day breaks. INT. is not a heading here.',
        'EXT. HOUSE - KITCHEN GARDEN - NIGHT',
        'INT. DINING ROOM - NIGHT',
        'INT./EXT. CAR - DAY',
        'INT. DAY CARE'
    ]);
});

test('time mode touches only the time of day', () => {
    const lines = HEADINGS();
    assert.deepEqual(found(lines, slugTarget('time'), 'day'), ['slug:DAY', 'slug:DAY']);
    const out = replaceAll(lines, slugTarget('time'), 'night', 'dusk');
    assert.equal(out[2], 'EXT. HOUSE - KITCHEN GARDEN - DUSK');
    assert.equal(out[3], 'INT. KITCHEN - DUSK');
    assert.equal(out[5], 'INT. DAY CARE');
});

test('emptying the time also removes its separator', () => {
    const lines = HEADINGS();
    const out = replaceAll(lines, slugTarget('time'), 'DAY', '');
    assert.equal(out[0], 'INT. KITCHEN');
    assert.equal(out[4], 'INT./EXT. CAR');
});

test('prefix mode changes INT/EXT only; emptying it drops the gap', () => {
    const lines = HEADINGS();
    assert.deepEqual(found(lines, slugTarget('prefix'), 'INT.'), ['slug:INT.', 'slug:INT.', 'slug:INT.']);
    const out = replaceAll(lines, slugTarget('prefix'), 'INT.', 'ext.');
    assert.equal(out[0], 'EXT. KITCHEN - DAY');
    assert.equal(out[1], 'The kitchen. Day breaks. INT. is not a heading here.');
    assert.equal(out[4], 'INT./EXT. CAR - DAY');
    assert.equal(replaceAll(HEADINGS(), slugTarget('prefix'), 'EXT.', '')[2], 'HOUSE - KITCHEN GARDEN - NIGHT');
});

test('fieldValues lists distinct heading values with counts', () => {
    const lines = HEADINGS();
    assert.deepEqual(fieldValues(lines, slugTarget('location')), [
        { value: 'KITCHEN', count: 2 },
        { value: 'CAR', count: 1 },
        { value: 'DAY CARE', count: 1 },
        { value: 'HOUSE - KITCHEN GARDEN', count: 1 }
    ]);
    assert.deepEqual(fieldValues(lines, slugTarget('time')), [{ value: 'DAY', count: 2 }, { value: 'NIGHT', count: 2 }]);
    assert.deepEqual(fieldValues(lines, slugTarget('prefix')).map(v => v.value), ['INT.', 'EXT.', 'INT./EXT.']);
});

// ---------- Character rename ----------

const CAST = () => [
    L(CHARACTER, 'ANNA'),
    L(DIALOGUE, "Anna's here. I am Anna."),
    L(CHARACTER, 'ANNA (V.O.)'),
    L(CHARACTER, "ANNA (O.S.) (CONT'D)"),
    L(CHARACTER, 'ANNABELLE'),
    L(CHARACTER, 'YOUNG ANNA'),
    L(CHARACTER, 'ANNA & BOB'),
    L(ACTION, 'ANNA enters. Annabelle waves at Anna and YOUNG ANNA. Joanna too.'),
    L(ACTION, 'Characters: ANNA, BOB'),
    L(PAREN, 'to Anna'),
    L(SLUG, "INT. ANNA'S ROOM - DAY")
];

test('rename changes the cue name and never touches extensions', () => {
    const out = replaceAll(CAST(), charTarget([]), 'Anna', 'Maria');
    assert.equal(out[0], 'MARIA');
    assert.equal(out[2], 'MARIA (V.O.)');
    assert.equal(out[3], "MARIA (O.S.) (CONT'D)");
    assert.equal(out[4], 'ANNABELLE');
});

test('related cues are found but unticked by default', () => {
    const lines = CAST();
    const { matches } = searchLines(lines, charTarget([]), 'ANNA');
    const byField = (f) => matches.filter(m => m.field === f).map(m => lines[m.lineIndex].text);
    assert.deepEqual(byField('cue'), ['ANNA', 'ANNA (V.O.)', "ANNA (O.S.) (CONT'D)"]);
    assert.deepEqual(byField('cue-related'), ['YOUNG ANNA', 'ANNA & BOB']);
    assert.ok(matches.filter(m => m.field === 'cue').every(m => m.ticked));
    assert.ok(matches.filter(m => m.field === 'cue-related').every(m => !m.ticked));
    // Ticking a related cue replaces just the name inside it.
    const { texts } = applyMatches(lines, matches, 'Maria', charTarget([]), {});
    assert.equal(texts.get(lines[5].id), 'YOUNG MARIA');
    assert.equal(texts.get(lines[6].id), 'MARIA & BOB');
});

test('rename updates mentions, mirroring their case and keeping possessives', () => {
    const out = replaceAll(CAST(), charTarget(), 'ANNA', 'maria');
    assert.equal(out[1], "Maria's here. I am Maria.");
    assert.equal(out[7], 'MARIA enters. Annabelle waves at Maria and YOUNG ANNA. Joanna too.');
    assert.equal(out[8], 'Characters: MARIA, BOB');
    assert.equal(out[9], 'to Maria');
    assert.equal(out[10], "INT. ANNA'S ROOM - DAY"); // scene headings only when asked for
});

test('rename can include scene headings and scene notes', () => {
    const lines = [...CAST(), { id: 'meta:s1:description', type: FIND_META_TYPE, text: 'Anna meets Bob.' }];
    const out = replaceAll(lines, charTarget([SLUG, FIND_META_TYPE]), 'ANNA', 'Maria');
    assert.equal(out[10], "INT. MARIA'S ROOM - DAY");
    assert.equal(out[11], 'Maria meets Bob.');
    assert.equal(out[7], 'ANNA enters. Annabelle waves at Anna and YOUNG ANNA. Joanna too.');
});

test('a mention inside a longer known character name is unticked', () => {
    const lines = CAST();
    const { matches } = searchLines(lines, charTarget([ACTION]), 'ANNA');
    const inAction = matches.filter(m => m.lineIndex === 7);
    assert.deepEqual(inAction.map(m => [m.text, m.ticked]), [['ANNA', true], ['Anna', true], ['ANNA', false]]);
});

test('hyphen-joined names are unticked', () => {
    const lines = [L(CHARACTER, 'ANNA'), L(ACTION, 'Anna-Maria and Jo-Anna arrive with Anna.')];
    const { matches } = searchLines(lines, charTarget([ACTION]), 'ANNA');
    assert.deepEqual(matches.filter(m => m.field === 'mention').map(m => m.ticked), [false, false, true]);
});

test('lowercase words are not mentions (WILL vs will)', () => {
    const lines = [L(CHARACTER, 'WILL'), L(DIALOGUE, 'Will you? I will. WILL will not. Goodwill.')];
    const { matches } = searchLines(lines, charTarget([DIALOGUE]), 'will');
    assert.deepEqual(matches.filter(m => m.field === 'mention').map(m => m.text), ['Will', 'WILL']);
});

test('multi-word names and odd spacing', () => {
    const lines = [L(CHARACTER, 'DR.  SMITH (V.O.)'), L(ACTION, 'Dr. Smith nods. DR. SMITH leaves. Dr. Smithson stays.')];
    const out = replaceAll(lines, charTarget(), 'dr. smith', 'Professor Jones');
    assert.equal(out[0], 'PROFESSOR JONES (V.O.)');
    assert.equal(out[1], 'Professor Jones nods. PROFESSOR JONES leaves. Dr. Smithson stays.');
});

test('a forced mixed-case cue keeps its case style', () => {
    const lines = [L(CHARACTER, 'McClane (V.O.)'), L(CHARACTER, 'Anna')];
    assert.equal(replaceAll(lines, charTarget([]), 'anna', 'MARIA')[1], 'Maria');
});

test('fieldValues lists characters from cue lines with counts', () => {
    assert.deepEqual(fieldValues(CAST(), charTarget()), [
        { value: 'ANNA', count: 3 },
        { value: 'ANNA & BOB', count: 1 },
        { value: 'ANNABELLE', count: 1 },
        { value: 'YOUNG ANNA', count: 1 }
    ]);
});

// ---------- Tick state survives edits ----------

test('applyMatches reports edits so untouched matches can be re-keyed', () => {
    const lines = [L(ACTION, 'ANNA sees ANNA near ANNA.')];
    const target = textTarget();
    const { matches } = searchLines(lines, target, 'ANNA');
    const excluded = matches[2];                       // the user unticked the third one
    const { texts, edits } = applyMatches(lines, [matches[0]], 'MARIA', target, {});
    const newText = texts.get(lines[0].id);
    assert.equal(newText, 'MARIA sees ANNA near ANNA.');

    const shifted = shiftKeys(new Set([matchKey(excluded)]), edits);
    const after = searchLines([{ ...lines[0], text: newText }], target, 'ANNA').matches;
    assert.equal(after.length, 2);
    assert.equal(shifted.has(matchKey(after[0])), false, 'second ANNA stays ticked');
    assert.equal(shifted.has(matchKey(after[1])), true, 'the unticked ANNA stays unticked');
});

test('shiftKeys leaves other lines and earlier matches alone', () => {
    const lines = [L(ACTION, 'ANNA and ANNA'), L(ACTION, 'ANNA again')];
    const target = textTarget();
    const { matches } = searchLines(lines, target, 'ANNA');
    const keys = new Set([matchKey(matches[0]), matchKey(matches[2])]);
    const { edits } = applyMatches(lines, [matches[1]], 'MARIA', target, {});
    const shifted = shiftKeys(keys, edits);
    assert.deepEqual([...shifted].sort(), [...keys].sort());
});
