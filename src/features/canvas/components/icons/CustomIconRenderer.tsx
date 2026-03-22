import { cn } from "@/lib/utils";

export interface CustomIconRendererProps {
  svgContent: string;
  size?: number;
  className?: string;
}

export function CustomIconRenderer({
  svgContent,
  size = 32,
  className,
}: CustomIconRendererProps) {
  return (
    <div
      className={cn(className)}
      style={{ width: size, height: size, pointerEvents: "none" }}
      // Content is pre-sanitized by svg.sanitizer before reaching the canvas.
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}
