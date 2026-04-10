import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
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
import QRCheckIn from "./pages/QRCheckIn";
import TicketSales from "./pages/admin/TicketSales";
import EventPurchaseDetails from "./pages/admin/EventPurchaseDetails";
import ManageAdmins from "./pages/admin/ManageAdmins";
import SystemLogs from "./pages/admin/SystemLogs";
import CaliforniaEvents from "./pages/CaliforniaEvents";
import FloridaEvents from "./pages/FloridaEvents";
import TrainingPrograms from "./pages/TrainingPrograms";
import TrainingDetail from "./pages/TrainingDetail";
import TrainingSuccess from "./pages/TrainingSuccess";
import AdminTrainingPrograms from "./pages/admin/TrainingPrograms";
import PeopleDashboard from "./pages/admin/PeopleDashboard";


const queryClient = new QueryClient();

const HIDE_HEADER_PATHS = ['/trainings', '/training-success'];
const HIDE_FOOTER_PATHS = ['/trainings', '/training-success', '/admin', '/admin/login', '/dashboard'];

const shouldHide = (pathname: string, paths: string[]) =>
  paths.some(p =>
    pathname === p ||
    (p === '/trainings' && pathname.startsWith('/trainings/')) ||
    (p === '/admin' && pathname.startsWith('/admin')) ||
    (p === '/dashboard' && pathname.startsWith('/dashboard'))
  );

const AppHeader = () => {
  const { pathname } = useLocation();
  if (shouldHide(pathname, HIDE_HEADER_PATHS)) return null;
  return (
    <header className="sticky top-0 z-50 shadow-horizon bg-white/70 backdrop-blur-xl backdrop-saturate-150 border-b border-white/50 transition-all duration-200">
      <div className="container mx-auto h-16 md:h-20 flex items-center justify-center lg:justify-start px-4">
        <Link to="/" className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl p-1.5 transition-transform hover:scale-105" aria-label="Home">
          <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg" alt="Logo" className="h-8 md:h-11 w-auto dark:hidden" loading="lazy" />
          <img src="https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-3logo-horizontal-blanco.svg" alt="Logo (dark)" className="h-8 md:h-11 w-auto hidden dark:block" loading="lazy" />
          <span className="sr-only">Home</span>
        </Link>
      </div>
    </header>
  );
};

const AppFooter = () => {
  const { pathname } = useLocation();
  if (shouldHide(pathname, HIDE_FOOTER_PATHS)) return null;
  return (
    <footer className="w-full mt-auto border-t border-white/50 bg-white/50 backdrop-blur-sm">
      <div className="container mx-auto max-w-5xl px-4 py-8 lg:py-12 text-center text-sm text-muted-foreground/70">
        <p>
          © Copyright {new Date().getFullYear()} Kyle Lam Sound Healing. All Rights Reserved. | Developed with ❤️ by{' '}
          <a
            href="https://hearttalecreative.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 font-medium transition-colors rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Hearttale Creative
          </a>
          .
        </p>
      </div>
    </footer>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <Helmet>
        <meta property="og:site_name" content="Kyle Lam Sound Healing" />
      </Helmet>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppHeader />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/event/:slugOrId" element={<EventDetail />} />
            <Route path="/events/california" element={<CaliforniaEvents />} />
            <Route path="/events/florida" element={<FloridaEvents />} />
            <Route path="/trainings" element={<TrainingPrograms />} />
            <Route path="/trainings/category/:slug" element={<TrainingPrograms />} />
            <Route path="/trainings/:programId" element={<TrainingDetail />} />
            <Route path="/training-success" element={<TrainingSuccess />} />
             <Route path="/admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/admin/people" element={<AdminRoute><PeopleDashboard /></AdminRoute>} />
            <Route path="/admin/training-programs" element={<AdminRoute><AdminTrainingPrograms /></AdminRoute>} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/events" element={<AdminRoute><AdminEvents /></AdminRoute>} />
            <Route path="/admin/coupons" element={<AdminRoute><CouponsPage /></AdminRoute>} />
            <Route path="/admin/venues" element={<AdminRoute><VenuesPage /></AdminRoute>} />
            <Route path="/admin/ticket-sales" element={<AdminRoute><TicketSales /></AdminRoute>} />
            <Route path="/admin/system-logs" element={<AdminRoute><SystemLogs /></AdminRoute>} />
            <Route path="/admin/events/:eventId/purchases" element={<AdminRoute><EventPurchaseDetails /></AdminRoute>} />
            <Route path="/admin/attendees/add" element={<AdminRoute><AddAttendeePage /></AdminRoute>} />
            <Route path="/admin/events/:eventId/attendees" element={<AdminRoute><EventAttendeesPage /></AdminRoute>} />
            <Route path="/admin/attendees" element={<AdminRoute><EventAttendeesPage /></AdminRoute>} />

            <Route path="/admin/manage-admins" element={<AdminRoute><ManageAdmins /></AdminRoute>} />
            <Route path="/qr/:qrCode" element={<QRCheckIn />} />
            <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/checkout/success" element={<CheckoutSuccess />} />
            <Route path="/checkout/cancel" element={<CheckoutCancel />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AppFooter />
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
