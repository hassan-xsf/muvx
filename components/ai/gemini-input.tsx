"use client";

import {
  ArrowUp,
  FileCode,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Plus,
  Square,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ModelPicker, type AIModelItem } from "@/components/ai/model-picker";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "";
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

/**
 * Clean staged file preview:
 * - Images: Square thumbnail with floating top-right close button.
 * - Documents: Compact pill card with type icon, name, and remove button.
 */
function StagedFilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage =
    file.type?.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(file.name);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isSheet =
    file.type?.includes("csv") ||
    file.type?.includes("sheet") ||
    file.type?.includes("excel") ||
    /\.(csv|xlsx?|tsv)$/i.test(file.name);
  const isCode =
    file.type?.includes("json") ||
    file.type?.includes("javascript") ||
    file.type?.includes("typescript") ||
    /\.(json|js|ts|tsx|py|sql|sh|html|css)$/i.test(file.name);

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  const ext =
    file.name.split(".").pop()?.toUpperCase() || (isImage ? "IMG" : "FILE");
  const formattedSize = formatFileSize(file.size);

  if (isImage) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 3 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -3 }}
        transition={{ duration: 0.15 }}
        className="group relative size-16 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-muted/20 shadow-xs sm:size-20 dark:border-white/10"
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-6 opacity-60" />
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${file.name}`}
          title="Remove image"
          className="absolute right-1.5 top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white shadow-xs transition-all hover:bg-black active:scale-90"
        >
          <X className="size-3 stroke-[2.5]" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 3 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -3 }}
      transition={{ duration: 0.15 }}
      className="group relative flex items-center gap-3 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 shadow-2xs transition-colors hover:bg-black/8 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/8"
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          isPdf
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            : isSheet
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : isCode
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
        )}
      >
        {isSheet ? (
          <FileSpreadsheet className="size-4" />
        ) : isCode ? (
          <FileCode className="size-4" />
        ) : (
          <FileText className="size-4" />
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <span
          className="max-w-[140px] truncate text-xs font-semibold text-brand-ink sm:max-w-[180px]"
          title={file.name}
        >
          {file.name}
        </span>
        <span className="font-mono text-[11px] text-brand-muted-soft">
          {ext} {formattedSize ? `· ${formattedSize}` : ""}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${file.name}`}
        title="Remove attachment"
        className="ml-1 flex size-5.5 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-muted-soft transition-colors hover:bg-black/10 hover:text-brand-ink active:scale-95 dark:hover:bg-white/10"
      >
        <X className="size-3.5" />
      </button>
    </motion.div>
  );
}

function formatModelLabel(model: string): string {
  return (model.split("/").pop() || model)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface GeminiInputProps {
  placeholder?: string;
  models: (string | AIModelItem)[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  onSubmit?: (
    value: string,
    options: { webSearch: boolean; model: string | null; files?: File[] }
  ) => void;
  isLoading?: boolean;
  onStop?: () => void;
  className?: string;
}

/**
 * Pure, custom Gemini-style AI input:
 * - Rounded capsule container (`rounded-[26px]`)
 * - Plus button on the left for attachments
 * - Clean auto-resizing text area in center
 * - Model picker and circular Send / Stop action on the right
 * - Staged attachments preview at the top (does NOT auto-send!)
 */
export function GeminiInput({
  placeholder = "Ask Muvx anything…",
  models = [],
  selectedModel = "",
  onModelChange,
  onSubmit,
  isLoading = false,
  onStop,
  className,
}: GeminiInputProps) {
  const [value, setValue] = useState("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 46,
    maxHeight: 180,
  });

  const handleSubmit = () => {
    if (isLoading) {
      onStop?.();
      return;
    }
    if (!value.trim() && stagedFiles.length === 0) {
      return;
    }
    onSubmit?.(value, {
      webSearch: false,
      model: selectedModel,
      files: stagedFiles.length > 0 ? stagedFiles : undefined,
    });
    setValue("");
    setStagedFiles([]);
    adjustHeight(true);
  };

  const handleContainerClick = (target: EventTarget) => {
    if (target instanceof Element && target.closest("button, label, input")) {
      return;
    }
    textareaRef.current?.focus();
  };

  const handleFilesAdded = (files: File[]) => {
    setStagedFiles((prev) => [...prev, ...files]);
  };

  const canSubmit = value.trim().length > 0 || stagedFiles.length > 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative mx-auto w-full max-w-2xl px-4 sm:px-0">
        <div
          className={cn(
            "relative flex w-full cursor-text flex-col rounded-[26px] text-left transition-all duration-200 border border-brand-rule/80 bg-brand-card shadow-xs",
            "focus-within:ring-2 focus-within:ring-brand-accent/20 focus-within:border-brand-accent/40",
            isDragging && "ring-2 ring-brand-accent/40 border-brand-accent bg-brand-cream/40"
          )}
          onClick={(e) => handleContainerClick(e.target)}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = Array.from(e.dataTransfer.files ?? []);
            if (dropped.length > 0) {
              handleFilesAdded(dropped);
            }
          }}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            aria-label="Attach file"
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length > 0) {
                handleFilesAdded(files);
              }
            }}
            multiple
            type="file"
          />

          {/* Staged files at the top — staged inside input, exactly like Gemini & ChatGPT */}
          {stagedFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 px-4 pt-3.5 pb-1">
              <AnimatePresence mode="popLayout">
                {stagedFiles.map((file, idx) => (
                  <StagedFilePreview
                    key={`${file.name}-${file.size}-${idx}`}
                    file={file}
                    onRemove={() =>
                      setStagedFiles((prev) => prev.filter((_, i) => i !== idx))
                    }
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Main Input Row */}
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Gemini Plus Button for Attachments */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add attachment"
              title="Add attachment"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-brand-muted transition-colors hover:bg-black/5 hover:text-brand-ink active:scale-95 dark:hover:bg-white/5"
            >
              <Plus className="size-5 stroke-[2]" />
            </button>

            {/* Auto-resizing Textarea */}
            <Textarea
              aria-label={placeholder}
              className="min-h-[44px] flex-1 resize-none border-none bg-transparent px-2 py-2.5 text-sm leading-relaxed text-brand-ink placeholder:text-brand-muted-soft focus-visible:ring-0 outline-none"
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={placeholder}
              ref={textareaRef}
              value={value}
            />

            {/* Model Selector & Action on Right */}
            <div className="flex items-center gap-1.5 shrink-0">
              <ModelPicker
                models={models.map((m) =>
                  typeof m === "string" ? { id: m, name: formatModelLabel(m) } : m
                )}
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                disabled={models.length === 0}
              />

              {isLoading ? (
                <button
                  aria-label="Stop generating"
                  className="flex size-8.5 cursor-pointer items-center justify-center rounded-full bg-brand-ink text-white shadow-xs transition-transform active:scale-95 dark:bg-white dark:text-brand-ink hover:opacity-90"
                  onClick={onStop}
                  type="button"
                  title="Stop"
                >
                  <Square className="size-3 fill-current" />
                </button>
              ) : (
                <button
                  aria-label="Send message"
                  className={cn(
                    "flex size-8.5 items-center justify-center rounded-full transition-all duration-150 shadow-xs",
                    canSubmit
                      ? "cursor-pointer bg-brand-ink text-white dark:bg-white dark:text-brand-ink hover:opacity-90 active:scale-95"
                      : "bg-black/5 text-black/25 dark:bg-white/5 dark:text-white/25 cursor-not-allowed"
                  )}
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  type="button"
                  title="Send"
                >
                  <ArrowUp className="size-4 stroke-[2.5]" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GeminiInput;
