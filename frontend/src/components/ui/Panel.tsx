'use client';

import React from 'react';

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'inset' | 'outset' | 'flat';
}

export const Panel: React.FC<PanelProps> = ({
  children,
  className = '',
  variant = 'default',
}) => {
  const variantClasses = {
    default: 'win98-panel',
    inset: 'win98-inset bg-gray-300 p-2',
    outset: 'win98-outset bg-gray-300 p-2',
    flat: 'win98-flat bg-gray-300 p-2',
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
};

interface GroupBoxProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const GroupBox: React.FC<GroupBoxProps> = ({
  title,
  children,
  className = '',
}) => {
  return (
    <div className={`win98-groupbox ${className}`}>
      <div className="win98-groupbox-label">{title}</div>
      {children}
    </div>
  );
};

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  className = '',
}) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={`win98-progress ${className}`}>
      <div
        className="win98-progress-bar"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export default Panel;
