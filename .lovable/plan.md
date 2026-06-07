# Editor visual de campos por categoria — Grid 12 colunas com drag & resize

## Problema atual
- Largura é um enum fixo de 4 valores (`full|half|third|quarter` → 100/50/33/25%). Não permite combinar 50% + 25% + 25% numa linha, nem ajustar Origem maior + Tipo/Embarque/Horário menores.
- Edição é em formato de lista vertical de "cards de configuração" — pouco intuitivo. Difícil visualizar o resultado final ao mesmo tempo que se edita.

## Solução proposta

Migrar para um modelo de **grid de 12 colunas com span configurável por campo (1–12)**, editado em uma tela **WYSIWYG com drag & resize** (handle lateral para redimensionar, arrastar para reordenar). Mantém compatibilidade com schemas existentes via migração automática dos enums.

### Modelo de dados (mínimo, compatível)

Adicionar dois campos opcionais em `CategoryField` (em `src/lib/category-schema.ts`):
- `span?: number` — 1 a 12 (colunas no grid desktop). Substitui `width` na prática.
- `row?: number` — agrupamento por linha visual (opcional; senão, o grid faz o wrap automático).

Manter `width` como **legado**: se `span` ausente, derivar de `width` (`full=12, half=6, third=4, quarter=3`). Ao salvar pela primeira vez no novo editor, gravar `span` e remover `width`.

Sem migração SQL — `field_schema` é JSONB.

### Responsividade (regra fixa, sem opção por campo)

```text
Mobile  (<640px):  todos os campos col-span-12 (empilhados)
Tablet  (≥640px):  span ≤ 4 vira span 6; span > 4 vira span 12
Desktop (≥1024px): respeita o span configurado (1–12)
```

Implementação via classes Tailwind responsivas: `col-span-12 sm:col-span-{6|12} lg:col-span-{span}`. Mantém o "zero horizontal scroll" no mobile.

### Editor WYSIWYG (substitui a lista atual)

Tela única em `CategoryFieldsEditor`:

```text
┌─ Toolbar ─────────────────────────────────────────────┐
│ [Aplicar modelo ▼]  [+ Adicionar campo]   12 campos  │
├─ Canvas (grid 12 col, igual ao runtime) ──────────────┤
│ ┌─Tipo─┐┌─Origem─────┐┌─Embarque─┐┌─Hr Embarque─┐    │
│ │ sp:2 ││ sp:5       ││ sp:3     ││ sp:2        │    │
│ └──╫───┘└──╫─────────┘└──╫───────┘└──╫──────────┘    │
│  drag handle = arrasta │ borda direita = resize       │
└────────────────────────────────────────────────────────┘
[Painel lateral aparece ao clicar no campo: label, key,
 tipo, placeholder, obrigatório, opções, grupo]
```

Comportamentos:
- **Arrastar** o card reordena no array `fields` (mantém ordem semântica = ordem de renderização).
- **Redimensionar** pela borda direita: snap em incrementos de 1 coluna (1–12). Mostra "X/12" durante o drag.
- **Clicar** no card abre painel lateral (Sheet) com config detalhada. Edição rápida de label inline (duplo-clique).
- **+ Adicionar campo** insere card de span 6 no fim.
- **Aplicar modelo Altivus** continua disponível; templates seed são atualizados para usar `span`.

### Biblioteca

- **Drag**: `@dnd-kit/core` + `@dnd-kit/sortable` (já é leve, sem deps novas pesadas; provavelmente já presente — verificar antes; senão `bun add`).
- **Resize**: implementação própria com `pointerdown/move/up` calculando `Math.round(deltaX / colWidth)`. Sem libs.

### Templates seed (atualização em `SEED_TEMPLATES`)

Atualizar voo para refletir o pedido (Tipo menor, Origem maior):
```text
L1: Tipo(2) Origem(5) Embarque(3) Hr Embarque(2)
L2: Duração(2) Destino(5) Chegada(3) Hr Chegada(2)
L3: Cia Aérea(4) Nº Voo(3) Localizador(3) Nº Compra(2)
L4: Classe(3) Conexões(3) Notif Checkin(3) Bagagens(3)
L5: Observação(12)
```

Hospedagem e Locação: convertidos de `width` para `span` equivalente (sem mudança visual).

### Runtime (`DynamicCategoryFields.tsx`)

Substituir o mapa `WIDTH_CLASS` por uma função `spanClass(span)` que gera `col-span-12 sm:col-span-{...} lg:col-span-{1..12}`. Como Tailwind precisa das classes presentes no bundle, usar um switch que mapeia 1–12 para classes literais (safelist implícita).

## Arquivos afetados

- `src/lib/category-schema.ts` — adicionar `span`, helper `getEffectiveSpan(field)`, atualizar `SEED_TEMPLATES`.
- `src/components/registrations/CategoryFieldsEditor.tsx` — reescrita do corpo para canvas WYSIWYG + Sheet de propriedades. Mantém imports/contrato externo.
- `src/components/quotes/DynamicCategoryFields.tsx` — trocar `WIDTH_CLASS` por `spanClass()`.
- (opcional) `bun add @dnd-kit/core @dnd-kit/sortable` se não estiverem instalados.

## Fora do escopo
- Resize livre por % (mantemos snap em colunas de 12 — suficiente e responsivo).
- Configuração de breakpoints por campo (mantemos a regra fixa).
- Drag entre "linhas" explícitas (linha é resultado do wrap natural do grid).
