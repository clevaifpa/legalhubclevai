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

async function testAuth() {
    // 1. Sign up a fake user
    const email = `test_zombie_${Date.now()}@example.com`;
    console.log("Signing up", email);
    let { data, error } = await supabase.auth.signUp({
        email,
        password: 'password123',
    });
    console.log("Signup:", data?.user?.id, error);

    // Assume admin deletes them from profile, but not auth.users
    // We simulate this by just doing a reset password for email
    console.log("Requesting reset password");
    const res = await supabase.auth.resetPasswordForEmail(email);
    console.log("Reset password res:", res.data, res.error);
}

testAuth();
