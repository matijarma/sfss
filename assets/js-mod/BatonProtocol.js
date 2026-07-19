// Collaboration protocol v2 — pure, Node-testable core (no trystero, no DOM).
//
// Two pieces live here:
//   1. The versioned message envelope ({ v, type, payload }) with helpers.
//   2. The baton state machine — a pure reducer that decides how write access
//      moves between peers. The reducer never touches the editor or network;
//      it returns declarative effects that CollaborationManager executes.
//
// Baton contract (#27): the offering side locks itself BEFORE the offer is
// sent, and the snapshot travels WITH the offer. In every terminal state of
// every exchange exactly ONE side holds the baton.

export const PROTOCOL_VERSION = 2;

// Message types
export const MSG = Object.freeze({
    HELLO: 'HELLO',
    SYNC_FULL: 'SYNC_FULL',
    SYNC_REQUEST: 'SYNC_REQUEST',
    UPDATE: 'UPDATE',
    BATON_OFFER: 'BATON_OFFER',
    BATON_ACCEPT: 'BATON_ACCEPT',
    BATON_DECLINE: 'BATON_DECLINE',
    BATON_REVOKE: 'BATON_REVOKE',
    SESSION_END: 'SESSION_END',
    PING: 'PING',
    MEDIA_STATE: 'MEDIA_STATE'
});

// Baton states
export const STATES = Object.freeze({
    HOLDING: 'HOLDING',    // this side may write
    OFFERING: 'OFFERING',  // this side locked itself and offered the baton
    NONE: 'NONE'           // this side is a reader
});

export function wrap(type, payload = {}) {
    return { v: PROTOCOL_VERSION, type, payload };
}

export function isCompatible(msg) {
    return !!msg && msg.v === PROTOCOL_VERSION && typeof msg.type === 'string';
}

// Readers track the last applied revision and drop anything at or below it,
// so a late/duplicate UPDATE or SYNC_FULL can never roll the script back.
// Non-numeric revs are never treated as stale (fail open, apply).
export function isStaleRev(rev, lastAppliedRev) {
    return typeof rev === 'number' && typeof lastAppliedRev === 'number' && rev <= lastAppliedRev;
}

// createBatonMachine(initial) -> { state, reduce(event) }
//
// Events (grantIds tie responses to a specific offer; stale ones are ignored):
//   holder side:  OFFER_SENT{grantId}  ACCEPT_RECEIVED{grantId}
//                 DECLINE_RECEIVED{grantId,reason}  OFFER_TIMEOUT{grantId}
//   grantee side: OFFER_RECEIVED{grantId}  REVOKE_RECEIVED{grantId}
//   either side:  FORCE_TAKE  RELEASE
//
// reduce(event) -> { state, effects: [] } where effects are declarative:
//   {type:'lockEditor'} {type:'unlockEditor'} {type:'applySnapshot'}
//   {type:'send', msg:{type, grantId, reason?}} {type:'startTimer', grantId}
//   {type:'clearTimer'} {type:'toast', text}
export function createBatonMachine(initial = STATES.NONE) {
    let state = initial;
    let pendingGrantId = null; // offer we sent that is still in flight
    let heldGrantId = null;    // grant we accepted (for revoke matching)

    const ignore = () => ({ state, effects: [] });

    function reduce(event) {
        let effects = [];

        switch (event.type) {
            case 'OFFER_SENT':
                if (state !== STATES.HOLDING) return ignore();
                state = STATES.OFFERING;
                pendingGrantId = event.grantId;
                // #27: lock BEFORE the offer leaves this side.
                effects = [
                    { type: 'lockEditor' },
                    { type: 'send', msg: { type: MSG.BATON_OFFER, grantId: event.grantId } },
                    { type: 'startTimer', grantId: event.grantId }
                ];
                break;

            case 'ACCEPT_RECEIVED':
                if (state !== STATES.OFFERING || event.grantId !== pendingGrantId) return ignore();
                state = STATES.NONE;
                pendingGrantId = null;
                effects = [
                    { type: 'clearTimer' },
                    { type: 'toast', text: 'Baton passed — your collaborator has control.' }
                ];
                break;

            case 'DECLINE_RECEIVED':
                if (state !== STATES.OFFERING || event.grantId !== pendingGrantId) return ignore();
                state = STATES.HOLDING;
                pendingGrantId = null;
                effects = [
                    { type: 'clearTimer' },
                    { type: 'unlockEditor' },
                    {
                        type: 'toast',
                        text: event.reason === 'mobile'
                            ? "Your collaborator is on mobile and can't take the baton — you keep control."
                            : 'Transfer declined — you still have control.'
                    }
                ];
                break;

            case 'OFFER_TIMEOUT':
                if (state !== STATES.OFFERING || event.grantId !== pendingGrantId) return ignore();
                state = STATES.HOLDING;
                pendingGrantId = null;
                effects = [
                    { type: 'clearTimer' },
                    { type: 'send', msg: { type: MSG.BATON_REVOKE, grantId: event.grantId } },
                    { type: 'unlockEditor' },
                    { type: 'toast', text: 'Transfer failed — you still have control.' }
                ];
                break;

            case 'OFFER_RECEIVED':
                if (state === STATES.NONE) {
                    state = STATES.HOLDING;
                    heldGrantId = event.grantId;
                    effects = [
                        { type: 'applySnapshot' },
                        { type: 'unlockEditor' },
                        { type: 'send', msg: { type: MSG.BATON_ACCEPT, grantId: event.grantId } },
                        { type: 'toast', text: 'You have the baton!' }
                    ];
                } else if (state === STATES.HOLDING) {
                    // Conflict guard: the remote offered while we already hold.
                    // The offering side locked itself first, so accepting keeps
                    // exactly one holder (us) without touching our editor.
                    effects = [{ type: 'send', msg: { type: MSG.BATON_ACCEPT, grantId: event.grantId } }];
                } else {
                    // OFFERING: impossible in a healthy session (only a holder
                    // can offer). Decline and let our own offer resolve.
                    effects = [{ type: 'send', msg: { type: MSG.BATON_DECLINE, grantId: event.grantId, reason: 'busy' } }];
                }
                break;

            case 'REVOKE_RECEIVED':
                if (state !== STATES.HOLDING || event.grantId !== heldGrantId || heldGrantId === null) return ignore();
                state = STATES.NONE;
                heldGrantId = null;
                effects = [
                    { type: 'lockEditor' },
                    { type: 'toast', text: 'The transfer was revoked — you are a reader again.' }
                ];
                break;

            case 'FORCE_TAKE':
                if (state === STATES.HOLDING) return ignore();
                effects = state === STATES.OFFERING
                    ? [{ type: 'clearTimer' }, { type: 'unlockEditor' }]
                    : [{ type: 'unlockEditor' }];
                state = STATES.HOLDING;
                pendingGrantId = null;
                heldGrantId = null;
                break;

            case 'RELEASE':
                if (state === STATES.NONE) return ignore();
                effects = state === STATES.OFFERING
                    ? [{ type: 'clearTimer' }]          // already locked at OFFER_SENT
                    : [{ type: 'lockEditor' }];
                state = STATES.NONE;
                pendingGrantId = null;
                heldGrantId = null;
                break;

            default:
                return ignore();
        }

        return { state, effects };
    }

    return {
        get state() { return state; },
        reduce
    };
}
