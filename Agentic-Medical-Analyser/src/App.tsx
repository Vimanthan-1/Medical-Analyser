import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import HeroPage from "@/pages/HeroPage";
import IntakePage from "@/pages/IntakePage";
import ResultsPage from "@/pages/ResultsPage";
import HospitalsPage from "@/pages/HospitalsPage";
import ChatPage from "@/pages/ChatPage";
import Dashboard from "@/pages/Dashboard";
import ExplainPage from "@/pages/ExplainPage";
import NotFound from "@/pages/NotFound";
import { healthCheck } from "@/lib/api";

export default function App() {
  // Ping backend on mount so Render wakes up before user needs it
  useEffect(() => {
    healthCheck().catch(() => {/* silent – just warming up */ });
  }, []);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HeroPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/intake" element={<IntakePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/hospitals" element={<HospitalsPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/explain" element={<ExplainPage />} />
            <Route path="/diagnosis" element={<Navigate to="/intake" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
}
