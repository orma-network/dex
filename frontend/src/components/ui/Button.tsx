'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary';
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'medium',
  children,
  className = '',
  disabled = false,
  ...props
}) => {
  const baseClass = variant === 'primary' ? 'win98-button-primary' : 'win98-button';
  
  const sizeClasses = {
    small: 'text-xs px-2 py-1 min-w-16 min-h-5',
    medium: 'text-sm px-3 py-1 min-w-20 min-h-6',
    large: 'text-base px-4 py-2 min-w-24 min-h-8',
  };

  return (
    <button
      className={`${baseClass} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
