import React from "react";

const VoiceControls = ({ micActive, micEnabled, onEnable, onDisable, onToggleMute }) => {
  return (
    <div className="card">
      <h3>🎤 Голосовой чат</h3>
      <div className="voice-controls">
        {!micActive ? (
          <button onClick={onEnable} className="mic-btn">
            🎙 Включить микрофон
          </button>
        ) : (
          <>
            <button onClick={onToggleMute} className="mic-btn" style={{ background: micEnabled ? "#555" : "#e74c3c" }}>
              {micEnabled ? "🔇 Выключить звук" : "🎤 Включить звук"}
            </button>
            <button onClick={onDisable} className="mic-btn" style={{ background: "#c0392b" }}>
              ⏹ Остановить микрофон
            </button>
          </>
        )}
        <span className={`voice-status ${micActive && micEnabled ? "on" : ""}`}>
          {micActive ? (micEnabled ? "🟢 Микрофон активен" : "🔴 Микрофон отключён") : "⚫ Микрофон выключен"}
        </span>
      </div>
    </div>
  );
};

export default React.memo(VoiceControls);