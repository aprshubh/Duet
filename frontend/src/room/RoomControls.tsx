import React, { useState } from 'react';
import type { Room, RoomMember, User } from '../types';
import { DyuetLogo } from '../components/DyuetLogo';
import { UserAvatar } from '../components/UserAvatar';
import { VoiceControls } from '../components/VoiceControls';
import type { VoicePeer } from '../services/webrtc';
import {
  Copy,
  Check,
  Users,
  Shield,
  Crown,
  MessageSquare,
} from 'lucide-react';

interface RoomControlsProps {
  room: Room;
  currentUser: User;
  members: RoomMember[];
  isHost: boolean;
  wsStatus: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';
  onUpdateSettings: (onlyHostCanControl: boolean) => void;
  onLeaveRoom: () => void;
  isChatOpen: boolean;
  onToggleChat: () => void;
  unreadCount: number;
  inVoice?: boolean;
  isSelfMuted?: boolean;
  voicePeers?: VoicePeer[];
  onJoinVoice?: () => void;
  onLeaveVoice?: () => void;
  onToggleSelfMute?: () => void;
  onSetPeerMute?: (peerUserId: string, muted: boolean) => void;
  onSetPeerVolume?: (peerUserId: string, volume: number) => void;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  room,
  currentUser,
  members,
  isHost,
  wsStatus,
  onUpdateSettings,
  onLeaveRoom,
  isChatOpen,
  onToggleChat,
  unreadCount,
  inVoice = false,
  isSelfMuted = false,
  voicePeers = [],
  onJoinVoice = () => {},
  onLeaveVoice = () => {},
  onToggleSelfMute = () => {},
  onSetPeerMute = () => {},
  onSetPeerVolume = () => {},
}) => {
  const [copied, setCopied] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <header className="header-bar">
      {/* Left: Brand + Room Code Badge */}
      <div className="header-left">
        <div className="brand-badge-wrap">
          <DyuetLogo size={32} />
          <span className="brand-title">Duet</span>
        </div>

        <div className="room-code-badge">
          <span className="room-code-label">Room</span>
          <span className="room-code-value">{room.code}</span>
          <button
            type="button"
            onClick={copyRoomLink}
            className="copy-btn"
            title="Copy Room Invitation Link"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        </div>

        {/* Live indicator */}
        <div className="status-pill">
          <span
            className={`status-dot ${
              wsStatus === 'CONNECTED' ? 'online' : 'connecting'
            }`}
          />
          <span>
            {wsStatus === 'CONNECTED' ? 'LIVE' : 'SYNCING'}
          </span>
        </div>
      </div>

      {/* Center: Permissions Switch */}
      <div className="header-center">
        <div className="control-switch">
          <Shield size={13} style={{ marginLeft: 6, color: 'var(--text-muted)' }} />
          <span className="control-label">Control:</span>
          <button
            type="button"
            disabled={!isHost}
            onClick={() => isHost && onUpdateSettings(false)}
            className={`control-pill ${!room.onlyHostCanControl ? 'active' : ''}`}
          >
            Everyone
          </button>
          <button
            type="button"
            disabled={!isHost}
            onClick={() => isHost && onUpdateSettings(true)}
            className={`control-pill ${room.onlyHostCanControl ? 'active' : ''}`}
          >
            Host Only
          </button>
        </div>
      </div>

      {/* Right: Voice Chat, Chat Toggle, Members, User */}
      <div className="header-right">
        {/* Voice Room Controls */}
        <VoiceControls
          inVoice={inVoice}
          isSelfMuted={isSelfMuted}
          voicePeers={voicePeers}
          currentUserName={currentUser.name}
          onJoinVoice={onJoinVoice}
          onLeaveVoice={onLeaveVoice}
          onToggleSelfMute={onToggleSelfMute}
          onSetPeerMute={onSetPeerMute}
          onSetPeerVolume={onSetPeerVolume}
        />

        {/* Chat Slide Toggle Button */}
        <button
          type="button"
          onClick={onToggleChat}
          className={`header-btn ${isChatOpen ? 'active' : ''}`}
          title={isChatOpen ? 'Close Chat Drawer' : 'Open Chat Drawer'}
        >
          <MessageSquare size={15} />
          <span>Chat</span>
          {!isChatOpen && unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </button>

        {/* Members Button & Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowMembers(!showMembers)}
            className="header-btn"
          >
            <Users size={15} />
            <span>{members.filter((m) => m.isOnline).length}</span>
          </button>

          {showMembers && (
            <div className="members-dropdown">
              <div className="dropdown-title">
                Active Participants ({members.length})
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {members.map((member) => (
                  <div key={member.userId} className="member-item">
                    <div className="member-info">
                      <UserAvatar
                        name={member.user?.name || 'Member'}
                        avatar={member.user?.avatar}
                        size={24}
                      />
                      <span className="member-name">
                        {member.user?.name || 'Member'}{' '}
                        {member.userId === currentUser.id ? '(You)' : ''}
                      </span>
                    </div>
                    {member.isHost && (
                      <span className="host-tag">
                        <Crown size={10} /> Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Refined User Profile Pill & Actions */}
        <div className="user-profile-header-wrap">
          <div className="user-profile-pill">
            <UserAvatar name={currentUser.name} avatar={currentUser.avatar} size={26} />
            <span className="user-profile-name">{currentUser.name}</span>
          </div>

          <button
            type="button"
            onClick={onLeaveRoom}
            className="leave-room-btn"
            title="Leave this watch room"
          >
            Leave Room
          </button>
        </div>
      </div>
    </header>
  );
};
