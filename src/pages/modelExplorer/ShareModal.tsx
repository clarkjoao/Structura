import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Diagram } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ShareUrlResult, generateShareUrl, generateViewerUrl } from "@/lib/diagram-url";

interface ShareModalProps {
  diagram: Diagram;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CopiedState = "share" | "embed" | null;

export function ShareModal({ diagram, open, onOpenChange }: ShareModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<CopiedState>(null);
  const shareResult: ShareUrlResult = useMemo(
    () => generateShareUrl(diagram),

    [diagram.id],
  );
  const shareUrl = shareResult.url;
  const embedUrl = useMemo(
    () => generateViewerUrl(diagram),

    [diagram.id],
  );
  const formattedLinkSize = useMemo(
    () => new Intl.NumberFormat().format(shareResult.compressedLength),
    [shareResult.compressedLength],
  );
  const compressionPercent = useMemo(
    () => Math.round(shareResult.compressionRatio * 100),
    [shareResult.compressionRatio],
  );

  const copyUrl = (url: string, copyType: Exclude<CopiedState, null>) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(copyType);
      toast.success(t("share.copied"));
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("share.modalTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("share.linkLabel")}</label>
            <p className="text-xs text-muted-foreground">{t("share.linkDescription")}</p>
            <p className="text-xs text-muted-foreground">
              {t("share.urlSize", { size: formattedLinkSize })}
              {" · "}
              {compressionPercent}% {t("share.smaller")}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="text-xs font-mono" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyUrl(shareUrl, "share")}
                title={t("share.button")}
                disabled={!shareUrl}
              >
                {copied === "share" ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>

          {!shareResult.isSafeForAllEnvs && shareResult.compressedLength < 64_000 ? (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "8px 12px",
                background: "var(--color-background-warning)",
                border: "1px solid var(--color-border-warning)",
                borderRadius: "var(--border-radius-md)",
                fontSize: 12,
                color: "var(--color-text-warning)",
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t("share.urlLargeWarning")}</span>
            </div>
          ) : null}

          {shareResult && shareResult.compressedLength >= 64_000 ? (
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                padding: "8px 12px",
                background: "var(--color-background-danger)",
                border: "1px solid var(--color-border-danger)",
                borderRadius: "var(--border-radius-md)",
                fontSize: 12,
                color: "var(--color-text-danger)",
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t("share.urlTooLargeError")}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">{t("share.embedLabel")}</label>
            <p className="text-xs text-muted-foreground">{t("share.embedDescription")}</p>
            <div className="flex gap-2">
              <Input readOnly value={embedUrl} className="text-xs font-mono" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyUrl(embedUrl, "embed")}
                title={t("share.button")}
                disabled={!embedUrl}
              >
                {copied === "embed" ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
