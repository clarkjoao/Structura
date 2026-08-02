export {
  architectureIrSchema,
  parseArchitectureIr,
  toLayoutInput,
  toStructuralInput,
  architectureIrJsonSchema,
  proposeArchitectureParameters,
  tiersFor,
} from "./ir";

export type { ArchitectureIr, IrNode, IrBoundary, IrConnection, Tier, DiagramKind } from "./ir";

export { ProposalSession, MAX_ROUNDS, STALL_LIMIT } from "./session";
export type { ProposalResult, ProposalStatus } from "./session";

export { toStorePayload } from "./commit";
export { ArchitectureToolExecutor } from "./execute";
export type { ArchitectureToolResult } from "./execute";
