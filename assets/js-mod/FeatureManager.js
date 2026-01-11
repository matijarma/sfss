export class FeatureManager {
    constructor(app) {
        this.app = app;
        this.storageKey = 'sfss_features';
        this.version = window.cacheverzija || 'dev';
        this.registry = [
            {
                id: 'collab',
                label: 'Collaboration',
                description: 'Peer-to-peer sessions, baton handoff, and live cursors powered by Trystero.',
                weight: 'Adds realtime networking and video HUD',
                css: ['assets/css/collab.css']
            },
            {
                id: 'media',
                label: 'Media Player',
                description: 'Scene soundtrack support via YouTube metadata and embedded player.',
                weight: 'Loads YouTube iframe API',
                css: []
            }
        ];
        this.flags = this.getFlags();
        this.pendingFlags = { ...this.flags };
    }

    getFlags() {
        let stored = {};
        try { stored = JSON.parse(localStorage.getItem(this.storageKey) || '{}'); } catch (e) { stored = {}; }
        const defaults = {};
        this.registry.forEach(f => defaults[f.id] = true);
        const injected = window.sfssFeatures || {};
        const merged = Object.assign({}, defaults, injected, stored);
        this.flags = merged;
        return merged;
    }

    setFlag(id, value) {
        this.pendingFlags[id] = !!value;
        const status = document.getElementById('feature-builder-status');
        if (status) status.textContent = 'Changes staged. Click Apply & Reload to enforce.';
    }

    isEnabled(id) {
        return !!this.getFlags()[id];
    }

    async loadFeatures() {
        const flags = this.getFlags();
        await Promise.all([
            this.applyMedia(flags.media),
            this.applyCollab(flags.collab)
        ]);
        this.renderUiState();
    }

    async applyMedia(enabled) {
        if (!enabled) {
            this.app.mediaPlayer = this.createMediaStub();
            const player = document.getElementById('music-player');
            if (player) player.classList.add('hidden');
            return;
        }
        if (this.app.mediaPlayer && !this.app.mediaPlayer.__isStub) return;
        const { MediaPlayer } = await import(`./MediaPlayer.js?v=${this.version}`);
        this.app.mediaPlayer = new MediaPlayer(this.app);
        await this.app.mediaPlayer.updatePlaylist?.();
    }

    async applyCollab(enabled) {
        const collabBtn = document.getElementById('collab-menu-btn');
        if (!enabled) {
            this.app.collaborationManager = this.createCollabManagerStub();
            this.app.collabUI = this.createCollabUIStub();
            if (collabBtn) collabBtn.classList.add('hidden');
            return;
        }
        if (collabBtn) collabBtn.classList.remove('hidden');
        if (this.app.collaborationManager && !this.app.collaborationManager.__isStub) return;

        // Ensure CSS is present if feature was off during initial load
        this.registry.find(f => f.id === 'collab')?.css?.forEach(src => this.ensureStyle(src));

        const [{ CollaborationManager }, { CollabUI }] = await Promise.all([
            import(`./CollaborationManager.js?v=${this.version}`),
            import(`./CollabUI.js?v=${this.version}`)
        ]);
        this.app.collaborationManager = new CollaborationManager(this.app);
        this.app.collabUI = new CollabUI(this.app);
    }

    ensureStyle(href) {
        const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link => link.href.includes(href));
        if (exists) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `${href}?v=${this.version}`;
        document.head.appendChild(link);
    }

    // ---- UI ----
    openModal() {
        this.pendingFlags = { ...this.getFlags() }; // refresh from storage
        this.renderList();
        const status = document.getElementById('feature-builder-status');
        if (status) status.textContent = '';
    }

    closeModal() {
        // No-op: feature UI now lives inside Help modal tabs
    }

    renderList() {
        const container = document.getElementById('feature-builder-list');
        if (!container) return;
        container.innerHTML = '';

        this.registry.forEach(feature => {
            const row = document.createElement('div');
            row.className = 'flex-justify-between-center border-bottom-light p-1';
            row.style.gap = '0.5rem';

            const info = document.createElement('div');
            info.style.flex = '1';
            info.innerHTML = `
                <div class="font-bold">${feature.label}</div>
                <div class="text-meta text-sm">${feature.description}</div>
                <div class="text-meta text-xs opacity-80">${feature.weight || ''}</div>
            `;

            const toggleWrap = document.createElement('label');
            toggleWrap.className = 'switch';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!this.pendingFlags[feature.id];
            input.dataset.featureId = feature.id;
            input.onchange = () => this.setFlag(feature.id, input.checked);
            const slider = document.createElement('span');
            slider.className = 'slider round';
            toggleWrap.appendChild(input);
            toggleWrap.appendChild(slider);

            row.appendChild(info);
            row.appendChild(toggleWrap);
            container.appendChild(row);
        });
    }

    renderUiState() {
        const musicPlayer = document.getElementById('music-player');
        if (musicPlayer) {
            musicPlayer.classList.toggle('hidden', !this.flags.media);
        }
    }

    // ---- Portable build integration ----
    async downloadPortable(statusEl) {
        const logEl = document.getElementById('portable-log');
        if (logEl) logEl.innerHTML = '';
        if (statusEl) statusEl.textContent = 'Packing portable build...';
        let Generator = window.SingleFileGenerator;
        if (!Generator) {
            const mod = await import(`./SingleFileGenerator.js?v=${this.version}`);
            Generator = mod.SingleFileGenerator;
        }
        const generator = new Generator(this);
        await generator.generate({ statusEl, logEl, features: { ...this.pendingFlags } });
        if (statusEl) statusEl.textContent = 'Portable build downloaded.';
    }

    applyAndReload() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.pendingFlags));
        window.location.reload();
    }

    // ---- Stubs ----
    createMediaStub() {
        return {
            __isStub: true,
            playlist: [],
            updatePlaylist: () => {},
            extractYouTubeVideoId: () => null,
            _fetchTrackMetadata: async () => null,
            ensureYouTubeAPILoaded: () => {},
            onYouTubeIframeAPIReady: () => {},
            reset: () => {},
            playTrackById: () => {},
            playPrevTrack: () => {},
            togglePlay: () => {},
            playNextTrack: () => {}
        };
    }

    createCollabManagerStub() {
        return {
            __isStub: true,
            connect: () => alert('Collaboration is disabled in this configuration. Enable it in App Builder to use.'),
            disconnect: () => {},
            stopMedia: () => {},
            toggleAudio: () => {},
            toggleVideo: () => {},
            enableMedia: async () => ({ success: false }),
            passBaton: () => {},
            takeBaton: () => {},
            sendUpdate: () => {},
            broadcast: () => {},
            room: null
        };
    }

    createCollabUIStub() {
        return {
            __isStub: true,
            openModal: () => alert('Collaboration is disabled in this configuration. Enable it in App Builder to use.'),
            joinFromUrl: () => {}
        };
    }
}
