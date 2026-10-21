import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://sqqxbxffwwfxmcqgjvui.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA");
async function main() {
  const { data } = await supabase.from("students").select("status, is_deleted").eq("school_id","aed24dc2-c3ac-47a1-9287-3b003934f720");
  const counts = {};
  (data||[]).forEach(r => { const k = `status="${r.status}" is_deleted=${r.is_deleted}`; counts[k]=(counts[k]||0)+1; });
  console.log("Student breakdown:");
  Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${k}: ${v}`));
}
main().catch(e=>{console.error(e);process.exit(1);});
