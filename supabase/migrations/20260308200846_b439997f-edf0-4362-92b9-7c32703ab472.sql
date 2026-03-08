
-- Insert chart of accounts based on the reference image
-- Level 1: Categories (RECEITAS, DESPESAS, IMPOSTOS, RETIRADA, TRANSFERÊNCIAS)
-- Level 2: Subcategories
-- Level 3: Accounts

DO $$
DECLARE
  -- Level 1 IDs
  id_receitas uuid := gen_random_uuid();
  id_despesas uuid := gen_random_uuid();
  id_impostos uuid := gen_random_uuid();
  id_retirada uuid := gen_random_uuid();
  id_transferencias uuid := gen_random_uuid();
  -- Level 2 IDs
  id_rec_vendas uuid := gen_random_uuid();
  id_rec_financeiras uuid := gen_random_uuid();
  id_desp_vendas uuid := gen_random_uuid();
  id_desp_admin uuid := gen_random_uuid();
  id_desp_educacao uuid := gen_random_uuid();
  id_desp_saas uuid := gen_random_uuid();
  id_desp_salarios uuid := gen_random_uuid();
  id_desp_taxas uuid := gen_random_uuid();
  id_desp_marketing uuid := gen_random_uuid();
  id_desp_eventos uuid := gen_random_uuid();
  id_imp_impostos uuid := gen_random_uuid();
  id_ret_retirada uuid := gen_random_uuid();
  id_trans_transferencia uuid := gen_random_uuid();
BEGIN
  -- Level 1
  INSERT INTO public.financial_categories (id, name, code, type, parent_id) VALUES
    (id_receitas, 'Receitas', '1', 'revenue', NULL),
    (id_despesas, 'Despesas', '2', 'expense', NULL),
    (id_impostos, 'Impostos', '3', 'cost', NULL),
    (id_retirada, 'Retirada', '4', 'expense', NULL),
    (id_transferencias, 'Transferências', '5', 'transfer', NULL);

  -- Level 2
  INSERT INTO public.financial_categories (id, name, code, type, parent_id) VALUES
    (id_rec_vendas, 'Vendas', '1.1', 'revenue', id_receitas),
    (id_rec_financeiras, 'Financeiras', '1.2', 'revenue', id_receitas),
    (id_desp_vendas, 'Vendas', '2.1', 'expense', id_despesas),
    (id_desp_admin, 'Administrativo', '2.2', 'expense', id_despesas),
    (id_desp_educacao, 'Educação', '2.3', 'expense', id_despesas),
    (id_desp_saas, 'SAAS', '2.4', 'expense', id_despesas),
    (id_desp_salarios, 'Salários', '2.5', 'expense', id_despesas),
    (id_desp_taxas, 'Taxas', '2.6', 'expense', id_despesas),
    (id_desp_marketing, 'Marketing', '2.7', 'expense', id_despesas),
    (id_desp_eventos, 'Eventos', '2.8', 'expense', id_despesas),
    (id_imp_impostos, 'Impostos', '3.1', 'cost', id_impostos),
    (id_ret_retirada, 'Retirada', '4.1', 'expense', id_retirada),
    (id_trans_transferencia, 'Transferência', '5.1', 'transfer', id_transferencias);

  -- Level 3 (Contas)
  INSERT INTO public.financial_categories (name, code, type, parent_id) VALUES
    ('Passagens', '1.1.01', 'revenue', id_rec_vendas),
    ('Hospedagens', '1.1.02', 'revenue', id_rec_vendas),
    ('Seguros', '1.1.03', 'revenue', id_rec_vendas),
    ('Câmbio', '1.1.04', 'revenue', id_rec_vendas),
    ('Investimentos', '1.2.01', 'revenue', id_rec_financeiras),
    ('Repasse Comissão', '2.1.01', 'expense', id_desp_vendas),
    ('Custo Operacional', '2.2.01', 'expense', id_desp_admin),
    ('Contabilidade', '2.2.02', 'expense', id_desp_admin),
    ('Manutenção Web', '2.2.03', 'expense', id_desp_admin),
    ('Certificações', '2.2.04', 'expense', id_desp_admin),
    ('Cursos', '2.3.01', 'expense', id_desp_educacao),
    ('Sistemas', '2.4.01', 'expense', id_desp_saas),
    ('Desenvolvedores', '2.5.01', 'expense', id_desp_salarios),
    ('Taxas', '2.6.01', 'expense', id_desp_taxas),
    ('Mídias Sociais', '2.7.01', 'expense', id_desp_marketing),
    ('Grupos Networking', '2.8.01', 'expense', id_desp_eventos),
    ('Impostos', '3.1.01', 'cost', id_imp_impostos),
    ('Retirada Sócios', '4.1.01', 'expense', id_ret_retirada),
    ('Transferência', '5.1.01', 'transfer', id_trans_transferencia);
END $$;
