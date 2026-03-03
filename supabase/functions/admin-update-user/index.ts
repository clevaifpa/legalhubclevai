import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing Authorization header");

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        // Client for auth verify (using user's token)
        const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
            global: { headers: { Authorization: authHeader } },
        });

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await authClient.auth.getUser(token);

        if (authError || !user) throw new Error("Invalid token");

        // Client for admin operations (bypassing RLS)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        // Verify if the executing user is an admin
        const { data: roleData, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .single();

        if (roleError || !roleData) {
            throw new Error("Not authorized. Admin access required.");
        }

        const { userId, department } = await req.json();
        if (!userId || !department) throw new Error("Missing userId or department");

        // Update the profile department
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ department })
            .eq('user_id', userId);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, message: "Department updated successfully" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
