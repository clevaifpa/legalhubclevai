import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) throw new Error("Missing Authorization header");

        // Initialize regular client to verify the user
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        // Get the user making the request
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) throw new Error("Unauthorized");

        // Verify if the user is admin
        const { data: roleData, error: roleError } = await supabaseClient
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .single();

        if (roleError || roleData?.role !== "admin") {
            throw new Error("Only admins can perform this action");
        }

        // Now initialize ADMIN client with Service Role Key to bypass RLS
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { target_user_id, action, department } = await req.json();

        if (!target_user_id) throw new Error("Missing target_user_id");

        if (action === "update_department") {
            if (!department) throw new Error("Missing department");

            const { error: pErr } = await supabaseAdmin.from("profiles").update({ department }).eq("user_id", target_user_id);
            if (pErr) throw pErr;

            // Update user_roles as well, ignore error if department column doesn't exist
            await supabaseAdmin.from("user_roles").update({ department } as any).eq("user_id", target_user_id);

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            });
        }

        throw new Error("Invalid action");
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
