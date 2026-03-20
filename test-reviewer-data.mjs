import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReviewerAssignment() {
    console.log("Checking recent review requests...");

    const { data: requests, error } = await supabase
        .from("review_requests")
        .select("id, contract_title, status, manager_id, global_manager_id")
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching requests:", error);
        return;
    }

    requests.forEach(req => {
        console.log(`Request: ${req.contract_title} [${req.status}]`);
        console.log(`  manager_id (Step 1): ${req.manager_id}`);
        console.log(`  global_manager_id (Step 2): ${req.global_manager_id}`);
        console.log("---");
    });

    console.log("Checking reviewers RPC...");
    const { data: reviewers, error: rpcError } = await supabase.rpc("get_all_reviewers_with_names");
    if (rpcError) {
        console.error("RPC Error:", rpcError);
    } else {
        const managerChung = reviewers.filter(r => r.role === 'manager_chung');
        console.log(`Found ${managerChung.length} manager_chung from get_all_reviewers_with_names:`);
        managerChung.forEach(m => console.log(`  - ${m.full_name}`));
    }
}

checkReviewerAssignment();
