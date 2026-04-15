import { useEffect, useState } from "react";
import { ref, onValue, set, onDisconnect } from "firebase/database";
import { db } from "../services/firebase";
import useRoomStore from "../store/useRoomStore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export const useRoomData = (roomId, user) => {
  const navigate = useNavigate();
  const { setRoomData, setVideoUrl, setIsPlaying } = useRoomStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId || !user) {
      navigate("/rooms");
      return;
    }

    // Присутствие
    const presenceRef = ref(db, `room_presence/${roomId}/${user.uid}`);
    set(presenceRef, { email: user.email, online: true });
    onDisconnect(presenceRef).remove();

    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        toast.error("Комната не найдена");
        navigate("/rooms");
        setLoading(false);
        return;
      }
      setRoomData(data);
      if (data.videoUrl) setVideoUrl(data.videoUrl);
      if (data.state) setIsPlaying(data.state.playing);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, user, navigate, setRoomData, setVideoUrl, setIsPlaying]);

  return { loading };
};