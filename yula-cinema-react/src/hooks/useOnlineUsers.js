import { useEffect, useState } from "react";
import { db } from "../services/firebase";
import { ref, onValue } from "firebase/database";

export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const statusRef = ref(db, "status");
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const users = [];
      snapshot.forEach((child) => {
        users.push({ uid: child.key, email: child.val().email });
      });
      setOnlineUsers(users);
    });
    return () => unsubscribe();
  }, []);

  return onlineUsers;
};