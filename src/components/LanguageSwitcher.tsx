import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { I18N_STORAGE_KEY } from "@/infrastructure/i18n";

const LANGS = [
  { code: "pt-BR", labelKey: "language.ptBR" as const },
  { code: "en", labelKey: "language.en" as const },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const resolved = i18n.resolvedLanguage?.toLowerCase().startsWith("pt") ? "pt-BR" : "en";

  return (
    <Select
      value={resolved}
      onValueChange={(code) => {
        void i18n.changeLanguage(code);
        localStorage.setItem(I18N_STORAGE_KEY, code);
      }}
    >
      <SelectTrigger
        className="h-8 w-[148px] text-xs border-border bg-background"
        aria-label={t("language.label")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {LANGS.map(({ code, labelKey }) => (
          <SelectItem key={code} value={code} className="text-xs">
            {t(labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
