import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      offset={24}
      className="toaster group z-[100]"
      style={{ zIndex: 100 } as React.CSSProperties}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: "group toast",
          description: "",
          actionButton: "",
          cancelButton: "",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
