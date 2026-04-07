import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

interface SheetRow {
  rowIndex: number;
  title: string;         // A
  partnerName: string;   // B
  taxCode: string;       // C
  status: string;        // D
  effectiveDate: string; // E
  expiryDate: string;    // F
  value: string;         // G
  department: string;    // H
  description: string;   // I
  contractType: string;  // J
  phaseName1: string;    // K - phase name
  phaseAmount1: string;  // L - phase amount
  phaseDate1: string;    // M - phase due date
  fileUrl: string;       // N - PDF link
  approvedPe: string;    // O - Approved PE number
  syncStatus: string;    // P - READY / DONE
}

// Parse Google Service Account JSON and create JWT for auth
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

  // Import private key
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

  // Exchange JWT for access token
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

function parseDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  // Try DD/MM/YYYY
  const dmy = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try YYYY-MM-DD
  const ymd = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return val;
  return null;
}

function mapStatus(val: string): string {
  const lower = val.toLowerCase().trim();
  if (lower.includes("đã ký") || lower === "da_ky") return "da_ky";
  if (lower.includes("hết hiệu lực") || lower.includes("het_hieu_luc")) return "het_hieu_luc";
  if (lower.includes("thanh lý") || lower === "da_thanh_ly") return "da_thanh_ly";
  return "da_ky"; // default
}

function parseRow(row: string[], rowIndex: number): SheetRow {
  const get = (i: number) => (row[i] || "").trim();
  return {
    rowIndex,
    title: get(0),
    partnerName: get(1),
    taxCode: get(2),
    status: get(3),
    effectiveDate: get(4),
    expiryDate: get(5),
    value: get(6),
    department: get(7),
    description: get(8),
    contractType: get(9),
    phaseName1: get(10),
    phaseAmount1: get(11),
    phaseDate1: get(12),
    fileUrl: get(13),
    approvedPe: get(14),
    syncStatus: get(15),
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
        // Check admin role
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
      // Get access token
      const accessToken = await getAccessToken(serviceAccountKey);

      // Read sheet data
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

      // Skip header row, parse data rows
      const dataRows = rows.slice(1).map((r, i) => parseRow(r, i + 2)); // +2 because sheet is 1-indexed + header

      // Filter only READY rows
      const readyRows = dataRows.filter((r) => r.syncStatus.toUpperCase() === "READY");

      let imported = 0;
      let skipped = 0;
      let errorCount = 0;
      const errors: { row: number; title: string; error: string }[] = [];

      // Get existing file URLs to check duplicates
      const { data: existingContracts } = await supabase
        .from("contracts")
        .select("file_url")
        .not("file_url", "is", null);
      const existingUrls = new Set(
        (existingContracts || []).map((c: any) => c.file_url).filter(Boolean)
      );

      // Get or create category for this entity + contract type
      const categoryCache: Record<string, string> = {};
      const { data: existingCats } = await supabase
        .from("contract_categories")
        .select("id, name");
      (existingCats || []).forEach((c: any) => {
        categoryCache[c.name.toLowerCase()] = c.id;
      });

      for (const row of readyRows) {
        try {
          // Validate required fields
          if (!row.title) {
            errors.push({ row: row.rowIndex, title: "(trống)", error: "Thiếu tên hợp đồng" });
            errorCount++;
            continue;
          }

          // Check duplicate PDF link
          if (row.fileUrl && existingUrls.has(row.fileUrl)) {
            skipped++;
            // Still mark as DONE since it's already imported
            await updateSheetCell(accessToken, sheetId, tab_name, row.rowIndex, "DONE");
            continue;
          }

          // Resolve category
          const contractTypeName = row.contractType || "Khác";
          const fullCatName = `${entity_name} - ${contractTypeName}`;
          let categoryId = categoryCache[fullCatName.toLowerCase()];

          if (!categoryId) {
            // Create new category
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
            categoryCache[fullCatName.toLowerCase()] = categoryId;
          }

          // Parse value
          const rawValue = row.value.replace(/[.,\s]/g, "");
          const numValue = parseInt(rawValue) || 0;

          // Insert contract
          const { data: insertedContract, error: insertErr } = await supabase
            .from("contracts")
            .insert({
              title: row.title,
              partner_name: row.partnerName || "",
              tax_code: row.taxCode || "",
              status: mapStatus(row.status || "da_ky"),
              effective_date: parseDate(row.effectiveDate),
              expiry_date: parseDate(row.expiryDate),
              value: numValue,
              department: row.department || "",
              contract_type: "khac",
              risk_level: "thap",
              category_id: categoryId,
              file_url: row.fileUrl || null,
              approved_pe_number: row.approvedPe || "",
            })
            .select()
            .single();

          if (insertErr) {
            errors.push({ row: row.rowIndex, title: row.title, error: insertErr.message });
            errorCount++;
            continue;
          }

          // Insert payment phase if provided
          if (row.phaseName1 && insertedContract) {
            const phaseAmount = parseInt(row.phaseAmount1.replace(/[.,\s]/g, "")) || 0;
            await supabase.from("contract_payment_schedules").insert({
              contract_id: insertedContract.id,
              phase_name: row.phaseName1,
              payment_amount: phaseAmount,
              payment_due_date: parseDate(row.phaseDate1),
            });
          }

          // Mark as DONE in sheet
          await updateSheetCell(accessToken, sheetId, tab_name, row.rowIndex, "DONE");

          if (row.fileUrl) existingUrls.add(row.fileUrl);
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
      // Update log as error
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
