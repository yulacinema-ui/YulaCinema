import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useVideoSync } from '../hooks/useVideoSync';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { useRoomUsers } from '../hooks/useRoomUsers';
import VideoPlayer from '../components/VideoPlayer';
import VoiceControls from '../components/VoiceControls';
import UserList from '../components/UserList';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const Room = () => {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('id');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const playerRef = useRef(null);
  const { sendAction, isHost } = useVideoSync(roomId, playerRef);
  const voiceChat = useVoiceChat(roomId);
  const users = useRoomUsers(roomId);

  // Загрузка информации о комнате
  useEffect(() => {
    if (!roomId || !user) {
      navigate('/rooms');
      return;
    }
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        toast.error('Комната не найдена');
        navigate('/rooms');
        return;
      }
      setRoom(data);
      if (data.videoUrl) setVideoUrl(data.videoUrl);
      if (data.state) setPlaying(data.state.playing);
    });
    return () => unsubscribe();
  }, [roomId, user, navigate]);

  // Установка URL видео (только для хоста)
  const handleSetVideo = useCallback(() => {
    const url = document.getElementById('videoUrlInput').value.trim();
    if (!url) return;
    if (!user || (room && room.owner !== user.email)) {
      toast.error('Только хост может менять видео');
      return;
    }
    update(ref(db, `rooms/${roomId}`), {
      videoUrl: url,
      state: { playing: false, time: 0, ts: Date.now(), user: user.email },
    }).then(() => {
      toast.success('Видео обновлено');
      document.getElementById('videoUrlInput').value = '';
    }).catch(() => toast.error('Ошибка'));
  }, [roomId, user, room]);

  // Обработчики событий плеера
  const handlePlay = () => {
    setPlaying(true);
    sendAction(true, playerRef.current?.getCurrentTime() || 0);
  };
  const handlePause = () => {
    setPlaying(false);
    sendAction(false, playerRef.current?.getCurrentTime() || 0);
  };
  const handleSeek = (seconds) => {
    sendAction(false, seconds);
  };

  // Автоматическое обновление текущего времени для синхронизации (каждые 5 сек)
  useEffect(() => {
    if (!playerRef.current) return;
    const interval = setInterval(() => {
      if (playerRef.current && playing) {
        sendAction(true, playerRef.current.getCurrentTime());
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [playing, sendAction]);

  if (!room) return <div className="loader-container">Loading...</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="top-bar">
        <button onClick={() => navigate('/rooms')} className="btn-secondary">
          ← Back
        </button>
        <div id="roomTitle">{room.name || 'Cinema Room'}</div>
        <div style={{ width: '60px' }}></div>
      </div>

      <div className="main-container">
        <div className="card video-card">
          <VideoPlayer
            ref={playerRef}
            url={videoUrl}
            playing={playing}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
          />
        </div>

        {isHost && (
          <div className="card">
            <h3>Управление видео</h3>
            <div className="input-group">
              <input id="videoUrlInput" type="text" placeholder="Вставьте ссылку на .mp4 или .m3u8" />
              <button onClick={handleSetVideo} className="btn-secondary">Ок</button>
            </div>
          </div>
        )}

        <VoiceControls
          isMicActive={voiceChat.isMicActive}
          micEnabled={voiceChat.micEnabled}
          onEnable={voiceChat.enableMicrophone}
          onDisable={voiceChat.disableMicrophone}
          onToggleMute={voiceChat.toggleMute}
        />

        <UserList users={users} />
      </div>
    </motion.div>
  );
};

export default Room;