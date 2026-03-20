const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL="(.*)"/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/)[1].trim();
const supabase = createClient(url, key);

async function test() {
    const { data, error } = await supabase.rpc('query_pg_policies', {});
    console.log(data, error);
}
test();
