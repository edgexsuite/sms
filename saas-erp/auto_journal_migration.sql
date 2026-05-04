-- ============================================================
-- Migration: Auto-Journal from Financial Transactions
-- ============================================================
-- PURPOSE
--   Whenever a fee payment or expense is recorded in
--   `financial_transactions`, this trigger automatically
--   creates the matching double-entry in `journal_entries`
--   + `journal_lines` — so the Accounting module stays in
--   sync with the operational ledger with zero manual effort.
--
-- PREREQUISITE
--   Run this AFTER setting up at least a few accounts in
--   Chart of Accounts (cash + income + expense).
--   If no accounts exist the trigger silently skips (safe).
--
-- RUN ONCE in Supabase SQL Editor → SQL Editor → New Query.
-- Safe to re-run (IF NOT EXISTS / CREATE OR REPLACE guards).
-- ============================================================

-- 1. Extend journal_entries to track auto-created entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_auto BOOLEAN DEFAULT FALSE;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_transaction_id UUID
  REFERENCES financial_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_je_source_tx
  ON journal_entries(source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;

-- ============================================================
-- 2. Auto-journal trigger function
-- ============================================================
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
BEGIN
  -- ── Guard: skip entries that came from manual journal postings
  --    (category set by JournalEntry.tsx to 'Adjustment (from Journal)')
  --    This prevents an infinite trigger loop.
  IF NEW.category ILIKE '%Adjustment (from Journal)%' THEN
    RETURN NEW;
  END IF;

  -- ── Narration & reference
  v_narration := COALESCE(NEW.remarks, NEW.category, 'Auto Transaction');
  v_ref_no    := 'AUTO-' || upper(substr(NEW.id::text, 1, 8));

  -- ── Resolve accounts based on transaction type
  IF NEW.type = 'income' THEN

    -- DEBIT side → Cash in Hand (default) or Bank Account (non-cash modes)
    IF NEW.payment_mode IN ('Bank Transfer', 'Cheque', 'Online') THEN
      SELECT id INTO v_debit_acct
      FROM   accounts
      WHERE  school_id    = NEW.school_id
        AND  account_type = 'asset'
        AND  name ILIKE '%bank%'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;
    -- Fallback → first active asset account
    IF v_debit_acct IS NULL THEN
      SELECT id INTO v_debit_acct
      FROM   accounts
      WHERE  school_id    = NEW.school_id
        AND  account_type = 'asset'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;

    -- CREDIT side → first active income account
    SELECT id INTO v_credit_acct
    FROM   accounts
    WHERE  school_id    = NEW.school_id
      AND  account_type = 'income'
      AND  is_active    = TRUE
    ORDER BY code LIMIT 1;

  ELSIF NEW.type = 'expense' THEN

    -- DEBIT side → first active expense account
    SELECT id INTO v_debit_acct
    FROM   accounts
    WHERE  school_id    = NEW.school_id
      AND  account_type = 'expense'
      AND  is_active    = TRUE
    ORDER BY code LIMIT 1;

    -- CREDIT side → Bank (non-cash) or Cash (default)
    IF NEW.payment_mode IN ('Bank Transfer', 'Cheque', 'Online') THEN
      SELECT id INTO v_credit_acct
      FROM   accounts
      WHERE  school_id    = NEW.school_id
        AND  account_type = 'asset'
        AND  name ILIKE '%bank%'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;
    IF v_credit_acct IS NULL THEN
      SELECT id INTO v_credit_acct
      FROM   accounts
      WHERE  school_id    = NEW.school_id
        AND  account_type = 'asset'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;
    END IF;

  ELSE
    RETURN NEW; -- unknown type — skip
  END IF;

  -- ── Graceful degradation: if Chart of Accounts not set up, skip silently
  IF v_debit_acct IS NULL OR v_credit_acct IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Create the journal entry header
  INSERT INTO journal_entries (
    school_id,
    entry_date,
    reference_no,
    narration,
    status,
    is_auto,
    source_transaction_id
  ) VALUES (
    NEW.school_id,
    NEW.date,
    v_ref_no,
    v_narration,
    'posted',
    TRUE,
    NEW.id
  ) RETURNING id INTO v_entry_id;

  -- ── Debit line
  INSERT INTO journal_lines (entry_id, account_id, description, debit, credit)
  VALUES (v_entry_id, v_debit_acct,  v_narration, NEW.amount::numeric, 0);

  -- ── Credit line
  INSERT INTO journal_lines (entry_id, account_id, description, debit, credit)
  VALUES (v_entry_id, v_credit_acct, v_narration, 0, NEW.amount::numeric);

  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Attach the trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_auto_journal_from_transaction ON financial_transactions;
CREATE TRIGGER trg_auto_journal_from_transaction
  AFTER INSERT ON financial_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_journal_from_transaction();

-- ============================================================
-- Done. Verify with:
--
-- SELECT je.entry_date, je.reference_no, je.narration,
--        je.is_auto, jl.debit, jl.credit, a.name AS account
-- FROM   journal_entries je
-- JOIN   journal_lines   jl ON jl.entry_id = je.id
-- JOIN   accounts        a  ON a.id = jl.account_id
-- WHERE  je.is_auto = TRUE
-- ORDER  BY je.entry_date DESC
-- LIMIT  20;
-- ============================================================
