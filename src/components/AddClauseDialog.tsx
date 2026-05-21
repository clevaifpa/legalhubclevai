import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CONTRACT_TYPE_LABELS, RISK_LEVEL_LABELS } from "@/types";
import type { ContractType, RiskLevel } from "@/types";
import { supabase } from "@/integrations/supabase/client";

interface AddClauseDialogProps {
    onSuccess: () => void;
}

export function AddClauseDialog({ onSuccess }: AddClauseDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [content, setContent] = useState("");
    const [contractType, setContractType] = useState<ContractType>("dich_vu");
    const [riskLevel, setRiskLevel] = useState<RiskLevel>("thap");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim() || !content.trim()) {
            toast.error("Vui lòng điền đầy đủ tên và nội dung điều khoản");
            return;
        }

        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("Vui lòng đăng nhập");
            setSaving(false);
            return;
        }

        const { error } = await supabase.from("clauses").insert({
            name: name.trim(),
            content: content.trim(),
            contract_type: contractType,
            risk_level: riskLevel,
            notes: notes.trim() || null,
            created_by: user.id,
        });

        setSaving(false);

        if (error) {
            toast.error("Không thể thêm điều khoản");
            return;
        }

        onSuccess();
        toast.success("Thêm điều khoản thành công");

        // Reset form
        setName("");
        setContent("");
        setNotes("");
        setContractType("dich_vu");
        setRiskLevel("thap");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0">
                    <Plus className="h-4 w-4 mr-2" />
                    Thêm điều khoản
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Thêm điều khoản mới</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Tên điều khoản *</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="VD: Điều khoản bảo mật thông tin"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Loại hợp đồng</label>
                            <Select value={contractType} onValueChange={(v: ContractType) => setContractType(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(CONTRACT_TYPE_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Mức rủi ro</label>
                            <Select value={riskLevel} onValueChange={(v: RiskLevel) => setRiskLevel(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(RISK_LEVEL_LABELS).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Nội dung điều khoản *</label>
                        <Textarea
                            className="min-h-[120px]"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Nhập nội dung chi tiết của điều khoản..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Ghi chú (Tùy chọn)</label>
                        <Input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Quy định, lưu ý khi sử dụng..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Hủy</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                        Lưu điều khoản
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
