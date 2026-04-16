import { useEffect, useRef, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../services/firebase';
import Hls from 'hls.js';

export const useVideoSync = (roomId, userEmail, videoRef) => {
  const blockSendingRef = useRef(false);
  let hlsRef = useRef(null);

  const loadVideo = useCallback((url) => {
    if (!videoRef.current) return;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (url && url.endsWith('.m3u8')) {
      if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = url;
      } else if (Hls.isSupported()) {
        hlsRef.current = new Hls();
        hlsRef.current.loadSource(url);
        hlsRef.current.attachMedia(videoRef.current);
      }
    } else {
      videoRef.current.src = url;
    }
  }, [videoRef]);

  // Listen to room changes (videoUrl + sync state)
  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const room = snapshot.val();
      if (!room) return;

      // Load video URL if changed
      if (room.videoUrl && videoRef.current?.dataset?.url !== room.videoUrl) {
        if (videoRef.current) videoRef.current.dataset.url = room.videoUrl;
        loadVideo(room.videoUrl);
        if (videoRef.current) videoRef.current.style.display = 'block';
        const placeholder = document.getElementById('videoPlaceholder');
        if (placeholder) placeholder.style.display = 'none';
      }

      // Sync state (playing/time) – ignore own updates
      if (!room.state || room.state.user === userEmail) return;
      const state = room.state;
      blockSendingRef.current = true;
      if (videoRef.current) {
        if (Math.abs(videoRef.current.currentTime - state.time) > 1) {
          videoRef.current.currentTime = state.time;
        }
        if (state.playing && videoRef.current.paused) {
          videoRef.current.play().catch(() => console.log('Need user interaction'));
        } else if (!state.playing && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
      setTimeout(() => { blockSendingRef.current = false; }, 100);
    });
    return () => unsubscribe();
  }, [roomId, userEmail, videoRef, loadVideo]);

  // Send local actions to Firebase
  useEffect(() => {
    if (!videoRef.current || !roomId || !userEmail) return;
    const video = videoRef.current;

    const sendAction = (isPlaying) => {
      if (blockSendingRef.current) return;
      update(ref(db, `rooms/${roomId}/state`), {
        playing: isPlaying,
        time: video.currentTime,
        user: userEmail,
        ts: Date.now()
      });
    };

    const onPlay = () => sendAction(true);
    const onPause = () => sendAction(false);
    const onSeeked = () => {
      if (blockSendingRef.current) return;
      video.pause();
      sendAction(false);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [roomId, userEmail, videoRef]);

  // Function for host to set video URL
  const setVideoUrl = useCallback((url) => {
    if (!roomId || !userEmail) return;
    update(ref(db, `rooms/${roomId}`), {
      videoUrl: url,
      state: { playing: false, time: 0, ts: Date.now(), user: userEmail }
    });
  }, [roomId, userEmail]);

  return { setVideoUrl };
};