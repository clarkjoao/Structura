import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useDiagramPreviewSync } from "@/lib/diagram-preview";
import Dashboard from "./pages/Dashboard";
import ModelExplorer from "./pages/ModelExplorer";
import ServiceRegistry from "./pages/ServiceRegistry";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function DiagramPreviewSync() {
  useDiagramPreviewSync();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DiagramPreviewSync />
        <Routes>
          <Route path="/" element={<Navigate to="/workspace" />} />
          <Route path="/workspace" element={<Dashboard />} />
          <Route path="/model/:id" element={<ModelExplorer />} />
          <Route path="/catalog" element={<ServiceRegistry />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
