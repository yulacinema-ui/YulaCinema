import React from "react";

const RoomCard = React.memo(({ room, currentUser, onJoin, onDelete }) => {
  const isOwner = currentUser && room.owner === currentUser.email;

  return (
    <div className="room-card">
      <div className="room-info">
        <h4>{room.name}</h4>
        <p>Host: {room.owner.split("@")[0]}</p>
      </div>
      <div className="room-actions">
        <button className="join-btn" onClick={() => onJoin(room.id)}>
          Join
        </button>
        {isOwner && (
          <button
            className="btn-secondary delete-btn"
            onClick={() => onDelete(room.id)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
});

export default RoomCard;