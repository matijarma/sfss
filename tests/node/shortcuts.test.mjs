import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    comboFromEvent, isValidBinding, conflict, matches, format, RESERVED_COMBOS, sameCombo, browserOwned
} from '../../assets/js-mod/Shortcuts.js';

const ev = (key, mods = {}) => ({
    key,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt
});

test('comboFromEvent returns null while only modifiers are down', () => {
    assert.equal(comboFromEvent(ev('Control', { ctrl: true })), null);
    assert.equal(comboFromEvent(ev('Shift', { ctrl: true, shift: true })), null);
    assert.equal(comboFromEvent(ev('Meta', { meta: true })), null);
});

test('comboFromEvent builds canonical combos', () => {
    assert.equal(comboFromEvent(ev('e', { ctrl: true })), 'Ctrl+E');
    assert.equal(comboFromEvent(ev('z', { ctrl: true, shift: true })), 'Ctrl+Shift+Z');
    assert.equal(comboFromEvent(ev('Enter', { ctrl: true })), 'Ctrl+Enter');
    assert.equal(comboFromEvent(ev('e', { meta: true })), 'Ctrl+E'); // Cmd ≙ Ctrl
});

test('isValidBinding rejects bare modifiers (the old default) and bare keys', () => {
    assert.equal(isValidBinding('Ctrl+Shift'), false); // legacy default — must migrate
    assert.equal(isValidBinding('Ctrl'), false);
    assert.equal(isValidBinding('E'), false);          // no modifier
    assert.equal(isValidBinding(''), false);
    assert.equal(isValidBinding(null), false);
    assert.equal(isValidBinding('Ctrl+E'), true);
    assert.equal(isValidBinding('Ctrl+Alt+Shift+K'), true);
});

test('conflict detects reserved combos case-insensitively', () => {
    assert.equal(conflict('Ctrl+Z'), 'Ctrl+Z');
    assert.equal(conflict('ctrl+z'), 'Ctrl+Z');
    assert.equal(conflict('Cmd+S'), 'Ctrl+S'); // cmd alias
    assert.equal(conflict('Ctrl+Shift+Z'), 'Ctrl+Shift+Z');
    assert.equal(conflict('Ctrl+E'), null);
    assert.ok(RESERVED_COMBOS.includes('Ctrl+B'));
});

test('matches: exact modifier set + main key; never matches without main key', () => {
    assert.equal(matches(ev('e', { ctrl: true }), 'Ctrl+E'), true);
    assert.equal(matches(ev('e', { meta: true }), 'Ctrl+E'), true);       // Cmd works
    assert.equal(matches(ev('e', { ctrl: true, shift: true }), 'Ctrl+E'), false); // extra modifier
    assert.equal(matches(ev('e', {}), 'Ctrl+E'), false);
    assert.equal(matches(ev('Shift', { ctrl: true, shift: true }), 'Ctrl+Shift'), false); // bare-modifier binding never matches
    assert.equal(matches(ev('ArrowLeft', { ctrl: true, shift: true }), 'Ctrl+Shift'), false);
});

test('format is pass-through on non-Mac platforms', () => {
    // Node has no navigator → IS_MAC false → labels unchanged.
    assert.equal(format('Ctrl+E'), 'Ctrl+E');
    assert.equal(format('Ctrl+Shift+Z'), 'Ctrl+Shift+Z');
});

test('Shift+F3 (default Change Case) is a valid, unreserved, matchable binding', () => {
    assert.equal(isValidBinding('Shift+F3'), true);
    assert.equal(conflict('Shift+F3'), null);
    assert.equal(comboFromEvent(ev('F3', { shift: true })), 'Shift+F3');
    assert.equal(matches(ev('F3', { shift: true }), 'Shift+F3'), true);
    assert.equal(matches(ev('F3', {}), 'Shift+F3'), false);
    assert.equal(matches(ev('F3', { shift: true, ctrl: true }), 'Shift+F3'), false);
});

test('sameCombo compares bindings modifier-order and case insensitively', () => {
    assert.equal(sameCombo('Ctrl+Shift+K', 'shift+ctrl+k'), true);
    assert.equal(sameCombo('Cmd+E', 'Ctrl+E'), true);
    assert.equal(sameCombo('Ctrl+E', 'Ctrl+Shift+E'), false);
    assert.equal(sameCombo('', ''), false);
    assert.equal(sameCombo(null, 'Ctrl+E'), false);
});

test('browserOwned flags tab/window/quit chords on every platform', () => {
    for (const isMac of [false, true]) {
        assert.equal(browserOwned('Ctrl+W', isMac)?.combo, 'Ctrl+W');
        assert.equal(browserOwned('Cmd+W', isMac)?.combo, 'Ctrl+W');           // Cmd ≙ Ctrl
        assert.equal(browserOwned('shift+ctrl+t', isMac)?.combo, 'Ctrl+Shift+T'); // order/case-insensitive
        assert.equal(browserOwned('Ctrl+Tab', isMac)?.combo, 'Ctrl+Tab');
        assert.equal(browserOwned('Ctrl+N', isMac)?.combo, 'Ctrl+N');
        assert.equal(browserOwned('Ctrl+Q', isMac)?.combo, 'Ctrl+Q');
        assert.match(browserOwned('Ctrl+W', isMac).what, /closes the tab/);
    }
});

test('browserOwned is platform-aware', () => {
    assert.ok(browserOwned('Ctrl+H', true));      // ⌘H hides the browser on Mac
    assert.equal(browserOwned('Ctrl+H', false), null);
    assert.ok(browserOwned('Alt+F4', false));     // closes the window on Windows/Linux
    assert.equal(browserOwned('Alt+F4', true), null);
});

test('browserOwned leaves app bindings alone', () => {
    for (const isMac of [false, true]) {
        assert.equal(browserOwned('Ctrl+E', isMac), null);
        assert.equal(browserOwned('Shift+F3', isMac), null);
        assert.equal(browserOwned('Ctrl+Shift+W+X', isMac), null);
        assert.equal(browserOwned('', isMac), null);
        assert.equal(browserOwned(null, isMac), null);
    }
});
