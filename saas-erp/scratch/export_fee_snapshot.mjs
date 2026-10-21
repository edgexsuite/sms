import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as nodePath from "path";

const supabase = createClient(
  "https://sqqxbxffwwfxmcqgjvui.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA"
);

const OUT_DIR = nodePath.resolve("scratch", "exports");
fs.mkdirSync(OUT_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

function escapeCell(v) {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows) {
  if (!rows.length) return "no data";
  const hdrs = Object.keys(rows[0]);
  return [hdrs.join(","), ...rows.map(r => hdrs.map(h => escapeCell(r[h])).join(","))].join("\n");
}

async function fetchAll(table, select, school_id) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).eq("school_id", school_id).range(from, from + PAGE - 1);
    if (error) { console.error("  ERR", table, error.message); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log("=== PRE-FIX FEE DATA EXPORT ===");
  console.log("Timestamp:", new Date().toISOString());
  const { data: schools } = await supabase.from("schools").select("id, name");
  console.log("Schools:", schools?.length ?? 0);
  const summary = { exported_at: new Date().toISOString(), schools: [] };
  const allFee = [], allStu = [], allTx = [];

  for (const school of schools ?? []) {
    console.log("\n-> " + school.name);
    const feeRows = await fetchAll("fee_records", "id,school_id,student_id,student_name,invoice_number,month_year,total_amount,paid_amount,discount_amount,status,payment_mode,due_date,paid_at,remarks,breakdown,created_at,deleted_at", school.id);
    console.log("   fee_records:", feeRows.length);
    const stuRows = await fetchAll("students", "id,school_id,full_name,roll_number,class_id,status,is_deleted,fee_waiver_percentage,created_at", school.id);
    console.log("   students:", stuRows.length);
    const txAll = await fetchAll("financial_transactions", "id,school_id,fee_record_id,category,amount,date,payment_mode,remarks,fee_items,created_at", school.id);
    const feeTx = txAll.filter(t => t.category === "Fee Collection");
    console.log("   fee_transactions:", feeTx.length);
    allFee.push(...feeRows);
    allStu.push(...stuRows);
    allTx.push(...feeTx);
    const active = feeRows.filter(r => !r.deleted_at);
    const byStatus = {};
    active.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    summary.schools.push({ school_id: school.id, school_name: school.name, total: feeRows.length, active: active.length, soft_deleted: feeRows.length - active.length, status_breakdown: byStatus, students: stuRows.length, fee_transactions: feeTx.length });
  }

  const feeFile = nodePath.join(OUT_DIR, "fee_records_" + ts + ".csv");
  fs.writeFileSync(feeFile, toCsv(allFee), "utf8");
  console.log("\n[OK] fee_records ->", feeFile, "(" + allFee.length + " rows)");

  const stuFile = nodePath.join(OUT_DIR, "students_" + ts + ".csv");
  fs.writeFileSync(stuFile, toCsv(allStu), "utf8");
  console.log("[OK] students    ->", stuFile, "(" + allStu.length + " rows)");

  const txFile = nodePath.join(OUT_DIR, "fee_transactions_" + ts + ".csv");
  fs.writeFileSync(txFile, toCsv(allTx), "utf8");
  console.log("[OK] tx          ->", txFile, "(" + allTx.length + " rows)");

  const sumFile = nodePath.join(OUT_DIR, "snapshot_summary_" + ts + ".json");
  fs.writeFileSync(sumFile, JSON.stringify(summary, null, 2), "utf8");
  console.log("[OK] summary     ->", sumFile);

  console.log("\n=== SUMMARY ===");
  for (const s of summary.schools) {
    if (!s.total) continue;
    console.log("\nSchool:", s.school_name);
    console.log("  Records:", s.total, " active:", s.active, " soft_deleted:", s.soft_deleted);
    console.log("  Status:", JSON.stringify(s.status_breakdown));
    console.log("  Students:", s.students, " Transactions:", s.fee_transactions);
  }
  console.log("\n=== EXPORT DONE ===");
}

main().catch(e => { console.error(e); process.exit(1); });
