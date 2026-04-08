import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface InlineEditCellProps {
  value: string | number | null;
  type: "text" | "number" | "date";
  canEdit: boolean;
  onSave: (newValue: string | number | null) => Promise<void>;
  formatDisplay?: (val: any) => string;
  className?: string;
  inputClassName?: string;
}

export function InlineEditCell({
  value,
  type,
  canEdit,
  onSave,
  formatDisplay,
  className,
  inputClassName,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type !== "date") inputRef.current.select();
    }
  }, [editing, type]);

  // Highlight after save
  useEffect(() => {
    if (justSaved) {
      const timer = setTimeout(() => setJustSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [justSaved]);

  const handleSave = async () => {
    if (saving) return;
    let newVal: string | number | null;
    if (type === "number") {
      newVal = editValue ? parseInt(editValue) : 0;
    } else {
      newVal = editValue || null;
    }
    if (String(newVal ?? "") === String(value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(newVal);
      setJustSaved(true);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing && canEdit) {
    return (
      <Input
        ref={inputRef}
        type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") {
            setEditValue(String(value ?? ""));
            setEditing(false);
          }
        }}
        className={cn("h-7 text-xs", inputClassName)}
        disabled={saving}
      />
    );
  }

  const displayValue = formatDisplay
    ? formatDisplay(value)
    : String(value || "—");

  return (
    <div
      className={cn(
        "flex items-center gap-1 group/edit min-h-[28px]",
        canEdit && "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors",
        justSaved && "bg-success/10 rounded px-1 -mx-1",
        className
      )}
      onClick={() => {
        if (canEdit) {
          setEditValue(String(value ?? ""));
          setEditing(true);
        }
      }}
      title={canEdit ? "Click để chỉnh sửa" : undefined}
    >
      <span className={cn("text-sm", !value && "text-muted-foreground")}>
        {displayValue}
      </span>
      {canEdit && (
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity shrink-0" />
      )}
    </div>
  );
}
