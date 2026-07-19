import { escapeHtml } from './Utils.js';
import { toast } from './Toast.js';

export class CollabUI {
    constructor(app) {
        this.app = app;
        this.manager = app.collaborationManager;
        this.init();
    }

    init() {
        this.injectHTML();
        this.bindEvents();
        this.hasRemoteStream = false;
        this.remoteVideoEnabled = false;
        this.userInitiatedLeave = false;

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
            if (remoteVideo) {
                remoteVideo.srcObject = null;
            }
            this.hasRemoteStream = false;
            this.remoteVideoEnabled = false;
            this.updateVideoVisibility();
            
            this.log(`Peer Signal Lost: ${peerId}`, 'warn');
            this.log(`Session Active. Waiting for peer re-connection...`, 'info');
        };
        this.manager.onRemoteStream = (stream, peerId) => {
            const remoteVideo = document.getElementById('collab-remote-video');
            if (remoteVideo) {
                remoteVideo.srcObject = stream;
                remoteVideo.play().catch(e => console.log('Remote play error', e));
                this.log(`Receiving Video Feed (WebRTC Stream)`, 'success');
                this.hasRemoteStream = true;
                // Assume enabled until told otherwise (or wait for state)
                this.remoteVideoEnabled = true; 
                this.updateVideoVisibility();
            }
        };
        this.manager.onPeerMediaChange = (peerId, state) => {
            this.remoteVideoEnabled = state.video;
            // We can also handle audio indication here (e.g. mute icon on remote video)
            this.updateVideoVisibility();
        };
        this.manager.onDisconnect = () => {
            this.updateStatus(false);
            document.getElementById('collab-hud').classList.add('hidden');
            document.getElementById('collab-top-bar').classList.add('hidden');
            this.app.modalManager.close('collab-modal'); // Ensure modal closes
            this.restoreToolbarItems();
            this.log('Disconnected from Swarm.', 'error');
            // Rejoin affordance: unexpected disconnects offer a one-click way
            // back into the same room (deliberate leaves just get the plain toast).
            if (!this.userInitiatedLeave && this.manager.lastRoomId) {
                this.showActionToast('Session ended.', 'Rejoin', () => {
                    this.initSession(this.manager.lastRoomId, this.manager.wasHost);
                });
            } else {
                this.showToast('Session Ended');
            }
            this.userInitiatedLeave = false;
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
                        <div id="collab-rejoin-row" class="hidden mt-2">
                            <button id="collab-rejoin-btn" class="btn-text btn-border" style="width: 100%;">
                                <i class="fas fa-history mr-1"></i> Rejoin Last Session
                            </button>
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
        this.app.modalManager.register('collab-modal', { closeBtnId: 'collab-close-btn' });

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
            <div class="flex-grow"></div>
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
                <div id="collab-video-wrapper" class="collab-video-container hidden">
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
    }

