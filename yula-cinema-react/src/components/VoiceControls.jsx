import React from 'react';

const VoiceControls = ({ isMicActive, isMuted, error, isConnecting, onEnable, onDisable, onToggleMute }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-3">🎙️ Voice Chat</h3>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {!isMicActive ? (
        <button
          onClick={onEnable}
          disabled={isConnecting}
          className="btn-primary w-full disabled:opacity-50"
        >
          {isConnecting ? 'Connecting...' : '🎤 Enable Microphone'}
        </button>
      ) : (
        <div className="space-y-2">
          <button onClick={onToggleMute} className="btn-secondary w-full">
            {isMuted ? '🔇 Unmute' : '🎤 Mute'}
          </button>
          <button onClick={onDisable} className="btn-danger w-full">
            ⏹️ Disable Microphone
          </button>
          <p className="text-xs text-gray-400 text-center mt-2">
            {isMuted ? '🔴 Muted' : '🟢 Active'}
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceControls;