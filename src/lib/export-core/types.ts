export interface C4MetaInfo {
  fillColor: string;
  strokeColor: string;
  fontColor: string;
  width: number;
  height: number;
}

export interface StyleOption {
  [key: string]: string | number | boolean | undefined;
}

export interface AwsServiceInfo {
  icon: string;
  categoryId: string;
  color: string;
}

export interface GeometryInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}
