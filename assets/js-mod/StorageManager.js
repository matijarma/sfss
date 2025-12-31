import { IDBHelper } from './IDBHelper.js';

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
                delete newScript.isNew;
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
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sfss_autosave_')) {
                    const id = key.replace('sfss_autosave_', '');
                    try {
                        const localData = JSON.parse(localStorage.getItem(key));
                        // If IDB has it, merge if newer. If not, add it.
                        if (scriptsDict[id]) {
                            if (new Date(localData.lastSavedAt) > new Date(scriptsDict[id].lastSavedAt)) {
                                scriptsDict[id].content = localData.content;
                                scriptsDict[id].lastSavedAt = localData.lastSavedAt;
                            }
                        } else {
                            // Only in LS
                            scriptsDict[id] = {
                                id: id,
                                content: localData.content,
                                lastSavedAt: localData.lastSavedAt,
                                createdAt: localData.lastSavedAt, // Estimate
                                lastBackupAt: null
                            };
                        }
                    } catch(e) {}
                }
            });

            return scriptsDict;
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

        // 3. Reconcile
        if (localScript && dbScript) {
            // If LocalStorage is newer, use its content but keep IDB metadata
            if (new Date(localScript.lastSavedAt) > new Date(dbScript.lastSavedAt)) {
                return {
                    ...dbScript,
                    content: localScript.content,
                    lastSavedAt: localScript.lastSavedAt
                };
            }
            return dbScript;
        }

        // If only in LS
        if (localScript) {
             return {
                id: scriptId,
                content: localScript.content,
                lastSavedAt: localScript.lastSavedAt,
                createdAt: localScript.lastSavedAt, // Estimate
                lastBackupAt: null
            };
        }

        return dbScript;
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

        // 2. Slow Path: Debounce IDB write
        if (this.pendingSaves[scriptId]) {
            clearTimeout(this.pendingSaves[scriptId]);
        }

        this.pendingSaves[scriptId] = setTimeout(() => {
            this._persistToIDB(scriptId, scriptContent, timestamp);
            delete this.pendingSaves[scriptId];
        }, this.saveDelay);
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
        } catch (e) {
            console.error("Failed to save script to IDB:", e);
        }
    }

    async deleteScript(scriptId) {
        await this.scriptsDB.delete(scriptId);
        localStorage.removeItem(`sfss_autosave_${scriptId}`);
        
        if (this.pendingSaves[scriptId]) {
            clearTimeout(this.pendingSaves[scriptId]);
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
                delete newScript.isNew;
                await this.saveScript(newScript.id, newScript.content);
                nextId = newScript.id;
            }
            this.setActiveScriptId(nextId);
        }
        return nextId;
    }

    createNewScript() {
        // Do not save to DB yet. Just return a structure.
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
                    { type: 'sc-slug', text: 'INT. ', id: `line-${Math.random().toString(36).substring(2, 11)}` }
                ],
                characters: []
            },
            isNew: true
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