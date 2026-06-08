import { createRoot } from "react-dom/client";
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import App from "./App.tsx";
import "./infrastructure/i18n/i18n";
import "./features/cloud/bootstrap";
import "./index.css";

loader.config({ monaco });

createRoot(document.getElementById("root")!).render(<App />);
