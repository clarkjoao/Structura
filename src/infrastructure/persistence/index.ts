export type { IStoragePort } from "./IStoragePort";

export { defaultStorage } from "./LocalStorageAdapter";
export { InMemoryAdapter } from "./InMemoryAdapter";

export { useFileSystemSync } from "./useFileSystemSync";
export { isFileSystemSupported } from "./useFileSystemStorage";
export { requestConnectFolder } from "./requestConnectFolder";

export { useFolderSyncStatus } from "./folderSyncStatus.store";
export { forceSaveToConnectedFolder } from "./fileSystemBoot";
