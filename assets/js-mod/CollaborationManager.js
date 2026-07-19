import { joinRoom, selfId } from '../trystero.min.js';
import { MSG, STATES, wrap, isCompatible, isStaleRev, createBatonMachine } from './BatonProtocol.js';

// Collaboration protocol v2. Every message travels in a versioned envelope
// ({ v: 2, type, payload }); incompatible versions are ignored with a toast
// (except SESSION_END, which is always honored). Write access moves via the
// BatonProtocol state machine: the holder flushes + locks itself BEFORE the
// offer leaves (#27), the snapshot rides on the offer itself, and a 4s
// timeout revokes and retakes. A monotonic rev counter on UPDATE / SYNC_FULL /
// BATON_OFFER lets readers drop stale payloads.
export class CollaborationManager {
    constructor(app) {
        this.app = app;
        this.room = null;
        this.roomId = null;
        this.peers = {};
        this.isHost = false;
        this.hasBaton = false;
        this.myPeerId = null;

        // Config
        this.APP_ID = 'sfss-collab-v1';
        this.PING_INTERVAL = 2000;
        // Zombie cleanup only — background-tab timer throttling makes short
        // thresholds report false deaths. trystero's onPeerLeave is the
        // primary disconnect signal.
        this.TIMEOUT_THRESHOLD = 90000;
        this.OFFER_TIMEOUT_MS = 4000;
        this.EMPTY_ROOM_GRACE_MS = 60000;

        // Protocol state
        this.baton = null;            // BatonProtocol machine (per session)
        this.pendingOffer = null;     // { grantId, snapshot, activeLineId, rev, targetPeer }
        this.offerTimer = null;
        this.rev = 0;                 // monotonic revision we author
        this.lastAppliedRev = 0;      // highest revision applied as a reader
        this.emptyRoomTimer = null;
        this.dismissWaitingToast = null;
        this.hadPeer = false;         // at least one peer joined this session
        this.lastSentAt = 0;

        // Rejoin affordance (survives disconnect; CollabUI reads these)
        this.lastRoomId = null;
        this.wasHost = false;

        // Channels
        this.dataChannel = null;
        this.localStream = null;

        this.heartbeatInterval = null;
        this.onBatonStatusChange = null;
        this.onPeerJoin = null;
        this.onPeerLeave = null;
        this.onDisconnect = null;
        this.onRemoteStream = null;

        this._versionWarned = {};

        // #28: leaving the page while holding the baton must not strand the
        // reader on a stale script. Registered here (not in SFSS) so the
        // listener lives and dies with the collab feature module.
        window.addEventListener('pagehide', () => {
            if (this.room && this.hasBaton) this.flushAndBroadcast();
        });
    }

    log(msg, type) {
        if (this.app.collabUI) this.app.collabUI.log(msg, type);
        else console.log(`[CollabManager] ${msg}`);
    }

    connect(roomId, isHost) {
        // #29 defense in depth: mobile clients follow along as readers; the
        // primary block (with user-facing toast) lives in CollabUI.
        if (isHost && document.body.classList.contains('mobile-view')) {
            this.log('Hosting is not supported on mobile devices.', 'error');
            return false;
        }

        this.log(`Initiating connection sequence for Room: ${roomId}...`, 'info');
        if (this.room) {
            this.disconnect();
        }

        this.roomId = roomId;
        this.isHost = isHost;
        this.lastRoomId = roomId;
        this.wasHost = isHost;
        this.hasBaton = isHost;
        this.baton = createBatonMachine(isHost ? STATES.HOLDING : STATES.NONE);
        this.rev = 0;
        this.lastAppliedRev = 0;
        this.hadPeer = false;
        this._versionWarned = {};

        try {
            this.room = joinRoom({ appId: this.APP_ID }, roomId);

            const [sendData, getData] = this.room.makeAction('data');
            this.sendDataRaw = sendData;
            getData(this.handleData.bind(this));
            this.log('Private communication channel established.', 'success');

            this.room.onPeerJoin(peerId => {
                this.handlePeerJoin(peerId);
            });
            this.room.onPeerLeave(peerId => {
                this.handlePeerLeave(peerId);
            });

            this.room.onPeerStream((stream, peerId) => {
                if (this.onRemoteStream) this.onRemoteStream(stream, peerId);
            });

            this.startHeartbeat();

            if (this.onBatonStatusChange) {
                this.onBatonStatusChange(this.hasBaton);
            }

            if (!this.hasBaton) {
                this.log('Guest Mode: You are a reader. Editor is locked until the baton is passed to you.', 'info');
                this.app.editorHandler.toggleReadOnly(true);
            } else {
                this.log('Host Mode: You have the baton and can write.', 'success');
            }

            document.body.classList.add('is-collaborating');

            return true;
        } catch (e) {
            this.log(`Critical Connection Error: ${e.message}`, 'error');
            console.error(e);
            return false;
        }
    }

