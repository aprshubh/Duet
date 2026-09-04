import { useState, useEffect, useRef, useCallback } from 'react';
import type { User, Room, RoomMember, VideoState, Message, AudioChangePayload, VideoURLPayload } from './types';
import { api, getStoredUser, getAuthToken } from './services/api';
import { WebSocketClient } from './services/websocket';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { useToast } from './context/useToast';
import { DyuetLogo } from './components/DyuetLogo';
import { RoomControls } from './room/RoomControls';
import { VideoPlayer } from './video/VideoPlayer';
import { ChatPanel } from './chat/ChatPanel';
import { WebRTCVoiceManager, type VoicePeer } from './services/webrtc';
import { PlusCircle, LogIn, User as UserIcon } from 'lucide-react';

function DyuetApp() {
  const toast = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [nameInput, setNameInput] = useState<string>(() => {
    const saved = getStoredUser();
    return saved?.name || '';
  });

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('join') || '').toUpperCase();
  });
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'CONNECTED' | 'DISCONNECTED'>('DISCONNECTED');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // WebRTC Voice Chat State
  const voiceManagerRef = useRef<WebRTCVoiceManager | null>(null);
  const [inVoice, setInVoice] = useState<boolean>(false);
  const [isSelfMuted, setIsSelfMuted] = useState<boolean>(false);
  const [voicePeers, setVoicePeers] = useState<VoicePeer[]>([]);

  // Chat sliding state & notification bubbles
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeNotification, setActiveNotification] = useState<Message | null>(null);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const notificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio Sync Suggestion Request state
  const [incomingAudioRequest, setIncomingAudioRequest] = useState<AudioChangePayload | null>(null);

  const [initialVideoState, setInitialVideoState] = useState<VideoState | undefined>(undefined);
  const [initialVideoURL, setInitialVideoURL] = useState<VideoURLPayload | undefined>(undefined);

  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);
  const wsClientRef = useRef<WebSocketClient | null>(null);

  // Clear notification timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const handleNewMessage = useCallback((msg: Message) => {
    if (msg.isSystem) return;

    setAllMessages((prev) => [...prev, msg]);

    if (msg.userId === currentUser?.id) return;

    if (!isChatOpen) {
      setUnreadCount((c) => c + 1);
    }

    setActiveNotification(msg);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      setActiveNotification(null);
    }, 4500);
  }, [currentUser?.id, isChatOpen]);

  const roomId = room?.id;

  useEffect(() => {
    if (!currentUser || !roomId) {
      return;
    }

    const token = getAuthToken() || '';
    const client = new WebSocketClient(token, roomId, (status) => {
      setWsStatus(status);
      if (status === 'CONNECTED') {
        setWsClient(client);
      } else if (status === 'DISCONNECTED') {
        setWsClient(null);
      }
    });

    client.on('ROOM_STATE', (msg) => {
      const payload = msg.payload as {
        room: Room;
        members: RoomMember[];
        messages: Message[];
        videoState: VideoState;
        videoURL?: VideoURLPayload;
      };
      if (payload.room) setRoom(payload.room);
      if (payload.members) setMembers(payload.members);
      if (payload.messages) setAllMessages(payload.messages.filter((m) => !m.isSystem));
      if (payload.videoState) setInitialVideoState(payload.videoState);
      if (payload.videoURL) setInitialVideoURL(payload.videoURL);
    });

    client.on('CHAT_MESSAGE', (msg) => {
      const chatMsg = msg.payload as Message;
      handleNewMessage(chatMsg);
    });

    client.on('USER_JOIN', (msg) => {
      const p = msg.payload as { userId: string; userName: string; avatar: string; isHost: boolean; isOnline: boolean };
      setMembers((prev) => {
        const exists = prev.find((m) => m.userId === p.userId);
        if (exists) {
          return prev.map((m) => (m.userId === p.userId ? { ...m, isOnline: true } : m));
        }
        return [
          ...prev,
          {
            roomId,
            userId: p.userId,
            user: { id: p.userId, name: p.userName, avatar: p.avatar, email: '' },
            isHost: p.isHost,
            isOnline: true,
            joinedAt: new Date().toISOString(),
          },
        ];
      });
      toast.info(`${p.userName} joined the room`);
    });

    client.on('USER_LEAVE', (msg) => {
      const p = msg.payload as { userId: string; isOnline: boolean };
      setMembers((prev) => prev.filter((m) => m.userId !== p.userId));
      vm.handleRemoteVoiceState({ userId: p.userId, userName: '', inVoice: false, isMuted: true });
    });

    client.on('UPDATE_SETTINGS', (msg) => {
      const p = msg.payload as { onlyHostCanControl: boolean };
      setRoom((prev) => (prev ? { ...prev, onlyHostCanControl: p.onlyHostCanControl } : null));
      toast.info(p.onlyHostCanControl ? 'Host-only controls enabled' : 'Controls open to everyone');
    });

    client.on('AUDIO_CHANGE_REQUEST', (msg) => {
      const p = msg.payload as AudioChangePayload;
      setIncomingAudioRequest(p);
    });

    const vm = new WebRTCVoiceManager(currentUser.id, client);
    vm.setCallbacks(
      (peers) => setVoicePeers(peers),
      (inV, isM) => {
        setInVoice(inV);
        setIsSelfMuted(isM);
      }
    );
    voiceManagerRef.current = vm;

    client.on('VOICE_SIGNAL', (msg) => {
      vm.handleSignal(msg.payload as any);
    });

    client.on('VOICE_STATE', (msg) => {
      vm.handleRemoteVoiceState(msg.payload as any);
    });

    client.connect();
    wsClientRef.current = client;

    return () => {
      vm.leaveVoice();
      voiceManagerRef.current = null;
      client.disconnect();
      wsClientRef.current = null;
    };
  }, [currentUser, roomId, handleNewMessage, toast]);

  // Ensure ephemeral user session exists with chosen name
  const ensureSession = async (): Promise<User> => {
    const finalName = nameInput.trim() || 'Guest_' + Math.random().toString(36).substring(2, 6);
    if (!nameInput.trim()) {
      setNameInput(finalName);
    }

    if (currentUser && currentUser.name === finalName && getAuthToken()) {
      return currentUser;
    }

    const session = await api.createSession(finalName);
    setCurrentUser(session.user);
    return session.user;
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await ensureSession();
      const newRoom = await api.createRoom();
      setRoom(newRoom);
      setIsHost(true);
      setMembers([
        {
          roomId: newRoom.id,
          userId: user.id,
          user: user,
          isHost: true,
          isOnline: true,
          joinedAt: new Date().toISOString(),
        },
      ]);
      toast.success('Room created! Share the room code or link.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create room';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await ensureSession();
      const res = await api.joinRoom(joinCodeInput.trim());
      setRoom(res.room);
      setIsHost(res.isHost);
      toast.success(`Joined room ${res.room.code}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Room not found or could not join';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = () => {
    voiceManagerRef.current?.leaveVoice();
    if (wsClientRef.current) {
      wsClientRef.current.disconnect();
      wsClientRef.current = null;
    }
    setWsClient(null);
    setRoom(null);
    setMembers([]);
    setInitialVideoState(undefined);
    setUnreadCount(0);
    setActiveNotification(null);
    setIncomingAudioRequest(null);
    setAllMessages([]);
    setInVoice(false);
    setIsSelfMuted(false);
    setVoicePeers([]);
    toast.info('Left watch room');
  };

  // Voice Chat Handlers
  const handleJoinVoice = async () => {
    if (!voiceManagerRef.current) return;
    const success = await voiceManagerRef.current.joinVoice();
    if (!success) {
      toast.error('Microphone access was denied. Please allow microphone permission in your browser to use Voice Chat.');
    } else {
      toast.success('Connected to Voice Chat!');
    }
  };

  const handleLeaveVoice = () => {
    voiceManagerRef.current?.leaveVoice();
    toast.info('Left voice chat');
  };

  const handleToggleSelfMute = () => {
    voiceManagerRef.current?.toggleSelfMute();
  };

  const handleSetPeerMute = (peerUserId: string, muted: boolean) => {
    voiceManagerRef.current?.setPeerMute(peerUserId, muted);
  };

  const handleSetPeerVolume = (peerUserId: string, volume: number) => {
    voiceManagerRef.current?.setPeerVolume(peerUserId, volume);
  };

  const handleUpdateSettings = (onlyHostCanControl: boolean) => {
    wsClientRef.current?.sendUpdateSettings(onlyHostCanControl);
    setRoom((prev) => (prev ? { ...prev, onlyHostCanControl } : null));
  };

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadCount(0);
        setActiveNotification(null);
      }
      return next;
    });
  };

  const handleOpenChat = () => {
    setIsChatOpen(true);
    setUnreadCount(0);
    setActiveNotification(null);
  };

  const handleSendChatMessage = (text: string) => {
    wsClientRef.current?.sendChatMessage(text);
  };

  // Zero-login instant Cinema Lobby Screen
  if (!room) {
    return (
      <div className="lobby-screen">
        <div className="lobby-card">
          <div className="lobby-icon-badge">
            <DyuetLogo size={58} />
          </div>

          <h1 className="lobby-heading">Duet</h1>
          <p className="lobby-subheading">Watch Movies &amp; Videos Together in Sync</p>

          {error && <div className="auth-error" role="alert">{error}</div>}

          {/* Quick Name Input */}
          <div style={{ marginBottom: 20, textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              Your Name
            </label>
            <div className="input-with-icon">
              <UserIcon className="input-icon" size={15} aria-hidden="true" />
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name (e.g. Shubh)"
                className="form-input has-icon"
                autoFocus
                aria-label="Your Name"
              />
            </div>
          </div>

          {/* Action 1: Create Room */}
          <button
            type="button"
            disabled={loading}
            onClick={handleCreateRoom}
            className="btn-primary"
          >
            <PlusCircle size={16} />
            {loading ? 'Creating...' : 'Create Watch Room'}
          </button>

          <div className="divider-row">
            <div className="divider-line" />
            <span className="divider-text">OR ENTER CODE</span>
            <div className="divider-line" />
          </div>

          {/* Action 2: Join Room */}
          <form onSubmit={handleJoinRoom}>
            <input
              type="text"
              maxLength={10}
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM CODE"
              className="form-input room-input"
              aria-label="Room Code"
            />

            <button
              type="submit"
              disabled={loading || !joinCodeInput.trim()}
              className="btn-secondary"
            >
              <LogIn size={15} />
              {loading ? 'Joining...' : 'Join Session'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active Theater View
  return (
    <div className="app-container">
      <RoomControls
        room={room}
        currentUser={currentUser || { id: '', name: nameInput || 'User', email: '', avatar: '' }}
        members={members}
        isHost={isHost}
        wsStatus={wsStatus}
        onUpdateSettings={handleUpdateSettings}
        onLeaveRoom={handleLeaveRoom}
        isChatOpen={isChatOpen}
        onToggleChat={handleToggleChat}
        unreadCount={unreadCount}
        inVoice={inVoice}
        isSelfMuted={isSelfMuted}
        voicePeers={voicePeers}
        onJoinVoice={handleJoinVoice}
        onLeaveVoice={handleLeaveVoice}
        onToggleSelfMute={handleToggleSelfMute}
        onSetPeerMute={handleSetPeerMute}
        onSetPeerVolume={handleSetPeerVolume}
      />

      <main className="theater-layout">
        <VideoPlayer
          room={room}
          isHost={isHost}
          currentUserName={currentUser?.name || nameInput || 'User'}
          wsClient={wsClient}
          initialVideoState={initialVideoState}
          activeNotification={activeNotification}
          onDismissNotification={() => setActiveNotification(null)}
          onOpenChat={handleOpenChat}
          isChatOpen={isChatOpen}
          chatMessages={allMessages}
          onSendChatMessage={handleSendChatMessage}
          incomingAudioRequest={incomingAudioRequest}
          onDismissAudioRequest={() => setIncomingAudioRequest(null)}
          initialVideoURL={initialVideoURL}
        />

        <ChatPanel
          currentUser={currentUser || { id: '', name: nameInput || 'User', email: '', avatar: '' }}
          wsClient={wsClient}
          messages={allMessages}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </main>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DyuetApp />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