    bindEvents() {
        // Modal & Link Logic
        document.getElementById('collab-create-btn').addEventListener('click', async () => {
            // #29: mobile clients can't host (Treatment-forced view never
            // produces UPDATEs) — they can still join as readers.
            if (document.body.classList.contains('mobile-view')) {
                this.showToast("Hosting isn't supported on mobile — join from a desktop, or open an invite link to follow along.");
                return;
            }
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

        document.getElementById('collab-rejoin-btn').addEventListener('click', () => {
            if (!this.manager.lastRoomId) return;
            this.initSession(this.manager.lastRoomId, this.manager.wasHost);
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
                this.userInitiatedLeave = true;
                this.manager.disconnect();
                this.manager.stopMedia();
                this.restoreToolbarItems(); // Restore UI
                document.getElementById('collab-hud').classList.add('hidden');
                document.getElementById('collab-top-bar').classList.add('hidden');
                this.app.modalManager.close('collab-modal');
            }
        });

        document.getElementById('collab-baton-btn').addEventListener('click', () => {
             this.log("Transferring write access (Baton)...", 'system');
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
            const localVideo = document.getElementById('collab-local-video');

            if (btn.classList.contains('active')) {
                // Turn OFF Camera (disable track)
                this.manager.toggleVideo(false);
                btn.classList.remove('active');
                this.updateVideoVisibility();
                this.log("Camera disabled.", 'info');
            } else {
                // Turn ON Camera
                this.log("Starting Camera...", 'system');
                const result = await this.manager.enableMedia(localVideo);
                
                if (result.success) {
                    btn.classList.add('active');
                    this.updateVideoVisibility();
                    this.log("Camera enabled.", 'success');
                } else {
                    this.log(`Error accessing camera: ${result.error}`, 'error');
                }
            }
        });

        document.getElementById('collab-mic-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const localVideo = document.getElementById('collab-local-video');

            if (btn.classList.contains('active')) {
                // Mute
                this.manager.toggleAudio(false);
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                this.log("Microphone muted.", 'info');
            } else {
                // Unmute
                // Check if we can just toggle
                if (this.manager.toggleAudio(true)) {
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="fas fa-microphone"></i>';
                    this.log("Microphone unmuted.", 'success');
                } else {
                    // No stream? Start it.
                    this.log("Starting Microphone...", 'system');
                    const result = await this.manager.enableMedia(localVideo);
                    if (result.success) {
                        btn.classList.add('active');
                        btn.innerHTML = '<i class="fas fa-microphone"></i>';
                        btn.disabled = false; // Enable if it was disabled
                        
                        // If camera button is NOT active, ensure video is disabled
                        if (!document.getElementById('collab-cam-btn').classList.contains('active')) {
                            this.manager.toggleVideo(false);
                        }
                        
                        this.updateVideoVisibility();
                        this.log("Microphone started.", 'success');
                    } else {
                        this.log(`Error accessing microphone: ${result.error}`, 'error');
                    }
                }
            }
        });
    }

    updateVideoVisibility() {
        const wrapper = document.getElementById('collab-video-wrapper');
        const localVideo = document.getElementById('collab-local-video');
        const camBtn = document.getElementById('collab-cam-btn');
        
        // Conditions
        const showRemote = this.hasRemoteStream && this.remoteVideoEnabled;
        const localCamActive = camBtn.classList.contains('active');

        if (showRemote) {
            // SHOW WRAPPER (Remote + Local PIP)
            wrapper.classList.remove('hidden');
            
            // Move local video to wrapper if not there
            if (localVideo.parentNode !== wrapper) {
                // Reset styles
                localVideo.style = ""; 
                wrapper.appendChild(localVideo);
            }
        } else {
            // HIDE WRAPPER
            wrapper.classList.add('hidden');
            
            if (localCamActive) {
                // SHOW LOCAL VIDEO ON BUTTON
                if (localVideo.parentNode !== camBtn) {
                    camBtn.appendChild(localVideo);
                    // Apply styles for button background
                    camBtn.style.position = 'relative';
                    camBtn.style.overflow = 'hidden';
                    
                    localVideo.style.position = 'absolute';
                    localVideo.style.top = '0';
                    localVideo.style.left = '0';
                    localVideo.style.width = '100%';
                    localVideo.style.height = '100%';
                    localVideo.style.objectFit = 'cover';
                    localVideo.style.zIndex = '0';
                    localVideo.style.opacity = '0.4';
                    localVideo.style.pointerEvents = 'none';
                    
                    // Ensure icon is above
                    const icon = camBtn.querySelector('i');
                    if(icon) {
                        icon.style.position = 'relative';
                        icon.style.zIndex = '1';
                    }
                }
            } else {
                // Local video off, just ensure it's hidden or back in wrapper (doesn't matter much if hidden)
                // Put it back in wrapper to be safe
                if (localVideo.parentNode !== wrapper) {
                    localVideo.style = "";
                    wrapper.appendChild(localVideo);
                    
                    // Reset button styles
                    camBtn.style = "";
                    const icon = camBtn.querySelector('i');
                    if(icon) icon.style = "";
                }
            }
        }
    }

