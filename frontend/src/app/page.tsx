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
import { WindowManagerProvider, useWindowManager } from '../contexts/WindowManagerContext';
import { Taskbar } from '@/components/ui/Taskbar';

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

// Desktop Content Component that uses WindowManager
const DesktopContent: React.FC = () => {
  const { openWindow, getActiveWindows } = useWindowManager();

  const handleOpenSwap = () => {
    openWindow('swap', 'WinDex - Token Swap');
  };

  const handleOpenLiquidity = () => {
    openWindow('liquidity', 'WinDex - Liquidity Management');
  };

  const handleOpenTokenizer = () => {
    openWindow('tokenizer', 'WinDex - Token Creator');
  };

  const handleOpenPools = () => {
    openWindow('pools', 'WinDex - Pools Overview');
  };

  const activeWindows = getActiveWindows();

  return (
    <>
      {/* Desktop Icons */}
      <div className="desktop-icons">
        <div className="desktop-icon" onDoubleClick={handleOpenSwap}>
          <div className="icon">💱</div>
          <div className="label">Token Swap</div>
        </div>
        <div className="desktop-icon" onDoubleClick={handleOpenLiquidity}>
          <div className="icon">💧</div>
          <div className="label">Liquidity</div>
        </div>
        <div className="desktop-icon" onDoubleClick={handleOpenTokenizer}>
          <div className="icon">🪙</div>
          <div className="label">Token Creator</div>
        </div>
        <div className="desktop-icon" onDoubleClick={handleOpenPools}>
          <div className="icon">📊</div>
          <div className="label">Pools</div>
        </div>
      </div>

      {/* Render Active Windows */}
      {activeWindows.map(window => {
        switch (window.id) {
          case 'swap':
            return <SwapInterface key={window.id} />;
          case 'liquidity':
            return <LiquidityInterface key={window.id} />;
          case 'tokenizer':
            return <TokenizerInterface key={window.id} />;
          case 'pools':
            return <PoolsInterface key={window.id} />;
          default:
            return null;
        }
      })}

      {/* Taskbar */}
      <Taskbar />
    </>
  );
};

export default function Home() {
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
          <WindowManagerProvider>
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
            <div className="win98-desktop">
              <DesktopContent />
            </div>
          </WindowManagerProvider>
        </PoolsProvider>
      </TokenRegistryProvider>
    </NotificationContext.Provider>
  );
}
