/**
 * Example Structura Canvas Plugin: Just Log It.  It's a no-op plugin.
 *
 * Install it from the Plugins page (/plugins) by picking this file, then use
 * Import → "Just Log It" in the model explorer to log the contents of the file
 * to the console.
 *
 * It demonstrates the StructuraPlugin v1 contract:
 *   - manifest with declared capabilities
 *   - StructuraPlugin.define({ manifest, activate })
 *   - registerImporter with extensions + canImport sniffing
 *   - ImportContext-based dedupe against existing components (by name)
 *   - plain-data ImportResult with warnings (the host assigns ids and handles undo)
 */

/* global window */

(function () {
  "use strict";
  
  function logContents(text, ctx) {
    console.log("logContents", JSON.stringify(text, null, 2), ctx);
  }

  window.StructuraPlugin.define({
    manifest: {
      id: "structura-plugin-log-import",
      name: "Just Log It",
      version: "1.0.0",
      author: "Structura examples",
      description:
        "Logs the contents of the file to the console.",
      apiVersion: "^1.0",
      capabilities: ["io:importers", "storage","events:diagram"],
    },
    activate: function (api) {
      api.registerImporter({
        id: "structura-plugin-log-import/log",
        label: { en: "Just Log It", "pt-BR": "Just Log It" },
        extensions: ["*"],
        import: function (contents, ctx) {
          return logContents(contents, ctx);
        },
      });
      console.log("activate", JSON.stringify(api, null, 2));
    },
  });
})();
