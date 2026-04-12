export type { IStoragePort } from "./IStoragePort";
export { isQuotaExceededError } from "./storageQuota";
export { mergeCustomComponentTemplates } from "./merge-custom-component-templates";
export { LocalStorageAdapter, defaultStorage } from "./LocalStorageAdapter";
export { InMemoryAdapter } from "./InMemoryAdapter";
export { FileSystemAdapter, fileSystemAdapter } from "./FileSystemAdapter";
export type {
  WorkspaceManifest,
  WorkspacePayload,
  WorkspaceScanResult,
} from "./FileSystemAdapter";
export { useFileSystemSync } from "./useFileSystemSync";
export {
  useFileSystemStorage,
  isFileSystemSupported,
} from "./useFileSystemStorage";
export {
  registerConnectFolderRequestHandler,
  requestConnectFolder,
} from "./requestConnectFolder";
export type { FsStatus } from "./useFileSystemStorage";
export {
  bootFileSystem,
  flushWorkspaceToConnectedFolder,
  forceSaveToConnectedFolder,
  hasReconnected,
  startFileSystemSync,
  stopFileSystemSync,
  resetBootState,
} from "./fileSystemBoot";
export type { ForceSaveToFolderResult } from "./fileSystemBoot";
export {
  validateDiagramFile,
  validateManifest,
} from "./validateWorkspaceFile";
export type {
  ValidationResult,
  ManifestValidationResult,
} from "./validateWorkspaceFile";
export {
  CustomComponentRepository,
  customComponentRepository,
} from "./CustomComponentRepository";
