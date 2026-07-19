// Unified non-blocking notification system (replaces scattered alert() calls).
// CollabUI.showToast delegates here so collab keeps its existing call sites.

let container = null;

function ensureContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
    return container;
}

// type: 'info' | 'success' | 'error'
export function toast(message, { type = 'info', duration = 3000 } = {}) {
    const host = ensureContainer();
    while (host.children.length >= 3) host.removeChild(host.firstChild);
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    if (duration > 0) {
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        }, duration);
    }
    return el;
}

// Single seam for destructive-action confirmations. Native dialog for now;
// swapping in a custom dialog later only touches this function.
export function confirmAction(message) {
    return window.confirm(message);
}
