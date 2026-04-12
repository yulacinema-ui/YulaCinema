import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { ref, onValue, remove, set, onDisconnect } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export const useVoiceChat = (roomId) => {
  const { user } = useAuth();
  const [isMicActive, setIsMicActive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const activeCallsRef = useRef(new Map()); // peerId -> { call, audioElement }
  const currentUid = user?.uid;

  // Генерация уникального peerId
  const generatePeerId = () => `user_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;

  // Создание аудио-элемента для удалённого потока
  const attachRemoteStream = useCallback((call, remoteStream) => {
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.controls = false;
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
    audioEl.srcObject = remoteStream;
    audioEl.play().catch(e => console.warn('Audio play error:', e));
    call.on('close', () => {
      audioEl.remove();
      activeCallsRef.current.delete(call.peer);
    });
    return audioEl;
  }, []);

  // Вызов всех существующих пиров в комнате
  const callAllPeers = useCallback(async () => {
    if (!peerRef.current || !localStreamRef.current || !isMicActive) return;
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
          activeCallsRef.current.set(targetPeerId, { call });
        }
      }
    }
  }, [roomId, currentUid, isMicActive, attachRemoteStream]);

  // Прослушивание новых пиров
  useEffect(() => {
    if (!roomId || !peerRef.current || !localStreamRef.current || !isMicActive) return;
    const peersRef = ref(db, `room_peers/${roomId}`);
    const unsubscribe = onValue(peersRef, (snapshot) => {
      const peers = snapshot.val() || {};
      // Подключаемся к новым
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
            activeCallsRef.current.set(targetPeerId, { call });
          }
        }
      }
      // Удаляем вызовы, чьи пиры покинули комнату
      for (const [peerId, item] of activeCallsRef.current.entries()) {
        let stillExists = false;
        for (const p of Object.values(peers)) {
          if (p.peerId === peerId) { stillExists = true; break; }
        }
        if (!stillExists) {
          item.call?.close();
          item.audioElement?.remove();
          activeCallsRef.current.delete(peerId);
        }
      }
    });
    return () => unsubscribe();
  }, [roomId, currentUid, isMicActive, attachRemoteStream]);

  // Включение микрофона и инициализация PeerJS
  const enableMicrophone = useCallback(async () => {
    if (isMicActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setIsMicActive(true);
      setMicEnabled(true);

      const peerId = generatePeerId();
      const peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });
      peerRef.current = peer;

      peer.on('open', async (id) => {
        const peerRefDb = ref(db, `room_peers/${roomId}/${currentUid}`);
        await set(peerRefDb, { peerId: id, email: user.email });
        onDisconnect(peerRefDb).remove();
        callAllPeers();
      });

      peer.on('call', (incomingCall) => {
        if (!localStreamRef.current || !isMicActive) return;
        incomingCall.answer(localStreamRef.current);
        incomingCall.on('stream', (remoteStream) => {
          const audioEl = attachRemoteStream(incomingCall, remoteStream);
          activeCallsRef.current.set(incomingCall.peer, { call: incomingCall, audioElement: audioEl });
        });
        activeCallsRef.current.set(incomingCall.peer, { call: incomingCall });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'unavailable-id' || err.type === 'invalid-id') {
          // реконнект с новым ID
          peer.destroy();
          const newPeerId = generatePeerId();
          const newPeer = new Peer(newPeerId, { config: peer.options.config });
          peerRef.current = newPeer;
          // повторная инициализация обработчиков...
          // упрощённо: перезапускаем enableMicrophone
          enableMicrophone();
        } else {
          toast.error('Ошибка голосового чата');
        }
      });

      toast.success('Микрофон включён');
    } catch (err) {
      console.error(err);
      toast.error('Не удалось получить доступ к микрофону');
      setIsMicActive(false);
    }
  }, [roomId, currentUid, user, callAllPeers, attachRemoteStream, isMicActive]);

  // Отключение микрофона и очистка ресурсов
  const disableMicrophone = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    for (const item of activeCallsRef.current.values()) {
      item.call?.close();
      item.audioElement?.remove();
    }
    activeCallsRef.current.clear();
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (currentUid && roomId) {
      remove(ref(db, `room_peers/${roomId}/${currentUid}`)).catch(console.warn);
    }
    setIsMicActive(false);
    setMicEnabled(true);
    toast('Микрофон выключен');
  }, [roomId, currentUid]);

  // Переключение mute/unmute (отключение звука локального микрофона)
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current || !isMicActive) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length) {
      const newState = !audioTracks[0].enabled;
      audioTracks[0].enabled = newState;
      setMicEnabled(newState);
      toast(newState ? 'Микрофон включён' : 'Микрофон отключён');
    }
  }, [isMicActive]);

  // Очистка при размонтировании компонента
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) peerRef.current.destroy();
      if (currentUid && roomId) {
        remove(ref(db, `room_peers/${roomId}/${currentUid}`)).catch(() => {});
      }
    };
  }, [roomId, currentUid]);

  return {
    isMicActive,
    micEnabled,
    enableMicrophone,
    disableMicrophone,
    toggleMute,
  };
};