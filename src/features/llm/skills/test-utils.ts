import type { SkillFolderHost } from "./skill-sources";

/** An in-memory workspace folder for skill tests; `files` is keyed by "dir/name". */
export function memorySkillFolder(workspaceId = "workspace") {
  const files = new Map<string, string>();
  let connected = true;
  const join = (segments: readonly string[], name: string) => [...segments, name].join("/");

  const host: SkillFolderHost = {
    isConnected: () => connected,
    workspaceId: () => (connected ? workspaceId : null),
    listFiles: async (segments) => {
      const prefix = `${segments.join("/")}/`;
      return [...files.keys()]
        .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .map((path) => path.slice(prefix.length))
        .sort();
    },
    readFile: async (segments, name) => {
      const text = files.get(join(segments, name));
      if (text === undefined) throw new Error(`not found: ${name}`);
      return text;
    },
    writeFile: async (segments, name, text) => {
      if (!connected) throw new Error("disconnected");
      files.set(join(segments, name), text);
    },
    deleteFile: async (segments, name) => {
      if (!connected) throw new Error("disconnected");
      files.delete(join(segments, name));
    },
  };

  return {
    host,
    files,
    setConnected: (value: boolean) => {
      connected = value;
    },
  };
}

export const skillText = (name: string, extra = "", body = "Do it.") =>
  `---\nname: ${name}\ndescription: ${name} description\n${extra}---\n${body}\n`;
