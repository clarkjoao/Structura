/**
 * Example Structura Canvas Plugin: Diagram Change Logger + Manipulator.
 *
 * Install it from the Plugins page (/plugins) by picking this file, then open a diagram:
 *
 *   - Every committed change is logged to the DevTools console as a structured diff
 *     (components added/removed/renamed/moved, connections added/removed) — open the
 *     console and edit the diagram to watch it, draw.io-devtools style.
 *   - Alt+Shift+O — arrange the active diagram's root components in a grid
 *     (one api.moveComponents call = a single undo step, like draw.io's reorder plugin).
 *   - Alt+Shift+U — uppercase every component name (api.updateComponent, each undoable).
 *
 * It demonstrates the StructuraPlugin v1.1 contract:
 *   - capabilities: events:diagram, diagram:read, diagram:write
 *   - onDiagramChange + getDiagram: snapshot diffing on committed changes
 *   - moveComponents / updateComponent: sanctioned, undoable diagram manipulation
 *   - deactivate: cleanup of resources the host cannot track (the keydown listener)
 */

/* global window, document, console */

(function () {
  "use strict";

  var TAG = "[console-log-plugin]";
  var lastSnapshots = {}; // diagramId -> DiagramSnapshot

  function indexById(list) {
    var map = {};
    list.forEach(function (item) {
      map[item.id] = item;
    });
    return map;
  }

  function samePosition(a, b) {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y;
  }

  function diffSnapshots(prev, next) {
    var prevComponents = indexById(prev.components);
    var nextComponents = indexById(next.components);
    var prevConnections = indexById(prev.connections);
    var nextConnections = indexById(next.connections);

    var diff = {
      addedComponents: [],
      removedComponents: [],
      renamedComponents: [],
      movedComponents: [],
      addedConnections: [],
      removedConnections: [],
    };

    Object.keys(nextComponents).forEach(function (id) {
      var nextComp = nextComponents[id];
      var prevComp = prevComponents[id];
      if (!prevComp) {
        diff.addedComponents.push({ id: id, label: nextComp.label, type: nextComp.type });
        return;
      }
      if (prevComp.label !== nextComp.label) {
        diff.renamedComponents.push({ id: id, from: prevComp.label, to: nextComp.label });
      }
      if (!samePosition(prevComp.position, nextComp.position)) {
        diff.movedComponents.push({
          id: id,
          label: nextComp.label,
          from: prevComp.position,
          to: nextComp.position,
        });
      }
    });
    Object.keys(prevComponents).forEach(function (id) {
      if (!nextComponents[id]) {
        diff.removedComponents.push({ id: id, label: prevComponents[id].label });
      }
    });

    Object.keys(nextConnections).forEach(function (id) {
      if (!prevConnections[id]) {
        var conn = nextConnections[id];
        diff.addedConnections.push({
          id: id,
          sourceId: conn.sourceId,
          targetId: conn.targetId,
          label: conn.label,
        });
      }
    });
    Object.keys(prevConnections).forEach(function (id) {
      if (!nextConnections[id]) {
        diff.removedConnections.push({ id: id, label: prevConnections[id].label });
      }
    });

    return diff;
  }

  function logDiff(diagram, diff) {
    var parts = [];
    if (diff.addedComponents.length) parts.push("+" + diff.addedComponents.length + " comp");
    if (diff.removedComponents.length) parts.push("-" + diff.removedComponents.length + " comp");
    if (diff.renamedComponents.length) parts.push("~" + diff.renamedComponents.length + " renamed");
    if (diff.movedComponents.length) parts.push("~" + diff.movedComponents.length + " moved");
    if (diff.addedConnections.length) parts.push("+" + diff.addedConnections.length + " conn");
    if (diff.removedConnections.length) parts.push("-" + diff.removedConnections.length + " conn");
    if (parts.length === 0) return; // e.g. a change in fields this logger does not track

    console.groupCollapsed(TAG + ' "' + diagram.name + '" changed: ' + parts.join(", "));
    Object.keys(diff).forEach(function (kind) {
      if (diff[kind].length) console.table(diff[kind]);
    });
    console.groupEnd();
  }

  function arrangeRootComponentsInGrid(api) {
    var diagram = api.getDiagram();
    if (!diagram) return;
    var roots = diagram.components.filter(function (component) {
      return component.parentId === null;
    });
    if (roots.length === 0) return;

    roots.sort(function (a, b) {
      return a.label.localeCompare(b.label);
    });
    var COLUMNS = 4;
    var CELL_W = 280;
    var CELL_H = 180;
    var moves = roots.map(function (component, index) {
      return {
        id: component.id,
        x: 100 + (index % COLUMNS) * CELL_W,
        y: 100 + Math.floor(index / COLUMNS) * CELL_H,
      };
    });

    api.moveComponents(moves); // one history step — a single Ctrl+Z reverts the grid
    console.log(TAG + " arranged " + moves.length + " root components in a grid (undo: 1 step)");
  }

  function uppercaseAllNames(api) {
    var diagram = api.getDiagram();
    if (!diagram) return;
    var renamed = 0;
    diagram.components.forEach(function (component) {
      var upper = component.label.toUpperCase();
      if (upper !== component.label) {
        api.updateComponent(component.id, { name: upper });
        renamed++;
      }
    });
    console.log(TAG + " uppercased " + renamed + " component names");
  }

  var removeKeydownListener = null;

  window.StructuraPlugin.define({
    manifest: {
      id: "structura-plugin-console-log",
      name: "Diagram Change Logger",
      version: "1.0.0",
      author: "Structura examples",
      description:
        "Logs a structured diff of every diagram change to the console, and adds Alt+Shift+O (grid-arrange root components) and Alt+Shift+U (uppercase names).",
      apiVersion: "^1.1",
      capabilities: ["events:diagram", "diagram:read", "diagram:write"],
    },

    activate: function (api) {
      console.log(TAG + " active (API v" + api.apiVersion + "). Edit a diagram to see diffs;");
      console.log(TAG + " Alt+Shift+O arranges root components, Alt+Shift+U uppercases names.");

      // Seed the baseline so the first edit logs a real diff.
      var activeId = api.getActiveDiagramId();
      if (activeId) lastSnapshots[activeId] = api.getDiagram(activeId);

      api.onDiagramChange(function (diagramId) {
        var next = api.getDiagram(diagramId);
        if (!next) {
          delete lastSnapshots[diagramId];
          return;
        }
        var prev = lastSnapshots[diagramId];
        lastSnapshots[diagramId] = next;
        if (!prev) {
          console.log(TAG + ' first committed change in "' + next.name + '"', next);
          return;
        }
        logDiff(next, diffSnapshots(prev, next));
      });

      // Keyboard commands, the draw.io-plugin way. No sandbox: DOM listeners are
      // sanctioned plugin behavior; the API ban only covers app internals.
      var onKeydown = function (event) {
        if (!event.altKey || !event.shiftKey) return;
        if (event.code === "KeyO") {
          event.preventDefault();
          arrangeRootComponentsInGrid(api);
        } else if (event.code === "KeyU") {
          event.preventDefault();
          uppercaseAllNames(api);
        }
      };
      document.addEventListener("keydown", onKeydown);
      removeKeydownListener = function () {
        document.removeEventListener("keydown", onKeydown);
      };
    },

    // Host-tracked contributions (the onDiagramChange subscription) are rolled back by the
    // host; the keydown listener is ours to clean up.
    deactivate: function () {
      if (removeKeydownListener) removeKeydownListener();
      removeKeydownListener = null;
      lastSnapshots = {};
      console.log(TAG + " deactivated");
    },
  });
})();
