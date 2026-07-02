import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";

export interface MermaidPreviewProps {
  mermaid: string;
}

export function MermaidPreview({ mermaid }: MermaidPreviewProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(mermaid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          {t("flowRecorder.mermaid")}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={t("flowRecorder.copyMermaidTitle")}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="rounded-md border border-border bg-secondary p-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap overflow-auto max-h-32">
        {mermaid}
      </pre>
    </div>
  );
}
