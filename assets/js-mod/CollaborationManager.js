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
        this.log(`Connecting to room: ${roomId}...`, 'info');
        if (this.room) {
            this.disconnect();
        }

        this.roomId = roomId;
        this.isHost = isHost;
        this.hasBaton = isHost; 
        
        try {
            this.log('Initializing Trystero (WebRTC Mesh)...', 'info');
            this.room = joinRoom({ appId: this.APP_ID }, roomId);

            const [sendData, getData] = this.room.makeAction('data');
            this.sendDataRaw = sendData;
            getData(this.handleData.bind(this));
            this.log('Data Channel Secured.', 'success');

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
                this.log('Guest Mode: Locking Editor.', 'info');
                this.app.editorHandler.toggleReadOnly(true);
            } else {
                this.log('Host Mode: Baton Active.', 'success');
            }

            return true;
        } catch (e) {
            this.log(`Connection Failed: ${e.message}`, 'error');
            console.error(e);
            return false;
        }
    }

    disconnect() {
        if (this.room) {
            this.room.leave();
            this.room = null;
        }
        clearInterval(this.heartbeatInterval);
        this.peers = {};
        this.hasBaton = true; 
        
        this.disableMedia();
        this.app.editorHandler.toggleReadOnly(false);

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
                    this.log(`Peer Timeout: ${peerId}`, 'warn');
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
             this.log(`Sending Full Sync to new peer ${peerId}...`, 'info');
             setTimeout(() => {
                 const snapshot = this.app.editorHandler.getSnapshot();
                 this.sendTo(peerId, { type: 'SYNC_FULL', payload: snapshot });
             }, 500);
        }
    }

    handlePeerLeave(peerId) {
        delete this.peers[peerId];
        
        if (!this.hasBaton && Object.keys(this.peers).length === 0) {
             this.log('Last peer left. Reclaiming Baton.', 'warn');
             this.takeBaton(true); 
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
                    this.log(`Peer ${peerId} identified as Mobile.`, 'info');
                }
                break;
            case 'SYNC_FULL':
                this.log('Received Full Sync.', 'info');
                this.app.editorHandler.applySnapshot(data.payload);
                break;
            case 'UPDATE':
                 if (!this.hasBaton) {
                     this.app.editorHandler.applySnapshot(data.payload, true); 
                 }
                 break;
            case 'GRANT_BATON':
                this.log('Baton Received!', 'success');
                this.takeBaton();
                this.sendTo(peerId, { type: 'BATON_ACK' });
                break;
            case 'BATON_ACK':
                this.log('Baton Transfer Confirmed.', 'info');
                this.hasBaton = false;
                this.app.editorHandler.toggleReadOnly(true);
                if (this.onBatonStatusChange) this.onBatonStatusChange(false);
                break;
        }
    }

    sendUpdate(snapshot) {
        if (!this.hasBaton) return;
        this.broadcast({ type: 'UPDATE', payload: snapshot });
    }

    passBaton() {
        if (!this.hasBaton) return;
        
        const eligiblePeers = Object.keys(this.peers).filter(id => !this.peers[id].meta.isMobile);
        
        if (eligiblePeers.length === 0) {
            alert("No eligible peers connected (Mobile users cannot edit).");
            return;
        }
        
        const targetPeer = eligiblePeers[0];
        this.log(`Passing Baton to ${targetPeer}...`, 'info');
        
        const snapshot = this.app.editorHandler.getSnapshot();
        this.sendTo(targetPeer, { type: 'SYNC_FULL', payload: snapshot });
        this.sendTo(targetPeer, { type: 'GRANT_BATON' });
    }

    takeBaton(forced = false) {
        this.hasBaton = true;
        this.app.editorHandler.toggleReadOnly(false);
        if (this.onBatonStatusChange) this.onBatonStatusChange(true);
        if (forced) {
             alert("Remote user disconnected. You have control.");
        } else {
             if (this.app.collabUI) this.app.collabUI.showToast("You have the baton!");
        }
    }

    async enableMedia(localVideoEl) {
        if (!this.room) {
            return { error: "Room not initialized" };
        }
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            if (localVideoEl) {
                localVideoEl.srcObject = this.localStream;
                localVideoEl.play().catch(e => console.error(e));
                localVideoEl.muted = true; 
            }
            
            this.room.addStream(this.localStream);
            return { success: true };
        } catch (e) {
            return { error: e.name, message: e.message };
        }
    }

    disableMedia() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            if (this.room) {
                this.room.removeStream(this.localStream);
            }
            this.localStream = null;
        }
    }

    toggleAudio(enabled) {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                audioTracks[0].enabled = enabled;
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
                return true;
            }
        }
        return false;
    }
}