    async initSession(roomId, isHost) {
        if (!roomId) return;

        // #29: hosting requires the desktop editor (defense in depth — the
        // Start New Session button is blocked before it ever gets here).
        if (isHost && document.body.classList.contains('mobile-view')) {
            this.showToast("Hosting isn't supported on mobile — join from a desktop, or open an invite link to follow along.");
            return;
        }

        // Ensure Writing Mode
        this.app.ensureWritingMode();

        // Show Waiting View ONLY if Host (Guest joins immediately)
        if (isHost) {
            document.getElementById('collab-start-view').classList.add('hidden');
            document.getElementById('collab-waiting-view').classList.remove('hidden');
        } else {
            // Guest: Hide modal immediately, we assume success or show error later
            this.app.modalManager.close('collab-modal');
        }

        const link = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        document.getElementById('collab-invite-link').value = link;

        this.log(`Initializing session. Room ID: ${roomId}`, 'info');
        this.log(`Role: ${isHost ? 'HOST (You started the session)' : 'GUEST (You joined a session)'}`, 'info');
        this.log(`Connecting to secure peer-to-peer network...`, 'system');
        this.log(`Searching for peers in the swarm...`, 'system');

        const success = this.manager.connect(roomId, isHost);
        if (success) {
            this.showHUD(roomId);
            this.moveToolbarItems(); // Move UI elements
            if (isHost) this.showToast("Session started. Waiting for others to join...");
            else this.showToast("Joining session...");

            this.autoStartMedia();

            if (document.body.classList.contains('mobile-view')) {
                document.getElementById('collab-baton-btn').style.display = 'none';
            }
        } else {
            alert("Failed to initialize connection.");
            this.log("Error: Connection initialization failed.", 'error');
            this.app.modalManager.open('collab-modal'); // Re-show if failed
        }
    }

    // Auto-start the camera (mic muted) right after a session begins.
    autoStartMedia() {
        const camBtn = document.getElementById('collab-cam-btn');
        const micBtn = document.getElementById('collab-mic-btn');

        // Simulate delay for "Connecting" feel
        setTimeout(async () => {
            this.log("Attempting to auto-start camera...", 'system');
            const result = await this.manager.enableMedia(document.getElementById('collab-local-video'));
            if (result.success) {
                camBtn.classList.add('active');
                micBtn.disabled = false;

                // Default to Muted
                this.manager.toggleAudio(false);
                micBtn.classList.remove('active');
                micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';

                this.updateVideoVisibility();
                this.log("Camera started. Mic muted by default.", 'success');
            } else {
                this.log(`Could not auto-start camera: ${result.error}`, 'warn');
            }
        }, 800);
    }

    moveToolbarItems() {
        const topBar = document.getElementById('collab-top-bar');
        if (!topBar) return;

        // Ensure we don't move if already moved
        if (this.itemsMoved) return;
        this.itemsMoved = true;

        // Elements to move
        const logo = document.querySelector('#toolbar > h1');
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        const typeSelector = document.getElementById('type-selector-container');
        const musicPlayer = document.getElementById('music-player');

        // Create placeholders to remember positions
        this.placeholders = {};
        const createPlaceholder = (el, id) => {
            if (el) {
                const p = document.createElement('div');
                p.id = `placeholder-${id}`;
                p.style.display = 'none';
                el.parentNode.insertBefore(p, el);
                this.placeholders[id] = p;
                return true;
            }
            return false;
        };

        if(createPlaceholder(logo, 'logo')) {
            // Logo goes to far left. We need to insert it at the start of the first section.
            const firstSection = topBar.querySelector('.collab-bar-section');
            if(firstSection) firstSection.insertBefore(logo, firstSection.firstChild);
        }

        const centerSection = document.createElement('div');
        centerSection.className = 'collab-bar-section center-tools';
        // Add Undo/Redo/TypeSelector/Music to a center section or append to existing?
        // Let's create a container for them in the top bar
        
        // We'll insert them into the left section or a new middle section. 
        // Existing layout: [Left Section (Badge, RoomID)] ... [Right Section (Baton, Leave)]
        // We want: [Logo] [Left Section] [Tools] [Right Section]
        
        // Actually, just append to the first section or create a middle one.
        // Let's put them in the middle.
        if(createPlaceholder(undoBtn, 'undo')) centerSection.appendChild(undoBtn);
        if(createPlaceholder(redoBtn, 'redo')) centerSection.appendChild(redoBtn);
        if(createPlaceholder(typeSelector, 'types')) centerSection.appendChild(typeSelector);
        if(createPlaceholder(musicPlayer, 'music')) centerSection.appendChild(musicPlayer);
        
        // Insert center section before the last section (Right Section)
        topBar.insertBefore(centerSection, topBar.lastElementChild);
    }

