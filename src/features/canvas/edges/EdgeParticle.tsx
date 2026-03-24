import { FLOW_PARTICLE_DURATION_MS } from "../canvas.constants";

export const PARTICLE_DURATION_MS = FLOW_PARTICLE_DURATION_MS;

export interface EdgeParticleProps {
  edgePath: string;
  direction: "request" | "response" | null;
}

export function EdgeParticle({ edgePath, direction }: EdgeParticleProps) {
  const reverse = direction === "response" ? " reverse" : "";
  return (
    <>
      <style>{`@keyframes flowParticle { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -112; } }`}</style>
      <path
        d={edgePath}
        fill="none"
        stroke={direction === "response" ? "hsl(152 60% 45%)" : "hsl(187 72% 51%)"}
        strokeWidth={2.5}
        strokeDasharray="6 106"
        strokeDashoffset={0}
        strokeLinecap="round"
        style={{
          animation: `flowParticle ${PARTICLE_DURATION_MS}ms linear infinite${reverse}`,
          pointerEvents: "none",
        }}
      />
    </>
  );
}
