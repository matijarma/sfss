// Pure storage-reconciliation logic, extracted from StorageManager so the
// LS-vs-IDB rules are Node-testable. No I/O, no DOM.

// Reconciles the LocalStorage autosave shadow against the IDB record.
// LS is a fast shadow copy: when newer, its content wins but IDB metadata
// (createdAt, lastBackupAt) is kept.
export function reconcileScript(scriptId, localScript, dbScript) {
    if (localScript && dbScript) {
        if (new Date(localScript.lastSavedAt) > new Date(dbScript.lastSavedAt)) {
            return {
                ...dbScript,
                content: localScript.content,
                lastSavedAt: localScript.lastSavedAt
            };
        }
        return dbScript;
    }
    if (localScript) {
        return {
            id: scriptId,
            content: localScript.content,
            lastSavedAt: localScript.lastSavedAt,
            createdAt: localScript.lastSavedAt, // Estimate
            lastBackupAt: null
        };
    }
    return dbScript || null;
}

// Overlays LS autosave entries onto the IDB dictionary (same rules as
// reconcileScript, applied list-wide). lsEntries: [{ id, data }].
export function mergeScriptLists(idbDict, lsEntries) {
    const merged = { ...idbDict };
    for (const entry of lsEntries) {
        if (!entry || !entry.data) continue;
        const { id, data } = entry;
        if (merged[id]) {
            if (new Date(data.lastSavedAt) > new Date(merged[id].lastSavedAt)) {
                merged[id] = {
                    ...merged[id],
                    content: data.content,
                    lastSavedAt: data.lastSavedAt
                };
            }
        } else {
            merged[id] = {
                id,
                content: data.content,
                lastSavedAt: data.lastSavedAt,
                createdAt: data.lastSavedAt, // Estimate
                lastBackupAt: null
            };
        }
    }
    return merged;
}

// Save-time sceneMeta pruning (#5): a key survives when its scene exists in
// the live document OR in ANY undo-history entry (history-aware so undo can
// still restore a deleted scene together with its meta). History entries are
// { data: { blocks, sceneMeta }, caret }. History sceneMeta objects that
// alias the live object are ignored — counting their keys would make pruning
// a permanent no-op. Returns the input object unchanged (same reference)
// when nothing needs pruning.
export function pruneSceneMeta(sceneMeta, liveBlockIds, historyEntries = []) {
    if (!sceneMeta) return sceneMeta;
    const keep = new Set(liveBlockIds || []);
    for (const entry of historyEntries) {
        const data = entry && entry.data;
        if (!data) continue;
        (data.blocks || []).forEach(b => { if (b && b.id) keep.add(b.id); });
        if (data.sceneMeta && data.sceneMeta !== sceneMeta) {
            Object.keys(data.sceneMeta).forEach(k => keep.add(k));
        }
    }
    const keys = Object.keys(sceneMeta);
    if (keys.every(k => keep.has(k))) return sceneMeta;
    const pruned = {};
    keys.forEach(k => { if (keep.has(k)) pruned[k] = sceneMeta[k]; });
    return pruned;
}

const BACKUP_STALE_MS = 30 * 60 * 1000;

function timeAgoLabel(ms) {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
}

// Backup-reminder rule: warn when the script has meaningful content AND it
// was never exported, or has been edited more than 30 minutes past the last
// export. Returns { warn, label }.
export function computeBackupWarning(script, now = Date.now()) {
    if (!script || !script.content) return { warn: false, label: '' };
    const blocks = script.content.blocks || [];
    const title = (script.content.meta && script.content.meta.title) || '';
    const meaningful =
        blocks.length > 1 ||
        (blocks[0] && (blocks[0].text || '').trim() !== 'INT.') ||
        !/^Untitled/.test(title);
    if (!meaningful) return { warn: false, label: '' };

    const lastSaved = script.lastSavedAt ? new Date(script.lastSavedAt).getTime() : null;
    if (lastSaved === null) return { warn: false, label: '' };

    if (!script.lastBackupAt) {
        return { warn: true, label: 'Never backed up — use Backup/Download' };
    }
    const lastBackup = new Date(script.lastBackupAt).getTime();
    if (lastSaved - lastBackup > BACKUP_STALE_MS) {
        return { warn: true, label: `Not backed up since ${timeAgoLabel(now - lastBackup)} ago` };
    }
    return { warn: false, label: '' };
}
