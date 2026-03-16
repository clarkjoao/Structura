import type { Diagram, Flow, Component, Connection } from "@/features/diagram";
import {
  getEffectiveConnectionStyle,
  isPanelComponent,
  isC4Component,
  isAwsComponent,
  ServiceDefinition
} from "@/features/diagram";
import { AWS_SERVICE_MAP } from "@/lib/catalogs/aws";

const CONFIG = {
  swimlaneHeader: 30,
  minDimensions: {
    c4: { width: 240, height: 120 },
    aws: { width: 90, height: 120 },
  },
  grid: {
    dx: 1422,
    dy: 762,
    gridSize: 10,
    pageWidth: 1169,
    pageHeight: 827,
  },
  defaults: {
    panelColor: "#666666",
    noteWidth: 336,
    noteHeight: 475,
    panelWidth: 400,
    panelHeight: 300,
  },
};

const THEME = {
  colors: {
    c4: {
      person: "#083F75",
      personStroke: "#06315C",
      system: "#1061B0",
      systemStroke: "#0D5091",
      container: "#23A2D9",
      containerStroke: "#0E7DAD",
      component: "#85BBF0",
      componentStroke: "#5D82A8",
    },
    aws: {
      compute: "#ED7100",
      storage: "#3F8624",
      database: "#C7131F",
      networking: "#8C4FFF",
      security: "#DD344C",
      analytics: "#8C4FFF",
      ml: "#01A88D",
      integration: "#E7157B",
      management: "#E7157B",
      developer: "#C7131F",
      containers: "#ED7100",
      media: "#8C4FFF",
      migration: "#8A6D3B",
      iot: "#1A9C3E",
      "end-user": "#ED7100",
      general: "#232F3E",
    },
  },
  fonts: {
    c4: { name: 16, type: 11, line2: 11, badge: 9 },
    aws: { name: 14, line2: 11, badge: 9 },
    edge: { label: 11 },
    panel: { title: 16, label: 11 },
  },
  strokes: {
    call: "#1f2937",
    event: "#6366f1",
    dataFlow: "#059669",
    asyncMessage: "#7c3aed",
    dependency: "#666666",
    default: "#666666",
  },
};

const AWS_CATEGORY_MAP_LOCAL: Record<string, string> = {
  "aws-compute": "compute",
  "aws-storage": "storage",
  "aws-database": "database",
  "aws-networking": "networking",
  "aws-security": "security",
  "aws-analytics": "analytics",
  "aws-ml": "ml",
  "aws-integration": "integration",
  "aws-management": "management",
  "aws-developer": "developer",
  "aws-containers": "containers",
  "aws-media": "media",
  "aws-migration": "migration",
  "aws-iot": "iot",
  "aws-end-user": "end-user",
  "aws-general": "general",
};

