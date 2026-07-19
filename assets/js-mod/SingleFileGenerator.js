import { escapeHtml as sharedEscapeHtml } from './Utils.js';

export class SingleFileGenerator {
    constructor(featureManager) {
        this.featureManager = featureManager;
        this.version = window.cacheverzija || 'dev';
        this.dataUrlCache = new Map();
        this.assetManifest = null;
    }

    async generate({ statusEl, logEl, features } = {}) {
        const config = { ...(features || this.featureManager.getFlags()) };
        const portableVersion = this.buildPortableVersion();
        try {
            this.setStatus(statusEl, 'Preparing portable build...');
            this.log(logEl, 'Starting portable build…');
            const html = await this.buildHtml(config, statusEl, logEl, portableVersion);
            this.setStatus(statusEl, 'Creating download...');
            this.triggerDownload(html, portableVersion, logEl);
            this.setStatus(statusEl, 'Portable build ready.');
            this.log(logEl, `✅ Portable build ready: ${portableVersion}`);
        } catch (err) {
            console.error('Portable build failed', err);
            this.setStatus(statusEl, 'Portable build failed. Check console.');
            this.log(logEl, '❌ Portable build failed: ' + err.message);
            throw err;
        }
    }

    setStatus(statusEl, text) {
        if (statusEl) statusEl.textContent = text;
    }

    log(logEl, text) {
        if (!logEl) return;
        const line = document.createElement('div');
        line.textContent = text;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
    }

    buildPortableVersion() {
        const base = window.cacheverzija || this.version || 'dev';
        const ts = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
        return `portable-${base}-${stamp}`;
    }

