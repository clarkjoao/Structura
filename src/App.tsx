import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, type FutureConfig } from "react-router-dom";
import { useSharedDiagram } from "@/features/viewer/hooks/useSharedDiagram";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
const ServiceCatalog = lazy(() => import("@/pages/serviceCatalog"));
const PluginsPage = lazy(() => import("@/pages/settings/PluginsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const ROUTER_FUTURE: Partial<FutureConfig> = {
  v7_relativeSplatPath: true,
  v7_startTransition: true,
};

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
    <TooltipProvider>
      <Sonner />
      <DiagramPreviewSync />
      <Routes>
        <Route path="/" element={<Navigate to="/workspace" />} />
        <Route path="/workspace" element={<Dashboard />} />
        <Route path="/journeys" element={<JourneysPage />} />
        <Route path="/journeys/:id/edit" element={<JourneyEditorPage />} />
        <Route path="/model/:id" element={<ModelExplorer />} />
        <Route path="/collab/:roomId" element={<CollabRoom />} />
        <Route path="/catalog" element={<ServiceCatalog />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  );
}

const App = () => {
  const { sharedDiagram, ShareProvider } = useSharedDiagram();

  return (
    <BrowserRouter future={ROUTER_FUTURE}>
      {sharedDiagram ? (
        <ShareProvider>
          <Suspense fallback={<RouteFallback />}>
            <SharedDiagramView diagram={sharedDiagram} />
          </Suspense>
        </ShareProvider>
      ) : (
        <JourneyPlayerProvider>
          <JourneyPlayerBar />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/viewer" element={<ViewerPage />} />
              <Route path="*" element={<MainPages />} />
            </Routes>
          </Suspense>
        </JourneyPlayerProvider>
      )}
    </BrowserRouter>
  );
};

export default App;
