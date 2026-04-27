import * as React from "react";
import { notify } from "@/lib/notify";
import { toast as sonnerToast } from "sonner";

/**
 * Legacy useToast/toast API — now delegates to the unified `notify` helper
 * (Sonner-based, top-right, animated check/alert icons, green/red gradients).
 * All existing call sites continue to work unchanged.
 */

type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
  duration?: number;
};

function toString(node: React.ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  // Fallback for ReactNode — try to extract text
  try {
    return String(node);
  } catch {
    return "";
  }
}

function toast(input: ToastInput = {}) {
  const title = toString(input.title) || "";
  const description = toString(input.description) || undefined;
  const variant = input.variant ?? "default";

  const id =
    variant === "destructive"
      ? notify.error(title || "Erro", { description, duration: input.duration })
      : notify.success(title || "Sucesso", { description, duration: input.duration });

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: () => {},
  };
}

function useToast() {
  return {
    toasts: [] as any[],
    toast,
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  };
}

export { useToast, toast };
