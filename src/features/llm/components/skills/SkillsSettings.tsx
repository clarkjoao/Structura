import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Download,
  FileWarning,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { downloadFile } from "@/lib/export-service/download-file";
import { cn } from "@/lib/utils";
import { useToolCatalog, type ToolCatalogEntry } from "../../hooks/useToolCatalog";
import { SKILL_LIMITS, serializeSkillMarkdown, skillFileStem } from "../../skills/skill-format";
import { unknownSkillTools } from "../../skills/skill-request";
import { useSkillStore, type SkillProblem, type SkillWriteResult } from "../../skills/skill-store";
import {
  SKILL_SOURCE_LABEL_KEYS,
  isWorkspaceSkill,
  isWorkspaceSource,
  skillKey,
  type Skill,
  type SkillSource,
} from "../../skills/skill.types";
import { SkillSourceBadge } from "./SkillSourceBadge";
import { TOOL_KIND_LABEL_KEYS, formatSkillParseError } from "./skill-labels";

interface SkillDraft {
  name: string;
  description: string;
  instructions: string;
  tools: string[];
}

type Editor =
  | { mode: "closed" }
  /** `target` is null for a new skill; `source` is where it is saved. */
  | {
      mode: "form";
      target: Pick<Skill, "source" | "id"> | null;
      source: SkillSource;
      draft: SkillDraft;
    }
  | { mode: "raw"; problem: SkillProblem; text: string };

const EMPTY_DRAFT: SkillDraft = { name: "", description: "", instructions: "", tools: [] };

function draftOf(skill: Skill): SkillDraft {
  return {
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    tools: skill.tools ?? [],
  };
}

const TOOL_KIND_CLASSES: Record<ToolCatalogEntry["kind"], string> = {
  read: "border-border text-muted-foreground",
  write: "border-amber-500/40 text-amber-700 dark:text-amber-400",
};

