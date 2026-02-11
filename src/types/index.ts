export type ContractType = 'mua_ban' | 'dich_vu' | 'nda' | 'hop_tac' | 'lao_dong' | 'thue' | 'khac';

export type RiskLevel = 'thap' | 'trung_binh' | 'cao';

export type ContractStatus = 'nhap' | 'dang_review' | 'da_ky' | 'het_hieu_luc';

export type ReviewStatus = 'cho_xu_ly' | 'dang_review' | 'yeu_cau_chinh_sua' | 'da_phe_duyet' | 'tu_choi';

export type UserRole = 'admin' | 'phap_che' | 'nguoi_dung';

export type DeadlineType = 'thanh_toan' | 'nghiem_thu' | 'gia_han' | 'het_hieu_luc';

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  mua_ban: 'Mua bán',
  dich_vu: 'Dịch vụ',
  nda: 'NDA',
  hop_tac: 'Hợp tác',
  lao_dong: 'Lao động',
  thue: 'Thuê',
  khac: 'Khác',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  thap: 'Thấp',
  trung_binh: 'Trung bình',
  cao: 'Cao',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  nhap: 'Nháp',
  dang_review: 'Đang review',
  da_ky: 'Đã ký',
  het_hieu_luc: 'Hết hiệu lực',
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  cho_xu_ly: 'Chờ xử lý',
  dang_review: 'Đang review',
  yeu_cau_chinh_sua: 'Yêu cầu chỉnh sửa',
  da_phe_duyet: 'Đã phê duyệt',
  tu_choi: 'Từ chối',
};

export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  thanh_toan: 'Thanh toán',
  nghiem_thu: 'Nghiệm thu',
  gia_han: 'Gia hạn',
  het_hieu_luc: 'Hết hiệu lực',
};

export interface Clause {
  id: string;
  name: string;
  content: string;
  contractType: ContractType;
  riskLevel: RiskLevel;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  title: string;
  contractType: ContractType;
  partnerName: string;
  status: ContractStatus;
  effectiveDate: string;
  expiryDate: string;
  value: number;
  riskLevel: RiskLevel;
  createdAt: string;
  fileUrl?: string;
}

export interface ReviewRequest {
  id: string;
  contractTitle: string;
  partnerName: string;
  contractValue: number;
  paymentTerm: string;
  contractDuration: string;
  fileName: string;
  status: ReviewStatus;
  requesterName: string;
  requesterDepartment: string;
  notes: ReviewNote[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Deadline {
  id: string;
  contractId: string;
  contractTitle: string;
  partnerName: string;
  type: DeadlineType;
  dueDate: string;
  daysRemaining: number;
}
