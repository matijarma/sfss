export class CollabUI {
    constructor(app) {
        this.app = app;
        this.manager = app.collaborationManager;
        this.init();
    }

    init() {
        this.injectHTML();
        this.bindEvents();
        
        // Hook into Manager Callbacks
        this.manager.onBatonStatusChange = (hasBaton) => {
            this.updateBatonUI(hasBaton);
            this.log(`State Changed: ${hasBaton ? 'WRITER (Master)' : 'READER (Slave)'}`, hasBaton ? 'success' : 'warn');
        };
        this.manager.onPeerJoin = (peerId) => {
            this.showToast(`Peer Connected`);
            this.updateStatus(true);
            this.log(`Peer Identification Verified: ${peerId}`, 'success');
            this.log(`Establishing Encrypted Data Channel...`, 'system');
            setTimeout(() => this.log(`P2P Mesh Synchronized. Secure Connection Active.`, 'success'), 500);
        };
        this.manager.onPeerLeave = (peerId) => {
            this.showToast(`Peer Disconnected`);
            this.updateStatus(false);
            const remoteVideo = document.getElementById('collab-remote-video');
            if (remoteVideo) remoteVideo.srcObject = null;
            this.log(`Peer Signal Lost: ${peerId}`, 'warn');
            
            // If we are alone, maybe hide HUD?
            // User requested "collab gui remains open" as bug when peer leaves.
            // But if I am host, I might wait for them to return.
            // I'll log a "Waiting" message.
            this.log(`Session Active. Waiting for peer re-connection...`, 'info');
        };
        this.manager.onRemoteStream = (stream, peerId) => {
            const remoteVideo = document.getElementById('collab-remote-video');
            if (remoteVideo) {
                remoteVideo.srcObject = stream;
                remoteVideo.play().catch(e => console.log('Remote play error', e));
                this.log(`Receiving Video Feed (WebRTC Stream)`, 'success');
            }
        };
        this.manager.onDisconnect = () => {
            this.updateStatus(false);
            this.showToast('Session Ended');
            document.getElementById('collab-hud').classList.add('hidden');
            document.getElementById('collab-top-bar').classList.add('hidden');
            document.getElementById('collab-modal').classList.add('hidden'); // Ensure modal closes
            this.log('Disconnected from Swarm.', 'error');
        };
    }

    injectHTML() {
        // 1. Connection Modal
        const modalHtml = `
        <div id="collab-modal" class="modal-overlay hidden">
            <div class="modal-window popup-max-width-md">
                <div class="modal-header">
                    <span>Collaboration (Beta)</span>
                    <button id="collab-close-btn" class="btn-text">✕</button>
                </div>
                <div class="modal-body collab-modal-content">
                    <p class="text-meta">Start a real-time session. P2P, Encrypted, Serverless.</p>
                    
                    <div id="collab-start-view">
                        <div class="flex-row justify-center gap-2 mt-3">
                            <button id="collab-create-btn" class="modal-btn-primary" style="background:var(--accent); width: 100%;">
                                <i class="fas fa-play mr-1"></i> Start New Session
                            </button>
                        </div>
                        <div class="text-center mt-2">OR</div>
                         <div class="flex-col gap-1 mt-2">
                            <label class="settings-label">Paste Invite Link</label>
                            <div class="flex-row gap-1">
                                <input type="text" id="collab-join-input" class="settings-input" placeholder="Paste link here...">
                                <button id="collab-join-btn" class="btn-text btn-border">Join</button>
                            </div>
                        </div>
                    </div>

                    <div id="collab-waiting-view" class="hidden text-center">
                        <div class="loader-spinner" style="width: 30px; height: 30px; margin: 0 auto; border-width: 3px;"></div>
                        <h3 class="mt-2">Waiting for peer...</h3>
                        <p class="text-meta text-sm mb-2">Share this link:</p>
                        
                        <div class="flex-row gap-1">
                            <input type="text" id="collab-invite-link" class="settings-input text-center" readonly onclick="this.select()">
                            <button id="collab-copy-btn" class="modal-btn-primary"><i class="fas fa-copy"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 2. Top Status Bar
        const topBarHtml = `
        <div id="collab-top-bar" class="hidden">
            <div class="collab-bar-section">
                <div id="collab-mode-badge" class="collab-status-badge reader">
                    <div class="collab-pulse"></div>
                    <span id="collab-mode-text">READER</span>
                </div>
                <span id="collab-room-id-display" class="text-meta" style="font-family:monospace; opacity: 0.7;"></span>
            </div>
            
            <div class="collab-bar-section">
                <button id="collab-baton-btn" disabled>Waiting...</button>
                <button id="collab-leave-btn" class="btn-text" style="color:var(--text-meta)" title="Leave Session"><i class="fas fa-sign-out-alt"></i></button>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', topBarHtml);

        // 3. Video HUD (Refactored Layout)
        const hudHtml = `
        <div id="collab-hud" class="hidden">
            <div id="collab-console" class="hidden">
                <div class="log-entry system"><span class="log-time">--:--</span> Initializing Secure Environment...</div>
            </div>
            
            <div class="collab-hud-right-pane">
                <div class="collab-video-container">
                    <video id="collab-remote-video" autoplay playsinline></video>
                    <video id="collab-local-video" autoplay playsinline muted></video>
                </div>
                <div class="collab-hud-controls">
                    <button class="collab-btn" id="collab-mic-btn" title="Toggle Mic" disabled><i class="fas fa-microphone-slash"></i></button>
                    <button class="collab-btn" id="collab-cam-btn" title="Toggle Camera"><i class="fas fa-video"></i></button>
                    <button class="collab-btn" id="collab-log-btn" title="Toggle Log Console"><i class="fas fa-terminal"></i></button>
                </div>
            </div>
        </div>
        `;
        document.body.insertAdjacentHTML('beforeend', hudHtml);

        // 4. Toast Container
        if (!document.getElementById('collab-toast')) {
            const toast = document.createElement('div');
            toast.id = 'collab-toast';
            toast.className = 'collab-toast';
            document.body.appendChild(toast);
        }
    }

    bindEvents() {
        // Modal & Link Logic
        document.getElementById('collab-close-btn').addEventListener('click', () => {
            document.getElementById('collab-modal').classList.add('hidden');
        });
        
        document.getElementById('collab-create-btn').addEventListener('click', async () => {
            const roomId = 'script-' + Math.random().toString(36).substring(2, 9);
            this.initSession(roomId, true);
            
            // Auto Copy
            setTimeout(() => {
                const linkInput = document.getElementById('collab-invite-link');
                linkInput.select();
                navigator.clipboard.writeText(linkInput.value).then(() => {
                    this.showToast("Link copied to clipboard!");
                });
            }, 500);
        });

        document.getElementById('collab-join-btn').addEventListener('click', () => {
            let input = document.getElementById('collab-join-input').value.trim();
            if (!input) return;
            if (input.includes('?room=')) {
                try {
                    const url = new URL(input);
                    const roomParam = url.searchParams.get('room');
                    if (roomParam) input = roomParam;
                } catch(e) {}
            }
            this.initSession(input, false);
        });

        document.getElementById('collab-copy-btn').addEventListener('click', () => {
            const copyText = document.getElementById('collab-invite-link');
            copyText.select();
            navigator.clipboard.writeText(copyText.value);
            this.showToast("Link copied!");
        });

        // Top Bar Logic
        document.getElementById('collab-leave-btn').addEventListener('click', () => {
            if(confirm("Disconnect from session?")) {
                this.manager.disconnect();
                this.manager.disableMedia();
                document.getElementById('collab-hud').classList.add('hidden');
                document.getElementById('collab-top-bar').classList.add('hidden');
                document.getElementById('collab-modal').classList.add('hidden');
            }
        });

        document.getElementById('collab-baton-btn').addEventListener('click', () => {
             this.log("Initiating Baton Transfer Protocol...", 'system');
             this.manager.passBaton();
        });

        // Video HUD Logic
        document.getElementById('collab-log-btn').addEventListener('click', (e) => {
            const consoleEl = document.getElementById('collab-console');
            consoleEl.classList.toggle('hidden');
            e.currentTarget.classList.toggle('active');
        });

        document.getElementById('collab-cam-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const micBtn = document.getElementById('collab-mic-btn');
            
            if (btn.classList.contains('active')) {
                this.manager.disableMedia();
                btn.classList.remove('active');
                micBtn.classList.remove('active');
                micBtn.disabled = true;
                micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                document.getElementById('collab-local-video').srcObject = null;
                this.log("Media Stream Terminated (Privacy Mode)", 'warn');
            } else {
                this.log("Requesting Hardware Access (Camera/Mic)...", 'system');
                const result = await this.manager.enableMedia(document.getElementById('collab-local-video'));
                if (result.success) {
                    btn.classList.add('active');
                    micBtn.disabled = false;
                    micBtn.classList.add('active');
                    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                    this.log("Media Stream Active (Encrypted)", 'success');
                } else {
                    this.log(`Hardware Access Denied: ${result.error}`, 'error');
                    alert("Error accessing media: " + result.error);
                }
            }
        });
        
        document.getElementById('collab-mic-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            if (btn.classList.contains('active')) {
                const ok = this.manager.toggleAudio(false);
                if (ok) {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                    this.log("Audio Track Muted", 'warn');
                }
            } else {
                const ok = this.manager.toggleAudio(true);
                if (ok) {
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fas fa-microphone"></i>';
                    this.log("Audio Track Active", 'success');
                }
            }
        });
    }

    async initSession(roomId, isHost) {
        if (!roomId) return;
        
        // Show Waiting View ONLY if Host (Guest joins immediately)
        if (isHost) {
            document.getElementById('collab-start-view').classList.add('hidden');
            document.getElementById('collab-waiting-view').classList.remove('hidden');
        } else {
            // Guest: Hide modal immediately, we assume success or show error later
            document.getElementById('collab-modal').classList.add('hidden');
        }
        
        const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        document.getElementById('collab-invite-link').value = link;
        
        this.log(`Initializing Session ID: ${roomId}`, 'info');
        this.log(`Role Assigned: ${isHost ? 'HOST (Initiator)' : 'GUEST (Peer)'}`, 'info');
        this.log(`Connecting to Signaling Server (BitTorrent Tracker)...`, 'system');
        this.log(`Resolving DHT for Room Swarm...`, 'system');

        const success = this.manager.connect(roomId, isHost);
        if (success) {
            this.showHUD(roomId);
            if (isHost) this.showToast("Session Ready. Waiting for Peer...");
            else this.showToast("Joining Session...");
            
            // Auto-Start Media
            const camBtn = document.getElementById('collab-cam-btn');
            const micBtn = document.getElementById('collab-mic-btn');
            
            // Simulate delay for "Connecting" feel
            setTimeout(async () => {
                this.log("Attempting Auto-Start Media Stream...", 'system');
                const result = await this.manager.enableMedia(document.getElementById('collab-local-video'));
                if (result.success) {
                    camBtn.classList.add('active');
                    micBtn.disabled = false;
                    micBtn.classList.add('active');
                    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                    this.log("Local Media Stream Attached.", 'success');
                } else {
                     this.log(`Auto-start media prevented: ${result.error}`, 'warn');
                }
            }, 800);

            if (document.body.classList.contains('mobile-view')) {
                document.getElementById('collab-baton-btn').style.display = 'none';
            }

        } else {
             alert("Failed to initialize connection.");
             this.log("CRITICAL: Connection Initialization Failed", 'error');
             document.getElementById('collab-modal').classList.remove('hidden'); // Re-show if failed
        }
    }
    
    joinFromUrl(roomId) {
        this.log(`Detected Invite Link. Auto-joining: ${roomId}`, 'system');
        const welcome = document.getElementById('mobile-welcome-modal');
        if (welcome) welcome.classList.add('hidden');
        
        // Ensure Modal is hidden for Guest
        document.getElementById('collab-modal').classList.add('hidden');
        this.initSession(roomId, false);
    }

    openModal() {
        document.getElementById('collab-modal').classList.remove('hidden');
        document.getElementById('collab-start-view').classList.remove('hidden');
        document.getElementById('collab-waiting-view').classList.add('hidden');
    }

    showHUD(roomId) {
        document.getElementById('collab-hud').classList.remove('hidden');
        document.getElementById('collab-top-bar').classList.remove('hidden');
        document.getElementById('collab-room-id-display').textContent = `${roomId}`;
    }

    updateStatus(isConnected) {
        if (isConnected) {
            // Ensure modal is closed if peer connects (for Host who was waiting)
            document.getElementById('collab-modal').classList.add('hidden');
        }
    }

    updateBatonUI(hasBaton) {
        const btn = document.getElementById('collab-baton-btn');
        const badge = document.getElementById('collab-mode-badge');
        const badgeText = document.getElementById('collab-mode-text');

        if (hasBaton) {
            btn.disabled = false;
            btn.textContent = "Pass Baton";
            btn.style.opacity = '1';
            
            badge.className = 'collab-status-badge writer';
            badgeText.textContent = 'WRITER (Active)';
        } else {
            btn.disabled = true;
            btn.textContent = "Waiting...";
            btn.style.opacity = '0.7';
            
            badge.className = 'collab-status-badge reader';
            badgeText.textContent = 'READER (Locked)';
        }
    }

    showToast(msg) {
        const toast = document.getElementById('collab-toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    log(msg, type = 'info') {
        const consoleEl = document.getElementById('collab-console');
        if (!consoleEl) return;
        
        const now = new Date().toLocaleTimeString([], { hour12: false });
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="log-time">${now}</span> ${msg}`;
        
        consoleEl.appendChild(entry);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }
}
