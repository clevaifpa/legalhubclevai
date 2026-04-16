import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { googleDocUrl } = await req.json();

    if (!googleDocUrl || typeof googleDocUrl !== "string") {
      return new Response(JSON.stringify({ error: "Thiếu googleDocUrl" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract file ID from Google Docs URL
    const match = googleDocUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match || !match[1]) {
      return new Response(JSON.stringify({ error: "Không thể lấy ID từ URL Google Docs" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileId = match[1];

    // Fetch content as plain text via Google Docs export
    const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
    const docResponse = await fetch(exportUrl);

    if (!docResponse.ok) {
      console.error("Google export error:", docResponse.status);
      return new Response(JSON.stringify({ error: "Không thể đọc nội dung Google Doc. Vui lòng đảm bảo tài liệu đã được chia sẻ công khai hoặc quyền 'Anyone with the link can view'." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docText = await docResponse.text();

    if (!docText || docText.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Nội dung tài liệu quá ngắn hoặc rỗng" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Truncate to 80000 chars
    const truncated = docText.slice(0, 80000);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Bạn là AI chuyên phân tích hợp đồng pháp lý Việt Nam.

Nhiệm vụ: Đọc nội dung hợp đồng (text) và trích xuất thông tin chính xác nhất có thể.

Quy tắc bắt buộc:
1. Nếu hợp đồng CÓ các đợt thanh toán → trích xuất ĐẦY ĐỦ từng đợt (tên đợt, giá trị, ngày thanh toán) và ĐẶT gia_tri_hop_dong = null
2. Nếu hợp đồng KHÔNG có đợt thanh toán → trả về gia_tri_hop_dong là tổng giá trị hợp đồng (chỉ số, không có đơn vị)
3. Ưu tiên trích xuất đợt thanh toán trước

Chuẩn hóa dữ liệu:
- Ngày: yyyy-mm-dd (ví dụ: 2025-01-15)
- Tiền: chỉ lấy số nguyên (VD: 1.000.000 → 1000000, 50 triệu → 50000000)
- loai_van_ban phải là 1 trong: "Hợp đồng nguyên tắc", "Hợp đồng sử dụng 1 lần", "Hợp đồng sử dụng dài hạn", "Hợp đồng/phụ lục gia hạn", "Phụ lục hợp đồng", "NDA", "Văn bản khác"
- Nếu không xác định được loại → dùng "Văn bản khác"

Trường mo_ta (BẮT BUỘC): Tóm tắt hợp đồng theo format chuẩn sau:
"[Loại văn bản] giữa [Bên A] và [Bên B] quy định việc [mục đích hợp tác].

1. Nội dung chính:
- Mục tiêu: [tóm tắt mục tiêu]
- Nội dung: [tóm tắt nội dung hợp tác]
- Phối hợp triển khai: [tóm tắt phối hợp]

2. Thời gian hiệu lực:
[thông tin thời hạn]

3. Chấm dứt:
[điều kiện chấm dứt]"

Viết ngắn gọn, rõ ràng, đúng tiếng Việt hành chính. Không thêm thông tin ngoài tài liệu.

Chỉ trả về JSON, không trả text ngoài JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Phân tích hợp đồng sau và trích xuất thông tin:\n\n${truncated}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contract_info",
              description: "Trả về thông tin trích xuất từ hợp đồng",
              parameters: {
                type: "object",
                properties: {
                  loai_van_ban: { type: "string", description: "Loại văn bản" },
                  ten_van_ban: { type: "string", description: "Tên văn bản/hợp đồng" },
                  ten_doi_tac: { type: "string", description: "Tên đối tác/bên B" },
                  ma_so_thue: { type: "string", description: "Mã số thuế đối tác" },
                  gia_tri_hop_dong: { type: ["number", "null"], description: "Giá trị hợp đồng (null nếu có đợt thanh toán)" },
                  ngay_bat_dau: { type: "string", description: "Ngày bắt đầu (yyyy-mm-dd)" },
                  ngay_ket_thuc: { type: "string", description: "Ngày kết thúc (yyyy-mm-dd)" },
                  mo_ta: { type: "string", description: "Tóm tắt nội dung hợp đồng theo format chuẩn" },
                  dot_thanh_toan: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ten_dot: { type: "string" },
                        gia_tri: { type: "number" },
                        ngay_thanh_toan: { type: "string", description: "yyyy-mm-dd" },
                      },
                      required: ["ten_dot", "gia_tri"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["loai_van_ban", "ten_van_ban", "ten_doi_tac", "ma_so_thue", "gia_tri_hop_dong", "ngay_bat_dau", "ngay_ket_thuc", "mo_ta", "dot_thanh_toan"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_contract_info" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Vượt giới hạn yêu cầu, vui lòng thử lại sau." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Cần nạp thêm credit để sử dụng AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Lỗi AI gateway" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    let result;
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      const content = data.choices?.[0]?.message?.content || "";
      try {
        result = JSON.parse(content);
      } catch {
        return new Response(JSON.stringify({ error: "AI không trả về dữ liệu hợp lệ" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-contract-from-doc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
