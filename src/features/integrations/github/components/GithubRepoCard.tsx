import { Archive, Star } from "lucide-react";
import type { GithubRepo } from "../github.types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";

interface Props {
  repo: GithubRepo;
  selected: boolean;
  alreadyImported: boolean;
  hasDefectDojoConflict: boolean;
  onToggle: (repoId: number) => void;
}

function truncateTopics(topics: string[], max = 3) {
  return topics.slice(0, max);
}

export function GithubRepoCard({
  repo,
  selected,
  alreadyImported,
  hasDefectDojoConflict,
  onToggle,
}: Props) {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-xl border border-border bg-card p-3 flex items-start gap-3 ${
        selected ? "ring-1 ring-primary/30" : ""
      }`}
    >
      <div className="pt-1">
        <Checkbox checked={selected} onCheckedChange={() => onToggle(repo.id)} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm text-foreground truncate">{repo.name}</p>
            {repo.archived && (
              <div className="mt-1 inline-flex items-center gap-2">
                <Badge className="bg-secondary/70 text-muted-foreground border border-border">
                  <Archive className="h-3.5 w-3.5 mr-1" />
                  {t("github.repoArchived")}
                </Badge>
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {alreadyImported && (
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {t("github.alreadyImported")}
              </Badge>
            )}
            {hasDefectDojoConflict && (
              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {t("github.defectDojoConflictBadge")}
              </Badge>
            )}
          </div>
        </div>

        {repo.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{repo.description}</p>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          {repo.language && (
            <Badge variant="secondary" className="bg-secondary/70 text-secondary-foreground">
              {repo.language}
            </Badge>
          )}
          {truncateTopics(repo.topics).map((topic) => (
            <Badge
              key={topic}
              variant="outline"
              className="border-border text-muted-foreground rounded-full"
            >
              {topic}
            </Badge>
          ))}
          {repo.topics.length > 3 && (
            <Badge className="bg-secondary/70 text-muted-foreground border border-border">
              +{repo.topics.length - 3}
            </Badge>
          )}
          {repo.stargazers_count > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3" />
              {repo.stargazers_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
