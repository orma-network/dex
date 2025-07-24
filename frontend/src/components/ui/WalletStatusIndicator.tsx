'use client';

import React, { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';

export const WalletStatusIndicator: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { data: balance } = useBalance({ address });
  const [showTooltip, setShowTooltip] = useState(false);

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

  if (!isConnected) {
    return (
      <div 
        className="wallet-status-indicator disconnected"
        title="Wallet not connected - Click Start menu to connect"
      >
        💳
      </div>
    );
  }

  return (
    <div 
      className="wallet-status-indicator connected"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={`Connected: ${address ? formatAddress(address) : 'Unknown'}`}
    >
      💳
      {showTooltip && address && (
        <div className="wallet-tooltip">
          <div className="tooltip-address">{formatAddress(address)}</div>
          {balance && (
            <div className="tooltip-balance">
              {formatBalance(balance.value, balance.decimals)} {balance.symbol}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
