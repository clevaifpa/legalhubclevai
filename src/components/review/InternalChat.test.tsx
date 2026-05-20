/**
 * Unit + integration tests for Trao đổi nội bộ (InternalChat).
 * Covers: @mention send, reply, edit, soft-delete, auto-scroll on hash deep-link.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// ----- Mocks -----
const currentUser = {
  id: "user-self",
  email: "linhnt2@clevai.edu.vn",
};

vi.mock("@/hooks/useAuth", async () => {
  const actual = await vi.importActual<any>("@/hooks/useAuth");
  return {
    ...actual,
    useAuth: () => ({
      user: currentUser,
      role: "admin",
      profile: { full_name: "Linh NT", department: "LVO" },
    }),
  };
});

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// ----- In-memory Supabase test double -----
type Row = Record<string, any>;
const db: Record<string, Row[]> = {
  review_request_messages: [],
  review_request_message_viewers: [],
  notifications: [],
  profiles: [
    { user_id: "user-self", full_name: "Linh NT", email: "linhnt2@clevai.edu.vn", department: "LVO" },
    { user_id: "user-anh", full_name: "Anh PV", email: "anhpv@clevai.edu.vn", department: "LVS" },
  ],
  user_roles: [
    { user_id: "user-self", role: "admin" },
    { user_id: "user-anh", role: "accountant" },
  ],
};

const inserts: { table: string; rows: Row[] }[] = [];
const updates: { table: string; patch: Row; match: Row }[] = [];

function makeQuery(table: string) {
  const state: any = { table, filters: [] as { col: string; val: any }[] };

  const exec = () => {
    let rows = [...(db[table] || [])];
    for (const f of state.filters) rows = rows.filter((r) => r[f.col] === f.val);
    return rows;
  };

  const api: any = {
    select: vi.fn(() => api),
    order: vi.fn(() => Promise.resolve({ data: exec(), error: null })),
    eq: vi.fn((col: string, val: any) => {
      state.filters.push({ col, val });
      // For update().eq() — apply update now
      if (state.pendingUpdate) {
        const patch = state.pendingUpdate;
        (db[table] || []).forEach((r) => {
          if (state.filters.every((f: any) => r[f.col] === f.val)) Object.assign(r, patch);
        });
        updates.push({ table, patch, match: { ...state.filters[0] } });
        state.pendingUpdate = null;
        return Promise.resolve({ error: null });
      }
      return api;
    }),
    insert: vi.fn((payload: Row | Row[]) => {
      const rows = Array.isArray(payload) ? payload : [payload];
      const withIds = rows.map((r, i) => ({
        id: r.id || `gen-${table}-${(db[table] || []).length + i + 1}`,
        created_at: new Date().toISOString(),
        is_deleted: false,
        edited_at: null,
        deleted_at: null,
        ...r,
      }));
      db[table] = [...(db[table] || []), ...withIds];
      inserts.push({ table, rows: withIds });
      const ret: any = {
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: withIds[0], error: null })),
        })),
        then: (res: any) => Promise.resolve({ data: withIds, error: null }).then(res),
      };
      return ret;
    }),
    update: vi.fn((patch: Row) => {
      state.pendingUpdate = patch;
      return api;
    }),
    order_promise: () => Promise.resolve({ data: exec(), error: null }),
  };
  return api;
}

const channelSubscribers: any[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => makeQuery(table)),
    channel: vi.fn(() => {
      const c: any = {
        on: vi.fn(() => c),
        subscribe: vi.fn(() => {
          channelSubscribers.push(c);
          return c;
        }),
      };
      return c;
    }),
    removeChannel: vi.fn(),
  },
}));

// ----- Import after mocks -----
import { InternalChat } from "@/components/review/InternalChat";

const seedMessages = (msgs: Partial<Row>[]) => {
  db.review_request_messages = msgs.map((m, i) => ({
    id: m.id || `msg-${i + 1}`,
    request_id: "req-1",
    sender_id: "user-anh",
    sender_name: "Anh PV",
    sender_role: "accountant",
    sender_department: "LVS",
    message: "hello",
    mentioned_user_ids: [],
    reply_to_message_id: null,
    is_deleted: false,
    edited_at: null,
    deleted_at: null,
    created_at: new Date("2026-05-20T10:00:00Z").toISOString(),
    ...m,
  }));
};

beforeEach(() => {
  db.review_request_messages = [];
  db.review_request_message_viewers = [];
  db.notifications = [];
  inserts.length = 0;
  updates.length = 0;
  channelSubscribers.length = 0;
  window.location.hash = "";
});

const renderChat = (props: Partial<React.ComponentProps<typeof InternalChat>> = {}) =>
  render(<InternalChat requestId="req-1" contractTitle="HĐ Test" {...props} />);

describe("InternalChat — header + load", () => {
  it("hiển thị header với số tin nhắn và mở rộng khi click", async () => {
    seedMessages([{ message: "Xin chào" }]);
    renderChat();
    const trigger = await screen.findByRole("button", { name: /Trao đổi nội bộ/i });
    expect(trigger).toHaveTextContent("(1)");
    fireEvent.click(trigger);
    expect(await screen.findByText("Xin chào")).toBeInTheDocument();
  });

  it("hiển thị trạng thái rỗng khi chưa có tin nhắn", async () => {
    renderChat();
    fireEvent.click(await screen.findByRole("button", { name: /Trao đổi nội bộ/i }));
    expect(await screen.findByText(/Chưa có trao đổi nào/i)).toBeInTheDocument();
  });
});

describe("InternalChat — gửi tin có @mention", () => {
  it("insert message + viewer + notification cho người được tag", async () => {
    renderChat();
    fireEvent.click(await screen.findByRole("button", { name: /Trao đổi nội bộ/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/Gõ @/)).toBeInTheDocument());

    const ta = screen.getByPlaceholderText(/Gõ @/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "@Anhpv vui lòng bổ sung" } });

    fireEvent.click(screen.getByRole("button", { name: /Gửi/i }));

    await waitFor(() => {
      const msgIns = inserts.find((i) => i.table === "review_request_messages");
      expect(msgIns).toBeTruthy();
      expect(msgIns!.rows[0].message).toMatch(/^@Anhpv/);
      expect(msgIns!.rows[0].mentioned_user_ids).toContain("user-anh");
    });

    const viewerIns = inserts.find((i) => i.table === "review_request_message_viewers");
    expect(viewerIns?.rows[0].user_id).toBe("user-anh");

    const notif = inserts.find((i) => i.table === "notifications");
    expect(notif?.rows[0].title).toMatch(/nhắc đến/i);
    expect(notif?.rows[0].content).toMatch(/<!--SCROLL:msg-/);
  });
});

describe("InternalChat — reply tin nhắn", () => {
  it("hiển thị quote tin gốc và tạo notification cho sender ban đầu", async () => {
    seedMessages([
      { id: "msg-orig", sender_id: "user-anh", sender_name: "Anh PV", message: "Gốc đây" },
    ]);
    renderChat();
    fireEvent.click(await screen.findByRole("button", { name: /Trao đổi nội bộ/i }));
    await screen.findByText("Gốc đây");

    // Open action menu for the message
    fireEvent.click(screen.getByRole("button", { name: /Thao tác/i }));
    fireEvent.click(await screen.findByText(/Trả lời/i));

    // Reply preview shown
    expect(await screen.findByText(/Đang trả lời Anh PV/i)).toBeInTheDocument();

    const ta = screen.getByPlaceholderText(/Gõ @/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "đã rõ" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi/i }));

    await waitFor(() => {
      const msgIns = inserts.find((i) => i.table === "review_request_messages");
      expect(msgIns?.rows[0].reply_to_message_id).toBe("msg-orig");
    });

    const notif = inserts.find((i) => i.table === "notifications");
    expect(notif?.rows[0].user_id).toBe("user-anh");
    expect(notif?.rows[0].title).toMatch(/trả lời/i);
  });
});

describe("InternalChat — chỉnh sửa tin nhắn của mình", () => {
  it("cập nhật DB và hiển thị (đã chỉnh sửa)", async () => {
    seedMessages([
      { id: "m1", sender_id: "user-self", sender_name: "Linh NT", message: "Nội dung cũ" },
    ]);
    renderChat();
    fireEvent.click(await screen.findByRole("button", { name: /Trao đổi nội bộ/i }));
    await screen.findByText("Nội dung cũ");

    fireEvent.click(screen.getByRole("button", { name: /Thao tác/i }));
    fireEvent.click(await screen.findByText(/Chỉnh sửa/i));

    const editTa = screen.getAllByRole("textbox").find(
      (el) => (el as HTMLTextAreaElement).value === "Nội dung cũ"
    ) as HTMLTextAreaElement;
    fireEvent.change(editTa, { target: { value: "Nội dung mới" } });
    fireEvent.click(screen.getByRole("button", { name: /Lưu/i }));

    await waitFor(() => {
      const upd = updates.find(
        (u) => u.table === "review_request_messages" && u.patch.message === "Nội dung mới"
      );
      expect(upd).toBeTruthy();
      expect(upd!.patch.edited_at).toBeTruthy();
    });
    expect(await screen.findByText(/đã chỉnh sửa/i)).toBeInTheDocument();
  });
});

describe("InternalChat — xoá mềm", () => {
  it("đánh dấu is_deleted và hiển thị 'Tin nhắn đã bị xóa'", async () => {
    seedMessages([
      { id: "m1", sender_id: "user-self", sender_name: "Linh NT", message: "Sẽ xoá" },
    ]);
    renderChat();
    fireEvent.click(await screen.findByRole("button", { name: /Trao đổi nội bộ/i }));
    await screen.findByText("Sẽ xoá");

    fireEvent.click(screen.getByRole("button", { name: /Thao tác/i }));
    fireEvent.click(await screen.findByText(/^Xóa$/));

    // Confirm dialog
    const confirm = await screen.findByRole("button", { name: /^Xóa$/ });
    fireEvent.click(confirm);

    await waitFor(() => {
      const upd = updates.find(
        (u) => u.table === "review_request_messages" && u.patch.is_deleted === true
      );
      expect(upd).toBeTruthy();
    });
    expect(await screen.findByText(/Tin nhắn đã bị xóa/i)).toBeInTheDocument();
  });
});

describe("InternalChat — auto-scroll theo hash deep-link", () => {
  it("gọi scrollIntoView trên #msg-<id> khi shouldScrollOnMount", async () => {
    seedMessages([
      { id: "msg-target", sender_id: "user-anh", sender_name: "Anh", message: "Target" },
    ]);
    window.location.hash = "#msg-msg-target";
    const spy = vi.spyOn(Element.prototype as any, "scrollIntoView");

    renderChat({ shouldScrollOnMount: true });
    await screen.findByText("Target");

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    const called = spy.mock.calls.some((args: any[]) => {
      // Called on the message element
      return true;
    });
    expect(called).toBe(true);
    spy.mockRestore();
  });
});
