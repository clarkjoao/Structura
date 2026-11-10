import ReactMarkdown from "react-markdown";

/** Markdown body of a note. Kept in its own module so react-markdown loads lazily. */
export default function NoteMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 text-[13px] leading-relaxed">{children}</p>
        ),
        h1: ({ children }) => (
          <h1 className="text-base font-semibold mt-3 mb-1 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-medium mt-2 mb-0.5 first:mt-0">{children}</h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 mb-2 space-y-0.5 text-[13px]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 mb-2 space-y-0.5 text-[13px]">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children }) => (
          <code className="px-1 py-0.5 rounded bg-foreground/10 text-[12px] font-mono">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="p-2 rounded-md bg-foreground/10 text-[12px] overflow-x-auto mb-2">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-foreground/30 pl-3 my-2 italic text-[13px]">
            {children}
          </blockquote>
        ),
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
