import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    PROTOCOL_VERSION, MSG, STATES,
    wrap, isCompatible, isStaleRev, createBatonMachine
} from '../../assets/js-mod/BatonProtocol.js';

const holders = (...machines) => machines.filter(m => m.state === STATES.HOLDING).length;
const effectTypes = (effects) => effects.map(e => e.type);
const sendOf = (effects, msgType) => effects.find(e => e.type === 'send' && e.msg.type === msgType);

// ---------- envelope ----------

test('wrap produces a v2 envelope', () => {
    const msg = wrap(MSG.UPDATE, { rev: 3 });
    assert.deepEqual(msg, { v: PROTOCOL_VERSION, type: MSG.UPDATE, payload: { rev: 3 } });
    assert.equal(msg.v, 2);
});

test('isCompatible accepts v2 and rejects everything else', () => {
    assert.equal(isCompatible(wrap(MSG.PING)), true);
    assert.equal(isCompatible({ v: 1, type: 'UPDATE', payload: {} }), false);   // explicit v1
    assert.equal(isCompatible({ type: 'GRANT_BATON', payload: {} }), false);    // unversioned legacy
    assert.equal(isCompatible({ v: 3, type: 'UPDATE' }), false);                // future version
    assert.equal(isCompatible({ v: 2 }), false);                                // missing type
    assert.equal(isCompatible(null), false);
    assert.equal(isCompatible(undefined), false);
});

test('isStaleRev drops <= revisions, never non-numeric ones', () => {
    assert.equal(isStaleRev(3, 3), true);    // duplicate
    assert.equal(isStaleRev(2, 3), true);    // late arrival
    assert.equal(isStaleRev(4, 3), false);   // fresh
    assert.equal(isStaleRev(undefined, 3), false); // fail open
    assert.equal(isStaleRev(3, undefined), false);
});

// ---------- reducer: happy pass ----------

test('happy pass: HOLDING -> OFFERING -> NONE, lock BEFORE send', () => {
    const a = createBatonMachine(STATES.HOLDING);
    const b = createBatonMachine(STATES.NONE);

    // A offers
    const r1 = a.reduce({ type: 'OFFER_SENT', grantId: 'g1' });
    assert.equal(r1.state, STATES.OFFERING);
    const types1 = effectTypes(r1.effects);
    assert.ok(types1.indexOf('lockEditor') !== -1, 'offer must lock the editor');
    assert.ok(types1.indexOf('lockEditor') < types1.indexOf('send'), 'lock must precede send (#27)');
    assert.ok(sendOf(r1.effects, MSG.BATON_OFFER), 'offer message sent');
    assert.equal(sendOf(r1.effects, MSG.BATON_OFFER).msg.grantId, 'g1');
    assert.ok(types1.includes('startTimer'), 'offer arms the timeout');

    // B receives the offer (grantee accept)
    const r2 = b.reduce({ type: 'OFFER_RECEIVED', grantId: 'g1' });
    assert.equal(r2.state, STATES.HOLDING);
    const types2 = effectTypes(r2.effects);
    assert.ok(sendOf(r2.effects, MSG.BATON_ACCEPT), 'grantee sends BATON_ACCEPT');
    assert.ok(types2.includes('applySnapshot'), 'grantee applies the offered snapshot');
    assert.ok(types2.indexOf('applySnapshot') < types2.indexOf('unlockEditor'),
        'snapshot lands before the editor unlocks');

    // A receives the accept
    const r3 = a.reduce({ type: 'ACCEPT_RECEIVED', grantId: 'g1' });
    assert.equal(r3.state, STATES.NONE);
    assert.ok(effectTypes(r3.effects).includes('clearTimer'));

    assert.equal(holders(a, b), 1, 'terminal: exactly one holder');
});

// ---------- reducer: timeout revert ----------

test('offer timeout: OFFERING -> HOLDING with revoke + unlock', () => {
    const a = createBatonMachine(STATES.HOLDING);
    a.reduce({ type: 'OFFER_SENT', grantId: 'g1' });

    const r = a.reduce({ type: 'OFFER_TIMEOUT', grantId: 'g1' });
    assert.equal(r.state, STATES.HOLDING);
    const revoke = sendOf(r.effects, MSG.BATON_REVOKE);
    assert.ok(revoke, 'timeout broadcasts BATON_REVOKE');
    assert.equal(revoke.msg.grantId, 'g1');
    assert.ok(effectTypes(r.effects).includes('unlockEditor'), 'holder retakes and unlocks');
    const toastEff = r.effects.find(e => e.type === 'toast');
    assert.ok(toastEff && /still have control/i.test(toastEff.text));
});

