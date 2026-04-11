import { memo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Link2,
  LayoutDashboard,
  BookMarked,
  Github,
  Ticket,
  Link,
} from "lucide-react";
import type { ExternalLink } from "@/features/diagram";

const linkClass = (disabled?: boolean) =>
  `flex items-center gap-1 text-primary ${disabled
    ? "pointer-events-none text-gray-500 opacity-50"
    : "hover:underline cursor-pointer"
  }`;

interface ExternalLinkRowProps {
  link: ExternalLink;
  disabled?: boolean;
}

function ExternalLinkRow({ link, disabled }: ExternalLinkRowProps) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`${linkClass(disabled)} min-w-0 overflow-hidden`}
    >
      <Link className="h-3 w-3 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="text-[10px] truncate" title={link.label || link.url}>
          {link.label || link.url}
        </span>
      </span>
    </a>
  );
}

interface BadgesProps {
  controlsDisabled?: boolean;
  serviceId?: string;
  serviceName?: string;
  linkedDiagramName?: string;
  externalLinks?: ExternalLink[];
}

export const Badges = memo(function Badges({
  controlsDisabled,
  serviceId,
  serviceName,
  linkedDiagramName,
  externalLinks = [],
}: BadgesProps) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const handleServiceClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!serviceId) return;
      navigate(`/catalog?serviceId=${encodeURIComponent(serviceId)}`);
    },
    [navigate, serviceId],
  );

  const hasAnything = !!serviceName || !!linkedDiagramName || externalLinks.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="flex flex-col gap-0.5 mt-1.5">

      <div className="flex items-center gap-1 min-w-0 overflow-hidden">
        {serviceName && (
          serviceId ? (
            <button
              type="button"
              onClick={handleServiceClick}
              aria-label={`Open service ${serviceName} in registry`}
              tabIndex={controlsDisabled ? -1 : 0}
              className={`${linkClass(controlsDisabled)} min-w-0 overflow-hidden`}
            >
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="text-[10px] truncate" title={serviceName}>
                  {serviceName}
                </span>
              </span>
            </button>
          ) : (
            <div className={`${linkClass(true)} min-w-0 overflow-hidden`}>
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="text-[10px] truncate" title={serviceName}>
                  {serviceName}
                </span>
              </span>
            </div>
          )
        )}

        {externalLinks.length > 0 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors w-fit"
            >
              {expanded ? "−" : `+${externalLinks.length}`}
            </button>
          </>
        )}
      </div>
      {expanded && externalLinks.map((link) => (
        <ExternalLinkRow key={link.id} link={link} disabled={controlsDisabled} />
      ))}

      {linkedDiagramName && (
        <div className="flex items-center gap-1 text-node-container">
          <LayoutDashboard className="h-3 w-3 shrink-0" />
          <span className="text-[10px] truncate">{linkedDiagramName}</span>
        </div>
      )}
    </div>
  );
});