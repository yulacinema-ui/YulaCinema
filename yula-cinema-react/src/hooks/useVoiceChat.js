import { useState, useRef, useEffect, useCallback } from "react";
import Peer from "peerjs";
import { ref, set, onValue, remove, onDisconnect } from "firebase/database";
import { db } from "../services/firebase";
import toast from "react-hot-toast";

export const useVoiceChat = (roomId, user) => {
  const [micActive, setMicActive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const callsRef = useRef(new Map());

  const generatePeerId = () => `user_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

  const attachRemoteAudio = useCallback((call, remoteStream) => {
    const audio = new Audio();
    audio.srcObject = remoteStream;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.style.display = "none";
    document.body.appendChild(audio);
    call.on("close", () => audio.remove());
    return audio;
  }, []);

  const callAllPeers = useCallback(async () => {
    if (!peerRef.current || !streamRef.current || !micActive) return;
    const peersSnapshot = await new Promise(resolve =>
      onValue(ref(db, `room_peers/${roomId}`), resolve, { onlyOnce: true })
    );
    const peers = peersSnapshot.val() || {};
    for (const [uid, data] of Object.entries(peers)) {
      if (uid === user?.uid) continue;
      const targetId = data.peerId;
      if (targetId && !callsRef.current.has(targetId)) {
        const call = peerRef.current.call(targetId, streamRef.current);
        call.on("stream", (remoteStream) => {
          const audio = attachRemoteAudio(call, remoteStream);
          callsRef.current.set(targetId, { call, audio });
        });
        callsRef.current.set(targetId, { call });
      }
    }
  }, [roomId, user, micActive, attachRemoteAudio]);

  useEffect(() => {
    if (!peerRef.current || !streamRef.current || !micActive || !roomId) return;
    const peersRef = ref(db, `room_peers/${roomId}`);
    const unsubscribe = onValue(peersRef, (snapshot) => {
      const peers = snapshot.val() || {};
      // Подключаемся к новым
      for (const [uid, data] of Object.entries(peers)) {
        if (uid === user?.uid) continue;
        const targetId = data.peerId;
        if (targetId && !callsRef.current.has(targetId)) {
          const call = peerRef.current.call(targetId, streamRef.current);
          call.on("stream", (remoteStream) => {
            const audio = attachRemoteAudio(call, remoteStream);
            callsRef.current.set(targetId, { call, audio });
          });
          callsRef.current.set(targetId, { call });
        }
      }
      // Удаляем тех, кто вышел
      for (const [peerId, item] of callsRef.current.entries()) {
        let stillExists = false;
        for (const p of Object.values(peers)) {
          if (p.peerId === peerId) { stillExists = true; break; }
        }
        if (!stillExists) {
          item.call?.close();
          item.audio?.remove();
          callsRef.current.delete(peerId);
        }
      }
    });
    return () => unsubscribe();
  }, [roomId, user, micActive, attachRemoteAudio]);

  const enableMic = async () => {
    if (micActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicActive(true);
      setMicEnabled(true);

      const peerId = generatePeerId();
      const peer = new Peer(peerId, {
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" }
          ]
        }
      });
      peerRef.current = peer;

      peer.on("open", async (id) => {
        const peerDbRef = ref(db, `room_peers/${roomId}/${user.uid}`);
        await set(peerDbRef, { peerId: id, email: user.email });
        onDisconnect(peerDbRef).remove();
        callAllPeers();
      });

      peer.on("call", (call) => {
        if (!streamRef.current || !micActive) return;
        call.answer(streamRef.current);
        call.on("stream", (remoteStream) => {
          const audio = attachRemoteAudio(call, remoteStream);
          callsRef.current.set(call.peer, { call, audio });
        });
        callsRef.current.set(call.peer, { call });
      });

      peer.on("error", (err) => {
        console.error(err);
        toast.error("Ошибка голосового чата");
        disableMic();
      });

      toast.success("Микрофон включён");
    } catch (err) {
      console.error(err);
      toast.error("Нет доступа к микрофону");
    }
  };

  const disableMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    for (const item of callsRef.current.values()) {
      item.call?.close();
      item.audio?.remove();
    }
    callsRef.current.clear();
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (user?.uid && roomId) {
      remove(ref(db, `room_peers/${roomId}/${user.uid}`)).catch(() => {});
    }
    setMicActive(false);
    setMicEnabled(true);
    toast("Микрофон выключен");
  };

  const toggleMute = () => {
    if (!streamRef.current || !micActive) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const newState = !audioTrack.enabled;
      audioTrack.enabled = newState;
      setMicEnabled(newState);
      toast(newState ? "Микрофон включён" : "Микрофон отключён");
    }
  };

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  return { micActive, micEnabled, enableMic, disableMic, toggleMute };
};