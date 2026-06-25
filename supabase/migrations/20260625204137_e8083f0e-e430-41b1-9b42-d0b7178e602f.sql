
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_by uuid,
  ADD COLUMN IF NOT EXISTS payment_proof_indexes integer[] DEFAULT '{}'::integer[];

CREATE OR REPLACE FUNCTION public.trg_fn_financial_tx_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_confirmed_statuses text[] := ARRAY['paid','received'];
BEGIN
  -- 1) Confirmação exige conta bancária + payment_date
  IF NEW.status = ANY(v_confirmed_statuses) THEN
    IF NEW.bank_account_id IS NULL THEN
      RAISE EXCEPTION 'Conta bancária é obrigatória para confirmar pagamento/recebimento.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.payment_date IS NULL THEN
      NEW.payment_date := CURRENT_DATE;
    END IF;
  END IF;

  -- 2) Conciliação só em transações confirmadas
  IF NEW.is_reconciled = true AND NOT (NEW.status = ANY(v_confirmed_statuses)) THEN
    RAISE EXCEPTION 'Só é possível conciliar transações já confirmadas (pago/recebido).'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3) Se passou para is_reconciled true agora, registra metadados
  IF NEW.is_reconciled = true AND (TG_OP = 'INSERT' OR COALESCE(OLD.is_reconciled, false) = false) THEN
    NEW.reconciled_at := COALESCE(NEW.reconciled_at, now());
    NEW.reconciled_by := COALESCE(NEW.reconciled_by, auth.uid());
  END IF;

  -- 4) Reabertura: voltou para pendente/cancelled → desconcilia
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = ANY(v_confirmed_statuses)
       AND NOT (NEW.status = ANY(v_confirmed_statuses)) THEN
      NEW.is_reconciled := false;
      NEW.reconciled_at := NULL;
      NEW.reconciled_by := NULL;
    END IF;

    -- 5) Mudou conta bancária ou valor base de uma transação já conciliada → desconcilia
    IF COALESCE(OLD.is_reconciled, false) = true
       AND NEW.is_reconciled = true
       AND (
            COALESCE(NEW.bank_account_id::text,'') IS DISTINCT FROM COALESCE(OLD.bank_account_id::text,'')
         OR COALESCE(NEW.amount, 0) IS DISTINCT FROM COALESCE(OLD.amount, 0)
         OR COALESCE(NEW.base_amount, 0) IS DISTINCT FROM COALESCE(OLD.base_amount, 0)
       ) THEN
      NEW.is_reconciled := false;
      NEW.reconciled_at := NULL;
      NEW.reconciled_by := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_tx_validate ON public.financial_transactions;
CREATE TRIGGER trg_financial_tx_validate
  BEFORE INSERT OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_financial_tx_validate();
