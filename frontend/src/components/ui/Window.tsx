'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWindowManager } from '@/contexts/WindowManagerContext';

interface WindowProps {
  id?: string;
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
  id,
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
  // Try to use window manager if available and id is provided
  const windowManager = (() => {
    try {
      return useWindowManager();
    } catch {
      return null;
    }
  })();

  const windowState = id && windowManager ? windowManager.getWindow(id) : null;
  // Use window manager state if available, otherwise use local state
  const [localPosition, setLocalPosition] = useState({ x, y });
  const [localSize, setLocalSize] = useState({ width, height });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [localIsMaximized, setLocalIsMaximized] = useState(false);
  const [previousState, setPreviousState] = useState({ x, y, width, height });

  // Determine actual state values
  const position = windowState?.position || localPosition;
  const size = windowState?.size || localSize;
  const isMaximized = windowState?.isMaximized || localIsMaximized;
  const isActive = windowState ? (windowManager?.activeWindowId === id) : active;

  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newPosition = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        };

        if (windowManager && id) {
          windowManager.updateWindowPosition(id, newPosition);
        } else {
          setLocalPosition(newPosition);
        }
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
      if (windowManager && id) {
        windowManager.focusWindow(id);
      }
      onFocus?.();
    }
  };

  const handleMaximize = () => {
    if (windowManager && id) {
      windowManager.maximizeWindow(id);
    } else {
      if (isMaximized) {
        // Restore
        setLocalPosition({ x: previousState.x, y: previousState.y });
        setLocalSize({ width: previousState.width, height: previousState.height });
        setLocalIsMaximized(false);
      } else {
        // Maximize
        setPreviousState({ x: position.x, y: position.y, width: size.width, height: size.height });
        setLocalPosition({ x: 0, y: 0 });
        setLocalSize({ width: window.innerWidth, height: window.innerHeight - 40 }); // Account for taskbar
        setLocalIsMaximized(true);
      }
    }
    onMaximize?.();
  };

  const handleMinimize = () => {
    if (windowManager && id) {
      windowManager.minimizeWindow(id);
    }
    onMinimize?.();
  };

  const handleClose = () => {
    if (windowManager && id) {
      windowManager.closeWindow(id);
    }
    onClose?.();
  };

  const windowStyle: React.CSSProperties = {
    position: className?.includes('fixed') ? 'fixed' : 'absolute',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    zIndex: className?.includes('z-[') ? undefined : (windowState?.zIndex || (isActive ? 1000 : 1)),
    display: windowState?.isOpen === false ? 'none' : undefined,
  };

  // Don't render if window is closed via window manager
  if (windowState?.isOpen === false) {
    return null;
  }

  // Don't render if window is minimized via window manager
  if (windowState?.isMinimized) {
    return null;
  }

  return (
    <div
      ref={windowRef}
      className={`window ${className}`}
      style={windowStyle}
      onClick={() => {
        if (windowManager && id) {
          windowManager.focusWindow(id);
        }
        onFocus?.();
      }}
    >
      {/* Title Bar */}
      <div
        className={`title-bar ${isActive ? '' : 'inactive'}`}
        onMouseDown={handleTitleBarMouseDown}
      >
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          {minimizable && (
            <button
              aria-label="Minimize"
              className="minimize"
              onClick={handleMinimize}
              title="Minimize"
            />
          )}
          {maximizable && (
            <button
              aria-label={isMaximized ? "Restore" : "Maximize"}
              className={isMaximized ? "restore" : "maximize"}
              onClick={handleMaximize}
              title={isMaximized ? "Restore" : "Maximize"}
            />
          )}
          {closable && (
            <button
              aria-label="Close"
              className="close"
              onClick={handleClose}
              title="Close"
            />
          )}
        </div>
      </div>

      {/* Window Content */}
      <div className="window-body">
        {children}
      </div>
    </div>
  );
};

export default Window;
