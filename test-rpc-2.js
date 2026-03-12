import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
    const [k, v] = line.split('=');
    if (k && v) acc[k.trim()] = v.trim().replace(/"/g, '');
    return acc;
}, {});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Client created");
    // Just test if we can call it. Note: requires matching auth.uid() which we don't have, so it should throw "Unauthorized" if the RPC exists.
    const { data, error } = await supabase.rpc('recreate_user_profile', {
        _user_id: '00000000-0000-0000-0000-000000000000',
        _email: 'test@example.com',
        _full_name: 'test',
        _department: 'LVO'
    });
    console.log("Error:", error);
    console.log("Data:", data);
}
run();
