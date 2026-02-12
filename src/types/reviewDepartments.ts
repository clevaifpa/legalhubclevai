// Review Department types and constants
// Defines the multi-department review workflow where each contract
// can be reviewed by Legal (Pháp lý), Finance (Tài chính), and Accounting (Kế toán)

export type ReviewDepartment = 'phap_ly' | 'tai_chinh' | 'ke_toan';

export interface DepartmentReviewStatus {
    department: ReviewDepartment;
    status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
    reviewerName?: string;
    reviewedAt?: string;
    notes?: string;
}

export const REVIEW_DEPARTMENTS: Record<ReviewDepartment, {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
}> = {
    phap_ly: {
        label: 'Pháp lý',
        icon: '⚖️',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        description: 'Kiểm tra tính hợp pháp, điều khoản ràng buộc',
    },
    tai_chinh: {
        label: 'Tài chính',
        icon: '💰',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        description: 'Đánh giá giá trị, điều khoản thanh toán',
    },
    ke_toan: {
        label: 'Kế toán',
        icon: '📊',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        description: 'Kiểm tra hạch toán, thuế, chứng từ',
    },
};

export const DEPARTMENT_REVIEW_STATUS_LABELS: Record<DepartmentReviewStatus['status'], string> = {
    pending: 'Chờ review',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    needs_revision: 'Cần chỉnh sửa',
};

export const DEPARTMENT_REVIEW_STATUS_COLORS: Record<DepartmentReviewStatus['status'], string> = {
    pending: 'bg-gray-100 text-gray-600 border-gray-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    needs_revision: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

// Parse department review data from review_notes
// Convention: notes with content starting with [DEPT_REVIEW:department:status] are department reviews
export const DEPT_REVIEW_PREFIX = '[DEPT_REVIEW]';

export function encodeDeptReview(
    department: ReviewDepartment,
    status: DepartmentReviewStatus['status'],
    notes: string
): string {
    return `${DEPT_REVIEW_PREFIX}${department}|${status}|${notes}`;
}

export function decodeDeptReview(content: string): {
    department: ReviewDepartment;
    status: DepartmentReviewStatus['status'];
    notes: string;
} | null {
    if (!content.startsWith(DEPT_REVIEW_PREFIX)) return null;
    const payload = content.slice(DEPT_REVIEW_PREFIX.length);
    const [department, status, ...notesParts] = payload.split('|');
    if (!department || !status) return null;
    return {
        department: department as ReviewDepartment,
        status: status as DepartmentReviewStatus['status'],
        notes: notesParts.join('|'),
    };
}

// Extract the latest department review statuses from review_notes
export function extractDeptReviews(
    notes: Array<{ content: string; author_name: string; created_at: string }>
): Record<ReviewDepartment, DepartmentReviewStatus> {
    const result: Record<ReviewDepartment, DepartmentReviewStatus> = {
        phap_ly: { department: 'phap_ly', status: 'pending' },
        tai_chinh: { department: 'tai_chinh', status: 'pending' },
        ke_toan: { department: 'ke_toan', status: 'pending' },
    };

    // Process notes in order (oldest to newest) - last one wins
    for (const note of notes) {
        const decoded = decodeDeptReview(note.content);
        if (decoded) {
            result[decoded.department] = {
                department: decoded.department,
                status: decoded.status,
                reviewerName: note.author_name,
                reviewedAt: note.created_at,
                notes: decoded.notes,
            };
        }
    }

    return result;
}

// Check if all departments have approved
export function isFullyApproved(deptReviews: Record<ReviewDepartment, DepartmentReviewStatus>): boolean {
    return Object.values(deptReviews).every((r) => r.status === 'approved');
}

// Check if any department has rejected
export function hasRejection(deptReviews: Record<ReviewDepartment, DepartmentReviewStatus>): boolean {
    return Object.values(deptReviews).some((r) => r.status === 'rejected');
}

// Get overall progress
export function getReviewProgress(deptReviews: Record<ReviewDepartment, DepartmentReviewStatus>): {
    completed: number;
    total: number;
    percentage: number;
} {
    const total = Object.keys(deptReviews).length;
    const completed = Object.values(deptReviews).filter((r) => r.status !== 'pending').length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
}
