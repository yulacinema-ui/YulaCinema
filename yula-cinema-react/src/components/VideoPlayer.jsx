// src/components/VideoPlayer.jsx
import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = ({ url, onPlayerReady }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!playerRef.current && videoRef.current) {
      // In VideoPlayer.jsx - Update your Video.js options object
const player = playerRef.current = videojs(videoRef.current, {
  autoplay: false,
  controls: true,
  responsive: true,
  fluid: true,
  preload: 'auto',
  // ADD THIS SECTION:
  html5: {
    vhs: { overrideNative: true },
    nativeVideoTracks: false,
    nativeAudioTracks: false,
    nativeTextTracks: false
  },
  controlBar: {
    fullscreenToggle: true // Force the button to show
  },
  sources: [{ 
    src: url, 
    type: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4' 
  }]
}, () => {
  // Logic for automatic fullscreen on rotate
  const handleOrientationChange = () => {
    if (window.orientation === 90 || window.orientation === -90) {
      if (player.paused() === false) { // Only go fullscreen if video is playing
        player.requestFullscreen();
      }
    } else {
      if (player.isFullscreen()) {
        player.exitFullscreen();
      }
    }
  };

  window.addEventListener('orientationchange', handleOrientationChange);
  onPlayerReady(player);
});
    }
  }, [url, onPlayerReady]);

  // Clean up on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player className="rounded-xl overflow-hidden shadow-xl">
      <video 
        ref={videoRef} 
        className="video-js vjs-big-play-centered" 
        // CRITICAL: Must have crossOrigin for iOS Web Audio to work
        crossOrigin="anonymous" 
        playsInline 
      />
    </div>
  );
};

export default VideoPlayer;