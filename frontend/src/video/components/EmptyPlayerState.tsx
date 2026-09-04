import React, { useState } from 'react';
import { Film, Upload } from 'lucide-react';
import { YouTubeIcon } from './YouTubeModal';

interface EmptyPlayerStateProps {
  onSelectFile: (file: File) => void;
  onSelectYouTube: (url: string) => void;
}

export const EmptyPlayerState: React.FC<EmptyPlayerStateProps> = ({
  onSelectFile,
  onSelectYouTube,
}) => {
  const [youtubeInput, setYoutubeInput] = useState('');

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeInput.trim()) return;
    onSelectYouTube(youtubeInput.trim());
  };

  return (
    <div className="empty-player-prompt">
      <div className="empty-player-card">
        <div className="empty-icon-card">
          <Film size={36} />
        </div>

        <h3 className="empty-title">Select Movie or YouTube Video</h3>

        <p className="empty-desc">
          Play local movie files in zero-buffering peer sync, or paste any YouTube link to stream together.
        </p>

        {/* YouTube Quick Paste Row */}
        <form onSubmit={handleYoutubeSubmit} className="youtube-input-form">
          <div className="youtube-input-wrap">
            <YouTubeIcon size={18} className="youtube-badge-icon" />
            <input
              type="text"
              placeholder="Paste YouTube Link (e.g. https://youtu.be/...)"
              value={youtubeInput}
              onChange={(e) => setYoutubeInput(e.target.value)}
              className="youtube-url-input"
            />
            <button
              type="submit"
              disabled={!youtubeInput.trim()}
              className="btn-play-youtube"
            >
              Stream
            </button>
          </div>
        </form>

        <div className="empty-divider">
          <span>OR CHOOSE LOCAL FILE</span>
        </div>

        <label className="file-select-btn">
          <Upload size={17} />
          <span>Choose Video File</span>
          <input
            type="file"
            accept="video/*,.mkv"
            onChange={(e) => e.target.files?.[0] && onSelectFile(e.target.files[0])}
            style={{ display: 'none' }}
          />
        </label>

        <div className="format-tags-row">
          <span className="format-badge">.MP4</span>
          <span className="format-badge">.MKV</span>
          <span className="format-badge">.WEBM</span>
          <span className="format-badge">.MOV</span>
        </div>

        <div className="empty-feature-pills">
          <div className="empty-feature-item">
            <span className="empty-pulse-dot" />
            <span>Zero Buffering</span>
          </div>
          <div className="empty-feature-item">
            <span>⚡ Peer-Synced</span>
          </div>
          <div className="empty-feature-item">
            <span>🔒 Private &amp; Local</span>
          </div>
        </div>
      </div>
    </div>
  );
};
