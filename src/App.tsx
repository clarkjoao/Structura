import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSharedDiagram, SharedDiagramView, ViewerPage } from "@/features/viewer";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDiagramPreviewSync } from "@/lib/diagram-preview";
import Dashboard from "@/pages/dashboard";
import ModelExplorer from "@/pages/modelExplorer";
import ServiceRegistry from "@/pages/serviceRegistry";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function DiagramPreviewSync() {
  useDiagramPreviewSync();
  return null;
}

const App = () => {
  const { sharedDiagram, ShareProvider } = useSharedDiagram();

  if (sharedDiagram) {
    return (
      <ShareProvider>
        <BrowserRouter future={{ v7_relativeSplatPath: true }}>
          <SharedDiagramView diagram={sharedDiagram} />
        </BrowserRouter>
      </ShareProvider>
    );
  }

  function MainPages() {
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


  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="*" element={<MainPages />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
