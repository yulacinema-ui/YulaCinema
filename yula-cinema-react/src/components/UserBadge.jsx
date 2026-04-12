import React from "react";

const UserBadge = React.memo(({ email }) => (
  <div className="user-badge">
    <span className="status-dot"></span>
    <span className="user-name">{email.split("@")[0]}</span>
  </div>
));

export default UserBadge;