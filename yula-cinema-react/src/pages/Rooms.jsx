import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRooms } from '../hooks/useFirebaseList';
import { ref, set, push, remove } from 'firebase/database';
import { db } from '../services/firebase';
import UserAvatar from '../components/UserAvatar';
import toast from 'react-hot-toast';

const Rooms = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { rooms, loading } = useRooms();
  const [newRoomName, setNewRoomName] = useState('');

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    const roomRef = push(ref(db, 'rooms'));
    await set(roomRef, {
      name: newRoomName,
      owner: user.email,
      createdAt: Date.now(),
      videoUrl: null,
      state: { playing: false, time: 0, ts: Date.now(), user: user.email }
    });
    toast.success('Room created');
    setNewRoomName('');
    navigate(`/room?id=${roomRef.key}`);
  };

  const joinRoom = (roomId) => {
    navigate(`/room?id=${roomId}`);
  };

  const deleteRoom = async (roomId, roomName) => {
    if (!window.confirm(`Delete room "${roomName}"? This action cannot be undone.`)) return;
    try {
      // Delete the room node
      await remove(ref(db, `rooms/${roomId}`));
      // Optional: also clean up presence and peers data for that room
      await remove(ref(db, `room_presence/${roomId}`)).catch(() => {});
      await remove(ref(db, `room_peers/${roomId}`)).catch(() => {});
      toast.success('Room deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete room');
    }
  };

  if (loading) return <div className="text-center p-8 text-apple-secondary">Loading rooms...</div>;

  return (
    <div className="min-h-screen bg-apple-bg">
      {/* iOS-style top bar */}
      <div className="pt-[60px] px-5 pb-5 flex justify-between items-center bg-apple-card/80 backdrop-blur-apple sticky top-0 z-10 border-b border-apple-border">
        <h2 className="text-3xl font-bold tracking-tight">Rooms</h2>
        <div className="flex items-center gap-4">
          <UserAvatar email={user?.email} showName />
          <button onClick={logout} className="bg-apple-accent text-white px-4 py-2 rounded-xl text-sm font-semibold active:opacity-70 transition">
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-5">
        {/* Create room card */}
        <div className="apple-card p-5 mb-8">
          <h3 className="text-apple-secondary text-xs uppercase tracking-wider mb-3">Create New Room</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Room name"
              className="flex-1 h-12 bg-apple-input border border-transparent rounded-xl px-4 text-white placeholder:text-apple-secondary focus:border-apple-accent focus:bg-[rgba(58,58,60,0.8)] outline-none transition-all"
            />
            <button onClick={createRoom} className="bg-apple-accent text-white px-6 rounded-xl font-semibold active:opacity-70 transition">
              Create
            </button>
          </div>
        </div>

        {/* Rooms list */}
        {rooms.length === 0 && <p className="empty-msg text-center">No rooms yet. Create one!</p>}
        {rooms.map((room) => {
          const isOwner = user?.email === room.owner;
          return (
            <div key={room.id} className="room-card">
              <div>
                <h4 className="text-lg font-semibold">{room.name}</h4>
                <p className="text-apple-secondary text-sm">
                  Owner: {room.owner?.split('@')[0] || 'unknown'}
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => joinRoom(room.id)} 
                  className="bg-apple-accent text-white px-5 py-2 rounded-xl font-semibold active:opacity-70 transition"
                >
                  Join
                </button>
                {isOwner && (
                  <button 
                    onClick={() => deleteRoom(room.id, room.name)} 
                    className="bg-red-600 text-white px-5 py-2 rounded-xl font-semibold active:opacity-70 transition"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Rooms;