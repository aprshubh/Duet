import React, { useEffect, useRef, useState } from 'react';
import type { VideoState, SyncCorrection, Room } from '../types';
import { WebSocketClient } from '../services/websocket';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  room: Room;
  wsClient: WebSocketClient | null;
  isHost: boolean;
  onClose?: () => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  room,
  wsClient,
  isHost,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const suppressBroadcastUntilRef = useRef<number>(0);
  const wsClientRef = useRef<WebSocketClient | null>(wsClient);
  useEffect(() => {
    wsClientRef.current = wsClient;
  }, [wsClient]);

  const [isReady, setIsReady] = useState(false);

  const canControl = !room.onlyHostCanControl || isHost;

  // Initialize YouTube API and player
  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!containerRef.current || !window.YT || !window.YT.Player) return;

      containerRef.current.innerHTML = '<div id="yt-player-target"></div>';

      playerRef.current = new window.YT.Player('yt-player-target', {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          autoplay: 1,
          controls: canControl ? 1 : 0,
          disablekb: canControl ? 0 : 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (isMounted) {
              setIsReady(true);
            }
          },
          onStateChange: (event: any) => {
            if (Date.now() < suppressBroadcastUntilRef.current) return;
            if (!canControl) return;

            const player = playerRef.current;
            if (!player) return;

            // YT.PlayerState: PLAYING (1), PAUSED (2)
            if (event.data === 1) {
              const currentTime = player.getCurrentTime() || 0;
              wsClientRef.current?.sendPlay(currentTime, player.getPlaybackRate() || 1.0);
            } else if (event.data === 2) {
              const currentTime = player.getCurrentTime() || 0;
              wsClientRef.current?.sendPause(currentTime, player.getPlaybackRate() || 1.0);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = () => {
        if (isMounted) {
          initPlayer();
        }
      };
    }

    return () => {
      isMounted = false;
      try {
        playerRef.current?.destroy();
      } catch {
        // cleanup ignore
      }
    };
  }, [videoId, canControl]);

  // Handle incoming remote sync actions
  useEffect(() => {
    if (!wsClient || !isReady) return;

    const unsubs = [
      wsClient.on('VIDEO_PLAY', (data: unknown) => {
        const state = data as VideoState;
        const player = playerRef.current;
        if (!player) return;

        suppressBroadcastUntilRef.current = Date.now() + 1200;
        const currentPos = player.getCurrentTime() || 0;
        if (Math.abs(currentPos - state.position) > 1.2) {
          player.seekTo(state.position, true);
        }
        player.playVideo();
      }),

      wsClient.on('VIDEO_PAUSE', (data: unknown) => {
        const state = data as VideoState;
        const player = playerRef.current;
        if (!player) return;

        suppressBroadcastUntilRef.current = Date.now() + 1200;
        player.seekTo(state.position, true);
        player.pauseVideo();
      }),

      wsClient.on('VIDEO_SEEK', (data: unknown) => {
        const state = data as VideoState;
        const player = playerRef.current;
        if (!player) return;

        suppressBroadcastUntilRef.current = Date.now() + 1200;
        player.seekTo(state.position, true);
      }),

      wsClient.on('SYNC_CORRECTION', (data: unknown) => {
        const correction = data as SyncCorrection;
        const player = playerRef.current;
        if (!player) return;

        if (Math.abs(correction.drift) > 2.0) {
          suppressBroadcastUntilRef.current = Date.now() + 1200;
          player.seekTo(correction.serverPosition, true);
          if (correction.playing) {
            player.playVideo();
          } else {
            player.pauseVideo();
          }
        }
      }),
    ];

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (player && isReady) {
        const currentTime = player.getCurrentTime() || 0;
        wsClient.sendSyncRequest(currentTime);
      }
    }, 4000);

    return () => {
      unsubs.forEach((u) => u());
      clearInterval(interval);
    };
  }, [wsClient, isReady]);

  return (
    <div className="youtube-player-wrapper" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
