// Central modal registry: one open/close path for every modal, with a stack
// (modals can layer), focus trap + restore, backdrop-click close and ARIA
// wiring. Escape is NOT handled here — SFSS.handleBackOrEscape calls
// closeTop() so the app keeps a single Escape entry point (see the dispatch
// contract in Shortcuts.js).

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class ModalManager {
    constructor(app) {
        this.app = app;
        this.registry = new Map();
        this.stackIds = [];
        document.addEventListener('keydown', (e) => this._handleTab(e));
    }

    register(id, opts = {}) {
        const overlay = document.getElementById(id);
        if (!overlay) return null;
        const entry = {
            id,
            overlay,
            backdropClose: opts.backdropClose !== false,
            canClose: opts.canClose || (() => true),
            onOpen: opts.onOpen || null,
            onClose: opts.onClose || null,
            initialFocus: opts.initialFocus || null,
            trapFocus: opts.trapFocus !== false,
            opener: null
        };

        const dialog = overlay.querySelector('.modal-window, .popup-window') || overlay.firstElementChild || overlay;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        const header = overlay.querySelector('.modal-header span, .modal-header h2, h2, h3');
        if (header) {
            if (!header.id) header.id = `${id}-title`;
            dialog.setAttribute('aria-labelledby', header.id);
        }

        if (opts.closeBtnId) {
            const btn = document.getElementById(opts.closeBtnId);
            if (btn) btn.addEventListener('click', () => this.close(id));
        }
        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay && entry.backdropClose && entry.canClose()) this.close(id);
        });

        this.registry.set(id, entry);
        return entry;
    }

    isOpen(id) {
        return this.stackIds.includes(id);
    }

    get top() {
        return this.stackIds.length ? this.registry.get(this.stackIds[this.stackIds.length - 1]) : null;
    }

    get stack() {
        return this.stackIds.slice();
    }

    open(id) {
        const entry = this.registry.get(id);
        if (!entry) {
            // Unregistered modal: fall back to raw toggle so nothing breaks.
            const el = document.getElementById(id);
            if (el) el.classList.remove('hidden');
            return;
        }
        if (this.isOpen(id)) return;
        entry.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        entry.overlay.classList.remove('hidden');
        this.stackIds.push(id);
        if (entry.onOpen) entry.onOpen();
        this._focusInitial(entry);
        if (this.app && this.app.pushHistoryState) this.app.pushHistoryState(id);
    }

    close(id) {
        const entry = this.registry.get(id);
        if (!entry) {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
            return false;
        }
        if (!this.isOpen(id)) return false;
        entry.overlay.classList.add('hidden');
        this.stackIds = this.stackIds.filter(sid => sid !== id);
        if (entry.onClose) entry.onClose();
        if (entry.opener && document.contains(entry.opener)) {
            entry.opener.focus();
        }
        entry.opener = null;
        return true;
    }

    // Closes the top-most closable modal. Returns true if one closed.
    closeTop() {
        for (let i = this.stackIds.length - 1; i >= 0; i--) {
            const entry = this.registry.get(this.stackIds[i]);
            if (entry.canClose()) return this.close(entry.id);
        }
        return false;
    }

    _focusInitial(entry) {
        let target = null;
        if (entry.initialFocus) target = entry.overlay.querySelector(entry.initialFocus);
        if (!target && entry.trapFocus) target = entry.overlay.querySelector(FOCUSABLE);
        if (target) target.focus();
    }

    _handleTab(e) {
        if (e.key !== 'Tab') return;
        const entry = this.top;
        if (!entry || !entry.trapFocus) return;
        const focusables = Array.from(entry.overlay.querySelectorAll(FOCUSABLE))
            .filter(el => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (!entry.overlay.contains(active)) {
            e.preventDefault();
            first.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        } else if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        }
    }
}
