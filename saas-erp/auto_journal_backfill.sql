-- ============================================================
-- Backfill: Create auto journal entries for all existing
-- financial_transactions that don't have one yet.
-- ============================================================
-- Run ONCE in Supabase SQL Editor after auto_journal_migration.sql
-- Safe to re-run — the WHERE NOT EXISTS guard prevents duplicates.
-- ============================================================

DO $$
DECLARE
  tx         RECORD;
  v_debit    UUID;
  v_credit   UUID;
  v_entry_id UUID;
  v_ref_no   TEXT;
  v_narr     TEXT;
  v_count    INT := 0;
BEGIN
  -- Loop over every financial_transaction that has no journal entry yet
  FOR tx IN
    SELECT ft.*
    FROM   financial_transactions ft
    WHERE  ft.category NOT ILIKE '%Adjustment (from Journal)%'
      AND  NOT EXISTS (
             SELECT 1 FROM journal_entries je
             WHERE je.source_transaction_id = ft.id
           )
    ORDER  BY ft.date, ft.created_at
  LOOP
    v_debit  := NULL;
    v_credit := NULL;

    -- ── Resolve accounts
    IF tx.type = 'income' THEN

      -- Debit: Bank if non-cash payment, else first asset account
      IF tx.payment_mode IN ('Bank Transfer', 'Cheque', 'Online') THEN
        SELECT id INTO v_debit
        FROM   accounts
        WHERE  school_id    = tx.school_id
          AND  account_type = 'asset'
          AND  name ILIKE '%bank%'
          AND  is_active    = TRUE
        ORDER BY code LIMIT 1;
      END IF;
      IF v_debit IS NULL THEN
        SELECT id INTO v_debit
        FROM   accounts
        WHERE  school_id    = tx.school_id
          AND  account_type = 'asset'
          AND  is_active    = TRUE
        ORDER BY code LIMIT 1;
      END IF;

      -- Credit: first income account
      SELECT id INTO v_credit
      FROM   accounts
      WHERE  school_id    = tx.school_id
        AND  account_type = 'income'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;

    ELSIF tx.type = 'expense' THEN

      -- Debit: first expense account
      SELECT id INTO v_debit
      FROM   accounts
      WHERE  school_id    = tx.school_id
        AND  account_type = 'expense'
        AND  is_active    = TRUE
      ORDER BY code LIMIT 1;

      -- Credit: Bank if non-cash, else first asset
      IF tx.payment_mode IN ('Bank Transfer', 'Cheque', 'Online') THEN
        SELECT id INTO v_credit
        FROM   accounts
        WHERE  school_id    = tx.school_id
          AND  account_type = 'asset'
          AND  name ILIKE '%bank%'
          AND  is_active    = TRUE
        ORDER BY code LIMIT 1;
      END IF;
      IF v_credit IS NULL THEN
        SELECT id INTO v_credit
        FROM   accounts
        WHERE  school_id    = tx.school_id
          AND  account_type = 'asset'
          AND  is_active    = TRUE
        ORDER BY code LIMIT 1;
      END IF;

    END IF;

    -- Skip if Chart of Accounts not set up for this school
    IF v_debit IS NULL OR v_credit IS NULL THEN
      CONTINUE;
    END IF;

    v_narr   := COALESCE(tx.remarks, tx.category, 'Auto Transaction');
    v_ref_no := 'AUTO-' || upper(substr(tx.id::text, 1, 8));

    -- Create journal entry
    INSERT INTO journal_entries (
      school_id, entry_date, reference_no, narration,
      status, is_auto, source_transaction_id
    ) VALUES (
      tx.school_id, tx.date, v_ref_no, v_narr,
      'posted', TRUE, tx.id
    ) RETURNING id INTO v_entry_id;

    -- Debit line
    INSERT INTO journal_lines (entry_id, account_id, description, debit, credit)
    VALUES (v_entry_id, v_debit,  v_narr, tx.amount::numeric, 0);

    -- Credit line
    INSERT INTO journal_lines (entry_id, account_id, description, debit, credit)
    VALUES (v_entry_id, v_credit, v_narr, 0, tx.amount::numeric);

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill complete — % journal entries created.', v_count;
END;
$$;
