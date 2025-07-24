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

  // Calculate center position with increased width and improved height calculation
  const dialogWidth = 480;
  const maxDialogHeight = Math.min(400, window.innerHeight - 100); // Max height with screen padding
  const minDialogHeight = 200;
  const estimatedContentHeight = message.split('\n').length * 18 + 140; // More accurate line height
  const dialogHeight = Math.min(maxDialogHeight, Math.max(minDialogHeight, estimatedContentHeight));

  const centerX = Math.max(20, (window.innerWidth - dialogWidth) / 2);
  const centerY = Math.max(20, (window.innerHeight - dialogHeight) / 2);

  return (
    <div className="notification-overlay">
      <Window
        title={title}
        width={dialogWidth}
        height={dialogHeight}
        x={centerX}
        y={centerY}
        resizable={false}
        minimizable={false}
        maximizable={false}
        className="notification-dialog z-[10000] fixed"
      >
        <div className="notification-content">
          <div className="notification-scrollable-area">
            <div className="notification-header">
              <span className="notification-icon">{getIcon()}</span>
              <div className="notification-message">
                {message}
              </div>
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
