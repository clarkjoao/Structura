import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Blocks, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  STRUCTURA_PLUGIN_API_VERSION,
  type PluginCapability,
  type PluginManifest,
} from "@/features/plugins/plugin.types";
import type { ManifestValidationError } from "@/features/plugins/manifest-validation";
import {
  installPluginFromCode,
  previewPluginManifest,
  setBundledPluginEnabled,
  setPluginEnabled,
  uninstallPlugin,
  type PluginRuntimeState,
} from "@/features/plugins/plugin-registry";
import { usePluginRegistry } from "@/features/plugins/store/plugins.store";

function capabilityLabelKey(capability: PluginCapability): string {
  return `plugins.capability.${capability.replace(/:/g, "-")}`;
}

export default function PluginsPage() {
  const { t } = useTranslation();
  const plugins = usePluginRegistry();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState<{ manifest: PluginManifest; code: string } | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<PluginManifest | null>(null);

  const manifestErrorText = (errors: ManifestValidationError[]): string =>
    t("plugins.errors.invalidManifest", {
      details: errors
        .map((error) =>
          t(`plugins.errors.manifest.${error.code}`, {
            field: error.field,
            detail: error.detail,
            current: STRUCTURA_PLUGIN_API_VERSION,
          }),
        )
        .join("; "),
    });

  const handlePickedFile = async (file: File) => {
    const code = await file.text();
    const preview = previewPluginManifest(code);
    if (!preview.ok) {
      toast.error(
        preview.reason === "load-error"
          ? t(`plugins.errors.${preview.code}`)
          : manifestErrorText(preview.errors),
      );
      return;
    }
    setConsent({ manifest: preview.manifest, code });
  };

  const handleConfirmInstall = async () => {
    if (!consent) return;
    const { manifest, code } = consent;
    setConsent(null);
    const result = await installPluginFromCode(code);
    if (result.ok) {
      toast.success(t("plugins.toast.installed", { name: result.manifest.name }));
    } else if (result.reason === "activation-error") {
      toast.error(t("plugins.toast.activationFailed", { name: manifest.name }));
    } else if (result.reason === "invalid-manifest") {
      toast.error(manifestErrorText(result.errors));
    } else {
      toast.error(t(`plugins.errors.${result.code}`));
    }
  };

  const handleUninstall = async () => {
    if (!uninstallTarget) return;
    const { id, name } = uninstallTarget;
    setUninstallTarget(null);
    await uninstallPlugin(id);
    toast.success(t("plugins.toast.uninstalled", { name }));
  };

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="container mx-auto max-w-3xl px-5 py-8">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("plugins.title")}</h1>
          <Button onClick={() => fileInputRef.current?.click()} className="gap-1.5">
            <Upload className="h-4 w-4" />
            {t("plugins.install")}
          </Button>
        </div>
        <p className="mb-8 text-sm text-muted-foreground">{t("plugins.subtitle")}</p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".js,text/javascript"
          className="hidden"
          tabIndex={-1}
          aria-label={t("plugins.install")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handlePickedFile(file);
          }}
        />

        {plugins.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center">
            <Blocks className="h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium text-foreground">{t("plugins.empty")}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t("plugins.emptyHint")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {plugins.map((plugin) => (
              <PluginCard
                key={plugin.manifest.id}
                plugin={plugin}
                onToggle={(enabled) =>
                  void (plugin.source === "bundled"
                    ? setBundledPluginEnabled(plugin.manifest.id, enabled)
                    : setPluginEnabled(plugin.manifest.id, enabled))
                }
                onUninstall={() => setUninstallTarget(plugin.manifest)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={consent !== null} onOpenChange={(open) => !open && setConsent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("plugins.consent.title", { name: consent?.manifest.name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("plugins.consent.description")}</DialogDescription>
          </DialogHeader>
          {consent && (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                {consent.manifest.description}{" "}
                <span className="whitespace-nowrap">
                  ({t("plugins.by", { author: consent.manifest.author })}, v
                  {consent.manifest.version})
                </span>
              </p>
              {consent.manifest.capabilities.length > 0 ? (
                <>
                  <p>{t("plugins.consent.capabilitiesIntro")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {consent.manifest.capabilities.map((capability) => (
                      <Badge key={capability} variant="secondary">
                        {t(capabilityLabelKey(capability))}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <p>{t("plugins.consent.noCapabilities")}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsent(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleConfirmInstall()}>
              {t("plugins.consent.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={uninstallTarget !== null}
        onOpenChange={(open) => !open && setUninstallTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("plugins.uninstallConfirm.title", { name: uninstallTarget?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("plugins.uninstallConfirm.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleUninstall()}>
              {t("plugins.uninstall")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PluginCard({
  plugin,
  onToggle,
  onUninstall,
}: {
  plugin: PluginRuntimeState;
  onToggle: (enabled: boolean) => void;
  onUninstall: () => void;
}) {
  const { t } = useTranslation();
  const { manifest } = plugin;
  const isBundled = plugin.source === "bundled";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{manifest.name}</h2>
            <span className="text-xs text-muted-foreground">v{manifest.version}</span>
            {isBundled && <Badge variant="outline">{t("plugins.builtin")}</Badge>}
            {plugin.errored && (
              <Badge variant="destructive" className="gap-1">
                <TriangleAlert className="h-3 w-3" aria-hidden />
                {t("plugins.errored")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("plugins.by", { author: manifest.author })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t("plugins.enable")}
            <Switch
              checked={plugin.enabled}
              onCheckedChange={onToggle}
              aria-label={t("plugins.enable")}
            />
          </label>
          {/* Bundled plugins ship with the build and can only be disabled, never uninstalled. */}
          {!isBundled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onUninstall}
              aria-label={t("plugins.uninstall")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <p className="text-sm text-muted-foreground">{manifest.description}</p>
        {plugin.errored && <p className="text-sm text-destructive">{t("plugins.erroredHint")}</p>}
        {manifest.capabilities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{t("plugins.capabilities")}:</span>
            {manifest.capabilities.map((capability) => (
              <Badge key={capability} variant="secondary">
                {t(capabilityLabelKey(capability))}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
