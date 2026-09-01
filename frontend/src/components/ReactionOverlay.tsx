import React, { useState, useEffect, useCallback } from 'react';
import type { ReactionPayload } from '../types';
import { WebSocketClient } from '../services/websocket';
import { Smile } from 'lucide-react';

interface ReactionItem {
  id: string;
  emoji: string;
  userName: string;
  leftPercent: number;
}

interface ReactionOverlayProps {
  wsClient: WebSocketClient | null;
  currentUserName: string;
}

const EMOJI_OPTIONS = ['❤️', '😂', '🍿', '🔥', '👏', '😱', '🎉'];

export const ReactionOverlay: React.FC<ReactionOverlayProps> = ({
  wsClient,
  currentUserName,
}) => {
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Trigger floating emoji animation
  const spawnReaction = useCallback((emoji: string, userName: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const leftPercent = 65 + Math.random() * 25; // Random position on right side (65% - 90%)

    setReactions((prev) => [...prev.slice(-25), { id, emoji, userName, leftPercent }]);

    // Auto remove after animation completes (3.2 seconds)
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3200);
  }, []);

  // Listen for incoming reactions from other room members
  useEffect(() => {
    if (!wsClient) return;

    const unsubscribe = wsClient.on('ROOM_REACTION', (data: unknown) => {
      const payload = data as ReactionPayload;
      if (payload && payload.emoji) {
        spawnReaction(payload.emoji, payload.userName || 'Member');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [wsClient, spawnReaction]);

  const handleSendReaction = (emoji: string) => {
    // Immediate local spawn
    spawnReaction(emoji, currentUserName);
    // Broadcast to room
    wsClient?.sendReaction(emoji, currentUserName);
  };

  return (
    <>
      {/* Floating Animated Emojis Container */}
      <div className="reaction-stream-container" aria-hidden="true">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="floating-reaction-bubble"
            style={{ left: `${r.leftPercent}%` }}
          >
            <span className="reaction-emoji">{r.emoji}</span>
            <span className="reaction-sender">{r.userName}</span>
          </div>
        ))}
      </div>

      {/* Floating Reaction Bar & Quick Trigger */}
      <div className="reaction-dock">
        <div className={`reaction-picker ${isPickerOpen ? 'open' : ''}`}>
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="reaction-btn"
              onClick={() => handleSendReaction(emoji)}
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`reaction-toggle-btn ${isPickerOpen ? 'active' : ''}`}
          onClick={() => setIsPickerOpen((prev) => !prev)}
          title="Send Reaction"
        >
          <Smile size={18} />
        </button>
      </div>
    </>
  );
};
