import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { ref, onValue, update, set, onDisconnect, remove } from "firebase/database";
import Hls from "hls.js";
import Peer from "peerjs";
import toast from "react-hot-toast";

const Room = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("id");
  const navigate = useNavigate();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const [roomData, setRoomData] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Голосовой чат
  const [micActive, setMicActive] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const callsRef = useRef(new Map());
  const currentUid = user?.uid;

  // --- 1. Загрузка комнаты и подписки ---
  useEffect(() => {
    if (!roomId || !user) {
      navigate("/rooms");
      return;
    }

    // Присутствие
    const presenceRef = ref(db, `room_presence/${roomId}/${user.uid}`);
    set(presenceRef, { email: user.email, online: true });
    onDisconnect(presenceRef).remove();

    // Данные комнаты
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubRoom = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        toast.error("Комната не найдена");
        navigate("/rooms");
        return;
      }
      setRoomData(data);
      setIsHost(data.owner === user.email);
      if (data.videoUrl) setVideoUrl(data.videoUrl);
      if (data.state) setIsPlaying(data.state.playing);
      setLoading(false);
    });

    // Список участников
    const usersRef = ref(db, `room_presence/${roomId}`);
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const list = [];
      snapshot.forEach((child) => list.push({ uid: child.key, email: child.val().email }));
      setUsers(list);
    });

    return () => {
      unsubRoom();
      unsubUsers();
    };
  }, [roomId, user, navigate]);

  // --- 2. Загрузка видео через HLS.js или обычный video ---
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;

    const video = videoRef.current;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (videoUrl.endsWith(".m3u8")) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;
      }
    } else {
      video.src = videoUrl;
    }
    video.load();
  }, [videoUrl]);

  // --- 3. Синхронизация состояния (подписка на изменения от других) ---
  useEffect(() => {
    if (!roomId || !videoRef.current) return;
    const stateRef = ref(db, `rooms/${roomId}/state`);
    const unsubState = onValue(stateRef, (snapshot) => {
      const state = snapshot.val();
      if (!state) return;
      if (state.user === user?.email) return;

      const video = videoRef.current;
      if (Math.abs(video.currentTime - state.time) > 1) {
        video.currentTime = state.time;
      }
      if (state.playing && video.paused) {
        video.play().catch(e => console.log("Autoplay blocked"));
        setIsPlaying(true);
      } else if (!state.playing && !video.paused) {
        video.pause();
        setIsPlaying(false);
      }
    });
    return () => unsubState();
  }, [roomId, user]);

  // --- 4. Отправка своих действий ---
  const sendState = useCallback((playing, time) => {
    if (!roomId || !user) return;
    update(ref(db, `rooms/${roomId}/state`), {
      playing,
      time,
      user: user.email,
      ts: Date.now(),
    }).catch(console.error);
  }, [roomId, user]);

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const onPlay = () => {
      setIsPlaying(true);
      sendState(true, video.currentTime);
    };
    const onPause = () => {
      setIsPlaying(false);
      sendState(false, video.currentTime);
    };
    const onSeeked = () => {
      sendState(false, video.currentTime);
    };
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [sendState]);

  // --- 5. Установка видео (хост) ---
  const handleSetVideo = () => {
    const input = document.getElementById("videoUrlInput");
    const url = input?.value.trim();
    if (!url) {
      toast.error("Введите ссылку");
      return;
    }
    update(ref(db, `rooms/${roomId}`), {
      videoUrl: url,
      state: { playing: false, time: 0, ts: Date.now(), user: user.email },
    })
      .then(() => {
        toast.success("Видео обновлено");
        input.value = "";
      })
      .catch(() => toast.error("Ошибка"));
  };

  // --- 6. Голосовой чат (полностью как в исходном проекте) ---
  const generateRandomPeerId = () => "user_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now();

  const attachRemoteStream = useCallback((call, remoteStream) => {
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.style.display = "none";
    document.body.appendChild(audioEl);
    audioEl.srcObject = remoteStream;
    call.on("close", () => audioEl.remove());
    return audioEl;
  }, []);

  const callAllPeers = useCallback(async () => {
    if (!peerRef.current || !streamRef.current || !micActive) return;
    const snapshot = await new Promise(resolve => onValue(ref(db, `room_peers/${roomId}`), resolve, { onlyOnce: true }));
    const peers = snapshot.val() || {};
    for (const [uid, data] of Object.entries(peers)) {
      if (uid === currentUid) continue;
      const targetPeerId = data.peerId;
      if (targetPeerId && !callsRef.current.has(targetPeerId)) {
        const call = peerRef.current.call(targetPeerId, streamRef.current);
        call.on("stream", (remoteStream) => {
          const audioEl = attachRemoteStream(call, remoteStream);
          callsRef.current.set(targetPeerId, { call, audioElement: audioEl });
        });
        callsRef.current.set(targetPeerId, { call });
      }
    }
  }, [roomId, currentUid, micActive, attachRemoteStream]);

  useEffect(() => {
    if (!peerRef.current || !streamRef.current || !micActive || !roomId) return;
    const peersRefDb = ref(db, `room_peers/${roomId}`);
    const unsubscribe = onValue(peersRefDb, (snapshot) => {
      const peers = snapshot.val() || {};
      for (const [uid, data] of Object.entries(peers)) {
        if (uid === currentUid) continue;
        const targetPeerId = data.peerId;
        if (targetPeerId && !callsRef.current.has(targetPeerId)) {
          const call = peerRef.current.call(targetPeerId, streamRef.current);
          call.on("stream", (remoteStream) => {
            const audioEl = attachRemoteStream(call, remoteStream);
            callsRef.current.set(targetPeerId, { call, audioElement: audioEl });
          });
          callsRef.current.set(targetPeerId, { call });
        }
      }
      for (const [peerId, item] of callsRef.current.entries()) {
        let stillExists = false;
        for (const p of Object.values(peers)) {
          if (p.peerId === peerId) { stillExists = true; break; }
        }
        if (!stillExists) {
          item.call?.close();
          item.audioElement?.remove();
          callsRef.current.delete(peerId);
        }
      }
    });
    return () => unsubscribe();
  }, [roomId, currentUid, micActive, attachRemoteStream]);

  const enableMicrophone = async () => {
    if (micActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicActive(true);
      setMicEnabled(true);

      const peerId = generateRandomPeerId();
      const peer = new Peer(peerId, {
        config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
      });
      peerRef.current = peer;

      peer.on("open", async (id) => {
        const peerDbRef = ref(db, `room_peers/${roomId}/${currentUid}`);
        await set(peerDbRef, { peerId: id, email: user.email });
        onDisconnect(peerDbRef).remove();
        callAllPeers();
      });

      peer.on("call", (call) => {
        if (!streamRef.current || !micActive) return;
        call.answer(streamRef.current);
        call.on("stream", (remoteStream) => {
          const audioEl = attachRemoteStream(call, remoteStream);
          callsRef.current.set(call.peer, { call, audioElement: audioEl });
        });
        callsRef.current.set(call.peer, { call });
      });

      peer.on("error", (err) => {
        console.error(err);
        toast.error("Ошибка голосового чата");
        disableMicrophone();
      });

      toast.success("Микрофон включён");
    } catch (err) {
      toast.error("Нет доступа к микрофону");
    }
  };

  const disableMicrophone = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    for (const item of callsRef.current.values()) {
      item.call?.close();
      item.audioElement?.remove();
    }
    callsRef.current.clear();
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (currentUid && roomId) {
      remove(ref(db, `room_peers/${roomId}/${currentUid}`)).catch(() => {});
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

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (peerRef.current) peerRef.current.destroy();
      if (currentUid && roomId) {
        remove(ref(db, `room_peers/${roomId}/${currentUid}`)).catch(() => {});
      }
    };
  }, [roomId, currentUid]);

  const handleLeave = () => {
    disableMicrophone();
    navigate("/rooms");
  };

  if (loading) return <div className="loader-container">Загрузка...</div>;

  return (
    <div>
      <div className="top-bar">
        <button onClick={handleLeave} className="btn-secondary">← Назад</button>
        <div>{roomData?.name || "Кинозал"}</div>
        <div style={{ width: 60 }}></div>
      </div>

      <div className="main-container">
        <div className="card video-card">
          <video
            ref={videoRef}
            id="mainVideo"
            controls
            playsInline
            style={{ width: "100%", height: "100%", display: videoUrl ? "block" : "none" }}
          />
          {!videoUrl && (
            <div className="placeholder-content">
              <span className="icon">🎬</span>
              <p>Ожидание ссылки от хоста...</p>
            </div>
          )}
        </div>

        {isHost && (
          <div className="card">
            <h3>Управление видео</h3>
            <div className="input-group">
              <input id="videoUrlInput" type="text" placeholder="Ссылка на .mp4 или .m3u8" />
              <button onClick={handleSetVideo} className="btn-secondary">Ок</button>
            </div>
          </div>
        )}

        <div className="card">
          <h3>🎤 Голосовой чат</h3>
          <div className="voice-controls">
            {!micActive ? (
              <button onClick={enableMicrophone} className="mic-btn">🎙 Включить микрофон</button>
            ) : (
              <>
                <button onClick={toggleMute} className="mic-btn" style={{ background: micEnabled ? "#555" : "#e74c3c" }}>
                  {micEnabled ? "🔇 Выключить звук" : "🎤 Включить звук"}
                </button>
                <button onClick={disableMicrophone} className="mic-btn" style={{ background: "#c0392b" }}>
                  ⏹ Остановить микрофон
                </button>
              </>
            )}
            <span className={`voice-status ${micActive && micEnabled ? "on" : ""}`}>
              {micActive ? (micEnabled ? "🟢 Микрофон активен" : "🔴 Микрофон отключён") : "⚫ Микрофон выключен"}
            </span>
          </div>
        </div>

        <div className="card">
          <h3>👥 В комнате</h3>
          <div className="online-list">
            {users.map((u) => (
              <div key={u.uid} className="user-badge">
                <span className="status-dot"></span>
                <span>{u.email.split("@")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;