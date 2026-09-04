import React, { useEffect } from 'react';
import type { Room, RoomMember, User } from '../types';
import type { VoicePeer } from '../services/webrtc';
import { UserAvatar } from '../components/UserAvatar';
import {
  X,
  Copy,
  Check,
  Shield,
  Crown,
  LogOut,
  Mic,
  MicOff,
  PhoneOff,
  PhoneCall,
  Sliders,
  Volume2,
  VolumeX,
  Users,
} from 'lucide-react';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room;
  currentUser: User;
  members: RoomMember[];
  isHost: boolean;
  wsStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
  onUpdateSettings: (onlyHostCanControl: boolean) => void;
  onLeaveRoom: () => void;
  inVoice: boolean;
  isSelfMuted: boolean;
  voicePeers: VoicePeer[];
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleSelfMute: () => void;
  onSetPeerMute: (peerUserId: string, muted: boolean) => void;
  onSetPeerVolume: (peerUserId: string, volume: number) => void;
  onCopyLink: () => void;
  copied: boolean;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  room,
  currentUser,
  members,
  isHost,
  wsStatus,
  onUpdateSettings,
  onLeaveRoom,
  inVoice,
  isSelfMuted,
  voicePeers,
  onJoinVoice,
  onLeaveVoice,
  onToggleSelfMute,
  onSetPeerMute,
  onSetPeerVolume,
  onCopyLink,
  copied,
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

  const onlineMembers = members.filter((m) => m.isOnline);
  const totalVoice = (inVoice ? 1 : 0) + voicePeers.length;

  return (
    <div
      className="mobile-drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Room Controls and Settings"
    >
      <div className="mobile-drawer-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="mobile-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>Room Settings</span>
            <div className="status-pill" style={{ padding: '2px 8px', fontSize: 10 }}>
              <span className={`status-dot ${wsStatus === 'CONNECTED' ? 'online' : 'connecting'}`} />
              <span>{wsStatus === 'CONNECTED' ? 'LIVE' : 'SYNCING'}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mobile-drawer-close-btn"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mobile-drawer-content">
          {/* Section 1: Room Code & Quick Share */}
          <div className="mobile-drawer-card">
            <div className="mobile-drawer-card-label">Room Invitation</div>
            <div className="mobile-room-code-row">
              <div className="mobile-code-pill">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CODE:</span>
                <span className="room-code-value" style={{ fontSize: 15 }}>{room.code}</span>
              </div>
              <button
                type="button"
                onClick={onCopyLink}
                className="mobile-copy-btn"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Playback Control Permissions */}
          <div className="mobile-drawer-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Shield size={14} className="text-muted" />
              <div className="mobile-drawer-card-label" style={{ marginBottom: 0 }}>Playback Controls</div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
              {isHost
                ? 'Choose who can play, pause, or seek the video:'
                : `Currently set to ${room.onlyHostCanControl ? 'Host Only' : 'Everyone'}`}
            </p>
            <div className="mobile-control-switch-wrap">
              <button
                type="button"
                disabled={!isHost}
                onClick={() => isHost && onUpdateSettings(false)}
                className={`mobile-control-pill ${!room.onlyHostCanControl ? 'active' : ''}`}
              >
                Everyone
              </button>
              <button
                type="button"
                disabled={!isHost}
                onClick={() => isHost && onUpdateSettings(true)}
                className={`mobile-control-pill ${room.onlyHostCanControl ? 'active' : ''}`}
              >
                Host Only
              </button>
            </div>
          </div>

          {/* Section 3: WebRTC Voice Chat */}
          <div className="mobile-drawer-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PhoneCall size={14} className="text-emerald-400" />
                <div className="mobile-drawer-card-label" style={{ marginBottom: 0 }}>
                  Voice Room ({totalVoice})
                </div>
              </div>
              {inVoice && (
                <button
                  type="button"
                  onClick={onLeaveVoice}
                  className="voice-leave-btn"
                  title="Leave Voice"
                  aria-label="Leave Voice"
                >
                  <PhoneOff size={13} />
                </button>
              )}
            </div>

            {!inVoice ? (
              <button
                type="button"
                onClick={onJoinVoice}
                className="btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: 13 }}
              >
                <Mic size={15} />
                <span>Join Voice Chat</span>
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Self Voice Pill */}
                <div className="mobile-voice-row self">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserAvatar name={currentUser.name} size={28} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
                        {currentUser.name} (You)
                      </div>
                      <div style={{ fontSize: 10, color: isSelfMuted ? 'var(--status-error)' : 'var(--status-online)' }}>
                        {isSelfMuted ? 'Mic Muted' : 'Speaking Active'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleSelfMute}
                    className={`voice-self-mute-btn ${isSelfMuted ? 'muted' : ''}`}
                    aria-label={isSelfMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isSelfMuted ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                </div>

                {/* Peer List */}
                {voicePeers.map((peer) => (
                  <div key={peer.userId} className="mobile-voice-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <UserAvatar name={peer.userName} size={26} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>
                          {peer.userName}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {peer.isLocallyMuted ? 'Muted for you' : `${Math.round(peer.volume * 100)}% Volume`}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="voice-volume-control">
                        <Sliders size={11} className="text-muted" />
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
                          style={{ width: 60 }}
                          aria-label={`${peer.userName} volume`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => onSetPeerMute(peer.userId, !peer.isLocallyMuted)}
                        className={`voice-peer-mute-btn ${peer.isLocallyMuted ? 'muted' : ''}`}
                        aria-label={peer.isLocallyMuted ? `Unmute ${peer.userName}` : `Mute ${peer.userName}`}
                      >
                        {peer.isLocallyMuted ? <VolumeX size={13} className="text-red-400" /> : <Volume2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Active Participants List */}
          <div className="mobile-drawer-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Users size={14} className="text-muted" />
              <div className="mobile-drawer-card-label" style={{ marginBottom: 0 }}>
                Participants ({onlineMembers.length})
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
              {members.map((member) => (
                <div key={member.userId} className="member-item" style={{ padding: '6px 8px' }}>
                  <div className="member-info">
                    <UserAvatar
                      name={member.user?.name || 'Member'}
                      avatar={member.user?.avatar}
                      size={24}
                    />
                    <span className="member-name" style={{ fontSize: 12 }}>
                      {member.user?.name || 'Member'} {member.userId === currentUser.id ? '(You)' : ''}
                    </span>
                  </div>
                  {member.isHost && (
                    <span className="host-tag" style={{ fontSize: 10 }}>
                      <Crown size={10} /> Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: User Profile & Leave Room */}
          <div className="mobile-drawer-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserAvatar name={currentUser.name} avatar={currentUser.avatar} size={30} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{currentUser.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Logged in as guest</div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLeaveRoom}
              className="leave-room-btn"
              style={{ padding: '8px 14px' }}
            >
              <LogOut size={14} />
              <span>Leave Room</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
