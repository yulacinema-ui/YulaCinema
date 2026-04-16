// src/hooks/usePeerConnection.js
import { useEffect, useRef, useState, useCallback } from 'react';

export const usePeerConnection = (videoRef, onVideoUrlReceived) => {
  const [peerId, setPeerId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteId, setRemoteId] = useState('');
  const [status, setStatus] = useState({ text: 'Ожидание', color: '#8e8e93' });
  const [micActive, setMicActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  const peerRef = useRef(null);
  const dataConnRef = useRef(null);
  const localStreamRef = useRef(null);
  const isRemoteActionRef = useRef(false);
  const lastSeekRef = useRef(0);
  const syncTimeoutRef = useRef(null);

  // Status update helper
  const updateStatus = (text, color) => {
    setStatus({ text, color });
  };

  // Unlock media for iOS
  const unlockMedia = useCallback(() => {
    const silent = new Audio();
    silent.src = "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA";
    silent.play().catch(() => {});
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play()
        .then(() => videoRef.current.pause())
        .catch(() => {});
    }
  }, [videoRef]);

  useEffect(() => {
    const events = ['touchstart', 'click'];
    events.forEach(event => document.addEventListener(event, unlockMedia, { once: true }));
    return () => {
      events.forEach(event => document.removeEventListener(event, unlockMedia));
    };
  }, [unlockMedia]);

  // Drift correction
  const correctDrift = useCallback((remoteTime) => {
    if (!videoRef.current) return;
    const diff = remoteTime - videoRef.current.currentTime;
    if (Math.abs(diff) < 0.3) {
      videoRef.current.playbackRate = 1;
      return;
    }
    if (Math.abs(diff) < 1) {
      videoRef.current.playbackRate = diff > 0 ? 1.05 : 0.95;
      return;
    }
    videoRef.current.playbackRate = 1;
    const now = Date.now();
    if (now - lastSeekRef.current < 1500) return;
    lastSeekRef.current = now;
    videoRef.current.currentTime = remoteTime;
  }, [videoRef]);

  // Send sync event
  const sendSyncEvent = useCallback(() => {
    if (!dataConnRef.current || isRemoteActionRef.current) return;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      dataConnRef.current.send({
        type: 'sync',
        time: videoRef.current?.currentTime || 0,
        playing: !videoRef.current?.paused,
        sentAt: Date.now()
      });
    }, 120);
  }, [videoRef]);

  // Setup data connection handlers
  const setupDataConnection = useCallback((conn) => {
    dataConnRef.current = conn;

    conn.on('data', (data) => {
      if (data.type === 'load') {
        if (videoRef.current) {
          videoRef.current.src = data.url;
          videoRef.current.load();
        }
        onVideoUrlReceived?.(data.url);
      }

      if (data.type === 'sync') {
        isRemoteActionRef.current = true;
        const delay = (Date.now() - data.sentAt) / 1000;
        const target = data.time + delay;
        correctDrift(target);
        if (data.playing && videoRef.current?.paused) {
          videoRef.current?.play().catch(() => {});
        }
        if (!data.playing && !videoRef.current?.paused) {
          videoRef.current?.pause();
        }
        setTimeout(() => {
          isRemoteActionRef.current = false;
        }, 200);
      }

      if (data.type === 'heartbeat') {
        conn.send({ type: 'heartbeat_reply', t: data.t });
      }
      if (data.type === 'heartbeat_reply') {
        console.log('Ping:', Date.now() - data.t, 'ms');
      }
    });

    conn.on('close', () => {
      updateStatus('Соединение потеряно', '#FF453A');
      setIsConnected(false);
      setTimeout(() => {
        if (remoteId) startConnection(remoteId);
      }, 3000);
    });
  }, [correctDrift, videoRef, onVideoUrlReceived, remoteId]);

  // Initialize Peer
  useEffect(() => {
    import('peerjs').then(({ default: Peer }) => {
      peerRef.current = new Peer({
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        }
      });

      peerRef.current.on('open', (id) => {
        setPeerId(id);
        updateStatus('Готов к подключению', '#8e8e93');
      });

      peerRef.current.on('connection', (conn) => {
        setIsHost(true);
        setupDataConnection(conn);
        updateStatus('Напарник подключен', '#32D74B');
        setIsConnected(true);
      });

      peerRef.current.on('error', (err) => {
        console.error(err);
        updateStatus('Ошибка соединения', '#FF453A');
      });
    });
  }, [setupDataConnection]);

  // Start connection (as guest)
  const startConnection = useCallback((id) => {
    if (!id) return;
    setRemoteId(id);
    const conn = peerRef.current.connect(id);
    conn.on('open', () => {
      setupDataConnection(conn);
      setIsHost(false);
      setIsConnected(true);
      updateStatus('Подключено', '#32D74B');

      // Request microphone and start voice call
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          localStreamRef.current = stream;
          const call = peerRef.current.call(id, stream);
          call.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
            setMicActive(true);
          });
        })
        .catch(err => {
          console.error('Microphone error:', err);
          updateStatus('Микрофон недоступен', '#FF453A');
        });
    });
  }, [setupDataConnection]);

  // Accept incoming voice call (host)
  useEffect(() => {
    if (!peerRef.current) return;
    peerRef.current.on('call', (call) => {
      if (!localStreamRef.current) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            localStreamRef.current = stream;
            call.answer(stream);
            call.on('stream', (remoteStream) => {
              setRemoteStream(remoteStream);
              setMicActive(true);
            });
          })
          .catch(err => console.error(err));
      } else {
        call.answer(localStreamRef.current);
        call.on('stream', (remoteStream) => {
          setRemoteStream(remoteStream);
          setMicActive(true);
        });
      }
    });
  }, []);

  // Send video URL (host only)
  const sendVideoUrl = useCallback((url) => {
    if (!dataConnRef.current || !isHost) {
      alert('Только хост может отправлять видео');
      return;
    }
    dataConnRef.current.send({ type: 'load', url });
    if (videoRef.current) {
      videoRef.current.src = url;
    }
  }, [isHost, videoRef]);

  // Toggle microphone mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Disable microphone
  const disableMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setMicActive(false);
    setMicMuted(false);
    setRemoteStream(null);
  }, []);

  // Attach video event listeners for sync
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const onPlay = () => sendSyncEvent();
    const onPause = () => sendSyncEvent();
    const onSeeked = () => sendSyncEvent();
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [videoRef, sendSyncEvent]);

  // Heartbeat interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (dataConnRef.current) {
        dataConnRef.current.send({ type: 'heartbeat', t: Date.now() });
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Visibility change sync
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendSyncEvent();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [sendSyncEvent]);

  return {
    peerId,
    isHost,
    isConnected,
    status,
    micActive,
    micMuted,
    remoteStream,
    remoteId,
    setRemoteId,
    startConnection,
    sendVideoUrl,
    toggleMute,
    disableMicrophone
  };
};