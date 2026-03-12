import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfjndfmbiatymgiczkhw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmam5kZm1iaWF0eW1naWN6a2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MDYwODAsImV4cCI6MjA4NjM4MjA4MH0.1t2LSLUCds_HzaRjut8GoPEcGFm_W_xt3It-P3EsX9g';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendResetEmail() {
    const email = 'linhnt2@clevai.edu.vn';
    console.log(`Sending reset password email to ${email}...`);
    // Use a fake origin to simulate the frontend
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://preview--legalhubclevai.lovable.app/reset-password",
    });

    if (error) {
        console.error("Failed to send reset email:", error.message);
    } else {
        console.log("Successfully triggered password reset email!");
    }
}

sendResetEmail();
