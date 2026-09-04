import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { Room, Message, AudioChangePayload, VideoURLPayload, VideoState } from '../types';
import { WebSocketClient } from '../services/websocket';
import { Upload, Lock, Volume1 } from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';
import { ReactionOverlay } from '../components/ReactionOverlay';
import { YouTubePlayer } from './YouTubePlayer';
import { extractYouTubeId } from './utils';
import { useToast } from '../context/useToast';
import { useVideoSync } from './hooks/useVideoSync';
import { CinemaControls } from './components/CinemaControls';
import { YouTubeModal } from './components/YouTubeModal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { FullscreenChatOverlay } from './components/FullscreenChatOverlay';
import { EmptyPlayerState } from './components/EmptyPlayerState';

interface VideoPlayerProps {
  room: Room;
  isHost: boolean;
  currentUserName: string;
  wsClient: WebSocketClient | null;
  initialVideoState?: VideoState;
  activeNotification: Message | null;
  onDismissNotification: () => void;
  onOpenChat: () => void;
  isChatOpen: boolean;
  chatMessages: Message[];
  onSendChatMessage: (msg: string) => void;
  incomingAudioRequest: AudioChangePayload | null;
  onDismissAudioRequest: () => void;
  initialVideoURL?: VideoURLPayload;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  room,
  isHost,
  currentUserName,
  wsClient,
  initialVideoState,
  activeNotification,
  onDismissNotification,
  onOpenChat,
  isChatOpen,
  chatMessages,
  onSendChatMessage,
  incomingAudioRequest,
  onDismissAudioRequest,
  initialVideoURL,
}) => {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Video source & playback state
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(() => !!initialVideoState?.playing);
  const [currentTime, setCurrentTime] = useState<number>(() => initialVideoState?.position || 0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(() => initialVideoState?.rate || 1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // YouTube streaming state
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(() => {
    if (initialVideoURL?.sourceType === 'youtube' && initialVideoURL.url) {
      return extractYouTubeId(initialVideoURL.url);
    }
    return null;
  });
  const [showYoutubeModal, setShowYoutubeModal] = useState<boolean>(false);

  // Fullscreen chat & Settings states
  const [isFullscreenChatOpen, setIsFullscreenChatOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(0);
  const [availableAudioTracks, setAvailableAudioTracks] = useState<string[]>([
    'Track 1 - Default Audio',
    'Track 2 - Alternate Language',
    'Track 3 - Surround / Commentary',
  ]);

  const canControl = !room.onlyHostCanControl || isHost;

  // Cleanup object URLs to avoid memory leaks
  const cleanupCurrentVideoSrc = useCallback(() => {
    if (videoSrc && videoSrc.startsWith('blob:')) {
      URL.revokeObjectURL(videoSrc);
    }
  }, [videoSrc]);

  useEffect(() => {
    return () => {
      cleanupCurrentVideoSrc();
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [cleanupCurrentVideoSrc]);

  // Video sync hook
  const { syncStatus, driftMs, isApplyingServerState } = useVideoSync({
    videoRef,
    wsClient,
    videoSrc,
    isHost,
    isPlaying,
    onRemotePlay: () => setIsPlaying(true),
    onRemotePause: () => setIsPlaying(false),
    onRateChange: (rate) => setPlaybackRate(rate),
  });

  // Initial video position / play state on mount if provided
  useEffect(() => {
    if (!initialVideoState || !videoRef.current) return;
    const video = videoRef.current;
    if (initialVideoState.position > 0 && Math.abs(video.currentTime - initialVideoState.position) > 0.5) {
      video.currentTime = initialVideoState.position;
    }
    if (initialVideoState.playing && video.paused) {
      video.play().catch(() => {});
    }
  }, [initialVideoState]);

  // Listen for broadcasted video URL changes
  useEffect(() => {
    if (!wsClient) return;

    const unsubVideoUrl = wsClient.on('VIDEO_URL_CHANGE', (data: unknown) => {
      const payload = data as VideoURLPayload;
      if (payload && payload.sourceType === 'youtube' && payload.url) {
        const id = extractYouTubeId(payload.url);
        if (id) {
          setYoutubeVideoId(id);
          cleanupCurrentVideoSrc();
          setVideoSrc(null);
          setFileName(payload.title || 'YouTube Stream');
        }
      } else if (payload && payload.sourceType === 'file') {
        setYoutubeVideoId(null);
      }
    });

    return () => {
      unsubVideoUrl();
    };
  }, [wsClient, cleanupCurrentVideoSrc]);

  // Handle local video file selection
  const handleFileSelect = (file: File) => {
    if (!file) return;
    cleanupCurrentVideoSrc();
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setFileName(file.name);
    setYoutubeVideoId(null);
    wsClient?.sendVideoURL('', 'file', file.name);
    toast.success(`Loaded video: ${file.name}`);

    setTimeout(() => {
      const video = videoRef.current as any;
      if (video && video.audioTracks && video.audioTracks.length > 0) {
        const detected: string[] = [];
        for (let i = 0; i < video.audioTracks.length; i++) {
          const t = video.audioTracks[i];
          detected.push(t.label || t.language || `Audio Track ${i + 1}`);
        }
        setAvailableAudioTracks(detected);
      }
    }, 500);
  };

  // Handle YouTube stream load
  const handleLoadYouTubeUrl = (url: string) => {
    const id = extractYouTubeId(url);
    if (!id) {
      toast.error('Please enter a valid YouTube video link (e.g. https://youtu.be/... or https://youtube.com/watch?v=...)');
      return;
    }
    cleanupCurrentVideoSrc();
    setYoutubeVideoId(id);
    setVideoSrc(null);
    setFileName('YouTube Stream');
    setShowYoutubeModal(false);
    wsClient?.sendVideoURL(url, 'youtube', 'YouTube Stream');
    toast.success('Streaming YouTube video with room!');
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Fullscreen event listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs) {
        setIsFullscreenChatOpen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const togglePlay = useCallback(() => {
    if (!canControl) return;
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      wsClient?.sendPlay(video.currentTime, playbackRate);
    } else {
      video.pause();
      setIsPlaying(false);
      wsClient?.sendPause(video.currentTime, playbackRate);
    }
  }, [canControl, playbackRate, wsClient]);

  const handleSeek = (target: number) => {
    if (!canControl) return;
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = target;
    setCurrentTime(target);
    wsClient?.sendSeek(target);
  };

  const handleStep = (seconds: number) => {
    if (!canControl || !videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration || Infinity, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    wsClient?.sendSeek(newTime);
  };

  const handleRateChange = (newRate: number) => {
    if (!canControl) return;
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = newRate;
    setPlaybackRate(newRate);
    wsClient?.sendRate(newRate);
  };

  const handleSelectAudioTrack = (index: number) => {
    setSelectedAudioTrack(index);
    const video = videoRef.current as any;
    if (video && video.audioTracks && video.audioTracks.length > index) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = (i === index);
      }
    }
    setShowSettings(false);
    const label = availableAudioTracks[index] || `Track ${index + 1}`;
    wsClient?.sendAudioChangeRequest(index, label, currentUserName);
    toast.info(`Suggested audio track "${label}" to room`);
  };

  const handleAcceptIncomingAudio = () => {
    if (!incomingAudioRequest) return;
    const targetIndex = incomingAudioRequest.trackIndex;
    setSelectedAudioTrack(targetIndex);
    const video = videoRef.current as any;
    if (video && video.audioTracks && video.audioTracks.length > targetIndex) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = (i === targetIndex);
      }
    }
    onDismissAudioRequest();
    toast.success(`Switched audio to ${incomingAudioRequest.trackLabel}`);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (newVol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="video-player-container"
    >
      {/* Empty State / Select File or YouTube Link */}
      {!videoSrc && !youtubeVideoId ? (
        <EmptyPlayerState
          onSelectFile={handleFileSelect}
          onSelectYouTube={handleLoadYouTubeUrl}
        />
      ) : youtubeVideoId ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <YouTubePlayer
            videoId={youtubeVideoId}
            room={room}
            wsClient={wsClient}
            isHost={isHost}
          />
          <button
            type="button"
            onClick={() => {
              setYoutubeVideoId(null);
              setVideoSrc(null);
              wsClient?.sendVideoURL('', 'file');
            }}
            className="change-video-pill-btn"
            title="Switch back to local file or change video"
          >
            Switch Video
          </button>
        </div>
      ) : (
        <video
          ref={videoRef}
          src={videoSrc || undefined}
          onClick={togglePlay}
          onTimeUpdate={() => {
            if (videoRef.current && !isApplyingServerState.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onDurationChange={() => videoRef.current && setDuration(videoRef.current.duration)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="video-element"
          playsInline
        />
      )}

      {/* Drag & Drop Visual Target */}
      {isDraggingOver && (
        <div className="drag-overlay">
          <div className="drag-content">
            <Upload size={40} style={{ margin: '0 auto 8px auto' }} />
            <h4>Drop Video File Here</h4>
          </div>
        </div>
      )}

      {/* Sync Health HUD (Top Left) */}
      {videoSrc && (
        <div className="sync-hud">
          <span className={`sync-dot ${syncStatus === 'SYNCED' ? 'synced' : 'adjusting'}`} />
          <span className="sync-text">{syncStatus === 'SYNCED' ? 'SYNCED' : 'ADJUSTING'}</span>
          {driftMs !== 0 && (
            <span className="sync-drift">{driftMs > 0 ? `+${driftMs}` : driftMs}ms</span>
          )}
          {fileName && (
            <span className="video-filename" title={fileName}>
              {fileName}
            </span>
          )}
        </div>
      )}

      {/* Permission Lock indicator */}
      {!canControl && videoSrc && (
        <div className="perm-lock">
          <Lock size={13} />
          <span>Host Only Controls</span>
        </div>
      )}

      {/* Audio Change Request Notification Banner */}
      {incomingAudioRequest && (
        <div className="audio-request-banner" role="alert">
          <Volume1 size={18} style={{ color: 'var(--status-warn)', flexShrink: 0 }} />
          <div className="audio-request-text">
            <strong>{incomingAudioRequest.fromUser}</strong> requested to switch audio to{' '}
            <strong>{incomingAudioRequest.trackLabel}</strong>. Switch too?
          </div>
          <div className="audio-request-actions">
            <button
              type="button"
              onClick={handleAcceptIncomingAudio}
              className="btn-accept-audio"
            >
              Switch Audio
            </button>
            <button
              type="button"
              onClick={onDismissAudioRequest}
              className="btn-dismiss-audio"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Floating Chat Bubble Notification Overlay */}
      {activeNotification && (!isChatOpen || isFullscreen) && !isFullscreenChatOpen && (
        <div className="floating-chat-bubble-container">
          <div
            className="floating-chat-toast"
            onClick={() => {
              if (isFullscreen) {
                setIsFullscreenChatOpen(true);
              } else {
                onOpenChat();
              }
              onDismissNotification();
            }}
            title="Click to open chat"
          >
            <UserAvatar
              name={activeNotification.userName}
              avatar={activeNotification.avatar}
              size={32}
              className="toast-avatar"
            />
            <div className="toast-content">
              <div className="toast-header">
                <span className="toast-name">{activeNotification.userName}</span>
                <span className="toast-badge">New Message</span>
              </div>
              <div className="toast-message">{activeNotification.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Chat Overlay */}
      <FullscreenChatOverlay
        isOpen={isFullscreen && isFullscreenChatOpen}
        onClose={() => setIsFullscreenChatOpen(false)}
        messages={chatMessages}
        currentUserName={currentUserName}
        onSendMessage={onSendChatMessage}
      />

      {/* Audio Track Settings Modal */}
      <AudioSettingsModal
        isOpen={showSettings && !!videoSrc}
        onClose={() => setShowSettings(false)}
        availableTracks={availableAudioTracks}
        selectedTrack={selectedAudioTrack}
        onSelectTrack={handleSelectAudioTrack}
      />

      {/* Bottom Cinema Controls Bar */}
      {videoSrc && (
        <CinemaControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          playbackRate={playbackRate}
          isFullscreen={isFullscreen}
          isFullscreenChatOpen={isFullscreenChatOpen}
          showSettings={showSettings}
          showControls={showControls}
          canControl={canControl}
          onTogglePlay={togglePlay}
          onStep={handleStep}
          onSeek={handleSeek}
          onToggleMute={toggleMute}
          onVolumeChange={handleVolumeChange}
          onRateChange={handleRateChange}
          onToggleFullscreenChat={() => setIsFullscreenChatOpen(!isFullscreenChatOpen)}
          onToggleSettings={() => setShowSettings(!showSettings)}
          onOpenYouTubeModal={() => setShowYoutubeModal(true)}
          onSelectFile={handleFileSelect}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      {/* YouTube Stream Modal */}
      <YouTubeModal
        isOpen={showYoutubeModal}
        onClose={() => setShowYoutubeModal(false)}
        onSubmit={handleLoadYouTubeUrl}
      />

      {/* Live Floating Emoji Reactions Layer */}
      <ReactionOverlay wsClient={wsClient} currentUserName={currentUserName} />
    </div>
  );
};

export default VideoPlayer;
