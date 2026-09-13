import { spawn } from "node:child_process";
import { openSync, writeFileSync } from "node:fs";
const log = openSync(process.argv[2], "a");
const child = spawn("npx", ["vite", "preview", "--port", "8199", "--strictPort"], {
  cwd: "/Users/clark/www/Structura",
  detached: true,            // own session/process group (macOS has no setsid)
  stdio: ["ignore", log, log],
});
child.unref();
writeFileSync(process.argv[3], String(child.pid));
console.log("parent pid", child.pid);
