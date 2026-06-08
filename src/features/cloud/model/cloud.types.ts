import type { ComponentType, LazyExoticComponent } from "react";

type IconComponent = ComponentType<{ size?: number | string }>;

export interface CloudService {
  id: string;
  name: string;
  iconName: string;
  categoryId: string;
}

export interface CloudCategory {
  id: string;
  providerId: string;
  name: string;
}

export interface CloudCategoryStyle {
  borderClass: string;
}

export interface IconResolver {
  resolve(serviceIconName: string): LazyExoticComponent<IconComponent> | null;
  Fallback: IconComponent;
}

export interface CloudProviderAdapter {
  readonly id: string;
  readonly name: string;
  readonly typePrefix: string;
  readonly categories: CloudCategory[];
  readonly services: CloudService[];
  readonly iconResolver: IconResolver;

  matchesType(type: string): boolean;
  getCategoryForType(type: string): CloudCategory | undefined;
  getService(serviceId: string): CloudService | undefined;
  getCategoryStyle(categoryId: string): CloudCategoryStyle;
}
