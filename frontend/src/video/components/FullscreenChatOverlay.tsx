import React, { useRef, useEffect, useState } from 'react';
import type { Message } from '../../types';
import { X, Send } from 'lucide-react';

interface FullscreenChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  currentUserName: string;
  onSendMessage: (text: string) => void;
}

export const FullscreenChatOverlay: React.FC<FullscreenChatOverlayProps> = ({
  isOpen,
  onClose,
  messages,
  currentUserName,
  onSendMessage,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    onSendMessage(inputMessage.trim());
    setInputMessage('');
  };

  const userMessages = messages.filter((m) => !m.isSystem);

  return (
    <div className="fullscreen-chat-panel">
      <button
        type="button"
        onClick={onClose}
        className="fs-floating-close-btn"
        aria-label="Close fullscreen chat"
      >
        <X size={14} />
      </button>

      <div className="fs-chat-messages">
        {userMessages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.45)', fontSize: 11, padding: 12 }}>
            No messages yet
          </div>
        ) : (
          userMessages.map((msg) => {
            const isMe = msg.userName === currentUserName;
            return (
              <div
                key={msg.id}
                className={`fs-msg-item ${isMe ? 'is-me' : 'is-other'}`}
              >
                {!isMe && (
                  <span className="fs-msg-author">
                    {msg.userName}
                  </span>
                )}
                <div className="fs-msg-bubble">
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="fs-chat-input-area">
        <div className="fs-input-pill">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type message..."
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="fs-input-send-btn"
            aria-label="Send message"
          >
            <Send size={12} />
          </button>
        </div>
      </form>
    </div>
  );
};
