import { useRef, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoomUsers } from '../hooks/useFirebaseList';
import { useVoiceChat } from '../hooks/useVoiceChat';
import UserAvatar from '../components/UserAvatar';
import { ref, onValue, update, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';
import Hls from 'hls.js';

const Room = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('id');
  const { user } = useAuth();
  const videoRef = useRef(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [roomName, setRoomName] = useState('');
  const users = useRoomUsers(roomId);
  const voice = useVoiceChat(roomId, user?.uid, user?.email);
  
  
  let hlsRef = useRef(null);
  const blockSendingRef = useRef(false);

  // Load video (supports .m3u8)
  const loadVideo = (url) => {
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
    if (videoRef.current) videoRef.current.style.display = 'block';
    const placeholder = document.getElementById('videoPlaceholder');
    if (placeholder) placeholder.style.display = 'none';
  };

  // Listen to room data (videoUrl + sync state)
  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const room = snapshot.val();
      if (!room) return;

      setRoomName(room.name || "Cinema Room");

      if (room.videoUrl && videoRef.current?.dataset?.url !== room.videoUrl) {
        if (videoRef.current) videoRef.current.dataset.url = room.videoUrl;
        loadVideo(room.videoUrl);
      }

      if (!room.state || room.state.user === user?.email) return;
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
  }, [roomId, user?.email]);

  // Send local video actions
  useEffect(() => {
    if (!videoRef.current || !roomId || !user?.email) return;
    const video = videoRef.current;

    const sendAction = (isPlaying) => {
      if (blockSendingRef.current) return;
      update(ref(db, `rooms/${roomId}/state`), {
        playing: isPlaying,
        time: video.currentTime,
        user: user.email,
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
  }, [roomId, user?.email]);

  // Check host
  useEffect(() => {
    if (!roomId || !user) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const room = snapshot.val();
      if (room) setIsHost(room.owner === user.email);
    });
    return () => unsubscribe();
  }, [roomId, user]);

  // Presence
  useEffect(() => {
    if (!roomId || !user) return;
    const presenceRef = ref(db, `room_presence/${roomId}/${user.uid}`);
    set(presenceRef, { email: user.email, onlineAt: serverTimestamp() });
    onDisconnect(presenceRef).remove();
    return () => set(presenceRef, null);
  }, [roomId, user]);

  const handleSetVideo = () => {
    if (!videoUrlInput.trim()) return;
    update(ref(db, `rooms/${roomId}`), {
      videoUrl: videoUrlInput.trim(),
      state: { playing: false, time: 0, ts: Date.now(), user: user.email }
    });
    setVideoUrlInput('');
  };

  return (
    <div className="min-h-screen bg-apple-bg flex flex-col">
      {/* iOS-style top bar */}
      <div className="pt-[60px] px-5 pb-5 flex justify-between items-center bg-apple-card/80 backdrop-blur-apple sticky top-0 z-10 border-b border-apple-border">
        <button onClick={() => navigate('/rooms')} className="text-apple-accent text-lg font-medium active:opacity-70 transition">
          ← Back
        </button>
        <h2 className="text-lg font-semibold truncate max-w-[200px]">{roomName || "Loading..."}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-apple-secondary">👥 {users.length}</span>
          {/* <UserAvatar email={user?.email} showName size="sm" /> */}
        </div>
      </div>

      <div className="flex-1 p-5 max-w-6xl mx-auto w-full">
        {/* Video player card */}
        <div className="apple-card p-0 overflow-hidden mb-5">
          <div className="video-wrapper">
            <video
              ref={videoRef}
              id="mainVideo"
              className="w-full h-full"
              controls
              playsInline
              style={{ display: 'block' }}
            />
            {/* <div id="videoPlaceholder" className="absolute inset-0 flex flex-col items-center justify-center text-apple-secondary">
              <span className="text-4xl mb-2">🎬</span>
              <span>No video loaded</span>
            </div> */}
          </div>
        </div>

        {/* Host controls */}
        {isHost && (
          <div className="apple-card p-5 mb-5">
            <h3 className="text-apple-secondary text-xs uppercase tracking-wider mb-3">Host Controls</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Video URL (mp4, m3u8, etc.)"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                className="flex-1 h-12 bg-apple-input border border-transparent rounded-xl px-4 text-white placeholder:text-apple-secondary focus:border-apple-accent focus:bg-[rgba(58,58,60,0.8)] outline-none transition-all"
              />
              <button onClick={handleSetVideo} className="bg-apple-accent text-white px-6 rounded-xl font-semibold active:opacity-70 transition">
                Set
              </button>
            </div>
          </div>
        )}

        {/* Voice chat card */}
        <div className="apple-card p-5 mb-5">
          <h3 className="text-apple-secondary text-xs uppercase tracking-wider mb-3">🎙️ Voice Chat</h3>
          {voice.error && <p className="text-red-500 text-sm mb-3">{voice.error}</p>}
          {!voice.isMicActive ? (
            <button onClick={voice.enableMicrophone} className="w-full bg-apple-accent text-white py-3 rounded-xl font-semibold active:opacity-70 transition">
              Enable Microphone
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${voice.isMuted ? 'text-apple-secondary' : 'voice-status on'}`}>
                  {voice.isMuted ? '🔴 Muted' : '🟢 Active'}
                </span>
                <button onClick={voice.toggleMute} className="bg-[#2c2c2e] text-white px-5 py-2 rounded-xl text-sm font-semibold active:opacity-70 transition">
                  {voice.isMuted ? 'Unmute' : 'Mute'}
                </button>
              </div>
              <button onClick={voice.disableMicrophone} className="w-full bg-red-600 text-white py-2 rounded-xl text-sm font-semibold active:opacity-70 transition">
                Disable Microphone
              </button>
            </div>
          )}
        </div>

        {/* Users list card */}
        <div className="apple-card p-5">
          <h3 className="text-apple-secondary text-xs uppercase tracking-wider mb-3">👥 In Room</h3>
          <div className="flex flex-wrap gap-2">
            {users.length === 0 && <p className="empty-msg">No one else here</p>}
            {users.map((u) => (
              <div key={u.id} className="user-badge">
                <span className="status-dot"></span>
                <span className="text-sm font-medium">{u.email.split('@')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;