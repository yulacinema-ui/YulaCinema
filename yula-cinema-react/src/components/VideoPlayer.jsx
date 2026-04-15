import React, { forwardRef } from "react";
import ReactPlayer from "react-player";

const VideoPlayer = forwardRef(({ url, playing, onPlay, onPause, onSeek }, ref) => {
  if (!url) {
    return (
      <div className="placeholder-content">
        <span className="icon">🎬</span>
        <p>Ожидание ссылки от хоста...</p>
      </div>
    );
  }
  return (
    <ReactPlayer
      ref={ref}
      url={url}
      playing={playing}
      controls
      width="100%"
      height="100%"
      onPlay={onPlay}
      onPause={onPause}
      onSeek={onSeek}
      config={{ file: { attributes: { playsInline: true } } }}
    />
  );
});

export default VideoPlayer;