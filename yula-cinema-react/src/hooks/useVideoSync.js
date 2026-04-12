import { useEffect, useRef, useCallback } from 'react';
import { ref, update, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export const useVideoSync = (roomId, playerRef) => {
  const { user } = useAuth();
  const blockSending = useRef(false);
  const lastSentState = useRef(null);
  const isHost = useRef(false);

  // Функция отправки действия (play/pause/seek)
  const sendAction = useCallback((isPlaying, currentTime) => {
    if (blockSending.current) return;
    if (!user) return;
    const state = {
      playing: isPlaying,
      time: currentTime,
      user: user.email,
      ts: Date.now(),
    };
    // избегаем дублирования одинаковых состояний
    if (lastSentState.current && 
        lastSentState.current.playing === isPlaying && 
        Math.abs(lastSentState.current.time - currentTime) < 0.5) return;
    lastSentState.current = state;
    update(ref(db, `rooms/${roomId}/state`), state).catch(console.warn);
  }, [roomId, user]);

  // Подписка на внешние изменения состояния
  useEffect(() => {
    if (!roomId) return;
    const stateRef = ref(db, `rooms/${roomId}/state`);
    const unsubscribe = onValue(stateRef, (snapshot) => {
      const state = snapshot.val();
      if (!state || !playerRef.current) return;
      // Игнорируем свои собственные действия
      if (state.user === user?.email) return;

      blockSending.current = true;
      const player = playerRef.current.getInternalPlayer?.() || playerRef.current;
      if (!player) return;

      // Синхронизация времени (с допуском 0.5 сек)
      if (Math.abs(player.currentTime - state.time) > 0.5) {
        player.currentTime = state.time;
      }
      // Синхронизация воспроизведения
      if (state.playing && player.paused) {
        player.play().catch(e => console.log('Autoplay prevented, need user interaction'));
      } else if (!state.playing && !player.paused) {
        player.pause();
      }
      setTimeout(() => { blockSending.current = false; }, 100);
    });
    return () => unsubscribe();
  }, [roomId, user, playerRef]);

  // Определяем, является ли пользователь владельцем комнаты
  useEffect(() => {
    if (!roomId || !user) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsubRoom = onValue(roomRef, (snapshot) => {
      const room = snapshot.val();
      if (room && room.owner === user.email) isHost.current = true;
      else isHost.current = false;
    });
    return () => unsubRoom();
  }, [roomId, user]);

  return { sendAction, isHost: isHost.current };
};