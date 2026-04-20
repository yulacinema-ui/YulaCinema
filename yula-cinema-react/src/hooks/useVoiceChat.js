// src/hooks/useVoiceChat.js
import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { ref, set, onValue, remove, onDisconnect } from 'firebase/database';
import { db } from '../services/firebase';

export const useVoiceChat = (roomId, currentUid, userEmail) => {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(null);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const activeCallsRef = useRef(new Map());
  const myPeerIdRef = useRef(null);
  const isMicActiveRef = useRef(false);

  const unlockAudio = useCallback(() => {
    const silent = new Audio();
    silent.src = "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA";
    silent.play().catch(()=>{});
    document.querySelectorAll('audio').forEach(audio => {
      if (audio.paused) audio.play().catch(() => {});
    });
  }, []);

  useEffect(() => {
    const events = ['touchstart', 'click'];
    events.forEach(event => document.addEventListener(event, unlockAudio, { once: true }));
    return () => {
      events.forEach(event => document.removeEventListener(event, unlockAudio));
    };
  }, [unlockAudio]);

  const generateRandomPeerId = () => {
    return 'user_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
  };

const attachRemoteStream = useCallback((call, remoteStream) => {
  const remoteAudio = document.createElement('audio');
  remoteAudio.autoplay = true;
  remoteAudio.playsInline = true;
  
  // ADD THESE THREE LINES:
  remoteAudio.setAttribute('aria-hidden', 'true');
  // This tells some browsers to prioritize the voice frequency
  if ("setSinkId" in remoteAudio) {
     remoteAudio.volume = 1.0; 
  }

  remoteAudio.srcObject = remoteStream;
  document.body.appendChild(remoteAudio);
  
  return remoteAudio;
}, []);

  const callAllPeers = useCallback(async () => {
    if (!peerRef.current || !localStreamRef.current || !isMicActiveRef.current) return;
    const peersRef = ref(db, `room_peers/${roomId}`);
    const snapshot = await new Promise(resolve => onValue(peersRef, resolve, { onlyOnce: true }));
    const peers = snapshot.val() || {};
    for (const [uid, data] of Object.entries(peers)) {
      if (uid === currentUid) continue;
      const targetPeerId = data.peerId;
      if (targetPeerId && !activeCallsRef.current.has(targetPeerId)) {
        const call = peerRef.current.call(targetPeerId, localStreamRef.current);
        if (call) {
          call.on('stream', (remoteStream) => {
            const audioEl = attachRemoteStream(call, remoteStream);
            activeCallsRef.current.set(targetPeerId, { call, audioElement: audioEl });
          });
          call.on('close', () => {
            activeCallsRef.current.delete(targetPeerId);
          });
          call.on('error', () => {});
        }
      }
    }
  }, [roomId, currentUid, attachRemoteStream]);

  const listenForNewPeers = useCallback(() => {
    const peersRef = ref(db, `room_peers/${roomId}`);
    return onValue(peersRef, (snapshot) => {
      if (!peerRef.current || !localStreamRef.current || !isMicActiveRef.current) return;
      const peers = snapshot.val() || {};
      for (const [uid, data] of Object.entries(peers)) {
        if (uid === currentUid) continue;
        const targetPeerId = data.peerId;
        if (targetPeerId && !activeCallsRef.current.has(targetPeerId)) {
          const call = peerRef.current.call(targetPeerId, localStreamRef.current);
          if (call) {
            call.on('stream', (remoteStream) => {
              const audioEl = attachRemoteStream(call, remoteStream);
              activeCallsRef.current.set(targetPeerId, { call, audioElement: audioEl });
            });
            call.on('close', () => {
              activeCallsRef.current.delete(targetPeerId);
            });
          }
        }
      }
      for (let [peerId, item] of activeCallsRef.current.entries()) {
        let stillExists = false;
        for (let item2 of Object.values(peers)) {
          if (item2.peerId === peerId) { stillExists = true; break; }
        }
        if (!stillExists) {
          if (item.call) item.call.close();
          if (item.audioElement) item.audioElement.remove();
          activeCallsRef.current.delete(peerId);
        }
      }
    });
  }, [roomId, currentUid, attachRemoteStream]);

  const enableMicrophone = useCallback(async () => {
    if (isMicActiveRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,      // Essential for movie watching
    noiseSuppression: true,     // Removes background fan/hiss noise
    autoGainControl: true,      // Keeps everyone's volume level even
    sampleRate: 48000,          // High-fidelity audio
    channelCount: 1             // Voice is better in mono (saves bandwidth)
  }
});
      localStreamRef.current = stream;
      isMicActiveRef.current = true;
      setIsMicActive(true);
      setIsMuted(false);

      const peerId = generateRandomPeerId();
      const peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" }
          ]
        }
      });
      peerRef.current = peer;

      peer.on('open', async (id) => {
        myPeerIdRef.current = id;
        const peerRefDb = ref(db, `room_peers/${roomId}/${currentUid}`);
        await set(peerRefDb, { peerId: id, email: userEmail });
        onDisconnect(peerRefDb).remove();
        await callAllPeers();
      });

      peer.on('call', (incomingCall) => {
        if (!localStreamRef.current || !isMicActiveRef.current) return;
        incomingCall.answer(localStreamRef.current);
        const callerId = incomingCall.peer;
        incomingCall.on('stream', (remoteStream) => {
          const audioEl = attachRemoteStream(incomingCall, remoteStream);
          activeCallsRef.current.set(callerId, { call: incomingCall, audioElement: audioEl });
        });
        incomingCall.on('close', () => {
          activeCallsRef.current.delete(callerId);
        });
      });

      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' || err.type === 'invalid-id') {
          peer.destroy();
          const newPeerId = generateRandomPeerId();
          const newPeer = new Peer(newPeerId, {
            config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
          });
          peerRef.current = newPeer;
          newPeer.on('open', async (id) => {
            myPeerIdRef.current = id;
            const peerRefDb = ref(db, `room_peers/${roomId}/${currentUid}`);
            await set(peerRefDb, { peerId: id, email: userEmail });
            onDisconnect(peerRefDb).remove();
            await callAllPeers();
          });
          newPeer.on('call', (incomingCall) => {
            if (!localStreamRef.current || !isMicActiveRef.current) return;
            incomingCall.answer(localStreamRef.current);
            const callerId = incomingCall.peer;
            incomingCall.on('stream', (remoteStream) => {
              const audioEl = attachRemoteStream(incomingCall, remoteStream);
              activeCallsRef.current.set(callerId, { call: incomingCall, audioElement: audioEl });
            });
            incomingCall.on('close', () => {
              activeCallsRef.current.delete(callerId);
            });
          });
        } else {
          setError(err.message);
        }
      });

      const unsubscribe = listenForNewPeers();
      peer.on('close', () => unsubscribe());

    } catch (err) {
      setError("Microphone access denied. Please check permissions.");
      isMicActiveRef.current = false;
      setIsMicActive(false);
    }
  }, [roomId, currentUid, userEmail, callAllPeers, listenForNewPeers, attachRemoteStream]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current || !isMicActiveRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length) {
      const newMuted = !audioTracks[0].enabled;
      audioTracks[0].enabled = !newMuted;
      setIsMuted(newMuted);
    }
  }, []);

  const disableMicrophone = useCallback(async () => {
    for (let item of activeCallsRef.current.values()) {
      if (item.call && item.call.close) item.call.close();
      if (item.audioElement) item.audioElement.remove();
    }
    activeCallsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (currentUid && roomId) {
      const peerRefDb = ref(db, `room_peers/${roomId}/${currentUid}`);
      await remove(peerRefDb).catch(() => {});
    }

    isMicActiveRef.current = false;
    setIsMicActive(false);
    setIsMuted(false);
    myPeerIdRef.current = null;
  }, [roomId, currentUid]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.destroy();
      }
      if (currentUid && roomId) {
        remove(ref(db, `room_peers/${roomId}/${currentUid}`)).catch(() => {});
      }
    };
  }, [roomId, currentUid]);

  return {
    isMicActive,
    isMuted,
    error,
    enableMicrophone,
    disableMicrophone,
    toggleMute
  };
};