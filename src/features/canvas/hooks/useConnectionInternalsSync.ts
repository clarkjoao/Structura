import { useEffect, useRef } from "react";

type ConnectionCounts = Record<string, { incoming: number; outgoing: number }>;

export function useConnectionInternalsSync(
  connectionCountPerNode: ConnectionCounts,
  updateNodeInternals: (nodeIds: string[]) => void,
) {
  const prevRef = useRef<ConnectionCounts>({});

  useEffect(() => {
    const changed = Object.keys(connectionCountPerNode).filter((id) => {
      const prev = prevRef.current[id];
      const cur = connectionCountPerNode[id];
      return !prev || prev.incoming !== cur.incoming || prev.outgoing !== cur.outgoing;
    });
    if (changed.length > 0) updateNodeInternals(changed);
    prevRef.current = connectionCountPerNode;
  }, [connectionCountPerNode, updateNodeInternals]);
}
