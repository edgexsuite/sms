import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://sqqxbxffwwfxmcqgjvui.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA"
);

async function main() {
  const { data: pmFee } = await supabase.from("fee_records").select("payment_mode").is("deleted_at", null);
  const pmFeeCounts = {};
  (pmFee || []).forEach(r => { const v = r.payment_mode ?? "(null)"; pmFeeCounts[v] = (pmFeeCounts[v] || 0) + 1; });
  console.log("=== fee_records payment_mode distribution ===");
  Object.entries(pmFeeCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  "${k}": ${v} rows`));

  const { data: pmTx } = await supabase.from("financial_transactions").select("payment_mode").eq("category", "Fee Collection");
  const pmTxCounts = {};
  (pmTx || []).forEach(r => { const v = r.payment_mode ?? "(null)"; pmTxCounts[v] = (pmTxCounts[v] || 0) + 1; });
  console.log("\n=== financial_transactions payment_mode ===");
  Object.entries(pmTxCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  "${k}": ${v} rows`));

  const { data: statusRows } = await supabase.from("fee_records").select("status, deleted_at");
  const statusCounts = {};
  (statusRows || []).forEach(r => { const key = r.status + (r.deleted_at ? " (deleted)" : ""); statusCounts[key] = (statusCounts[key] || 0) + 1; });
  console.log("\n=== fee_records status distribution ===");
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  "${k}": ${v} rows`));
}

main().catch(e => { console.error(e); process.exit(1); });
