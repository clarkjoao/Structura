/**
 * The extension is placed by Structura through the webview (`STRUCTURA_PLACE`), whose answer is
 * the host's `api.layout.place` implementation. Tests get that implementation directly, read
 * from the host's source (the `@` alias in vitest.config.mjs points there), so a picture placed
 * here is placed the way Structura, its plugins and the preview place it.
 */
// The host's own test setup: `api.layout.place` builds and sizes elements through the element
// registry, which boots with the app (DOM, i18n) — as it does in the webview.
import "../../../src/test/setup";
import { pluginLayout } from "../../../src/features/plugins/plugin-layout";
import { setHostEngine } from "../src/host-engine.test-support";

setHostEngine(pluginLayout);
