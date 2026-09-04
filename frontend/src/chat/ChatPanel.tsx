import React, { useState, useEffect, useRef } from 'react';
import type { Message, User } from '../types';
import { WebSocketClient } from '../services/websocket';
import { Send, MessageSquare, ChevronRight } from 'lucide-react';
import { UserAvatar } from '../components/UserAvatar';

interface ChatPanelProps {
  currentUser: User;
  wsClient: WebSocketClient | null;
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  currentUser,
  wsClient,
  messages,
  isOpen,
  onClose,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!wsClient) return;

    const unsubTyping = wsClient.on('TYPING', (msg) => {
      const payload = msg.payload as { isTyping: boolean; userName: string };
      if (payload.isTyping) {
        setTypingUsers((prev) => Array.from(new Set([...prev, payload.userName])));
      } else {
        setTypingUsers((prev) => prev.filter((name) => name !== payload.userName));
      }
    });

    return () => {
      unsubTyping();
    };
  }, [wsClient]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !wsClient) return;

    wsClient.sendChatMessage(inputMessage.trim());
    setInputMessage('');
    wsClient.sendTyping(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    if (!wsClient) return;

    wsClient.sendTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      wsClient.sendTyping(false);
    }, 2000);
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const userMessages = messages.filter((m) => !m.isSystem);

  return (
    <div className={`chat-drawer ${!isOpen ? 'collapsed' : ''}`} aria-label="Room Chat">
      {/* Header with slide/collapse toggle */}
      <div className="chat-header">
        <div className="chat-header-left">
          <MessageSquare size={16} />
          <span className="chat-title">Chat</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="chat-close-btn"
          title="Close chat drawer"
          aria-label="Close chat drawer"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="messages-container">
        {userMessages.length === 0 ? (
          <div className="empty-chat">
            <p>No messages yet</p>
          </div>
        ) : (
          userMessages.map((msg) => {
            const isMe = msg.userId === currentUser.id;

            return (
              <div
                key={msg.id}
                className={`message-row ${isMe ? 'is-me' : ''}`}
              >
                <UserAvatar
                  name={msg.userName}
                  avatar={msg.avatar}
                  size={28}
                  className="msg-avatar"
                />

                <div className="msg-bubble-wrap">
                  <div className="msg-info">
                    <span className="msg-sender">{msg.userName}</span>
                    <span className="msg-time">{formatTime(msg.createdAt)}</span>
                  </div>

                  <div className="msg-bubble">
                    {msg.message}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="typing-indicator" aria-live="polite">
            <span className="typing-dot" />
            <span>{typingUsers.join(', ')} typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSendMessage} className="chat-input-area">
        <div className="chat-input-wrapper">
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="form-input chat-input-field"
            aria-label="Chat message"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="chat-send-btn"
            aria-label="Send message"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
};