    disconnect() {
        this._cancelEmptyRoomGrace();
        clearTimeout(this.offerTimer);
        this.offerTimer = null;
        this.pendingOffer = null;

        if (this.room) {
            // #28: deliver the tail of our edits before saying goodbye.
            if (this.hasBaton) this.flushAndBroadcast();
            this.broadcast(wrap(MSG.SESSION_END, { reason: 'User disconnected.' }));

            this.room.leave();
            this.room = null;
        }
        this.sendDataRaw = null;
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
        this.peers = {};
        this.hadPeer = false;
        this.baton = null;
        this.hasBaton = true;

        this.stopMedia();
        this.app.editorHandler.toggleReadOnly(false);

        document.body.classList.remove('is-collaborating');

        if (this.onDisconnect) this.onDisconnect();
        if (this.onBatonStatusChange) this.onBatonStatusChange(true);
    }

    // #28: flush the sub-500ms saveState tail, then broadcast a final UPDATE.
    // saveState(true) skips sendUpdate when content is unchanged, so an
    // explicit sendUpdate guarantees the receiver converges either way.
    flushAndBroadcast() {
        if (!this.room || !this.hasBaton) return;
        clearTimeout(this.app.historyTimeout);
        this.app.saveState(true);
        this.sendUpdate(this.app.exportToJSONStructure());
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

        this.heartbeatInterval = setInterval(() => {
            // Any recent message already proved liveness — skip the PING.
            if (Date.now() - this.lastSentAt >= this.PING_INTERVAL) {
                this.broadcast(wrap(MSG.PING));
            }

            const now = Date.now();
            for (const [peerId, meta] of Object.entries(this.peers)) {
                if (now - meta.lastPing > this.TIMEOUT_THRESHOLD) {
                    this.log(`Peer connection timed out: ${peerId}`, 'warn');
                    this.handlePeerLeave(peerId);
                }
            }
        }, this.PING_INTERVAL);
    }

    broadcast(msg) {
        if (!this.sendDataRaw) return;
        this.lastSentAt = Date.now();
        this.sendDataRaw(msg);
    }

    sendTo(peerId, msg) {
        if (!this.sendDataRaw) return;
        this.lastSentAt = Date.now();
        this.sendDataRaw(msg, peerId);
    }

    handlePeerJoin(peerId) {
        this.peers[peerId] = { lastPing: Date.now(), meta: {} };
        this.hadPeer = true;
        this._cancelEmptyRoomGrace(true);

        if (this.onPeerJoin) this.onPeerJoin(peerId);

        const isMobile = document.body.classList.contains('mobile-view');
        this.sendTo(peerId, wrap(MSG.HELLO, { isMobile, hasBaton: this.hasBaton, rev: this.rev }));

        // Joiners/rejoiners pull the current script; whoever holds answers.
        if (!this.hasBaton) {
            this.sendTo(peerId, wrap(MSG.SYNC_REQUEST, { rev: this.lastAppliedRev }));
        }

        // Fix: Ensure video/audio is sent to the new peer
        if (this.localStream) {
            this.log('Negotiating video/audio stream with new collaborator...', 'system');
            this.room.addStream(this.localStream, peerId);
        }
    }

