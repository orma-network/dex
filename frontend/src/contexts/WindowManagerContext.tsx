'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface WindowState {
  id: string;
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  icon?: string;
}

interface WindowManagerContextType {
  windows: WindowState[];
  activeWindowId: string | null;
  openWindow: (id: string, title: string, options?: Partial<WindowState>) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, position: { x: number; y: number }) => void;
  updateWindowSize: (id: string, size: { width: number; height: number }) => void;
  getWindow: (id: string) => WindowState | undefined;
  getActiveWindows: () => WindowState[];
  getMinimizedWindows: () => WindowState[];
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined);

export const useWindowManager = () => {
  const context = useContext(WindowManagerContext);
  if (!context) {
    throw new Error('useWindowManager must be used within a WindowManagerProvider');
  }
  return context;
};

// Default window configurations
const DEFAULT_WINDOW_CONFIGS: Record<string, Partial<WindowState>> = {
  swap: {
    title: 'WinDex - Token Swap',
    position: { x: 50, y: 50 },
    size: { width: 460, height: 620 },
    icon: '💱'
  },
  liquidity: {
    title: 'WinDex - Liquidity Management',
    position: { x: 100, y: 100 },
    size: { width: 520, height: 680 },
    icon: '💧'
  },
  tokenizer: {
    title: 'WinDex - Token Creator',
    position: { x: 150, y: 150 },
    size: { width: 480, height: 640 },
    icon: '🪙'
  },
  pools: {
    title: 'WinDex - Pools Overview',
    position: { x: 200, y: 200 },
    size: { width: 500, height: 600 },
    icon: '📊'
  }
};

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [nextZIndex, setNextZIndex] = useState(1000);

  const openWindow = useCallback((id: string, title?: string, options?: Partial<WindowState>) => {
    setWindows(prev => {
      const existingWindow = prev.find(w => w.id === id);
      if (existingWindow) {
        // Window already exists, just restore and focus it
        const updatedWindows = prev.map(w => 
          w.id === id 
            ? { ...w, isOpen: true, isMinimized: false, zIndex: nextZIndex }
            : w
        );
        setNextZIndex(nextZIndex + 1);
        setActiveWindowId(id);
        return updatedWindows;
      }

      // Create new window
      const defaultConfig = DEFAULT_WINDOW_CONFIGS[id] || {};
      const newWindow: WindowState = {
        id,
        title: title || defaultConfig.title || id,
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        position: defaultConfig.position || { x: 100, y: 100 },
        size: defaultConfig.size || { width: 400, height: 300 },
        zIndex: nextZIndex,
        icon: defaultConfig.icon,
        ...options
      };

      setNextZIndex(nextZIndex + 1);
      setActiveWindowId(id);
      return [...prev, newWindow];
    });
  }, [nextZIndex]);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isOpen: false } : w
    ));
    
    if (activeWindowId === id) {
      // Find next active window
      const openWindows = windows.filter(w => w.isOpen && w.id !== id);
      const nextActive = openWindows.reduce((highest, current) => 
        current.zIndex > (highest?.zIndex || 0) ? current : highest, null as WindowState | null
      );
      setActiveWindowId(nextActive?.id || null);
    }
  }, [activeWindowId, windows]);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: true } : w
    ));
    
    if (activeWindowId === id) {
      // Find next active window
      const visibleWindows = windows.filter(w => w.isOpen && !w.isMinimized && w.id !== id);
      const nextActive = visibleWindows.reduce((highest, current) => 
        current.zIndex > (highest?.zIndex || 0) ? current : highest, null as WindowState | null
      );
      setActiveWindowId(nextActive?.id || null);
    }
  }, [activeWindowId, windows]);

  const restoreWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id 
        ? { ...w, isMinimized: false, isMaximized: false, zIndex: nextZIndex }
        : w
    ));
    setNextZIndex(nextZIndex + 1);
    setActiveWindowId(id);
  }, [nextZIndex]);

  const maximizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id 
        ? { ...w, isMaximized: !w.isMaximized, zIndex: nextZIndex }
        : w
    ));
    setNextZIndex(nextZIndex + 1);
    setActiveWindowId(id);
  }, [nextZIndex]);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id 
        ? { ...w, zIndex: nextZIndex, isMinimized: false }
        : w
    ));
    setNextZIndex(nextZIndex + 1);
    setActiveWindowId(id);
  }, [nextZIndex]);

  const updateWindowPosition = useCallback((id: string, position: { x: number; y: number }) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, position } : w
    ));
  }, []);

  const updateWindowSize = useCallback((id: string, size: { width: number; height: number }) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, size } : w
    ));
  }, []);

  const getWindow = useCallback((id: string) => {
    return windows.find(w => w.id === id);
  }, [windows]);

  const getActiveWindows = useCallback(() => {
    return windows.filter(w => w.isOpen && !w.isMinimized);
  }, [windows]);

  const getMinimizedWindows = useCallback(() => {
    return windows.filter(w => w.isOpen && w.isMinimized);
  }, [windows]);

  const value: WindowManagerContextType = {
    windows,
    activeWindowId,
    openWindow,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    maximizeWindow,
    focusWindow,
    updateWindowPosition,
    updateWindowSize,
    getWindow,
    getActiveWindows,
    getMinimizedWindows
  };

  return (
    <WindowManagerContext.Provider value={value}>
      {children}
    </WindowManagerContext.Provider>
  );
}
