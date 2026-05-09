const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf-8');
const getVal = (key) => {
    const regex = new RegExp(`${key}="?([^"\\n\\r]*)"?`);
    const match = env.match(regex);
    return match ? match[1] : null;
};

const url = getVal('VITE_SUPABASE_URL');
const key = getVal('VITE_SUPABASE_ANON_KEY');

const supabase = createClient(url, key);

async function check() {
    try {
        const { data, error } = await supabase.from('staff').select('*').limit(1);
        console.log("Staff record keys:", data ? Object.keys(data[0]) : "No data", error);
    } catch (e) {
        console.error(e);
    }
}
check();
