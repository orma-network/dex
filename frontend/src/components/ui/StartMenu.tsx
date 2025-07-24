'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWindowManager } from '@/contexts/WindowManagerContext';
import { WalletConnect } from '@/components/wallet/WalletConnect';
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { Button } from '@/components/ui/Button';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({ isOpen, onClose }) => {
  const { openWindow } = useWindowManager();
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleMenuItemClick = (action: () => void) => {
    action();
    onClose();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatBalance = (value: bigint, decimals: number) => {
    try {
      const divisor = BigInt(10 ** decimals);
      const whole = value / divisor;
      const fraction = value % divisor;

      if (whole > BigInt(999999)) {
        const millions = Number(whole) / 1000000;
        return `${millions.toFixed(1)}M`;
      } else if (whole > BigInt(999)) {
        const thousands = Number(whole) / 1000;
        return `${thousands.toFixed(1)}K`;
      } else {
        const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 2);
        const cleanFraction = fractionStr.replace(/0+$/, '');

        if (cleanFraction === '') {
          return whole.toString();
        }

        return `${whole}.${cleanFraction}`;
      }
    } catch (error) {
      return '0.00';
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={menuRef}
      className="win98-start-menu"
    >
      {/* Start Menu Header */}
      <div className="start-menu-header">
        <div className="start-menu-title">WinDex</div>
        <div className="start-menu-subtitle">Windows 98</div>
      </div>

      {/* Menu Items */}
      <div className="start-menu-items">
        {/* Applications Section */}
        <div className="start-menu-section">
          <div className="start-menu-section-title">Applications</div>
          
          <div 
            className="start-menu-item"
            onClick={() => handleMenuItemClick(() => openWindow('swap', 'WinDex - Token Swap'))}
          >
            <span className="menu-item-icon">💱</span>
            <span className="menu-item-text">Token Swap</span>
          </div>
          
          <div 
            className="start-menu-item"
            onClick={() => handleMenuItemClick(() => openWindow('liquidity', 'WinDex - Liquidity Management'))}
          >
            <span className="menu-item-icon">💧</span>
            <span className="menu-item-text">Liquidity Management</span>
          </div>
          
          <div 
            className="start-menu-item"
            onClick={() => handleMenuItemClick(() => openWindow('tokenizer', 'WinDex - Token Creator'))}
          >
            <span className="menu-item-icon">🪙</span>
            <span className="menu-item-text">Token Creator</span>
          </div>
          
          <div 
            className="start-menu-item"
            onClick={() => handleMenuItemClick(() => openWindow('pools', 'WinDex - Pools Overview'))}
          >
            <span className="menu-item-icon">📊</span>
            <span className="menu-item-text">Pools Overview</span>
          </div>
        </div>

        {/* Separator */}
        <div className="start-menu-separator"></div>

        {/* Wallet Section */}
        <div className="start-menu-section">
          <div className="start-menu-section-title">Wallet</div>

          {isConnected && address ? (
            <div className="start-menu-wallet-status">
              <div className="wallet-connected-item">
                <span className="menu-item-icon">💳</span>
                <div className="wallet-info">
                  <div className="wallet-status-text">Connected</div>
                  <div className="wallet-address-text">{formatAddress(address)}</div>
                  {balance && (
                    <div className="wallet-balance-text">
                      {formatBalance(balance.value, balance.decimals)} {balance.symbol}
                    </div>
                  )}
                </div>
              </div>

              {/* Disconnect Button */}
              <div className="start-menu-wallet-actions">
                <Button
                  size="small"
                  onClick={handleDisconnect}
                  className="start-menu-disconnect-btn"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="start-menu-wallet-connect">
              <WalletConnect />
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="start-menu-separator"></div>

        {/* System Section */}
        <div className="start-menu-section">
          <div className="start-menu-item disabled">
            <span className="menu-item-icon">⚙️</span>
            <span className="menu-item-text">Settings</span>
          </div>
          
          <div className="start-menu-item disabled">
            <span className="menu-item-icon">❓</span>
            <span className="menu-item-text">Help</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StartButtonProps {
  onClick: () => void;
  isMenuOpen: boolean;
}

export const StartButton: React.FC<StartButtonProps> = ({ onClick, isMenuOpen }) => {
  return (
    <div
      className={`win98-start-button ${isMenuOpen ? 'active' : ''}`}
      onClick={onClick}
    >
      <img
        src="/windows-98-48.png"
        alt="Windows 98 Logo"
        className="start-icon-image"
      />
      <span>Start</span>
    </div>
  );
};
