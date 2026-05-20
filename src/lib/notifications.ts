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

  // 1. Lấy thông tin review_request để biết chính xác người duyệt được phân công
  const { data: request } = await supabase
    .from("review_requests")
    .select("manager_id, global_manager_id, legal_reviewer_id, accountant_reviewer_id, finance_reviewer_id")
    .eq("id", reviewRequestId)
    .single();

  if (request) {
    if (newStatus === "cho_quan_ly" && request.manager_id) {
      recipientIds.add(request.manager_id);
    } else if (newStatus === "cho_quan_ly_chung" && request.global_manager_id) {
      recipientIds.add(request.global_manager_id);
    } else if (newStatus === "cho_phap_che" && request.legal_reviewer_id) {
      recipientIds.add(request.legal_reviewer_id);
    } else if (newStatus === "cho_ke_toan" && request.accountant_reviewer_id) {
      recipientIds.add(request.accountant_reviewer_id);
    } else if (newStatus === "cho_tai_chinh" && request.finance_reviewer_id) {
      recipientIds.add(request.finance_reviewer_id);
    }
  }

  // 2. Admin chỉ nhận thông báo khi Mới tạo hoặc Hoàn tất toàn bộ quy trình
  // Bổ sung: Kế toán và Tài chính nhận thông báo khi Hoàn tất
  if (oldStatus === "moi_tao" || newStatus === "hoan_tat") {
    const rolesToFetch = newStatus === "hoan_tat" ? ["admin", "accountant", "finance"] : ["admin"];
    const { data: usersByRole, error: rpcError } = await (supabase.rpc as any)(
      "get_users_by_roles",
      { _roles: rolesToFetch }
    );
    if (!rpcError && usersByRole) {
      (usersByRole as any[]).forEach((ru: any) => recipientIds.add(ru.user_id));
    }
  }

  // 3. Khi bị từ chối / yêu cầu chỉnh sửa: Gửi cho toàn bộ những người đã tham gia duyệt trước đó
  if (newStatus === "tu_choi" || newStatus === "yeu_cau_chinh_sua") {
    const { data: notes } = await supabase
      .from("review_notes")
      .select("author_id")
      .eq("review_request_id", reviewRequestId);
    if (notes) {
      notes.forEach((n: any) => {
        if (n.author_id) recipientIds.add(n.author_id);
      });
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

/**
 * Gọi khi Admin gán 1 người cụ thể vào vị trí duyệt đang trống.
 * Dùng đúng template của thông báo gửi yêu cầu (moi_tao).
 */
export async function notifyReviewerAssigned(
  reviewRequestId: string,
  contractTitle: string,
  reviewerId: string,
  currentStatus: string,
) {
  // Lấy thông tin người tạo từ DB để ghép đúng mẫu
  const { data: request } = await supabase
    .from("review_requests")
    .select("requester_name, department")
    .eq("id", reviewRequestId)
    .single();

  const requesterName = request?.requester_name || "—";
  const dept = request?.department || "—";

  const title = `Yêu cầu review: ${contractTitle}`;
  const content = [
    `• Tên hợp đồng: ${contractTitle}`,
    `• Người yêu cầu: ${requesterName}`,
    `• Phòng ban: ${dept}`,
    `• Trạng thái: ${STATUS_LABELS[currentStatus] || currentStatus}`,
    `\n<!--REQUEST_ID:${reviewRequestId}-->`
  ].join("\n");

  await supabase.from("notifications").insert([{
    user_id: reviewerId,
    title,
    content,
    review_request_id: reviewRequestId,
    is_read: false,
  }] as any);

  await supabase.from("notification_logs").insert([{
    notification_type: "in_app",
    review_request_id: reviewRequestId,
    recipient_user_id: reviewerId,
    title,
    content,
    status: "sent",
  }] as any);
}

/**
 * Notify relevant people when a review request has been edited
 * (without status change).
 */
export async function notifyReviewRequestEdited(params: {
  reviewRequestId: string;
  contractTitle: string;
  actorName: string;
  requesterId: string;
  department?: string;
}) {
  const { reviewRequestId, contractTitle, actorName, requesterId, department } = params;

  const { data: request } = await supabase
    .from("review_requests")
    .select("status, manager_id, global_manager_id, legal_reviewer_id, accountant_reviewer_id, finance_reviewer_id, department")
    .eq("id", reviewRequestId)
    .single();

  const status = (request?.status as string) || "";
  const dept = department || (request as any)?.department || "—";
  const statusLabel = STATUS_LABELS[status] || status || "—";

  const title = "Yêu cầu review đã được chỉnh sửa";
  const content = [
    `• Tên hợp đồng: ${contractTitle}`,
    `• Người chỉnh sửa: ${actorName}`,
    `• Phòng ban: ${dept}`,
    `• Trạng thái hiện tại: ${statusLabel}`,
    `• Nội dung yêu cầu vừa được cập nhật. Vui lòng kiểm tra lại trước khi duyệt.`,
    `\n<!--REQUEST_ID:${reviewRequestId}-->`,
  ].join("\n");

  const recipientIds = new Set<string>();
  if (requesterId) recipientIds.add(requesterId);

  if (request) {
    if (status === "cho_quan_ly" && request.manager_id) recipientIds.add(request.manager_id);
    else if (status === "cho_quan_ly_chung" && request.global_manager_id) recipientIds.add(request.global_manager_id);
    else if (status === "cho_phap_che" && request.legal_reviewer_id) recipientIds.add(request.legal_reviewer_id);
    else if (status === "cho_ke_toan" && request.accountant_reviewer_id) recipientIds.add(request.accountant_reviewer_id);
    else if (status === "cho_tai_chinh" && request.finance_reviewer_id) recipientIds.add(request.finance_reviewer_id);
  }

  // Admin/pháp chế theo dõi toàn bộ
  const { data: adminLegal } = await (supabase.rpc as any)("get_users_by_roles", { _roles: ["admin"] });
  if (adminLegal) (adminLegal as any[]).forEach((u: any) => recipientIds.add(u.user_id));
  if (request?.legal_reviewer_id) recipientIds.add(request.legal_reviewer_id);

  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser) recipientIds.delete(currentUser.id);

  if (recipientIds.size === 0) return;

  const notifications = Array.from(recipientIds).map((userId) => ({
    user_id: userId,
    title,
    content,
    review_request_id: reviewRequestId,
    is_read: false,
  }));
  await supabase.from("notifications").insert(notifications as any);

  const logs = Array.from(recipientIds).map((userId) => ({
    notification_type: "in_app",
    review_request_id: reviewRequestId,
    recipient_user_id: userId,
    title,
    content,
    status: "sent",
  }));
  await supabase.from("notification_logs").insert(logs as any);
}
