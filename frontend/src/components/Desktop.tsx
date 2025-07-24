'use client';

import React from 'react';
import { SwapInterface } from '@/components/dex/SwapInterface';
import { LiquidityInterface } from '@/components/dex/LiquidityInterface';
import { TokenizerInterface } from '@/components/dex/TokenizerInterface';
import { PoolsInterface } from '@/components/dex/PoolsInterface';
import { Button } from '@/components/ui/Button';
import { Taskbar } from '@/components/ui/Taskbar';
import { useWindowManager } from '@/contexts/WindowManagerContext';

export const Desktop: React.FC = () => {
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
    <div className="win98-desktop">
      {/* Desktop Icons */}
      <div className="desktop-icons">
        <div className="desktop-icon" onClick={handleOpenSwap}>
          <div className="icon">💱</div>
          <div className="label">Token Swap</div>
        </div>
        <div className="desktop-icon" onClick={handleOpenLiquidity}>
          <div className="icon">💧</div>
          <div className="label">Liquidity</div>
        </div>
        <div className="desktop-icon" onClick={handleOpenTokenizer}>
          <div className="icon">🪙</div>
          <div className="label">Token Creator</div>
        </div>
        <div className="desktop-icon" onClick={handleOpenPools}>
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
    </div>
  );
};
