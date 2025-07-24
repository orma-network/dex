'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

export function WalletConnect() {
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({ address });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleConnect = (connectorId: string) => {
    const connector = connectors.find(c => c.id === connectorId);
    if (connector) {
      connect({ connector });
      setIsConnectDialogOpen(false);
    }
  };

  const formatAddress = (addr: string) => {
    // More compact format for taskbar
    return `${addr.slice(0, 4)}...${addr.slice(-3)}`;
  };

  const formatBalance = (balance: bigint, decimals: number) => {
    try {
      const divisor = BigInt(10 ** decimals);
      const whole = balance / divisor;
      const fraction = balance % divisor;

      // For taskbar, use more compact formatting
      if (whole > BigInt(999999)) {
        // Show in millions: 1.2M
        const millions = Number(whole) / 1000000;
        return `${millions.toFixed(1)}M`;
      } else if (whole > BigInt(999)) {
        // Show in thousands: 1.2K
        const thousands = Number(whole) / 1000;
        return `${thousands.toFixed(1)}K`;
      } else {
        // Show with limited decimal places
        const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 2);
        const cleanFraction = fractionStr.replace(/0+$/, '');

        if (cleanFraction === '') {
          return whole.toString();
        }

        return `${whole}.${cleanFraction}`;
      }
    } catch (error) {
      console.error('Error formatting balance:', error);
      return '0.00';
    }
  };

  // Prevent hydration mismatch by showing loading state until mounted
  if (!isMounted) {
    return (
      <Button variant="primary" disabled>
        Loading...
      </Button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="wallet-status-panel">
        <div className="wallet-info">
          <div className="wallet-label">Connected:</div>
          <div
            className="wallet-address"
            title={address}
          >
            {formatAddress(address)}
          </div>
          <div className="wallet-balance">
            {isBalanceLoading ? (
              'Loading...'
            ) : balance ? (
              `${formatBalance(balance.value, balance.decimals)} ${balance.symbol}`
            ) : (
              'No balance'
            )}
          </div>
        </div>
        <Button
          size="small"
          onClick={() => disconnect()}
          className="disconnect-button"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setIsConnectDialogOpen(true)}
        disabled={isPending}
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </Button>

      <Dialog
        title="Connect Wallet"
        isOpen={isConnectDialogOpen}
        onClose={() => setIsConnectDialogOpen(false)}
        width={380}
        height={280}
      >
        <div className="wallet-connect-dialog">
          <div className="dialog-instruction">
            Choose a wallet to connect:
          </div>

          <div className="connector-list">
            {connectors.map((connector) => (
              <Button
                key={connector.id}
                onClick={() => handleConnect(connector.id)}
                disabled={isPending}
                className="connector-button"
              >
                <div className="connector-info">
                  <span className="connector-name">{connector.name}</span>
                  {connector.id === 'injected' && (
                    <span className="connector-type">(Browser Wallet)</span>
                  )}
                </div>
              </Button>
            ))}
          </div>

          <div className="network-notice">
            <div className="notice-icon">⚠️</div>
            <div className="notice-text">
              <strong>Important:</strong> Make sure you're connected to the Anvil local network (Chain ID: 31337)
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export default WalletConnect;
