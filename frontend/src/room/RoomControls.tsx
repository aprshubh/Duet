import React, { useState, useEffect, useRef } from 'react';
import type { Room, RoomMember, User } from '../types';
import { DyuetLogo } from '../components/DyuetLogo';
import { UserAvatar } from '../components/UserAvatar';
import { VoiceControls } from '../components/VoiceControls';
import type { VoicePeer } from '../services/webrtc';
import { useToast } from '../context/useToast';
import { MobileNavDrawer } from './MobileNavDrawer';
import {
  Copy,
  Check,
  Users,
  Shield,
  Crown,
  MessageSquare,
  LogOut,
  Menu,
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
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close members dropdown on click outside
  useEffect(() => {
    if (!showMembers) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowMembers(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMembers]);

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Room invitation link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.info(`Room code is: ${room.code}`);
    }
  };

  const onlineMembers = members.filter((m) => m.isOnline);

  return (
    <>
      <header className="header-bar" role="banner">
        {/* Left: Brand + Room Code Badge */}
        <div className="header-left">
          <div className="brand-badge-wrap">
            <DyuetLogo size={28} />
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
              aria-label="Copy Room Invitation Link"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>

          {/* Live indicator */}
          <div className="status-pill header-status-pill" aria-label={`Connection status: ${wsStatus}`}>
            <span
              className={`status-dot ${
                wsStatus === 'CONNECTED' ? 'online' : 'connecting'
              }`}
            />
            <span className="status-text">
              {wsStatus === 'CONNECTED' ? 'LIVE' : 'SYNCING'}
            </span>
          </div>
        </div>

        {/* Center: Permissions Switch (Desktop only) */}
        <div className="header-center desktop-only-control">
          <div className="control-switch" aria-label="Playback control permissions">
            <Shield size={13} style={{ marginLeft: 6, color: 'var(--text-muted)' }} aria-hidden="true" />
            <span className="control-label">Control:</span>
            <button
              type="button"
              disabled={!isHost}
              onClick={() => isHost && onUpdateSettings(false)}
              className={`control-pill ${!room.onlyHostCanControl ? 'active' : ''}`}
              title={isHost ? 'Allow everyone to control playback' : 'Playback control: Everyone'}
            >
              Everyone
            </button>
            <button
              type="button"
              disabled={!isHost}
              onClick={() => isHost && onUpdateSettings(true)}
              className={`control-pill ${room.onlyHostCanControl ? 'active' : ''}`}
              title={isHost ? 'Only host can control playback' : 'Playback control: Host only'}
            >
              Host Only
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="header-right">
          {/* Desktop Voice Room Controls */}
          <div className="desktop-only-controls">
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
          </div>

          {/* Chat Slide Toggle Button (Always accessible) */}
          <button
            type="button"
            onClick={onToggleChat}
            className={`header-btn chat-toggle-btn ${isChatOpen ? 'active' : ''}`}
            title={isChatOpen ? 'Toggle Chat' : 'Open Chat'}
            aria-label={isChatOpen ? 'Close Chat' : 'Open Chat'}
          >
            <MessageSquare size={15} />
            <span className="header-btn-text">Chat</span>
            {!isChatOpen && unreadCount > 0 && (
              <span className="unread-badge" aria-label={`${unreadCount} unread messages`}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Desktop Members Dropdown */}
          <div style={{ position: 'relative' }} ref={dropdownRef} className="desktop-only-controls">
            <button
              type="button"
              onClick={() => setShowMembers(!showMembers)}
              className={`header-btn ${showMembers ? 'active' : ''}`}
              title="Room Participants"
              aria-label={`Participants (${onlineMembers.length})`}
            >
              <Users size={15} />
              <span>{onlineMembers.length}</span>
            </button>

            {showMembers && (
              <div className="members-dropdown" role="dialog" aria-label="Active Participants">
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

          {/* Desktop User Profile Pill & Leave Room */}
          <div className="user-profile-header-wrap desktop-only-controls">
            <div className="user-profile-pill" title={currentUser.name}>
              <UserAvatar name={currentUser.name} avatar={currentUser.avatar} size={24} />
              <span className="user-profile-name">{currentUser.name}</span>
            </div>

            <button
              type="button"
              onClick={onLeaveRoom}
              className="leave-room-btn"
              title="Leave this watch room"
              aria-label="Leave watch room"
            >
              <LogOut size={13} className="leave-icon" />
              <span className="leave-text">Leave</span>
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="header-btn mobile-hamburger-btn"
            title="Room Settings and Menu"
            aria-label="Open Room Menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Navigation Drawer */}
      <MobileNavDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        room={room}
        currentUser={currentUser}
        members={members}
        isHost={isHost}
        wsStatus={wsStatus}
        onUpdateSettings={onUpdateSettings}
        onLeaveRoom={onLeaveRoom}
        inVoice={inVoice}
        isSelfMuted={isSelfMuted}
        voicePeers={voicePeers}
        onJoinVoice={onJoinVoice}
        onLeaveVoice={onLeaveVoice}
        onToggleSelfMute={onToggleSelfMute}
        onSetPeerMute={onSetPeerMute}
        onSetPeerVolume={onSetPeerVolume}
        onCopyLink={copyRoomLink}
        copied={copied}
      />
    </>
  );
};
