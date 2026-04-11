
import type {
  ApiGroupComponent,
  Component,
  DbTableComponent,
  EndpointComponent,
  JsonViewerComponent,
} from "@/features/diagram";
import {
  C4_LABEL_TEMPLATE,
  C4_META,
  CONFIG,
  THEME,
} from "./constants";
import { awsServiceCache } from "./aws-cache";
import type { CellBuilder, GeometryInfo } from "./types";
import {
  buildApiGroupStyle,
  buildAwsStyle,
  buildC4Line2,
  buildC4RegistryBadge,
  buildC4Style,
  buildEndpointStyle,
  buildNoteStyle,
  buildPanelStyle,
  c4TypeLabel,
} from "./styles";
import { applyTemplate, escXml } from "./xml-utils";

class C4CellBuilder implements CellBuilder {
  build(
    c: Component & { type: string; technology?: string },
    geometry: GeometryInfo,
    parentId: string,
    serviceName?: string,
  ): string {
    const meta = C4_META[c.type] ?? C4_META.system;
    const { x, y, width, height } = geometry;

    const finalWidth = Math.max(width, CONFIG.minDimensions.c4.width);
    const finalHeight = Math.max(height, CONFIG.minDimensions.c4.height);

    const c4Line2 = buildC4Line2(c.description, c.technology);
    const badge = buildC4RegistryBadge(serviceName);

    const style = buildC4Style(meta, c.type);

    const label = applyTemplate(C4_LABEL_TEMPLATE, {
      fontSize: String(THEME.fonts.c4.name),
      c4Name: c.name,
      c4Type: c4TypeLabel(c.type),
      c4Line2,
      c4RegistryBadge: badge,
    });

    const svcAttrs = serviceName
      ? ` registryService="${escXml(serviceName)}" registryId="${escXml(c.serviceId ?? "")}"`
      : "";

    return (
      `<object placeholders="1" ` +
      `c4Name="${escXml(c.name)}" ` +
      `c4Type="${escXml(c4TypeLabel(c.type))}" ` +
      `c4Description="${escXml(c.description)}" ` +
      `c4Technology="${escXml(c.technology ?? "")}" ` +
      `c4Line2="${escXml(c4Line2)}" ` +
      `c4RegistryBadge="${escXml(badge)}" ` +
      `label="${escXml(label)}" ` +
      `id="${escXml(c.id)}"${svcAttrs}>` +
      `<mxCell style="${style}" vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${finalWidth}" height="${finalHeight}" as="geometry"/>` +
      `</mxCell>` +
      `</object>`
    );
  }
}

class AwsCellBuilder implements CellBuilder {
  build(
    c: Component & { awsService?: string; type: string },
    geometry: GeometryInfo,
    parentId: string,
  ): string {
    const { x, y } = geometry;
    const serviceId = c.awsService ?? "";
    const awsInfo = awsServiceCache.getInfo(serviceId);

    const style = buildAwsStyle(awsInfo);

    return (
      `<mxCell id="${escXml(c.id)}" parent="${escXml(parentId)}" style="${style}" value="${escXml(c.name)}" vertex="1">` +
      `<mxGeometry height="${CONFIG.minDimensions.aws.height}" width="${CONFIG.minDimensions.aws.width}" x="${x}" y="${y}" as="geometry" />` +
      `</mxCell>`
    );
  }
}

class PanelCellBuilder implements CellBuilder {
  build(
    c: Component & { type: "panel"; panelColor?: string },
    geometry: GeometryInfo,
    parentId: string,
  ): string {
    const { x, y, width, height } = geometry;
    const stroke = c.panelColor ?? CONFIG.defaults.panelColor;

    const style = buildPanelStyle(stroke);

    const label =
      '<font style="font-size:16px"><b><div style="text-align:left">%c4Name%</div></b></font>' +
      '<div style="text-align:left">[%c4Application%]</div>';

    const appliedLabel = applyTemplate(label, {
      c4Name: c.name,
      c4Application: "Software System",
    });

    return (
      `<object placeholders="1" ` +
      `c4Name="${escXml(c.name)}" ` +
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

class ApiGroupCellBuilder implements CellBuilder {
  build(
    c: ApiGroupComponent,
    geometry: GeometryInfo,
    parentId: string,
  ): string {
    const { x, y, width, height } = geometry;
    const w = Math.max(width, 300);
    const h = Math.max(height, 120);
    const style = buildApiGroupStyle(c.protocol);
    const label = `${c.serviceName}\n${c.basePath} · ${c.protocol}`;
    return (
      `<mxCell id="${escXml(c.id)}" value="${escXml(label)}" style="${style}" ` +
      `vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
      `</mxCell>`
    );
  }
}

class EndpointCellBuilder implements CellBuilder {
  build(
    c: EndpointComponent,
    geometry: GeometryInfo,
    parentId: string,
  ): string {
    const { x, y, width, height } = geometry;
    const style = buildEndpointStyle(c.method);
    const pathLine = c.endpointDescription?.trim()
      ? `${c.method}  ${c.path}\n${c.endpointDescription}`
      : `${c.method}  ${c.path}`;
    const finalW = Math.max(width, 260);
    const finalH = Math.max(height, 40);
    return (
      `<mxCell id="${escXml(c.id)}" value="${escXml(pathLine)}" style="${style}" ` +
      `vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${finalW}" height="${finalH}" as="geometry"/>` +
      `</mxCell>`
    );
  }
}

class DbTableCellBuilder implements CellBuilder {
  build(
    c: DbTableComponent,
    geometry: GeometryInfo,
    parentId: string,
  ): string {
    const { x, y, width, height } = geometry;
    const cols = c.columns
      .map((col) => `${col.name}: ${col.dataType}`)
      .join("\n");
    const value = cols.length > 0 ? `${c.tableName}\n${cols}` : c.tableName;
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

class NoteCellBuilder implements CellBuilder {
  build(
    c: Component & { type: "note" },
    geometry: GeometryInfo,
    parentId: string,
  ): string {
    const { x, y, width, height } = geometry;

    const style = buildNoteStyle();

    return (
      `<mxCell id="${escXml(c.id)}" value="${escXml(c.description || c.name)}" ` +
      `style="${style}" vertex="1" parent="${escXml(parentId)}">` +
      `<mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>` +
      `</mxCell>`
    );
  }
}

class JsonViewerCellBuilder implements CellBuilder {
  build(
    c: JsonViewerComponent,
    geometry: GeometryInfo,
    parentId: string,
  ): string {
    const { x, y, width, height } = geometry;
    let preview = c.jsonContent;
    try {
      preview = JSON.stringify(JSON.parse(c.jsonContent), null, 2);
    } catch {
      
    }
    const truncated = preview.length > 400 ? `${preview.slice(0, 400)}…` : preview;
    const schemaLine = c.schemaRef ? `${c.schemaRef}\n` : "";
    const value = `${c.name}\n${schemaLine}${truncated}`;
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

export const cellBuilders: Record<string, CellBuilder> = {
  c4: new C4CellBuilder(),
  aws: new AwsCellBuilder(),
  panel: new PanelCellBuilder(),
  apiGroup: new ApiGroupCellBuilder(),
  endpoint: new EndpointCellBuilder(),
  dbTable: new DbTableCellBuilder(),
  note: new NoteCellBuilder(),
  jsonViewer: new JsonViewerCellBuilder(),
};
