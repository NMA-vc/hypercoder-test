'use client';

import { useEffect } from 'react';
import { 
  AlertTriangleIcon, 
  InfoIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  HelpCircleIcon,
  XIcon
} from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success' | 'default';
  icon?: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  preventCloseOnOverlay?: boolean;
  showCloseButton?: boolean;
  children?: React.ReactNode;
}

function getVariantStyles(variant: string) {
  switch (variant) {
    case 'danger':
      return {
        iconBg: 'bg-red-100 dark:bg-red-900/50',
        iconColor: 'text-red-600 dark:text-red-400',
        confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        defaultIcon: XCircleIcon
      };
    case 'warning':
      return {
        iconBg: 'bg-yellow-100 dark:bg-yellow-900/50',
        iconColor: 'text-yellow-600 dark:text-yellow-400',
        confirmButton: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
        defaultIcon: AlertTriangleIcon
      };
    case 'success':
      return {
        iconBg: 'bg-green-100 dark:bg-green-900/50',
        iconColor: 'text-green-600 dark:text-green-400',
        confirmButton: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
        defaultIcon: CheckCircleIcon
      };
    case 'info':
      return {
        iconBg: 'bg-blue-100 dark:bg-blue-900/50',
        iconColor: 'text-blue-600 dark:text-blue-400',
        confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        defaultIcon: InfoIcon
      };
    default:
      return {
        iconBg: 'bg-gray-100 dark:bg-gray-800',
        iconColor: 'text-gray-600 dark:text-gray-400',
        confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        defaultIcon: HelpCircleIcon
      };
  }
}

function getSizeStyles(size: string) {
  switch (size) {
    case 'sm':
      return {
        dialog: 'max-w-sm',
        icon: 'w-6 h-6',
        iconContainer: 'w-10 h-10',
        title: 'text-lg',
        description: 'text-sm'
      };
    case 'lg':
      return {
        dialog: 'max-w-2xl',
        icon: 'w-8 h-8',
        iconContainer: 'w-16 h-16',
        title: 'text-2xl',
        description: 'text-lg'
      };
    default: // md
      return {
        dialog: 'max-w-md',
        icon: 'w-6 h-6',
        iconContainer: 'w-12 h-12',
        title: 'text-xl',
        description: 'text-base'
      };
  }
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  icon,
  isLoading = false,
  size = 'md',
  preventCloseOnOverlay = false,
  showCloseButton = true,
  children
}: ConfirmDialogProps) {
  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);
  const IconComponent = icon || variantStyles.defaultIcon;

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading, onClose]);

  // Handle confirm action
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      console.error('Error in confirm action:', error);
    }
  };

  // Handle cancel action
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !preventCloseOnOverlay && !isLoading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      {/* Backdrop */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-80 transition-opacity"
          onClick={handleOverlayClick}
        />
        
        {/* Dialog */}
        <div className={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full ${sizeStyles.dialog}`}>
          {/* Close button */}
          {showCloseButton && !isLoading && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close dialog"
            >
              <XIcon className="w-5 h-5" />
            </button>
          )}
          
          <div className="p-6">
            {/* Icon and Title */}
            <div className="flex items-start space-x-4 mb-4">
              <div className={`${variantStyles.iconBg} ${sizeStyles.iconContainer} rounded-full flex items-center justify-center flex-shrink-0`}>
                <IconComponent className={`${sizeStyles.icon} ${variantStyles.iconColor}`} />
              </div>
              
              <div className="flex-1 pt-1">
                <h3 
                  id="dialog-title"
                  className={`font-semibold text-gray-900 dark:text-white ${sizeStyles.title} mb-2`}
                >
                  {title}
                </h3>
                
                <p 
                  id="dialog-description"
                  className={`text-gray-600 dark:text-gray-400 ${sizeStyles.description} leading-relaxed`}
                >
                  {description}
                </p>
              </div>
            </div>
            
            {/* Custom content */}
            {children && (
              <div className="mb-6 pl-16">
                {children}
              </div>
            )}
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-4">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {cancelLabel}
              </button>
              
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLoading}
                className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${variantStyles.confirmButton}`}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Processing...
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Predefined confirm dialogs for common actions
export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  isLoading = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType?: string;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Delete ${itemType}?`}
      description={`Are you sure you want to delete "${itemName}"? This action cannot be undone and will permanently remove all associated data.`}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      variant="danger"
      isLoading={isLoading}
      preventCloseOnOverlay={isLoading}
    >
      {/* Additional warning */}
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
        <p className="text-sm text-red-800 dark:text-red-300 font-medium">
          ⚠️ This action is permanent and cannot be reversed.
        </p>
      </div>
    </ConfirmDialog>
  );
}

export function LogoutConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Sign out of your account?"
      description="You will need to sign in again to access your dashboard and data."
      confirmLabel="Sign Out"
      cancelLabel="Stay Signed In"
      variant="warning"
      isLoading={isLoading}
    />
  );
}

export function UnsavedChangesDialog({
  isOpen,
  onClose,
  onConfirm,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSave?: () => void;
}) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Unsaved changes"
      description="You have unsaved changes that will be lost if you continue. What would you like to do?"
      confirmLabel="Discard Changes"
      cancelLabel="Continue Editing"
      variant="warning"
      size="md"
    >
      {onSave && (
        <div className="text-center">
          <button
            onClick={onSave}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
    </ConfirmDialog>
  );
}

export function ArchiveConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  isLoading = false
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  itemType?: string;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`Archive ${itemType}?`}
      description={`"${itemName}" will be moved to your archive and hidden from your active ${itemType}s. You can restore it later if needed.`}
      confirmLabel="Archive"
      cancelLabel="Cancel"
      variant="info"
      isLoading={isLoading}
    />
  );
}