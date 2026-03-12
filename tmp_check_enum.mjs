import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfjndfmbiatymgiczkhw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmam5kZm1iaWF0eW1naWN6a2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDYwODAsImV4cCI6MjA4NjM4MjA4MH0.1t2LSLUCds_HzaRjut8GoPEcGFm_W_xt3It-P3EsX9g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnum() {
    const testData = {
        title: "TEST_ENUM",
        status: "het_hieu_luc_chua_hoan_thanh",
        partner_name: "test",
        contract_type: "khac",
        value: 0
    };

    const { error: insertError } = await supabase.from('contracts').insert(testData);
    if (insertError) {
        if (insertError.message.includes('invalid input value for enum contract_status')) {
            console.log("ENUM VALUE MISSING IN DATABASE!");
        } else {
            console.log("Insert failed for another reason:", insertError.message);
        }
    } else {
        console.log("Enum value exists and insert succeeded! Deleting test record...");
        await supabase.from('contracts').delete().eq('title', 'TEST_ENUM');
    }
}

checkEnum();
