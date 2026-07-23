/**
 * C4 Meta Information
 */
export interface C4MetaInfo {
  fillColor: string;
  strokeColor: string;
  fontColor: string;
  width: number;
  height: number;
}

/**
 * Style options for draw.io
 */
export interface StyleOption {
  [key: string]: string | number | boolean | undefined;
}

/**
 * AWS Service Info
 */
export interface AwsServiceInfo {
  icon: string;
  categoryId: string;
  color: string;
}

/**
 * Geometry information for cells
 */
export interface GeometryInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bounding box for layout calculations
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}
