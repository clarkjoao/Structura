/**
 * Example Structura Canvas Plugin: an element pack and a shape (API 1.17).
 *
 * Install it from the Plugins page (/plugins) by picking this file. The element catalog then
 * offers an "Edge Platform" group with:
 *
 *   - two catalog services (cards with an icon, like the AWS ones): "Edge Router" and
 *     "Edge Cache", in two categories with their own accent colour;
 *   - one SVG shape, "Hexagon tile", drawn stretched to the node with its name inside.
 *
 * It demonstrates the StructuraPlugin v1.17 contract:
 *   - capability: canvas:elements
 *   - registerElementPack: the same format as the host's built-in packs
 *     (src/features/elements/packs/<id>/pack.json), with icons given as SVG markup
 *   - registerShape: a shape added to the plugin's palette group
 *   - nothing to clean up: disabling the plugin removes the elements, and nodes already on a
 *     diagram show as "unknown" (their data kept) until it is enabled again
 */

/* global window */

(function () {
  "use strict";

  var PLUGIN_ID = "structura-plugin-element-pack";

  var ROUTER_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0e7490" stroke-width="2">' +
    '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>';
  var CACHE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2">' +
    '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/></svg>';

  window.StructuraPlugin.define({
    manifest: {
      id: PLUGIN_ID,
      name: "Edge Platform",
      version: "1.0.0",
      author: "Structura examples",
      description: "Adds an element pack (two services) and a shape to the element catalog.",
      apiVersion: "^1.17",
      capabilities: ["canvas:elements"],
    },
    activate: function (api) {
      api.registerElementPack({
        id: PLUGIN_ID,
        label: { en: "Edge Platform", "pt-BR": "Plataforma de borda" },
        categories: [
          {
            id: "network",
            label: { en: "Network", "pt-BR": "Rede" },
            description: { en: "Edge routing.", "pt-BR": "Roteamento na borda." },
            accent: { light: "#0e7490", dark: "#22d3ee" },
          },
          {
            id: "storage",
            label: { en: "Storage", "pt-BR": "Armazenamento" },
            description: { en: "Edge caches.", "pt-BR": "Caches na borda." },
            accent: { light: "#7c3aed" },
          },
        ],
        services: [
          {
            id: "edge-router",
            name: "Edge Router",
            category: "network",
            icon: "router",
            concepts: ["load-balancer"],
          },
          {
            id: "edge-cache",
            name: "Edge Cache",
            category: "storage",
            icon: "cache",
            concepts: ["cache"],
            description: {
              en: "Caches responses close to the user.",
              "pt-BR": "Guarda respostas perto do usuário.",
            },
          },
        ],
        icons: { router: ROUTER_ICON, cache: CACHE_ICON },
      });

      api.registerShape({
        id: "hexagon-tile",
        label: { en: "Hexagon tile", "pt-BR": "Ladrilho hexagonal" },
        viewBox: "0 0 100 88",
        paths: ["M26 2 H74 L98 44 L74 86 H26 L2 44 Z"],
        size: { width: 140, height: 124 },
        searchKeys: ["hexagon", "hexágono", "tile"],
      });
    },
  });
})();
