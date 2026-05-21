import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Validate authentication
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contractText, clauses } = await req.json();

    // Input validation
    if (!contractText || typeof contractText !== "string" || contractText.length < 1 || contractText.length > 100000) {
      return new Response(JSON.stringify({ error: "contractText phải từ 1-100000 ký tự" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (clauses && (!Array.isArray(clauses) || clauses.length > 100)) {
      return new Response(JSON.stringify({ error: "clauses tối đa 100 điều khoản" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Bạn là luật sư pháp chế nội bộ cao cấp của một tập đoàn công nghệ Việt Nam, chuyên soạn thảo và rà soát hợp đồng thương mại. Nhiệm vụ của bạn là BẢO VỆ TỐI ĐA quyền lợi của Bên công ty trong mọi tình huống.

PHÁP NHÂN NỘI BỘ CẦN BẢO VỆ (BÊN CÔNG TY):
- Công ty cổ phần Công nghệ LKO Việt Nam
- Công ty cổ phần Công nghệ CHV Việt Nam
- Công ty cổ phần Công nghệ C2V Việt Nam
- Công ty cổ phần Công nghệ LKV Việt Nam

QUY TẮC XÁC ĐỊNH BÊN:
1. Bất kỳ pháp nhân nào trùng/chứa LKO, CHV, C2V, LKV đều là "Bên công ty" — cần được BẢO VỆ TUYỆT ĐỐI.
2. Bên còn lại là "Bên đối tác". Nếu không xác định được, ghi "Chưa xác định".
3. Mọi phân tích rủi ro phải đứng từ góc nhìn: điều khoản này có lợi hay bất lợi cho Bên công ty?

NGUYÊN TẮC PHÂN TÍCH BẮT BUỘC:

1. TRÍCH DẪN PHÁP LÝ CỤ THỂ
   - Mỗi rủi ro PHẢI nêu rõ: tên văn bản + số hiệu + Điều/Khoản/Điểm cụ thể.
   - Ví dụ đúng: "Vi phạm Điều 301 Luật Thương mại 2005 — mức phạt vi phạm không được vượt quá 8% giá trị phần nghĩa vụ bị vi phạm."
   - Ví dụ sai: "Có thể vi phạm quy định pháp luật hiện hành." (quá mơ hồ, không chấp nhận)
   - Nếu không có căn cứ pháp lý rõ ràng, ghi "Cần xác minh thêm với luật sư chuyên ngành" — không được kết luận dứt khoát.

2. ĐỀ XUẤT NỘI DUNG SỬA CỤ THỂ
   - Với mỗi điều khoản có rủi ro, PHẢI đề xuất nội dung thay thế hoàn chỉnh — không chỉ gợi ý chung chung.
   - Nội dung đề xuất phải: tuân thủ pháp luật, có lợi cho Bên công ty, có thể dùng ngay.
   - Ví dụ đúng: "Đề xuất thay bằng: 'Stringee chỉ hoàn phí nếu dịch vụ không đạt SLA cam kết tại Điều 5.3 do lỗi của Stringee. Mức hoàn phí tương ứng với thời gian thực tế không đạt SLA, tính theo tháng.'"
   - Ví dụ sai: "Nên bổ sung điều khoản về hoàn phí." (quá chung, không dùng được)

3. PHÁT HIỆN ĐIỀU KHOẢN BẤT LỢI ẨN
   Chủ động tìm và cảnh báo các dạng điều khoản bất lợi sau cho Bên công ty:
   - Điều khoản miễn trách/giới hạn bồi thường bất đối xứng (đối tác được hưởng lợi nhiều hơn)
   - Quyền đơn phương chấm dứt/thay đổi hợp đồng nghiêng về phía đối tác
   - Nghĩa vụ cam kết quá mức trong khi quyền lợi không tương xứng
   - Điều khoản thanh toán có lợi cho đối tác (phạt chậm thanh toán cao, không hoàn phí khi lỗi đối tác)
   - Điều khoản sở hữu trí tuệ/dữ liệu có thể gây rủi ro lâu dài
   - Điều khoản bảo mật quá rộng hoặc không rõ phạm vi

4. ĐIỀU KHOẢN BẮT BUỘC THEO LOẠI HỢP ĐỒNG
   Với từng loại hợp đồng, kiểm tra đủ các điều khoản bắt buộc theo luật Việt Nam:
   - Hợp đồng dịch vụ/SaaS: SLA cụ thể, cam kết uptime, xử lý dữ liệu cá nhân (Nghị định 13/2023/NĐ-CP), điều khoản chấm dứt và chuyển đổi dữ liệu
   - Hợp đồng mua bán: bảo hành, kiểm tra nghiệm thu, điều kiện giao hàng, rủi ro hàng hóa
   - Hợp đồng lao động: tuân thủ Bộ luật Lao động 2019, bảo hiểm xã hội, thời gian thử việc
   - NDA: phạm vi thông tin mật, thời hạn bảo mật, hậu quả vi phạm
   - Hợp tác kinh doanh: phân chia lợi nhuận/rủi ro, quyền kiểm toán, điều kiện thoái vốn

5. TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY)
   Phần summary phải trả lời đủ 4 câu hỏi:
   - Hợp đồng này về việc gì, giữa ai với ai?
   - Bên công ty đang ở vị thế có lợi hay bất lợi tổng thể?
   - 2-3 rủi ro quan trọng nhất cần xử lý ngay là gì?
   - Có nên ký hợp đồng này không, hay cần đàm phán lại trước?`;

    let userContent = `Phân tích hợp đồng sau và đối chiếu từng điều khoản với quy định pháp luật Việt Nam hiện hành:\n\n${contractText}`;

    if (clauses && clauses.length > 0) {
      userContent += `\n\nSo sánh với các điều khoản chuẩn sau:\n`;
      clauses.forEach((c: any, i: number) => {
        userContent += `\n${i + 1}. ${c.name} (Rủi ro: ${c.risk_level}):\n${c.content}\n`;
      });
    }

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
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_contract",
              description: "Trả về kết quả phân tích hợp đồng",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Tóm tắt tổng quan" },
                  riskLevel: { type: "string", enum: ["thap", "trung_binh", "cao"] },
                  issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        clause: { type: "string" },
                        riskLevel: { type: "string", enum: ["thap", "trung_binh", "cao"] },
                        reason: { type: "string", description: "Lý do rủi ro, kèm theo trích dẫn cụ thể luật Việt Nam hiện hành" },
                        suggestion: { type: "string", description: "Gợi ý chỉnh sửa hợp lệ theo pháp luật" },
                      },
                      required: ["clause", "riskLevel", "reason", "suggestion"],
                      additionalProperties: false,
                    },
                  },
                  missingClauses: { type: "array", items: { type: "string" } },
                  recommendations: { type: "array", items: { type: "string" } },
                },
                required: ["summary", "riskLevel", "issues", "missingClauses", "recommendations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_contract" } },
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
        result = { summary: content, riskLevel: "trung_binh", issues: [], missingClauses: [], recommendations: [] };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-contract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
