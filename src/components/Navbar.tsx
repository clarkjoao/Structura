import { Link, useLocation } from "react-router-dom";
import { Network } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FileSystemStatus } from "./FileSystemStatus";
import { useFileSystemSync } from "@/infrastructure/persistence";
import { SettingsMenu } from "./SettingsMenu";
import { cn } from "@/lib/utils";

const Navbar = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  useFileSystemSync();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
            <Network className="h-4 w-4 text-primary" strokeWidth={1.75} />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Structura<span className="text-primary">{t("nav.brandSuffix")}</span>
          </span>
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 text-sm md:flex">
          <NavItem
            to="/"
            label={t("nav.workspaces")}
            active={
              pathname === "/" || pathname.startsWith("/workspace") || pathname.startsWith("/model")
            }
          />
          <NavItem
            to="/catalog"
            label={t("nav.registry")}
            active={pathname.startsWith("/catalog")}
          />
          <NavItem
            to="/plugins"
            label={t("nav.plugins")}
            active={pathname.startsWith("/plugins")}
          />
        </div>

        <div className="flex shrink-0 items-center gap-0">
          <FileSystemStatus compact />
          <SettingsMenu />
        </div>
      </div>
    </nav>
  );
};

function NavItem({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "transition-colors",
        active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}

export default Navbar;
