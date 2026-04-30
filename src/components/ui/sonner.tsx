import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      offset={24}
      visibleToasts={3}
      duration={3000}
      closeButton
      gap={12}
      className="toaster group z-[100]"
      style={{ zIndex: 100 } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto flex items-center gap-3 w-full min-w-[300px] max-w-[440px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)]",
          title: "text-sm font-medium text-slate-900 leading-snug",
          description: "text-xs text-slate-500 leading-snug mt-0.5",
          icon: "shrink-0 flex items-center justify-center",
          success:
            "[&_[data-icon]]:text-emerald-500 [&_[data-icon]>svg]:w-5 [&_[data-icon]>svg]:h-5",
          error:
            "[&_[data-icon]]:text-red-500 [&_[data-icon]>svg]:w-5 [&_[data-icon]>svg]:h-5 border-red-100",
          warning:
            "[&_[data-icon]]:text-amber-500 [&_[data-icon]>svg]:w-5 [&_[data-icon]>svg]:h-5",
          info:
            "[&_[data-icon]]:text-sky-500 [&_[data-icon]>svg]:w-5 [&_[data-icon]>svg]:h-5",
          closeButton:
            "!left-auto !right-2 !top-1/2 !-translate-y-1/2 !translate-x-0 !bg-transparent !border-0 !text-slate-400 hover:!text-slate-700 hover:!bg-slate-100 !rounded-md transition-colors",
          actionButton: "",
          cancelButton: "",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
