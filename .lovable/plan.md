
## Avaliação honesta

O Claude tem razão na ressalva: **testes de integração mockando Supabase são frágeis**. Mas a maior parte do prompt é sobre **extrair funções puras + testá-las**, o que é genuinamente valioso. O problema é que ele é AMBICIOSO demais para um único prompt:

- `Quotes.tsx` tem **2.617 linhas**. Extrair 7 grupos de funções ao mesmo tempo = risco real de quebrar coisa.
- Várias funções listadas (`autoFixRecommendedOption`, `buildAcceptancePayload`, `getDeadlineTone`, `filterQuotes`, etc.) podem nem existir como função nomeada — estão inline no JSX. Extrair vira reescrever.
- Cobertura proposta é boa (resumo, validade, filtros, validadores), mas misturar tudo num prompt = risco de regressão silenciosa.

## Vale a pena? Sim, mas em fases

Recomendo **dividir em 3 prompts menores**, do mais seguro pro mais arriscado:

### Fase 1 — Quick wins (BAIXO RISCO, ALTO VALOR)
Funções que **já existem isoladas** ou são triviais de extrair:
- `quote-summary.ts` já existe — só escrever testes (8 casos do Claude).
- Criar `validators.ts` (email/CPF/phone) — funções novas, não extrai nada.
- Criar `quote-status.ts` com `getDeadlineTone`, `getAgeTone`, `getValidityBadge` — funções pequenas, fáceis de espelhar a lógica inline sem mexer no Quotes.tsx (deixa a inline lá, testa a versão extraída como "fonte da verdade" futura).
- Setup de fixtures + mock do Supabase.

Resultado: ~25 testes passando, zero risco de quebrar UI.

### Fase 2 — Extração de filtros/sort (MÉDIO RISCO)
- `quote-filters.ts` (`filterQuotes`, `sortQuotes`) — extração mecânica do que está inline no Quotes.tsx, com substituição da inline por import.
- Testes correspondentes.

Por que separar: aqui SIM mexe no Quotes.tsx. Isolar o blast radius.

### Fase 3 — Pular ou adiar (ALTO RISCO, BAIXO ROI)
- **`duplicateQuote` mockado**: o Claude mesmo avisa que mock de Supabase é frágil. Para um fluxo crítico desses, **teste manual com checklist** vale mais que mock.
- **`buildAcceptancePayload`**: a validação real está espalhada entre o form do `PublicQuote.tsx` e a edge function `accept-quote`. Extrair "só o pedaço de validação" é artificial — o teste vai cobrir uma função que ninguém chama em produção.
- **`autoFixRecommendedOption`**: precisaria localizar primeiro se essa lógica existe; pelos prompts anteriores, options são manuais.

Recomendo **pular esses três** ou só fazer se houver bug real.

## O que NÃO fazer do prompt original

- Não criar `test:coverage` agora — overkill, ninguém vai olhar.
- Não criar `src/test/mocks/supabase.ts` se não vai usar (Fase 3 caindo fora).
- Não tentar testar `Quotes.tsx` montado.

## Minha recomendação

**Roda só a Fase 1 agora.** É ~70% do valor com ~10% do risco. Se gostar do ritmo, faz a Fase 2 depois. A Fase 3 só se aparecer bug específico que justifique.

## Próximo passo

Posso preparar o **prompt da Fase 1** já formatado pra você colar (estilo dos prompts anteriores), cobrindo:
1. Setup: `setup.ts` atualizado, `fixtures/quote.ts`
2. Testes de `quote-summary.ts` (já existe — 7 casos)
3. Criar + testar `validators.ts`
4. Criar + testar `quote-status.ts` (sem mexer no Quotes.tsx ainda; integração inline vira tarefa da Fase 2)

Confirma que quer Fase 1 e eu escrevo o prompt enxuto pronto pra colar.
