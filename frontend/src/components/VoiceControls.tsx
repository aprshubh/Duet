import React, { useState, useEffect, useRef } from 'react';
import type { VoicePeer } from '../services/webrtc';
import { UserAvatar } from './UserAvatar';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneCall,
  PhoneOff,
  Sliders,
  ChevronDown,
} from 'lucide-react';

interface VoiceControlsProps {
  inVoice: boolean;
  isSelfMuted: boolean;
  voicePeers: VoicePeer[];
  currentUserName: string;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleSelfMute: () => void;
  onSetPeerMute: (peerUserId: string, muted: boolean) => void;
  onSetPeerVolume: (peerUserId: string, volume: number) => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  inVoice,
  isSelfMuted,
  voicePeers,
  currentUserName,
  onJoinVoice,
  onLeaveVoice,
  onToggleSelfMute,
  onSetPeerMute,
  onSetPeerVolume,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const totalConnected = (inVoice ? 1 : 0) + voicePeers.length;

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Header Voice Action Pill */}
      <div className="voice-header-pill">
        {!inVoice ? (
          <button
            type="button"
            onClick={onJoinVoice}
            className="header-btn btn-voice-join"
            title="Join Voice Chat"
            aria-label="Join Voice Chat"
          >
            <Mic size={15} />
            <span className="header-btn-text">Voice</span>
          </button>
        ) : (
          <div className="voice-active-group">
            <button
              type="button"
              onClick={onToggleSelfMute}
              className={`voice-mic-btn ${isSelfMuted ? 'muted' : 'unmuted'}`}
              title={isSelfMuted ? 'Unmute My Microphone' : 'Mute My Microphone'}
              aria-label={isSelfMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isSelfMuted ? <MicOff size={14} /> : <Mic size={14} />}
              <span className="voice-mic-status-text">{isSelfMuted ? 'Muted' : 'Mic On'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="voice-panel-toggle"
              title="Voice Room & Member Volumes"
              aria-label={`Voice participants (${totalConnected})`}
            >
              <span className="voice-count-dot" />
              <span>{totalConnected}</span>
              <ChevronDown size={12} />
            </button>

            <button
              type="button"
              onClick={onLeaveVoice}
              className="voice-leave-btn"
              title="Leave Voice Chat"
              aria-label="Leave Voice Chat"
            >
              <PhoneOff size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Voice Controls Dropdown / Drawer */}
      {isOpen && inVoice && (
        <div className="voice-dropdown-panel" role="dialog" aria-label="Voice Chat Controls">
          <div className="voice-panel-header">
            <div className="voice-panel-title">
              <PhoneCall size={14} className="text-emerald-400" />
              <span>Voice Room ({totalConnected})</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="voice-panel-close"
              aria-label="Close voice panel"
            >
              ✕
            </button>
          </div>

          <div className="voice-members-list">
            {/* Self Member Card */}
            <div className="voice-member-card self">
              <div className="voice-member-info">
                <div className="voice-avatar-wrap">
                  <UserAvatar name={currentUserName} size={28} />
                  {!isSelfMuted && <span className="voice-speaking-pulse" />}
                </div>
                <div className="voice-name-block">
                  <span className="voice-member-name">{currentUserName} (You)</span>
                  <span className="voice-member-status">
                    {isSelfMuted ? 'Mic Muted' : 'Speaking Active'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleSelfMute}
                className={`voice-self-mute-btn ${isSelfMuted ? 'muted' : ''}`}
                title={isSelfMuted ? 'Unmute microphone' : 'Mute microphone'}
                aria-label={isSelfMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isSelfMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>

            {/* Other Connected Members */}
            {voicePeers.length === 0 ? (
              <div className="voice-empty-peers">
                <span>Waiting for other friends to connect to voice...</span>
              </div>
            ) : (
              voicePeers.map((peer) => (
                <div key={peer.userId} className="voice-member-card">
                  <div className="voice-member-info">
                    <div className="voice-avatar-wrap">
                      <UserAvatar name={peer.userName} size={28} />
                      {!peer.isMuted && !peer.isLocallyMuted && (
                        <span className="voice-speaking-pulse" />
                      )}
                    </div>
                    <div className="voice-name-block">
                      <span className="voice-member-name">{peer.userName}</span>
                      <span className="voice-member-status">
                        {peer.isLocallyMuted
                          ? 'Blocked for you'
                          : peer.isMuted
                          ? 'Self Muted'
                          : `${Math.round(peer.volume * 100)}% Volume`}
                      </span>
                    </div>
                  </div>

                  {/* Individual Control Actions */}
                  <div className="voice-peer-actions">
                    {/* Per-User Volume Slider */}
                    <div className="voice-volume-control" title={`Adjust ${peer.userName}'s volume`}>
                      <Sliders size={12} className="text-muted" aria-hidden="true" />
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        value={peer.isLocallyMuted ? 0 : peer.volume}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          onSetPeerVolume(peer.userId, val);
                          if (val > 0 && peer.isLocallyMuted) {
                            onSetPeerMute(peer.userId, false);
                          }
                        }}
                        className="voice-peer-slider"
                        aria-label={`${peer.userName} volume`}
                      />
                    </div>

                    {/* Individual Block/Mute Toggle Button */}
                    <button
                      type="button"
                      onClick={() => onSetPeerMute(peer.userId, !peer.isLocallyMuted)}
                      className={`voice-peer-mute-btn ${peer.isLocallyMuted ? 'muted' : ''}`}
                      title={
                        peer.isLocallyMuted
                          ? `Unblock ${peer.userName}'s voice`
                          : `Block/Mute ${peer.userName}'s voice for me`
                      }
                      aria-label={
                        peer.isLocallyMuted
                          ? `Unblock ${peer.userName}`
                          : `Mute ${peer.userName} for me`
                      }
                    >
                      {peer.isLocallyMuted ? (
                        <VolumeX size={14} className="text-red-400" />
                      ) : (
                        <Volume2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
