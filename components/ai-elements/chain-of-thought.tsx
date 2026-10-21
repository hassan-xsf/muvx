"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { BrainIcon, ChevronDownIcon, DotIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { createContext, memo, useContext, useMemo } from "react";

interface ChainOfThoughtContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const ChainOfThoughtContext = createContext<ChainOfThoughtContextValue | null>(
  null
);

const useChainOfThought = () => {
  const context = useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error(
      "ChainOfThought components must be used within ChainOfThought"
    );
  }
  return context;
};

export type ChainOfThoughtProps = ComponentProps<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ChainOfThought = memo(
  ({
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
  }: ChainOfThoughtProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    });

    const chainOfThoughtContext = useMemo(
      () => ({ isOpen, setIsOpen }),
      [isOpen, setIsOpen]
    );

    return (
      <ChainOfThoughtContext.Provider value={chainOfThoughtContext}>
        <div className={cn("not-prose w-full space-y-4", className)} {...props}>
          {children}
        </div>
      </ChainOfThoughtContext.Provider>
    );
  }
);

export type ChainOfThoughtHeaderProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  /**
   * Replaces the default Brain glyph. Pass `null` together with children to
   * render a completely bare header (no icon, no default label) — that is
   * what a product wants when it renders its own avatar, since two faces or a
   * generic "Chain of Thought" string next to a branded avatar reads as a bug.
   */
  headerIcon?: ReactNode | null;
};

export const ChainOfThoughtHeader = memo(
  ({ className, children, headerIcon, ...props }: ChainOfThoughtHeaderProps) => {
    const { isOpen, setIsOpen } = useChainOfThought();
    // Only fall back to the Brain glyph + default label when the caller opted
    // out of them entirely (undefined). An explicit `null` means "no glyph".
    const hasCustomHeader = headerIcon !== undefined;

    return (
      <Collapsible onOpenChange={setIsOpen} open={isOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
            className
          )}
          {...props}
        >
          {hasCustomHeader ? headerIcon : <BrainIcon className="size-4" />}
          {!hasCustomHeader && (
            <span className="flex-1 text-left">
              {children ?? "Chain of Thought"}
            </span>
          )}
          {hasCustomHeader && children && (
            <span className="flex-1 text-left">{children}</span>
          )}
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              isOpen ? "rotate-180" : "rotate-0"
            )}
          />
        </CollapsibleTrigger>
      </Collapsible>
    );
  }
);

export type ChainOfThoughtStepProps = ComponentProps<"div"> & {
  icon?: LucideIcon;
  label: ReactNode;
  description?: ReactNode;
  status?: "complete" | "active" | "pending";
  /**
   * Renders the vertical rail that visually links this step to the next one.
   * Off by default: a trailing rail on the final step dangles below the last
   * icon with nothing to connect to. The container sets this automatically for
   * all but the last child.
   */
  showConnector?: boolean;
};

const stepStatusStyles = {
  active: "text-foreground",
  complete: "text-muted-foreground",
  pending: "text-muted-foreground/50",
};