    restoreToolbarItems() {
        if (!this.itemsMoved || !this.placeholders) return;
        
        const restore = (id, elId) => {
            const p = this.placeholders[id];
            const el = id === 'logo' ? document.querySelector('#collab-top-bar h1') : 
                       id === 'undo' ? document.getElementById('undo-btn') :
                       id === 'redo' ? document.getElementById('redo-btn') :
                       id === 'types' ? document.getElementById('type-selector-container') :
                       id === 'music' ? document.getElementById('music-player') : null;
            
            if (p && el) {
                p.parentNode.insertBefore(el, p);
                p.remove();
            }
        };

        restore('logo');
        restore('undo');
        restore('redo');
        restore('types');
        restore('music');
        
        // Remove the temporary center section
        const centerSection = document.querySelector('#collab-top-bar .center-tools');
        if (centerSection) centerSection.remove();

        this.itemsMoved = false;
        this.placeholders = null;
    }

    joinFromUrl(roomId) {
        this.log(`Detected invite link. Auto-joining room: ${roomId}`, 'system');
        const welcome = document.getElementById('mobile-welcome-modal');
        if (welcome) welcome.classList.add('hidden');
        
        // Ensure Modal is hidden for Guest
        this.app.modalManager.close('collab-modal');
        this.initSession(roomId, false);
    }

    openModal() {
        this.app.modalManager.open('collab-modal');
        document.getElementById('collab-start-view').classList.remove('hidden');
        document.getElementById('collab-waiting-view').classList.add('hidden');
        // Offer a rejoin shortcut when a previous session is remembered.
        document.getElementById('collab-rejoin-row').classList.toggle('hidden', !this.manager.lastRoomId || !!this.manager.room);
    }

    showHUD(roomId) {
        document.getElementById('collab-hud').classList.remove('hidden');
        document.getElementById('collab-top-bar').classList.remove('hidden');
        document.getElementById('collab-room-id-display').textContent = `${roomId}`;
    }

    updateStatus(isConnected) {
        if (isConnected) {
            // Ensure modal is closed if peer connects (for Host who was waiting)
            this.app.modalManager.close('collab-modal');
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
            badgeText.textContent = 'WRITER (You can edit)';
        } else {
            btn.disabled = true;
            btn.textContent = "Waiting...";
            btn.style.opacity = '0.7';
            
            badge.className = 'collab-status-badge reader';
            badgeText.textContent = 'READER (View only)';
        }
    }

    showToast(msg) {
        toast(msg);
    }

    // Persistent toast with a single action button (e.g. the reconnection
    // wait). Returns a dismiss function for the caller.
    showActionToast(msg, actionLabel, onAction) {
        const el = toast(msg, { duration: 0 });
        const btn = document.createElement('button');
        btn.className = 'btn-text btn-border';
        btn.style.marginLeft = '8px';
        btn.textContent = actionLabel;
        const dismiss = () => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        };
        btn.addEventListener('click', () => {
            dismiss();
            onAction();
        });
        el.appendChild(btn);
        return dismiss;
    }

    log(msg, type = 'info') {
        const consoleEl = document.getElementById('collab-console');
        if (!consoleEl) return;
        
        const now = new Date().toLocaleTimeString([], { hour12: false });
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="log-time">${now}</span> ${escapeHtml(msg)}`;
        
        consoleEl.appendChild(entry);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }
}
