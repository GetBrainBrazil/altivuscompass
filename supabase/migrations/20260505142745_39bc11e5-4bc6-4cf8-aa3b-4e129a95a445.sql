
-- Category enum
DO $$ BEGIN
  CREATE TYPE public.changelog_category AS ENUM ('nova_funcionalidade', 'melhoria', 'correcao', 'remocao');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.platform_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text,
  date timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  description text NOT NULL,
  category public.changelog_category NOT NULL DEFAULT 'melhoria',
  module text NOT NULL DEFAULT 'Geral',
  created_by text DEFAULT 'Equipe Altivus',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view changelog"
  ON public.platform_changelog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert changelog"
  ON public.platform_changelog FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update changelog"
  ON public.platform_changelog FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete changelog"
  ON public.platform_changelog FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_platform_changelog_updated_at
  BEFORE UPDATE ON public.platform_changelog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_platform_changelog_date ON public.platform_changelog (date DESC);

-- Seed
INSERT INTO public.platform_changelog (date, title, description, category, module) VALUES
('2026-05-05', 'Arquivados como filtro no CRM', 'O accordion de arquivados no rodapé do Kanban foi substituído por um filtro de Status na barra de filtros. Agora é possível filtrar por Ativos, Arquivados, Concluídos ou Todos, combinando com outros filtros.', 'melhoria', 'CRM'),
('2026-05-05', 'Configurações do funil via engrenagem', 'O botão ''Automação'' foi removido das tabs do CRM e substituído por um ícone de engrenagem ao lado do título, separando configurações de navegação.', 'melhoria', 'CRM'),
('2026-05-05', 'Renomeação: Operações em Viagem → Pós-Venda', 'O segundo funil foi renomeado para ''Pós-Venda'' por ser um termo mais abrangente. A Altivus não trabalha apenas com viagens — pode ser aluguel de carro, hotel avulso ou seguro viagem.', 'melhoria', 'CRM'),
('2026-05-05', 'Etapa ''Fechado'' renomeada para ''Concluído''', 'A última etapa do Funil de Vendas foi renomeada de ''Fechado'' para ''Concluído''. Cards nesta etapa agora têm destaque visual em verde. O termo anterior era ambíguo e podia sugerir que o cliente desistiu.', 'melhoria', 'CRM'),
('2026-05-05', 'Persistência de cards em Concluído', 'Cards movidos para ''Concluído'' agora permanecem no Funil de Vendas como registro histórico, além de serem enviados ao Pós-Venda. Antes, desapareciam do funil original.', 'correcao', 'CRM'),
('2026-05-05', 'Filtros persistentes por usuário', 'Os filtros selecionados no CRM agora são salvos por usuário no backend. Ao sair e voltar para o CRM, ou ao trocar de módulo, os filtros permanecem. Cada usuário tem suas próprias preferências independentes.', 'nova_funcionalidade', 'CRM'),
('2026-05-05', 'Validação no formulário de Novo Lead', 'Adicionada máscara de telefone com seletor de DDI, validação de e-mail em tempo real e campo de observações expandido. Impede o cadastro de dados inválidos no CRM.', 'nova_funcionalidade', 'CRM'),
('2026-05-05', 'Cards perdidos redesenhados', 'Cards marcados como ''Perdido'' agora exibem um badge compacto com borda lateral vermelha e tooltip com o motivo. Antes, o texto do motivo aumentava o tamanho do card e quebrava o alinhamento.', 'melhoria', 'CRM'),
('2026-05-05', 'Etapas vazias visíveis no Pós-Venda', 'Colunas do Kanban no Pós-Venda agora aparecem mesmo quando estão vazias, permitindo drag-and-drop e mostrando a estrutura completa do funil.', 'correcao', 'CRM'),
('2026-05-06', 'Reestruturação completa dos Agentes IA', 'A página de configuração do agente foi reorganizada em 8 seções: Identidade, Fluxos de Atendimento, Comunicação, Coleta de Dados, Regras e Limites, Integrações, Métricas e Testar Agente. Antes era apenas campos de texto livre.', 'nova_funcionalidade', 'Agentes IA'),
('2026-05-06', 'Fluxos de atendimento configuráveis', 'Agora é possível configurar 3 fluxos distintos para o agente IA: Nova Cotação, Suporte/Problema e Prospect Indeciso. Cada fluxo tem perguntas obrigatórias, prioridade, ação de conclusão e mensagens personalizáveis.', 'nova_funcionalidade', 'Agentes IA'),
('2026-05-06', 'Simulador de teste do agente IA', 'Adicionado chat simulador com debug em tempo real para validar o comportamento do agente antes de colocar em produção. Mostra fluxo detectado, dados coletados, regras aplicadas e sentimento do cliente.', 'nova_funcionalidade', 'Agentes IA'),
('2026-05-06', 'Avatar do agente via Z-API', 'O agente agora pode usar a foto de perfil do WhatsApp conectado como avatar, buscada automaticamente via Z-API.', 'nova_funcionalidade', 'Agentes IA'),
('2026-05-06', 'Botão de ativação/desativação do agente', 'O toggle de status agora é um controle operacional real que ativa ou desativa a IA no WhatsApp instantaneamente, com diálogo de confirmação e feedback visual.', 'nova_funcionalidade', 'Agentes IA'),
('2026-05-06', 'Handoff configurável com roteamento por fluxo', 'Adicionada configuração de equipe para handoff com seleção de membros por fluxo de atendimento, método de distribuição (round-robin ou todos recebem) e template de mensagem de notificação.', 'nova_funcionalidade', 'Agentes IA'),
('2026-05-06', 'Métricas do agente com dados reais', 'A seção de métricas agora se conecta aos dados reais do webhook Z-API, mostrando total de conversas, taxa de resolução, tempo médio e leads gerados. Inclui tabela de últimas conversas com paginação.', 'nova_funcionalidade', 'Agentes IA'),
('2026-05-06', 'Conexão WhatsApp movida para sidebar', 'A página de Conexão WhatsApp foi integrada como aba na sidebar de Agentes IA em vez de ser um botão separado no header, com indicador de status de conexão.', 'melhoria', 'Agentes IA'),
('2026-05-06', 'Notas de atualização da plataforma', 'Adicionado changelog na área de Configurações para registrar todas as mudanças, melhorias e correções feitas na plataforma.', 'nova_funcionalidade', 'Geral');
