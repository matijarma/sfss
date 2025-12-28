import { joinRoom } from '../trystero.min.js';

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
        this.TIMEOUT_THRESHOLD = 5000;

        // Channels
        this.dataChannel = null;
        this.localStream = null;
        
        this.heartbeatInterval = null;
        this.onBatonStatusChange = null; 
        this.onPeerJoin = null;
        this.onPeerLeave = null;
        this.onDisconnect = null;
        this.onRemoteStream = null;
    }

    log(msg, type) {
        if (this.app.collabUI) this.app.collabUI.log(msg, type);
        else console.log(`[CollabManager] ${msg}`);
    }

    connect(roomId, isHost) {
        this.log(`Initiating connection sequence for Room: ${roomId}...`, 'info');
        if (this.room) {
            this.disconnect();
        }

        this.roomId = roomId;
        this.isHost = isHost;
        this.hasBaton = isHost; 
        
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
        if (this.room) {
            // Notify peers we are closing the session (if we are host or just leaving)
            // Ideally only Host closes session, but anyone leaving might want to say goodbye.
            // If we want to "Close Session" for everyone, we send SESSION_END.
            // If we just want to leave, we rely on peerLeave.
            // The user request implies "Disconnecting the session" should clean up for the other person?
            // If I am just one of many, I shouldn't close it for everyone.
            // But usually this is 1-on-1.
            // Let's send a graceful exit message.
            this.broadcast({ type: 'SESSION_END', payload: { reason: 'User disconnected.' } });
            
            this.room.leave();
            this.room = null;
        }
        clearInterval(this.heartbeatInterval);
        this.peers = {};
        this.hasBaton = true; 
        
        this.stopMedia();
        this.app.editorHandler.toggleReadOnly(false);

        document.body.classList.remove('is-collaborating');

        if (this.onDisconnect) this.onDisconnect();
        if (this.onBatonStatusChange) this.onBatonStatusChange(true);
    }

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        
        this.heartbeatInterval = setInterval(() => {
            this.broadcast({ type: 'PING' });
            
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
        this.sendDataRaw(msg); 
    }

    sendTo(peerId, msg) {
        if (!this.sendDataRaw) return;
        this.sendDataRaw(msg, peerId);
    }

    handlePeerJoin(peerId) {
        this.peers[peerId] = { lastPing: Date.now(), meta: {} };
        
        if (this.onPeerJoin) this.onPeerJoin(peerId);

        const isMobile = document.body.classList.contains('mobile-view');
        this.sendTo(peerId, { type: 'HELLO', payload: { isMobile } });

        if (this.hasBaton) {
             this.log(`New collaborator joined. Sending them the current script (encrypted)...`, 'info');
             setTimeout(() => {
                 const snapshot = this.app.editorHandler.getSnapshot();
                 const currentBlock = this.app.editorHandler.getCurrentBlock();
                 if (currentBlock) snapshot.activeLineId = currentBlock.dataset.lineId;
                 this.sendTo(peerId, { type: 'SYNC_FULL', payload: snapshot });
             }, 500);
        }

        // Fix: Ensure video/audio is sent to the new peer
        if (this.localStream) {
            this.log('Negotiating video/audio stream with new collaborator...', 'system');
            this.room.addStream(this.localStream, peerId);
        }
    }

    handlePeerLeave(peerId) {
        delete this.peers[peerId];
        
        if (Object.keys(this.peers).length === 0) {
             this.log('Connection lost (No peers remaining). Ending session.', 'warn');
             this.disconnect();
             if (this.app.collabUI) {
                 this.app.collabUI.showToast("Connection lost. Session ended.");
                 this.app.collabUI.restoreToolbarItems();
             }
        }

        if (this.onPeerLeave) this.onPeerLeave(peerId);
    }

    handleData(data, peerId) {
        if (!this.peers[peerId]) this.peers[peerId] = { lastPing: Date.now(), meta: {} };
        this.peers[peerId].lastPing = Date.now();

        switch (data.type) {
            case 'PING':
                break;
            case 'HELLO':
                if (data.payload && data.payload.isMobile) {
                    this.peers[peerId].meta.isMobile = true;
                    this.log(`Collaborator is on a mobile device. They will be a reader only.`, 'info');
                }
                break;
            case 'SYNC_FULL':
                this.log('Received latest script version from collaborator.', 'success');
                this.app.editorHandler.applySnapshot(data.payload, false, false, data.payload.activeLineId);
                // After full sync, ensure we see the active cursor
                setTimeout(() => this.app.scrollToActive(), 100);
                break;
            case 'UPDATE':
                 if (!this.hasBaton) {
                     this.app.editorHandler.applySnapshot(data.payload, true, true, data.payload.activeLineId); 
                 }
                 break;
            case 'GRANT_BATON':
                this.log('You have been granted write access (baton). Your editor is now unlocked.', 'success');
                this.takeBaton();
                this.sendTo(peerId, { type: 'BATON_ACK' });
                this.app.scrollToActive(); // Ensure writer sees where they are
                break;
            case 'BATON_ACK':
                this.log('Collaborator has confirmed receipt of the baton. Your editor is now locked.', 'info');
                this.hasBaton = false;
                this.app.editorHandler.toggleReadOnly(true);
                if (this.onBatonStatusChange) this.onBatonStatusChange(false);
                break;
            case 'SESSION_END':
                this.log('Remote user ended the session.', 'warn');
                this.disconnect();
                if(this.app.collabUI) this.app.collabUI.restoreToolbarItems(); // Ensure UI restoration
                break;
            case 'MEDIA_STATE':
                if (this.onPeerMediaChange) {
                    this.onPeerMediaChange(peerId, data.payload);
                }
                break;
        }
    }

    sendUpdate(snapshot) {
        if (!this.hasBaton) return;
        const currentBlock = this.app.editorHandler.getCurrentBlock();
        if (currentBlock) snapshot.activeLineId = currentBlock.dataset.lineId;
        this.broadcast({ type: 'UPDATE', payload: snapshot });
    }

    passBaton() {
        if (!this.hasBaton) return;
        
        const eligiblePeers = Object.keys(this.peers).filter(id => !this.peers[id].meta.isMobile);
        
        if (eligiblePeers.length === 0) {
            if (Object.keys(this.peers).length === 0) {
                 this.log("Cannot pass the baton: No one else is in the session.", 'warn');
            } else {
                 this.log("Cannot pass the baton: Your collaborator is on a mobile device and cannot edit.", 'warn');
            }
            return;
        }
        
        const targetPeer = eligiblePeers[0];
        this.log(`Passing write access (baton) to collaborator...`, 'info');
        
        const snapshot = this.app.editorHandler.getSnapshot();
        const currentBlock = this.app.editorHandler.getCurrentBlock();
        if (currentBlock) snapshot.activeLineId = currentBlock.dataset.lineId;
        this.sendTo(targetPeer, { type: 'SYNC_FULL', payload: snapshot });
        this.sendTo(targetPeer, { type: 'GRANT_BATON' });
    }

    takeBaton(forced = false) {
        this.hasBaton = true;
        this.app.editorHandler.toggleReadOnly(false);
        if (this.onBatonStatusChange) this.onBatonStatusChange(true);
        if (forced) {
             if(this.app.collabUI) this.app.collabUI.showToast("Remote user disconnected. You have control.");
        } else {
             if (this.app.collabUI) this.app.collabUI.showToast("You have the baton!");
        }
        this.app.scrollToActive();
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
        
        this.broadcast({
            type: 'MEDIA_STATE',
            payload: {
                video: v ? v.enabled : false,
                audio: a ? a.enabled : false
            }
        });
    }

    stopMedia() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            if (this.room) {
                this.room.removeStream(this.localStream);
            }
            this.localStream = null;
            this.broadcast({ type: 'MEDIA_STATE', payload: { video: false, audio: false } });
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
