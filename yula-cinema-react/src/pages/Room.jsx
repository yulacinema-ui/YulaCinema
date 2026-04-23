import { useRef, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRoomUsers } from '../hooks/useFirebaseList';
// 1. CHANGE: Import your new Agora hook instead of useVoiceChat
import { useAgoraVoice } from '../hooks/useAgoraVoice'; 
import { ref, onValue, update, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { db } from '../services/firebase';

// Components
import VideoPlayer from '../components/VideoPlayer'; 
import VideoVolumeSlider from '../components/VideoVolumeSlider';

// 2. ADD: Your App ID here
const AGORA_APP_ID = "dd23b69f39f84553ae6dba2337b63d6f"; 

const Room = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('id');
  const { user } = useAuth();
  
  const [player, setPlayer] = useState(null); 
  const [roomVideoUrl, setRoomVideoUrl] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [roomName, setRoomName] = useState('');
  
  const users = useRoomUsers(roomId);

  // 3. CHANGE: Use useAgoraVoice instead of useVoiceChat
  // We keep the variable name 'voice' so we don't have to change the JSX below
  const voice = useAgoraVoice(AGORA_APP_ID, roomId, user?.uid);

  // Sync Control Refs
  const blockSendingRef = useRef(false);
  const hasInitialSynced = useRef(false);
  const prevUsersCount = useRef(0);

  // 1. Sync Listeners: Firebase -> Video.js Player
  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const room = snapshot.val();
      if (!room) return;

      setRoomName(room.name || "Cinema Room");

      if (room.videoUrl && room.videoUrl !== roomVideoUrl) {
        setRoomVideoUrl(room.videoUrl);
        hasInitialSynced.current = false; 
        
        if (player) {
            player.src({
                src: room.videoUrl,
                type: room.videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
            });
        }
      }

      if (!player || !room.state) return;

      const state = room.state;
      const isOwnUpdate = state.user === user?.email;

      if (isOwnUpdate && hasInitialSynced.current) return;

      blockSendingRef.current = true;

      let targetTime = state.time;
      if (state.playing && state.ts) {
        const elapsed = (Date.now() - state.ts) / 1000;
        if (elapsed > 0 && elapsed < 3600) targetTime += elapsed;
      }

      if (Math.abs(player.currentTime() - targetTime) > 1.5) {
        player.currentTime(targetTime);
      }

      if (state.playing && player.paused()) {
        player.play().catch(() => console.log('Autoplay blocked'));
      } else if (!state.playing && !player.paused()) {
        player.pause();
      }

      hasInitialSynced.current = true;
      setTimeout(() => { blockSendingRef.current = false; }, 1000);
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

    player.on('play', () => sendAction(true));
    player.on('pause', () => {
        if (!player.seeking()) sendAction(false);
    });
    player.on('seeked', () => {
      if (blockSendingRef.current) return;
      player.pause(); 
      sendAction(false); 
    });

    return () => {
      player.off('play');
      player.off('pause');
      player.off('seeked');
    };
  }, [player, roomId, user?.email]);

  // 3. Presence Logic
  useEffect(() => {
    if (!roomId || !user) return;
    const presenceRef = ref(db, `room_presence/${roomId}/${user.uid}`);
    set(presenceRef, { email: user.email, onlineAt: serverTimestamp() });
    onDisconnect(presenceRef).remove();
    return () => set(presenceRef, null);
  }, [roomId, user]);

  // 4. Pause on Leave/Refresh Logic
  useEffect(() => {
    if (!player || !roomId || !user?.email) return;

    const handleBeforeUnload = () => {
      update(ref(db, `rooms/${roomId}/state`), {
        playing: false,
        time: player.currentTime(),
        user: user.email,
        ts: Date.now()
      });
    };

    if (prevUsersCount.current > 0 && users.length < prevUsersCount.current) {
      if (!player.paused()) {
        player.pause();
        if (users[0]?.email === user.email) {
          update(ref(db, `rooms/${roomId}/state`), {
            playing: false,
            time: player.currentTime(),
            user: "system-auto-pause",
            ts: Date.now()
          });
        }
      }
    }

    prevUsersCount.current = users.length;
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [player, roomId, user, users]);

  // 5. Host Check
  useEffect(() => {
    if (!roomId || !user) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const room = snapshot.val();
      if (room) setIsHost(room.owner === user.email);
    });
    return () => unsubscribe();
  }, [roomId, user]);

  const handleSetVideo = () => {
    if (!videoUrlInput.trim()) return;
    hasInitialSynced.current = false; 

    update(ref(db, `rooms/${roomId}`), {
      videoUrl: videoUrlInput.trim(),
      state: { 
        playing: false, 
        time: 0, 
        ts: Date.now(), 
        user: user.email 
      }
    });
    setVideoUrlInput('');
  };

  return (
    <div className="min-h-screen bg-apple-bg flex flex-col">
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
          
          <div className="p-4 flex justify-between items-center bg-[#1c1c1e] border-t border-white/5">
            {player ? (
              <VideoVolumeSlider player={player} />
            ) : (
              <div className="text-xs text-apple-secondary italic">Initializing audio...</div>
            )}
          </div>
        </div>

        {isHost && (
          <div className="apple-card p-5 mb-5">
            <h3 className="text-apple-secondary text-xs uppercase tracking-wider mb-3">Host Controls</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Video URL (mp4, m3u8)"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                className="flex-1 h-12 bg-apple-input border border-transparent rounded-xl px-4 text-white outline-none transition-all"
              />
              <button onClick={handleSetVideo} className="bg-apple-accent text-white px-6 rounded-xl font-semibold active:opacity-70 transition">
                Set
              </button>
            </div>
          </div>
        )}

        <div className="apple-card p-5 mb-5">
          <h3 className="text-apple-secondary text-xs uppercase tracking-wider mb-3">🎙️ Voice Chat</h3>
          {!voice.isMicActive ? (
            <button onClick={voice.enableMicrophone} className="w-full bg-apple-accent text-white py-3 rounded-xl font-semibold active:opacity-70 transition">
              Enable Microphone
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${voice.isMuted ? 'text-apple-secondary' : 'text-green-500'}`}>
                  {voice.isMuted ? '🔴 Muted' : '🟢 Active'}
                </span>
                <button onClick={voice.toggleMute} className="bg-[#2c2c2e] text-white px-5 py-2 rounded-xl text-sm font-semibold transition">
                  {voice.isMuted ? 'Unmute' : 'Mute'}
                </button>
              </div>
              <button onClick={voice.disableMicrophone} className="w-full bg-red-600 text-white py-2 rounded-xl text-sm font-semibold transition">
                Disable Microphone
              </button>
            </div>
          )}
        </div>

        <div className="apple-card p-5">
          <h3 className="text-apple-secondary text-xs uppercase tracking-wider mb-3">👥 In Room</h3>
          <div className="flex flex-wrap gap-2">
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