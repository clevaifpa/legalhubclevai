import { FolderOpen, FileText, File, Plus, ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface LinkItem {
  id: string;
  url: string;
  name: string;
  type: "folder" | "pdf" | "doc";
}

export function getLinkType(url: string): "folder" | "pdf" | "doc" {
  const lower = url.toLowerCase();
  if (lower.includes("drive.google.com/drive/folders")) return "folder";
  if (lower.includes(".pdf") || lower.includes("drive.google.com/file/d/"))
    return "pdf";
  if (lower.includes(".doc") || lower.includes(".docx")) return "doc";
  if (lower.includes("drive.google.com")) return "folder";
  return "doc";
}

interface ContractLinkCellProps {
  links: LinkItem[];
  canEdit: boolean;
  onAddLink: () => void;
}

const PRIORITY_ORDER: Record<string, number> = {
  folder: 0,
  pdf: 1,
  doc: 2,
};

function LinkIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  switch (type) {
    case "folder":
      return <FolderOpen className={cn("h-3.5 w-3.5", className)} />;
    case "pdf":
      return <FileText className={cn("h-3.5 w-3.5", className)} />;
    default:
      return <File className={cn("h-3.5 w-3.5", className)} />;
  }
}

function LinkBadge({ link }: { link: LinkItem }) {
  return (
    <a
      href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-background text-xs hover:bg-muted/50 transition-colors"
      title={link.name}
      onClick={(e) => e.stopPropagation()}
    >
      <LinkIcon type={link.type} className="text-muted-foreground" />
      <span className="uppercase text-[10px] font-medium leading-none">
        {link.type === "folder" ? "Folder" : link.type.toUpperCase()}
      </span>
    </a>
  );
}

export function ContractLinkCell({
  links,
  canEdit,
  onAddLink,
}: ContractLinkCellProps) {
  const MAX_VISIBLE = 3;

  // Sort by priority: Folder > PDF > DOC
  const sortedLinks = [...links].sort(
    (a, b) => (PRIORITY_ORDER[a.type] ?? 9) - (PRIORITY_ORDER[b.type] ?? 9)
  );

  const visibleLinks = sortedLinks.slice(0, MAX_VISIBLE);
  const overflowCount = sortedLinks.length - MAX_VISIBLE;

  if (links.length === 0) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground text-sm">—</span>
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddLink();
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Thêm link"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleLinks.map((link) => (
        <LinkBadge key={link.id} link={link} />
      ))}
      {overflowCount > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="inline-flex items-center px-1.5 py-0.5 rounded border text-xs hover:bg-muted/50 transition-colors font-medium text-muted-foreground bg-background"
              onClick={(e) => e.stopPropagation()}
            >
              +{overflowCount}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">
              Danh sách link:
            </p>
            <div className="space-y-1">
              {sortedLinks.map((link) => (
                <a
                  key={link.id}
                  href={
                    link.url.startsWith("http")
                      ? link.url
                      : `https://${link.url}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs hover:bg-muted/50 rounded px-2 py-1.5 transition-colors"
                >
                  <LinkIcon
                    type={link.type}
                    className="text-muted-foreground shrink-0"
                  />
                  <span className="truncate flex-1">{link.name}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                </a>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {canEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddLink();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Thêm link"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
