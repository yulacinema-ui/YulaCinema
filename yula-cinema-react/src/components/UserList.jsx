import React from 'react';

const UserList = ({ users }) => {
  return (
    <div className="card">
      <h3>👥 В комнате</h3>
      <div className="online-list">
        {users.map((user) => (
          <div key={user.uid} className="user-badge">
            <span className="status-dot"></span>
            <span className="user-name">{user.email.split('@')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(UserList);