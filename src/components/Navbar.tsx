import { Link, NavLink } from "react-router-dom";
import { Network, Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { FileSystemStatus } from "./FileSystemStatus";
import { useFileSystemSync } from "@/infrastructure/persistence";
import { LanguageSwitcher } from "./LanguageSwitcher";

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  useFileSystemSync();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
            <Network className="h-4 w-4 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Structura<span className="text-primary">{t("nav.brandSuffix")}</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            {t("nav.workspaces")}
          </Link>
          <NavLink
            to="/journeys"
            className={({ isActive }) =>
              cn(
                "hover:text-foreground transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground",
              )
            }
          >
            {t("nav.journeys")}
          </NavLink>
          <Link to="/catalog" className="hover:text-foreground transition-colors">
            {t("nav.registry")}
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <FileSystemStatus />
          <LanguageSwitcher />
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            title={theme === "dark" ? t("theme.lightMode") : t("theme.darkMode")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
