import React, { useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableTracks: string[];
  selectedTrack: number;
  onSelectTrack: (index: number) => void;
}

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  availableTracks,
  selectedTrack,
  onSelectTrack,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="video-settings-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Audio and Video Settings"
    >
      <div className="settings-header">
        <span className="settings-title">Audio & Video Settings</span>
        <button
          type="button"
          onClick={onClose}
          className="ctrl-btn"
          style={{ padding: 4 }}
          aria-label="Close audio settings"
        >
          <X size={14} />
        </button>
      </div>

      <div className="settings-section-label">Select Audio Track</div>
      <div style={{ marginBottom: 12 }}>
        {availableTracks.map((label, idx) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelectTrack(idx)}
            className={`audio-track-item ${selectedTrack === idx ? 'selected' : ''}`}
          >
            <span>{label}</span>
            {selectedTrack === idx && <Check size={14} className="text-emerald-400" />}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Changing audio suggests this track to other participants so everyone stays in sync.
      </div>
    </div>
  );
};