// ---------- reducer: decline ----------

test('decline (mobile grantee): OFFERING -> HOLDING', () => {
    const a = createBatonMachine(STATES.HOLDING);
    a.reduce({ type: 'OFFER_SENT', grantId: 'g1' });

    const r = a.reduce({ type: 'DECLINE_RECEIVED', grantId: 'g1', reason: 'mobile' });
    assert.equal(r.state, STATES.HOLDING);
    const types = effectTypes(r.effects);
    assert.ok(types.includes('clearTimer'));
    assert.ok(types.includes('unlockEditor'));
    const toastEff = r.effects.find(e => e.type === 'toast');
    assert.ok(toastEff && /mobile/i.test(toastEff.text), 'mobile reason surfaces in the toast');
});

// ---------- reducer: grantee accept in isolation ----------

test('grantee accept: NONE -> HOLDING via OFFER_RECEIVED', () => {
    const b = createBatonMachine(STATES.NONE);
    const r = b.reduce({ type: 'OFFER_RECEIVED', grantId: 'g9' });
    assert.equal(r.state, STATES.HOLDING);
    const accept = sendOf(r.effects, MSG.BATON_ACCEPT);
    assert.ok(accept && accept.msg.grantId === 'g9');
    assert.ok(effectTypes(r.effects).includes('unlockEditor'));
});

// ---------- reducer: revoke-after-accept convergence ----------

test('revoke after accept (lost ACCEPT): both sides converge to one holder', () => {
    const a = createBatonMachine(STATES.HOLDING);
    const b = createBatonMachine(STATES.NONE);

    a.reduce({ type: 'OFFER_SENT', grantId: 'g1' });
    b.reduce({ type: 'OFFER_RECEIVED', grantId: 'g1' });     // B accepted, ACCEPT lost in flight
    assert.equal(holders(a, b), 1);                          // transitional: B holds, A offering

    a.reduce({ type: 'OFFER_TIMEOUT', grantId: 'g1' });      // A retakes + revokes
    assert.equal(a.state, STATES.HOLDING);

    const rb = b.reduce({ type: 'REVOKE_RECEIVED', grantId: 'g1' }); // revoke reaches B
    assert.equal(rb.state, STATES.NONE);
    assert.ok(effectTypes(rb.effects).includes('lockEditor'), 'revoked grantee locks itself');

    // The late ACCEPT finally arrives at A — stale, ignored.
    const ra = a.reduce({ type: 'ACCEPT_RECEIVED', grantId: 'g1' });
    assert.equal(ra.state, STATES.HOLDING);
    assert.deepEqual(ra.effects, []);

    assert.equal(holders(a, b), 1, 'terminal: exactly one holder');
});

test('exactly one holder in every terminal state (enumerated pairs)', () => {
    // 1. Happy pass -> (NONE, HOLDING)
    {
        const a = createBatonMachine(STATES.HOLDING), b = createBatonMachine(STATES.NONE);
        a.reduce({ type: 'OFFER_SENT', grantId: 'g' });
        b.reduce({ type: 'OFFER_RECEIVED', grantId: 'g' });
        a.reduce({ type: 'ACCEPT_RECEIVED', grantId: 'g' });
        assert.deepEqual([a.state, b.state], [STATES.NONE, STATES.HOLDING]);
        assert.equal(holders(a, b), 1);
    }
    // 2. Decline -> (HOLDING, NONE)
    {
        const a = createBatonMachine(STATES.HOLDING), b = createBatonMachine(STATES.NONE);
        a.reduce({ type: 'OFFER_SENT', grantId: 'g' });
        // B is mobile: manager declines without reducing, B stays NONE.
        a.reduce({ type: 'DECLINE_RECEIVED', grantId: 'g', reason: 'mobile' });
        assert.deepEqual([a.state, b.state], [STATES.HOLDING, STATES.NONE]);
        assert.equal(holders(a, b), 1);
    }
    // 3. Timeout, offer never arrived -> (HOLDING, NONE)
    {
        const a = createBatonMachine(STATES.HOLDING), b = createBatonMachine(STATES.NONE);
        a.reduce({ type: 'OFFER_SENT', grantId: 'g' });
        a.reduce({ type: 'OFFER_TIMEOUT', grantId: 'g' });
        assert.deepEqual([a.state, b.state], [STATES.HOLDING, STATES.NONE]);
        assert.equal(holders(a, b), 1);
    }
    // 4. Timeout with lost ACCEPT, revoke lands -> (HOLDING, NONE)
    {
        const a = createBatonMachine(STATES.HOLDING), b = createBatonMachine(STATES.NONE);
        a.reduce({ type: 'OFFER_SENT', grantId: 'g' });
        b.reduce({ type: 'OFFER_RECEIVED', grantId: 'g' });
        a.reduce({ type: 'OFFER_TIMEOUT', grantId: 'g' });
        b.reduce({ type: 'REVOKE_RECEIVED', grantId: 'g' });
        assert.deepEqual([a.state, b.state], [STATES.HOLDING, STATES.NONE]);
        assert.equal(holders(a, b), 1);
    }
    // 5. Survivor takeover -> (—, HOLDING)
    {
        const b = createBatonMachine(STATES.NONE);
        b.reduce({ type: 'FORCE_TAKE' });
        assert.equal(b.state, STATES.HOLDING);
        assert.equal(holders(b), 1);
    }
});

