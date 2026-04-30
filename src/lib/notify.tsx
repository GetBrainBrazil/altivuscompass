import { toast as sonnerToast } from "sonner";

/**
 * Toast notification system — light theme, top-right, max 3 visible,
 * auto-dismiss in 3s with close button. Styling lives in `sonner.tsx`
 * (toastOptions.classNames), so we just delegate to Sonner's native variants
 * to get consistent look across the whole app.
 */

type ToastOpts = {
  description?: string;
  duration?: number;
};

export const notify = {
  success(title: string, opts: ToastOpts = {}) {
    return sonnerToast.success(title, {
      description: opts.description,
      duration: opts.duration ?? 3000,
    });
  },
  error(title: string, opts: ToastOpts = {}) {
    return sonnerToast.error(title, {
      description: opts.description,
      duration: opts.duration ?? 5000,
    });
  },
  warning(title: string, opts: ToastOpts = {}) {
    return sonnerToast.warning(title, {
      description: opts.description,
      duration: opts.duration ?? 4000,
    });
  },
  info(title: string, opts: ToastOpts = {}) {
    return sonnerToast.info(title, {
      description: opts.description,
      duration: opts.duration ?? 3000,
    });
  },
  dismiss: sonnerToast.dismiss,
};
