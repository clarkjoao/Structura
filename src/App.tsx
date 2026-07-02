import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSharedDiagram } from "@/features/viewer/hooks/useSharedDiagram";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDiagramPreviewSync } from "@/lib/diagram-preview";
import { JourneyPlayerBar, JourneyPlayerProvider } from "@/features/journeys";

const ViewerPage = lazy(() =>
  import("@/pages/ViewerPage").then((m) => ({ default: m.ViewerPage })),
);
const SharedDiagramView = lazy(() =>
  import("@/features/viewer/components/SharedDiagramView").then((m) => ({
    default: m.SharedDiagramView,
  })),
);
const CollabRoom = lazy(() =>
  import("@/features/collaboration/components/CollabRoom").then((m) => ({
    default: m.CollabRoom,
  })),
);
const Dashboard = lazy(() => import("@/pages/dashboard"));
const JourneyEditorPage = lazy(() => import("@/pages/journeys/JourneyEditorPage"));
const JourneysPage = lazy(() => import("@/pages/journeys/JourneysPage"));
const ModelExplorer = lazy(() => import("@/pages/modelExplorer"));
const ServiceRegistry = lazy(() => import("@/pages/serviceRegistry"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function DiagramPreviewSync(): null {
  useDiagramPreviewSync();
  return null;
}

function RouteFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
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
          <Suspense fallback={<RouteFallback />}>
            <SharedDiagramView diagram={sharedDiagram} />
          </Suspense>
        </BrowserRouter>
      </ShareProvider>
    );
  }

  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <JourneyPlayerProvider>
        <JourneyPlayerBar />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/viewer" element={<ViewerPage />} />
            <Route path="*" element={<MainPages />} />
          </Routes>
        </Suspense>
      </JourneyPlayerProvider>
    </BrowserRouter>
  );
};

export default App;
