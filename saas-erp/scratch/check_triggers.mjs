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

async function check() {
  const { data: accounts } = await supabase.from('accounts').select('*');
  console.log('All accounts:');
  console.table(accounts?.map(a => ({ id: a.id, code: a.code, name: a.name, type: a.account_type })));

  // Check trial balance query based on journal_lines + accounts!
  const { data: jlines } = await supabase
    .from('journal_lines')
    .select(`
      debit, credit,
      accounts ( id, code, name, account_type )
    `);
  console.log('Total journal lines:', jlines?.length);
  let totalDr = 0, totalCr = 0;
  const accMap = {};
  jlines?.forEach(jl => {
    totalDr += jl.debit || 0;
    totalCr += jl.credit || 0;
    const acc = jl.accounts;
    if (acc) {
      if (!accMap[acc.id]) accMap[acc.id] = { code: acc.code, name: acc.name, type: acc.account_type, debit: 0, credit: 0 };
      accMap[acc.id].debit += jl.debit || 0;
      accMap[acc.id].credit += jl.credit || 0;
    }
  });
  console.log(`Journal Lines Total Debit: ${totalDr}, Total Credit: ${totalCr}, Difference: ${totalDr - totalCr}`);
  console.log('Account balances from Journal Lines:');
  console.table(Object.values(accMap));
}
check();
