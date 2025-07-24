'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { CONTRACT_ADDRESSES, FACTORY_ABI, PAIR_ABI, ERC20_ABI } from '../lib/wagmi';
import { formatUnits } from 'viem';

export interface PoolInfo {
  pairAddress: string;
  token0: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  hasLiquidity: boolean;
  createdAt?: string;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isCustom?: boolean;
}

interface PoolsContextType {
  pools: PoolInfo[];
  activePools: PoolInfo[];
  availableTokens: Token[];
  isLoading: boolean;
  refreshPools: () => Promise<void>;
  getPoolByTokens: (tokenA: string, tokenB: string) => PoolInfo | undefined;
  getTotalPools: () => number;
  getTotalLiquidity: () => string;
}

const PoolsContext = createContext<PoolsContextType | undefined>(undefined);

export function PoolsProvider({ children }: { children: React.ReactNode }) {
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const initializedRef = useRef(false);

  // Get token information from contract
  const getTokenInfo = useCallback(async (tokenAddress: string): Promise<Token | null> => {
    if (!publicClient) return null;

    try {
      const [name, symbol, decimals] = await Promise.all([
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
      ]);

      return {
        address: tokenAddress,
        name: name as string,
        symbol: symbol as string,
        decimals: decimals as number,
        isCustom: !Object.values(CONTRACT_ADDRESSES).includes(tokenAddress),
      };
    } catch (error) {
      console.error(`Failed to fetch token info for ${tokenAddress}:`, error);
      return null;
    }
  }, [publicClient]);

  // Get pair information including reserves
  const getPairInfo = useCallback(async (pairAddress: string): Promise<PoolInfo | null> => {
    if (!publicClient) return null;

    try {
      const [token0Address, token1Address, reserves, totalSupply] = await Promise.all([
        publicClient.readContract({
          address: pairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: 'token0',
        }),
        publicClient.readContract({
          address: pairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: 'token1',
        }),
        publicClient.readContract({
          address: pairAddress as `0x${string}`,
          abi: PAIR_ABI,
          functionName: 'getReserves',
        }),
        publicClient.readContract({
          address: pairAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'totalSupply',
        }),
      ]);

      const [token0Info, token1Info] = await Promise.all([
        getTokenInfo(token0Address as string),
        getTokenInfo(token1Address as string),
      ]);

      if (!token0Info || !token1Info) return null;

      const reservesArray = reserves as [bigint, bigint, number];
      const reserve0 = reservesArray[0];
      const reserve1 = reservesArray[1];

      return {
        pairAddress,
        token0: token0Info,
        token1: token1Info,
        reserve0,
        reserve1,
        totalSupply: totalSupply as bigint,
        hasLiquidity: reserve0 > 0n && reserve1 > 0n,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Failed to fetch pair info for ${pairAddress}:`, error);
      return null;
    }
  }, [publicClient, getTokenInfo]);

  // Discover all pools from the factory
  const discoverPools = useCallback(async (): Promise<PoolInfo[]> => {
    if (!publicClient || !CONTRACT_ADDRESSES.FACTORY) return [];

    try {
      // Get total number of pairs
      const allPairsLength = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.FACTORY as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'allPairsLength',
      });

      const pairCount = Number(allPairsLength);
      if (pairCount === 0) return [];

      // Get all pair addresses
      const pairAddresses = await Promise.all(
        Array.from({ length: pairCount }, (_, i) =>
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.FACTORY as `0x${string}`,
            abi: FACTORY_ABI,
            functionName: 'allPairs',
            args: [BigInt(i)],
          })
        )
      );

      // Get detailed info for each pair
      const poolInfoPromises = pairAddresses.map(pairAddress =>
        getPairInfo(pairAddress as string)
      );

      const poolInfos = await Promise.all(poolInfoPromises);
      return poolInfos.filter((pool): pool is PoolInfo => pool !== null);
    } catch (error) {
      console.error('Failed to discover pools:', error);
      return [];
    }
  }, [publicClient, getPairInfo]);

  // Refresh pools data
  const refreshPools = useCallback(async () => {
    setIsLoading(true);
    try {
      const discoveredPools = await discoverPools();
      setPools(discoveredPools);
    } catch (error) {
      console.error('Failed to refresh pools:', error);
    } finally {
      setIsLoading(false);
    }
  }, [discoverPools]);

  // Auto-refresh pools on mount and when account changes
  useEffect(() => {
    if (!initializedRef.current || address) {
      initializedRef.current = true;
      refreshPools();
    }
  }, [address]); // Remove refreshPools from dependencies to prevent infinite loop

  // Get pools with active liquidity
  const activePools = pools.filter(pool => pool.hasLiquidity);

  // Extract unique tokens from active pools
  const availableTokens: Token[] = React.useMemo(() => {
    const tokenMap = new Map<string, Token>();
    
    activePools.forEach(pool => {
      tokenMap.set(pool.token0.address.toLowerCase(), pool.token0);
      tokenMap.set(pool.token1.address.toLowerCase(), pool.token1);
    });

    return Array.from(tokenMap.values());
  }, [activePools]);

  // Helper functions
  const getPoolByTokens = useCallback((tokenA: string, tokenB: string): PoolInfo | undefined => {
    return activePools.find(pool => 
      (pool.token0.address.toLowerCase() === tokenA.toLowerCase() && 
       pool.token1.address.toLowerCase() === tokenB.toLowerCase()) ||
      (pool.token0.address.toLowerCase() === tokenB.toLowerCase() && 
       pool.token1.address.toLowerCase() === tokenA.toLowerCase())
    );
  }, [activePools]);

  const getTotalPools = useCallback(() => activePools.length, [activePools]);

  const getTotalLiquidity = useCallback(() => {
    // This is a simplified calculation - in reality you'd need USD prices
    return activePools.length.toString();
  }, [activePools]);

  const value: PoolsContextType = {
    pools,
    activePools,
    availableTokens,
    isLoading,
    refreshPools,
    getPoolByTokens,
    getTotalPools,
    getTotalLiquidity,
  };

  return (
    <PoolsContext.Provider value={value}>
      {children}
    </PoolsContext.Provider>
  );
}

export function usePools() {
  const context = useContext(PoolsContext);
  if (context === undefined) {
    throw new Error('usePools must be used within a PoolsProvider');
  }
  return context;
}

export default PoolsContext;
