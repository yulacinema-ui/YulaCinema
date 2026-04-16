// src/components/VideoPlayer.jsx
import React, { forwardRef } from 'react';

const VideoPlayer = forwardRef(({ url }, ref) => {
  return (
    <div className="video-wrapper">
      <video
        ref={ref}
        id="movie-player"
        className="w-full h-full"
        controls
        playsInline
        src={url || ''}
      />
    </div>
  );
});

export default VideoPlayer;