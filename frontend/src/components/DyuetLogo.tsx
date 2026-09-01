import React from 'react';

interface DyuetLogoProps {
  size?: number;
  className?: string;
}

export const DyuetLogo: React.FC<DyuetLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <img
      src="/duet-logo.png"
      alt="Duet Logo"
      width={size}
      height={size}
      className={`duet-logo-img ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-block',
        verticalAlign: 'middle',
        objectFit: 'contain',
        backgroundColor: 'transparent',
      }}
    />
  );
};
