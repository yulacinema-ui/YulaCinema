import React, { useState } from 'react';
import toast from 'react-hot-toast';
import ReactPlayer from 'react-player';

const UrlInput = ({ currentUrl, onSave, isHost }) => {
  const [url, setUrl] = useState(currentUrl || '');
  const [isEditing, setIsEditing] = useState(false);

  if (!isHost) return null;

  const handleSave = () => {
    if (!url.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    if (!ReactPlayer.canPlay(url)) {
      toast.error('Unsupported video URL');
      return;
    }
    onSave(url);
    setIsEditing(false);
    toast.success('Video URL updated');
  };

  if (!isEditing) {
    return (
      <button onClick={() => setIsEditing(true)} className="btn-secondary">
        Change Video URL
      </button>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste YouTube, Vimeo, or direct video URL"
        className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
        autoFocus
      />
      <button onClick={handleSave} className="btn-primary">OK</button>
      <button onClick={() => setIsEditing(false)} className="btn-secondary">Cancel</button>
    </div>
  );
};

export default UrlInput;