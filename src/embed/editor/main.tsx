/**
 * Entry of the editable embed (`embed-editor.html`, built with `npm run build:embed`): the
 * Structura canvas on one in-memory diagram, for hosts such as the VSCode extension that bind
 * it to files. Protocol: ./protocol.ts.
 */
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "@/infrastructure/i18n/i18n";
import "@/features/cloud/bootstrap";
import "@/features/elements/bootstrap";
import "@/index.css";
import { Toaster } from "@/components/ui/sonner";
import { EmbedEditor } from "./EmbedEditor";

createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <EmbedEditor />
    <Toaster />
  </MemoryRouter>,
);
