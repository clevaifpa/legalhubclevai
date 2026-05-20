import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getEmployeeName } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Send,
  MessageSquare,
  ChevronDown,
  MoreVertical,
  Reply,
  Pencil,
  Trash2,
  X,
  Check,
  ImagePlus,
  Paperclip,
  FolderPlus,
  FileIcon,
  ImageIcon,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Attachment,
  classifyFile,
  isValidDriveFolderUrl,
  listAttachmentsForRequest,
  MAX_FILES_PER_MESSAGE,
  MAX_FILE_SIZE,
  insertAttachmentRow,
  uploadFileToBucket,
} from "@/lib/attachments";
import { AttachmentRenderer } from "./AttachmentRenderer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  department: string;
  role?: string;
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
  reply_to_message_id: string | null;
  is_deleted: boolean;
  edited_at: string | null;
  deleted_at: string | null;
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

const initialOf = (name: string) => (name?.trim()?.[0] || "?").toUpperCase();

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const excerpt = (s: string, n = 80) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};

function MessageText({
  text,
  profilesByName,
}: {
  text: string;
  profilesByName: Record<string, Profile>;
}) {
  const parts = text.split(/(@[A-Za-z0-9_.-]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("@")) {
          const key = p.slice(1).toLowerCase();
          const prof = profilesByName[key];
          const chip = (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-accent bg-accent/10 font-medium cursor-default"
            >
              {p}
            </span>
          );
          if (prof) {
            return (
              <TooltipProvider key={i} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>{chip}</TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <div className="font-medium">{prof.full_name || prof.email}</div>
                    <div className="text-muted-foreground">{prof.email}</div>
                    {prof.department && (
                      <div className="text-muted-foreground">Phòng ban: {prof.department}</div>
                    )}
                    {prof.role && (
                      <div className="text-muted-foreground">
                        Vai trò: {ROLE_LABEL[prof.role] || prof.role}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          return chip;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function InternalChat({ requestId, contractTitle, shouldScrollOnMount }: Props) {
  const { user, role, profile } = useAuth();
  const isAdmin = role === "admin";

  const [open, setOpen] = useState(!!shouldScrollOnMount);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Attachments state
  const [attachmentsByMsg, setAttachmentsByMsg] = useState<Record<string, Attachment[]>>({});
  const [pending, setPending] = useState<
    { tempId: string; file?: File; previewUrl?: string; folderUrl?: string; folderName?: string; uploading?: boolean }[]
  >([]);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderUrlInput, setFolderUrlInput] = useState("");
  const [folderNameInput, setFolderNameInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
        .order("created_at", { ascending: true });
      if (!cancelled) {
        if (error) setMessages([]);
        else setMessages((data || []) as any);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  // Realtime: INSERT + UPDATE (edits / soft-deletes)
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
          const m = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "review_request_messages",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  // Profiles for mention picker + tooltips
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, department")
        .order("full_name", { ascending: true });
      if (!data) return;
      // Try fetch roles (admins see all; others may not — silently ignore)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      const roleMap = new Map<string, string>();
      (roles || []).forEach((r: any) => roleMap.set(r.user_id, r.role));
      setProfiles(
        (data as any[]).map((p) => ({ ...p, role: roleMap.get(p.user_id) }))
      );
    })();
  }, []);

  const profilesByName = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach((p) => {
      map[getEmployeeName(p.email).toLowerCase()] = p;
    });
    return map;
  }, [profiles]);

  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  // Auto scroll on new messages while open
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, open]);

  // Hash deep link
  useEffect(() => {
    if (!shouldScrollOnMount) return;
    setOpen(true);
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const msgMatch = hash.match(/#msg-([0-9a-f-]+)/i);
    setTimeout(() => {
      if (msgMatch) {
        const id = msgMatch[1];
        const el = document.getElementById(`msg-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setHighlightId(id);
          setTimeout(() => setHighlightId(null), 2000);
          return;
        }
      }
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 350);
  }, [shouldScrollOnMount, messages.length]);

  const filteredProfiles = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return profiles
      .filter(
        (p) =>
          !q ||
          getEmployeeName(p.email).toLowerCase().includes(q) ||
          (p.full_name || "").toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [profiles, mentionQuery]);

  const handleChange = (val: string) => {
    setText(val);
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? val.length;
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
      const name = t.slice(1).toLowerCase();
      const p = profilesByName[name];
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
          reply_to_message_id: replyTo?.id || null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (inserted) {
        setMessages((prev) =>
          prev.some((x) => x.id === (inserted as any).id) ? prev : [...prev, inserted as any]
        );
      }

      // Targets: mentioned users + reply recipient (dedup, exclude self)
      const targetSet = new Set<string>(mentionedIds);
      if (replyTo && replyTo.sender_id !== user.id) targetSet.add(replyTo.sender_id);
      targetSet.delete(user.id);
      const targets = Array.from(targetSet);

      if (targets.length > 0) {
        await supabase
          .from("review_request_message_viewers" as any)
          .insert(targets.map((uid) => ({ request_id: requestId, user_id: uid })) as any);

        const insertedId = (inserted as any)?.id;
        const ex = excerpt(msg, 140);
        const notifs = targets.map((uid) => {
          const isReplyTarget = replyTo && uid === replyTo.sender_id;
          const title = isReplyTarget
            ? "Có người trả lời tin nhắn của bạn"
            : "Bạn được nhắc đến trong yêu cầu review";
          const content = isReplyTarget
            ? `[${contractTitle}] ${senderName} đã trả lời bạn: ${ex}\n<!--REQUEST_ID:${requestId}-->\n<!--SCROLL:msg-${insertedId}-->`
            : `[${contractTitle}] ${senderName}: ${ex}\n<!--REQUEST_ID:${requestId}-->\n<!--SCROLL:msg-${insertedId}-->`;
          return {
            user_id: uid,
            title,
            content,
            review_request_id: requestId,
          };
        });
        await supabase.from("notifications").insert(notifs as any);
      }

      setText("");
      setMentionMap({});
      setReplyTo(null);
    } catch (e: any) {
      toast.error(e?.message || "Gửi tin nhắn thất bại");
    } finally {
      setSending(false);
    }
  };

  const startEdit = (m: ChatMessage) => {
    setEditingId(m.id);
    setEditingText(m.message);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const next = editingText.trim();
    if (!next) {
      toast.error("Nội dung không được để trống");
      return;
    }
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from("review_request_messages" as any)
        .update({ message: next, edited_at: new Date().toISOString() } as any)
        .eq("id", editingId);
      if (error) throw error;
      setMessages((prev) =>
        prev.map((x) =>
          x.id === editingId ? { ...x, message: next, edited_at: new Date().toISOString() } : x
        )
      );
      cancelEdit();
    } catch (e: any) {
      toast.error(e?.message || "Không thể cập nhật tin nhắn");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("review_request_messages" as any)
        .update({ is_deleted: true, deleted_at: new Date().toISOString() } as any)
        .eq("id", deleteTarget.id);
      if (error) throw error;
      setMessages((prev) =>
        prev.map((x) =>
          x.id === deleteTarget.id
            ? { ...x, is_deleted: true, deleted_at: new Date().toISOString() }
            : x
        )
      );
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || "Không thể xóa tin nhắn");
    } finally {
      setDeleting(false);
    }
  };

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 1800);
    }
  };

  const visibleCount = messages.filter((m) => !m.is_deleted).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        ref={rootRef}
        id={`internal-chat-${requestId}`}
        className="rounded-lg border bg-card"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors rounded-t-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium">Trao đổi nội bộ ({visibleCount})</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t" onClick={(e) => e.stopPropagation()}>
            <div ref={listRef} className="max-h-[400px] overflow-y-auto p-3 space-y-2">
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
                  const canEdit = mine && !m.is_deleted;
                  const canDelete = (mine || isAdmin) && !m.is_deleted;
                  const canReply = !m.is_deleted;
                  const roleLabel = m.sender_role ? ROLE_LABEL[m.sender_role] || m.sender_role : "";
                  const replyTarget = m.reply_to_message_id
                    ? messagesById.get(m.reply_to_message_id)
                    : null;
                  const isHighlight = highlightId === m.id;

                  if (m.is_deleted) {
                    return (
                      <div
                        key={m.id}
                        id={`msg-${m.id}`}
                        className={`flex gap-2 p-2.5 rounded-md border bg-muted/20 ${isHighlight ? "ring-2 ring-accent" : ""}`}
                      >
                        <div className="text-xs italic text-muted-foreground">
                          Tin nhắn đã bị xóa
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={`group flex gap-2 p-2.5 rounded-md border transition-shadow ${
                        mine ? "bg-accent/5 border-accent/20" : "bg-background"
                      } ${isHighlight ? "ring-2 ring-accent" : ""}`}
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
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[11px] text-muted-foreground">
                              {formatTime(m.created_at)}
                            </span>
                            {(canEdit || canDelete || canReply) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                                    aria-label="Thao tác"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="text-xs">
                                  {canReply && (
                                    <DropdownMenuItem onClick={() => { setReplyTo(m); taRef.current?.focus(); }}>
                                      <Reply className="w-3.5 h-3.5 mr-2" /> Trả lời
                                    </DropdownMenuItem>
                                  )}
                                  {canEdit && (
                                    <DropdownMenuItem onClick={() => startEdit(m)}>
                                      <Pencil className="w-3.5 h-3.5 mr-2" /> Chỉnh sửa
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => setDeleteTarget(m)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Xóa
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>

                        {/* Reply quote */}
                        {m.reply_to_message_id && (
                          <button
                            type="button"
                            onClick={() => replyTarget && scrollToMessage(replyTarget.id)}
                            className="mt-1 mb-1 w-full text-left bg-muted/40 border-l-2 border-accent rounded px-2 py-1 hover:bg-muted/60 transition-colors"
                          >
                            {replyTarget ? (
                              <>
                                <div className="text-[11px] font-medium text-foreground">
                                  {replyTarget.sender_name}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {replyTarget.is_deleted
                                    ? "Tin nhắn gốc đã bị xóa"
                                    : excerpt(replyTarget.message, 100)}
                                </div>
                              </>
                            ) : (
                              <div className="text-[11px] italic text-muted-foreground">
                                Tin nhắn gốc đã bị xóa
                              </div>
                            )}
                          </button>
                        )}

                        {editingId === m.id ? (
                          <div className="mt-1 space-y-1">
                            <Textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={2}
                              className="text-sm min-h-[44px] resize-none"
                              disabled={savingEdit}
                            />
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEdit}
                                disabled={savingEdit}
                                className="h-7 px-2"
                              >
                                <X className="w-3.5 h-3.5 mr-1" /> Hủy
                              </Button>
                              <Button
                                size="sm"
                                onClick={saveEdit}
                                disabled={savingEdit || !editingText.trim()}
                                className="h-7 px-2"
                              >
                                {savingEdit ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 mr-1" />
                                )}
                                Lưu
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-foreground whitespace-pre-wrap break-words mt-0.5">
                            <MessageText text={m.message} profilesByName={profilesByName} />
                            {m.edited_at && (
                              <span className="ml-1 text-[10px] text-muted-foreground italic">
                                (đã chỉnh sửa)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply preview */}
            {replyTo && (
              <div className="px-3 pt-2">
                <div className="flex items-start gap-2 bg-muted/40 border-l-2 border-accent rounded px-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium">
                      Đang trả lời {replyTo.sender_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {excerpt(replyTo.message, 100)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="p-0.5 rounded hover:bg-muted shrink-0"
                    aria-label="Hủy trả lời"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

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
                      <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-semibold shrink-0">
                        {initialOf(p.full_name || p.email)}
                      </span>
                      <span className="flex-1 min-w-0 truncate">
                        <span className="font-medium">@{getEmployeeName(p.email)}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {p.email}
                          {p.department ? ` · ${p.department}` : ""}
                          {p.role ? ` · ${ROLE_LABEL[p.role] || p.role}` : ""}
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
                  placeholder="Gõ @ để tag người liên quan"
                  rows={2}
                  className="min-h-[44px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                    if (e.key === "Escape") {
                      setMentionOpen(false);
                      if (replyTo) setReplyTo(null);
                    }
                  }}
                  disabled={sending}
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !text.trim()}
                  size="sm"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">Gửi</span>
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tin nhắn?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa tin nhắn này không? Tin nhắn sẽ bị ẩn nhưng vẫn giữ chỗ trong mạch hội thoại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
