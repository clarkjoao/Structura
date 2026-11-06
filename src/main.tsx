import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./infrastructure/i18n/i18n";
import "./features/cloud/bootstrap";
import "./features/plugins/bootstrap";
import "./features/elements/bootstrap";
import "./index.css";
import { diagramStoreHydrated } from "./features/diagram/store";

// Render only once the workspace is loaded: IndexedDB answers asynchronously,
// and a screen drawn over the empty store would show no diagrams for a moment.
void diagramStoreHydrated.then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
