import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfjndfmbiatymgiczkhw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmam5kZm1iaWF0eW1naWN6a2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDYwODAsImV4cCI6MjA4NjM4MjA4MH0.1t2LSLUCds_HzaRjut8GoPEcGFm_W_xt3It-P3EsX9g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    console.log("Checking profiles...");
    const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', '%linhnt2%');
    console.log("Profiles:", profiles, pErr);

    console.log("Checking user roles...");
    if (profiles && profiles.length > 0) {
        for (const p of profiles) {
            const { data: roles, error: rErr } = await supabase
                .from('user_roles')
                .select('*')
                .eq('user_id', p.user_id);
            console.log(`Roles for ${p.email}:`, roles, rErr);
        }
    }
}

checkUser();
