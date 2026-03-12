import { supabase } from "@/integrations/supabase/client";

const STATUS_LABELS: Record<string, string> = {
  cho_xu_ly: "Chờ xử lý",
  cho_quan_ly: "Chờ Quản lý xác nhận",
  cho_quan_ly_chung: "Chờ Quản lý chung duyệt",
  cho_phap_che: "Chờ Pháp chế review",
  cho_ke_toan: "Chờ Kế toán review",
  cho_tai_chinh: "Chờ Tài chính review",
  hoan_tat: "Hoàn tất",
  dang_review: "Đang review",
  da_hoan_thanh: "Đã hoàn thành",
  yeu_cau_chinh_sua: "Yêu cầu chỉnh sửa",
  tu_choi: "Từ chối",
  moi_tao: "Mới tạo",
};

function formatVNTime(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

interface NotifyParams {
  reviewRequestId: string;
  contractTitle: string;
  oldStatus: string;
  newStatus: string;
  actorName: string;
  requesterId: string;
  managerId?: string | null;
  department?: string;
}

/**
 * Create in-app notifications for all relevant users when a review request status changes.
 * Standardized format: Tên HĐ, Người thực hiện, Phòng ban, Thời gian, Trạng thái.
 */
export async function createWorkflowNotifications(params: NotifyParams) {
  const { reviewRequestId, contractTitle, oldStatus, newStatus, actorName, requesterId, managerId, department } = params;

  // Fetch requester department if not provided
  let dept = department || "";
  if (!dept) {
    const { data: reqProfile } = await supabase
      .from("profiles")
      .select("department")
      .eq("user_id", requesterId)
      .single();
    if (reqProfile) dept = (reqProfile as any).department || "";
  }

  const title = `Yêu cầu review: ${contractTitle}`;
  const timeStr = formatVNTime();
  let content = ``;

  if (oldStatus === "moi_tao") {
    content = [
      `• Tên hợp đồng: ${contractTitle}`,
      `• Người yêu cầu: ${actorName}`,
      `• Phòng ban: ${dept}`,
      `• Trạng thái: ${STATUS_LABELS[newStatus] || newStatus}`,
      `\n<!--REQUEST_ID:${reviewRequestId}-->`
    ].join("\n");
  } else {
    content = [
      `Thay đổi trạng thái hợp đồng`,
      `• Tên hợp đồng: ${contractTitle}`,
      `• Trạng thái: ${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[newStatus] || newStatus}`,
      `• Người thực hiện: ${actorName}`,
      `• Phòng ban: ${dept}`,
      `\n<!--REQUEST_ID:${reviewRequestId}-->`
    ].join("\n");
  }

  // Gather recipient user IDs (deduplicated)
  const recipientIds = new Set<string>();

  // Always notify requester
  recipientIds.add(requesterId);

  // Always notify the assigned manager if provided
  if (managerId) recipientIds.add(managerId);

  // Notify relevant roles based on new status
  const rolesToNotify: string[] = ["admin"]; // admins always get notified

  if (newStatus === "cho_ke_toan") rolesToNotify.push("accountant");
  if (newStatus === "cho_tai_chinh") rolesToNotify.push("finance");
  if (newStatus === "hoan_tat" || newStatus === "tu_choi") {
    rolesToNotify.push("accountant", "finance");
  }

  // Fetch user IDs for global roles using RPC
  const { data: roleUsers, error: rpcError } = await (supabase.rpc as any)(
    "get_users_by_roles",
    { _roles: rolesToNotify }
  );

  if (rpcError) {
    console.warn("Lỗi khi lấy danh sách roles qua RPC:", rpcError);
  }

  if (roleUsers) {
    (roleUsers as any[]).forEach((ru: any) => recipientIds.add(ru.user_id));
  }

  // Notify department-specific managers
  if (newStatus === "cho_quan_ly" || newStatus === "hoan_tat" || newStatus === "tu_choi") {
    if (dept) {
      const { data: deptManagers, error: deptError } = await (supabase.rpc as any)(
        "get_managers_by_department",
        { _department: dept }
      );
      if (!deptError && deptManagers) {
        (deptManagers as any[]).forEach((m: any) => recipientIds.add(m.user_id));
      }
    }
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
 * Notifies all users with role 'admin' that a new contract has been uploaded.
 * Standardized format: Tên HĐ, Người upload, Phòng ban, Thời gian.
 */
export async function notifyAdminsOnContractUpload(
  contractTitle: string,
  actorName: string,
  department?: string,
  contractId?: string,
  categoryId?: string,
) {
  const timeStr = formatVNTime();
  const title = "Hợp đồng mới";
  const content = [
    `• Tên hợp đồng: ${contractTitle}`,
    `• Người upload: ${actorName}`,
    `• Phòng ban: ${department || "—"}`,
  ];
  if (contractId) content.push(`\n<!--CONTRACT_ID:${contractId}-->`);
  if (categoryId) content.push(`\n<!--CATEGORY_ID:${categoryId}-->`);
  const finalContent = content.join("\n");

  // Fetch admin user IDs bypass RLS
  const { data: adminUsers, error: rpcError } = await (supabase.rpc as any)(
    "get_users_by_roles",
    { _roles: ["admin"] }
  );

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
    content: finalContent,
    is_read: false,
  }));

  await supabase.from("notifications").insert(notifications as any);

  // Log notifications for audit
  const logs = Array.from(recipientIds).map((userId) => ({
    notification_type: "in_app",
    recipient_user_id: userId,
    title,
    content: finalContent,
    status: "sent",
  }));

  await supabase.from("notification_logs").insert(logs as any);
}

/**
 * Notifies all admins that a contract has been deleted by a user.
 */
export async function notifyAdminsOnContractDeletion(
  contractTitle: string,
  actorName: string,
  department?: string,
  contractId?: string,
  categoryId?: string,
) {
  const timeStr = formatVNTime();
  const title = "Hợp đồng đã bị xóa";
  const content = [
    `• Tên hợp đồng: ${contractTitle}`,
    `• Người thực hiện: ${actorName}`,
    `• Phòng ban: ${department || "—"}`
  ];

  if (contractId) content.push(`\n<!--CONTRACT_ID:${contractId}-->`);
  if (categoryId) content.push(`\n<!--CATEGORY_ID:${categoryId}-->`);

  const finalContent = content.join("\n");

  const { data: adminUsers, error: rpcError } = await (supabase.rpc as any)(
    "get_users_by_roles",
    { _roles: ["admin"] }
  );

  if (rpcError) {
    console.warn("Lỗi khi lấy danh sách admin:", rpcError);
  }

  if (!adminUsers || (adminUsers as any[]).length === 0) return;

  const recipientIds = new Set((adminUsers as any[]).map((u: any) => u.user_id));
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser) recipientIds.delete(currentUser.id);

  if (recipientIds.size === 0) return;

  const notifications = Array.from(recipientIds).map((userId) => ({
    user_id: userId,
    title,
    content: finalContent,
    is_read: false,
  }));

  await supabase.from("notifications").insert(notifications as any);

  const logs = Array.from(recipientIds).map((userId) => ({
    notification_type: "in_app",
    recipient_user_id: userId,
    title,
    content: finalContent,
    status: "sent",
  }));

  await supabase.from("notification_logs").insert(logs as any);
}
