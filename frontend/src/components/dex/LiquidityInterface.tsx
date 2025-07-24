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
import { GroupBox } from '@/components/ui';
import { TokenSelector } from './TokenSelector';
import { LiquidityConfirmationDialog } from '@/components/ui/LiquidityConfirmationDialog';

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

  // Confirmation dialog state
  const [showAddConfirmation, setShowAddConfirmation] = useState(false);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState<{
    type: 'add' | 'remove';
    tokenA: Token;
    tokenB: Token;
    amountA: string;
    amountB: string;
    lpTokenAmount?: string;
  } | null>(null);

  // Transaction handling
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, isError: receiptError } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    setIsMounted(true);
    // Test notification system
    console.log('LiquidityInterface mounted, testing notification system');
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
    return !!(address &&
           address.startsWith('0x') &&
           address.length === 42 &&
           /^0x[a-fA-F0-9]{40}$/.test(address));
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
    console.log('Transaction status changed:', {
      isSuccess,
      hash,
      isPending,
      isConfirming,
      receiptError,
      writeError
    });

    if (isSuccess && hash) {
      console.log('🎉 Transaction successful! Hash:', hash);

      showNotification(
        'Liquidity Added Successfully',
        'Your liquidity has been added to the pool!\n\n• LP tokens minted to your wallet\n• Token balances updated\n• Check "My Positions" tab for details',
        'success'
      );

      // Close confirmation dialog
      setShowAddConfirmation(false);
      setPendingTransaction(null);

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
      }).catch((error) => {
        console.error('Error refreshing balances:', error);
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
  }, [isSuccess, hash, isPending, isConfirming, showNotification, refetchBalanceA, refetchBalanceB, refetchRemoveBalanceA, refetchRemoveBalanceB, checkPairAndReserves, refreshPools]);

  // Monitor hash changes
  useEffect(() => {
    if (hash) {
      console.log('📋 Transaction hash received:', hash);
    }
  }, [hash]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      console.error('Write contract error:', writeError);
      showNotification(
        'Transaction Failed',
        `Failed to submit transaction: ${writeError.message}\n\nPlease check your wallet connection and try again.`,
        'error'
      );
      // Close confirmation dialog on error
      setShowAddConfirmation(false);
      setShowRemoveConfirmation(false);
      setPendingTransaction(null);
    }
  }, [writeError, showNotification]);

  useEffect(() => {
    if (receiptError) {
      console.error('Transaction receipt error:', receiptError);
      showNotification(
        'Transaction Failed',
        'Transaction was submitted but failed to complete.\n\nPlease check the transaction on the blockchain explorer.',
        'error'
      );
      // Close confirmation dialog on error
      setShowAddConfirmation(false);
      setShowRemoveConfirmation(false);
      setPendingTransaction(null);
    }
  }, [receiptError, showNotification]);

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

  const handleAddLiquidityClick = () => {
    if (!isConnected || !address || !amountA || !amountB ||
        !isValidAddress(tokenA.address) || !isValidAddress(tokenB.address)) return;

    // Set pending transaction data and show confirmation dialog
    setPendingTransaction({
      type: 'add',
      tokenA,
      tokenB,
      amountA,
      amountB,
    });
    setShowAddConfirmation(true);
  };

  const executeAddLiquidity = async () => {
    if (!isConnected || !address || !pendingTransaction) return;

    try {
      setIsLoading(true);

      const { tokenA: txTokenA, tokenB: txTokenB, amountA: txAmountA, amountB: txAmountB } = pendingTransaction;

      const amountADesired = parseUnits(txAmountA, txTokenA.decimals);
      const amountBDesired = parseUnits(txAmountB, txTokenB.decimals);
      const amountAMin = parseUnits((parseFloat(txAmountA) * 0.95).toString(), txTokenA.decimals); // 5% slippage
      const amountBMin = parseUnits((parseFloat(txAmountB) * 0.95).toString(), txTokenB.decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

      console.log('🔍 Checking token balances and approvals...');

      // Check if user has sufficient balances
      const balanceA = await publicClient?.readContract({
        address: txTokenA.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      const balanceB = await publicClient?.readContract({
        address: txTokenB.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      console.log('💰 Token balances:', {
        tokenA: `${formatUnits(balanceA || BigInt(0), txTokenA.decimals)} ${txTokenA.symbol}`,
        tokenB: `${formatUnits(balanceB || BigInt(0), txTokenB.decimals)} ${txTokenB.symbol}`,
        required: `${txAmountA} ${txTokenA.symbol}, ${txAmountB} ${txTokenB.symbol}`
      });

      if (!balanceA || balanceA < amountADesired) {
        throw new Error(`Insufficient ${txTokenA.symbol} balance. Required: ${txAmountA}, Available: ${formatUnits(balanceA || BigInt(0), txTokenA.decimals)}`);
      }

      if (!balanceB || balanceB < amountBDesired) {
        throw new Error(`Insufficient ${txTokenB.symbol} balance. Required: ${txAmountB}, Available: ${formatUnits(balanceB || BigInt(0), txTokenB.decimals)}`);
      }

      // Check current allowances
      const allowanceA = await publicClient?.readContract({
        address: txTokenA.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, CONTRACT_ADDRESSES.ROUTER as `0x${string}`],
      });

      const allowanceB = await publicClient?.readContract({
        address: txTokenB.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, CONTRACT_ADDRESSES.ROUTER as `0x${string}`],
      });

      console.log('🔐 Current allowances:', {
        tokenA: `${formatUnits(allowanceA || BigInt(0), txTokenA.decimals)} ${txTokenA.symbol}`,
        tokenB: `${formatUnits(allowanceB || BigInt(0), txTokenB.decimals)} ${txTokenB.symbol}`,
        required: `${txAmountA} ${txTokenA.symbol}, ${txAmountB} ${txTokenB.symbol}`
      });

      // Only approve if current allowance is insufficient
      if (!allowanceA || allowanceA < amountADesired) {
        console.log(`📝 Approving ${txTokenA.symbol}...`);
        showNotification(
          'Approval Required',
          `Please approve ${txTokenA.symbol} spending in your wallet.`,
          'info'
        );

        writeContract({
          address: txTokenA.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.ROUTER as `0x${string}`, amountADesired],
        });
        return; // Exit here, let the transaction complete and user will need to retry
      }

      if (!allowanceB || allowanceB < amountBDesired) {
        console.log(`📝 Approving ${txTokenB.symbol}...`);
        showNotification(
          'Approval Required',
          `Please approve ${txTokenB.symbol} spending in your wallet.`,
          'info'
        );

        writeContract({
          address: txTokenB.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.ROUTER as `0x${string}`, amountBDesired],
        });
        return; // Exit here, let the transaction complete and user will need to retry
      }

      // Both tokens are approved, proceed with addLiquidity
      console.log('📝 Submitting addLiquidity transaction with args:', {
        tokenA: txTokenA.address,
        tokenB: txTokenB.address,
        amountADesired: amountADesired.toString(),
        amountBDesired: amountBDesired.toString(),
        amountAMin: amountAMin.toString(),
        amountBMin: amountBMin.toString(),
        to: address,
        deadline: deadline.toString()
      });

      writeContract({
        address: CONTRACT_ADDRESSES.ROUTER as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'addLiquidity',
        args: [
          txTokenA.address as `0x${string}`,
          txTokenB.address as `0x${string}`,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          address,
          deadline,
        ],
      });

      console.log('✅ Liquidity transaction submitted, waiting for confirmation...');
    } catch (error) {
      console.error('Add liquidity failed:', error);
      showNotification(
        'Add Liquidity Failed',
        `Failed to add liquidity: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n• Your token balances\n• Token approvals\n• Network connection`,
        'error'
      );
      // Close confirmation dialog on error
      setShowAddConfirmation(false);
      setPendingTransaction(null);
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

  // Enhanced validation functions
  const getAmountValidationError = (amount: string, balance: bigint | undefined, decimals: number, tokenSymbol: string): string | null => {
    if (!amount) return null;
    if (parseFloat(amount) <= 0) return 'Amount must be greater than 0';
    if (hasInsufficientBalance(amount, balance, decimals)) {
      return `Insufficient ${tokenSymbol} balance`;
    }
    return null;
  };

  const getMinimumLiquidityError = (amountA: string, amountB: string): string | null => {
    if (!amountA || !amountB) return null;
    const minAmount = 0.000001; // Minimum liquidity threshold
    if (parseFloat(amountA) < minAmount || parseFloat(amountB) < minAmount) {
      return `Minimum liquidity amount is ${minAmount}`;
    }
    return null;
  };

  // Real-time validation
  const amountAError = getAmountValidationError(amountA, balanceA, tokenA.decimals, tokenA.symbol);
  const amountBError = getAmountValidationError(amountB, balanceB, tokenB.decimals, tokenB.symbol);
  const minimumLiquidityError = getMinimumLiquidityError(amountA, amountB);
  const lpAmountError = getAmountValidationError(lpTokenAmount, removeLpTokenBalance, 18, 'LP');

  const hasValidationErrors = !!(amountAError || amountBError || minimumLiquidityError);
  const hasRemoveValidationErrors = !!lpAmountError;

  const canAddLiquidity = isMounted && isConnected &&
    isValidAmount(amountA) && isValidAmount(amountB) &&
    !hasValidationErrors &&
    !isPending && !isConfirming;

  const canRemoveLiquidity = isMounted && isConnected &&
    isValidAmount(lpTokenAmount) &&
    !hasRemoveValidationErrors &&
    !isPending && !isConfirming;

  return (
    <Window
      id="liquidity"
      title="WinDex - Liquidity Management"
      width={520}
      height={680}
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
                No tokens available for liquidity provision
                <br />
                <br />
                To add liquidity:
                <br />
                1. Create tokens using the Tokenizer
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
            <div className="win98-tab-control">
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
                {/* Step Indicator */}
                <div className="win98-step-indicator">
                  <div className="step-header">
                    <span className="step-icon">•</span>
                    <span className="step-title">Add Liquidity to Pool</span>
                    <button
                      className="refresh-button"
                      onClick={refreshBalances}
                      disabled={isRefreshingBalances}
                      title="Refresh balances and pool data"
                    >
                      {isRefreshingBalances ? '⟳ Refreshing...' : '↻ Refresh'}
                    </button>
                  </div>
                  <div className="step-description">
                    {pairExists ?
                      'Add tokens to an existing liquidity pool. You\'ll receive LP tokens representing your share.' :
                      'Create a new liquidity pool by being the first to add these tokens. You\'ll set the initial price ratio.'
                    }
                  </div>
                </div>

                <GroupBox>
                  <div className="liquidity-section">
                    
                    {/* Token Pair Selection */}
                    <div className="token-pair-section">
                      <div className="pair-selection-header">
                        <span className="pair-label">Select Token Pair</span>
                        <span className="pair-helper">Choose two tokens to provide liquidity</span>
                      </div>

                      {/* First Token */}
                      <div className="token-input-container">
                        <div className="token-input-header">
                          <div className="token-label-group">
                            <span className="token-label">First Token</span>
                            <span className="token-role">You provide</span>
                          </div>
                          <div className="balance-info">
                            <span className="balance-label">
                              Available: {isRefreshingBalances ? '⟳' : ''} {formatBalance(balanceA, tokenA.decimals)} {tokenA.symbol || 'Select token'}
                            </span>
                            {tokenA.address && balanceA && (
                              <button
                                className="max-button"
                                onClick={() => {
                                  handleAmountAChange(formatUnits(balanceA, tokenA.decimals));
                                }}
                                disabled={!isMounted || !isConnected}
                                title="Use maximum available balance"
                              >
                                MAX
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="token-input-controls">
                          <div className="amount-input-wrapper">
                            <Input
                              type="number"
                              placeholder="0.0"
                              value={amountA}
                              onChange={(e) => handleAmountAChange(e.target.value)}
                              className={`liquidity-amount-input ${amountAError ? 'error' : ''}`}
                              disabled={!isMounted || !isConnected}
                            />
                            {amountAError && (
                              <div className="win98-validation-error">
                                <span className="error-icon">⚠️</span>
                                <span className="error-text">{amountAError}</span>
                              </div>
                            )}
                          </div>

                          <div className="token-selector-wrapper">
                            <TokenSelector
                              value={tokenA.address}
                              onChange={(token) => setTokenA(token)}
                              tokens={availableTokens}
                              className="liquidity-token-select"
                              disabled={!isMounted || !isConnected}
                              placeholder="Select first token"
                              showBalance={true}
                              balances={{
                                [tokenA.address]: balanceA?.toString() || '0'
                              }}
                            />
                          </div>
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
                        {amountBError && (
                          <div className="win98-validation-error">
                            <span className="error-icon">⚠️</span>
                            <span className="error-text">{amountBError}</span>
                          </div>
                        )}
                        <TokenSelector
                          value={tokenB.address}
                          onChange={(token) => setTokenB(token)}
                          tokens={availableTokens}
                          className="liquidity-token-select"
                          disabled={!isMounted || !isConnected}
                          placeholder="Select Token B"
                          showBalance={true}
                          balances={{
                            [tokenB.address]: balanceB?.toString() || '0'
                          }}
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

                    {/* Pool Status Information */}
                    <div className="pool-status-section">
                      {pairExists ? (
                        <div className="status-info existing-pool">
                          <span className="status-icon">•</span>
                          <div className="status-details">
                            <span className="status-title">Existing Pool Found</span>
                            <span className="status-description">
                              Second token amount calculated automatically based on current pool ratio
                            </span>
                            {reserves && (
                              <div className="pool-ratio-display">
                                <span className="ratio-label">Current Pool Ratio:</span>
                                <span className="ratio-value">
                                  1 {tokenA.symbol} = {
                                    reserves.reserveA > 0
                                      ? formatUnits((reserves.reserveB * parseUnits('1', tokenA.decimals)) / reserves.reserveA, tokenB.decimals)
                                      : '0'
                                  } {tokenB.symbol}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="status-info new-pool">
                          <span className="status-icon">•</span>
                          <div className="status-details">
                            <span className="status-title">Creating New Pool</span>
                            <span className="status-description">
                              You'll be the first liquidity provider! You can set your own price ratio.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                  {/* Add Liquidity Button */}
                  <div className="liquidity-button-container">
                    <Button
                      onClick={handleAddLiquidityClick}
                      disabled={!canAddLiquidity || isLoading}
                      className="liquidity-button"
                    >
                      {isPending || isConfirming ? (
                        <span className="button-loading">
                          <span className="win98-loading-spinner">⏳</span>
                          {isPending ? 'Confirming Transaction...' : 'Processing...'}
                        </span>
                      ) : isLoading ? (
                        <span className="button-loading">
                          <span className="win98-loading-spinner">⚙️</span>
                          Preparing Transaction...
                        </span>
                      ) : !canAddLiquidity && isMounted && isConnected ? (
                        <span>
                          {!isValidAmount(amountA) || !isValidAmount(amountB)
                            ? 'Enter Valid Amounts'
                            : hasValidationErrors
                            ? 'Fix Validation Errors'
                            : 'Add Liquidity'
                          }
                        </span>
                      ) : (
                        <span>
                          Add Liquidity
                        </span>
                      )}
                    </Button>

                    {/* Transaction Progress Indicator */}
                    {(isPending || isConfirming || isLoading) && (
                      <div className="win98-progress-indicator">
                        <div className={`progress-step ${isLoading ? 'active' : 'complete'}`}>
                          <span className="step-icon">
                            {isLoading ? '⚙️' : '✅'}
                          </span>
                          <span>Preparing Transaction</span>
                        </div>
                        <div className={`progress-step ${isPending ? 'active' : isConfirming || isSuccess ? 'complete' : ''}`}>
                          <span className="step-icon">
                            {isPending ? '⏳' : isConfirming || isSuccess ? '✅' : '⏸️'}
                          </span>
                          <span>Confirming in Wallet</span>
                        </div>
                        <div className={`progress-step ${isConfirming ? 'active' : isSuccess ? 'complete' : ''}`}>
                          <span className="step-icon">
                            {isConfirming ? '🔄' : isSuccess ? '✅' : '⏸️'}
                          </span>
                          <span>Processing on Chain</span>
                        </div>
                      </div>
                    )}

                    {/* Minimum Liquidity Warning */}
                    {minimumLiquidityError && (
                      <div className="win98-status-panel warning">
                        <span className="win98-status-text">
                          ⚠️ {minimumLiquidityError}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                  </div>
                </GroupBox>
              </div>
            )}

            {/* Remove Liquidity Tab */}
            {activeTab === 'remove' && (
              <div className="liquidity-content">
                {/* Step Indicator */}
                <div className="win98-step-indicator">
                  <div className="step-header">
                    <span className="step-icon">•</span>
                    <span className="step-title">Remove Liquidity from Pool</span>
                  </div>
                  <div className="step-description">
                    Remove your tokens from a liquidity pool. You'll burn LP tokens and receive the underlying tokens back.
                  </div>
                </div>

                <GroupBox title="Remove Liquidity">
                  <div className="liquidity-section">
                    {/* Pool Selection */}
                    <div className="pool-selection-section">
                      <div className="selection-header">
                        <span className="selection-label">Select Pool to Remove From</span>
                        <span className="selection-helper">Choose the trading pair you want to remove liquidity from</span>
                      </div>

                      <div className="pool-selector-container">
                        <div className="pool-selector-row">
                          <div className="token-selector-group">
                            <label className="selector-label">First Token</label>
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
                          </div>

                          <div className="pair-separator-container">
                            <span className="pair-separator">/</span>
                          </div>

                          <div className="token-selector-group">
                            <label className="selector-label">Second Token</label>
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
                      </div>
                    </div>

                    {/* LP Token Amount Section */}
                    <div className="lp-amount-section">
                      <div className="amount-header">
                        <span className="amount-label">How much liquidity to remove?</span>
                        <span className="amount-helper">
                          Your LP Balance: {isRefreshingBalances ? '⟳' : ''} {formatBalance(removeLpTokenBalance, 18)} {removeTokenA.symbol}/{removeTokenB.symbol}
                        </span>
                      </div>

                      {/* Percentage Buttons */}
                      <div className="percentage-selection">
                        <span className="percentage-label">Quick Select:</span>
                        <div className="percentage-buttons">
                          {['25', '50', '75', '100'].map((percent) => (
                            <button
                              key={percent}
                              className={`percentage-button ${removePercentage === percent ? 'active' : ''}`}
                              onClick={() => setRemovePercentage(percent)}
                              disabled={!isMounted || !isConnected}
                              title={`Remove ${percent}% of your liquidity`}
                            >
                              {percent}%
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* LP Token Amount Input */}
                      <div className="lp-input-container">
                        <div className="lp-input-header">
                          <span className="lp-input-label">LP Tokens to Remove</span>
                          <span className="lp-input-helper">Enter exact amount or use percentage buttons above</span>
                        </div>
                        <div className="lp-input-wrapper">
                          <Input
                            type="number"
                            placeholder="0.0"
                            value={lpTokenAmount}
                            onChange={(e) => setLpTokenAmount(e.target.value)}
                            className={`liquidity-amount-input ${lpAmountError ? 'error' : ''}`}
                            disabled={!isMounted || !isConnected}
                          />
                          {lpAmountError && (
                            <div className="win98-validation-error">
                              <span className="error-icon">⚠️</span>
                              <span className="error-text">{lpAmountError}</span>
                            </div>
                          )}
                        </div>
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
                          <span className="button-loading">
                            <span className="win98-loading-spinner">⏳</span>
                            {isPending ? 'Confirming Transaction...' : 'Processing...'}
                          </span>
                        ) : isLoading ? (
                          <span className="button-loading">
                            <span className="win98-loading-spinner">⚙️</span>
                            Preparing Transaction...
                          </span>
                        ) : !canRemoveLiquidity && isMounted && isConnected ? (
                          <span>
                            {!isValidAmount(lpTokenAmount)
                              ? 'Enter LP Token Amount'
                              : hasRemoveValidationErrors
                              ? 'Fix Validation Errors'
                              : 'Remove Liquidity'
                            }
                          </span>
                        ) : (
                          <span>
                            Remove Liquidity
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </GroupBox>
              </div>
            )}

            {/* My Positions Tab */}
            {activeTab === 'positions' && (
              <div className="liquidity-content">
                {/* Step Indicator */}
                <div className="win98-step-indicator">
                  <div className="step-header">
                    <span className="step-icon">•</span>
                    <span className="step-title">My Liquidity Positions</span>
                    <button
                      className="refresh-button"
                      onClick={refreshBalances}
                      disabled={isRefreshingBalances}
                      title="Refresh LP token balances"
                    >
                      {isRefreshingBalances ? '⟳ Refreshing...' : '↻ Refresh'}
                    </button>
                  </div>
                  <div className="step-description">
                    View and manage your liquidity positions. Each position represents your share in a trading pool.
                  </div>
                </div>

                <GroupBox title="Active Positions Overview">
                  <div className="positions-summary">
                    <div className="summary-stats">
                      <div className="stat-item">
                        <span className="stat-label">Total Positions:</span>
                        <span className="stat-value">
                          {((pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') ? 1 : 0) +
                           ((removePairAddress && removePairAddress !== '0x0000000000000000000000000000000000000000' && removePairAddress !== pairAddress) ? 1 : 0)}
                        </span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Status:</span>
                        <span className="stat-value">
                          {isRefreshingBalances ? '⟳ Updating...' : '✅ Current'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Positions Data Grid */}
                  <div className="win98-data-grid">
                    <div className="win98-data-grid-header">
                      <div className="grid-column-header pair-column">
                        <span className="header-text">Trading Pair</span>
                        <span className="header-helper">Token combination</span>
                      </div>
                      <div className="grid-column-header balance-column">
                        <span className="header-text">LP Tokens</span>
                        <span className="header-helper">Your balance</span>
                      </div>
                      <div className="grid-column-header share-column">
                        <span className="header-text">Pool Share</span>
                        <span className="header-helper">% of total pool</span>
                      </div>
                      <div className="grid-column-header value-column">
                        <span className="header-text">Token Values</span>
                        <span className="header-helper">Underlying assets</span>
                      </div>
                      <div className="grid-column-header actions-column">
                        <span className="header-text">Actions</span>
                        <span className="header-helper">Manage position</span>
                      </div>
                    </div>

                    <div className="win98-data-grid-body">
                      {/* Current Add Liquidity Pair Position */}
                      {pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000' && (
                        <div className="win98-data-grid-row">
                          <div className="grid-cell pair-cell">
                            <div className="pair-display">
                              <div className="token-pair-icons">
                                <div className="token-icon">{tokenA.symbol.charAt(0)}</div>
                                <div className="token-icon">{tokenB.symbol.charAt(0)}</div>
                              </div>
                              <div className="pair-info">
                                <div className="pair-name">{tokenA.symbol}/{tokenB.symbol}</div>
                                <div className="pair-status">Active Pool</div>
                              </div>
                            </div>
                          </div>
                          <div className="grid-cell balance-cell">
                            <div className="balance-display">
                              <div className="balance-amount">
                                {isRefreshingBalances ? '⟳' : ''} {formatBalance(lpTokenBalance, 18)}
                              </div>
                              <div className="balance-unit">SLP</div>
                            </div>
                          </div>
                          <div className="grid-cell share-cell">
                            <div className="share-display">
                              {reserves && lpTokenBalance ? (
                                <div className="share-percentage">
                                  {((parseFloat(formatUnits(lpTokenBalance, 18)) / parseFloat(formatUnits(reserves.reserveA + reserves.reserveB, 18))) * 100).toFixed(2)}%
                                </div>
                              ) : (
                                <div className="share-percentage">0.00%</div>
                              )}
                            </div>
                          </div>
                          <div className="grid-cell value-cell">
                            <div className="value-display">
                              {reserves && lpTokenBalance ? (
                                <div className="estimated-value">
                                  <div className="value-breakdown">
                                    {formatBalance(reserves.reserveA, tokenA.decimals)} {tokenA.symbol}
                                  </div>
                                  <div className="value-breakdown">
                                    {formatBalance(reserves.reserveB, tokenB.decimals)} {tokenB.symbol}
                                  </div>
                                </div>
                              ) : (
                                <div className="value-loading">Calculating...</div>
                              )}
                            </div>
                          </div>
                          <div className="grid-cell actions-cell">
                            <div className="position-actions">
                              <button
                                className="action-button remove-button"
                                onClick={() => {
                                  setRemoveTokenA(tokenA);
                                  setRemoveTokenB(tokenB);
                                  setActiveTab('remove');
                                }}
                                title="Remove liquidity from this position"
                              >
                                🔄 Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Remove Liquidity Pair Position (if different from add pair) */}
                      {removePairAddress &&
                       removePairAddress !== '0x0000000000000000000000000000000000000000' &&
                       removePairAddress !== pairAddress && (
                        <div className="win98-data-grid-row">
                          <div className="grid-cell pair-cell">
                            <div className="pair-display">
                              <div className="token-pair-icons">
                                <div className="token-icon">{removeTokenA.symbol.charAt(0)}</div>
                                <div className="token-icon">{removeTokenB.symbol.charAt(0)}</div>
                              </div>
                              <div className="pair-info">
                                <div className="pair-name">{removeTokenA.symbol}/{removeTokenB.symbol}</div>
                                <div className="pair-status">Active Pool</div>
                              </div>
                            </div>
                          </div>
                          <div className="grid-cell balance-cell">
                            <div className="balance-display">
                              <div className="balance-amount">
                                {isRefreshingBalances ? '⟳' : ''} {formatBalance(removeLpTokenBalance, 18)}
                              </div>
                              <div className="balance-unit">SLP</div>
                            </div>
                          </div>
                          <div className="grid-cell share-cell">
                            <div className="share-display">
                              <div className="share-percentage">--</div>
                            </div>
                          </div>
                          <div className="grid-cell value-cell">
                            <div className="value-display">
                              <div className="value-loading">Calculating...</div>
                            </div>
                          </div>
                          <div className="grid-cell actions-cell">
                            <div className="position-actions">
                              <button
                                className="action-button remove-button"
                                onClick={() => setActiveTab('remove')}
                                title="Remove liquidity from this position"
                              >
                                🔄 Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* No positions message */}
                    {(!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') &&
                     (!removePairAddress || removePairAddress === '0x0000000000000000000000000000000000000000') && (
                      <div className="win98-data-grid-empty">
                        <div className="empty-state">
                          <div className="empty-icon">💰</div>
                          <div className="empty-title">No Liquidity Positions Found</div>
                          <div className="empty-description">
                            Add liquidity to a trading pair to see your positions here.
                          </div>
                          <button
                            className="empty-action-button"
                            onClick={() => setActiveTab('add')}
                          >
                            💧 Add Liquidity
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </GroupBox>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation Dialogs */}
      {pendingTransaction && (
        <>
          <LiquidityConfirmationDialog
            isOpen={showAddConfirmation}
            onClose={() => {
              setShowAddConfirmation(false);
              setPendingTransaction(null);
            }}
            onConfirm={executeAddLiquidity}
            type="add"
            tokenA={pendingTransaction.tokenA}
            tokenB={pendingTransaction.tokenB}
            amountA={pendingTransaction.amountA}
            amountB={pendingTransaction.amountB}
            slippage="0.5"
            isLoading={isPending || isConfirming}
          />

          <LiquidityConfirmationDialog
            isOpen={showRemoveConfirmation}
            onClose={() => {
              setShowRemoveConfirmation(false);
              setPendingTransaction(null);
            }}
            onConfirm={() => {
              // TODO: Implement remove liquidity execution
              setShowRemoveConfirmation(false);
              setPendingTransaction(null);
            }}
            type="remove"
            tokenA={pendingTransaction.tokenA}
            tokenB={pendingTransaction.tokenB}
            amountA={pendingTransaction.amountA}
            amountB={pendingTransaction.amountB}
            lpTokenAmount={pendingTransaction.lpTokenAmount}
            slippage="0.5"
            isLoading={isPending || isConfirming}
          />
        </>
      )}
    </Window>
  );
}

export default LiquidityInterface;
