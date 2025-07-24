'use client';

import React from 'react';
import { Dialog } from './Dialog';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface LiquidityConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'add' | 'remove';
  tokenA: Token;
  tokenB: Token;
  amountA: string;
  amountB: string;
  lpTokenAmount?: string;
  estimatedOutput?: {
    tokenA: string;
    tokenB: string;
  };
  priceImpact?: string;
  minimumReceived?: {
    tokenA: string;
    tokenB: string;
  };
  slippage?: string;
  isLoading?: boolean;
}

export const LiquidityConfirmationDialog: React.FC<LiquidityConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type,
  tokenA,
  tokenB,
  amountA,
  amountB,
  lpTokenAmount,
  estimatedOutput,
  priceImpact,
  minimumReceived,
  slippage = '0.5',
  isLoading = false,
}) => {
  const formatAmount = (amount: string, decimals: number = 18) => {
    if (!amount || amount === '0') return '0.00';
    try {
      const num = parseFloat(amount);
      return num.toFixed(4);
    } catch {
      return '0.00';
    }
  };

  const getPriceImpactColor = (impact: string) => {
    const num = parseFloat(impact);
    if (num < 1) return '#00cc00'; // Green
    if (num < 3) return '#ffcc00'; // Yellow
    return '#ff0000'; // Red
  };

  const title = type === 'add' ? 'Confirm Add Liquidity' : 'Confirm Remove Liquidity';

  return (
    <Dialog
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      confirmText={isLoading ? 'Processing...' : 'Confirm'}
      cancelText="Cancel"
      showCancel={true}
      width={450}
      height={type === 'add' ? 450 : 480}
      type="custom"
    >
      <div className="liquidity-confirmation-content">
        {/* Transaction Summary */}
        <div className="win98-groupbox">
          <div className="win98-groupbox-title">
            {type === 'add' ? 'Adding Liquidity' : 'Removing Liquidity'}
          </div>
          
          <div className="confirmation-section">
            <div className="token-pair-header">
              <span className="pair-name">{tokenA.symbol}/{tokenB.symbol}</span>
              <span className="pair-type">Liquidity Pool</span>
            </div>

            {type === 'add' ? (
              <div className="add-liquidity-details">
                <div className="token-amount-row">
                  <div className="token-info">
                    <div className="token-icon">{tokenA.symbol.charAt(0)}</div>
                    <span className="token-symbol">{tokenA.symbol}</span>
                  </div>
                  <span className="amount-value">{formatAmount(amountA)}</span>
                </div>
                
                <div className="plus-separator">+</div>
                
                <div className="token-amount-row">
                  <div className="token-info">
                    <div className="token-icon">{tokenB.symbol.charAt(0)}</div>
                    <span className="token-symbol">{tokenB.symbol}</span>
                  </div>
                  <span className="amount-value">{formatAmount(amountB)}</span>
                </div>
              </div>
            ) : (
              <div className="remove-liquidity-details">
                <div className="lp-token-row">
                  <span className="lp-label">LP Tokens to Remove:</span>
                  <span className="lp-amount">{formatAmount(lpTokenAmount || '0')} SLP</span>
                </div>
                
                {estimatedOutput && (
                  <div className="estimated-output">
                    <div className="output-label">You will receive:</div>
                    <div className="token-amount-row">
                      <div className="token-info">
                        <div className="token-icon">{tokenA.symbol.charAt(0)}</div>
                        <span className="token-symbol">{tokenA.symbol}</span>
                      </div>
                      <span className="amount-value">{formatAmount(estimatedOutput.tokenA)}</span>
                    </div>
                    <div className="token-amount-row">
                      <div className="token-info">
                        <div className="token-icon">{tokenB.symbol.charAt(0)}</div>
                        <span className="token-symbol">{tokenB.symbol}</span>
                      </div>
                      <span className="amount-value">{formatAmount(estimatedOutput.tokenB)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Transaction Details */}
        <div className="win98-groupbox">
          <div className="win98-groupbox-title">Transaction Details</div>
          
          <div className="details-grid">
            {priceImpact && (
              <div className="detail-row">
                <span className="detail-label">Price Impact:</span>
                <span 
                  className="detail-value"
                  style={{ color: getPriceImpactColor(priceImpact) }}
                >
                  {priceImpact}%
                </span>
              </div>
            )}
            
            <div className="detail-row">
              <span className="detail-label">Slippage Tolerance:</span>
              <span className="detail-value">{slippage}%</span>
            </div>

            {minimumReceived && type === 'remove' && (
              <>
                <div className="detail-row">
                  <span className="detail-label">Minimum {tokenA.symbol}:</span>
                  <span className="detail-value">{formatAmount(minimumReceived.tokenA)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Minimum {tokenB.symbol}:</span>
                  <span className="detail-value">{formatAmount(minimumReceived.tokenB)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Warning Messages */}
        {priceImpact && parseFloat(priceImpact) > 3 && (
          <div className="win98-status-panel warning">
            <span className="win98-status-text">
              High price impact! This transaction may result in significant slippage.
            </span>
          </div>
        )}

        {type === 'remove' && (
          <div className="win98-status-panel info">
            <span className="win98-status-text">
              Removing liquidity will burn your LP tokens and return the underlying assets.
            </span>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default LiquidityConfirmationDialog;
