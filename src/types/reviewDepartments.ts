// Review Department types and constants
// Workflow:
// Employee: Manager → Global Manager (hiennd) → Legal → Accountant → Finance → Complete
// Manager/Admin/Accountant/Finance: Global Manager (hiennd) → Legal → Accountant → Finance → Complete

export type ReviewDepartment = 'quan_ly' | 'quan_ly_chung' | 'phap_ly' | 'ke_toan' | 'tai_chinh';

export interface DepartmentReviewStatus {
    department: ReviewDepartment;
    status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
    reviewerName?: string;
    reviewedAt?: string;
    notes?: string;
}

export const REVIEW_DEPARTMENTS: Record<ReviewDepartment, {
    label: string;
    description: string;
    stepOrder: number;
    requiredRole: string;
}> = {
    quan_ly: {
        label: 'Quản lý',
        description: 'Xác nhận yêu cầu từ phòng ban',
        stepOrder: 1,
        requiredRole: 'manager',
    },
    quan_ly_chung: {
        label: 'QL chung',
        description: 'Xác nhận bởi Quản lý chung (hiennd)',
        stepOrder: 2,
        requiredRole: 'manager',
    },
    phap_ly: {
        label: 'Pháp chế',
        description: 'Kiểm tra tính hợp pháp, điều khoản ràng buộc',
        stepOrder: 3,
        requiredRole: 'admin',
    },
    ke_toan: {
        label: 'Kế toán',
        description: 'Kiểm tra hạch toán, thuế, chứng từ',
        stepOrder: 4,
        requiredRole: 'accountant',
    },
    tai_chinh: {
        label: 'Tài chính',
        description: 'Đánh giá giá trị, điều khoản thanh toán',
        stepOrder: 5,
        requiredRole: 'finance',
    },
};

// Global manager email constant
export const GLOBAL_MANAGER_EMAIL = 'hiennd@clevai.edu.vn';

// Workflow status mapping
export const WORKFLOW_STATUSES: Record<string, { label: string; nextStep: ReviewDepartment | null; prevStep: ReviewDepartment | null }> = {
    cho_quan_ly: { label: 'Chờ Quản lý xác nhận', nextStep: 'quan_ly', prevStep: null },
    cho_quan_ly_chung: { label: 'Chờ Quản lý chung duyệt', nextStep: 'quan_ly_chung', prevStep: 'quan_ly' },
    cho_phap_che: { label: 'Chờ Pháp chế review', nextStep: 'phap_ly', prevStep: 'quan_ly_chung' },
    cho_ke_toan: { label: 'Chờ Kế toán review', nextStep: 'ke_toan', prevStep: 'phap_ly' },
    cho_tai_chinh: { label: 'Chờ Tài chính review', nextStep: 'tai_chinh', prevStep: 'ke_toan' },
    hoan_tat: { label: 'Hoàn tất', nextStep: null, prevStep: 'tai_chinh' },
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

export function extractDeptReviews(
    notes: Array<{ content: string; author_name: string; created_at: string }>
): Record<ReviewDepartment, DepartmentReviewStatus> {
    const result: Record<ReviewDepartment, DepartmentReviewStatus> = {
        quan_ly: { department: 'quan_ly', status: 'pending' },
        quan_ly_chung: { department: 'quan_ly_chung', status: 'pending' },
        phap_ly: { department: 'phap_ly', status: 'pending' },
        ke_toan: { department: 'ke_toan', status: 'pending' },
        tai_chinh: { department: 'tai_chinh', status: 'pending' },
    };

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

export function isFullyApproved(deptReviews: Record<ReviewDepartment, DepartmentReviewStatus>): boolean {
    return Object.values(deptReviews).every((r) => r.status === 'approved');
}

export function hasRejection(deptReviews: Record<ReviewDepartment, DepartmentReviewStatus>): boolean {
    return Object.values(deptReviews).some((r) => r.status === 'rejected');
}

export function getReviewProgress(deptReviews: Record<ReviewDepartment, DepartmentReviewStatus>): {
    completed: number;
    total: number;
    percentage: number;
} {
    const total = Object.keys(deptReviews).length;
    const completed = Object.values(deptReviews).filter((r) => r.status !== 'pending').length;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
}

// Get the current workflow step based on status
export function getCurrentStep(status: string): ReviewDepartment | null {
    return WORKFLOW_STATUSES[status]?.nextStep || null;
}

// Get the next status after a step is approved
export function getNextStatus(currentStatus: string): string {
    const statusOrder = ['cho_quan_ly', 'cho_quan_ly_chung', 'cho_phap_che', 'cho_ke_toan', 'cho_tai_chinh', 'hoan_tat'];
    const idx = statusOrder.indexOf(currentStatus);
    if (idx === -1 || idx >= statusOrder.length - 1) return 'hoan_tat';
    return statusOrder[idx + 1];
}
