import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contractText, clauses } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Bạn là chuyên gia pháp chế Việt Nam, chuyên phân tích và kiểm tra hợp đồng. 
Nhiệm vụ: Phân tích nội dung hợp đồng, phát hiện rủi ro, so sánh với điều khoản chuẩn.

Trả về kết quả theo format JSON với cấu trúc:
{
  "summary": "Tóm tắt tổng quan hợp đồng",
  "riskLevel": "thap" | "trung_binh" | "cao",
  "issues": [
    {
      "clause": "Tên/nội dung điều khoản có vấn đề",
      "riskLevel": "thap" | "trung_binh" | "cao",
      "reason": "Giải thích vì sao rủi ro",
      "suggestion": "Gợi ý nội dung chỉnh sửa"
    }
  ],
  "missingClauses": ["Danh sách điều khoản bắt buộc bị thiếu"],
  "recommendations": ["Các khuyến nghị chung"]
}

Hãy phân tích kỹ lưỡng, chính xác theo luật pháp Việt Nam.`;

    let userContent = `Phân tích hợp đồng sau:\n\n${contractText}`;
    
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
                        reason: { type: "string" },
                        suggestion: { type: "string" },
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
      // Fallback: try to parse from content
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
