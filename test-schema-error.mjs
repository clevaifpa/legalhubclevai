import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://kfjndfmbiatymgiczkhw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmam5kZm1iaWF0eW1naWN6a2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDYwODAsImV4cCI6MjA4NjM4MjA4MH0.1t2LSLUCds_HzaRjut8GoPEcGFm_W_xt3It-P3EsX9g";
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkErrors() {
    console.log("Checking DB schema...");

    // 1. Check if manager_chung is a valid enum value for app_role
    // We can't query enums directly easily with the JS client, but we can query `user_roles`.
    const { data: rolesTest, error: rolesErr } = await supabase.from('user_roles').select('role').limit(1);
    if (rolesErr) {
        console.error("user_roles error:", rolesErr);
    } else {
        console.log("user_roles works.");
    }

    // 2. Check if the review_requests table has global_manager_id
    const { data: reqTest, error: reqErr } = await supabase.from('review_requests').select('global_manager_id, legal_reviewer_id').limit(1);
    if (reqErr) {
        console.error("review_requests schema error:", reqErr.message);
    } else {
        console.log("review_requests schema OK.");
    }

    // 3. Check RPC
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_all_reviewers_with_names');
    if (rpcErr) {
        console.error("RPC error:", rpcErr.message);
    } else {
        console.log("RPC get_all_reviewers_with_names returned count:", rpcData?.length);
    }
}
checkErrors();
