import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: req.headers.get("Authorization")! },
                },
            }
        );

        // Verify admin role
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: roles } = await supabaseClient
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);

        const isAdmin = roles?.some(r => r.role === "admin");
        if (!isAdmin) {
            throw new Error("Admin access required");
        }

        const { userId } = await req.json();
        if (!userId) {
            throw new Error("userId is required");
        }

        // Call the original RPC to clean up related records (profiles, roles, logs etc)
        const { error: rpcError } = await supabaseClient.rpc("admin_delete_user", { _user_id: userId });

        if (rpcError) {
            console.error("RPC cleanup error:", rpcError);
        }

        // Create service role client for true admin operations (bypassing RLS & accessing auth schema)
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Hard delete the user from Auth to free up the email completely
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            throw deleteError;
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
