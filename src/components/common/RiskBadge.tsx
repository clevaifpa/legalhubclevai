import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";
import { RISK_LEVEL_LABELS } from "@/types";
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
  showIcon?: boolean;
}

const riskConfig: Record<RiskLevel, { classes: string; Icon: typeof Shield }> = {
  thap: {
    classes: "bg-success/10 text-success border-success/20 hover:bg-success/20",
    Icon: ShieldCheck,
  },
  trung_binh: {
    classes: "bg-warning/10 text-warning border-warning/20 hover:bg-warning/20",
    Icon: Shield,
  },
  cao: {
    classes: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
    Icon: ShieldAlert,
  },
};

export function RiskBadge({ level, className, showIcon = true }: RiskBadgeProps) {
  const config = riskConfig[level];
  const { Icon } = config;

  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", config.classes, className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      {RISK_LEVEL_LABELS[level]}
    </Badge>
  );
}