    async buildHtml(features, statusEl, logEl, portableVersion) {
        const portableFeatures = { ...features, media: false, collab: false };
        const templateDoc = await this.loadBaseDocument();
        this.log(logEl, 'Inlining inline images/icons in document body...');
        await this.inlineImages(templateDoc, logEl);

        this.setStatus(statusEl, 'Inlining styles...');
        this.log(logEl, 'Inlining styles and fonts...');
        const cssBundle = await this.inlineCss(portableFeatures, logEl);

        this.setStatus(statusEl, 'Bundling scripts...');
        this.log(logEl, 'Bundling scripts and stubs...');
        const jsBundle = this.escapeScript(await this.inlineJs(portableFeatures, logEl, portableVersion));

        const lang = templateDoc.documentElement.lang || 'en';
        const bodyClass = templateDoc.body.getAttribute('class') || '';
        const title = templateDoc.querySelector('title')?.textContent || 'SFSS Portable';
        const description = templateDoc.querySelector('meta[name="description"]')?.getAttribute('content') || 'SFSS Portable';
        const icon64 = await this.fetchAsDataUrl('assets/images/icon-64.png', 'image/png');
        const icon512 = await this.fetchAsDataUrl('assets/images/icon-512.png', 'image/png');

        return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0f62fe">
<meta name="description" content="${this.escapeHtml(description)}">
<title>${this.escapeHtml(title)}</title>
<link rel="icon" href="${icon64}">
<link rel="apple-touch-icon" href="${icon512}">
<style>
${cssBundle}
</style>
</head>
<body class="${bodyClass}">
${templateDoc.body.innerHTML}
<script>
${jsBundle}
</script>
</body>
</html>`;
    }

    async loadBaseDocument() {
        const html = await this.fetchText('index.html');
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('script').forEach(el => el.remove());
        return doc;
    }

    async inlineImages(doc, logEl) {
        const images = Array.from(doc.querySelectorAll('img[src]'));
        let inlined = 0;
        for (const img of images) {
            const src = img.getAttribute('src');
            if (!src || src.startsWith('data:')) continue;
            const dataUrl = await this.fetchAsDataUrl(src, this.getMimeType(src));
            img.setAttribute('src', dataUrl);
            inlined++;
        }
        this.log(logEl, `✓ Inlined ${inlined} inline images`);
    }

    // assets/asset-manifest.json is the single source of truth for the file
    // lists (portableJsOrder / portableCss, with @media/@collab tokens
    // expanding into the conditional groups). Fetched once, then cached.
    async loadAssetManifest() {
        if (!this.assetManifest) {
            const res = await fetch(this.appendVersion('assets/asset-manifest.json'));
            if (!res.ok) throw new Error('Failed to load assets/asset-manifest.json');
            this.assetManifest = await res.json();
        }
        return this.assetManifest;
    }

    expandFeatureTokens(list, conditional, features) {
        const expanded = [];
        for (const entry of list) {
            if (entry.startsWith('@')) {
                const key = entry.slice(1);
                if (features[key]) expanded.push(...(conditional[key] || []));
            } else {
                expanded.push(entry);
            }
        }
        return expanded;
    }

    async inlineCss(features, logEl) {
        const manifest = await this.loadAssetManifest();
        const cssFiles = this.expandFeatureTokens(manifest.portableCss, manifest.conditional || {}, features)
            .filter(file => file.endsWith('.css'));

        const contents = [];
        let cssTotal = 0;
        for (const file of cssFiles) {
            const text = await this.fetchText(file);
            const inlined = await this.inlineCssUrls(text, file);
            contents.push(this.minifyCss(inlined));
            const size = this.byteLength(inlined);
            cssTotal += size;
            this.log(logEl, `✓ Inlined CSS: ${file} (${this.formatBytes(size)})`);
        }
        const joined = contents.join('\n');
        this.log(logEl, `CSS bundle size: ${this.formatBytes(this.byteLength(joined))} (sources ${this.formatBytes(cssTotal)})`);
        return joined;
    }

    async inlineCssUrls(css, fromPath) {
        const urlRegex = /url\(([^)]+)\)/g;
        const replacements = [];
        let match;
        while ((match = urlRegex.exec(css)) !== null) {
            const raw = match[1].trim().replace(/['"]/g, '');
            if (!raw || raw.startsWith('data:') || raw.startsWith('http') || raw.startsWith('#')) continue;
            const assetPath = this.resolvePath(fromPath, raw);
            const mime = this.getMimeType(assetPath);
            try {
                const dataUrl = await this.fetchAsDataUrl(assetPath, mime);
                replacements.push({ target: match[0], replacement: `url(${dataUrl})` });
            } catch (err) {
                console.warn(`Skipping inline for ${assetPath}: ${err.message || err}`);
            }
        }
        replacements.forEach(({ target, replacement }) => {
            css = css.split(target).join(replacement);
        });
        return css;
    }

    minifyCss(text) {
        return text
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s{2,}/g, ' ')
            .replace(/\n\s*/g, '\n')
            .trim();
    }

    async inlineJs(features, logEl, portableVersion) {
        const normalizedFeatures = { ...features, media: false, collab: false };
        const files = await this.getJsFiles(normalizedFeatures);
        const bundleParts = [
            `window.isPortableBuild = true;`,
            `window.cacheverzija = '${portableVersion}';`,
            `window.sfssFeatures = ${JSON.stringify(normalizedFeatures)};`,
            `localStorage.setItem('sfss_features', JSON.stringify(window.sfssFeatures));`
        ];
        this.log(logEl, 'Excluded modules: Collaboration, Media Player');

        let jsTotal = 0;
        for (const file of files) {
            let code = await this.fetchText(file);
            code = this.prepareModule(code, file);
            bundleParts.push(`// ${file}\n${code.trim()}`);
            const size = this.byteLength(code);
            jsTotal += size;
            this.log(logEl, `✓ Bundled script: ${file} (${this.formatBytes(size)})`);
        }

        bundleParts.push(this.getFeatureManagerStub(normalizedFeatures));
        bundleParts.push(this.getMediaStubCode()); // always stubbed in portable
        bundleParts.push(this.getCollabStubCode()); // always stubbed in portable
        bundleParts.push(this.getPortableUiPatches());

        bundleParts.push(this.getBootstrapCode());

