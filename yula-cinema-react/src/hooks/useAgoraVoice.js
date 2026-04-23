import { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';

const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

export const useAgoraVoice = (appId, roomId, userId) => {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const localAudioTrack = useRef(null);

  // Helper to wake up audio on any browser
  const resumeAudioContext = async () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const tempCtx = new AudioContext();
        if (tempCtx.state === 'suspended') {
          await tempCtx.resume();
        }
      }
    } catch (e) {
      console.warn("AudioContext resume failed:", e);
    }
  };

  useEffect(() => {
    const handleUserPublished = async (user, mediaType) => {
      await agoraClient.subscribe(user, mediaType);
      
      if (mediaType === "audio") {
        // Play remote sound
        user.audioTrack.play();
        // Wake up audio for the second person
        await resumeAudioContext();
      }
    };

    agoraClient.on("user-published", handleUserPublished);
    return () => {
      agoraClient.off("user-published", handleUserPublished);
    };
  }, []);

  const enableMicrophone = async () => {
    if (!appId || appId.includes("YOUR_")) {
      alert("App ID is missing! Paste it in Room.jsx");
      return;
    }

    try {
      // 1. Join
      await agoraClient.join(appId, roomId, null, userId || Math.floor(Math.random() * 1000));
      
      // 2. Create Track
      const track = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true, ANS: true, AGC: true
      });

      localAudioTrack.current = track;
      
      // 3. Publish
      await agoraClient.publish(track);
      
      // 4. Force global audio resume
      await resumeAudioContext();
      
      setIsMicActive(true);
      setIsMuted(false);

    } catch (err) {
      console.error("Agora Error:", err);
      alert("Mic Error: " + err.message);
    }
  };

  const toggleMute = async () => {
    if (localAudioTrack.current) {
      const newState = !isMuted;
      await localAudioTrack.current.setEnabled(!newState);
      setIsMuted(newState);
    }
  };

  const disableMicrophone = async () => {
    localAudioTrack.current?.stop();
    localAudioTrack.current?.close();
    await agoraClient.leave();
    setIsMicActive(false);
    localAudioTrack.current = null;
  };

  useEffect(() => {
    return () => { disableMicrophone(); };
  }, []);

  return { isMicActive, isMuted, enableMicrophone, disableMicrophone, toggleMute };
};