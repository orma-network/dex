'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useBlockNumber } from 'wagmi';
import { Dialog } from '@/components/ui/Dialog';


import { StatusIcon, QualityMeter } from '@/components/ui/Tabs';
import { Accordion, AccordionSection } from '@/components/ui/Accordion';

type NetworkState = 'connected' | 'disconnected' | 'error';

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export function NetworkStatus() {
  const { isConnected, chain } = useAccount();
  const [isMounted, setIsMounted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [networkState, setNetworkState] = useState<NetworkState>('disconnected');
  const [connectionLatency, setConnectionLatency] = useState<number | null>(null);
  const [connectionStartTime, setConnectionStartTime] = useState<Date | null>(null);
  const [lastSuccessfulConnection, setLastSuccessfulConnection] = useState<Date | null>(null);
  const [connectionLog, setConnectionLog] = useState<LogEntry[]>([]);
  const [bytesSent, setBytesSent] = useState(0);
  const [bytesReceived, setBytesReceived] = useState(0);

  const logContainerRef = useRef<HTMLDivElement>(null);

  const { data: blockNumber, error: blockError } = useBlockNumber({
    watch: true,
    query: {
      refetchInterval: 2000,
      retry: false,
    },
  });

  useEffect(() => {
    setIsMounted(true);
    addLogEntry('info', 'Network monitor initialized');
  }, []);

  // Logging function
  const addLogEntry = (level: 'info' | 'warning' | 'error', message: string) => {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
    };
    setConnectionLog(prev => [...prev.slice(-49), entry]); // Keep last 50 entries

    // Auto-scroll to bottom
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // Enhanced connection monitoring
  useEffect(() => {
    if (isConnected && !blockError) {
      if (!connectionStartTime) {
        setConnectionStartTime(new Date());
        addLogEntry('info', 'Connection established');
      }

      const measureLatency = async () => {
        try {
          const start = Date.now();
          const requestSize = 100; // Approximate request size

          const response = await fetch('http://127.0.0.1:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_blockNumber',
              params: [],
              id: 1,
            }),
          });

          if (response.ok) {
            const latency = Date.now() - start;
            const responseSize = JSON.stringify(await response.clone().json()).length;

            setConnectionLatency(latency);
            setLastSuccessfulConnection(new Date());
            setBytesSent(prev => prev + requestSize);
            setBytesReceived(prev => prev + responseSize);

            if (latency > 1000) {
              addLogEntry('warning', `High latency detected: ${latency}ms`);
            }
          }
        } catch (error) {
          setConnectionLatency(null);
          addLogEntry('error', `Connection test failed: ${error}`);
        }
      };

      measureLatency();
      const interval = setInterval(measureLatency, 5000); // Every 5 seconds
      return () => clearInterval(interval);
    } else if (blockError) {
      addLogEntry('error', `Block fetch error: ${blockError.message}`);
    }
  }, [isConnected, blockError, connectionStartTime]);

  // Update network state
  useEffect(() => {
    const prevState = networkState;
    let newState: NetworkState;

    if (!isConnected) {
      newState = 'disconnected';
      if (prevState !== 'disconnected') {
        setConnectionStartTime(null);
        addLogEntry('warning', 'Wallet disconnected');
      }
    } else if (blockError) {
      newState = 'error';
      if (prevState !== 'error') {
        addLogEntry('error', 'Network connection error');
      }
    } else if (blockNumber) {
      newState = 'connected';
      if (prevState !== 'connected') {
        addLogEntry('info', `Connected to block ${blockNumber}`);
      }
    } else {
      newState = 'disconnected';
    }

    setNetworkState(newState);
  }, [isConnected, blockError, blockNumber, networkState]);

  // Utility functions
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (start: Date | null): string => {
    if (!start) return 'Not connected';
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getConnectionQuality = (): number => {
    if (!connectionLatency) return 0;
    if (connectionLatency < 50) return 100;
    if (connectionLatency < 100) return 80;
    if (connectionLatency < 200) return 60;
    if (connectionLatency < 500) return 40;
    return 20;
  };



  const getNetworkIcon = () => {
    switch (networkState) {
      case 'connected':
        return (
          <div className="win98-network-icon" title="Network Connected">
            {/* Left computer */}
            <div className="win98-network-computer" style={{ left: '1px', top: '6px' }}></div>
            {/* Right computer */}
            <div className="win98-network-computer" style={{ right: '1px', top: '6px' }}></div>
            {/* Connection line */}
            <div className="win98-network-connection" style={{ left: '7px', width: '2px', top: '7px' }}></div>
            {/* Activity indicator */}
            <div className="win98-network-activity animate-pulse" style={{ left: '2px', top: '2px' }}></div>
          </div>
        );
      case 'error':
        return (
          <div className="win98-network-icon" title="Network Error">
            {/* Computer */}
            <div className="win98-network-computer" style={{ left: '2px', top: '6px' }}></div>
            {/* Warning triangle */}
            <div className="win98-network-error" style={{ right: '1px', top: '1px' }}>!</div>
          </div>
        );
      case 'disconnected':
      default:
        return (
          <div className="win98-network-icon" title="Network Disconnected">
            {/* Grayed computer */}
            <div className="win98-network-computer" style={{
              left: '2px',
              top: '6px',
              backgroundColor: '#808080',
              borderColor: '#606060'
            }}></div>
            {/* Disconnect X */}
            <div className="win98-network-disconnect" style={{ right: '1px', top: '1px' }}>✕</div>
          </div>
        );
    }
  };

  const getConnectionSpeed = () => {
    if (!connectionLatency) return 'Unknown';
    if (connectionLatency < 50) return 'Excellent';
    if (connectionLatency < 100) return 'Good';
    if (connectionLatency < 200) return 'Fair';
    return 'Poor';
  };

  const getStatusText = () => {
    switch (networkState) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Connection Error';
      case 'disconnected':
      default:
        return 'Disconnected';
    }
  };



  if (!isMounted) {
    return null;
  }

  const handleIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDialogOpen(true);
  };

  return (
    <>
      {/* Network Icon in System Tray */}
      <div
        className="win98-systray-icon"
        onClick={handleIconClick}
        style={{ cursor: 'pointer' }}
        title="Network Connection Status"
      >
        {getNetworkIcon()}
      </div>

      {/* Enhanced Network Status Dialog */}
      <Dialog
        title="Network Connection"
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        width={460}
        height={320}
        type="custom"
      >
        <div className="network-dialog-compact">
          {/* Header with Icon and Status */}
          <div className="network-header">
            <div className="network-icon-large">🌐</div>
            <div className="network-status-text">
              <div className="network-title">Network Connection Status</div>
              <div className="network-subtitle">
                {networkState === 'connected' ? 'Connected to Anvil Local' : 'Connection unavailable'}
              </div>
            </div>
          </div>

          <Accordion>
            {/* Connection Status Section */}
            <AccordionSection title="Connection Status" defaultExpanded={true}>
              <div className="win98-info-row-compact">
                <StatusIcon status={networkState === 'connected' ? 'good' : networkState === 'error' ? 'error' : 'warning'} />
                <span className="win98-info-label">Status:</span>
                <span className="win98-info-value">{getStatusText()}</span>
              </div>

              <div className="win98-info-row-compact">
                <StatusIcon status="good" />
                <span className="win98-info-label">Network:</span>
                <span className="win98-info-value">{chain?.name || 'Anvil Local'}</span>
              </div>

              <div className="win98-info-row-compact">
                <StatusIcon status="good" />
                <span className="win98-info-label">Chain ID:</span>
                <span className="win98-info-value">{chain?.id || '31337'}</span>
              </div>

              {blockNumber && (
                <div className="win98-info-row-compact">
                  <StatusIcon status="good" />
                  <span className="win98-info-label">Block Number:</span>
                  <span className="win98-info-value">{blockNumber.toString()}</span>
                </div>
              )}
            </AccordionSection>

            {/* Connection Quality Section */}
            <AccordionSection title="Connection Quality" defaultExpanded={false}>
              <div className="win98-quality-meter-compact">
                <QualityMeter
                  value={getConnectionQuality()}
                  label="Quality:"
                />
              </div>
              <div className="win98-info-row-compact">
                <StatusIcon status={connectionLatency && connectionLatency < 200 ? 'good' : 'warning'} />
                <span className="win98-info-label">Latency:</span>
                <span className="win98-info-value">
                  {connectionLatency ? `${connectionLatency}ms` : 'Unknown'}
                </span>
              </div>
              <div className="win98-info-row-compact">
                <StatusIcon status="good" />
                <span className="win98-info-label">Duration:</span>
                <span className="win98-info-value">{formatDuration(connectionStartTime)}</span>
              </div>
            </AccordionSection>

            {/* Technical Information Section */}
            <AccordionSection title="Technical Information" defaultExpanded={false}>
              <div className="win98-info-row-compact">
                <span className="win98-info-label">RPC URL:</span>
                <span className="win98-info-value">http://127.0.0.1:8545</span>
              </div>
              <div className="win98-info-row-compact">
                <span className="win98-info-label">Last Success:</span>
                <span className="win98-info-value">
                  {lastSuccessfulConnection ? lastSuccessfulConnection.toLocaleTimeString() : 'Never'}
                </span>
              </div>
              <div className="win98-info-row-compact">
                <span className="win98-info-label">Bytes Sent:</span>
                <span className="win98-info-value">{formatBytes(bytesSent)}</span>
              </div>
              <div className="win98-info-row-compact">
                <span className="win98-info-label">Bytes Received:</span>
                <span className="win98-info-value">{formatBytes(bytesReceived)}</span>
              </div>
            </AccordionSection>

            {/* Connection Log Section */}
            <AccordionSection title="Connection Log" defaultExpanded={false}>
              <div className="win98-log-container-compact" ref={logContainerRef}>
                {connectionLog.map((entry, index) => (
                  <div key={index} className="win98-log-entry">
                    <span className="win98-log-timestamp">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`win98-log-level-${entry.level}`}>
                      [{entry.level.toUpperCase()}]
                    </span>
                    <span> {entry.message}</span>
                  </div>
                ))}
              </div>
            </AccordionSection>
          </Accordion>
        </div>
      </Dialog>
    </>
  );
}

export default NetworkStatus;
