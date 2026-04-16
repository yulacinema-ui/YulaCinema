import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { snapshotToArray } from '../utils/firebaseHelpers';

export const useFirebaseList = (path, dependencies = []) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const dbRef = ref(db, path);
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshotToArray(snapshot);
      setItems(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [path, ...dependencies]);

  return { items, loading };
};

// Specific hooks
export const useOnlineUsers = () => {
  const { items } = useFirebaseList('status');
  return items;
};

export const useRoomUsers = (roomId) => {
  const { items } = useFirebaseList(roomId ? `room_presence/${roomId}` : null);
  return items;
};

export const useRooms = () => {
  const { items, loading } = useFirebaseList('rooms');
  return { rooms: items, loading };
};