    handlePeerLeave(peerId) {
        delete this.peers[peerId];

        // Empty-room grace: don't kill the session on a refresh or a network
        // blip — wait for the peer to come back before giving up.
        if (Object.keys(this.peers).length === 0 && this.hadPeer && this.room) {
            this._startEmptyRoomGrace();
        }

        if (this.onPeerLeave) this.onPeerLeave(peerId);
    }

    _startEmptyRoomGrace() {
        if (this.emptyRoomTimer) return;
        this.log(`All peers disconnected. Waiting ${this.EMPTY_ROOM_GRACE_MS / 1000}s for reconnection...`, 'warn');

        if (this.app.collabUI && this.app.collabUI.showActionToast) {
            this.dismissWaitingToast = this.app.collabUI.showActionToast(
                'Peer disconnected — waiting for reconnection…', 'Leave', () => this.disconnect());
        } else if (this.app.collabUI) {
            this.app.collabUI.showToast('Peer disconnected — waiting for reconnection…');
        }

        this.emptyRoomTimer = setTimeout(() => {
            this.emptyRoomTimer = null;
            if (!this.room) return;
            // If the holder vanished while we were reading, take the baton
            // BEFORE disconnecting so the survivor keeps an editable script.
            if (!this.hasBaton && this.baton) {
                this.log('Reconnection window expired. Taking over the baton.', 'warn');
                this._runEffects(this.baton.reduce({ type: 'FORCE_TAKE' }).effects);
            }
            this.disconnect();
            if (this.app.collabUI) {
                this.app.collabUI.showToast('No reconnection — session ended.');
                this.app.collabUI.restoreToolbarItems();
            }
        }, this.EMPTY_ROOM_GRACE_MS);
    }

    _cancelEmptyRoomGrace(rejoined = false) {
        if (this.emptyRoomTimer) {
            clearTimeout(this.emptyRoomTimer);
            this.emptyRoomTimer = null;
            if (rejoined) this.log('Peer reconnected — resuming session.', 'success');
        }
        if (this.dismissWaitingToast) {
            this.dismissWaitingToast();
            this.dismissWaitingToast = null;
        }
    }

