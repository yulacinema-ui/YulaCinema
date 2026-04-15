import { create } from 'zustand';

const useRoomStore = create((set) => ({
  roomData: null,
  videoUrl: null,
  isPlaying: false,
  currentTime: 0,
  users: [], // <--- важно: массив по умолчанию
  setRoomData: (data) => set({ roomData: data }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setUsers: (usersList) => set({ users: usersList }),
  resetRoom: () => set({ roomData: null, videoUrl: null, isPlaying: false, currentTime: 0, users: [] }),
}));

export default useRoomStore;