'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/Input';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface TokenSelectorProps {
  value: string;
  onChange: (token: Token) => void;
  options?: { value: string; label: string }[];
  tokens?: Token[];
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  showBalance?: boolean;
  balances?: { [address: string]: string };
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  value,
  onChange,
  options,
  tokens = [],
  className = '',
  disabled = false,
  placeholder = 'Select Token',
  showBalance = false,
  balances = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find selected token
  const selectedToken = tokens.find(token => token.address === value);

  // Filter tokens based on search term
  const filteredTokens = tokens.filter(token =>
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleTokenSelect = (token: Token) => {
    onChange(token);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    } else if (event.key === 'Enter' && filteredTokens.length === 1) {
      handleTokenSelect(filteredTokens[0]);
    } else if (event.key === 'ArrowDown' && !isOpen) {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' && filteredTokens.length > 0) {
      event.preventDefault();
      // Focus first token option
      const firstOption = document.querySelector('.win98-token-option') as HTMLElement;
      if (firstOption) {
        firstOption.focus();
      }
    } else if (event.key === 'Enter' && filteredTokens.length === 1) {
      event.preventDefault();
      handleTokenSelect(filteredTokens[0]);
    }
  };

  const formatBalance = (balance: string, decimals: number) => {
    if (!balance || balance === '0') return '0.00';
    try {
      const num = parseFloat(balance) / Math.pow(10, decimals);
      return num.toFixed(4);
    } catch {
      return '0.00';
    }
  };

  return (
    <div className={`win98-token-selector ${className}`} ref={dropdownRef}>
      {/* Token Selection Button */}
      <button
        type="button"
        className="win98-token-button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        onKeyDown={handleKeyDown}
      >
        <div className="win98-token-display">
          {selectedToken ? (
            <>
              <div className="win98-token-icon">
                {selectedToken.symbol.charAt(0)}
              </div>
              <div className="win98-token-info">
                <span className="win98-token-symbol">{selectedToken.symbol}</span>
                <span className="win98-token-name">{selectedToken.name}</span>
              </div>
            </>
          ) : (
            <span className="win98-token-placeholder">{placeholder}</span>
          )}
        </div>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {/* Dropdown List */}
      {isOpen && !disabled && (
        <div className="win98-token-dropdown">
          {/* Search Input */}
          <div className="win98-token-search-container">
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search tokens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="win98-token-search"
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {/* Token List */}
          <div className="win98-token-list">
            {filteredTokens.length > 0 ? (
              filteredTokens.map((token) => (
                <div
                  key={token.address}
                  className={`win98-token-option ${token.address === value ? 'selected' : ''}`}
                  onClick={() => handleTokenSelect(token)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTokenSelect(token);
                    }
                  }}
                  tabIndex={0}
                  role="option"
                  aria-selected={token.address === value}
                >
                  <div className="win98-token-icon">
                    {token.symbol.charAt(0)}
                  </div>
                  <div className="win98-token-info">
                    <div className="win98-token-symbol">{token.symbol}</div>
                    <div className="win98-token-name">{token.name}</div>
                  </div>
                  {showBalance && balances[token.address] && (
                    <div className="win98-token-balance">
                      {formatBalance(balances[token.address], token.decimals)}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="win98-token-no-results">
                {searchTerm ? `No tokens found for "${searchTerm}"` : 'No tokens available'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};