"use client";

import { Paperclip, Send, Square } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ModelPicker, type AIModelItem } from "@/components/ai/model-picker";
import { MessageFileAttachment } from "@/components/chat/message-file-attachment";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

/** Short, human-readable label derived from a model ID like "deepseek-ai/deepseek-v4.1-flash". */
function formatModelLabel(model: string): string {
  return (model.split("/").pop() || model)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface AIInputSearchProps {
  placeholder?: string;
  searchLabel?: string;
  /** Available models (IDs or rich items) to show in the selector. */
  models: (string | AIModelItem)[];
  /** Currently selected model (controlled). */
  selectedModel: string;
  /** Called when the user picks a different model. */
  onModelChange: (model: string) => void;
  /** Receives the text, web-search flag (always false now), selected model, and staged files. */
  onSubmit?: (
    value: string,
    options: { webSearch: boolean; model: string | null; files?: File[] }
  ) => void;
  /** Called with the files picked through the attach button. */
  onFilesSelected?: (files: File[]) => void;
  /** True while the agent turn is streaming. */
  isLoading?: boolean;
  /** Cancels the in-flight generation. */
  onStop?: () => void;
  className?: string;
}

export default function AI_Input_Search({
  placeholder = "Ask Muvx anything — loads, rates, drivers, invoices, or attach a document...",
  models = [],
  selectedModel = "",
  onModelChange,
  onSubmit,
  onFilesSelected,
  isLoading = false,
  onStop,
  className,
}: AIInputSearchProps) {
  const [value, setValue] = useState("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 200,
  });

  const handleSubmit = () => {
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

  // Mouse convenience: clicking the box around the field focuses it.
  const handleContainerClick = (target: EventTarget) => {
    if (target instanceof Element && target.closest("button, label, input")) {
      return;
    }
    textareaRef.current?.focus();
  };

  const handleAddFiles = (files: File[]) => {
    setStagedFiles((prev) => [...prev, ...files]);
    onFilesSelected?.(files);
  };

  const canSubmit = (value.trim().length > 0 || stagedFiles.length > 0) && !isLoading;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative mx-auto w-full max-w-2xl px-4 sm:px-0">
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: pointer-only shortcut */}
        <div
          className={cn(
            "relative flex w-full cursor-text flex-col rounded-2xl text-left transition-all duration-200 border border-brand-rule bg-brand-card shadow-xs",
            "has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-brand-accent/20 has-[textarea:focus-visible]:border-brand-accent/40",
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
              handleAddFiles(dropped);
            }
          }}
        >
          <Textarea
            aria-label={placeholder}
            className="min-h-[56px] w-full resize-none rounded-2xl rounded-b-none border-none bg-transparent px-4 py-3.5 text-sm leading-relaxed placeholder:text-brand-muted-soft focus-visible:ring-0 text-brand-ink outline-none"
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

          {/* Staged files — compact cards matching the message treatment */}
          {stagedFiles.length > 0 && (
            <div className="flex flex-wrap items-start gap-1.5 px-3.5 pb-2 pt-1">
              {stagedFiles.map((file, idx) => (
                <MessageFileAttachment
                  key={`${file.name}-${idx}`}
                  id={`staged-${file.name}-${idx}`}
                  part={{
                    type: "file",
                    mediaType: file.type || "application/octet-stream",
                    filename: file.name,
                    url: "",
                    size: file.size,
                  }}
                  className="group/attachment"
                  onRemove={() =>
                    setStagedFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-b-2xl bg-brand-cream/30 px-3 pt-1.5 pb-2.5 border-t border-brand-rule/60">
            <div className="flex items-center gap-2">
              {/* Model selector with authentic Lobehub icons */}
              <ModelPicker
                models={models.map((m) =>
                  typeof m === "string" ? { id: m, name: formatModelLabel(m) } : m
                )}
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                disabled={models.length === 0}
              />

              {/* Attach file button */}
              <label className="group/attach cursor-pointer rounded-lg bg-black/5 p-2 transition-transform has-focus-visible:ring-2 has-focus-visible:ring-sky-600 motion-safe:active:scale-[0.97] dark:bg-white/5 dark:has-focus-visible:ring-sky-500">
                <input
                  aria-label="Attach file"
                  className="sr-only"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (files.length > 0) {
                      handleAddFiles(files);
                    }
                  }}
                  multiple
                  type="file"
                />
                <Paperclip className="h-4 w-4 text-black/40 transition-colors group-hover/attach:text-black dark:text-white/40 dark:group-hover/attach:text-white" />
              </label>
            </div>

            {/* Send or Stop button */}
            {isLoading ? (
              <button
                aria-label="Stop generation"
                className="cursor-pointer rounded-lg bg-black/5 p-2 text-brand-ink transition-transform hover:bg-black/10 active:scale-[0.97] dark:bg-white/10 dark:text-white"
                onClick={onStop}
                type="button"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                aria-label="Send"
                className={cn(
                  "rounded-lg p-2 transition-[color,background-color,scale] motion-safe:active:scale-[0.97]",
                  canSubmit
                    ? "cursor-pointer bg-sky-500/15 text-sky-500"
                    : "bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40"
                )}
                disabled={!canSubmit}
                onClick={handleSubmit}
                type="button"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
