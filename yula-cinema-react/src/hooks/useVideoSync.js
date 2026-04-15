import { useCallback, useRef } from "react";
import { update, ref } from "firebase/database";
import { db } from "../services/firebase";

export const useVideoSync = (roomId, user) => {
  const playerRef = useRef(null);
  const blockSending = useRef(false);

  const sendState = useCallback((playing, time) => {
    if (blockSending.current) return;
    if (!roomId || !user) return;
    update(ref(db, `rooms/${roomId}/state`), {
      playing,
      time,
      user: user.email,
      ts: Date.now(),
    });
  }, [roomId, user]);

  const onPlay = useCallback(() => {
    sendState(true, playerRef.current?.getCurrentTime() || 0);
  }, [sendState]);

  const onPause = useCallback(() => {
    sendState(false, playerRef.current?.getCurrentTime() || 0);
  }, [sendState]);

  const onSeek = useCallback((seconds) => {
    sendState(false, seconds);
  }, [sendState]);

  return { playerRef, onPlay, onPause, onSeek, sendState };
};