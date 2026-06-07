## Editor de campos com toggle "Dados técnicos"

Em vez de remover os campos avançados, vamos escondê-los por padrão e expor um **switch "Dados técnicos"** no topo da página. Quando desligado (padrão), a UI fica enxuta; quando ligado, mostra os controles de power-user.

### Toggle global

Novo controle no header da página (ao lado de "Aplicar modelo Altivus" / "Adicionar campo"):

```
[ ] Dados técnicos
```

Estado mantido em `useState` local (não persiste). Default: **desligado**.

### Campos sempre visíveis (modo simples)

- Rótulo
- Tipo
- Largura
- Obrigatório (switch)
- Botões mover ↑ ↓ / remover
- Textarea de Opções (quando tipo = select/checkbox)

### Campos visíveis só com "Dados técnicos" ON

- **Chave (key)** — input editável (com `slugify` no onChange, respeitando `mapsTo` que segue bloqueado)
- **Placeholder**
- **Grupo**

### Simplificação das opções de select/checkbox

Independente do toggle, o textarea de opções passa a aceitar **um rótulo por linha** (sem `valor|rótulo`):

```
direto
1 conexão
2 conexões
3 ou mais
```

O `value` é derivado automaticamente via `slugify(label)` + `ensureUniqueKey` para garantir unicidade dentro do mesmo campo. Opções salvas anteriormente são exibidas mostrando apenas o `label`.

### Auto-geração da key

Hoje a key só é recalculada quando começa com `novo_campo` ou bate exatamente com o slug do label anterior. Vamos manter essa lógica (não quebra campos já renomeados manualmente por usuários avançados) — o toggle simplesmente esconde o input.

### Arquivo afetado

- `src/pages/CategoryFieldsPage.tsx` — adiciona `showTechnical` state + switch no header, condiciona renderização dos 3 inputs avançados, ajusta textarea de opções.

Sem mudanças no schema do banco nem em outros arquivos.
