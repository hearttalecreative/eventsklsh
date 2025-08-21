import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { HelmetProvider, Helmet } from "react-helmet-async";
import Index from "./pages/Index";
import EventDetail from "./pages/EventDetail";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/Login";
import AdminEvents from "./pages/admin/Events";
import AdminRoute from "./routes/AdminRoute";
import Terms from "./pages/Terms";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCancel from "./pages/CheckoutCancel";
import CouponsPage from "./pages/admin/Coupons";
import AddAttendeePage from "./pages/admin/AddAttendee";
import VenuesPage from "./pages/admin/Venues";
import EventAttendeesPage from "./pages/admin/EventAttendees";
import QRCheckInPage from "./pages/admin/QRCheckIn";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <Helmet>
        <meta property="og:site_name" content="Kyle Lam Sound Healing" />
        <meta property="og:image" content="https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg" />
        <meta name="twitter:image" content="https://kylelamsoundhealing.com/wp-content/uploads/2025/02/Mesa-de-trabajo-34-100.jpg" />
      </Helmet>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto h-16 flex items-center justify-center">
              <Link to="/" className="flex items-center gap-3" aria-label="Home">
                <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg" alt="Logo" className="h-8 w-auto dark:hidden" loading="lazy" />
                <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-3logo-horizontal-blanco.svg" alt="Logo (dark)" className="h-8 w-auto hidden dark:block" loading="lazy" />
                <span className="sr-only">Home</span>
              </Link>
            </div>
          </header>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/event/:slugOrId" element={<EventDetail />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/events" element={<AdminRoute><AdminEvents /></AdminRoute>} />
            <Route path="/admin/coupons" element={<AdminRoute><CouponsPage /></AdminRoute>} />
            <Route path="/admin/venues" element={<AdminRoute><VenuesPage /></AdminRoute>} />
            <Route path="/admin/attendees/add" element={<AdminRoute><AddAttendeePage /></AdminRoute>} />
            <Route path="/admin/events/:eventId/attendees" element={<AdminRoute><EventAttendeesPage /></AdminRoute>} />
            <Route path="/admin/attendees" element={<AdminRoute><EventAttendeesPage /></AdminRoute>} />
            <Route path="/admin/qr/:qrCode" element={<QRCheckInPage />} />
            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/cancel" element={<CheckoutCancel />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          {!(typeof window !== 'undefined' && window.location.pathname === '/') && (
            <footer className="border-t mt-10">
              <div className="container mx-auto px-4 py-8 flex flex-col items-center gap-6 sm:gap-5">
                <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg" alt="Kyle Lam Sound Healing logo" className="h-8 w-auto opacity-80 dark:hidden" loading="lazy" />
                <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-3logo-horizontal-blanco.svg" alt="Kyle Lam Sound Healing logo (dark)" className="h-8 w-auto opacity-80 hidden dark:block" loading="lazy" />
                <nav aria-label="Footer" className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-4 sm:gap-6 text-base sm:text-sm text-muted-foreground">
                  <Link to="/" className="story-link">Events</Link>
                  <Link to="/admin/events" className="story-link">Event management</Link>
                  <Link to="/admin/venues" className="story-link">Venues</Link>
                  <Link to="/admin/coupons" className="story-link">Coupons</Link>
                  <Link to="/admin/attendees" className="story-link">Attendees</Link>
                  <Link to="/dashboard" className="story-link">Dashboard</Link>
                  <Link to="/admin/login" className="story-link">Admin access</Link>
                  <a href="https://kylelamsoundhealing.com/" target="_blank" rel="noopener noreferrer" className="story-link">Main site</a>
                </nav>
              </div>
            </footer>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
