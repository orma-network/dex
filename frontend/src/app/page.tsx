'use client';

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { SwapInterface } from '@/components/dex/SwapInterface';
import { LiquidityInterface } from '@/components/dex/LiquidityInterface';
import { TokenizerInterface } from '@/components/dex/TokenizerInterface';
import { PoolsInterface } from '@/components/dex/PoolsInterface';
import { Button } from '@/components/ui/Button';
import { Window } from '@/components/ui/Window';
import { NotificationDialog } from '@/components/ui/NotificationDialog';
import { TokenRegistryProvider } from '../contexts/TokenRegistryContext';
import { PoolsProvider } from '../contexts/PoolsContext';

// Create a context for notifications
interface NotificationContextType {
  showNotification: (title: string, message: string, type: 'error' | 'warning' | 'info' | 'success') => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default function Home() {
  const [activeWindows, setActiveWindows] = useState<string[]>(['swap']);
  const [activeWindow, setActiveWindow] = useState<string>('swap');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'error' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  useEffect(() => {
    // Set initial time and update every second
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };

    updateTime(); // Set initial time
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  const openWindow = (windowId: string) => {
    if (!activeWindows.includes(windowId)) {
      setActiveWindows([...activeWindows, windowId]);
    }
    setActiveWindow(windowId);
  };

  const closeWindow = (windowId: string) => {
    setActiveWindows(activeWindows.filter(id => id !== windowId));
    if (activeWindow === windowId) {
      setActiveWindow(activeWindows[0] || '');
    }
  };

  const focusWindow = (windowId: string) => {
    setActiveWindow(windowId);
  };

  const showNotification = useCallback((title: string, message: string, type: 'error' | 'warning' | 'info' | 'success') => {
    setNotification({
      isOpen: true,
      title,
      message,
      type
    });
  }, []);

  const closeNotification = () => {
    setNotification({
      isOpen: false,
      title: '',
      message: '',
      type: 'info'
    });
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      <TokenRegistryProvider>
        <PoolsProvider>
      {/* Notification Dialog - Renders at root level */}
      <NotificationDialog
        isOpen={notification.isOpen}
        onClose={closeNotification}
        title={notification.title}
        message={notification.message}
        type={notification.type}
        showCopy={true}
      />

      {/* Main App */}
    <div className="h-screen w-screen bg-teal-600 relative overflow-hidden">
      {/* Desktop Icons */}
      <div className="absolute top-4 left-4 flex flex-col gap-4">
        <div
          className="win98-desktop-icon"
          onDoubleClick={() => openWindow('swap')}
        >
          <div className="win98-icon bg-blue-500 flex items-center justify-center text-white font-bold">
            💱
          </div>
          <div className="win98-icon-text">WinDex</div>
        </div>

        <div
          className="win98-desktop-icon"
          onDoubleClick={() => openWindow('liquidity')}
        >
          <div className="win98-icon bg-green-500 flex items-center justify-center text-white font-bold">
            💧
          </div>
          <div className="win98-icon-text">Liquidity</div>
        </div>

        <div
          className="win98-desktop-icon"
          onDoubleClick={() => openWindow('tokenizer')}
        >
          <div className="win98-icon bg-yellow-500 flex items-center justify-center text-white font-bold">
            🪙
          </div>
          <div className="win98-icon-text">Tokenizer</div>
        </div>

        <div
          className="win98-desktop-icon"
          onDoubleClick={() => openWindow('pools')}
        >
          <div className="win98-icon bg-purple-500 flex items-center justify-center text-white font-bold">
            📊
          </div>
          <div className="win98-icon-text">Pools</div>
        </div>
      </div>

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gray-300 border-t-2 border-gray-400 flex items-center px-2 gap-2">
        <Button
          size="small"
          className="h-8 px-3 font-bold"
        >
          Start
        </Button>

        <div className="flex-1 flex gap-1">
          {activeWindows.map(windowId => (
            <Button
              key={windowId}
              size="small"
              className={`h-8 px-3 ${activeWindow === windowId ? 'border-inset' : ''}`}
              onClick={() => focusWindow(windowId)}
            >
              {windowId === 'swap' && '💱 WinDex'}
              {windowId === 'liquidity' && '💧 Liquidity'}
              {windowId === 'tokenizer' && '🪙 Tokenizer'}
              {windowId === 'pools' && '📊 Pools'}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <WalletConnect />

          {/* System Tray Area */}
          <div className="win98-systray">
            <NetworkStatus />
            <div className="win98-clock">
              {currentTime || '--:--:--'}
            </div>
          </div>
        </div>
      </div>

      {/* Windows */}
      {activeWindows.includes('swap') && (
        <SwapInterface />
      )}

      {activeWindows.includes('liquidity') && (
        <LiquidityInterface />
      )}

      {activeWindows.includes('tokenizer') && (
        <TokenizerInterface />
      )}

      {activeWindows.includes('pools') && (
        <PoolsInterface />
      )}
    </div>
        </PoolsProvider>
      </TokenRegistryProvider>
    </NotificationContext.Provider>
  );
}
