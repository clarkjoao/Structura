import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    {
      name: "embed-raw-url",
      configureServer(server) {
        server.middlewares.use("/embed", (_req, _res, next) => {
          // Keep embed route middleware chain simple; React Router handles query parsing.
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["aws-react-icons"],
  },
}));
