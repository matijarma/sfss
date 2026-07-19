import { IDBHelper } from './IDBHelper.js';
import { reconcileScript, mergeScriptLists } from './StorageLogic.js';
import { generateLineId } from './Utils.js';

export class StorageManager {
    constructor(app) {
        this.app = app;
        this.storageKey = 'sfss_scripts'; // Kept only for key reference if needed
        this.activeScriptKey = 'sfss_active_script_id';
        this.scriptsDB = new IDBHelper('SFSSDB', 'scripts', 3);
        this.pendingSaves = {};
        this.saveDelay = 2000; // 2 seconds debounce for IDB write
    }

    async init() {
        // Migration logic removed as requested.
        let activeScriptId = this.getActiveScriptId();

        // 1. FASTEST: Check if active script is in LocalStorage.
        // If so, return immediately to allow app to boot without waiting for IDB.
        if (activeScriptId && localStorage.getItem(`sfss_autosave_${activeScriptId}`)) {
            return activeScriptId;
        }

        const scripts = await this.getAllScripts();
        
        // If we have an active ID but it's not in the DB, or if no active ID,
        // pick the first one or create a new one.
        if (!activeScriptId || !scripts[activeScriptId]) {
            const scriptIds = Object.keys(scripts);
            if (scriptIds.length > 0) {
                activeScriptId = scriptIds[0];
            } else {
                // No scripts at all? Create a default one
                const newScript = this.createNewScript();
                await this.saveScript(newScript.id, newScript.content);
                activeScriptId = newScript.id;
            }
            this.setActiveScriptId(activeScriptId);
        }
        return activeScriptId;
    }

