import * as constants from './Constants.js';
import * as Shortcuts from './Shortcuts.js';

// Remappable editor actions, in Settings display order.
const SHORTCUT_ACTIONS = [
    { id: 'cycleType', label: 'Toggle Element Type', fallback: 'Ctrl+E' },
    { id: 'changeCase', label: 'Change Case (UPPER → Sentence → Title → lower)', fallback: 'Shift+F3' }
];

const BROWSER_HINT = () =>
    `That shortcut belongs to your browser (${Shortcuts.format('Ctrl+W')} closes the tab; ` +
    `${Shortcuts.format('Ctrl+T')} / ${Shortcuts.format('Ctrl+N')} open new ones) — choose another.`;

export class SettingsManager {
    constructor(sfss) {
        this.sfss = sfss;

        // Shortcuts
        this.shortcuts = Object.fromEntries(SHORTCUT_ACTIONS.map(a => [a.id, a.fallback]));
        const storedShortcuts = localStorage.getItem('sfss_shortcuts');
        if (storedShortcuts) {
            try {
                this.shortcuts = { ...this.shortcuts, ...JSON.parse(storedShortcuts) };
            } catch (e) {
                console.error("Error loading shortcuts", e);
            }
        }
        // Migrate legacy bare-modifier bindings (e.g. 'Ctrl+Shift') that used
        // to hijack every Ctrl+Shift+<key> chord.
        if (this.normalizeShortcuts()) {
            localStorage.setItem('sfss_shortcuts', JSON.stringify(this.shortcuts));
        }

        // Recording guard: some browser chords never reach the page (Chrome
        // closes the tab on Ctrl+W before any keydown), so while a recorder
        // is armed the browser's own "Leave site?" prompt stands between the
        // user and a closed tab. The recorder explains what happened.
        this.activeRecorder = null;
        window.addEventListener('beforeunload', (e) => {
            const rec = this.activeRecorder;
            if (!rec || !rec.input.isConnected || rec.input.getClientRects().length === 0) return;
            e.preventDefault();
            e.returnValue = '';
            rec.onBrowserShortcut();
        });

        // Keymap
        this.keymap = {
            [constants.ELEMENT_TYPES.SLUG]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.CHARACTER },
            [constants.ELEMENT_TYPES.ACTION]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.CHARACTER },
            [constants.ELEMENT_TYPES.CHARACTER]: { enter: constants.ELEMENT_TYPES.DIALOGUE, tab: constants.ELEMENT_TYPES.PARENTHETICAL },
            [constants.ELEMENT_TYPES.DIALOGUE]: { enter: constants.ELEMENT_TYPES.ACTION, tab: constants.ELEMENT_TYPES.PARENTHETICAL },
            [constants.ELEMENT_TYPES.PARENTHETICAL]: { enter: constants.ELEMENT_TYPES.DIALOGUE, tab: constants.ELEMENT_TYPES.DIALOGUE },
            [constants.ELEMENT_TYPES.TRANSITION]: { enter: constants.ELEMENT_TYPES.SLUG, tab: constants.ELEMENT_TYPES.ACTION }
        };

        const storedKeymap = localStorage.getItem('sfss_keymap');
        if (storedKeymap) {
            try {
                const parsed = JSON.parse(storedKeymap);
                // Per-type merge so a partial stored entry can't leave
                // tab/enter undefined.
                for (const t of Object.keys(this.keymap)) {
                    this.keymap[t] = { ...this.keymap[t], ...(parsed[t] || {}) };
                }
            } catch (e) {
                console.error("Error loading keymap", e);
            }
        }
    }

    open() {
        this.sfss.editorHandler.closePopups();
        this.generateUI();
        this.sfss.modalManager.open('settings-modal');
    }

    close() {
        this.sfss.modalManager.close('settings-modal');
    }

    // Resets every invalid (or cleared) binding to its default. An action
    // whose binding collides with an earlier action's falls back to its
    // default, or stays unbound ('') if the default is taken too. Returns
    // true if anything changed.
    normalizeShortcuts() {
        let changed = false;
        SHORTCUT_ACTIONS.forEach((action, i) => {
            const before = this.shortcuts[action.id];
            const takenBy = (combo) => SHORTCUT_ACTIONS.slice(0, i).some(a => Shortcuts.sameCombo(this.shortcuts[a.id], combo));
            let combo = before;
            // conflict(): a binding stored before a combo became built-in
            // (Ctrl+F for Find) must not keep shadowing it.
            if (!Shortcuts.isValidBinding(combo) || Shortcuts.browserOwned(combo) ||
                Shortcuts.conflict(combo) || takenBy(combo)) combo = action.fallback;
            if (takenBy(combo)) combo = '';
            if (combo !== before) {
                this.shortcuts[action.id] = combo;
                changed = true;
            }
        });
        return changed;
    }

    async save() {
        this.normalizeShortcuts();
        localStorage.setItem('sfss_keymap', JSON.stringify(this.keymap));
        localStorage.setItem('sfss_shortcuts', JSON.stringify(this.shortcuts));
        await this.sfss.persistSettings();
    }

    checkShortcut(e, action) {
        return Shortcuts.matches(e, this.shortcuts[action]);
    }

    toggleTheme() {
        document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('sfss_theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');
    }

    // One recorder row per remappable action (click, then press the chord).
    createShortcutRow(action) {
        const row = document.createElement('tr');
        const labelCell = document.createElement('td');
        labelCell.textContent = action.label;
        
        const inputCell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'settings-input';
        input.value = this.shortcuts[action.id] ? Shortcuts.format(this.shortcuts[action.id]) : '';
        input.readOnly = true;
        input.placeholder = 'Click to record...';
        input.style.cursor = 'pointer';
        input.style.textAlign = 'center';

        const errorEl = document.createElement('div');
        errorEl.className = 'text-sm';
        errorEl.style.color = '#ef4444';
        errorEl.style.display = 'none';

        const showStored = () => {
            input.value = this.shortcuts[action.id] ? Shortcuts.format(this.shortcuts[action.id]) : '';
        };
        const showError = (msg) => {
            errorEl.textContent = msg || '';
            errorEl.style.display = msg ? '' : 'none';
        };

        // chordPending: a modifier is down with no main key yet. If the page
        // then unloads or loses focus, the browser took the chord.
        let chordPending = false;
        let awayWithChord = false;
        const showBrowserHint = () => { showError(BROWSER_HINT()); showStored(); };
        const recorder = {
            input,
            onBrowserShortcut: () => { if (chordPending) showBrowserHint(); }
        };

        input.addEventListener('focus', () => {
            this.activeRecorder = recorder;
            // Back from a tab/window a browser chord opened (Ctrl+T, Ctrl+Tab).
            if (awayWithChord) showBrowserHint();
            awayWithChord = false;
            chordPending = false;
        });

        input.addEventListener('keyup', (e) => {
            if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) chordPending = false;
        });

        input.addEventListener('keydown', (e) => {
            // The recorder owns every key while focused: nothing may bubble to
            // the editor, the modal stack or the browser (Esc must not close
            // Settings, Ctrl+S must not open Save As).
            e.preventDefault();
            e.stopPropagation();
            const combo = Shortcuts.comboFromEvent(e);
            chordPending = combo === null;
            if (e.key === 'Escape') {
                showError('');
                showStored();
                input.blur();
                return;
            }
            if (e.key === 'Backspace') {
                this.shortcuts[action.id] = '';
                showError('');
                input.value = '';
                return;
            }
            if (combo === null) {
                // Modifier-only chord: show pending text, commit nothing.
                const mods = [];
                if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
                if (e.altKey) mods.push('Alt');
                if (e.shiftKey) mods.push('Shift');
                const label = Shortcuts.format(mods.join('+'));
                input.value = label ? (Shortcuts.IS_MAC ? `${label}…` : `${label}+…`) : '';
                return;
            }
            if (!Shortcuts.isValidBinding(combo)) {
                showError('Shortcut needs a modifier (e.g. Ctrl) plus a key.');
                showStored();
                return;
            }
            const owned = Shortcuts.browserOwned(combo);
            if (owned) {
                showError(`${Shortcuts.format(combo)} belongs to your browser (it ${owned.what}) — choose another.`);
                showStored();
                return;
            }
            const clash = Shortcuts.conflict(combo);
            if (clash) {
                showError(`${Shortcuts.format(combo)} is reserved for ${Shortcuts.format(clash)}.`);
                showStored();
                return;
            }
            const other = SHORTCUT_ACTIONS.find(a => a.id !== action.id && Shortcuts.sameCombo(this.shortcuts[a.id], combo));
            if (other) {
                showError(`${Shortcuts.format(combo)} is already used for ${other.label}.`);
                showStored();
                return;
            }
            this.shortcuts[action.id] = combo;
            showError('');
            showStored();
        });
        input.addEventListener('blur', () => {
            if (!document.hasFocus()) {
                // The whole window lost focus (browser chord, a dialog, an app
                // switch): stay armed — focus comes back to this input.
                awayWithChord = chordPending;
                if (chordPending) showBrowserHint();
                return;
            }
            if (this.activeRecorder === recorder) this.activeRecorder = null;
            chordPending = false;
            awayWithChord = false;
            showError('');
            showStored();
        });

        inputCell.appendChild(input);
        inputCell.appendChild(errorEl);
        row.appendChild(labelCell);
        row.appendChild(inputCell);
        return row;
    }

    generateUI() {
        this.activeRecorder = null; // old recorder inputs are about to go
        const container = document.getElementById('keymap-settings');
        container.innerHTML = '';
        
        // --- Global Shortcuts Section ---
        const globalHeader = document.createElement('h3');
        globalHeader.textContent = 'Global Shortcuts';
        globalHeader.style.marginBottom = '0.5rem';
        container.appendChild(globalHeader);
        
        const globalTable = document.createElement('table');
        globalTable.className = 'keymap-table';
        globalTable.style.marginBottom = '1.5rem';
        
        SHORTCUT_ACTIONS.forEach(action => globalTable.appendChild(this.createShortcutRow(action)));
        container.appendChild(globalTable);
        
        // --- Element Transitions Section ---
        const transHeader = document.createElement('h3');
        transHeader.textContent = 'Element Transitions';
        transHeader.style.marginBottom = '0.5rem';
        container.appendChild(transHeader);
        
        const keyOrder = ['tab', 'enter'];
        const table = document.createElement('table');
        table.className = 'keymap-table';
        
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Element</th>
                <th><span class="keycap">Tab</span> ➔</th>
                <th><span class="keycap">Enter</span> ➔</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        for (const type in this.keymap) {
            const typeLabel = constants.TYPE_LABELS[type];
            const row = document.createElement('tr');
            const typeCell = document.createElement('td');
            typeCell.textContent = typeLabel;
            row.appendChild(typeCell);
            
            keyOrder.forEach(key => {
                const keyCell = document.createElement('td');
                const selector = this.createSelector(type, key);
                keyCell.appendChild(selector);
                row.appendChild(keyCell);
            });
            tbody.appendChild(row);
        }
        table.appendChild(tbody);
        container.appendChild(table);
    }

    createSelector(type, key) {
        const selector = document.createElement('select');
        selector.className = 'settings-input'; 
        selector.dataset.type = type;
        selector.dataset.key = key;
        
        const noneOption = document.createElement('option');
        noneOption.value = 'null';
        noneOption.textContent = 'None (Show Menu)';
        selector.appendChild(noneOption);
        
        for (const optionType in constants.TYPE_LABELS) {
            const isActionEnterAction = type === constants.ELEMENT_TYPES.ACTION && key === 'enter' && optionType === constants.ELEMENT_TYPES.ACTION;
            if (optionType === type && !isActionEnterAction) continue;
            
            const option = document.createElement('option');
            option.value = optionType;
            option.textContent = `${constants.TYPE_LABELS[optionType]}`;
            selector.appendChild(option);
        }
        
        selector.value = this.keymap[type][key] || 'null';
        selector.addEventListener('change', (e) => {
            this.keymap[e.target.dataset.type][e.target.dataset.key] = e.target.value === 'null' ? null : e.target.value;
        });
        return selector;
    }
}
