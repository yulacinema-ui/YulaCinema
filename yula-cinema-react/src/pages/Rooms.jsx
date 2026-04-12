import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useOnlineUsers } from "../hooks/useOnlineUsers";
import { useRooms } from "../hooks/useRooms";
import UserBadge from "../components/UserBadge";
import RoomCard from "../components/RoomCard";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

const Rooms = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const onlineUsers = useOnlineUsers();
  const { rooms, createRoom, deleteRoom } = useRooms(user);

  const handleCreateRoom = useCallback(async () => {
    const roomName = prompt("Название комнаты:");
    if (roomName) {
      const roomId = await createRoom(roomName);
      if (roomId) navigate(`/room?id=${roomId}`);
    }
  }, [createRoom, navigate]);

  const handleJoinRoom = useCallback((roomId) => {
    navigate(`/room?id=${roomId}`);
  }, [navigate]);

  const handleDeleteRoom = useCallback(async (roomId) => {
    if (confirm("Удалить эту комнату?")) {
      await deleteRoom(roomId);
      toast.success("Комната удалена");
    }
  }, [deleteRoom]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="top-bar">
        <h2>Rooms</h2>
        <button onClick={handleLogout} className="btn-secondary">
          Exit
        </button>
      </div>
      <div className="main-container">
        <div className="card">
          <h3>Online Now</h3>
          <div className="online-list">
            {onlineUsers.map((u) => (
              <UserBadge key={u.uid} email={u.email} />
            ))}
          </div>
        </div>

        <button onClick={handleCreateRoom} style={{ marginBottom: "20px" }}>
          + Create New Room
        </button>

        <div id="roomList">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              currentUser={user}
              onJoin={handleJoinRoom}
              onDelete={handleDeleteRoom}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default Rooms;