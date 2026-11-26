import type { PluginUiKit } from "../plugin.types";
import {
  KitBadge,
  KitButton,
  KitCard,
  KitCheckbox,
  KitField,
  KitInput,
  KitLabel,
  KitSelect,
  KitSeparator,
  KitStack,
  KitSwitch,
  KitTabs,
  KitTextarea,
  KitTooltip,
} from "./components";

/**
 * The plugin UI kit, one object behind both doors: `api.ui.*` and the `__STRUCTURA_UI__`
 * global that bundled plugins import as `@structura/ui`. Typed against `PluginUiKit`, the
 * contract plugins compile against.
 */
export const PLUGIN_UI_KIT: PluginUiKit = {
  Button: KitButton,
  Input: KitInput,
  Textarea: KitTextarea,
  Label: KitLabel,
  Field: KitField,
  Checkbox: KitCheckbox,
  Switch: KitSwitch,
  Select: KitSelect,
  Badge: KitBadge,
  Card: KitCard,
  Tabs: KitTabs,
  Tooltip: KitTooltip,
  Separator: KitSeparator,
  Stack: KitStack,
};
