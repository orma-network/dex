'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Window } from '@/components/ui/Window';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { CONTRACT_ADDRESSES, ROUTER_ABI, ERC20_ABI, FACTORY_ABI } from '@/lib/wagmi';
import { useNotification } from '@/app/page';
import { useTokenRegistry } from '../../contexts/TokenRegistryContext';
import { usePools } from '../../contexts/PoolsContext';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Liquidity interface supports both tokens with existing pools and new token pairs

type LiquidityTab = 'add' | 'remove' | 'positions';

export function LiquidityInterface() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { showNotification } = useNotification();
  const { tokens: registryTokens } = useTokenRegistry();
  const { availableTokens: poolTokens, refreshPools } = usePools();

  // For liquidity, we primarily use tokens from registry (includes user-created tokens from TokenFactory)
  // and supplement with pool tokens for existing liquidity pairs
  const availableTokens = React.useMemo(() => {
    const tokenMap = new Map<string, Token>();

    // Add tokens from registry first (includes user-created tokens from TokenFactory)
    registryTokens.forEach(token => {
      if (token.address && token.address !== '0x0000000000000000000000000000000000000000') {
        tokenMap.set(token.address.toLowerCase(), token);
      }
    });

    // Add tokens from pools (existing liquidity) - only if not already present
    poolTokens.forEach(token => {
      if (token.address &&
          token.address !== '0x0000000000000000000000000000000000000000' &&
          !tokenMap.has(token.address.toLowerCase())) {
        tokenMap.set(token.address.toLowerCase(), token);
      }
    });

    // Convert to array and sort by symbol for consistent ordering
    return Array.from(tokenMap.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [registryTokens, poolTokens]);

  // UI State
  const [activeTab, setActiveTab] = useState<LiquidityTab>('add');
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if we have enough tokens to work with
  const hasTokens = availableTokens.length >= 2;

  // Add Liquidity State - Initialize with empty tokens, will be set when availableTokens loads
  const [tokenA, setTokenA] = useState<Token>({ address: '', symbol: '', name: '', decimals: 18 });
  const [tokenB, setTokenB] = useState<Token>({ address: '', symbol: '', name: '', decimals: 18 });
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [pairExists, setPairExists] = useState(false);
  const [pairAddress, setPairAddress] = useState<string>('');
  const [reserves, setReserves] = useState<{ reserveA: bigint; reserveB: bigint } | null>(null);
  const [isCalculatingB, setIsCalculatingB] = useState(false);
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  
  // Remove Liquidity State - Initialize with empty tokens, will be set when availableTokens loads
  const [removeTokenA, setRemoveTokenA] = useState<Token>({ address: '', symbol: '', name: '', decimals: 18 });
  const [removeTokenB, setRemoveTokenB] = useState<Token>({ address: '', symbol: '', name: '', decimals: 18 });
  const [lpTokenAmount, setLpTokenAmount] = useState('');
  const [removePercentage, setRemovePercentage] = useState('25');

  // Transaction handling
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize tokens when availableTokens becomes available
  useEffect(() => {
    if (availableTokens.length >= 2) {
      // Only set if current tokens are empty (initial state)
      if (!tokenA.address) {
        setTokenA(availableTokens[0]);
      }
      if (!tokenB.address) {
        setTokenB(availableTokens[1]);
      }
      if (!removeTokenA.address) {
        setRemoveTokenA(availableTokens[0]);
      }
      if (!removeTokenB.address) {
        setRemoveTokenB(availableTokens[1]);
      }
    }
  }, [availableTokens, tokenA.address, tokenB.address, removeTokenA.address, removeTokenB.address]);

  // Function to validate Ethereum address
  const isValidAddress = (address: string): boolean => {
    return address &&
           address.startsWith('0x') &&
           address.length === 42 &&
           /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Get token balances with refetch capability
  const { data: balanceA, refetch: refetchBalanceA } = useReadContract({
    address: tokenA.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && isValidAddress(tokenA.address) }
  });

  const { data: balanceB, refetch: refetchBalanceB } = useReadContract({
    address: tokenB.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && isValidAddress(tokenB.address) }
  });

  // Get remove liquidity token balances
  const { data: removeBalanceA, refetch: refetchRemoveBalanceA } = useReadContract({
    address: removeTokenA.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && isValidAddress(removeTokenA.address) }
  });

  const { data: removeBalanceB, refetch: refetchRemoveBalanceB } = useReadContract({
    address: removeTokenB.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && isValidAddress(removeTokenB.address) }
  });

  // Function to check pair and fetch reserves
  const checkPairAndReserves = useCallback(async () => {
    // Validate addresses before making contract calls
    if (!tokenA.address || !tokenB.address || !publicClient ||
        !isValidAddress(tokenA.address) || !isValidAddress(tokenB.address)) {
      setPairExists(false);
      setPairAddress('');
      setReserves(null);
      return;
    }

    try {
      const fetchedPairAddress = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.FACTORY as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [tokenA.address as `0x${string}`, tokenB.address as `0x${string}`],
      });

      const exists = fetchedPairAddress !== '0x0000000000000000000000000000000000000000' &&
                     isValidAddress(fetchedPairAddress as string);
      setPairExists(exists);
      setPairAddress(fetchedPairAddress as string);

      if (exists) {
        // Fetch reserves
        const pairReserves = await publicClient.readContract({
          address: fetchedPairAddress as `0x${string}`,
          abi: [{
            inputs: [],
            name: 'getReserves',
            outputs: [
              { name: 'reserve0', type: 'uint112' },
              { name: 'reserve1', type: 'uint112' },
              { name: 'blockTimestampLast', type: 'uint32' }
            ],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'getReserves',
        });

        // Determine which reserve corresponds to which token
        const token0Address = await publicClient.readContract({
          address: fetchedPairAddress as `0x${string}`,
          abi: [{
            inputs: [],
            name: 'token0',
            outputs: [{ name: '', type: 'address' }],
            stateMutability: 'view',
            type: 'function'
          }],
          functionName: 'token0',
        });

        const isTokenAFirst = tokenA.address.toLowerCase() === (token0Address as string).toLowerCase();

        setReserves({
          reserveA: isTokenAFirst ? pairReserves[0] : pairReserves[1],
          reserveB: isTokenAFirst ? pairReserves[1] : pairReserves[0],
        });
      } else {
        setReserves(null);
      }
    } catch (error) {
      console.error('Error checking pair:', error);
      setPairExists(false);
      setPairAddress('');
      setReserves(null);
    }
  }, [tokenA.address, tokenB.address, publicClient]);

  // Handle transaction success
  useEffect(() => {
    if (isSuccess) {
      showNotification(
        'Liquidity Added Successfully',
        'Your liquidity has been added to the pool! 🎉\n\n✅ LP tokens have been minted to your wallet\n✅ Your token balances have been updated\n✅ Check "My Positions" tab to see your LP tokens',
        'success'
      );

      // Refetch all balances with loading indicator
      setIsRefreshingBalances(true);

      Promise.all([
        refetchBalanceA(),
        refetchBalanceB(),
        refetchRemoveBalanceA(),
        refetchRemoveBalanceB(),
        refetchLpTokenBalance(),
        refetchRemoveLpTokenBalance(),
        refreshPools(), // Refresh pools to update available tokens
      ]).then(() => {
        // Refetch reserves to update pool ratio
        return checkPairAndReserves();
      }).finally(() => {
        setTimeout(() => {
          setIsRefreshingBalances(false);
        }, 500);
      });

      // Reset form fields
      setAmountA('');
      setAmountB('');
      setLpTokenAmount('');
    }
  }, [isSuccess, showNotification, refetchBalanceA, refetchBalanceB, refetchRemoveBalanceA, refetchRemoveBalanceB, checkPairAndReserves]);

  // Check if pair exists and get reserves
  useEffect(() => {
    checkPairAndReserves();
    // Also refetch balances when tokens change
    if (tokenA.address && address) {
      refetchBalanceA();
    }
    if (tokenB.address && address) {
      refetchBalanceB();
    }
  }, [tokenA.address, tokenB.address, publicClient, checkPairAndReserves, address, refetchBalanceA, refetchBalanceB]);

  // Refetch remove liquidity balances when remove tokens change
  useEffect(() => {
    if (removeTokenA.address && address) {
      refetchRemoveBalanceA();
    }
    if (removeTokenB.address && address) {
      refetchRemoveBalanceB();
    }
  }, [removeTokenA.address, removeTokenB.address, address, refetchRemoveBalanceA, refetchRemoveBalanceB]);

  // Calculate Token B amount when Token A changes (for existing pairs)
  useEffect(() => {
    if (!pairExists || !reserves || !amountA || isCalculatingB) return;

    try {
      const amountABigInt = parseUnits(amountA, tokenA.decimals);

      // Use Uniswap V2 quote formula: amountB = (amountA * reserveB) / reserveA
      if (reserves.reserveA > 0) {
        const calculatedAmountB = (amountABigInt * reserves.reserveB) / reserves.reserveA;
        const formattedAmountB = formatUnits(calculatedAmountB, tokenB.decimals);

        // Only update if the calculated value is different from current value
        if (formattedAmountB !== amountB) {
          setAmountB(formattedAmountB);
        }
      }
    } catch (error) {
      console.error('Error calculating Token B amount:', error);
    }
  }, [amountA, pairExists, reserves, tokenA.decimals, tokenB.decimals, isCalculatingB]);

  // Handle Token A input change
  const handleAmountAChange = (value: string) => {
    setAmountA(value);

    // If pair doesn't exist, allow manual input for both tokens
    if (!pairExists) {
      // Don't auto-calculate for new pairs
      return;
    }
  };

  // Handle Token B input change (only for new pairs)
  const handleAmountBChange = (value: string) => {
    if (!pairExists) {
      // For new pairs, allow manual input
      setAmountB(value);
    } else {
      // For existing pairs, calculate Token A based on Token B
      setIsCalculatingB(true);
      setAmountB(value);

      if (reserves && value) {
        try {
          const amountBBigInt = parseUnits(value, tokenB.decimals);

          if (reserves.reserveB > 0) {
            const calculatedAmountA = (amountBBigInt * reserves.reserveA) / reserves.reserveB;
            const formattedAmountA = formatUnits(calculatedAmountA, tokenA.decimals);
            setAmountA(formattedAmountA);
          }
        } catch (error) {
          console.error('Error calculating Token A amount:', error);
        }
      }

      setTimeout(() => setIsCalculatingB(false), 100);
    }
  };

  // Manual refresh function
  const refreshBalances = async () => {
    setIsRefreshingBalances(true);

    try {
      await Promise.all([
        refetchBalanceA(),
        refetchBalanceB(),
        refetchRemoveBalanceA(),
        refetchRemoveBalanceB(),
        refetchLpTokenBalance(),
        refetchRemoveLpTokenBalance(),
        checkPairAndReserves(),
      ]);
    } catch (error) {
      console.error('Error refreshing balances:', error);
    } finally {
      setTimeout(() => {
        setIsRefreshingBalances(false);
      }, 500);
    }
  };

  const formatBalance = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return '0.0000';
    return parseFloat(formatUnits(balance, decimals)).toFixed(4);
  };

  const handleAddLiquidity = async () => {
    if (!isConnected || !address || !amountA || !amountB ||
        !isValidAddress(tokenA.address) || !isValidAddress(tokenB.address)) return;

    try {
      setIsLoading(true);
      
      const amountADesired = parseUnits(amountA, tokenA.decimals);
      const amountBDesired = parseUnits(amountB, tokenB.decimals);
      const amountAMin = parseUnits((parseFloat(amountA) * 0.95).toString(), tokenA.decimals); // 5% slippage
      const amountBMin = parseUnits((parseFloat(amountB) * 0.95).toString(), tokenB.decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

      // First approve both tokens
      await writeContract({
        address: tokenA.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.ROUTER as `0x${string}`, amountADesired],
      });

      // Wait for first approval
      await new Promise(resolve => setTimeout(resolve, 2000));

      await writeContract({
        address: tokenB.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.ROUTER as `0x${string}`, amountBDesired],
      });

      // Wait for second approval
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Add liquidity
      await writeContract({
        address: CONTRACT_ADDRESSES.ROUTER as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'addLiquidity',
        args: [
          tokenA.address as `0x${string}`,
          tokenB.address as `0x${string}`,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          address,
          deadline,
        ],
      });

      console.log('Liquidity added successfully!');
    } catch (error) {
      console.error('Add liquidity failed:', error);
      showNotification(
        'Add Liquidity Failed',
        `Failed to add liquidity: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n• Your token balances\n• Token approvals\n• Network connection`,
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Get LP token balance for current add liquidity pair
  const { data: lpTokenBalance, refetch: refetchLpTokenBalance } = useReadContract({
    address: pairAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && isValidAddress(pairAddress) && pairAddress !== '0x0000000000000000000000000000000000000000' }
  });

  // Get LP token balance for remove liquidity pair
  const [removePairAddress, setRemovePairAddress] = useState<string>('');

  // Get remove liquidity pair address
  useEffect(() => {
    const getRemovePairAddress = async () => {
      if (!removeTokenA.address || !removeTokenB.address || !publicClient ||
          !isValidAddress(removeTokenA.address) || !isValidAddress(removeTokenB.address)) {
        setRemovePairAddress('');
        return;
      }

      try {
        const fetchedPairAddress = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.FACTORY as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: 'getPair',
          args: [removeTokenA.address as `0x${string}`, removeTokenB.address as `0x${string}`],
        });

        setRemovePairAddress(fetchedPairAddress as string);
      } catch (error) {
        console.error('Error getting remove pair address:', error);
        setRemovePairAddress('');
      }
    };

    getRemovePairAddress();
  }, [removeTokenA.address, removeTokenB.address, publicClient]);

  const { data: removeLpTokenBalance, refetch: refetchRemoveLpTokenBalance } = useReadContract({
    address: removePairAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && isValidAddress(removePairAddress) && removePairAddress !== '0x0000000000000000000000000000000000000000' }
  });

  const handleRemoveLiquidity = async () => {
    if (!isConnected || !address || !lpTokenAmount ||
        !isValidAddress(removeTokenA.address) || !isValidAddress(removeTokenB.address)) return;

    try {
      setIsLoading(true);

      // Get pair address first
      const pairAddress = await publicClient?.readContract({
        address: CONTRACT_ADDRESSES.FACTORY as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [removeTokenA.address as `0x${string}`, removeTokenB.address as `0x${string}`],
      });

      if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Trading pair does not exist');
      }

      const liquidity = parseUnits(lpTokenAmount, 18); // LP tokens are typically 18 decimals
      const amountAMin = BigInt(0); // For demo, set to 0. In production, calculate based on slippage
      const amountBMin = BigInt(0);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

      // First approve LP tokens to router
      await writeContract({
        address: pairAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.ROUTER as `0x${string}`, liquidity],
      });

      // Wait for approval
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Remove liquidity
      await writeContract({
        address: CONTRACT_ADDRESSES.ROUTER as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'removeLiquidity',
        args: [
          removeTokenA.address as `0x${string}`,
          removeTokenB.address as `0x${string}`,
          liquidity,
          amountAMin,
          amountBMin,
          address,
          deadline,
        ],
      });

      console.log('Liquidity removed successfully!');
    } catch (error) {
      console.error('Remove liquidity failed:', error);
      showNotification(
        'Remove Liquidity Failed',
        `Failed to remove liquidity: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n• Your LP token balance\n• Pair exists\n• Network connection`,
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Validation helpers
  const isValidAmount = (amount: string) => {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0;
  };

  const hasInsufficientBalance = (amount: string, balance: bigint | undefined, decimals: number) => {
    if (!amount || !balance) return false;
    try {
      const amountBigInt = parseUnits(amount, decimals);
      return amountBigInt > balance;
    } catch {
      return false;
    }
  };

  const canAddLiquidity = isMounted && isConnected &&
    isValidAmount(amountA) && isValidAmount(amountB) &&
    !hasInsufficientBalance(amountA, balanceA, tokenA.decimals) &&
    !hasInsufficientBalance(amountB, balanceB, tokenB.decimals) &&
    !isPending && !isConfirming;

  const canRemoveLiquidity = isMounted && isConnected && isValidAmount(lpTokenAmount) && !isPending && !isConfirming;

  return (
    <Window
      title="WinDex - Liquidity Management"
      width={520}
      height={650}
      x={150}
      y={80}
      className="font-mono"
    >
      <div className="liquidity-dialog-container">
        {/* Status Messages */}
        {!isMounted && (
          <div className="swap-status-message">
            <div className="win98-status-panel">
              <span className="win98-status-text">Loading...</span>
            </div>
          </div>
        )}

        {isMounted && !isConnected && (
          <div className="swap-status-message">
            <div className="win98-status-panel warning">
              <span className="win98-status-text">Please connect your wallet to manage liquidity</span>
            </div>
          </div>
        )}

        {isMounted && isConnected && !CONTRACT_ADDRESSES.FACTORY && (
          <div className="swap-status-message">
            <div className="win98-status-panel error">
              <span className="win98-status-text">
                Smart contracts not deployed. Please deploy contracts to Anvil first.
              </span>
            </div>
          </div>
        )}

        {isMounted && isConnected && CONTRACT_ADDRESSES.FACTORY && availableTokens.length === 0 && (
          <div className="swap-status-message">
            <div className="win98-status-panel warning">
              <span className="win98-status-text">
                🪙 No tokens available for liquidity provision
                <br />
                <br />
                To add liquidity:
                <br />
                1. Create tokens using the 🪙 Tokenizer
                <br />
                2. Tokens will appear here for liquidity provision
                <br />
                3. Add liquidity to create tradeable pools
              </span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        {isMounted && isConnected && CONTRACT_ADDRESSES.FACTORY && hasTokens && (
          <>
            <div className="liquidity-tabs">
              <button
                className={`win98-tab ${activeTab === 'add' ? 'active' : ''}`}
                onClick={() => setActiveTab('add')}
              >
                Add Liquidity
              </button>
              <button
                className={`win98-tab ${activeTab === 'remove' ? 'active' : ''}`}
                onClick={() => setActiveTab('remove')}
              >
                Remove Liquidity
              </button>
              <button
                className={`win98-tab ${activeTab === 'positions' ? 'active' : ''}`}
                onClick={() => setActiveTab('positions')}
              >
                My Positions
              </button>
            </div>

            {/* Add Liquidity Tab */}
            {activeTab === 'add' && (
              <div className="liquidity-content">
                <div className="liquidity-section">
                  <div className="section-header">
                    <h3 className="section-title">Add Liquidity</h3>
                    <button
                      className="refresh-button"
                      onClick={refreshBalances}
                      disabled={isRefreshingBalances}
                      title="Refresh balances and pool data"
                    >
                      {isRefreshingBalances ? '⟳' : '↻'}
                    </button>
                  </div>
                  
                  {/* Token A Input */}
                  <div className="liquidity-input-group">
                    <div className="input-header">
                      <span className="token-label">Token A</span>
                      <div className="balance-controls">
                        <span className="balance-label">
                          Balance: {isRefreshingBalances ? '⟳' : ''} {formatBalance(balanceA, tokenA.decimals)} {tokenA.symbol}
                        </span>
                        <button
                          className="max-button"
                          onClick={() => {
                            if (balanceA) {
                              handleAmountAChange(formatUnits(balanceA, tokenA.decimals));
                            }
                          }}
                          disabled={!isMounted || !isConnected || !balanceA}
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                    <div className="liquidity-input-row">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={amountA}
                        onChange={(e) => handleAmountAChange(e.target.value)}
                        className={`liquidity-amount-input ${
                          amountA && hasInsufficientBalance(amountA, balanceA, tokenA.decimals)
                            ? 'error'
                            : ''
                        }`}
                        disabled={!isMounted || !isConnected}
                      />
                      {amountA && hasInsufficientBalance(amountA, balanceA, tokenA.decimals) && (
                        <div className="input-error">Insufficient balance</div>
                      )}
                      <Select
                        value={tokenA.address}
                        onChange={(e) => {
                          const token = availableTokens.find((t: Token) => t.address === e.target.value);
                          if (token) setTokenA(token);
                        }}
                        options={availableTokens && availableTokens.length > 0 ? availableTokens.map(token => ({
                          value: token.address,
                          label: `${token.symbol} (${token.name})`,
                        })) : [{ value: '', label: 'No tokens available' }]}
                        className="liquidity-token-select"
                        disabled={!isMounted || !isConnected}
                      />
                    </div>
                  </div>

                  {/* Plus Icon */}
                  <div className="liquidity-plus">+</div>

                  {/* Token B Input */}
                  <div className="liquidity-input-group">
                    <div className="input-header">
                      <span className="token-label">
                        Token B
                        {pairExists && reserves && (
                          <span className="calculated-indicator"> (Auto-calculated)</span>
                        )}
                      </span>
                      <div className="balance-controls">
                        <span className="balance-label">
                          Balance: {isRefreshingBalances ? '⟳' : ''} {formatBalance(balanceB, tokenB.decimals)} {tokenB.symbol}
                        </span>
                        {!pairExists && (
                          <button
                            className="max-button"
                            onClick={() => {
                              if (balanceB) {
                                handleAmountBChange(formatUnits(balanceB, tokenB.decimals));
                              }
                            }}
                            disabled={!isMounted || !isConnected || !balanceB}
                          >
                            MAX
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="liquidity-input-row">
                      <Input
                        type="number"
                        placeholder={pairExists ? "Calculated automatically" : "0.0"}
                        value={amountB}
                        onChange={(e) => handleAmountBChange(e.target.value)}
                        className={`liquidity-amount-input ${
                          amountB && hasInsufficientBalance(amountB, balanceB, tokenB.decimals)
                            ? 'error'
                            : ''
                        } ${pairExists ? 'calculated' : ''}`}
                        disabled={!isMounted || !isConnected}
                        readOnly={pairExists && reserves !== null}
                      />
                      {amountB && hasInsufficientBalance(amountB, balanceB, tokenB.decimals) && (
                        <div className="input-error">Insufficient balance</div>
                      )}
                      <Select
                        value={tokenB.address}
                        onChange={(e) => {
                          const token = availableTokens.find((t: Token) => t.address === e.target.value);
                          if (token) setTokenB(token);
                        }}
                        options={availableTokens && availableTokens.length > 0 ? availableTokens.map(token => ({
                          value: token.address,
                          label: `${token.symbol} (${token.name})`,
                        })) : [{ value: '', label: 'No tokens available' }]}
                        className="liquidity-token-select"
                        disabled={!isMounted || !isConnected}
                      />
                    </div>
                  </div>

                  {/* Pair Status */}
                  <div className="pair-status">
                    {pairExists ? (
                      <span className="pair-exists">
                        <span>✅</span>
                        <span>
                          Trading pair exists - Token B amount calculated automatically based on current pool ratio
                          {reserves && (
                            <div className="pool-ratio">
                              Pool Ratio: 1 {tokenA.symbol} = {
                                reserves.reserveA > 0
                                  ? formatUnits((reserves.reserveB * parseUnits('1', tokenA.decimals)) / reserves.reserveA, tokenB.decimals)
                                  : '0'
                              } {tokenB.symbol}
                            </div>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="pair-new">
                        <span>🆕</span>
                        <span>New pair - You'll be the first liquidity provider! Set your own ratio.</span>
                      </span>
                    )}
                  </div>

                  {/* Add Liquidity Button */}
                  <div className="liquidity-button-container">
                    <Button
                      onClick={handleAddLiquidity}
                      disabled={!canAddLiquidity || isLoading}
                      className="liquidity-button"
                    >
                      {isPending || isConfirming ? (
                        <span className="button-loading">
                          <span className="loading-spinner">⏳</span>
                          {isPending ? 'Confirming Transaction...' : 'Processing...'}
                        </span>
                      ) : !canAddLiquidity && isMounted && isConnected ? (
                        <span>
                          {!isValidAmount(amountA) || !isValidAmount(amountB)
                            ? 'Enter Valid Amounts'
                            : hasInsufficientBalance(amountA, balanceA, tokenA.decimals) ||
                              hasInsufficientBalance(amountB, balanceB, tokenB.decimals)
                            ? 'Insufficient Balance'
                            : 'Add Liquidity'
                          }
                        </span>
                      ) : (
                        'Add Liquidity'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Remove Liquidity Tab */}
            {activeTab === 'remove' && (
              <div className="liquidity-content">
                <div className="liquidity-section">
                  <h3 className="section-title">Remove Liquidity</h3>

                  {/* Token Pair Selection */}
                  <div className="liquidity-input-group">
                    <div className="input-header">
                      <span className="token-label">Select Pair</span>
                    </div>
                    <div className="liquidity-input-row">
                      <Select
                        value={removeTokenA.address}
                        onChange={(e) => {
                          const token = availableTokens.find((t: Token) => t.address === e.target.value);
                          if (token) setRemoveTokenA(token);
                        }}
                        options={availableTokens && availableTokens.length > 0 ? availableTokens.map(token => ({
                          value: token.address,
                          label: `${token.symbol} (${token.name})`,
                        })) : [{ value: '', label: 'No tokens available' }]}
                        className="liquidity-token-select"
                        disabled={!isMounted || !isConnected}
                      />
                      <span className="pair-separator">/</span>
                      <Select
                        value={removeTokenB.address}
                        onChange={(e) => {
                          const token = availableTokens.find((t: Token) => t.address === e.target.value);
                          if (token) setRemoveTokenB(token);
                        }}
                        options={availableTokens && availableTokens.length > 0 ? availableTokens.map(token => ({
                          value: token.address,
                          label: `${token.symbol} (${token.name})`,
                        })) : [{ value: '', label: 'No tokens available' }]}
                        className="liquidity-token-select"
                        disabled={!isMounted || !isConnected}
                      />
                    </div>
                  </div>

                  {/* Percentage Buttons */}
                  <div className="liquidity-input-group">
                    <div className="input-header">
                      <span className="token-label">Amount to Remove</span>
                    </div>
                    <div className="percentage-buttons">
                      {['25', '50', '75', '100'].map((percent) => (
                        <button
                          key={percent}
                          className={`percentage-button ${removePercentage === percent ? 'active' : ''}`}
                          onClick={() => setRemovePercentage(percent)}
                          disabled={!isMounted || !isConnected}
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* LP Token Amount Input */}
                  <div className="liquidity-input-group">
                    <div className="input-header">
                      <span className="token-label">LP Token Amount</span>
                      <span className="balance-label">
                        LP Balance: {isRefreshingBalances ? '⟳' : ''} {formatBalance(removeLpTokenBalance, 18)} {removeTokenA.symbol}/{removeTokenB.symbol}
                      </span>
                    </div>
                    <div className="liquidity-input-row">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={lpTokenAmount}
                        onChange={(e) => setLpTokenAmount(e.target.value)}
                        className="liquidity-amount-input"
                        disabled={!isMounted || !isConnected}
                      />
                    </div>
                  </div>

                  {/* Remove Liquidity Button */}
                  <div className="liquidity-button-container">
                    <Button
                      onClick={handleRemoveLiquidity}
                      disabled={!canRemoveLiquidity || isLoading}
                      className="liquidity-button remove-button"
                    >
                      {isPending || isConfirming ? (
                        <span>
                          <span className="loading-spinner">⏳</span>
                          {isPending ? 'Confirming...' : 'Processing...'}
                        </span>
                      ) : (
                        'Remove Liquidity'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* My Positions Tab */}
            {activeTab === 'positions' && (
              <div className="liquidity-content">
                <div className="liquidity-section">
                  <div className="section-header">
                    <h3 className="section-title">My Liquidity Positions</h3>
                    <button
                      className="refresh-button"
                      onClick={refreshBalances}
                      disabled={isRefreshingBalances}
                      title="Refresh LP token balances"
                    >
                      {isRefreshingBalances ? '⟳' : '↻'}
                    </button>
                  </div>

                  <div className="positions-list">
                    {/* Current Add Liquidity Pair Position */}
                    {pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000' && (
                      <div className="position-item">
                        <div className="position-header">
                          <span className="pair-name">{tokenA.symbol}/{tokenB.symbol}</span>
                          <span className="position-status">Active Pool</span>
                        </div>
                        <div className="position-details">
                          <div className="position-stat">
                            <span className="stat-label">LP Tokens:</span>
                            <span className="stat-value">
                              {isRefreshingBalances ? '⟳' : ''} {formatBalance(lpTokenBalance, 18)} SLP
                            </span>
                          </div>
                          {reserves && (
                            <>
                              <div className="position-stat">
                                <span className="stat-label">Pool Ratio:</span>
                                <span className="stat-value">
                                  1 {tokenA.symbol} = {
                                    reserves.reserveA > 0
                                      ? formatUnits((reserves.reserveB * parseUnits('1', tokenA.decimals)) / reserves.reserveA, tokenB.decimals)
                                      : '0'
                                  } {tokenB.symbol}
                                </span>
                              </div>
                              <div className="position-stat">
                                <span className="stat-label">Pool Reserves:</span>
                                <span className="stat-value">
                                  {formatUnits(reserves.reserveA, tokenA.decimals)} {tokenA.symbol} / {formatUnits(reserves.reserveB, tokenB.decimals)} {tokenB.symbol}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Remove Liquidity Pair Position (if different from add pair) */}
                    {removePairAddress &&
                     removePairAddress !== '0x0000000000000000000000000000000000000000' &&
                     removePairAddress !== pairAddress && (
                      <div className="position-item">
                        <div className="position-header">
                          <span className="pair-name">{removeTokenA.symbol}/{removeTokenB.symbol}</span>
                          <span className="position-status">Active Pool</span>
                        </div>
                        <div className="position-details">
                          <div className="position-stat">
                            <span className="stat-label">LP Tokens:</span>
                            <span className="stat-value">
                              {isRefreshingBalances ? '⟳' : ''} {formatBalance(removeLpTokenBalance, 18)} SLP
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* No positions message */}
                    {(!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') &&
                     (!removePairAddress || removePairAddress === '0x0000000000000000000000000000000000000000') && (
                      <div className="no-positions">
                        <p>💰 No liquidity positions found</p>
                        <p>Add liquidity to a trading pair to see your positions here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Window>
  );
}

export default LiquidityInterface;
