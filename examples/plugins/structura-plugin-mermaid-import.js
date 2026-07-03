/**
 * Example Structura Canvas Plugin: Mermaid flowchart importer.
 *
 * Install it from the Plugins page (/plugins) by picking this file, then use
 * Import → "Mermaid (plugin)" in the model explorer to import a .mmd/.mermaid
 * flowchart into the open diagram.
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

  // Parses a small subset of Mermaid flowchart syntax: node definitions and edges.
  //   A[Label]  B(Label)  C{Label}  D((Label))  plain ids, and A --> B / A -->|text| B
  function parseFlowchart(text, ctx) {
    var warnings = [];
    var nodes = {}; // mermaid id -> { key, name }
    var edges = [];

    var lines = text.split("\n");
    var edgeRe =
      /^\s*([\w-]+)(?:[[({]+([^\])}]*)[\])}]+)?\s*-{2,}>?\s*(?:\|([^|]*)\|\s*)?([\w-]+)(?:[[({]+([^\])}]*)[\])}]+)?\s*$/;
    var nodeRe = /^\s*([\w-]+)[[({]+([^\])}]*)[\])}]+\s*$/;

    function ensureNode(id, label) {
      if (!nodes[id]) {
        nodes[id] = { key: id, name: label || id };
      } else if (label) {
        nodes[id].name = label;
      }
      return nodes[id];
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || /^(flowchart|graph)\b/.test(line) || line.indexOf("%%") === 0) continue;

      var edgeMatch = edgeRe.exec(line);
      if (edgeMatch) {
        ensureNode(edgeMatch[1], edgeMatch[2]);
        ensureNode(edgeMatch[4], edgeMatch[5]);
        edges.push({ source: edgeMatch[1], target: edgeMatch[4], label: edgeMatch[3] || "" });
        continue;
      }

      var nodeMatch = nodeRe.exec(line);
      if (nodeMatch) {
        ensureNode(nodeMatch[1], nodeMatch[2]);
        continue;
      }

      warnings.push("Ignored line " + (i + 1) + ': "' + line + '"');
    }

    // Dedupe against the open diagram by (case-insensitive) name: reuse existing ids.
    var existingByName = {};
    Object.keys(ctx.existingComponents).forEach(function (id) {
      existingByName[ctx.existingComponents[id].label.trim().toLowerCase()] = id;
    });

    var components = [];
    var keyOrExisting = {}; // mermaid id -> import key or existing component id
    var index = 0;
    Object.keys(nodes).forEach(function (id) {
      var node = nodes[id];
      var existingId = existingByName[node.name.trim().toLowerCase()];
      if (existingId) {
        keyOrExisting[id] = existingId;
        warnings.push('Reused existing component for "' + node.name + '"');
        return;
      }
      keyOrExisting[id] = node.key;
      components.push({
        key: node.key,
        name: node.name,
        type: "system",
        x: ctx.anchor.x + (index % 4) * 260,
        y: ctx.anchor.y + Math.floor(index / 4) * 160,
      });
      index++;
    });

    return {
      components: components,
      connections: edges.map(function (edge) {
        return {
          source: keyOrExisting[edge.source],
          target: keyOrExisting[edge.target],
          label: edge.label,
        };
      }),
      warnings: warnings,
    };
  }

  window.StructuraPlugin.define({
    manifest: {
      id: "structura-plugin-mermaid-import",
      name: "Mermaid Flowchart Import",
      version: "1.0.0",
      author: "Structura examples",
      description:
        "Imports Mermaid flowchart files (.mmd, .mermaid) into the open diagram, reusing existing components by name.",
      apiVersion: "^1.0",
      capabilities: ["io:importers"],
    },
    activate: function (api) {
      api.registerImporter({
        id: "structura-plugin-mermaid-import/flowchart",
        label: { en: "Mermaid (plugin)", "pt-BR": "Mermaid (plugin)" },
        extensions: ["mmd", "mermaid"],
        canImport: function (_fileName, contents) {
          return /^\s*(flowchart|graph)\b/m.test(contents);
        },
        import: function (contents, ctx) {
          return parseFlowchart(contents, ctx);
        },
      });
    },
  });
})();