        const joined = bundleParts.join('\n\n');
        this.log(logEl, `JS bundle size: ${this.formatBytes(this.byteLength(joined))} (modules ${this.formatBytes(jsTotal)})`);
        return joined;
    }

    async getJsFiles(features) {
        const manifest = await this.loadAssetManifest();
        return this.expandFeatureTokens(manifest.portableJsOrder, manifest.conditional || {}, features)
            .filter(file => file.endsWith('.js'));
    }

    prepareModule(code, file) {
        if (file.endsWith('Constants.js')) {
            const transformed = this.transformExports(code);
            return `${transformed}
window.SFSS_CONSTANTS = { ELEMENT_TYPES, TYPE_LABELS, TYPE_SHORTCUTS, FDX_MAP, FDX_REVERSE_MAP, FORMATTING, PAPER_CONFIGS, ELEMENT_INDENTS, CHARACTER_SUFFIXES };
window.constants = window.SFSS_CONSTANTS;`;
        }

        if (file.endsWith('trystero.min.js')) {
            const transformed = this.transformExports(code);
            return `${transformed}
window.joinRoom = typeof joinRoom !== 'undefined' ? joinRoom : (typeof Y !== 'undefined' ? Y : undefined);`;
        }

        if (file.endsWith('Shortcuts.js')) {
            // Shortcuts.js is consumed via a namespace import (import * as
            // Shortcuts). Rebuild that namespace object from the module's own
            // export statements so the list can never drift out of date.
            const names = [...code.matchAll(/export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]);
            const transformed = this.transformExports(code);
            return `${transformed}
window.SFSS_SHORTCUTS = { ${names.join(', ')} };`;
        }

        code = code.replace(/import\s+\*\s+as\s+constants\s+from\s+['"]\.\/Constants.js['"];?/g, 'var constants = window.SFSS_CONSTANTS;');
        code = code.replace(/import\s+\*\s+as\s+Shortcuts\s+from\s+['"]\.\/Shortcuts.js['"];?/g, 'var Shortcuts = window.SFSS_SHORTCUTS;');
        code = code.replace(/import\s*{\s*joinRoom\s*}\s*from\s*['"]\.\.\/trystero.min.js['"];?/g, 'var joinRoom = window.joinRoom;');
        // Remove remaining import lines (avoid clobbering strings containing "import")
        code = code.replace(/^\s*import[^;]+;\s*$/gm, '');
        code = this.transformExports(code);
        return code;
    }

    transformExports(code) {
        return code
            .replace(/export\s+default\s+/g, '')
            .replace(/export\s+class\s+/g, 'class ')
            .replace(/export\s+function\s+/g, 'function ')
            .replace(/export\s+const\s+/g, 'const ')
            .replace(/export\s+let\s+/g, 'let ')
            .replace(/export\s*\{[^}]*\};?/g, '');
    }

    getFeatureManagerStub(features) {
        return `
class FeatureManager {
    constructor(app) {
        this.app = app;
        this.flags = window.sfssFeatures || ${JSON.stringify(features)};
    }
    getFlags() { return { ...this.flags }; }
    setFlag(id, value) { this.flags[id] = !!value; }
    async loadFeatures() {
        await Promise.all([
            this.applyMedia(this.flags.media),
            this.applyCollab(this.flags.collab)
        ]);
        this.renderUiState();
    }
    renderUiState() {
        const musicPlayer = document.getElementById('music-player');
        if (musicPlayer) musicPlayer.classList.toggle('hidden', !this.flags.media);
    }
    ensureStyle() {}
    openModal() { alert('App Builder is not available in the portable build.'); }
    closeModal() {}
    applyAndReload() {}

    async applyMedia(enabled) {
        const player = document.getElementById('music-player');
        if (!window.sfssFeatures?.media || !enabled) {
            this.app.mediaPlayer = this.createMediaStub();
            if (player) player.classList.add('hidden');
            return;
        }
        if (this.app.mediaPlayer && !this.app.mediaPlayer.__isStub) return;
        if (window.MediaPlayer) {
            this.app.mediaPlayer = new window.MediaPlayer(this.app);
            await this.app.mediaPlayer.updatePlaylist?.();
            if (player) player.classList.remove('hidden');
        } else {
            this.app.mediaPlayer = this.createMediaStub();
            if (player) player.classList.add('hidden');
        }
    }

    async applyCollab(enabled) {
        const collabBtn = document.getElementById('collab-menu-btn');
        if (!window.sfssFeatures?.collab || !enabled) {
            this.app.collaborationManager = this.createCollabManagerStub();
            this.app.collabUI = this.createCollabUIStub();
            if (collabBtn) collabBtn.classList.add('hidden');
            return;
        }
        if (collabBtn) collabBtn.classList.remove('hidden');
        if (this.app.collaborationManager && !this.app.collaborationManager.__isStub) return;
        if (window.CollaborationManager && window.CollabUI) {
            this.app.collaborationManager = new window.CollaborationManager(this.app);
            this.app.collabUI = new window.CollabUI(this.app);
        } else {
            this.app.collaborationManager = this.createCollabManagerStub();
            this.app.collabUI = this.createCollabUIStub();
        }
    }

    createMediaStub() {
        return ${this.getMediaStubInstance()};
    }

    createCollabManagerStub() {
        return ${this.getCollabManagerStub()};
    }

    createCollabUIStub() {
        return ${this.getCollabUIStub()};
    }

    async downloadPortable(statusEl) {
        if (statusEl) statusEl.textContent = 'This is already a portable build.';
        alert('This build is already portable. Rebuild from the hosted app to change features.');
    }
}
`;
    }

    getPortableUiPatches() {
        return `
(function() {
    // Hide collab/music UI outright
    const hideUi = () => {
        ['collab-menu-btn', 'music-player', 'feature-builder-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        document.querySelectorAll('[data-action="feature-builder"]').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.collab-only').forEach(el => el.classList.add('hidden'));
    };
    document.addEventListener('DOMContentLoaded', hideUi);

    const extractId = (url) => {
        if (!url) return null;
        const match = url.match(/(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/|v\\/))([\\w-]{11})/i);
        return match ? match[1] : null;
    };

    // Sidebar: allow saving plain links without metadata and render as anchors
    SidebarManager.prototype.renderTrackArea = function(sceneId) {
        const trackArea = document.getElementById('track-area');
        if (!trackArea) return;
        const meta = this.app.sceneMeta[sceneId] || {};
        const link = meta.track;

        const clearTrack = () => {
            if (!this.app.sceneMeta[sceneId]) return;
            this.app.sceneMeta[sceneId].track = '';
            this.app.sceneMeta[sceneId].trackTitle = '';
            this.app.sceneMeta[sceneId].trackArtist = '';
            this.saveSceneMeta(sceneId);
            this.renderTrackArea(sceneId);
        };

        if (link) {
            trackArea.innerHTML = \`
                <div class="track-display">
                    <a href="\${link}" target="_blank" rel="noopener">\${link}</a>
                    <button class="btn-icon" id="remove-track-btn" title="Remove track"><i class="fas fa-times"></i></button>
                </div>
            \`;
            const removeBtn = trackArea.querySelector('#remove-track-btn');
            if (removeBtn) removeBtn.addEventListener('click', clearTrack);
            return;
        }

        trackArea.innerHTML = \`
            <div class="track-drop-zone">
                <i class="fab fa-youtube"></i>
                <span>Ctrl+V or click to paste YouTube URL</span>
            </div>
        \`;
        const dropZone = trackArea.querySelector('.track-drop-zone');
        const handler = (text) => {
            const videoId = extractId(text);
            if (!videoId) {
                alert('Invalid YouTube URL');
                return;
            }
            if (!this.app.sceneMeta[sceneId]) this.app.sceneMeta[sceneId] = {};
            this.app.sceneMeta[sceneId].track = text;
            this.app.sceneMeta[sceneId].trackTitle = text;
            this.app.sceneMeta[sceneId].trackArtist = '';
            this.saveSceneMeta(sceneId);
            this.renderTrackArea(sceneId);
        };
        dropZone.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                handler(text);
            } catch (err) {
                alert('Could not read clipboard. Please paste with Ctrl+V.');
            }
        });
        dropZone.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            handler(text);
        });
    };

    // Treatment: accept links without metadata and show anchors instead of play buttons
    const originalShowMusicInput = TreatmentRenderer.prototype.showMusicInput;
    TreatmentRenderer.prototype.showMusicInput = function(btn, container, scene) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'treatment-char-input';
        input.placeholder = 'PASTE YOUTUBE URL...';
        input.style.width = '200px';

        wrapper.appendChild(input);
        btn.style.display = 'none';

        const finish = () => {
            const val = input.value.trim();
            if (val) {
                const videoId = extractId(val);
                if (videoId) {
                    if (!this.app.sceneMeta[scene.slug.id]) this.app.sceneMeta[scene.slug.id] = {};
                    this.app.sceneMeta[scene.slug.id].track = val;
                    this.app.sceneMeta[scene.slug.id].trackTitle = val;
                    this.app.sceneMeta[scene.slug.id].trackArtist = '';
                    this.app.sidebarManager.saveSceneMeta(scene.slug.id);
                    this.app.refreshTreatmentView();
                } else {
                    alert('Invalid YouTube URL');
                }
            }
            wrapper.remove();
            if (!val) {
                btn.style.display = '';
                if (container.classList.contains('empty-section') && container.children.length === 0) {
                    container.remove();
                }
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(); }
            if (e.key === 'Escape') { e.preventDefault(); wrapper.remove(); btn.style.display = ''; }
        });
        input.addEventListener('blur', () => setTimeout(() => finish(), 50));
        input.addEventListener('paste', () => setTimeout(() => finish(), 100));

        const parent = btn.parentElement;
        if (parent.classList.contains('treatment-controls-area')) {
            container.appendChild(wrapper);
        } else {
            parent.appendChild(wrapper);
        }
        input.focus();
    };

    const originalRenderTreatment = TreatmentRenderer.prototype.renderTreatment;
    TreatmentRenderer.prototype.renderTreatment = function(...args) {
        const result = originalRenderTreatment.apply(this, args);
        try {
            document.querySelectorAll('.treatment-music-row').forEach(row => {
                row.querySelector('.treatment-music-play-btn')?.remove();
                const info = row.querySelector('.treatment-music-info');
                const block = row.closest('[data-scene-id]');
                const sceneId = block ? block.dataset.sceneId : null;
                const track = sceneId ? (this.app.sceneMeta[sceneId]?.track || '') : '';
                if (info) {
                    info.textContent = '';
                    if (track) {
                        const a = document.createElement('a');
                        a.href = track;
                        a.target = '_blank';
                        a.rel = 'noopener';
                        a.textContent = track;
                        info.appendChild(a);
                    } else {
                        info.textContent = 'Track Attached';
                    }
                }
            });
        } catch (err) {
            console.warn('Portable music row patch failed', err);
        }
        return result;
    };
})();
`;
    }

    getBootstrapCode() {
        return `
(function() {
    window.deferredInstallPrompt = null;
    window.showPwaInstallButton = () => {
        const installBtn = document.getElementById('install-pwa-btn');
        if (installBtn) installBtn.classList.remove('hidden');
        const mobileInstallBtn = document.querySelector('[data-action="install-pwa"]');
        if (mobileInstallBtn) mobileInstallBtn.classList.remove('hidden');
    };

    window.onYouTubeIframeAPIReady = function() {
        if (window.app && window.app.mediaPlayer && window.app.mediaPlayer.onYouTubeIframeAPIReady) {
            window.app.mediaPlayer.onYouTubeIframeAPIReady();
        }
    };

    window.app = new SFSS();
    const changelogHeader = document.querySelector('#help-changelog h3');
    if (changelogHeader) changelogHeader.textContent = 'Version ' + window.cacheverzija;
})();
`;
    }

    triggerDownload(html, portableVersion, logEl) {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sfss_${portableVersion}.html`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        this.log(logEl, `HTML size: ${this.formatBytes(this.byteLength(html))}`);
    }

    async fetchText(path) {
        const res = await fetch(this.appendVersion(path));
        if (!res.ok) throw new Error(`Failed to load ${path}`);
        return res.text();
    }

    async fetchAsDataUrl(path, mimeHint) {
        if (this.dataUrlCache.has(path)) return this.dataUrlCache.get(path);
        const res = await fetch(this.appendVersion(path));
        if (!res.ok) throw new Error(`Failed to load asset ${path}`);
        const buffer = await res.arrayBuffer();
        const base64 = this.arrayBufferToBase64(buffer);
        const mime = mimeHint || this.getMimeType(path) || 'application/octet-stream';
        const dataUrl = `data:${mime};base64,${base64}`;
        this.dataUrlCache.set(path, dataUrl);
        return dataUrl;
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
    }

    appendVersion(path) {
        if (path.includes('://') || path.startsWith('data:')) return path;
        return path.includes('?') ? path : `${path}?v=${this.version}`;
    }

    byteLength(str) {
        return new TextEncoder().encode(str).length;
    }

    formatBytes(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB'];
        const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
        const value = bytes / Math.pow(1024, i);
        return `${value.toFixed(1)} ${units[i]}`;
    }

    resolvePath(base, relative) {
        const baseParts = base.split('/');
        baseParts.pop();
        const cleanRelative = relative.split('#')[0].split('?')[0];
        cleanRelative.split('/').forEach(part => {
            if (!part || part === '.') return;
            if (part === '..') baseParts.pop();
            else baseParts.push(part);
        });
        return baseParts.join('/');
    }

    getMimeType(path) {
        const lower = path.toLowerCase();
        if (lower.endsWith('.png')) return 'image/png';
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
        if (lower.endsWith('.svg')) return 'image/svg+xml';
        if (lower.endsWith('.woff2')) return 'font/woff2';
        if (lower.endsWith('.woff')) return 'font/woff';
        if (lower.endsWith('.ttf')) return 'font/ttf';
        if (lower.endsWith('.eot')) return 'application/vnd.ms-fontobject';
        if (lower.endsWith('.css')) return 'text/css';
        if (lower.endsWith('.js')) return 'application/javascript';
        return 'application/octet-stream';
    }

    escapeHtml(text) {
        return sharedEscapeHtml(text || '');
    }

    escapeScript(code) {
        return code.replace(/<\/script/gi, '<\\/script');
    }

    getMediaStubCode() {
        return `
class MediaPlayer {
    constructor(){ this.__isStub = true; this.playlist = []; }
    updatePlaylist() {}
    extractYouTubeVideoId(url){
        if (!url) return null;
        const m = url.match(/(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/|v\\/))([\\w-]{11})/i);
        return m ? m[1] : null;
    }
    _fetchTrackMetadata(url){ return Promise.resolve({ title: url, artist: '' }); }
    ensureYouTubeAPILoaded(){}
    onYouTubeIframeAPIReady(){}
    reset(){}
    playTrackById(){}
    playPrevTrack(){}
    togglePlay(){}
    playNextTrack(){}
}
`;
    }

    getMediaStubInstance() {
        return `{
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
}`;
    }

    getCollabManagerStub() {
        return `{
    __isStub: true,
    connect: () => { alert('Collaboration is disabled in this portable build. Enable it in the hosted app before exporting.'); return false; },
    disconnect: () => {},
    stopMedia: () => {},
    toggleAudio: () => {},
    toggleVideo: () => {},
    enableMedia: async () => ({ success:false }),
    passBaton: () => {},
    takeBaton: () => {},
    sendUpdate: () => {},
    broadcast: () => {},
    room: null
}`;
    }

    getCollabUIStub() {
        return `{
    __isStub: true,
    openModal: () => alert('Collaboration is disabled in this portable build. Enable it in the hosted app before exporting.'),
    joinFromUrl: () => {}
}`;
    }

    getCollabStubCode() {
        return `
class CollaborationManager {
    constructor(){ this.__isStub = true; }
    connect(){ alert('Collaboration is disabled in this portable build.'); return false; }
    disconnect(){}
    stopMedia(){}
    toggleAudio(){}
    toggleVideo(){}
    enableMedia(){ return Promise.resolve({ success:false }); }
    passBaton(){}
    takeBaton(){}
    sendUpdate(){}
    broadcast(){}
}
class CollabUI {
    constructor(){ this.__isStub = true; }
    openModal(){ alert('Collaboration is disabled in this portable build.'); }
    joinFromUrl(){}
}
`;
    }
}

// Guarded so the module stays import-safe under Node (test harness).
if (typeof window !== 'undefined') window.SingleFileGenerator = SingleFileGenerator;
