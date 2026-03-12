const fs = require('fs');
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('get_users_by_roles', { _roles: ['admin', 'manager'] });
    console.log("Data:", data);
    console.log("Error:", error);
}

main();
