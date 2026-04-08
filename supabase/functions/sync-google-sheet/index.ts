import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// CORRECT COLUMN MAPPING:
// A=title, B=partner, C=taxCode, D=contractType, E=(unused), F=status,
// G=value, H=effectiveDate, I=expiryDate, J=folderLink, K=pdfLink, L=docLink,
// M=(unused), N=description, O=approvedPe, P=syncStatus
interface SheetRow {
  rowIndex: number;
  title: string;         // A
  partnerName: string;   // B
  taxCode: string;       // C
  contractType: string;  // D
  col_e: string;         // E (unused)
  status: string;        // F
  value: string;         // G
  effectiveDate: string; // H
  expiryDate: string;    // I
  folderLink: string;    // J
  pdfLink: string;       // K
  docLink: string;       // L
  col_m: string;         // M (unused)
  description: string;   // N
  approvedPe: string;    // O
  syncStatus: string;    // P
}

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
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to get access token: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function getSheetData(
  accessToken: string,
  spreadsheetId: string,
  tabName: string
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:P`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to read sheet tab "${tabName}": ${errText}`);
  }
  const data = await res.json();
  return data.values || [];
}

async function updateSheetCell(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  row: number,
  value: string
): Promise<void> {
  const range = `${tabName}!P${row}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Failed to update cell P${row}: ${errText}`);
  }
}

function normalize(text: string | undefined): string {
  return (text || "").trim().toLowerCase();
}

function parseDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    let yearNum = parseInt(y);
    if (yearNum < 100) yearNum += 2000;
    const dayNum = parseInt(d);
    const monthNum = parseInt(m);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    if (result.getUTCDate() !== dayNum || result.getUTCMonth() !== monthNum - 1) return null;
    return `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
  }
  // Try YYYY-MM-DD
  const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return trimmed;
  return null;
}

function isValidUrl(url: string | undefined): boolean {
  return !!url && url.trim().startsWith("http");
}

function mapStatus(val: string): string {
  const lower = normalize(val);
  if (!lower) return "da_ky";

  // Exact matches first
  if (lower === "đã ký" || lower === "da_ky") return "da_ky";
  if (lower === "đã hết hạn" || lower === "het_hieu_luc") return "het_hieu_luc";
  if (lower.includes("chưa hoàn thành") || lower.includes("chua_hoan_thanh") || lower.includes("chtnv")) return "het_hieu_luc"; // stored as het_hieu_luc + hidden flag
  if (lower === "đã thanh lý" || lower === "da_thanh_ly") return "da_thanh_ly";

  // Partial matches
  if (lower.includes("đã ký")) return "da_ky";
  if (lower.includes("hết hạn") || lower.includes("hết hiệu lực")) return "het_hieu_luc";
  if (lower.includes("thanh lý")) return "da_thanh_ly";

  return "da_ky"; // default
}

function needsHiddenFlag(val: string): boolean {
  const lower = normalize(val);
  return lower.includes("chưa hoàn thành") || lower.includes("chua_hoan_thanh") || lower.includes("chtnv");
}

function parseRow(row: string[], rowIndex: number): SheetRow {
  const get = (i: number) => (row[i] || "").trim();
  return {
    rowIndex,
    title: get(0),         // A
    partnerName: get(1),   // B
    taxCode: get(2),       // C
    contractType: get(3),  // D
    col_e: get(4),         // E (unused)
    status: get(5),        // F
    value: get(6),         // G
    effectiveDate: get(7), // H
    expiryDate: get(8),    // I
    folderLink: get(9),    // J
    pdfLink: get(10),      // K
    docLink: get(11),      // L
    col_m: get(12),        // M (unused)
    description: get(13),  // N
    approvedPe: get(14),   // O
    syncStatus: get(15),   // P
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured");
    }
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    if (!sheetId) {
      throw new Error("GOOGLE_SHEET_ID is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check - only admin can trigger sync
    const authHeader = req.headers.get("Authorization");
    let triggeredBy = "cron";
    
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      if (!authError && userData?.user) {
        triggeredBy = "manual";
        const { data: isAdmin } = await supabase.rpc("has_role", {
          _user_id: userData.user.id,
          _role: "admin",
        });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Chỉ admin mới có thể đồng bộ" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const { entity_name, tab_name } = body as { entity_name?: string; tab_name?: string };

    if (!entity_name || !tab_name) {
      return new Response(
        JSON.stringify({ error: "entity_name and tab_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create sync log entry
    const { data: logEntry, error: logError } = await supabase
      .from("sync_logs")
      .insert({
        entity_name,
        tab_name,
        status: "running",
        triggered_by: triggeredBy,
      })
      .select()
      .single();

    if (logError) {
      throw new Error(`Failed to create sync log: ${logError.message}`);
    }

    const logId = logEntry.id;

    try {
      const accessToken = await getAccessToken(serviceAccountKey);
      const rows = await getSheetData(accessToken, sheetId, tab_name);

      if (rows.length <= 1) {
        await supabase.from("sync_logs").update({
          status: "done",
          total_rows: 0,
          finished_at: new Date().toISOString(),
        }).eq("id", logId);

        return new Response(
          JSON.stringify({ success: true, imported: 0, skipped: 0, errors: 0, message: "Không có dữ liệu" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dataRows = rows.slice(1).map((r, i) => parseRow(r, i + 2));
      const readyRows = dataRows.filter((r) => normalize(r.syncStatus) === "ready");

      let imported = 0;
      let skipped = 0;
      let errorCount = 0;
      const errors: { row: number; title: string; error: string }[] = [];

      // Check duplicates by all link URLs
      const { data: existingDocs } = await supabase
        .from("contract_related_docs")
        .select("doc_url");
      const existingDocUrls = new Set(
        (existingDocs || []).map((d: any) => d.doc_url).filter(Boolean)
      );
      const { data: existingContracts } = await supabase
        .from("contracts")
        .select("file_url")
        .not("file_url", "is", null);
      const existingFileUrls = new Set(
        (existingContracts || []).map((c: any) => c.file_url).filter(Boolean)
      );

      // Category cache
      const categoryCache: Record<string, string> = {};
      const { data: existingCats } = await supabase
        .from("contract_categories")
        .select("id, name");
      (existingCats || []).forEach((c: any) => {
        categoryCache[normalize(c.name)] = c.id;
      });

      for (const row of readyRows) {
        try {
          // Validate required: title (A)
          if (!row.title) {
            errors.push({ row: row.rowIndex, title: "(trống)", error: "Thiếu tên hợp đồng (cột A)" });
            errorCount++;
            continue;
          }

          // Validate: at least one link (J/K/L)
          const links = [
            { type: "folder", url: row.folderLink },
            { type: "pdf", url: row.pdfLink },
            { type: "doc", url: row.docLink },
          ].filter(l => isValidUrl(l.url));

          // Check duplicate by any link
          const isDuplicate = links.some(l => existingDocUrls.has(l.url) || existingFileUrls.has(l.url));
          if (isDuplicate) {
            skipped++;
            await updateSheetCell(accessToken, sheetId, tab_name, row.rowIndex, "DONE");
            continue;
          }

          // Resolve category from contractType (col D)
          const contractTypeName = row.contractType || "Khác";
          const fullCatName = `${entity_name} - ${contractTypeName}`;
          let categoryId = categoryCache[normalize(fullCatName)];

          if (!categoryId) {
            const { data: newCat, error: catErr } = await supabase
              .from("contract_categories")
              .insert({ name: fullCatName, description: `Tự tạo từ Google Sheet sync` })
              .select()
              .single();
            if (catErr) {
              errors.push({ row: row.rowIndex, title: row.title, error: `Lỗi tạo loại HĐ: ${catErr.message}` });
              errorCount++;
              continue;
            }
            categoryId = newCat.id;
            categoryCache[normalize(fullCatName)] = categoryId;
          }

          // Parse value
          const rawValue = row.value.replace(/[.,\s]/g, "");
          const numValue = parseInt(rawValue) || 0;

          // Parse dates
          const effectiveDate = parseDate(row.effectiveDate);
          const expiryDate = parseDate(row.expiryDate);

          // Map status
          const dbStatus = mapStatus(row.status);
          const addHiddenFlag = needsHiddenFlag(row.status);

          // Use first valid link as file_url for backward compatibility
          const primaryLink = links.length > 0 ? links[0].url : null;

          // Insert contract
          const { data: insertedContract, error: insertErr } = await supabase
            .from("contracts")
            .insert({
              title: row.title,
              partner_name: row.partnerName || "",
              tax_code: row.taxCode || "",
              status: dbStatus,
              effective_date: effectiveDate,
              expiry_date: expiryDate,
              value: numValue,
              department: "",
              contract_type: "khac",
              risk_level: "thap",
              category_id: categoryId,
              file_url: primaryLink,
              approved_pe_number: row.approvedPe || "",
              description: row.description || "",
            })
            .select()
            .single();

          if (insertErr) {
            errors.push({ row: row.rowIndex, title: row.title, error: insertErr.message });
            errorCount++;
            continue;
          }

          // Insert all links as contract_related_docs
          if (insertedContract) {
            for (const link of links) {
              const docType = link.type === "folder" ? "folder" : link.type === "pdf" ? "pdf" : "doc";
              await supabase.from("contract_related_docs").insert({
                contract_id: insertedContract.id,
                doc_type: docType,
                doc_name: link.type === "folder" ? "Folder" : link.type === "pdf" ? "PDF" : "DOC",
                doc_url: link.url,
              });
              existingDocUrls.add(link.url);
            }

            // Add hidden flag for CHTNV status
            if (addHiddenFlag) {
              await supabase.from("contract_payment_schedules").insert({
                contract_id: insertedContract.id,
                phase_name: "[HIDDEN] CHUA_HOAN_THANH",
                payment_amount: 0,
                payment_due_date: null,
              });
            }
          }

          if (primaryLink) existingFileUrls.add(primaryLink);

          // Mark as DONE in sheet
          await updateSheetCell(accessToken, sheetId, tab_name, row.rowIndex, "DONE");
          imported++;
        } catch (rowErr: any) {
          errors.push({ row: row.rowIndex, title: row.title, error: rowErr.message });
          errorCount++;
        }
      }

      // Update sync log
      await supabase.from("sync_logs").update({
        status: "done",
        total_rows: readyRows.length,
        imported_count: imported,
        skipped_count: skipped,
        error_count: errorCount,
        errors: errors,
        finished_at: new Date().toISOString(),
      }).eq("id", logId);

      return new Response(
        JSON.stringify({
          success: true,
          imported,
          skipped,
          errors: errorCount,
          total: readyRows.length,
          details: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (syncErr: any) {
      await supabase.from("sync_logs").update({
        status: "error",
        errors: [{ error: syncErr.message }],
        finished_at: new Date().toISOString(),
      }).eq("id", logId);

      throw syncErr;
    }
  } catch (err: any) {
    console.error("Sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
