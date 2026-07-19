// script.js content
window.deferredInstallPrompt = null;

window.showPwaInstallButton = () => {
    const installBtn = document.getElementById('install-pwa-btn');
    if (installBtn) installBtn.classList.remove('hidden');
    
    const mobileInstallBtn = document.querySelector('[data-action="install-pwa"]');
    if (mobileInstallBtn) mobileInstallBtn.classList.remove('hidden');
};

window.addEventListener('beforeinstallprompt', (e) => {
    window.deferredInstallPrompt = e;
    window.showPwaInstallButton();
    console.log(`'beforeinstallprompt' event was fired.`);
});

(async () => {
    const queryString = self.location.search;
    const params = new URLSearchParams(queryString);
    const cachesecondary = window.cacheverzija ? window.cacheverzija : "1";
    const CACHE_NAME = params.get('v') ? params.get('v') : cachesecondary; 

    // Unified entry point: Always load SFSS
    const { SFSS } = await import('./js-mod/SFSS.js?v=' + CACHE_NAME);
    window.SFSS = SFSS;
    window.app = new SFSS();
    
    window.onYouTubeIframeAPIReady = function() {
        if (window.app && window.app.mediaPlayer) {
            window.app.mediaPlayer.onYouTubeIframeAPIReady();
        }
    };

    if ('serviceWorker' in navigator) {
        // Reload once when the updated SW takes control -- but never on the very
        // first install (clients.claim() fires controllerchange then too).
        let hadController = !!navigator.serviceWorker.controller;
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!hadController) { hadController = true; return; }
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

        const showUpdateBanner = (registration) => {
            if (document.getElementById('update-banner')) return;
            const banner = document.createElement('div');
            banner.id = 'update-banner';
            const label = document.createElement('span');
            label.textContent = 'A new version of SFSS is ready';
            const reloadBtn = document.createElement('button');
            reloadBtn.type = 'button';
            reloadBtn.textContent = 'Reload';
            reloadBtn.addEventListener('click', () => {
                reloadBtn.disabled = true;
                if (registration.waiting) {
                    // The SW answers with skipWaiting(); controllerchange reloads us.
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else {
                    window.location.reload();
                }
            });
            banner.appendChild(label);
            banner.appendChild(reloadBtn);
            const attach = () => document.body.appendChild(banner);
            if (document.body) attach();
            else document.addEventListener('DOMContentLoaded', attach);
        };

        const registerSW = () => {
            navigator.serviceWorker.register('./sw.js?v=' + CACHE_NAME).then(registration => {
                console.log('SW registered: ', registration);
                // An update may already be sitting in "waiting" from a previous visit.
                if (registration.waiting && navigator.serviceWorker.controller) {
                    showUpdateBanner(registration);
                }
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker == null) return;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('New content is available; please refresh.');
                                showUpdateBanner(registration);
                            } else {
                                console.log('Content is cached for offline use.');
                            }
                        }
                    };
                };
            }).catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        };

        if (document.readyState === 'complete') {
            registerSW();
        } else {
            window.addEventListener('load', registerSW);
        }
    }

})();