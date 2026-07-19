import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Drift guard (#23): assets/asset-manifest.json is the single source of truth
// for the SW precache and the portable build. These tests fail whenever a
// module is added/removed/renamed without updating the manifest.

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(join(APP_ROOT, 'assets', 'asset-manifest.json'), 'utf8'));
const conditional = manifest.conditional || {};
const conditionalUrls = Object.values(conditional).flat();
const cacheUrls = [...manifest.core, ...manifest.extras, ...conditionalUrls];

// Mirrors SingleFileGenerator.expandFeatureTokens with every feature enabled.
const expandTokens = (list) =>
    list.flatMap(entry => entry.startsWith('@') ? (conditional[entry.slice(1)] || []) : [entry]);

test('every js-mod module appears exactly once across core/extras/conditional', () => {
    const modules = readdirSync(join(APP_ROOT, 'assets', 'js-mod')).filter(f => f.endsWith('.js'));
    assert.ok(modules.length > 0, 'assets/js-mod must contain modules');
    for (const file of modules) {
        const url = `assets/js-mod/${file}`;
        const count = cacheUrls.filter(u => u === url).length;
        assert.equal(count, 1, `${url} must be listed exactly once in asset-manifest.json (found ${count})`);
    }
});

test('every listed asset exists on disk', () => {
    const listed = new Set([
        ...cacheUrls,
        ...expandTokens(manifest.portableJsOrder),
        ...expandTokens(manifest.portableCss)
    ]);
    for (const url of listed) {
        if (url === '.') continue; // scope root; served as index.html
        assert.ok(
            existsSync(join(APP_ROOT, ...url.split('/'))),
            `${url} is listed in asset-manifest.json but missing on disk`
        );
    }
});

test('portableJsOrder topological sanity', () => {
    const order = expandTokens(manifest.portableJsOrder).filter(f => f.endsWith('.js'));
    assert.equal(order[0], 'assets/js-mod/Constants.js', 'Constants.js must be bundled first');
    assert.ok(
        order.indexOf('assets/js-mod/Utils.js') < order.indexOf('assets/js-mod/InlineMarkup.js'),
        'Utils.js must be bundled before InlineMarkup.js'
    );
    assert.equal(order[order.length - 1], 'assets/js-mod/SFSS.js', 'SFSS.js must be bundled last');
    assert.equal(new Set(order).size, order.length, 'portableJsOrder must not expand to duplicates');
});

test('sw.js defers activation to the SKIP_WAITING message (#20)', () => {
    const source = readFileSync(join(APP_ROOT, 'sw.js'), 'utf8');

    const installStart = source.search(/addEventListener\(\s*['"]install['"]/);
    assert.notEqual(installStart, -1, 'sw.js must register an install handler');
    const afterInstall = source.indexOf('addEventListener(', installStart + 1);
    const installBody = source.slice(installStart, afterInstall === -1 ? source.length : afterInstall);
    assert.ok(!/skipWaiting\s*\(/.test(installBody), 'install handler must not call skipWaiting()');

    const messageStart = source.search(/addEventListener\(\s*['"]message['"]/);
    assert.notEqual(messageStart, -1, 'sw.js must register a message handler');
    const afterMessage = source.indexOf('addEventListener(', messageStart + 1);
    const messageBody = source.slice(messageStart, afterMessage === -1 ? source.length : afterMessage);
    assert.match(messageBody, /SKIP_WAITING/, 'message handler must check for SKIP_WAITING');
    assert.ok(/skipWaiting\s*\(/.test(messageBody), 'SKIP_WAITING message must trigger skipWaiting()');
});

test('every CSS file in assets/css is precached as core', () => {
    const cssFiles = readdirSync(join(APP_ROOT, 'assets', 'css')).filter(f => f.endsWith('.css'));
    for (const file of cssFiles) {
        assert.ok(
            manifest.core.includes(`assets/css/${file}`),
            `assets/css/${file} must be listed in asset-manifest.json core`
        );
    }
});
