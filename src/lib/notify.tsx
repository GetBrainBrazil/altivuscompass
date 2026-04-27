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
    <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 shrink-0">
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="white"
          strokeWidth="2"
          strokeDasharray="63"
          strokeDashoffset="63"
          style={{ animation: "notify-draw-circle 0.35s ease-out forwards" }}
        />
        <path
          d="M7 12.5l3.2 3.2L17 9"
          stroke="white"
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
    <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 shrink-0 animate-[notify-pulse_0.6s_ease-out]">
      <AlertTriangle className="w-4 h-4 text-white" strokeWidth={2.5} />
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
  const bg =
    variant === "success"
      ? "bg-gradient-to-r from-emerald-700 to-emerald-600"
      : "bg-gradient-to-r from-red-700 to-red-600";

  return (
    <div
      className={`${bg} text-white shadow-2xl rounded-lg px-4 py-3 flex items-start gap-3 min-w-[300px] max-w-[420px] border border-white/10`}
    >
      {variant === "success" ? <AnimatedCheckIcon /> : <AlertIcon />}
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="font-semibold text-sm leading-snug">{title}</div>
        {description && (
          <div className="text-xs text-white/85 mt-0.5 leading-snug">{description}</div>
        )}
      </div>
      {showClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="shrink-0 -mr-1 -mt-0.5 p-1 rounded hover:bg-white/15 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
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
