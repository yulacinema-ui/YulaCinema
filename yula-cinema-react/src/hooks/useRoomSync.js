import { useEffect, useState, useCallback } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../services/firebase';

export const useRoomSync = (roomId) => {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      setRoom(snapshot.val());
      setLoading(false);
    });
    return () => unsubscribe();
  }, [roomId]);

  const updateRoom = useCallback((updates) => {
    return update(ref(db, `rooms/${roomId}`), updates);
  }, [roomId]);

  return { room, loading, updateRoom };
};