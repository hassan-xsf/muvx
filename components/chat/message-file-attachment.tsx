"use client";

import { memo, useCallback, useState } from "react";
import type { FileUIPart } from "ai";
import { DownloadIcon, FileTextIcon, RefreshCwIcon, XIcon } from "lucide-react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { refreshAttachmentUrl } from "@/lib/copilot/upload";
import { traceError, traceInfo } from "@/lib/copilot/client-trace";
import { cn } from "@/lib/utils";

/** A `FileUIPart` enriched by our upload route with S3 key and byte size. */
export type StoredFilePart = FileUIPart & {
  key?: string;
  size?: number;
};

/** 1536 B → "1.5 KB". Matches what the operator picked in the file picker. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** "application/pdf" → "PDF", "text/csv" → "CSV", "image/png" → "PNG". */
function formatMediaType(mediaType?: string): string | null {
  if (!mediaType) return null;
  const subtype = mediaType.split("/")[1]?.split("+")[0];
  if (!subtype) return null;
  const cleaned = subtype.replace(/^x-/, "").replace(/vnd\./, "");
  const known: Record<string, string> = {
    pdf: "PDF",
    csv: "CSV",
    json: "JSON",
    jsonl: "JSONL",
    plain: "TXT",
    markdown: "MD",
    doc: "DOC",
    wordprocessingml: "DOCX",
    excel: "XLS",
    spreadsheetml: "XLSX",
    octetstream: "FILE",
  };
  return known[cleaned.toLowerCase()] ?? cleaned.toUpperCase().slice(0, 5);
}

type Status = "ready" | "uploading" | "error";

export type MessageFileAttachmentProps = {
  id: string;
  part: StoredFilePart;
  status?: Status;
  error?: string | null;
  onRemove?: () => void;
  className?: string;
};

/**
 * Authentic ChatGPT-style attachment component for chat history:
 * - Images render as a rich, full-fidelity thumbnail photo card.
 * - Documents render as a sleek, rounded pill card with type icon, filename, and download button.
 */
export const MessageFileAttachment = memo(function MessageFileAttachment({
  id,
  part,
  status = "ready",
  error = null,
  onRemove,
  className,
}: MessageFileAttachmentProps) {
  const [resigning, setResigning] = useState(false);
  const isImage =
    part.mediaType?.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(part.filename ?? "");
  const typeLabel = formatMediaType(part.mediaType);
  const sizeLabel =
    typeof part.size === "number" && part.size > 0 ? formatBytes(part.size) : null;

  const handleDownload = useCallback(async () => {
    setResigning(true);
    try {
      const fresh = await refreshAttachmentUrl(part);
      traceInfo("attachment:download", { filename: part.filename });
      window.open(fresh.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      traceError("attachment:download-failed", {
        filename: part.filename,
        message: err instanceof Error ? err.message : String(err),
      });
      window.open(part.url, "_blank", "noopener,noreferrer");
    } finally {
      setResigning(false);
    }
  }, [part]);

  const isPending = status === "uploading";
  const hasError = status === "error";

  // ChatGPT-style Image Card in Message History (Screenshot 4)
  if (isImage && part.url) {
    return (
      <div
        className={cn(
          "group/img relative max-w-xs overflow-hidden rounded-2xl border border-black/10 bg-muted/20 shadow-xs transition-all hover:opacity-95 active:scale-[0.99] dark:border-white/10",
          className
        )}
        onClick={handleDownload}
        title={`View ${part.filename ?? "image"}`}
      >
        <img
          src={part.url}
          alt={part.filename ?? "Uploaded image"}
          className="max-h-60 w-auto rounded-2xl object-cover"
        />
        <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent p-2.5 opacity-0 transition-opacity group-hover/img:opacity-100">
          <span className="max-w-[180px] truncate text-xs font-medium text-white">
            {part.filename ?? "Image"}
          </span>
          <div className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white shadow-xs">
            {resigning ? (
              <RefreshCwIcon className="size-3 animate-spin" />
            ) : (
              <DownloadIcon className="size-3" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ChatGPT-style Document Card in Message History (Screenshot 4)
  return (
    <div
      className={cn(
        "group/attachment relative flex w-fit max-w-sm items-center gap-3 rounded-2xl p-2.5",
        "border border-black/10 bg-black/5 shadow-2xs transition-colors hover:bg-black/8 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8",
        className
      )}
      onClick={!onRemove ? handleDownload : undefined}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          typeLabel === "PDF"
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            : typeLabel === "CSV" || typeLabel === "XLS" || typeLabel === "XLSX"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : typeLabel === "JSON" || typeLabel === "JSONL"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
        )}
      >
        <FileTextIcon className="size-4" />
      </div>

      {isPending ? (
        <Shimmer duration={1.4} className="min-w-0 flex-1 text-xs">
          Uploading…
        </Shimmer>
      ) : hasError ? (
        <p className="min-w-0 flex-1 text-xs leading-snug text-destructive">
          {error ?? "Upload failed"}
        </p>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col pr-1">
            <span className="block truncate text-xs font-semibold text-brand-ink">
              {part.filename ?? "Document"}
            </span>
            <span className="font-mono text-[11px] text-brand-muted-soft">
              {typeLabel ?? "File"} {sizeLabel ? `· ${sizeLabel}` : ""}
            </span>
          </div>

          <Button
            aria-label={
              onRemove
                ? `Remove ${part.filename ?? "attachment"}`
                : `Download ${part.filename ?? "attachment"}`
            }
            className={cn(
              "size-7 shrink-0 rounded-lg text-brand-muted-soft transition-all",
              onRemove
                ? "hover:bg-destructive/15 hover:text-destructive active:scale-95"
                : "opacity-70 group-hover/attachment:opacity-100 hover:bg-brand-cream/60 hover:text-brand-ink"
            )}
            disabled={resigning || isPending}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (onRemove) {
                onRemove();
                return;
              }
              void handleDownload();
            }}
            size="icon"
            title={onRemove ? "Remove" : "Download"}
            type="button"
            variant="ghost"
          >
            {resigning ? (
              <RefreshCwIcon className="size-3.5 animate-spin" />
            ) : onRemove ? (
              <XIcon className="size-3.5" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
          </Button>
        </>
      )}
    </div>
  );
});
