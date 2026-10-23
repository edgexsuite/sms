-- ============================================================
-- Migration: Enhanced Auto-Journal Synchronization
-- ============================================================
-- PURPOSE
--   Keeps the Chart of Accounts and General Ledger 100% in
--   sync with operational cash flows (Fee payments, Daily Expenses,
--   Payroll disbursements) across INSERT, UPDATE, and DELETE/Soft-delete.
--
-- IMPROVEMENTS:
--   1. Handles UPDATE and DELETE triggers (previously only INSERT was handled).
--   2. Voids / deletes matching journal entry if transaction is soft-deleted (is_deleted = true).
--   3. Matches expense/income category by account name before falling back to default.
--   4. Supports Payroll category mapping directly to Salary/Payroll expense accounts.
-- ============================================================

-- Ensure columns exist
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT FALSE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_transaction_id UUID
  REFERENCES financial_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_je_source_tx
  ON journal_entries(source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;

-- Trigger Function
CREATE OR REPLACE FUNCTION fn_auto_journal_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debit_acct  UUID;
  v_credit_acct UUID;
  v_entry_id    UUID;
  v_ref_no      TEXT;
  v_narration   TEXT;
  v_tx          RECORD;
BEGIN
  -- ── Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE source_transaction_id = OLD.id;
    RETURN OLD;
  END IF;

  v_tx := NEW;

  -- ── Handle Soft Delete
  IF v_tx.is_deleted = TRUE THEN
    DELETE FROM journal_entries WHERE source_transaction_id = v_tx.id;
    RETURN NEW;
  END IF;

  -- ── Guard: Skip entries created by manual adjustment from Journal to avoid infinite loops
  IF v_tx.category ILIKE '%Adjustment (from Journal)%' THEN
    RETURN NEW;
  END IF;

  -- ── If UPDATE, clean existing auto-entry before recreating with updated values
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries WHERE source_transaction_id = v_tx.id;
  END IF;

  -- ── Narration & Reference
  v_narration := COALESCE(v_tx.remarks, v_tx.category, 'Auto Transaction');
  v_ref_no    := 'AUTO-' || upper(substr(v_tx.id::text, 1, 8));

  -- ── Resolve accounts based on transaction type
  IF v_tx.type = 'income' THEN

    -- DEBIT side → Bank (for non-cash modes) or Cash in Hand
    IF v_tx.payment_mode IN ('Bank Transfer', 'Cheque', 'Online') THEN
      SELECT id INTO v_debit_acct
      FROM   accounts
      WHERE  school_id    = v_tx.school_id
        AND  account_type = 'asset'
        AND  name ILIKE '%bank%'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;

    IF v_debit_acct IS NULL THEN
      SELECT id INTO v_debit_acct
      FROM   accounts
      WHERE  school_id    = v_tx.school_id
        AND  account_type = 'asset'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;

    -- CREDIT side → Specific matching income account, else fallback
    SELECT id INTO v_credit_acct
    FROM   accounts
    WHERE  school_id    = v_tx.school_id
      AND  account_type = 'income'
      AND  is_active    = TRUE
      AND  (name ILIKE '%' || v_tx.category || '%' OR code = v_tx.category)
    ORDER BY code LIMIT 1;

    IF v_credit_acct IS NULL THEN
      SELECT id INTO v_credit_acct
      FROM   accounts
      WHERE  school_id    = v_tx.school_id
        AND  account_type = 'income'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;

  ELSIF v_tx.type = 'expense' THEN

    -- DEBIT side → Specific matching expense account (e.g. Payroll -> Salary Expense)
    SELECT id INTO v_debit_acct
    FROM   accounts
    WHERE  school_id    = v_tx.school_id
      AND  account_type = 'expense'
      AND  is_active    = TRUE
      AND  (
        name ILIKE '%' || v_tx.category || '%' 
        OR (v_tx.category ILIKE '%payroll%' AND name ILIKE '%salar%')
        OR code = v_tx.category
      )
    ORDER BY code LIMIT 1;

    IF v_debit_acct IS NULL THEN
      SELECT id INTO v_debit_acct
      FROM   accounts
      WHERE  school_id    = v_tx.school_id
        AND  account_type = 'expense'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;

    -- CREDIT side → Bank (non-cash) or Cash
    IF v_tx.payment_mode IN ('Bank Transfer', 'Cheque', 'Online') THEN
      SELECT id INTO v_credit_acct
      FROM   accounts
      WHERE  school_id    = v_tx.school_id
        AND  account_type = 'asset'
        AND  name ILIKE '%bank%'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;

    IF v_credit_acct IS NULL THEN
      SELECT id INTO v_credit_acct
      FROM   accounts
      WHERE  school_id    = v_tx.school_id
        AND  account_type = 'asset'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;

  ELSE
    RETURN NEW;
  END IF;

  -- ── If Chart of Accounts is not set up for this school, skip gracefully
  IF v_debit_acct IS NULL OR v_credit_acct IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Insert Journal Entry Header
  INSERT INTO journal_entries (
    school_id,
    entry_date,
    reference_no,
    narration,
    status,
    is_auto,
    source_transaction_id
  ) VALUES (
    v_tx.school_id,
    v_tx.date,
    v_ref_no,
    v_narration,
    'posted',
    TRUE,
    v_tx.id
  ) RETURNING id INTO v_entry_id;

  -- ── Debit Line
  INSERT INTO journal_lines (entry_id, account_id, description, debit, credit)
  VALUES (v_entry_id, v_debit_acct, v_narration, v_tx.amount::numeric, 0);

  -- ── Credit Line
  INSERT INTO journal_lines (entry_id, account_id, description, debit, credit)
  VALUES (v_entry_id, v_credit_acct, v_narration, 0, v_tx.amount::numeric);

  RETURN NEW;
END;
$$;

-- ── Re-attach trigger on INSERT, UPDATE, DELETE
DROP TRIGGER IF EXISTS trg_auto_journal_from_transaction ON financial_transactions;
CREATE TRIGGER trg_auto_journal_from_transaction
  AFTER INSERT OR UPDATE OR DELETE ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_journal_from_transaction();
