import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  MessageSquare,
  Settings,
  Upload,
  Maximize,
  Minimize,
} from 'lucide-react';
import { YouTubeIcon } from './YouTubeModal';
import { formatTime } from '../utils';

interface CinemaControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isFullscreenChatOpen: boolean;
  showSettings: boolean;
  showControls: boolean;
  canControl: boolean;
  onTogglePlay: () => void;
  onStep: (seconds: number) => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onRateChange: (rate: number) => void;
  onToggleFullscreenChat: () => void;
  onToggleSettings: () => void;
  onOpenYouTubeModal: () => void;
  onSelectFile: (file: File) => void;
  onToggleFullscreen: () => void;
}

export const CinemaControls: React.FC<CinemaControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  isFullscreen,
  isFullscreenChatOpen,
  showSettings,
  showControls,
  canControl,
  onTogglePlay,
  onStep,
  onSeek,
  onToggleMute,
  onVolumeChange,
  onRateChange,
  onToggleFullscreenChat,
  onToggleSettings,
  onOpenYouTubeModal,
  onSelectFile,
  onToggleFullscreen,
}) => {
  return (
    <div
      className={`cinema-controls ${!showControls && isPlaying ? 'hidden' : ''}`}
      aria-label="Video controls"
    >
      {/* Timeline scrub bar */}
      <div className="timeline-row">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          disabled={!canControl}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          aria-label="Video progress timeline"
          aria-valuemin={0}
          aria-valuemax={duration || 100}
          aria-valuenow={currentTime}
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        />
      </div>

      {/* Controls row */}
      <div className="controls-row">
        {/* Left group: Playback & Volume */}
        <div className="controls-group left-group">
          <button
            type="button"
            disabled={!canControl}
            onClick={onTogglePlay}
            className="ctrl-btn main-play-btn"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} fill="#ffffff" />}
          </button>

          {/* Rewind -10s */}
          <button
            type="button"
            disabled={!canControl}
            onClick={() => onStep(-10)}
            className="ctrl-btn"
            title="Rewind 10 seconds"
            aria-label="Rewind 10 seconds"
          >
            <RotateCcw size={15} />
            <span className="step-badge">10</span>
          </button>

          {/* Forward +10s */}
          <button
            type="button"
            disabled={!canControl}
            onClick={() => onStep(10)}
            className="ctrl-btn"
            title="Forward 10 seconds"
            aria-label="Forward 10 seconds"
          >
            <RotateCw size={15} />
            <span className="step-badge">10</span>
          </button>

          {/* Timestamp display */}
          <div className="timestamp-display" aria-label="Playback time">
            <span className="current">{formatTime(currentTime)}</span>
            <span className="divider"> / </span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Desktop Volume Wrapper (Hidden on mobile touch via CSS) */}
          <div className="volume-wrapper">
            <button
              type="button"
              onClick={onToggleMute}
              className="ctrl-btn"
              title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
              aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              aria-label="Volume slider"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={isMuted ? 0 : volume}
            />
          </div>
        </div>

        {/* Right group: Speed, Settings, Modals, Fullscreen */}
        <div className="controls-group right-group">
          {/* Fullscreen Chat Toggle */}
          {isFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreenChat}
              className={`ctrl-btn ${isFullscreenChatOpen ? 'active' : ''}`}
              title="Toggle Fullscreen Chat"
              aria-label="Toggle Fullscreen Chat"
            >
              <MessageSquare size={16} />
            </button>
          )}

          {/* Playback speed selector */}
          <select
            disabled={!canControl}
            value={playbackRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="speed-select"
            aria-label="Playback speed"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1.0}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2.0}>2.0x</option>
          </select>

          {/* Audio & Settings button */}
          <button
            type="button"
            onClick={onToggleSettings}
            className={`ctrl-btn ${showSettings ? 'active' : ''}`}
            title="Audio Track Settings"
            aria-label="Audio Track Settings"
          >
            <Settings size={16} />
          </button>

          {/* Stream YouTube Video Button */}
          <button
            type="button"
            onClick={onOpenYouTubeModal}
            className="ctrl-btn"
            title="Stream YouTube Video"
            aria-label="Stream YouTube Video"
          >
            <YouTubeIcon size={16} />
          </button>

          {/* Change video file */}
          <label className="ctrl-btn" title="Change video file" aria-label="Change video file">
            <Upload size={15} />
            <input
              type="file"
              accept="video/*,.mkv"
              onChange={(e) => e.target.files?.[0] && onSelectFile(e.target.files[0])}
              style={{ display: 'none' }}
            />
          </label>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="ctrl-btn"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};
