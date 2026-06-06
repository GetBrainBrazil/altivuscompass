## Unificar Passageiros e Clientes Vinculados em uma única tabela

Atualmente a aba **Viajantes** mostra duas tabelas separadas: **Passageiros** (sem ficha) e **Clientes Vinculados** (com ficha própria). Vamos unificar em **uma só tabela** mantendo a distinção visual e funcional entre os dois tipos.

### Mudanças em `src/components/ClientTravelersTab.tsx`

1. **Header único** "Viajantes" com os 3 botões à direita: `Copiar de outro cliente`, `Vincular Cliente`, `Adicionar`.

2. **Tabela unificada** com as colunas:
   - **Nome** — nome + ícone `ExternalLink` (clicável) quando for cliente vinculado
   - **Tipo** — pill: `Cliente` (azul/primary) para vinculados; `Passageiro` (cinza/muted) para passageiros simples
   - **Vínculo** — relação (Cônjuge, Filho(a), etc.)
   - **CPF** — só passageiros têm; vinculados ficam `—` (ou poderemos buscar `cpf_cnpj` do cliente vinculado em iteração futura)
   - **Nascimento**
   - **Nacionalidade**
   - **Passaporte** — passageiros: `passport_number`; vinculados: `_passports` (válidos)
   - **Ações** — passageiros: Promover + Excluir; vinculados: Excluir vínculo

3. **Linha unificada**: clique abre o editor correto:
   - passageiro → `openPassengerForm(p)`
   - vinculado → diálogo `editRelDialog` existente

4. **Ordenação**: mesclar `passengers` + `relationships` em uma única lista normalizada com chaves comuns (`_kind`, `_name`, `_relType`, `_cpf`, `_birth`, `_nationality`, `_passport`) e usar `useSortableData` em cima dela. Tipo padrão de ordenação: primeiro `Cliente`, depois `Passageiro`, alfabético por nome.

5. **Estado vazio único**: "Nenhum viajante cadastrado."

6. Remover o `border-t` separador entre as duas seções (não existirão mais duas seções).

### O que NÃO muda
- Diálogos de criar/editar passageiro, vincular cliente, editar vínculo, promover, copiar de outro cliente — todos permanecem iguais.
- Mutations e queries permanecem iguais.
- Esquema do banco não muda.

### Verificação
- Conferir visualmente que os 3 botões aparecem no header da tabela única.
- Conferir pills `Cliente` vs `Passageiro` legíveis e distintos.
- Conferir que clicar em linha de cliente abre edição de vínculo e o ícone externo navega para a ficha.
- Conferir ordenação por cada coluna.
