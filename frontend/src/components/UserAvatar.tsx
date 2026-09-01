import React from 'react';

interface UserAvatarProps {
  name?: string;
  avatar?: string;
  size?: number;
  className?: string;
}

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, Math.min(2, name.length)).toUpperCase();
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name = 'User',
  avatar,
  size = 28,
  className = '',
}) => {
  // If the avatar is the old pixelated bottts dicebear robot, replace it with the modern gradient initials avatar
  const isBottts = avatar && avatar.includes('/bottts/');
  const shouldUseImage = avatar && !isBottts && (avatar.startsWith('http') || avatar.startsWith('data:') || avatar.startsWith('/'));

  if (shouldUseImage) {
    return (
      <img
        src={avatar}
        alt={name}
        width={size}
        height={size}
        className={`user-avatar-img ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          display: 'inline-block',
          verticalAlign: 'middle',
        }}
        onError={(e) => {
          // If image fails, fallback to rendering initials
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  const gradient = getGradient(name);
  const initials = getInitials(name);
  const fontSize = Math.max(10, Math.round(size * 0.42));

  return (
    <div
      className={`user-avatar-initials ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: gradient,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        letterSpacing: '-0.5px',
        border: '1.5px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        flexShrink: 0,
        userSelect: 'none',
      }}
      title={name}
    >
      {initials}
    </div>
  );
};
