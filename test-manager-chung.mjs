import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testManagerChungFlow() {
    // Simulate an employee login to test manager logic
    console.log("Fetching a regular user...");
    const { data: profiles } = await supabase.from('profiles').select('*').limit(5);
    const employee = profiles.find(p => p.email !== 'hiennd@clevai.edu.vn');

    if (!employee) {
        console.error("No employee found to test with");
        return;
    }
    console.log(`Using employee: ${employee.email}`);

    // We are bypassing the UI, so we just want to verify what the RPC 'get_users_by_roles' returns
    console.log("\n--- Testing get_users_by_roles RPC ---");
    const { data: managers, error } = await supabase.rpc("get_users_by_roles", { _roles: ["manager_chung"] });
    if (error) {
        console.error("Error calling get_users_by_roles:", error.message);
    } else {
        console.log(`Found ${managers.length} manager_chung users:`);
        managers.forEach(m => console.log(`- ${m.full_name} (${m.role})`));
    }
}

testManagerChungFlow();
