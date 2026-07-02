import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSharedDiagram, SharedDiagramView } from "@/features/viewer";
import { ViewerPage } from "@/pages/ViewerPage";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDiagramPreviewSync } from "@/lib/diagram-preview";
import { CollabRoom } from "@/features/collaboration";
import Dashboard from "@/pages/dashboard";
import JourneyEditorPage from "@/pages/journeys/JourneyEditorPage";
import JourneysPage from "@/pages/journeys/JourneysPage";
import { JourneyPlayerBar, JourneyPlayerProvider } from "@/features/journeys";
import ModelExplorer from "@/pages/modelExplorer";
import ServiceRegistry from "@/pages/serviceRegistry";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function DiagramPreviewSync() {
  useDiagramPreviewSync();
  return null;
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
          <Route path="/journeys" element={<JourneysPage />} />
          <Route path="/journeys/:id/edit" element={<JourneyEditorPage />} />
          <Route path="/model/:id" element={<ModelExplorer />} />
          <Route path="/collab/:roomId" element={<CollabRoom />} />
          <Route path="/catalog" element={<ServiceRegistry />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </QueryClientProvider>
  );
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

  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <JourneyPlayerProvider>
        <JourneyPlayerBar />
        <Routes>
          <Route path="/viewer" element={<ViewerPage />} />
          <Route path="*" element={<MainPages />} />
        </Routes>
      </JourneyPlayerProvider>
    </BrowserRouter>
  );
};

export default App;
