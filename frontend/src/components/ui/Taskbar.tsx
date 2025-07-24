'use client';

import React, { useState } from 'react';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { StartMenu, StartButton } from '@/components/ui/StartMenu';
import { WalletStatusIndicator } from '@/components/ui/WalletStatusIndicator';

export const Taskbar: React.FC = () => {
  const { windows, activeWindowId, restoreWindow, focusWindow } = useWindowManager();
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);

  // Get all open windows (both visible and minimized)
  const openWindows = windows.filter(w => w.isOpen);
  const minimizedWindows = windows.filter(w => w.isOpen && w.isMinimized);

  const handleTaskbarButtonClick = (windowId: string) => {
    const window = windows.find(w => w.id === windowId);
    if (!window) return;

    if (window.isMinimized) {
      restoreWindow(windowId);
    } else if (activeWindowId === windowId) {
      // If clicking on active window, minimize it
      // minimizeWindow(windowId); // Uncomment if you want this behavior
    } else {
      focusWindow(windowId);
    }
  };

  // Always show taskbar for wallet functionality and system tray

  return (
    <>
      <StartMenu
        isOpen={isStartMenuOpen}
        onClose={() => setIsStartMenuOpen(false)}
      />

      <div className="win98-taskbar">
        <StartButton
          onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
          isMenuOpen={isStartMenuOpen}
        />
      
      <div className="win98-taskbar-buttons">
        {openWindows.map(window => (
          <button
            key={window.id}
            className={`win98-taskbar-button ${
              activeWindowId === window.id && !window.isMinimized ? 'active' : ''
            } ${window.isMinimized ? 'minimized' : ''}`}
            onClick={() => handleTaskbarButtonClick(window.id)}
            title={window.title}
          >
            <span className="taskbar-icon">{window.icon || '📄'}</span>
            <span className="taskbar-title">{window.title}</span>
          </button>
        ))}
      </div>

      <div className="win98-system-tray">
        <WalletStatusIndicator />
        <NetworkStatus />
        <div className="system-time">
          {new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })}
        </div>
      </div>
    </div>
    </>
  );
};
