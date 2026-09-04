import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Trigger floating emoji animation
  const spawnReaction = useCallback((emoji: string, userName: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const leftPercent = 65 + Math.random() * 25; // Random position on right side (65% - 90%)

    setReactions((prev) => [...prev.slice(-25), { id, emoji, userName, leftPercent }]);

    const t = setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
      timeoutsRef.current.delete(t);
    }, 3200);
    timeoutsRef.current.add(t);
  }, []);

  useEffect(() => {
    const activeTimeouts = timeoutsRef.current;
    return () => {
      activeTimeouts.forEach((t) => clearTimeout(t));
      activeTimeouts.clear();
    };
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
    spawnReaction(emoji, currentUserName);
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
        <div className={`reaction-picker ${isPickerOpen ? 'open' : ''}`} role="group" aria-label="Emoji Reactions">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="reaction-btn"
              onClick={() => handleSendReaction(emoji)}
              title={`React ${emoji}`}
              aria-label={`React ${emoji}`}
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
          aria-label="Toggle emoji reaction picker"
          aria-expanded={isPickerOpen}
        >
          <Smile size={18} />
        </button>
      </div>
    </>
  );
};
