/**
 * Entry of the embeddable preview (`embed.html`, `npm run build:embed`): the viewer alone,
 * with no app routes, store persistence or editor — for hosts such as the VSCode extension
 * that post a graph and show it read-only. Built with relative paths so it can be served
 * from any base. Protocol: ./protocol.ts.
 */
import { createRoot } from "react-dom/client";
// Card badges call `useNavigate`; there is nowhere to navigate to, but they need a router.
import { MemoryRouter } from "react-router-dom";
import "@/infrastructure/i18n/i18n";
import "@/features/cloud/bootstrap";
import "@/features/elements/bootstrap";
import "@/index.css";
import { EmbedPreview } from "./EmbedPreview";

createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <EmbedPreview />
  </MemoryRouter>,
);
