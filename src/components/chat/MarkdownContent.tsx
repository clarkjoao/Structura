import type { HTMLAttributes, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  isStreaming?: boolean;
}

interface MarkdownElementProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

interface MarkdownLinkProps extends MarkdownElementProps {
  href?: string;
}

interface MarkdownCodeProps extends MarkdownElementProps {
  inline?: boolean;
}

const markdownComponents = {
  p: ({ children }: MarkdownElementProps) => (
    <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
  ),
  strong: ({ children }: MarkdownElementProps) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: MarkdownElementProps) => <em className="italic">{children}</em>,
  code: ({ inline, children }: MarkdownCodeProps) =>
    inline ? (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
        {children}
      </code>
    ) : (
      <code>{children}</code>
    ),
  pre: ({ children }: MarkdownElementProps) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100">
      {children}
    </pre>
  ),
  ul: ({ children }: MarkdownElementProps) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }: MarkdownElementProps) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>
  ),
  li: ({ children }: MarkdownElementProps) => <li className="pl-1 leading-relaxed">{children}</li>,
  h1: ({ children }: MarkdownElementProps) => (
    <h1 className="mb-2 mt-3 text-base font-bold text-foreground first:mt-0">{children}</h1>
  ),
  h2: ({ children }: MarkdownElementProps) => (
    <h2 className="mb-1.5 mt-2 text-sm font-semibold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }: MarkdownElementProps) => (
    <h3 className="mb-1 mt-2 text-sm font-medium text-foreground first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }: MarkdownElementProps) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  a: ({ href, children }: MarkdownLinkProps) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  table: ({ children }: MarkdownElementProps) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: MarkdownElementProps) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }: MarkdownElementProps) => (
    <th className="px-3 py-2 text-left font-medium text-foreground">{children}</th>
  ),
  td: ({ children }: MarkdownElementProps) => (
    <td className="border-t border-border px-3 py-2 text-muted-foreground">{children}</td>
  ),
};

export function MarkdownContent({ content, isStreaming = false }: MarkdownContentProps) {
  if (isStreaming && content.length === 0) {
    return (
      <span className="flex h-5 items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
      </span>
    );
  }

  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {isStreaming && content.length > 0 ? (
        <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse align-middle bg-current" />
      ) : null}
    </div>
  );
}
