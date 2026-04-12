import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';

export const useRoomUsers = (roomId) => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!roomId) return;
    const presenceRef = ref(db, `room_presence/${roomId}`);
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const list = [];
      snapshot.forEach((child) => {
        list.push({ uid: child.key, email: child.val().email });
      });
      setUsers(list);
    });
    return () => unsubscribe();
  }, [roomId]);

  return users;
};