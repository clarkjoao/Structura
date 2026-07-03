// App-boot side effect (imported from main.tsx, like features/cloud/bootstrap):
// re-activate installed & enabled plugins. Loaded via dynamic import so the plugin
// runtime (which reaches into the canvas node-type registry) becomes an async chunk
// instead of bloating the entry bundle; failures must never block the app.
void import("./plugin-registry")
  .then(({ initializePluginRegistry }) => initializePluginRegistry())
  .catch((error) => {
    console.error("[plugins] plugin registry initialization failed:", error);
  });
