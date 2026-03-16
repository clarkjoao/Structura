import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Link2, LayoutDashboard } from "lucide-react";

interface BadgesProps {
  controlsDisabled?: boolean;
  serviceId?: string;
  serviceName?: string;
  linkedDiagramName?: string;
}

export const Badges = ({
  controlsDisabled,
  serviceId,
  serviceName,
  linkedDiagramName,
}: BadgesProps) => {
  const navigate = useNavigate();

  const handleServiceClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!serviceId) return;
      navigate(`/registry?serviceId=${encodeURIComponent(serviceId)}`);
    },
    [navigate, serviceId],
  );

  return (
    <>
      {serviceName && (
        serviceId ? (
          <button
            type="button"
            onClick={handleServiceClick}
            className={`mt-1.5 flex items-center gap-1 text-primary ${
              controlsDisabled ? "pointer-events-none" : "hover:underline"
            }`}
            aria-label={`Abrir serviço ${serviceName} no registry`}
            tabIndex={controlsDisabled ? -1 : 0}
          >
            <Link2 className="h-3 w-3 shrink-0" />
            <span className="text-[10px] truncate">{serviceName}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 mt-1.5">
            <Link2 className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[10px] text-primary truncate">{serviceName}</span>
          </div>
        )
      )}
      {linkedDiagramName && (
        <div className="flex items-center gap-1 mt-1">
          <LayoutDashboard className="h-3 w-3 text-node-container shrink-0" />
          <span className="text-[10px] text-node-container truncate">
            {linkedDiagramName}
          </span>
        </div>
      )}
    </>
  );
};
