import { useRef, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoomUsers } from '../hooks/useFirebaseList';
import { useVoiceChat } from '../hooks/useVoiceChat';
import UserAvatar from '../components/UserAvatar';
import { ref, onValue, update, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';

// New Library Components
import VideoPlayer from '../components/VideoPlayer'; 
import VideoVolumeSlider from '../components/VideoVolumeSlider';

const Room = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('id');
  const { user } = useAuth();
  
  // State for Video.js and Firebase Data
  const [player, setPlayer] = useState(null); 
  const [roomVideoUrl, setRoomVideoUrl] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [roomName, setRoomName] = useState('');
  
  const users = useRoomUsers(roomId);
  const voice = useVoiceChat(roomId, user?.uid, user?.email);
  const blockSendingRef = useRef(false);

  // 1. Sync Listeners: Firebase -> Video.js Player
  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const room = snapshot.val();
      if (!room) return;

      setRoomName(room.name || "Cinema Room");

      // Update URL if changed in Database
      if (room.videoUrl && room.videoUrl !== roomVideoUrl) {
        setRoomVideoUrl(room.videoUrl);
      }

      // Only sync playback if player is ready and action came from another user
      if (!player || !room.state || room.state.user === user?.email) return;

      const state = room.state;
      blockSendingRef.current = true;

      // Sync Time (threshold of 1.5s to prevent jitter)
      if (Math.abs(player.currentTime() - state.time) > 1.5) {
        player.currentTime(state.time);
      }

      // Sync Play/Pause status
      if (state.playing && player.paused()) {
        player.play().catch(() => console.log('Autoplay blocked: requires interaction'));
      } else if (!state.playing && !player.paused()) {
        player.pause();
      }

      setTimeout(() => { blockSendingRef.current = false; }, 100);
    });

    return () => unsubscribe();
  }, [roomId, player, user?.email, roomVideoUrl]);

  // 2. Local Actions: Video.js Player -> Firebase
  useEffect(() => {
    if (!player || !roomId || !user?.email) return;

    const sendAction = (isPlaying) => {
      if (blockSendingRef.current) return;
      update(ref(db, `rooms/${roomId}/state`), {
        playing: isPlaying,
        time: player.currentTime(),
        user: user.email,
        ts: Date.now()
      });
    };

    // Video.js standardized event listeners
    player.on('play', () => sendAction(true));
    player.on('pause', () => sendAction(false));
    player.on('seeked', () => {
      if (!blockSendingRef.current) sendAction(!player.paused());
    });

    return () => {
      player.off('play');
      player.off('pause');
      player.off('seeked');
    };
  }, [player, roomId, user?.email]);

  // 3. Host Check
  useEffect(() => {
    if (!roomId || !user) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const room = snapshot.val();
      if (room) setIsHost(room.owner === user.email);
    });
    return () => unsubscribe();
  }, [roomId, user]);

  // 4. Presence Logic
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
        </div>
      </div>

      <div className="flex-1 p-5 max-w-6xl mx-auto w-full">
        {/* Video Player Section */}
        <div className="apple-card p-0 overflow-hidden mb-5 bg-black shadow-2xl">
          <div className="video-wrapper min-h-[220px]">
            {roomVideoUrl ? (
              <VideoPlayer 
                url={roomVideoUrl} 
                onPlayerReady={(p) => setPlayer(p)} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-apple-secondary">
                <span className="text-4xl mb-2">🎬</span>
                <span>Wait for host to load a video</span>
              </div>
            )}
          </div>
          
          {/* Custom Volume Logic Bar (Bypasses iOS Lock) */}
          <div className="p-4 flex justify-between items-center bg-[#1c1c1e] border-t border-white/5">
            {player ? (
              <VideoVolumeSlider player={player} />
            ) : (
              <div className="text-xs text-apple-secondary italic">Initializing audio bridge...</div>
            )}
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
              <div key={u.id} className="user-badge flex items-center gap-2 bg-[#2c2c2e] px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-sm font-medium text-white">{u.email?.split('@')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;