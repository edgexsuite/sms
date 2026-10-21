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
  // Test if type must be 'income' | 'expense'
  const { data: test, error } = await supabase.from('financial_transactions').insert({
    school_id: 'aed24dc2-c3ac-47a1-9287-3b003934f720',
    type: 'transfer',
    amount: 1,
    date: '2099-01-01',
    category: 'Test'
  }).select();
  console.log('Insert test with type=transfer:', error?.message || 'SUCCESS');
  if (test && test[0]) {
    await supabase.from('financial_transactions').delete().eq('id', test[0].id);
  }
}
check();
