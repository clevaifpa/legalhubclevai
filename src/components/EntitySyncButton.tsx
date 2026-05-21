import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface SyncLog {
  id: string;
  entity_name: string;
  tab_name: string;
  status: string;
  total_rows: number;
  imported_count: number;
  skipped_count: number;
  error_count: number;
  errors: any[];
  started_at: string;
  finished_at: string | null;
  triggered_by: string;
}

interface EntitySyncButtonProps {
  entityName: string;
  isAdmin: boolean;
  onSyncComplete?: () => void | Promise<void>;
}

export function EntitySyncButton({ entityName, isAdmin, onSyncComplete }: EntitySyncButtonProps) {

  const [syncing, setSyncing] = useState(false);
  const [lastLog, setLastLog] = useState<SyncLog | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);

  const fetchLastLog = useCallback(async () => {
    const { data } = await supabase
      .from("sync_logs")
      .select("*")
      .eq("entity_name", entityName)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) setLastLog(data[0] as unknown as SyncLog);
  }, [entityName]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("sync_logs")
      .select("*")
      .eq("entity_name", entityName)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setLogs(data as unknown as SyncLog[]);
  }, [entityName]);

  useEffect(() => {
    fetchLastLog();
  }, [fetchLastLog]);

  useEffect(() => {
    if (logsOpen) fetchLogs();
  }, [logsOpen, fetchLogs]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/sync-google-sheet`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            entity_name: entityName,
            tab_name: entityName, // tab name = entity name
          }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        toast.error("Lỗi đồng bộ", { description: result.error || "Lỗi không xác định" });
      } else {
        toast.success("Đã đồng bộ dữ liệu từ Google Sheet", {
          description: `Mới: ${result.imported || 0} | Cập nhật: ${result.updated || 0} | Bỏ qua: ${result.skipped || 0} | Lỗi: ${result.errors || 0}`,
        });
        try { await onSyncComplete?.(); } catch (e) { console.error("onSyncComplete error", e); }
      }

    } catch (err: any) {
      toast.error("Lỗi kết nối", { description: err.message });
    } finally {
      setSyncing(false);
      fetchLastLog();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "done": return <CheckCircle className="h-3.5 w-3.5 text-green-600" />;
      case "error": return <XCircle className="h-3.5 w-3.5 text-destructive" />;
      case "running": return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "done": return "Hoàn tất";
      case "error": return "Lỗi";
      case "running": return "Đang chạy";
      default: return status;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          disabled={syncing}
          onClick={(e) => { e.stopPropagation(); handleSync(); }}
        >
          {syncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {syncing ? "Đang tải..." : "Tải từ Google Sheet"}
        </Button>
      )}

      {lastLog && (
        <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
          <DialogTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {statusIcon(lastLog.status)}
              <span>{formatTime(lastLog.started_at)}</span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Nhật ký đồng bộ — {entityName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Import</TableHead>
                    <TableHead>Bỏ qua</TableHead>
                    <TableHead>Lỗi</TableHead>
                    <TableHead>Nguồn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{statusIcon(log.status)}</TableCell>
                      <TableCell className="text-xs">{formatTime(log.started_at)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{log.imported_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.skipped_count}</Badge>
                      </TableCell>
                      <TableCell>
                        {log.error_count > 0 ? (
                          <Badge variant="destructive" className="text-xs">{log.error_count}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.triggered_by === "manual" ? "Thủ công" : "Tự động"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Chưa có lịch sử đồng bộ
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Show errors of last sync if any */}
              {logs.length > 0 && logs[0].error_count > 0 && Array.isArray(logs[0].errors) && logs[0].errors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive">Chi tiết lỗi (lần sync gần nhất)</h4>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 space-y-1 max-h-40 overflow-y-auto">
                    {logs[0].errors.map((err: any, i: number) => (
                      <p key={i} className="text-xs">
                        {err.row ? `Dòng ${err.row}` : ""} {err.title ? `"${err.title}"` : ""}: {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
