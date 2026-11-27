/**
 * The plugin is placed by the host (`api.layout`, API 1.21), which `activate` hands over at run
 * time. Tests get what the host would hand them: the host's `api.layout` implementation, read
 * from the host's source (the `@` alias in vite.config.js points there) and run after the host's
 * own test setup (`src/test/setup.tsx`: element registry, i18n), so a projection placed here is
 * placed the way the app places it.
 */
import "../../../src/test/setup";
import { pluginLayout } from "../../../src/features/plugins/plugin-layout";
import { setHostLayout } from "../src/layout";

setHostLayout(pluginLayout);
