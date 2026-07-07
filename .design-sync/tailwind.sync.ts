// Tailwind config used only by design-sync to compile a real stylesheet for the
// bundle. Reuses the project's theme/tokens but scopes content to the synced UI
// primitives plus the authored preview cards, so every utility class those use
// is emitted into ds-bundle's styles.css.
import base from "../tailwind.config";
import type { Config } from "tailwindcss";

const config: Config = {
  ...base,
  content: [
    "./src/components/ui/**/*.{ts,tsx}",
    "./.design-sync/entry.tsx",
    "./.design-sync/previews/**/*.tsx",
  ],
};

export default config;
