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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

type EmbedMethod = "iframe-base64" | "iframe-postmessage" | "iframe-src";

interface EmbedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagram: Diagram;
}

function isEmbedMethod(value: string): value is EmbedMethod {
  return value === "iframe-base64" || value === "iframe-postmessage" || value === "iframe-src";
}

function encodeDiagramToBase64(diagram: Diagram): string {
  const json = JSON.stringify(diagram);
  const utf8 = new TextEncoder().encode(json);
  let binary = "";
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
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
  const [activeMethod, setActiveMethod] = useState<EmbedMethod>("iframe-base64");
  const [sourceUrl, setSourceUrl] = useState("");
  const origin = window.location.origin;

  const base64IframeCode = useMemo(() => {
    const base64 = encodeDiagramToBase64(diagram);
    const embedUrl = `${origin}/embed?data=${encodeURIComponent(base64)}`;
    return buildIframeCode(embedUrl);
  }, [diagram, origin]);

  const base64UrlLength = useMemo(() => {
    const match = base64IframeCode.match(/src="([^"]+)"/);
    return match?.[1]?.length ?? 0;
  }, [base64IframeCode]);

  const sourceIframeCode = useMemo(() => {
    const normalizedSourceUrl = sourceUrl.trim();
    const embedUrl = normalizedSourceUrl
      ? `${origin}/embed?src=${encodeURIComponent(normalizedSourceUrl)}`
      : `${origin}/embed`;
    return buildIframeCode(embedUrl);
  }, [origin, sourceUrl]);

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
      src="${origin}/embed"
      width="100%"
      height="500"
      frameBorder="0"
    />
  );
}
`,
    [origin],
  );

  const activeSnippet =
    activeMethod === "iframe-base64"
      ? base64IframeCode
      : activeMethod === "iframe-postmessage"
        ? reactSnippet
        : sourceIframeCode;

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="iframe-base64">{t("export.embed.tabs.direct")}</TabsTrigger>
            <TabsTrigger value="iframe-postmessage">{t("export.embed.tabs.postMessage")}</TabsTrigger>
            <TabsTrigger value="iframe-src">{t("export.embed.tabs.src")}</TabsTrigger>
          </TabsList>

          <TabsContent value="iframe-base64" className="space-y-3">
            {base64UrlLength > 2000 ? (
              <p className="text-xs text-amber-500">{t("export.embed.urlTooLong")}</p>
            ) : null}
            <Textarea value={base64IframeCode} readOnly className="min-h-[180px] font-mono text-xs" />
          </TabsContent>

          <TabsContent value="iframe-postmessage">
            <Textarea value={reactSnippet} readOnly className="min-h-[260px] font-mono text-xs" />
          </TabsContent>

          <TabsContent value="iframe-src" className="space-y-3">
            <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
            <Textarea value={sourceIframeCode} readOnly className="min-h-[180px] font-mono text-xs" />
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
