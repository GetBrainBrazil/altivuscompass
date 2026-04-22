

## Alinhar "Anexar arquivo" com o input de Link externo

**Arquivo:** `src/components/quotes/QuoteItemAttachments.tsx`

### Problema
Hoje o bloco "Referências e anexos" usa um grid de 2 colunas onde cada coluna tem seu próprio `<Label>` empilhado acima do controle. Isso faz o botão "Anexar arquivo" aparecer com o label "Anexos" em cima e desalinhado do input de "Link externo" ao lado.

### Solução
Reorganizar em uma única linha flex onde:
- O label "Link externo" fica acima do input (como hoje) ocupando toda a largura disponível.
- O botão "Anexar arquivo" fica posicionado **na mesma linha horizontal do input** (não dos labels), alinhado ao final.
- Remover o label "Anexos" redundante — o ícone de clipe + texto do botão já comunicam a função.

### Estrutura nova (JSX)

```text
<div className="space-y-2">
  <Label> Referências e anexos </Label>

  <div className="space-y-1">
    <Label className="text-[11px]"> Link externo </Label>

    <div className="flex items-center gap-2">
      <Input ... className="h-9 flex-1" />               ← cresce
      {externalUrl && <Button ExternalLink />}            ← abrir link
      <Button "Anexar arquivo" className="h-9 shrink-0"/> ← MESMA altura/linha do input
    </div>
  </div>

  {/* lista de anexos abaixo, inalterada */}
</div>
```

### Detalhes técnicos
- Trocar `grid grid-cols-1 lg:grid-cols-[1fr_auto]` por um único bloco flex.
- Padronizar altura do input e do botão em `h-9` (em vez de `h-8`) para alinhamento visual perfeito.
- Manter o `<input type="file" hidden>` e toda a lógica de upload/remoção/abertura intacta — apenas reposicionamento de classes Tailwind.
- O `TooltipProvider` em torno do botão permanece (mensagem "Salve a cotação primeiro" continua funcionando).
- No mobile (`< sm`), o botão pode quebrar para baixo do input mantendo `flex-wrap` para evitar scroll horizontal (alinhado com a política Zero Scroll Horizontal).

Nenhuma função, prop ou comportamento muda — apenas o layout das classes Tailwind.

