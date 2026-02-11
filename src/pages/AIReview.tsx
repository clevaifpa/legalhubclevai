import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Upload, FileText, Sparkles, ShieldCheck, ShieldAlert, Shield, AlertTriangle, CheckCircle, Loader2, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface AnalysisResult {
  summary: string;
  riskLevel: string;
  issues: { clause: string; riskLevel: string; reason: string; suggestion: string }[];
  missingClauses: string[];
  recommendations: string[];
}

const RISK_LABELS: Record<string, string> = { thap: "Thấp", trung_binh: "Trung bình", cao: "Cao" };
const RISK_COLORS: Record<string, string> = {
  thap: "bg-success/10 text-success border-success/20",
  trung_binh: "bg-warning/10 text-warning border-warning/20",
  cao: "bg-destructive/10 text-destructive border-destructive/20",
};
const RISK_ICONS: Record<string, typeof Shield> = { thap: ShieldCheck, trung_binh: Shield, cao: ShieldAlert };

const AIReview = () => {
  const [contractText, setContractText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!contractText.trim()) {
      toast.error("Vui lòng nhập nội dung hợp đồng");
      return;
    }
    setAnalyzing(true);
    setResult(null);

    try {
      // Fetch clauses for comparison
      const { data: clauses } = await supabase.from("clauses").select("name, content, risk_level");

      const { data, error } = await supabase.functions.invoke("analyze-contract", {
        body: { contractText: contractText.trim(), clauses: clauses || [] },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setResult(data);
      toast.success("Phân tích hoàn tất!");
    } catch (e: any) {
      toast.error("Lỗi phân tích", { description: e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const RiskIcon = result ? RISK_ICONS[result.riskLevel] || Shield : Shield;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Kiểm tra hợp đồng</h1>
        <p className="text-muted-foreground">
          Sử dụng AI để phân tích, phát hiện rủi ro và gợi ý chỉnh sửa hợp đồng
        </p>
      </div>

      {/* Input Area */}
      <Card className="border-2 border-dashed border-accent/30 bg-accent/5 shadow-none">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-accent/10">
              <Upload className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Nhập nội dung hợp đồng</h3>
              <p className="text-sm text-muted-foreground">Dán nội dung hợp đồng cần kiểm tra vào ô bên dưới</p>
            </div>
          </div>
          <Textarea
            value={contractText}
            onChange={(e) => setContractText(e.target.value)}
            placeholder="Dán toàn bộ nội dung hợp đồng tại đây...&#10;&#10;VD: ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG&#10;Bên A đồng ý cung cấp cho Bên B..."
            rows={10}
            className="resize-y"
          />
          <Button
            className="bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto"
            onClick={handleAnalyze}
            disabled={analyzing || !contractText.trim()}
          >
            {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {analyzing ? "Đang phân tích..." : "Phân tích hợp đồng"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-accent" />
                  Kết quả phân tích
                </CardTitle>
                <Badge className={RISK_COLORS[result.riskLevel] || ""}>
                  <RiskIcon className="h-3 w-3 mr-1" />
                  Rủi ro: {RISK_LABELS[result.riskLevel] || result.riskLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{result.summary}</p>
            </CardContent>
          </Card>

          {/* Issues */}
          {result.issues.length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Điều khoản có rủi ro ({result.issues.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.issues.map((issue, i) => {
                  const IssueIcon = RISK_ICONS[issue.riskLevel] || Shield;
                  return (
                    <div key={i} className="p-4 rounded-lg border bg-card space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-sm flex-1">{issue.clause}</p>
                        <Badge variant="outline" className={`shrink-0 ${RISK_COLORS[issue.riskLevel] || ""}`}>
                          <IssueIcon className="h-3 w-3 mr-1" />
                          {RISK_LABELS[issue.riskLevel]}
                        </Badge>
                      </div>
                      <div className="p-3 rounded bg-destructive/5 border border-destructive/10">
                        <p className="text-xs font-medium text-destructive mb-1">⚠️ Lý do rủi ro</p>
                        <p className="text-sm text-muted-foreground">{issue.reason}</p>
                      </div>
                      <div className="p-3 rounded bg-success/5 border border-success/10">
                        <p className="text-xs font-medium text-success mb-1">✏️ Gợi ý chỉnh sửa</p>
                        <p className="text-sm text-muted-foreground">{issue.suggestion}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Missing Clauses */}
          {result.missingClauses.length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-info" />
                  Điều khoản bắt buộc bị thiếu ({result.missingClauses.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.missingClauses.map((clause, i) => (
                    <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-info/5 border border-info/10">
                      <AlertTriangle className="h-4 w-4 text-info shrink-0 mt-0.5" />
                      <span className="text-sm">{clause}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-accent" />
                  Khuyến nghị
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/10">
                      <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* How it works (shown when no result) */}
      {!result && !analyzing && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Cách hoạt động</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-none shadow-sm">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <div className="p-3 rounded-xl bg-info/10 mb-3">
                  <FileText className="h-6 w-6 text-info" />
                </div>
                <h3 className="font-semibold text-sm mb-1">1. Nhập nội dung</h3>
                <p className="text-xs text-muted-foreground">Dán nội dung hợp đồng cần kiểm tra</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <div className="p-3 rounded-xl bg-accent/10 mb-3">
                  <Sparkles className="h-6 w-6 text-accent" />
                </div>
                <h3 className="font-semibold text-sm mb-1">2. AI phân tích</h3>
                <p className="text-xs text-muted-foreground">So sánh với kho điều khoản chuẩn, phát hiện rủi ro</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <div className="p-3 rounded-xl bg-success/10 mb-3">
                  <ShieldCheck className="h-6 w-6 text-success" />
                </div>
                <h3 className="font-semibold text-sm mb-1">3. Nhận kết quả</h3>
                <p className="text-xs text-muted-foreground">Báo cáo chi tiết với gợi ý chỉnh sửa</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReview;
