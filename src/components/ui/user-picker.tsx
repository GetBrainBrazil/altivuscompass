import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UserOption = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  meta?: string | null;
};

export function getUserInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

export function UserAvatar({
  name,
  avatarUrl,
  className,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-6 w-6", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name ?? ""} /> : null}
      <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
        {getUserInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

type UserPickerProps = {
  users: UserOption[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  size?: "default" | "sm";
};

export function UserPicker({
  users,
  value,
  onChange,
  placeholder = "Selecione um responsável",
  allowClear = true,
  className,
  triggerClassName,
  disabled,
  size = "default",
}: UserPickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = React.useMemo(
    () => users.find((u) => u.id === value) ?? null,
    [users, value]
  );

  const heightClass = size === "sm" ? "h-9" : "h-10";

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              heightClass,
              "w-full justify-between font-normal px-3",
              !selected && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected ? (
                <>
                  <UserAvatar
                    name={selected.name}
                    avatarUrl={selected.avatarUrl}
                    className="h-5 w-5"
                  />
                  <span className="truncate text-sm text-foreground">
                    {selected.name}
                  </span>
                </>
              ) : (
                <span className="truncate text-sm">{placeholder}</span>
              )}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {selected && allowClear && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(null);
                  }}
                  className="rounded-sm p-0.5 hover:bg-muted"
                  aria-label="Limpar"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar usuário..." />
            <CommandList>
              <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
              <CommandGroup>
                {users.map((u) => {
                  const isSelected = u.id === value;
                  return (
                    <CommandItem
                      key={u.id}
                      value={u.name}
                      onSelect={() => {
                        onChange(u.id);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      <UserAvatar name={u.name} avatarUrl={u.avatarUrl} className="h-6 w-6" />
                      <span className="flex-1 truncate text-sm">{u.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