    handleData(msg, peerId) {
        if (!this.peers[peerId]) {
            // Zombie-cleaned peer resumed sending — treat it as alive again.
            this.peers[peerId] = { lastPing: Date.now(), meta: {} };
            this._cancelEmptyRoomGrace(true);
        }
        this.peers[peerId].lastPing = Date.now();

        if (!isCompatible(msg)) {
            // SESSION_END is honored regardless of version so a v1 peer
            // leaving still tears the session down cleanly.
            if (msg && msg.type === MSG.SESSION_END) {
                this._handleSessionEnd();
                return;
            }
            if (!this._versionWarned[peerId]) {
                this._versionWarned[peerId] = true;
                this.log(`Ignoring message with incompatible protocol version (v${msg && msg.v ? msg.v : 1}).`, 'error');
                if (this.app.collabUI) {
                    this.app.collabUI.showToast('Collaborator runs a different SFSS version — both sides should reload');
                }
            }
            return;
        }

        const payload = msg.payload || {};

        switch (msg.type) {
            case MSG.PING:
                break;
            case MSG.HELLO:
                this.peers[peerId].meta.isMobile = !!payload.isMobile;
                this.peers[peerId].meta.hasBaton = !!payload.hasBaton;
                if (payload.isMobile) {
                    this.log('Collaborator is on a mobile device. They will be a reader only.', 'info');
                }
                if (typeof payload.rev === 'number') this.rev = Math.max(this.rev, payload.rev);
                if (!payload.hasBaton) this._maybeBreakHolderTie(peerId);
                break;
            case MSG.SYNC_REQUEST:
                if (this.hasBaton) {
                    this.log('Peer requested a full sync. Sending current script...', 'info');
                    // Never answer with a rev the requester would drop.
                    if (typeof payload.rev === 'number') this.rev = Math.max(this.rev, payload.rev);
                    this.sendTo(peerId, wrap(MSG.SYNC_FULL, this._buildSyncPayload()));
                }
                break;
            case MSG.SYNC_FULL:
            case MSG.UPDATE:
                // Only holders broadcast content — keep holder-knowledge fresh
                // so the tie-break can never fire against a live writer.
                this.peers[peerId].meta.hasBaton = true;
                if (this.hasBaton) break;
                if (isStaleRev(payload.rev, this.lastAppliedRev)) break;
                this._applyRemoteSnapshot(payload, msg.type === MSG.UPDATE);
                if (msg.type === MSG.SYNC_FULL) {
                    this.log('Received latest script version from collaborator.', 'success');
                    setTimeout(() => this.app.scrollToActive(), 100);
                }
                break;
            case MSG.BATON_OFFER: {
                // The offering side locked itself before sending (#27).
                this.peers[peerId].meta.hasBaton = false;
                // #29: a reader that got resized into mobile-view must not
                // become the writer — decline, but still apply the snapshot
                // so the mobile reader stays current.
                if (document.body.classList.contains('mobile-view')) {
                    this.sendTo(peerId, wrap(MSG.BATON_DECLINE, { grantId: payload.grantId, reason: 'mobile' }));
                    if (!isStaleRev(payload.rev, this.lastAppliedRev)) {
                        this._applyRemoteSnapshot(payload, false);
                    }
                    break;
                }
                const { effects } = this.baton.reduce({ type: 'OFFER_RECEIVED', grantId: payload.grantId });
                this._runEffects(effects, { peerId, payload });
                break;
            }
            case MSG.BATON_ACCEPT:
                this.peers[peerId].meta.hasBaton = true;   // they took the grant
                this._runEffects(this.baton.reduce({ type: 'ACCEPT_RECEIVED', grantId: payload.grantId }).effects, { peerId });
                break;
            case MSG.BATON_DECLINE:
                this.peers[peerId].meta.hasBaton = false;  // they stayed a reader
                this._runEffects(this.baton.reduce({ type: 'DECLINE_RECEIVED', grantId: payload.grantId, reason: payload.reason }).effects, { peerId });
                break;
            case MSG.BATON_REVOKE:
                this.peers[peerId].meta.hasBaton = true;   // revoker retakes on timeout
                this._runEffects(this.baton.reduce({ type: 'REVOKE_RECEIVED', grantId: payload.grantId }).effects, { peerId });
                break;
            case MSG.SESSION_END:
                this._handleSessionEnd();
                break;
            case MSG.MEDIA_STATE:
                if (this.onPeerMediaChange) {
                    this.onPeerMediaChange(peerId, payload);
                }
                break;
        }
    }

    _handleSessionEnd() {
        this.log('Remote user ended the session.', 'warn');
        this.disconnect();
        if (this.app.collabUI) this.app.collabUI.restoreToolbarItems();
    }

    _applyRemoteSnapshot(payload, animate) {
        if (!payload.snapshot) return;
        if (typeof payload.rev === 'number') {
            this.lastAppliedRev = payload.rev;
            this.rev = Math.max(this.rev, payload.rev);
        }
        this.app.editorHandler.applySnapshot(payload.snapshot, true, animate, payload.activeLineId);
    }

    _buildSyncPayload() {
        const snapshot = this.app.editorHandler.getSnapshot();
        const currentBlock = this.app.editorHandler.getCurrentBlock();
        return {
            snapshot,
            activeLineId: currentBlock ? currentBlock.dataset.lineId : null,
            rev: ++this.rev
        };
    }

