/**
 * export_fee_snapshot.ts
 * Exports a full pre-fix snapshot of:
 *  - fee_records (all, including soft-deleted)
 *  - students (id, full_name, status, is_deleted)
 *  - financial_transactions (fee-related)
 * Writes three CSV files + one summary JSON to scratch/exports/
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE key in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const OUT_DIR = path.resolve(__dirname, 'exports');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

/* ── CSV helper ──────────────────────────────────────────────────────────── */
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

/* ── Paginated fetch helper ──────────────────────────────────────────────── */
async function fetchAll<T = Record<string, unknown>>(
  table: string,
  select: string,
  filters: Record<string, string> = {},
  pageSize = 1000
): Promise<T[]> {
  let all: T[] = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    for (const [col, val] of Object.entries(filters)) {
      q = (q as any).eq(col, val);
    }
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main() {
  console.log('=== PRE-FIX FEE DATA EXPORT ===');
  console.log(`Timestamp : ${new Date().toISOString()}`);
  console.log(`Output dir: ${OUT_DIR}\n`);

  const { data: schools } = await supabase.from('schools').select('id, name');
  console.log(`Found ${schools?.length ?? 0} school(s).`);

  const summary: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    schools: [],
  };

  const allFeeRecords: Record<string, unknown>[] = [];
  const allStudents: Record<string, unknown>[] = [];
  const allTransactions: Record<string, unknown>[] = [];

  for (const school of schools ?? []) {
    console.log(`\n→ School: ${school.name} (${school.id})`);

    const feeRows = await fetchAll(
      'fee_records',
      'id, school_id, student_id, student_name, invoice_number, month_year, total_amount, paid_amount, discount_amount, status, payment_mode, due_date, paid_at, remarks, breakdown, created_at, deleted_at',
      { school_id: school.id }
    );
    console.log(`  fee_records    : ${feeRows.length} rows`);
    allFeeRecords.push(...feeRows);

    const stuRows = await fetchAll(
      'students',
      'id, school_id, full_name, roll_number, class_id, status, is_deleted, fee_waiver_percentage, created_at',
      { school_id: school.id }
    );
    console.log(`  students       : ${stuRows.length} rows`);
    allStudents.push(...stuRows);

    const txRows = await fetchAll(
      'financial_transactions',
      'id, school_id, fee_record_id, category, amount, date, payment_mode, remarks, fee_items, created_at',
      { school_id: school.id }
    );
    const feeTx = txRows.filter((t: any) => t.category === 'Fee Collection');
    console.log(`  fee_transactions: ${feeTx.length} rows`);
    allTransactions.push(...feeTx);

    const active  = feeRows.filter((r: any) => !r.deleted_at);
    const deleted = feeRows.filter((r: any) =>  r.deleted_at);
    const byStatus: Record<string, number> = {};
    active.forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

    (summary.schools as any[]).push({
      school_id   : school.id,
      school_name : school.name,
      total_fee_records    : feeRows.length,
      active_fee_records   : active.length,
      soft_deleted_records : deleted.length,
      status_breakdown     : byStatus,
      total_students       : stuRows.length,
      fee_transactions     : feeTx.length,
    });
  }

  const feeFile = path.join(OUT_DIR, `fee_records_${ts}.csv`);
  fs.writeFileSync(feeFile, toCsv(allFeeRecords));
  console.log(`\n✅  fee_records  → ${feeFile} (${allFeeRecords.length} rows)`);

  const stuFile = path.join(OUT_DIR, `students_${ts}.csv`);
  fs.writeFileSync(stuFile, toCsv(allStudents));
  console.log(`✅  students     → ${stuFile} (${allStudents.length} rows)`);

  const txFile = path.join(OUT_DIR, `fee_transactions_${ts}.csv`);
  fs.writeFileSync(txFile, toCsv(allTransactions));
  console.log(`✅  transactions → ${txFile} (${allTransactions.length} rows)`);

  const sumFile = path.join(OUT_DIR, `snapshot_summary_${ts}.json`);
  fs.writeFileSync(sumFile, JSON.stringify(summary, null, 2));
  console.log(`✅  summary      → ${sumFile}`);

  console.log('\n=== SNAPSHOT SUMMARY ===');
  for (const s of summary.schools as any[]) {
    console.log(`\nSchool           : ${s.school_name}`);
    console.log(`Total records    : ${s.total_fee_records}`);
    console.log(`Active records   : ${s.active_fee_records}`);
    console.log(`Soft-deleted     : ${s.soft_deleted_records}`);
    console.log('Status breakdown :', s.status_breakdown);
    console.log(`Total students   : ${s.total_students}`);
    console.log(`Fee transactions : ${s.fee_transactions}`);
  }

  console.log('\n=== EXPORT COMPLETE — safe to proceed with fixes ===');
}

main().catch(e => { console.error(e); process.exit(1); });
