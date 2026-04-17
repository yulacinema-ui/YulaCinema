import React, { useState, useRef } from 'react';

const VideoVolumeSlider = ({ player }) => {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const gainNodeRef = useRef(null);
  const audioCtxRef = useRef(null);

  const activateIOSVolume = async () => {
    if (isReady || !player) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const videoElement = player.tech().el();
      const source = ctx.createMediaElementSource(videoElement);
      const gainNode = ctx.createGain();
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();
      setIsReady(true);
    } catch (e) {
      console.error("Audio Context Error", e);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      if (!isReady) activateIOSVolume();
      if (gainNodeRef.current) gainNodeRef.current.gain.value = isMuted ? 0 : val;
    } else {
      player.volume(val);
      player.muted(val === 0);
    }
  };

  const fillPercent = isMuted ? 0 : volume * 100;

  return (
    /* Change 1: Added w-full to the container */
    <div className="flex items-center gap-4 bg-gray-900/90 p-3 rounded-2xl border border-white/10 w-full">
      <button 
        onClick={() => setIsMuted(!isMuted)} 
        className="text-white text-lg focus:outline-none active:opacity-50 transition"
      >
        {volume === 0 || isMuted ? '🔇' : '🔊'}
      </button>

      {/* Change 2: Changed width class to flex-1 to fill all remaining space */}
      <div className="relative flex-1 flex items-center">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          onPointerDown={activateIOSVolume}
          className="w-full h-2 appearance-none bg-transparent cursor-pointer accent-blue-500"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${fillPercent}%, #374151 ${fillPercent}%)`,
            borderRadius: '10px'
          }}
        />
        
        {/* iOS Helper text if needed */}
        {!isReady && /iPad|iPhone|iPod/.test(navigator.userAgent) && (
          <span className="absolute -top-6 left-0 text-[10px] text-blue-400 animate-pulse whitespace-nowrap">
            Tap slider to enable sound
          </span>
        )}
      </div>

      <span className="text-white text-xs font-mono w-8 text-right">
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
};

export default VideoVolumeSlider;