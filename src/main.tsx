import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./infrastructure/i18n/i18n";
import "./features/cloud/bootstrap";
import "./features/plugins/bootstrap";
import "./features/elements/bootstrap";
import { registerBuiltInDiagramKinds } from "./features/diagram-kinds/bootstrap";
import "./index.css";
import { diagramStoreHydrated } from "./features/diagram/store";

// Diagram kinds (ADR-0014): with none registered, the editor is the freehand one.
registerBuiltInDiagramKinds();

// Render only once the workspace is loaded: IndexedDB answers asynchronously,
// and a screen drawn over the empty store would show no diagrams for a moment.
void diagramStoreHydrated.then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
