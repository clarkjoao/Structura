import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Diagram } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ShareUrlResult, generateShareUrl, generateViewerUrl } from "@/lib/share-url";

/** Nothing chosen. A value rather than an empty string, so the select says it. */
const NO_FLOW = "";

interface ShareModalProps {
  diagram: Diagram;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CopiedState = "share" | "embed" | null;

/** Creates a content-based key to detect diagram changes for memoization. */
function getSnapshotVersionKey(snapshot: Diagram["snapshot"]): string {
  if (!snapshot) return "";
  return JSON.stringify({
    components: Object.keys(snapshot.components ?? {}).length,
    connections: Object.keys(snapshot.connections ?? {}).length,
    flows: Object.keys(snapshot.flows ?? {}).length,
  });
}

export function ShareModal({ diagram, open, onOpenChange }: ShareModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<CopiedState>(null);
  /**
   * The script the link opens on. Not part of the diagram — part of the
   * invitation — so it is chosen here and travels beside the payload.
   */
  const [flowId, setFlowId] = useState<string>(NO_FLOW);

  const flows = useMemo(() => Object.values(diagram.snapshot?.flows ?? {}), [diagram.snapshot]);

  // Depend on content key so URL regenerates when components are added/removed
  const snapshotVersion = getSnapshotVersionKey(diagram.snapshot);

  const shareResult: ShareUrlResult = useMemo(
    () => generateShareUrl(diagram, { flowId: flowId || null }),
    [diagram.id, snapshotVersion, flowId],
  );

  const shareUrl = shareResult.url;

  const embedUrl = useMemo(
    () => generateViewerUrl(diagram, flowId ? { flowId } : {}),
    [diagram.id, snapshotVersion, flowId],
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
          {flows.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="share-flow">
                {t("share.flowLabel")}
              </label>
              <p className="text-xs text-muted-foreground">{t("share.flowDescription")}</p>
              <select
                id="share-flow"
                data-testid="share-flow"
                value={flowId}
                onChange={(event) => setFlowId(event.target.value)}
                className="w-full rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value={NO_FLOW}>{t("share.flowNone")}</option>
                {flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </select>
            </div>
          )}

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
