import * as constants from './Constants.js';

export class SettingsManager {
    constructor(sfss) {
        this.sfss = sfss;
        
        // Shortcuts
        const storedShortcuts = localStorage.getItem('sfss_shortcuts');
        this.shortcuts = storedShortcuts ? JSON.parse(storedShortcuts) : { cycleType: 'Ctrl+Shift' };

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
                this.keymap = { ...this.keymap, ...parsed };
            } catch (e) {
                console.error("Error loading keymap", e);
            }
        }
    }

    open() {
        // Manually close other popups via sfss
        this.sfss.editorHandler.closePopups();
        this.sfss.sidebarManager.closeSceneSettings();
        this.sfss.sidebarManager.closeScriptMetaPopup();
        document.getElementById('help-modal').classList.add('hidden');
        document.getElementById('reports-modal').classList.add('hidden');
        
        this.generateUI();
        document.getElementById('settings-modal').classList.remove('hidden');
        this.sfss.pushHistoryState('settings');
    }

    close() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    async save() {
        localStorage.setItem('sfss_keymap', JSON.stringify(this.keymap));
        localStorage.setItem('sfss_shortcuts', JSON.stringify(this.shortcuts));
        await this.sfss.persistSettings();
    }

    checkShortcut(e, action) {
        if (!this.shortcuts[action]) return false;
        const keys = this.shortcuts[action].toLowerCase().split('+');
        const pressedKey = e.key.toLowerCase();
        const ctrl = keys.includes('ctrl') || keys.includes('control') || keys.includes('meta') || keys.includes('cmd');
        const shift = keys.includes('shift');
        const alt = keys.includes('alt');
        
        if (ctrl !== (e.ctrlKey || e.metaKey)) return false;
        if (shift !== e.shiftKey) return false;
        if (alt !== e.altKey) return false;
        
        const mainKey = keys.find(k => !['ctrl', 'control', 'meta', 'cmd', 'shift', 'alt'].includes(k));
        if (mainKey) {
            return mainKey === pressedKey;
        } else {
            return true; 
        }
    }

    toggleTheme() {
        document.documentElement.classList.toggle('dark-mode');
        localStorage.setItem('sfss_theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');
    }

    generateUI() {
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
        
        const row = document.createElement('tr');
        const labelCell = document.createElement('td');
        labelCell.textContent = 'Toggle Element Type';
        
        const inputCell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'settings-input';
        input.value = this.shortcuts.cycleType || '';
        input.readOnly = true;
        input.placeholder = 'Click to record...';
        input.style.cursor = 'pointer';
        input.style.textAlign = 'center';
        
        input.addEventListener('keydown', (e) => {
            e.preventDefault();
            if (e.key === 'Escape') {
                input.blur();
                return;
            }
            if (e.key === 'Backspace') {
                this.shortcuts.cycleType = '';
                input.value = '';
                return;
            }
            const keys = [];
            if (e.ctrlKey || e.metaKey) keys.push('Ctrl');
            if (e.altKey) keys.push('Alt');
            if (e.shiftKey) keys.push('Shift');
            
            if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                keys.push(e.key.toUpperCase());
            }
            
            // Allow just modifiers (e.g. Ctrl+Shift)
            if (keys.length > 0) {
                const shortcut = keys.join('+');
                this.shortcuts.cycleType = shortcut;
                input.value = shortcut;
            }
        });
        
        inputCell.appendChild(input);
        row.appendChild(labelCell);
        row.appendChild(inputCell);
        globalTable.appendChild(row);
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
