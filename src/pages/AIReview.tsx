import { Brain, Upload, FileText, ArrowRight, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AIReview = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Kiểm tra hợp đồng</h1>
        <p className="text-muted-foreground">
          Sử dụng AI để phân tích, phát hiện rủi ro và gợi ý chỉnh sửa hợp đồng
        </p>
      </div>

      {/* Upload Area */}
      <Card className="border-2 border-dashed border-accent/30 bg-accent/5 shadow-none">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-accent/10">
              <Upload className="h-8 w-8 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Tải lên hợp đồng cần kiểm tra</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Hỗ trợ file PDF, DOC, DOCX — Tối đa 20MB
              </p>
            </div>
            <div className="flex gap-3">
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Upload className="h-4 w-4 mr-2" />
                Chọn file
              </Button>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                id="contract-upload"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Cách hoạt động</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <div className="p-3 rounded-xl bg-info/10 mb-3">
                <FileText className="h-6 w-6 text-info" />
              </div>
              <h3 className="font-semibold text-sm mb-1">1. Tải lên hợp đồng</h3>
              <p className="text-xs text-muted-foreground">
                Upload file hợp đồng PDF hoặc Word cần kiểm tra
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <div className="p-3 rounded-xl bg-accent/10 mb-3">
                <Sparkles className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-sm mb-1">2. AI phân tích</h3>
              <p className="text-xs text-muted-foreground">
                Hệ thống tự động phân tích nội dung, phát hiện điều khoản rủi ro
              </p>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm">
            <CardContent className="p-5 flex flex-col items-center text-center">
              <div className="p-3 rounded-xl bg-success/10 mb-3">
                <ShieldCheck className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-semibold text-sm mb-1">3. Nhận kết quả</h3>
              <p className="text-xs text-muted-foreground">
                Xem báo cáo chi tiết với đánh dấu rủi ro và gợi ý chỉnh sửa
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Features */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            Tính năng AI Kiểm tra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Phát hiện điều khoản rủi ro</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tự động đánh dấu các điều khoản có mức độ rủi ro cao, giải thích lý do
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <ShieldCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">So sánh với kho điều khoản chuẩn</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Đối chiếu nội dung hợp đồng với các điều khoản mẫu đã được phê duyệt
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <Sparkles className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Gợi ý nội dung chỉnh sửa</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Đề xuất nội dung thay thế phù hợp cho các điều khoản cần chỉnh sửa
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 rounded-lg bg-info/5 border border-info/20 text-center">
        <p className="text-sm text-info font-medium">
          🚀 Tính năng AI Kiểm tra đang được phát triển. Hãy bật Lovable Cloud để sử dụng.
        </p>
      </div>
    </div>
  );
};

export default AIReview;
