import { C4_LABEL_TEMPLATE, C4_META, CONFIG, THEME } from "./constants";
import type { ExportNode } from "./model";
import {
  buildApiGroupStyle,
  buildAwsStyle,
  buildC4Line2,
  buildC4RegistryBadge,
  buildC4Style,
  buildEndpointStyle,
  buildNoteStyle,
  buildPanelStyle,
  buildSwimlaneStyle,
  c4TypeLabel,
} from "./styles";
import { estimateNoteHeight, renderNoteHtml } from "./note-format";
import type { GeometryInfo } from "./types";
import { applyTemplate, escXml } from "./xml-utils";

/**
 * Build the mxCell/object XML for a single node. Per-kind size defaults live here
 * (a node whose width/height is 0 means "use the kind default").
 */
export function buildCell(node: ExportNode, geometry: GeometryInfo, parentId: string): string {
  const { x, y, width, height } = geometry;

  switch (node.kind) {
    case "c4": {
      const meta = C4_META[node.subtype] ?? C4_META.system;
      // A1-compensation: nodes that have NO measured size yet (e.g. a diagram
      // that was never rendered, or freshly created) fall back to the canonical
      // box. Otherwise we honour the canvas-measured size — clamped between
      // the canonical floor and the per-subtype ceiling — so a long description
      // grows the box up to a sensible max instead of overflowing or being
      // truncated. The compensation pass still keeps adjacent nodes from
      // overlapping (see computeCompensationOffsets / ADR-0009 A1).
      const finalWidth = Math.max(
        meta.width,
        Math.min(meta.maxWidth, width > 0 ? width : meta.width),
      );
      const finalHeight = Math.max(
        meta.height,
        Math.min(meta.maxHeight, height > 0 ? height : meta.height),
      );

      const c4Line2 = buildC4Line2(node.description, node.technology);
      const badge = buildC4RegistryBadge(node.serviceName);
      const style = buildC4Style(meta, node.subtype);

      const label = applyTemplate(C4_LABEL_TEMPLATE, {
        fontSize: String(THEME.fonts.c4.name),
        c4Name: node.name,
        c4Type: c4TypeLabel(node.subtype),
        c4Line2,
        c4RegistryBadge: badge,
      });

      const svcAttrs = node.serviceName
        ? ` registryService="${escXml(node.serviceName)}" registryId="${escXml(node.serviceId ?? "")}"`
        : "";

      return (
        `<object placeholders="1" ` +
        `c4Name="${escXml(node.name)}" ` +
        `c4Type="${escXml(c4TypeLabel(node.subtype))}" ` +
        `c4Description="${escXml(node.description)}" ` +
        `c4Technology="${escXml(node.technology ?? "")}" ` +
        `c4Line2="${escXml(c4Line2)}" ` +
        `c4RegistryBadge="${escXml(badge)}" ` +
        `label="${escXml(label)}" ` +
        `id="${escXml(node.id)}"${svcAttrs}>` +
        `<mxCell style="${style}" vertex="1" parent="${escXml(parentId)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${finalWidth}" height="${finalHeight}" as="geometry"/>` +
        `</mxCell>` +
        `</object>`
      );
    }

    case "aws": {
      const style = buildAwsStyle(node.awsIcon);
      return (
        `<mxCell id="${escXml(node.id)}" parent="${escXml(parentId)}" style="${style}" value="${escXml(node.name)}" vertex="1">` +
        `<mxGeometry height="${CONFIG.minDimensions.aws.height}" width="${CONFIG.minDimensions.aws.width}" x="${x}" y="${y}" as="geometry" />` +
        `</mxCell>`
      );
    }

    case "panel": {
      const w = width || CONFIG.defaults.panelWidth;
      const h = height || CONFIG.defaults.panelHeight;
      // Prefer the panel's own colour; fall back to the kind default (VPC/EKS/…)
      // so a freshly-created panel of that kind exports the same colour the
      // canvas renders; only the legacy neutral grey is used when neither is set.
      const color = node.panelColor ?? node.panelKindDefaultColor ?? CONFIG.defaults.panelColor;
      const style = buildPanelStyle({
        color,
        opacity: node.panelOpacity ?? 10,
        borderStyle: node.borderStyle ?? "solid",
      });

      const label =
        '<font style="font-size:16px"><b><div style="text-align:left">%c4Name%</div></b></font>' +
        '<div style="text-align:left">[%c4Application%]</div>';
      const appliedLabel = applyTemplate(label, {
        c4Name: node.name,
        c4Application: "Software System",
      });

      return (
        `<object placeholders="1" ` +
        `c4Name="${escXml(node.name)}" ` +
        `c4Type="SystemScopeBoundary" ` +
        `c4Application="Software System" ` +
        `label="${escXml(appliedLabel)}" ` +
        `id="${escXml(node.id)}">` +
        `<mxCell style="${style}" vertex="1" parent="${escXml(parentId)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
        `</mxCell>` +
        `</object>`
      );
    }

    case "swimlane": {
      const w = width || CONFIG.defaults.panelWidth;
      const h = height || CONFIG.defaults.panelHeight;
      const style = buildSwimlaneStyle({
        laneColor: node.laneColor ?? "#6366f1",
        orientation: node.orientation,
        opacity: node.opacity ?? 10,
      });
      const label = node.laneLabel?.trim() || node.name?.trim() || "Lane";
      return (
        `<mxCell id="${escXml(node.id)}" value="${escXml(label)}" style="${style}" ` +
        `vertex="1" parent="${escXml(parentId)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
        `</mxCell>`
      );
    }

    case "apiGroup": {
      const w = Math.max(width, 300);
      const h = Math.max(height, 120);
      const style = buildApiGroupStyle(node.protocol);
      const label = node.basePath
        ? `${node.serviceName}\n${node.basePath} · ${node.protocol}`
        : `${node.serviceName}\n${node.protocol}`;
      return (
        `<mxCell id="${escXml(node.id)}" value="${escXml(label)}" style="${style}" ` +
        `vertex="1" parent="${escXml(parentId)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
        `</mxCell>`
      );
    }

    case "endpoint": {
      const style = buildEndpointStyle(node.method);
      const pathLine = node.endpointDescription?.trim()
        ? `${node.method}  ${node.path}\n${node.endpointDescription}`
        : `${node.method}  ${node.path}`;
      const finalW = Math.max(width, 260);
      const finalH = Math.max(height, 40);
      return (
        `<mxCell id="${escXml(node.id)}" value="${escXml(pathLine)}" style="${style}" ` +
        `vertex="1" parent="${escXml(parentId)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${finalW}" height="${finalH}" as="geometry"/>` +
        `</mxCell>`
      );
    }

    case "dbTable": {
      const cols = node.columns.map((col) => `${col.name}: ${col.dataType}`).join("\n");
      const value = cols.length > 0 ? `${node.tableName}\n${cols}` : node.tableName;
      const finalW = Math.max(width, 260);
      const finalH = Math.max(height, 120);
      const style =
        "rounded=1;whiteSpace=wrap;html=1;align=left;spacingLeft=8;spacingTop=6;fontSize=11;fillColor=#f8fafc;strokeColor=#64748b;";
      return (
        `<mxCell id="${escXml(node.id)}" value="${escXml(value)}" style="${style}" ` +
        `vertex="1" parent="${escXml(parentId)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${finalW}" height="${finalH}" as="geometry"/>` +
        `</mxCell>`
      );
    }

    case "note": {
      const content = node.description || node.name;
      const w = width || CONFIG.defaults.noteWidth;
      const h = estimateNoteHeight(content, w);
      const style = buildNoteStyle();
      return (
        `<mxCell id="${escXml(node.id)}" value="${escXml(renderNoteHtml(content))}" ` +
        `style="${style}" vertex="1" parent="${escXml(parentId)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
        `</mxCell>`
      );
    }

    case "jsonViewer": {
      let preview = node.jsonContent;
      try {
        preview = JSON.stringify(JSON.parse(node.jsonContent), null, 2);
      } catch (err) {
        console.warn("[export-core] Failed to format JSON for preview:", err);
      }
      const truncated = preview.length > 400 ? `${preview.slice(0, 400)}…` : preview;
      const schemaLine = node.schemaRef ? `${node.schemaRef}\n` : "";
      const value = `${node.name}\n${schemaLine}${truncated}`;
      const finalW = Math.max(width, 220);
      const finalH = Math.max(height, 80);
      const style =
        "rounded=1;whiteSpace=wrap;html=1;align=left;spacingLeft=8;spacingTop=6;fontSize=10;fontFamily=Courier New;fillColor=#f1f5f9;strokeColor=#64748b;";
      return (
        `<mxCell id="${escXml(node.id)}" value="${escXml(value)}" style="${style}" ` +
        `vertex="1" parent="${escXml(parentId)}">` +
        `<mxGeometry x="${x}" y="${y}" width="${finalW}" height="${finalH}" as="geometry"/>` +
        `</mxCell>`
      );
    }

    default: {
      const _exhaustive: never = node;
      throw new Error(`Unsupported export node kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