    // Deadlock breaker: if a HELLO reveals that neither side holds the baton
    // (e.g. both peers rejoined after a drop), the peer with the smaller id
    // deterministically takes it. Both sides evaluate the same comparison,
    // so exactly one converges to HOLDING.
    _maybeBreakHolderTie(peerId) {
        if (!this.baton || this.baton.state !== STATES.NONE || this.hasBaton) return;
        if (document.body.classList.contains('mobile-view')) return;
        if (Object.values(this.peers).some(p => p.meta.hasBaton)) return;
        if (String(selfId) < String(peerId)) {
            this.log('No one holds the baton — taking control (deterministic tie-break).', 'warn');
            this._runEffects(this.baton.reduce({ type: 'FORCE_TAKE' }).effects);
            if (this.app.collabUI) this.app.collabUI.showToast('You have control.');
            const isMobile = document.body.classList.contains('mobile-view');
            this.broadcast(wrap(MSG.HELLO, { isMobile, hasBaton: true, rev: this.rev }));
        }
    }

    sendUpdate(snapshot) {
        if (!this.hasBaton || !this.room) return;
        const currentBlock = this.app.editorHandler.getCurrentBlock();
        const activeLineId = currentBlock ? currentBlock.dataset.lineId : null;
        this.broadcast(wrap(MSG.UPDATE, { snapshot, activeLineId, rev: ++this.rev }));
    }

