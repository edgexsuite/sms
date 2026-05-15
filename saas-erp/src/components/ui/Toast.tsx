import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastState {
  message: string;
  variant: ToastVariant;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success', duration = 4000) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, variant });
    timer.current = setTimeout(() => setToast(null), duration);
  }, []);

  const hideToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}

const STYLES: Record<ToastVariant, { bg: string; Icon: React.FC<{ className?: string }> }> = {
  success: { bg: 'bg-emerald-600', Icon: CheckCircle },
  error:   { bg: 'bg-rose-600',    Icon: XCircle    },
  info:    { bg: 'bg-indigo-600',  Icon: Info        },
};

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const style = toast ? STYLES[toast.variant] : null;
  const Icon = style?.Icon;

  return createPortal(
    <AnimatePresence>
      {toast && style && Icon && (
        <motion.div
          key={toast.message + toast.variant}
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex items-center gap-3 text-white text-sm font-semibold px-5 py-3.5 rounded-2xl shadow-2xl min-w-max max-w-sm ${style.bg}`}
        >
          <Icon className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
          <button onClick={onDismiss} className="ml-2 p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
