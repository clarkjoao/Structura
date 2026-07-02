import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./infrastructure/i18n/i18n";
import "./features/cloud/bootstrap";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