    // #27: flush → lock self → offer (snapshot travels WITH the offer, so
    // there is no separate SYNC race and no two-writer window).
    passBaton() {
        if (!this.hasBaton || !this.baton || this.baton.state !== STATES.HOLDING) return;

        const eligiblePeers = Object.keys(this.peers).filter(id => !this.peers[id].meta.isMobile);

        if (eligiblePeers.length === 0) {
            if (Object.keys(this.peers).length === 0) {
                this.log('Cannot pass the baton: No one else is in the session.', 'warn');
            } else {
                this.log('Cannot pass the baton: Your collaborator is on a mobile device and cannot edit.', 'warn');
            }
            return;
        }

        // Flush pending edits so the offered snapshot is the real tail state.
        clearTimeout(this.app.historyTimeout);
        this.app.saveState(true);

        const currentBlock = this.app.editorHandler.getCurrentBlock();
        this.pendingOffer = {
            grantId: `grant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            snapshot: this.app.exportToJSONStructure(),
            activeLineId: currentBlock ? currentBlock.dataset.lineId : null,
            rev: ++this.rev,
            targetPeer: eligiblePeers[0]
        };

        this.log('Passing write access (baton) to collaborator...', 'info');
        const { effects } = this.baton.reduce({ type: 'OFFER_SENT', grantId: this.pendingOffer.grantId });
        this._runEffects(effects, { peerId: this.pendingOffer.targetPeer });
    }

    takeBaton(forced = false) {
        if (this.baton) {
            this._runEffects(this.baton.reduce({ type: 'FORCE_TAKE' }).effects);
        } else {
            this.hasBaton = true;
            this.app.editorHandler.toggleReadOnly(false);
            if (this.onBatonStatusChange) this.onBatonStatusChange(true);
        }
        if (this.app.collabUI) {
            this.app.collabUI.showToast(forced ? 'Remote user disconnected. You have control.' : 'You have the baton!');
        }
        this.app.scrollToActive();
    }

    // Executes the declarative effects returned by the baton reducer.
    _runEffects(effects, ctx = {}) {
        for (const eff of effects) {
            switch (eff.type) {
                case 'lockEditor':
                    this.hasBaton = false;
                    this.app.editorHandler.toggleReadOnly(true);
                    if (this.onBatonStatusChange) this.onBatonStatusChange(false);
                    break;
                case 'unlockEditor':
                    this.hasBaton = true;
                    this.app.editorHandler.toggleReadOnly(false);
                    if (this.onBatonStatusChange) this.onBatonStatusChange(true);
                    this.app.scrollToActive();
                    break;
                case 'applySnapshot':
                    if (ctx.payload) this._applyRemoteSnapshot(ctx.payload, false);
                    break;
                case 'send':
                    this._sendBatonMsg(eff.msg, ctx);
                    break;
                case 'startTimer': {
                    clearTimeout(this.offerTimer);
                    const grantId = eff.grantId;
                    this.offerTimer = setTimeout(() => {
                        this.offerTimer = null;
                        this._runEffects(this.baton.reduce({ type: 'OFFER_TIMEOUT', grantId }).effects);
                    }, this.OFFER_TIMEOUT_MS);
                    break;
                }
                case 'clearTimer':
                    clearTimeout(this.offerTimer);
                    this.offerTimer = null;
                    this.pendingOffer = null;
                    break;
                case 'toast':
                    if (this.app.collabUI) this.app.collabUI.showToast(eff.text);
                    this.log(eff.text, 'info');
                    break;
            }
        }
    }

    _sendBatonMsg(descriptor, ctx = {}) {
        switch (descriptor.type) {
            case MSG.BATON_OFFER: {
                const offer = this.pendingOffer;
                if (!offer || offer.grantId !== descriptor.grantId) return;
                this.sendTo(offer.targetPeer, wrap(MSG.BATON_OFFER, {
                    grantId: offer.grantId,
                    snapshot: offer.snapshot,
                    activeLineId: offer.activeLineId,
                    rev: offer.rev
                }));
                break;
            }
            case MSG.BATON_ACCEPT:
            case MSG.BATON_DECLINE: {
                const out = wrap(descriptor.type, { grantId: descriptor.grantId, reason: descriptor.reason });
                if (ctx.peerId) this.sendTo(ctx.peerId, out);
                else this.broadcast(out);
                break;
            }
            case MSG.BATON_REVOKE:
                this.broadcast(wrap(MSG.BATON_REVOKE, { grantId: descriptor.grantId }));
                break;
        }
    }

    async enableMedia(localVideoEl) {
        if (!this.room) {
            return { error: "Room not initialized" };
        }
        try {
            // Check if we already have a stream
            if (this.localStream) {
                // Re-attach if needed (UI might have cleared srcObject)
                if (localVideoEl && localVideoEl.srcObject !== this.localStream) {
                    localVideoEl.srcObject = this.localStream;
                    localVideoEl.play().catch(e => console.error(e));
                    localVideoEl.muted = true;
                }

                // Ensure video track is enabled (since 'enableMedia' implies turning it on)
                const v = this.localStream.getVideoTracks()[0];
                if (v && !v.enabled) v.enabled = true;

                this.broadcastMediaState();
                return { success: true };
            }

            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (localVideoEl) {
                localVideoEl.srcObject = this.localStream;
                localVideoEl.play().catch(e => console.error(e));
                localVideoEl.muted = true;
            }

            this.room.addStream(this.localStream);

            // Broadcast initial state
            this.broadcastMediaState();

            return { success: true };
        } catch (e) {
            return { error: e.name, message: e.message };
        }
    }

    broadcastMediaState() {
        if (!this.localStream) return;
        const v = this.localStream.getVideoTracks()[0];
        const a = this.localStream.getAudioTracks()[0];

        this.broadcast(wrap(MSG.MEDIA_STATE, {
            video: v ? v.enabled : false,
            audio: a ? a.enabled : false
        }));
    }

    stopMedia() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            if (this.room) {
                this.room.removeStream(this.localStream);
            }
            this.localStream = null;
            this.broadcast(wrap(MSG.MEDIA_STATE, { video: false, audio: false }));
        }
    }

    toggleAudio(enabled) {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                audioTracks[0].enabled = enabled;
                this.broadcastMediaState();
                return true;
            }
        }
        return false;
    }

    toggleVideo(enabled) {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            if (videoTracks.length > 0) {
                videoTracks[0].enabled = enabled;
                this.broadcastMediaState();
                return true;
            }
        }
        return false;
    }
}
