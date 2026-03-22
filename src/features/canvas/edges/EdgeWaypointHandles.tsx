import type { TFunction } from "i18next";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "@/features/diagram";
import MidpointHandle from "./components/MidpointHandle";
import WaypointHandle from "./components/WaypointHandle";
import { buildEdgeMidpoints } from "./edgeBuilding";

export interface EdgeWaypointHandlesProps {
  connectionId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  waypoints: Point[];
  translate: TFunction;
  onWaypointDrag: (waypointIndex: number, newPoint: Point) => void;
  onWaypointRemoveAtIndex: (waypointIndex: number) => void;
  onMidpointPointerDown: (
    segmentIndex: number,
    midpoint: Point,
  ) => (event: ReactPointerEvent<SVGCircleElement>) => void;
  /** Cancels midpoint drag listeners before a waypoint drag. */
  onWaypointGestureClear?: () => void;
}

export function EdgeWaypointHandles({
  connectionId,
  sourceX,
  sourceY,
  targetX,
  targetY,
  waypoints,
  translate,
  onWaypointDrag,
  onWaypointRemoveAtIndex,
  onMidpointPointerDown,
  onWaypointGestureClear,
}: EdgeWaypointHandlesProps) {
  return (
    <>
      {waypoints.map((waypoint, waypointIndex) => (
        <WaypointHandle
          key={`${connectionId}-wp-${waypointIndex}`}
          point={waypoint}
          onDrag={(newPoint) => onWaypointDrag(waypointIndex, newPoint)}
          onDoubleClick={() => onWaypointRemoveAtIndex(waypointIndex)}
          onPointerGestureStart={onWaypointGestureClear}
          ariaLabel={translate("customEdge.waypointHandleAria", { index: waypointIndex + 1 })}
        />
      ))}
      {buildEdgeMidpoints(sourceX, sourceY, targetX, targetY, waypoints).map(
        (midpoint, segmentIndex) => (
          <MidpointHandle
            key={`${connectionId}-mid-${segmentIndex}`}
            point={midpoint}
            onPointerDown={onMidpointPointerDown(segmentIndex, midpoint)}
            ariaLabel={translate("customEdge.midpointHandleAria", { segment: segmentIndex + 1 })}
          />
        ),
      )}
    </>
  );
}
