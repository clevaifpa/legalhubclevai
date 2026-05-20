import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture inserted payloads
const inserted: Record<string, any[]> = { notifications: [], notification_logs: [] };
let mockStatus: string = "cho_phap_che";
let mockDeptInDb: string = "LVO";

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: {
            status: mockStatus,
            manager_id: "m-1",
            global_manager_id: "gm-1",
            legal_reviewer_id: "lg-1",
            accountant_reviewer_id: "ac-1",
            finance_reviewer_id: "fi-1",
            department: mockDeptInDb,
          },
        }),
      }),
    }),
    insert: async (rows: any[]) => {
      inserted[table] = (inserted[table] || []).concat(rows);
      return { data: null, error: null };
    },
  });
  return {
    supabase: {
      from,
      rpc: async () => ({ data: [], error: null }),
      auth: { getUser: async () => ({ data: { user: null } }) },
    },
  };
});

import { notifyReviewRequestEdited } from "./notifications";

const STATUS_LABELS: Record<string, string> = {
  cho_xu_ly: "Chờ xử lý",
  cho_quan_ly: "Chờ Quản lý xác nhận",
  cho_quan_ly_chung: "Chờ Quản lý chung duyệt",
  cho_phap_che: "Chờ Pháp chế review",
  cho_ke_toan: "Chờ Kế toán review",
  cho_tai_chinh: "Chờ Tài chính review",
};

describe("notifyReviewRequestEdited", () => {
  beforeEach(() => {
    inserted.notifications = [];
    inserted.notification_logs = [];
  });

  const baseParams = {
    reviewRequestId: "req-123",
    contractTitle: "HĐ Test",
    actorName: "Nguyễn A",
    requesterId: "user-1",
    department: "LVO",
  };

  for (const status of Object.keys(STATUS_LABELS)) {
    it(`renders all fields with correct label for status ${status}`, async () => {
      mockStatus = status;
      await notifyReviewRequestEdited(baseParams);

      expect(inserted.notifications.length).toBeGreaterThan(0);
      const n = inserted.notifications[0];

      expect(n.title).toBe("Yêu cầu review đã được chỉnh sửa");
      expect(n.review_request_id).toBe("req-123");
      expect(n.content).toContain("• Tên hợp đồng: HĐ Test");
      expect(n.content).toContain("• Người chỉnh sửa: Nguyễn A");
      expect(n.content).toContain("• Phòng ban: LVO");
      expect(n.content).toContain(`• Trạng thái hiện tại: ${STATUS_LABELS[status]}`);
      expect(n.content).toContain("Nội dung yêu cầu vừa được cập nhật");
      expect(n.content).toContain("<!--REQUEST_ID:req-123-->");

      // notification_logs mirrors title/content
      const log = inserted.notification_logs[0];
      expect(log.title).toBe(n.title);
      expect(log.content).toBe(n.content);
    });
  }

  it("falls back to department from DB when not passed in params", async () => {
    mockStatus = "cho_phap_che";
    mockDeptInDb = "LVS";
    await notifyReviewRequestEdited({ ...baseParams, department: undefined });
    const n = inserted.notifications[0];
    expect(n.content).toContain("• Phòng ban: LVS");
  });
});
