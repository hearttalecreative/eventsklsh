import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import EventDetail from "./pages/EventDetail";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/Login";
import AdminEvents from "./pages/admin/Events";
import AdminRoute from "./routes/AdminRoute";
import Terms from "./pages/Terms";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <header className="border-b bg-background">
            <div className="container mx-auto h-14 flex items-center justify-between gap-4">
              <Link to="/" className="flex items-center gap-3" aria-label="Kyle Lam Sound Healing - Home">
                <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg" alt="Kyle Lam Sound Healing logo" className="h-8 w-auto" loading="lazy" />
                <span className="sr-only">Kyle Lam Sound Healing</span>
              </Link>
              <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
                <Link to="/" className="hover:underline">Eventos</Link>
                <Link to="/admin/events" className="hover:underline">Event management</Link>
                <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                <Link to="/admin/login" className="hover:underline">Admin access</Link>
              </nav>
            </div>
          </header>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/terms" element={<Terms />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <footer className="border-t mt-10">
            <div className="container mx-auto py-8 flex flex-col items-center gap-4">
              <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg" alt="Kyle Lam Sound Healing logo" className="h-8 w-auto opacity-80" loading="lazy" />
              <nav aria-label="Footer" className="flex flex-wrap items-center gap-4 text-sm">
                <Link to="/" className="hover:underline">Eventos</Link>
                <Link to="/admin/events" className="hover:underline">Event management</Link>
                <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                <Link to="/admin/login" className="hover:underline">Admin access</Link>
                <a href="https://kylelamsoundhealing.com/" target="_blank" rel="noopener noreferrer" className="hover:underline">Main site</a>
              </nav>
            </div>
          </footer>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
