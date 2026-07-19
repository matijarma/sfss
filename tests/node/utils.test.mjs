import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    generateLineId, escapeHtml, escapeXML,
    extractYouTubeVideoId, normalizeParenText, formatEighths
} from '../../assets/js-mod/Utils.js';

test('generateLineId shape and uniqueness', () => {
    const a = generateLineId();
    const b = generateLineId();
    assert.match(a, /^line-[a-z0-9]+$/);
    assert.notEqual(a, b);
});

test('escapeHtml escapes all dangerous chars', () => {
    assert.equal(
        escapeHtml(`<img src=x onerror="alert('1')" & more>`),
        '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot; &amp; more&gt;'
    );
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(undefined), ''); // default param
});

test('escapeXML uses XML entities', () => {
    assert.equal(escapeXML(`a<b>&'"`), 'a&lt;b&gt;&amp;&apos;&quot;');
});

test('extractYouTubeVideoId accepts all URL shapes', () => {
    const id = 'dQw4w9WgXcQ';
    assert.equal(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://youtube.com/watch?feature=share&v=${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://youtu.be/${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://www.youtube.com/embed/${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://www.youtube.com/shorts/${id}`), id);
    assert.equal(extractYouTubeVideoId(`https://www.youtube.com/v/${id}`), id);
    assert.equal(extractYouTubeVideoId('https://example.com/watch?v=nope'), null);
    assert.equal(extractYouTubeVideoId(''), null);
    assert.equal(extractYouTubeVideoId(null), null);
});

test('normalizeParenText strips exactly one outer pair', () => {
    assert.equal(normalizeParenText('(beat)'), 'beat');
    assert.equal(normalizeParenText('((double))'), '(double)');
    assert.equal(normalizeParenText('no parens'), 'no parens');
    assert.equal(normalizeParenText('  (trimmed)  '), 'trimmed');
});

test('formatEighths label style', () => {
    assert.equal(formatEighths(3), '3/8');
    assert.equal(formatEighths(8), '1pg');
    assert.equal(formatEighths(11), '1pg 3/8');
    assert.equal(formatEighths(0), '0/8');
});

test('formatEighths fdx style normalizes >8 (never "16/8")', () => {
    assert.equal(formatEighths(3, 'fdx'), '3/8');
    assert.equal(formatEighths(8, 'fdx'), '1');
    assert.equal(formatEighths(16, 'fdx'), '2');
    assert.equal(formatEighths(11, 'fdx'), '1 3/8');
});
