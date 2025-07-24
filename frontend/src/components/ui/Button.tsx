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
  // 98.css uses 'default' class for primary buttons
  const variantClass = variant === 'primary' ? 'default' : '';

  // 98.css handles sizing automatically, but we can add custom size classes if needed
  const sizeClasses = {
    small: 'button-small',
    medium: '',
    large: 'button-large',
  };

  return (
    <button
      className={`${variantClass} ${sizeClasses[size]} ${className}`.trim()}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
