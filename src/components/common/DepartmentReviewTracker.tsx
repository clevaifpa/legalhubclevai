import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Clock, AlertTriangle } from "lucide-react";
import {
    type ReviewDepartment,
    type DepartmentReviewStatus,
    REVIEW_DEPARTMENTS,
    DEPARTMENT_REVIEW_STATUS_LABELS,
    DEPARTMENT_REVIEW_STATUS_COLORS,
    getReviewProgress,
} from "@/types/reviewDepartments";
import { formatDate } from "@/lib/format";

interface DepartmentReviewTrackerProps {
    deptReviews: Record<ReviewDepartment, DepartmentReviewStatus>;
    compact?: boolean;
}

const StatusIcon = ({ status }: { status: DepartmentReviewStatus["status"] }) => {
    switch (status) {
        case "approved":
            return <Check className="h-3.5 w-3.5 text-green-600" />;
        case "rejected":
            return <X className="h-3.5 w-3.5 text-red-600" />;
        case "needs_revision":
            return <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />;
        default:
            return <Clock className="h-3.5 w-3.5 text-gray-400" />;
    }
};

export function DepartmentReviewTracker({ deptReviews, compact = false }: DepartmentReviewTrackerProps) {
    const progress = getReviewProgress(deptReviews);
    const departments = Object.keys(REVIEW_DEPARTMENTS) as ReviewDepartment[];

    if (compact) {
        return (
            <div className="flex items-center gap-1.5">
                {departments.map((dept) => {
                    const review = deptReviews[dept];
                    const config = REVIEW_DEPARTMENTS[dept];
                    return (
                        <Tooltip key={dept}>
                            <TooltipTrigger asChild>
                                <div
                                    className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all ${review.status === "approved"
                                            ? "border-green-400 bg-green-50"
                                            : review.status === "rejected"
                                                ? "border-red-400 bg-red-50"
                                                : review.status === "needs_revision"
                                                    ? "border-yellow-400 bg-yellow-50"
                                                    : "border-gray-200 bg-gray-50"
                                        }`}
                                >
                                    <span className="text-xs">{config.icon}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                                <p className="font-semibold">{config.label}</p>
                                <p>{DEPARTMENT_REVIEW_STATUS_LABELS[review.status]}</p>
                                {review.reviewerName && (
                                    <p className="text-muted-foreground">
                                        Bởi: {review.reviewerName}
                                    </p>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
                <span className="text-xs text-muted-foreground ml-1">
                    {progress.completed}/{progress.total}
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Progress bar */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Tiến trình review</span>
                    <span className="font-semibold">{progress.completed}/{progress.total} phòng ban</span>
                </div>
                <Progress value={progress.percentage} className="h-2" />
            </div>

            {/* Department cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {departments.map((dept) => {
                    const review = deptReviews[dept];
                    const config = REVIEW_DEPARTMENTS[dept];
                    return (
                        <div
                            key={dept}
                            className={`p-3 rounded-lg border transition-all ${review.status === "pending"
                                    ? "bg-muted/30 border-muted"
                                    : review.status === "approved"
                                        ? "bg-green-50/50 border-green-200"
                                        : review.status === "rejected"
                                            ? "bg-red-50/50 border-red-200"
                                            : "bg-yellow-50/50 border-yellow-200"
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{config.icon}</span>
                                    <span className="text-xs font-semibold">{config.label}</span>
                                </div>
                                <StatusIcon status={review.status} />
                            </div>
                            <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 ${DEPARTMENT_REVIEW_STATUS_COLORS[review.status]}`}
                            >
                                {DEPARTMENT_REVIEW_STATUS_LABELS[review.status]}
                            </Badge>
                            {review.reviewerName && (
                                <p className="text-[10px] text-muted-foreground mt-1.5 truncate">
                                    {review.reviewerName} • {review.reviewedAt ? formatDate(review.reviewedAt) : ""}
                                </p>
                            )}
                            {review.notes && (
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 italic">
                                    "{review.notes}"
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
