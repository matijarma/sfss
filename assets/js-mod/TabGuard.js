// Multi-tab single-writer lock (#1) over BroadcastChannel('sfss-tab-lock').
//
// Protocol:
//   CLAIM    — a booting tab asks "is anyone active?"
//   HELD     — the active tab answers every CLAIM, forever
//   TAKEOVER — a passive tab requests the lock ("Use here")
//   RELEASED — the active tab confirms it flushed and stepped down
//
// Boot: post CLAIM and wait 300ms. A HELD reply means another tab is the
// writer -> this tab goes passive (full-screen overlay, read-only editor,
// autosave/backup polling suspended via the `passive` flag checked in
// SFSS). Silence means this tab becomes the active writer.
//
// Takeover: the passive tab posts TAKEOVER; the active tab saves + flushes
// its debounced IDB writes, flips itself passive (shows its own overlay) and
// replies RELEASED. On RELEASED — or after a 1s timeout, covering an active
// tab that was killed and can never answer — the requesting tab reloads.
// Design decision: location.reload() is used instead of re-running
// loadScript because loadScript early-returns when the script id is
// unchanged; a reload guarantees a completely fresh read of LS + IDB.
//
// If BroadcastChannel is unavailable the guard degrades to a no-op: the tab
// always behaves as the single active writer.

import { generateLineId } from './Utils.js';

const CHANNEL_NAME = 'sfss-tab-lock';
const CLAIM_WAIT_MS = 300;
const RELEASE_WAIT_MS = 1000;

export class TabGuard {
    constructor(app) {
        this.app = app;
        this.tabId = generateLineId();
        this.passive = false;
        this.channel = null;
        this._claimResolve = null;
        this._releaseTimer = null;
        this._overlay = null;
        if (typeof BroadcastChannel === 'undefined') return; // graceful no-op mode
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (e) => this._onMessage(e.data || {});
    }

    // Boot handshake. Must complete before the app performs any storage
    // writes (SFSS.init awaits this before storageManager.init()).
    async claim() {
        if (!this.channel) return;
        this.channel.postMessage({ t: 'CLAIM', tabId: this.tabId });
        const held = await new Promise((resolve) => {
            this._claimResolve = resolve;
            setTimeout(() => resolve(false), CLAIM_WAIT_MS);
        });
        this._claimResolve = null;
        if (held) this._enterPassive();
    }

    _onMessage(msg) {
        switch (msg.t) {
            case 'CLAIM':
                // The active tab answers every claim, forever.
                if (!this.passive) {
                    this.channel.postMessage({ t: 'HELD', tabId: this.tabId });
                }
                break;
            case 'HELD':
                if (this._claimResolve) this._claimResolve(true);
                break;
            case 'TAKEOVER':
                if (!this.passive && msg.tabId !== this.tabId) {
                    this._handleTakeover();
                }
                break;
            case 'RELEASED':
                // Only meaningful while we are waiting on our own TAKEOVER.
                if (this.passive && this._releaseTimer) this._activate();
                break;
        }
    }

    // Active side of a takeover: flush everything, then hand the lock over.
    async _handleTakeover() {
        try {
            if (this.app && this.app.isDirty && this.app.activeScriptId) {
                await this.app.save();
            }
            if (this.app && this.app.storageManager) {
                this.app.storageManager.flushPendingSaves();
            }
        } catch (e) {
            console.error('TabGuard: flush before handover failed', e);
        }
        this._enterPassive();
        this.channel.postMessage({ t: 'RELEASED', tabId: this.tabId });
    }

    // Passive side: "Use here" was clicked.
    requestTakeover() {
        if (!this.channel) return;
        this.channel.postMessage({ t: 'TAKEOVER', tabId: this.tabId });
        // A killed active tab can never answer RELEASED; activate anyway.
        this._releaseTimer = setTimeout(() => this._activate(), RELEASE_WAIT_MS);
    }

    _activate() {
        clearTimeout(this._releaseTimer);
        this._releaseTimer = null;
        this.passive = false;
        this._setReadOnly(false);
        this._removeOverlay();
        this._reload();
    }

    // Separate seam so tests can stub the reload (see the header comment for
    // why takeover reloads instead of re-running loadScript).
    _reload() {
        window.location.reload();
    }

    _enterPassive() {
        this.passive = true;
        this._setReadOnly(true);
        this._showOverlay();
    }

    _setReadOnly(readOnly) {
        const editor = this.app && this.app.editor;
        if (!editor) return;
        if (readOnly) {
            editor.contentEditable = false;
        } else if (!document.body.classList.contains('mobile-view')) {
            // Mobile view keeps the editor non-editable regardless.
            editor.contentEditable = true;
        }
    }

    _showOverlay() {
        if (this._overlay && document.body.contains(this._overlay)) return;
        const overlay = document.createElement('div');
        overlay.id = 'tab-lock-overlay';
        const box = document.createElement('div');
        box.className = 'tab-lock-box';
        const msg = document.createElement('p');
        msg.textContent = 'This screenplay is open in another tab.';
        const btn = document.createElement('button');
        btn.id = 'tab-lock-use-here-btn';
        btn.type = 'button';
        btn.textContent = 'Use here';
        btn.addEventListener('click', () => {
            btn.disabled = true;
            this.requestTakeover();
        });
        box.appendChild(msg);
        box.appendChild(btn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        this._overlay = overlay;
    }

    _removeOverlay() {
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
    }

    // Test/teardown hygiene: close the channel and drop the overlay.
    destroy() {
        clearTimeout(this._releaseTimer);
        this._releaseTimer = null;
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        this._removeOverlay();
    }
}
