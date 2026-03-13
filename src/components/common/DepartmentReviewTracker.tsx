import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    assignedReviewers?: Partial<Record<ReviewDepartment, { id: string; name: string }>>;
    compact?: boolean;
    skipManagerStep?: boolean;
    assignable?: boolean;
    reviewers?: any[];
    onAssignReviewer?: (dept: ReviewDepartment, reviewerId: string) => void;
}

const StatusText = ({ status }: { status: DepartmentReviewStatus["status"] }) => {
    switch (status) {
        case "approved": return <span className="text-green-600 font-semibold text-xs">✓</span>;
        case "rejected": return <span className="text-red-600 font-semibold text-xs">✗</span>;
        case "needs_revision": return <span className="text-yellow-600 font-semibold text-xs">!</span>;
        default: return <span className="text-gray-400 text-xs">—</span>;
    }
};

export function DepartmentReviewTracker({
    deptReviews,
    assignedReviewers = {},
    compact = false,
    skipManagerStep = false,
    assignable = false,
    reviewers = [],
    onAssignReviewer
}: DepartmentReviewTrackerProps) {
    const departments = (Object.keys(REVIEW_DEPARTMENTS) as ReviewDepartment[])
        .filter(dept => !(skipManagerStep && dept === "quan_ly"))
        .sort((a, b) => REVIEW_DEPARTMENTS[a].stepOrder - REVIEW_DEPARTMENTS[b].stepOrder);

    const total = departments.length;
    const completed = departments.filter((dept) => deptReviews[dept]?.status && deptReviews[dept].status !== "pending").length;
    const customProgress = { completed, total, percentage: Math.round((completed / total) * 100) || 0 };

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
                                    <span className="text-[10px] font-bold">{config.label.charAt(0)}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                                <p className="font-semibold">{config.label}</p>
                                <p>{DEPARTMENT_REVIEW_STATUS_LABELS[review.status]}</p>
                                {review.reviewerName ? (
                                    <p className="text-muted-foreground">Người duyệt: {review.reviewerName}</p>
                                ) : (
                                    <p className="text-muted-foreground">Người duyệt: {assignedReviewers[dept]?.name || "(Chưa phân công)"}</p>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
                <span className="text-xs text-muted-foreground ml-1">
                    {customProgress.completed}/{customProgress.total}
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Tiến trình duyệt</span>
                    <span className="font-semibold">{customProgress.completed}/{customProgress.total} bước</span>
                </div>
                <Progress value={customProgress.percentage} className="h-2" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {departments.map((dept, idx) => {
                    const review = deptReviews[dept];
                    const config = REVIEW_DEPARTMENTS[dept];
                    const availableReviewers = dept === 'quan_ly_chung' 
                      ? reviewers.filter(r => r.user_id === assignedReviewers[dept]?.id) 
                      : reviewers.filter(r => r.role === config.requiredRole);
                    const currentAssignedId = assignedReviewers[dept]?.id || "none";

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
                                <span className="text-xs font-semibold">Bước {idx + 1}: {config.label}</span>
                                <StatusText status={review.status} />
                            </div>
                            <div className="mb-2">
                                <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 ${DEPARTMENT_REVIEW_STATUS_COLORS[review.status]}`}
                                >
                                    {DEPARTMENT_REVIEW_STATUS_LABELS[review.status]}
                                </Badge>
                            </div>

                            {review.reviewerName ? (
                                <p className="text-[10px] text-muted-foreground mt-1.5 truncate" title={review.reviewerName}>
                                    Đã duyệt: {review.reviewerName} • {review.reviewedAt ? formatDate(review.reviewedAt) : ""}
                                </p>
                            ) : assignable && onAssignReviewer ? (
                                <div className="mt-1.5">
                                    <Select
                                        value={currentAssignedId}
                                        onValueChange={(val) => onAssignReviewer(dept, val === "none" ? "" : val)}
                                    >
                                        <SelectTrigger className="h-7 text-[10px] w-full px-2 py-0">
                                            <SelectValue placeholder="Chọn người duyệt" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-[10px] italic text-muted-foreground">(Chưa chọn)</SelectItem>
                                            {availableReviewers.map((r) => (
                                                <SelectItem key={r.user_id} value={r.user_id} className="text-[10px]">{r.full_name || r.user_id}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <p className="text-[10px] text-muted-foreground mt-1.5 truncate" title={assignedReviewers[dept]?.name || "(Chưa có người duyệt)"}>
                                    Người duyệt: {assignedReviewers[dept]?.name || "(Chưa có người duyệt)"}
                                </p>
                            )}

                            {review.notes && (
                                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 italic" title={review.notes}>
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
