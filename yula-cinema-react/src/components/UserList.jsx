import React from "react";
import useRoomStore from "../store/useRoomStore";

const UserList = () => {
  const users = useRoomStore((state) => state.users);
  // Гарантируем, что users всегда массив
  const safeUsers = Array.isArray(users) ? users : [];
  
  return (
    <div className="card">
      <h3>👥 В комнате</h3>
      <div className="online-list">
        {safeUsers.length === 0 ? (
          <div className="user-badge">Нет участников</div>
        ) : (
          safeUsers.map((u) => (
            <div key={u.uid} className="user-badge">
              <span className="status-dot"></span>
              <span>{u.email?.split("@")[0] || "Гость"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default React.memo(UserList);