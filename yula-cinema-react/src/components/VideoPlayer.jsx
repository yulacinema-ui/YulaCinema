// src/components/VideoPlayer.jsx
import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = ({ url, onPlayerReady }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!playerRef.current && videoRef.current) {
      const player = playerRef.current = videojs(videoRef.current, {
        autoplay: false,
        controls: true,
        responsive: true,
        fluid: true,
        sources: [{ src: url, type: 'video/mp4' }]
      }, () => {
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