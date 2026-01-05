export class MediaPlayer {
    constructor(app) {
        this.app = app;
        this.musicPlayer = document.getElementById('music-player');
        this.playerIndicator = document.getElementById('player-scene-indicator');
        this.prevBtn = document.getElementById('player-prev');
        this.playBtn = document.getElementById('player-play');
        this.nextBtn = document.getElementById('player-next');

        this.youtubePlayer = null;
        this.playlist = [];
        this.currentTrackIndex = -1;
        this.isPlaying = false;
        this.isApiLoading = false;
        this.pendingPlay = false;

        this.initListeners();
    }

    cleanAuthorName(name) {
        if (!name) return name;
        return name.replace(/\s*-\s*topic$/i, '').trim();
    }

    initListeners() {
        this.prevBtn.addEventListener('click', () => this.playPrevTrack());
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.nextBtn.addEventListener('click', () => this.playNextTrack());

        this.prevBtn.addEventListener('mouseenter', () => this.showPreview('prev'));
        this.prevBtn.addEventListener('mouseleave', () => this.updatePlayerIndicator());
        this.nextBtn.addEventListener('mouseenter', () => this.showPreview('next'));
        this.nextBtn.addEventListener('mouseleave', () => this.updatePlayerIndicator());
        
        this.playerIndicator.addEventListener('click', () => {
            const index = this.currentTrackIndex !== -1 ? this.currentTrackIndex : 0;
            if (this.playlist[index]) {
                this.app.scrollToScene(this.playlist[index].sceneId);
            }
        });
    }

    onYouTubeIframeAPIReady() {
        this.youtubePlayer = new YT.Player('youtube-player-container', {
            height: '0', width: '0',
            host: 'https://www.youtube-nocookie.com',
            playerVars: { 'playsinline': 1, 'origin': window.location.origin },
            events: {
                'onReady': () => {
                    if (this.pendingPlay) {
                        this.pendingPlay = false;
                        if (this.currentTrackIndex !== -1) {
                            this._playTrackAtIndex(this.currentTrackIndex);
                        } else if (this.playlist.length > 0) {
                            this._playTrackAtIndex(0);
                        }
                    }
                },
                'onStateChange': this.onPlayerStateChange.bind(this),
                'onError': (e) => console.error('YouTube Player Error:', e.data)
            }
        });
    }

    ensureYouTubeAPILoaded() {
        if ((!window.YT || !window.YT.Player) && !this.isApiLoading) {
            this.isApiLoading = true;
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else if (window.YT && window.YT.Player && !this.youtubePlayer) {
             this.onYouTubeIframeAPIReady();
        }
    }

    onPlayerStateChange(event) {
        const playBtnIcon = this.playBtn.querySelector('i');
        if (event.data === YT.PlayerState.PLAYING) {
            this.isPlaying = true;
            playBtnIcon.className = 'fas fa-pause';
        } else {
            this.isPlaying = false;
            playBtnIcon.className = 'fas fa-play';
        }
        if (event.data === YT.PlayerState.ENDED) {
            this.playNextTrack();
        }
        this.updatePlayerIndicator();
    }
    
    async updatePlaylist() {
        this.playlist = [];
        const slugs = this.app.editor.querySelectorAll(`.${this.app.ELEMENT_TYPES.SLUG}`);
        
        const trackPromises = Array.from(slugs).map(async (slug, index) => {
            const sceneId = slug.dataset.lineId;
            const meta = this.app.sceneMeta[sceneId];

            if (meta && meta.track) {
                const videoId = this.extractYouTubeVideoId(meta.track);
                if (videoId) {
                    // If we don't have the title, fetch it.
                    if (!meta.trackTitle || !meta.trackArtist) {
                        const fetchedMeta = await this._fetchTrackMetadata(videoId);
                        if (fetchedMeta) {
                            meta.trackTitle = fetchedMeta.title;
                            meta.trackArtist = fetchedMeta.artist;
                            // No need to save here, as it's just hydrating. Main save is elsewhere.
                        }
                    }
                    if (meta.trackArtist) {
                        const cleaned = this.cleanAuthorName(meta.trackArtist);
                        if (cleaned !== meta.trackArtist) {
                            meta.trackArtist = cleaned;
                        }
                    }
                    return { 
                        videoId: videoId, 
                        sceneId: sceneId,
                        sceneTitle: slug.textContent.trim() || 'UNTITLED',
                        sceneNumber: index + 1,
                        trackArtist: meta.trackArtist,
                        trackTitle: meta.trackTitle
                    };
                }
            }
            return null;
        });

        this.playlist = (await Promise.all(trackPromises)).filter(p => p !== null);

        if (this.playlist.length > 0) {
            this.musicPlayer.classList.remove('hidden');
        } else {
            this.musicPlayer.classList.add('hidden');
            this.currentTrackIndex = -1;
        }

        const isNavDisabled = this.playlist.length <= 1;
        this.prevBtn.disabled = isNavDisabled;
        this.nextBtn.disabled = isNavDisabled;

        this.updatePlayerIndicator();
        this.app.sidebarManager.updateSceneList();
    }
    
    async _fetchTrackMetadata(videoId) {
        if (!videoId) return null;
        try {
            const response = await fetch(`https://www.youtube.com/oembed?url=http%3A//youtube.com/watch%3Fv%3D${videoId}&format=json`);
            if (!response.ok) return null;
            const data = await response.json();
            const cleanAuthor = this.cleanAuthorName(data.author_name) || data.author_name;
            return {
                title: data.title,
                artist: cleanAuthor
            };
        } catch (error) {
            console.error('Failed to fetch YouTube metadata:', error);
            return null;
        }
    }

    extractYouTubeVideoId(url) {
        if (!url) return null;
        try {
            const urlObj = new URL(url);
            let videoId = urlObj.hostname === 'youtu.be' 
                ? urlObj.pathname.slice(1).split('/')[0] 
                : urlObj.searchParams.get('v');
            if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return videoId;
        } catch (e) { /* not a valid URL */ }
        return null;
    }

    updatePlayerIndicator(index) {
        if (!this.playerIndicator) return;
        
        const trackIndex = (index !== undefined) ? index : this.currentTrackIndex;
        const isShowingCurrentTrack = (index === undefined) || (index === this.currentTrackIndex);
        const shouldScroll = this.isPlaying && isShowingCurrentTrack;

        if (shouldScroll) {
            this.playerIndicator.classList.add('is-playing');
        } else {
            this.playerIndicator.classList.remove('is-playing');
        }

        let text = '';
        let title = '';

        if (this.playlist.length > 0) {
            const track = this.playlist[trackIndex === -1 ? 0 : trackIndex];
            if (track) {
                const sceneInfo = `${track.sceneNumber}. ${track.sceneTitle}`;
                
                if (shouldScroll && track.trackTitle) {
                    // Playing: Show Scene Info + Track Info
                    text = `${sceneInfo} <i class="fas fa-music fa-fw scene-music-icon"></i> ${track.trackArtist} - ${track.trackTitle} &nbsp;`;
                    title = text;
                } else {
                    // Paused or Preview: Show Scene Info only
                    text = sceneInfo;
                    title = track.sceneTitle;
                }
            }
        }
        
        this.playerIndicator.innerHTML = `<span class="marquee-text">${text}</span>`;
        this.playerIndicator.title = title;
    }

    showPreview(direction) {
        if (this.playlist.length <= 1) return;
        
        let previewIndex;
        if (this.currentTrackIndex === -1) {
            if (direction === 'next') {
                previewIndex = 0;
            } else { // 'prev'
                previewIndex = this.playlist.length - 1;
            }
        } else {
            if (direction === 'next') {
                previewIndex = (this.currentTrackIndex + 1) % this.playlist.length;
            } else { // 'prev'
                previewIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
            }
        }
        this.updatePlayerIndicator(previewIndex);
    }
    
    _playTrackAtIndex(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentTrackIndex = index;
        
        if (!this.youtubePlayer || !this.youtubePlayer.loadVideoById) {
            this.pendingPlay = true;
            this.ensureYouTubeAPILoaded();
            return;
        }

        const trackObject = this.playlist[this.currentTrackIndex];
        this.youtubePlayer.loadVideoById(trackObject.videoId);
        this.app.scrollToScene(trackObject.sceneId);
        // Defer indicator update until state change, but can prime it
        this.updatePlayerIndicator(); 
    }

    playTrackById(videoId) {
        const index = this.playlist.findIndex(track => track.videoId === videoId);
        if (index !== -1) {
            this._playTrackAtIndex(index);
        }
    }
    
    playPrevTrack() {
        if (this.playlist.length <= 1) return;
        const newIndex = this.currentTrackIndex === -1
            ? this.playlist.length - 1 // If nothing playing, start from last
            : (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
        this._playTrackAtIndex(newIndex);
    }

    togglePlay() {
        if (this.playlist.length === 0) return;
        
        if (!this.youtubePlayer || !this.youtubePlayer.getPlayerState) {
            this.pendingPlay = true;
            this.ensureYouTubeAPILoaded();
            return;
        }

        if (this.currentTrackIndex === -1) {
            this._playTrackAtIndex(0);
            return;
        }

        const playerState = this.youtubePlayer.getPlayerState();
        if (playerState === YT.PlayerState.PLAYING) {
            this.youtubePlayer.pauseVideo();
        }
        else {
            this.youtubePlayer.playVideo();
        }
    }

    playNextTrack() {
        if (this.playlist.length <= 1) return;
        const newIndex = this.currentTrackIndex === -1
            ? 0 // If nothing playing, start from first
            : (this.currentTrackIndex + 1) % this.playlist.length;
        this._playTrackAtIndex(newIndex);
    }

    reset() {
        if (this.youtubePlayer && this.youtubePlayer.stopVideo) {
            this.youtubePlayer.stopVideo();
        }
        this.playlist = [];
        this.currentTrackIndex = -1;
        this.isPlaying = false;
        this.musicPlayer.classList.add('hidden');
        this.updatePlayerIndicator();
    }
}
