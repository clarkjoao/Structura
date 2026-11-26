import { sanitizeSvg } from "@/features/canvas/utils/svg.sanitizer";
import { inlinePackIcons } from "@/features/elements/packs/pack.icons";
import { registerElementPack, type RegisteredPack } from "@/features/elements/packs/pack.loader";
import { parsePack } from "@/features/elements/packs/pack.schema";
import type { PluginElementPack, PluginManifest, PluginShape } from "./plugin.types";

/**
 * A plugin's element pack and shapes (API 1.17, capability `canvas:elements`).
 *
 * A plugin has one pack, whose id is the plugin id, so its types are `<pluginId>/<id>` and never
 * collide. `registerShape` adds to that pack — or to an implicit one labelled with the plugin's
 * name — and each call re-registers the whole pack, which keeps one family and one catalog group
 * per plugin. Components on the canvas are untouched by the swap: they render again from the
 * new registration, and as `unknown` (data intact) once the plugin is gone.
 */
export class PluginElementPackContribution {
  private pack: PluginElementPack | null = null;
  private readonly shapes: PluginShape[] = [];
  private registered: RegisteredPack | null = null;

  constructor(private readonly manifest: PluginManifest) {}

  registerPack(input: PluginElementPack): void {
    if (this.pack) {
      throw new Error(`[plugins] ${this.manifest.id}: registerElementPack was already called.`);
    }
    if (input?.id !== this.manifest.id) {
      throw new Error(
        `[plugins] ${this.manifest.id}: the pack id "${String(input?.id)}" must equal the plugin id.`,
      );
    }
    this.apply(input, this.shapes);
    this.pack = input;
  }

  registerShape(shape: PluginShape): void {
    const id = shape?.id;
    const taken = [...(this.pack?.shapes ?? []), ...this.shapes].some((s) => s.id === id);
    if (taken) {
      throw new Error(
        `[plugins] ${this.manifest.id}: shape "${String(id)}" is already registered.`,
      );
    }
    const next = [...this.shapes, shape];
    this.apply(this.pack ?? this.implicitPack(), next);
    this.shapes.push(shape);
  }

  unregister(): void {
    this.registered?.unregister();
    this.registered = null;
  }

  private implicitPack(): PluginElementPack {
    const name = this.manifest.name;
    return { id: this.manifest.id, label: { en: name, "pt-BR": name } };
  }

  /** Validates first, so a rejected call leaves the previous registration in place. */
  private apply(input: PluginElementPack, extraShapes: readonly PluginShape[]): void {
    const { icons: svgIcons, ...data } = input;
    const pack = parsePack(
      { ...data, typeIds: "namespaced", shapes: [...(data.shapes ?? []), ...extraShapes] },
      `plugin pack of ${this.manifest.id}`,
    );
    const icons = inlinePackIcons(this.sanitizedIcons(svgIcons ?? {}));
    this.unregister();
    this.registered = registerElementPack(pack, { icons });
  }

  private sanitizedIcons(icons: Readonly<Record<string, string>>): Record<string, string> {
    const safe: Record<string, string> = {};
    for (const [name, svg] of Object.entries(icons)) {
      const clean = typeof svg === "string" ? sanitizeSvg(svg) : null;
      if (!clean) {
        throw new Error(`[plugins] ${this.manifest.id}: icon "${name}" is not a valid SVG.`);
      }
      safe[name] = clean;
    }
    return safe;
  }
}
