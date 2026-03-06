import { ReactNode, useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showClose?: boolean;
  'aria-describedby'?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  'aria-describedby': ariaDescribedBy,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [hasInitialFocus, setHasInitialFocus] = useState(false);

  // Use ref for onClose to avoid recreating event handlers on every render
  // This is the KEY fix - it prevents parent re-renders from causing focus issues
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stable close handler that uses the ref
  const handleClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  // Get all focusable elements within the modal
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return [];
    return Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
  }, []);

  // Reset initial focus state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setHasInitialFocus(false);
    }
  }, [isOpen]);

  // Keyboard event handling (Escape and Tab)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift + Tab: move focus backwards
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: move focus forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, getFocusableElements]);

  // Body scroll lock and initial focus
  useEffect(() => {
    if (!isOpen) return;

    // Store currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Focus first INPUT element (not button) only once when modal opens
    // This prevents focus from jumping while user is typing
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!hasInitialFocus) {
      timer = setTimeout(() => {
        const focusableInputs = modalRef.current?.querySelectorAll<HTMLElement>(
          'input, select, textarea'
        );
        if (focusableInputs && focusableInputs.length > 0) {
          focusableInputs[0].focus();
        } else {
          modalRef.current?.focus();
        }
        setHasInitialFocus(true);
      }, 100);
    }

    return () => {
      if (timer) clearTimeout(timer);
      document.body.style.overflow = 'unset';
      // Restore focus to previously focused element
      previousActiveElement.current?.focus();
    };
  }, [isOpen, hasInitialFocus]);

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'modal-title' : undefined}
              aria-describedby={ariaDescribedBy}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'bg-card rounded-2xl border border-neutral-800 shadow-2xl w-full overflow-hidden outline-none',
                sizes[size]
              )}
            >
              {/* Header */}
              {(title || showClose) && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
                  {title && <h2 id="modal-title" className="text-xl font-semibold text-white">{title}</h2>}
                  {showClose && (
                    <button
                      onClick={handleClose}
                      className="text-neutral-400 hover:text-white transition-colors p-1"
                      aria-label="Close modal"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