const AWS_RESICON: Record<string, string> = {
  // Compute
  ec2: "ec2",
  lambda: "lambda",
  ecs: "ecs",
  eks: "eks",
  fargate: "fargate",
  "elastic-beanstalk": "elastic_beanstalk",
  batch: "batch",
  lightsail: "lightsail",
  "app-runner": "app_runner",
  "auto-scaling": "auto_scaling",
  "compute-optimizer": "compute_optimizer",
  "ec2-image-builder": "ec2_image_builder",
  // Storage
  s3: "s3",
  ebs: "ebs",
  efs: "efs",
  "s3-glacier": "s3_glacier",
  "storage-gateway": "storage_gateway",
  fsx: "fsx",
  backup: "backup",
  datasync: "datasync",
  // Database
  rds: "rds",
  dynamodb: "dynamodb",
  elasticache: "elasticache",
  redshift: "redshift",
  aurora: "aurora",
  neptune: "neptune",
  documentdb: "documentdb",
  keyspaces: "keyspaces",
  timestream: "timestream",
  memorydb: "memorydb_for_redis",
  dms: "database_migration_service",
  // Networking
  vpc: "vpc",
  cloudfront: "cloudfront",
  route53: "route_53",
  "api-gateway": "api_gateway",
  elb: "elastic_load_balancing",
  "direct-connect": "direct_connect",
  "transit-gateway": "transit_gateway",
  "global-accelerator": "global_accelerator",
  "app-mesh": "app_mesh",
  "cloud-map": "cloud_map",
  "client-vpn": "client_vpn",
  "cloud-wan": "cloud_wan",
  privatelink: "privatelink",
  // Security
  iam: "iam",
  cognito: "cognito",
  guardduty: "guardduty",
  inspector: "inspector",
  macie: "macie",
  waf: "waf",
  shield: "shield",
  kms: "key_management_service",
  "secrets-manager": "secrets_manager",
  acm: "certificate_manager",
  "firewall-manager": "firewall_manager",
  "security-hub": "security_hub",
  detective: "detective",
  cloudhsm: "cloudhsm",
  "iam-identity-center": "iam_identity_center",
  "directory-service": "directory_service",
  "audit-manager": "audit_manager",
  artifact: "artifact",
  // Analytics
  athena: "athena",
  emr: "emr",
  kinesis: "kinesis",
  quicksight: "quicksight",
  glue: "glue",
  "lake-formation": "lake_formation",
  opensearch: "opensearch_service",
  "data-exchange": "data_exchange",
  msk: "managed_streaming_for_apache_kafka",
  "data-pipeline": "data_pipeline",
  "clean-rooms": "clean_rooms",
  // ML
  sagemaker: "sagemaker",
  bedrock: "bedrock",
  rekognition: "rekognition",
  comprehend: "comprehend",
  polly: "polly",
  transcribe: "transcribe",
  translate: "translate",
  lex: "lex",
  textract: "textract",
  personalize: "personalize",
  forecast: "forecast",
  kendra: "kendra",
  // Integration
  sqs: "sqs",
  sns: "sns",
  eventbridge: "event_bridge",
  "step-functions": "step_functions",
  appsync: "appsync",
  mq: "mq",
  // Management
  cloudwatch: "cloudwatch",
  cloudformation: "cloudformation",
  cloudtrail: "cloudtrail",
  "systems-manager": "systems_manager",
  config: "config",
  organizations: "organizations",
  "control-tower": "control_tower",
  "trusted-advisor": "trusted_advisor",
  "service-catalog": "service_catalog",
  "health-dashboard": "personal_health_dashboard",
  "cost-explorer": "cost_explorer",
  // Developer
  codebuild: "codebuild",
  codepipeline: "codepipeline",
  codedeploy: "codedeploy",
  codecommit: "codecommit",
  codeartifact: "codeartifact",
  cloud9: "cloud9",
  xray: "x_ray",
  cdk: "cloud_development_kit",
  cli: "command_line_interface",
  amplify: "amplify",
  // Containers
  ecr: "ecr",
  "ecs-2": "ecs",
  "eks-2": "eks",
  "fargate-2": "fargate",
  // Media
  "media-convert": "elemental_mediaconvert",
  "media-live": "elemental_medialive",
  "media-package": "elemental_mediapackage",
  "media-store": "elemental_mediastore",
  "media-connect": "elemental_mediaconnect",
  ivs: "interactive_video_service",
  // Migration
  "migration-hub": "migration_hub",
  "app-migration": "application_migration_service",
  "app-discovery": "application_discovery_service",
  "transfer-family": "transfer_family",
  snowball: "snow_family",
  // IoT
  "iot-core": "iot_core",
  "iot-greengrass": "iot_greengrass",
  "iot-analytics": "iot_analytics",
  "iot-events": "iot_events",
  "iot-sitewise": "iot_sitewise",
  "iot-twinmaker": "iot_twinmaker",
  "iot-device-mgmt": "iot_device_management",
  "iot-fleetwise": "iot_fleet_wise",
  // End User
  workspaces: "workspaces",
  appstream: "appstream_2_0",
};

interface C4MetaInfo {
  fillColor: string;
  strokeColor: string;
  fontColor: string;
  width: number;
  height: number;
}

interface StyleOption {
  [key: string]: string | number | boolean | undefined;
}

interface AwsServiceInfo {
  icon: string;
  categoryId: string;
  color: string;
}

