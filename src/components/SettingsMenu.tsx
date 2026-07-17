import { useTranslation } from "react-i18next";
import { Moon, Sun, Monitor, Check, Settings as SettingsIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { I18N_STORAGE_KEY } from "@/infrastructure/i18n";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

const LANGS = [
  { code: "pt-BR", labelKey: "language.ptBR" as const },
  { code: "en", labelKey: "language.en" as const },
];

export function SettingsMenu() {
  const { i18n, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const resolved =
    i18n.resolvedLanguage?.toLowerCase().startsWith("pt") ? "pt-BR" : "en";

  const isDark = theme === "dark";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          aria-label={t("settings.menuLabel")}
          title={t("settings.menuLabel")}
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-64 p-0">
        <div className="p-3">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("settings.appearance")}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
            <label
              htmlFor="settings-theme-toggle"
              className="flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              {isDark ? (
                <Moon className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {isDark ? t("theme.darkMode") : t("theme.lightMode")}
            </label>
            <Switch
              id="settings-theme-toggle"
              checked={isDark}
              onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const sys: "light" | "dark" = window.matchMedia(
                "(prefers-color-scheme: dark)",
              ).matches
                ? "dark"
                : "light";
              setTheme(sys);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <Monitor className="h-3.5 w-3.5" />
            {t("settings.followSystem")}
          </button>
        </div>

        <div className="border-t border-border p-3">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("language.label")}
          </p>
          {LANGS.map(({ code, labelKey }) => {
            const selected = code === resolved;
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  void i18n.changeLanguage(code);
                  localStorage.setItem(I18N_STORAGE_KEY, code);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                  selected && "text-foreground font-medium",
                )}
              >
                <span>{t(labelKey)}</span>
                {selected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
