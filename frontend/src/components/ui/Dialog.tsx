'use client';

import React, { useEffect } from 'react';
import { Window } from './Window';
import { Button } from './Button';

interface DialogProps {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  width?: number;
  height?: number;
  type?: 'info' | 'warning' | 'error' | 'question' | 'custom';
}

export const Dialog: React.FC<DialogProps> = ({
  title,
  children,
  isOpen,
  onClose,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false,
  width = 300,
  height = 150,
  type = 'info',
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'question':
        return '❓';
      default:
        return 'ℹ️';
    }
  };

  const centerX = (window.innerWidth - width) / 2;
  const centerY = (window.innerHeight - height) / 2;

  return (
    <>
      {/* Dialog Window */}
      <Window
        title={title}
        width={width}
        height={height}
        x={centerX}
        y={centerY}
        resizable={false}
        minimizable={false}
        maximizable={false}
        closable={true}
        active={true}
        onClose={onClose}
        className="z-[1001] fixed"
      >
        <div className="flex flex-col h-full">
          {/* Content */}
          {type === 'custom' ? (
            <div className="flex-1 overflow-hidden min-h-0">
              {children}
            </div>
          ) : (
            <div className="flex-1 flex items-start gap-3 p-2">
              <div className="text-2xl">{getIcon()}</div>
              <div className="flex-1 text-sm">
                {children}
              </div>
            </div>
          )}
          
          {/* Buttons */}
          <div className={`flex justify-end gap-2 ${type === 'custom' ? 'py-2' : 'p-2'}`} style={type === 'custom' ? { paddingLeft: '12px', paddingRight: '12px', borderTop: '2px outset var(--win98-bg)' } : { borderTop: '2px outset var(--win98-bg)' }}>
            {showCancel && (
              <Button onClick={onClose}>
                {cancelText}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={onConfirm || onClose}
              autoFocus
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </Window>
    </>
  );
};

interface MessageBoxOptions {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'question';
  buttons?: 'ok' | 'ok-cancel' | 'yes-no' | 'yes-no-cancel';
}

export const useMessageBox = () => {
  const [dialog, setDialog] = React.useState<{
    isOpen: boolean;
    options: MessageBoxOptions;
    resolve: (result: string) => void;
  } | null>(null);

  const showMessageBox = (options: MessageBoxOptions): Promise<string> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        options,
        resolve,
      });
    });
  };

  const handleClose = (result: string) => {
    if (dialog) {
      dialog.resolve(result);
      setDialog(null);
    }
  };

  const MessageBoxComponent = dialog ? (
    <Dialog
      title={dialog.options.title}
      isOpen={dialog.isOpen}
      onClose={() => handleClose('cancel')}
      type={dialog.options.type}
      showCancel={dialog.options.buttons !== 'ok'}
      confirmText={
        dialog.options.buttons === 'yes-no' || dialog.options.buttons === 'yes-no-cancel'
          ? 'Yes'
          : 'OK'
      }
      cancelText={
        dialog.options.buttons === 'yes-no' || dialog.options.buttons === 'yes-no-cancel'
          ? 'No'
          : 'Cancel'
      }
      onConfirm={() => 
        handleClose(
          dialog.options.buttons === 'yes-no' || dialog.options.buttons === 'yes-no-cancel'
            ? 'yes'
            : 'ok'
        )
      }
    >
      {dialog.options.message}
    </Dialog>
  ) : null;

  return { showMessageBox, MessageBoxComponent };
};

export default Dialog;
