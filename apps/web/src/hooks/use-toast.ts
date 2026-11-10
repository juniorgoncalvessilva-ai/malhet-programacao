import { toast as sonnerToast } from 'sonner';
import { useTranslations } from 'next-intl';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick?: () => void;
  };
}

export function useToast() {
  const t = useTranslations('Toast');

  const toast = ({ 
    title, 
    description, 
    variant = 'default', 
    duration = 4000,
    action,
    cancel
  }: ToastProps) => {
    // Create message content as string
    let message = '';
    if (title && description) {
      message = `${title}\n${description}`;
    } else if (title) {
      message = title;
    } else if (description) {
      message = description;
    }

    const toastOptions = {
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      cancel: cancel ? {
        label: cancel.label,
        onClick: cancel.onClick || (() => {}),
      } : undefined,
    };

    switch (variant) {
      case 'success':
        return sonnerToast.success(message, toastOptions);
      case 'error':
        return sonnerToast.error(message, toastOptions);
      case 'warning':
        return sonnerToast.warning(message, toastOptions);
      case 'info':
        return sonnerToast.info(message, toastOptions);
      case 'loading':
        return sonnerToast.loading(message, toastOptions);
      default:
        return sonnerToast(message, toastOptions);
    }
  };

  const success = (message: string, duration?: number) => {
    return sonnerToast.success(message, { duration: duration || 4000 });
  };

  const error = (message: string, duration?: number) => {
    return sonnerToast.error(message, { duration: duration || 6000 });
  };

  const warning = (message: string, duration?: number) => {
    return sonnerToast.warning(message, { duration: duration || 5000 });
  };

  const info = (message: string, duration?: number) => {
    return sonnerToast.info(message, { duration: duration || 4000 });
  };

  const loading = (message: string, promise?: Promise<any>) => {
    if (promise) {
      return sonnerToast.promise(promise, {
        loading: message,
        success: t('promiseSuccess'),
        error: t('promiseError'),
      });
    }
    return sonnerToast.loading(message);
  };

  const dismiss = (toastId?: string | number) => {
    if (toastId) {
      sonnerToast.dismiss(toastId);
    } else {
      sonnerToast.dismiss();
    }
  };

  return {
    toast,
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
  };
}