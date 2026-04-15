import { useEffect } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../services/firebase";
import useRoomStore from "../store/useRoomStore";

export const useRoomUsers = (roomId) => {
  const { setUsers } = useRoomStore();

  useEffect(() => {
    if (!roomId) return;
    const usersRef = ref(db, `room_presence/${roomId}`);
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const list = [];
      snapshot.forEach((child) => {
        list.push({ uid: child.key, email: child.val().email });
      });
      setUsers(list);
    });
    return () => unsubscribe();
  }, [roomId, setUsers]);
};