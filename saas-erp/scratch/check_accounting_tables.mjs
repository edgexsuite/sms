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
  const { count: txnCount } = await supabase.from('financial_transactions').select('*', { count: 'exact', head: true });
  const { count: entryCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true });
  const { count: lineCount } = await supabase.from('journal_lines').select('*', { count: 'exact', head: true });
  console.log({ txnCount, entryCount, lineCount });

  // Check Advance Recovery transactions currently in financial_transactions
  const { data: advRecTxns } = await supabase.from('financial_transactions').select('*').eq('category', 'Advance Recovery');
  console.log('Advance Recovery transactions in DB:', advRecTxns?.length);
  if (advRecTxns?.length) console.log(advRecTxns);
}
check();
