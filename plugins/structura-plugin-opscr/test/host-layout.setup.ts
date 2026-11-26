/**
 * The plugin lays out with the host's engine (`api.layout`, API 1.19), which `activate` hands
 * over at run time. Tests get the same engine the host would hand them: the host's
 * `api.layout` implementation, read from the host's source (the `@` alias in vite.config.js
 * points there), so a projection laid out here is laid out the way the app lays it out.
 */
import { pluginLayout } from "../../../src/features/plugins/plugin-layout";
import { setHostLayout } from "../src/layout";

setHostLayout(pluginLayout);
