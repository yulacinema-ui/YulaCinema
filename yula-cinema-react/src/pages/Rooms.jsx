import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRooms } from '../hooks/useFirebaseList';
import { ref, set, push, remove, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import UserAvatar from '../components/UserAvatar';
import toast from 'react-hot-toast';

const Rooms = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { rooms, loading } = useRooms();
  const [newRoomName, setNewRoomName] = useState('');
  
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceUrl, setAdvanceUrl] = useState('');
  const [advanceName, setAdvanceName] = useState('');

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    const roomRef = push(ref(db, 'rooms'));
    await set(roomRef, {
      name: newRoomName,
      owner: user.email,
      createdAt: Date.now(),
      videoUrl: null,
      isAdvanced: false,
      state: { playing: false, time: 0, ts: Date.now(), user: user.email }
    });
    toast.success('Room created');
    setNewRoomName('');
    navigate(`/room?id=${roomRef.key}`);
  };

const createAdvanceRoom = async () => {
    if (!advanceUrl.trim() || !advanceName.trim()) {
      toast.error('Fill all fields');
      return;
    }

    const toastId = toast.loading('Initializing bot...');
    
    try {
      const commandRef = push(ref(db, 'commands'));
      const roomId = advanceName.toLowerCase().replace(/\s+/g, '-');

      await set(commandRef, {
        url: advanceUrl,
        name: advanceName,
        targetRoomId: roomId,
        owner: user.email,
        status: 'start',
        timestamp: Date.now()
      });

      setIsAdvanceModalOpen(false);
      setAdvanceUrl('');
      setAdvanceName('');

      // Слушаем изменения
      const unsubscribe = onValue(commandRef, (snapshot) => {
        const data = snapshot.val();
        
        // Если данных нет (бот удалил команду), значит процесс завершен
        if (!data) {
          unsubscribe(); 
          return;
        }

        if (data.status === 'downloading') {
          toast.loading('Bot: Downloading video...', { id: toastId });
        } else if (data.status === 'uploading') {
          toast.loading('Bot: Uploading to Cloud...', { id: toastId });
        } else if (data.status === 'completed') {
          toast.success('Room is ready!', { id: toastId });
          unsubscribe();
        } else if (data.status === 'error') {
          toast.error(`Bot Error: ${data.error}`, { id: toastId });
          unsubscribe();
        }
      }, (error) => {
        // Ошибка самого слушателя (например, права доступа)
        console.error("Listener error:", error);
      });

    } catch (error) {
      // Сюда попадет только если ПЕРВИЧНАЯ отправка (set) не удалась
      toast.error('Failed to send command', { id: toastId });
    }
  };

  const deleteRoom = async (room) => {
    if (!window.confirm(`Delete room "${room.name}"?`)) return;
    
    try {
      if (room.isAdvanced) {
        const commandRef = push(ref(db, 'commands'));
        await set(commandRef, {
          targetRoomId: room.id,
          status: 'delete_request',
          timestamp: Date.now()
        });
        toast.success('Delete request sent to bot');
      } else {
        await remove(ref(db, `rooms/${room.id}`));
        await remove(ref(db, `room_presence/${room.id}`)).catch(() => {});
        toast.success('Room deleted');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  if (loading) return <div className="text-center p-8 text-apple-secondary">Loading rooms...</div>;

  return (
    <div className="min-h-screen bg-apple-bg">
      <div className="pt-[60px] px-5 pb-5 flex justify-between items-center bg-apple-card/80 backdrop-blur-apple sticky top-0 z-10 border-b border-apple-border">
        <h2 className="text-3xl font-bold tracking-tight text-white">Rooms</h2>
        <div className="flex items-center gap-4">
          <UserAvatar email={user?.email} showName />
          <button onClick={logout} className="bg-apple-accent text-white px-4 py-2 rounded-xl text-sm font-semibold active:opacity-70 transition">
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="apple-card p-5">
            <h3 className="text-apple-secondary text-xs uppercase tracking-wider mb-3">Quick Room</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className="flex-1 h-11 bg-apple-input rounded-xl px-4 text-white outline-none border border-transparent focus:border-apple-accent transition"
              />
              <button onClick={createRoom} className="bg-white text-black px-4 rounded-xl font-semibold text-sm active:opacity-70 transition">
                Create
              </button>
            </div>
          </div>

          <div className="apple-card p-5 border-dashed border-apple-accent/50 border-2">
            <h3 className="text-apple-accent text-xs uppercase tracking-wider mb-3 font-bold">Cloud Cinema</h3>
            <p className="text-apple-secondary text-[11px] mb-3">Bot will download & host video in HF Bucket</p>
            <button 
              onClick={() => setIsAdvanceModalOpen(true)}
              className="w-full h-11 bg-apple-accent text-white rounded-xl font-bold active:opacity-70 transition"
            >
              Advance Room +
            </button>
          </div>
        </div>

        {isAdvanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
            <div className="apple-card w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
              <h3 className="text-xl font-bold mb-4">New Advance Room</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-apple-secondary block mb-1 px-1">VIDEO URL</label>
                  <input
                    type="text"
                    value={advanceUrl}
                    onChange={(e) => setAdvanceUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-12 bg-apple-input rounded-xl px-4 text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-apple-secondary block mb-1 px-1">ROOM NAME</label>
                  <input
                    type="text"
                    value={advanceName}
                    onChange={(e) => setAdvanceName(e.target.value)}
                    placeholder="e.g. Gravity Falls"
                    className="w-full h-12 bg-apple-input rounded-xl px-4 text-white outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setIsAdvanceModalOpen(false)} className="flex-1 h-12 bg-apple-card border border-apple-border rounded-xl font-semibold">
                    Cancel
                  </button>
                  <button onClick={createAdvanceRoom} className="flex-1 h-12 bg-apple-accent text-white rounded-xl font-bold">
                    Start Bot
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {rooms.length === 0 && !loading && <p className="text-center text-apple-secondary py-10">No rooms available</p>}
          {rooms.map((room) => {
            // Сравниваем полные email
            const isOwner = user?.email === room.owner;
            return (
              <div key={room.id} className="room-card flex justify-between items-center p-4 bg-apple-card border border-apple-border rounded-2xl">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-semibold">{room.name}</h4>
                    {room.isAdvanced && <span className="bg-apple-accent/20 text-apple-accent text-[10px] px-2 py-0.5 rounded-full font-bold">CLOUD</span>}
                  </div>
                  {/* Показываем полный email владельца */}
                  <p className="text-apple-secondary text-sm">Owner: {room.owner || 'Unknown'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/room?id=${room.id}`)} className="bg-apple-accent text-white px-5 py-2 rounded-xl font-semibold">Join</button>
                  {isOwner && (
                    <button onClick={() => deleteRoom(room)} className="bg-red-500/20 text-red-500 px-4 py-2 rounded-xl font-semibold hover:bg-red-500 hover:text-white transition">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Rooms;