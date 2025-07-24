import React from 'react';
import { Window } from './Window';

interface NotificationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  showCopy?: boolean;
}

export function NotificationDialog({ 
  isOpen, 
  onClose, 
  title, 
  message, 
  type,
  showCopy = true 
}: NotificationDialogProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      default: return 'ℹ️';
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      // Brief visual feedback
      const button = document.querySelector('.copy-button') as HTMLElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="notification-overlay">
      <Window
        title={title}
        width={400}
        height={200}
        x={100}
        y={100}
        className="notification-dialog"
      >
        <div className="notification-content">
          <div className="notification-header">
            <span className="notification-icon">{getIcon()}</span>
            <div className="notification-message">
              {message}
            </div>
          </div>
          
          <div className="notification-buttons">
            {showCopy && (
              <button 
                className="win98-button copy-button"
                onClick={handleCopy}
                type="button"
              >
                Copy
              </button>
            )}
            <button 
              className="win98-button ok-button"
              onClick={onClose}
              type="button"
              autoFocus
            >
              OK
            </button>
          </div>
        </div>
      </Window>
    </div>
  );
}
