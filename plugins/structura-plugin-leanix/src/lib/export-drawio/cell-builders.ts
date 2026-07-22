import type { PluginComponentSnapshot } from "../../types/plugin.types";
import { C4_LABEL_TEMPLATE, C4_META, CONFIG } from "./constants";
import { awsServiceCache } from "./aws-cache";
import type { GeometryInfo } from "./types";
import {
  buildAwsStyle,
  buildC4Style,
  buildC4Line2,
  buildC4RegistryBadge,
  buildEndpointStyle,
  buildNoteStyle,
  buildPanelStyle,
  buildApiGroupStyle,
  c4TypeLabel,
} from "./styles";
import { applyTemplate, escXml } from "./xml-utils";

/**
 * C4 Cell Builder - builds mxCell XML for C4 components
 */
class C4CellBuilder {
  build(
    c: PluginComponentSnapshot,
    geometry: GeometryInfo,
    parentId: string,
    serviceName?: string,
  ): string {
    const meta = C4_META[c.type] ?? C4_META.system;
    const { x, y, width, height } = geometry;

    const finalWidth = Math.max(width, CONFIG.minDimensions.c4.width);
    const finalHeight = Math.max(height, CONFIG.minDimensions.c4.height);

    const c4Line2 = buildC4Line2(c.description);
    const badge = buildC4RegistryBadge(serviceName);

    const style = buildC4Style(meta, c.type);

    const label = applyTemplate(C4_LABEL_TEMPLATE, {
      fontSize: "16",
      c4Name: c.label,
      c4Type: c4TypeLabel(c.type),
      c4Line2,
      c4RegistryBadge: badge,
    });

    return (
      `<object placeholders="1" ` +
      `c4Name="${escXml(c.label)}" ` +
      `c4Type="${escXml(c4TypeLabel(c.type))}" ` +
      `c4Description="${escXml(c.description)}" ` +
      `c4Line2="${escXml(c4Line2)}" ` +
      `c4RegistryBadge="${escXml(badge)}" ` +
      `label="${escXml(label)}" ` +
      `id="${escXml(c.id)}">` +
      `<mxCell style="${style}" vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${finalWidth}" height="${finalHeight}" as="geometry"/>` +
      `</mxCell>` +
      `</object>`
    );
  }
}

/**
 * AWS Cell Builder - builds mxCell XML for AWS components
 */
class AwsCellBuilder {
  build(c: PluginComponentSnapshot, geometry: GeometryInfo, parentId: string): string {
    const { x, y } = geometry;
    // Extract AWS service ID from serviceId or type
    const serviceId = c.serviceId?.replace("aws-", "") ?? c.type.replace("aws-", "") ?? "";
    const awsInfo = awsServiceCache.getInfo(serviceId);

    const style = buildAwsStyle(awsInfo);

    return (
      `<mxCell id="${escXml(c.id)}" parent="${escXml(parentId)}" style="${style}" value="${escXml(c.label)}" vertex="1">` +
      `<mxGeometry height="${CONFIG.minDimensions.aws.height}" width="${CONFIG.minDimensions.aws.width}" x="${x}" y="${y}" as="geometry" />` +
      `</mxCell>`
    );
  }
}

/**
 * Panel Cell Builder - builds mxCell XML for panels (system boundaries)
 */
class PanelCellBuilder {
  build(c: PluginComponentSnapshot, geometry: GeometryInfo, parentId: string): string {
    const { x, y, width, height } = geometry;
    const stroke = CONFIG.defaults.panelColor;

    const style = buildPanelStyle(stroke);

    const label =
      '<font style="font-size:16px"><b><div style="text-align:left">%c4Name%</div></b></font>' +
      '<div style="text-align:left">[Software System]</div>';

    const appliedLabel = applyTemplate(label, {
      c4Name: c.label,
    });

    return (
      `<object placeholders="1" ` +
      `c4Name="${escXml(c.label)}" ` +
      `c4Type="SystemScopeBoundary" ` +
      `c4Application="Software System" ` +
      `label="${escXml(appliedLabel)}" ` +
      `id="${escXml(c.id)}">` +
      `<mxCell style="${style}" vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>` +
      `</mxCell>` +
      `</object>`
    );
  }
}

/**
 * API Group Cell Builder - builds mxCell XML for API groups
 */
