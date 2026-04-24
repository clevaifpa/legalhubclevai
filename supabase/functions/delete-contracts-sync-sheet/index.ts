import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

type ContractRow = {
  id: string;
  title: string;
  created_by: string | null;
  category_id: string | null;
  sheet_row_index: number | null;
  sheet_tab_name: string | null;
  sheet_entity_name: string | null;
};

type DeleteResult = {
  contractId: string;
  title: string;
  deleted: boolean;
  sheetUpdated: boolean;
  warning?: string;
  error?: string;
};

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const sa = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const unsignedToken = `${enc(header)}.${enc(payload)}`;
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken),
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsignedToken}.${sig}`,
  });

  if (!tokenRes.ok) throw new Error(`Không lấy được Google access token: ${await tokenRes.text()}`);
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function updateSheetStatus(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  rowIndex: number,
  value: "READY" | "DONE" | "REJECT",
): Promise<void> {
  const range = `${tabName}!P${rowIndex}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!res.ok) throw new Error(`Không cập nhật được ${range}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    if (!serviceAccountKey) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY chưa được cấu hình");
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID chưa được cấu hình");

    const supabase = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Bạn cần đăng nhập để xóa hợp đồng" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Phiên đăng nhập không hợp lệ" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const contractIds = Array.isArray(body.contractIds)
      ? body.contractIds.filter((id: unknown) => typeof id === "string" && id.length > 0)
      : [];
    if (contractIds.length === 0 || contractIds.length > 100) {
      return new Response(JSON.stringify({ error: "Danh sách hợp đồng không hợp lệ" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const [{ data: isAdmin }, { data: isManagerChung }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "manager_chung" }),
    ]);

    const { data: contracts, error: fetchError } = await supabase
      .from("contracts")
      .select("id,title,created_by,category_id,sheet_row_index,sheet_tab_name,sheet_entity_name")
      .in("id", contractIds);
    if (fetchError) throw fetchError;

    const found = new Set((contracts || []).map((c: ContractRow) => c.id));
    const results: DeleteResult[] = contractIds
      .filter((id: string) => !found.has(id))
      .map((id: string) => ({ contractId: id, title: "", deleted: false, sheetUpdated: false, error: "Không tìm thấy hợp đồng" }));

    const accessToken = await getAccessToken(serviceAccountKey);

    for (const contract of (contracts || []) as ContractRow[]) {
      if (!isAdmin && !isManagerChung && contract.created_by !== userId) {
        results.push({ contractId: contract.id, title: contract.title, deleted: false, sheetUpdated: false, error: "Bạn không có quyền xóa hợp đồng này" });
        continue;
      }

      let sheetUpdated = false;
      let warning: string | undefined;

      // First delete the contract from DB, then update Sheet to REJECT
      try {
        await supabase.from("contract_related_docs").delete().eq("contract_id", contract.id);
        await supabase.from("contract_payment_schedules").delete().eq("contract_id", contract.id);
        await supabase.from("edit_logs").delete().eq("record_id", contract.id).eq("table_name", "contracts");
        const { error: deleteError } = await supabase.from("contracts").delete().eq("id", contract.id);
        if (deleteError) throw deleteError;
      } catch (deleteErr) {
        const message = deleteErr instanceof Error ? deleteErr.message : "Lỗi xóa hợp đồng";
        console.error("Contract delete failed", { contractId: contract.id, error: message });
        results.push({ contractId: contract.id, title: contract.title, deleted: false, sheetUpdated: false, error: message });
        continue;
      }

      let sheetUpdated = false;
      let warning: string | undefined;

      if (contract.sheet_row_index && contract.sheet_tab_name) {
        try {
          await updateSheetStatus(accessToken, sheetId, contract.sheet_tab_name, contract.sheet_row_index, "REJECT");
          sheetUpdated = true;
        } catch (sheetErr) {
          const message = sheetErr instanceof Error ? sheetErr.message : "Lỗi cập nhật Google Sheet";
          console.error("Sheet update failed after deletion", { contractId: contract.id, row: contract.sheet_row_index, error: message });
          warning = `Đã xóa nhưng chưa cập nhật Google Sheet sang REJECT: ${message}`;
        }
      } else {
        warning = "Đã xóa nhưng hợp đồng không có mapping dòng Google Sheet";
        console.warn("Missing sheet mapping", { contractId: contract.id, title: contract.title });
      }

      results.push({ contractId: contract.id, title: contract.title, deleted: true, sheetUpdated, warning });
    }

    const deleted = results.filter((r) => r.deleted).length;
    const sheetUpdated = results.filter((r) => r.sheetUpdated).length;
    const warnings = results.filter((r) => r.warning).length;
    const errors = results.filter((r) => r.error).length;

    return new Response(JSON.stringify({ success: errors === 0, deleted, sheetUpdated, warnings, errors, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: errors > 0 && deleted === 0 ? 400 : 200,
    });
  } catch (err) {
    console.error("delete-contracts-sync-sheet error", err);
    const message = err instanceof Error ? err.message : "Lỗi xóa hợp đồng";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
