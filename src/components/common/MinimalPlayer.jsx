import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, RotateCcw, RotateCw } from 'lucide-react';

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

const MinimalPlayer = ({ youtubeId, title = 'Video Player' }) => {
  const containerRef = useRef(null);
  const playerMountRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [actionFeedback, setActionFeedback] = useState(null); // 'play' | 'pause'

  // Initialize YouTube Iframe API
  useEffect(() => {
    if (!youtubeId) return;

    let destroyed = false;

    const initPlayer = () => {
      if (destroyed || !playerMountRef.current || !window.YT || !window.YT.Player) return;

      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch (e) {}
      }

      playerRef.current = new window.YT.Player(playerMountRef.current, {
        width: '100%',
        height: '100%',
        videoId: youtubeId,
        playerVars: {
          autoplay: 1,
          mute: 1, // CRITICAL: Required for mobile browsers to allow autoplay
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          cc_lang_pref: 'none',
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          widget_referrer: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (destroyed) return;
            const player = event.target;
            try {
              player.mute();
              player.playVideo();
              setIsMuted(true);

              // Set playsinline on iframe directly for iOS Safari / WebKit
              if (player.getIframe) {
                const iframe = player.getIframe();
                if (iframe) {
                  iframe.setAttribute('playsinline', '1');
                  iframe.setAttribute('webkit-playsinline', '1');
                  iframe.setAttribute('x5-playsinline', 'true');
                  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
                }
              }

              // Force captions OFF
              if (player.unloadModule) {
                player.unloadModule('captions');
                player.unloadModule('cc');
              }

              // Force Maximum Resolution
              if (player.setPlaybackQuality) {
                player.setPlaybackQuality('hd1080');
                player.setPlaybackQuality('highres');
              }
            } catch (e) {
              console.error(e);
            }
            setDuration(player.getDuration() || 0);
            setIsReady(true);
          },
          onStateChange: (event) => {
            if (destroyed) return;
            const state = event.data;
            if (state === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              try {
                if (event.target.setPlaybackQuality) {
                  event.target.setPlaybackQuality('hd1080');
                  event.target.setPlaybackQuality('highres');
                }
                if (event.target.unloadModule) {
                  event.target.unloadModule('captions');
                }
              } catch (e) {}
            } else if (state === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              setShowControls(true);
            } else if (state === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              setShowControls(true);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          initPlayer();
        }
      }, 100);

      return () => {
        destroyed = true;
        clearInterval(checkInterval);
        if (playerRef.current && playerRef.current.destroy) {
          try { playerRef.current.destroy(); } catch (e) {}
        }
      };
    }

    return () => {
      destroyed = true;
      if (playerRef.current && playerRef.current.destroy) {
        try { playerRef.current.destroy(); } catch (e) {}
      }
    };
  }, [youtubeId]);

  // Track playback time
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          try {
            const current = playerRef.current.getCurrentTime() || 0;
            setCurrentTime(current);
            const dur = playerRef.current.getDuration() || 0;
            if (dur > 0 && dur !== duration) setDuration(dur);
          } catch (e) {}
        }
      }, 250);
    }
    return () => clearInterval(timer);
  }, [isPlaying, duration]);

  // Auto-hide controls during playback
  const triggerActivity = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying]);

  const showFeedback = (type) => {
    setActionFeedback(type);
    setTimeout(() => setActionFeedback(null), 500);
  };

  const togglePlay = (e) => {
    if (e) e.stopPropagation();
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        showFeedback('pause');
      } else {
        playerRef.current.playVideo();
        showFeedback('play');
      }
    } catch (e) {}
    triggerActivity();
  };

  const toggleMute = (e) => {
    if (e) e.stopPropagation();
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume > 0 ? volume : 100);
        setIsMuted(false);
        if (volume === 0) setVolume(100);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch (e) {}
    triggerActivity();
  };

  const handleVolumeSlider = (e) => {
    e.stopPropagation();
    const newVol = Number(e.target.value);
    setVolume(newVol);
    if (!playerRef.current) return;
    try {
      playerRef.current.setVolume(newVol);
      if (newVol === 0) {
        playerRef.current.mute();
        setIsMuted(true);
      } else {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    } catch (e) {}
    triggerActivity();
  };

  const skipTime = (seconds, e) => {
    if (e) e.stopPropagation();
    if (!playerRef.current || duration <= 0) return;
    try {
      const current = playerRef.current.getCurrentTime() || 0;
      const target = Math.max(0, Math.min(duration, current + seconds));
      playerRef.current.seekTo(target, true);
      setCurrentTime(target);
    } catch (e) {}
    triggerActivity();
  };

  const cycleSpeed = (e) => {
    if (e) e.stopPropagation();
    const nextIdx = (SPEED_OPTIONS.indexOf(playbackSpeed) + 1) % SPEED_OPTIONS.length;
    const nextSpeed = SPEED_OPTIONS[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (playerRef.current && playerRef.current.setPlaybackRate) {
      try {
        playerRef.current.setPlaybackRate(nextSpeed);
      } catch (e) {}
    }
    triggerActivity();
  };

  const handleSeek = (e) => {
    if (e) e.stopPropagation();
    if (!playerRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const seekTime = pos * duration;
    try {
      playerRef.current.seekTo(seekTime, true);
      setCurrentTime(seekTime);
    } catch (e) {}
    triggerActivity();
  };

  const handleOverlayClick = (e) => {
    if (e) e.stopPropagation();
    // On touch or desktop: if playing and controls are hidden, tap reveals controls
    if (isPlaying && !showControls) {
      triggerActivity();
      return;
    }
    togglePlay(e);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      ref={containerRef}
      onMouseMove={triggerActivity}
      onTouchStart={triggerActivity}
      onClick={triggerActivity}
      className="relative w-full aspect-video bg-black rounded-none sm:rounded-2xl overflow-hidden shadow-2xl border-y sm:border border-gray-200 dark:border-white/10 select-none group touch-manipulation"
    >
      {/* 
        INVISIBLE YOUTUBE ENGINE LAYER
        Masked and cropped with .yt-masked-engine:
        On mobile: scale(1.44) eliminates mobile title, AI tags, watch later, avatar, and watermarks.
        On desktop: scale(1.26) cleanly clips out the desktop header and watermark.
        pointer-events-none completely blocks any YouTube branding interaction/context menu.
      */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none bg-black flex items-center justify-center">
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:border-0 yt-masked-engine"
        >
          <div ref={playerMountRef} className="w-full h-full" />
        </div>
      </div>

      {/* Click-to-Play/Pause Transparent Overlay */}
      <div 
        onClick={handleOverlayClick}
        className="absolute inset-0 z-10 cursor-pointer" 
      />

      {/* Action Pulse Icon in Center */}
      {actionFeedback && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm animate-ping">
            {actionFeedback === 'play' ? <Play size={28} className="translate-x-0.5 fill-white" /> : <Pause size={28} />}
          </div>
        </div>
      )}

      {/* Unmute Prompt Badge on Autoplay */}
      {isMuted && isPlaying && (
        <button
          onClick={toggleMute}
          className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/80 hover:bg-black text-white text-xs font-semibold backdrop-blur-md transition-all shadow-lg animate-pulse border border-white/15 cursor-pointer"
        >
          <VolumeX size={14} className="text-red-400" /> Tap to Unmute
        </button>
      )}

      {/* Big Play Button when Paused */}
      {!isPlaying && isReady && (
        <div 
          onClick={togglePlay}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[2px] cursor-pointer transition-opacity"
        >
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center text-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'var(--brand-color, #f97316)' }}
          >
            <Play size={28} className="translate-x-0.5 fill-white" />
          </div>
        </div>
      )}

      {/* 100% Custom Minimal Player Controls Bar */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-20 px-3 sm:px-4 pt-8 pb-2.5 sm:pb-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Custom Seekbar with enlarged finger touch zone */}
        <div 
          onClick={handleSeek}
          onTouchStart={handleSeek}
          onTouchMove={handleSeek}
          className="relative w-full py-2.5 -my-2 cursor-pointer touch-none mb-2 sm:mb-3 group/bar"
        >
          <div className="w-full h-1.5 group-hover/bar:h-2 bg-white/25 group-hover/bar:bg-white/35 rounded-full transition-all relative">
            <div 
              className="h-full rounded-full transition-all relative"
              style={{ 
                width: `${progressPercent}%`,
                backgroundColor: 'var(--brand-color, #f97316)'
              }}
            >
              <div 
                className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>

        {/* Controls Layout */}
        <div className="flex items-center justify-between text-white text-xs font-medium">
          {/* Left: Play/Pause, Rewind, Forward, Volume, Time */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={togglePlay}
              className="p-1.5 text-white/90 hover:text-white hover:scale-110 transition-transform rounded-lg hover:bg-white/10"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} className="fill-white/90" />}
            </button>

            <button 
              onClick={(e) => skipTime(-10, e)}
              className="p-1 text-white/70 hover:text-white hover:scale-110 transition-transform"
              title="Rewind 10 seconds"
            >
              <RotateCcw size={15} />
            </button>

            <button 
              onClick={(e) => skipTime(10, e)}
              className="p-1 text-white/70 hover:text-white hover:scale-110 transition-transform"
              title="Forward 10 seconds"
            >
              <RotateCw size={15} />
            </button>

            {/* Volume with Hover Slider */}
            <div className="flex items-center gap-1.5 group/vol">
              <button 
                onClick={toggleMute}
                className="p-1 text-white/80 hover:text-white hover:scale-110 transition-transform"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={17} className="text-red-400" />
                ) : volume < 50 ? (
                  <Volume1 size={17} />
                ) : (
                  <Volume2 size={17} />
                )}
              </button>

              <input 
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeSlider}
                className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-[var(--brand-color,#f97316)] cursor-pointer h-1 opacity-0 group-hover/vol:opacity-100"
                title="Volume"
              />
            </div>

            <span className="text-[12px] text-white/80 tabular-nums ml-1 select-none">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right: Speed Selector, 1080p Badge, Fullscreen */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Speed Selector Button */}
            <button 
              onClick={cycleSpeed}
              className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white/80 hover:text-white hover:bg-white/10 transition-colors border border-white/15"
              title="Playback speed"
            >
              {playbackSpeed}x
            </button>

            {/* HD 1080p Badge */}
            <span 
              className="px-2.5 py-1 rounded text-[11px] font-extrabold tracking-wider uppercase border border-white/20 bg-white/10 shadow-sm"
              style={{ color: 'var(--brand-color, #f97316)' }}
            >
              1080p HD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MinimalPlayer;
