import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Star, Layers, Undo2, Trash2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AnyItem = {
  id?: string;
  item_type: string;
  option_group?: string | null;
  option_label?: string | null;
  option_order?: number | null;
  is_recommended?: boolean;
  is_selected?: boolean;
  [key: string]: any;
};

interface Props<T extends AnyItem> {
  itemType: string;
  itemTypeLabel: string;
  items: T[];
  /** Cria item novo do tipo (já existente em Quotes.tsx: addItem) */
  onAddItem: (extra?: Partial<T>) => void;
  /** Atualiza item por seu índice GLOBAL no array `items` da página */
  onUpdateItemGlobal: (globalIndex: number, patch: Partial<T>) => void;
  /** Remove item por índice global */
  onRemoveItemGlobal: (globalIndex: number) => void;
  /** Array global completo (para calcular índices globais) */
  allItems: T[];
  /** Render do form do item — recebe item + índice global */
  renderItem: (item: T, globalIndex: number, localIndex: number) => ReactNode;
  /** Botão "Adicionar X" exibido quando NÃO está em modo opções */
  addButtonLabel: string;
}

const nextLetter = (existingLabels: string[]): string => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const l of letters) {
    const candidate = `Opção ${l}`;
    if (!existingLabels.includes(candidate)) return candidate;
  }
  return `Opção ${existingLabels.length + 1}`;
};

