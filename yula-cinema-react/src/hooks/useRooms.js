import { useEffect, useState, useCallback } from "react";
import { db } from "../services/firebase";
import { ref, onValue, push, set, remove, serverTimestamp } from "firebase/database";

export const useRooms = (currentUser) => {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    const roomsRef = ref(db, "rooms");
    const unsubscribe = onValue(roomsRef, (snapshot) => {
      const roomsData = [];
      snapshot.forEach((child) => {
        roomsData.push({ id: child.key, ...child.val() });
      });
      setRooms(roomsData);
    });
    return () => unsubscribe();
  }, []);

  const createRoom = useCallback(async (roomName) => {
    if (!roomName || !currentUser) return null;
    const newRoomRef = push(ref(db, "rooms"));
    await set(newRoomRef, {
      name: roomName,
      owner: currentUser.email,
      createdAt: serverTimestamp(),
    });
    return newRoomRef.key;
  }, [currentUser]);

  const deleteRoom = useCallback(async (roomId) => {
    await remove(ref(db, `rooms/${roomId}`));
    await remove(ref(db, `room_presence/${roomId}`));
  }, []);

  return { rooms, createRoom, deleteRoom };
};