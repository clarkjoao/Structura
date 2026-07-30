import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, Route } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  CreateWalkthroughModal,
  WalkthroughCard,
  useWalkthroughActions,
  useWalkthroughs,
  type Walkthrough,
} from "@/features/walkthroughs";

export default function WalkthroughsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const walkthroughs = useWalkthroughs();
  const { removeWalkthrough } = useWalkthroughActions();
  const [createOpen, setCreateOpen] = useState(false);

  const { domainSections, noDomainJourneys } = useMemo(() => {
    const byDomain: Record<string, Walkthrough[]> = {};
    const noDomain: Walkthrough[] = [];
    for (const walkthrough of walkthroughs) {
      const domainKey = walkthrough.domain?.trim();
      if (!domainKey) {
        noDomain.push(walkthrough);
        continue;
      }
      if (!byDomain[domainKey]) byDomain[domainKey] = [];
      byDomain[domainKey].push(walkthrough);
    }
    const sortedKeys = Object.keys(byDomain).sort((a, b) => a.localeCompare(b));
    return {
      domainSections: sortedKeys.map((key) => ({
        domain: key,
        items: byDomain[key],
      })),
      noDomainJourneys: noDomain,
    };
  }, [walkthroughs]);

  const handleEdit = (walkthroughId: string) => {
    navigate(`/walkthroughs/${walkthroughId}/edit`);
  };

  const handleDelete = (walkthroughId: string) => {
    removeWalkthrough(walkthroughId);
  };

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="container mx-auto px-5 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("walkthroughs.title")}</h1>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("walkthroughs.new")}
          </Button>
        </div>

        {walkthroughs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
              <Route className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <p className="mb-1 text-sm text-muted-foreground">{t("walkthroughs.empty")}</p>
            <p className="mb-4 text-xs text-muted-foreground/80">{t("walkthroughs.emptyHint")}</p>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t("walkthroughs.new")}
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {domainSections.map(({ domain, items }) => (
              <section key={domain} className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{domain}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((walkthrough) => (
                    <WalkthroughCard
                      key={walkthrough.id}
                      walkthrough={walkthrough}
                      onEdit={() => handleEdit(walkthrough.id)}
                      onDelete={() => handleDelete(walkthrough.id)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {noDomainJourneys.length > 0 ? (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {t("walkthroughs.noDomain")}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {noDomainJourneys.map((walkthrough) => (
                    <WalkthroughCard
                      key={walkthrough.id}
                      walkthrough={walkthrough}
                      onEdit={() => handleEdit(walkthrough.id)}
                      onDelete={() => handleDelete(walkthrough.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      <CreateWalkthroughModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
