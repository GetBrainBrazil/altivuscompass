import { toast as sonnerToast } from "sonner";
import { Check, AlertTriangle, X } from "lucide-react";

/**
 * Toast notification system — premium green/red toasts with animated icons.
 * Use this instead of raw sonner/useToast for consistency.
 */

type ToastOpts = {
  description?: string;
  duration?: number;
};

function AnimatedCheckIcon() {
  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 shrink-0">
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="63"
          strokeDashoffset="63"
          style={{ animation: "notify-draw-circle 0.35s ease-out forwards" }}
        />
        <path
          d="M7 12.5l3.2 3.2L17 9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="20"
          strokeDashoffset="20"
          style={{ animation: "notify-draw-check 0.3s ease-out 0.3s forwards" }}
        />
      </svg>
    </span>
  );
}

function AlertIcon() {
  return (
    <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500/15 shrink-0 animate-[notify-pulse_0.6s_ease-out]">
      <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} />
    </span>
  );
}

function ToastBody({
  variant,
  title,
  description,
  onClose,
  showClose,
}: {
  variant: "success" | "error";
  title: string;
  description?: string;
  onClose: () => void;
  showClose?: boolean;
}) {
  const accent =
    variant === "success"
      ? "text-emerald-400"
      : "text-red-400";

  return (
    <div
      className="bg-slate-900 text-white shadow-[0_10px_40px_-5px_rgba(0,0,0,0.5)] rounded-xl px-5 py-4 flex items-center gap-3 min-w-[300px] max-w-[440px] border border-white/10"
    >
      <span className={`shrink-0 inline-flex items-center justify-center ${accent}`}>
        {variant === "success" ? <AnimatedCheckIcon /> : <AlertIcon />}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm leading-tight">{title}</div>
        {description && (
          <div className="text-xs text-white/70 mt-1 leading-snug">{description}</div>
        )}
      </div>
      {showClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-white/80" />
        </button>
      )}
    </div>
  );
}

export const notify = {
  success(title: string, opts: ToastOpts = {}) {
    return sonnerToast.custom(
      (id) => (
        <ToastBody
          variant="success"
          title={title}
          description={opts.description}
          onClose={() => sonnerToast.dismiss(id)}
        />
      ),
      { duration: opts.duration ?? 3000 }
    );
  },
  error(title: string, opts: ToastOpts = {}) {
    return sonnerToast.custom(
      (id) => (
        <ToastBody
          variant="error"
          title={title}
          description={opts.description}
          onClose={() => sonnerToast.dismiss(id)}
          showClose
        />
      ),
      { duration: opts.duration ?? Infinity }
    );
  },
  dismiss: sonnerToast.dismiss,
};
