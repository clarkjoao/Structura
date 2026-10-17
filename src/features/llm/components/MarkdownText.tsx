"use client";

import { memo, useState, type ComponentPropsWithoutRef } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import remarkGfm from "remark-gfm";
import {
  MarkdownTextPrimitive,
  useIsMarkdownCodeBlock,
  type CodeHeaderProps,
} from "@assistant-ui/react-markdown";
import { cn } from "@/lib/utils";

/** The slice of a Markdown (mdast) node this file needs. */
interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}

/**
 * Raw HTML in a reply is model output, not markup we trust: show it as the
 * text it is instead of rendering or silently dropping it. react-markdown has
 * no `rehype-raw` here, so HTML nodes would otherwise disappear.
 */
function remarkHtmlAsText() {
  const walk = (node: MarkdownNode): void => {
    if (node.type === "html") {
      node.type = "text";
      return;
    }
    node.children?.forEach(walk);
  };
  return (tree: MarkdownNode) => walk(tree);
}

const REMARK_PLUGINS = [remarkGfm, remarkHtmlAsText];

function CodeHeader({ language, code }: CodeHeaderProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center justify-between rounded-t-md border border-b-0 border-border bg-muted px-3 py-1">
      <span className="font-mono text-[11px] text-muted-foreground">{language}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={t("llmChat.markdown.copyCode")}
        title={t("llmChat.markdown.copyCode")}
        className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

function Code({ className, ...props }: ComponentPropsWithoutRef<"code">) {
  const isCodeBlock = useIsMarkdownCodeBlock();
  return (
    <code
      className={cn(
        !isCodeBlock && "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]",
        className,
      )}
      {...props}
    />
  );
}

const MARKDOWN_COMPONENTS = {
  CodeHeader,
  code: Code,
  pre: ({ className, ...props }: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className={cn(
        "mb-2 overflow-x-auto rounded-b-md border border-border bg-muted p-3 font-mono text-xs leading-relaxed",
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a
      {...props}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("text-primary underline underline-offset-2", className)}
    />
  ),
  p: ({ className, ...props }: ComponentPropsWithoutRef<"p">) => (
    <p className={cn("mb-2 last:mb-0", className)} {...props} />
  ),
  ul: ({ className, ...props }: ComponentPropsWithoutRef<"ul">) => (
    <ul className={cn("mb-2 ml-4 list-disc space-y-1", className)} {...props} />
  ),
  ol: ({ className, ...props }: ComponentPropsWithoutRef<"ol">) => (
    <ol className={cn("mb-2 ml-4 list-decimal space-y-1", className)} {...props} />
  ),
  h1: ({ className, ...props }: ComponentPropsWithoutRef<"h1">) => (
    <h1 className={cn("mb-2 text-base font-semibold", className)} {...props} />
  ),
  h2: ({ className, ...props }: ComponentPropsWithoutRef<"h2">) => (
    <h2 className={cn("mb-2 text-sm font-semibold", className)} {...props} />
  ),
  h3: ({ className, ...props }: ComponentPropsWithoutRef<"h3">) => (
    <h3 className={cn("mb-1 text-sm font-medium", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className={cn("mb-2 border-l-2 border-border pl-3 text-muted-foreground", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }: ComponentPropsWithoutRef<"hr">) => (
    <hr className={cn("my-3 border-border", className)} {...props} />
  ),
  table: ({ className, ...props }: ComponentPropsWithoutRef<"table">) => (
    <div className="mb-2 overflow-x-auto rounded-md border border-border">
      <table className={cn("w-full border-collapse text-xs", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }: ComponentPropsWithoutRef<"th">) => (
    <th
      className={cn("border-b border-border bg-muted px-2 py-1 text-left font-medium", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }: ComponentPropsWithoutRef<"td">) => (
    <td className={cn("border-b border-border px-2 py-1 align-top", className)} {...props} />
  ),
};

/** Assistant text as Markdown (GFM). Used for assistant text parts only. */
export const MarkdownText = memo(function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={REMARK_PLUGINS}
      components={MARKDOWN_COMPONENTS}
      className="text-sm leading-relaxed break-words [overflow-wrap:anywhere]"
    />
  );
});
