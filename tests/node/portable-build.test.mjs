import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The portable single-file build (SingleFileGenerator) strips every
// import/export and concatenates the modules into ONE classic script. These
// guards catch the ways a new or edited module can break that build while
// the normal ES-module app keeps working.

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MOD_DIR = join(APP_ROOT, 'assets', 'js-mod');
const manifest = JSON.parse(readFileSync(join(APP_ROOT, 'assets', 'asset-manifest.json'), 'utf8'));
const conditionalUrls = Object.values(manifest.conditional || {}).flat();

// Modules that are deliberately NOT concatenated: the portable build ships
// its own FeatureManager stub, and never bundles the generator itself.
const NOT_BUNDLED = ['FeatureManager.js', 'SingleFileGenerator.js'];

// What actually gets concatenated (feature tokens are stubbed in portable).
const bundled = manifest.portableJsOrder
    .filter(entry => !entry.startsWith('@') && entry.startsWith('assets/js-mod/'))
    .map(entry => entry.slice('assets/js-mod/'.length));

const read = (file) => readFileSync(join(MOD_DIR, file), 'utf8');

// Declarations at column 0 are module top-level in this codebase's style.
const TOP_LEVEL_RE = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

test('every js-mod module is bundled, conditional, or explicitly excluded', () => {
    const modules = readdirSync(MOD_DIR).filter(f => f.endsWith('.js'));
    for (const file of modules) {
        const url = `assets/js-mod/${file}`;
        const known = bundled.includes(file) || conditionalUrls.includes(url) || NOT_BUNDLED.includes(file);
        assert.ok(known, `${url} is missing from portableJsOrder in asset-manifest.json`);
    }
});

test('top-level names are unique across the bundled modules', () => {
    const seen = new Map();
    for (const file of bundled) {
        for (const m of read(file).matchAll(TOP_LEVEL_RE)) {
            const name = m[1];
            assert.ok(
                !seen.has(name),
                `top-level "${name}" is declared in both ${seen.get(name)} and ${file} — ` +
                'the portable build shares one scope, so one would shadow or break the other'
            );
            seen.set(name, file);
        }
    }
    assert.ok(seen.size > 50, 'expected to scan a realistic number of declarations');
});

test('bundled modules only use syntax the flattener understands', () => {
    for (const file of bundled) {
        const code = read(file);
        assert.ok(!/^export\s+async\s+function/m.test(code), `${file}: "export async function" is not stripped by the flattener`);
        assert.ok(!/^export\s+var\s/m.test(code), `${file}: "export var" is not stripped by the flattener`);

        const imports = code.match(/^import\b[^;]*;?/gm) || [];
        for (const stmt of imports) {
            assert.ok(stmt.trimEnd().endsWith(';'), `${file}: import must end with ";" or the flattener eats the next statement:\n${stmt}`);
            const isNamespace = /^import\s+\*\s+as\s+(\w+)/.exec(stmt);
            if (isNamespace) {
                assert.ok(
                    ['constants', 'Shortcuts'].includes(isNamespace[1]),
                    `${file}: only the "constants" and "Shortcuts" namespace imports are rebuilt in the portable build:\n${stmt}`
                );
            } else if (!/trystero/.test(stmt)) {
                assert.ok(!/\bas\b/.test(stmt), `${file}: aliased imports lose their alias in the portable build:\n${stmt}`);
            }
        }
    }
});

test('the Constants namespace in the portable build carries every export', async () => {
    globalThis.window = globalThis.window || {};
    const { SingleFileGenerator } = await import('../../assets/js-mod/SingleFileGenerator.js');
    const gen = Object.create(SingleFileGenerator.prototype);
    const source = read('Constants.js');
    const out = gen.prepareModule(source, 'assets/js-mod/Constants.js');
    const namespaceLine = out.split('\n').find(l => l.startsWith('window.SFSS_CONSTANTS'));
    assert.ok(namespaceLine, 'prepareModule must emit the SFSS_CONSTANTS namespace');
    const exported = [...source.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
    assert.ok(exported.includes('TYPE_ORDER'));
    for (const name of exported) {
        assert.match(namespaceLine, new RegExp(`\\b${name}\\b`), `${name} must be in the portable Constants namespace`);
    }
    assert.ok(!/\bexport\b/.test(out), 'no export keyword may survive flattening');
});
