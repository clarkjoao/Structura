import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Diagram } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { generateViewerUrl, getViewerPostMessageUrl } from "@/lib/diagram-url";

type EmbedMethod = "iframe-hash" | "iframe-postmessage";

interface EmbedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagram: Diagram;
}

function isEmbedMethod(value: string): value is EmbedMethod {
  return value === "iframe-hash" || value === "iframe-postmessage";
}

function buildIframeCode(embedUrl: string): string {
  return `<iframe
  src="${embedUrl}"
  width="100%"
  height="500"
  frameborder="0"
  allowfullscreen
></iframe>`;
}

export function EmbedModal({ open, onOpenChange, diagram }: EmbedModalProps) {
  const { t } = useTranslation();
  const [activeMethod, setActiveMethod] = useState<EmbedMethod>("iframe-hash");
  const origin = window.location.origin;

  const hashIframeCode = useMemo(() => {
    const embedUrl = generateViewerUrl(diagram);
    return buildIframeCode(embedUrl);
  }, [diagram]);

  const reactSnippet = useMemo(
    () => `import { useEffect, useRef } from "react";
import diagramJson from "./diagram.json";

function StructuraDiagramEmbed() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const send = () => {
      iframe.contentWindow?.postMessage(
        { type: "STRUCTURA_LOAD", diagram: diagramJson },
        "${origin}",
      );
    };

    iframe.addEventListener("load", send);
    return () => iframe.removeEventListener("load", send);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src="${getViewerPostMessageUrl()}"
      width="100%"
      height="500"
      frameBorder="0"
    />
  );
}
`,
    [origin],
  );

  const activeSnippet = activeMethod === "iframe-hash" ? hashIframeCode : reactSnippet;

  const handleCopyEmbed = () => {
    void navigator.clipboard.writeText(activeSnippet).then(() => {
      toast.success(t("export.embed.copied"));
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("export.embed.title")}</DialogTitle>
          <DialogDescription>{t("export.embed.menuItem")}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeMethod}
          onValueChange={(value) => {
            if (isEmbedMethod(value)) setActiveMethod(value);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="iframe-hash">{t("export.embed.tabs.direct")}</TabsTrigger>
            <TabsTrigger value="iframe-postmessage">
              {t("export.embed.tabs.postMessage")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="iframe-hash" className="space-y-3">
            <Textarea value={hashIframeCode} readOnly className="min-h-[180px] font-mono text-xs" />
          </TabsContent>

          <TabsContent value="iframe-postmessage">
            <Textarea value={reactSnippet} readOnly className="min-h-[260px] font-mono text-xs" />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
          <Button onClick={handleCopyEmbed}>{t("flows.copyDrawio")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
