import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://kfjndfmbiatymgiczkhw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmam5kZm1iaWF0eW1naWN6a2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDYwODAsImV4cCI6MjA4NjM4MjA4MH0.1t2LSLUCds_HzaRjut8GoPEcGFm_W_xt3It-P3EsX9g";
const supabase = createClient(supabaseUrl, supabaseKey);

async function testHistory() {
    const { data, error } = await supabase
        .from("ai_review_history")
        .select("id")
        .limit(1);

    console.log("ai_review_history test:", error ? error : "Success", data);
}

testHistory();
