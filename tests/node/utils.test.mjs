import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    generateLineId, escapeHtml, escapeXML,
    extractYouTubeVideoId, normalizeParenText, formatEighths, trackLabel
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

test('trackLabel: title and artist, title only, artist only', () => {
    assert.equal(trackLabel({ track: 'https://youtu.be/dQw4w9WgXcQ', trackTitle: 'Clair de Lune', trackArtist: 'Debussy' }), 'Clair de Lune \u2014 Debussy');
    assert.equal(trackLabel({ track: 'https://youtu.be/dQw4w9WgXcQ', trackTitle: 'Clair de Lune', trackArtist: '' }), 'Clair de Lune');
    assert.equal(trackLabel({ track: 'https://youtu.be/dQw4w9WgXcQ', trackArtist: 'Debussy' }), 'Debussy');
    assert.equal(trackLabel({ trackTitle: '  Padded  ', trackArtist: ' Name ' }), 'Padded \u2014 Name');
});

test('trackLabel: no real title falls back to a short link', () => {
    // URL only (oEmbed lookup failed).
    assert.equal(trackLabel({ track: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), 'youtu.be/dQw4w9WgXcQ');
    // Portable build stores the URL as the title and an empty artist.
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s';
    assert.equal(trackLabel({ track: url, trackTitle: url, trackArtist: '' }), 'youtu.be/dQw4w9WgXcQ');
});

test('trackLabel: unrecognised URL gets a generic label', () => {
    assert.equal(trackLabel({ track: 'https://example.com/song.mp3' }), 'Track attached');
    assert.equal(trackLabel({ track: 'https://example.com/a', trackTitle: 'https://example.com/a' }), 'Track attached');
});

test('trackLabel: no track means no label', () => {
    assert.equal(trackLabel({ track: '', trackTitle: '', trackArtist: '' }), ''); // removed track: fields blanked
    assert.equal(trackLabel({}), '');
    assert.equal(trackLabel(undefined), '');
    assert.equal(trackLabel(null), '');
    assert.equal(trackLabel({ track: '   ' }), '');
});
