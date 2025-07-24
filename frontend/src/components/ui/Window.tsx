'use client';

import React, { useState, useRef, useEffect } from 'react';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  closable?: boolean;
  active?: boolean;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
  className?: string;
}

export const Window: React.FC<WindowProps> = ({
  title,
  children,
  width = 400,
  height = 300,
  x = 100,
  y = 100,
  resizable = true,
  minimizable = true,
  maximizable = true,
  closable = true,
  active = true,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  className = '',
}) => {
  const [position, setPosition] = useState({ x, y });
  const [size, setSize] = useState({ width, height });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [previousState, setPreviousState] = useState({ x, y, width, height });

  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart]);

  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    if (e.detail === 2) {
      // Double click to maximize/restore
      handleMaximize();
      return;
    }

    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
      onFocus?.();
    }
  };

  const handleMaximize = () => {
    if (isMaximized) {
      // Restore
      setPosition({ x: previousState.x, y: previousState.y });
      setSize({ width: previousState.width, height: previousState.height });
      setIsMaximized(false);
    } else {
      // Maximize
      setPreviousState({ x: position.x, y: position.y, width: size.width, height: size.height });
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight - 40 }); // Account for taskbar
      setIsMaximized(true);
    }
    onMaximize?.();
  };

  const handleMinimize = () => {
    onMinimize?.();
  };

  const handleClose = () => {
    onClose?.();
  };

  const windowStyle: React.CSSProperties = {
    position: className?.includes('fixed') ? 'fixed' : 'absolute',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    zIndex: className?.includes('z-[') ? undefined : (active ? 1000 : 1),
  };

  return (
    <div
      ref={windowRef}
      className={`win98-window ${active ? 'active' : ''} ${className}`}
      style={windowStyle}
      onClick={onFocus}
    >
      {/* Title Bar */}
      <div
        className={`win98-titlebar ${active ? '' : 'inactive'}`}
        onMouseDown={handleTitleBarMouseDown}
      >
        <div className="win98-titlebar-text">{title}</div>
        <div className="win98-titlebar-controls">
          {minimizable && (
            <button
              className="win98-control-button"
              onClick={handleMinimize}
              title="Minimize"
            >
              _
            </button>
          )}
          {maximizable && (
            <button
              className="win98-control-button"
              onClick={handleMaximize}
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? '❐' : '□'}
            </button>
          )}
          {closable && (
            <button
              className="win98-control-button"
              onClick={handleClose}
              title="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Window Content */}
      <div className="win98-window-content">
        {children}
      </div>
    </div>
  );
};

export default Window;
