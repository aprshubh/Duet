import { useEffect, useRef, useState } from 'react';
import type { VideoState, SyncCorrection } from '../../types';
import { WebSocketClient } from '../../services/websocket';

export type SyncStatus = 'SYNCED' | 'CATCHING_UP' | 'SEEKING' | 'WAITING_VIDEO';

interface UseVideoSyncProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  wsClient: WebSocketClient | null;
  videoSrc: string | null;
  isHost: boolean;
  isPlaying: boolean;
  onRemotePlay?: () => void;
  onRemotePause?: () => void;
  onRateChange?: (rate: number) => void;
}

export function useVideoSync({
  videoRef,
  wsClient,
  videoSrc,
  isHost,
  isPlaying,
  onRemotePlay,
  onRemotePause,
  onRateChange,
}: UseVideoSyncProps) {
  const [playbackSyncState, setPlaybackSyncState] = useState<'SYNCED' | 'CATCHING_UP' | 'SEEKING'>('SYNCED');
  const [driftMs, setDriftMs] = useState<number>(0);
  const isApplyingServerState = useRef<boolean>(false);

  const syncStatus: SyncStatus = !videoSrc ? 'WAITING_VIDEO' : playbackSyncState;

  useEffect(() => {
    if (!wsClient || !videoSrc) return;

    const unsubPlay = wsClient.on('VIDEO_PLAY', (msg) => {
      const payload = msg.payload as VideoState;
      const video = videoRef.current;
      if (!video) return;

      isApplyingServerState.current = true;
      if (Math.abs(video.currentTime - payload.position) > 0.3) {
        video.currentTime = payload.position;
      }
      video.playbackRate = payload.rate || 1.0;
      video.play().catch(() => {});
      onRemotePlay?.();
      onRateChange?.(payload.rate || 1.0);
      setPlaybackSyncState('SYNCED');
      setTimeout(() => {
        isApplyingServerState.current = false;
      }, 300);
    });

    const unsubPause = wsClient.on('VIDEO_PAUSE', (msg) => {
      const payload = msg.payload as VideoState;
      const video = videoRef.current;
      if (!video) return;

      isApplyingServerState.current = true;
      video.pause();
      if (Math.abs(video.currentTime - payload.position) > 0.2) {
        video.currentTime = payload.position;
      }
      onRemotePause?.();
      setPlaybackSyncState('SYNCED');
      setTimeout(() => {
        isApplyingServerState.current = false;
      }, 300);
    });

    const unsubSeek = wsClient.on('VIDEO_SEEK', (msg) => {
      const payload = msg.payload as VideoState;
      const video = videoRef.current;
      if (!video) return;

      isApplyingServerState.current = true;
      video.currentTime = payload.position;
      setPlaybackSyncState('SEEKING');
      setTimeout(() => {
        isApplyingServerState.current = false;
        setPlaybackSyncState('SYNCED');
      }, 300);
    });

    const unsubRate = wsClient.on('VIDEO_RATE', (msg) => {
      const payload = msg.payload as VideoState;
      const video = videoRef.current;
      if (!video) return;

      video.playbackRate = payload.rate;
      onRateChange?.(payload.rate);
    });

    const unsubCorrection = wsClient.on('SYNC_CORRECTION', (msg) => {
      const correction = msg.payload as SyncCorrection;
      const video = videoRef.current;
      if (!video || !videoSrc) return;

      const drift = correction.drift;
      setDriftMs(Math.round(drift * 1000));

      if (correction.action === 'HARD_SEEK') {
        isApplyingServerState.current = true;
        video.currentTime = correction.serverPosition;
        setPlaybackSyncState('SEEKING');
        setTimeout(() => {
          isApplyingServerState.current = false;
          setPlaybackSyncState('SYNCED');
        }, 300);
      } else if (correction.action === 'RATE_ADJUST') {
        video.playbackRate = correction.targetRate;
        setPlaybackSyncState('CATCHING_UP');
      } else {
        if (video.playbackRate !== correction.rate) {
          video.playbackRate = correction.rate;
        }
        setPlaybackSyncState('SYNCED');
      }

      if (correction.playing && video.paused) {
        video.play().catch(() => {});
        onRemotePlay?.();
      } else if (!correction.playing && !video.paused) {
        video.pause();
        onRemotePause?.();
      }
    });

    return () => {
      unsubPlay();
      unsubPause();
      unsubSeek();
      unsubRate();
      unsubCorrection();
    };
  }, [wsClient, videoSrc, videoRef, onRemotePlay, onRemotePause, onRateChange]);

  // Periodic drift check: only for non-host members when playing
  useEffect(() => {
    if (!wsClient || !videoSrc || isHost || !isPlaying) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.seeking && !video.paused) {
        wsClient.sendSyncRequest(video.currentTime);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [wsClient, videoSrc, isHost, isPlaying, videoRef]);

  return {
    syncStatus,
    driftMs,
    isApplyingServerState,
  };
}
