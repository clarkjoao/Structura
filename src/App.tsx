import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useDiagramPreviewSync } from "@/lib/diagram-preview";
import type { Diagram } from "@/features/diagram";
import { ShareContext } from "@/contexts/ShareContext";
import { decodeShareParam } from "@/lib/share-url";
import Dashboard from "@/pages/dashboard";
import ModelExplorer from "@/pages/modelExplorer";
import ServiceRegistry from "@/pages/serviceRegistry";
import SharedDiagramView from "@/pages/SharedDiagramView";
import EmbedPage from "./pages/EmbedPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function DiagramPreviewSync() {
  useDiagramPreviewSync();
  return null;
}

function isEmbedMode(): boolean {
  return new URLSearchParams(window.location.search).get("embed") === "true";
}

function getShareParamFromUrl(): string | null {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  return params.get("share");
}

function MainApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <DiagramPreviewSync />
      <Routes>
        <Route path="/" element={<Navigate to="/workspace" />} />
        <Route path="/workspace" element={<Dashboard />} />
        <Route path="/model/:id" element={<ModelExplorer />} />
        <Route path="/catalog" element={<ServiceRegistry />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const App = () => {
  const shareParam = getShareParamFromUrl();
  const sharedDiagram: Diagram | null = shareParam ? decodeShareParam(shareParam) : null;
  if (shareParam) {
    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", cleanUrl);
  }

  if (isEmbedMode()) {
    return <EmbedPage />;
  }

  if (sharedDiagram) {
    return (
      <ShareContext.Provider value={{ sharedDiagram, clearShared: () => {} }}>
        <BrowserRouter>
          <SharedDiagramView diagram={sharedDiagram} />
        </BrowserRouter>
      </ShareContext.Provider>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/embed" element={<EmbedPage />} />
        <Route path="*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