export default function QuoteOptionsManager<T extends AnyItem>({
  itemType,
  itemTypeLabel,
  items,
  onAddItem,
  onUpdateItemGlobal,
  onRemoveItemGlobal,
  allItems,
  renderItem,
  addButtonLabel,
}: Props<T>) {
  // Items do tipo, com índice global pré-calculado
  const typedItems = items.map((item) => ({
    item,
    globalIndex: allItems.indexOf(item),
  }));

  // Items que pertencem ao grupo de opções (option_group preenchido com itemType)
  const groupedItems = typedItems.filter(
    ({ item }) => item.option_group === itemType
  );
  const looseItems = typedItems.filter(({ item }) => !item.option_group);

  const isOptionsMode = groupedItems.length > 0;

  const [activeOptionTab, setActiveOptionTab] = useState<string>("0");
  const [confirmRevert, setConfirmRevert] = useState(false);

  // Sort grupados pela ordem
  const sortedGrouped = [...groupedItems].sort(
    (a, b) => (a.item.option_order ?? 0) - (b.item.option_order ?? 0)
  );

  // Algum item do grupo foi escolhido pelo cliente no aceite?
  const hasSelectedInGroup = sortedGrouped.some(({ item }) => item.is_selected);

  const handleTransformToOptions = () => {
    if (looseItems.length === 1) {
      // converte o único item solto em "Opção A"
      const { globalIndex } = looseItems[0];
      onUpdateItemGlobal(globalIndex, {
        option_group: itemType,
        option_label: "Opção A",
        option_order: 0,
        is_recommended: true,
      } as Partial<T>);
    } else if (looseItems.length === 0) {
      // Cria 2 items vazios A e B
      onAddItem({
        option_group: itemType,
        option_label: "Opção A",
        option_order: 0,
        is_recommended: true,
      } as Partial<T>);
      onAddItem({
        option_group: itemType,
        option_label: "Opção B",
        option_order: 1,
        is_recommended: false,
      } as Partial<T>);
    }
    setActiveOptionTab("0");
  };

  const handleAddOption = () => {
    const labels = sortedGrouped.map((g) => g.item.option_label || "");
    const newLabel = nextLetter(labels);
    onAddItem({
      option_group: itemType,
      option_label: newLabel,
      option_order: sortedGrouped.length,
      is_recommended: false,
    } as Partial<T>);
    setActiveOptionTab(String(sortedGrouped.length));
  };

  const handleRemoveOption = (globalIndex: number, localIdx: number) => {
    onRemoveItemGlobal(globalIndex);
    // Após remoção, força tab pra 0
    if (sortedGrouped.length - 1 <= 0) {
      setActiveOptionTab("0");
    } else if (localIdx >= sortedGrouped.length - 1) {
      setActiveOptionTab(String(sortedGrouped.length - 2));
    }
  };

  const handleToggleRecommended = (globalIndex: number, value: boolean) => {
    if (value) {
      // Desmarca outras do mesmo grupo
      sortedGrouped.forEach(({ globalIndex: gi }) => {
        if (gi !== globalIndex) {
          onUpdateItemGlobal(gi, { is_recommended: false } as Partial<T>);
        }
      });
    }
    onUpdateItemGlobal(globalIndex, { is_recommended: value } as Partial<T>);
  };

  const handleRevertToSingle = () => {
    if (sortedGrouped.length !== 1) return; // bloqueado se 2+
    const { globalIndex } = sortedGrouped[0];
    onUpdateItemGlobal(globalIndex, {
      option_group: null,
      option_label: null,
      option_order: null,
      is_recommended: false,
    } as Partial<T>);
  };

  return (
    <div className="space-y-2">
      {/* Header com toggle de modo */}
      <div className="flex items-center justify-between gap-2">
        {!isOptionsMode ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleTransformToOptions}
          >
            <Layers className="w-3.5 h-3.5" />
            Transformar em opções
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Modo opções ({sortedGrouped.length})
            </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      disabled={sortedGrouped.length !== 1}
                      onClick={handleRevertToSingle}
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      Voltar pra item único
                    </Button>
                  </span>
                </TooltipTrigger>
                {sortedGrouped.length !== 1 && (
                  <TooltipContent>
                    Remova as opções extras para voltar ao item único
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Items soltos (modo atual) */}
      {!isOptionsMode && (
        <>
          {looseItems.map(({ item, globalIndex }, localIdx) =>
            renderItem(item, globalIndex, localIdx)
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 font-body text-xs h-8"
            onClick={() => onAddItem()}
          >
            <Plus className="w-3 h-3" /> {addButtonLabel}
          </Button>
        </>
      )}

      {/* Modo opções */}
      {isOptionsMode && (
        <Tabs value={activeOptionTab} onValueChange={setActiveOptionTab} className="w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <TabsList className="h-8">
              {sortedGrouped.map(({ item }, idx) => (
                <TabsTrigger
                  key={idx}
                  value={String(idx)}
                  className={cn(
                    "text-xs h-7 px-3 gap-1.5",
                    item.is_recommended && "data-[state=active]:text-gold",
                    item.is_selected &&
                      "ring-2 ring-emerald-500/70 data-[state=active]:bg-emerald-500 data-[state=active]:text-white",
                    hasSelectedInGroup && !item.is_selected && "opacity-50"
                  )}
                >
                  {item.is_selected && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 data-[state=active]:text-white" />
                  )}
                  {item.is_recommended && (
                    <Star className="w-3 h-3 fill-gold text-gold" />
                  )}
                  {item.option_label || `Opção ${idx + 1}`}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 h-7 text-xs"
              onClick={handleAddOption}
            >
              <Plus className="w-3 h-3" /> Adicionar opção
            </Button>
          </div>

          {sortedGrouped.map(({ item, globalIndex }, idx) => (
            <TabsContent
              key={idx}
              value={String(idx)}
              className={cn(
                "mt-2 rounded-md border p-2.5 space-y-2.5",
                item.is_selected
                  ? "border-2 border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/40"
                  : item.is_recommended
                  ? "border-gold/60 ring-1 ring-gold/20"
                  : "border-border",
                hasSelectedInGroup && !item.is_selected && "opacity-60"
              )}
            >
              {/* Banner: escolhida pelo cliente */}
              {item.is_selected && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-800 font-body">
                    Escolhida pelo cliente no aceite
                  </span>
                  {item.is_recommended && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gold/90">
                      <Star className="w-3 h-3 fill-gold text-gold" />
                      também recomendada
                    </span>
                  )}
                </div>
              )}

              {/* Toolbar da opção */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Input
                    value={item.option_label ?? ""}
                    onChange={(e) =>
                      onUpdateItemGlobal(globalIndex, {
                        option_label: e.target.value,
                      } as Partial<T>)
                    }
                    placeholder="Nome da opção"
                    className="h-7 text-xs max-w-[200px]"
                  />
                  <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Switch
                      checked={!!item.is_recommended}
                      onCheckedChange={(v) => handleToggleRecommended(globalIndex, v)}
                    />
                    <Star
                      className={cn(
                        "w-3.5 h-3.5",
                        item.is_recommended ? "fill-gold text-gold" : "text-muted-foreground"
                      )}
                    />
                    Recomendada
                  </label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                  onClick={() => {
                    if (sortedGrouped.length <= 1) {
                      // se for a última, apenas remove (vira estado vazio)
                      handleRemoveOption(globalIndex, idx);
                    } else {
                      handleRemoveOption(globalIndex, idx);
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remover opção
                </Button>
              </div>

              {/* Form do item */}
              {renderItem(item, globalIndex, idx)}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <AlertDialog open={confirmRevert} onOpenChange={setConfirmRevert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voltar para item único?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá as outras opções. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertToSingle}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
