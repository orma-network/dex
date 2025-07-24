'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePublicClient, useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, TOKEN_FACTORY_ABI } from '../lib/wagmi';

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isCustom?: boolean;
  createdBy?: string;
  createdAt?: string;
}

interface TokenRegistryContextType {
  tokens: Token[];
  customTokens: Token[];
  addCustomToken: (token: Token) => void;
  removeCustomToken: (address: string) => void;
  refreshTokens: () => Promise<void>;
  isLoading: boolean;
}

const TokenRegistryContext = createContext<TokenRegistryContextType | undefined>(undefined);

// Default tokens (existing hardcoded tokens)
const DEFAULT_TOKENS: Token[] = [
  {
    address: CONTRACT_ADDRESSES.TOKEN_A || '0x0000000000000000000000000000000000000001',
    symbol: 'TTA',
    name: 'Test Token A',
    decimals: 18,
  },
  {
    address: CONTRACT_ADDRESSES.TOKEN_B || '0x0000000000000000000000000000000000000002',
    symbol: 'TTB',
    name: 'Test Token B',
    decimals: 18,
  },
  {
    address: CONTRACT_ADDRESSES.TOKEN_C || '0x0000000000000000000000000000000000000003',
    symbol: 'TTC',
    name: 'Test Token C',
    decimals: 18,
  },
].filter(token => token.address !== '0x0000000000000000000000000000000000000001' && 
                  token.address !== '0x0000000000000000000000000000000000000002' && 
                  token.address !== '0x0000000000000000000000000000000000000003');

// ERC20 ABI for token info queries
const ERC20_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export function TokenRegistryProvider({ children }: { children: React.ReactNode }) {
  const [customTokens, setCustomTokens] = useState<Token[]>([]);
  const [userCreatedTokens, setUserCreatedTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const publicClient = usePublicClient();
  const { address, isConnected } = useAccount();

  // Fetch user's tokens from TokenFactory
  const { data: userTokenAddresses, refetch: refetchUserTokens } = useReadContract({
    address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`,
    abi: TOKEN_FACTORY_ABI,
    functionName: 'getTokensByCreator',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address && isConnected,
    },
  });

  // Fetch token information from blockchain
  const fetchTokenInfo = useCallback(async (address: string): Promise<Token | null> => {
    if (!publicClient) return null;

    try {
      const [name, symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'name',
        }),
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
        publicClient.readContract({
          address: address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'decimals',
        }),
      ]);

      return {
        address,
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        isCustom: true,
      };
    } catch (error) {
      console.error(`Failed to fetch token info for ${address}:`, error);
      return null;
    }
  }, [publicClient]);

  // Fetch token metadata for user created tokens
  useEffect(() => {
    const fetchUserTokensMetadata = async () => {
      if (!userTokenAddresses || !Array.isArray(userTokenAddresses) || userTokenAddresses.length === 0) {
        setUserCreatedTokens([]);
        return;
      }

      setIsLoading(true);
      try {
        const tokenPromises = userTokenAddresses.map(async (tokenAddress: string) => {
          const tokenInfo = await fetchTokenInfo(tokenAddress);
          if (tokenInfo) {
            return {
              address: tokenAddress,
              ...tokenInfo,
              isCustom: true,
              createdBy: address,
              createdAt: new Date().toISOString(),
            };
          }
          return null;
        });

        const tokens = await Promise.all(tokenPromises);
        const validTokens = tokens.filter((token): token is Token => token !== null);
        setUserCreatedTokens(validTokens);
      } catch (error) {
        console.error('Failed to fetch user token metadata:', error);
        setUserCreatedTokens([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserTokensMetadata();
  }, [userTokenAddresses, address, fetchTokenInfo]);

  // Load custom tokens from localStorage on mount
  useEffect(() => {
    const savedTokens = localStorage.getItem('windex-custom-tokens');
    if (savedTokens) {
      try {
        const parsed = JSON.parse(savedTokens);
        setCustomTokens(parsed);
      } catch (error) {
        console.error('Failed to parse saved tokens:', error);
      }
    }
  }, []);

  // Save custom tokens to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('windex-custom-tokens', JSON.stringify(customTokens));
  }, [customTokens]);

  // Add a custom token
  const addCustomToken = useCallback((token: Token) => {
    setCustomTokens(prev => {
      // Check if token already exists
      const exists = prev.some(t => t.address.toLowerCase() === token.address.toLowerCase());
      if (exists) {
        return prev;
      }
      
      const newToken = {
        ...token,
        isCustom: true,
        createdAt: token.createdAt || new Date().toISOString()
      };
      
      return [newToken, ...prev];
    });
  }, []);

  // Remove a custom token
  const removeCustomToken = useCallback((address: string) => {
    setCustomTokens(prev => prev.filter(token => 
      token.address.toLowerCase() !== address.toLowerCase()
    ));
  }, []);

  // Refresh tokens from TokenFactory and validate custom tokens
  const refreshTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      // Refetch user tokens from TokenFactory
      await refetchUserTokens();

      // Validate existing custom tokens
      const validatedTokens: Token[] = [];

      for (const token of customTokens) {
        const tokenInfo = await fetchTokenInfo(token.address);
        if (tokenInfo) {
          validatedTokens.push({
            ...token,
            ...tokenInfo, // Update with fresh data from blockchain
          });
        }
      }

      setCustomTokens(validatedTokens);
    } catch (error) {
      console.error('Failed to refresh tokens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [customTokens, fetchTokenInfo, refetchUserTokens]);

  // Combined tokens list - prioritize user created tokens, then custom tokens, then defaults
  const tokens = [...userCreatedTokens, ...customTokens, ...DEFAULT_TOKENS];

  const value: TokenRegistryContextType = {
    tokens,
    customTokens,
    addCustomToken,
    removeCustomToken,
    refreshTokens,
    isLoading,
  };

  return (
    <TokenRegistryContext.Provider value={value}>
      {children}
    </TokenRegistryContext.Provider>
  );
}

export function useTokenRegistry() {
  const context = useContext(TokenRegistryContext);
  if (context === undefined) {
    throw new Error('useTokenRegistry must be used within a TokenRegistryProvider');
  }
  return context;
}

export default TokenRegistryContext;
