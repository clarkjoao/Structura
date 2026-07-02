import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Plus, Route } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  CreateJourneyModal,
  JourneyCard,
  useJourneyActions,
  useJourneys,
  type Journey,
} from "@/features/journeys";

export default function JourneysPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const journeys = useJourneys();
  const { removeJourney } = useJourneyActions();
  const [createOpen, setCreateOpen] = useState(false);

  const { domainSections, noDomainJourneys } = useMemo(() => {
    const byDomain: Record<string, Journey[]> = {};
    const noDomain: Journey[] = [];
    for (const journey of journeys) {
      const domainKey = journey.domain?.trim();
      if (!domainKey) {
        noDomain.push(journey);
        continue;
      }
      if (!byDomain[domainKey]) byDomain[domainKey] = [];
      byDomain[domainKey].push(journey);
    }
    const sortedKeys = Object.keys(byDomain).sort((a, b) => a.localeCompare(b));
    return {
      domainSections: sortedKeys.map((key) => ({
        domain: key,
        items: byDomain[key],
      })),
      noDomainJourneys: noDomain,
    };
  }, [journeys]);

  const handleEdit = (journeyId: string) => {
    navigate(`/journeys/${journeyId}/edit`);
  };

  const handleDelete = (journeyId: string) => {
    removeJourney(journeyId);
  };

  return (
    <div className="min-h-screen pt-16">
      <Navbar />
      <div className="container mx-auto px-5 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("journeys.title")}</h1>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t("journeys.new")}
          </Button>
        </div>

        {journeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
              <Route className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <p className="mb-1 text-sm text-muted-foreground">{t("journeys.empty")}</p>
            <p className="mb-4 text-xs text-muted-foreground/80">{t("journeys.emptyHint")}</p>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t("journeys.new")}
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {domainSections.map(({ domain, items }) => (
              <section key={domain} className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{domain}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((journey) => (
                    <JourneyCard
                      key={journey.id}
                      journey={journey}
                      onEdit={() => handleEdit(journey.id)}
                      onDelete={() => handleDelete(journey.id)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {noDomainJourneys.length > 0 ? (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{t("journeys.noDomain")}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {noDomainJourneys.map((journey) => (
                    <JourneyCard
                      key={journey.id}
                      journey={journey}
                      onEdit={() => handleEdit(journey.id)}
                      onDelete={() => handleDelete(journey.id)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      <CreateJourneyModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
