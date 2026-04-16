import React from 'react';

const UserAvatar = ({ email, showName, size = 'md' }) => {
  const username = email?.split('@')[0] || 'Anonymous';
  if (showName) {
    return (
      <div className="user-badge">
        <span className="status-dot"></span>
        <span className="text-sm font-medium">{username}</span>
      </div>
    );
  }
  // Fallback to simple circle (if needed)
  const sizeClass = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
  }[size];
  return (
    <div className={`${sizeClass} rounded-full bg-apple-accent flex items-center justify-center font-bold`}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
};

export default UserAvatar;