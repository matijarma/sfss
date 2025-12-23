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
        const registerSW = () => {
            navigator.serviceWorker.register('./sw.js?v=' + CACHE_NAME).then(registration => {
                console.log('SW registered: ', registration);
                registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker == null) return;
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('New content is available; please refresh.');
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