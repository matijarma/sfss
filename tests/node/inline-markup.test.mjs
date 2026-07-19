import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    tokenize, hasMarkup, plainText, stripMarkers, unescapeText,
    tokensToRuns, runsToFountain, toggleMarkers, splitBoneyard
} from '../../assets/js-mod/InlineMarkup.js';

test('tokenize finds emphasis, notes, and plain text', () => {
    const t = 'He said **hello** to *her* and _left_ [[check pacing]]';
    const kinds = tokenize(t).map(x => x.kind);
    assert.deepEqual(kinds, ['text', 'em', 'text', 'em', 'text', 'em', 'text', 'note']);
});

test('tokenize priority: *** beats ** beats *', () => {
    const toks = tokenize('***both*** then **bold** then *it*');
    const ems = toks.filter(t => t.kind === 'em');
    assert.deepEqual(ems.map(e => e.style), ['bi', 'b', 'i']);
});

test('emphasis requires non-whitespace at boundaries', () => {
    assert.equal(hasMarkup('* not emphasis *'), false);
    assert.equal(hasMarkup('2 * 3 * 4 = 24'), false);
    assert.equal(hasMarkup('*real*'), true);
});

test('escapes prevent tokenization and unescape cleanly', () => {
    const BS = '\\';
    const s = `keep ${BS}*this${BS}* literal`;
    assert.equal(hasMarkup(s), false);
    assert.equal(plainText(s), 'keep *this* literal');
    assert.equal(unescapeText(`${BS}_u${BS}_`), '_u_');
});

test('escaped char still counts as content at emphasis boundary', () => {
    const BS = '\\';
    // *foo\** = italic run ending in a literal star
    const s = `*foo${BS}**`;
    assert.equal(plainText(s), 'foo*');
});

test('plainText drops notes by default, keeps with option', () => {
    const t = 'before [[note text]] after';
    assert.equal(plainText(t), 'before  after');
    assert.equal(plainText(t, { notes: true }), 'before note text after');
    assert.equal(stripMarkers, plainText);
});

test('nested emphasis flattens to correct runs', () => {
    const runs = tokensToRuns('a **b *c* d** e');
    assert.deepEqual(runs, [
        { text: 'a ', bold: false, italic: false, underline: false },
        { text: 'b ', bold: true, italic: false, underline: false },
        { text: 'c', bold: true, italic: true, underline: false },
        { text: ' d', bold: true, italic: false, underline: false },
        { text: ' e', bold: false, italic: false, underline: false }
    ]);
});

test('underline-italic composite', () => {
    const runs = tokensToRuns('_*ui*_');
    assert.deepEqual(runs, [{ text: 'ui', bold: false, italic: true, underline: true }]);
});

test('runsToFountain round-trips through tokensToRuns', () => {
    const cases = ['**bold** plain *it* _u_', '***bi*** x', '_*ui*_ tail'];
    for (const c of cases) {
        assert.deepEqual(tokensToRuns(runsToFountain(tokensToRuns(c))), tokensToRuns(c), c);
    }
});

test('runsToFountain escapes literal markers in run text', () => {
    const out = runsToFountain([{ text: 'a*b_c', bold: false, italic: false, underline: false }]);
    assert.equal(hasMarkup(out), false);
    assert.equal(plainText(out), 'a*b_c');
});

test('runsToFountain merges adjacent same-style runs', () => {
    const out = runsToFountain([
        { text: 'he', bold: true }, { text: 'llo', bold: true }
    ]);
    assert.equal(out, '**hello**');
});

test('toggleMarkers wraps, unwraps, and handles empty selection', () => {
    assert.deepEqual(toggleMarkers('hello world', 0, 5, 'b'),
        { text: '**hello** world', selStart: 2, selEnd: 7 });
    assert.deepEqual(toggleMarkers('**hello** world', 2, 7, 'b'),
        { text: 'hello world', selStart: 0, selEnd: 5 });
    const r = toggleMarkers('ab', 1, 1, 'i');
    assert.equal(r.text, 'a**b');
    assert.equal(r.selStart, 2);
});

test('toggleMarkers italic does not eat one star of a bold pair', () => {
    const r = toggleMarkers('**bold**', 2, 6, 'i');
    // wraps instead of stripping a star from the ** pair
    assert.equal(r.text, '***bold***');
});

test('toggleMarkers trims whitespace out of the selection', () => {
    const r = toggleMarkers('say  word  now', 3, 11, 'u');
    assert.equal(r.text, 'say  _word_  now');
});

test('splitBoneyard extracts only multi-line boneyards', () => {
    const raw = 'line1\nline2 /* inline */ x\n/* multi\nline */\nline3';
    const { text, extracted } = splitBoneyard(raw);
    assert.ok(text.includes('/* inline */'));
    assert.ok(!text.includes('multi'));
    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].text, ' multi\nline ');
    assert.equal(extracted[0].beforeLineIndex, 2);
});

test('splitBoneyard leaves unclosed comment alone', () => {
    const raw = 'a\n/* never closed\nb';
    const { text, extracted } = splitBoneyard(raw);
    assert.equal(text, raw);
    assert.equal(extracted.length, 0);
});
