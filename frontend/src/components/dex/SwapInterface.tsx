'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Window } from '@/components/ui/Window';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { CONTRACT_ADDRESSES, ROUTER_ABI, ERC20_ABI, FACTORY_ABI, anvilChain } from '@/lib/wagmi';
import { useNotification } from '@/app/page';
import { useTokenRegistry } from '../../contexts/TokenRegistryContext';
import { usePools } from '../../contexts/PoolsContext';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// No default tokens - only tokens with active liquidity pools are available

export function SwapInterface() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { showNotification } = useNotification();
  const { availableTokens, isLoading: isLoadingPools, refreshPools } = usePools();

  // Only tokens with active liquidity pools are available for trading

  const [fromToken, setFromToken] = useState<Token>({ address: '', symbol: '', name: '', decimals: 18 });
  const [toToken, setToToken] = useState<Token>({ address: '', symbol: '', name: '', decimals: 18 });
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isLoading, setIsLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);


  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle transaction success/error
  useEffect(() => {
    if (isSuccess) {
      showNotification(
        'Transaction Successful',
        'Your transaction has been completed successfully! 🎉\n\nYour token balances have been updated.',
        'success'
      );

      // Reset input fields for next transaction
      setFromAmount('');
      setToAmount('');

      setTimeout(() => {
        refetchAllBalances();
      }, 1000);
    }
  }, [isSuccess]);

  useEffect(() => {
    if (writeError) {
      showNotification(
        'Transaction Error',
        `Transaction failed: ${writeError.message}\n\nPlease try again or check your wallet connection.`,
        'error'
      );
    }
  }, [writeError]);

  // Update token selections when available tokens change
  useEffect(() => {
    if (availableTokens.length > 0) {
      // Set fromToken if not set or if current token is not available
      if (!fromToken.address || !availableTokens.find(t => t.address === fromToken.address)) {
        setFromToken(availableTokens[0]);
      }
      // Set toToken if not set or if current token is not available
      if (!toToken.address || !availableTokens.find(t => t.address === toToken.address)) {
        const secondToken = availableTokens.find(t => t.address !== fromToken.address) || availableTokens[1] || availableTokens[0];
        setToToken(secondToken);
      }
    } else {
      // Clear tokens when no tokens are available
      if (fromToken.address) setFromToken({ address: '', symbol: '', name: '', decimals: 18 });
      if (toToken.address) setToToken({ address: '', symbol: '', name: '', decimals: 18 });
    }
  }, [availableTokens, fromToken.address, toToken.address]);

  // Get balance for the selected FROM token
  const { data: fromBalance, refetch: refetchFromBalance } = useReadContract({
    address: fromToken.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && !!fromToken.address && fromToken.address !== '' },
  });

  // Get balance for the selected TO token
  const { data: toBalance, refetch: refetchToBalance } = useReadContract({
    address: toToken.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && !!toToken.address && toToken.address !== '' },
  });

  // Get balances for hardcoded test tokens (for the "Get Test Tokens" functionality)
  const { data: balanceA, refetch: refetchBalanceA } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN_A as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && !!CONTRACT_ADDRESSES.TOKEN_A },
  });

  const { data: balanceB, refetch: refetchBalanceB } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN_B as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && !!CONTRACT_ADDRESSES.TOKEN_B },
  });

  const { data: balanceC, refetch: refetchBalanceC } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN_C as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && !!CONTRACT_ADDRESSES.TOKEN_C },
  });

  // Get quote for swap using public client
  useEffect(() => {
    const getQuote = async () => {
      if (!fromAmount || !fromToken.address || !toToken.address || fromAmount === '0' || !CONTRACT_ADDRESSES.ROUTER || !publicClient) {
        setToAmount('');
        return;
      }

      try {
        // Validate fromAmount before parsing
        const fromAmountFloat = parseFloat(fromAmount);
        if (isNaN(fromAmountFloat) || fromAmountFloat <= 0) {
          setToAmount('');
          return;
        }

        const amountIn = parseUnits(fromAmount, fromToken.decimals);
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.ROUTER as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [amountIn, [fromToken.address as `0x${string}`, toToken.address as `0x${string}`]],
        });

        if (result && Array.isArray(result) && result.length > 1) {
          const outputAmount = formatUnits(result[1], toToken.decimals);
          setToAmount(outputAmount);
        } else {
          setToAmount('');
        }
      } catch (error) {
        console.error('Failed to get quote:', error);
        setToAmount('');
      }
    };

    getQuote();
  }, [fromAmount, fromToken.address, toToken.address, fromToken.decimals, toToken.decimals, publicClient]);

  // Function to refetch all balances
  const refetchAllBalances = async () => {
    try {
      const refetchPromises = [];

      // Refetch selected token balances
      if (fromToken.address) refetchPromises.push(refetchFromBalance());
      if (toToken.address && toToken.address !== fromToken.address) refetchPromises.push(refetchToBalance());

      // Refetch hardcoded test token balances (for test token functionality)
      refetchPromises.push(refetchBalanceA(), refetchBalanceB(), refetchBalanceC());

      await Promise.all(refetchPromises);
    } catch (error) {
      console.error('Failed to refetch balances:', error);
    }
  };

  const handleSwap = async () => {
    if (!isConnected || !address || !fromAmount || !toAmount) return;

    try {
      setIsLoading(true);

      const amountIn = parseUnits(fromAmount, fromToken.decimals);

      // Validate toAmount and slippage before calculation
      const toAmountFloat = parseFloat(toAmount);
      const slippageFloat = parseFloat(slippage);

      if (isNaN(toAmountFloat) || toAmountFloat <= 0) {
        throw new Error('Invalid output amount. Please try again.');
      }

      if (isNaN(slippageFloat) || slippageFloat < 0 || slippageFloat >= 100) {
        throw new Error('Invalid slippage tolerance. Please enter a value between 0 and 99.');
      }

      const slippageMultiplier = 1 - slippageFloat / 100;
      const minOutputAmount = toAmountFloat * slippageMultiplier;

      if (minOutputAmount <= 0) {
        throw new Error('Calculated minimum output amount is invalid. Please check your slippage settings.');
      }

      const amountOutMin = parseUnits(minOutputAmount.toString(), toToken.decimals);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

      // First, check current allowance
      const currentAllowance = await publicClient?.readContract({
        address: fromToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, CONTRACT_ADDRESSES.ROUTER as `0x${string}`],
      });

      // Only approve if allowance is insufficient
      if (!currentAllowance || currentAllowance < amountIn) {
        console.log('Approving router to spend tokens...');
        const approvalHash = await writeContract({
          address: fromToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESSES.ROUTER as `0x${string}`, amountIn],
        });

        // Wait for approval transaction to be confirmed
        console.log('Waiting for approval confirmation...');
        let approvalConfirmed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds max wait

        while (!approvalConfirmed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          try {
            const updatedAllowance = await publicClient?.readContract({
              address: fromToken.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'allowance',
              args: [address as `0x${string}`, CONTRACT_ADDRESSES.ROUTER as `0x${string}`],
            });
            if (updatedAllowance && updatedAllowance >= amountIn) {
              approvalConfirmed = true;
              console.log('Approval confirmed!');
            }
          } catch (error) {
            console.log('Checking allowance...', attempts + 1);
          }
          attempts++;
        }

        if (!approvalConfirmed) {
          throw new Error('Approval transaction failed to confirm. Please try again.');
        }
      } else {
        console.log('Sufficient allowance already exists');
      }

      // Verify the pair exists and has liquidity
      console.log('Verifying trading pair...');
      const pairAddress = await publicClient?.readContract({
        address: CONTRACT_ADDRESSES.FACTORY as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'getPair',
        args: [fromToken.address as `0x${string}`, toToken.address as `0x${string}`],
      });

      if (!pairAddress || pairAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(`Trading pair does not exist for ${fromToken.symbol}/${toToken.symbol}. Please contact support.`);
      }

      console.log(`Trading pair found at: ${pairAddress}`);

      // Check pair reserves to ensure there's liquidity
      const pairReserves = await publicClient?.readContract({
        address: pairAddress as `0x${string}`,
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

      console.log('Pair reserves:', pairReserves);

      if (!pairReserves || (pairReserves[0] === BigInt(0) && pairReserves[1] === BigInt(0))) {
        throw new Error(`No liquidity available for ${fromToken.symbol}/${toToken.symbol} pair. Please add liquidity first.`);
      }

      // Check user's token balance
      const userBalance = await publicClient?.readContract({
        address: fromToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });

      console.log(`User ${fromToken.symbol} balance:`, userBalance?.toString());

      if (!userBalance || userBalance < amountIn) {
        throw new Error(`Insufficient ${fromToken.symbol} balance. You have ${formatUnits(userBalance || BigInt(0), fromToken.decimals)} but need ${formatUnits(amountIn, fromToken.decimals)}.`);
      }

      // Then perform the swap
      console.log('Performing swap...');
      console.log('Swap parameters:', {
        amountIn: amountIn.toString(),
        amountOutMin: amountOutMin.toString(),
        path: [fromToken.address, toToken.address],
        to: address,
        deadline: deadline.toString()
      });

      await writeContract({
        address: CONTRACT_ADDRESSES.ROUTER as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          amountIn,
          amountOutMin,
          [fromToken.address as `0x${string}`, toToken.address as `0x${string}`],
          address,
          deadline,
        ],
      });

      console.log('Swap completed successfully!');
    } catch (error) {
      console.error('Swap failed:', error);
      showNotification(
        'Swap Failed',
        `Failed to execute swap: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n• Your wallet connection\n• Token balances\n• Network connection\n• Gas fees`,
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetTestTokens = async () => {
    if (!isConnected || !address) return;

    try {
      setIsLoading(true);
      const mintAmount = parseUnits('1000', 18); // Mint 1000 tokens

      // Mint TTA tokens
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN_A as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, mintAmount],
      });

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mint TTB tokens
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN_B as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, mintAmount],
      });

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mint TTC tokens
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN_C as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, mintAmount],
      });

      console.log('Test tokens minted successfully!');
      showNotification(
        'Test Tokens Minted',
        'Successfully minted 1000 tokens of each type! 🪙\n\nYour balances have been updated and you can now start trading.',
        'success'
      );
    } catch (error) {
      console.error('Failed to mint test tokens:', error);
      showNotification(
        'Minting Failed',
        `Failed to mint test tokens: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n• Your wallet connection\n• Network connection\n• Contract deployment`,
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatBalance = (balance: bigint | undefined, decimals: number) => {
    if (!balance) return '0.0000';
    return parseFloat(formatUnits(balance, decimals)).toFixed(4);
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: anvilChain.id });
    } catch (error) {
      showNotification(
        'Network Switch Failed',
        `Failed to switch to Anvil Local network: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease manually switch to the Anvil Local network (Chain ID: 31337) in your wallet.`,
        'error'
      );
    }
  };

  const isWrongNetwork = isConnected && chainId !== anvilChain.id;
  const canSwap = isMounted && isConnected && !isWrongNetwork && fromAmount && toAmount && !isPending && !isConfirming;

  return (
    <>
      <Window
        title="WinDex - Token Swap"
        width={460}
        height={620}
        x={50}
        y={50}
        className="font-mono"
      >
      <div className="swap-dialog-container">
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
              <span className="win98-status-text">Please connect your wallet to use the DEX</span>
            </div>
          </div>
        )}

        {isMounted && isConnected && availableTokens.length === 0 && (
          <div className="swap-status-message">
            <div className="win98-status-panel warning">
              <span className="win98-status-text">
                💧 No tokens with liquidity available for trading
                <br />
                <br />
                To start trading:
                <br />
                1. Create tokens using the 🪙 Tokenizer
                <br />
                2. Add liquidity using the 💧 Liquidity interface
                <br />
                3. Tokens will appear here once they have active pools
              </span>
            </div>
          </div>
        )}

        {isMounted && isWrongNetwork && (
          <div className="swap-status-message">
            <div className="win98-status-panel error">
              <span className="win98-status-text">Wrong network! Please switch to Anvil Local (Chain ID: 31337) </span>
              <button
                className="win98-button-small"
                onClick={handleSwitchNetwork}
                style={{ marginLeft: '8px' }}
              >
                🔄 Switch Network
              </button>
            </div>
          </div>
        )}

        {isMounted && isConnected && !CONTRACT_ADDRESSES.FACTORY && (
          <div className="swap-status-message">
            <div className="win98-status-panel error">
              <span className="win98-status-text">Smart contracts not deployed. Please deploy contracts to Anvil first.</span>
            </div>
          </div>
        )}

        {/* Get Test Tokens Button */}
        {isMounted && isConnected && !isWrongNetwork && CONTRACT_ADDRESSES.FACTORY && (
          <div className="swap-status-message">
            <div className="win98-status-panel info">
              <span className="win98-status-text">Need test tokens? </span>
              <button
                className="win98-button-small"
                onClick={handleGetTestTokens}
                disabled={isLoading}
                style={{ marginLeft: '8px' }}
              >
                {isLoading ? '⏳ Minting...' : '🪙 Get Test Tokens'}
              </button>
            </div>
          </div>
        )}





        {/* Main Swap Form */}
        <div className="swap-form-container">
          <div className="swap-groupbox">
            <div className="swap-groupbox-title">
              <span className="swap-title-icon">🔄</span>
              Swap Tokens
            </div>
            <div className="swap-groupbox-content">
              {/* From Token Section */}
              <div className="swap-token-section from-token">
                <div className="swap-token-header">
                  <label className="swap-token-label">
                    <span className="token-direction-icon">📤</span>
                    From
                  </label>
                  <span className="swap-balance-text">
                    {fromToken.address && fromToken.symbol ? (
                      `Balance: ${formatBalance(fromBalance, fromToken.decimals)} ${fromToken.symbol}`
                    ) : (
                      'Select a token'
                    )}
                  </span>
                </div>
                <div className="swap-token-inputs">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="swap-amount-input"
                    disabled={!isMounted || !isConnected}
                  />
                  <Select
                    value={fromToken.address}
                    onChange={(e) => {
                      const token = availableTokens.find((t: Token) => t.address === e.target.value);
                      if (token) setFromToken(token);
                    }}
                    options={availableTokens && availableTokens.length > 0 ? availableTokens.map(token => ({
                      value: token.address,
                      label: `${token.symbol} - ${token.name}`,
                    })) : []}
                    className="swap-token-select"
                    disabled={!isMounted || !isConnected}
                  />
                </div>
              </div>

              {/* Swap Direction Button */}
              <div className="swap-direction-container">
                <Button
                  onClick={() => {
                    const tempToken = fromToken;
                    const tempAmount = fromAmount;
                    setFromToken(toToken);
                    setToToken(tempToken);
                    setFromAmount(toAmount);
                    setToAmount(tempAmount);
                  }}
                  disabled={!isMounted || !isConnected}
                  className="swap-direction-button"
                >
                  ↕
                </Button>
              </div>

              {/* To Token Section */}
              <div className="swap-token-section to-token">
                <div className="swap-token-header">
                  <label className="swap-token-label">
                    <span className="token-direction-icon">📥</span>
                    To
                  </label>
                  <span className="swap-balance-text">
                    {toToken.address && toToken.symbol ? (
                      `Balance: ${formatBalance(toBalance, toToken.decimals)} ${toToken.symbol}`
                    ) : (
                      'Select a token'
                    )}
                  </span>
                </div>
                <div className="swap-token-inputs">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={toAmount}
                    readOnly
                    className="swap-amount-input readonly"
                  />
                  <Select
                    value={toToken.address}
                    onChange={(e) => {
                      const token = availableTokens.find((t: Token) => t.address === e.target.value);
                      if (token) setToToken(token);
                    }}
                    options={availableTokens && availableTokens.length > 0 ? availableTokens.map(token => ({
                      value: token.address,
                      label: `${token.symbol} - ${token.name}`,
                    })) : []}
                    className="swap-token-select"
                    disabled={!isMounted || !isConnected}
                  />
                </div>
              </div>

              {/* Slippage Section */}
              <div className="swap-slippage-section">
                <Input
                  label="Slippage Tolerance (%)"
                  type="number"
                  step="0.1"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="swap-slippage-input"
                  disabled={!isMounted || !isConnected}
                />
              </div>

              {/* Price Information */}
              {fromAmount && toAmount && (
                <div className="swap-price-info">
                  <div className="swap-groupbox">
                    <div className="swap-groupbox-title">
                      <span className="swap-title-icon">📊</span>
                      Exchange Rate
                    </div>
                    <div className="swap-groupbox-content">
                      <div className="swap-price-row">
                        <span className="swap-price-label">Rate:</span>
                        <span className="swap-price-value">
                          1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                        </span>
                      </div>
                      <div className="swap-price-row">
                        <span className="swap-price-label">Slippage:</span>
                        <span className="swap-price-value">{slippage}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Swap Action Button */}
              <div className="swap-action-section">
                <Button
                  variant="primary"
                  onClick={handleSwap}
                  disabled={!canSwap}
                  className="swap-action-button"
                >
                  {isPending || isConfirming ? (
                    <span className="swap-button-content">
                      <span className="swap-loading-indicator">⏳</span>
                      {isPending ? 'Confirming...' : 'Processing...'}
                    </span>
                  ) : isLoading ? (
                    <span className="swap-button-content">
                      <span className="swap-loading-indicator">⚙️</span>
                      Preparing...
                    </span>
                  ) : (
                    <span className="swap-button-content">
                      <span className="swap-action-icon">💱</span>
                      Swap Tokens
                    </span>
                  )}
                </Button>
              </div>


            </div>
          </div>
        </div>
      </div>
      </Window>
    </>
  );
}

export default SwapInterface;
