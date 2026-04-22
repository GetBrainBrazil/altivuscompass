
O card do kanban hoje mostra "Sem vendedor" no rodapé quando `assigned_to` está vazio. O usuário quer que, em vez disso, apareça o nome do cliente principal da cotação.

**Investigação necessária:**
- Confirmar como a cotação se relaciona com cliente (campo `client_id` em `quotes`, com nome em `clients.name`).
- Ver como `sellers`/`clients` são carregados em `Quotes.tsx` para passar o nome ao card.

**Mudanças propostas:**

1. **`src/pages/Quotes.tsx`** — onde renderiza `<QuoteKanbanCard />`:
   - Já existe lookup de vendedor via `sellers`. Adicionar lookup similar de cliente via lista `clients` (já carregada na página).
   - Passar nova prop `clientName` para o card.

2. **`src/components/quotes/QuoteKanbanCard.tsx`** — rodapé:
   - Receber `clientName` opcional.
   - Lógica de exibição no rodapé: mostrar **nome do cliente principal** (não o vendedor). 
   - Avatar usa iniciais do cliente.
   - Se não houver cliente vinculado, mostra "Sem cliente" em itálico cinza (mesmo padrão atual de "Sem vendedor").
   - O vendedor (`assigned_to`) deixa de aparecer no card — fica apenas no editor. Isso alinha com o pedido: o card mostra **quem é o cliente**, não quem atende.

**Arquivos:** 2 arquivos editados, ~15 linhas alteradas no total. Sem mudanças de schema ou lógica de drag/menu.

**Confirmação visual:** rodapé fica `[avatar iniciais cliente] Nome do Cliente ............ R$ valor`.
