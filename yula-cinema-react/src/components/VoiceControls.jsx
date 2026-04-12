import React from 'react';
import { motion } from 'framer-motion';

const VoiceControls = ({ isMicActive, micEnabled, onEnable, onDisable, onToggleMute }) => {
  return (
    <div className="card">
      <h3>🎤 Голосовой чат</h3>
      <div className="voice-controls">
        {!isMicActive ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onEnable}
            className="mic-btn"
          >
            🎙 Включить микрофон
          </motion.button>
        ) : (
          <>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onToggleMute}
              className="mic-btn"
              style={{ background: micEnabled ? '#555' : '#e74c3c' }}
            >
              {micEnabled ? '🔇 Выключить звук' : '🎤 Включить звук'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onDisable}
              className="mic-btn"
              style={{ background: '#c0392b' }}
            >
              ⏹ Остановить микрофон
            </motion.button>
          </>
        )}
        <span className={`voice-status ${isMicActive && micEnabled ? 'on' : ''}`}>
          {isMicActive ? (micEnabled ? '🟢 Микрофон активен' : '🔴 Микрофон отключён') : '⚫ Микрофон выключен'}
        </span>
      </div>
    </div>
  );
};

export default React.memo(VoiceControls);