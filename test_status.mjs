import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Signing in...");
  const { error: authErr } = await supabase.auth.signInWithPassword({
    email: 'linhnt2@clevai.edu.vn',
    password: 'Password123!'
  });
  
  if (authErr) { console.error('Auth error:', authErr); return; }

  console.log("Fetching contracts...");
  const { data, error } = await supabase.from('contracts').select('id, status').limit(2);
  if (error) { console.error('Select error:', error); return; }
  
  if (data && data.length > 0) {
    const testId = data[0].id;
    console.log(`Testing update on contract ${testId} with current status ${data[0].status}`);
    const { error: updateErr } = await supabase.from('contracts')
      .update({ status: 'het_hieu_luc_chua_hoan_thanh' })
      .eq('id', testId);
    console.log("Update error?", updateErr);

    if (!updateErr) {
      console.log("Update successful. Reverting...");
      await supabase.from('contracts').update({ status: data[0].status }).eq('id', testId);
    }
  } else {
    console.log("No contracts found to test with.");
  }
}
test();
