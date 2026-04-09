

## Plano: Cadastro de Contas Pagas via WhatsApp (#pago)

### Fluxo da Conversa

```text
Você: #pago
IA: Olá, João! Vou ajudar a cadastrar a conta paga.
    Me envie a descrição, valor, fornecedor, e se tiver, 
    a foto ou PDF do boleto ou comprovante de pagamento. 
    Pode me enviar em várias mensagens.

Você: [envia foto do boleto]
IA: Li o boleto! Identifiquei:
    - Fornecedor: Vivo Telecomunicações
    - Valor: R$ 189,90
    - Vencimento: 15/04/2026
    Está correto? Falta algo?

Você: sim, paguei hoje
Você: [envia comprovante]
IA: Recebi o comprovante. Resumo final:
    - Descrição: Conta de internet
    - Valor: R$ 189,90
    - Fornecedor: Vivo Telecomunicações
    - Vencimento: 15/04/2026
    - Data pagamento: 09/04/2026
    - Anexos: boleto + comprovante
    - Categoria: Despesa
    - Status: Pago
    Confirma? (sim/não)

Você: sim
IA: Esta conta paga foi cadastrada com sucesso em Contas a Pagar!
```

O nome do usuário será obtido via Z-API (`get-profile-name` ou campo `senderName` do payload do webhook). Se não encontrar, usa apenas "Olá!".

### Alterações

#### 1. Migration SQL
- Criar tabela `whatsapp_sessions` (phone, state jsonb, status, expires_at)
- Criar bucket privado `financial-attachments`
- Adicionar coluna `attachment_urls text[]` em `financial_transactions`

#### 2. Edge Function `whatsapp-webhook` (nova)
- Recebe payload da Z-API (texto, imagem, documento)
- Extrai `senderName` do payload para personalizar a saudação
- Comando `#pago` inicia sessão
- Download de arquivos da Z-API e envio ao Gemini 2.5 Flash (multimodal) para OCR/extração de dados
- Busca mista de fornecedores/categorias/contas no banco
- Apresenta resumo e aguarda confirmação
- Insere em `financial_transactions` com status "paid" e anexos
- Mensagem final: "Esta conta paga foi cadastrada com sucesso em Contas a Pagar!"

#### 3. Leitura inteligente de documentos
- Imagens/PDFs enviados são processados pelo Gemini (multimodal) para extrair valor, fornecedor, vencimento, data de pagamento
- Dados extraídos são sugeridos para confirmação antes de salvar

#### 4. Campos vinculados (busca mista)
- Fornecedor: busca aproximada em `clients`/`suppliers`/`financial_parties`. Se encontrar, vincula. Se não, pergunta se salva como texto livre
- Categoria: busca em `financial_categories`, sugere com base no conteúdo
- Conta bancária: lista contas ativas, opcional

#### 5. Configuração Z-API
- Webhook de recebimento apontando para: `https://fuaaackbubqxkkdvbvpi.supabase.co/functions/v1/whatsapp-webhook`
- Você precisará configurar isso no painel da Z-API

