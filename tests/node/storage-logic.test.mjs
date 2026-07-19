import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileScript, mergeScriptLists, computeBackupWarning } from '../../assets/js-mod/StorageLogic.js';

const T1 = '2026-07-01T10:00:00.000Z';
const T2 = '2026-07-01T11:00:00.000Z';

test('reconcileScript: LS newer wins content, keeps IDB metadata', () => {
    const local = { content: { v: 'local' }, lastSavedAt: T2 };
    const db = { id: 's1', content: { v: 'db' }, lastSavedAt: T1, createdAt: T1, lastBackupAt: T1 };
    const r = reconcileScript('s1', local, db);
    assert.equal(r.content.v, 'local');
    assert.equal(r.lastSavedAt, T2);
    assert.equal(r.createdAt, T1);
    assert.equal(r.lastBackupAt, T1);
});

test('reconcileScript: IDB newer wins outright', () => {
    const local = { content: { v: 'local' }, lastSavedAt: T1 };
    const db = { id: 's1', content: { v: 'db' }, lastSavedAt: T2 };
    assert.equal(reconcileScript('s1', local, db).content.v, 'db');
});

test('reconcileScript: LS-only synthesizes a record', () => {
    const r = reconcileScript('s2', { content: { v: 'x' }, lastSavedAt: T1 }, null);
    assert.equal(r.id, 's2');
    assert.equal(r.createdAt, T1);
    assert.equal(r.lastBackupAt, null);
});

test('reconcileScript: neither returns null', () => {
    assert.equal(reconcileScript('s3', null, null), null);
});

test('mergeScriptLists overlays LS entries by recency', () => {
    const idb = { a: { id: 'a', content: 1, lastSavedAt: T2 }, b: { id: 'b', content: 1, lastSavedAt: T1 } };
    const ls = [
        { id: 'a', data: { content: 2, lastSavedAt: T1 } },  // older, ignored
        { id: 'b', data: { content: 2, lastSavedAt: T2 } },  // newer, wins
        { id: 'c', data: { content: 3, lastSavedAt: T1 } },  // LS-only, added
        { id: 'd', data: null }                               // corrupt, skipped
    ];
    const m = mergeScriptLists(idb, ls);
    assert.equal(m.a.content, 1);
    assert.equal(m.b.content, 2);
    assert.equal(m.c.content, 3);
    assert.equal(m.d, undefined);
});

const NOW = new Date('2026-07-19T12:00:00Z').getTime();
const mkScript = (over = {}) => ({
    lastSavedAt: new Date(NOW - 1000).toISOString(),
    lastBackupAt: null,
    content: {
        meta: { title: 'My Script' },
        blocks: [{ type: 'sc-slug', text: 'INT. HOUSE - DAY' }, { type: 'sc-action', text: 'Stuff.' }]
    },
    ...over
});

test('backup warning: meaningful + never backed up warns', () => {
    const r = computeBackupWarning(mkScript(), NOW);
    assert.equal(r.warn, true);
    assert.match(r.label, /Never backed up/);
});

test('backup warning: pristine new script does not warn', () => {
    const r = computeBackupWarning(mkScript({
        content: { meta: { title: 'Untitled Jul 19 2026 12:00' }, blocks: [{ type: 'sc-slug', text: 'INT. ' }] }
    }), NOW);
    assert.equal(r.warn, false);
});

test('backup warning: edited >30min after backup warns', () => {
    const r = computeBackupWarning(mkScript({
        lastBackupAt: new Date(NOW - 2 * 3600 * 1000).toISOString(),
        lastSavedAt: new Date(NOW - 1000).toISOString()
    }), NOW);
    assert.equal(r.warn, true);
    assert.match(r.label, /2h/);
});

test('backup warning: freshly backed up does not warn', () => {
    const r = computeBackupWarning(mkScript({
        lastBackupAt: new Date(NOW - 60 * 1000).toISOString(),
        lastSavedAt: new Date(NOW - 120 * 1000).toISOString()
    }), NOW);
    assert.equal(r.warn, false);
});
