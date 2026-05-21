import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Upload, FileText, Sparkles, ShieldCheck, ShieldAlert, Shield, AlertTriangle, CheckCircle, Loader2, Lightbulb, History, Link2, FileUp, ClipboardEdit, Copy, Send, User as UserIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AnalysisResult {
  summary: string;
  riskLevel: string;
  issues: { clause: string; riskLevel: string; reason: string; suggestion: string; revisedClause: string }[];
  missingClauses: string[];
  recommendations: string[];
}

interface AIReviewHistoryItem {
  id: string;
  contract_text: string;
  contract_name?: string | null;
  summary: string;
  risk_level: string;
  issues: { clause: string; riskLevel: string; reason: string; suggestion: string; revisedClause?: string }[];
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
  const [contractName, setContractName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AIReviewHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [inputMode, setInputMode] = useState<"text" | "gdoc" | "file">("text");
  const [gdocUrl, setGdocUrl] = useState("");
  const [loadingGdoc, setLoadingGdoc] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [contractType, setContractType] = useState("auto");
  const [companyRole, setCompanyRole] = useState("ben_a");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || !result || chatLoading) return;
    const newMessages = [...chatMessages, { role: "user" as const, content: text }].slice(-20);
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-contract", {
        body: {
          messages: newMessages,
          contractSummary: result.summary,
          issues: result.issues,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setChatMessages((prev) => [...prev, { role: "assistant" as const, content: data?.reply || "" }].slice(-20));
    } catch (e: any) {
      toast.error("Lỗi chat", { description: e.message });
    } finally {
      setChatLoading(false);
    }
  };

  const handleLoadGdoc = async () => {
    const url = gdocUrl.trim();
    if (!url) {
      toast.error("Vui lòng nhập link Google Doc");
      return;
    }
    setLoadingGdoc(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-contract-from-doc", {
        body: { googleDocUrl: url, attachments: [], cacheBust: Date.now() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const text: string =
        data?.contractText ||
        data?.mo_ta ||
        "";
      if (!text.trim()) throw new Error("Không có nội dung trả về");
      setContractText(text);
      setInputMode("text");
      toast.success("Đã đọc tài liệu");
    } catch (e: any) {
      console.error(e);
      toast.error("Không đọc được tài liệu. Kiểm tra link đúng định dạng Google Doc và đã bật quyền xem chưa.");
    } finally {
      setLoadingGdoc(false);
    }
  };

  const handleFileSelected = async (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File vượt quá 10MB");
      return;
    }
    const name = file.name.toLowerCase();
    const isDocx = name.endsWith(".docx");
    const isPdf = name.endsWith(".pdf");
    if (!isDocx && !isPdf) {
      toast.error("Chỉ hỗ trợ file .pdf hoặc .docx");
      return;
    }
    setLoadingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      let text = "";
      if (isDocx) {
        const mammoth = await import("mammoth");
        const res = await mammoth.extractRawText({ arrayBuffer: buffer });
        text = res.value || "";
      } else {
        const pdfjs: any = await import("pdfjs-dist");
        const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        const pdf = await pdfjs.getDocument({ data: buffer }).promise;
        const parts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          parts.push(content.items.map((it: any) => it.str).join(" "));
        }
        text = parts.join("\n\n");
      }
      if (!text.trim()) throw new Error("File rỗng");
      setContractText(text);
      setInputMode("text");
      toast.success("Đã đọc file");
    } catch (e) {
      console.error(e);
      toast.error("Không đọc được file. Thử dán text trực tiếp.");
    } finally {
      setLoadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };


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

  const saveHistory = async (payload: AnalysisResult, text: string, name: string) => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const { error } = await (supabase.from("ai_review_history") as any).insert({
      user_id: user.id,
      contract_text: text,
      contract_name: name.trim() || null,
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
    setChatMessages([]);
    setChatInput("");

    try {
      const { data: clauses } = await supabase.from("clauses").select("name, content, risk_level");

      const { data, error } = await supabase.functions.invoke("analyze-contract", {
        body: { contractText: contractText.trim(), clauses: clauses || [], contractType, companyRole },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const analysisResult = data as AnalysisResult;
      setResult(analysisResult);

      try {
        await saveHistory(analysisResult, contractText.trim(), contractName);
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
              <div className="space-y-1.5">
                <label htmlFor="contract-name" className="text-sm font-medium">Tên hợp đồng (tùy chọn)</label>
                <Input
                  id="contract-name"
                  value={contractName}
                  onChange={(e) => setContractName(e.target.value)}
                  placeholder="VD: Hợp đồng cung cấp dịch vụ ABC..."
                />
              </div>
              <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as any)} className="space-y-3">
                <TabsList className="grid grid-cols-3 w-full sm:w-auto">
                  <TabsTrigger value="text"><FileText className="h-4 w-4 mr-1.5" />Dán text</TabsTrigger>
                  <TabsTrigger value="gdoc"><Link2 className="h-4 w-4 mr-1.5" />Link Google Doc</TabsTrigger>
                  <TabsTrigger value="file"><FileUp className="h-4 w-4 mr-1.5" />Tải file lên</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="mt-3">
                  <Textarea
                    value={contractText}
                    onChange={(e) => setContractText(e.target.value)}
                    placeholder="Dán toàn bộ nội dung hợp đồng tại đây...&#10;&#10;VD: ĐIỀU 1: ĐỐI TƯỢNG HỢP ĐỒNG&#10;Bên A đồng ý cung cấp cho Bên B..."
                    rows={10}
                    className="resize-y"
                  />
                </TabsContent>

                <TabsContent value="gdoc" className="mt-3 space-y-3">
                  <Input
                    value={gdocUrl}
                    onChange={(e) => setGdocUrl(e.target.value)}
                    placeholder="Dán link Google Doc tại đây... (vd: https://docs.google.com/document/d/...)"
                    disabled={loadingGdoc}
                  />
                  <Button onClick={handleLoadGdoc} disabled={loadingGdoc || !gdocUrl.trim()} variant="secondary">
                    {loadingGdoc ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                    {loadingGdoc ? "Đang đọc tài liệu..." : "Đọc tài liệu"}
                  </Button>
                </TabsContent>

                <TabsContent value="file" className="mt-3">
                  <div
                    onDragOver={(e) => { e.preventDefault(); if (!loadingFile) setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (loadingFile) return;
                      handleFileSelected(e.dataTransfer.files?.[0]);
                    }}
                    onClick={() => !loadingFile && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragging ? "border-accent bg-accent/10" : "border-border bg-muted/30 hover:bg-muted/50"
                    } ${loadingFile ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e.target.files?.[0])}
                      disabled={loadingFile}
                    />
                    {loadingFile ? (
                      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-accent" />
                        Đang đọc file...
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <FileUp className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-medium">Kéo thả file hoặc bấm để chọn</p>
                        <p className="text-xs text-muted-foreground">Hỗ trợ .pdf, .docx (tối đa 10MB)</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Loại hợp đồng</label>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Tự động nhận diện</SelectItem>
                      <SelectItem value="mua_ban">Mua bán hàng hóa</SelectItem>
                      <SelectItem value="dich_vu">Dịch vụ & Phần mềm</SelectItem>
                      <SelectItem value="nda">NDA & Bảo mật</SelectItem>
                      <SelectItem value="lao_dong">Lao động</SelectItem>
                      <SelectItem value="thue_tai_san">Thuê tài sản</SelectItem>
                      <SelectItem value="hop_tac">Hợp tác kinh doanh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Công ty mình là</label>
                  <Select value={companyRole} onValueChange={setCompanyRole}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ben_a">Bên A</SelectItem>
                      <SelectItem value="ben_b">Bên B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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

          {result && (() => {
            const riskScore = result.riskLevel === "cao" ? 85 : result.riskLevel === "trung_binh" ? 60 : 25;
            return (
            <div className="space-y-4 animate-fade-in">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Brain className="h-5 w-5 text-accent" />
                    Kết quả phân tích
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed">{result.summary}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`rounded-lg border p-3 ${RISK_COLORS[result.riskLevel] || ""}`}>
                      <div className="text-[11px] font-medium opacity-80 flex items-center gap-1">
                        <RiskIcon className="h-3 w-3" /> Mức rủi ro
                      </div>
                      <div className="text-base font-semibold mt-1">{RISK_LABELS[result.riskLevel] || result.riskLevel}</div>
                    </div>
                    <div className="rounded-lg border p-3 bg-muted/30">
                      <div className="text-[11px] font-medium text-muted-foreground">Điểm</div>
                      <div className="text-base font-semibold mt-1">{riskScore}/100</div>
                    </div>
                    <div className="rounded-lg border p-3 bg-warning/5 border-warning/20">
                      <div className="text-[11px] font-medium text-warning">Số vấn đề</div>
                      <div className="text-base font-semibold mt-1">{result.issues.length}</div>
                    </div>
                    <div className="rounded-lg border p-3 bg-info/5 border-info/20">
                      <div className="text-[11px] font-medium text-info">Điều khoản thiếu</div>
                      <div className="text-base font-semibold mt-1">{result.missingClauses.length}</div>
                    </div>
                  </div>
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
                  <CardContent className="space-y-2">
                    {result.issues.map((issue, i) => {
                      const IssueIcon = RISK_ICONS[issue.riskLevel] || Shield;
                      const key = `issue-${i}`;
                      const open = expandedItems[key];
                      return (
                        <div key={i} className="rounded-lg border bg-card overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleExpand(key)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                          >
                            <p className="font-medium text-sm flex-1 truncate">{issue.clause}</p>
                            <Badge variant="outline" className={`shrink-0 ${RISK_COLORS[issue.riskLevel] || ""}`}>
                              <IssueIcon className="h-3 w-3 mr-1" />
                              {RISK_LABELS[issue.riskLevel]}
                            </Badge>
                            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                          </button>
                          {open && (
                            <div className="px-4 pb-4 space-y-2 border-t">
                              <div className="p-3 rounded bg-destructive/5 border border-destructive/10 mt-3">
                                <p className="text-xs font-medium text-destructive mb-1">⚠️ Lý do rủi ro</p>
                                <p className="text-sm text-muted-foreground">{issue.reason}</p>
                              </div>
                              <div className="p-3 rounded bg-success/5 border border-success/10">
                                <p className="text-xs font-medium text-success mb-1">✏️ Gợi ý chỉnh sửa</p>
                                <p className="text-sm text-muted-foreground">{issue.suggestion}</p>
                              </div>
                              {issue.revisedClause && (
                                <div className="p-3 rounded bg-info/5 border border-info/20 relative">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <p className="text-xs font-medium text-info flex items-center gap-1">
                                      <ClipboardEdit className="h-3 w-3" />
                                      📝 Nội dung đề xuất thay thế
                                    </p>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 -mt-1 -mr-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(issue.revisedClause);
                                        toast.success("Đã sao chép");
                                      }}
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Sao chép
                                    </Button>
                                  </div>
                                  <p className="text-sm text-foreground font-mono whitespace-pre-wrap leading-relaxed">{issue.revisedClause}</p>
                                </div>
                              )}
                            </div>
                          )}
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
                    <div className="flex flex-wrap gap-2">
                      {result.missingClauses.map((clause, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-info/10 text-info text-xs font-medium border border-info/20">
                          <AlertTriangle className="h-3 w-3" />
                          {clause}
                        </span>
                      ))}
                    </div>
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
                    <ol className="space-y-2">
                      {result.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <span><span className="text-muted-foreground mr-1">{i + 1}.</span>{rec}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </div>
            );
          })()}

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
                <div className="space-y-2">
                  {history.map((item) => {
                    const ItemIcon = RISK_ICONS[item.risk_level] || Shield;
                    const isExpanded = expandedItems[item.id] || false;
                    const histKey = `hist-${item.id}`;
                    const histOpen = expandedItems[histKey] || false;
                    const score = item.risk_level === "cao" ? 85 : item.risk_level === "trung_binh" ? 60 : 25;
                    const summarySnippet = item.summary?.slice(0, 80) || "Hợp đồng đã phân tích";
                    const hasName = !!item.contract_name?.trim();

                    return (
                      <div key={item.id} className="border rounded-lg bg-card overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                          <button
                            type="button"
                            onClick={() => toggleExpand(histKey)}
                            className="flex-1 flex items-center gap-3 text-left min-w-0"
                          >
                            <History className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold truncate ${hasName ? "" : "text-muted-foreground italic font-normal"}`}>
                                {hasName ? item.contract_name : "Không có tên"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{summarySnippet}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })}
                              </p>
                            </div>
                            <Badge className={`shrink-0 ${RISK_COLORS[item.risk_level] || ""}`}>
                              <ItemIcon className="h-3 w-3 mr-1" />
                              {RISK_LABELS[item.risk_level] || item.risk_level}
                            </Badge>
                            <span className="shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{score}/100</span>
                            {histOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => deleteHistoryItem(item.id)}
                            title="Xóa bản ghi này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {histOpen && (
                          <div className="px-4 pb-4 pt-3 space-y-4 border-t">
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
                              <div className="flex flex-wrap gap-2">
                                {item.missing_clauses.map((clause, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-info/10 text-info text-xs font-medium border border-info/20">
                                    <AlertTriangle className="h-3 w-3" />
                                    {clause}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.recommendations && item.recommendations.length > 0 && (
                            <div>
                              <p className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-success">
                                <Lightbulb className="h-4 w-4" /> Khuyến nghị chung
                              </p>
                              <ol className="space-y-1.5">
                                {item.recommendations.map((rec, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm">
                                    <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
                                    <span><span className="text-muted-foreground mr-1">{idx + 1}.</span>{rec}</span>
                                  </li>
                                ))}
                              </ol>
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
                        )}
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
