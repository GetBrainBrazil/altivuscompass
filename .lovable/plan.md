
O problema é de sincronização: o snapshot inicial é capturado antes dos items carregarem do banco.

**Causa raiz:**
- Effect de snapshot (linha 547) roda quando `dialogOpen` e `editingQuote?.id` mudam
- Effect de carregamento de items (linha 582) é async e demora
- Resultado: snapshot captura `items: []` mas depois os items carregam
- Na hora de fechar, há diferença → sempre mostra "descartar alterações"

**Solução:**
Modificar o effect de snapshot para só capturar quando os dados estiverem hidratados. Para cotações existentes, esperar que `items.length > 0` (ou draft ter sido restaurado). Adicionar `items.length` e `draftRestored` nas dependências do effect.

**Mudanças:**
1. Atualizar `src/pages/Quotes.tsx`:
   - No effect de snapshot (linhas 547-565), adicionar early return se for cotação existente sem items carregados
   - Adicionar `items.length` e `draftRestored` às dependências
   - Preservar comportamento para novas cotações (snapshot imediato vazio é OK)

**Arquivo:** `src/pages/Quotes.tsx` - effect de snapshot inicial (~10 linhas modificadas)
