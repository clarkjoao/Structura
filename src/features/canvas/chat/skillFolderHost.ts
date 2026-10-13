import { fileSystemAdapter } from "@/infrastructure/persistence";
import type { SkillFolderHost } from "@/features/llm/skills/skill-sources";

/** How chat skills reach `.structura/skills/` in the connected workspace folder. */
export const canvasSkillFolderHost: SkillFolderHost = {
  isConnected: () => fileSystemAdapter.isConnected,
  workspaceId: () => fileSystemAdapter.folderName,
  listFiles: (segments) => fileSystemAdapter.listFilesAt([...segments]),
  readFile: (segments, fileName) => fileSystemAdapter.readTextFileAt([...segments], fileName),
  writeFile: (segments, fileName, text) =>
    fileSystemAdapter.writeTextFileAt([...segments], fileName, text),
  deleteFile: (segments, fileName) => fileSystemAdapter.deleteFileAt([...segments], fileName),
};
