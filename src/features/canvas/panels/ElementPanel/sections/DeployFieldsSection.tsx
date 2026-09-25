import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import {
  isShardComponent,
  isShardedStoreComponent,
  useDiagramActions,
  useResolvedComponents,
  useResolvedNodeLayouts,
  type Component,
  type ComponentPatch,
  type ShardStrategy,
} from "@/features/diagram";
import { hasShardRouter, shardCount } from "@/features/diagram/utils/sharded-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "../components/SegmentedControl";

const LABEL_CLASS = "text-[11px] text-muted-foreground uppercase tracking-wider font-semibold";
const STRATEGIES: readonly ShardStrategy[] = [
  "hash",
  "consistent-hash",
  "range",
  "geo",
  "directory",
];

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={`${LABEL_CLASS} block`}>
        {label}
      </label>
      <Input
        id={id}
        type={type}
        min={type === "number" ? 0 : undefined}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-9"
      />
    </div>
  );
}

/** Free text; empty clears the field instead of storing "". */
const text = (value: string) => (value === "" ? undefined : value);
/** A positive number; empty or invalid clears it. */
const positive = (value: string) => {
  const n = Number(value);
  return value.trim() === "" || !Number.isFinite(n) || n <= 0 ? undefined : n;
};

/** The fields each deployment element carries beyond a name and a description. */
export function DeployFieldsSection({
  component,
  onChange,
}: {
  component: Component;
  onChange: (patch: ComponentPatch) => void;
}) {
  const { t } = useTranslation();
  const components = useResolvedComponents();
  const layouts = useResolvedNodeLayouts();
  const { addComponent } = useDiagramActions();
  /**
   * Where a new child goes: the next slot in a row under the store's header,
   * in canvas coordinates (the store converts them to its own).
   */
  const slot = (storeId: string, index: number, rowY: number) => {
    const store = layouts[storeId];
    return store ? { x: store.x + 16 + index * 192, y: store.y + rowY } : undefined;
  };

  if (isShardedStoreComponent(component)) {
    const shards = shardCount(component.id, components);
    return (
      <>
        <div className="space-y-1.5">
          <p className={LABEL_CLASS}>{t("deploy.fields.strategy")}</p>
          <select
            aria-label={t("deploy.fields.strategy")}
            value={component.strategy ?? "hash"}
            onChange={(event) => {
              const strategy = event.target.value as ShardStrategy;
              onChange({ strategy: strategy === "hash" ? undefined : strategy });
            }}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {STRATEGIES.map((strategy) => (
              <option key={strategy} value={strategy}>
                {t(`deploy.strategy.${strategy}`)}
              </option>
            ))}
          </select>
        </div>
        <TextField
          id="deploy-key"
          label={t("deploy.fields.keyExpression")}
          value={component.keyExpression}
          onChange={(value) => onChange({ keyExpression: text(value) })}
        />
        <TextField
          id="deploy-tech"
          label={t("common.technology")}
          value={component.technology}
          onChange={(value) => onChange({ technology: text(value) })}
        />
        <TextField
          id="deploy-rf"
          type="number"
          label={t("deploy.fields.replicationFactor")}
          value={component.replicationFactor}
          onChange={(value) => onChange({ replicationFactor: positive(value) })}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 flex-1 text-xs"
            onClick={() =>
              // A shard name, and a slot to the right of the last one.
              addComponent(
                "deploy-shard",
                `shard-${shards + 1}`,
                component.id,
                slot(component.id, shards, 200),
              )
            }
          >
            <Plus />
            {t("deploy.addShard")}
          </Button>
          {!hasShardRouter(component.id, components) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() =>
                addComponent(
                  "deploy-shard-router",
                  t("deploy.router"),
                  component.id,
                  slot(component.id, 0, 104),
                )
              }
            >
              <Plus />
              {t("deploy.addRouter")}
            </Button>
          )}
        </div>
      </>
    );
  }

  if (isShardComponent(component)) {
    return (
      <>
        <TextField
          id="deploy-range"
          label={t("deploy.fields.keyRange")}
          value={component.keyRange}
          onChange={(value) => onChange({ keyRange: text(value) })}
        />
        <TextField
          id="deploy-share"
          type="number"
          label={t("deploy.fields.share")}
          value={component.share}
          onChange={(value) => onChange({ share: positive(value) })}
        />
        <TextField
          id="deploy-region"
          label={t("deploy.fields.region")}
          value={component.region}
          onChange={(value) => onChange({ region: text(value) })}
        />
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="deploy-hot">{t("deploy.fields.hot")}</Label>
          <Switch
            id="deploy-hot"
            checked={component.hot === true}
            onCheckedChange={(hot) => onChange({ hot: hot ? true : undefined })}
          />
        </div>
      </>
    );
  }

  return null;
}
