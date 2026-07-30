import { ExternalLink } from "lucide-react";
import type { Diagram } from "@/features/diagram/model";
import { getAppUrl } from "@/lib/diagram-url";

interface OpenInStructuraButtonProps {
  diagram: Diagram;
}

export const OpenInStructuraButton = ({ diagram }: OpenInStructuraButtonProps) => (
  <a
    href={getAppUrl()}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`Abrir ${diagram.name} no Structura`}
    style={{
      position: "absolute",
      top: 12,
      right: 12,
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      background: "var(--color-background-primary)",
      border: "0.5px solid var(--color-border-secondary)",
      borderRadius: "var(--border-radius-md)",
      fontSize: 12,
      color: "var(--color-text-secondary)",
      textDecoration: "none",
      zIndex: 10,
      cursor: "pointer",
    }}
  >
    <ExternalLink size={13} />
    Abrir no Structura
  </a>
);
