import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAPER_CONFIGS } from '../../assets/js-mod/Constants.js';

// Phase 8 parity invariant: the live text area must be EXACTLY equal across
// papers (the spec's constant-live-area axiom), so pagination — page count,
// splits, eighths — is identical on US Letter and A4.

const round = (n) => Math.round(n * 1000) / 1000;

test('every paper config: dimensions - margins === declared liveArea', () => {
    for (const [key, cfg] of Object.entries(PAPER_CONFIGS)) {
        const liveW = round(cfg.dimensions.width - cfg.margins.left - cfg.margins.right);
        const liveH = round(cfg.dimensions.height - cfg.margins.top - cfg.margins.bottom);
        assert.equal(liveW, cfg.liveArea.width, `${key} live width`);
        assert.equal(liveH, cfg.liveArea.height, `${key} live height`);
    }
});

test('A4 emulation live area is EXACTLY the US Letter live area (6.0 x 9.0)', () => {
    const letter = PAPER_CONFIGS.US_LETTER;
    const a4 = PAPER_CONFIGS.A4_EMULATION;
    assert.deepEqual(letter.liveArea, { width: 6.0, height: 9.0 });
    assert.deepEqual(a4.liveArea, letter.liveArea);
    // Parity margins (deviation from the spec's rounded 1.7 / 0.8 figures).
    assert.equal(a4.margins.bottom, 1.69);
    assert.equal(a4.margins.right, 0.77);
    // The physical deviation from the spec literals stays under 1mm (0.04in).
    assert.ok(Math.abs(a4.margins.bottom - 1.7) <= 0.04);
    assert.ok(Math.abs(a4.margins.right - 0.8) <= 0.04);
});

test('paper configs carry the @page css size keywords', () => {
    assert.equal(PAPER_CONFIGS.US_LETTER.cssSize, 'letter');
    assert.equal(PAPER_CONFIGS.A4_EMULATION.cssSize, 'A4');
});
