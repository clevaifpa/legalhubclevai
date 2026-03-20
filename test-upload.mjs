import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@clevai.edu.vn', // or any test user
        password: 'password123'
    });

    if (authError) {
        console.error("Auth error", authError);
        return;
    }

    const { data: cats } = await supabase.from('contract_categories').select('id').limit(1);
    const catId = cats?.[0]?.id;

    const { data, error } = await supabase.from('contracts').insert({
        title: "Test Contract",
        partner_name: "Test Partner",
        contract_type: "khac",
        status: "da_ky",
        value: 0,
        effective_date: null,
        expiry_date: "2026-12-31",
        department: "",
        risk_level: "thap",
        category_id: catId,
        file_url: "https://example.com/file.pdf",
        tax_code: "123",
    }).select().single();

    if (error) {
        console.error("Upload error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Upload success:", data);
    }
}

testUpload();
