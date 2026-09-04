import React, { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

interface YouTubeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export const YouTubeIcon = ({ size = 18, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
    aria-hidden="true"
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

export const YouTubeModal: React.FC<YouTubeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [urlInput, setUrlInput] = useState('');

  const handleClose = useCallback(() => {
    setUrlInput('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    setUrlInput('');
    onSubmit(url);
  };

  return (
    <div
      className="youtube-modal-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="yt-modal-title"
    >
      <div className="youtube-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="youtube-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <YouTubeIcon size={20} className="text-red-500" />
            <h4 id="yt-modal-title" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
              Stream YouTube Video
            </h4>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="voice-panel-close"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '10px 0 16px 0', lineHeight: 1.5 }}>
          Paste any YouTube link to stream it in sync with all participants in the room.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="youtube-url-input"
            style={{ width: '100%', marginBottom: 14 }}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={handleClose}
              className="btn-dismiss-audio"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!urlInput.trim()}
              className="btn-play-youtube"
            >
              Stream Together
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
