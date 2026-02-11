import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContractStatus, ReviewStatus } from "@/types";
import { CONTRACT_STATUS_LABELS, REVIEW_STATUS_LABELS } from "@/types";

type StatusType = ContractStatus | ReviewStatus;

interface StatusBadgeProps {
  status: StatusType;
  type?: "contract" | "review";
  className?: string;
}

const contractStatusConfig: Record<ContractStatus, string> = {
  nhap: "bg-muted text-muted-foreground border-border",
  dang_review: "bg-info/10 text-info border-info/20",
  da_ky: "bg-success/10 text-success border-success/20",
  het_hieu_luc: "bg-destructive/10 text-destructive border-destructive/20",
};

const reviewStatusConfig: Record<ReviewStatus, string> = {
  cho_xu_ly: "bg-muted text-muted-foreground border-border",
  dang_review: "bg-info/10 text-info border-info/20",
  yeu_cau_chinh_sua: "bg-warning/10 text-warning border-warning/20",
  da_phe_duyet: "bg-success/10 text-success border-success/20",
  tu_choi: "bg-destructive/10 text-destructive border-destructive/20",
};

function isContractStatus(status: StatusType): status is ContractStatus {
  return status in CONTRACT_STATUS_LABELS;
}

function isReviewStatus(status: StatusType): status is ReviewStatus {
  return status in REVIEW_STATUS_LABELS;
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  let classes = "";
  let label = "";

  if (type === "review" || isReviewStatus(status)) {
    classes = reviewStatusConfig[status as ReviewStatus] || "";
    label = REVIEW_STATUS_LABELS[status as ReviewStatus] || status;
  } else if (type === "contract" || isContractStatus(status)) {
    classes = contractStatusConfig[status as ContractStatus] || "";
    label = CONTRACT_STATUS_LABELS[status as ContractStatus] || status;
  }

  return (
    <Badge variant="outline" className={cn("font-medium", classes, className)}>
      {label}
    </Badge>
  );
}
