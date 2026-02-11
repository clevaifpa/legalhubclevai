import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContractType } from "@/types";
import { CONTRACT_TYPE_LABELS } from "@/types";

interface ContractTypeBadgeProps {
  type: ContractType;
  className?: string;
}

const typeConfig: Record<ContractType, string> = {
  mua_ban: "bg-primary/10 text-primary border-primary/20",
  dich_vu: "bg-accent/10 text-accent border-accent/20",
  nda: "bg-violet-100 text-violet-700 border-violet-200",
  hop_tac: "bg-info/10 text-info border-info/20",
  lao_dong: "bg-orange-100 text-orange-700 border-orange-200",
  thue: "bg-emerald-100 text-emerald-700 border-emerald-200",
  khac: "bg-muted text-muted-foreground border-border",
};

export function ContractTypeBadge({ type, className }: ContractTypeBadgeProps) {
  return (
    <Badge variant="outline" className={cn("font-medium", typeConfig[type], className)}>
      {CONTRACT_TYPE_LABELS[type]}
    </Badge>
  );
}