// ---------- reducer: stale grantIds ----------

test('stale grantIds are ignored in every state', () => {
    const a = createBatonMachine(STATES.HOLDING);
    a.reduce({ type: 'OFFER_SENT', grantId: 'g1' });

    for (const type of ['ACCEPT_RECEIVED', 'DECLINE_RECEIVED', 'OFFER_TIMEOUT']) {
        const r = a.reduce({ type, grantId: 'g-stale' });
        assert.equal(r.state, STATES.OFFERING, `${type} with wrong grantId must not transition`);
        assert.deepEqual(r.effects, []);
    }

    // Grantee side: revoke for a grant we never accepted.
    const b = createBatonMachine(STATES.NONE);
    b.reduce({ type: 'OFFER_RECEIVED', grantId: 'g1' });
    const r = b.reduce({ type: 'REVOKE_RECEIVED', grantId: 'g2' });
    assert.equal(r.state, STATES.HOLDING, 'mismatched revoke ignored');
    assert.deepEqual(r.effects, []);

    // Original holder can still take an accept for the real grant.
    const r2 = a.reduce({ type: 'ACCEPT_RECEIVED', grantId: 'g1' });
    assert.equal(r2.state, STATES.NONE);
});

// ---------- reducer: FORCE_TAKE / RELEASE / edge transitions ----------

test('FORCE_TAKE from NONE takes and unlocks; from HOLDING is a no-op', () => {
    const m = createBatonMachine(STATES.NONE);
    const r = m.reduce({ type: 'FORCE_TAKE' });
    assert.equal(r.state, STATES.HOLDING);
    assert.ok(effectTypes(r.effects).includes('unlockEditor'));

    const r2 = m.reduce({ type: 'FORCE_TAKE' });
    assert.equal(r2.state, STATES.HOLDING);
    assert.deepEqual(r2.effects, []);
});

test('FORCE_TAKE from OFFERING clears the pending offer', () => {
    const m = createBatonMachine(STATES.HOLDING);
    m.reduce({ type: 'OFFER_SENT', grantId: 'g1' });
    const r = m.reduce({ type: 'FORCE_TAKE' });
    assert.equal(r.state, STATES.HOLDING);
    assert.ok(effectTypes(r.effects).includes('clearTimer'));
    // The now-cancelled offer's accept must be stale.
    const r2 = m.reduce({ type: 'ACCEPT_RECEIVED', grantId: 'g1' });
    assert.equal(r2.state, STATES.HOLDING);
    assert.deepEqual(r2.effects, []);
});

test('RELEASE from HOLDING locks; from NONE is a no-op', () => {
    const m = createBatonMachine(STATES.HOLDING);
    const r = m.reduce({ type: 'RELEASE' });
    assert.equal(r.state, STATES.NONE);
    assert.ok(effectTypes(r.effects).includes('lockEditor'));

    const r2 = m.reduce({ type: 'RELEASE' });
    assert.equal(r2.state, STATES.NONE);
    assert.deepEqual(r2.effects, []);
});

test('OFFER_RECEIVED while HOLDING accepts without touching the editor (conflict guard)', () => {
    const m = createBatonMachine(STATES.HOLDING);
    const r = m.reduce({ type: 'OFFER_RECEIVED', grantId: 'gx' });
    assert.equal(r.state, STATES.HOLDING);
    assert.ok(sendOf(r.effects, MSG.BATON_ACCEPT), 'accept converges the remote to NONE');
    assert.ok(!effectTypes(r.effects).includes('unlockEditor'));
    assert.ok(!effectTypes(r.effects).includes('lockEditor'));
});

test('unknown events are ignored', () => {
    const m = createBatonMachine(STATES.HOLDING);
    const r = m.reduce({ type: 'NOT_A_REAL_EVENT' });
    assert.equal(r.state, STATES.HOLDING);
    assert.deepEqual(r.effects, []);
});
