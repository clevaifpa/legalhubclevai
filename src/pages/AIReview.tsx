import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Upload, FileText, Sparkles, ShieldCheck, ShieldAlert, Shield, AlertTriangle, CheckCircle, Loader2, Lightbulb, History, Link2, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";

interface AnalysisResult {
  summary: string;
  riskLevel: string;
  issues: { clause: string; riskLevel: string; reason: string; suggestion: string }[];
  missingClauses: string[];
  recommendations: string[];
}

interface AIReviewHistoryItem {
  id: string;
  contract_text: string;
  summary: string;
  risk_level: string;
  issues: { clause: string; riskLevel: string; reason: string; suggestion: string }[];
  missing_clauses: string[];
  recommendations: string[];
  created_at: string;
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
  const [history, setHistory] = useState<AIReviewHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const deleteHistoryItem = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bản ghi lịch sử này không?")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("ai_review_history")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      setHistory(prev => prev.filter(item => item.id !== id));
      toast.success("Đã xóa bản ghi lịch sử");
    } catch (e: any) {
      toast.error("Không thể xóa bản ghi", { description: e.message });
    }
  };

  const PAGE_SIZE = 20;

  const loadHistory = async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) setLoadingHistory(true);
      else setLoadingMore(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHistory([]);
        setHasMore(false);
        return;
      }

      const from = (pageNumber - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("ai_review_history")
        .select("id, contract_text, summary, risk_level, issues, missing_clauses, recommendations, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const newItems = (data || []) as unknown as AIReviewHistoryItem[];

      if (pageNumber === 1) {
        setHistory(newItems);
      } else {
        setHistory((prev) => [...prev, ...newItems]);
      }

      setHasMore(newItems.length === PAGE_SIZE);
    } catch (e: any) {
      toast.error("Không tải được lịch sử AI kiểm tra", { description: e.message });
    } finally {
      setLoadingHistory(false);
      setLoadingMore(false);
    }
  };


  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadHistory(nextPage);
  };

  useEffect(() => {
    loadHistory(1);
  }, []);

  const saveHistory = async (payload: AnalysisResult, text: string) => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const { error } = await (supabase.from("ai_review_history") as any).insert({
      user_id: user.id,
      contract_text: text,
      summary: payload.summary,
      risk_level: payload.riskLevel,
      issues: payload.issues,
      missing_clauses: payload.missingClauses,
      recommendations: payload.recommendations,
    });

    if (error) throw error;
  };

  const handleAnalyze = async () => {
    if (!contractText.trim()) {
      toast.error("Vui lòng nhập nội dung hợp đồng");
      return;
    }
    setAnalyzing(true);
    setResult(null);

    try {
      const { data: clauses } = await supabase.from("clauses").select("name, content, risk_level");

      const { data, error } = await supabase.functions.invoke("analyze-contract", {
        body: { contractText: contractText.trim(), clauses: clauses || [] },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const analysisResult = data as AnalysisResult;
      setResult(analysisResult);

      try {
        await saveHistory(analysisResult, contractText.trim());
        setPage(1);
        await loadHistory(1);
      } catch (saveError: any) {
        toast.error("Phân tích xong nhưng lưu lịch sử thất bại", { description: saveError.message });
      }

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
          Sử dụng AI để phân tích, phát hiện rủi ro, đối chiếu điều khoản với pháp luật Việt Nam hiện hành và gợi ý chỉnh sửa hợp đồng
        </p>
      </div>

      <Tabs defaultValue="analyze" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analyze">Kiểm tra hợp đồng</TabsTrigger>
          <TabsTrigger value="history">Lịch sử AI kiểm tra</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze" className="space-y-6">
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

          {result && (
            <div className="space-y-4 animate-fade-in">
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
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-accent" />
                Lịch sử AI kiểm tra
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="text-sm text-muted-foreground">Đang tải lịch sử...</div>
              ) : history.length === 0 ? (
                <div className="text-sm text-muted-foreground">Chưa có dữ liệu lịch sử.</div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => {
                    const ItemIcon = RISK_ICONS[item.risk_level] || Shield;
                    const isExpanded = expandedItems[item.id] || false;

                    return (
                      <div key={item.id} className="border rounded-lg p-4 space-y-4 bg-card">
                        <div className="flex items-center justify-between gap-3 border-b pb-3">
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm font-medium">
                              {new Date(item.created_at).toLocaleString("vi-VN", {
                                dateStyle: "medium", timeStyle: "short"
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={RISK_COLORS[item.risk_level] || ""}>
                              <ItemIcon className="h-3 w-3 mr-1" />
                              {RISK_LABELS[item.risk_level] || item.risk_level}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => deleteHistoryItem(item.id)}
                              title="Xóa bản ghi này"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-foreground">
                              <Brain className="h-4 w-4 text-accent" /> Kết luận chung
                            </p>
                            <p className="text-sm bg-muted/50 p-3 rounded-md">{item.summary}</p>
                          </div>

                          {item.issues && item.issues.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-warning">
                                <AlertTriangle className="h-4 w-4" /> Điều khoản có rủi ro ({item.issues.length})
                              </p>
                              <div className="space-y-2">
                                {item.issues.map((issue, idx) => (
                                  <div key={idx} className="text-sm p-3 rounded-md border border-warning/20 bg-warning/5 space-y-1.5">
                                    <div className="font-medium flex justify-between">
                                      <span>{issue.clause}</span>
                                      <Badge variant="outline" className={`shrink-0 ${RISK_COLORS[issue.riskLevel] || ""}`}>
                                        {RISK_LABELS[issue.riskLevel] || issue.riskLevel}
                                      </Badge>
                                    </div>
                                    <div className="text-muted-foreground"><span className="font-medium text-destructive">Lý do:</span> {issue.reason}</div>
                                    <div className="text-muted-foreground"><span className="font-medium text-success">Gợi ý:</span> {issue.suggestion}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.missing_clauses && item.missing_clauses.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-info">
                                <FileText className="h-4 w-4" /> Điều khoản thiếu ({item.missing_clauses.length})
                              </p>
                              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                {item.missing_clauses.map((clause, idx) => (
                                  <li key={idx}>{clause}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {item.recommendations && item.recommendations.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-success">
                                <Lightbulb className="h-4 w-4" /> Khuyến nghị chung
                              </p>
                              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                                {item.recommendations.map((rec, idx) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <Separator className="my-2" />

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-foreground">Nội dung hợp đồng đã phân tích</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(item.id)}
                                className="h-7 text-xs px-2"
                              >
                                {isExpanded ? (
                                  <><ChevronUp className="h-3 w-3 mr-1" /> Thu gọn</>
                                ) : (
                                  <><ChevronDown className="h-3 w-3 mr-1" /> Xem toàn bộ</>
                                )}
                              </Button>
                            </div>
                            <div className={`text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md border ${isExpanded ? '' : 'line-clamp-4'}`}>
                              {item.contract_text}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {hasMore && history.length > 0 && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="w-full sm:w-auto"
                      >
                        {loadingMore ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải...</>
                        ) : (
                          "Tải thêm"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIReview;
