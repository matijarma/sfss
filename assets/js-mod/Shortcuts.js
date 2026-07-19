// Keyboard dispatch order contract — the single source of truth for who
// handles a key event. Handlers earlier in the list consume events before
// later ones see them:
//   1. Transient editor popups (autocomplete / type selector / treatment
//      menus) own Esc / Enter / Tab / Arrows while open.
//   2. Modal stack (ModalManager): while non-empty, the top modal owns Esc
//      (close) and Tab (focus trap). Editor-local and global shortcuts are
//      inert, except Ctrl+S / Ctrl+P which still preventDefault to suppress
//      the browser dialogs (Ctrl+S also saves — saving is always safe).
//   3. Editor-local (EditorHandler.handleKeydown, editor focused): cycleType,
//      Ctrl+B/I/U, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, Enter/Tab/Backspace,
//      Ctrl+Enter.
//   4. Global window-level (SFSS): Ctrl+S, Ctrl+P — guarded by an empty modal
//      stack and a non-editable event target.
// Escape has ONE entry point: SFSS.handleBackOrEscape.
//
// Import-safe under Node (guards around navigator/Element).

export const IS_MAC = typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

const MODIFIER_NAMES = ['ctrl', 'control', 'meta', 'cmd', 'shift', 'alt'];
const CTRL_ALIASES = ['ctrl', 'control', 'meta', 'cmd'];

// Combos user bindings may never shadow (built-in editor/global behavior).
export const RESERVED_COMBOS = [
    'Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+Y', 'Ctrl+S', 'Ctrl+P',
    'Ctrl+B', 'Ctrl+I', 'Ctrl+U',
    'Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+A', 'Ctrl+Enter',
    'Enter', 'Tab', 'Escape', 'Backspace', 'Delete'
];

function parseCombo(combo) {
    const keys = String(combo || '').split('+').map(k => k.trim().toLowerCase()).filter(Boolean);
    return {
        ctrl: keys.some(k => CTRL_ALIASES.includes(k)),
        shift: keys.includes('shift'),
        alt: keys.includes('alt'),
        main: keys.find(k => !MODIFIER_NAMES.includes(k)) || null
    };
}

// Builds a canonical combo string from a keydown event, or null while only
// modifiers are down (modifier-only chords are never a complete combo).
export function comboFromEvent(e) {
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
    const keys = [];
    if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    return keys.join('+');
}

// A binding is valid only with at least one modifier AND exactly one
// non-modifier main key. Bare-modifier bindings (the old 'Ctrl+Shift'
// default) are rejected everywhere.
export function isValidBinding(combo) {
    if (!combo || typeof combo !== 'string') return false;
    const keys = combo.split('+').map(k => k.trim()).filter(Boolean);
    const mains = keys.filter(k => !MODIFIER_NAMES.includes(k.toLowerCase()));
    const mods = keys.filter(k => MODIFIER_NAMES.includes(k.toLowerCase()));
    return mains.length === 1 && mods.length >= 1;
}

function normalizeCombo(combo) {
    const p = parseCombo(combo);
    return `${p.ctrl ? 'ctrl+' : ''}${p.alt ? 'alt+' : ''}${p.shift ? 'shift+' : ''}${p.main || ''}`;
}

// Returns the reserved combo a binding collides with, or null.
export function conflict(combo) {
    if (!combo) return null;
    const norm = normalizeCombo(combo);
    return RESERVED_COMBOS.find(r => normalizeCombo(r) === norm) || null;
}

// Exact modifier-set + main-key match. 'Ctrl' in a binding matches either
// ctrlKey or metaKey (Cmd on Mac). Bindings without a main key never match.
export function matches(e, combo) {
    const p = parseCombo(combo);
    if (!p.main) return false;
    if (p.ctrl !== (e.ctrlKey || e.metaKey)) return false;
    if (p.shift !== e.shiftKey) return false;
    if (p.alt !== e.altKey) return false;
    return (e.key || '').toLowerCase() === p.main;
}

// Platform-aware display label: 'Ctrl+E' → '⌘E' on Mac, unchanged elsewhere.
export function format(combo) {
    if (!combo) return '';
    const keys = String(combo).split('+').map(k => k.trim()).filter(Boolean);
    if (!IS_MAC) return keys.join('+');
    return keys.map(k => {
        const l = k.toLowerCase();
        if (CTRL_ALIASES.includes(l)) return '⌘';
        if (l === 'shift') return '⇧';
        if (l === 'alt') return '⌥';
        return k;
    }).join('');
}

// True when the event target is a form field or a contenteditable OTHER than
// the script editor itself (pass the editor container to allow it).
export function isEditableTarget(target, editorContainer = null) {
    if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
    if (editorContainer && editorContainer.contains(target)) return false;
    if (target.closest('input, textarea, select')) return true;
    if (target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')) return true;
    return false;
}
