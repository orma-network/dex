'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { Window } from '@/components/ui/Window';
import { Button } from '@/components/ui/Button';
import { useNotification } from '../../app/page';
import { usePools, PoolInfo } from '../../contexts/PoolsContext';

export function PoolsInterface() {
  const { address, isConnected } = useAccount();
  const { showNotification } = useNotification();
  const { pools, activePools, isLoading, refreshPools, getTotalPools, getTotalLiquidity } = usePools();
  
  // UI State
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshPools();
      showNotification(
        'Pools Refreshed',
        'Pool data has been updated successfully! 📊',
        'success'
      );
    } catch (error) {
      showNotification(
        'Refresh Failed',
        'Failed to refresh pool data. Please try again.',
        'error'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format large numbers
  const formatLargeNumber = (value: bigint, decimals: number): string => {
    const formatted = formatUnits(value, decimals);
    const num = parseFloat(formatted);
    
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    } else {
      return num.toFixed(4);
    }
  };

  // Calculate pool ratio
  const getPoolRatio = (pool: PoolInfo): string => {
    if (pool.reserve0 === 0n || pool.reserve1 === 0n) return 'N/A';
    
    const ratio0 = formatUnits(pool.reserve1 * BigInt(10 ** pool.token0.decimals) / pool.reserve0, pool.token1.decimals);
    const ratio1 = formatUnits(pool.reserve0 * BigInt(10 ** pool.token1.decimals) / pool.reserve1, pool.token0.decimals);
    
    return `1 ${pool.token0.symbol} = ${parseFloat(ratio0).toFixed(4)} ${pool.token1.symbol}`;
  };

  // Get pools to display based on active tab
  const displayPools = activeTab === 'active' ? activePools : pools;

  return (
    <Window
      title="WinDex - Liquidity Pools"
      width={600}
      height={500}
      x={200}
      y={150}
    >
      <div className="pools-container">
        {/* Status Messages */}
        {!isMounted && (
          <div className="swap-status-message">
            <div className="win98-status-panel">
              <span className="win98-status-text">Loading pools...</span>
            </div>
          </div>
        )}

        {isMounted && !isConnected && (
          <div className="swap-status-message">
            <div className="win98-status-panel warning">
              <span className="win98-status-text">Connect your wallet to view pool information</span>
            </div>
          </div>
        )}

        {isMounted && isConnected && (
          <>
            {/* Header with Stats */}
            <div className="pools-header">
              <div className="pools-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Pools:</span>
                  <span className="stat-value">{getTotalPools()}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Active Pools:</span>
                  <span className="stat-value">{activePools.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">All Pairs:</span>
                  <span className="stat-value">{pools.length}</span>
                </div>
              </div>
              
              <Button
                size="small"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="refresh-pools-button"
              >
                {isRefreshing || isLoading ? '⟳ Refreshing...' : '↻ Refresh'}
              </Button>
            </div>

            {/* Tab Navigation */}
            <div className="pools-tabs">
              <button
                className={`win98-tab ${activeTab === 'active' ? 'active' : ''}`}
                onClick={() => setActiveTab('active')}
              >
                💧 Active Pools ({activePools.length})
              </button>
              <button
                className={`win98-tab ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                📊 All Pairs ({pools.length})
              </button>
            </div>

            {/* Pools Content */}
            <div className="pools-content">
              {displayPools.length === 0 ? (
                <div className="no-pools">
                  {activeTab === 'active' ? (
                    <>
                      <p>💧 No active liquidity pools found</p>
                      <p>Pools will appear here once liquidity is added to token pairs.</p>
                      <p>
                        <br />
                        To create pools:
                        <br />
                        1. Create tokens using 🪙 Tokenizer
                        <br />
                        2. Add liquidity using 💧 Liquidity interface
                        <br />
                        3. Pools will appear here with trading data
                      </p>
                    </>
                  ) : (
                    <>
                      <p>📊 No token pairs found</p>
                      <p>Token pairs will appear here once created through liquidity provision.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="pools-list">
                  {displayPools.map((pool, index) => (
                    <div key={pool.pairAddress} className={`pool-card ${pool.hasLiquidity ? 'active' : 'inactive'}`}>
                      <div className="pool-header">
                        <div className="pool-pair">
                          <span className="pair-tokens">
                            {pool.token0.symbol}/{pool.token1.symbol}
                          </span>
                          <span className={`pool-status ${pool.hasLiquidity ? 'active' : 'inactive'}`}>
                            {pool.hasLiquidity ? '🟢 Active' : '🔴 No Liquidity'}
                          </span>
                        </div>
                        <div className="pool-address" title={pool.pairAddress}>
                          📍 {pool.pairAddress.slice(0, 6)}...{pool.pairAddress.slice(-4)}
                        </div>
                      </div>
                      
                      {pool.hasLiquidity && (
                        <div className="pool-details">
                          <div className="pool-reserves">
                            <div className="reserve-item">
                              <span className="reserve-label">{pool.token0.symbol} Reserve:</span>
                              <span className="reserve-value">
                                {formatLargeNumber(pool.reserve0, pool.token0.decimals)}
                              </span>
                            </div>
                            <div className="reserve-item">
                              <span className="reserve-label">{pool.token1.symbol} Reserve:</span>
                              <span className="reserve-value">
                                {formatLargeNumber(pool.reserve1, pool.token1.decimals)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="pool-info">
                            <div className="info-item">
                              <span className="info-label">Pool Ratio:</span>
                              <span className="info-value">{getPoolRatio(pool)}</span>
                            </div>
                            <div className="info-item">
                              <span className="info-label">LP Tokens:</span>
                              <span className="info-value">
                                {formatLargeNumber(pool.totalSupply, 18)} SLP
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {!pool.hasLiquidity && (
                        <div className="pool-empty">
                          <p>This pair exists but has no liquidity.</p>
                          <p>Add liquidity to activate trading.</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Window>
  );
}

export default PoolsInterface;
