import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// COLUMN MAPPING: A=title, B=partner, C=taxCode, D=contractType, E=(unused), F=status,
// G=value, H=effectiveDate, I=expiryDate, J=folderLink, K=pdfLink, L=docLink,
// M=(unused), N=description, O=approvedPe, P=syncStatus
interface SheetRow {
  rowIndex: number;
  title: string;
  partnerName: string;
  taxCode: string;
  contractType: string;
  status: string;
  value: string;
  effectiveDate: string;
  expiryDate: string;
  folderLink: string;
  pdfLink: string;
  docLink: string;
  description: string;
  approvedPe: string;
  syncStatus: string;
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

function normalizeUrl(url: string | undefined): string {
  return (url || "").trim().toLowerCase();
}

function parseDate(val: string): string | null {
  if (!val || !val.trim()) return null;
  const trimmed = val.trim();
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
  if (lower === "đã ký" || lower === "da_ky") return "da_ky";
  if (lower === "đã hết hạn" || lower === "het_hieu_luc") return "het_hieu_luc";
  if (lower.includes("chưa hoàn thành") || lower.includes("chua_hoan_thanh") || lower.includes("chtnv")) return "het_hieu_luc";
  if (lower === "đã thanh lý" || lower === "da_thanh_ly") return "da_thanh_ly";
  if (lower.includes("đã ký")) return "da_ky";
  if (lower.includes("hết hạn") || lower.includes("hết hiệu lực")) return "het_hieu_luc";
  if (lower.includes("thanh lý")) return "da_thanh_ly";
  return "da_ky";
}

function needsHiddenFlag(val: string): boolean {
  const lower = normalize(val);
  return lower.includes("chưa hoàn thành") || lower.includes("chua_hoan_thanh") || lower.includes("chtnv");
}

function parseRow(row: string[], rowIndex: number): SheetRow {
  const get = (i: number) => (row[i] || "").trim();
  return {
    rowIndex,
    title: get(0),
    partnerName: get(1),
    taxCode: get(2),
    contractType: get(3),
    status: get(5),
    value: get(6),
    effectiveDate: get(7),
    expiryDate: get(8),
    folderLink: get(9),
    pdfLink: get(10),
    docLink: get(11),
    description: get(13),
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
    if (!serviceAccountKey) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not configured");
    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
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

    // Create sync log
    const { data: logEntry, error: logError } = await supabase
      .from("sync_logs")
      .insert({ entity_name, tab_name, status: "running", triggered_by: triggeredBy })
      .select()
      .single();

    if (logError) throw new Error(`Failed to create sync log: ${logError.message}`);
    const logId = logEntry.id;

    try {
      const accessToken = await getAccessToken(serviceAccountKey);
      const rows = await getSheetData(accessToken, sheetId, tab_name);

      if (rows.length <= 1) {
        await supabase.from("sync_logs").update({
          status: "done", total_rows: 0, finished_at: new Date().toISOString(),
        }).eq("id", logId);
        return new Response(
          JSON.stringify({ success: true, imported: 0, updated: 0, skipped: 0, errors: 0, message: "Không có dữ liệu" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dataRows = rows.slice(1).map((r, i) => parseRow(r, i + 2));
      const readyRows = dataRows.filter((r) => normalize(r.syncStatus) === "ready");

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errorCount = 0;
      const errors: { row: number; title: string; error: string }[] = [];

      // Build PDF URL → contract mapping for UPSERT
      const { data: existingDocs } = await supabase
        .from("contract_related_docs")
        .select("contract_id, doc_url, doc_type");
      
      // Map: normalized PDF url → contract_id
      const pdfUrlToContractId: Record<string, string> = {};
      (existingDocs || []).forEach((d: any) => {
        if (d.doc_type === "pdf" && d.doc_url) {
          pdfUrlToContractId[normalizeUrl(d.doc_url)] = d.contract_id;
        }
      });

      // Also check contracts.file_url for legacy PDF links
      const { data: existingContracts } = await supabase
        .from("contracts")
        .select("id, file_url");
      (existingContracts || []).forEach((c: any) => {
        if (c.file_url && normalizeUrl(c.file_url).includes("pdf")) {
          const key = normalizeUrl(c.file_url);
          if (!pdfUrlToContractId[key]) {
            pdfUrlToContractId[key] = c.id;
          }
        }
      });

      // Category cache
      const categoryCache: Record<string, string> = {};
      const { data: existingCats } = await supabase.from("contract_categories").select("id, name");
      (existingCats || []).forEach((c: any) => {
        categoryCache[normalize(c.name)] = c.id;
      });

      for (const row of readyRows) {
        try {
          // Validate: title required
          if (!row.title) {
            errors.push({ row: row.rowIndex, title: "(trống)", error: "Thiếu tên hợp đồng (cột A)" });
            errorCount++;
            continue;
          }

          // Build links
          const links = [
            { type: "folder", url: row.folderLink },
            { type: "pdf", url: row.pdfLink },
            { type: "doc", url: row.docLink },
          ].filter(l => isValidUrl(l.url));

          // CHECK DUPLICATE BY PDF (col K) ONLY
          const pdfUrl = normalizeUrl(row.pdfLink);
          const existingContractId = pdfUrl ? pdfUrlToContractId[pdfUrl] : null;

          // If PDF exists → UPSERT (update existing contract)
          if (existingContractId) {
            // Resolve category
            const contractTypeName = row.contractType || "Khác";
            const fullCatName = `${entity_name} - ${contractTypeName}`;
            let categoryId = categoryCache[normalize(fullCatName)];
            if (!categoryId) {
              const { data: newCat, error: catErr } = await supabase
                .from("contract_categories")
                .insert({ name: fullCatName, description: "Tự tạo từ Google Sheet sync" })
                .select().single();
              if (catErr) {
                errors.push({ row: row.rowIndex, title: row.title, error: `Lỗi tạo loại HĐ: ${catErr.message}` });
                errorCount++;
                continue;
              }
              categoryId = newCat.id;
              categoryCache[normalize(fullCatName)] = categoryId;
            }

            const rawValue = row.value.replace(/[.,\s]/g, "");
            const numValue = parseInt(rawValue) || 0;
            const effectiveDate = parseDate(row.effectiveDate);
            const expiryDate = parseDate(row.expiryDate);
            const dbStatus = mapStatus(row.status);

            // UPDATE existing contract
            const { error: updateErr } = await supabase
              .from("contracts")
              .update({
                title: row.title,
                partner_name: row.partnerName || "",
                tax_code: row.taxCode || "",
                status: dbStatus,
                effective_date: effectiveDate,
                expiry_date: expiryDate,
                value: numValue,
                category_id: categoryId,
                description: row.description || "",
                approved_pe_number: row.approvedPe || "",
              })
              .eq("id", existingContractId);

            if (updateErr) {
              errors.push({ row: row.rowIndex, title: row.title, error: `Update error: ${updateErr.message}` });
              errorCount++;
              continue;
            }

            // Update related docs: delete old synced docs and re-insert
            await supabase.from("contract_related_docs")
              .delete()
              .eq("contract_id", existingContractId)
              .in("doc_type", ["folder", "pdf", "doc"]);

            for (const link of links) {
              await supabase.from("contract_related_docs").insert({
                contract_id: existingContractId,
                doc_type: link.type,
                doc_name: link.type === "folder" ? "Folder" : link.type === "pdf" ? "PDF" : "DOC",
                doc_url: link.url,
              });
            }

            // Handle CHTNV flag
            const addHiddenFlag = needsHiddenFlag(row.status);
            // Remove old hidden flag
            await supabase.from("contract_payment_schedules")
              .delete()
              .eq("contract_id", existingContractId)
              .eq("phase_name", "[HIDDEN] CHUA_HOAN_THANH");
            
            if (addHiddenFlag) {
              await supabase.from("contract_payment_schedules").insert({
                contract_id: existingContractId,
                phase_name: "[HIDDEN] CHUA_HOAN_THANH",
                payment_amount: 0,
                payment_due_date: null,
              });
            }

            await updateSheetCell(accessToken, sheetId, tab_name, row.rowIndex, "DONE");
            updated++;
            continue;
          }

          // No existing PDF → CREATE new contract
          // Resolve category
          const contractTypeName = row.contractType || "Khác";
          const fullCatName = `${entity_name} - ${contractTypeName}`;
          let categoryId = categoryCache[normalize(fullCatName)];
          if (!categoryId) {
            const { data: newCat, error: catErr } = await supabase
              .from("contract_categories")
              .insert({ name: fullCatName, description: "Tự tạo từ Google Sheet sync" })
              .select().single();
            if (catErr) {
              errors.push({ row: row.rowIndex, title: row.title, error: `Lỗi tạo loại HĐ: ${catErr.message}` });
              errorCount++;
              continue;
            }
            categoryId = newCat.id;
            categoryCache[normalize(fullCatName)] = categoryId;
          }

          const rawValue = row.value.replace(/[.,\s]/g, "");
          const numValue = parseInt(rawValue) || 0;
          const effectiveDate = parseDate(row.effectiveDate);
          const expiryDate = parseDate(row.expiryDate);
          const dbStatus = mapStatus(row.status);
          const addHiddenFlag = needsHiddenFlag(row.status);
          const primaryLink = links.length > 0 ? links[0].url : null;

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

          if (insertedContract) {
            for (const link of links) {
              await supabase.from("contract_related_docs").insert({
                contract_id: insertedContract.id,
                doc_type: link.type,
                doc_name: link.type === "folder" ? "Folder" : link.type === "pdf" ? "PDF" : "DOC",
                doc_url: link.url,
              });
            }

            // Register new PDF in lookup for subsequent rows
            if (pdfUrl) {
              pdfUrlToContractId[pdfUrl] = insertedContract.id;
            }

            if (addHiddenFlag) {
              await supabase.from("contract_payment_schedules").insert({
                contract_id: insertedContract.id,
                phase_name: "[HIDDEN] CHUA_HOAN_THANH",
                payment_amount: 0,
                payment_due_date: null,
              });
            }
          }

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
          updated,
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
