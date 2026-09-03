"use client";

import { useEffect, useState } from "react";

/**
 * TypingIndicator
 * Shown when isLoading=true but no streamingContent has arrived yet —
 * gives the user feedback that something is happening.
 */
export function TypingIndicator() {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-end gap-2">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 ring-1 ring-primary/20">
        <div className="flex gap-0.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
      {/* Text bubble */}
      <div className="rounded-2xl rounded-bl-md bg-muted/60 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">{"thinking" + ".".repeat(dots)}</span>
      </div>
    </div>
  );
}