/** Settings → Skills: list, enable, edit, import/export, and files that do not parse. */
export function SkillsSettings() {
  const { t } = useTranslation();
  const skills = useSkillStore((state) => state.skills);
  const problems = useSkillStore((state) => state.problems);
  const warnings = useSkillStore((state) => state.warnings);
  const availableSources = useSkillStore((state) => state.availableSources);
  const tools = useToolCatalog();

  const [editor, setEditor] = useState<Editor>({ mode: "closed" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Skill | null>(null);
  const [importTarget, setImportTarget] = useState<SkillSource | null>(null);
  const [importChooser, setImportChooser] = useState(false);
  const [importReport, setImportReport] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const workspaceAvailable = availableSources.some(isWorkspaceSource);

  // Workspace files may have changed outside the app since the last look.
  useEffect(() => {
    void useSkillStore.getState().load();
  }, []);

  const knownTool = useMemo(() => {
    const names = new Set((tools ?? []).map((tool) => tool.name));
    return (name: string) => tools === null || names.has(name);
  }, [tools]);

  const describeWriteFailure = (result: Extract<SkillWriteResult, { ok: false }>): string =>
    result.parseError
      ? formatSkillParseError(result.parseError, t)
      : t("llmChat.skills.settings.saveFailed", { message: result.message ?? "" });

  const openNew = () => {
    setError(null);
    setEditor({ mode: "form", target: null, source: "local", draft: EMPTY_DRAFT });
  };

  const openEdit = (skill: Skill) => {
    setError(null);
    setEditor({
      mode: "form",
      target: { source: skill.source, id: skill.id },
      source: skill.source,
      draft: draftOf(skill),
    });
  };

  const openRaw = (problem: SkillProblem) => {
    setError(null);
    setEditor({ mode: "raw", problem, text: problem.text });
  };

  const save = async () => {
    if (editor.mode === "closed") return;
    setSaving(true);
    setError(null);
    const store = useSkillStore.getState();
    let result: SkillWriteResult;
    if (editor.mode === "raw") {
      result = await store.saveRawText(editor.problem, editor.text);
    } else {
      const fields = {
        name: editor.draft.name,
        description: editor.draft.description,
        instructions: editor.draft.instructions,
        ...(editor.draft.tools.length > 0 ? { tools: editor.draft.tools } : {}),
      };
      result = editor.target
        ? await store.updateSkill(editor.target, fields)
        : await store.createSkill(editor.source, fields);
    }
    setSaving(false);
    // On failure the form keeps the edit, so nothing typed is lost.
    if (!result.ok) {
      setError(describeWriteFailure(result));
      return;
    }
    setEditor({ mode: "closed" });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    const result = await useSkillStore.getState().deleteSkill(target);
    if (!result.ok) {
      setError(t("llmChat.skills.settings.deleteFailed", { message: result.message ?? "" }));
      return;
    }
    if (editor.mode === "form" && editor.target && skillKey(editor.target) === skillKey(target)) {
      setEditor({ mode: "closed" });
    }
  };

  const exportSkill = (skill: Skill) => {
    downloadFile(serializeSkillMarkdown(skill), `${skillFileStem(skill.name)}.md`, "text/markdown");
  };

  const startImport = (source: SkillSource) => {
    setImportTarget(source);
    setImportChooser(false);
    fileInput.current?.click();
  };

  const onImportClick = () => {
    if (workspaceAvailable) {
      setImportChooser((open) => !open);
    } else {
      startImport("local");
    }
  };

  const importChosenFiles = async (fileList: FileList | null) => {
    const source = importTarget ?? "local";
    const files = await Promise.all(
      Array.from(fileList ?? []).map(async (file) => ({
        name: file.name,
        text: await file.text(),
      })),
    );
    if (fileInput.current) fileInput.current.value = "";
    if (files.length === 0) return;
    const results = await useSkillStore.getState().importFiles(files, source);
    const imported = results.filter((entry) => entry.result.ok).length;
    setImportReport([
      t("llmChat.skills.settings.importDone", { count: imported }),
      ...results.flatMap((entry) =>
        entry.result.ok
          ? []
          : [
              t("llmChat.skills.settings.importFailed", {
                file: entry.fileName,
                reason: describeWriteFailure(entry.result),
              }),
            ],
      ),
    ]);
  };

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-foreground">
              {t("llmChat.skills.settings.title")}
            </h4>
            <p className="text-[11px] text-muted-foreground">{t("llmChat.skills.settings.hint")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={onImportClick}>
              <Upload className="mr-1 h-3.5 w-3.5" />
              {t("llmChat.skills.settings.import")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openNew}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("llmChat.skills.settings.new")}
            </Button>
          </div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".md,text/markdown"
          multiple
          className="hidden"
          aria-label={t("llmChat.skills.settings.import")}
          onChange={(event) => void importChosenFiles(event.target.files)}
        />
        {importChooser ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{t("llmChat.skills.settings.importTo")}</span>
            {availableSources.map((source) => (
              <Button
                key={source}
                type="button"
                variant="secondary"
                size="sm"
                className="h-7"
                onClick={() => startImport(source)}
              >
                {t(SKILL_SOURCE_LABEL_KEYS[source])}
              </Button>
            ))}
          </div>
        ) : null}
        {importReport.length > 0 ? (
          <ul role="status" className="space-y-0.5 text-[11px] text-muted-foreground">
            {importReport.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {!workspaceAvailable ? (
          <p className="text-[11px] text-muted-foreground">
            {t("llmChat.skills.settings.workspaceHint")}
          </p>
        ) : null}

        {skills.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            {t("llmChat.skills.settings.empty")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {skills.map((skill) => (
              <SkillRow
                key={skillKey(skill)}
                skill={skill}
                editing={
                  editor.mode === "form" &&
                  editor.target !== null &&
                  skillKey(editor.target) === skillKey(skill)
                }
                unknownTools={unknownSkillTools(skill, knownTool)}
                unknownKeys={(warnings[skillKey(skill)] ?? []).map((warning) => warning.field)}
                onToggle={(enabled) => void useSkillStore.getState().setEnabled(skill, enabled)}
                onEdit={() => openEdit(skill)}
                onExport={() => exportSkill(skill)}
                onDelete={() => setDeleting(skill)}
              />
            ))}
          </ul>
        )}
      </section>

      {problems.length > 0 ? (
        <section className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-destructive">
            <FileWarning aria-hidden className="h-3.5 w-3.5" />
            {t("llmChat.skills.settings.problemsTitle")}
          </h4>
          <ul className="space-y-1.5">
            {problems.map((problem) => (
              <ProblemRow key={problem.key} problem={problem} onFix={() => openRaw(problem)} />
            ))}
          </ul>
        </section>
      ) : null}

      {editor.mode === "form" ? (
        <SkillForm
          isNew={editor.target === null}
          source={editor.source}
          availableSources={availableSources}
          draft={editor.draft}
          tools={tools}
          knownTool={knownTool}
          error={error}
          saving={saving}
          onSourceChange={(source) => setEditor({ ...editor, source })}
          onChange={(draft) => setEditor({ ...editor, draft })}
          onCancel={() => setEditor({ mode: "closed" })}
          onSave={() => void save()}
        />
      ) : null}

      {editor.mode === "raw" ? (
        <section className="space-y-2 border-t border-border pt-4">
          <h4 className="text-xs font-semibold tracking-wide text-foreground">
            {t("llmChat.skills.settings.rawTitle")}
          </h4>
          <Textarea
            aria-label={t("llmChat.skills.settings.rawTitle")}
            value={editor.text}
            onChange={(event) => setEditor({ ...editor, text: event.target.value })}
            className="min-h-48 font-mono text-xs"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditor({ mode: "closed" })}
            >
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
              {t("common.save")}
            </Button>
          </div>
        </section>
      ) : null}

      {editor.mode === "closed" && error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("llmChat.skills.settings.deleteTitle", { name: deleting?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && isWorkspaceSkill(deleting)
                ? t("llmChat.skills.settings.deleteWorkspace", { path: deleting.path ?? "" })
                : t("llmChat.skills.settings.deleteLocal")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>
              {t("llmChat.skills.settings.confirmDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SkillRow({
  skill,
  editing,
  unknownTools,
  unknownKeys,
  onToggle,
  onEdit,
  onExport,
  onDelete,
}: {
  skill: Skill;
  editing: boolean;
  unknownTools: string[];
  unknownKeys: string[];
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const warning = [
    unknownTools.length > 0
      ? t("llmChat.skills.settings.warningUnknownTools", { names: unknownTools.join(", ") })
      : "",
    unknownKeys.length > 0
      ? t("llmChat.skills.settings.warningUnknownKeys", { keys: unknownKeys.join(", ") })
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors",
        editing ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <Sparkles aria-hidden className="h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{skill.name}</span>
          <SkillSourceBadge source={skill.source} />
          {warning ? (
            <span
              role="img"
              aria-label={warning}
              title={warning}
              className="flex shrink-0 text-amber-600"
            >
              <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{skill.description}</span>
      </div>
      <Switch
        checked={skill.enabled}
        onCheckedChange={onToggle}
        aria-label={t("llmChat.skills.settings.enable", { name: skill.name })}
      />
      <IconButton label={t("llmChat.skills.settings.edit")} onClick={onEdit}>
        <Pencil className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label={t("llmChat.skills.settings.export")} onClick={onExport}>
        <Download className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label={t("llmChat.skills.settings.delete")} onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </IconButton>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

function ProblemRow({ problem, onFix }: { problem: SkillProblem; onFix: () => void }) {
  const { t } = useTranslation();
  const reason: string = problem.error
    ? formatSkillParseError(problem.error, t)
    : t("llmChat.skills.settings.unreadable", { message: problem.readError ?? "" });
  return (
    <li className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-medium">{problem.path ?? firstLine(problem.text)}</span>
        <SkillSourceBadge source={problem.source} />
      </div>
      <p className="text-destructive">{reason}</p>
      {problem.path ? (
        <p className="text-[11px] text-muted-foreground">
          {t("llmChat.skills.settings.filePath", { path: problem.path })}
        </p>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-7" onClick={onFix}>
          {t("llmChat.skills.settings.showRaw")}
        </Button>
      )}
    </li>
  );
}

function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim().length > 0 && line.trim() !== "---") ?? "";
}

function Counter({ value, max }: { value: string; max: number }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "text-[10px] tabular-nums",
        value.length > max ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {t("llmChat.skills.settings.charCount", { count: value.length, max })}
    </span>
  );
}

function SkillForm({
  isNew,
  source,
  availableSources,
  draft,
  tools,
  knownTool,
  error,
  saving,
  onSourceChange,
  onChange,
  onCancel,
  onSave,
}: {
  isNew: boolean;
  source: SkillSource;
  availableSources: readonly SkillSource[];
  draft: SkillDraft;
  tools: ToolCatalogEntry[] | null;
  knownTool: (name: string) => boolean;
  error: string | null;
  saving: boolean;
  onSourceChange: (source: SkillSource) => void;
  onChange: (draft: SkillDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const kindOf = (name: string) => tools?.find((tool) => tool.name === name)?.kind;
  const toggleTool = (name: string) =>
    onChange({
      ...draft,
      tools: draft.tools.includes(name)
        ? draft.tools.filter((tool) => tool !== name)
        : [...draft.tools, name],
    });

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold tracking-wide text-foreground">
          {isNew ? t("llmChat.skills.settings.new") : t("llmChat.skills.settings.editTitle")}
        </h4>
        {!isNew ? <SkillSourceBadge source={source} /> : null}
      </div>

      {isNew ? (
        <fieldset className="space-y-1">
          <legend className="text-xs text-muted-foreground">
            {t("llmChat.skills.settings.saveTo")}
          </legend>
          <div className="flex gap-1.5">
            {availableSources.map((candidate) => (
              <Button
                key={candidate}
                type="button"
                size="sm"
                variant={candidate === source ? "secondary" : "ghost"}
                aria-pressed={candidate === source}
                className="h-7"
                onClick={() => onSourceChange(candidate)}
              >
                {t(SKILL_SOURCE_LABEL_KEYS[candidate])}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="skill-name" className="text-xs text-muted-foreground">
            {t("llmChat.skills.settings.name")}
          </label>
          <Counter value={draft.name} max={SKILL_LIMITS.name} />
        </div>
        <Input
          id="skill-name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="skill-description" className="text-xs text-muted-foreground">
            {t("llmChat.skills.settings.description")}
          </label>
          <Counter value={draft.description} max={SKILL_LIMITS.description} />
        </div>
        <Input
          id="skill-description"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="skill-instructions" className="text-xs text-muted-foreground">
            {t("llmChat.skills.settings.instructions")}
          </label>
          <Counter value={draft.instructions} max={SKILL_LIMITS.instructions} />
        </div>
        <Textarea
          id="skill-instructions"
          value={draft.instructions}
          onChange={(event) => onChange({ ...draft, instructions: event.target.value })}
          className="min-h-32 text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">{t("llmChat.skills.settings.tools")}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {draft.tools.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">
              {t("llmChat.skills.settings.toolsAll")}
            </span>
          ) : null}
          {draft.tools.map((name) => {
            const kind = kindOf(name);
            return (
              <span
                key={name}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-md border pl-2 pr-1 font-mono text-[11px]",
                  kind ? TOOL_KIND_CLASSES[kind] : "border-dashed border-amber-500/60",
                )}
                title={knownTool(name) ? undefined : t("llmChat.skills.settings.unknownTool")}
              >
                {name}
                {kind ? (
                  <span className="font-sans text-[10px]">{t(TOOL_KIND_LABEL_KEYS[kind])}</span>
                ) : null}
                <button
                  type="button"
                  className="flex rounded p-0.5 hover:bg-muted"
                  aria-label={t("llmChat.skills.settings.removeTool", { name })}
                  onClick={() => toggleTool(name)}
                >
                  <X aria-hidden className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-[11px]">
                <Plus className="mr-1 h-3 w-3" />
                {t("llmChat.skills.settings.addTool")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1">
              <ul className="max-h-64 overflow-y-auto">
                {(tools ?? []).map((tool) => {
                  const selected = draft.tools.includes(tool.name);
                  return (
                    <li key={tool.name}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleTool(tool.name)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-muted",
                          selected && "bg-muted",
                        )}
                      >
                        <span className="truncate">{tool.name}</span>
                        <span
                          className={cn(
                            "shrink-0 rounded border px-1 font-sans text-[10px]",
                            TOOL_KIND_CLASSES[tool.kind],
                          )}
                        >
                          {t(TOOL_KIND_LABEL_KEYS[tool.kind])}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("llmChat.skills.settings.writeNote")}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" size="sm" disabled={saving} onClick={onSave}>
          {t("common.save")}
        </Button>
      </div>
    </section>
  );
}
