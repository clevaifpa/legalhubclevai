import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const extractGoogleDocId = (url: string) => url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
const extractGoogleDriveFileId = (url: string) => {
  const m1 = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (m2) return m2[1];
  return null;
};
const extractGoogleFolderId = (url: string) => url.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;

const base64Url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const getServiceAccountAccessToken = async () => {
  const rawKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!rawKey) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY missing");
  const key = JSON.parse(rawKey);
  const now = Math.floor(Date.now() / 1000);
  const unsignedToken = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }))}`;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(key.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, "")), c => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(unsignedToken));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsignedToken}.${base64Url(signature)}` }),
  });
  if (!response.ok) throw new Error(`Google auth failed: ${response.status}`);
  return (await response.json()).access_token as string;
};

const fetchGoogleDocText = async (fileId: string, accessToken: string, cacheBust: number) => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain&supportsAllDrives=true&_=${cacheBust}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
  });
  if (!response.ok) throw new Error(`Google Doc fetch failed: ${response.status}`);
  return await response.text();
};

const fetchDriveFileMetadata = async (fileId: string, accessToken: string) => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Drive metadata failed: ${response.status}`);
  return await response.json();
};

const fetchDriveFileContent = async (fileId: string, mimeType: string, accessToken: string, cacheBust: number) => {
  // Google Doc
  if (mimeType === "application/vnd.google-apps.document") {
    return await fetchGoogleDocText(fileId, accessToken, cacheBust);
  }
  // PDF / other binary - download then attempt text extract via export if possible
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&_=${cacheBust}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`Drive file download failed: ${response.status}`);
  if (mimeType === "application/pdf") {
    // basic PDF text extraction: get bytes and pull readable strings
    const buf = new Uint8Array(await response.arrayBuffer());
    return extractTextFromPdfBytes(buf);
  }
  // try as text
  try { return await response.text(); } catch { return ""; }
};

// Minimal PDF text extraction (BT/ET text streams)
const extractTextFromPdfBytes = (bytes: Uint8Array): string => {
  const text = new TextDecoder("latin1").decode(bytes);
  const out: string[] = [];
  const re = /\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:[^\]])*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[1]) {
      out.push(m[1].replace(/\\(.)/g, "$1"));
    } else if (m[2]) {
      const inner = m[2];
      const re2 = /\(((?:\\.|[^\\()])*)\)/g;
      let m2: RegExpExecArray | null;
      while ((m2 = re2.exec(inner)) !== null) {
        out.push(m2[1].replace(/\\(.)/g, "$1"));
      }
    }
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
};

const fetchFolderFilesContent = async (folderId: string, accessToken: string, cacheBust: number) => {
  const listResp = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true&_=${cacheBust}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listResp.ok) throw new Error(`Folder list failed: ${listResp.status}`);
  const { files = [] } = await listResp.json();
  // priority: PDF, then Google Doc, then others
  const sorted = [...files].sort((a: any, b: any) => {
    const score = (f: any) => {
      if (f.mimeType === "application/pdf") return 0;
      if (f.mimeType === "application/vnd.google-apps.document") return 1;
      return 2;
    };
    return score(a) - score(b);
  });
  const top = sorted[0];
  if (!top) return "";
  return await fetchDriveFileContent(top.id, top.mimeType, accessToken, cacheBust);
};

const fetchAnyLinkContent = async (url: string, cacheBust: number): Promise<string> => {
  if (!url) return "";
  const docId = extractGoogleDocId(url);
  const folderId = extractGoogleFolderId(url);
  const driveFileId = extractGoogleDriveFileId(url);

  if (docId || folderId || driveFileId) {
    const accessToken = await getServiceAccountAccessToken();
    if (docId) return await fetchGoogleDocText(docId, accessToken, cacheBust);
    if (folderId) return await fetchFolderFilesContent(folderId, accessToken, cacheBust);
    if (driveFileId) {
      const meta = await fetchDriveFileMetadata(driveFileId, accessToken);
      return await fetchDriveFileContent(driveFileId, meta.mimeType, accessToken, cacheBust);
    }
  }

  // direct URL fetch (PDF/text)
  const sep = url.includes("?") ? "&" : "?";
  const resp = await fetch(`${url}${sep}_=${cacheBust}`, { headers: { "Cache-Control": "no-cache" } });
  if (!resp.ok) throw new Error(`Direct fetch failed: ${resp.status}`);
  const ct = resp.headers.get("content-type") || "";
  if (ct.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
    const buf = new Uint8Array(await resp.arrayBuffer());
    return extractTextFromPdfBytes(buf);
  }
  return await resp.text();
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { contractId } = await req.json();
    if (!contractId) {
      return new Response(JSON.stringify({ error: "Thiếu contractId" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: contract, error: cErr } = await supabaseClient
      .from("contracts")
      .select("id, title, partner_name, file_url, liquidation_file_url")
      .eq("id", contractId)
      .maybeSingle();
    if (cErr || !contract) {
      return new Response(JSON.stringify({ error: "Không tìm thấy hợp đồng" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: relatedDocs } = await supabaseClient
      .from("contract_related_docs")
      .select("doc_type, doc_name, doc_url")
      .eq("contract_id", contractId);

    const cacheBust = Date.now();

    let mainText = "";
    const sourceErrors: string[] = [];
    if (contract.file_url) {
      try {
        mainText = await fetchAnyLinkContent(contract.file_url, cacheBust);
      } catch (e) {
        sourceErrors.push(`Link chính: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!mainText || mainText.trim().length < 30) {
      return new Response(JSON.stringify({ error: "Không đọc được nội dung hợp đồng từ link đính kèm. " + sourceErrors.join("; ") }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const attachments: { type: string; content: string }[] = [];
    for (const d of (relatedDocs || [])) {
      try {
        const txt = await fetchAnyLinkContent(d.doc_url, cacheBust);
        if (txt && txt.trim().length > 20) {
          const typeLabel = d.doc_type === "phu_luc_hop_dong" ? "Phụ lục hợp đồng"
            : d.doc_type === "thanh_ly" ? "Biên bản thanh lý"
            : d.doc_type === "bien_ban_nghiem_thu" ? "Biên bản nghiệm thu"
            : d.doc_name || "Văn bản bổ sung";
          attachments.push({ type: typeLabel, content: txt.slice(0, 15000) });
        }
      } catch {
        // skip
      }
    }

    const truncated = mainText.slice(0, 80000);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `Bạn là chuyên gia pháp lý Việt Nam. Đọc nội dung hợp đồng và tóm tắt CHÍNH XÁC theo format chuẩn dưới đây.

QUY TẮC:
1. Xác định rõ Bên A và Bên B theo đúng nội dung hợp đồng.
2. Thời gian hiệu lực: nếu hợp đồng có ngày cụ thể (dd/mm/yyyy hoặc yyyy-mm-dd) → BẮT BUỘC ghi "Từ ngày dd/mm/yyyy đến ngày dd/mm/yyyy". KHÔNG dùng "12 tháng" nếu đã có ngày cụ thể.
3. Nếu có văn bản bổ sung (Phụ lục, Thanh lý, NDA, Biên bản nghiệm thu) → liệt kê riêng trong mục 4.
4. Văn phong pháp lý, ngắn gọn, không suy đoán ngoài tài liệu.

FORMAT BẮT BUỘC:
"[Loại hợp đồng] giữa [Bên A] và [Bên B] về [mục đích].

1. Nội dung chính:
- Mục tiêu: ...
- Nội dung: ...
- Phối hợp triển khai: ...

2. Thời gian hiệu lực:
[Ưu tiên ngày cụ thể]

3. Chấm dứt:
[điều kiện chấm dứt]

4. Văn bản bổ sung:
- [Loại]: [Tóm tắt]
"

Chỉ thêm mục 4 nếu có văn bản bổ sung. Trả về DUY NHẤT phần mô tả (text thuần), không kèm JSON, không kèm tiêu đề khác.`;

    const userPayload = {
      contract_title: contract.title,
      partner_name: contract.partner_name,
      main_contract: truncated,
      attachments,
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Hãy viết mô tả hợp đồng theo format chuẩn dựa trên dữ liệu sau:\n\n${JSON.stringify(userPayload)}` },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Vượt giới hạn yêu cầu, vui lòng thử lại sau." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Cần nạp thêm credit để sử dụng AI." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Lỗi AI gateway" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const description = (data.choices?.[0]?.message?.content || "").trim();
    if (!description) {
      return new Response(JSON.stringify({ error: "AI không trả về mô tả" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ description }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("regenerate-contract-description error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
