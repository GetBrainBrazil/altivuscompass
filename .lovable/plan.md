## Problema

Ao editar uma cotação e remover o último item de um tipo (no caso, o último voo) sem salvar, o item volta a aparecer sozinho. Não é o backend recriando — é o editor recarregando os itens do banco em cima do estado local.

## Causa raiz

`src/pages/Quotes.tsx`, useEffect das linhas 686–728 (hidratação dos `quote_items` ao abrir o editor):

- Guarda: `if (editingQuote && items.length === 0) { ...fetch quote_items... setItems(loadedItems) }`
- Dependências (linha 728): `[editingQuote, draftRestored, items.length]`

Como `items.length` está nas dependências, toda vez que o usuário apaga o último item e a lista fica vazia (`items.length === 0`), o effect dispara de novo, busca os `quote_items` do banco e repõe o item que o usuário acabou de remover. Reproduz exatamente o sintoma: deleta o voo → ele "reaparece" instantaneamente.

(O setItems na linha 707 usa o updater `current.length > 0 ? current : loadedItems`, que protege contra concorrência mas não contra o próprio effect ser re-disparado depois que current já zerou.)

## Correção

Tornar a hidratação dos itens estritamente "uma vez por cotação aberta", desacoplada de `items.length`:

1. Adicionar um `useRef<string | null>(null)` — `hydratedQuoteIdRef` — com o id da cotação cuja hidratação já rodou.
2. No effect (linhas 686–728):
   - Sair cedo se `hydratedQuoteIdRef.current === editingQuote.id` (já hidratou esta cotação).
   - Manter a guarda existente para draft restaurado.
   - No `then()` da busca, marcar `hydratedQuoteIdRef.current = editingQuote.id` após `setItems`/`setSelectedPassengers`.
3. Remover `items.length` do array de dependências (linha 728). Passa a depender apenas de `[editingQuote, draftRestored]`.
4. Resetar `hydratedQuoteIdRef.current = null` quando o dialog fechar ou ao trocar `editingQuote?.id` (no mesmo effect já existente em 628–631 que zera `snapshotCapturedRef`).

Resultado: a remoção do último item passa a ser respeitada localmente até o usuário salvar (que já cuida de deletar do banco corretamente, linhas 905–909). Re-hidratação só acontece ao abrir o editor de uma cotação diferente.

## Escopo

- Apenas `src/pages/Quotes.tsx`. Sem migração, sem edge, sem triggers. Não toca a lógica de save/delete (linhas 905–975), que já está correta.
- Não muda o comportamento de draft do localStorage.
- Não toca `QuoteOptionsManager` nem a geração de tarefas de pós-venda da Etapa 6.

## Validação manual

1. Abrir cotação existente que tem 1 voo. Remover o voo. Confirmar que ele não reaparece.
2. Salvar. Reabrir. Confirmar que continua sem voo (delete persistido no banco).
3. Em outra cotação com 1 voo + 1 hotel, remover apenas o voo. Hotel deve permanecer. Salvar e reabrir.
4. Abrir cotação A (com voo), fechar sem salvar, abrir cotação B (com voo): B deve carregar seu próprio voo (hidratação dispara ao trocar de cotação).
