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
    const { requestId, contractTitle, newStatus, updatedBy, requesterId } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not configured, skipping email notification");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up requester email from auth
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(requesterId);
    const requesterEmail = userData?.user?.email;

    if (!requesterEmail) {
      return new Response(
        JSON.stringify({ success: false, message: "Requester email not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #fff; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #ea580c; margin: 0;">⚖️ LegalHub</h2>
          <p style="color: #6b7280; font-size: 14px;">Thông báo cập nhật trạng thái hợp đồng</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <table style="width: 100%; font-size: 14px; color: #374151;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; width: 140px;">Tên hợp đồng:</td>
            <td style="padding: 8px 0;">${contractTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Trạng thái mới:</td>
            <td style="padding: 8px 0;"><span style="background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 6px; font-weight: 600;">${newStatus}</span></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Người xử lý:</td>
            <td style="padding: 8px 0;">${updatedBy}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Thời gian:</td>
            <td style="padding: 8px 0;">${now}</td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">Email tự động từ hệ thống LegalHub. Vui lòng đăng nhập để xem chi tiết.</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "LegalHub <onboarding@resend.dev>",
        to: [requesterEmail],
        subject: `[LegalHub] Cập nhật: ${contractTitle} - ${newStatus}`,
        html: emailHtml,
      }),
    });

    const result = await res.json();

    return new Response(
      JSON.stringify({ success: res.ok, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Email notification error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
