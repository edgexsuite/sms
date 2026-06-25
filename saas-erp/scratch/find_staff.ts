
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://sqqxbxffwwfxmcqgjvui.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcXhieGZmd3dmeG1jcWdqdnVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NzIzNzksImV4cCI6MjA5MTQ0ODM3OX0.8bsScNKKLwuPMW7g97Fcjdoe_VnoVbsBkOW-R9_kREA"
);

async function findStaff() {
  const { data, error } = await supabase
    .from('staff')
    .select('full_name')
    .eq('id', 'c3b1121a-5ede-4355-a64b-1008f0d19a1b')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Staff with ID c3b1121a-5ede-4355-a64b-1008f0d19a1b is:', data.full_name);
}

findStaff();
