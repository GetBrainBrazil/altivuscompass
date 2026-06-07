## Objetivo

Unificar a edição da Categoria de Produto numa única tela (dados básicos + camadas/campos), abrir essa tela ao clicar na linha da tabela, e mover o botão **Excluir** para dentro dela — bloqueando a exclusão quando houver produtos vinculados.

## Mudanças

### 1. `src/pages/CategoryFieldsPage.tsx` (página unificada)
- Adicionar bloco "Dados da categoria" no topo: inputs **Nome** (obrigatório), **Descrição** (textarea) e switch **Ativa**.
- Estado `meta` inicializado a partir da categoria carregada.
- `saveMutation` passa a salvar `name`, `description`, `is_active` e `field_schema` no mesmo update (com audit log).
- **Suporte a criação**: quando `id === "new"`, mostra a mesma tela vazia; ao salvar pela 1ª vez faz `insert` e redireciona para `/registrations/categories/{novo-id}/fields`.
- **Botão Excluir** no rodapé (lado esquerdo, ao lado do Salvar):
  - Faz `SELECT count` em `products` por `category_id` ao carregar.
  - Se `productCount > 0`: botão desabilitado, com tooltip e legenda *"Para excluir, remova ou troque a categoria dos N produto(s) vinculados."*
  - Se `productCount === 0`: abre `AlertDialog` de confirmação e exclui; após sucesso, navega de volta para `/registrations`.
  - Em modo "novo", o botão não aparece.

### 2. `src/components/ProductsTab.tsx` (CategoriesSubTab)
- Tornar a `TableRow` clicável (`cursor-pointer`, hover, `onClick` → `/registrations/categories/${c.id}/fields`).
- Remover a coluna **Ações** inteira (botões editar ✏️ e excluir 🗑️ e Dialog inline). Edição e exclusão acontecem somente na página dedicada.
- Manter o contador de campos visível em uma coluna própria (ícone Layers + número), exibido na linha.
- Botão **+ Categoria** passa a navegar para `/registrations/categories/new/fields` em vez de abrir Dialog.
- Remover `saveMutation`, `deleteMutation`, `dialogOpen`, `editing`, `form` e o `<Dialog>` inteiro do componente.

### 3. Rota
- `src/App.tsx`: rota `/registrations/categories/:id/fields` já é dinâmica; o componente trata `id === "new"`. Nenhuma alteração de rota necessária.

## Sem mudanças
- Schema do banco, RLS, audit, demais módulos.
- Aba Produtos da `ProductsTab`.
