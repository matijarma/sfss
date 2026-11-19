import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCase, nextCaseMode, wordBoundsAt } from '../../assets/js-mod/InlineMarkup.js';

const seg = (text, start = 0, end = text.length) => ({ text, start, end });
const cycle = (text, start = 0, end = text.length) => {
    const mode = nextCaseMode([seg(text, start, end)]);
    return mode ? applyCase(text, start, end, mode) : text;
};

test('applyCase upper/lower/title on the whole string', () => {
    assert.equal(applyCase('hello big world', 0, 15, 'upper'), 'HELLO BIG WORLD');
    assert.equal(applyCase('HELLO Big World', 0, 15, 'lower'), 'hello big world');
    assert.equal(applyCase('hELLO big WORLD', 0, 15, 'title'), 'Hello Big World');
});

test('applyCase only touches the given range', () => {
    assert.equal(applyCase('she opens the door', 4, 9, 'upper'), 'she OPENS the door');
});

test('title case uses surrounding text for word starts', () => {
    // Selection starts mid-word: "llo world" must not become "Llo World".
    assert.equal(applyCase('hello world', 2, 11, 'title'), 'hello World');
});

test('title case keeps apostrophes inside words', () => {
    assert.equal(applyCase("don't o'neil's 'quoted'", 0, 23, 'title'), "Don't O'neil's 'Quoted'");
});

test('title case sees through inline markers', () => {
    assert.equal(applyCase('a **loud** _bang_', 0, 17, 'title'), 'A **Loud** _Bang_');
});

test('applyCase handles Croatian and other non-ASCII letters', () => {
    assert.equal(applyCase('čovjek žđć šuma', 0, 15, 'upper'), 'ČOVJEK ŽĐĆ ŠUMA');
    assert.equal(applyCase('ČOVJEK ŽĐĆ', 0, 10, 'title'), 'Čovjek Žđć');
});

test('applyCase is length-preserving (ß stays, never becomes SS)', () => {
    const out = applyCase('straße', 0, 6, 'upper');
    assert.equal(out, 'STRAßE');
    assert.equal(out.length, 'straße'.length);
});

test('cycle order: lower -> UPPER -> Title -> lower', () => {
    assert.equal(cycle('the door opens'), 'THE DOOR OPENS');
    assert.equal(cycle('THE DOOR OPENS'), 'The Door Opens');
    assert.equal(cycle('The Door Opens'), 'the door opens');
});

test('mixed case goes to UPPER first', () => {
    assert.equal(cycle('The door opens'), 'THE DOOR OPENS');
    assert.equal(cycle('hELLo'), 'HELLO');
});

test('cycle skips modes that would not change anything', () => {
    // "A" is both UPPER and Title: the next real change is lower.
    assert.equal(cycle('A'), 'a');
    assert.equal(cycle('a'), 'A');
});

test('nextCaseMode returns null when nothing has letters', () => {
    assert.equal(nextCaseMode([seg('123 -- !!')]), null);
    assert.equal(nextCaseMode([]), null);
});

test('nextCaseMode decides once across several segments', () => {
    assert.equal(nextCaseMode([seg('HELLO'), seg('THERE')]), 'title');
    assert.equal(nextCaseMode([seg('HELLO'), seg('there')]), 'upper');
    assert.equal(nextCaseMode([seg('Hello'), seg('There')]), 'lower');
});

test('wordBoundsAt finds the word touching the caret', () => {
    const t = 'she opens the door';
    assert.deepEqual(wordBoundsAt(t, 5), { start: 4, end: 9 });  // inside "opens"
    assert.deepEqual(wordBoundsAt(t, 9), { start: 4, end: 9 });  // right after "opens"
    assert.deepEqual(wordBoundsAt(t, 0), { start: 0, end: 3 });  // before "she"
    assert.deepEqual(wordBoundsAt("it's", 2), { start: 0, end: 4 });
});

test('wordBoundsAt stops at markers and returns null between words', () => {
    assert.deepEqual(wordBoundsAt('**bang**', 4), { start: 2, end: 6 });
    assert.equal(wordBoundsAt('a  b', 2), null);
    assert.equal(wordBoundsAt('', 0), null);
});