export const ChainOfThoughtStep = memo(
  ({
    className,
    icon: Icon = DotIcon,
    label,
    description,
    status = "complete",
    showConnector = false,
    children,
    ...props
  }: ChainOfThoughtStepProps) => (
    <div
      className={cn(
        "group/step relative flex gap-2 text-sm",
        stepStatusStyles[status],
        "fade-in-0 slide-in-from-top-2 animate-in",
        className
      )}
      {...props}
    >
      {/* Icon column. `after:` draws the rail as a pseudo-element so it never
          affects layout and is hidden cleanly on the last step. */}
      <div className="relative mt-0.5 flex size-4 shrink-0 justify-center">
        <Icon className="size-4" />
        {showConnector && (
          <span
            aria-hidden
            className="absolute top-6 left-1/2 h-[calc(100%+0.5rem)] w-px -translate-x-1/2 bg-border"
          />
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden pb-2 last:pb-0">
        <div>{label}</div>
        {description && (
          <div className="text-muted-foreground text-xs">{description}</div>
        )}
        {children}
      </div>
    </div>
  )
);

export type ChainOfThoughtSearchResultsProps = ComponentProps<"div">;

export const ChainOfThoughtSearchResults = memo(
  ({ className, ...props }: ChainOfThoughtSearchResultsProps) => (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  )
);

export type ChainOfThoughtSearchResultProps = ComponentProps<typeof Badge>;

export const ChainOfThoughtSearchResult = memo(
  ({ className, children, ...props }: ChainOfThoughtSearchResultProps) => (
    <Badge
      className={cn("gap-1 px-2 py-0.5 font-normal text-xs", className)}
      variant="secondary"
      {...props}
    >
      {children}
    </Badge>
  )
);

export type ChainOfThoughtContentProps = ComponentProps<
  typeof CollapsibleContent
>;

export const ChainOfThoughtContent = memo(
  ({ className, children, ...props }: ChainOfThoughtContentProps) => {
    const { isOpen } = useChainOfThought();

    return (
      <Collapsible open={isOpen}>
        <CollapsibleContent
          className={cn(
            "mt-2 space-y-3",
            "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
            className
          )}
          {...props}
        >
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  }
);

/**
 * Per-step trigger row. Renders the step label and chevron; clicking it
 * toggles the parent ChainOfThought collapsible. Mirrors the prompt-kit
 * API so existing examples (`<ChainOfThoughtTrigger>...</ChainOfThoughtTrigger>`)
 * drop in unchanged.
 */
export type ChainOfThoughtTriggerProps = ComponentProps<"button">;

export const ChainOfThoughtTrigger = memo(
  ({ className, children, ...props }: ChainOfThoughtTriggerProps) => {
    const { isOpen, setIsOpen } = useChainOfThought();
    return (
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center gap-2 text-left text-sm transition-colors hover:text-foreground",
          className,
        )}
        {...props}
      >
        <span className="flex-1">{children}</span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 transition-transform",
            isOpen ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
    );
  },
);

/**
 * Single bullet inside a ChainOfThoughtContent block. Renders a leading
 * dot so the list reads as a sequence of facts the model considered.
 */
export type ChainOfThoughtItemProps = ComponentProps<"div">;

export const ChainOfThoughtItem = memo(
  ({ className, children, ...props }: ChainOfThoughtItemProps) => (
    <div
      className={cn(
        "flex items-start gap-2 text-muted-foreground text-xs leading-relaxed",
        className,
      )}
      {...props}
    >
      <DotIcon className="mt-1 size-3 shrink-0 text-muted-foreground/60" />
      <span className="flex-1">{children}</span>
    </div>
  ),
);

export type ChainOfThoughtImageProps = ComponentProps<"div"> & {
  caption?: string;
};

export const ChainOfThoughtImage = memo(
  ({ className, children, caption, ...props }: ChainOfThoughtImageProps) => (
    <div className={cn("mt-2 space-y-2", className)} {...props}>
      <div className="relative flex max-h-[22rem] items-center justify-center overflow-hidden rounded-lg bg-muted p-3">
        {children}
      </div>
      {caption && <p className="text-muted-foreground text-xs">{caption}</p>}
    </div>
  )
);

ChainOfThought.displayName = "ChainOfThought";
ChainOfThoughtHeader.displayName = "ChainOfThoughtHeader";
ChainOfThoughtStep.displayName = "ChainOfThoughtStep";
ChainOfThoughtSearchResults.displayName = "ChainOfThoughtSearchResults";
ChainOfThoughtSearchResult.displayName = "ChainOfThoughtSearchResult";
ChainOfThoughtContent.displayName = "ChainOfThoughtContent";
ChainOfThoughtTrigger.displayName = "ChainOfThoughtTrigger";
ChainOfThoughtItem.displayName = "ChainOfThoughtItem";
ChainOfThoughtImage.displayName = "ChainOfThoughtImage";