    // Returns dictionary { [id]: scriptObject } to match old API
    async getAllScripts() {
        try {
            const allScriptsArray = await this.scriptsDB.getAll();
            const scriptsDict = {};
            if (allScriptsArray && Array.isArray(allScriptsArray)) {
                allScriptsArray.forEach(script => {
                    scriptsDict[script.id] = script;
                });
            }

            // Merge in unsaved changes from LocalStorage
            const lsEntries = [];
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sfss_autosave_')) {
                    const id = key.replace('sfss_autosave_', '');
                    try {
                        lsEntries.push({ id, data: JSON.parse(localStorage.getItem(key)) });
                    } catch(e) {}
                }
            });

            return mergeScriptLists(scriptsDict, lsEntries);
        } catch (e) {
            console.error("Error fetching scripts:", e);
            return {};
        }
    }

    async getScript(scriptId) {
        // 1. Check LocalStorage (Fastest / Newest)
        const localRaw = localStorage.getItem(`sfss_autosave_${scriptId}`);
        let localScript = null;
        if (localRaw) {
            try {
                localScript = JSON.parse(localRaw);
            } catch(e) {}
        }

        // 2. Check IDB
        let dbScript = null;
        try {
            dbScript = await this.scriptsDB.get(scriptId);
        } catch(e) {
            console.error("Error reading from IDB", e);
        }

        // 3. Reconcile (pure logic in StorageLogic.js, covered by node tests)
        return reconcileScript(scriptId, localScript, dbScript);
    }

    async saveScript(scriptId, scriptContent) {
        const timestamp = new Date().toISOString();
        
        // 1. Fast Path: Save to LocalStorage immediately
        try {
            const localData = {
                id: scriptId,
                content: scriptContent,
                lastSavedAt: timestamp,
                dirty: true
            };
            localStorage.setItem(`sfss_autosave_${scriptId}`, JSON.stringify(localData));
        } catch (e) {
            console.warn("LocalStorage Error (Quota?):", e);
            // Fallback: Write to IDB immediately if LS fails
             return this._persistToIDB(scriptId, scriptContent, timestamp);
        }

        // 2. Slow Path: Debounce IDB write. Entries keep the content so
        // flushPendingSaves() can persist immediately on unload (#2).
        if (this.pendingSaves[scriptId]) {
            clearTimeout(this.pendingSaves[scriptId].timer);
        }

        const timer = setTimeout(() => {
            delete this.pendingSaves[scriptId];
            this._persistToIDB(scriptId, scriptContent, timestamp);
        }, this.saveDelay);
        this.pendingSaves[scriptId] = { timer, content: scriptContent, timestamp };
    }

    // Persists every debounced write immediately (fire-and-forget: called
    // from pagehide/visibilitychange/takeover where awaiting isn't possible).
    flushPendingSaves() {
        Object.keys(this.pendingSaves).forEach(scriptId => {
            const pending = this.pendingSaves[scriptId];
            clearTimeout(pending.timer);
            delete this.pendingSaves[scriptId];
            this._persistToIDB(scriptId, pending.content, pending.timestamp);
        });
    }

    // Unload-safe save: synchronous LS write plus an immediate
    // (fire-and-forget) IDB persist, skipping the debounce entirely.
    saveScriptSync(scriptId, scriptContent) {
        const timestamp = new Date().toISOString();
        try {
            localStorage.setItem(`sfss_autosave_${scriptId}`, JSON.stringify({
                id: scriptId,
                content: scriptContent,
                lastSavedAt: timestamp,
                dirty: true
            }));
        } catch (e) {
            console.warn("LocalStorage Error (Quota?):", e);
        }
        // Any debounced write for this script is now stale.
        if (this.pendingSaves[scriptId]) {
            clearTimeout(this.pendingSaves[scriptId].timer);
            delete this.pendingSaves[scriptId];
        }
        this._persistToIDB(scriptId, scriptContent, timestamp);
    }

    async _persistToIDB(scriptId, scriptContent, timestamp) {
        try {
            let script = await this.scriptsDB.get(scriptId);
            if (!script) {
                script = {};
                script.createdAt = timestamp || new Date().toISOString();
            }

            script.id = scriptId;
            script.content = scriptContent;
            script.lastSavedAt = timestamp || new Date().toISOString();

            await this.scriptsDB.put(script);
            this._clearPersistFailure();
        } catch (e) {
            console.error("Failed to save script to IDB:", e);
            this._flagPersistFailure(e);
        }
    }

    // Surfaces IDB persist failures on the save-status indicator (#8): a
    // persistent '!' hint plus an explanatory title. Cleared on the next
    // successful persist.
    _flagPersistFailure(e) {
        if (typeof document === 'undefined') return;
        const status = document.getElementById('save-status');
        if (!status) return;
        let hint = status.querySelector('.persist-error-hint');
        if (!hint) {
            hint = document.createElement('span');
            hint.className = 'persist-error-hint';
            hint.textContent = '!';
            hint.style.cssText = 'color:#c62828;font-weight:bold;margin-left:2px;';
            status.appendChild(hint);
        }
        status.title = 'Saving to browser storage failed — download a backup. (' + ((e && e.message) || e) + ')';
        status.style.opacity = '1';
    }

    _clearPersistFailure() {
        if (typeof document === 'undefined') return;
        const status = document.getElementById('save-status');
        if (!status) return;
        const hint = status.querySelector('.persist-error-hint');
        if (hint) {
            hint.remove();
            status.title = '';
        }
    }

    // Deletes image-store entries no script references any more (#5). Runs
    // deferred at boot and after deleteScript; never blocks the caller.
    async sweepOrphanImages(imageDB) {
        if (!imageDB) return 0;
        if (this.app && this.app.tabGuard && this.app.tabGuard.passive) return 0;
        try {
            // Persist any in-memory sceneMeta first so a just-added image is
            // referenced by the stored copy before the sweep reads it.
            if (this.app && this.app.isDirty && this.app.activeScriptId) {
                await this.app.save();
            }
            const scripts = await this.getAllScripts();
            const referenced = new Set();
            Object.values(scripts).forEach(script => {
                const sceneMeta = (script && script.content && script.content.sceneMeta) || {};
                Object.values(sceneMeta).forEach(meta => {
                    ((meta && meta.images) || []).forEach(id => referenced.add(id));
                });
            });
            const keys = await imageDB.getAllKeys();
            let removed = 0;
            for (const key of keys) {
                if (!referenced.has(key)) {
                    await imageDB.delete(key);
                    removed++;
                }
            }
            return removed;
        } catch (e) {
            console.error('Orphan-image sweep failed:', e);
            return 0;
        }
    }

    async deleteScript(scriptId) {
        await this.scriptsDB.delete(scriptId);
        localStorage.removeItem(`sfss_autosave_${scriptId}`);

        if (this.pendingSaves[scriptId]) {
            clearTimeout(this.pendingSaves[scriptId].timer);
            delete this.pendingSaves[scriptId];
        }

        let activeId = this.getActiveScriptId();
        let nextId = activeId;

        if (activeId === scriptId) {
            const scripts = await this.getAllScripts();
            const remainingIds = Object.keys(scripts);
            if (remainingIds.length > 0) {
                nextId = remainingIds[0];
            } else {
                const newScript = this.createNewScript();
                await this.saveScript(newScript.id, newScript.content);
                nextId = newScript.id;
            }
            this.setActiveScriptId(nextId);
        }

        // The deleted script's scene images are now orphans; sweep them.
        if (this.app && this.app.sidebarManager && this.app.sidebarManager.imageDB) {
            this.sweepOrphanImages(this.app.sidebarManager.imageDB);
        }
        return nextId;
    }

    createNewScript() {
        // Returns a fresh script structure; callers persist it immediately
        // via saveScript (#7 — no more memory-only "isNew" scripts).
        const newId = `script-${Date.now()}`;
        const date = new Date();
        const dateStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: false }).replace(',', '');
        
        return {
            id: newId,
            createdAt: date.toISOString(),
            lastBackupAt: null,
            lastSavedAt: date.toISOString(),
            content: {
                meta: { title: `Untitled ${dateStr}`, author: '', contact: '' },
                sceneMeta: {},
                blocks: [
                    { type: 'sc-slug', text: 'INT. ', id: generateLineId() }
                ],
                characters: []
            }
        };
    }

    getActiveScriptId() {
        return localStorage.getItem(this.activeScriptKey);
    }

    setActiveScriptId(scriptId) {
        localStorage.setItem(this.activeScriptKey, scriptId);
    }

    async updateBackupTimestamp(scriptId) {
        const script = await this.getScript(scriptId);
        if (script) {
            script.lastBackupAt = new Date().toISOString();
            await this.scriptsDB.put(script);
        }
    }
}