import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let supabaseUrl = process.env.VITE_SUPABASE_URL;
let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

try {
  const envText = fs.readFileSync('../superadmin/.env', 'utf8');
  const u = envText.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
  const k = envText.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim().replace(/['"]/g, '');
  if (u && k) { supabaseUrl = u; supabaseKey = k; }
} catch (e) {}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTB() {
  const sid = 'aed24dc2-c3ac-47a1-9287-3b003934f720';
  const asOf = new Date().toISOString().split('T')[0];

  // 1. Fetch all accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, account_type')
    .eq('school_id', sid)
    .order('code');

  // 2. Fetch journal lines up to asOf
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id, entry_date, journal_lines(account_id, debit, credit)')
    .eq('school_id', sid)
    .lte('entry_date', asOf);

  console.log(`Found ${accounts?.length} accounts and ${entries?.length} journal entries.`);

  const accTotals = {};
  accounts?.forEach(a => {
    accTotals[a.id] = { code: a.code, name: a.name, type: a.account_type, debit: 0, credit: 0 };
  });

  entries?.forEach(e => {
    e.journal_lines?.forEach(l => {
      if (accTotals[l.account_id]) {
        accTotals[l.account_id].debit += Number(l.debit || 0);
        accTotals[l.account_id].credit += Number(l.credit || 0);
      }
    });
  });

  let totalDr = 0;
  let totalCr = 0;

  const rows = [];
  for (const acc of Object.values(accTotals)) {
    const rawDr = acc.debit;
    const rawCr = acc.credit;
    if (rawDr === 0 && rawCr === 0) continue;

    let netDr = 0;
    let netCr = 0;

    // Normal debit accounts: asset, expense
    if (acc.type === 'asset' || acc.type === 'expense') {
      const net = rawDr - rawCr;
      if (net >= 0) netDr = net;
      else netCr = -net;
    } else {
      // Normal credit accounts: liability, equity, income
      const net = rawCr - rawDr;
      if (net >= 0) netCr = net;
      else netDr = -net;
    }

    totalDr += netDr;
    totalCr += netCr;

    rows.push({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      rawDr, rawCr,
      netDr, netCr
    });
  }

  console.table(rows);
  console.log(`Total Debit: ${totalDr}, Total Credit: ${totalCr}, Diff: ${totalDr - totalCr}`);
}

testTB();