interface GeometryInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PanelLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildStyle(baseStyle: string, options: StyleOption): string {
  const stylePairs = Object.entries(options)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`);

  return [baseStyle, ...stylePairs].filter(Boolean).join(";");
}

function applyTemplate(
  template: string,
  placeholders: Record<string, string>,
): string {
  return template.replace(/%(\w+)%/g, (_, key) => placeholders[key] || "");
}

function validateDiagram(diagram: Diagram): void {
  if (!diagram) {
    throw new Error("Diagram is required");
  }
  if (!diagram.snapshot) {
    throw new Error("Diagram snapshot is missing");
  }
  const { components, connections } = diagram.snapshot;
  if (!components || !connections) {
    throw new Error("Invalid diagram snapshot structure");
  }
}

const C4_META: Record<string, C4MetaInfo> = {
  person: {
    fillColor: THEME.colors.c4.person,
    strokeColor: THEME.colors.c4.personStroke,
    fontColor: "#ffffff",
    width: 200,
    height: 180,
  },
  system: {
    fillColor: THEME.colors.c4.system,
    strokeColor: THEME.colors.c4.systemStroke,
    fontColor: "#ffffff",
    width: 240,
    height: 120,
  },
  container: {
    fillColor: THEME.colors.c4.container,
    strokeColor: THEME.colors.c4.containerStroke,
    fontColor: "#ffffff",
    width: 240,
    height: 120,
  },
  component: {
    fillColor: THEME.colors.c4.component,
    strokeColor: THEME.colors.c4.componentStroke,
    fontColor: "#000000",
    width: 240,
    height: 120,
  },
};

const PERSON_POINTS =
  "points=[[0.5,0,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0]];";

const BOX_POINTS =
  "points=[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]];";

const C4_SHAPE_POINTS: Record<string, string> = {
  person: PERSON_POINTS,
  system: BOX_POINTS,
  container: BOX_POINTS,
  component: BOX_POINTS,
};

const C4_LABEL_TEMPLATE =
  '<font style="font-size:%fontSize%px"><b>%c4Name%</b></font>' +
  '<div><font style="font-size:11px">[%c4Type%]</font></div>' +
  "<br>" +
  '<div><font style="font-size:11px">%c4Line2%</font></div>' +
  "%c4RegistryBadge%";

class AwsServiceCache {
  private cache = new Map<string, AwsServiceInfo>();

  getInfo(serviceId: string): AwsServiceInfo {
    if (!this.cache.has(serviceId)) {
      const catalogEntry = AWS_SERVICE_MAP.get(serviceId);
      const categoryId = catalogEntry?.categoryId ?? "aws-general";
      const categoryKey = AWS_CATEGORY_MAP_LOCAL[categoryId] ?? "general";

      this.cache.set(serviceId, {
        icon: AWS_RESICON[serviceId] ?? "general",
        categoryId,
        color:
          THEME.colors.aws[categoryKey as keyof typeof THEME.colors.aws] ??
          THEME.colors.aws.general,
      });
    }
    return this.cache.get(serviceId)!;
  }

  clear(): void {
    this.cache.clear();
  }
}

const awsServiceCache = new AwsServiceCache();

function buildC4Line2(description?: string, technology?: string): string {
  const parts: string[] = [];
  if (description) parts.push(description);
  if (technology) parts.push(`[${technology}]`);
  return parts.join(" ");
}

function c4TypeLabel(type: string): string {
  const typeMap: Record<string, string> = {
    person: "Person",
    system: "Software System",
    container: "Container",
    component: "Component",
  };
  return typeMap[type] || type;
}

function buildC4RegistryBadge(serviceName?: string): string {
  if (!serviceName) return "";
  return `<div><font style="font-size:9px;color:#666666">⬡ ${escXml(serviceName)}</font></div>`;
}

function buildC4Style(meta: C4MetaInfo, type: string): string {
  const baseStyle = `html=1;whiteSpace=wrap;fontSize=11;align=center;dashed=0;metaEdit=1;resizable=0;${C4_SHAPE_POINTS[type] ?? BOX_POINTS}`;

  return buildStyle(baseStyle, {
    fillColor: meta.fillColor,
    strokeColor: meta.strokeColor,
    fontColor: meta.fontColor,
    labelBackgroundColor: "none",
  });
}

function buildAwsStyle(awsInfo: AwsServiceInfo): string {
  const baseStyle = `sketch=0;outlineConnect=0;dashed=0;verticalLabelPosition=middle;verticalAlign=bottom;align=center;html=1;whiteSpace=wrap;fontSize=10;fontStyle=1;spacing=3;shape=mxgraph.aws4.productIcon;prIcon=mxgraph.aws4.${awsInfo.icon};`;

  return buildStyle(baseStyle, {
    strokeColor: "#ffffff",
    fillColor: "#232F3E",
    fontColor: "#232F3E",
    gradientColor: "none",
  });
}

function buildPanelStyle(stroke: string): string {
  const baseStyle = `rounded=1;arcSize=20;dashed=1;dashPattern=8 4;fillColor=none;whiteSpace=wrap;html=1;fontSize=11;labelBackgroundColor=none;align=left;verticalAlign=bottom;spacing=10;spacingTop=0;metaEdit=1;rotatable=0;connectable=0;allowArrows=0;expand=0;recursiveResize=0;editable=1;pointerEvents=0;absoluteArcSize=1;perimeter=rectanglePerimeter;`;

  return buildStyle(baseStyle, {
    strokeColor: stroke,
    fontColor: "#333333",
    points:
      "[[0.25,0,0],[0.5,0,0],[0.75,0,0],[1,0.25,0],[1,0.5,0],[1,0.75,0],[0.75,1,0],[0.5,1,0],[0.25,1,0],[0,0.75,0],[0,0.5,0],[0,0.25,0]]",
  });
}

function buildNoteStyle(): string {
  return "text;html=1;strokeColor=#cccccc;fillColor=#ffffff;align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;whiteSpace=wrap;rounded=1;arcSize=5;fontColor=#000000;fontSize=12;";
}

function buildEdgeStyle(
  strokeColor: string,
  isDashed: boolean,
  dashPattern: string,
  strokeWidth: number,
  endArrow: string,
  startArrow: string,
  bidir: string,
): string {
  const baseStyle = `edgeStyle=elbowEdgeStyle;elbow=orthogonal;curved=1;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;`;

  return buildStyle(baseStyle, {
    endArrow: endArrow,
    endFill: endArrow === "block" ? 1 : 0,
    ...(bidir && {
      startArrow: startArrow,
      startFill: startArrow === "block" ? 1 : 0,
    }),
    ...(isDashed && { dashed: 1, dashPattern: dashPattern }),
    ...(strokeWidth !== 1 && { strokeWidth: strokeWidth }),
    strokeColor: strokeColor,
    fontColor: "#000000",
    fontSize: 11,
    labelBackgroundColor: "#ffffff",
    labelBorderColor: "none",
  });
}

interface CellBuilder {
  build(
    component: Component,
    geometry: GeometryInfo,
    parentId: string,
    serviceName?: string,
  ): string;
}

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
    _parentId: string,
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
      `<mxCell style="${style}" vertex="1" parent="1">` +
      `<mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/>` +
      `</mxCell>` +
      `</object>`
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

// Cell Builder Factory
const cellBuilders: Record<string, CellBuilder> = {
  c4: new C4CellBuilder(),
  aws: new AwsCellBuilder(),
  panel: new PanelCellBuilder(),
  note: new NoteCellBuilder(),
};

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildEdgeCell(conn: Connection): string {
  const eff = getEffectiveConnectionStyle(conn);
  const isDashed = eff.strokeStyle === "dashed" || eff.strokeStyle === "dotted";
  const dashPattern = eff.strokeStyle === "dotted" ? "2 4" : "8 4";

  function toDrawioArrow(m: string): string {
    if (m === "arrowclosed") return "block";
    if (m === "arrow") return "open";
    return "none";
  }

  const endArrow = toDrawioArrow(eff.markerEnd);
  const startArrow = toDrawioArrow(eff.markerStart);
  const bidir =
    eff.markerStart !== "none"
      ? `startArrow=${startArrow};startFill=${startArrow === "block" ? 1 : 0};`
      : "";

  const strokeColor = getStrokeColor(conn.intent);
  const strokeWidth = eff.strokeWidth ?? 1;

  const style = buildEdgeStyle(
    strokeColor,
    isDashed,
    dashPattern,
    strokeWidth,
    endArrow,
    startArrow,
    bidir,
  );

  const tech = conn.technology
    ? `<div><i>${escXml(conn.technology)}</i></div>`
    : "";
  const value = conn.label ? `${escXml(conn.label)}${tech}` : tech;

  return (
    `<mxCell id="${escXml(conn.id)}" value="${value}" style="${style}" ` +
    `edge="1" source="${escXml(conn.sourceId)}" target="${escXml(conn.targetId)}" parent="1">` +
    `<mxGeometry relative="1" as="geometry"/>` +
    `</mxCell>`
  );
}

function getStrokeColor(intent: Connection["intent"]): string {
  const colorMap: Record<string, string> = {
    call: THEME.strokes.call,
    event: THEME.strokes.event,
    "data-flow": THEME.strokes.dataFlow,
    "async-message": THEME.strokes.asyncMessage,
    dependency: THEME.strokes.dependency,
  };

  return colorMap[intent] ?? THEME.strokes.default;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOMETRY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateGeometry(
  layout: any,
  parentLayout: any | undefined,
  isPanel: boolean,
): GeometryInfo {
  if (!layout) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const x = parentLayout ? layout.x - parentLayout.x : layout.x;
  const y = parentLayout
    ? layout.y - parentLayout.y - (isPanel ? 0 : CONFIG.swimlaneHeader)
    : layout.y;

  return {
    x,
    y,
    width: layout.width ?? 0,
    height: layout.height ?? 0,
  };
}

export function exportJSON(diagram: Diagram): string {
  validateDiagram(diagram);
  return JSON.stringify(diagram, null, 2);
}

export function exportDrawio(
  diagram: Diagram,
  serviceRegistry: Record<string, ServiceDefinition>,
): string {
  validateDiagram(diagram);

  const { components, connections } = diagram.snapshot;

  // Build layout lookup
  const layoutMap = new Map(Object.entries(diagram.nodeLayouts));

  // Separate panels and collect layout info
  const panelIds = new Set<string>();
  const panelOrder: string[] = [];
  const childrenByPanel = new Map<string, string[]>();
  const standalCells: string[] = [];
  const edgeCells: string[] = [];
  const panelLayouts = new Map<string, PanelLayout>();

  // Collect panels
  for (const c of Object.values(components)) {
    if (isPanelComponent(c)) {
      panelIds.add(c.id);
      panelOrder.push(c.id);
      const nl = layoutMap.get(c.id);
      if (nl) {
        panelLayouts.set(c.id, {
          x: nl.x,
          y: nl.y,
          w: nl.width ?? CONFIG.defaults.panelWidth,
          h: nl.height ?? CONFIG.defaults.panelHeight,
        });
      }
    }
  }

  // Render non-panel components
  for (const c of Object.values(components)) {
    if (isPanelComponent(c)) continue;

    const nl = layoutMap.get(c.id);
    if (!nl) continue;

    const serviceName = c.serviceId
      ? serviceRegistry[c.serviceId]?.name
      : undefined;
    const parentNl =
      c.parentId && panelIds.has(c.parentId)
        ? layoutMap.get(c.parentId)
        : undefined;
    const parentId = c.parentId && panelIds.has(c.parentId) ? c.parentId : "1";

    const geometry = calculateGeometry(nl, parentNl, false);

    let cell: string;

    if (isAwsComponent(c)) {
      cell = cellBuilders.aws.build(c, geometry, parentId);
    } else if (isC4Component(c)) {
      cell = cellBuilders.c4.build(c, geometry, parentId, serviceName);
    } else {
      const finalWidth = geometry.width ?? CONFIG.defaults.noteWidth;
      const finalHeight = geometry.height ?? CONFIG.defaults.noteHeight;
      cell = cellBuilders.note.build(
        c,
        { ...geometry, width: finalWidth, height: finalHeight },
        parentId,
      );
    }

    if (parentId !== "1") {
      const arr = childrenByPanel.get(parentId) ?? [];
      arr.push(cell);
      childrenByPanel.set(parentId, arr);
    } else {
      standalCells.push(cell);
    }
  }

  // Build panel cells with children
  const panelAndChildCells: string[] = [];
  for (const panelId of panelOrder) {
    const pl = panelLayouts.get(panelId);
    if (pl) {
      const panelComp = components[panelId];
      if (panelComp && isPanelComponent(panelComp)) {
        const panelGeometry = { x: pl.x, y: pl.y, width: pl.w, height: pl.h };
        panelAndChildCells.push(
          cellBuilders.panel.build(panelComp, panelGeometry, "1"),
        );
      }
    }
    const kids = childrenByPanel.get(panelId) ?? [];
    panelAndChildCells.push(...kids);
  }

  // Build edges
  for (const conn of Object.values(connections)) {
    edgeCells.push(buildEdgeCell(conn));
  }

  // Assemble final XML
  const allCells = [
    `<mxCell id="0"/>`,
    `<mxCell id="1" parent="0"/>`,
    ...panelAndChildCells,
    ...standalCells,
    ...edgeCells,
  ].join("");

  const slug = escXml(diagram.name);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mxfile><diagram name="${slug}">` +
    `<mxGraphModel dx="${CONFIG.grid.dx}" dy="${CONFIG.grid.dy}" grid="1" gridSize="${CONFIG.grid.gridSize}" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="${CONFIG.grid.pageWidth}" pageHeight="${CONFIG.grid.pageHeight}" math="0" shadow="0" background="#ffffff">` +
    `<root>${allCells}</root>` +
    `</mxGraphModel></diagram></mxfile>`
  );
}

export function exportMermaid(
  flows: Flow[],
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): string {
  return flows
    .map((flow) => `## ${flow.name}\n\n\`\`\`mermaid\n${flow.mermaid}\n\`\`\``)
    .join("\n\n");
}

export function downloadFile(
  content: string,
  filename: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
