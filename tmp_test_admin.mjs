import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfjndfmbiatymgiczkhw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmam5kZm1iaWF0eW1naWN6a2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDYwODAsImV4cCI6MjA4NjM4MjA4MH0.1t2LSLUCds_HzaRjut8GoPEcGFm_W_xt3It-P3EsX9g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdminAccount() {
    const email = 'linhnt2@clevai.edu.vn';
    const password = 'Password123!';

    console.log(`[1] Attempting to sign in with ${email}...`);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: 'wrongpassword' // purposely wrong to see error type
    });
    console.log("Sign in result:", signInError ? signInError.message : "Success");

    console.log(`\n[2] Attempting to sign up with ${email}...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Linh Nguyen',
                department: 'LVO'
            }
        }
    });
    console.log("Sign up result:", signUpError ? signUpError.message : "Success. Account might not have existed?");

    if (!signUpError && signUpData.user) {
        if (signUpData.user.identities && signUpData.user.identities.length === 0) {
            console.log("User already exists but sign up didn't throw error (fake sign up protection is ON).");
        } else {
            console.log("Newly created user ID:", signUpData.user.id);
        }
    }
}

testAdminAccount();