class ApiGroupCellBuilder {
  build(c: PluginComponentSnapshot, geometry: GeometryInfo, parentId: string): string {
    const { x, y, width, height } = geometry;
    const w = Math.max(width, 300);
    const h = Math.max(height, 120);
    // Extract protocol from tags or description
    const protocol = this.extractProtocol(c);
    const style = buildApiGroupStyle(protocol);
    const label = `${c.label}`;
    return (
      `<mxCell id="${escXml(c.id)}" value="${escXml(label)}" style="${style}" ` +
      `vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
      `</mxCell>`
    );
  }

  private extractProtocol(c: PluginComponentSnapshot): string {
    // Try to extract protocol from tags
    for (const tag of c.tags) {
      const lower = tag.toLowerCase();
      if (["http", "https", "rest", "graphql", "websocket", "grpc"].includes(lower)) {
        return lower;
      }
    }
    // Default to https
    return "https";
  }
}

/**
 * Endpoint Cell Builder - builds mxCell XML for endpoints
 */
class EndpointCellBuilder {
  build(c: PluginComponentSnapshot, geometry: GeometryInfo, parentId: string): string {
    const { x, y, width, height } = geometry;
    // Extract HTTP method from tags or label
    const method = this.extractMethod(c);
    const style = buildEndpointStyle(method);
    const pathLine = `${method}  ${c.label}`;
    const finalW = Math.max(width, 260);
    const finalH = Math.max(height, 40);
    return (
      `<mxCell id="${escXml(c.id)}" value="${escXml(pathLine)}" style="${style}" ` +
      `vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${finalW}" height="${finalH}" as="geometry"/>` +
      `</mxCell>`
    );
  }

  private extractMethod(c: PluginComponentSnapshot): string {
    // Check tags first
    for (const tag of c.tags) {
      const upper = tag.toUpperCase();
      if (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(upper)) {
        return upper;
      }
    }
    // Check label
    const labelUpper = c.label.toUpperCase();
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      if (labelUpper.startsWith(method)) {
        return method;
      }
    }
    return "GET";
  }
}

/**
 * Database Table Cell Builder - builds mxCell XML for database tables
 */
class DbTableCellBuilder {
  build(c: PluginComponentSnapshot, geometry: GeometryInfo, parentId: string): string {
    const { x, y, width, height } = geometry;
    const value = c.label;
    const finalW = Math.max(width, 260);
    const finalH = Math.max(height, 120);
    const style =
      "rounded=1;whiteSpace=wrap;html=1;align=left;spacingLeft=8;spacingTop=6;fontSize=11;fillColor=#f8fafc;strokeColor=#64748b;";
    return (
      `<mxCell id="${escXml(c.id)}" value="${escXml(value)}" style="${style}" ` +
      `vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${finalW}" height="${finalH}" as="geometry"/>` +
      `</mxCell>`
    );
  }
}

/**
 * Note Cell Builder - builds mxCell XML for notes
 */
class NoteCellBuilder {
  build(c: PluginComponentSnapshot, geometry: GeometryInfo, parentId: string): string {
    const { x, y, width, height } = geometry;
    const style = buildNoteStyle();
    return (
      `<mxCell id="${escXml(c.id)}" value="${escXml(c.description || c.label)}" ` +
      `style="${style}" vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>` +
      `</mxCell>`
    );
  }
}

/**
 * JSON Viewer Cell Builder - builds mxCell XML for JSON viewers
 */
class JsonViewerCellBuilder {
  build(c: PluginComponentSnapshot, geometry: GeometryInfo, parentId: string): string {
    const { x, y, width, height } = geometry;
    let preview = c.description;
    try {
      preview = JSON.stringify(JSON.parse(c.description), null, 2);
    } catch {
      // Use as-is if not valid JSON
    }
    const truncated = preview.length > 400 ? `${preview.slice(0, 400)}…` : preview;
    const value = `${c.label}\n${truncated}`;
    const finalW = Math.max(width, 220);
    const finalH = Math.max(height, 80);
    const style =
      "rounded=1;whiteSpace=wrap;html=1;align=left;spacingLeft=8;spacingTop=6;fontSize=10;fontFamily=Courier New;fillColor=#f1f5f9;strokeColor=#64748b;";
    return (
      `<mxCell id="${escXml(c.id)}" value="${escXml(value)}" style="${style}" ` +
      `vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${finalW}" height="${finalH}" as="geometry"/>` +
      `</mxCell>`
    );
  }
}

// Export cell builders registry
export const cellBuilders = {
  c4: new C4CellBuilder(),
  aws: new AwsCellBuilder(),
  panel: new PanelCellBuilder(),
  apiGroup: new ApiGroupCellBuilder(),
  endpoint: new EndpointCellBuilder(),
  dbTable: new DbTableCellBuilder(),
  note: new NoteCellBuilder(),
  jsonViewer: new JsonViewerCellBuilder(),
};
