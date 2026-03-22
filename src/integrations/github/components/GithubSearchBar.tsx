import { useEffect, useState } from "react";
import { Search, Loader2, User } from "lucide-react";
import {
  GH_SEARCH_FIELDS,
  type GHSearchField,
  type GHSearchFilters,
  type GithubOrg,
} from "../github.types";
import type { GithubClient } from "../githubClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

interface Props {
  loading: boolean;
  client: GithubClient | null;
  onSearch: (query: string, filters: GHSearchFilters) => void;
}

export function GithubSearchBar({ loading, client, onSearch }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [searchField, setSearchField] = useState<GHSearchField>("name_contains");
  const [org, setOrg] = useState("__all__");
  const [userFilter, setUserFilter] = useState("");
  const [language, setLanguage] = useState("");
  const [hideArchived, setHideArchived] = useState(true);
  const [hideForks, setHideForks] = useState(false);
  const [minStars, setMinStars] = useState("");
  const [perPage, setPerPage] = useState("50");

  const [orgs, setOrgs] = useState<GithubOrg[]>([]);
  const [authenticatedUser, setAuthenticatedUser] = useState("");
  const [orgsLoading, setOrgsLoading] = useState(false);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    setOrgsLoading(true);
    Promise.all([client.listUserOrgs(), client.getAuthenticatedUser()])
      .then(([orgList, user]) => {
        if (cancelled) return;
        setOrgs(orgList);
        setAuthenticatedUser(user.login);
      })
      .catch(() => {
        // Silently fail — orgs dropdown just stays empty
      })
      .finally(() => {
        if (!cancelled) setOrgsLoading(false);
      });

    return () => { cancelled = true; };
  }, [client]);

  const currentField = GH_SEARCH_FIELDS.find((f) => f.param === searchField);
  const fieldLabel = currentField
    ? t(`githubSearchField.${currentField.param}`)
    : "";
  const placeholder = currentField
    ? t("githubSearch.searchByField", { field: fieldLabel.toLowerCase() })
    : t("githubSearch.searchRepo");

  const resolvedOrg = org === "__all__" ? "" : org === "__user__" ? "" : org;
  const resolvedUser = org === "__user__" ? authenticatedUser : userFilter.trim();

  const canSearch = query.trim() || resolvedOrg || resolvedUser;

  const handleSearch = () => {
    if (!canSearch) return;
    onSearch(query, {
      searchField,
      org: resolvedOrg || undefined,
      user: resolvedUser || undefined,
      language: language.trim() || undefined,
      hideArchived,
      hideForks,
      minStars: minStars ? parseInt(minStars, 10) || undefined : undefined,
      perPage: Number(perPage),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="pl-10"
          />
        </div>

        <Select
          value={searchField}
          onValueChange={(v) => setSearchField(v as GHSearchField)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("github.searchFieldPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {GH_SEARCH_FIELDS.map((f) => (
              <SelectItem key={f.param} value={f.param}>
                {t(`githubSearchField.${f.param}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          onClick={handleSearch}
          disabled={loading || !canSearch}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {t("github.searchButton")}
        </Button>
      </div>

      {/* Filtros combinados */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={org} onValueChange={setOrg}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("github.orgPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("github.allOrgs")}</SelectItem>
            {authenticatedUser && (
              <SelectItem value="__user__">
                {t("github.myRepos", { user: authenticatedUser })}
              </SelectItem>
            )}
            {orgsLoading && (
              <SelectItem value="__loading__" disabled>
                {t("github.loadingOrgs")}
              </SelectItem>
            )}
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.login}>
                {o.login}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative min-w-[180px]">
          <User className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("github.otherUserPlaceholder")}
            className="pl-9 text-sm"
            disabled={org === "__user__"}
          />
        </div>

        <div className="min-w-[180px]">
          <Input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("github.languagePlaceholder")}
            className="text-sm"
          />
        </div>

        <div className="min-w-[120px]">
          <Input
            value={minStars}
            onChange={(e) => setMinStars(e.target.value.replace(/\D/g, ""))}
            onKeyDown={handleKeyDown}
            placeholder={t("github.minStarsPlaceholder")}
            className="text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={hideArchived} onCheckedChange={setHideArchived} />
          <span className="text-sm text-muted-foreground">{t("github.hideArchived")}</span>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={hideForks} onCheckedChange={setHideForks} />
          <span className="text-sm text-muted-foreground">{t("github.hideForks")}</span>
        </div>

        <Select value={perPage} onValueChange={setPerPage}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t("github.limitPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {[50, 100, 150, 200, 250].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t("github.perPage", { n })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
