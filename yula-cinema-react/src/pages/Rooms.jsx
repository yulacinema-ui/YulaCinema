import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../services/firebase";
import { ref, onValue, push, set, remove, serverTimestamp } from "firebase/database";
import toast from "react-hot-toast";

const Rooms = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Подписка на список комнат
  useEffect(() => {
    if (!user) return;

    const roomsRef = ref(db, "rooms");
    const unsubscribeRooms = onValue(
      roomsRef,
      (snapshot) => {
        const roomsData = [];
        snapshot.forEach((child) => {
          roomsData.push({
            id: child.key,
            ...child.val(),
          });
        });
        console.log("Rooms loaded:", roomsData); // отладка
        setRooms(roomsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading rooms:", error);
        toast.error("Ошибка загрузки комнат");
        setLoading(false);
      }
    );

    // Подписка на онлайн-статусы
    const statusRef = ref(db, "status");
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const usersList = [];
      snapshot.forEach((child) => {
        usersList.push({ uid: child.key, email: child.val().email });
      });
      setOnlineUsers(usersList);
    });

    return () => {
      unsubscribeRooms();
      unsubscribeStatus();
    };
  }, [user]);

  const createRoom = async () => {
    const roomName = prompt("Название комнаты:");
    if (!roomName || !user) return;

    try {
      const newRoomRef = push(ref(db, "rooms"));
      await set(newRoomRef, {
        name: roomName,
        owner: user.email,
        createdAt: serverTimestamp(),
      });
      toast.success("Комната создана!");
      // Переход в новую комнату
      navigate(`/room?id=${newRoomRef.key}`);
    } catch (error) {
      console.error("Create room error:", error);
      toast.error("Не удалось создать комнату");
    }
  };

  const deleteRoom = async (roomId) => {
    if (!confirm("Удалить эту комнату?")) return;
    try {
      await remove(ref(db, `rooms/${roomId}`));
      await remove(ref(db, `room_presence/${roomId}`));
      toast.success("Комната удалена");
    } catch (error) {
      console.error("Delete room error:", error);
      toast.error("Ошибка удаления");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (loading) {
    return <div className="loader-container">Загрузка комнат...</div>;
  }

  return (
    <div>
      <div className="top-bar">
        <h2>Комнаты</h2>
        <button onClick={handleLogout} className="btn-secondary">Выйти</button>
      </div>
      <div className="main-container">
        <div className="card">
          <h3>Сейчас в сети</h3>
          <div className="online-list">
            {onlineUsers.map((u) => (
              <div key={u.uid} className="user-badge">
                <span className="status-dot"></span>
                <span>{u.email.split("@")[0]}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={createRoom} style={{ marginBottom: "20px" }}>
          + Создать комнату
        </button>

        {rooms.length === 0 ? (
          <p>Нет комнат. Создайте первую!</p>
        ) : (
          rooms.map((room) => {
            const isOwner = user && room.owner === user.email;
            return (
              <div key={room.id} className="room-card">
                <div className="room-info">
                  <h4>{room.name}</h4>
                  <p>Хост: {room.owner?.split("@")[0] || room.owner}</p>
                </div>
                <div className="room-actions">
                  <button
                    className="join-btn"
                    onClick={() => navigate(`/room?id=${room.id}`)}
                  >
                    Войти
                  </button>
                  {isOwner && (
                    <button
                      className="btn-secondary delete-btn"
                      onClick={() => deleteRoom(room.id)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Rooms;