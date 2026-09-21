import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, type FutureConfig } from "react-router-dom";
import { useSharedDiagram } from "@/features/viewer/hooks/useSharedDiagram";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDiagramPreviewSync } from "@/lib/diagram-preview";
import { useLLMStore } from "@/features/llm";
import { ModalOverlay } from "@/features/plugins/components/ModalOverlay";

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
const Workspace = lazy(() => import("@/pages/workspace"));
const ServicesPage = lazy(() => import("@/pages/services"));
const PluginsPage = lazy(() => import("@/pages/settings/PluginsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Walkthrough pages — only imported (and route registered) when VITE_ENABLE_WALKTHROUGHS="true".
// Using import.meta.env directly here (not the runtime constant) so that Vite's
// dead-code elimination removes the entire branch at build time when the flag is off.
const WalkthroughLibraryPage = lazy(
  () => import("@/features/walkthrough/pages/WalkthroughLibraryPage"),
);
const WalkthroughEditorPage = lazy(
  () => import("@/features/walkthrough/pages/WalkthroughEditorPage"),
);
const WalkthroughPlayerPage = lazy(
  () => import("@/features/walkthrough/pages/WalkthroughPlayerPage"),
);

// ASL Upstream pages — only imported (and route registered) when VITE_ENABLE_ASL_UPSTREAM="true".
const UpstreamLibraryPage = lazy(
  () => import("@/features/asl-upstream/pages/UpstreamLibraryPage"),
);
const UpstreamViewerPage = lazy(
  () => import("@/features/asl-upstream/pages/UpstreamViewerPage"),
);

const ROUTER_FUTURE: Partial<FutureConfig> = {
  v7_relativeSplatPath: true,
  v7_startTransition: true,
};

function DiagramPreviewSync(): null {
  useDiagramPreviewSync();
  return null;
}

/**
 * Hydrates the LLM chat thread cache from IndexedDB on app boot. Mounted
 * once at the top of `App` so it runs regardless of which route resolves.
 * Idempotent: `initChatThreads` short-circuits when the cache is already
 * hydrated.
 */
function ChatThreadsHydrator(): null {
  useEffect(() => {
    void useLLMStore.getState().initChatThreads();
  }, []);
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
      <ModalOverlay />
      <DiagramPreviewSync />
      <Routes>
        <Route path="/" element={<Navigate to="/workspace" />} />
        <Route path="/workspace" element={<Dashboard />} />
        <Route path="/model/:id" element={<Workspace />} />
        <Route path="/collab/:roomId" element={<CollabRoom />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/catalog" element={<Navigate to="/services" replace />} />
        <Route path="/plugins" element={<PluginsPage />} />
        {import.meta.env.VITE_ENABLE_WALKTHROUGHS === "true" && (
          <>
            <Route path="/workflows" element={<WalkthroughLibraryPage />} />
            <Route path="/workflow/:id/edit" element={<WalkthroughEditorPage />} />
            <Route path="/workflow/:id/step/:step" element={<WalkthroughPlayerPage />} />
          </>
        )}
        {import.meta.env.VITE_ENABLE_ASL_UPSTREAM === "true" && (
          <>
            <Route path="/upstream" element={<UpstreamLibraryPage />} />
            <Route path="/upstream/:namespace/view" element={<UpstreamViewerPage />} />
          </>
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  );
}

const App = () => {
  const { sharedDiagram, sharedFlowId, ShareProvider } = useSharedDiagram();

  return (
    <BrowserRouter future={ROUTER_FUTURE}>
      <ChatThreadsHydrator />
      {sharedDiagram ? (
        <ShareProvider>
          <Suspense fallback={<RouteFallback />}>
            <SharedDiagramView diagram={sharedDiagram} flowId={sharedFlowId} />
          </Suspense>
        </ShareProvider>
      ) : (
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/*
              The reading route, and the only one. Outside `MainPages` on
              purpose: it is a whole-window surface with no app chrome, and a
              webview pointed at it should not mount the toaster, the plugin
              modal host or the preview sync.
            */}
            <Route path="/viewer" element={<ViewerPage />} />
            <Route path="*" element={<MainPages />} />
          </Routes>
        </Suspense>
      )}
    </BrowserRouter>
  );
};

export default App;
