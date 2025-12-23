import { IDBHelper } from './IDBHelper.js';

export class StorageManager {
    constructor(app) {
        this.app = app;
        this.storageKey = 'sfss_scripts'; // Kept only for key reference if needed
        this.activeScriptKey = 'sfss_active_script_id';
        this.scriptsDB = new IDBHelper('SFSSDB', 'scripts', 3);
    }

    async init() {
        // Migration logic removed as requested.
        let activeScriptId = this.getActiveScriptId();
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
            return scriptsDict;
        } catch (e) {
            console.error("Error fetching scripts:", e);
            return {};
        }
    }

    async getScript(scriptId) {
        return await this.scriptsDB.get(scriptId);
    }

    async saveScript(scriptId, scriptContent) {
        try {
            let script = await this.getScript(scriptId);
            if (!script) {
                script = {};
                script.createdAt = new Date().toISOString();
            }
            
            script.id = scriptId;
            script.content = scriptContent;
            script.lastSavedAt = new Date().toISOString();

            await this.scriptsDB.put(script);
        } catch (e) {
            console.error("Failed to save script:", e);
        }
    }

    async deleteScript(scriptId) {
        await this.scriptsDB.delete(scriptId);
        
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
