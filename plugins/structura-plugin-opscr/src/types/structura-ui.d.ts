/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host plugin API contract
 * (src/features/plugins/structura-ui.d.ts), synced via `npm run sync-types`.
 * It is the single source of truth for plugin/host type compatibility; edit the host
 * file and re-run the sync instead of changing this file.
 */

/**
 * Types of `@structura/ui` (API 1.18) for bundled plugins: the host's UI kit, imported as a
 * build-time external bound to the `__STRUCTURA_UI__` global (see `runtime-globals.ts`).
 *
 * Copied next to `plugin.types.ts` by each plugin's `sync-types`; the plugin's tsconfig maps
 * `@structura/ui` to it (`"paths": { "@structura/ui": ["./src/types/structura-ui.d.ts"] }`).
 */
import type { PluginUiKit } from "./plugin.types";

export declare const Button: PluginUiKit["Button"];
export declare const Input: PluginUiKit["Input"];
export declare const Textarea: PluginUiKit["Textarea"];
export declare const Label: PluginUiKit["Label"];
export declare const Field: PluginUiKit["Field"];
export declare const Checkbox: PluginUiKit["Checkbox"];
export declare const Switch: PluginUiKit["Switch"];
export declare const Select: PluginUiKit["Select"];
export declare const Badge: PluginUiKit["Badge"];
export declare const Card: PluginUiKit["Card"];
export declare const Tabs: PluginUiKit["Tabs"];
export declare const Tooltip: PluginUiKit["Tooltip"];
export declare const Separator: PluginUiKit["Separator"];
export declare const Stack: PluginUiKit["Stack"];
