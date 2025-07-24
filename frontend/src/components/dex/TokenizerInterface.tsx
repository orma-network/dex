'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Window } from '@/components/ui/Window';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useNotification } from '../../app/page';
import { useTokenRegistry } from '../../contexts/TokenRegistryContext';
import { usePools } from '../../contexts/PoolsContext';
import { CONTRACT_ADDRESSES, TOKEN_FACTORY_ABI, ERC20_ABI } from '@/lib/wagmi';



interface TokenData {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  description: string;
}

interface DeployedToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  deployedAt: string;
  creator?: string;
  balance?: string;
}

interface MintData {
  tokenAddress: string;
  amount: string;
}

export function TokenizerInterface() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { showNotification } = useNotification();
  const { addCustomToken } = useTokenRegistry();
  const { refreshPools } = usePools();
  
  // UI State
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [mintingTokens, setMintingTokens] = useState<Set<string>>(new Set());
  
  // Form State
  const [tokenData, setTokenData] = useState<TokenData>({
    name: '',
    symbol: '',
    decimals: 18,
    initialSupply: '',
    description: ''
  });

  // Deployed Tokens State
  const [deployedTokens, setDeployedTokens] = useState<DeployedToken[]>([]);
  const [userTokens, setUserTokens] = useState<DeployedToken[]>([]);
  const [mintData, setMintData] = useState<{ [tokenAddress: string]: string }>({});
  const [lastDeployedToken, setLastDeployedToken] = useState<DeployedToken | null>(null);
  
  // Transaction handling
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  // Minting transaction handling
  const { writeContract: mintContract, data: mintHash, isPending: isMintPending } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
    hash: mintHash,
  });

  // Read user's tokens from TokenFactory
  const { data: userTokenAddresses, refetch: refetchUserTokens } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`,
    abi: TOKEN_FACTORY_ABI,
    functionName: 'getTokensByCreator',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Ref to prevent multiple simultaneous refetch calls
  const isRefetchingRef = useRef(false);

  // Memoized refetch function to prevent infinite re-renders
  const stableRefetchUserTokens = useCallback(() => {
    if (isConnected && address && !isRefetchingRef.current) {
      isRefetchingRef.current = true;
      refetchUserTokens().finally(() => {
        isRefetchingRef.current = false;
      });
    }
  }, [isConnected, address]); // Remove refetchUserTokens from dependencies

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Refetch user tokens when switching to manage tab
  useEffect(() => {
    if (activeTab === 'manage') {
      stableRefetchUserTokens();
    }
  }, [activeTab, stableRefetchUserTokens]);

  // Handle form input changes
  const handleInputChange = (field: keyof TokenData, value: string | number) => {
    setTokenData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Validate form data
  const isValidForm = () => {
    return (
      tokenData.name.trim() !== '' &&
      tokenData.symbol.trim() !== '' &&
      tokenData.symbol.length <= 10 &&
      tokenData.decimals >= 0 && tokenData.decimals <= 18 &&
      tokenData.initialSupply !== '' &&
      parseFloat(tokenData.initialSupply) > 0
    );
  };

  // Handle token creation
  const handleCreateToken = async () => {
    if (!isConnected || !address || !isValidForm()) return;

    try {
      setIsLoading(true);
      
      const initialSupplyBigInt = parseUnits(tokenData.initialSupply, tokenData.decimals);
      
      // Deploy to the real TokenFactory contract
      await writeContract({
        address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`,
        abi: TOKEN_FACTORY_ABI,
        functionName: 'createToken',
        args: [
          tokenData.name,
          tokenData.symbol,
          tokenData.decimals,
          initialSupplyBigInt,
          address
        ],
      });

    } catch (error) {
      console.error('Token creation failed:', error);
      showNotification(
        'Token Creation Failed',
        `Failed to create token: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease check:\n• Your wallet connection\n• Network connection\n• Form data validity`,
        'error'
      );
      setIsLoading(false);
    }
  };

  // Handle successful token creation
  useEffect(() => {
    if (isSuccess && hash && receipt) {
      // Capture current token data to avoid stale closure
      const currentTokenData = tokenData;

      // Extract the actual deployed token address from the transaction receipt
      // The TokenFactory emits a TokenCreated event with the new token address
      let tokenAddress: string | undefined;

      try {
        // Look for the TokenCreated event in the logs
        // The token address should be in the event logs
        if (receipt.logs && receipt.logs.length > 0) {
          // The first log should be from the newly created token contract
          // and the address field contains the token contract address
          tokenAddress = receipt.logs[0].address;
          console.log('Extracted token address from receipt:', tokenAddress);
        }

        if (!tokenAddress) {
          throw new Error('Could not extract token address from transaction receipt');
        }

        const newToken: DeployedToken = {
          address: tokenAddress,
          name: currentTokenData.name,
          symbol: currentTokenData.symbol,
          decimals: currentTokenData.decimals,
          deployedAt: new Date().toISOString()
        };

      setLastDeployedToken(newToken);
      setDeployedTokens(prev => [newToken, ...prev]);

      // Add to token registry for use in swaps
      addCustomToken({
        address: newToken.address,
        symbol: newToken.symbol,
        name: newToken.name,
        decimals: newToken.decimals,
        isCustom: true,
        createdBy: address,
        createdAt: newToken.deployedAt
      });

      // Refresh pools to update available tokens
      refreshPools();

      showNotification(
        'Token Created Successfully! 🎉',
        `Your token "${currentTokenData.name}" (${currentTokenData.symbol}) has been deployed!\n\n📍 Contract Address: ${newToken.address}\n💰 Initial Supply: ${currentTokenData.initialSupply} ${currentTokenData.symbol}\n\nYou can now add it to your wallet or use it in swaps.`,
        'success'
      );

      // Reset form
      setTokenData({
        name: '',
        symbol: '',
        decimals: 18,
        initialSupply: '',
        description: ''
      });

      setIsLoading(false);
      setActiveTab('manage');

        // Refetch user tokens to update the manage tab
        stableRefetchUserTokens();
      } catch (error) {
        console.error('Error processing token creation:', error);
        showNotification(
          'Token Created with Warning',
          'Token was created successfully, but there was an issue extracting the address. Please check the transaction manually.',
          'warning'
        );
        setIsLoading(false);
      }
    }
  }, [isSuccess, hash, receipt, stableRefetchUserTokens]); // Only include stable dependencies

  // Add token to wallet
  const addTokenToWallet = async (token: DeployedToken) => {
    try {
      // Validate token data
      if (!token.address || !token.symbol || token.decimals === undefined) {
        throw new Error('Invalid token data');
      }

      // Check if address is valid (starts with 0x and is 42 characters)
      if (!token.address.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid token address format');
      }

      if (window.ethereum) {
        const result = await window.ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            },
          },
        });

        if (result) {
          showNotification(
            'Token Added to Wallet',
            `${token.symbol} has been added to your wallet! 🎉`,
            'success'
          );
        } else {
          showNotification(
            'Token Addition Cancelled',
            'Token addition was cancelled by user.',
            'warning'
          );
        }
      } else {
        showNotification(
          'Wallet Not Found',
          'No Ethereum wallet detected. Please install MetaMask or another wallet.',
          'error'
        );
      }
    } catch (error) {
      console.error('Failed to add token to wallet:', error);

      // More specific error messages
      let errorMessage = 'Could not add token to wallet. Please add it manually.';
      if (error instanceof Error) {
        if (error.message.includes('Invalid token')) {
          errorMessage = 'Invalid token data. Cannot add to wallet.';
        } else if (error.message.includes('User rejected')) {
          errorMessage = 'Token addition was rejected by user.';
        }
      }

      showNotification(
        'Failed to Add Token',
        errorMessage,
        'error'
      );
    }
  };

  // Handle minting tokens
  const handleMintTokens = async (tokenAddress: string) => {
    if (!isConnected || !address) return;

    const mintAmount = mintData[tokenAddress];
    if (!mintAmount || parseFloat(mintAmount) <= 0) {
      showNotification('Invalid Amount', 'Please enter a valid amount to mint.', 'error');
      return;
    }

    try {
      setMintingTokens(prev => new Set(prev).add(tokenAddress));

      // Get token decimals to parse the amount correctly
      const token = userTokens.find(t => t.address === tokenAddress);
      const decimals = token?.decimals || 18;
      const mintAmountBigInt = parseUnits(mintAmount, decimals);

      await mintContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [address, mintAmountBigInt],
      });

    } catch (error) {
      console.error('Minting failed:', error);
      setMintingTokens(prev => {
        const newSet = new Set(prev);
        newSet.delete(tokenAddress);
        return newSet;
      });
      showNotification(
        'Minting Failed',
        `Failed to mint tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  };

  // Handle mint amount input change
  const handleMintAmountChange = (tokenAddress: string, amount: string) => {
    setMintData(prev => ({
      ...prev,
      [tokenAddress]: amount
    }));
  };

  // Fetch user's token details
  useEffect(() => {
    const fetchUserTokens = async () => {
      if (!userTokenAddresses || !publicClient) return;

      try {
        const tokenDetails = await Promise.all(
          userTokenAddresses.map(async (tokenAddress: string) => {
            const [name, symbol, decimals, balance] = await Promise.all([
              publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'name',
              }),
              publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'symbol',
              }),
              publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'decimals',
              }),
              publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [address],
              }),
            ]);

            return {
              address: tokenAddress,
              name: name as string,
              symbol: symbol as string,
              decimals: decimals as number,
              balance: formatUnits(balance as bigint, decimals as number),
              deployedAt: new Date().toISOString(),
              creator: address,
            };
          })
        );

        setUserTokens(tokenDetails);
      } catch (error) {
        console.error('Failed to fetch user tokens:', error);
      }
    };

    fetchUserTokens();
  }, [userTokenAddresses, publicClient, address]);

  // Handle successful minting
  useEffect(() => {
    if (isMintSuccess && mintHash) {
      setMintingTokens(new Set());
      setMintData({});
      showNotification(
        'Tokens Minted Successfully! 🎉',
        'Your tokens have been minted to your wallet.',
        'success'
      );
      // Refetch user tokens to update balances
      stableRefetchUserTokens();
    }
  }, [isMintSuccess, mintHash, stableRefetchUserTokens]);

  const canCreateToken = isMounted && isConnected && isValidForm() && !isPending && !isConfirming && !isLoading;

  return (
    <Window
      title="WinDex - Token Creator"
      width={500}
      height={600}
      x={150}
      y={100}
    >
      <div className="tokenizer-container">
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
              <span className="win98-status-text">Please connect your wallet to create tokens</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        {isMounted && isConnected && (
          <>
            <div className="tokenizer-tabs">
              <button
                className={`win98-tab ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => setActiveTab('create')}
              >
                🪙 Create Token
              </button>
              <button
                className={`win98-tab ${activeTab === 'manage' ? 'active' : ''}`}
                onClick={() => setActiveTab('manage')}
              >
                📋 My Tokens
              </button>
            </div>

            {/* Create Token Tab */}
            {activeTab === 'create' && (
              <div className="tokenizer-content">
                <div className="tokenizer-section">
                  <h3 className="section-title">Create New Token</h3>
                  
                  <div className="tokenizer-form">
                    {/* Token Name */}
                    <div className="form-group">
                      <label className="form-label">Token Name *</label>
                      <Input
                        type="text"
                        placeholder="e.g., My Custom Token"
                        value={tokenData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="form-input"
                        maxLength={50}
                      />
                    </div>

                    {/* Token Symbol */}
                    <div className="form-group">
                      <label className="form-label">Token Symbol *</label>
                      <Input
                        type="text"
                        placeholder="e.g., MCT"
                        value={tokenData.symbol}
                        onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                        className="form-input"
                        maxLength={10}
                      />
                    </div>

                    {/* Decimals and Initial Supply Row */}
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Decimals</label>
                        <Input
                          type="number"
                          value={tokenData.decimals}
                          onChange={(e) => handleInputChange('decimals', parseInt(e.target.value) || 18)}
                          className="form-input"
                          min={0}
                          max={18}
                        />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">Initial Supply *</label>
                        <Input
                          type="number"
                          placeholder="e.g., 1000000"
                          value={tokenData.initialSupply}
                          onChange={(e) => handleInputChange('initialSupply', e.target.value)}
                          className="form-input"
                          min={0}
                          step="any"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div className="form-group">
                      <label className="form-label">Description (Optional)</label>
                      <textarea
                        placeholder="Describe your token's purpose..."
                        value={tokenData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        className="form-textarea"
                        maxLength={200}
                        rows={3}
                      />
                    </div>

                    {/* Create Button */}
                    <div className="form-actions">
                      <Button
                        onClick={handleCreateToken}
                        disabled={!canCreateToken}
                        className="create-token-button"
                        variant="primary"
                      >
                        {isPending || isConfirming ? (
                          <span className="button-loading">
                            <span className="loading-spinner">⏳</span>
                            {isPending ? 'Confirming Transaction...' : 'Deploying Token...'}
                          </span>
                        ) : isLoading ? (
                          <span className="button-loading">
                            <span className="loading-spinner">⚙️</span>
                            Preparing...
                          </span>
                        ) : (
                          <span>
                            🚀 Create Token
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manage Tokens Tab */}
            {activeTab === 'manage' && (
              <div className="tokenizer-content">
                <div className="tokenizer-section">
                  <h3 className="section-title">My Created Tokens</h3>

                  {/* Last Deployed Token Highlight */}
                  {lastDeployedToken && (
                    <div className="recent-token-highlight">
                      <div className="highlight-header">
                        <span className="highlight-icon">🎉</span>
                        <span className="highlight-title">Recently Created</span>
                      </div>
                      <div className="token-card featured">
                        <div className="token-info">
                          <div className="token-name">{lastDeployedToken.name}</div>
                          <div className="token-symbol">{lastDeployedToken.symbol}</div>
                          <div className="token-address" title={lastDeployedToken.address}>
                            📍 {lastDeployedToken.address.slice(0, 6)}...{lastDeployedToken.address.slice(-4)}
                          </div>
                        </div>
                        <div className="token-actions">
                          <Button
                            size="small"
                            onClick={() => addTokenToWallet(lastDeployedToken)}
                            className="add-wallet-button"
                          >
                            + Wallet
                          </Button>
                          <Button
                            size="small"
                            onClick={() => {
                              navigator.clipboard.writeText(lastDeployedToken.address);
                              showNotification('Address Copied', 'Token address copied to clipboard!', 'success');
                            }}
                            className="copy-address-button"
                          >
                            📋 Copy
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User's Token List with Minting */}
                  <div className="token-list">
                    {!isConnected ? (
                      <div className="no-tokens">
                        <p>🔗 Connect your wallet to view your tokens</p>
                        <p>Connect to see tokens you've created and mint additional supply!</p>
                      </div>
                    ) : userTokens.length === 0 ? (
                      <div className="no-tokens">
                        <p>🪙 No tokens created yet</p>
                        <p>Create your first custom token to get started!</p>
                      </div>
                    ) : (
                      <>
                        <div className="token-list-header">
                          <span className="list-title">My Tokens ({userTokens.length})</span>
                        </div>
                        {userTokens.map((token) => (
                          <div key={token.address} className="token-card">
                            <div className="token-info">
                              <div className="token-name">{token.name}</div>
                              <div className="token-details">
                                <span className="token-symbol">{token.symbol}</span>
                                <span className="token-decimals">• {token.decimals} decimals</span>
                              </div>
                              {token.balance && (
                                <div style={{
                                  marginTop: '4px',
                                  padding: '4px 8px',
                                  backgroundColor: '#e8f4fd',
                                  border: '1px solid #b8d4f0',
                                  borderRadius: '2px',
                                  fontSize: '11px',
                                  fontWeight: 'bold'
                                }}>
                                  💰 Balance: {parseFloat(token.balance).toLocaleString()} {token.symbol}
                                </div>
                              )}
                              <div className="token-address" title={token.address}>
                                📍 {token.address.slice(0, 8)}...{token.address.slice(-6)}
                              </div>
                            </div>

                            {/* Minting Section */}
                            <div style={{
                              marginTop: '12px',
                              padding: '12px',
                              backgroundColor: '#f0f0f0',
                              border: '1px inset #c0c0c0',
                              borderRadius: '2px'
                            }}>
                              <div style={{
                                display: 'flex',
                                gap: '8px',
                                alignItems: 'center',
                                marginBottom: '8px'
                              }}>
                                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>🪙 Mint Tokens:</span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <Input
                                  type="number"
                                  placeholder="Amount to mint"
                                  value={mintData[token.address] || ''}
                                  onChange={(e) => handleMintAmountChange(token.address, e.target.value)}
                                  style={{ flex: 1, fontSize: '11px' }}
                                  min="0"
                                  step="any"
                                />
                                <Button
                                  size="small"
                                  onClick={() => handleMintTokens(token.address)}
                                  disabled={
                                    !mintData[token.address] ||
                                    parseFloat(mintData[token.address] || '0') <= 0 ||
                                    mintingTokens.has(token.address) ||
                                    isMintPending ||
                                    isMintConfirming
                                  }
                                  variant="primary"
                                  style={{ minWidth: '70px' }}
                                >
                                  {mintingTokens.has(token.address) || (isMintPending || isMintConfirming) ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span>⏳</span>
                                      Minting...
                                    </span>
                                  ) : (
                                    '🪙 Mint'
                                  )}
                                </Button>
                              </div>
                            </div>

                            <div className="token-actions">
                              <Button
                                size="small"
                                onClick={() => addTokenToWallet(token)}
                                className="add-wallet-button"
                              >
                                + Wallet
                              </Button>
                              <Button
                                size="small"
                                onClick={() => {
                                  navigator.clipboard.writeText(token.address);
                                  showNotification('Address Copied', 'Token address copied to clipboard!', 'success');
                                }}
                                className="copy-address-button"
                              >
                                📋 Copy
                              </Button>
                            </div>
                          </div>
                        ))}
                      </>
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

export default TokenizerInterface;
