import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getEmployeeName } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, MessageSquare, Info } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  department: string;
}

interface ChatMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string | null;
  sender_department: string | null;
  message: string;
  mentioned_user_ids: string[];
  created_at: string;
}

interface Props {
  requestId: string;
  contractTitle: string;
  shouldScrollOnMount?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin Pháp chế",
  manager_chung: "Quản lý chung",
  manager: "Quản lý",
  accountant: "Kế toán",
  finance: "Tài chính",
  user: "Nhân viên",
};

function initialOf(name: string) {
  return (name?.trim()?.[0] || "?").toUpperCase();
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

/** Render message text, highlighting @mentions */
function renderMessage(text: string) {
  const parts = text.split(/(@[A-Za-z0-9_.-]+)/g);
  return parts.map((p, i) => {
    if (p.startsWith("@")) {
      return (
        <span
          key={i}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-accent bg-accent/10 font-medium"
        >
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function InternalChat({ requestId, contractTitle, shouldScrollOnMount }: Props) {
  const { user, role, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  // Map from "@token" -> user_id for mentions inserted via picker
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});

  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Load messages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("review_request_messages" as any)
        .select("*")
        .eq("request_id", requestId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) {
          // RLS will block silently for users without access; just show empty
          setMessages([]);
        } else {
          setMessages((data || []) as any);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${requestId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "review_request_messages",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage & { is_deleted?: boolean };
          if (m.is_deleted) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  // Profiles for mention picker
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department")
        .order("full_name", { ascending: true });
      if (data) setProfiles(data as any);
    })();
  }, []);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Hash scroll
  useEffect(() => {
    if (shouldScrollOnMount && rootRef.current) {
      setTimeout(() => {
        rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 250);
    }
  }, [shouldScrollOnMount]);

  const filteredProfiles = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return profiles
      .filter(
        (p) =>
          !q ||
          getEmployeeName(p.email).toLowerCase().includes(q) ||
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [profiles, mentionQuery]);

  const handleChange = (val: string) => {
    setText(val);
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? val.length;
    // Find last '@' before caret with no space after
    const before = val.slice(0, caret);
    const atIdx = before.lastIndexOf("@");
    if (atIdx >= 0) {
      const slice = before.slice(atIdx + 1);
      if (!/\s/.test(slice) && slice.length <= 30) {
        setMentionStart(atIdx);
        setMentionQuery(slice);
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery("");
  };

  const insertMention = (p: Profile) => {
    if (mentionStart === null) return;
    const token = getEmployeeName(p.email);
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? text.length;
    const before = text.slice(0, mentionStart);
    const after = text.slice(caret);
    const replacement = `@${token} `;
    const next = before + replacement + after;
    setText(next);
    setMentionMap((m) => ({ ...m, [`@${token}`]: p.user_id }));
    setMentionOpen(false);
    setMentionStart(null);
    setMentionQuery("");
    requestAnimationFrame(() => {
      const pos = (before + replacement).length;
      ta?.focus();
      ta?.setSelectionRange(pos, pos);
    });
  };

  const extractMentionedIds = (msg: string): string[] => {
    const tokens = msg.match(/@[A-Za-z0-9_.-]+/g) || [];
    const ids = new Set<string>();
    for (const t of tokens) {
      const id = mentionMap[t];
      if (id) {
        ids.add(id);
        continue;
      }
      // Fallback: try resolve by email prefix match
      const name = t.slice(1).toLowerCase();
      const p = profiles.find((p) => getEmployeeName(p.email).toLowerCase() === name);
      if (p) ids.add(p.user_id);
    }
    return Array.from(ids);
  };

  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || !user) return;
    setSending(true);
    try {
      const mentionedIds = extractMentionedIds(msg);
      const senderName = profile?.full_name || getEmployeeName(user.email) || "User";

      const { data: inserted, error } = await supabase
        .from("review_request_messages" as any)
        .insert({
          request_id: requestId,
          sender_id: user.id,
          sender_name: senderName,
          sender_role: role || null,
          sender_department: profile?.department || null,
          message: msg,
          mentioned_user_ids: mentionedIds,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Optimistic add (realtime usually beats us)
      if (inserted) {
        setMessages((prev) =>
          prev.some((x) => x.id === (inserted as any).id) ? prev : [...prev, inserted as any]
        );
      }

      // Grant viewer access + send notification for each mentioned user (skip sender)
      const targets = mentionedIds.filter((id) => id !== user.id);
      if (targets.length > 0) {
        // Insert viewers (ignore duplicate unique violations)
        await supabase
          .from("review_request_message_viewers" as any)
          .insert(targets.map((uid) => ({ request_id: requestId, user_id: uid })) as any);

        // Insert notifications
        const excerpt = msg.length > 140 ? msg.slice(0, 140) + "…" : msg;
        await supabase.from("notifications").insert(
          targets.map((uid) => ({
            user_id: uid,
            title: "Bạn được nhắc đến trong yêu cầu review",
            content: `[${contractTitle}] ${senderName}: ${excerpt}\n<!--REQUEST_ID:${requestId}-->\n<!--SCROLL:internal-chat-->`,
            review_request_id: requestId,
          })) as any
        );
      }

      setText("");
      setMentionMap({});
    } catch (e: any) {
      toast.error(e?.message || "Gửi tin nhắn thất bại");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      ref={rootRef}
      id={`internal-chat-${requestId}`}
      className="rounded-lg border bg-card"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent" />
          <p className="text-sm font-medium">Trao đổi nội bộ ({messages.length})</p>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
          <Info className="w-3 h-3" />
          Chỉ người liên quan hoặc được tag mới xem được
        </div>
      </div>

      <div
        ref={listRef}
        className="max-h-[360px] overflow-y-auto p-3 space-y-2"
      >
        {loading ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">
            Đang tải trao đổi...
          </p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">
            Chưa có trao đổi nào. Hãy bắt đầu cuộc trò chuyện.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const roleLabel = m.sender_role ? ROLE_LABEL[m.sender_role] || m.sender_role : "";
            return (
              <div
                key={m.id}
                className={`flex gap-2 p-2.5 rounded-md border ${
                  mine ? "bg-accent/5 border-accent/20" : "bg-background"
                }`}
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-sm font-semibold">
                  {initialOf(m.sender_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-xs text-muted-foreground truncate">
                      <span className="font-medium text-foreground">{m.sender_name}</span>
                      {roleLabel && <> · {roleLabel}</>}
                      {m.sender_department && <> · {m.sender_department}</>}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatTime(m.created_at)}
                    </span>
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-wrap break-words mt-0.5">
                    {renderMessage(m.message)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t p-2 relative">
        {mentionOpen && filteredProfiles.length > 0 && (
          <div className="absolute bottom-full left-2 right-2 mb-1 z-20 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
            {filteredProfiles.map((p) => (
              <button
                key={p.user_id}
                type="button"
                className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-accent/10 flex items-center gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(p);
                }}
              >
                <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-semibold">
                  {initialOf(p.full_name || p.email)}
                </span>
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-medium">@{getEmployeeName(p.email)}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {p.email}
                    {p.department ? ` · ${p.department}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={taRef}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Viết trao đổi... Gõ @ để tag người liên quan"
            rows={2}
            className="min-h-[44px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") setMentionOpen(false);
            }}
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span className="ml-1 hidden sm:inline">Gửi</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
