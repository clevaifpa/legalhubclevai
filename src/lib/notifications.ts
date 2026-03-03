import { supabase } from "@/integrations/supabase/client";

const STATUS_LABELS: Record<string, string> = {
  cho_xu_ly: "Chờ xử lý",
  cho_quan_ly: "Chờ Quản lý xác nhận",
  cho_phap_che: "Chờ Pháp chế review",
  cho_ke_toan: "Chờ Kế toán review",
  cho_tai_chinh: "Chờ Tài chính review",
  hoan_tat: "Hoàn tất",
  dang_review: "Đang review",
  da_hoan_thanh: "Đã hoàn thành",
  yeu_cau_chinh_sua: "Yêu cầu chỉnh sửa",
  tu_choi: "Từ chối",
};

interface NotifyParams {
  reviewRequestId: string;
  contractTitle: string;
  oldStatus: string;
  newStatus: string;
  actorName: string;
  requesterId: string;
  managerId?: string | null;
}

/**
 * Create in-app notifications for all relevant users when a review request status changes.
 * Recipients: requester + role-based users (manager of dept, admins, accountants, finance).
 * Also triggers email notification via edge function.
 */
export async function createWorkflowNotifications(params: NotifyParams) {
  const { reviewRequestId, contractTitle, oldStatus, newStatus, actorName, requesterId, managerId } = params;

  const title = `Hợp đồng: ${contractTitle}`;
  let content = "";
  if (oldStatus === "moi_tao") {
    content = `Yêu cầu review mới được tạo bởi ${actorName}. Trạng thái: ${STATUS_LABELS[newStatus] || newStatus}`;
  } else {
    content = `Cập nhật bởi ${actorName}. Trạng thái mới: ${STATUS_LABELS[newStatus] || newStatus}`;
  }

  // Gather recipient user IDs (deduplicated)
  const recipientIds = new Set<string>();

  // Always notify requester
  recipientIds.add(requesterId);

  // Always notify the assigned manager if provided
  if (managerId) recipientIds.add(managerId);

  // Notify relevant roles based on new status
  const rolesToNotify: string[] = ["admin"]; // admins always get notified

  if (newStatus === "cho_quan_ly") rolesToNotify.push("manager");
  if (newStatus === "cho_phap_che") { /* admin already included */ }
  if (newStatus === "cho_ke_toan") rolesToNotify.push("accountant");
  if (newStatus === "cho_tai_chinh") rolesToNotify.push("finance");
  if (newStatus === "hoan_tat" || newStatus === "tu_choi") {
    rolesToNotify.push("manager", "accountant", "finance");
  }

  // Fetch user IDs for these roles using RPC to bypass RLS
  const { data: roleUsers, error: rpcError } = await supabase
    .rpc("get_users_by_roles", { _roles: rolesToNotify } as any);

  if (rpcError) {
    console.warn("Lỗi khi lấy danh sách roles qua RPC:", rpcError);
  }

  if (roleUsers) {
    (roleUsers as any[]).forEach((ru: any) => recipientIds.add(ru.user_id));
  }

  // Remove the actor (current user) from recipients to avoid self-notification
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser) recipientIds.delete(currentUser.id);

  // Insert notifications
  const notifications = Array.from(recipientIds).map((userId) => ({
    user_id: userId,
    title,
    content,
    review_request_id: reviewRequestId,
    is_read: false,
  }));

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications as any);
  }

  // Log notifications for audit
  const logs = Array.from(recipientIds).map((userId) => ({
    notification_type: "in_app",
    review_request_id: reviewRequestId,
    recipient_user_id: userId,
    title,
    content,
    status: "sent",
  }));

  if (logs.length > 0) {
    await supabase.from("notification_logs").insert(logs as any);
  }

  // Send email notification to requester
  try {
    await supabase.functions.invoke("send-notification-email", {
      body: {
        requestId: reviewRequestId,
        contractTitle,
        newStatus: STATUS_LABELS[newStatus] || newStatus,
        updatedBy: actorName,
        requesterId,
      },
    });
  } catch (e) {
    console.warn("Email notification failed:", e);
  }
}

/**
 * Notifies all users with role 'admin' that a new contract has been uploaded to 'Tổng hợp đồng'.
 */
export async function notifyAdminsOnContractUpload(contractTitle: string, actorName: string, categoryId?: string) {
  const title = "Hợp đồng mới được Upload";
  const content = `Hợp đồng "${contractTitle}" vừa được tải lên bởi ${actorName}.`;

  // Fetch admin user IDs bypass RLS
  const { data: adminUsers, error: rpcError } = await supabase
    .rpc("get_users_by_roles", { _roles: ["admin"] } as any);

  if (rpcError) {
    console.warn("Lỗi khi lấy danh sách admin:", rpcError);
  }

  if (!adminUsers || (adminUsers as any[]).length === 0) return;

  const recipientIds = new Set((adminUsers as any[]).map((u: any) => u.user_id));

  // Remove the actor (current user) from recipients
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser) recipientIds.delete(currentUser.id);

  if (recipientIds.size === 0) return;

  // Insert notifications
  const notifications = Array.from(recipientIds).map((userId) => ({
    user_id: userId,
    title,
    content,
    is_read: false,
    // (Optional) link to category/contract if supported by your notification schema, but review_request_id is not applicable here
  }));

  await supabase.from("notifications").insert(notifications as any);

  // Log notifications for audit
  const logs = Array.from(recipientIds).map((userId) => ({
    notification_type: "in_app",
    recipient_user_id: userId,
    title,
    content,
    status: "sent",
  }));

  await supabase.from("notification_logs").insert(logs as any);
}
