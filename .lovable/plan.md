
## Problema

No `/quotes`, view kanban (linhas 2371–2444 de `Quotes.tsx`):

```tsx
<div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pb-4">
  {stages.map(stage => (
    <div className="w-full sm:min-w-[280px] sm:flex-shrink-0">
```

- Layout `flex-row` + `min-w-[280px]` + `flex-shrink-0` → cada coluna trava em ≥280px e empurra pra scroll horizontal.
- Com 5 estágios (`new`, `sent`, `negotiating`, `confirmed`, `cancelled`) em 1384px de viewport sobra espaço pra cada coluna ficar enorme ou aparecer scroll.

## Solução

Trocar pra **grid responsivo de 5 colunas em telas médias+**, mantendo empilhamento no mobile:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 pb-4">
  {stages.map(stage => (
    <div className="min-w-0">  {/* sem min-w fixo, sem flex-shrink */}
```

Mudanças pontuais:

1. **Container**: `flex flex-col sm:flex-row` → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`. Todas as 5 colunas cabem lado a lado em ≥1024px (cada uma ~260px no viewport atual de 1384px), sem scroll horizontal.
2. **Cada coluna**: `w-full sm:min-w-[280px] sm:flex-shrink-0` → `min-w-0 flex flex-col` pra permitir encolhimento e respeitar o grid.
3. **Cards internos**: ajustar pra `p-3` (sem `sm:p-4`) e garantir `min-w-0` + `truncate` no título — em coluna de ~260px, o `flex justify-between` do header do card precisa não estourar. Trocar `text-sm` do título por `text-sm truncate` e o bloco do valor + dropdown já tem `shrink-0`.
4. **KanbanSkeleton** (`src/components/ui/loading-skeletons.tsx`): aplicar a mesma mudança de `flex-row` → `grid lg:grid-cols-5` pra esqueleto bater com o layout real.

## Breakpoints finais

- **Mobile** (`<640px`): 1 coluna, empilhado (igual hoje).
- **Tablet** (`640–1024px`): 2 colunas (melhora o uso de espaço vs. hoje que vira scroll horizontal).
- **Desktop** (`≥1024px`): **5 colunas lado a lado**, sem scroll horizontal — todas visíveis na mesma tela, conforme pedido.

## Drag & drop

Mantém-se 100% — handlers `onDragOver/onDragLeave/onDrop` vivem em cada coluna e não dependem do layout de container.

## Arquivos

- `src/pages/Quotes.tsx` — linhas ~2372–2376 e ajustes finos no card (~2400, 2403–2404).
- `src/components/ui/loading-skeletons.tsx` — `KanbanSkeleton` pra refletir grid de 5.

## Fora do escopo

- Não mexo na view tabela.
- Não mexo no editor da cotação nem em filtros/busca.
- Não altero `stages` array nem cores.

<lov-actions>
<lov-suggestion message="Verifique no preview se as 5 colunas do kanban aparecem lado a lado sem scroll horizontal e se o drag-and-drop continua funcionando">Verificar no preview</lov-suggestion>
<lov-suggestion message="Adicione um indicador de soma de valores (R$ total) por coluna do kanban, embaixo do contador de cotações">Total por coluna no kanban</lov-suggestion>
<lov-suggestion message="Permita colapsar/expandir colunas individuais do kanban (ex: esconder 'Cancelada' por padrão) com preferência salva no localStorage">Colapsar colunas</lov-suggestion>
</lov-actions>
